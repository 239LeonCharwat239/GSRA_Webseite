-- =========================================================
-- GSRA Messenger: Profile & GSRA-ID, Freundschaften, öffentliche Foren,
-- Blockieren, Melden, Verwarnungen und Sperren (Admin-Bereich)
-- Einmal komplett im Supabase SQL Editor ausführen (darf auch mehrfach laufen).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Profile: Profilbild, Info-Text und die GSRA-ID (fortlaufende Zahl ab 100001)
-- ---------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
create sequence if not exists public.profiles_gsra_id_seq start with 100001;
alter table public.profiles add column if not exists gsra_id bigint;

-- Bestehende Mitglieder bekommen ihre ID in der Reihenfolge ihrer Registrierung
do $$
declare r record;
begin
  for r in
    select p.id from public.profiles p left join auth.users u on u.id = p.id
    where p.gsra_id is null
    order by u.created_at nulls last, p.id
  loop
    update public.profiles set gsra_id = nextval('public.profiles_gsra_id_seq') where id = r.id;
  end loop;
end $$;

alter table public.profiles alter column gsra_id set default nextval('public.profiles_gsra_id_seq');
alter table public.profiles alter column gsra_id set not null;
alter sequence public.profiles_gsra_id_seq owned by public.profiles.gsra_id;
create unique index if not exists profiles_gsra_id_key on public.profiles (gsra_id);

create or replace function public.is_site_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Rolle und GSRA-ID kann niemand selbst ändern (sonst könnte man sich z. B. selbst zum Admin machen)
create or replace function public.profiles_protect_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or public.is_site_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.role = 'admin' then
      raise exception 'Keine Berechtigung.';
    end if;
    new.gsra_id := nextval('public.profiles_gsra_id_seq');
  else
    new.role := old.role;
    new.gsra_id := old.gsra_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_fields on public.profiles;
create trigger trg_profiles_protect_fields
  before insert or update on public.profiles
  for each row execute function public.profiles_protect_fields();

-- ---------------------------------------------------------
-- 2) Neue Tabellen: Blockierungen, Meldungen, Verwarnungen, Sperren, „Für mich gelöscht“
-- ---------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  reported_id uuid not null references auth.users(id) on delete cascade,
  chat_id uuid references public.chats(id) on delete set null,
  message_id text,
  reason text not null,
  details text,
  context jsonb not null default '[]'::jsonb,
  status text not null default 'offen' check (status in ('offen', 'verwarnt', 'gesperrt', 'verworfen')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_reported_idx on public.reports (reported_id);

create table if not exists public.user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  text text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);
create index if not exists user_warnings_user_idx on public.user_warnings (user_id);

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  banned_until timestamptz,                 -- leer = dauerhaft gesperrt
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id) on delete set null
);
create index if not exists user_bans_user_idx on public.user_bans (user_id);

-- „Für mich löschen“: ausgeblendete Nachrichten je Person (Spaltentyp passend zu messages.id)
do $$
declare _id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into _id_type
  from pg_attribute a
  where a.attrelid = 'public.messages'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.message_hides (
      user_id uuid not null references auth.users(id) on delete cascade,
      message_id %s not null references public.messages(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, message_id)
    )$f$, _id_type);
end $$;

alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;
alter table public.user_warnings enable row level security;
alter table public.user_bans enable row level security;
alter table public.message_hides enable row level security;

-- ---------------------------------------------------------
-- 3) Hilfsfunktionen
-- ---------------------------------------------------------
create or replace function public.is_banned()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.user_bans b
    where b.user_id = auth.uid() and b.lifted_at is null and (b.banned_until is null or b.banned_until > now())
  );
$$;

create or replace function public.is_friend(_other uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = auth.uid() and f.friend_id = _other) or (f.user_id = _other and f.friend_id = auth.uid()))
  );
$$;

create or replace function public.i_blocked(_other uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.user_blocks where blocker_id = auth.uid() and blocked_id = _other);
$$;

-- Schreiben: im offiziellen Forum nur Website-Admins, sonst Teilnehmer bzw. Gruppenmitglieder
create or replace function public.can_post_in_chat(_chat_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.chats c
    where c.id = _chat_id
      and case
            when c.title = 'GSRA Official / Community Forum' and c.user1_id = c.user2_id then public.is_site_admin()
            else c.user1_id = auth.uid() or c.user2_id = auth.uid()
                 or exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = auth.uid())
          end
  );
