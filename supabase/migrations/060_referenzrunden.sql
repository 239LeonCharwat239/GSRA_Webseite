-- =========================================================
-- GSRA – 060: Referenzrunden (Wunsch 27./28.11.)
-- =========================================================
-- Damit der Renningenieur gegen ECHTE Bestwerte vergleichen kann (nicht nur eigene Runden gegeneinander), sammelt die
-- GSRA sehr schnelle Runden je Strecke und Auto:
--  * „eigen“: Eine Person lädt in der App ausdrücklich eine eigene Runde hoch (mit Tempo, Gas und Bremse – daraus
--    entstehen später die Bremspunkte für „Fahr eine Runde mit mir“). Angezeigt wird sie anonym; ein Name kommt erst
--    später mit einer eigenen Zustimmung (Spalte name_zeigen, vorerst immer aus).
--  * „feld“: Die schnellste Runde eines ANDEREN Autos aus derselben Sitzung (z. B. ein E-Sportler im Rennen). Davon kennt
--    die App nur die Zeit über die Strecke, keine Pedale. Gespeichert wird sie ohne Namen, ohne Startnummer, ohne
--    iRacing-Kennung – nur Strecke, Auto, Zeit und Zeitverlauf.
-- Abgesichert:
--  * Tabelle für niemanden direkt les- oder beschreibbar; Hochladen nur über reference_lap_add (angemeldet, Zwei-Faktor
--    bestätigt falls eingerichtet, nicht gesperrt), Lesen nur über reference_laps_get (angemeldet, nicht gesperrt) –
--    die Antwort enthält NIE, wer hochgeladen hat.
--  * Strenge Prüfung: Strecke/Auto 2–120 bzw. 1–120 Zeichen (bereinigt), Zeit 20–1.800 s, Zeitverlauf genau 201 Werte,
--    beginnt bei 0, steigt stetig, endet bei der Rundenzeit (±2 %); Tempo 0–500 km/h, Gas/Bremse 0–100 %;
--    Feld-Runden ohne Pedale.
--  * Höchstens 60 Uploads je Person und Tag; dieselbe Feld-Runde (gleiche Strecke, gleiches Auto, gleiche Zeit auf
--    die Tausendstel, letzte 6 Stunden) wird nur einmal gespeichert, auch wenn viele im Rennen sie melden.
--  * Je Strecke und Auto bleiben die 50 schnellsten Runden; langsamere fallen raus.
--  * Eigene Runden lassen sich jederzeit löschen (reference_lap_delete); wird ein Konto gelöscht, verschwinden auch
--    alle Runden, die es hochgeladen hat.
-- Darf mehrfach laufen. Am Ende: Kontrollabfrage („bereit“ …).
-- =========================================================

create table if not exists public.reference_laps (
  id              uuid primary key default gen_random_uuid(),
  sim             text not null default 'iRacing',
  strecke         text not null,
  fahrzeug        text not null,
  laenge_m        real,
  zeit_s          real not null,
  quelle          text not null,
  zeitverlauf     real[] not null,
  tempo           real[],
  gas             real[],
  bremse          real[],
  name_zeigen     boolean not null default false,
  hochgeladen_von uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now()
);

alter table public.reference_laps drop constraint if exists reference_laps_sim_check;
alter table public.reference_laps add constraint reference_laps_sim_check check (sim in ('iRacing'));
alter table public.reference_laps drop constraint if exists reference_laps_quelle_check;
alter table public.reference_laps add constraint reference_laps_quelle_check check (quelle in ('eigen', 'feld'));
alter table public.reference_laps drop constraint if exists reference_laps_zeit_check;
alter table public.reference_laps add constraint reference_laps_zeit_check check (zeit_s between 20 and 1800);
alter table public.reference_laps drop constraint if exists reference_laps_text_check;
alter table public.reference_laps add constraint reference_laps_text_check
  check (char_length(strecke) between 2 and 120 and char_length(fahrzeug) between 1 and 120);
alter table public.reference_laps drop constraint if exists reference_laps_verlauf_check;
alter table public.reference_laps add constraint reference_laps_verlauf_check
  check (array_length(zeitverlauf, 1) = 201
         and (tempo is null or array_length(tempo, 1) = 201)
         and (gas is null or array_length(gas, 1) = 201)
         and (bremse is null or array_length(bremse, 1) = 201));
