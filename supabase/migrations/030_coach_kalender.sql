-- =========================================================
-- GSRA 030 – Verfügbarkeitskalender für Coaches (17.11.)
--  * Coaches tragen wöchentliche Zeitfenster ein (z. B. Mo–Fr 18–22 Uhr) und können einzelne Tage sperren
--    (Urlaub). Die Zeiten gelten in der Zeitzone des Coaches.
--  * Hat ein Coach Zeiten eingetragen, buchen Kunden nur freie Termine daraus: frühestens 24 Stunden,
--    spätestens 60 Tage im Voraus, im 30-Minuten-Raster. Ohne Zeiten bleibt alles wie bisher (Wunschtermin).
--  * Keine Doppelbelegung: Offene Anfragen, angenommene und bezahlte Coachings blockieren ihre Zeit. Auch beim
--    Annehmen und Verschieben prüft die Datenbank, dass sich nichts überschneidet (je Coach nacheinander).
-- Schreiben nur über Funktionen. Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 024–027 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Tabellen: Zeitzone, Zeitfenster, gesperrte Tage (jeder Coach sieht nur seine eigenen)
-- ---------------------------------------------------------
create table if not exists public.coach_calendars (
  coach_id    uuid primary key references auth.users(id) on delete cascade,
  timezone    text not null default 'Europe/Berlin' check (char_length(timezone) between 1 and 64),
  updated_at  timestamptz not null default now()
);
create table if not exists public.coach_availability (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references auth.users(id) on delete cascade,
  weekday    smallint not null check (weekday between 1 and 7),                       -- 1 = Montag … 7 = Sonntag
  start_min  smallint not null check (start_min between 0 and 1410 and start_min % 15 = 0),  -- Minuten ab 0 Uhr
  end_min    smallint not null check (end_min between 30 and 1440 and end_min % 15 = 0),
  check (end_min - start_min >= 30)
);
create index if not exists coach_availability_coach_idx on public.coach_availability (coach_id, weekday);
create table if not exists public.coach_blocked_days (
  coach_id  uuid not null references auth.users(id) on delete cascade,
  day       date not null,
  primary key (coach_id, day)
);