$$;

-- Forenbild und -beschreibung: Gruppenadmins; beim offiziellen Forum die Website-Admins
create or replace function public.can_edit_group_profile(_chat text)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  return public.is_group_admin(_chat::uuid)
      or (public.is_site_admin() and exists (
            select 1 from public.chats where id = _chat::uuid and title = 'GSRA Official / Community Forum'));
exception when invalid_text_representation then
  return false;
end;
$$;

-- ---------------------------------------------------------
-- 4) Foren: Beschreibung, Bild, öffentlich oder privat
-- ---------------------------------------------------------
alter table public.chats add column if not exists description text;
alter table public.chats add column if not exists image_url text;
alter table public.chats add column if not exists is_public boolean not null default false;

drop policy if exists "Website-Admins bearbeiten das offizielle Forum" on public.chats;
create policy "Website-Admins bearbeiten das offizielle Forum" on public.chats
  for update to authenticated
  using (title = 'GSRA Official / Community Forum' and user1_id = user2_id and public.is_site_admin())
  with check (title = 'GSRA Official / Community Forum' and user1_id = user2_id and public.is_site_admin());

-- Neue Direktchats nur zwischen Freunden (Marktplatz-Anfragen laufen über start_direct_chat)
drop policy if exists "Neue Direktchats nur zwischen Freunden" on public.chats;
create policy "Neue Direktchats nur zwischen Freunden" on public.chats
  as restrictive for insert to authenticated
  with check (user1_id = user2_id or public.is_friend(case when user1_id = auth.uid() then user2_id else user1_id end));

