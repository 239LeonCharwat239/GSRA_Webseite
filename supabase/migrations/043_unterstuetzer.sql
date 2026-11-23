-- =========================================================
-- GSRA 043 – Unterstützen: einmalig oder monatlich, Unterstützerwand und Abzeichen (23.11.)
--  * Bezahlt wird über Stripe (Server-Funktionen create-checkout und stripe-webhook). Den Betrag wählt die Person,
--    die Grenzen prüft der Server (einmalig 3–500 €, monatlich 2–100 €).
--  * Beträge sind nie öffentlich: Sie stehen nur in support_payments, die niemand über die Webseite lesen kann.
--  * Name auf der Unterstützerwand und Abzeichen im Profil nur, wenn die Person es selbst einschaltet (Standard: aus).
--  * Die monatliche Unterstützung lässt sich jederzeit beenden – über „Abo verwalten“ oder „Verträge hier kündigen“.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 011–013 (Zahlungen, Kündigung) voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Tabellen
-- ---------------------------------------------------------
create table if not exists public.supporters (
  user_id                      uuid primary key references auth.users(id) on delete cascade,
  show_public                  boolean not null default false,
  since                        timestamptz,            -- erste Unterstützung (null = noch keine)
  last_support_at              timestamptz,
  monthly_subscription_id      text unique,
  monthly_status               text,
  monthly_period_end           timestamptz,
  monthly_cancel_at_period_end boolean not null default false,
  updated_at                   timestamptz not null default now()
);

create table if not exists public.support_payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  kind         text not null check (kind in ('einmalig', 'monatlich')),
  stripe_ref   text not null unique,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency     text,
  created_at   timestamptz not null default now()
);

alter table public.supporters enable row level security;
alter table public.support_payments enable row level security;
revoke all on public.supporters, public.support_payments from anon, authenticated;
-- Gelesen und geändert wird nur über die Funktionen unten

-- „Verträge hier kündigen“ kennt jetzt auch die monatliche Unterstützung
alter table public.cancellations drop constraint if exists cancellations_contract_check;
alter table public.cancellations add constraint cancellations_contract_check
  check (contract in ('pole', 'alliance', 'unterstuetzung'));

-- ---------------------------------------------------------
-- 2) Funktionen für die Webseite
-- ---------------------------------------------------------
-- Eigener Stand (Unterstützen-Seite, Dashboard)
create or replace function public.my_support()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'unterstuetzer', coalesce(s.since is not null, false),
    'oeffentlich',   coalesce(s.show_public, false),
    'seit',          s.since,
    'monatlich',     coalesce(s.monthly_status in ('active', 'trialing', 'past_due'), false),
    'monatlich_bis', s.monthly_period_end,
    'gekuendigt',    coalesce(s.monthly_cancel_at_period_end, false))
  from (select 1) x
  left join public.supporters s on s.user_id = auth.uid();
$$;

