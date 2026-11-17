-- =========================================================
-- GSRA 028 – Moderatoren ernennen ermöglichen (17.11.)
-- Fehler: „new row for relation profiles violates check constraint profiles_role_check“.
-- Ursache: Eine Regel aus der Anfangszeit der Datenbank erlaubt als Rolle nur bestimmte Werte – „moderator“
-- fehlt darin. Diese Regel wird ersetzt: erlaubt sind „user“, „moderator“ und „admin“ sowie alle Werte,
-- die heute schon in der Tabelle stehen (damit kein bestehendes Profil ungültig wird).
-- Wer welche Rolle vergeben darf, regeln weiterhin admin_set_role (nur Admins mit Zwei-Faktor) und der
-- Schutz-Trigger aus 021 – daran ändert sich nichts.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 021 voraus.
-- =========================================================

do $$
declare
  _extra text;
begin
  alter table public.profiles drop constraint if exists profiles_role_check;
  select string_agg(distinct quote_literal(role), ', ') into _extra
  from public.profiles where role is not null and role not in ('user', 'moderator', 'admin');
  execute format('alter table public.profiles add constraint profiles_role_check check (role in (%s))',
                 '''user'', ''moderator'', ''admin''' || coalesce(', ' || _extra, ''));
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Rolle „moderator“ erlaubt' as pruefung,
       case when pg_get_constraintdef(c.oid) like '%moderator%' then 'bereit' else 'FEHLT' end as ergebnis
from pg_constraint c
where c.conrelid = 'public.profiles'::regclass and c.conname = 'profiles_role_check'
union all
select 'Moderatoren im Team', count(*)::text
from public.profiles where role = 'moderator';
