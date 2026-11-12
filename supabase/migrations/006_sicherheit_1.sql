-- =========================================================
-- GSRA Sicherheits-Härtung: Marktplatz, Setups, Rennkalender und Dateispeicher
-- Bestehende Regeln bleiben erhalten. Zusätzliche „einschränkende“ Regeln legen fest, wer anlegen,
-- ändern und löschen darf – egal, was bisher eingestellt war.
-- Einmal komplett im Supabase SQL Editor ausführen (darf auch mehrfach laufen).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Marktplatz: alle dürfen lesen, nur Eigentümer (und Website-Admins) ändern und löschen
-- ---------------------------------------------------------
alter table public.marketplace enable row level security;

drop policy if exists "GSRA: Inserate lesen" on public.marketplace;
create policy "GSRA: Inserate lesen" on public.marketplace
  for select to anon, authenticated using (true);

drop policy if exists "GSRA: Eigene Inserate anlegen" on public.marketplace;
create policy "GSRA: Eigene Inserate anlegen" on public.marketplace
  for insert to authenticated with check (user_id::text = auth.uid()::text);

drop policy if exists "GSRA: Eigene Inserate ändern" on public.marketplace;
create policy "GSRA: Eigene Inserate ändern" on public.marketplace
  for update to authenticated
  using (user_id::text = auth.uid()::text or (select public.is_site_admin()))
  with check (user_id::text = auth.uid()::text or (select public.is_site_admin()));

drop policy if exists "GSRA: Eigene Inserate löschen" on public.marketplace;
create policy "GSRA: Eigene Inserate löschen" on public.marketplace
  for delete to authenticated using (user_id::text = auth.uid()::text or (select public.is_site_admin()));

-- Einschränkend (gilt zusätzlich zu allen anderen Regeln, auch zu älteren, offeneren)
drop policy if exists "GSRA: Inserate nur vom Eigentümer anlegen" on public.marketplace;
create policy "GSRA: Inserate nur vom Eigentümer anlegen" on public.marketplace
  as restrictive for insert with check (user_id::text = auth.uid()::text);

drop policy if exists "GSRA: Inserate nur vom Eigentümer ändern" on public.marketplace;
create policy "GSRA: Inserate nur vom Eigentümer ändern" on public.marketplace
  as restrictive for update
  using (user_id::text = auth.uid()::text or (select public.is_site_admin()))
  with check (user_id::text = auth.uid()::text or (select public.is_site_admin()));

drop policy if exists "GSRA: Inserate nur vom Eigentümer löschen" on public.marketplace;
create policy "GSRA: Inserate nur vom Eigentümer löschen" on public.marketplace
  as restrictive for delete using (user_id::text = auth.uid()::text or (select public.is_site_admin()));

-- ---------------------------------------------------------
-- 2) Setups: alle dürfen lesen, nur Eigentümer (und Website-Admins) ändern und löschen.
--    Abstimmen nur noch über die Funktion vote_setup – eine Stimme pro Person.
-- ---------------------------------------------------------
alter table public.setups enable row level security;

-- Spalten, die die Setups-Seite verwendet: fehlende werden ergänzt, vorhandene bleiben unverändert
-- (in eurer Datenbank fehlte z. B. uploader_id – daran sind Uploads und das Konto-Löschen gescheitert)
alter table public.setups add column if not exists uploader_id uuid default auth.uid();
alter table public.setups add column if not exists simulation  text;
alter table public.setups add column if not exists car_model   text;
alter table public.setups add column if not exists track_name  text;
alter table public.setups add column if not exists file_url    text;
alter table public.setups add column if not exists file_name   text;
alter table public.setups add column if not exists likes       integer default 0;
alter table public.setups add column if not exists dislikes    integer default 0;

drop policy if exists "GSRA: Setups lesen" on public.setups;
create policy "GSRA: Setups lesen" on public.setups
  for select to anon, authenticated using (true);

drop policy if exists "GSRA: Eigene Setups hochladen" on public.setups;
create policy "GSRA: Eigene Setups hochladen" on public.setups
  for insert to authenticated with check (uploader_id::text = auth.uid()::text);

drop policy if exists "GSRA: Eigene Setups ändern" on public.setups;
create policy "GSRA: Eigene Setups ändern" on public.setups
  for update to authenticated
  using (uploader_id::text = auth.uid()::text or (select public.is_site_admin()))
  with check (uploader_id::text = auth.uid()::text or (select public.is_site_admin()));

