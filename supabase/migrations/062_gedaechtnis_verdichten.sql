-- =========================================================
-- GSRA – 062: Gedächtnis des Renningenieurs verdichten (Wunsch 28.11.)
-- =========================================================
-- Bisher sammelte der Renningenieur nach jeder Nachbesprechung bis zu zwei Einträge (054) – bis 100 Stück; bei der KI
-- kamen aber nur die neuesten 20 an. Jetzt verdichtet er sein Gedächtnis wie ein Mensch: Ab 10 eigenen Einträgen fasst
-- die KI sie zusammen (Wichtiges bleibt, Doppeltes wird zusammengelegt, Überholtes fällt weg – z. B. eine Schwäche, die
-- inzwischen eine Stärke ist) und ersetzt sie durch höchstens 10 neue.
-- Abgesichert:
--  * race_engineer_turn('gedaechtnis'): nur angemeldet, Zwei-Faktor bestätigt (falls eingerichtet), nicht gesperrt;
--    erst ab 10 eigenen Einträgen des Renningenieurs (sonst „nicht nötig“, zählt nicht); höchstens 5 am Tag;
--    für diese Anfrage kommen alle Einträge mit Herkunft (bis 100) an die Server-Funktion.
--  * race_engineer_memory_compact: ersetzt NUR Einträge mit Herkunft „renningenieur“ – was die Person selbst
--    eingetragen hat, bleibt immer unberührt; nur direkt nach einer Gedächtnis-Anfrage (15 Minuten); 1–10 Einträge,
--    nur Stärke/Schwäche/Ziel, Text bereinigt (2–200 Zeichen), Doppeltes (auch zu eigenen Einträgen) fällt weg.
-- Darf mehrfach laufen. Am Ende: Kontrollabfrage („bereit“ …).
-- =========================================================

-- Neue Art „gedaechtnis“ für die Zählung
do $$
declare c record;
begin
  for c in select con.conname
             from pg_constraint con
             join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
            where con.conrelid = 'public.race_engineer_usage'::regclass
              and con.contype = 'c'
              and a.attname = 'art'
  loop
    execute format('alter table public.race_engineer_usage drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.race_engineer_usage add constraint race_engineer_usage_art_check
  check (art in ('funk', 'nachbesprechung', 'frage', 'analyse', 'gedaechtnis'));

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
  _tages  integer;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if not public.mfa_ok() then raise exception 'Bitte bestätige zuerst deine Zwei-Faktor-Anmeldung.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _art is null or _art not in ('funk', 'nachbesprechung', 'frage', 'analyse', 'gedaechtnis') then raise exception 'Unbekannte Anfrage.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('gsra-renningenieur:' || _me::text, 0));

  -- Verdichten erst, wenn es sich lohnt (zählt dann auch nicht)
  if _art = 'gedaechtnis' and (select count(*) from public.race_engineer_memory
                                where user_id = _me and quelle = 'renningenieur') < 10 then
    return jsonb_build_object('erlaubt', false, 'grund', 'nicht_noetig');
  end if;

  delete from public.race_engineer_usage where user_id = _me and created_at < now() - interval '2 days';

  if (select count(*) from public.race_engineer_usage
       where user_id = _me and created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('erlaubt', false, 'grund', 'minute');
  end if;
  -- Tagesgrenzen je Art (Funk hat keine eigene – dort reichen Minute und Monat)
  _tages := case _art when 'nachbesprechung' then 30 when 'frage' then 300 when 'analyse' then 100 when 'gedaechtnis' then 5 else null end;
  if _tages is not null and (select count(*) from public.race_engineer_usage
       where user_id = _me and art = _art and created_at > now() - interval '1 day') >= _tages then
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

  select name, rufname, art, gespraechig, stimme, sprache, themen into _s
    from public.race_engineer_settings where user_id = _me;
  -- Für das Verdichten alle Einträge mit Herkunft, sonst die neuesten 20 (wie bisher, jetzt mit Herkunft)
  select coalesce(jsonb_agg(jsonb_build_object('art', g.art, 'text', g.text, 'quelle', g.quelle) order by g.created_at desc), '[]'::jsonb) into _merk
    from (select art, text, quelle, created_at from public.race_engineer_memory
           where user_id = _me order by created_at desc
           limit case when _art = 'gedaechtnis' then 100 else 20 end) g;

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
-- Verdichtete Einträge übernehmen (ersetzt nur die des Renningenieurs)
-- ---------------------------------------------------------
create or replace function public.race_engineer_memory_compact(_eintraege jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _me     uuid := auth.uid();
  _e      jsonb;
  _art    text;
  _txt    text;
  _neu    integer := 0;
  _gesehen text[] := array[]::text[];
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if not public.mfa_ok() then raise exception 'Bitte bestätige zuerst deine Zwei-Faktor-Anmeldung.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _eintraege is null or jsonb_typeof(_eintraege) <> 'array'
     or jsonb_array_length(_eintraege) < 1 or jsonb_array_length(_eintraege) > 10 then
    raise exception 'Bitte 1 bis 10 Einträge.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gsra-renningenieur-merken:' || _me::text, 0));

  -- nur direkt nach einer Gedächtnis-Anfrage an die KI
  if not exists (select 1 from public.race_engineer_usage
                  where user_id = _me and art = 'gedaechtnis' and created_at > now() - interval '15 minutes') then
    raise exception 'Das Gedächtnis wird nur nach einer Zusammenfassung des Renningenieurs ersetzt.';
  end if;

  -- erst alles prüfen, dann ersetzen (kein halber Stand)
  for _e in select * from jsonb_array_elements(_eintraege) loop
    _art := _e ->> 'art';
    _txt := public.race_engineer_clean(_e ->> 'text', 200);
    if _art is null or _art not in ('staerke', 'schwaeche', 'ziel') then raise exception 'Unbekannte Art.'; end if;
    if _txt is null or char_length(_txt) < 2 then raise exception 'Leerer Eintrag.'; end if;
  end loop;

  delete from public.race_engineer_memory where user_id = _me and quelle = 'renningenieur';

  for _e in select * from jsonb_array_elements(_eintraege) loop
    _art := _e ->> 'art';
    _txt := public.race_engineer_clean(_e ->> 'text', 200);
    if lower(_txt) = any (_gesehen) then continue; end if;
    _gesehen := _gesehen || lower(_txt);
    -- schon von der Person selbst eingetragen? Dann nicht doppelt
    if exists (select 1 from public.race_engineer_memory where user_id = _me and lower(text) = lower(_txt)) then continue; end if;
    insert into public.race_engineer_memory (user_id, art, text, quelle) values (_me, _art, _txt, 'renningenieur');
    _neu := _neu + 1;
  end loop;
  return _neu;
end;
$$;

revoke execute on function public.race_engineer_memory_compact(jsonb) from public, anon;
grant execute on function public.race_engineer_memory_compact(jsonb) to authenticated;

-- ---------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------
select 'Gedächtnis verdichten 062' as pruefung,
       case when to_regprocedure('public.race_engineer_memory_compact(jsonb)') is not null
             and exists (select 1 from pg_constraint where conname = 'race_engineer_usage_art_check'
                           and pg_get_constraintdef(oid) like '%gedaechtnis%')
             and pg_get_functiondef('public.race_engineer_turn(text)'::regprocedure) like '%nicht_noetig%'
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Gäste ausgeschlossen',
       case when not has_function_privilege('anon', 'public.race_engineer_memory_compact(jsonb)', 'execute')
             and not has_function_privilege('anon', 'public.race_engineer_turn(text)', 'execute') then 'ja' else 'NEIN' end;
