-- =========================================================
-- GSRA 035 – Coaching: „Problem melden“ (Reklamation) (Entscheidung 19.11.)
--  * Kunden melden ein Problem mit einem bezahlten Coaching ab Terminbeginn bis 7 Tage danach:
--    „Coach ist nicht erschienen“, „Coaching war mangelhaft“ oder „Etwas anderes“ – mit Beschreibung.
--  * Der Coach hat 48 Stunden Zeit: selbst erstatten oder mit Begründung widersprechen.
--  * Coach nicht erschienen und keine Reaktion in 48 Stunden → volle Erstattung automatisch.
--  * Widerspruch, „mangelhaft“ oder „etwas anderes“ ohne Einigung → die Moderation entscheidet (voll, teilweise
--    oder keine Erstattung, immer mit Begründung, steht im Moderationsprotokoll).
--  * Schutz für Coaches: keine Meldung vor dem Termin (bis 24 Std. vorher gilt die kostenlose Stornierung),
--    nur eine Meldung pro Coaching, nur der Kunde selbst, nur innerhalb von 7 Tagen.
--  * Die Erstattung selbst führt die Server-Funktion coaching-refund aus (Stripe); hier wird nur entschieden.
--  * E-Mails: Der Coach erfährt von der Meldung, beide vom Ergebnis (über coaching-reminders).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 025 und 033 voraus.
-- =========================================================