drop policy if exists "GSRA: Eigene Setups löschen" on public.setups;
create policy "GSRA: Eigene Setups löschen" on public.setups
  for delete to authenticated using (uploader_id::text = auth.uid()::text or (select public.is_site_admin()));

drop policy if exists "GSRA: Setups nur vom Eigentümer hochladen" on public.setups;
create policy "GSRA: Setups nur vom Eigentümer hochladen" on public.setups
  as restrictive for insert with check (uploader_id::text = auth.uid()::text);

drop policy if exists "GSRA: Setups nur vom Eigentümer ändern" on public.setups;
create policy "GSRA: Setups nur vom Eigentümer ändern" on public.setups
  as restrictive for update
  using (uploader_id::text = auth.uid()::text or (select public.is_site_admin()))
  with check (uploader_id::text = auth.uid()::text or (select public.is_site_admin()));

drop policy if exists "GSRA: Setups nur vom Eigentümer löschen" on public.setups;
create policy "GSRA: Setups nur vom Eigentümer löschen" on public.setups
  as restrictive for delete using (uploader_id::text = auth.uid()::text or (select public.is_site_admin()));

-- Download-Links nur als echte https-Adressen (gilt für neue Setups und geänderte Links;
-- ältere Einträge bleiben unverändert und lassen sich weiter bewerten)
create or replace function public.setups_https_only()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.file_url is null or new.file_url !~* '^https://' then
    raise exception 'Der Download-Link muss mit https:// beginnen.';
  end if;
  return new;
end;
$$;

drop trigger if exists setups_https_only on public.setups;
create trigger setups_https_only
  before insert or update of file_url on public.setups
  for each row execute function public.setups_https_only();

-- Stimmen: eine pro Person und Setup (Spaltentyp passend zu setups.id)
do $$
declare _id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into _id_type
  from pg_attribute a
  where a.attrelid = 'public.setups'::regclass and a.attname = 'id';
  execute format($f$
    create table if not exists public.setup_votes (
      setup_id   %s not null references public.setups(id) on delete cascade,
      user_id    uuid not null references auth.users(id) on delete cascade,
      vote       smallint not null check (vote in (-1, 1)),
      created_at timestamptz not null default now(),
      primary key (setup_id, user_id)
    )$f$, _id_type);
end $$;
create index if not exists setup_votes_user_idx on public.setup_votes (user_id);
alter table public.setup_votes enable row level security;

drop policy if exists "GSRA: Eigene Stimmen sehen" on public.setup_votes;
create policy "GSRA: Eigene Stimmen sehen" on public.setup_votes
  for select to authenticated using (user_id = (select auth.uid()));

-- _vote: 1 = Daumen hoch, -1 = Daumen runter, 0 = Stimme zurücknehmen
create or replace function public.vote_setup(_setup_id text, _vote integer)
returns table (new_likes integer, new_dislikes integer, my_vote integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _owner text;
  _old   integer;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an, um abzustimmen.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _vote is null or _vote not in (-1, 0, 1) then raise exception 'Ungültige Stimme.'; end if;

  select s.uploader_id::text into _owner from public.setups s where s.id::text = _setup_id;
  if not found then raise exception 'Dieses Setup gibt es nicht mehr.'; end if;
  if _owner = auth.uid()::text then raise exception 'Eigene Setups kannst du nicht bewerten.'; end if;

  select v.vote into _old
  from public.setup_votes v join public.setups s on s.id = v.setup_id
  where s.id::text = _setup_id and v.user_id = auth.uid();
  _old := coalesce(_old, 0);

  if _old <> _vote then
    -- Zähler anpassen (bisherige Stimmen bleiben erhalten, jede Person zählt ab jetzt nur einmal)
    update public.setups s set
      likes    = greatest(0, coalesce(s.likes, 0) + (case when _vote = 1 then 1 else 0 end) - (case when _old = 1 then 1 else 0 end)),
      dislikes = greatest(0, coalesce(s.dislikes, 0) + (case when _vote = -1 then 1 else 0 end) - (case when _old = -1 then 1 else 0 end))
    where s.id::text = _setup_id;

    if _vote = 0 then
      delete from public.setup_votes v using public.setups s
      where s.id = v.setup_id and s.id::text = _setup_id and v.user_id = auth.uid();
    else
      insert into public.setup_votes (setup_id, user_id, vote)
      select s.id, auth.uid(), _vote from public.setups s where s.id::text = _setup_id
      on conflict (setup_id, user_id) do update set vote = excluded.vote, created_at = now();
    end if;
  end if;

  return query
  select coalesce(s.likes, 0)::integer, coalesce(s.dislikes, 0)::integer, _vote
  from public.setups s where s.id::text = _setup_id;
end;
$$;

-- ---------------------------------------------------------
-- 3) Rennkalender: nur angemeldete Nutzer sehen Events (wegen der Server-Passwörter),
--    anlegen, ändern und löschen nur Website-Admins
-- ---------------------------------------------------------
alter table public.events enable row level security;

