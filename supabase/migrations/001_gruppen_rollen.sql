-- =========================================================
-- GSRA Messenger: Gruppenmitglieder & Gruppenadmins
-- Einmal komplett im Supabase SQL Editor ausführen (darf auch mehrfach laufen).
-- =========================================================

-- 1) Mitgliederliste mit Rolle: 'admin' = Gruppenadmin, 'member' = Mitglied
create table if not exists public.chat_members (
  chat_id    uuid not null references public.chats(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('admin', 'member')),
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index if not exists chat_members_user_id_idx on public.chat_members (user_id);
alter table public.chat_members enable row level security;

-- 2) Hilfsfunktionen für die Regeln
create or replace function public.is_group_member(_chat_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.chat_members where chat_id = _chat_id and user_id = auth.uid());
$$;

create or replace function public.is_group_admin(_chat_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.chat_members where chat_id = _chat_id and user_id = auth.uid() and role = 'admin');
$$;

-- 3) Bestehende Gruppen übernehmen: wer sie gegründet hat = Gruppenadmin,
--    wer dort schon geschrieben hat oder hinzugefügt wurde = Mitglied
insert into public.chat_members (chat_id, user_id, role)
select id, user1_id, 'admin'
from public.chats
where title is not null and user1_id = user2_id and title <> 'GSRA Official / Community Forum'
on conflict (chat_id, user_id) do update set role = 'admin';

insert into public.chat_members (chat_id, user_id, role)
select distinct m.chat_id, m.sender_id, 'member'::text
from public.messages m
join public.chats c on c.id = m.chat_id
where c.title is not null and c.user1_id = c.user2_id and c.title <> 'GSRA Official / Community Forum'
  and m.sender_id is not null
on conflict (chat_id, user_id) do nothing;

insert into public.chat_members (chat_id, user_id, role)
select distinct m.chat_id, p.id, 'member'::text
from public.messages m
join public.chats c on c.id = m.chat_id
join public.profiles p on p.username is not null
  and right(m.text, length(' hat ' || p.username || ' zum Forum hinzugefügt.')) = ' hat ' || p.username || ' zum Forum hinzugefügt.'
where c.title is not null and c.user1_id = c.user2_id and c.title <> 'GSRA Official / Community Forum'
  and m.text like '% zum Forum hinzugefügt.'
on conflict (chat_id, user_id) do nothing;

-- 4) Wer eine neue Gruppe anlegt, wird automatisch Gruppenadmin
create or replace function public.chats_add_founder_as_admin()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.title is not null and new.user1_id = new.user2_id and new.title <> 'GSRA Official / Community Forum' then
    insert into public.chat_members (chat_id, user_id, role)
    values (new.id, new.user1_id, 'admin')
    on conflict (chat_id, user_id) do update set role = 'admin';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_chats_add_founder_as_admin on public.chats;
create trigger trg_chats_add_founder_as_admin
  after insert on public.chats
  for each row execute function public.chats_add_founder_as_admin();

-- 5) Mitglieder verwalten – nur über diese Funktionen. Sie prüfen die Rolle und schreiben die Systemnachricht in den Chat.
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
  select username into _target from public.profiles where id = _user_id;
  if _target is null then
    raise exception 'Nutzer nicht gefunden.';
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