alter table public.reference_laps drop constraint if exists reference_laps_feld_check;
alter table public.reference_laps add constraint reference_laps_feld_check
  check (quelle = 'eigen' or (tempo is null and gas is null and bremse is null and not name_zeigen));

create index if not exists reference_laps_suche on public.reference_laps (strecke, fahrzeug, zeit_s);
create index if not exists reference_laps_von on public.reference_laps (hochgeladen_von, created_at);

alter table public.reference_laps enable row level security;
revoke all on public.reference_laps from public, anon, authenticated;
-- Keine Zugriffsregel für Personen: lesen und schreiben nur über die Funktionen unten
drop policy if exists "GSRA: Referenzrunden nur über Funktionen" on public.reference_laps;
create policy "GSRA: Referenzrunden nur über Funktionen" on public.reference_laps
  as restrictive for all to public using (false) with check (false);

-- ---------------------------------------------------------
-- Prüfen einer Werte-Reihe (endlich, im Bereich)
-- ---------------------------------------------------------
create or replace function public.reference_lap_reihe_ok(_werte real[], _min real, _max real)
returns boolean
language sql
immutable
set search_path = public
as $$
  select _werte is null
      or (array_length(_werte, 1) = 201
          and not exists (select 1 from unnest(_werte) w where w is null or w = 'NaN'::real or w < _min or w > _max));
$$;
revoke execute on function public.reference_lap_reihe_ok(real[], real, real) from public, anon, authenticated;

-- ---------------------------------------------------------
-- Hochladen
-- ---------------------------------------------------------
create or replace function public.reference_lap_add(
  _strecke text, _fahrzeug text, _laenge_m real, _zeit_s real, _quelle text,
  _zeitverlauf real[], _tempo real[] default null, _gas real[] default null, _bremse real[] default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me  uuid := auth.uid();
  _str text := left(btrim(regexp_replace(coalesce(_strecke, ''), '[[:cntrl:]]', ' ', 'g')), 120);
  _fz  text := left(btrim(regexp_replace(coalesce(_fahrzeug, ''), '[[:cntrl:]]', ' ', 'g')), 120);
  _id  uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if not public.mfa_ok() then raise exception 'Bitte bestätige zuerst deine Zwei-Faktor-Anmeldung.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _quelle is null or _quelle not in ('eigen', 'feld') then raise exception 'Unbekannte Herkunft.'; end if;
  if char_length(_str) < 2 or char_length(_fz) < 1 then raise exception 'Strecke oder Auto fehlt.'; end if;
  if _zeit_s is null or _zeit_s = 'NaN'::real or _zeit_s < 20 or _zeit_s > 1800 then raise exception 'Die Rundenzeit ist nicht plausibel.'; end if;
  if _laenge_m is not null and (_laenge_m = 'NaN'::real or _laenge_m < 300 or _laenge_m > 30000) then raise exception 'Die Streckenlänge ist nicht plausibel.'; end if;
  if not public.reference_lap_reihe_ok(_zeitverlauf, 0, 1800) or _zeitverlauf is null then raise exception 'Der Zeitverlauf ist ungültig.'; end if;
  -- beginnt bei 0, steigt stetig, endet bei der Rundenzeit
  if _zeitverlauf[1] > 0.5
     or abs(_zeitverlauf[201] - _zeit_s) > _zeit_s * 0.02
     or exists (select 1 from generate_series(2, 201) i where _zeitverlauf[i] < _zeitverlauf[i - 1]) then
    raise exception 'Der Zeitverlauf passt nicht zur Rundenzeit.';
  end if;
  if _quelle = 'feld' and (_tempo is not null or _gas is not null or _bremse is not null) then
    raise exception 'Runden aus dem Feld haben keine Pedaldaten.';
  end if;
  if not public.reference_lap_reihe_ok(_tempo, 0, 500) or not public.reference_lap_reihe_ok(_gas, 0, 100)
     or not public.reference_lap_reihe_ok(_bremse, 0, 100) then
    raise exception 'Tempo, Gas oder Bremse sind ungültig.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gsra-referenzrunden:' || _me::text, 0));
  if (select count(*) from public.reference_laps where hochgeladen_von = _me and created_at > now() - interval '1 day') >= 60 then
    raise exception 'Für heute hast du genug Runden geteilt – danke!';
  end if;

  -- Dieselbe Feld-Runde melden oft mehrere aus demselben Rennen: nur einmal speichern
  if _quelle = 'feld' then
    select id into _id from public.reference_laps
     where quelle = 'feld' and strecke = _str and fahrzeug = _fz and abs(zeit_s - _zeit_s) < 0.0005
       and created_at > now() - interval '6 hours'
     limit 1;
    if _id is not null then return _id; end if;
  end if;

  insert into public.reference_laps (strecke, fahrzeug, laenge_m, zeit_s, quelle, zeitverlauf, tempo, gas, bremse, hochgeladen_von)
  values (_str, _fz, _laenge_m, _zeit_s, _quelle, _zeitverlauf, _tempo, _gas, _bremse, _me)
  returning id into _id;

  -- Je Strecke und Auto nur die 50 schnellsten behalten
  delete from public.reference_laps r
   where r.strecke = _str and r.fahrzeug = _fz
     and r.id in (select id from public.reference_laps where strecke = _str and fahrzeug = _fz order by zeit_s, created_at offset 50);
  return (select id from public.reference_laps where id = _id); -- null, wenn sie gleich wieder rausfiel (zu langsam)
