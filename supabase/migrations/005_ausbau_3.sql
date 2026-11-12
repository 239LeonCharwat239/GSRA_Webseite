-- =========================================================
-- GSRA Ausbau 3: Benutzername einmal im Monat, Konto selbst löschen, Melden per Zeitraum,
-- Live-Hinweise (angenommene Freundschaftsanfragen, neue Meldungen) und Leistung für sehr viele Nutzer
-- Einmal komplett im Supabase SQL Editor ausführen (darf auch mehrfach laufen).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Benutzername: einmal im Monat änderbar, 3–40 Zeichen, keine Namen des GSRA-Teams
--    (gilt nur für Änderungen im Dashboard – die Registrierung bleibt unverändert)
-- ---------------------------------------------------------
alter table public.profiles add column if not exists username_changed_at timestamptz;

create or replace function public.profiles_username_rules()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare _name text;
begin
  -- Datenbank (SQL Editor) und Website-Admins sind ausgenommen
  if auth.uid() is null or public.is_site_admin() then
    return new;
  end if;
  new.username_changed_at := old.username_changed_at;   -- lässt sich nicht selbst setzen
  if new.username is not distinct from old.username then
    return new;
  end if;
  if old.username_changed_at is not null and old.username_changed_at > now() - interval '30 days' then
    raise exception 'Du kannst deinen Benutzernamen nur einmal im Monat ändern – wieder möglich ab dem %.',
      to_char(old.username_changed_at + interval '30 days', 'DD.MM.YYYY');
  end if;
  _name := trim(coalesce(new.username, ''));
  if char_length(_name) < 3 or char_length(_name) > 40 then
    raise exception 'Der Benutzername muss 3 bis 40 Zeichen lang sein.';
  end if;
  if _name ~* '\m(admin|administrator|moderator|gsra|support|system)\M' then
    raise exception 'Dieser Benutzername ist für das GSRA-Team reserviert.';
  end if;
  new.username := _name;
  new.username_changed_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_username_rules on public.profiles;
create trigger trg_profiles_username_rules
  before update on public.profiles
  for each row execute function public.profiles_username_rules();

-- ---------------------------------------------------------
-- 2) Leistung für sehr viele Nutzer: Indizes für Chats, Absender und Antworten
--    (wird nur angelegt, wenn es noch keinen passenden Index gibt)
-- ---------------------------------------------------------
do $$
declare
  _wanted text[][] := array[array['chat_id', 'created_at'], array['sender_id', 'created_at'], array['reply_to', '']];
  _cols text[];
begin
  foreach _cols slice 1 in array _wanted loop
    if not exists (
      select 1 from pg_index i
      join pg_attribute a1 on a1.attrelid = i.indrelid and a1.attnum = i.indkey[0]
      left join pg_attribute a2 on a2.attrelid = i.indrelid and a2.attnum = i.indkey[1]
      where i.indrelid = 'public.messages'::regclass and a1.attname = _cols[1]
        and (_cols[2] = '' or a2.attname = _cols[2])
    ) then
      if _cols[2] = '' then
        execute format('create index messages_%s_idx on public.messages (%I) where %I is not null', _cols[1], _cols[1], _cols[1]);
      else
        execute format('create index messages_%s_%s_idx on public.messages (%I, %I)', _cols[1], _cols[2], _cols[1], _cols[2]);
      end if;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------
-- 3) Melden per Zeitraum: Das GSRA-Team sieht alle Nachrichten eines Zeitraums (höchstens 7 Tage) –
--    auch gelöschte. Es wird nichts kopiert: Die Nachrichten werden bei der Prüfung direkt geladen.
-- ---------------------------------------------------------
alter table public.reports add column if not exists scope text;
alter table public.reports add column if not exists window_chat_id uuid;   -- bleibt erhalten, auch wenn der Chat gelöscht wird
update public.reports set window_chat_id = chat_id where window_chat_id is null and chat_id is not null;
create index if not exists reports_window_chat_idx on public.reports (window_chat_id) where status = 'offen';

-- Gesicherte Originale nach 180 Tagen entfernen – außer sie gehören zu einer offenen Meldung
create or replace function public.purge_message_history()
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from public.message_history h
  where h.changed_at < now() - interval '180 days'
    and not exists (
      select 1 from public.reports r
      where r.status = 'offen' and r.window_chat_id = h.chat_id
        and h.original_created_at between coalesce(r.window_from, '-infinity'::timestamptz) and coalesce(r.window_to, 'infinity'::timestamptz)
    );
