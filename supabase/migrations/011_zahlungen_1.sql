-- =========================================================
-- GSRA Zahlungen: Abos (Paddock kostenlos, Pole, Alliance-Team), Marktplatz-Boni, Zahlungsbelege
-- Zahlungen laufen über Stripe; eingetragen werden sie nur von der Server-Funktion „stripe-webhook“
-- (Dienstschlüssel), nie direkt aus dem Browser. Einmal komplett im SQL Editor ausführen (darf mehrfach laufen).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Stripe-Kunden, persönliche Abos (Pole), Teams (Alliance), Zahlungsbelege
-- ---------------------------------------------------------
create table if not exists public.billing_customers (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

create table if not exists public.user_plans (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  plan                   text not null default 'pole' check (plan in ('pole')),
  status                 text not null default 'active',
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

create table if not exists public.teams (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references auth.users(id) on delete cascade,
  status                 text not null default 'active',
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id  uuid not null references public.teams(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create unique index if not exists team_members_one_team_idx on public.team_members (user_id);

create table if not exists public.payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  kind              text not null check (kind in ('highlight', 'bump', 'top', 'pole', 'alliance')),
  listing_id        text,
  stripe_session_id text not null unique,
  amount_cents      integer,
  currency          text,
  created_at        timestamptz not null default now()
);

alter table public.billing_customers enable row level security;
alter table public.user_plans enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.payments enable row level security;

-- Eigenes Team (Hilfsfunktion, damit sich die Leseregel der Teammitglieder nicht selbst aufruft)
create or replace function public.my_team_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select tm.team_id from public.team_members tm where tm.user_id = auth.uid();
$$;

-- Lesen: nur eigene Daten (Teams: alle Mitglieder), Website-Admins alles. Schreiben nur über Funktionen.
drop policy if exists "GSRA: Eigene Kundendaten" on public.billing_customers;
create policy "GSRA: Eigene Kundendaten" on public.billing_customers
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_site_admin()));

drop policy if exists "GSRA: Eigenes Abo" on public.user_plans;
create policy "GSRA: Eigenes Abo" on public.user_plans
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_site_admin()));

drop policy if exists "GSRA: Eigenes Team" on public.teams;
create policy "GSRA: Eigenes Team" on public.teams
  for select to authenticated using (id = (select public.my_team_id()) or (select public.is_site_admin()));

drop policy if exists "GSRA: Mitglieder des eigenen Teams" on public.team_members;
create policy "GSRA: Mitglieder des eigenen Teams" on public.team_members
  for select to authenticated using (team_id = (select public.my_team_id()) or (select public.is_site_admin()));

drop policy if exists "GSRA: Eigene Zahlungen" on public.payments;
create policy "GSRA: Eigene Zahlungen" on public.payments
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_site_admin()));

-- ---------------------------------------------------------
-- 2) Welches Abo hat jemand? (für alle sichtbar, z. B. im Profil)
--    Kurze Kulanz von 3 Tagen, falls eine Verlängerung sich verzögert.
-- ---------------------------------------------------------
create or replace function public.plan_of(_user uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when exists (select 1 from public.team_members tm join public.teams t on t.id = tm.team_id
                 where tm.user_id = _user and t.status in ('active', 'trialing', 'past_due')
                   and (t.current_period_end is null or t.current_period_end > now() - interval '3 days')) then 'alliance'
    when exists (select 1 from public.user_plans p
                 where p.user_id = _user and p.status in ('active', 'trialing', 'past_due')
                   and (p.current_period_end is null or p.current_period_end > now() - interval '3 days')) then 'pole'
    else 'paddock'
  end;
$$;

-- Eigene Mitgliedschaft mit allen Details (Abo-Seite)
create or replace function public.my_membership()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  _me   uuid := auth.uid();
  _team public.teams%rowtype;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  select t.* into _team from public.teams t join public.team_members tm on tm.team_id = t.id where tm.user_id = _me;
  return jsonb_build_object(
    'plan', public.plan_of(_me),
    'pole', (select to_jsonb(p) - 'stripe_subscription_id' from public.user_plans p where p.user_id = _me),
    'team', case when _team.id is null then null else jsonb_build_object(
      'id', _team.id,
      'is_owner', _team.owner_id = _me,
      'owner_name', (select username from public.profiles where id = _team.owner_id),
      'status', _team.status,
      'current_period_end', _team.current_period_end,
      'cancel_at_period_end', _team.cancel_at_period_end,
      'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', tm.user_id, 'username', p.username,
                                                               'gsra_id', p.gsra_id, 'avatar_url', p.avatar_url,
                                                               'is_owner', tm.user_id = _team.owner_id)
                                            order by tm.user_id <> _team.owner_id, tm.added_at), '[]'::jsonb)
                  from public.team_members tm left join public.profiles p on p.id = tm.user_id
                  where tm.team_id = _team.id)) end,
    'has_customer', exists (select 1 from public.billing_customers c where c.user_id = _me));
