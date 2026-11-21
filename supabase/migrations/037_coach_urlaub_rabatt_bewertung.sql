-- =========================================================
-- GSRA 037 – Coaching: Urlaubsmodus, Rabatte der Coaches, Bitte um Bewertung (Entscheidung 21.11.)
--  * Urlaubsmodus: ein Knopf „Ich bin im Urlaub“ (bis ich ihn beende) oder ein Zeitraum von–bis, der von selbst
--    endet. In dieser Zeit gibt es keine freien Termine; Anfragen ohne Kalender sind gesperrt. Andere sehen
--    „Im Urlaub bis …“. Bestehende Buchungen bleiben (die Seite weist darauf hin).
--  * Rabatte: Coaches geben selbst einen Rabatt von 5 bis 70 % auf ein Angebot, auf Wunsch befristet.
--    Gebucht wird zum reduzierten Preis; die Servicegebühr (Paddock) richtet sich nach dem reduzierten Preis.
--  * Bitte um Bewertung: 2 Stunden nach dem Ende eines bezahlten Coachings eine E-Mail an den Kunden
--    (über coaching-reminders) – nur einmal, nicht bei Reklamationen, nicht wenn schon bewertet.
--    Bereits vergangene Coachings bekommen keine nachträgliche E-Mail.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 030, 033, 035 und 036 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Urlaubsmodus
-- ---------------------------------------------------------
create table if not exists public.coach_away (
  coach_id   uuid primary key references auth.users(id) on delete cascade,
  from_day   date not null,
  until_day  date,                                   -- leer = bis der Coach es selbst beendet
  created_at timestamptz not null default now(),
  check (until_day is null or until_day >= from_day)
);
alter table public.coach_away enable row level security;
revoke all on public.coach_away from anon, authenticated;
grant select on public.coach_away to authenticated;
drop policy if exists "GSRA eigener Urlaub" on public.coach_away;
create policy "GSRA eigener Urlaub" on public.coach_away for select to authenticated
  using (coach_id = (select auth.uid()) or (select public.is_moderator()));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.coach_away;
create policy "Gesperrte Konten haben keinen Zugriff" on public.coach_away as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));
drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.coach_away;
create policy "GSRA Zwei-Faktor erforderlich" on public.coach_away as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Heutiger Tag in der Zeitzone des Coaches (Kalender), sonst deutsche Zeit
create or replace function public.coach_today(_coach uuid)
returns date
language sql
stable security definer
set search_path = public
as $$
  select (now() at time zone coalesce((select timezone from public.coach_calendars where coach_id = _coach), 'Europe/Berlin'))::date;
$$;

-- Ist der Coach an diesem Tag im Urlaub?
create or replace function public.coach_away_on(_coach uuid, _day date)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (select 1 from public.coach_away a
                 where a.coach_id = _coach and a.from_day <= _day and (a.until_day is null or a.until_day >= _day));
$$;

-- Coach: Urlaub ab _from (leer = heute) bis _until (leer = bis ich ihn beende)
create or replace function public.coach_set_away(_from date default null, _until date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _me    uuid := auth.uid();
  _today date;
  _start date;
  _n     integer;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if not public.coach_license_active(_me) then raise exception 'Den Urlaubsmodus gibt es für Coaches mit Coach-Lizenz.'; end if;
  _today := public.coach_today(_me);
  _start := coalesce(_from, _today);
  if _start < _today then raise exception 'Der Urlaub kann frühestens heute beginnen.'; end if;
  if _start > _today + 365 then raise exception 'Urlaub lässt sich bis ein Jahr im Voraus planen.'; end if;
  if _until is not null and _until < _start then raise exception 'Das Ende des Urlaubs liegt vor dem Beginn.'; end if;
  if _until is not null and _until > _start + 180 then raise exception 'Ein Urlaub kann höchstens 180 Tage dauern. Für länger pausierst du deine Angebote.'; end if;
  insert into public.coach_away (coach_id, from_day, until_day) values (_me, _start, _until)
  on conflict (coach_id) do update set from_day = excluded.from_day, until_day = excluded.until_day, created_at = now();
  -- Hinweis für die Seite: Buchungen, die in den Urlaub fallen (bleiben bestehen)
  select count(*) into _n from public.coaching_bookings b
  where b.coach_id = _me and b.status in ('angefragt', 'angenommen', 'bezahlt') and b.scheduled_at is not null
    and (b.scheduled_at at time zone coalesce((select timezone from public.coach_calendars where coach_id = _me), 'Europe/Berlin'))::date >= _start
    and (_until is null or (b.scheduled_at at time zone coalesce((select timezone from public.coach_calendars where coach_id = _me), 'Europe/Berlin'))::date <= _until);
  return jsonb_build_object('von', _start, 'bis', _until, 'betroffen', _n);
end;
$$;

create or replace function public.coach_end_away()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  delete from public.coach_away where coach_id = auth.uid();
end;
$$;

-- Für alle: Ist ein Coach gerade im Urlaub (und bis wann)? Der Coach selbst sieht auch geplanten Urlaub.
create or replace function public.coach_away_info(_user uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _a     public.coach_away;
  _today date;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  select * into _a from public.coach_away where coach_id = _user;
  if _a.coach_id is null then return jsonb_build_object('urlaub', false); end if;
  _today := public.coach_today(_user);
  if _a.until_day is not null and _a.until_day < _today then return jsonb_build_object('urlaub', false); end if;
  if _a.from_day <= _today then return jsonb_build_object('urlaub', true, 'von', _a.from_day, 'bis', _a.until_day); end if;
  if _user = auth.uid() then return jsonb_build_object('urlaub', false, 'geplant', true, 'von', _a.from_day, 'bis', _a.until_day); end if;
  return jsonb_build_object('urlaub', false);
end;
$$;

-- Alle Coaches, die gerade im Urlaub sind (für die Angebotsliste)
create or replace function public.coaching_away_coaches()
returns jsonb
language sql
stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('coach_id', a.coach_id, 'bis', a.until_day)), '[]'::jsonb)
  from public.coach_away a
  where a.from_day <= public.coach_today(a.coach_id) and (a.until_day is null or a.until_day >= public.coach_today(a.coach_id));
