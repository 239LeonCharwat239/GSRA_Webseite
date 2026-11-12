-- =========================================================
-- GSRA Setup Hub: alle Simulationen mit passenden Dateiformaten, Setups ohne Datei (Werte/Screenshots),
-- Pro Setups nur für Abonnenten (Pole/Alliance). Voraussetzung: gsra_sicherheit_1.sql und gsra_zahlungen_1.sql.
-- Einmal komplett im SQL Editor ausführen (darf mehrfach laufen).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Neue Angaben zu Setups
-- ---------------------------------------------------------
alter table public.setups add column if not exists created_at  timestamptz default now();
alter table public.setups add column if not exists is_pro      boolean not null default false;
alter table public.setups add column if not exists setup_type  text;
alter table public.setups add column if not exists description text;

-- Erlaubte Dateiendung je Simulation ('' = keine Datei, nur Werte/Screenshots; null = unbekannte/alte Angabe)
create or replace function public.setup_allowed_ext(_sim text)
returns text
language sql
immutable
as $$
  select case _sim
    when 'iRacing' then 'sto'
    when 'ACC' then 'json'
    when 'Assetto Corsa' then 'ini'
    when 'Assetto Corsa EVO' then 'ini'
    when 'Le Mans Ultimate' then 'svm'
    when 'rFactor 2' then 'svm'
    when 'Automobilista 2' then 'svm'
    when 'RaceRoom' then 'usr'
    when 'Rennsport' then 'json'
    when 'BeamNG.drive' then 'pc'
    when 'Richard Burns Rally' then 'ini'
    when 'F1 23' then ''
    when 'F1 24' then ''
    when 'F1 25' then ''
    when 'F1 26' then ''
    when 'EA SPORTS WRC' then ''
    when 'DiRT Rally 2.0' then ''
    else null
  end;
$$;

-- ---------------------------------------------------------
-- 2) Pro-Fahrer (von der GSRA bezahlt): nur sie und Website-Admins veröffentlichen Pro Setups
-- ---------------------------------------------------------
create table if not exists public.pro_creators (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now()
);
alter table public.pro_creators enable row level security;

drop policy if exists "GSRA: Pro-Fahrer lesen" on public.pro_creators;
create policy "GSRA: Pro-Fahrer lesen" on public.pro_creators
  for select to anon, authenticated using (true);
drop policy if exists "GSRA: Pro-Fahrer verwalten (Admins)" on public.pro_creators;
create policy "GSRA: Pro-Fahrer verwalten (Admins)" on public.pro_creators
  for all to authenticated using ((select public.is_site_admin())) with check ((select public.is_site_admin()));

create or replace function public.is_pro_creator(_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.pro_creators where user_id = _user);
$$;

-- Darf jemand Pro-Inhalte sehen? (Pole, Alliance, Pro-Fahrer, Website-Admins)
create or replace function public.can_see_pro(_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select _user is not null and (public.plan_of(_user) in ('pole', 'alliance') or public.is_pro_creator(_user)
         or exists (select 1 from public.profiles p where p.id = _user and p.role = 'admin'));
$$;

-- ---------------------------------------------------------
-- 3) Prüfungen beim Hochladen: richtige Dateiendung je Simulation, Pro nur für Pro-Fahrer
-- ---------------------------------------------------------
-- Download-Link: wenn vorhanden, nur https (Setups ohne Datei und Pro Setups haben keinen öffentlichen Link)
create or replace function public.setups_https_only()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.file_url is not null and new.file_url !~* '^https://' then
    raise exception 'Der Download-Link muss mit https:// beginnen.';
  end if;
  return new;
end;
$$;

create or replace function public.setups_validate()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  _ext text := public.setup_allowed_ext(new.simulation);
begin
  if new.is_pro and (tg_op = 'INSERT' or not old.is_pro) and auth.uid() is not null
     and not (public.is_pro_creator(auth.uid()) or public.is_site_admin()) then
    raise exception 'Pro Setups können nur GSRA-Pro-Fahrer veröffentlichen.';
  end if;
  if tg_op = 'INSERT' and _ext is not null then
    if _ext = '' then
      if new.file_url is not null or new.file_name is not null then
        raise exception 'Für % gibt es keine Setup-Datei – bitte trage die Werte ein oder lade Screenshots hoch.', new.simulation;
      end if;
    elsif new.file_name is null or lower(new.file_name) !~ ('\.' || _ext || '$') then
      raise exception 'Für % sind nur .%-Dateien erlaubt.', new.simulation, _ext;
    elsif not new.is_pro and new.file_url is null then
      raise exception 'Die Setup-Datei fehlt.';
    elsif new.is_pro and new.file_url is not null then
      raise exception 'Pro Setups werden nicht öffentlich verlinkt.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists setups_validate on public.setups;
