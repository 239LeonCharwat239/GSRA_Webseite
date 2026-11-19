-- =========================================================
-- GSRA 031 – Alle Länder und Sprachen im Profil (19.11.)
-- Die Webseite bietet jetzt alle Länder (ISO 3166-1) und alle Sprachen (ISO 639-1) an.
--  * Nation: Die Regel aus 029 (Code aus zwei Großbuchstaben) passt bereits für alle Länder – keine Änderung.
--  * Sprachen: statt einer festen Liste von 27 Sprachen gilt jetzt das Format eines Sprachcodes
--    (2–3 Kleinbuchstaben, z. B. „de“, „sw“), höchstens 8, keine leeren Einträge.
-- Die Namen („Deutsch“, „Suaheli“) setzt die Webseite aus dem Code; gespeichert wird nur der Code.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 029 voraus.
-- =========================================================

alter table public.profiles drop constraint if exists profiles_languages_check;
alter table public.profiles add constraint profiles_languages_check check (
  cardinality(languages) <= 8
  and array_position(languages, null) is null
  and array_to_string(languages, ',') ~ '^([a-z]{2,3}(,[a-z]{2,3})*)?$'
  -- jeder Eintrag einzeln ein Code: ein Eintrag wie „de,en“ würde beim Zerlegen zu zwei Teilen
  and cardinality(string_to_array(array_to_string(languages, ','), ',')) = cardinality(languages)
);

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „bereit“)
-- ---------------------------------------------------------
select 'Sprachen: alle Sprachcodes erlaubt' as pruefung,
       case when exists (select 1 from pg_constraint where conname = 'profiles_languages_check'
                           and conrelid = 'public.profiles'::regclass
                           and pg_get_constraintdef(oid) like '%array_to_string%') then 'bereit' else 'fehlt' end as ergebnis
union all
select 'Nation: Ländercode-Regel aktiv',
       case when exists (select 1 from pg_constraint where conname = 'profiles_country_check'
                           and conrelid = 'public.profiles'::regclass) then 'bereit' else 'fehlt' end;