end;
$$;

-- Teamleitung: Mitglied per GSRA-ID hinzufügen (höchstens 10 Personen inklusive Teamleitung)
create or replace function public.team_add_member(_gsra_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me     uuid := auth.uid();
  _team   public.teams%rowtype;
  _target uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  select * into _team from public.teams where owner_id = _me and status in ('active', 'trialing', 'past_due');
  if _team.id is null then raise exception 'Nur die Teamleitung eines aktiven Alliance-Abos kann Mitglieder hinzufügen.'; end if;
  select id into _target from public.profiles where gsra_id = _gsra_id;
  if _target is null then raise exception 'Zu dieser GSRA-ID gibt es kein Konto.'; end if;
  if public.plan_of(_target) = 'alliance' then
    raise exception 'Diese Person ist bereits Mitglied eines Teams.';
  end if;
  if exists (select 1 from public.user_plans p where p.user_id = _target and p.status in ('active', 'trialing', 'past_due')
             and not p.cancel_at_period_end and (p.current_period_end is null or p.current_period_end > now())) then
    raise exception 'Diese Person hat ein eigenes Pole-Abo. Sie sollte es zuerst kündigen, damit sie nicht doppelt zahlt.';
  end if;
  -- Mitgliedschaft in einem beendeten Team zählt nicht mehr
  delete from public.team_members where user_id = _target;
  perform pg_advisory_xact_lock(hashtext('gsra_team:' || _team.id::text));
  if (select count(*) from public.team_members where team_id = _team.id) >= 10 then
    raise exception 'Euer Team ist voll – das Alliance-Abo gilt für höchstens 10 Personen.';
  end if;
  insert into public.team_members (team_id, user_id) values (_team.id, _target);
end;
$$;

-- Mitglied entfernen (Teamleitung) bzw. Team verlassen (Mitglied selbst)
create or replace function public.team_remove_member(_user uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me   uuid := auth.uid();
  _team public.teams%rowtype;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  select t.* into _team from public.teams t join public.team_members tm on tm.team_id = t.id where tm.user_id = _user;
  if _team.id is null then raise exception 'Diese Person ist in keinem Team.'; end if;
  if _user = _team.owner_id then raise exception 'Die Teamleitung kann das Team nicht verlassen – kündige stattdessen das Abo.'; end if;
  if _me <> _team.owner_id and _me <> _user then raise exception 'Nur die Teamleitung kann Mitglieder entfernen.'; end if;
  delete from public.team_members where team_id = _team.id and user_id = _user;
end;
$$;

-- ---------------------------------------------------------
-- 3) Marktplatz-Boni (gelten dauerhaft für das gekaufte Inserat)
-- ---------------------------------------------------------
alter table public.marketplace add column if not exists highlighted boolean not null default false;
alter table public.marketplace add column if not exists top_ad      boolean not null default false;
alter table public.marketplace add column if not exists bump_since  timestamptz;   -- automatisch alle 7 Tage nach oben

-- Boni lassen sich nur über eine Zahlung (Server-Funktion) oder von Website-Admins setzen
create or replace function public.marketplace_protect_boosts()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or public.is_site_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.highlighted := false;
    new.top_ad := false;
    new.bump_since := null;
  else
    new.highlighted := old.highlighted;
    new.top_ad := old.top_ad;
    new.bump_since := old.bump_since;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marketplace_protect_boosts on public.marketplace;
create trigger trg_marketplace_protect_boosts
  before insert or update on public.marketplace
  for each row execute function public.marketplace_protect_boosts();

-- Suche: „Neueste zuerst“ berücksichtigt das wöchentliche Hochschieben, _top_only liefert die Top-Anzeigen
drop function if exists public.search_marketplace(text, text, text, text, text, numeric, numeric, double precision,
  double precision, double precision, boolean, text, integer, integer);
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
  _offset      integer default 0,
  _top_only    boolean default false)
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
           end as dist,
           -- Hochschieben: letzter 7-Tage-Takt seit dem Kauf zählt wie ein neues Inserat
           greatest(m.created_at, coalesce(m.bump_since + floor(extract(epoch from (now() - m.bump_since)) / 604800) * interval '7 days',
                                           m.created_at)) as sort_at
    from public.marketplace m, params
    where m.status <> 'verkauft'
      and (not coalesce(_top_only, false) or m.top_ad)
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
      and (_radius_km is null or _lat is null
           or m.latitude between _lat - _radius_km / 110.0 and _lat + _radius_km / 110.0)
  ), filtered as (
    select * from base
    where _radius_km is null or _lat is null or (dist is not null and dist <= _radius_km)
  )
  select to_jsonb(f) - 'dist' - 'sort_at', round(f.dist::numeric, 1)::double precision, count(*) over ()
  from filtered f
  order by
    case when coalesce(_top_only, false) then random() end,
    case when _sort = 'distance' then f.dist end asc nulls last,
    case when _sort = 'price-asc' then f.price end asc nulls last,
    case when _sort = 'price-desc' then f.price end desc nulls last,
    f.sort_at desc
  limit least(greatest(coalesce(_limit, 24), 1), 60)
  offset greatest(coalesce(_offset, 0), 0);
