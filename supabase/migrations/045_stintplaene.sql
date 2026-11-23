-- =========================================================
-- GSRA 045 – Stint-Planer: Pläne im Konto, Team und Live-Abgleich (23.11.)
--  * Nur für Pole und Alliance (und Admins): Das prüft die Datenbank selbst bei jedem Zugriff (plan_of).
--  * Pläne speichert nur der Server über geprüfte Funktionen – mit Versionsnummer, damit sich zwei Personen nicht
--    unbemerkt gegenseitig überschreiben. Höchstens 25 eigene Pläne, je Plan höchstens 64 KB.
--  * Team: Die Eigentümerin oder der Eigentümer lädt Mitglieder per GSRA-ID ein (nur mit Pole oder Alliance, nicht
--    blockiert, höchstens 12), Rollen „ansehen“ oder „bearbeiten“. Mitglieder können jederzeit austreten.
--  * Live-Abgleich: Änderungen kommen über die Echtzeit-Verbindung sofort bei allen Mitgliedern an – nur bei denen,
--    die den Plan sehen dürfen (gleiche Leseregel).
--  * Gegen Spam: höchstens 60 Speichervorgänge pro Minute und Person.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 011 (plan_of), 003 (Blockieren) und 006 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Tabellen
-- ---------------------------------------------------------
create table if not exists public.stint_plans (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  data       jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 65536),
  version    integer not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stint_plans_owner_idx on public.stint_plans (owner_id, updated_at desc);

create table if not exists public.stint_plan_members (
  plan_id  uuid not null references public.stint_plans(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  role     text not null check (role in ('ansehen', 'bearbeiten')),
  added_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
create index if not exists stint_plan_members_user_idx on public.stint_plan_members (user_id);

create table if not exists public.stint_plan_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  minute  timestamptz not null,
  n       integer not null default 0,
  primary key (user_id, minute)
);

alter table public.stint_plans enable row level security;
alter table public.stint_plan_members enable row level security;
alter table public.stint_plan_saves enable row level security;
revoke all on public.stint_plans, public.stint_plan_members, public.stint_plan_saves from anon, authenticated;
-- Lesen dürfen Angemeldete (die Regeln unten bestimmen, welche Zeilen); schreiben nur über die Funktionen
grant select on public.stint_plans, public.stint_plan_members to authenticated;

-- ---------------------------------------------------------
-- 2) Zugriff: Abo-Prüfung und Rolle im Plan
-- ---------------------------------------------------------
create or replace function public.stint_planer_erlaubt()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and not public.is_banned()
     and (public.plan_of(auth.uid()) in ('pole', 'alliance') or public.is_site_admin());
$$;