create table if not exists public.coaching_disputes (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null unique references public.coaching_bookings(id) on delete cascade,
  buyer_id          uuid not null references auth.users(id) on delete cascade,
  coach_id          uuid not null references auth.users(id) on delete cascade,
  reason            text not null check (reason in ('nicht_erschienen', 'mangelhaft', 'sonstiges')),
  description       text not null check (char_length(description) between 10 and 2000),
  status            text not null default 'offen'
                    check (status in ('offen', 'widerspruch', 'erstattung', 'erstattet', 'teilweise_erstattet', 'abgelehnt')),
  respond_until     timestamptz not null,
  coach_statement   text check (char_length(coach_statement) <= 2000),
  coach_answered_at timestamptz,
  refund_cents      integer check (refund_cents >= 0),
  decision          text check (char_length(decision) <= 1000),
  decided_by        uuid references auth.users(id) on delete set null,
  decided_at        timestamptz,
  refunded_at       timestamptz,
  coach_notified_at timestamptz,
  result_notified_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists coaching_disputes_status_idx on public.coaching_disputes (status, respond_until);

alter table public.coaching_disputes enable row level security;
revoke all on public.coaching_disputes from anon, authenticated;
grant select on public.coaching_disputes to authenticated;
drop policy if exists "GSRA Reklamation sehen" on public.coaching_disputes;
create policy "GSRA Reklamation sehen" on public.coaching_disputes for select to authenticated
  using (buyer_id = (select auth.uid()) or coach_id = (select auth.uid()) or (select public.is_moderator()));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.coaching_disputes;
create policy "Gesperrte Konten haben keinen Zugriff" on public.coaching_disputes as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));
drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.coaching_disputes;
create policy "GSRA Zwei-Faktor erforderlich" on public.coaching_disputes as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- ---------------------------------------------------------
-- 1) Kunde meldet ein Problem
-- ---------------------------------------------------------
create or replace function public.coaching_report_problem(_booking_id uuid, _reason text, _description text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me  uuid := auth.uid();
  _b   public.coaching_bookings;
  _txt text := btrim(coalesce(_description, ''));
  _id  uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _b from public.coaching_bookings where id = _booking_id for update;
  if _b.id is null or _b.buyer_id <> _me then raise exception 'Ein Problem melden kannst du nur zu deinem eigenen Coaching.'; end if;
  if _b.status not in ('bezahlt', 'erledigt') or _b.stripe_payment_intent is null then
    raise exception 'Ein Problem melden kannst du nur zu einem bezahlten Coaching.';
  end if;
  if _b.scheduled_at is null or _b.scheduled_at > now() then
    raise exception 'Ein Problem kannst du ab Beginn des Termins melden. Vorher kannst du bis 24 Stunden vor dem Termin kostenlos stornieren.';
  end if;
  if _b.scheduled_at < now() - interval '7 days' then
    raise exception 'Ein Problem melden geht bis 7 Tage nach dem Termin.';
  end if;
  if exists (select 1 from public.coaching_disputes where booking_id = _booking_id) then
    raise exception 'Zu diesem Coaching hast du schon ein Problem gemeldet.';
  end if;
  if coalesce(_reason, '') not in ('nicht_erschienen', 'mangelhaft', 'sonstiges') then
    raise exception 'Bitte wähle aus, was nicht gepasst hat.';
  end if;
  if char_length(_txt) < 10 then raise exception 'Bitte beschreibe kurz, was passiert ist (mindestens 10 Zeichen).'; end if;
  insert into public.coaching_disputes (booking_id, buyer_id, coach_id, reason, description, respond_until)
  values (_b.id, _b.buyer_id, _b.coach_id, _reason, left(_txt, 2000), now() + interval '48 hours')
  returning id into _id;
  return _id;
end;
$$;

-- ---------------------------------------------------------
-- 2) Coach antwortet: erstatten oder widersprechen (innerhalb von 48 Stunden; erstatten geht auch danach)
-- ---------------------------------------------------------
create or replace function public.coaching_dispute_answer(_dispute_id uuid, _refund boolean, _statement text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _me  uuid := auth.uid();
  _d   public.coaching_disputes;
  _txt text := btrim(coalesce(_statement, ''));
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _d from public.coaching_disputes where id = _dispute_id for update;
  if _d.id is null or _d.coach_id <> _me then raise exception 'Diese Reklamation betrifft nicht dein Coaching.'; end if;
  if _refund then
    if _d.status not in ('offen', 'widerspruch') then raise exception 'Diese Reklamation ist bereits entschieden.'; end if;
    update public.coaching_disputes
    set status = 'erstattung', refund_cents = (select total_cents from public.coaching_bookings where id = _d.booking_id),
        coach_statement = nullif(left(_txt, 2000), ''), coach_answered_at = now(), decision = 'Der Coach hat die Erstattung zugesagt.',
        decided_by = _me, decided_at = now(), updated_at = now()
    where id = _d.id;
    return 'erstattung';
  end if;
  if _d.status <> 'offen' then raise exception 'Widersprechen kannst du nur einer offenen Reklamation.'; end if;
  if now() > _d.respond_until then raise exception 'Die 48 Stunden für deine Antwort sind vorbei.'; end if;
  if char_length(_txt) < 10 then raise exception 'Bitte begründe deinen Widerspruch (mindestens 10 Zeichen).'; end if;
  update public.coaching_disputes
  set status = 'widerspruch', coach_statement = left(_txt, 2000), coach_answered_at = now(), updated_at = now()
  where id = _d.id;
  return 'widerspruch';
end;
$$;

-- ---------------------------------------------------------
-- 3) Moderation entscheidet (Widerspruch oder nach Ablauf der 48 Stunden)
-- ---------------------------------------------------------
create or replace function public.coaching_dispute_decide(_dispute_id uuid, _refund_cents integer, _decision text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _d     public.coaching_disputes;
  _total integer;
  _txt   text := btrim(coalesce(_decision, ''));
begin
  if not public.is_moderator() then raise exception 'Nur das Moderationsteam (mit Zwei-Faktor-Anmeldung) entscheidet Reklamationen.'; end if;
  select * into _d from public.coaching_disputes where id = _dispute_id for update;
  if _d.id is null then raise exception 'Diese Reklamation gibt es nicht.'; end if;
  if _d.status not in ('offen', 'widerspruch') then raise exception 'Diese Reklamation ist bereits entschieden.'; end if;
  if _d.status = 'offen' and now() <= _d.respond_until then
    raise exception 'Der Coach hat noch bis zum Ablauf der 48 Stunden Zeit zu antworten.';
  end if;
  if char_length(_txt) < 5 then raise exception 'Bitte begründe die Entscheidung (mindestens 5 Zeichen).'; end if;
  select total_cents into _total from public.coaching_bookings where id = _d.booking_id;
  if coalesce(_refund_cents, 0) < 0 or coalesce(_refund_cents, 0) > _total then
    raise exception 'Der Erstattungsbetrag muss zwischen 0 und dem bezahlten Betrag liegen.';
  end if;
  update public.coaching_disputes
  set status = case when coalesce(_refund_cents, 0) > 0 then 'erstattung' else 'abgelehnt' end,
      refund_cents = nullif(coalesce(_refund_cents, 0), 0), decision = left(_txt, 1000),
      decided_by = auth.uid(), decided_at = now(), updated_at = now()
  where id = _d.id;
  insert into public.moderation_log (actor_id, action, target_user, details)
  values (auth.uid(), 'coaching_reklamation_entschieden', _d.coach_id,
          jsonb_build_object('erstattung_cent', coalesce(_refund_cents, 0), 'grund', left(_txt, 300), 'kunde', _d.buyer_id));
  return case when coalesce(_refund_cents, 0) > 0 then 'erstattung' else 'abgelehnt' end;
end;
$$;

-- ---------------------------------------------------------
-- 4) Nur für den Server: fällige automatische Erstattungen, offene Erstattungen, Abschluss
-- ---------------------------------------------------------
-- Coach nicht erschienen und keine Antwort in 48 Stunden → volle Erstattung
create or replace function public.coaching_disputes_auto()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare _n integer;
begin
  update public.coaching_disputes d
  set status = 'erstattung', refund_cents = b.total_cents,
      decision = 'Automatisch erstattet: Der Coach hat nicht innerhalb von 48 Stunden reagiert.', decided_at = now(), updated_at = now()
  from public.coaching_bookings b
  where b.id = d.booking_id and d.status = 'offen' and d.reason = 'nicht_erschienen' and d.respond_until < now();
  get diagnostics _n = row_count;
  return _n;