do $$
declare t text;
begin
  foreach t in array array['coach_calendars', 'coach_availability', 'coach_blocked_days'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists "GSRA eigener Kalender" on public.%I', t);
    execute format('create policy "GSRA eigener Kalender" on public.%I for select to authenticated using (coach_id = (select auth.uid()))', t);
    execute format('drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.%I', t);
    execute format('create policy "Gesperrte Konten haben keinen Zugriff" on public.%I as restrictive for all to authenticated
                      using (not (select public.is_banned())) with check (not (select public.is_banned()))', t);
    execute format('drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.%I', t);
    execute format('create policy "GSRA Zwei-Faktor erforderlich" on public.%I as restrictive for all to authenticated
                      using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------
-- 2) Intern: Ist die Zeit frei? Welche Termine sind buchbar?
-- ---------------------------------------------------------
-- Frei = keine offene Anfrage, kein angenommenes oder bezahltes Coaching überschneidet sich (_ignore: die eigene Buchung)
create or replace function public.coach_time_free(_coach uuid, _start timestamptz, _duration integer, _ignore uuid default null)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.coaching_bookings b
    where b.coach_id = _coach and b.status in ('angefragt', 'angenommen', 'bezahlt')
      and b.scheduled_at is not null and (_ignore is null or b.id <> _ignore)
      and b.scheduled_at < _start + make_interval(mins => _duration)
      and b.scheduled_at + make_interval(mins => b.duration_minutes) > _start);
$$;

-- Freie Starttermine im 30-Minuten-Raster ab _from (Tag in der Zeitzone des Coaches) für _days Tage
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
-- 3) Für Coaches: Kalender speichern (ersetzt alle Zeiten auf einmal; leere Liste = Kalender aus)
--    _windows: [{"tag": 1–7, "von": Minuten, "bis": Minuten}, …]   _blocked: gesperrte Tage
-- ---------------------------------------------------------
create or replace function public.coach_save_calendar(_timezone text, _windows jsonb, _blocked date[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _me   uuid := auth.uid();
  _w    jsonb := coalesce(_windows, '[]'::jsonb);
  _bad  integer;
  _n    integer;
  _days integer;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if not public.coach_license_active(_me) then
    raise exception 'Freie Zeiten trägst du ein, sobald du die GSRA-Coach-Lizenz hast.';
  end if;
  if _timezone is null or _timezone !~ '^(UTC|[A-Za-z_]+(/[A-Za-z0-9_+-]+){1,2})$' then raise exception 'Unbekannte Zeitzone.'; end if;
  begin
    perform now() at time zone _timezone;
  exception when others then
    raise exception 'Unbekannte Zeitzone.';
  end;
  if jsonb_typeof(_w) <> 'array' then raise exception 'Die Zeiten sind ungültig.'; end if;
  if jsonb_array_length(_w) > 42 then raise exception 'Bitte trage höchstens 6 Zeitfenster pro Tag ein.'; end if;
  if coalesce(cardinality(_blocked), 0) > 100 then raise exception 'Bitte sperre höchstens 100 Tage auf einmal.'; end if;

  -- Form: Tag 1–7, Uhrzeiten in Minuten (Viertelstunden), mindestens 30 Minuten lang
  select count(*) into _bad from jsonb_array_elements(_w) e
  where jsonb_typeof(e) <> 'object' or coalesce(e->>'tag', '') !~ '^[1-7]$'
     or coalesce(e->>'von', '') !~ '^\d{1,4}$' or coalesce(e->>'bis', '') !~ '^\d{1,4}$';
  if _bad > 0 then raise exception 'Die Zeiten sind ungültig.'; end if;
  select count(*) into _bad from jsonb_array_elements(_w) e
  where (e->>'von')::integer % 15 <> 0 or (e->>'bis')::integer % 15 <> 0
     or (e->>'bis')::integer > 1440 or (e->>'bis')::integer - (e->>'von')::integer < 30;
  if _bad > 0 then raise exception 'Jedes Zeitfenster braucht mindestens 30 Minuten (in Viertelstunden, bis 24 Uhr).'; end if;
  -- Keine Überschneidungen am selben Tag
  with w as (
    select row_number() over () as i, (e->>'tag')::integer as tag, (e->>'von')::integer as von, (e->>'bis')::integer as bis
    from jsonb_array_elements(_w) e
  )
  select count(*) into _bad from w a join w b on a.tag = b.tag and a.i < b.i and a.von < b.bis and b.von < a.bis;
  if _bad > 0 then raise exception 'Zwei Zeitfenster am selben Tag überschneiden sich.'; end if;
  if exists (select 1 from unnest(coalesce(_blocked, '{}')) d where d > current_date + 365) then
    raise exception 'Tage sperren geht bis ein Jahr im Voraus.';
  end if;

  delete from public.coach_availability where coach_id = _me;
  insert into public.coach_availability (coach_id, weekday, start_min, end_min)
  select _me, (e->>'tag')::smallint, (e->>'von')::smallint, (e->>'bis')::smallint from jsonb_array_elements(_w) e;
  get diagnostics _n = row_count;
  -- Vergangene Tage fallen still weg
  delete from public.coach_blocked_days where coach_id = _me;
  insert into public.coach_blocked_days (coach_id, day)
  select distinct _me, d from unnest(coalesce(_blocked, '{}')) d where d >= current_date - 1;
  get diagnostics _days = row_count;
  insert into public.coach_calendars (coach_id, timezone, updated_at) values (_me, _timezone, now())
  on conflict (coach_id) do update set timezone = excluded.timezone, updated_at = now();
  return jsonb_build_object('fenster', _n, 'gesperrt', _days);
end;
$$;

-- ---------------------------------------------------------
-- 4) Für Kunden: freie Termine eines Angebots; welche Coaches einen Kalender haben
-- ---------------------------------------------------------
create or replace function public.coaching_free_slots(_offer_id uuid, _from date default null, _days integer default 28)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _o     record;
  _tz    text;
  _today date;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select id, coach_id, duration_minutes into _o from public.coaching_offers where id = _offer_id and active;
  if _o.id is null or not public.coach_license_active(_o.coach_id) then
    raise exception 'Dieses Coaching wird nicht mehr angeboten.';
  end if;
  if not exists (select 1 from public.coach_availability where coach_id = _o.coach_id) then
    return jsonb_build_object('kalender', false);
  end if;
  _tz := coalesce((select timezone from public.coach_calendars where coach_id = _o.coach_id), 'Europe/Berlin');
  _today := (now() at time zone _tz)::date;
  return jsonb_build_object('kalender', true, 'zeitzone', _tz, 'slots', coalesce((
    select jsonb_agg(s order by s)
    from public.coach_slots(_o.coach_id, _o.duration_minutes, greatest(coalesce(_from, _today), _today), least(greatest(coalesce(_days, 28), 1), 62)) s
  ), '[]'::jsonb));
end;
$$;

create or replace function public.coaching_calendar_coaches()
returns setof uuid
language sql
stable security definer
set search_path = public
as $$
  select distinct coach_id from public.coach_availability;
$$;

-- ---------------------------------------------------------
-- 5) Buchen: mit Kalender nur freie Termine, ohne Kalender wie bisher mit Wunschtermin
-- ---------------------------------------------------------
create or replace function public.coaching_book_internal(_offer_id uuid, _message text, _preferred_time text, _scheduled_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _me    uuid := auth.uid();
  _offer record;
  _fee   integer;
  _id    uuid;
  _cal   boolean;
  _tz    text;
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
  if _cal then
    -- Je Coach nacheinander prüfen und eintragen: zwei gleichzeitige Buchungen bekommen nie denselben Termin
    perform pg_advisory_xact_lock(hashtext('gsra_coach_' || _offer.coach_id::text));
    _tz := coalesce((select timezone from public.coach_calendars where coach_id = _offer.coach_id), 'Europe/Berlin');
    if not exists (select 1 from public.coach_slots(_offer.coach_id, _offer.duration_minutes, (_scheduled_at at time zone _tz)::date, 1) s
                   where s = _scheduled_at) then
      raise exception 'Dieser Termin ist leider nicht mehr frei. Bitte wähle einen anderen.';
    end if;
  end if;

  -- Servicegebühr: 10 % für Paddock, keine mit Pole oder Alliance (unverändert)
  _fee := case when public.plan_of(_me) in ('pole', 'alliance') then 0 else round(_offer.price_cents * 0.10)::integer end;
  insert into public.coaching_bookings (offer_id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents,
                                        preferred_time, message, scheduled_at)
  values (_offer.id, _offer.coach_id, _me, _offer.title, _offer.duration_minutes, _offer.price_cents, _fee, _offer.price_cents + _fee,
          case when _cal then null else nullif(left(trim(coalesce(_preferred_time, '')), 200), '') end,
          nullif(left(trim(coalesce(_message, '')), 1000), ''), case when _cal then _scheduled_at end)
  returning id into _id;
  return jsonb_build_object('id', _id, 'price_cents', _offer.price_cents, 'fee_cents', _fee, 'total_cents', _offer.price_cents + _fee,
                            'scheduled_at', case when _cal then _scheduled_at end);
end;
$$;

-- Bisheriger Aufruf (Wunschtermin als Text) – bei Coaches mit Kalender abgelehnt
create or replace function public.coaching_book(_offer_id uuid, _message text default null, _preferred_time text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.coaching_book_internal(_offer_id, _message, _preferred_time, null);
$$;

-- Neuer Aufruf: Termin aus dem Kalender
create or replace function public.coaching_book_at(_offer_id uuid, _scheduled_at timestamptz, _message text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.coaching_book_internal(_offer_id, _message, null, _scheduled_at);
$$;

-- ---------------------------------------------------------
-- 6) Annehmen und Verschieben: nie zwei Coachings gleichzeitig (ersetzt die Fassungen aus 025)
-- ---------------------------------------------------------
create or replace function public.coaching_respond(_booking_id uuid, _accept boolean, _scheduled_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _b  record;
  _at timestamptz;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _b from public.coaching_bookings where id = _booking_id and coach_id = auth.uid() and status = 'angefragt' for update;
  if _b.id is null then raise exception 'Diese Anfrage gibt es nicht mehr oder sie wurde schon beantwortet.'; end if;
  if not _accept then
    update public.coaching_bookings set status = 'abgelehnt', updated_at = now() where id = _b.id;
    return;
  end if;
  -- Ohne neue Zeit gilt der Termin, den der Kunde im Kalender gewählt hat
  _at := coalesce(_scheduled_at, _b.scheduled_at);
  if _at is null or _at < now() + interval '1 hour' or _at > now() + interval '180 days' then
    raise exception 'Bitte wähle einen Termin, der mindestens 1 Stunde und höchstens 6 Monate in der Zukunft liegt.';
  end if;
  perform pg_advisory_xact_lock(hashtext('gsra_coach_' || _b.coach_id::text));
  if not public.coach_time_free(_b.coach_id, _at, _b.duration_minutes, _b.id) then
    raise exception 'Zu dieser Zeit hast du schon ein anderes Coaching oder eine offene Anfrage. Bitte wähle einen anderen Termin.';
  end if;
  update public.coaching_bookings set status = 'angenommen', scheduled_at = _at, updated_at = now() where id = _b.id;
end;
$$;

create or replace function public.coaching_set_time(_booking_id uuid, _scheduled_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _b record;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _scheduled_at is null or _scheduled_at < now() + interval '1 hour' or _scheduled_at > now() + interval '180 days' then
    raise exception 'Bitte wähle einen Termin, der mindestens 1 Stunde und höchstens 6 Monate in der Zukunft liegt.';
  end if;
  select * into _b from public.coaching_bookings where id = _booking_id and coach_id = auth.uid() and status = 'angenommen' for update;
  if _b.id is null then raise exception 'Den Termin kannst du nur ändern, solange noch nicht bezahlt ist.'; end if;
  perform pg_advisory_xact_lock(hashtext('gsra_coach_' || _b.coach_id::text));
  if not public.coach_time_free(_b.coach_id, _scheduled_at, _b.duration_minutes, _b.id) then
    raise exception 'Zu dieser Zeit hast du schon ein anderes Coaching oder eine offene Anfrage. Bitte wähle einen anderen Termin.';
  end if;
  update public.coaching_bookings set scheduled_at = _scheduled_at, updated_at = now() where id = _b.id;
end;
$$;

-- ---------------------------------------------------------
-- 7) Rechte: interne Funktionen für niemanden direkt, die übrigen nur für angemeldete Mitglieder
-- ---------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['public.coach_time_free(uuid, timestamptz, integer, uuid)', 'public.coach_slots(uuid, integer, date, integer)',
                           'public.coaching_book_internal(uuid, text, text, timestamptz)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['public.coach_save_calendar(text, jsonb, date[])', 'public.coaching_free_slots(uuid, date, integer)',
                           'public.coaching_calendar_coaches()', 'public.coaching_book(uuid, text, text)',
                           'public.coaching_book_at(uuid, timestamptz, text)', 'public.coaching_respond(uuid, boolean, timestamptz)',
                           'public.coaching_set_time(uuid, timestamptz)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „3 von 3“, „bereit“, „ja“)
-- ---------------------------------------------------------
select 'Kalender-Tabellen geschützt' as pruefung,
       (select count(*) from pg_tables where schemaname = 'public' and rowsecurity
          and tablename in ('coach_calendars', 'coach_availability', 'coach_blocked_days'))::text || ' von 3' as ergebnis
union all
select 'Kalender-Funktionen',
       case when to_regprocedure('public.coaching_free_slots(uuid, date, integer)') is not null
             and to_regprocedure('public.coaching_book_at(uuid, timestamptz, text)') is not null
             and to_regprocedure('public.coach_save_calendar(text, jsonb, date[])') is not null then 'bereit' else 'fehlt' end
union all
select 'Interne Funktionen nicht direkt aufrufbar',
       case when not has_function_privilege('authenticated', 'public.coach_slots(uuid, integer, date, integer)', 'execute')
             and not has_function_privilege('authenticated', 'public.coaching_book_internal(uuid, text, text, timestamptz)', 'execute')
             and not has_function_privilege('anon', 'public.coaching_free_slots(uuid, date, integer)', 'execute') then 'ja' else 'nein' end;
