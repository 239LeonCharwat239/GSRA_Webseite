-- =========================================================
-- GSRA 036 – Coaching: mehr Rücksicht auf Coaches bei Reklamationen, dauerhafte Coach-Sperre (Entscheidung 19.11.)
--  * Antwortfrist für Coaches 5 Tage statt 48 Stunden (Urlaub, Schule, Spam-Ordner). Offene Fälle werden verlängert.
--  * 24 Stunden vor Fristende eine Erinnerungs-E-Mail; dazu ein Hinweis auf jeder GSRA-Seite (Webseite).
--  * Dauerhafte Coach-Sperre – nur Administratoren mit Zwei-Faktor, immer mit Begründung:
--      - Coach-Lizenz dauerhaft entzogen (auch Pro-Coaches). Selbst holen geht nie wieder,
--        egal wie lange jemand wartet oder welche Bewertungen er bekommt.
--      - Aufheben können nur Administratoren (für Irrtümer), Moderatoren nicht.
--      - Angebote werden pausiert, offene Anfragen abgelehnt, angenommene (unbezahlte) storniert.
--      - Bezahlte künftige Termine werden voll erstattet – über die Erstattungs-Automatik aus 035.
--      - Der Coach bekommt eine E-Mail mit Begründung. Das Konto selbst bleibt nutzbar (Chat, Marktplatz, Setups).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 026, 027, 033 und 035 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Neue Spalten
-- ---------------------------------------------------------
alter table public.coaching_disputes add column if not exists coach_reminded_at timestamptz;
alter table public.coaching_disputes drop constraint if exists coaching_disputes_reason_check;
alter table public.coaching_disputes add constraint coaching_disputes_reason_check
  check (reason in ('nicht_erschienen', 'mangelhaft', 'sonstiges', 'coach_gesperrt'));
alter table public.coach_licenses add column if not exists permanent boolean not null default false;
alter table public.coach_licenses add column if not exists ban_notified_at timestamptz;

-- ---------------------------------------------------------
-- 2) Reklamation: 5 Tage Antwortfrist für den Coach
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
  values (_b.id, _b.buyer_id, _b.coach_id, _reason, left(_txt, 2000), now() + interval '5 days')
  returning id into _id;
  return _id;
end;
$$;

-- Schon offene Fälle bekommen ebenfalls 5 Tage ab Meldung
update public.coaching_disputes set respond_until = created_at + interval '5 days', updated_at = now()
where status = 'offen' and respond_until < created_at + interval '5 days';

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
  if now() > _d.respond_until then raise exception 'Die Frist für deine Antwort ist vorbei. Erstatten geht weiterhin.'; end if;
  if char_length(_txt) < 10 then raise exception 'Bitte begründe deinen Widerspruch (mindestens 10 Zeichen).'; end if;
  update public.coaching_disputes
  set status = 'widerspruch', coach_statement = left(_txt, 2000), coach_answered_at = now(), updated_at = now()
  where id = _d.id;
  return 'widerspruch';
end;
$$;

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
    raise exception 'Der Coach hat noch bis % Uhr Zeit zu antworten.', to_char(_d.respond_until at time zone 'Europe/Berlin', 'DD.MM.YYYY, HH24:MI');
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
      decision = 'Automatisch erstattet: Der Coach hat nicht innerhalb von 5 Tagen reagiert.', decided_at = now(), updated_at = now()
  from public.coaching_bookings b
  where b.id = d.booking_id and d.status = 'offen' and d.reason = 'nicht_erschienen' and d.respond_until < now();
  get diagnostics _n = row_count;
  return _n;
end;
$$;

