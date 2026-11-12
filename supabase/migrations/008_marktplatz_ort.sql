-- =========================================================
-- GSRA Marktplatz: Koordinaten zum Standort eines Inserats
-- (Grundlage für die spätere Umkreissuche). Bestehende Inserate bleiben unverändert.
-- Einmal komplett im Supabase SQL Editor ausführen (darf auch mehrfach laufen).
-- =========================================================

alter table public.marketplace add column if not exists latitude  double precision;
alter table public.marketplace add column if not exists longitude double precision;

-- Nur gültige Koordinaten (beide leer oder beide im erlaubten Bereich)
do $$
begin
  alter table public.marketplace add constraint marketplace_coords_valid check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  ) not valid;
exception when duplicate_object then
  null;
end $$;

notify pgrst, 'reload schema';

-- Kontrolle (ändert nichts)
select 'Koordinaten im Marktplatz' as pruefung,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'marketplace' and column_name = 'latitude')
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'marketplace' and column_name = 'longitude')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Inserate mit Koordinaten',
       (select count(*) filter (where latitude is not null) || ' von ' || count(*) from public.marketplace);
