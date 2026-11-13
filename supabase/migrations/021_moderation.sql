-- =========================================================
-- GSRA 021 – Moderator-Rolle und Protokoll aller Moderations- und Admin-Aktionen (Maßnahme 13, 13.11.)
-- Rollen: „user“ (Standard), „moderator“, „admin“.
--   Moderatoren: Meldungen ansehen und bearbeiten, verwarnen, bis zu 30 Tage sperren, befristete Sperren aufheben.
--   Admins zusätzlich: dauerhafte Sperren, Rollen vergeben, Events, fremde Inhalte löschen, Protokoll ansehen.
--   Beide brauchen eine Anmeldung mit bestätigtem Zwei-Faktor-Code.
-- Protokoll: Jede Verwarnung, Sperre, Aufhebung, verworfene Meldung, Rollenänderung, gelöschte fremde Inhalte und
--   Event-Änderung wird automatisch festgehalten. Einträge lassen sich über die Webseite weder ändern noch löschen.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Am Ende stehen Kontrollzeilen.
-- =========================================================

-- 1) Moderationsteam: Rolle Moderator oder Admin UND Anmeldung mit bestätigtem Code
create or replace function public.is_moderator()
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin'));
$$;
revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- 2) Rollen kann niemand selbst setzen – auch nicht beim Anlegen des eigenen Profils (bisher nur „admin“ gesperrt)
create or replace function public.profiles_protect_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_site_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.role, 'user') <> 'user' then
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

-- 3) Meldungen bearbeiten: vom Admin auf das ganze Moderationsteam erweitern (Inhalt der Funktionen bleibt gleich)
do $$
declare
  f record;
  _def text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_report_window', 'admin_warn_user', 'admin_ban_user',
                                                 'admin_dismiss_report', 'admin_lift_ban')
  loop
    _def := pg_get_functiondef(f.oid);
    if position('public.is_site_admin()' in _def) > 0 then
      execute replace(replace(_def, 'public.is_site_admin()', 'public.is_moderator()'),
                      'Nur für Administratoren.', 'Nur für das Moderationsteam.');
    end if;
  end loop;

  -- Konto selbst löschen: gesperrt für alle mit Team-Rolle (unabhängig davon, ob der Code gerade bestätigt ist)
  select pg_get_functiondef(p.oid) into _def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'delete_own_account';
  if _def is not null and position('public.is_site_admin()' in _def) > 0 then
    execute replace(replace(_def, 'public.is_site_admin()',
                            'exists (select 1 from public.profiles where id = auth.uid() and role in (''admin'', ''moderator''))'),
                    'Administratoren können ihr Konto nicht selbst löschen – bitte gib die Admin-Rolle vorher ab.',
                    'Admins und Moderatoren können ihr Konto nicht selbst löschen – bitte gib die Rolle vorher ab.');
  end if;
end $$;

-- 4) Das Moderationsteam sieht Meldungen, Verwarnungen und Sperren (zusätzlich zu den bestehenden Regeln)
drop policy if exists "GSRA Moderation sieht Meldungen" on public.reports;
create policy "GSRA Moderation sieht Meldungen" on public.reports
  for select to authenticated using ((select public.is_moderator()));
drop policy if exists "GSRA Moderation sieht Verwarnungen" on public.user_warnings;
create policy "GSRA Moderation sieht Verwarnungen" on public.user_warnings
  for select to authenticated using ((select public.is_moderator()));
drop policy if exists "GSRA Moderation sieht Sperren" on public.user_bans;
create policy "GSRA Moderation sieht Sperren" on public.user_bans
  for select to authenticated using ((select public.is_moderator()));