drop policy if exists "GSRA: Events lesen" on public.events;
create policy "GSRA: Events lesen" on public.events
  for select to authenticated using (true);

drop policy if exists "GSRA: Events nur für Angemeldete" on public.events;
create policy "GSRA: Events nur für Angemeldete" on public.events
  as restrictive for select to anon using (false);

drop policy if exists "GSRA: Events anlegen (Admins)" on public.events;
create policy "GSRA: Events anlegen (Admins)" on public.events
  for insert to authenticated with check ((select public.is_site_admin()));

drop policy if exists "GSRA: Events ändern (Admins)" on public.events;
create policy "GSRA: Events ändern (Admins)" on public.events
  for update to authenticated using ((select public.is_site_admin())) with check ((select public.is_site_admin()));

drop policy if exists "GSRA: Events löschen (Admins)" on public.events;
create policy "GSRA: Events löschen (Admins)" on public.events
  for delete to authenticated using ((select public.is_site_admin()));

drop policy if exists "GSRA: Events nur von Admins anlegen" on public.events;
create policy "GSRA: Events nur von Admins anlegen" on public.events
  as restrictive for insert with check ((select public.is_site_admin()));

drop policy if exists "GSRA: Events nur von Admins ändern" on public.events;
create policy "GSRA: Events nur von Admins ändern" on public.events
  as restrictive for update using ((select public.is_site_admin())) with check ((select public.is_site_admin()));

drop policy if exists "GSRA: Events nur von Admins löschen" on public.events;
create policy "GSRA: Events nur von Admins löschen" on public.events
  as restrictive for delete using ((select public.is_site_admin()));

-- ---------------------------------------------------------
-- 4) Gesperrte Konten: kein Zugriff auf Marktplatz, Setups, Stimmen und Kalender
-- ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['marketplace', 'setups', 'setup_votes', 'events'] loop
    execute format('drop policy if exists %I on public.%I', 'Gesperrte Konten haben keinen Zugriff', t);
    execute format('create policy %I on public.%I as restrictive for all to authenticated
                      using (not (select public.is_banned())) with check (not (select public.is_banned()))',
                   'Gesperrte Konten haben keinen Zugriff', t);
  end loop;
end $$;

-- ---------------------------------------------------------
-- 5) Dateispeicher: Bilder und Setup-Dateien nur in den eigenen Ordner (<Nutzer-ID>/…),
--    Bilder im Marktplatz höchstens 8 MB (JPEG, PNG, WebP), Setup-Dateien höchstens 5 MB
-- ---------------------------------------------------------
update storage.buckets
set file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'marketplace';

update storage.buckets
set file_size_limit = 5242880
where id = 'setups';

drop policy if exists "GSRA Marktplatz und Setups hochladen" on storage.objects;
create policy "GSRA Marktplatz und Setups hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('marketplace', 'setups') and (storage.foldername(name))[1] = auth.uid()::text
              and not (select public.is_banned()));

drop policy if exists "GSRA Marktplatz und Setups eigene Dateien löschen" on storage.objects;
create policy "GSRA Marktplatz und Setups eigene Dateien löschen" on storage.objects
  for delete to authenticated
  using (bucket_id in ('marketplace', 'setups') and (storage.foldername(name))[1] = auth.uid()::text);

