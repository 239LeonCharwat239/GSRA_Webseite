-- =========================================================
-- GSRA 025 – Coaching bezahlen mit Stripe Connect (16.11.)
-- Entscheidungen vom 16.11.:
--  * Stripe rechnet direkt mit dem Coach ab (Standard-Konto mit eigenem Stripe-Dashboard): Die Zahlung geht
--    auf das Stripe-Konto des Coaches, die Stripe-Gebühren trägt der Coach. Die GSRA erhält nur die
--    10 % Servicegebühr von Käufern mit Paddock.
--  * Der Coach legt beim Annehmen einen festen Termin fest (bis zur Bezahlung änderbar).
--  * Käufer stornieren bis 24 Stunden vor dem Termin kostenlos (alles zurück, auch die Servicegebühr),
--    danach nicht mehr. Sagt der Coach ab, bekommt der Käufer immer alles zurück.
-- Zahlungsdaten schreiben nur die Server-Funktionen (Edge Functions mit service_role), nie die Webseite.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 024 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Auszahlungskonten der Coaches (Stripe-Konto). Jeder sieht nur sein eigenes, schreiben nur der Server.
-- ---------------------------------------------------------
create table if not exists public.coach_payout_accounts (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id  text not null unique check (stripe_account_id like 'acct\_%'),
  country            text check (char_length(country) = 2),
  charges_enabled    boolean not null default false,
  details_submitted  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.coach_payout_accounts enable row level security;
revoke all on public.coach_payout_accounts from anon, authenticated;
grant select on public.coach_payout_accounts to authenticated;

drop policy if exists "GSRA eigenes Auszahlungskonto" on public.coach_payout_accounts;
create policy "GSRA eigenes Auszahlungskonto" on public.coach_payout_accounts for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.coach_payout_accounts;
create policy "Gesperrte Konten haben keinen Zugriff" on public.coach_payout_accounts as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));
drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.coach_payout_accounts;
create policy "GSRA Zwei-Faktor erforderlich" on public.coach_payout_accounts as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Kann dieser Coach Zahlungen annehmen? (für Käufer – ohne die Kontonummer preiszugeben)
create or replace function public.coach_payment_ready(_user uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select coalesce((select charges_enabled from public.coach_payout_accounts where user_id = _user), false);
$$;

-- ---------------------------------------------------------
-- 2) Anfragen: Termin, Zahlung, Erstattung
-- ---------------------------------------------------------
alter table public.coaching_bookings
  add column if not exists scheduled_at          timestamptz,
  add column if not exists stripe_session_id     text,
  add column if not exists checkout_started_at   timestamptz,
  add column if not exists stripe_payment_intent text,
  add column if not exists paid_at               timestamptz,
  add column if not exists refunded_at           timestamptz,
  add column if not exists cancelled_by          uuid,
  add column if not exists completed_at          timestamptz;
alter table public.coaching_bookings drop constraint if exists coaching_bookings_status_check;
alter table public.coaching_bookings add constraint coaching_bookings_status_check
  check (status in ('angefragt', 'angenommen', 'abgelehnt', 'storniert', 'bezahlt', 'erledigt', 'erstattet'));
create unique index if not exists coaching_bookings_payment_idx on public.coaching_bookings (stripe_payment_intent)
  where stripe_payment_intent is not null;

