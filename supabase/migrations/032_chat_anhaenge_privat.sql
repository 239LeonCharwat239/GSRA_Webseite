-- =========================================================
-- GSRA 032 – Chat-Anhänge im privaten Speicher (Sicherheitsbericht Nr. 9, 19.11.)
-- Bisher war der Speicher „chat_attachments“ öffentlich: Wer den Link eines Fotos, Videos oder einer
-- Sprachnachricht kannte, konnte die Datei ohne Anmeldung abrufen – auch nach dem Verlassen eines Chats.
-- Ab jetzt:
--  * Der Speicher ist privat. Die Webseite holt zum Anzeigen kurzlebige Links (2 Stunden); die stellt Supabase
--    nur aus, wenn die Datenbank es erlaubt.
--  * Sehen dürfen einen Anhang die Mitglieder des Chats, in dem er verschickt wurde, sowie die Moderation
--    (mit Zwei-Faktor-Anmeldung) zur Prüfung von Meldungen. Gesperrte Konten und Gäste sehen nichts.
--  * Neue Anhänge liegen unter <Chat-ID>/<eigene Nutzer-ID>/<Datei>; hochladen darf man nur in Chats, in denen
--    man schreiben darf, und nur in den eigenen Ordner.
--  * Ältere Anhänge (ohne Ordner) bleiben für die Mitglieder des Chats sichtbar, in dem sie verschickt wurden.
--  * Größe höchstens 50 MB, nur Bilder, Videos und Sprachaufnahmen (falls noch keine Grenze gesetzt war).
-- Wichtig: Erst die neue Webseite pushen, dann dieses Skript ausführen (die alte Webseite kann private Anhänge
-- nicht anzeigen). 016 danach nicht erneut ausführen. Einmal im SQL Editor ausführen (darf mehrfach laufen).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Prüfungen (laufen mit den Rechten der Datenbank, verraten nur ja/nein)
-- ---------------------------------------------------------
create or replace function public.chat_attachment_allowed(_name text)
returns boolean
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _first text := split_part(coalesce(_name, ''), '/', 1);
begin
  if auth.uid() is null or coalesce(_name, '') = '' or public.is_banned() then return false; end if;
  if public.is_site_admin() or public.is_moderator() then return true; end if;
  -- Neuer Speicherort: <Chat-ID>/<Nutzer-ID>/<Datei>
  if position('/' in _name) > 0 then
    if _first !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
    return public.is_chat_participant(_first::uuid);
  end if;
  -- Ältere Anhänge ohne Ordner: nur, wenn sie in einer Nachricht eines eigenen Chats stecken
  return exists (
    select 1 from public.messages m
    where (strpos(coalesce(m.image_url, ''), '/chat_attachments/' || _name) > 0
           or strpos(coalesce(m.audio_url, ''), '/chat_attachments/' || _name) > 0)
      and public.is_chat_participant(m.chat_id));
end;
$$;

create or replace function public.chat_attachment_upload_allowed(_name text)
returns boolean
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _parts text[] := string_to_array(coalesce(_name, ''), '/');
begin
  if auth.uid() is null or public.is_banned() then return false; end if;
  if coalesce(array_length(_parts, 1), 0) <> 3 or _parts[2] <> auth.uid()::text or coalesce(_parts[3], '') = '' then return false; end if;
  if _parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return public.can_post_in_chat(_parts[1]::uuid);
end;
$$;

revoke execute on function public.chat_attachment_allowed(text) from public, anon;
revoke execute on function public.chat_attachment_upload_allowed(text) from public, anon;
grant execute on function public.chat_attachment_allowed(text) to authenticated;
grant execute on function public.chat_attachment_upload_allowed(text) to authenticated;

-- ---------------------------------------------------------
-- 2) Regeln auf dem Dateispeicher (ersetzen die Fassungen aus 016; Namen bleiben gleich)
-- ---------------------------------------------------------
-- Lesen (und damit kurzlebige Links): nur Chat-Mitglieder und Moderation
drop policy if exists "GSRA Chat-Anhänge nicht auflistbar" on storage.objects;
create policy "GSRA Chat-Anhänge nicht auflistbar" on storage.objects
  as restrictive for select
  using (bucket_id <> 'chat_attachments' or public.chat_attachment_allowed(name));

drop policy if exists "GSRA Chatmitglieder sehen Anhänge" on storage.objects;
create policy "GSRA Chatmitglieder sehen Anhänge" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat_attachments' and public.chat_attachment_allowed(name));

-- Hochladen: nur in den eigenen Ordner eines Chats, in dem man schreiben darf
drop policy if exists "GSRA Chat-Anhänge nur angemeldet hochladen" on storage.objects;
create policy "GSRA Chat-Anhänge nur angemeldet hochladen" on storage.objects
  as restrictive for insert
  with check (bucket_id <> 'chat_attachments' or public.chat_attachment_upload_allowed(name));

-- ---------------------------------------------------------
-- 3) Speicher privat, Größe und Dateitypen begrenzen (bestehende engere Grenzen bleiben)
-- ---------------------------------------------------------
update storage.buckets
set public = false,
    file_size_limit = least(coalesce(file_size_limit, 52428800), 52428800),
    allowed_mime_types = coalesce(allowed_mime_types, array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp',
      'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
where id = 'chat_attachments';

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „ja“, „bereit“, „bereit“, Grenze und Dateitypen)
-- ---------------------------------------------------------
select 'Chat-Anhänge privat' as pruefung,
       case when exists (select 1 from storage.buckets where id = 'chat_attachments' and not public) then 'ja' else 'NEIN' end as ergebnis
union all
select 'Lesen nur für Chat-Mitglieder und Moderation',
       case when (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
                  and policyname in ('GSRA Chat-Anhänge nicht auflistbar', 'GSRA Chatmitglieder sehen Anhänge')
                  and coalesce(qual, '') like '%chat_attachment_allowed%') = 2 then 'bereit' else 'FEHLT' end
union all
select 'Hochladen nur in eigene Chats',
       case when exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                         and policyname = 'GSRA Chat-Anhänge nur angemeldet hochladen'
                         and coalesce(with_check, '') like '%chat_attachment_upload_allowed%') then 'bereit' else 'FEHLT' end
union all
select 'Grenzen',
       coalesce((select (file_size_limit / 1048576)::text || ' MB, ' || coalesce(cardinality(allowed_mime_types), 0)::text || ' Dateitypen'
                 from storage.buckets where id = 'chat_attachments'), 'Speicher nicht gefunden');
