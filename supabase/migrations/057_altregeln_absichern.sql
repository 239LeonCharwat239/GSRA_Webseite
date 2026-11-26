-- =========================================================
-- GSRA 057: Ergebnis der Gesamtprüfung vom 26.11. beheben
-- =========================================================
-- Die Prüf-SQL (supabase/pruefungen/datenbank_pruefung.sql) fand live:
--  1. ABWEICHUNG: public.setups_https_only() ist die ältere Fassung aus 006 (verlangt immer einen Download-Link).
--     Folge: Pro Setups und Setups ohne Datei (z. B. F1 mit Werten) scheitern beim Speichern mit
--     „Der Download-Link muss mit https:// beginnen.“ → hier wieder die Fassung aus 014.
--  2. 27 WARNUNGEN: alte Zugriffsregeln aus der Anfangszeit (z. B. „Öffentliche Profile sind für jeden sichtbar“).
--     Sie werden durch unsere einschränkenden Regeln abgesichert. Der Nachbau spielt sie jetzt im SCHLIMMSTEN Fall
--     durch (für alle Rollen, ohne Bedingung). Dabei zeigten sich vier Stellen, an denen die Sicherheit bisher davon
--     abhing, wie die alte Regel genau formuliert ist:
--       a) Profile ändern: nur durch die alte Regel auf das eigene Profil begrenzt
--       b) Startseiten-Bilder: „nur in den eigenen Ordner“ stand nur in der erlaubenden Regel
--       c) Favoriten: nur durch die alte Regel auf die eigenen begrenzt
--       d) Nachrichten: Gäste (nicht angemeldet) waren nur durch die alte Leseregel ausgeschlossen
--     → beide jetzt zusätzlich als EINSCHRÄNKENDE Regel; die alten Regeln bleiben stehen (die Webseite nutzt sie),
--       können aber nichts mehr öffnen, was nicht erlaubt ist.
-- Darf mehrfach laufen. Ändert keine Daten.

-- 1) Download-Link: nur prüfen, WENN es einen gibt (Fassung aus 014)
create or replace function public.setups_https_only()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.file_url is not null and new.file_url !~* '^https://' then
    raise exception 'Der Download-Link muss mit https:// beginnen.';
  end if;
  return new;
end;
$$;

-- 2a) Profile: ändern nur das eigene – egal, was ältere Regeln erlauben.
--     (Admins und Moderatoren ändern Profile nur über geprüfte Funktionen, die davon nicht betroffen sind.)
drop policy if exists "GSRA: Profile nur selbst ändern" on public.profiles;
create policy "GSRA: Profile nur selbst ändern" on public.profiles
  as restrictive for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2b) Startseiten-Bilder: nur Admins, nur in den eigenen Ordner, nur erlaubte Bildnamen – auch einschränkend
drop policy if exists "GSRA Startseite nur Admins" on storage.objects;
create policy "GSRA Startseite nur Admins" on storage.objects
  as restrictive for insert
  with check (bucket_id <> 'startseite'
              or (public.is_site_admin()
                  and (storage.foldername(name))[1] = auth.uid()::text
                  and public.home_bild_ok(name)));

-- 2c) Favoriten: nur die eigenen sehen, anlegen und löschen
drop policy if exists "GSRA: Nur eigene Favoriten" on public.chat_favorites;
create policy "GSRA: Nur eigene Favoriten" on public.chat_favorites
  as restrictive for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2d) Nachrichten: Gäste lesen nie Nachrichten (der Messenger braucht immer eine Anmeldung)
drop policy if exists "GSRA: Gäste lesen keine Nachrichten" on public.messages;
create policy "GSRA: Gäste lesen keine Nachrichten" on public.messages
  as restrictive for select to anon
  using (false);

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------
select 'Setup-Link 057' as pruefung,
       case when position('new.file_url is not null and' in pg_get_functiondef('public.setups_https_only()'::regprocedure)) > 0
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Profile nur selbst ändern',
       case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                         and policyname = 'GSRA: Profile nur selbst ändern' and permissive = 'RESTRICTIVE')
            then 'ja' else 'NEIN' end
union all
select 'Startseiten-Bilder nur eigener Ordner',
       case when exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                         and policyname = 'GSRA Startseite nur Admins' and permissive = 'RESTRICTIVE'
                         and with_check like '%foldername%')
            then 'ja' else 'NEIN' end
union all
select 'Favoriten und Nachrichten unabhängig von Altregeln',
       case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_favorites'
                         and policyname = 'GSRA: Nur eigene Favoriten' and permissive = 'RESTRICTIVE')
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'messages'
                         and policyname = 'GSRA: Gäste lesen keine Nachrichten' and permissive = 'RESTRICTIVE')
            then 'ja' else 'NEIN' end;