$$;

grant execute on function public.search_marketplace(text, text, text, text, text, numeric, numeric, double precision,
  double precision, double precision, boolean, text, integer, integer, boolean) to anon, authenticated;

-- ---------------------------------------------------------
-- 4) Nur für die Server-Funktion „stripe-webhook“ (Dienstschlüssel): Zahlung verbuchen, Abo abgleichen
-- ---------------------------------------------------------
create or replace function public.stripe_apply_payment(_session_id text, _kind text, _user uuid, _listing_id text,
                                                       _amount_cents integer, _currency text, _customer_id text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _owner text;
begin
  if _customer_id is not null and _user is not null then
    insert into public.billing_customers (user_id, stripe_customer_id) values (_user, _customer_id)
    on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id;
  end if;

  -- Jede Stripe-Sitzung wird genau einmal verbucht (Stripe kann Meldungen wiederholen)
  insert into public.payments (user_id, kind, listing_id, stripe_session_id, amount_cents, currency)
  values (_user, _kind, _listing_id, _session_id, _amount_cents, _currency)
  on conflict (stripe_session_id) do nothing;
  if not found then return 'bereits verbucht'; end if;

  if _kind in ('highlight', 'bump', 'top') then
    select m.user_id::text into _owner from public.marketplace m where m.id::text = _listing_id;
    if _owner is null then return 'Inserat nicht gefunden'; end if;
    update public.marketplace m set
      highlighted = m.highlighted or _kind = 'highlight',
      top_ad      = m.top_ad or _kind = 'top',
      bump_since  = case when _kind = 'bump' then now() else m.bump_since end
    where m.id::text = _listing_id;
  end if;
  return 'verbucht';
end;
$$;

create or replace function public.stripe_sync_subscription(_subscription_id text, _kind text, _user uuid, _customer_id text,
                                                           _status text, _period_end timestamptz, _cancel_at_period_end boolean)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _team uuid;
begin
  if _customer_id is not null and _user is not null then
    insert into public.billing_customers (user_id, stripe_customer_id) values (_user, _customer_id)
    on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id;
  end if;

  if _kind = 'pole' then
    insert into public.user_plans (user_id, plan, status, stripe_subscription_id, current_period_end, cancel_at_period_end, updated_at)
    values (_user, 'pole', _status, _subscription_id, _period_end, coalesce(_cancel_at_period_end, false), now())
    on conflict (user_id) do update set status = excluded.status, stripe_subscription_id = excluded.stripe_subscription_id,
      current_period_end = excluded.current_period_end, cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now();
    return 'pole ' || _status;
  elsif _kind = 'alliance' then
    select id into _team from public.teams where stripe_subscription_id = _subscription_id;
    if _team is null then
      select id into _team from public.teams where owner_id = _user;
    end if;
    if _team is null then
      insert into public.teams (owner_id, status, stripe_subscription_id, current_period_end, cancel_at_period_end)
      values (_user, _status, _subscription_id, _period_end, coalesce(_cancel_at_period_end, false))
      returning id into _team;
    else
      update public.teams set status = _status, stripe_subscription_id = _subscription_id, current_period_end = _period_end,
        cancel_at_period_end = coalesce(_cancel_at_period_end, false)
      where id = _team;
    end if;
    -- Teamleitung ist selbst Mitglied (wechselt bei Bedarf aus einem anderen, beendeten Team)
    if _status in ('active', 'trialing', 'past_due') then
      delete from public.team_members where user_id = _user and team_id <> _team;
      insert into public.team_members (team_id, user_id) values (_team, _user) on conflict do nothing;
    end if;
    return 'alliance ' || _status;
  end if;
  return 'unbekannt';
end;
$$;

-- Ausführen: plan_of für alle, Mitgliedschaft und Team für Angemeldete, Stripe-Funktionen nur mit Dienstschlüssel
revoke execute on function public.plan_of(uuid) from public;
grant execute on function public.plan_of(uuid) to anon, authenticated;
revoke execute on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;
revoke execute on function public.team_add_member(bigint) from public, anon;
grant execute on function public.team_add_member(bigint) to authenticated;
revoke execute on function public.team_remove_member(uuid) from public, anon;
grant execute on function public.team_remove_member(uuid) to authenticated;
revoke execute on function public.stripe_apply_payment(text, text, uuid, text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.stripe_sync_subscription(text, text, uuid, text, text, timestamptz, boolean) from public, anon, authenticated;
do $$
begin
  grant execute on function public.stripe_apply_payment(text, text, uuid, text, integer, text, text) to service_role;
  grant execute on function public.stripe_sync_subscription(text, text, uuid, text, text, timestamptz, boolean) to service_role;
exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 5) Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Abos und Teams' as pruefung,
       case when to_regclass('public.user_plans') is not null and to_regclass('public.teams') is not null
             and to_regclass('public.team_members') is not null and to_regclass('public.payments') is not null
             and to_regprocedure('public.plan_of(uuid)') is not null
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Marktplatz-Boni',
       case when exists (select 1 from pg_trigger where tgname = 'trg_marketplace_protect_boosts')
             and to_regprocedure('public.stripe_apply_payment(text, text, uuid, text, integer, text, text)') is not null
            then 'bereit (nur per Zahlung setzbar)' else 'FEHLT' end
union all
select 'Suche mit Top-Anzeigen',
       case when to_regprocedure('public.search_marketplace(text, text, text, text, text, numeric, numeric, double precision, double precision, double precision, boolean, text, integer, integer, boolean)') is not null
            then 'bereit' else 'FEHLT' end;
