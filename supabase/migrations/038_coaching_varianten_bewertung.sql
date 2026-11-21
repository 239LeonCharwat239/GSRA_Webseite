-- =========================================================
-- GSRA 038 – Coaching: Dauer-Varianten und Bewertungsabfrage auf der Seite (Entscheidung 21.11.)
--  * Dauer-Varianten: Ein Angebot kann neben seiner Grund-Dauer bis zu 3 weitere Längen mit eigenem Preis haben
--    (z. B. 1 Std. 30 €, 2 Std. 55 €, 3 Std. 80 €). Kunden wählen nur aus diesen Längen – kein Widerspruch zum
--    Angebot. Freie Termine und die Doppelbuchungs-Prüfung richten sich nach der gewählten Länge; Rabatte gelten
--    für alle Längen. Die bisherigen Funktionen (Grund-Dauer) bleiben unverändert nutzbar.
--  * Bewertung: Nach dem Coaching fragt die Webseite selbst („Wie war dein Coaching?“). „Nicht bewerten“ blendet
--    die Frage dauerhaft aus. Die E-Mail kommt nur noch als späte Erinnerung: 3 Tage nach dem Termin, wenn weder
--    bewertet noch abgelehnt wurde (statt nach 2 Stunden).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 030 und 037 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Dauer-Varianten
-- ---------------------------------------------------------
create table if not exists public.coaching_offer_variants (
  offer_id         uuid not null references public.coaching_offers(id) on delete cascade,
  duration_minutes integer not null check (duration_minutes between 15 and 600),
  price_cents      integer not null check (price_cents between 500 and 100000),
  created_at       timestamptz not null default now(),
  primary key (offer_id, duration_minutes)
);
alter table public.coaching_offer_variants enable row level security;
revoke all on public.coaching_offer_variants from anon, authenticated;
grant select on public.coaching_offer_variants to authenticated;
-- Sichtbar, wenn das Angebot sichtbar ist (die Regeln von coaching_offers gelten in der Unterabfrage mit)
drop policy if exists "GSRA Varianten sehen" on public.coaching_offer_variants;
create policy "GSRA Varianten sehen" on public.coaching_offer_variants for select to authenticated
  using (exists (select 1 from public.coaching_offers o where o.id = offer_id));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.coaching_offer_variants;
