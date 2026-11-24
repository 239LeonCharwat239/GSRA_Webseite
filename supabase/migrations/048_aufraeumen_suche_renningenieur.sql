-- =========================================================
-- GSRA 048 – Speicher aufräumen, Videos und Liveries in der Suche, Grundlage für den KI-Renningenieur (24.11.2026)
--
-- 1) Speicher aufräumen: Bisher blieben Dateien liegen, wenn die zugehörigen Inhalte verschwanden – Chat-Anhänge
--    gelöschter oder abgelaufener Nachrichten auch nach der Beweissicherung (180 Tage), alte Profilbilder,
--    Bilder gelöschter Inserate, Livery-Angebote und Videos. Ab jetzt merkt sich die Datenbank solche Dateien in einer
--    Warteschlange; eine kleine Server-Funktion („speicher-aufraeumen“, stündlich) löscht sie aus dem Speicher.
--    Chat-Anhänge erst, wenn auch die Kopie für Meldungen abgelaufen ist und keine Nachricht sie mehr nutzt.
--    Einmalig: ältere, nirgends mehr genutzte Chat-Anhänge (über 180 Tage) kommen ebenfalls in die Warteschlange.
-- 2) Globale Suche: zusätzlich Videos (Titel, Hashtags, Creator) und Livery-Angebote (Titel, Painter, Simulation).
-- 3) KI-Renningenieur: Einstellungen (Name, Anrede, Art, Gesprächigkeit, Stimme, Themen) und ein Gedächtnis, das
--    jede Person selbst sieht und löschen kann. Schreiben nur über geprüfte Funktionen.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 004, 040, 041 und 046 voraus.
-- Danach die Server-Funktion „speicher-aufraeumen“ hochladen („Verify JWT“ an).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Warteschlange für Dateien, die aus dem Speicher entfernt werden
-- ---------------------------------------------------------
create table if not exists public.storage_cleanup_queue (
  id          bigserial primary key,
  bucket      text not null check (bucket in ('chat_attachments', 'avatars', 'marketplace', 'liveries', 'videos')),
  path        text not null check (char_length(path) between 3 and 300 and position('..' in path) = 0),
  reason      text,
  due_at      timestamptz not null default now(),
  attempts    integer not null default 0,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (bucket, path)
);
create index if not exists storage_cleanup_due_idx on public.storage_cleanup_queue (due_at) where done_at is null;
alter table public.storage_cleanup_queue enable row level security;
revoke all on public.storage_cleanup_queue from anon, authenticated;