end;
$$;

-- Was jetzt bei Stripe erstattet werden muss (mit allem, was die Server-Funktion dafür braucht)
create or replace function public.coaching_dispute_refunds_pending()
returns jsonb
language sql
stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'booking_id', d.booking_id, 'refund_cents', d.refund_cents, 'total_cents', b.total_cents,
           'fee_cents', b.fee_cents, 'payment_intent', b.stripe_payment_intent,
           'stripe_account_id', (select stripe_account_id from public.coach_payout_accounts where user_id = b.coach_id))), '[]'::jsonb)
  from public.coaching_disputes d join public.coaching_bookings b on b.id = d.booking_id
  where d.status = 'erstattung' and b.stripe_payment_intent is not null;
$$;

create or replace function public.coaching_dispute_mark_refunded(_dispute_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _d public.coaching_disputes;
  _b public.coaching_bookings;
begin
  select * into _d from public.coaching_disputes where id = _dispute_id and status = 'erstattung' for update;
  if _d.id is null then return; end if;
  select * into _b from public.coaching_bookings where id = _d.booking_id;
  if coalesce(_d.refund_cents, 0) >= _b.total_cents then
    update public.coaching_disputes set status = 'erstattet', refunded_at = now(), updated_at = now() where id = _d.id;
    update public.coaching_bookings set status = 'erstattet', refunded_at = now(), updated_at = now()
    where id = _b.id and status in ('bezahlt', 'erledigt');
  else
    update public.coaching_disputes set status = 'teilweise_erstattet', refunded_at = now(), updated_at = now() where id = _d.id;
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 5) E-Mails über die Erinnerungs-Funktion: neue Meldung an den Coach, Ergebnis an beide
--    (ersetzt coaching_reminder_run aus 033 – die Erinnerungen bleiben unverändert)
-- ---------------------------------------------------------
create or replace function public.coaching_reminder_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _due    jsonb;
  _cases  jsonb;