$$;

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
  -- Aufräumen nur gelegentlich (spart Zeit bei sehr vielen Nachrichten)
  if random() < 0.02 then
    perform public.purge_message_history();
  end if;
  return null;
end;
$$;

drop function if exists public.submit_report(uuid, text, text, uuid, text[], boolean);
create or replace function public.submit_report(_reported uuid, _reason text, _details text default null,
                                                 _chat_id uuid default null, _message_ids text[] default null,
                                                 _whole_chat boolean default false,
                                                 _window_from timestamptz default null, _window_to timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me       uuid := auth.uid();
  _selected text[];
  _whole    boolean := coalesce(_whole_chat, false);
  _scope    text := 'profil';
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

  if _chat_id is not null and public.is_chat_participant(_chat_id) and _window_from is not null then
    -- Zeitraum: nur prüfen und merken – das GSRA-Team lädt die Nachrichten bei der Prüfung direkt
    _from := _window_from;
    _to := coalesce(_window_to, now());
    if _from >= _to then raise exception 'Der Zeitraum ist ungültig – „von“ muss vor „bis“ liegen.'; end if;
    if _to > now() + interval '5 minutes' then raise exception 'Der Zeitraum darf nicht in der Zukunft liegen.'; end if;
    if _to - _from > interval '7 days' then raise exception 'Ein Zeitraum darf höchstens 7 Tage umfassen.'; end if;
    if _from < now() - interval '180 days' then raise exception 'Gemeldet werden können nur Zeiträume der letzten 180 Tage.'; end if;
    _scope := 'zeitraum';
    _whole := false;
  elsif _chat_id is not null and public.is_chat_participant(_chat_id) then
    -- Gemeldete Nachrichten: nur Nachrichten der gemeldeten Person aus diesem Chat (höchstens 30)
    select (array_agg(m.id::text order by m.created_at))[1:30] into _selected
    from public.messages m
    where m.chat_id = _chat_id and m.sender_id = _reported and m.id::text = any(coalesce(_message_ids, '{}'));
    if _selected is null then _whole := true; end if;
    _scope := case when _whole then 'chat' else 'auswahl' end;

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
      select h.*
      from public.message_history h
      where h.chat_id = _chat_id and h.change_type = 'endgültig gelöscht'
        and (exists (select 1 from sel where h.original_created_at between sel.from_at and sel.to_at)
             or (_whole and h.original_created_at >= coalesce((select min(latest.created_at) from latest), now())))
        and not exists (select 1 from public.messages x where x.id = h.message_id)
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
                           from public.message_history h where h.message_id = w.id)) as item
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
                           from public.message_history h where h.message_id = g.message_id))
      from gone g left join public.profiles p on p.id = g.sender_id
    ) t;
  else
    _chat_id := null;
    _whole := false;
  end if;

  insert into public.reports (reporter_id, reported_id, chat_id, window_chat_id, scope, message_id, message_ids, whole_chat,
                              window_from, window_to, reason, details, context)
  values (_me, _reported, _chat_id, _chat_id, _scope, _selected[1], _selected, _whole, _from, _to,
          left(trim(_reason), 80), nullif(left(trim(coalesce(_details, '')), 1000), ''), _context)
  returning id into _report;

  -- Sofortiger Schutz: die gemeldete Person ist für die meldende Person blockiert
  insert into public.user_blocks (blocker_id, blocked_id) values (_me, _reported) on conflict do nothing;
  delete from public.friendships
  where (user_id = _me and friend_id = _reported) or (user_id = _reported and friend_id = _me);
  return _report;
end;
$$;

-- Admin-Ansicht eines gemeldeten Zeitraums: Nachrichten seitenweise (auch gelöschte, mit Originalinhalt)
create or replace function public.admin_report_window(_report_id uuid, _after timestamptz default null,
                                                      _limit integer default 100, _only_reported boolean default false)