-- Einschränkend: in diesen beiden Speichern nur im eigenen Ordner hochladen, ersetzen oder löschen
-- (alle anderen Speicher wie Profilbilder und Chat-Anhänge bleiben unberührt)
drop policy if exists "GSRA Marktplatz und Setups nur eigener Ordner (hochladen)" on storage.objects;
create policy "GSRA Marktplatz und Setups nur eigener Ordner (hochladen)" on storage.objects
  as restrictive for insert
  with check (bucket_id not in ('marketplace', 'setups') or (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "GSRA Marktplatz und Setups nur eigener Ordner (ersetzen)" on storage.objects;
create policy "GSRA Marktplatz und Setups nur eigener Ordner (ersetzen)" on storage.objects
  as restrictive for update
  using (bucket_id not in ('marketplace', 'setups') or (storage.foldername(name))[1] = auth.uid()::text or (select public.is_site_admin()))
  with check (bucket_id not in ('marketplace', 'setups') or (storage.foldername(name))[1] = auth.uid()::text or (select public.is_site_admin()));

drop policy if exists "GSRA Marktplatz und Setups nur eigener Ordner (löschen)" on storage.objects;
create policy "GSRA Marktplatz und Setups nur eigener Ordner (löschen)" on storage.objects
  as restrictive for delete
  using (bucket_id not in ('marketplace', 'setups') or (storage.foldername(name))[1] = auth.uid()::text or (select public.is_site_admin()));

-- ---------------------------------------------------------
-- 6) Funktionen nur für angemeldete Nutzer freigeben
-- ---------------------------------------------------------
revoke execute on function public.vote_setup(text, integer) from public, anon;
grant execute on function public.vote_setup(text, integer) to authenticated;

-- Schnittstelle sofort über die neuen Spalten und Funktionen informieren
notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 7) Kontrolle (ändert nichts): alle Regeln der drei Bereiche und des Dateispeichers
-- ---------------------------------------------------------
select 'RLS aktiv' as pruefung,
       (select string_agg(c.relname || ': ' || case when c.relrowsecurity then 'ja' else 'NEIN' end, ', ' order by c.relname)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname in ('marketplace', 'setups', 'setup_votes', 'events')) as ergebnis
union all
select 'Spalten setups (Pflicht = muss beim Hochladen gefüllt sein)',
       (select string_agg(col.column_name || case when col.is_nullable = 'NO' and col.column_default is null and col.is_identity = 'NO' then ' (Pflicht)' else '' end,
                          ', ' order by col.ordinal_position)
        from information_schema.columns col
        where col.table_schema = 'public' and col.table_name = 'setups')
union all
select 'Setups: Abstimmen und Download',
       case when to_regprocedure('public.vote_setup(text, integer)') is not null and to_regclass('public.setup_votes') is not null
            then 'eine Stimme pro Person: bereit' else 'Abstimmen: FEHLT' end
       || ' · ' ||
       case when exists (select 1 from pg_trigger where tgname = 'setups_https_only' and tgrelid = 'public.setups'::regclass)
            then 'nur https-Links: aktiv' else 'https-Prüfung: FEHLT' end
union all
select 'Regeln ' || t.tablename,
       string_agg(t.policyname || ' (' || t.cmd || case when t.permissive = 'RESTRICTIVE' then ', einschränkend' else '' end || ')',
                  ' · ' order by t.permissive desc, t.policyname)
from pg_policies t
where t.schemaname = 'public' and t.tablename in ('marketplace', 'setups', 'events')
group by t.tablename
union all
select 'Regeln Dateispeicher',
       string_agg(t.policyname || ' (' || t.cmd || case when t.permissive = 'RESTRICTIVE' then ', einschränkend' else '' end || ')',
                  ' · ' order by t.permissive desc, t.policyname)
from pg_policies t
where t.schemaname = 'storage' and t.tablename = 'objects'
union all
select 'Speicher ' || b.id,
       'öffentlich: ' || b.public::text || ', max. ' || coalesce((b.file_size_limit / 1048576)::text || ' MB', 'unbegrenzt')
       || ', Dateitypen: ' || coalesce(array_to_string(b.allowed_mime_types, ' '), 'alle')
from storage.buckets b
where b.id in ('marketplace', 'setups')
union all
select 'Konto löschen: Verknüpfungen ohne automatisches Löschen',
       coalesce((select string_agg(c.conrelid::regclass::text || '.' || a.attname, ', ' order by c.conrelid::regclass::text, a.attname)
                 from pg_constraint c
                 join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
                 where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
                   and c.connamespace <> 'auth'::regnamespace
                   and c.confdeltype not in ('c', 'n', 'd')), 'keine');