create or replace function public.storage_cleanup_enqueue(_bucket text, _path text, _reason text, _due timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _path is null or char_length(_path) < 3 or char_length(_path) > 300 or position('..' in _path) > 0 then return; end if;
  insert into public.storage_cleanup_queue (bucket, path, reason, due_at)
  values (_bucket, _path, left(_reason, 120), coalesce(_due, now()))
  on conflict (bucket, path) do update set done_at = null, due_at = least(storage_cleanup_queue.due_at, excluded.due_at);
end;
$$;

-- Pfad einer öffentlichen Datei aus ihrer Adresse (…/storage/v1/object/public/<bucket>/<pfad>)
create or replace function public.storage_path_of(_url text, _bucket text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(substring(coalesce(_url, '') from '/' || _bucket || '/([^?#]+)$'), '');
$$;

-- Chat-Anhänge einer Nachricht (Fotos, Videos, Sprachnachrichten) samt Vorschaubildern „chatv_….vorschau.jpg“
create or replace function public.chat_attachment_paths(_urls text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct p), '{}') from (
    select substring(btrim(u) from '/chat_attachments/([^?#,]+)') as p
    from unnest(string_to_array(coalesce(_urls, ''), ',')) u
    union all
    select regexp_replace(substring(btrim(u) from '/chat_attachments/([^?#,]+)'),
                          'chatv_([0-9]+_[a-z0-9]+)(_[0-9]+s)?\.[a-z0-9]+$', 'chatv_\1.vorschau.jpg')
    from unnest(string_to_array(coalesce(_urls, ''), ',')) u
    where u ~ '/chatv_[0-9]+_[a-z0-9]+(_[0-9]+s)?\.[a-z0-9]+'
  ) x where p is not null and p <> '';
$$;

-- Wird ein Chat-Anhang noch gebraucht? (von einer Nachricht oder einer noch aufbewahrten Kopie für Meldungen)
create or replace function public.chat_attachment_in_use(_path text)
returns boolean
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _probe text := regexp_replace(_path, '\.vorschau\.jpg$', '');
begin
  return exists (select 1 from public.messages m
                 where strpos(coalesce(m.image_url, '') || ',' || coalesce(m.audio_url, '') || ',' || coalesce(m.file_path, ''), _probe) > 0)
      or exists (select 1 from public.message_history h
                 where strpos(coalesce(h.image_url, '') || ',' || coalesce(h.audio_url, ''), _probe) > 0);
end;
$$;

-- Läuft die Beweissicherung einer Nachricht ab, werden ihre Anhänge zum Löschen vorgemerkt (falls ungenutzt)
create or replace function public.message_history_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _p text;
begin
  foreach _p in array public.chat_attachment_paths(concat_ws(',', old.image_url, old.audio_url)) loop
    if not public.chat_attachment_in_use(_p) then
      perform public.storage_cleanup_enqueue('chat_attachments', _p, 'Beweissicherung abgelaufen');
    end if;
  end loop;
  return null;
end;
$$;
drop trigger if exists gsra_message_history_cleanup on public.message_history;
create trigger gsra_message_history_cleanup after delete on public.message_history
  for each row execute function public.message_history_cleanup();

-- Altes Profilbild (und seine kleine Fassung) nach einem Wechsel oder Löschen
create or replace function public.profiles_avatar_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _p text := public.storage_path_of(old.avatar_url, 'avatars');
begin
  if old.avatar_url is distinct from new.avatar_url and _p is not null and split_part(_p, '/', 1) = old.id::text then
    perform public.storage_cleanup_enqueue('avatars', _p, 'Profilbild ersetzt');
    if _p ~ '_k\.[a-z]+$' then
      perform public.storage_cleanup_enqueue('avatars', regexp_replace(_p, '_k\.[a-z]+$', '_k.klein.jpg'), 'Profilbild ersetzt');
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists gsra_profiles_avatar_cleanup on public.profiles;
create trigger gsra_profiles_avatar_cleanup after update of avatar_url on public.profiles
  for each row execute function public.profiles_avatar_cleanup();

-- Bilder gelöschter Inserate (samt Vorschaubildern)
create or replace function public.marketplace_images_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _u text;
  _p text;
begin
  foreach _u in array coalesce(old.images, '{}') loop
    _p := public.storage_path_of(_u, 'marketplace');
    if _p is not null then
      perform public.storage_cleanup_enqueue('marketplace', _p, 'Inserat gelöscht');
      if _p ~ '_v\.[a-z]+$' then
        perform public.storage_cleanup_enqueue('marketplace', regexp_replace(_p, '_v\.[a-z]+$', '_v.vorschau.jpg'), 'Inserat gelöscht');
      end if;
    end if;
  end loop;
  return null;
end;
$$;
drop trigger if exists gsra_marketplace_images_cleanup on public.marketplace;
create trigger gsra_marketplace_images_cleanup after delete on public.marketplace
  for each row execute function public.marketplace_images_cleanup();

-- Livery-Beispielbilder: beim Löschen des Angebots und beim Entfernen einzelner Bilder
create or replace function public.livery_images_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _p text;
begin
  foreach _p in array coalesce(old.images, '{}') loop
    if tg_op = 'DELETE' or not (_p = any(coalesce(new.images, '{}'))) then
      perform public.storage_cleanup_enqueue('liveries', _p, 'Livery-Bild entfernt');
      perform public.storage_cleanup_enqueue('liveries', regexp_replace(_p, '\.(jpe?g|png|webp)$', '.vorschau.jpg'), 'Livery-Bild entfernt');
    end if;
  end loop;
  return null;
end;
$$;
drop trigger if exists gsra_livery_images_cleanup on public.livery_offers;
create trigger gsra_livery_images_cleanup after delete or update of images on public.livery_offers
  for each row execute function public.livery_images_cleanup();

-- Video-Vorschaubilder: beim Löschen und beim Austauschen
create or replace function public.video_thumb_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.thumbnail is not null and (tg_op = 'DELETE' or new.thumbnail is distinct from old.thumbnail) then
    perform public.storage_cleanup_enqueue('videos', old.thumbnail, 'Video-Vorschaubild entfernt');
  end if;
  return null;
end;
$$;
drop trigger if exists gsra_video_thumb_cleanup on public.pro_videos;
create trigger gsra_video_thumb_cleanup after delete or update of thumbnail on public.pro_videos
  for each row execute function public.video_thumb_cleanup();

-- Nur für die Server-Funktion: fällige Dateien holen (räumt vorher abgelaufene Kopien für Meldungen auf) und erledigen
create or replace function public.storage_cleanup_take(_limit integer default 200)
returns table (id bigint, bucket text, path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.message_history where changed_at < now() - interval '180 days';
  return query
  with faellig as (
    select q.id from public.storage_cleanup_queue q
    where q.done_at is null and q.due_at <= now() and q.attempts < 5
    order by q.due_at
    limit least(greatest(coalesce(_limit, 200), 1), 500)
    for update skip locked
  )
  update public.storage_cleanup_queue q set attempts = q.attempts + 1
  from faellig f where q.id = f.id
  returning q.id, q.bucket, q.path;
end;
$$;

create or replace function public.storage_cleanup_done(_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _n integer;
begin
  update public.storage_cleanup_queue set done_at = now() where id = any(coalesce(_ids, '{}')) and done_at is null;
  get diagnostics _n = row_count;
  delete from public.storage_cleanup_queue where done_at < now() - interval '30 days';
  return _n;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.storage_cleanup_enqueue(text, text, text, timestamptz)', 'public.chat_attachment_in_use(text)',
    'public.message_history_cleanup()', 'public.profiles_avatar_cleanup()', 'public.marketplace_images_cleanup()',
    'public.livery_images_cleanup()', 'public.video_thumb_cleanup()',
    'public.storage_cleanup_take(integer)', 'public.storage_cleanup_done(bigint[])'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  begin
    execute 'grant execute on function public.storage_cleanup_take(integer) to service_role';
    execute 'grant execute on function public.storage_cleanup_done(bigint[]) to service_role';
  exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
  end;
end $$;

-- Einmalig: alte Chat-Anhänge (über 180 Tage), die keine Nachricht und keine Kopie mehr nutzt
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'objects' and column_name = 'created_at') then
    execute $q$
      insert into public.storage_cleanup_queue (bucket, path, reason)
      select 'chat_attachments', o.name, 'Altbestand ohne Nutzung'
      from storage.objects o
      where o.bucket_id = 'chat_attachments' and o.created_at < now() - interval '180 days'
        and not public.chat_attachment_in_use(o.name)
      order by o.created_at
      limit 5000
      on conflict (bucket, path) do nothing $q$;
  end if;
end $$;

-- ---------------------------------------------------------
-- 2) Globale Suche (040) um Videos und Livery-Angebote erweitert – läuft weiter mit den Rechten der suchenden Person
-- ---------------------------------------------------------
create or replace function public.gsra_search(_q text)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public', 'extensions'
as $$
declare
  _me   uuid := auth.uid();
  _term text := left(btrim(regexp_replace(coalesce(_q, ''), '\s+', ' ', 'g')), 60);
  _like text;
  _res  jsonb := '{}'::jsonb;
begin
  if char_length(_term) < 2 then return _res; end if;
  -- % und _ sind in LIKE Platzhalter – als normale Zeichen suchen
  _like := '%' || replace(replace(replace(_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- Setups (für alle sichtbar; Pro Setups erscheinen als Vorschau wie im Setup Hub)
  _res := _res || jsonb_build_object('setups', coalesce((
    select jsonb_agg(x) from (
      select s.id, s.simulation, s.car_model, s.track_name, s.setup_type, coalesce(s.is_pro, false) as is_pro
      from public.setups s
      where s.car_model ilike _like or s.track_name ilike _like or s.car_model % _term or s.track_name % _term
      order by greatest(similarity(coalesce(s.car_model, ''), _term), similarity(coalesce(s.track_name, ''), _term)) desc, s.created_at desc
      limit 5) x), '[]'::jsonb));

  -- Marktplatz (verkaufte Inserate nicht)
  _res := _res || jsonb_build_object('marktplatz', coalesce((
    select jsonb_agg(x) from (
      select m.id, m.title, m.price, m.status, (m.images)[1] as image
      from public.marketplace m
      where coalesce(m.status, 'aktiv') <> 'verkauft' and (m.title ilike _like or m.title % _term)
      order by similarity(coalesce(m.title, ''), _term) desc, m.created_at desc
      limit 5) x), '[]'::jsonb));

  if _me is null then return _res; end if;   -- alles Weitere nur für Angemeldete

  -- Mitglieder (Name oder GSRA-ID; nicht man selbst, keine Blockierten)
  _res := _res || jsonb_build_object('mitglieder', coalesce((
    select jsonb_agg(x) from (
      select p.id, p.username, p.gsra_id, p.avatar_url
      from public.profiles p
      where p.id <> _me and p.username is not null and not public.i_blocked(p.id)
        and (p.username ilike _like or p.username % _term or p.gsra_id::text = _term)
      order by coalesce(p.gsra_id::text = _term, false) desc, similarity(p.username, _term) desc
      limit 5) x), '[]'::jsonb));

  -- Foren und Gruppen: eigene (auch private) und öffentliche Foren
  _res := _res || jsonb_build_object('foren', coalesce((
    select jsonb_agg(x) from (
      select g.id, g.title, g.is_public, g.is_member from (
        select c.id, c.title, coalesce(c.is_public, false) as is_public, true as is_member
        from public.chats c
        where c.title is not null and c.user1_id = c.user2_id and c.title ilike _like
          and (exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = _me)
               or (c.title = 'GSRA Official / Community Forum'))
        union
        select f.id, f.title, true, f.is_member from public.search_public_groups(_term) f
      ) g
      order by g.is_member desc, g.title
      limit 5) x), '[]'::jsonb));

  -- Nachrichten aus eigenen Chats, Gruppen und Foren (ab 3 Zeichen)
  if char_length(_term) >= 3 then
    _res := _res || jsonb_build_object('nachrichten', coalesce((
      select jsonb_agg(x) from (
        select m.id, m.chat_id, m.created_at,
               case when c.title is not null and c.user1_id = c.user2_id then c.title end as chat_title,
               (select p.username from public.profiles p
                 where p.id = case when c.user1_id = _me then c.user2_id else c.user1_id end) as partner,
               (select p.username from public.profiles p where p.id = m.sender_id) as sender,
               m.sender_id = _me as mine,
               substr(m.text, greatest(1, strpos(lower(m.text), lower(_term)) - 50), 160) as snippet
        from public.messages m
        join public.chats c on c.id = m.chat_id
        where m.text ilike _like
          and (c.user1_id = _me or c.user2_id = _me
               or exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = _me)
               or (c.title = 'GSRA Official / Community Forum' and c.user1_id = c.user2_id))
          and m.text not in ('Du hast diese Nachricht gelöscht', 'Diese Nachricht wurde gelöscht',
                             'Diese Nachricht wurde von einem Gruppenadmin gelöscht')
          and not exists (select 1 from public.message_hides h where h.user_id = _me and h.message_id = m.id)
          and (m.expires_at is null or m.expires_at > now())
        order by m.created_at desc
        limit 8) x), '[]'::jsonb));
  end if;

  -- Coaching (nur aktive Angebote mit gültiger Lizenz – die Tabellenregel prüft das zusätzlich)
  _res := _res || jsonb_build_object('coaching', coalesce((
    select jsonb_agg(x) from (
      select o.id, o.coach_id, o.title, o.category, o.simulation, o.price_cents,
             (select p.username from public.profiles p where p.id = o.coach_id) as coach
      from public.coaching_offers o
      where o.active and (o.title ilike _like or o.title % _term or o.category ilike _like or o.simulation ilike _like
                          or exists (select 1 from public.profiles p where p.id = o.coach_id and p.username ilike _like))
      order by similarity(o.title, _term) desc, o.created_at desc
      limit 5) x), '[]'::jsonb));

  -- Liveries (nur aktive Angebote aktiver Painter – die Tabellenregel prüft das zusätzlich)
  _res := _res || jsonb_build_object('liveries', coalesce((
    select jsonb_agg(x) from (
      select o.id, o.painter_id, o.title, o.price_from_cents, o.images[1] as image,
             (select p.username from public.profiles p where p.id = o.painter_id) as painter
      from public.livery_offers o
      where o.active and (o.title ilike _like or o.title % _term or array_to_string(o.simulations, ' ') ilike _like
                          or exists (select 1 from public.profiles p where p.id = o.painter_id
                                     and (p.username ilike _like or p.gsra_id::text = _term)))
      order by similarity(o.title, _term) desc, o.updated_at desc
      limit 5) x), '[]'::jsonb));

  -- Videos (Titel, Text, Hashtags, Creator-Name oder GSRA-ID)
  _res := _res || jsonb_build_object('videos', coalesce((
    select jsonb_agg(x) from (
      select v.id, v.uploader_id, v.title, v.thumbnail, v.created_at,
             (select p.username from public.profiles p where p.id = v.uploader_id) as creator
      from public.pro_videos v
      where v.title ilike _like or v.title % _term or v.description ilike _like
         or array_to_string(v.tags, ' ') ilike replace(_like, '#', '')
         or exists (select 1 from public.profiles p where p.id = v.uploader_id
                    and (p.username ilike _like or p.gsra_id::text = ltrim(_term, '#')))
      order by similarity(v.title, _term) desc, v.created_at desc
      limit 5) x), '[]'::jsonb));

  -- Rennen (anstehende und laufende)
  _res := _res || jsonb_build_object('rennen', coalesce((
    select jsonb_agg(x) from (
      select e.id, e.title, e.simulation, e.track, e.event_date
      from public.events e
      where e.event_date >= now() - interval '6 hours'
        and (e.title ilike _like or e.track ilike _like or e.simulation ilike _like or e.title % _term)
      order by e.event_date
      limit 5) x), '[]'::jsonb));

  return _res;
end;
$$;
revoke execute on function public.gsra_search(text) from public;
grant execute on function public.gsra_search(text) to anon, authenticated;

-- ---------------------------------------------------------
-- 3) KI-Renningenieur: Einstellungen und Gedächtnis (nur die eigene Person sieht und ändert sie)
-- ---------------------------------------------------------
create table if not exists public.race_engineer_settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  name        text not null default 'Kim' check (char_length(name) between 1 and 24),
  rufname     text check (rufname is null or char_length(rufname) between 1 and 24),
  art         text not null default 'kumpel' check (art in ('kumpel', 'profi', 'motivator', 'knapp')),
  gespraechig text not null default 'normal' check (gespraechig in ('still', 'normal', 'viel')),
  stimme      text not null default 'ruhig' check (stimme in ('ruhig', 'energisch', 'tief', 'hell')),
  sprache     text not null default 'de' check (sprache in ('de', 'en')),
  themen      jsonb not null default '{"sprit": true, "abstaende": true, "flaggen": true, "reifen": true, "coaching": true, "wetter": true}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.race_engineer_settings enable row level security;
revoke all on public.race_engineer_settings from anon, authenticated;
grant select on public.race_engineer_settings to authenticated;
drop policy if exists "GSRA eigener Renningenieur" on public.race_engineer_settings;
create policy "GSRA eigener Renningenieur" on public.race_engineer_settings for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.race_engineer_settings;
create policy "Gesperrte Konten haben keinen Zugriff" on public.race_engineer_settings as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));