returns table (id text, sender_id uuid, sender_name text, text text, image_url text, audio_url text, transcript text,
               created_at timestamptz, deleted boolean, hard_deleted boolean, history jsonb)
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare _r public.reports;
begin
  if not public.is_site_admin() then raise exception 'Nur für Administratoren.'; end if;
  select * into _r from public.reports where reports.id = _report_id;
  if _r.id is null or _r.window_chat_id is null or _r.window_from is null then return; end if;
  _limit := least(greatest(coalesce(_limit, 100), 1), 200);
  return query
  select x.id, x.sender_id, coalesce(p.username, 'Fahrer'), x.text, x.image_url, x.audio_url, x.transcript,
         x.created_at, x.deleted, x.hard_deleted, x.history
  from (
    (select m.id::text as id, m.sender_id, m.text, m.image_url, m.audio_url, m.transcript, m.created_at,
            m.text in ('Du hast diese Nachricht gelöscht', 'Diese Nachricht wurde gelöscht',
                       'Diese Nachricht wurde von einem Gruppenadmin gelöscht') as deleted,
            false as hard_deleted,
            (select jsonb_agg(jsonb_build_object('text', h.text, 'image_url', h.image_url, 'audio_url', h.audio_url,
                                                 'transcript', h.transcript, 'change_type', h.change_type, 'changed_at', h.changed_at)
                              order by h.changed_at)
             from public.message_history h where h.message_id = m.id) as history
     from public.messages m
     where m.chat_id = _r.window_chat_id and m.created_at between _r.window_from and _r.window_to
       and (_after is null or m.created_at > _after)
       and (not _only_reported or m.sender_id = _r.reported_id)
     order by m.created_at
     limit _limit)
    union all
    (select g.message_id::text, g.sender_id, g.text, g.image_url, g.audio_url, g.transcript, g.original_created_at,
            true, true,
            (select jsonb_agg(jsonb_build_object('text', h.text, 'image_url', h.image_url, 'audio_url', h.audio_url,
                                                 'transcript', h.transcript, 'change_type', h.change_type, 'changed_at', h.changed_at)
                              order by h.changed_at)
             from public.message_history h where h.message_id = g.message_id)
     from public.message_history g
     where g.chat_id = _r.window_chat_id and g.change_type = 'endgültig gelöscht'
       and g.original_created_at between _r.window_from and _r.window_to
       and (_after is null or g.original_created_at > _after)
       and (not _only_reported or g.sender_id = _r.reported_id)
       and not exists (select 1 from public.messages e where e.id = g.message_id)
     order by g.original_created_at
     limit _limit)
  ) x
  left join public.profiles p on p.id = x.sender_id
  order by x.created_at, x.id
  limit _limit;
end;
$$;

