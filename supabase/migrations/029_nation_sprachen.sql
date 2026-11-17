-- =========================================================
-- GSRA 029 – Nation und Sprachen im Profil (17.11.)
-- Jedes Mitglied kann im Dashboard angeben, aus welchem Land es kommt und welche Sprachen es spricht.
-- Sichtbar im Profil und auf den Coach-Karten (z. B. „Deutschland · spricht Deutsch, Englisch“),
-- im Coaching auch als Filter. Beides ist freiwillig.
-- Schutz: nur gültige Ländercodes (zwei Großbuchstaben) und nur Sprachen aus einer festen Liste, höchstens 8.
-- Ändern kann jeder nur sein eigenes Profil (bestehende Regeln; Rolle und GSRA-ID bleiben geschützt).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen).
-- =========================================================

alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists languages text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_country_check;
alter table public.profiles add constraint profiles_country_check
  check (country is null or country ~ '^[A-Z]{2}$');

alter table public.profiles drop constraint if exists profiles_languages_check;
alter table public.profiles add constraint profiles_languages_check
  check (cardinality(languages) <= 8
         and languages <@ array['de', 'en', 'fr', 'es', 'it', 'nl', 'pl', 'pt', 'tr', 'cs', 'sk', 'da', 'sv', 'no', 'fi',
                                'hu', 'ro', 'bg', 'hr', 'sl', 'el', 'uk', 'ru', 'ar', 'ja', 'zh', 'ko']::text[]);

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Nation und Sprachen im Profil' as pruefung,
       count(*)::text || ' von 2' as ergebnis
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name in ('country', 'languages')
union all
select 'Prüfregeln aktiv',
       count(*)::text || ' von 2'
from pg_constraint
where conrelid = 'public.profiles'::regclass and conname in ('profiles_country_check', 'profiles_languages_check');
