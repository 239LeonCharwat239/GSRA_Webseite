-- =========================================================
-- GSRA 019 – Zwei-Faktor-Anmeldung ist Pflicht für alle, die sie eingerichtet haben (13.11.)
-- Bisher: Wer nur das Passwort kannte, war mit dem Konto angemeldet (ohne Admin-Rechte, aber mit
-- Nachrichten, Profil usw.). Ab jetzt gilt eine Sitzung ohne bestätigten Code bei solchen Konten als
-- gesperrt: kein Lesen, kein Schreiben, keine Datenbank-Funktionen. Konten ohne Zwei-Faktor sind
-- nicht betroffen. Vorgehen wie in der Supabase-Anleitung („Enforce MFA for users who have opted in“).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Am Ende stehen Kontrollzeilen.
-- =========================================================

-- 1) Prüfung: Code bestätigt (aal2) – oder für dieses Konto gar keine Zwei-Faktor-Anmeldung eingerichtet
create or replace function public.mfa_ok()
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                     where f.user_id = auth.uid() and f.status::text = 'verified');
$$;
revoke execute on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

-- 2) Alle Tabellen (und der Dateispeicher): ohne bestätigten Code kein Zugriff.
--    Einschränkende Regel – sie kommt zu allen bestehenden hinzu und kann nichts öffnen.
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.%I', t.relname);
    execute format('create policy "GSRA Zwei-Faktor erforderlich" on public.%I as restrictive for all to authenticated '
                   'using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t.relname);
  end loop;
end $$;

drop policy if exists "GSRA Zwei-Faktor erforderlich" on storage.objects;
create policy "GSRA Zwei-Faktor erforderlich" on storage.objects as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- 3) Datenbank-Funktionen (Chat starten, Freundschaftsanfrage, Melden …) prüfen „gesperrt?“ über is_banned().
--    Eine Sitzung ohne bestätigten Code gilt dort ebenfalls als gesperrt.
create or replace function public.is_banned()
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_bans b
    where b.user_id = auth.uid() and b.lifted_at is null and (b.banned_until is null or b.banned_until > now())
  ) or not public.mfa_ok();
$$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Tabellen ohne Zwei-Faktor-Regel' as pruefung,
       count(*)::text as ergebnis
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
                  and p.policyname = 'GSRA Zwei-Faktor erforderlich')
union all
select 'Dateispeicher mit Zwei-Faktor-Regel',
       case when exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                         and policyname = 'GSRA Zwei-Faktor erforderlich') then 'bereit' else 'FEHLT' end
union all
select 'Gesperrt-Prüfung beachtet Zwei-Faktor',
       case when (select prosrc from pg_proc where oid = 'public.is_banned()'::regprocedure) like '%mfa_ok%'
            then 'bereit' else 'FEHLT' end
union all
select 'Konten mit eingerichteter Zwei-Faktor-Anmeldung',
       (select count(distinct user_id) from auth.mfa_factors where status::text = 'verified')::text;