-- ---------------------------------------------------------
-- 3) Dauerhafte Coach-Sperre (nur Administratoren mit Zwei-Faktor)
-- ---------------------------------------------------------
create or replace function public.coach_ban_permanent(_user uuid, _reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _txt       text := btrim(coalesce(_reason, ''));
  _declined  integer;
  _cancelled integer;
  _refunds   integer;
begin
  if not public.is_site_admin() then
    raise exception 'Dauerhaft sperren können nur Administratoren (mit Zwei-Faktor-Anmeldung).';
  end if;
  if _user is null or _user = auth.uid() then raise exception 'Das eigene Konto lässt sich nicht sperren.'; end if;
  if not exists (select 1 from auth.users where id = _user) then raise exception 'Dieses Konto gibt es nicht.'; end if;
  if char_length(_txt) < 10 then
    raise exception 'Bitte begründe die Sperre (mindestens 10 Zeichen). Der Coach bekommt die Begründung per E-Mail.';
  end if;
  if exists (select 1 from public.coach_licenses where user_id = _user and permanent and revoked_at is not null) then
    raise exception 'Dieser Coach ist bereits dauerhaft gesperrt.';
  end if;

  insert into public.coach_licenses (user_id, granted_at, revoked_at, revoked_reason, revoked_by, auto_revoked, permanent, ban_notified_at)
  values (_user, null, now(), left(_txt, 300), auth.uid(), false, true, null)
  on conflict (user_id) do update set revoked_at = now(), revoked_reason = excluded.revoked_reason, revoked_by = excluded.revoked_by,
                                      auto_revoked = false, permanent = true, ban_notified_at = null;

  update public.coaching_offers set active = false, updated_at = now() where coach_id = _user and active;
  update public.coaching_bookings set status = 'abgelehnt', updated_at = now() where coach_id = _user and status = 'angefragt';
  get diagnostics _declined = row_count;
  -- Angenommen, aber noch nicht bezahlt: storniert (eine danach noch eingehende Zahlung erstattet der Webhook automatisch)
  update public.coaching_bookings set status = 'storniert', cancelled_by = auth.uid(), updated_at = now()
  where coach_id = _user and status = 'angenommen';
  get diagnostics _cancelled = row_count;
  -- Bezahlt und noch nicht stattgefunden: volle Erstattung über die Automatik (coaching-refund, alle 15 Minuten)
  insert into public.coaching_disputes (booking_id, buyer_id, coach_id, reason, description, status, respond_until,
                                        refund_cents, decision, decided_by, decided_at, coach_notified_at)
  select b.id, b.buyer_id, b.coach_id, 'coach_gesperrt', 'Das Coaching entfällt, weil der Coach auf GSRA nicht mehr coachen darf.',
         'erstattung', now(), b.total_cents, 'Volle Erstattung: Der Coach darf auf GSRA nicht mehr coachen.', auth.uid(), now(), now()
  from public.coaching_bookings b
  where b.coach_id = _user and b.status = 'bezahlt' and b.stripe_payment_intent is not null
    and (b.scheduled_at is null or b.scheduled_at > now())
  on conflict (booking_id) do nothing;
  get diagnostics _refunds = row_count;

  insert into public.moderation_log (actor_id, action, target_user, details)
  values (auth.uid(), 'coach_dauerhaft_gesperrt', _user,
          jsonb_build_object('grund', left(_txt, 300), 'abgelehnt', _declined, 'storniert', _cancelled, 'erstattungen', _refunds));
  return jsonb_build_object('abgelehnt', _declined, 'storniert', _cancelled, 'erstattungen', _refunds);
end;
$$;

-- Moderatoren entziehen weiterhin Lizenzen; eine dauerhafte Sperre überschreiben oder aufheben können sie nicht
create or replace function public.coach_license_revoke(_user uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then raise exception 'Nur für das Moderationsteam.'; end if;
  if _user is null or _user = auth.uid() then raise exception 'Die eigene Coach-Lizenz lässt sich nicht entziehen.'; end if;
  if char_length(trim(coalesce(_reason, ''))) < 5 then raise exception 'Bitte gib eine Begründung an (mindestens 5 Zeichen).'; end if;
  if exists (select 1 from public.coach_licenses where user_id = _user and permanent and revoked_at is not null) then
    raise exception 'Dieser Coach ist bereits dauerhaft gesperrt.';
  end if;
  insert into public.coach_licenses (user_id, granted_at, revoked_at, revoked_reason, revoked_by, auto_revoked)
  values (_user, null, now(), left(trim(_reason), 300), auth.uid(), false)
  on conflict (user_id) do update set revoked_at = now(), revoked_reason = excluded.revoked_reason,
                                      revoked_by = excluded.revoked_by, auto_revoked = false;
  update public.coaching_offers set active = false, updated_at = now() where coach_id = _user and active;
  insert into public.moderation_log (actor_id, action, target_user, details)
  values (auth.uid(), 'coach_lizenz_entzogen', _user, jsonb_build_object('grund', left(trim(_reason), 300)));
end;
$$;

create or replace function public.coach_license_restore(_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _perm boolean;
begin
  if not public.is_moderator() then raise exception 'Nur für das Moderationsteam.'; end if;
  select permanent into _perm from public.coach_licenses where user_id = _user and revoked_at is not null;
  if not found then raise exception 'Diese Person hat keine entzogene Coach-Lizenz.'; end if;
  if _perm and not public.is_site_admin() then
    raise exception 'Eine dauerhafte Coach-Sperre können nur Administratoren aufheben.';
  end if;
  update public.coach_licenses set revoked_at = null, revoked_reason = null, revoked_by = null, auto_revoked = false,
                                   permanent = false, ban_notified_at = null
  where user_id = _user and revoked_at is not null;
  delete from public.coach_licenses where user_id = _user and granted_at is null;
  insert into public.moderation_log (actor_id, action, target_user, details)
  values (auth.uid(), case when _perm then 'coach_sperre_aufgehoben' else 'coach_lizenz_wiederhergestellt' end, _user, '{}'::jsonb);
end;
$$;

-- Lizenz holen: bei dauerhafter Sperre nie wieder
create or replace function public.coach_claim_license()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
  _l  public.coach_licenses;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _l from public.coach_licenses where user_id = _me;
  if _l.permanent and _l.revoked_at is not null then
    raise exception 'Deine Coach-Lizenz wurde dauerhaft entzogen. Mit diesem Konto kannst du keine Coachings mehr anbieten.';
  end if;
  if _l.granted_at is not null and _l.revoked_at is null then return 'schon_aktiv'; end if;
  if _l.revoked_at is not null and not _l.auto_revoked then
    raise exception 'Deine Coach-Lizenz wurde vom Moderationsteam entzogen. Bei Fragen wende dich bitte an die GSRA.';
  end if;
  if not (public.coach_license_progress(_me) ->> 'alle')::boolean then
    raise exception 'Du erfüllst noch nicht alle Voraussetzungen für die Coach-Lizenz.';
  end if;
  insert into public.coach_licenses (user_id, granted_at) values (_me, now())
  on conflict (user_id) do update set granted_at = now(), revoked_at = null, revoked_reason = null, revoked_by = null, auto_revoked = false;
  insert into public.moderation_log (actor_id, action, target_user, details) values (_me, 'coach_lizenz_erteilt', _me, '{}'::jsonb);
  return 'erteilt';
end;
$$;

-- Stand der Lizenz: zusätzlich „dauerhaft“
create or replace function public.coach_license_status(_user uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _l public.coach_licenses;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if _user is distinct from auth.uid() and not public.is_moderator() then
    return jsonb_build_object('aktiv', public.coach_license_active(_user), 'pro', public.is_pro_creator(_user));
  end if;
  select * into _l from public.coach_licenses where user_id = _user;
  return jsonb_build_object(
    'aktiv', public.coach_license_active(_user),
    'pro', public.is_pro_creator(_user),
    'erteilt_am', _l.granted_at,
    'entzogen', case when _l.revoked_at is null then null
                     else jsonb_build_object('am', _l.revoked_at, 'grund', _l.revoked_reason, 'automatisch', _l.auto_revoked,
                                             'dauerhaft', coalesce(_l.permanent, false)) end,
    'regeln', public.coach_license_rules(),
    'fortschritt', public.coach_license_progress(_user));
end;
$$;

-- ---------------------------------------------------------
-- 4) E-Mails: zusätzlich Erinnerung 24 Std. vor Fristende und Nachricht über eine dauerhafte Sperre
--    (ersetzt coaching_reminder_run aus 035; Termin-Erinnerungen entfallen für Coachings, die erstattet werden)
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
  _bans   jsonb;
begin
  update public.coaching_reminder_runs set last_run = now()
  where id = 1 and last_run < now() - interval '4 minutes';
  if not found then
    return jsonb_build_object('lauf', false, 'erinnerungen', '[]'::jsonb, 'reklamationen', '[]'::jsonb, 'sperren', '[]'::jsonb);
  end if;

  perform public.coaching_expire_stale();
  perform public.coaching_disputes_auto();

  with soon as (
    update public.coaching_bookings b
    set reminded_1h_at = now(), reminded_24h_at = coalesce(b.reminded_24h_at, now())
    where b.status = 'bezahlt' and b.reminded_1h_at is null
      and b.scheduled_at > now() and b.scheduled_at <= now() + interval '75 minutes'
      and not exists (select 1 from public.coaching_disputes d where d.booking_id = b.id)
    returning b.id, '1h'::text as art
  ), day as (
    update public.coaching_bookings b
    set reminded_24h_at = now()
    where b.status in ('bezahlt', 'angenommen') and b.reminded_24h_at is null
      and b.scheduled_at > now() + interval '75 minutes' and b.scheduled_at <= now() + interval '24 hours'
      and not exists (select 1 from public.coaching_disputes d where d.booking_id = b.id)
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

  -- Reklamationen: neue an den Coach, Erinnerung 24 Std. vor Fristende, Ergebnisse an beide
  with neu as (
    update public.coaching_disputes set coach_notified_at = now()
    where coach_notified_at is null and status = 'offen'
    returning id, 'neu'::text as art
  ), erinnerung as (
    update public.coaching_disputes set coach_reminded_at = now()
    where status = 'offen' and coach_notified_at is not null and coach_reminded_at is null
      and respond_until > now() and respond_until <= now() + interval '24 hours'
    returning id, 'erinnerung'::text as art
  ), fertig as (
    update public.coaching_disputes set result_notified_at = now()
    where result_notified_at is null and status in ('erstattet', 'teilweise_erstattet', 'abgelehnt')
    returning id, 'ergebnis'::text as art
  ), alle as (
    select * from neu union all select * from erinnerung union all select * from fertig
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'art', a.art, 'status', d.status, 'grund', d.reason, 'titel', b.offer_title, 'termin', b.scheduled_at,
           'frist', d.respond_until, 'betrag', coalesce(d.refund_cents, 0), 'entscheidung', d.decision,
           'coach_id', d.coach_id, 'kunde_id', d.buyer_id,
           'coach_name', coalesce((select username from public.profiles where id = d.coach_id), 'dein Coach'),
           'kunde_name', coalesce((select username from public.profiles where id = d.buyer_id), 'dein Kunde'))), '[]'::jsonb)
  into _cases
  from alle a join public.coaching_disputes d on d.id = a.id join public.coaching_bookings b on b.id = d.booking_id;

  -- Dauerhafte Sperren: der Coach erfährt Entscheidung und Begründung
  with gesperrt as (
    update public.coach_licenses set ban_notified_at = now()
    where permanent and revoked_at is not null and ban_notified_at is null
    returning user_id, revoked_reason
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'coach_id', g.user_id, 'grund', g.revoked_reason,
           'coach_name', coalesce((select username from public.profiles where id = g.user_id), 'Coach'))), '[]'::jsonb)
  into _bans
  from gesperrt g;

  return jsonb_build_object('lauf', true, 'erinnerungen', _due, 'reklamationen', _cases, 'sperren', _bans);