-- Name auf der Wand / Abzeichen ein- oder ausschalten (auch vor der ersten Unterstützung möglich)
create or replace function public.set_supporter_visibility(_show boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  insert into public.supporters (user_id, show_public) values (auth.uid(), coalesce(_show, false))
  on conflict (user_id) do update set show_public = coalesce(_show, false), updated_at = now();
  return coalesce(_show, false);
end;
$$;

-- Unterstützerwand: nur Name, Profilbild und Monat der ersten Unterstützung – nie Beträge oder Häufigkeit
create or replace function public.supporter_wall()
returns table (username text, avatar_url text, seit date)
language sql
stable
security definer
set search_path = public
as $$
  select p.username, p.avatar_url, date_trunc('month', s.since)::date
  from public.supporters s
  join public.profiles p on p.id = s.user_id
  where s.show_public and s.since is not null and coalesce(p.username, '') <> ''
    and not exists (select 1 from public.user_bans b where b.user_id = s.user_id and b.lifted_at is null
                    and (b.banned_until is null or b.banned_until > now()))
  order by s.since, p.username
  limit 1000;
$$;

-- Abzeichen: Welche dieser Personen zeigen sich als Unterstützer? (höchstens 200 auf einmal)
create or replace function public.supporter_badges(_users uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id
  from public.supporters s
  where s.user_id = any ((coalesce(_users, '{}'::uuid[]))[1:200])
    and s.show_public and s.since is not null;
$$;

-- ---------------------------------------------------------
-- 3) Funktionen nur für den Server (Stripe-Webhook)
-- ---------------------------------------------------------
create or replace function public.stripe_apply_support(_ref text, _user uuid, _kind text, _amount_cents integer,
                                                       _currency text, _customer_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user is null or coalesce(_ref, '') = '' or _kind not in ('einmalig', 'monatlich') then return 'ungültig'; end if;
  if _customer_id is not null then
    insert into public.billing_customers (user_id, stripe_customer_id) values (_user, _customer_id)
    on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id;
  end if;
  -- Jede Zahlung genau einmal (Stripe kann Meldungen wiederholen)
  insert into public.support_payments (user_id, kind, stripe_ref, amount_cents, currency)
  values (_user, _kind, _ref, _amount_cents, _currency)
  on conflict (stripe_ref) do nothing;
  if not found then return 'bereits verbucht'; end if;
  insert into public.supporters (user_id, since, last_support_at) values (_user, now(), now())
  on conflict (user_id) do update set since = coalesce(supporters.since, now()), last_support_at = now(), updated_at = now();
  return 'verbucht';
end;
$$;

create or replace function public.stripe_sync_support(_subscription_id text, _user uuid, _customer_id text, _status text,
                                                      _period_end timestamptz, _cancel_at_period_end boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user is null or coalesce(_subscription_id, '') = '' then return 'ungültig'; end if;
  if _customer_id is not null then
    insert into public.billing_customers (user_id, stripe_customer_id) values (_user, _customer_id)
    on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id;
  end if;
  insert into public.supporters (user_id, since, last_support_at, monthly_subscription_id, monthly_status,
                                 monthly_period_end, monthly_cancel_at_period_end)
  values (_user, case when _status in ('active', 'trialing') then now() end, case when _status in ('active', 'trialing') then now() end,
          _subscription_id, _status, _period_end, coalesce(_cancel_at_period_end, false))
  on conflict (user_id) do update set
    since = coalesce(supporters.since, case when _status in ('active', 'trialing') then now() end),
    monthly_subscription_id = _subscription_id,
    monthly_status = _status,
    monthly_period_end = _period_end,
    monthly_cancel_at_period_end = coalesce(_cancel_at_period_end, false),
    updated_at = now()
  -- Eine ältere, beendete Unterstützung überschreibt keine neuere laufende
  where supporters.monthly_subscription_id is null
     or supporters.monthly_subscription_id = _subscription_id
     or supporters.monthly_status not in ('active', 'trialing', 'past_due');
  return 'abgeglichen';
end;
$$;

-- ---------------------------------------------------------
-- 4) Rechte
-- ---------------------------------------------------------
revoke execute on function public.my_support() from public, anon;
revoke execute on function public.set_supporter_visibility(boolean) from public, anon;
grant execute on function public.my_support() to authenticated;
grant execute on function public.set_supporter_visibility(boolean) to authenticated;
revoke execute on function public.supporter_wall() from public;
revoke execute on function public.supporter_badges(uuid[]) from public;
grant execute on function public.supporter_wall() to anon, authenticated;
grant execute on function public.supporter_badges(uuid[]) to anon, authenticated;
revoke execute on function public.stripe_apply_support(text, uuid, text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.stripe_sync_support(text, uuid, text, text, timestamptz, boolean) from public, anon, authenticated;
do $$
begin
  execute 'grant execute on function public.stripe_apply_support(text, uuid, text, integer, text, text) to service_role';
  execute 'grant execute on function public.stripe_sync_support(text, uuid, text, text, timestamptz, boolean) to service_role';
exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „ja“, „ja“, „bereit“)
-- ---------------------------------------------------------
select 'Unterstützer und Zahlungen' as pruefung,
       case when to_regclass('public.supporters') is not null and to_regclass('public.support_payments') is not null
             and to_regprocedure('public.supporter_wall()') is not null then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Beträge nicht lesbar',
       case when not has_table_privilege('anon', 'public.support_payments', 'select')
             and not has_table_privilege('authenticated', 'public.support_payments', 'select')
             and not has_table_privilege('authenticated', 'public.supporters', 'select') then 'ja' else 'NEIN' end
union all
select 'Verbuchen nur für den Server',
       case when not has_function_privilege('authenticated', 'public.stripe_apply_support(text, uuid, text, integer, text, text)', 'execute')
             and not has_function_privilege('anon', 'public.stripe_sync_support(text, uuid, text, text, timestamptz, boolean)', 'execute')
            then 'ja' else 'NEIN' end
union all
select 'Kündigung der monatlichen Unterstützung',
       case when pg_get_constraintdef((select oid from pg_constraint where conname = 'cancellations_contract_check')) like '%unterstuetzung%'
            then 'bereit' else 'FEHLT' end;