-- Mitglied entfernen (Gruppenadmins) bzw. Gruppe verlassen (jedes Mitglied sich selbst)
create or replace function public.remove_group_member(_chat_id uuid, _user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _founder uuid;
  _actor   text;
  _target  text;
begin
  if auth.uid() is null then
    raise exception 'Bitte melde dich an.';
  end if;
  select user1_id into _founder from public.chats
  where id = _chat_id and title is not null and user1_id = user2_id;
  if _founder is null then
    raise exception 'Gruppe nicht gefunden.';
  end if;
  if _user_id = _founder then
    raise exception 'Wer die Gruppe gegründet hat, kann sie nicht verlassen, aber löschen.';
  end if;
  if _user_id <> auth.uid() and not public.is_group_admin(_chat_id) then
    raise exception 'Nur Gruppenadmins können Mitglieder entfernen.';
  end if;

  delete from public.chat_members where chat_id = _chat_id and user_id = _user_id;

  if found then
    select username into _actor from public.profiles where id = auth.uid();
    if _user_id = auth.uid() then
      insert into public.messages (chat_id, sender_id, text)
      values (_chat_id, auth.uid(), coalesce(_actor, 'Fahrer') || ' hat die Gruppe verlassen.');
    else
      select username into _target from public.profiles where id = _user_id;
      insert into public.messages (chat_id, sender_id, text)
      values (_chat_id, auth.uid(), coalesce(_actor, 'Fahrer') || ' hat ' || coalesce(_target, 'Fahrer') || ' aus der Gruppe entfernt.');
    end if;
  end if;
end;
$$;

-- Gruppenadmin ernennen oder entfernen
create or replace function public.set_group_member_role(_chat_id uuid, _user_id uuid, _role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not public.is_group_admin(_chat_id) then
    raise exception 'Nur Gruppenadmins können Rollen vergeben.';
  end if;
  if _role not in ('admin', 'member') then
    raise exception 'Unbekannte Rolle: %', _role;
  end if;
  if _role = 'member' and exists (select 1 from public.chats where id = _chat_id and user1_id = _user_id) then
    raise exception 'Wer die Gruppe gegründet hat, bleibt immer Gruppenadmin.';
  end if;
  update public.chat_members set role = _role where chat_id = _chat_id and user_id = _user_id;
  if not found then
    raise exception 'Diese Person ist kein Mitglied der Gruppe.';
  end if;
end;
$$;

revoke execute on function public.add_group_member(uuid, uuid) from public, anon;
revoke execute on function public.remove_group_member(uuid, uuid) from public, anon;
revoke execute on function public.set_group_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.set_group_member_role(uuid, uuid, text) to authenticated;

-- 6) Regeln (RLS)
-- Mitgliederliste: nur für Mitglieder der jeweiligen Gruppe sichtbar (Ändern nur über die Funktionen oben)
drop policy if exists "Mitglieder sehen die Mitglieder ihrer Gruppen" on public.chat_members;
create policy "Mitglieder sehen die Mitglieder ihrer Gruppen" on public.chat_members
  for select to authenticated
  using (public.is_group_member(chat_id));

-- Private Gruppen sieht nur noch, wer Mitglied ist; das offizielle Forum sehen weiterhin alle angemeldeten Mitglieder
alter policy "Nutzer können ihre eigenen Chats sehen" on public.chats
  to authenticated
  using (
    auth.uid() = user1_id
    or auth.uid() = user2_id
    or (title = 'GSRA Official / Community Forum' and user1_id = user2_id)
    or public.is_group_member(id)
  );

-- Gruppenadmins dürfen ihre Gruppe umbenennen (zusätzlich zur bestehenden Regel für die gründende Person)
drop policy if exists "Gruppenadmins können ihre Gruppe bearbeiten" on public.chats;
create policy "Gruppenadmins können ihre Gruppe bearbeiten" on public.chats
  for update to authenticated
  using (public.is_group_admin(id))
  with check (public.is_group_admin(id));

-- Nachrichten lesen und schreiben: in Gruppen nur noch Mitglieder (bisher: alle angemeldeten Nutzer)
create or replace function public.is_chat_participant(_chat_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.chats c
    where c.id = _chat_id
    and (
      c.user1_id = auth.uid()
      or c.user2_id = auth.uid()
      or (c.title = 'GSRA Official / Community Forum' and c.user1_id = c.user2_id)
      or exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = auth.uid())
    )
  );
$function$;

-- 7) Kontrolle (ändert nichts): Gruppen mit Mitgliedern und die Regeln der Nachrichten-Tabelle
select 'Gruppe: ' || c.title as pruefung,
       count(m.user_id) || ' Mitglieder, davon ' || count(m.user_id) filter (where m.role = 'admin') || ' Gruppenadmin(s)' as ergebnis
from public.chats c
left join public.chat_members m on m.chat_id = c.id
where c.title is not null and c.user1_id = c.user2_id and c.title <> 'GSRA Official / Community Forum'
group by c.id, c.title
union all
select 'Regel Nachrichten (' || cmd || '): ' || policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '')
from pg_policies
where schemaname = 'public' and tablename = 'messages';
