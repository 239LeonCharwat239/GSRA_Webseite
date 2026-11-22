-- =========================================================
-- GSRA 039 – Setup-Zähler geschützt, Download-Zähler (22.11.)
--  * SICHERHEIT: Likes und Dislikes eines Setups ließen sich vom Eigentümer direkt setzen (beim Hochladen oder
--    Bearbeiten des eigenen Setups). Damit hätte jemand die 25 Setup-Punkte für die Coach-Lizenz erreichen können.
--    Ab jetzt ändern nur noch die Datenbank-Funktionen die Zähler (vote_setup, setup_register_download);
--    direkte Werte von der Webseite werden beim Hochladen auf 0 gesetzt und beim Bearbeiten ignoriert.
--  * Download-Zähler: Jede angemeldete Person zählt einmal pro Setup (mehrfaches Herunterladen zählt nicht
--    mehrfach, eigene Downloads zählen nicht, Pro Setups nur mit Berechtigung). Gäste laden weiter herunter,
--    werden aber nicht gezählt.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 006 und 014 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Download-Zähler und Liste, wer schon gezählt wurde
-- ---------------------------------------------------------
alter table public.setups add column if not exists download_count integer not null default 0;

do $$
declare _id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into _id_type
  from pg_attribute a
  where a.attrelid = 'public.setups'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.setup_downloads (
      setup_id   %s not null references public.setups(id) on delete cascade,
      user_id    uuid not null references auth.users(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (setup_id, user_id)
    )$f$, _id_type);
end $$;
create index if not exists setup_downloads_user_idx on public.setup_downloads (user_id);
-- Kein direkter Zugriff: Die Liste wird nur von der Funktion unten geschrieben und gelesen
alter table public.setup_downloads enable row level security;
revoke all on public.setup_downloads from anon, authenticated;

-- ---------------------------------------------------------
-- 2) Zähler schützen
--    Läuft mit den Rechten des Aufrufers: Direkte Änderungen über die Webseite kommen als Rolle
--    „authenticated“ bzw. „anon“ an, die Datenbank-Funktionen laufen als Eigentümer und dürfen zählen.
-- ---------------------------------------------------------
create or replace function public.setups_protect_counters()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.likes := 0;
      new.dislikes := 0;
      new.download_count := 0;
    else
      new.likes := old.likes;
      new.dislikes := old.dislikes;
      new.download_count := old.download_count;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.setups_protect_counters() from public, anon, authenticated;

drop trigger if exists setups_protect_counters on public.setups;
create trigger setups_protect_counters
  before insert or update on public.setups
  for each row execute function public.setups_protect_counters();

-- ---------------------------------------------------------
-- 3) Download zählen (gibt den neuen Stand zurück; Gäste: null)
-- ---------------------------------------------------------
create or replace function public.setup_register_download(_setup_id text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _owner  text;
  _is_pro boolean;
  _count  integer;
  _neu    integer;
begin
  if auth.uid() is null then return null; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;

  select s.uploader_id::text, coalesce(s.is_pro, false), coalesce(s.download_count, 0)
    into _owner, _is_pro, _count
  from public.setups s where s.id::text = _setup_id;
  if not found then raise exception 'Dieses Setup gibt es nicht mehr.'; end if;

  -- Eigene Downloads zählen nicht
  if _owner = auth.uid()::text then return _count; end if;
  -- Pro Setups zählen nur bei Personen, die sie auch herunterladen dürfen
  if _is_pro and not public.can_see_pro(auth.uid()) then
    raise exception 'Pro Setups laden nur Abonnenten herunter.';
  end if;

  insert into public.setup_downloads (setup_id, user_id)
  select s.id, auth.uid() from public.setups s where s.id::text = _setup_id
  on conflict (setup_id, user_id) do nothing;
  get diagnostics _neu = row_count;

  if _neu > 0 then
    update public.setups s set download_count = coalesce(s.download_count, 0) + 1
    where s.id::text = _setup_id
    returning s.download_count into _count;
  end if;
  return _count;
end;
$$;
revoke execute on function public.setup_register_download(text) from public, anon;
grant execute on function public.setup_register_download(text) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „bereit“, dann eine Zahl zur Info)
-- ---------------------------------------------------------
select 'Zähler geschützt (Likes, Dislikes, Downloads nur über Funktionen)' as pruefung,
       case when exists (select 1 from pg_trigger where tgrelid = 'public.setups'::regclass
                           and tgname = 'setups_protect_counters' and not tgisinternal)
             and not (select prosecdef from pg_proc where oid = 'public.setups_protect_counters()'::regprocedure)
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Download-Zähler (Liste geschützt, Funktion nur für Angemeldete)',
       case when (select relrowsecurity from pg_class where oid = 'public.setup_downloads'::regclass)
             and not has_table_privilege('authenticated', 'public.setup_downloads', 'select')
             and has_function_privilege('authenticated', 'public.setup_register_download(text)', 'execute')
             and not has_function_privilege('anon', 'public.setup_register_download(text)', 'execute')
            then 'bereit' else 'FEHLT' end
union all
-- Nur zur Info: Setups mit mehr Likes als abgegebenen Daumen-hoch-Stimmen (ältere Stimmen von vor 006 –
-- oder ein früher selbst gesetzter Wert; bei Auffälligkeiten im Admin-Bereich ansehen)
select 'Info: Setups mit mehr Likes als Stimmen',
       (select count(*)::text from public.setups s
         where coalesce(s.likes, 0) > (select count(*) from public.setup_votes v where v.setup_id = s.id and v.vote = 1));