-- Gesperrt? (für Server-Funktionen, die ohne angemeldete Person laufen)
create or replace function public.coaching_user_banned(_user uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (select 1 from public.user_bans
                 where user_id = _user and lifted_at is null and (banned_until is null or banned_until > now()));
$$;

-- Coach nimmt an (mit festem Termin) oder lehnt ab – ersetzt die Fassung aus 024
drop function if exists public.coaching_respond(uuid, boolean);
create or replace function public.coaching_respond(_booking_id uuid, _accept boolean, _scheduled_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _accept and (_scheduled_at is null or _scheduled_at < now() + interval '1 hour' or _scheduled_at > now() + interval '180 days') then
    raise exception 'Bitte wähle einen Termin, der mindestens 1 Stunde und höchstens 6 Monate in der Zukunft liegt.';
  end if;
  update public.coaching_bookings
  set status = case when _accept then 'angenommen' else 'abgelehnt' end,
      scheduled_at = case when _accept then _scheduled_at else scheduled_at end,
      updated_at = now()
  where id = _booking_id and coach_id = auth.uid() and status = 'angefragt';
  if not found then raise exception 'Diese Anfrage gibt es nicht mehr oder sie wurde schon beantwortet.'; end if;
end;
$$;

-- Termin ändern, solange noch nicht bezahlt ist (z. B. nach Absprache im Messenger)
create or replace function public.coaching_set_time(_booking_id uuid, _scheduled_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _scheduled_at is null or _scheduled_at < now() + interval '1 hour' or _scheduled_at > now() + interval '180 days' then
    raise exception 'Bitte wähle einen Termin, der mindestens 1 Stunde und höchstens 6 Monate in der Zukunft liegt.';
  end if;
  update public.coaching_bookings set scheduled_at = _scheduled_at, updated_at = now()
  where id = _booking_id and coach_id = auth.uid() and status = 'angenommen';
  if not found then raise exception 'Den Termin kannst du nur ändern, solange noch nicht bezahlt ist.'; end if;
end;
$$;

-- Coach meldet das Coaching als erledigt (frühestens zum Termin)
create or replace function public.coaching_mark_done(_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  update public.coaching_bookings set status = 'erledigt', completed_at = now(), updated_at = now()
  where id = _booking_id and coach_id = auth.uid() and status = 'bezahlt' and scheduled_at <= now();
  if not found then raise exception 'Als erledigt markieren kannst du ein bezahltes Coaching ab dem Termin.'; end if;
end;
$$;

-- ---------------------------------------------------------
-- 3) Nur für die Server-Funktionen (Stripe): prüfen, verbuchen, erstatten
-- ---------------------------------------------------------
-- Bezahlseite: darf diese Person jetzt bezahlen? Liefert Betrag, Gebühr und Stripe-Konto des Coaches.
create or replace function public.coaching_checkout_info(_booking_id uuid, _user uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _b   public.coaching_bookings;
  _acc public.coach_payout_accounts;
begin
  if public.coaching_user_banned(_user) then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _b from public.coaching_bookings where id = _booking_id and buyer_id = _user;
  if _b.id is null then raise exception 'Diese Anfrage gibt es nicht.'; end if;
  if _b.status = 'bezahlt' then raise exception 'Dieses Coaching ist schon bezahlt.'; end if;
  if _b.status <> 'angenommen' then raise exception 'Bezahlen kannst du, sobald der Coach deine Anfrage angenommen hat.'; end if;
  if _b.scheduled_at is null or _b.scheduled_at <= now() then
    raise exception 'Der Termin liegt in der Vergangenheit. Bitte stimmt im Messenger einen neuen Termin ab.';
  end if;
  select * into _acc from public.coach_payout_accounts where user_id = _b.coach_id;
  if _acc.user_id is null or not _acc.charges_enabled then
    raise exception 'Der Coach richtet die Bezahlung gerade noch ein. Bitte versuche es später erneut.';
  end if;
  return jsonb_build_object(
    'total_cents', _b.total_cents, 'fee_cents', _b.fee_cents, 'price_cents', _b.price_cents,
    'title', _b.offer_title, 'duration_minutes', _b.duration_minutes, 'scheduled_at', _b.scheduled_at,
    'coach_name', (select username from public.profiles where id = _b.coach_id),
    'stripe_account_id', _acc.stripe_account_id,
    'stripe_session_id', _b.stripe_session_id, 'checkout_started_at', _b.checkout_started_at);
end;
$$;

create or replace function public.coaching_checkout_started(_booking_id uuid, _session_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coaching_bookings set stripe_session_id = _session_id, checkout_started_at = now(), updated_at = now()
  where id = _booking_id and status = 'angenommen';
$$;

-- Zahlung verbuchen (Webhook). Ergebnis: 'bezahlt', 'schon_verbucht' oder 'erstatten'
-- ('erstatten' = Anfrage inzwischen storniert, Betrag, Konto oder Bezahlseite passt nicht → Server erstattet sofort).
-- Nur die Bezahlseite, die coaching-checkout angelegt hat, zählt – eine selbst gebaute Bezahlseite des Coaches nicht.
drop function if exists public.coaching_mark_paid(uuid, text, integer, text);
create or replace function public.coaching_mark_paid(_booking_id uuid, _session_id text, _payment_intent text, _amount_total integer, _account text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _b public.coaching_bookings;
begin
  select * into _b from public.coaching_bookings where id = _booking_id for update;
  if _b.id is null then return 'erstatten'; end if;
  if _b.stripe_payment_intent = _payment_intent and _b.status in ('bezahlt', 'erledigt', 'erstattet') then return 'schon_verbucht'; end if;
  if _b.status <> 'angenommen' or _amount_total is distinct from _b.total_cents
     or _session_id is distinct from _b.stripe_session_id
     or not exists (select 1 from public.coach_payout_accounts where user_id = _b.coach_id and stripe_account_id = _account) then
    return 'erstatten';
  end if;
  update public.coaching_bookings
  set status = 'bezahlt', stripe_payment_intent = _payment_intent, paid_at = now(), updated_at = now()
  where id = _booking_id;
  return 'bezahlt';
end;
$$;

-- Erstattung prüfen: Käufer bis 24 Stunden vor dem Termin, Coach immer (solange nicht erledigt)
create or replace function public.coaching_refund_info(_booking_id uuid, _user uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _b public.coaching_bookings;
begin
  if public.coaching_user_banned(_user) then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _b from public.coaching_bookings where id = _booking_id and (buyer_id = _user or coach_id = _user);
  if _b.id is null then raise exception 'Diese Anfrage gibt es nicht.'; end if;
  if _b.status <> 'bezahlt' or _b.stripe_payment_intent is null then
    raise exception 'Erstatten lässt sich nur ein bezahltes Coaching, das noch nicht stattgefunden hat.';
  end if;
  if _user = _b.buyer_id and _user <> _b.coach_id and _b.scheduled_at - now() < interval '24 hours' then
    raise exception 'Kostenlos stornieren ging nur bis 24 Stunden vor dem Termin. Schreib dem Coach im Messenger.';
  end if;
  return jsonb_build_object(
    'payment_intent', _b.stripe_payment_intent, 'fee_cents', _b.fee_cents,
    'stripe_account_id', (select stripe_account_id from public.coach_payout_accounts where user_id = _b.coach_id),
    'by', case when _user = _b.coach_id then 'coach' else 'buyer' end);
end;
$$;

-- Erstattung verbuchen (nach Erfolg bei Stripe oder per Webhook, z. B. wenn der Coach im Stripe-Dashboard erstattet)
create or replace function public.coaching_mark_refunded(_payment_intent text, _by uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coaching_bookings
  set status = 'erstattet', refunded_at = now(), cancelled_by = coalesce(_by, cancelled_by), updated_at = now()
  where stripe_payment_intent = _payment_intent and status in ('bezahlt', 'erledigt');
$$;

-- Rechte: Webseite nur die eigenen Aktionen, Stripe-Teil nur der Server
do $$
declare f text;
begin
  foreach f in array array['public.coach_payment_ready(uuid)', 'public.coaching_respond(uuid, boolean, timestamptz)',
    'public.coaching_set_time(uuid, timestamptz)', 'public.coaching_mark_done(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.coaching_user_banned(uuid)', 'public.coaching_checkout_info(uuid, uuid)',
    'public.coaching_checkout_started(uuid, text)', 'public.coaching_mark_paid(uuid, text, text, integer, text)',
    'public.coaching_refund_info(uuid, uuid)', 'public.coaching_mark_refunded(text, uuid)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    begin
      execute format('grant execute on function %s to service_role', f);
    exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Auszahlungskonten geschützt' as pruefung,
       case when (select relrowsecurity from pg_class where oid = 'public.coach_payout_accounts'::regclass)
                 and not has_table_privilege('authenticated', 'public.coach_payout_accounts', 'INSERT')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Termin und Zahlung bei Anfragen',
       count(*)::text || ' von 3'
from information_schema.columns
where table_schema = 'public' and table_name = 'coaching_bookings' and column_name in ('scheduled_at', 'stripe_payment_intent', 'refunded_at')
union all
select 'Stripe-Funktionen nur für den Server',
       case when not has_function_privilege('authenticated', 'public.coaching_mark_paid(uuid, text, text, integer, text)', 'EXECUTE')
                 and not has_function_privilege('authenticated', 'public.coaching_refund_info(uuid, uuid)', 'EXECUTE')
            then 'bereit' else 'FEHLT' end;