end;
$$;

revoke execute on function public.reference_lap_add(text, text, real, real, text, real[], real[], real[], real[]) from public, anon;
grant execute on function public.reference_lap_add(text, text, real, real, text, real[], real[], real[], real[]) to authenticated;

-- ---------------------------------------------------------
-- Lesen: die schnellsten Runden einer Strecke (optional eines Autos) – ohne Angabe, wer hochgeladen hat
-- ---------------------------------------------------------
create or replace function public.reference_laps_get(_strecke text, _fahrzeug text default null, _anzahl integer default 5)
returns table (id uuid, strecke text, fahrzeug text, laenge_m real, zeit_s real, quelle text,
               zeitverlauf real[], tempo real[], gas real[], bremse real[], eigene boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  return query
    select r.id, r.strecke, r.fahrzeug, r.laenge_m, r.zeit_s, r.quelle, r.zeitverlauf, r.tempo, r.gas, r.bremse,
           -- Datum nur tagesgenau: erschwert, eine anonyme Runde einem öffentlichen Rennergebnis zuzuordnen
           r.hochgeladen_von = auth.uid(), date_trunc('day', r.created_at)
      from public.reference_laps r
     where r.strecke = left(btrim(coalesce(_strecke, '')), 120)
       and (_fahrzeug is null or r.fahrzeug = left(btrim(_fahrzeug), 120))
     order by r.zeit_s, r.created_at
     limit greatest(1, least(coalesce(_anzahl, 5), 20));
end;
$$;

revoke execute on function public.reference_laps_get(text, text, integer) from public, anon;
grant execute on function public.reference_laps_get(text, text, integer) to authenticated;

-- ---------------------------------------------------------
-- Eigene Runde löschen (nur selbst hochgeladene)
-- ---------------------------------------------------------
create or replace function public.reference_lap_delete(_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  delete from public.reference_laps where id = _id and hochgeladen_von = auth.uid();
  return found;
end;
$$;

revoke execute on function public.reference_lap_delete(uuid) from public, anon;
grant execute on function public.reference_lap_delete(uuid) to authenticated;

-- ---------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------
select 'Referenzrunden 060' as pruefung,
       case when to_regclass('public.reference_laps') is not null
             and to_regprocedure('public.reference_lap_add(text, text, real, real, text, real[], real[], real[], real[])') is not null
             and to_regprocedure('public.reference_laps_get(text, text, integer)') is not null
             and to_regprocedure('public.reference_lap_delete(uuid)') is not null then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Tabelle nicht direkt lesbar',
       case when not has_table_privilege('authenticated', 'public.reference_laps', 'select')
             and not has_table_privilege('anon', 'public.reference_laps', 'select') then 'ja' else 'NEIN' end
union all
select 'Gäste ausgeschlossen',
       case when not has_function_privilege('anon', 'public.reference_lap_add(text, text, real, real, text, real[], real[], real[], real[])', 'execute')
             and not has_function_privilege('anon', 'public.reference_laps_get(text, text, integer)', 'execute') then 'ja' else 'NEIN' end
union all
select 'Zugriffsregeln aktiv',
       case when (select relrowsecurity from pg_class where oid = 'public.reference_laps'::regclass) then 'ja' else 'NEIN' end;
