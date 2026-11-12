-- =========================================================
-- GSRA Sicherheit 2 – Sofortmaßnahmen aus der Sicherheits-Bestandsaufnahme (11.11.)
-- 1) Chat-Anhänge (Bilder, Videos, Sprachnachrichten) ließen sich OHNE Anmeldung auflisten und damit
--    alle herunterladen. Ab jetzt: Auflisten, Ändern und Löschen nur noch für Website-Admins, Hochladen nur
--    angemeldet. Bereits verschickte Anhänge bleiben über ihren Link im Chat sichtbar.
-- 2) Profile sind nur noch für angemeldete Nutzer lesbar (bisher auch für Gäste, inkl. full_name und role).
-- Diese Regeln sind „einschränkend“: Sie gelten zusätzlich zu allen bestehenden Regeln und können nichts öffnen.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen).
-- =========================================================

-- 1) Chat-Anhänge
drop policy if exists "GSRA Chat-Anhänge nicht auflistbar" on storage.objects;
create policy "GSRA Chat-Anhänge nicht auflistbar" on storage.objects
  as restrictive for select
  using (bucket_id <> 'chat_attachments' or (select public.is_site_admin()));

drop policy if exists "GSRA Chat-Anhänge nur angemeldet hochladen" on storage.objects;
create policy "GSRA Chat-Anhänge nur angemeldet hochladen" on storage.objects
  as restrictive for insert
  with check (bucket_id <> 'chat_attachments' or (auth.uid() is not null and not (select public.is_banned())));

drop policy if exists "GSRA Chat-Anhänge nicht überschreibbar" on storage.objects;
create policy "GSRA Chat-Anhänge nicht überschreibbar" on storage.objects
  as restrictive for update
  using (bucket_id <> 'chat_attachments' or (select public.is_site_admin()))
  with check (bucket_id <> 'chat_attachments' or (select public.is_site_admin()));

drop policy if exists "GSRA Chat-Anhänge nur Admins löschen" on storage.objects;
create policy "GSRA Chat-Anhänge nur Admins löschen" on storage.objects
  as restrictive for delete
  using (bucket_id <> 'chat_attachments' or (select public.is_site_admin()));

-- 2) Profile nicht für Gäste
drop policy if exists "GSRA Profile nicht für Gäste" on public.profiles;
create policy "GSRA Profile nicht für Gäste" on public.profiles
  as restrictive for select to anon
  using (false);

notify pgrst, 'reload schema';

-- Kontrolle (ändert nichts)
select 'Chat-Anhänge geschützt' as pruefung,
       case when (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
                  and policyname like 'GSRA Chat-Anhänge%') = 4 then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Profile nur für Angemeldete',
       case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                         and policyname = 'GSRA Profile nicht für Gäste') then 'bereit' else 'FEHLT' end
union all
-- Übersicht aller Regeln auf dem Dateispeicher (zur Kontrolle für die Bestandsaufnahme)
select 'Speicher-Regel: ' || policyname, cmd || case when permissive = 'RESTRICTIVE' then ' (einschränkend)' else '' end
from pg_policies where schemaname = 'storage' and tablename = 'objects';
