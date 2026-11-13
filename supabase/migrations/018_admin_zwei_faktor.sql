-- =========================================================
-- GSRA 018 – Admin-Rechte nur mit Zwei-Faktor-Anmeldung (13.11.)
-- Alle Admin-Rechte der Datenbank laufen über public.is_site_admin() (Meldungen bearbeiten, sperren,
-- fremde Inhalte löschen, Chat-Anhänge sehen, Events anlegen …). Ab jetzt gilt ein Admin nur dann als
-- Admin, wenn die aktuelle Anmeldung mit dem Code aus der Authenticator-App bestätigt wurde („aal2“).
-- Mit einem gestohlenen Passwort allein bekommt man also keine Admin-Rechte mehr.
--
-- Reihenfolge: Webseite hochladen (Push) → im Admin-Bereich die Zwei-Faktor-Anmeldung einrichten →
-- dieses Skript ausführen. Andersherum geht auch: Die Einrichtung im Admin-Bereich braucht keine Admin-Rechte.
-- Handy verloren? Im SQL Editor: delete from auth.mfa_factors where user_id = '<Nutzer-ID>';
-- danach im Admin-Bereich neu einrichten.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Rechte (wer die Funktion aufrufen darf) bleiben unverändert.
-- =========================================================

create or replace function public.is_site_admin()
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

notify pgrst, 'reload schema';

-- Kontrolle (ändert nichts)
select 'Admin-Rechte nur mit zweitem Faktor' as pruefung,
       case when (select prosrc from pg_proc where oid = 'public.is_site_admin()'::regprocedure) like '%aal2%'
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Admins mit eingerichteter Zwei-Faktor-Anmeldung',
       (select count(*) from public.profiles p where p.role = 'admin'
          and exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status::text = 'verified'))::text
       || ' von ' || (select count(*) from public.profiles where role = 'admin')::text
union all
select 'Gäste dürfen is_site_admin() aufrufen',
       case when has_function_privilege('anon', 'public.is_site_admin()', 'EXECUTE') then 'ja (017 noch ausführen)' else 'nein' end;