create trigger setups_validate
  before insert or update of is_pro on public.setups
  for each row execute function public.setups_validate();

-- ---------------------------------------------------------
-- 4) Inhalte, die nicht jeder sehen darf: Werte (Spiele ohne Datei), Screenshots, Pfad der Pro-Datei
--    Bei Pro Setups nur für Abonnenten, Pro-Fahrer, den Ersteller und Admins lesbar.
-- ---------------------------------------------------------
do $$
declare _id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into _id_type
  from pg_attribute a where a.attrelid = 'public.setups'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.setup_contents (
      setup_id      %s primary key references public.setups(id) on delete cascade,
      manual_values text,
      screenshots   text[] not null default '{}',
      pro_file_path text
    )$f$, _id_type);
end $$;
alter table public.setup_contents enable row level security;

drop policy if exists "GSRA: Setup-Inhalte lesen" on public.setup_contents;
create policy "GSRA: Setup-Inhalte lesen" on public.setup_contents
  for select to authenticated
  using (exists (select 1 from public.setups s where s.id = setup_id
                 and (not s.is_pro or s.uploader_id::text = (select auth.uid())::text or (select public.can_see_pro(auth.uid())))));

drop policy if exists "GSRA: Eigene Setup-Inhalte schreiben" on public.setup_contents;
create policy "GSRA: Eigene Setup-Inhalte schreiben" on public.setup_contents
  for all to authenticated
  using (exists (select 1 from public.setups s where s.id = setup_id
                 and (s.uploader_id::text = (select auth.uid())::text or (select public.is_site_admin()))))
  with check (exists (select 1 from public.setups s where s.id = setup_id
                      and (s.uploader_id::text = (select auth.uid())::text or (select public.is_site_admin()))));

-- ---------------------------------------------------------
-- 5) Privater Speicher für Pro Setups (Dateien und Screenshots), Download nur über zeitlich begrenzte Links
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('setups-pro', 'setups-pro', false, 5242880)
on conflict (id) do update set public = false, file_size_limit = 5242880;

drop policy if exists "GSRA Pro Setups lesen" on storage.objects;
create policy "GSRA Pro Setups lesen" on storage.objects
  for select to authenticated
  using (bucket_id = 'setups-pro' and ((storage.foldername(name))[1] = auth.uid()::text or (select public.can_see_pro(auth.uid()))));

drop policy if exists "GSRA Pro Setups hochladen" on storage.objects;
create policy "GSRA Pro Setups hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'setups-pro' and (storage.foldername(name))[1] = auth.uid()::text
              and ((select public.is_pro_creator(auth.uid())) or (select public.is_site_admin())));

drop policy if exists "GSRA Pro Setups löschen" on storage.objects;
create policy "GSRA Pro Setups löschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'setups-pro' and ((storage.foldername(name))[1] = auth.uid()::text or (select public.is_site_admin())));

-- Einschränkend (gilt zusätzlich zu allen anderen Regeln): Pro-Dateien sieht wirklich nur, wer darf
drop policy if exists "GSRA Pro Setups nur für Abonnenten" on storage.objects;
create policy "GSRA Pro Setups nur für Abonnenten" on storage.objects
  as restrictive for select
  using (bucket_id <> 'setups-pro' or (storage.foldername(name))[1] = auth.uid()::text or (select public.can_see_pro(auth.uid())));

drop policy if exists "GSRA Pro Setups nur Pro-Fahrer laden hoch" on storage.objects;
create policy "GSRA Pro Setups nur Pro-Fahrer laden hoch" on storage.objects
  as restrictive for insert
  with check (bucket_id <> 'setups-pro' or ((storage.foldername(name))[1] = auth.uid()::text
              and ((select public.is_pro_creator(auth.uid())) or (select public.is_site_admin()))));

-- ---------------------------------------------------------
-- 6) Ausführen nur für die Seite freigeben
-- ---------------------------------------------------------
revoke execute on function public.is_pro_creator(uuid) from public;
grant execute on function public.is_pro_creator(uuid) to anon, authenticated;
revoke execute on function public.can_see_pro(uuid) from public;
grant execute on function public.can_see_pro(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 7) Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Setup Hub: Formate und Pro Setups' as pruefung,
       case when to_regclass('public.setup_contents') is not null and to_regclass('public.pro_creators') is not null
             and exists (select 1 from pg_trigger where tgname = 'setups_validate')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Privater Speicher für Pro Setups',
       case when exists (select 1 from storage.buckets where id = 'setups-pro' and not public)
            then 'bereit (privat)' else 'FEHLT' end;