create table if not exists public.race_engineer_memory (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  art         text not null check (art in ('vorliebe', 'ziel', 'staerke', 'schwaeche', 'notiz')),
  text        text not null check (char_length(text) between 2 and 200),
  quelle      text not null default 'fahrer' check (quelle in ('fahrer', 'renningenieur')),
  created_at  timestamptz not null default now()
);
create index if not exists race_engineer_memory_user_idx on public.race_engineer_memory (user_id, created_at desc);
alter table public.race_engineer_memory enable row level security;
revoke all on public.race_engineer_memory from anon, authenticated;
grant select, delete on public.race_engineer_memory to authenticated;
drop policy if exists "GSRA eigenes Gedächtnis lesen" on public.race_engineer_memory;
create policy "GSRA eigenes Gedächtnis lesen" on public.race_engineer_memory for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "GSRA eigenes Gedächtnis löschen" on public.race_engineer_memory;
create policy "GSRA eigenes Gedächtnis löschen" on public.race_engineer_memory for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.race_engineer_memory;
create policy "Gesperrte Konten haben keinen Zugriff" on public.race_engineer_memory as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));

create or replace function public.race_engineer_clean(_t text, _max integer)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(left(btrim(regexp_replace(regexp_replace(coalesce(_t, ''), '[\x01-\x1F\x7F<>`]', '', 'g'), '\s+', ' ', 'g')), _max), '');
$$;

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
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if public.race_engineer_clean(_name, 24) is null then raise exception 'Bitte gib deinem Renningenieur einen Namen.'; end if;
  foreach _k in array array['sprit', 'abstaende', 'flaggen', 'reifen', 'coaching', 'wetter'] loop
    _t := _t || jsonb_build_object(_k, coalesce((_themen ->> _k)::boolean, true));
  end loop;
  insert into public.race_engineer_settings (user_id, name, rufname, art, gespraechig, stimme, sprache, themen, updated_at)
  values (_me, public.race_engineer_clean(_name, 24), public.race_engineer_clean(_rufname, 24), coalesce(_art, 'kumpel'),
          coalesce(_gespraechig, 'normal'), coalesce(_stimme, 'ruhig'), coalesce(_sprache, 'de'), _t, now())
  on conflict (user_id) do update set name = excluded.name, rufname = excluded.rufname, art = excluded.art,
    gespraechig = excluded.gespraechig, stimme = excluded.stimme, sprache = excluded.sprache, themen = excluded.themen, updated_at = now();
