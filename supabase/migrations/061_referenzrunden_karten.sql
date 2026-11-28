-- =========================================================
-- GSRA – 061: Referenzrunden als Kärtchen, Löschen durch Admins (Wunsch 28.11.)
-- =========================================================
-- Baut auf 060 auf (Tabelle reference_laps nur über Funktionen erreichbar).
--  * reference_laps_overview: je Strecke und Auto ein Kärtchen – Anzahl (offiziell hochgeladen / anonym aus Rennen),
--    Bestzeit, ob Pedalwerte da sind (für den Piepton), letztes Datum (nur tagesgenau). Nie, wer hochgeladen hat.
--  * Die Kennung zum Löschen liefert schon reference_laps_get (060).
--  * reference_lap_admin_delete: Admins (mit Zwei-Faktor, is_site_admin aus 018) löschen jede Referenzrunde;
--    ins Moderationsprotokoll kommt, WAS gelöscht wurde (Strecke, Auto, Zeit, Quelle) – nicht, wer sie hochgeladen hat.
--  * reference_laps_darf_loeschen: sagt der App, ob sie Löschen-Knöpfe zeigen soll (prüft dasselbe wie das Löschen).
-- Darf mehrfach laufen.

-- ---------------------------------------------------------
-- Kärtchen: Übersicht je Strecke und Auto
-- ---------------------------------------------------------
create or replace function public.reference_laps_overview(_strecke text default null)
returns table (strecke text, fahrzeug text, anzahl integer, offiziell integer, aus_rennen integer,
               bestzeit_s real, mit_pedalen boolean, zuletzt timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  return query
    select r.strecke, r.fahrzeug,
           count(*)::integer,
           (count(*) filter (where r.quelle = 'eigen'))::integer,
           (count(*) filter (where r.quelle = 'feld'))::integer,
           min(r.zeit_s),
           bool_or(r.bremse is not null),
           date_trunc('day', max(r.created_at))
      from public.reference_laps r
     where _strecke is null or r.strecke = left(btrim(_strecke), 120)
     group by r.strecke, r.fahrzeug
     order by max(r.created_at) desc
     limit 200;
end;
$$;

revoke execute on function public.reference_laps_overview(text) from public, anon;
grant execute on function public.reference_laps_overview(text) to authenticated;

-- ---------------------------------------------------------
-- Admins: dürfen löschen?
-- ---------------------------------------------------------
create or replace function public.reference_laps_darf_loeschen()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.is_site_admin();
$$;

revoke execute on function public.reference_laps_darf_loeschen() from public, anon;
grant execute on function public.reference_laps_darf_loeschen() to authenticated;

-- ---------------------------------------------------------
-- Admins: Referenzrunde löschen (mit Protokoll)
-- ---------------------------------------------------------
create or replace function public.reference_lap_admin_delete(_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _r record;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if not public.is_site_admin() then raise exception 'Nur Admins (mit Zwei-Faktor) dürfen fremde Referenzrunden löschen.'; end if;
  delete from public.reference_laps where id = _id
    returning strecke, fahrzeug, zeit_s, quelle into _r;
  if not found then return false; end if;
  insert into public.moderation_log (actor_id, action, details)
  values (auth.uid(), 'referenzrunde_geloescht',
          jsonb_build_object('strecke', _r.strecke, 'fahrzeug', _r.fahrzeug, 'zeit_s', _r.zeit_s, 'quelle', _r.quelle));
  return true;
end;
$$;

revoke execute on function public.reference_lap_admin_delete(uuid) from public, anon;
grant execute on function public.reference_lap_admin_delete(uuid) to authenticated;

-- ---------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------
select 'Referenzrunden-Kärtchen 061' as pruefung,
       case when to_regprocedure('public.reference_laps_overview(text)') is not null
             and to_regprocedure('public.reference_lap_admin_delete(uuid)') is not null
             and to_regprocedure('public.reference_laps_darf_loeschen()') is not null
             and to_regclass('public.reference_laps') is not null then 'bereit' else 'FEHLT (zuerst 060 ausführen)' end as ergebnis
union all
select 'Gäste ausgeschlossen',
       case when not has_function_privilege('anon', 'public.reference_laps_overview(text)', 'execute')
             and not has_function_privilege('anon', 'public.reference_lap_admin_delete(uuid)', 'execute') then 'ja' else 'NEIN' end;
