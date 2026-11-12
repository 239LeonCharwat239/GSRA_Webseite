-- =========================================================
-- GSRA Messenger, Ausbau 2: Online- & Spielstatus, Häkchen (zugestellt/gelesen), Sprachnachrichten,
-- Beweissicherung für Meldungen, Social-Media-Links und öffentliche Foren im Profil
-- Einmal komplett im Supabase SQL Editor ausführen (darf auch mehrfach laufen).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Online-Status und „Spielt gerade …“ – sichtbar für Freunde (und einen selbst)
-- ---------------------------------------------------------
create table if not exists public.user_presence (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  current_game text,
  updated_at   timestamptz not null default now()
);
alter table public.user_presence enable row level security;

drop policy if exists "Online-Status für Freunde" on public.user_presence;
create policy "Online-Status für Freunde" on public.user_presence
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_friend(user_id));

-- Lebenszeichen (jede Minute, solange eine GSRA-Seite offen ist), optional neuer Spielstatus.
-- Wer länger als 5 Minuten offline war, startet ohne Spielstatus; beim Abmelden ist man sofort offline.
create or replace function public.touch_presence(_game text default null, _set_game boolean default false,
                                                 _offline boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then return; end if;
  if _offline then
    update public.user_presence
    set last_seen_at = now() - interval '190 seconds', current_game = null, updated_at = now()
    where user_id = auth.uid();
    return;
  end if;
  insert into public.user_presence (user_id, last_seen_at, current_game, updated_at)
  values (auth.uid(), now(), case when _set_game then nullif(left(trim(_game), 40), '') end, now())
  on conflict (user_id) do update set
    current_game = case
      when _set_game then nullif(left(trim(_game), 40), '')
      when public.user_presence.last_seen_at < now() - interval '5 minutes' then null
      else public.user_presence.current_game
    end,
    last_seen_at = now(),
    updated_at = now();
end;
$$;

-- ---------------------------------------------------------
-- 2) Häkchen: zugestellt (zwei graue) und gelesen (zwei blaue)
-- ---------------------------------------------------------
create table if not exists public.chat_reads (
  chat_id           uuid not null references public.chats(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  last_delivered_at timestamptz,
  last_read_at      timestamptz,
  primary key (chat_id, user_id)
);
alter table public.chat_reads enable row level security;

drop policy if exists "Lesestatus im eigenen Chat" on public.chat_reads;
create policy "Lesestatus im eigenen Chat" on public.chat_reads
  for select to authenticated
  using (public.is_chat_participant(chat_id));

create or replace function public.mark_chat_read(_chat_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not public.is_chat_participant(_chat_id) then return; end if;
  insert into public.chat_reads (chat_id, user_id, last_delivered_at, last_read_at)
  values (_chat_id, auth.uid(), now(), now())
  on conflict (chat_id, user_id) do update set last_delivered_at = now(), last_read_at = now();
end;
$$;

-- Neue Nachrichten in eigenen Chats und Gruppen gelten als zugestellt, sobald eine GSRA-Seite offen ist
create or replace function public.mark_chats_delivered()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.chat_reads (chat_id, user_id, last_delivered_at)
  select c.id, auth.uid(), now()
  from public.chats c
  where (c.user1_id = auth.uid() or c.user2_id = auth.uid()
         or exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = auth.uid()))
    and exists (
      select 1 from public.messages msg
      where msg.chat_id = c.id and msg.sender_id <> auth.uid()
        and msg.created_at > coalesce((select r.last_delivered_at from public.chat_reads r
                                       where r.chat_id = c.id and r.user_id = auth.uid()), '-infinity'::timestamptz))
  on conflict (chat_id, user_id) do update set last_delivered_at = excluded.last_delivered_at;
end;
$$;

-- Häkchen live aktualisieren (Realtime) – ist die Tabelle schon eingetragen, passiert nichts
do $$
begin
  alter publication supabase_realtime add table public.chat_reads;
exception when duplicate_object or undefined_object then
  null;
end $$;

-- ---------------------------------------------------------
-- 3) Sprachnachrichten: Audiodatei, Dauer, Wellenform und Transkript
-- ---------------------------------------------------------
alter table public.messages add column if not exists audio_url text;
alter table public.messages add column if not exists voice_duration real;
alter table public.messages add column if not exists voice_waveform jsonb;
alter table public.messages add column if not exists transcript text;

