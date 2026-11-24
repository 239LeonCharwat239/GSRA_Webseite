-- =========================================================
-- GSRA – 050: Renningenieur – neue Art „Locker“ (Jugendsprache), Sprachen vorbereitet, klare Fehlermeldungen
-- =========================================================
-- Wunsch: Der Renningenieur soll wie ein echter Mensch klingen – je nach Fahrer ganz sachlich ODER locker
-- mit Jugendsprache. Dafür:
--  1) Neue Art „locker“ (zusätzlich zu Kumpel, Profi, Motivator, Knapp).
--  2) Sprachen für später schon erlaubt (de, en, es, fr, pt, it, nl, pl, tr, ru, zh, ja) – die Webseite bietet sie
--     erst an, wenn der Renningenieur sie wirklich spricht.
--  3) race_engineer_save prüft jede Auswahl selbst und meldet verständlich, was nicht passt (statt eines
--     technischen Datenbankfehlers). Rechte bleiben wie in 048: nur Angemeldete, nur das eigene Konto, keine
--     gesperrten Konten, Schreiben nur über diese Funktion.
-- Darf mehrfach laufen. Am Ende: Kontrollabfrage („bereit“).
-- =========================================================

-- Alte Prüfregeln für „art“ und „sprache“ entfernen – egal, wie sie heißen – und neu anlegen
do $$
declare c record;
begin
  for c in select distinct con.conname
             from pg_constraint con
             join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
            where con.conrelid = 'public.race_engineer_settings'::regclass
              and con.contype = 'c'
              and a.attname in ('art', 'sprache')
  loop
    execute format('alter table public.race_engineer_settings drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.race_engineer_settings add constraint race_engineer_settings_art_check
  check (art in ('kumpel', 'profi', 'motivator', 'knapp', 'locker'));

alter table public.race_engineer_settings add constraint race_engineer_settings_sprache_check
  check (sprache in ('de', 'en', 'es', 'fr', 'pt', 'it', 'nl', 'pl', 'tr', 'ru', 'zh', 'ja'));

create or replace function public.race_engineer_save(_name text, _rufname text, _art text, _gespraechig text,
                                                     _stimme text, _sprache text, _themen jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
  _t jsonb := '{}'::jsonb;
  _k text;
  _a text := coalesce(_art, 'kumpel');
  _g text := coalesce(_gespraechig, 'normal');
  _s text := coalesce(_stimme, 'ruhig');
  _l text := coalesce(_sprache, 'de');
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if public.race_engineer_clean(_name, 24) is null then raise exception 'Bitte gib deinem Renningenieur einen Namen.'; end if;
  if _a not in ('kumpel', 'profi', 'motivator', 'knapp', 'locker') then raise exception 'Unbekannte Art.'; end if;
  if _g not in ('still', 'normal', 'viel') then raise exception 'Unbekannte Gesprächigkeit.'; end if;
  if _s not in ('ruhig', 'energisch', 'tief', 'hell') then raise exception 'Unbekannte Stimme.'; end if;
  if _l not in ('de', 'en', 'es', 'fr', 'pt', 'it', 'nl', 'pl', 'tr', 'ru', 'zh', 'ja') then raise exception 'Diese Sprache gibt es noch nicht.'; end if;
  if _themen is not null and jsonb_typeof(_themen) <> 'object' then raise exception 'Themen ungültig.'; end if;
  foreach _k in array array['sprit', 'abstaende', 'flaggen', 'reifen', 'coaching', 'wetter'] loop
    _t := _t || jsonb_build_object(_k, case when jsonb_typeof(_themen -> _k) = 'boolean' then (_themen ->> _k)::boolean else true end);
  end loop;
  insert into public.race_engineer_settings (user_id, name, rufname, art, gespraechig, stimme, sprache, themen, updated_at)
  values (_me, public.race_engineer_clean(_name, 24), public.race_engineer_clean(_rufname, 24), _a, _g, _s, _l, _t, now())
  on conflict (user_id) do update set name = excluded.name, rufname = excluded.rufname, art = excluded.art,
    gespraechig = excluded.gespraechig, stimme = excluded.stimme, sprache = excluded.sprache, themen = excluded.themen, updated_at = now();
end;
$$;

revoke execute on function public.race_engineer_save(text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.race_engineer_save(text, text, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------
select 'Renningenieur 050' as pruefung,
       case when exists (select 1 from pg_constraint where conname = 'race_engineer_settings_art_check'
                           and pg_get_constraintdef(oid) like '%locker%')
             and exists (select 1 from pg_constraint where conname = 'race_engineer_settings_sprache_check'
                           and pg_get_constraintdef(oid) like '%ja%')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Gäste ausgeschlossen',
       case when not has_function_privilege('anon', 'public.race_engineer_save(text, text, text, text, text, text, jsonb)', 'execute')
            then 'ja' else 'NEIN' end;