-- ---------------------------------------------------------
-- 4) Konto selbst löschen (das Passwort muss kurz vorher bestätigt worden sein)
--    Gegründete Gruppen gehen an ein anderes Mitglied, alles Persönliche wird gelöscht.
-- ---------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me    uuid := auth.uid();
  _chat  record;
  _heir  uuid;
  _fresh boolean;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_site_admin() then
    raise exception 'Administratoren können ihr Konto nicht selbst löschen – bitte gib die Admin-Rolle vorher ab.';
  end if;
  if public.is_banned() then
    raise exception 'Gesperrte Konten können nicht selbst gelöscht werden. Bitte wende dich an das GSRA-Team.';
  end if;
  -- Passwort muss gerade eben bestätigt worden sein (Anmeldung vor höchstens 10 Minuten)
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    where (a ->> 'timestamp') ~ '^\d+$' and (a ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - 600
  ) into _fresh;
  if not _fresh then raise exception 'Bitte bestätige zuerst dein Passwort.'; end if;

  -- Gegründete Gruppen und Foren gehen an ein anderes Mitglied (zuerst Gruppenadmins, dann das älteste Mitglied);
  -- ohne weitere Mitglieder werden sie gelöscht
  for _chat in select c.id from public.chats c where c.user1_id = _me and c.user2_id = _me and c.title is not null loop
    _heir := null;
    select m.user_id into _heir from public.chat_members m
    where m.chat_id = _chat.id and m.user_id <> _me
    order by (m.role = 'admin') desc, m.created_at
    limit 1;
    if _heir is not null then
      update public.chats set user1_id = _heir, user2_id = _heir where id = _chat.id;
      update public.chat_members set role = 'admin' where chat_id = _chat.id and user_id = _heir;
    else
      delete from public.chat_favorites where chat_id = _chat.id;
      delete from public.messages where chat_id = _chat.id;
      delete from public.chats where id = _chat.id;
    end if;
  end loop;

  -- Direktchats (auch beim Gegenüber) samt Nachrichten
  delete from public.chat_favorites where chat_id in (select id from public.chats where user1_id <> user2_id and (user1_id = _me or user2_id = _me));
  delete from public.messages where chat_id in (select id from public.chats where user1_id <> user2_id and (user1_id = _me or user2_id = _me));
  delete from public.chats where user1_id <> user2_id and (user1_id = _me or user2_id = _me);

  -- Eigene Nachrichten in Gruppen und Foren: Antworten darauf lösen, eigene Reaktionen entfernen, Nachrichten löschen
  update public.messages set reply_to = null
  where reply_to in (select id from public.messages where sender_id = _me) and sender_id <> _me;
  update public.messages set reactions = reactions - _me::text
  where (chat_id in (select chat_id from public.chat_members where user_id = _me)
         or chat_id in (select id from public.chats where title = 'GSRA Official / Community Forum' and user1_id = user2_id))
    and reactions ? _me::text;
  delete from public.messages where sender_id = _me;

  -- Freundschaften, Blockierungen, Mitgliedschaften und Status
  delete from public.friendships where user_id = _me or friend_id = _me;
  delete from public.user_blocks where blocker_id = _me or blocked_id = _me;
  delete from public.chat_members where user_id = _me;
  delete from public.chat_favorites where user_id = _me;
  delete from public.message_hides where user_id = _me;
  delete from public.user_presence where user_id = _me;
  delete from public.chat_reads where user_id = _me;
  delete from public.user_warnings where user_id = _me;

  -- Inserate und Setups
  if to_regclass('public.marketplace') is not null then
    execute 'delete from public.marketplace where user_id::text = $1' using _me::text;
  end if;
  if to_regclass('public.setups') is not null then
    execute 'delete from public.setups where uploader_id::text = $1' using _me::text;
  end if;

  -- Hochgeladene Dateien gehören danach niemandem mehr (sonst kann die Anmeldung nicht gelöscht werden)
  begin
    update storage.objects set owner = null where owner = _me;
  exception when others then
    null;
  end;

  -- Profil und Anmeldung
  delete from public.profiles where id = _me;
  delete from auth.users where id = _me;
end;
$$;

-- ---------------------------------------------------------
-- 5) Live-Hinweise: angenommene Freundschaftsanfragen und neue Meldungen (für Admins)
--    Die Datenbank-Regeln gelten auch live: Meldungen sehen nur Admins, Freundschaften nur die Beteiligten.
-- ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['friendships', 'reports'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object or undefined_object then
      null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------
-- 6) Funktionen nur für angemeldete Nutzer freigeben
-- ---------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.submit_report(uuid, text, text, uuid, text[], boolean, timestamptz, timestamptz)',
    'public.admin_report_window(uuid, timestamptz, integer, boolean)', 'public.delete_own_account()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'revoke execute on function public.purge_message_history() from public, anon, authenticated';
end $$;

-- ---------------------------------------------------------
-- 7) Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Benutzername 1x im Monat' as pruefung,
       case when exists (select 1 from pg_trigger where tgname = 'trg_profiles_username_rules') then 'aktiv' else 'fehlt' end as ergebnis
union all
select 'Melden per Zeitraum', case when exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'reports' and column_name = 'window_chat_id') then 'bereit' else 'fehlt' end
union all
select 'Live: Freundschaften / Meldungen', coalesce((select string_agg(tablename, ' + ' order by tablename) from pg_publication_tables
  where pubname = 'supabase_realtime' and tablename in ('friendships', 'reports')), 'ohne Live-Aktualisierung')
union all
select 'Indizes Nachrichten', (select string_agg(indexname, ', ' order by indexname) from pg_indexes
  where schemaname = 'public' and tablename = 'messages')
union all
select 'Verknüpfungen mit Konten', (select string_agg(c.conrelid::regclass::text || ' → ' ||
         case c.confdeltype when 'c' then 'wird mitgelöscht' when 'n' then 'wird geleert' when 'd' then 'Standardwert'
              else 'blockiert' end, ', ' order by c.conrelid::regclass::text)
       from pg_constraint c
       where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
         and c.connamespace <> 'auth'::regnamespace);