begin
  update public.coaching_reminder_runs set last_run = now()
  where id = 1 and last_run < now() - interval '4 minutes';
  if not found then return jsonb_build_object('lauf', false, 'erinnerungen', '[]'::jsonb, 'reklamationen', '[]'::jsonb); end if;

  perform public.coaching_expire_stale();
  perform public.coaching_disputes_auto();

  with soon as (
    update public.coaching_bookings b
    set reminded_1h_at = now(), reminded_24h_at = coalesce(b.reminded_24h_at, now())
    where b.status = 'bezahlt' and b.reminded_1h_at is null
      and b.scheduled_at > now() and b.scheduled_at <= now() + interval '75 minutes'
    returning b.id, '1h'::text as art
  ), day as (
    update public.coaching_bookings b
    set reminded_24h_at = now()
    where b.status in ('bezahlt', 'angenommen') and b.reminded_24h_at is null
      and b.scheduled_at > now() + interval '75 minutes' and b.scheduled_at <= now() + interval '24 hours'
      and b.id not in (select id from soon)
    returning b.id, '24h'::text as art
  ), picked as (
    select * from soon union all select * from day
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'art', p.art, 'status', b.status, 'titel', b.offer_title, 'termin', b.scheduled_at,
           'dauer', b.duration_minutes, 'coach_id', b.coach_id, 'kunde_id', b.buyer_id,
           'coach_name', coalesce((select username from public.profiles where id = b.coach_id), 'dein Coach'),
           'kunde_name', coalesce((select username from public.profiles where id = b.buyer_id), 'dein Kunde'))
         order by b.scheduled_at), '[]'::jsonb)
  into _due
  from picked p join public.coaching_bookings b on b.id = p.id;

  -- Reklamationen: neue an den Coach, Ergebnisse (erstattet, teilweise, abgelehnt) an beide
  with neu as (
    update public.coaching_disputes set coach_notified_at = now()
    where coach_notified_at is null and status = 'offen'
    returning id, 'neu'::text as art
  ), fertig as (
    update public.coaching_disputes set result_notified_at = now()
    where result_notified_at is null and status in ('erstattet', 'teilweise_erstattet', 'abgelehnt')
    returning id, 'ergebnis'::text as art
  ), alle as (
    select * from neu union all select * from fertig
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'art', a.art, 'status', d.status, 'grund', d.reason, 'titel', b.offer_title, 'termin', b.scheduled_at,
           'frist', d.respond_until, 'betrag', coalesce(d.refund_cents, 0), 'entscheidung', d.decision,
           'coach_id', d.coach_id, 'kunde_id', d.buyer_id,
           'coach_name', coalesce((select username from public.profiles where id = d.coach_id), 'dein Coach'),
           'kunde_name', coalesce((select username from public.profiles where id = d.buyer_id), 'dein Kunde'))), '[]'::jsonb)
  into _cases
  from alle a join public.coaching_disputes d on d.id = a.id join public.coaching_bookings b on b.id = d.booking_id;

  return jsonb_build_object('lauf', true, 'erinnerungen', _due, 'reklamationen', _cases);
end;
$$;

-- ---------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['public.coaching_report_problem(uuid, text, text)', 'public.coaching_dispute_answer(uuid, boolean, text)',
                           'public.coaching_dispute_decide(uuid, integer, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.coaching_disputes_auto()', 'public.coaching_dispute_refunds_pending()',
                           'public.coaching_dispute_mark_refunded(uuid)', 'public.coaching_reminder_run()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    begin
      execute format('grant execute on function %s to service_role', f);
    exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
    end;
  end loop;
end $$;

-- ---------------------------------------------------------
-- Zeitplan: alle 15 Minuten fällige Erstattungen bei Stripe ausführen (Server-Funktion coaching-refund)
-- ---------------------------------------------------------
do $$
declare
  _key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xcXl2cG1kZGFhc3RhY2xkYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzAzNzUsImV4cCI6MjEwMzAwNjM3NX0.OWY2FUS7n9Jw-6FP0Hp1B9aY6AUAkEpZ6Xd7MpS0GLI';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') or not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'gsra-coaching-erstattungen') then
    perform cron.unschedule('gsra-coaching-erstattungen');
  end if;
  perform cron.schedule('gsra-coaching-erstattungen', '7-59/15 * * * *', format($cmd$
    select net.http_post(
      url := 'https://mqqyvpmddaastacldbyy.supabase.co/functions/v1/coaching-refund',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer %1$s', 'apikey', '%1$s'),
      body := '{"action":"reklamationen"}'::jsonb,
      timeout_milliseconds := 25000)
  $cmd$, _key));
end $$;

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „bereit“, „ja“, „aktiv (alle 15 Minuten)“)
-- ---------------------------------------------------------
select 'Reklamationen (Tabelle, nur Beteiligte und Moderation)' as pruefung,
       case when (select relrowsecurity from pg_class where oid = 'public.coaching_disputes'::regclass)
             and not has_table_privilege('authenticated', 'public.coaching_disputes', 'insert')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Melden, Antworten, Entscheiden',
       case when to_regprocedure('public.coaching_report_problem(uuid, text, text)') is not null
             and to_regprocedure('public.coaching_dispute_answer(uuid, boolean, text)') is not null
             and to_regprocedure('public.coaching_dispute_decide(uuid, integer, text)') is not null then 'bereit' else 'FEHLT' end
union all
select 'Erstattungen nur über den Server',
       case when not has_function_privilege('authenticated', 'public.coaching_dispute_refunds_pending()', 'execute')
             and not has_function_privilege('authenticated', 'public.coaching_dispute_mark_refunded(uuid)', 'execute') then 'ja' else 'NEIN' end
union all
select 'Zeitplan Erstattungen',
       case when not exists (select 1 from pg_extension where extname = 'pg_cron') or not exists (select 1 from pg_extension where extname = 'pg_net')
            then 'fehlt – pg_cron und pg_net einschalten' else 'aktiv (alle 15 Minuten)' end;
