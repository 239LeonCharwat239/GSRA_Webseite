-- =========================================================
-- GSRA Marktplatz-Ausbau: Unterkategorien, technische Angaben, Status (reserviert/verkauft),
-- höchstens 100 Inserate pro Person, Inserate melden und schnelle Filter.
-- Bestehende Inserate bleiben unverändert (Status „aktiv“).
-- Einmal komplett im Supabase SQL Editor ausführen (darf auch mehrfach laufen).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Neue Angaben am Inserat
-- ---------------------------------------------------------
alter table public.marketplace add column if not exists subcategory       text;
alter table public.marketplace add column if not exists manufacturer      text;
alter table public.marketplace add column if not exists model             text;
alter table public.marketplace add column if not exists torque_nm         numeric;
alter table public.marketplace add column if not exists wheel_diameter_mm integer;
alter table public.marketplace add column if not exists screen_size_inch  numeric;
alter table public.marketplace add column if not exists status            text not null default 'aktiv';
alter table public.marketplace add column if not exists status_changed_at timestamptz;

do $$
begin
  alter table public.marketplace add constraint marketplace_status_valid
    check (status in ('aktiv', 'reserviert', 'verkauft')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.marketplace add constraint marketplace_specs_valid check (
        (torque_nm is null or torque_nm between 0 and 100)
    and (wheel_diameter_mm is null or wheel_diameter_mm between 100 and 600)
    and (screen_size_inch is null or screen_size_inch between 5 and 120)
    and char_length(coalesce(manufacturer, '')) <= 60
    and char_length(coalesce(model, '')) <= 80
    and char_length(coalesce(subcategory, '')) <= 80
  ) not valid;
exception when duplicate_object then null;
end $$;

-- Schnelle Filter und seitenweises Laden (auch bei sehr vielen Inseraten)
create index if not exists marketplace_status_created_idx on public.marketplace (status, created_at desc);
create index if not exists marketplace_category_idx on public.marketplace (category, subcategory);
create index if not exists marketplace_user_status_idx on public.marketplace (user_id, status);

-- ---------------------------------------------------------
-- 2) Höchstens 100 nicht verkaufte Inserate pro Person, Zeitpunkt der Statusänderung
-- ---------------------------------------------------------
create or replace function public.marketplace_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;

  if new.status <> 'verkauft' and (tg_op = 'INSERT' or old.status = 'verkauft') then
    perform pg_advisory_xact_lock(hashtext('gsra_listing_limit:' || new.user_id::text));
    if (select count(*) from public.marketplace m
        where m.user_id::text = new.user_id::text and m.status <> 'verkauft'
          and (tg_op = 'INSERT' or m.id <> new.id)) >= 100 then
      raise exception 'Du kannst höchstens 100 Inserate gleichzeitig online haben. Lösche oder verkaufe zuerst ein anderes.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marketplace_rules on public.marketplace;
create trigger trg_marketplace_rules
  before insert or update on public.marketplace
  for each row execute function public.marketplace_rules();

-- ---------------------------------------------------------
-- 3) Inserat melden: landet im Admin-Bereich mit einer Kopie des Inserats (Beweissicherung)
-- ---------------------------------------------------------
create or replace function public.report_listing(_listing_id text, _reason text, _details text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me      uuid := auth.uid();
  _item    record;
  _report  uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Bitte wähle einen Grund.'; end if;

  select m.* into _item from public.marketplace m where m.id::text = _listing_id;
  if not found then raise exception 'Dieses Inserat gibt es nicht mehr.'; end if;
  if _item.user_id::text = _me::text then raise exception 'Dein eigenes Inserat kannst du nicht melden.'; end if;
  if exists (select 1 from public.reports r
             where r.reporter_id = _me and r.scope = 'inserat' and r.status = 'offen'
               and r.context ->> 'listing_id' = _listing_id) then
    raise exception 'Du hast dieses Inserat bereits gemeldet. Das GSRA-Team prüft es.';
  end if;
  if (select count(*) from public.reports where reporter_id = _me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Du hast in kurzer Zeit sehr viele Meldungen gesendet. Bitte versuche es später erneut.';
  end if;

  insert into public.reports (reporter_id, reported_id, scope, whole_chat, reason, details, context)
  values (_me, _item.user_id::text::uuid, 'inserat', false, left(trim(_reason), 80),
          nullif(left(trim(coalesce(_details, '')), 1000), ''),
          jsonb_build_object(
            'listing_id', _item.id::text,
            'title', _item.title,
            'price', _item.price,
            'category', _item.category,
            'subcategory', _item.subcategory,
            'description', _item.description,
            'location', _item.location,
            'images', to_jsonb(_item.images),
            'created_at', _item.created_at))
  returning id into _report;
  return _report;
end;
$$;

revoke execute on function public.report_listing(text, text, text) from public, anon;
grant execute on function public.report_listing(text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 4) Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Neue Angaben im Marktplatz' as pruefung,
       (select case when count(*) = 8 then 'bereit' else 'FEHLT (' || count(*) || ' von 8)' end
        from information_schema.columns
        where table_schema = 'public' and table_name = 'marketplace'
          and column_name in ('subcategory', 'manufacturer', 'model', 'torque_nm', 'wheel_diameter_mm',
                              'screen_size_inch', 'status', 'status_changed_at')) as ergebnis
union all
select 'Limit und Melden',
       case when exists (select 1 from pg_trigger where tgname = 'trg_marketplace_rules')
             and to_regprocedure('public.report_listing(text, text, text)') is not null
            then 'aktiv' else 'FEHLT' end
union all
select 'Inserate nach Status',
       coalesce((select string_agg(status || ': ' || n, ', ' order by status)
                 from (select status, count(*) as n from public.marketplace group by status) s), 'keine');
