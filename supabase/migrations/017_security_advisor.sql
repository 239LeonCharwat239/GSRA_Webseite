-- =========================================================
-- GSRA 017 – Hinweise des Supabase Security Advisors (12.11.)
-- 1) „Function Search Path Mutable“: jede eigene Funktion bekommt einen festen Suchpfad.
-- 2) „Public Can Execute SECURITY DEFINER Function“: Funktionen mit erhöhten Rechten sind für Gäste
--    (nicht angemeldet) nicht mehr aufrufbar. Ausnahmen, die die öffentlichen Seiten brauchen:
--    username_available (Registrierung) und team_invite_info (Team-Einladungslink ansehen).
--    Angemeldete Nutzer und Server-Funktionen behalten genau die Rechte, die sie vorher hatten.
--    Trigger-Funktionen (laufen automatisch im Hintergrund) kann niemand mehr direkt aufrufen.
-- 3) „Public Bucket Allows Listing“: breite Leseregeln auf dem Dateispeicher werden entfernt.
--    Öffentliche Links (Profilbilder, Inseratsbilder, Setups, Chat-Anhänge) funktionieren weiter,
--    nur das Auflisten fremder Dateien geht nicht mehr. Eigene Dateien bleiben sicht- und löschbar.
-- 4) „RLS Policy Always True“: Schreibregeln mit „true“ auf messages und setups werden eingeschränkt
--    (Nachrichten: nur Chat-Teilnehmer, Setups: nur Eigentümer bzw. Admins).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Am Ende stehen Kontrollzeilen.
-- =========================================================

-- 1) Fester Suchpfad für alle eigenen Funktionen im Schema public (Erweiterungen bleiben unberührt).
--    „public, extensions“ entspricht dem bisherigen Suchpfad der Website-Aufrufe – an den Funktionen ändert sich nichts.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    begin
      execute format('alter function %s set search_path = public, extensions', f.sig);
    exception when insufficient_privilege then
      raise notice 'Übersprungen (gehört nicht uns): %', f.sig;
    end;
  end loop;
end $$;

-- 2) Funktionen mit erhöhten Rechten nicht für Gäste
do $$
declare
  f record;
  _auth boolean;
  _service boolean;
begin
  for f in
    select p.oid, p.oid::regprocedure as sig, p.prorettype = 'trigger'::regtype as is_trigger
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and p.proname not in ('username_available', 'team_invite_info')   -- bewusst für Gäste
  loop
    _auth := has_function_privilege('authenticated', f.oid, 'EXECUTE');
    _service := exists (select 1 from pg_roles where rolname = 'service_role')
                and has_function_privilege('service_role', f.oid, 'EXECUTE');
    begin
      execute format('revoke execute on function %s from public, anon', f.sig);
      if f.is_trigger then
        -- Trigger-Funktionen werden von der Datenbank selbst gestartet; ein direkter Aufruf ist nie nötig
        execute format('revoke execute on function %s from authenticated', f.sig);
      else
        if _auth then execute format('grant execute on function %s to authenticated', f.sig); end if;
        if _service then execute format('grant execute on function %s to service_role', f.sig); end if;
      end if;
    exception when insufficient_privilege then
      raise notice 'Übersprungen (gehört nicht uns): %', f.sig;
    end;
  end loop;
end $$;

-- 3) Dateispeicher: breite Leseregeln (ohne Bezug auf Person, Ordner oder Rolle) entfernen …
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and coalesce(qual, 'true') !~* '(auth\.uid|foldername|is_site_admin|can_see_pro|is_pro_creator)'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

-- … und durch „eigene Dateien sehen“ ersetzen: nötig, damit man eigene Bilder und Setups löschen kann
-- (Löschen setzt Lesen voraus). Website-Admins sehen weiterhin alles (Moderation).
drop policy if exists "GSRA eigene Dateien sehen" on storage.objects;
create policy "GSRA eigene Dateien sehen" on storage.objects
  for select to authenticated
  using (bucket_id in ('avatars', 'marketplace', 'setups', 'chat_attachments')
         and ((storage.foldername(name))[1] = auth.uid()::text or (select public.is_site_admin())));

-- 4) Schreibregeln mit „true“ auf messages und setups einschränken (Lesen bleibt unverändert)
do $$
declare
  p record;
  _expr text;
begin
  for p in
    select tablename, policyname, cmd from pg_policies
    where schemaname = 'public' and tablename in ('messages', 'setups') and permissive = 'PERMISSIVE'
      and cmd <> 'SELECT' and (qual = 'true' or with_check = 'true')
  loop
    _expr := case
      when p.tablename = 'messages' and p.cmd = 'INSERT' then 'auth.uid() = sender_id'
      when p.tablename = 'messages' then 'public.is_chat_participant(chat_id) or (select public.is_site_admin())'
      when p.cmd = 'INSERT' then '(uploader_id)::text = (auth.uid())::text'
      else '(uploader_id)::text = (auth.uid())::text or (select public.is_site_admin())'
    end;
    if p.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check (%s)', p.policyname, p.tablename, _expr);
    elsif p.cmd = 'DELETE' then
      execute format('alter policy %I on public.%I using (%s)', p.policyname, p.tablename, _expr);
    else
      execute format('alter policy %I on public.%I using (%s) with check (%s)', p.policyname, p.tablename, _expr, _expr);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts) – in den ersten vier Zeilen überall „0“ erwartet
-- ---------------------------------------------------------
select 'Funktionen ohne festen Suchpfad' as pruefung,
       count(*)::text as ergebnis
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
union all
select 'Funktionen mit erhöhten Rechten für Gäste (ohne die 2 Ausnahmen)',
       count(*)::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
  and p.proname not in ('username_available', 'team_invite_info')
  and has_function_privilege('anon', p.oid, 'EXECUTE')
union all
select 'Breite Leseregeln auf dem Dateispeicher',
       count(*)::text
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT' and permissive = 'PERMISSIVE'
  and coalesce(qual, 'true') !~* '(auth\.uid|foldername|is_site_admin|can_see_pro|is_pro_creator)'
union all
select 'Schreibregeln mit „true“ auf messages/setups',
       count(*)::text
from pg_policies
where schemaname = 'public' and tablename in ('messages', 'setups') and permissive = 'PERMISSIVE'
  and cmd <> 'SELECT' and (qual = 'true' or with_check = 'true')
union all
select 'Für Gäste bewusst freigegeben',
       coalesce(string_agg(p.proname, ', ' order by p.proname), '–')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
  and has_function_privilege('anon', p.oid, 'EXECUTE');