-- Erlaubt der Speicher für Chat-Anhänge nur bestimmte Dateitypen, kommen Audiodateien dazu
update storage.buckets
set allowed_mime_types = allowed_mime_types || array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
where id = 'chat_attachments' and allowed_mime_types is not null and not ('audio/webm' = any(allowed_mime_types));

-- Schutz fremder Nachrichten um die neuen Spalten erweitert (sonst unverändert)
create or replace function public.messages_guard_changes()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.chat_id is distinct from old.chat_id
     or new.sender_id is distinct from old.sender_id
     or (to_jsonb(new) -> 'created_at') is distinct from (to_jsonb(old) -> 'created_at') then
    raise exception 'Chat, Absender und Zeitpunkt einer Nachricht können nicht geändert werden.';
  end if;

  if old.sender_id = auth.uid() then
    return new;
  end if;

  -- Gruppenadmins löschen fremde Nachrichten ihrer Gruppe für alle (nur löschen, nicht umschreiben)
  if new.text = 'Diese Nachricht wurde von einem Gruppenadmin gelöscht'
     and new.image_url is null
     and (to_jsonb(new) ->> 'audio_url') is null
     and public.is_group_admin(new.chat_id) then
    return new;
  end if;

  if exists (
       select 1
       from unnest(array['text', 'image_url', 'is_edited', 'edit_count', 'edited_at',
                         'audio_url', 'voice_duration', 'voice_waveform', 'transcript']) as spalte
       where (to_jsonb(new) -> spalte) is distinct from (to_jsonb(old) -> spalte)
     )
     or (new.reply_to is distinct from old.reply_to and new.reply_to is not null) then
    raise exception 'Fremde Nachrichten kannst du nicht bearbeiten, nur mit einer Reaktion versehen.';
  end if;

  if (coalesce(to_jsonb(new) -> 'reactions', '{}'::jsonb) - auth.uid()::text)
       is distinct from (coalesce(to_jsonb(old) -> 'reactions', '{}'::jsonb) - auth.uid()::text)
     or ((to_jsonb(new) ->> 'last_reaction_user') is distinct from (to_jsonb(old) ->> 'last_reaction_user')
         and (to_jsonb(new) ->> 'last_reaction_user') is not null
         and (to_jsonb(new) ->> 'last_reaction_user') <> auth.uid()::text) then
    raise exception 'Du kannst nur deine eigene Reaktion ändern.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------
-- 4) Beweissicherung: Bearbeitete oder gelöschte Nachrichten bleiben im Original erhalten –
--    nur GSRA-Admins sehen sie (für Meldungen), nach 180 Tagen werden sie automatisch entfernt
-- ---------------------------------------------------------
do $$
declare _id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into _id_type
  from pg_attribute a
  where a.attrelid = 'public.messages'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.message_history (
      id                  uuid primary key default gen_random_uuid(),
      message_id          %s not null,
      chat_id             uuid,
      sender_id           uuid,
      text                text,
      image_url           text,
      audio_url           text,
      transcript          text,
      change_type         text not null,
      changed_by          uuid,
      original_created_at timestamptz,
      changed_at          timestamptz not null default now()
    )$f$, _id_type);
end $$;
create index if not exists message_history_chat_idx on public.message_history (chat_id, original_created_at);
create index if not exists message_history_message_idx on public.message_history (message_id);
create index if not exists message_history_changed_idx on public.message_history (changed_at);
alter table public.message_history enable row level security;

drop policy if exists "Nur Admins sehen gesicherte Nachrichten" on public.message_history;
create policy "Nur Admins sehen gesicherte Nachrichten" on public.message_history
  for select to authenticated
  using ((select public.is_site_admin()));