end;
$$;

-- ---------------------------------------------------------
-- 5) Rechte
-- ---------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['public.coaching_report_problem(uuid, text, text)', 'public.coaching_dispute_answer(uuid, boolean, text)',
                           'public.coaching_dispute_decide(uuid, integer, text)', 'public.coach_ban_permanent(uuid, text)',
                           'public.coach_license_revoke(uuid, text)', 'public.coach_license_restore(uuid)',
                           'public.coach_claim_license()', 'public.coach_license_status(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.coaching_disputes_auto()', 'public.coaching_reminder_run()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    begin
      execute format('grant execute on function %s to service_role', f);
    exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „5 Tage“, „bereit“, „ja“)
-- ---------------------------------------------------------
select 'Antwortfrist für Coaches' as pruefung,
       case when (select prosrc from pg_proc where oid = 'public.coaching_report_problem(uuid, text, text)'::regprocedure) like '%5 days%'
             and not exists (select 1 from public.coaching_disputes where status = 'offen' and respond_until < created_at + interval '5 days')
            then '5 Tage' else 'FEHLT' end as ergebnis
union all
select 'Dauerhafte Coach-Sperre (nur Admins)',
       case when to_regprocedure('public.coach_ban_permanent(uuid, text)') is not null
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coach_licenses' and column_name = 'permanent')
             and not has_function_privilege('anon', 'public.coach_ban_permanent(uuid, text)', 'execute')
            then 'bereit' else 'FEHLT' end
union all
select 'E-Mail-Liste nur für den Server',
       case when not has_function_privilege('authenticated', 'public.coaching_reminder_run()', 'execute') then 'ja' else 'NEIN' end;