end;
$$;

-- Etwas fürs Gedächtnis eintragen (höchstens 100 Einträge, 30 pro Stunde)
create or replace function public.race_engineer_remember(_art text, _text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me  uuid := auth.uid();
  _txt text := public.race_engineer_clean(_text, 200);
  _id  uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _txt is null or char_length(_txt) < 2 then raise exception 'Bitte schreib, was sich dein Renningenieur merken soll.'; end if;
  if _art is null or _art not in ('vorliebe', 'ziel', 'staerke', 'schwaeche', 'notiz') then raise exception 'Unbekannte Art.'; end if;
  if (select count(*) from public.race_engineer_memory where user_id = _me) >= 100 then
    raise exception 'Das Gedächtnis ist voll (100 Einträge). Lösche zuerst ältere Einträge.';
  end if;
  if (select count(*) from public.race_engineer_memory where user_id = _me and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Zu viele Einträge in kurzer Zeit. Bitte warte etwas.';
  end if;
  insert into public.race_engineer_memory (user_id, art, text, quelle) values (_me, _art, _txt, 'fahrer') returning id into _id;
  return _id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.race_engineer_save(text, text, text, text, text, text, jsonb)',
                           'public.race_engineer_remember(text, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------
-- 4) Zeitplan: stündlich die Server-Funktion „speicher-aufraeumen“ aufrufen (öffentlicher Schlüssel wie in 042 –
--    die Funktion gibt nur Zahlen zurück und löscht nur, was die Datenbank vorgemerkt hat)
-- ---------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron konnte nicht eingeschaltet werden: %', sqlerrm;
  end;
  begin
    create extension if not exists pg_net with schema extensions;
  exception when others then
    raise notice 'pg_net konnte nicht eingeschaltet werden: %', sqlerrm;
  end;
end $$;

do $$
declare
  _key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xcXl2cG1kZGFhc3RhY2xkYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzAzNzUsImV4cCI6MjEwMzAwNjM3NX0.OWY2FUS7n9Jw-6FP0Hp1B9aY6AUAkEpZ6Xd7MpS0GLI';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'gsra-speicher-aufraeumen') then
    perform cron.unschedule('gsra-speicher-aufraeumen');
  end if;
  perform cron.schedule('gsra-speicher-aufraeumen', '17 * * * *', format($cmd$
    select net.http_post(
      url := 'https://mqqyvpmddaastacldbyy.supabase.co/functions/v1/speicher-aufraeumen',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer %1$s', 'apikey', '%1$s'),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000)
  $cmd$, _key));
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „ja“, „bereit“, „bereit“, „aktiv (stündlich)“ und eine Info-Zahl)
-- ---------------------------------------------------------
select 'Warteschlange und Aufräum-Regeln' as pruefung,
       case when to_regclass('public.storage_cleanup_queue') is not null
             and to_regprocedure('public.storage_cleanup_take(integer)') is not null
             and exists (select 1 from pg_trigger where tgname = 'gsra_message_history_cleanup')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Aufräumen nur für den Server',
       case when not has_function_privilege('authenticated', 'public.storage_cleanup_take(integer)', 'execute')
             and not has_function_privilege('anon', 'public.storage_cleanup_take(integer)', 'execute')
             and not has_table_privilege('authenticated', 'public.storage_cleanup_queue', 'select') then 'ja' else 'NEIN' end
union all
select 'Suche mit Videos und Liveries',
       case when position('pro_videos' in pg_get_functiondef('public.gsra_search(text)'::regprocedure)) > 0
            then 'bereit' else 'FEHLT' end
union all
select 'Renningenieur: Einstellungen und Gedächtnis',
       case when to_regclass('public.race_engineer_settings') is not null and to_regclass('public.race_engineer_memory') is not null
             and not has_table_privilege('authenticated', 'public.race_engineer_settings', 'insert') then 'bereit' else 'FEHLT' end
union all
select 'Zeitplan',
       case when not exists (select 1 from pg_extension where extname = 'pg_cron') or not exists (select 1 from pg_extension where extname = 'pg_net')
            then 'fehlt – pg_cron und pg_net unter Database → Extensions einschalten' else 'aktiv (stündlich)' end
union all
select 'Info: vorgemerkte Dateien', (select count(*)::text from public.storage_cleanup_queue where done_at is null);