create or replace function public.messages_keep_history()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.message_history (message_id, chat_id, sender_id, text, image_url, audio_url, transcript,
                                        change_type, changed_by, original_created_at)
    values (old.id, old.chat_id, old.sender_id, old.text, old.image_url, old.audio_url, old.transcript,
            'endgültig gelöscht', auth.uid(), old.created_at);
  elsif new.text is distinct from old.text or new.image_url is distinct from old.image_url
        or new.audio_url is distinct from old.audio_url then
    insert into public.message_history (message_id, chat_id, sender_id, text, image_url, audio_url, transcript,
                                        change_type, changed_by, original_created_at)
    values (old.id, old.chat_id, old.sender_id, old.text, old.image_url, old.audio_url, old.transcript,
            case when new.text in ('Du hast diese Nachricht gelöscht', 'Diese Nachricht wurde gelöscht',
                                   'Diese Nachricht wurde von einem Gruppenadmin gelöscht')
                 then 'gelöscht' else 'bearbeitet' end,
            auth.uid(), old.created_at);
  else
    return null;
  end if;
  delete from public.message_history where changed_at < now() - interval '180 days';
  return null;
end;
$$;

drop trigger if exists trg_messages_keep_history on public.messages;
create trigger trg_messages_keep_history
  after update or delete on public.messages
  for each row execute function public.messages_keep_history();

-- ---------------------------------------------------------
-- 5) Meldungen mit Bezug: ausgewählte Nachrichten und/oder der ganze Chat – mit Zeitfenster inkl. gelöschter Nachrichten
-- ---------------------------------------------------------
alter table public.reports add column if not exists message_ids text[];
alter table public.reports add column if not exists whole_chat boolean not null default false;
alter table public.reports add column if not exists window_from timestamptz;
alter table public.reports add column if not exists window_to timestamptz;

-- Chats, Gruppen und Foren, die man mit einer Person gemeinsam hat (Meldung aus dem Profil)
create or replace function public.shared_chats_with(_other uuid)
returns table (id uuid, title text, kind text)
language sql
stable security definer
set search_path to 'public'
as $$
  select c.id, c.title,
         case when c.user1_id <> c.user2_id then 'direkt' when c.is_public then 'forum' else 'gruppe' end
  from public.chats c
  where auth.uid() is not null
    and c.title is distinct from 'GSRA Official / Community Forum'
    and public.is_chat_participant(c.id)
    and ((c.user1_id <> c.user2_id and (c.user1_id = _other or c.user2_id = _other))
         or (c.user1_id = c.user2_id and (c.user1_id = _other
             or exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = _other))))
  order by (c.user1_id <> c.user2_id) desc, c.title;
$$;

-- Die letzten Nachrichten einer Person in einem gemeinsamen Chat (zum Auswählen – auch wenn sie schon blockiert ist)
create or replace function public.reportable_messages(_chat_id uuid, _user uuid)
returns table (id text, text text, image_url text, audio_url text, transcript text, created_at timestamptz, deleted boolean)
language sql
stable security definer
set search_path to 'public'
as $$
  select m.id::text, m.text, m.image_url, m.audio_url, m.transcript, m.created_at,
         m.text in ('Du hast diese Nachricht gelöscht', 'Diese Nachricht wurde gelöscht',
                    'Diese Nachricht wurde von einem Gruppenadmin gelöscht')
  from public.messages m
  where auth.uid() is not null and m.chat_id = _chat_id and m.sender_id = _user and public.is_chat_participant(_chat_id)
  order by m.created_at desc
  limit 30;
$$;

