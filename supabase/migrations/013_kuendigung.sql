-- =========================================================
-- GSRA Kündigungen („Verträge hier kündigen“, § 312k BGB)
-- Jede Kündigung wird hier mit Eingangszeitpunkt festgehalten. Eingetragen wird nur von der Server-Funktion
-- „cancel-contract“ (Dienstschlüssel). Einmal komplett im SQL Editor ausführen (darf mehrfach laufen).
-- =========================================================

create table if not exists public.cancellations (
  id                     uuid primary key default gen_random_uuid(),
  reference              text not null unique,
  created_at             timestamptz not null default now(),
  user_id                uuid references auth.users(id) on delete set null,
  name                   text not null,
  email                  text not null,
  account_hint           text,
  contract               text not null check (contract in ('pole', 'alliance')),
  kind                   text not null check (kind in ('ordentlich', 'ausserordentlich')),
  reason                 text,
  requested_date         date,
  status                 text not null default 'eingegangen'
                         check (status in ('eingegangen', 'vorgemerkt', 'pruefung', 'kein_vertrag', 'fehler', 'erledigt')),
  effective_at           timestamptz,
  stripe_subscription_id text,
  email_sent             boolean not null default false,
  handled_by             uuid references auth.users(id) on delete set null,
  handled_at             timestamptz
);
create index if not exists cancellations_email_idx on public.cancellations (lower(email), created_at desc);

alter table public.cancellations enable row level security;

-- Lesen: eigene Kündigungen bzw. Website-Admins alle. Schreiben nur über die Server-Funktion (Dienstschlüssel).
drop policy if exists "GSRA: Eigene Kündigungen" on public.cancellations;
create policy "GSRA: Eigene Kündigungen" on public.cancellations
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_site_admin()));

-- Admins können eine Kündigung als erledigt markieren (z. B. nach Prüfung einer außerordentlichen Kündigung)
drop policy if exists "GSRA: Kündigungen bearbeiten (Admins)" on public.cancellations;
create policy "GSRA: Kündigungen bearbeiten (Admins)" on public.cancellations
  for update to authenticated using ((select public.is_site_admin())) with check ((select public.is_site_admin()));

-- Konto zu einer E-Mail-Adresse (Kündigung ohne Anmeldung) – nur für die Server-Funktion
create or replace function public.cancellation_user_by_email(_email text)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  _id uuid;
begin
  select u.id into _id from auth.users u where lower(u.email) = lower(trim(_email)) limit 1;
  return _id;
end;
$$;
revoke execute on function public.cancellation_user_by_email(text) from public, anon, authenticated;
do $$
begin
  grant execute on function public.cancellation_user_by_email(text) to service_role;
exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
end $$;

notify pgrst, 'reload schema';

-- Kontrolle (ändert nichts)
select 'Kündigungen' as pruefung,
       case when to_regclass('public.cancellations') is not null
             and to_regprocedure('public.cancellation_user_by_email(text)') is not null
            then 'bereit' else 'FEHLT' end as ergebnis;
