-- =========================================================
-- GSRA 041 – Setups im Chat senden (Entscheidung 22.11.)
-- Über die Büroklammer lassen sich Setup-Dateien (iRacing .sto, ACC .json, Assetto Corsa .ini, LMU/rFactor 2/AMS2
-- .svm, RaceRoom .usr, BeamNG .pc) in einen Chat schicken. Empfänger laden sie herunter oder speichern sie in
-- Chrome/Edge direkt in ihren Setup-Ordner.
-- Sicherheit:
--  * Datei liegt im privaten Chat-Speicher (SQL 032): nur Chat-Mitglieder lesen sie, kurzlebige Links.
--  * Eigener Dateityp „application/vnd.gsra.setup“ – ein Browser zeigt so eine Datei nie als Webseite an.
--  * Die Nachricht darf nur auf eine Datei im Ordner <Chat>/<Absender>/ zeigen, nur Setup-Endungen, höchstens
--    5 MB, Ordner-Hinweis ohne „..“ und ohne Sonderzeichen. Ein Anhang lässt sich nachträglich nicht austauschen
--    (nur entfernen, z. B. beim Löschen für alle).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 003 und 032 voraus.
-- =========================================================

alter table public.messages add column if not exists file_path text;
alter table public.messages add column if not exists file_name text;
alter table public.messages add column if not exists file_meta jsonb;

-- Erlaubte Simulationen und Dateiendungen (wie im Setup Hub)
create or replace function public.chat_setup_sims()
returns jsonb
language sql
immutable
set search_path to 'public'
as $$
  select '{"iRacing":"sto","ACC":"json","Assetto Corsa":"ini","Assetto Corsa EVO":"ini","Le Mans Ultimate":"svm",
           "rFactor 2":"svm","Automobilista 2":"svm","RaceRoom":"usr","Rennsport":"json","BeamNG.drive":"pc",
           "Richard Burns Rally":"ini"}'::jsonb;
$$;

create or replace function public.messages_file_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  _ext text;
  _sim text;
  _sub text;
  _size numeric;
begin
  -- Ändern: nur unverändert lassen oder ganz entfernen
  if tg_op = 'UPDATE' then
    if new.file_path is not distinct from old.file_path and new.file_name is not distinct from old.file_name
       and new.file_meta is not distinct from old.file_meta then
      return new;
    end if;
    if new.file_path is null then
      new.file_name := null;
      new.file_meta := null;
      return new;
    end if;
    raise exception 'Ein Anhang lässt sich nicht nachträglich austauschen.';
  end if;

  if new.file_path is null then
    if new.file_name is not null or new.file_meta is not null then raise exception 'Ungültiger Anhang.'; end if;
    return new;
  end if;

  -- Datei nur im eigenen Ordner dieses Chats
  if new.chat_id is null or new.sender_id is null
     or new.file_path !~ ('^' || new.chat_id::text || '/' || new.sender_id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$') then
    raise exception 'Ungültiger Anhang.';
  end if;
  -- Anzeigename: 1–120 Zeichen, keine Pfad- oder Steuerzeichen
  if new.file_name is null or char_length(new.file_name) not between 1 and 120
     or new.file_name ~ '[/\\<>:"|?*]' or new.file_name ~ '[[:cntrl:]]' or new.file_name ~ '^\.' then
    raise exception 'Ungültiger Dateiname.';
  end if;
  _ext := lower(substring(new.file_name from '\.([A-Za-z0-9]{1,8})$'));
  if new.file_meta is null or jsonb_typeof(new.file_meta) <> 'object' or new.file_meta ->> 'kind' is distinct from 'setup' then
    raise exception 'Ungültiger Anhang.';
  end if;
  _sim := new.file_meta ->> 'sim';
  if _sim is null or public.chat_setup_sims() ->> _sim is distinct from _ext then
    raise exception 'Diese Datei passt nicht zur Simulation – erlaubt sind z. B. .sto für iRacing oder .json für ACC.';
  end if;
  if jsonb_typeof(new.file_meta -> 'size') <> 'number' then raise exception 'Ungültiger Anhang.'; end if;
  _size := (new.file_meta ->> 'size')::numeric;
  if _size < 1 or _size > 5242880 then raise exception 'Setup-Dateien dürfen höchstens 5 MB groß sein.'; end if;
  _sub := new.file_meta ->> 'sub';
  if _sub is not null and (_sub !~ '^[A-Za-z0-9 ._()+-]{1,80}(/[A-Za-z0-9 ._()+-]{1,80}){0,3}$' or _sub ~ '(^|/)\.\.?(/|$)') then
    raise exception 'Ungültiger Ordner-Hinweis.';
  end if;
  -- Nur bekannte Felder (nichts Zusätzliches einschleusen)
  if exists (select 1 from jsonb_object_keys(new.file_meta) k where k not in ('kind', 'sim', 'size', 'sub')) then
    raise exception 'Ungültiger Anhang.';
  end if;
  return new;
end;
$$;
revoke execute on function public.messages_file_guard() from public, anon, authenticated;

drop trigger if exists messages_file_guard on public.messages;
create trigger messages_file_guard
  before insert or update of file_path, file_name, file_meta on public.messages
  for each row execute function public.messages_file_guard();

-- Speicher: eigener Dateityp für Setups zusätzlich erlauben (Fotos, Videos, Sprache bleiben wie bisher)
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct t order by t)
  from unnest(coalesce(allowed_mime_types, array[]::text[]) || array['application/vnd.gsra.setup']) as t)
where id = 'chat_attachments';

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „bereit“, „ja“)
-- ---------------------------------------------------------
select 'Nachrichten mit Setup-Datei (Spalten und Schutzregel)' as pruefung,
       case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'messages'
                    and column_name in ('file_path', 'file_name', 'file_meta')) = 3
             and exists (select 1 from pg_trigger where tgrelid = 'public.messages'::regclass and tgname = 'messages_file_guard')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Speicher erlaubt Setup-Dateien (eigener Dateityp)',
       case when exists (select 1 from storage.buckets where id = 'chat_attachments'
                           and 'application/vnd.gsra.setup' = any(allowed_mime_types)) then 'bereit' else 'FEHLT' end
union all
select 'Chat-Speicher weiterhin privat',
       case when exists (select 1 from storage.buckets where id = 'chat_attachments' and not public) then 'ja' else 'NEIN' end;