-- Zeitfenster: um jede gemeldete Nachricht bis zu 20 Nachrichten davor und danach (höchstens 2 Stunden),
-- beim ganzen Chat die letzten 150 Nachrichten. Gelöschte und bearbeitete Nachrichten kommen mit Originalinhalt mit.
create or replace function public.submit_report(_reported uuid, _reason text, _details text default null,
                                                 _chat_id uuid default null, _message_ids text[] default null,
                                                 _whole_chat boolean default false)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me       uuid := auth.uid();
  _selected text[];
  _whole    boolean := coalesce(_whole_chat, false);
  _from     timestamptz;
  _to       timestamptz;
  _context  jsonb := '[]'::jsonb;
  _report   uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if _reported is null or _reported = _me then raise exception 'Du kannst dich nicht selbst melden.'; end if;
  if not exists (select 1 from public.profiles where id = _reported) then raise exception 'Nutzer nicht gefunden.'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Bitte wähle einen Grund.'; end if;
  if (select count(*) from public.reports where reporter_id = _me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Du hast in kurzer Zeit sehr viele Meldungen gesendet. Bitte versuche es später erneut.';
  end if;

  -- Verlauf nur aus einem Chat, den die meldende Person selbst lesen darf
  if _chat_id is not null and public.is_chat_participant(_chat_id) then
    -- Gemeldete Nachrichten: nur Nachrichten der gemeldeten Person aus diesem Chat (höchstens 30)
    select (array_agg(m.id::text order by m.created_at))[1:30] into _selected
    from public.messages m
    where m.chat_id = _chat_id and m.sender_id = _reported and m.id::text = any(coalesce(_message_ids, '{}'));
    if _selected is null then _whole := true; end if;

    with sel as (
      select s.created_at,
             greatest(s.created_at - interval '2 hours',
                      (select b.created_at from public.messages b
                        where b.chat_id = _chat_id and b.created_at < s.created_at
                        order by b.created_at desc offset 19 limit 1)) as from_at,
             least(s.created_at + interval '2 hours',
                   (select a.created_at from public.messages a
                     where a.chat_id = _chat_id and a.created_at > s.created_at
                     order by a.created_at offset 19 limit 1)) as to_at
      from public.messages s
      where s.chat_id = _chat_id and s.id::text = any(coalesce(_selected, '{}'))
    ), latest as (
      select l.id, l.created_at from public.messages l
      where _whole and l.chat_id = _chat_id
      order by l.created_at desc
      limit 150
    ), win as (
      select m.* from public.messages m
      where m.chat_id = _chat_id
        and (exists (select 1 from sel where m.created_at between sel.from_at and sel.to_at)
             or m.id in (select latest.id from latest))
    ), gone as (
      select distinct on (h.message_id) h.*
      from public.message_history h
      where h.chat_id = _chat_id and h.change_type = 'endgültig gelöscht'
        and (exists (select 1 from sel where h.original_created_at between sel.from_at and sel.to_at)
             or (_whole and h.original_created_at >= coalesce((select min(latest.created_at) from latest), now())))
        and not exists (select 1 from public.messages x where x.id::text = h.message_id::text)
      order by h.message_id, h.changed_at desc
    )
    select coalesce(jsonb_agg(item order by sort_at, item ->> 'id'), '[]'::jsonb), min(sort_at), max(sort_at)
    into _context, _from, _to
    from (
      select w.created_at as sort_at, jsonb_build_object(
               'id', w.id::text,
               'sender_id', w.sender_id,
               'sender_name', coalesce(p.username, 'Fahrer'),
               'text', w.text,
               'image_url', w.image_url,
               'audio_url', w.audio_url,
               'transcript', w.transcript,
               'created_at', w.created_at,
               'reported', w.id::text = any(coalesce(_selected, '{}')),
               'deleted', w.text in ('Du hast diese Nachricht gelöscht', 'Diese Nachricht wurde gelöscht',
                                     'Diese Nachricht wurde von einem Gruppenadmin gelöscht'),
               'history', (select jsonb_agg(jsonb_build_object('text', h.text, 'image_url', h.image_url,
                                                               'audio_url', h.audio_url, 'transcript', h.transcript,
                                                               'change_type', h.change_type, 'changed_at', h.changed_at)
                                            order by h.changed_at)
                           from public.message_history h where h.message_id::text = w.id::text)) as item
      from win w left join public.profiles p on p.id = w.sender_id
      union all
      select g.original_created_at, jsonb_build_object(
               'id', g.message_id::text,
               'sender_id', g.sender_id,
               'sender_name', coalesce(p.username, 'Fahrer'),
               'text', g.text,
               'image_url', g.image_url,
               'audio_url', g.audio_url,
               'transcript', g.transcript,
               'created_at', g.original_created_at,
               'reported', false,
               'deleted', true,
               'hard_deleted', true,
               'history', (select jsonb_agg(jsonb_build_object('text', h.text, 'image_url', h.image_url,
                                                               'audio_url', h.audio_url, 'transcript', h.transcript,
                                                               'change_type', h.change_type, 'changed_at', h.changed_at)
                                            order by h.changed_at)
                           from public.message_history h where h.message_id::text = g.message_id::text))
      from gone g left join public.profiles p on p.id = g.sender_id
    ) t;
  else
    _chat_id := null;
    _whole := false;
  end if;

  insert into public.reports (reporter_id, reported_id, chat_id, message_id, message_ids, whole_chat,
                              window_from, window_to, reason, details, context)
  values (_me, _reported, _chat_id, _selected[1], _selected, _whole, _from, _to,
          left(trim(_reason), 80), nullif(left(trim(coalesce(_details, '')), 1000), ''), _context)
  returning id into _report;

  -- Sofortiger Schutz: die gemeldete Person ist für die meldende Person blockiert
  insert into public.user_blocks (blocker_id, blocked_id) values (_me, _reported) on conflict do nothing;
  delete from public.friendships
  where (user_id = _me and friend_id = _reported) or (user_id = _reported and friend_id = _me);
  return _report;
end;
$$;

-- Bisherige Meldefunktion bleibt erhalten und nutzt jetzt ebenfalls das Zeitfenster
create or replace function public.report_user(_reported uuid, _reason text, _details text default null,
                                              _chat_id uuid default null, _message_id text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return public.submit_report(_reported, _reason, _details, _chat_id,
                              case when _message_id is null then null else array[_message_id] end, false);
end;
$$;

-- ---------------------------------------------------------
-- 6) Profil: Social-Media-Links und öffentliche Foren (mit Admin-Kennzeichnung)
-- ---------------------------------------------------------
alter table public.profiles add column if not exists social_links jsonb not null default '[]'::jsonb;
do $$
begin
  alter table public.profiles add constraint profiles_social_links_check
    check (jsonb_typeof(social_links) = 'array' and jsonb_array_length(social_links) <= 8);
exception when duplicate_object then
  null;
end $$;

create or replace function public.user_public_forums(_user uuid)
returns table (id uuid, title text, description text, image_url text, member_count bigint, role text, is_member boolean)
language sql
stable security definer
set search_path to 'public'
as $$
  select c.id, c.title, c.description, c.image_url,
         (select count(*) from public.chat_members m2 where m2.chat_id = c.id),
         m.role,
         exists (select 1 from public.chat_members m3 where m3.chat_id = c.id and m3.user_id = auth.uid())
  from public.chats c
  join public.chat_members m on m.chat_id = c.id and m.user_id = _user
  where auth.uid() is not null and c.is_public and c.title is not null and c.user1_id = c.user2_id
  order by (m.role = 'admin') desc, c.title;
$$;

-- ---------------------------------------------------------
-- 7) Funktionen nur für angemeldete Nutzer freigeben
-- ---------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.touch_presence(text, boolean, boolean)', 'public.mark_chat_read(uuid)', 'public.mark_chats_delivered()',
    'public.shared_chats_with(uuid)', 'public.reportable_messages(uuid, uuid)',
    'public.submit_report(uuid, text, text, uuid, text[], boolean)', 'public.report_user(uuid, text, text, uuid, text)',
    'public.user_public_forums(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------
-- 8) Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Neue Tabellen' as pruefung, string_agg(tablename, ', ' order by tablename) as ergebnis
from pg_tables
where schemaname = 'public' and tablename in ('user_presence', 'chat_reads', 'message_history')
union all
select 'Neue Spalten Nachrichten', string_agg(column_name, ', ' order by column_name)
from information_schema.columns
where table_schema = 'public' and table_name = 'messages' and column_name in ('audio_url', 'voice_duration', 'voice_waveform', 'transcript')
union all
select 'Social-Media-Links', case when exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'social_links') then 'bereit' else 'fehlt' end
union all
select 'Häkchen live (Realtime)', case when exists (select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and tablename = 'chat_reads') then 'aktiv' else 'ohne Live-Aktualisierung' end
union all
select 'Speicher Chat-Anhänge', coalesce((select 'öffentlich: ' || public::text || ', Dateitypen: '
  || coalesce(array_to_string(allowed_mime_types, ' '), 'alle erlaubt')
  from storage.buckets where id = 'chat_attachments'), 'nicht gefunden');
