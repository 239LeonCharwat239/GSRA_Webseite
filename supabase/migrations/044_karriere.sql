-- =========================================================
-- GSRA 044 – Karriere-Timeline im Profil (23.11.)
--  * Mitglieder tragen ihre Stationen selbst ein: Teams, Meisterschaften, Erfolge, Rennen, Lizenzen, Sonstiges –
--    jeweils mit Jahr (optional Monat), Titel, kurzer Beschreibung und optional einem https-Link.
--  * Dazu automatische Meilensteine, die niemand fälschen kann: Mitglied seit, erstes geteiltes Setup,
--    GSRA-Coach seit, Pro-Fahrer, Unterstützer seit (nur wenn die Person ihre Unterstützung öffentlich zeigt).
--  * Lesen: alle angemeldeten Mitglieder (wie Profile). Schreiben: nur die eigenen Einträge, nicht mit gesperrtem
--    Konto, höchstens 40 Einträge, Texte begrenzt, Links nur https.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 006, 014, 026 und 043 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Tabelle und Regeln
-- ---------------------------------------------------------
create table if not exists public.career_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year       smallint not null check (year between 1950 and 2100),
  month      smallint check (month between 1 and 12),
  kind       text not null check (kind in ('team', 'meisterschaft', 'erfolg', 'rennen', 'lizenz', 'sonstiges')),
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  detail     text check (detail is null or char_length(detail) <= 300),
  link       text check (link is null or (char_length(link) between 11 and 300 and link ~ '^https://[^[:space:]<>"''`]+$')),
  created_at timestamptz not null default now()
);
create index if not exists career_entries_user_idx on public.career_entries (user_id, year desc, month desc nulls last);

alter table public.career_entries enable row level security;
revoke all on public.career_entries from anon, authenticated;
grant select, insert, update, delete on public.career_entries to authenticated;

drop policy if exists "GSRA: Karriere lesen" on public.career_entries;
create policy "GSRA: Karriere lesen" on public.career_entries
  for select to authenticated using (true);

drop policy if exists "GSRA: Eigene Karriere anlegen" on public.career_entries;
create policy "GSRA: Eigene Karriere anlegen" on public.career_entries
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "GSRA: Eigene Karriere ändern" on public.career_entries;
create policy "GSRA: Eigene Karriere ändern" on public.career_entries
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "GSRA: Eigene Karriere löschen" on public.career_entries;
create policy "GSRA: Eigene Karriere löschen" on public.career_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- Gesperrte Konten schreiben nichts (zusätzliche, einschränkende Regel)
drop policy if exists "GSRA: Karriere nicht mit gesperrtem Konto" on public.career_entries;
create policy "GSRA: Karriere nicht mit gesperrtem Konto" on public.career_entries
  as restrictive for insert to authenticated with check (not (select public.is_banned()));
drop policy if exists "GSRA: Karriere nicht ändern mit gesperrtem Konto" on public.career_entries;
create policy "GSRA: Karriere nicht ändern mit gesperrtem Konto" on public.career_entries
  as restrictive for update to authenticated using (not (select public.is_banned()));

-- Höchstens 40 Einträge pro Person; Texte ohne Steuerzeichen und ohne führende/folgende Leerzeichen
create or replace function public.career_entries_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.title := btrim(regexp_replace(new.title, '[[:cntrl:]]', ' ', 'g'));
  new.detail := nullif(btrim(regexp_replace(coalesce(new.detail, ''), '[[:cntrl:]]', ' ', 'g')), '');
  new.link := nullif(btrim(coalesce(new.link, '')), '');
  if tg_op = 'INSERT' and (select count(*) from public.career_entries c where c.user_id = new.user_id) >= 40 then
    raise exception 'Du hast schon 40 Karriere-Einträge. Lösche einen älteren, um einen neuen hinzuzufügen.';
  end if;
  if tg_op = 'UPDATE' then new.user_id := old.user_id; new.created_at := old.created_at; end if;
  return new;
end;
$$;
revoke execute on function public.career_entries_guard() from public, anon, authenticated;
drop trigger if exists career_entries_guard on public.career_entries;
create trigger career_entries_guard before insert or update on public.career_entries
  for each row execute function public.career_entries_guard();

-- ---------------------------------------------------------
-- 2) Automatische Meilensteine (nur öffentliche Tatsachen, keine Beträge)
-- ---------------------------------------------------------
create or replace function public.career_milestones(_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _out jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or _user is null then return _out; end if;
  _out := jsonb_build_object(
    'mitglied_seit', (select u.created_at from auth.users u where u.id = _user),
    'erstes_setup', (select min(s.created_at) from public.setups s where s.uploader_id = _user),
    'setups', (select count(*) from public.setups s where s.uploader_id = _user),
    'coach_seit', (select l.granted_at from public.coach_licenses l
                   where l.user_id = _user and l.granted_at is not null and l.revoked_at is null),
    'pro_fahrer', coalesce(public.is_pro_creator(_user), false));
  -- Unterstützung nur, wenn die Person sie selbst öffentlich zeigt (SQL 043)
  if to_regclass('public.supporters') is not null then
    _out := _out || jsonb_build_object('unterstuetzer_seit',
      (select s.since from public.supporters s where s.user_id = _user and s.show_public and s.since is not null));
  end if;
  return _out;
end;
$$;
revoke execute on function public.career_milestones(uuid) from public, anon;
grant execute on function public.career_milestones(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „ja“, „ja“)
-- ---------------------------------------------------------
select 'Karriere-Tabelle und Meilensteine' as pruefung,
       case when to_regclass('public.career_entries') is not null and to_regprocedure('public.career_milestones(uuid)') is not null
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Gäste lesen und schreiben nichts',
       case when not has_table_privilege('anon', 'public.career_entries', 'select')
             and not has_table_privilege('anon', 'public.career_entries', 'insert')
             and not has_function_privilege('anon', 'public.career_milestones(uuid)', 'execute') then 'ja' else 'NEIN' end
union all
select 'Schutzregeln aktiv',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'career_entries') = 6
             and exists (select 1 from pg_trigger where tgname = 'career_entries_guard') then 'ja' else 'NEIN' end;