$$;

-- Freie Termine: Urlaubstage fallen weg (ersetzt die Fassung aus 030)
create or replace function public.coach_slots(_coach uuid, _duration integer, _from date, _days integer)
returns setof timestamptz
language sql
stable security definer
set search_path = public
as $$
  with cal as (
    select coalesce((select timezone from public.coach_calendars where coach_id = _coach), 'Europe/Berlin') as tz
  ), days as (
    select (_from + g)::date as d from generate_series(0, greatest(least(coalesce(_days, 28), 62), 1) - 1) g
  ), win as (
    select days.d, w.start_min, w.end_min
    from days join public.coach_availability w on w.coach_id = _coach and w.weekday = extract(isodow from days.d)
    where not exists (select 1 from public.coach_blocked_days b where b.coach_id = _coach and b.day = days.d)
      and not public.coach_away_on(_coach, days.d)
  ), cand as (
    select ((win.d + make_interval(mins => m)) at time zone cal.tz) as start_at
    from win cross join cal cross join lateral generate_series(win.start_min::integer, win.end_min - _duration, 30) m
  )
  select distinct start_at from cand
  where start_at >= now() + interval '24 hours' and start_at <= now() + interval '60 days'
    and public.coach_time_free(_coach, start_at, _duration)
  order by start_at;
$$;

-- ---------------------------------------------------------
-- 2) Rabatte der Coaches
-- ---------------------------------------------------------
alter table public.coaching_offers add column if not exists discount_percent smallint;
alter table public.coaching_offers add column if not exists discount_until date;
alter table public.coaching_offers drop constraint if exists coaching_offers_discount_check;
alter table public.coaching_offers add constraint coaching_offers_discount_check
  check (discount_percent is null or discount_percent between 5 and 70);
alter table public.coaching_bookings add column if not exists discount_percent smallint;

-- Preis nach Rabatt (Rabatt gilt bis einschließlich discount_until, deutsche Zeit)
create or replace function public.coaching_effective_price(_price integer, _percent integer, _until date)
returns integer
language sql
stable
set search_path = public
as $$
  select case when _percent is not null and (_until is null or _until >= (now() at time zone 'Europe/Berlin')::date)
              then round(_price * (100 - _percent) / 100.0)::integer else _price end;
$$;