create policy "Gesperrte Konten haben keinen Zugriff" on public.coaching_offer_variants as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));
drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.coaching_offer_variants;
create policy "GSRA Zwei-Faktor erforderlich" on public.coaching_offer_variants as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Coach: weitere Längen eines Angebots festlegen (ersetzt alle bisherigen; leere Liste = nur die Grund-Dauer)
-- _variants: [{"dauer": Minuten, "preis": Cent}, …]
create or replace function public.coaching_save_variants(_offer_id uuid, _variants jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _me  uuid := auth.uid();
  _o   public.coaching_offers;
  _v   jsonb := coalesce(_variants, '[]'::jsonb);
  _bad integer;
  _n   integer;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _o from public.coaching_offers where id = _offer_id and coach_id = _me for update;
  if _o.id is null then raise exception 'Dieses Angebot gibt es nicht oder es gehört dir nicht.'; end if;
  if jsonb_typeof(_v) <> 'array' then raise exception 'Die Längen sind ungültig.'; end if;
  if jsonb_array_length(_v) > 3 then raise exception 'Höchstens 3 weitere Längen pro Angebot.'; end if;
  if jsonb_array_length(_v) > 0 and not public.coach_license_active(_me) then
    raise exception 'Weitere Längen bieten Coaches mit Coach-Lizenz an.';
  end if;
  select count(*) into _bad from jsonb_array_elements(_v) e
  where jsonb_typeof(e) <> 'object' or coalesce(e->>'dauer', '') !~ '^\d{2,3}$' or coalesce(e->>'preis', '') !~ '^\d{3,6}$';
  if _bad > 0 then raise exception 'Die Längen sind ungültig.'; end if;
  select count(*) into _bad from jsonb_array_elements(_v) e
  where (e->>'dauer')::integer not between 15 and 600 or (e->>'dauer')::integer % 15 <> 0;
  if _bad > 0 then raise exception 'Jede Länge braucht 15 Minuten bis 10 Stunden (in Viertelstunden).'; end if;
  select count(*) into _bad from jsonb_array_elements(_v) e where (e->>'preis')::integer not between 500 and 100000;
  if _bad > 0 then raise exception 'Jeder Preis muss zwischen 5 € und 1.000 € liegen.'; end if;
  if (select count(distinct (e->>'dauer')::integer) from jsonb_array_elements(_v) e) <> jsonb_array_length(_v)
     or exists (select 1 from jsonb_array_elements(_v) e where (e->>'dauer')::integer = _o.duration_minutes) then
    raise exception 'Jede Länge darf es nur einmal geben (auch nicht doppelt zur Grund-Dauer).';
  end if;
  delete from public.coaching_offer_variants where offer_id = _o.id;
  insert into public.coaching_offer_variants (offer_id, duration_minutes, price_cents)
  select _o.id, (e->>'dauer')::integer, (e->>'preis')::integer from jsonb_array_elements(_v) e;
  get diagnostics _n = row_count;
  update public.coaching_offers set updated_at = now() where id = _o.id;
  return _n;
end;
$$;

-- Freie Termine für eine bestimmte Länge (leer = Grund-Dauer)
create or replace function public.coaching_free_slots_dauer(_offer_id uuid, _duration integer default null, _from date default null, _days integer default 28)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _o     record;
  _dur   integer;
  _tz    text;
  _today date;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select id, coach_id, duration_minutes into _o from public.coaching_offers where id = _offer_id and active;
  if _o.id is null or not public.coach_license_active(_o.coach_id) then
    raise exception 'Dieses Coaching wird nicht mehr angeboten.';
  end if;
  if _duration is null or _duration = _o.duration_minutes then
    _dur := _o.duration_minutes;
  else
    select duration_minutes into _dur from public.coaching_offer_variants where offer_id = _o.id and duration_minutes = _duration;
    if _dur is null then raise exception 'Diese Dauer bietet der Coach nicht an.'; end if;
  end if;
  if not exists (select 1 from public.coach_availability where coach_id = _o.coach_id) then
    return jsonb_build_object('kalender', false);
  end if;
  _tz := coalesce((select timezone from public.coach_calendars where coach_id = _o.coach_id), 'Europe/Berlin');
  _today := (now() at time zone _tz)::date;
  return jsonb_build_object('kalender', true, 'zeitzone', _tz, 'dauer', _dur, 'slots', coalesce((
    select jsonb_agg(s order by s)
    from public.coach_slots(_o.coach_id, _dur, greatest(coalesce(_from, _today), _today), least(greatest(coalesce(_days, 28), 1), 62)) s
  ), '[]'::jsonb));
end;
$$;

-- Bisheriger Aufruf: Grund-Dauer (unverändert, ersetzt die Fassung aus 030)
create or replace function public.coaching_free_slots(_offer_id uuid, _from date default null, _days integer default 28)
returns jsonb
language sql
stable security definer
set search_path = public
as $$
  select public.coaching_free_slots_dauer(_offer_id, null, _from, _days);
$$;

-- Buchen mit gewählter Länge (Urlaub, Rabatt und Kalender wie in 037)
create or replace function public.coaching_book_v2(_offer_id uuid, _message text, _preferred_time text, _scheduled_at timestamptz, _duration integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _me    uuid := auth.uid();
  _offer record;
  _dur   integer;
  _base  integer;
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
  -- Gewählte Länge: Grund-Dauer oder eine der Varianten des Coaches
  if _duration is null or _duration = _offer.duration_minutes then
    _dur := _offer.duration_minutes;
    _base := _offer.price_cents;
  else
    select duration_minutes, price_cents into _dur, _base from public.coaching_offer_variants
    where offer_id = _offer.id and duration_minutes = _duration;
    if _dur is null then raise exception 'Diese Dauer bietet der Coach nicht an.'; end if;
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
    perform pg_advisory_xact_lock(hashtext('gsra_coach_' || _offer.coach_id::text));
    if not exists (select 1 from public.coach_slots(_offer.coach_id, _dur, (_scheduled_at at time zone _tz)::date, 1) s
                   where s = _scheduled_at) then
      raise exception 'Dieser Termin ist leider nicht mehr frei. Bitte wähle einen anderen.';
    end if;
  elsif public.coach_away_on(_offer.coach_id, public.coach_today(_offer.coach_id)) then
    raise exception 'Der Coach ist gerade im Urlaub%. Danach kannst du wieder anfragen.',
      case when _away.until_day is not null then ' (bis ' || to_char(_away.until_day, 'DD.MM.YYYY') || ')' else '' end;
  end if;

  _price := public.coaching_effective_price(_base, _offer.discount_percent, _offer.discount_until);
  _fee := case when public.plan_of(_me) in ('pole', 'alliance') then 0 else round(_price * 0.10)::integer end;
  insert into public.coaching_bookings (offer_id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents,
                                        preferred_time, message, scheduled_at, discount_percent)
  values (_offer.id, _offer.coach_id, _me, _offer.title, _dur, _price, _fee, _price + _fee,
          case when _cal then null else nullif(left(trim(coalesce(_preferred_time, '')), 200), '') end,
          nullif(left(trim(coalesce(_message, '')), 1000), ''), case when _cal then _scheduled_at end,
          case when _price < _base then _offer.discount_percent end)
  returning id into _id;
  return jsonb_build_object('id', _id, 'dauer', _dur, 'price_cents', _price, 'fee_cents', _fee, 'total_cents', _price + _fee,
                            'scheduled_at', case when _cal then _scheduled_at end,
                            'rabatt', case when _price < _base then _offer.discount_percent end);
end;
$$;

-- Bisherige Wege buchen die Grund-Dauer (ersetzt die Fassung aus 037)
create or replace function public.coaching_book_internal(_offer_id uuid, _message text, _preferred_time text, _scheduled_at timestamptz)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.coaching_book_v2(_offer_id, _message, _preferred_time, _scheduled_at, null);
$$;

-- Neu: mit gewählter Länge (Termin aus dem Kalender oder Wunschtermin als Text)
create or replace function public.coaching_book_dauer(_offer_id uuid, _duration integer, _scheduled_at timestamptz default null,
                                                      _message text default null, _preferred_time text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.coaching_book_v2(_offer_id, _message, _preferred_time, _scheduled_at, _duration);
$$;

-- ---------------------------------------------------------
-- 2) Bewertung: Abfrage auf der Seite, E-Mail nur als späte Erinnerung
-- ---------------------------------------------------------
alter table public.coaching_bookings add column if not exists review_dismissed_at timestamptz;

-- Eigene Coachings, die auf eine Bewertung warten (höchstens 3, neueste zuerst)
create or replace function public.coaching_review_prompts()
returns jsonb
language sql
stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.termin desc), '[]'::jsonb) from (
    select b.id, b.offer_title as titel, b.scheduled_at as termin, b.coach_id,
           coalesce((select username from public.profiles where id = b.coach_id), 'dein Coach') as coach_name
    from public.coaching_bookings b
    where b.buyer_id = auth.uid() and b.status in ('bezahlt', 'erledigt') and b.scheduled_at is not null
      and b.scheduled_at + make_interval(mins => b.duration_minutes) <= now()
      and b.scheduled_at > now() - interval '14 days'
      and b.review_dismissed_at is null
      and not exists (select 1 from public.coaching_reviews r where r.booking_id = b.id)
      and not exists (select 1 from public.coaching_disputes d where d.booking_id = b.id)
    order by b.scheduled_at desc
    limit 3
  ) x;