create or replace function public.stint_plan_role(_plan uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.stint_planer_erlaubt() then null
    when exists (select 1 from public.stint_plans p where p.id = _plan and p.owner_id = auth.uid()) then 'eigentuemer'
    else (select m.role from public.stint_plan_members m where m.plan_id = _plan and m.user_id = auth.uid())
  end;
$$;

drop policy if exists "GSRA: Stintplan lesen" on public.stint_plans;
create policy "GSRA: Stintplan lesen" on public.stint_plans
  for select to authenticated using (public.stint_plan_role(id) is not null);

drop policy if exists "GSRA: Stintplan-Team lesen" on public.stint_plan_members;
create policy "GSRA: Stintplan-Team lesen" on public.stint_plan_members
  for select to authenticated using (public.stint_plan_role(plan_id) is not null);

-- ---------------------------------------------------------
-- 3) Funktionen für die Seite
-- ---------------------------------------------------------
-- Eigene und geteilte Pläne
create or replace function public.stint_plan_list()
returns table (id uuid, name text, owner_name text, role text, updated_at timestamptz, members integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, coalesce(pr.username, 'Fahrer'), public.stint_plan_role(p.id), p.updated_at,
         (select count(*)::int from public.stint_plan_members m where m.plan_id = p.id)
  from public.stint_plans p
  left join public.profiles pr on pr.id = p.owner_id
  where public.stint_planer_erlaubt()
    and (p.owner_id = auth.uid() or exists (select 1 from public.stint_plan_members m where m.plan_id = p.id and m.user_id = auth.uid()))
  order by p.updated_at desc
  limit 100;
$$;

-- Speichern (neu: _id leer). _version: die zuletzt geladene Version – passt sie nicht, hat jemand anderes geändert.
create or replace function public.stint_plan_save(_id uuid, _name text, _data jsonb, _version integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
  _rolle text;
  _jetzt integer;
  _name_ok text := left(btrim(regexp_replace(coalesce(_name, ''), '[[:cntrl:]<>]', '', 'g')), 60);
  _neu public.stint_plans;
begin
  if not public.stint_planer_erlaubt() then
    raise exception 'Der Stint-Planer ist Teil von Pole und Alliance.';
  end if;
  if _data is null or jsonb_typeof(_data) <> 'object' then raise exception 'Ungültiger Plan.'; end if;
  if pg_column_size(_data) > 65536 then raise exception 'Der Plan ist zu groß (höchstens 64 KB).'; end if;
  if _name_ok = '' then _name_ok := 'Mein Stintplan'; end if;

  -- Gegen Spam: höchstens 60 Speichervorgänge pro Minute
  insert into public.stint_plan_saves (user_id, minute, n) values (_me, date_trunc('minute', now()), 1)
  on conflict (user_id, minute) do update set n = stint_plan_saves.n + 1;
  if (select n from public.stint_plan_saves where user_id = _me and minute = date_trunc('minute', now())) > 60 then
    raise exception 'Zu viele Speichervorgänge. Bitte warte einen Moment.';
  end if;
  delete from public.stint_plan_saves where minute < now() - interval '10 minutes';

  if _id is null then
    if (select count(*) from public.stint_plans where owner_id = _me) >= 25 then
      raise exception 'Du hast schon 25 Stintpläne. Lösche einen älteren, um einen neuen anzulegen.';
    end if;
    insert into public.stint_plans (owner_id, name, data, updated_by) values (_me, _name_ok, _data, _me)
    returning * into _neu;
    return jsonb_build_object('id', _neu.id, 'version', _neu.version, 'updated_at', _neu.updated_at);
  end if;

  _rolle := public.stint_plan_role(_id);
  if _rolle is null then raise exception 'Diesen Plan gibt es nicht oder du hast keinen Zugriff.'; end if;
  if _rolle = 'ansehen' then raise exception 'Diesen Plan darfst du nur ansehen.'; end if;
  select version into _jetzt from public.stint_plans where id = _id for update;
  if _version is not null and _version <> _jetzt then
    raise exception 'Der Plan wurde gerade von jemand anderem geändert. Er wird neu geladen.';
  end if;
  update public.stint_plans
  set name = _name_ok, data = _data, version = version + 1, updated_by = _me, updated_at = now()
  where id = _id
  returning * into _neu;
  return jsonb_build_object('id', _neu.id, 'version', _neu.version, 'updated_at', _neu.updated_at);
end;
$$;

create or replace function public.stint_plan_delete(_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.stint_plan_role(_id) is distinct from 'eigentuemer' then
    raise exception 'Löschen kann nur, wer den Plan angelegt hat.';
  end if;
  delete from public.stint_plans where id = _id;
  return true;
end;
$$;

-- Team: Mitglied per GSRA-ID einladen oder Rolle ändern
create or replace function public.stint_plan_member_add(_plan uuid, _gsra_id bigint, _role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
  _ziel uuid;
  _name text;
begin
  if public.stint_plan_role(_plan) is distinct from 'eigentuemer' then
    raise exception 'Mitglieder einladen kann nur, wer den Plan angelegt hat.';
  end if;
  if _role not in ('ansehen', 'bearbeiten') then raise exception 'Ungültige Rolle.'; end if;
  select p.id, p.username into _ziel, _name from public.profiles p where p.gsra_id = _gsra_id;
  if _ziel is null then raise exception 'Zu dieser GSRA-ID gibt es kein Mitglied.'; end if;
  if _ziel = _me then raise exception 'Du bist schon Eigentümer dieses Plans.'; end if;
  if exists (select 1 from public.user_blocks b where (b.blocker_id = _me and b.blocked_id = _ziel) or (b.blocker_id = _ziel and b.blocked_id = _me)) then
    raise exception 'Diese Person kannst du nicht einladen.';
  end if;
  if exists (select 1 from public.user_bans b where b.user_id = _ziel and b.lifted_at is null and (b.banned_until is null or b.banned_until > now())) then
    raise exception 'Diese Person kannst du nicht einladen.';
  end if;
  if public.plan_of(_ziel) not in ('pole', 'alliance') and not exists (select 1 from public.profiles p where p.id = _ziel and p.role = 'admin') then
    raise exception 'Diese Person hat kein Pole- oder Alliance-Abo. Der Stint-Planer ist Teil dieser Abos.';
  end if;
  if not exists (select 1 from public.stint_plan_members m where m.plan_id = _plan and m.user_id = _ziel)
     and (select count(*) from public.stint_plan_members m where m.plan_id = _plan) >= 12 then
    raise exception 'Ein Plan kann höchstens 12 Mitglieder haben.';
  end if;
  insert into public.stint_plan_members (plan_id, user_id, role) values (_plan, _ziel, _role)
  on conflict (plan_id, user_id) do update set role = excluded.role;
  return coalesce(_name, 'Fahrer');
end;
$$;

-- Mitglied entfernen (Eigentümer) oder selbst austreten
create or replace function public.stint_plan_member_remove(_plan uuid, _user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if _user is distinct from auth.uid() and public.stint_plan_role(_plan) is distinct from 'eigentuemer' then
    raise exception 'Mitglieder entfernen kann nur, wer den Plan angelegt hat.';
  end if;
  delete from public.stint_plan_members where plan_id = _plan and user_id = _user;
  return found;
end;
$$;

-- Team mit Namen (nur für alle, die den Plan sehen dürfen)
create or replace function public.stint_plan_team(_plan uuid)
returns table (user_id uuid, username text, avatar_url text, gsra_id bigint, role text)
language sql
stable
security definer
set search_path = public
as $$
  select x.user_id, coalesce(p.username, 'Fahrer'), p.avatar_url, p.gsra_id, x.role
  from (
    select sp.owner_id as user_id, 'eigentuemer'::text as role, 0 as ord from public.stint_plans sp where sp.id = _plan
    union all
    select m.user_id, m.role, 1 from public.stint_plan_members m where m.plan_id = _plan
  ) x
  left join public.profiles p on p.id = x.user_id
  where public.stint_plan_role(_plan) is not null
  order by x.ord, p.username;
$$;

-- ---------------------------------------------------------
-- 4) Rechte
-- ---------------------------------------------------------
revoke execute on function public.stint_planer_erlaubt() from public, anon;
revoke execute on function public.stint_plan_role(uuid) from public, anon;
revoke execute on function public.stint_plan_list() from public, anon;
revoke execute on function public.stint_plan_save(uuid, text, jsonb, integer) from public, anon;
revoke execute on function public.stint_plan_delete(uuid) from public, anon;
revoke execute on function public.stint_plan_member_add(uuid, bigint, text) from public, anon;
revoke execute on function public.stint_plan_member_remove(uuid, uuid) from public, anon;
revoke execute on function public.stint_plan_team(uuid) from public, anon;
grant execute on function public.stint_planer_erlaubt() to authenticated;
grant execute on function public.stint_plan_role(uuid) to authenticated;
grant execute on function public.stint_plan_list() to authenticated;
grant execute on function public.stint_plan_save(uuid, text, jsonb, integer) to authenticated;
grant execute on function public.stint_plan_delete(uuid) to authenticated;
grant execute on function public.stint_plan_member_add(uuid, bigint, text) to authenticated;
grant execute on function public.stint_plan_member_remove(uuid, uuid) to authenticated;
grant execute on function public.stint_plan_team(uuid) to authenticated;

-- ---------------------------------------------------------
-- 5) Live-Abgleich: Änderungen über die Echtzeit-Verbindung (gleiche Leseregel)
-- ---------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.stint_plans;
exception when duplicate_object or undefined_object then
  null;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „ja“, „ja“, „aktiv“)
-- ---------------------------------------------------------
select 'Stintpläne und Team' as pruefung,
       case when to_regclass('public.stint_plans') is not null and to_regclass('public.stint_plan_members') is not null
             and to_regprocedure('public.stint_plan_save(uuid, text, jsonb, integer)') is not null then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Schreiben nur über die Funktionen',
       case when not has_table_privilege('authenticated', 'public.stint_plans', 'insert')
             and not has_table_privilege('authenticated', 'public.stint_plans', 'update')
             and not has_table_privilege('authenticated', 'public.stint_plan_members', 'insert') then 'ja' else 'NEIN' end
union all
select 'Gäste ausgeschlossen',
       case when not has_table_privilege('anon', 'public.stint_plans', 'select')
             and not has_function_privilege('anon', 'public.stint_plan_save(uuid, text, jsonb, integer)', 'execute') then 'ja' else 'NEIN' end
union all
select 'Live-Abgleich',
       case when exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'stint_plans')
            then 'aktiv' else 'ohne Live-Abgleich (Realtime fehlt)' end;