create or replace function public.coaching_set_discount(_offer_id uuid, _percent integer, _until date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _me    uuid := auth.uid();
  _o     public.coaching_offers;
  _today date := (now() at time zone 'Europe/Berlin')::date;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _o from public.coaching_offers where id = _offer_id and coach_id = _me for update;
  if _o.id is null then raise exception 'Dieses Angebot gibt es nicht oder es gehört dir nicht.'; end if;
  if coalesce(_percent, 0) = 0 then
    update public.coaching_offers set discount_percent = null, discount_until = null, updated_at = now() where id = _o.id;
    return jsonb_build_object('prozent', null, 'preis', _o.price_cents);
  end if;
  if not public.coach_license_active(_me) then raise exception 'Rabatte vergeben Coaches mit Coach-Lizenz.'; end if;
  if _percent < 5 or _percent > 70 then raise exception 'Der Rabatt muss zwischen 5 und 70 Prozent liegen.'; end if;
  if _until is not null and (_until < _today or _until > _today + 365) then
    raise exception 'Der Rabatt kann bis höchstens ein Jahr im Voraus gelten (und nicht in der Vergangenheit enden).';
  end if;
  update public.coaching_offers set discount_percent = _percent, discount_until = _until, updated_at = now() where id = _o.id;
  return jsonb_build_object('prozent', _percent, 'bis', _until,
                            'preis', public.coaching_effective_price(_o.price_cents, _percent, _until));
end;
$$;

-- Buchen: Urlaub beachten, Rabatt anwenden (ersetzt die Fassung aus 030; sonst unverändert)
create or replace function public.coaching_book_internal(_offer_id uuid, _message text, _preferred_time text, _scheduled_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _me    uuid := auth.uid();
  _offer record;
  _price integer;
  _fee   integer;
  _id    uuid;
  _cal   boolean;
  _tz    text;
  _away  public.coach_away;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _offer from public.coaching_offers where id = _offer_id and active;
  if _offer.id is null then raise exception 'Dieses Coaching wird nicht mehr angeboten.'; end if;
  if _offer.coach_id = _me then raise exception 'Dein eigenes Coaching kannst du nicht buchen.'; end if;
  if not public.coach_license_active(_offer.coach_id) then
    raise exception 'Dieser Coach bietet gerade keine Coachings an.';
  end if;
  if exists (select 1 from public.coaching_bookings where buyer_id = _me and offer_id = _offer_id and status in ('angefragt', 'angenommen')) then
    raise exception 'Du hast dieses Coaching bereits angefragt.';
  end if;
  if (select count(*) from public.coaching_bookings where buyer_id = _me and status = 'angefragt') >= 5 then
    raise exception 'Du hast schon 5 offene Anfragen. Warte bitte auf eine Antwort, bevor du weitere stellst.';
  end if;
  if (select count(*) from public.coaching_bookings where buyer_id = _me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Zu viele Anfragen in kurzer Zeit. Bitte versuche es später erneut.';
  end if;

  _cal := exists (select 1 from public.coach_availability where coach_id = _offer.coach_id);
  if _cal and _scheduled_at is null then
    raise exception 'Bitte wähle einen freien Termin aus dem Kalender des Coaches.';
  end if;
  if not _cal and _scheduled_at is not null then
    raise exception 'Dieser Coach hat keinen Kalender – schreib deinen Wunschtermin in die Anfrage.';
  end if;
  _tz := coalesce((select timezone from public.coach_calendars where coach_id = _offer.coach_id), 'Europe/Berlin');
  select * into _away from public.coach_away where coach_id = _offer.coach_id;
  if _cal then
    if public.coach_away_on(_offer.coach_id, (_scheduled_at at time zone _tz)::date) then
      raise exception 'Der Coach ist an diesem Tag im Urlaub%. Bitte wähle einen anderen Termin.',
        case when _away.until_day is not null then ' (bis ' || to_char(_away.until_day, 'DD.MM.YYYY') || ')' else '' end;
    end if;
    -- Je Coach nacheinander prüfen und eintragen: zwei gleichzeitige Buchungen bekommen nie denselben Termin
    perform pg_advisory_xact_lock(hashtext('gsra_coach_' || _offer.coach_id::text));
    if not exists (select 1 from public.coach_slots(_offer.coach_id, _offer.duration_minutes, (_scheduled_at at time zone _tz)::date, 1) s
                   where s = _scheduled_at) then
      raise exception 'Dieser Termin ist leider nicht mehr frei. Bitte wähle einen anderen.';
    end if;
  elsif public.coach_away_on(_offer.coach_id, public.coach_today(_offer.coach_id)) then
    raise exception 'Der Coach ist gerade im Urlaub%. Danach kannst du wieder anfragen.',
      case when _away.until_day is not null then ' (bis ' || to_char(_away.until_day, 'DD.MM.YYYY') || ')' else '' end;
  end if;

  -- Preis nach Rabatt; Servicegebühr: 10 % für Paddock, keine mit Pole oder Alliance (unverändert)
  _price := public.coaching_effective_price(_offer.price_cents, _offer.discount_percent, _offer.discount_until);
  _fee := case when public.plan_of(_me) in ('pole', 'alliance') then 0 else round(_price * 0.10)::integer end;
  insert into public.coaching_bookings (offer_id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents,
                                        preferred_time, message, scheduled_at, discount_percent)
  values (_offer.id, _offer.coach_id, _me, _offer.title, _offer.duration_minutes, _price, _fee, _price + _fee,
          case when _cal then null else nullif(left(trim(coalesce(_preferred_time, '')), 200), '') end,
          nullif(left(trim(coalesce(_message, '')), 1000), ''), case when _cal then _scheduled_at end,
          case when _price < _offer.price_cents then _offer.discount_percent end)
  returning id into _id;
  return jsonb_build_object('id', _id, 'price_cents', _price, 'fee_cents', _fee, 'total_cents', _price + _fee,
                            'scheduled_at', case when _cal then _scheduled_at end,
                            'rabatt', case when _price < _offer.price_cents then _offer.discount_percent end);
end;
$$;

-- ---------------------------------------------------------
-- 3) Bitte um Bewertung nach dem Coaching
-- ---------------------------------------------------------
alter table public.coaching_bookings add column if not exists review_asked_at timestamptz;
-- Schon vergangene Coachings bekommen keine nachträgliche E-Mail
update public.coaching_bookings set review_asked_at = now()
where review_asked_at is null and scheduled_at is not null and scheduled_at + make_interval(mins => duration_minutes) < now();

-- E-Mail-Liste (ersetzt coaching_reminder_run aus 036; alles andere bleibt gleich)
create or replace function public.coaching_reminder_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _due     jsonb;
  _cases   jsonb;
  _bans    jsonb;
  _reviews jsonb;
begin
  update public.coaching_reminder_runs set last_run = now()
  where id = 1 and last_run < now() - interval '4 minutes';
  if not found then
    return jsonb_build_object('lauf', false, 'erinnerungen', '[]'::jsonb, 'reklamationen', '[]'::jsonb, 'sperren', '[]'::jsonb, 'bewertungen', '[]'::jsonb);
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

  -- Bitte um Bewertung: 2 Std. nach dem Ende, höchstens 14 Tage danach, nur einmal
  with ask as (
    update public.coaching_bookings b set review_asked_at = now()
    where b.status in ('bezahlt', 'erledigt') and b.review_asked_at is null and b.scheduled_at is not null
      and b.scheduled_at + make_interval(mins => b.duration_minutes) + interval '2 hours' < now()
      and b.scheduled_at > now() - interval '14 days'
      and not exists (select 1 from public.coaching_reviews r where r.booking_id = b.id)
      and not exists (select 1 from public.coaching_disputes d where d.booking_id = b.id)
    returning b.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'titel', b.offer_title, 'termin', b.scheduled_at, 'coach_id', b.coach_id, 'kunde_id', b.buyer_id,
           'coach_name', coalesce((select username from public.profiles where id = b.coach_id), 'dein Coach'),
           'kunde_name', coalesce((select username from public.profiles where id = b.buyer_id), 'dein Kunde'))), '[]'::jsonb)
  into _reviews
  from ask a join public.coaching_bookings b on b.id = a.id;

  return jsonb_build_object('lauf', true, 'erinnerungen', _due, 'reklamationen', _cases, 'sperren', _bans, 'bewertungen', _reviews);
