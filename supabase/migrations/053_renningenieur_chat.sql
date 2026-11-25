-- =========================================================
-- GSRA – 053: KI-Renningenieur – Rückfragen im Chat der App
-- =========================================================
-- Wunsch 25.11.: Im Telemetrie-Tool soll man dem Renningenieur auch schreiben bzw. Rückfragen stellen können –
-- nicht nur im Rennen. Einfache Fragen („Wer fährt vor mir?“) beantwortet er sofort, schwierige („Warum verliere
-- ich in Kurve 4 Zeit?“) wie ein echter Renningenieur: „Wir schauen uns das an“ – und einige Sekunden später kommt
-- eine gründlichere Antwort.
-- Dafür zwei neue Arten in der stillen Zählung (052 bleibt sonst unverändert):
--  * frage   – kurze Rückfrage (schnelles Modell), höchstens 300 am Tag
--  * analyse – gründliche Antwort (stärkeres Modell), höchstens 100 am Tag
-- Beide zählen zur Minute (20) und zum Monat (6.000) wie Funk und Nachbesprechung, ebenso zum Tagesdeckel für alle.
-- Darf mehrfach laufen. Am Ende: Kontrollabfrage („bereit“ …).
-- =========================================================

-- Erlaubte Arten erweitern – alte Prüfregel für „art“ entfernen, egal wie sie heißt
do $$
declare c record;
begin
  for c in select distinct con.conname
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
  check (art in ('funk', 'nachbesprechung', 'frage', 'analyse'));

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
  if _art is null or _art not in ('funk', 'nachbesprechung', 'frage', 'analyse') then raise exception 'Unbekannte Anfrage.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('gsra-renningenieur:' || _me::text, 0));

  delete from public.race_engineer_usage where user_id = _me and created_at < now() - interval '2 days';

  if (select count(*) from public.race_engineer_usage
       where user_id = _me and created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('erlaubt', false, 'grund', 'minute');
  end if;
  -- Tagesgrenzen je Art (Funk hat keine eigene – dort reichen Minute und Monat)
  _tages := case _art when 'nachbesprechung' then 30 when 'frage' then 300 when 'analyse' then 100 else null end;
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
select 'Renningenieur 053' as pruefung,
       case when exists (select 1 from pg_constraint where conname = 'race_engineer_usage_art_check'
                           and pg_get_constraintdef(oid) like '%analyse%')
             and (select count(*) from pg_constraint con
                    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
                   where con.conrelid = 'public.race_engineer_usage'::regclass and con.contype = 'c' and a.attname = 'art') = 1
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Gäste ausgeschlossen',
       case when not has_function_privilege('anon', 'public.race_engineer_turn(text)', 'execute') then 'ja' else 'NEIN' end;