-- 5) Grenzen für Moderatoren (Admins und SQL Editor sind ausgenommen)
create or replace function public.moderation_ban_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_site_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.banned_until is null or new.banned_until > now() + interval '30 days 1 hour' then
      raise exception 'Dauerhafte Sperren und Sperren über 30 Tage kann nur ein Administrator verhängen.';
    end if;
    if exists (select 1 from public.profiles where id = new.user_id and role in ('admin', 'moderator')) then
      raise exception 'Mitglieder des Moderationsteams kann nur ein Administrator sperren.';
    end if;
  elsif old.lifted_at is null and new.lifted_at is not null and old.banned_until is null then
    raise exception 'Eine dauerhafte Sperre kann nur ein Administrator aufheben.';
  end if;
  return new;
end;
$$;
revoke execute on function public.moderation_ban_rules() from public, anon, authenticated;
drop trigger if exists gsra_moderation_ban_rules on public.user_bans;
create trigger gsra_moderation_ban_rules before insert or update on public.user_bans
  for each row execute function public.moderation_ban_rules();

-- 6) Rollen vergeben (nur Admins): Moderator ernennen oder Rolle entziehen. Admins ernennt nur der SQL Editor.
create or replace function public.admin_set_role(_gsra_id bigint, _role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare _target record;
begin
  if not public.is_site_admin() then raise exception 'Nur für Administratoren.'; end if;
  if _role not in ('user', 'moderator') then raise exception 'Über die Webseite lassen sich nur Moderatoren ernennen oder entfernen.'; end if;
  select id, username, role into _target from public.profiles where gsra_id = _gsra_id;
  if _target.id is null then raise exception 'Zu dieser GSRA-ID gibt es kein Konto.'; end if;
  if _target.id = auth.uid() then raise exception 'Die eigene Rolle lässt sich nicht ändern.'; end if;
  if _target.role = 'admin' then raise exception 'Administratoren lassen sich nur im SQL Editor ändern.'; end if;
  update public.profiles set role = _role where id = _target.id;
  return _target.username;
end;
$$;
revoke execute on function public.admin_set_role(bigint, text) from public, anon;
grant execute on function public.admin_set_role(bigint, text) to authenticated;

-- 7) Protokoll
create table if not exists public.moderation_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid references auth.users(id) on delete set null,   -- leer = SQL Editor bzw. System
  action      text not null,
  target_user uuid references auth.users(id) on delete set null,
  report_id   uuid,
  details     jsonb not null default '{}'::jsonb
);
create index if not exists moderation_log_created_idx on public.moderation_log (created_at desc);
alter table public.moderation_log enable row level security;
-- Lesen nur Admins; Schreiben nur die Datenbank selbst (keine Regel für Einfügen, Ändern oder Löschen)
drop policy if exists "GSRA Admins sehen das Protokoll" on public.moderation_log;
create policy "GSRA Admins sehen das Protokoll" on public.moderation_log
  for select to authenticated using ((select public.is_site_admin()));
revoke insert, update, delete, truncate on public.moderation_log from anon, authenticated;
do $$ begin
  -- Zwei-Faktor-Regel wie bei allen anderen Tabellen (019)
  if exists (select 1 from pg_proc where proname = 'mfa_ok' and pronamespace = 'public'::regnamespace) then
    drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.moderation_log;
    create policy "GSRA Zwei-Faktor erforderlich" on public.moderation_log as restrictive for all to authenticated
      using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
  end if;
end $$;