end;
$$;

-- ---------------------------------------------------------
-- 4) Rechte
-- ---------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['public.coach_set_away(date, date)', 'public.coach_end_away()', 'public.coach_away_info(uuid)',
                           'public.coaching_away_coaches()', 'public.coaching_set_discount(uuid, integer, date)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- Intern (nur über die Funktionen oben bzw. den Server)
  foreach f in array array['public.coach_today(uuid)', 'public.coach_away_on(uuid, date)', 'public.coach_slots(uuid, integer, date, integer)',
                           'public.coaching_book_internal(uuid, text, text, timestamptz)', 'public.coaching_reminder_run()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  begin
    grant execute on function public.coaching_reminder_run() to service_role;
  exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
  end;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „bereit“, „bereit“, „ja“)
-- ---------------------------------------------------------
select 'Urlaubsmodus (Tabelle geschützt, Funktionen)' as pruefung,
       case when (select relrowsecurity from pg_class where oid = 'public.coach_away'::regclass)
             and not has_table_privilege('authenticated', 'public.coach_away', 'insert')
             and to_regprocedure('public.coach_set_away(date, date)') is not null then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Rabatte (5–70 %, Buchung zum reduzierten Preis)',
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coaching_offers' and column_name = 'discount_percent')
             and to_regprocedure('public.coaching_set_discount(uuid, integer, date)') is not null then 'bereit' else 'FEHLT' end
union all
select 'Bitte um Bewertung (E-Mail-Liste)',
       case when (select prosrc from pg_proc where oid = 'public.coaching_reminder_run()'::regprocedure) like '%bewertungen%' then 'bereit' else 'FEHLT' end
union all
select 'Interne Funktionen für Nutzer gesperrt',
       case when not has_function_privilege('authenticated', 'public.coach_away_on(uuid, date)', 'execute')
             and not has_function_privilege('authenticated', 'public.coaching_book_internal(uuid, text, text, timestamptz)', 'execute')
             and not has_function_privilege('authenticated', 'public.coaching_reminder_run()', 'execute') then 'ja' else 'NEIN' end;
