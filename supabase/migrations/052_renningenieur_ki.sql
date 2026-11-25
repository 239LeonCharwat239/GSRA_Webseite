-- =========================================================
-- GSRA – 052: KI-Renningenieur – unsichtbare Schutzgrenzen und Kostendeckel
-- =========================================================
-- Entscheidung 24./25.11.: Der Renningenieur soll ohne sichtbare Kontingente nutzbar sein. Damit niemand ihn
-- missbraucht (und die Kosten nie davonlaufen), zählt die Datenbank still mit:
--  * Funk: höchstens 20 KI-Antworten pro Minute und 6.000 im Kalendermonat pro Konto (≈ 300 Rennstunden –
--    Vielfahrer und E-Sportler mit 200 Stunden im Monat merken davon nichts).
--  * Nachbesprechung nach der Sitzung: höchstens 30 am Tag (zählen zum Monat mit).
--  * Für alle zusammen höchstens 100.000 KI-Antworten am Tag (Kostendeckel, falls jemand viele Konten anlegt).
-- Wer: nur Angemeldete, nicht gesperrt, mit bestätigter Zwei-Faktor-Anmeldung (falls eingerichtet).
-- race_engineer_turn wird von der Server-Funktion „renningenieur“ mit der Anmeldung der Person aufgerufen. Sie
-- zählt die Anfrage und liefert dafür die Einstellungen und das Gedächtnis der Person (nur der eigenen).
-- Gespeichert wird nur: wer, welche Art, wann – keine Inhalte. Einträge älter als 2 Tage werden gelöscht,
-- übrig bleibt nur die Zahl pro Monat. Konto gelöscht → alles weg (on delete cascade).
-- Darf mehrfach laufen. Am Ende: Kontrollabfrage („bereit“ …).
-- =========================================================

create table if not exists public.race_engineer_usage (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  art         text not null check (art in ('funk', 'nachbesprechung')),
  created_at  timestamptz not null default now()
);
create index if not exists race_engineer_usage_user_idx on public.race_engineer_usage (user_id, created_at desc);

create table if not exists public.race_engineer_monthly (
  user_id  uuid not null references auth.users(id) on delete cascade,
  monat    date not null,
  anzahl   integer not null default 0 check (anzahl >= 0),
  primary key (user_id, monat)
);

create table if not exists public.race_engineer_daily (
  tag     date primary key,
  anzahl  integer not null default 0 check (anzahl >= 0)
);

-- Niemand liest oder schreibt diese Tabellen direkt (auch nicht die eigenen Zeilen) – nur die Funktion unten
alter table public.race_engineer_usage enable row level security;
alter table public.race_engineer_monthly enable row level security;
alter table public.race_engineer_daily enable row level security;
revoke all on public.race_engineer_usage from public, anon, authenticated;
revoke all on public.race_engineer_monthly from public, anon, authenticated;
revoke all on public.race_engineer_daily from public, anon, authenticated;

create or replace function public.race_engineer_turn(_art text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _me     uuid := auth.uid();
  _monat  date := date_trunc('month', now())::date;
  _tag    date := (now() at time zone 'utc')::date;
  _s      record;
  _merk   jsonb;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if not public.mfa_ok() then raise exception 'Bitte bestätige zuerst deine Zwei-Faktor-Anmeldung.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _art is null or _art not in ('funk', 'nachbesprechung') then raise exception 'Unbekannte Anfrage.'; end if;

  -- Anfragen derselben Person nacheinander zählen (gleichzeitige Anfragen können die Grenze nicht überholen)
  perform pg_advisory_xact_lock(hashtextextended('gsra-renningenieur:' || _me::text, 0));

  delete from public.race_engineer_usage where user_id = _me and created_at < now() - interval '2 days';

  if (select count(*) from public.race_engineer_usage
       where user_id = _me and created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('erlaubt', false, 'grund', 'minute');
  end if;
  if _art = 'nachbesprechung' and (select count(*) from public.race_engineer_usage
       where user_id = _me and art = 'nachbesprechung' and created_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('erlaubt', false, 'grund', 'tag');
  end if;
  if coalesce((select anzahl from public.race_engineer_monthly where user_id = _me and monat = _monat), 0) >= 6000 then
    return jsonb_build_object('erlaubt', false, 'grund', 'monat');
  end if;
  if coalesce((select anzahl from public.race_engineer_daily where tag = _tag), 0) >= 100000 then
    return jsonb_build_object('erlaubt', false, 'grund', 'gesamt');
  end if;

  insert into public.race_engineer_usage (user_id, art) values (_me, _art);
  insert into public.race_engineer_monthly as m (user_id, monat, anzahl) values (_me, _monat, 1)
    on conflict (user_id, monat) do update set anzahl = m.anzahl + 1;
  insert into public.race_engineer_daily as d (tag, anzahl) values (_tag, 1)
    on conflict (tag) do update set anzahl = d.anzahl + 1;

  -- Persönlichkeit und Gedächtnis – nur die eigenen
  select name, rufname, art, gespraechig, stimme, sprache, themen into _s
    from public.race_engineer_settings where user_id = _me;
  select coalesce(jsonb_agg(jsonb_build_object('art', g.art, 'text', g.text) order by g.created_at desc), '[]'::jsonb) into _merk
    from (select art, text, created_at from public.race_engineer_memory
           where user_id = _me order by created_at desc limit 20) g;

  return jsonb_build_object(
    'erlaubt', true,
    'einstellungen', jsonb_build_object(
      'name', coalesce(_s.name, 'Kim'), 'rufname', _s.rufname, 'art', coalesce(_s.art, 'kumpel'),
      'gespraechig', coalesce(_s.gespraechig, 'normal'), 'stimme', coalesce(_s.stimme, 'ruhig'),
      'sprache', coalesce(_s.sprache, 'de'), 'themen', coalesce(_s.themen, '{}'::jsonb)),
    'gedaechtnis', _merk);
end;
$$;

revoke execute on function public.race_engineer_turn(text) from public, anon;
grant execute on function public.race_engineer_turn(text) to authenticated;

-- ---------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------
select 'Renningenieur 052' as pruefung,
       case when to_regclass('public.race_engineer_usage') is not null
             and to_regclass('public.race_engineer_monthly') is not null
             and to_regclass('public.race_engineer_daily') is not null
             and to_regprocedure('public.race_engineer_turn(text)') is not null
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Gäste ausgeschlossen',
       case when not has_function_privilege('anon', 'public.race_engineer_turn(text)', 'execute') then 'ja' else 'NEIN' end
union all
select 'Zähler nicht lesbar',
       case when not has_table_privilege('authenticated', 'public.race_engineer_usage', 'select')
             and not has_table_privilege('authenticated', 'public.race_engineer_monthly', 'select')
             and not has_table_privilege('authenticated', 'public.race_engineer_daily', 'select')
            then 'ja' else 'NEIN' end;