$$;

-- „Nicht bewerten“: Frage und E-Mail-Erinnerung entfallen für dieses Coaching
create or replace function public.coaching_review_dismiss(_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  update public.coaching_bookings set review_dismissed_at = now()
  where id = _booking_id and buyer_id = auth.uid() and review_dismissed_at is null;
  if not found and not exists (select 1 from public.coaching_bookings where id = _booking_id and buyer_id = auth.uid()) then
    raise exception 'Dieses Coaching gehört nicht zu deinen Buchungen.';
  end if;
end;
$$;

-- E-Mail-Liste (ersetzt die Fassung aus 037; geändert nur: Bewertungs-E-Mail erst nach 3 Tagen und nicht nach „Nicht bewerten“)
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

  -- Späte Erinnerung: 3 Tage nach dem Ende, nur wenn auf der Seite weder bewertet noch „Nicht bewerten“ gewählt wurde
  with ask as (
    update public.coaching_bookings b set review_asked_at = now()
    where b.status in ('bezahlt', 'erledigt') and b.review_asked_at is null and b.review_dismissed_at is null
      and b.scheduled_at is not null
      and b.scheduled_at + make_interval(mins => b.duration_minutes) + interval '3 days' < now()
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
-- 3) Rechte
-- ---------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['public.coaching_save_variants(uuid, jsonb)', 'public.coaching_free_slots_dauer(uuid, integer, date, integer)',
                           'public.coaching_free_slots(uuid, date, integer)', 'public.coaching_book_dauer(uuid, integer, timestamptz, text, text)',
                           'public.coaching_review_prompts()', 'public.coaching_review_dismiss(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.coaching_book_v2(uuid, text, text, timestamptz, integer)',
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
-- Kontrolle (erwartet: „bereit“, „bereit“, „ja“)
-- ---------------------------------------------------------
select 'Dauer-Varianten (Tabelle geschützt, Funktionen)' as pruefung,
       case when (select relrowsecurity from pg_class where oid = 'public.coaching_offer_variants'::regclass)
             and not has_table_privilege('authenticated', 'public.coaching_offer_variants', 'insert')
             and to_regprocedure('public.coaching_book_dauer(uuid, integer, timestamptz, text, text)') is not null then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Bewertung auf der Seite (E-Mail erst nach 3 Tagen)',
       case when to_regprocedure('public.coaching_review_prompts()') is not null
             and (select prosrc from pg_proc where oid = 'public.coaching_reminder_run()'::regprocedure) like '%3 days%' then 'bereit' else 'FEHLT' end
union all
select 'Interne Funktionen für Nutzer gesperrt',
       case when not has_function_privilege('authenticated', 'public.coaching_book_v2(uuid, text, text, timestamptz, integer)', 'execute')
             and not has_function_privilege('authenticated', 'public.coaching_reminder_run()', 'execute') then 'ja' else 'NEIN' end;
