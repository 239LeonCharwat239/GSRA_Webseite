-- =========================================================
-- GSRA: Jeder Benutzername nur einmal (Groß-/Kleinschreibung egal)
-- Gilt für neue Konten und Namensänderungen. Bereits doppelte Namen bleiben bestehen,
-- bis die betroffenen Personen ihren Namen ändern.
-- Einmal komplett im Supabase SQL Editor ausführen (darf auch mehrfach laufen).
-- =========================================================

-- Schnelle Suche nach Namen (auch bei sehr vielen Nutzern)
create index if not exists profiles_username_lower_idx on public.profiles (lower(btrim(username)));

create or replace function public.profiles_username_unique()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.username is null or btrim(new.username) = '' then
    return new;
  end if;
  -- „Anlegen oder ändern“ eines bestehenden Profils: geprüft wird erst beim Ändern
  if tg_op = 'INSERT' and exists (select 1 from public.profiles p where p.id = new.id) then
    return new;
  end if;
  -- Name nicht geändert (oder nur Groß-/Kleinschreibung): nichts zu prüfen
  if tg_op = 'UPDATE' and lower(btrim(new.username)) = lower(btrim(coalesce(old.username, ''))) then
    return new;
  end if;
  -- Gleichzeitige Anmeldungen mit demselben Namen nacheinander prüfen
  perform pg_advisory_xact_lock(hashtext('gsra_username:' || lower(btrim(new.username))));
  if exists (select 1 from public.profiles p
             where lower(btrim(p.username)) = lower(btrim(new.username)) and p.id <> new.id) then
    raise exception 'Dieser Benutzername ist bereits vergeben.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_username_unique on public.profiles;
create trigger trg_profiles_username_unique
  before insert or update of username on public.profiles
  for each row execute function public.profiles_username_unique();

-- Für die Registrierung: ist der Name noch frei?
create or replace function public.username_available(_name text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select not exists (select 1 from public.profiles p where lower(btrim(p.username)) = lower(btrim(_name)));
$$;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Eindeutige Namen' as pruefung,
       case when exists (select 1 from pg_trigger where tgname = 'trg_profiles_username_unique' and tgrelid = 'public.profiles'::regclass)
                 and to_regprocedure('public.username_available(text)') is not null
            then 'aktiv' else 'FEHLT' end as ergebnis
union all
select 'Bereits doppelte Namen (bleiben bestehen)',
       coalesce((select string_agg(d.name || ' (' || d.n || '×)', ', ' order by d.name)
                 from (select min(username) as name, count(*) as n from public.profiles
                       where username is not null and btrim(username) <> ''
                       group by lower(btrim(username)) having count(*) > 1) d), 'keine');