-- Öffentliche Foren finden (ohne Mitglied zu sein)
create or replace function public.search_public_groups(_term text)
returns table (id uuid, title text, description text, image_url text, member_count bigint, is_member boolean)
language sql
stable security definer
set search_path to 'public'
as $$
  select c.id, c.title, c.description, c.image_url,
         (select count(*) from public.chat_members m where m.chat_id = c.id),
         exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = auth.uid())
  from public.chats c
  where auth.uid() is not null
    and c.is_public and c.title is not null and c.user1_id = c.user2_id
    and c.title ilike '%' || replace(replace(replace(coalesce(_term, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by c.title
  limit 20;
$$;

create or replace function public.join_public_group(_chat_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare _name text;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if not exists (select 1 from public.chats where id = _chat_id and is_public and title is not null and user1_id = user2_id) then
    raise exception 'Dieses Forum ist nicht öffentlich.';
  end if;
  insert into public.chat_members (chat_id, user_id, role) values (_chat_id, auth.uid(), 'member')
  on conflict (chat_id, user_id) do nothing;
  if found then
    select username into _name from public.profiles where id = auth.uid();
    insert into public.messages (chat_id, sender_id, text)
    values (_chat_id, auth.uid(), coalesce(_name, 'Fahrer') || ' ist dem Forum beigetreten.');
  end if;
end;
$$;

-- Mitglieder hinzufügen: nur Gruppenadmins – und nur Freunde
create or replace function public.add_group_member(_chat_id uuid, _user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _actor  text;
  _target text;
begin
  if auth.uid() is null or not public.is_group_admin(_chat_id) then
    raise exception 'Nur Gruppenadmins können Mitglieder hinzufügen.';
  end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select username into _target from public.profiles where id = _user_id;
  if _target is null then
    raise exception 'Nutzer nicht gefunden.';
  end if;
  if not public.is_friend(_user_id) then
    raise exception 'Du kannst nur Freunde hinzufügen.';
  end if;

  insert into public.chat_members (chat_id, user_id, role, added_by)
  values (_chat_id, _user_id, 'member', auth.uid())
  on conflict (chat_id, user_id) do nothing;

  if found then
    select username into _actor from public.profiles where id = auth.uid();
    insert into public.messages (chat_id, sender_id, text)
    values (_chat_id, auth.uid(), coalesce(_actor, 'Fahrer') || ' hat ' || _target || ' zum Forum hinzugefügt.');
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 5) Freundschaften (Anfragen senden, annehmen, ablehnen, entfernen)
-- ---------------------------------------------------------
alter table public.friendships add column if not exists created_at timestamptz default now();
alter table public.friendships add column if not exists responded_at timestamptz;

-- Doppelte Einträge zwischen denselben zwei Personen entfernen (eine bestehende Freundschaft bleibt erhalten)
delete from public.friendships where user_id is null or friend_id is null or user_id = friend_id;
delete from public.friendships f
using public.friendships g
where least(f.user_id, f.friend_id) = least(g.user_id, g.friend_id)
  and greatest(f.user_id, f.friend_id) = greatest(g.user_id, g.friend_id)
  and f.ctid <> g.ctid
  and ((coalesce(g.status, '') = 'accepted' and coalesce(f.status, '') <> 'accepted')
       or ((coalesce(g.status, '') = 'accepted') = (coalesce(f.status, '') = 'accepted') and g.ctid < f.ctid));
create unique index if not exists friendships_pair_key
  on public.friendships (least(user_id, friend_id), greatest(user_id, friend_id));

-- Bisherige Regeln ersetzen (die Freundesfunktion wurde noch nicht genutzt): lesen nur eigene, ändern nur über die Funktionen unten
alter table public.friendships enable row level security;
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'friendships' loop
    execute format('drop policy %I on public.friendships', r.policyname);
  end loop;
end $$;
create policy "Eigene Freundschaften sehen" on public.friendships
  for select to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

create or replace function public.send_friend_request(_target uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me uuid := auth.uid();
  _existing record;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _target is null or _target = _me then raise exception 'Du kannst dir selbst keine Anfrage senden.'; end if;
  if not exists (select 1 from public.profiles where id = _target) then raise exception 'Nutzer nicht gefunden.'; end if;
  if exists (select 1 from public.user_blocks
             where (blocker_id = _me and blocked_id = _target) or (blocker_id = _target and blocked_id = _me)) then
    raise exception 'Eine Anfrage an diese Person ist nicht möglich.';
  end if;

  select * into _existing from public.friendships
  where (user_id = _me and friend_id = _target) or (user_id = _target and friend_id = _me)
  limit 1;
  if found then
    if _existing.status = 'accepted' then raise exception 'Ihr seid bereits befreundet.'; end if;
    if _existing.user_id = _me then raise exception 'Du hast bereits eine Anfrage gesendet.'; end if;
    -- Die andere Person hat schon angefragt: dann gilt die Freundschaft sofort
    update public.friendships set status = 'accepted', responded_at = now()
    where user_id = _target and friend_id = _me;
    return 'accepted';
  end if;

  insert into public.friendships (user_id, friend_id, status) values (_me, _target, 'pending');
  return 'pending';
end;
$$;

create or replace function public.respond_friend_request(_from uuid, _accept boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if _accept then
    update public.friendships set status = 'accepted', responded_at = now()
    where user_id = _from and friend_id = auth.uid() and status = 'pending';
  else
    delete from public.friendships where user_id = _from and friend_id = auth.uid() and status = 'pending';
  end if;
  if not found then raise exception 'Diese Anfrage gibt es nicht mehr.'; end if;
end;
$$;

-- Freund entfernen bzw. eigene Anfrage zurückziehen
create or replace function public.remove_friend(_other uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  delete from public.friendships
  where (user_id = auth.uid() and friend_id = _other) or (user_id = _other and friend_id = auth.uid());
end;
$$;

-- ---------------------------------------------------------
-- 6) Direktchats beginnen: mit Freunden – Ausnahme: Verkäufer im Marktplatz.
--    Ein bestehender Chat wird immer wiederverwendet (nie zwei Chats mit derselben Person).
-- ---------------------------------------------------------
create or replace function public.start_direct_chat(_other uuid, _intro text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me   uuid := auth.uid();
  _a    uuid;
  _b    uuid;
  _chat uuid;
  _name text;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _other is null or _other = _me then raise exception 'Du kannst keinen Chat mit dir selbst beginnen.'; end if;
  if not exists (select 1 from public.profiles where id = _other) then raise exception 'Nutzer nicht gefunden.'; end if;

  select id into _chat from public.chats
  where user1_id <> user2_id
    and ((user1_id = _me and user2_id = _other) or (user1_id = _other and user2_id = _me))
  order by created_at
  limit 1;
  if _chat is not null then
    return _chat;
  end if;

  if not public.is_friend(_other) and not exists (select 1 from public.marketplace where user_id = _other) then
    raise exception 'Ihr müsst befreundet sein, um einen Chat zu beginnen.';
  end if;
  if exists (select 1 from public.user_blocks where blocker_id = _other and blocked_id = _me) then
    raise exception 'Ein Chat mit dieser Person ist nicht möglich.';
  end if;

  if _me < _other then _a := _me; _b := _other; else _a := _other; _b := _me; end if;
  select username into _name from public.profiles where id = _me;
  _intro := left(coalesce(nullif(trim(_intro), ''), coalesce(_name, 'Fahrer') || ' hat den Chat eröffnet.'), 500);

  insert into public.chats (user1_id, user2_id, title, last_message) values (_a, _b, null, _intro)
  returning id into _chat;
  insert into public.messages (chat_id, sender_id, text) values (_chat, _me, _intro);
  return _chat;
end;
$$;

-- ---------------------------------------------------------
-- 7) Blockieren: Nachrichten blockierter Personen kommen nicht mehr an
-- ---------------------------------------------------------
drop policy if exists "Eigene Blockierungen sehen" on public.user_blocks;
create policy "Eigene Blockierungen sehen" on public.user_blocks
  for select to authenticated
  using (blocker_id = auth.uid());

create or replace function public.block_user(_other uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if _other is null or _other = auth.uid() then raise exception 'Du kannst dich nicht selbst blockieren.'; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), _other) on conflict do nothing;
  delete from public.friendships
  where (user_id = auth.uid() and friend_id = _other) or (user_id = _other and friend_id = auth.uid());
end;
$$;

create or replace function public.unblock_user(_other uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = _other;
end;
$$;

-- Nachrichten lesen: nur in eigenen Chats, Gruppen und dem offiziellen Forum – und nichts von Blockierten.
-- Schreiben: als Teilnehmer bzw. Mitglied; im offiziellen Forum nur Website-Admins.
drop policy if exists "Nachrichten nur aus eigenen Chats und nicht von Blockierten" on public.messages;
create policy "Nachrichten nur aus eigenen Chats und nicht von Blockierten" on public.messages
  as restrictive for select to authenticated
  using (public.is_chat_participant(chat_id) and not public.i_blocked(sender_id));

drop policy if exists "Schreiben nur als Teilnehmer" on public.messages;
create policy "Schreiben nur als Teilnehmer" on public.messages
  as restrictive for insert to authenticated
  with check (public.can_post_in_chat(chat_id));

drop policy if exists "Eigene ausgeblendete Nachrichten" on public.message_hides;
create policy "Eigene ausgeblendete Nachrichten" on public.message_hides
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Fremde Nachrichten: wie bisher nur die eigene Reaktion – neu: Gruppenadmins dürfen sie für alle löschen
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
     and public.is_group_admin(new.chat_id) then
    return new;
  end if;

  if exists (
       select 1
       from unnest(array['text', 'image_url', 'is_edited', 'edit_count', 'edited_at']) as spalte
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
-- 8) Melden: Meldung mit Grund, Text und Gesprächsverlauf (gemeldete Nachricht ± 2) – danach sofort blockiert
-- ---------------------------------------------------------
drop policy if exists "Admins sehen alle Meldungen" on public.reports;
create policy "Admins sehen alle Meldungen" on public.reports
  for select to authenticated
  using ((select public.is_site_admin()));

create or replace function public.report_user(_reported uuid, _reason text, _details text default null,
                                              _chat_id uuid default null, _message_id text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me        uuid := auth.uid();
  _anchor_id text;
  _anchor_at timestamptz;
  _context   jsonb := '[]'::jsonb;
  _report    uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if _reported is null or _reported = _me then raise exception 'Du kannst dich nicht selbst melden.'; end if;
  if not exists (select 1 from public.profiles where id = _reported) then raise exception 'Nutzer nicht gefunden.'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Bitte wähle einen Grund.'; end if;
  if (select count(*) from public.reports where reporter_id = _me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Du hast in kurzer Zeit sehr viele Meldungen gesendet. Bitte versuche es später erneut.';
  end if;

  -- Gesprächsverlauf nur aus einem Chat, den die meldende Person selbst lesen darf
  if _chat_id is not null and public.is_chat_participant(_chat_id) then
    select m.id::text, m.created_at into _anchor_id, _anchor_at
    from public.messages m
    where m.chat_id = _chat_id and m.sender_id = _reported
    order by (m.id::text = coalesce(_message_id, '')) desc, m.created_at desc
    limit 1;

    if _anchor_id is not null then
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', x.id::text,
               'sender_id', x.sender_id,
               'sender_name', coalesce(p.username, 'Fahrer'),
               'text', x.text,
               'image_url', x.image_url,
               'created_at', x.created_at,
               'reported', x.id::text = _anchor_id)
             order by x.created_at, x.id::text), '[]'::jsonb)
      into _context
      from (
        (select * from public.messages
          where chat_id = _chat_id and (created_at, id::text) < (_anchor_at, _anchor_id)
          order by created_at desc, id::text desc limit 2)
        union all
        (select * from public.messages where id::text = _anchor_id)
        union all
        (select * from public.messages
          where chat_id = _chat_id and (created_at, id::text) > (_anchor_at, _anchor_id)
          order by created_at, id::text limit 2)
      ) x
      left join public.profiles p on p.id = x.sender_id;
    end if;
  else
    _chat_id := null;
  end if;

  insert into public.reports (reporter_id, reported_id, chat_id, message_id, reason, details, context)
  values (_me, _reported, _chat_id, _anchor_id, left(trim(_reason), 80),
          nullif(left(trim(coalesce(_details, '')), 1000), ''), _context)
  returning id into _report;

  -- Sofortiger Schutz: die gemeldete Person ist für die meldende Person blockiert
  insert into public.user_blocks (blocker_id, blocked_id) values (_me, _reported) on conflict do nothing;
  delete from public.friendships
  where (user_id = _me and friend_id = _reported) or (user_id = _reported and friend_id = _me);
  return _report;
end;
$$;

-- ---------------------------------------------------------
-- 9) Verwarnungen (oben im Chat angeheftet, bis sie bestätigt wurden) und Sperren
-- ---------------------------------------------------------
drop policy if exists "Eigene Verwarnungen sehen" on public.user_warnings;
create policy "Eigene Verwarnungen sehen" on public.user_warnings
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_site_admin()));

drop policy if exists "Eigene Sperren sehen" on public.user_bans;
create policy "Eigene Sperren sehen" on public.user_bans
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_site_admin()));

create or replace function public.acknowledge_warning(_warning_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.user_warnings set acknowledged_at = now()
  where id = _warning_id and user_id = auth.uid() and acknowledged_at is null;
end;
$$;

create or replace function public.admin_warn_user(_report_id uuid, _text text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare _user uuid;
begin
  if not public.is_site_admin() then raise exception 'Nur für Administratoren.'; end if;
  if coalesce(trim(_text), '') = '' then raise exception 'Bitte gib einen Text für die Verwarnung ein.'; end if;
  select reported_id into _user from public.reports where id = _report_id and status = 'offen';
  if _user is null then raise exception 'Diese Meldung ist bereits erledigt.'; end if;
  insert into public.user_warnings (user_id, report_id, text, created_by)
  values (_user, _report_id, left(trim(_text), 2000), auth.uid());
  update public.reports set status = 'verwarnt', resolved_by = auth.uid(), resolved_at = now() where id = _report_id;
end;
$$;

-- _days = 30 für 30 Tage, leer (null) für eine dauerhafte Sperre
create or replace function public.admin_ban_user(_report_id uuid, _days integer default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _user  uuid;
  _until timestamptz;
begin
  if not public.is_site_admin() then raise exception 'Nur für Administratoren.'; end if;
  select reported_id into _user from public.reports where id = _report_id and status = 'offen';
  if _user is null then raise exception 'Diese Meldung ist bereits erledigt.'; end if;
  if exists (select 1 from public.profiles where id = _user and role = 'admin') then
    raise exception 'Administratoren können nicht gesperrt werden.';
  end if;

  _until := case when _days is null then null else now() + make_interval(days => _days) end;
  insert into public.user_bans (user_id, report_id, banned_until, reason, created_by)
  values (_user, _report_id, _until, (select reason from public.reports where id = _report_id), auth.uid());
  update public.reports set status = 'gesperrt', resolved_by = auth.uid(), resolved_at = now() where id = _report_id;

  -- Zusätzlich die Anmeldung selbst sperren. Erlaubt die Datenbank das nicht, greift die Sperre trotzdem:
  -- über die Webseite (Abmeldung + Hinweis) und die Regeln unten (kein Zugriff auf Daten).
  begin
    update auth.users set banned_until = coalesce(_until, now() + interval '100 years') where id = _user;
  exception when others then
    null;
  end;
end;
$$;

create or replace function public.admin_dismiss_report(_report_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_site_admin() then raise exception 'Nur für Administratoren.'; end if;
  update public.reports set status = 'verworfen', resolved_by = auth.uid(), resolved_at = now()
  where id = _report_id and status = 'offen';
  if not found then raise exception 'Diese Meldung ist bereits erledigt.'; end if;
end;
$$;

create or replace function public.admin_lift_ban(_user uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_site_admin() then raise exception 'Nur für Administratoren.'; end if;
  update public.user_bans set lifted_at = now(), lifted_by = auth.uid()
  where user_id = _user and lifted_at is null;
  begin
    update auth.users set banned_until = null where id = _user;
  exception when others then
    null;
  end;
end;
$$;

-- Gesperrte Konten haben keinen Zugriff auf Messenger, Marktplatz, Setups usw.
-- (nur bei Tabellen, die schon Regeln/RLS nutzen – an allen anderen ändert sich nichts)
do $$
declare t text;
begin
  foreach t in array array['chats', 'messages', 'chat_members', 'chat_favorites', 'friendships', 'user_blocks',
                           'message_hides', 'marketplace', 'setups', 'events'] loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = t and c.relkind = 'r' and c.relrowsecurity) then
      execute format('drop policy if exists %I on public.%I', 'Gesperrte Konten haben keinen Zugriff', t);
      execute format('create policy %I on public.%I as restrictive for all to authenticated
                        using (not (select public.is_banned())) with check (not (select public.is_banned()))',
                     'Gesperrte Konten haben keinen Zugriff', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------
-- 10) Speicher für Profil- und Forenbilder (öffentlich lesbar, max. 5 MB, nur Bilder)
--     Profilbilder: avatars/<eigene Nutzer-ID>/…   Forenbilder: avatars/foren/<Chat-ID>/…
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "GSRA Bilder hochladen" on storage.objects;
create policy "GSRA Bilder hochladen" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars' and not (select public.is_banned()) and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ((storage.foldername(name))[1] = 'foren' and public.can_edit_group_profile((storage.foldername(name))[2]))
    )
  );

drop policy if exists "GSRA eigene Bilder löschen" on storage.objects;
create policy "GSRA eigene Bilder löschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------
-- 11) Funktionen nur für angemeldete Nutzer freigeben
-- ---------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.search_public_groups(text)', 'public.join_public_group(uuid)', 'public.add_group_member(uuid, uuid)',
    'public.send_friend_request(uuid)', 'public.respond_friend_request(uuid, boolean)', 'public.remove_friend(uuid)',
    'public.start_direct_chat(uuid, text)', 'public.block_user(uuid)', 'public.unblock_user(uuid)',
    'public.report_user(uuid, text, text, uuid, text)', 'public.acknowledge_warning(uuid)',
    'public.admin_warn_user(uuid, text)', 'public.admin_ban_user(uuid, integer)',
    'public.admin_dismiss_report(uuid)', 'public.admin_lift_ban(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------
-- 12) Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Profile mit GSRA-ID' as pruefung, count(*)::text || ' (kleinste ID ' || coalesce(min(gsra_id)::text, '-') || ')' as ergebnis
from public.profiles
union all
select 'Freundschaften / offene Anfragen',
       count(*) filter (where status = 'accepted')::text || ' / ' || count(*) filter (where status = 'pending')::text
from public.friendships
union all
select 'Neue Tabellen', string_agg(tablename, ', ' order by tablename)
from pg_tables
where schemaname = 'public' and tablename in ('user_blocks', 'reports', 'user_warnings', 'user_bans', 'message_hides')
union all
select 'Bilder-Speicher', coalesce((select 'avatars (öffentlich: ' || public::text || ')' from storage.buckets where id = 'avatars'), 'fehlt');
