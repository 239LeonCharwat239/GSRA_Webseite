-- =========================================================
-- GSRA Marktplatz: Umkreissuche (z. B. 50 km, 150 km, europaweit, weltweit)
-- Sucht, filtert, sortiert (auch nach Entfernung) und lädt seitenweise direkt in der Datenbank.
-- Bestehende Inserate bleiben unverändert. Einmal komplett im SQL Editor ausführen (darf mehrfach laufen).
-- =========================================================

-- Land des Standorts (z. B. DE, AT) – für „europaweit“
alter table public.marketplace add column if not exists country_code text;
do $$
begin
  alter table public.marketplace add constraint marketplace_country_code_valid
    check (country_code is null or country_code ~ '^[A-Z]{2}$') not valid;
exception when duplicate_object then null;
end $$;

create index if not exists marketplace_latitude_idx on public.marketplace (latitude) where latitude is not null;

create or replace function public.search_marketplace(
  _category    text default null,
  _subcategory text default null,
  _search      text default null,
  _condition   text default null,
  _place       text default null,
  _min_price   numeric default null,
  _max_price   numeric default null,
  _lat         double precision default null,
  _lon         double precision default null,
  _radius_km   double precision default null,
  _europe      boolean default false,
  _sort        text default 'newest',
  _limit       integer default 24,
  _offset      integer default 0)
returns table (item jsonb, distance_km double precision, total_count bigint)
language sql
stable
set search_path to 'public'
as $$
  with params as (
    select nullif(replace(replace(replace(trim(coalesce(_search, '')), '\', '\\'), '%', '\%'), '_', '\_'), '') as s,
           nullif(replace(replace(replace(trim(coalesce(_place, '')), '\', '\\'), '%', '\%'), '_', '\_'), '') as p
  ), base as (
    select m.*,
           case when _lat is not null and _lon is not null and m.latitude is not null and m.longitude is not null then
             6371 * 2 * asin(sqrt(least(1, power(sin(radians(m.latitude - _lat) / 2), 2)
               + cos(radians(_lat)) * cos(radians(m.latitude)) * power(sin(radians(m.longitude - _lon) / 2), 2))))
           end as dist
    from public.marketplace m, params
    where m.status <> 'verkauft'
      and (_category is null or m.category = _category)
      and (_subcategory is null or m.subcategory = _subcategory)
      and (_condition is null or m.condition = _condition)
      and (params.s is null or m.title ilike '%' || params.s || '%' or m.description ilike '%' || params.s || '%'
           or m.manufacturer ilike '%' || params.s || '%' or m.model ilike '%' || params.s || '%')
      and (params.p is null or m.location ilike '%' || params.p || '%')
      and (_min_price is null or m.price >= _min_price)
      and (_max_price is null or m.price <= _max_price)
      and (not coalesce(_europe, false)
           or m.country_code in ('AD','AL','AT','BA','BE','BG','BY','CH','CY','CZ','DE','DK','EE','ES','FI','FO','FR','GB','GI','GR',
                                 'HR','HU','IE','IM','IS','IT','JE','GG','LI','LT','LU','LV','MC','MD','ME','MK','MT','NL','NO','PL',
                                 'PT','RO','RS','SE','SI','SK','SM','UA','VA','XK')
           or (m.country_code is null and m.latitude between 34 and 72 and m.longitude between -25 and 45))
      -- Schneller Vorfilter für den Umkreis (Breitengrad), die genaue Entfernung prüft „dist“
      and (_radius_km is null or _lat is null
           or m.latitude between _lat - _radius_km / 110.0 and _lat + _radius_km / 110.0)
  ), filtered as (
    select * from base
    where _radius_km is null or _lat is null or (dist is not null and dist <= _radius_km)
  )
  select to_jsonb(f) - 'dist', round(f.dist::numeric, 1)::double precision, count(*) over ()
  from filtered f
  order by
    case when _sort = 'distance' then f.dist end asc nulls last,
    case when _sort = 'price-asc' then f.price end asc nulls last,
    case when _sort = 'price-desc' then f.price end desc nulls last,
    f.created_at desc
  limit least(greatest(coalesce(_limit, 24), 1), 60)
  offset greatest(coalesce(_offset, 0), 0);
$$;

grant execute on function public.search_marketplace(text, text, text, text, text, numeric, numeric, double precision,
  double precision, double precision, boolean, text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';

-- Kontrolle (ändert nichts)
select 'Umkreissuche' as pruefung,
       case when to_regprocedure('public.search_marketplace(text, text, text, text, text, numeric, numeric, double precision, double precision, double precision, boolean, text, integer, integer)') is not null
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'marketplace' and column_name = 'country_code')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Testsuche (alle nicht verkauften Inserate)',
       (select coalesce(max(total_count), 0)::text || ' gefunden' from public.search_marketplace());