create or replace function public.moderation_log_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _me uuid := auth.uid();
begin
  -- Spalten nur im Zweig der jeweiligen Tabelle ansprechen (eine Funktion für mehrere Tabellen)
  if tg_table_name = 'user_warnings' then
    insert into public.moderation_log (actor_id, action, target_user, report_id, details)
    values (_me, 'verwarnung', new.user_id, new.report_id, jsonb_build_object('text', left(new.text, 500)));
  elsif tg_table_name = 'user_bans' then
    if tg_op = 'INSERT' then
      insert into public.moderation_log (actor_id, action, target_user, report_id, details)
      values (_me, 'sperre', new.user_id, new.report_id, jsonb_build_object('bis', new.banned_until, 'grund', new.reason));
    elsif old.lifted_at is null and new.lifted_at is not null then
      insert into public.moderation_log (actor_id, action, target_user, report_id, details)
      values (_me, 'sperre_aufgehoben', new.user_id, new.report_id, jsonb_build_object('war_bis', old.banned_until));
    end if;
  elsif tg_table_name = 'reports' then
    if old.status = 'offen' and new.status = 'verworfen' then
      insert into public.moderation_log (actor_id, action, target_user, report_id, details)
      values (_me, 'meldung_verworfen', new.reported_id, new.id, jsonb_build_object('grund', new.reason));
    end if;
  elsif tg_table_name = 'profiles' then
    if old.role is distinct from new.role then
      insert into public.moderation_log (actor_id, action, target_user, details)
      values (_me, 'rolle', new.id, jsonb_build_object('von', old.role, 'nach', new.role));
    end if;
  elsif tg_table_name = 'marketplace' then
    if _me is distinct from old.user_id then
      insert into public.moderation_log (actor_id, action, target_user, details)
      values (_me, 'inserat_geloescht', old.user_id, jsonb_build_object('titel', old.title));
    end if;
  elsif tg_table_name = 'setups' then
    if _me::text is distinct from old.uploader_id::text then
      insert into public.moderation_log (actor_id, action, target_user, details)
      values (_me, 'setup_geloescht', old.uploader_id,
              jsonb_build_object('fahrzeug', old.car_model, 'strecke', old.track_name));
    end if;
  elsif tg_table_name = 'events' then
    if tg_op = 'DELETE' then
      insert into public.moderation_log (actor_id, action, details)
      values (_me, 'event_geloescht', jsonb_build_object('titel', old.title));
    else
      insert into public.moderation_log (actor_id, action, details)
      values (_me, case tg_op when 'INSERT' then 'event_angelegt' else 'event_geaendert' end, jsonb_build_object('titel', new.title));
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.moderation_log_write() from public, anon, authenticated;

drop trigger if exists gsra_moderation_log on public.user_warnings;
create trigger gsra_moderation_log after insert on public.user_warnings for each row execute function public.moderation_log_write();
drop trigger if exists gsra_moderation_log on public.user_bans;
create trigger gsra_moderation_log after insert or update on public.user_bans for each row execute function public.moderation_log_write();
drop trigger if exists gsra_moderation_log on public.reports;
create trigger gsra_moderation_log after update on public.reports for each row execute function public.moderation_log_write();
drop trigger if exists gsra_moderation_log on public.profiles;
create trigger gsra_moderation_log after update on public.profiles for each row execute function public.moderation_log_write();
drop trigger if exists gsra_moderation_log on public.marketplace;
create trigger gsra_moderation_log after delete on public.marketplace for each row execute function public.moderation_log_write();
drop trigger if exists gsra_moderation_log on public.setups;
create trigger gsra_moderation_log after delete on public.setups for each row execute function public.moderation_log_write();
drop trigger if exists gsra_moderation_log on public.events;
create trigger gsra_moderation_log after insert or update or delete on public.events for each row execute function public.moderation_log_write();

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Meldungs-Funktionen für das Moderationsteam' as pruefung,
       count(*) filter (where prosrc like '%is_moderator()%')::text || ' von 5' as ergebnis
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('admin_report_window', 'admin_warn_user', 'admin_ban_user', 'admin_dismiss_report', 'admin_lift_ban')
union all
select 'Tabellen mit Protokoll', count(*)::text || ' von 7'
from pg_trigger where tgname = 'gsra_moderation_log'
union all
select 'Moderatoren / Admins',
       (select count(*) from public.profiles where role = 'moderator')::text || ' / ' ||
       (select count(*) from public.profiles where role = 'admin')::text
union all
select 'Protokoll-Einträge bisher', (select count(*) from public.moderation_log)::text;
