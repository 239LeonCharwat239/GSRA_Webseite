-- =========================================================
-- GSRA 024 – Bewertungsskala, Visibility-Header, Coaching (16.11.)
-- 1) Einheitliche Skala für Verkäufer- und Setup-Bewertungen: Ideal, In Ordnung, Mangelhaft, Schlecht.
--    Bisherige Bewertungen werden übernommen (TOP → Ideal, OK → In Ordnung, Na ja → Mangelhaft;
--    hilfreich → Ideal, okay → In Ordnung, nicht hilfreich → Mangelhaft, nicht wie beschrieben → Schlecht).
-- 2) Visibility-Header: Namen von Mitgliedern mit Pole oder Alliance schweben durch die Kopfzeile.
--    Jedes Mitglied kann das im Dashboard abschalten (Spalte show_in_header, Standard: an).
-- 3) Coaching: Mitglieder mit Pole oder Alliance bieten Coachings zu eigenem Preis an, alle Mitglieder
--    können anfragen. Der Coach erhält 100 % seines Preises. Mitglieder mit Paddock zahlen 10 %
--    Servicegebühr zusätzlich, mit Pole oder Alliance entfällt sie. Preis und Gebühr berechnet nur die Datenbank.
--    Die Bezahlung selbst folgt in einem nächsten Schritt (Stripe Connect).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 019, 021 und 023 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Bewertungsskala: Ideal (1), In Ordnung (0), Mangelhaft (-1), Schlecht (-2)
-- ---------------------------------------------------------
alter table public.seller_ratings drop constraint if exists seller_ratings_rating_check;
alter table public.seller_ratings add constraint seller_ratings_rating_check check (rating in (-2, -1, 0, 1));

alter table public.setup_reviews drop constraint if exists setup_reviews_verdict_check;
update public.setup_reviews set verdict = case verdict
    when 'hilfreich' then 'ideal' when 'okay' then 'in_ordnung'
    when 'nicht_hilfreich' then 'mangelhaft' when 'nicht_wie_beschrieben' then 'schlecht' else verdict end
  where verdict in ('hilfreich', 'okay', 'nicht_hilfreich', 'nicht_wie_beschrieben');
alter table public.setup_reviews add constraint setup_reviews_verdict_check
  check (verdict in ('ideal', 'in_ordnung', 'mangelhaft', 'schlecht'));

create or replace function public.rate_seller(_listing_id text, _rating integer, _tags text[] default '{}', _comment text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _me     uuid := auth.uid();
  _item   record;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _rating not in (-2, -1, 0, 1) then raise exception 'Bitte wähle „Ideal“, „In Ordnung“, „Mangelhaft“ oder „Schlecht“.'; end if;
  select m.id::text as id, m.user_id, m.title into _item from public.marketplace m where m.id::text = _listing_id;
  if _item.id is null then raise exception 'Dieses Inserat gibt es nicht mehr.'; end if;
  if _item.user_id = _me then raise exception 'Dein eigenes Inserat kannst du nicht bewerten.'; end if;
  if not exists (
    select 1 from public.chats c
    where c.title is null and c.user1_id <> c.user2_id
      and ((c.user1_id = _me and c.user2_id = _item.user_id) or (c.user1_id = _item.user_id and c.user2_id = _me))
      and exists (select 1 from public.messages x where x.chat_id = c.id and x.sender_id = _me)
      and exists (select 1 from public.messages x where x.chat_id = c.id and x.sender_id = _item.user_id)
  ) then
    raise exception 'Bewerten kannst du, sobald du mit dem Verkäufer im Messenger geschrieben hast und er geantwortet hat.';
  end if;

  insert into public.seller_ratings (listing_id, listing_title, seller_id, rater_id, rating, tags, comment)
  values (_item.id, left(_item.title, 160), _item.user_id, _me, _rating,
          coalesce((select array_agg(distinct t) from unnest(coalesce(_tags, '{}')) t
                    where t in ('freundlich', 'zuverlaessig', 'schnelle_antwort', 'wie_beschrieben')), '{}'),
          nullif(left(trim(coalesce(_comment, '')), 500), ''))
  on conflict (rater_id, listing_id) do update
    set rating = excluded.rating, tags = excluded.tags, comment = excluded.comment, updated_at = now();
end;
$$;

create or replace function public.review_setup(_setup_id text, _verdict text, _comment text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _me    uuid := auth.uid();
  _setup record;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _verdict not in ('ideal', 'in_ordnung', 'mangelhaft', 'schlecht') then
    raise exception 'Bitte wähle „Ideal“, „In Ordnung“, „Mangelhaft“ oder „Schlecht“.';
  end if;
  select s.id::text as id, s.uploader_id::text as uploader, coalesce((to_jsonb(s) ->> 'is_pro')::boolean, false) as is_pro
    into _setup from public.setups s where s.id::text = _setup_id;
  if _setup.id is null then raise exception 'Dieses Setup gibt es nicht mehr.'; end if;
  if _setup.uploader = _me::text then raise exception 'Dein eigenes Setup kannst du nicht bewerten.'; end if;
  if _setup.is_pro and not public.can_see_pro(_me) then
    raise exception 'Pro Setups bewerten nur Mitglieder mit Zugang zu Pro Setups.';
  end if;

  insert into public.setup_reviews (setup_id, user_id, verdict, comment)
  values (_setup.id, _me, _verdict, nullif(left(trim(coalesce(_comment, '')), 1000), ''))
  on conflict (setup_id, user_id) do update
    set verdict = excluded.verdict, comment = excluded.comment, updated_at = now();
end;
$$;

-- ---------------------------------------------------------
-- 2) Visibility-Header
-- ---------------------------------------------------------
alter table public.profiles add column if not exists show_in_header boolean not null default true;

-- Namen (und Abo-Stufe) aller Mitglieder mit Pole oder Alliance, die nicht widersprochen haben – zufällige Reihenfolge
create or replace function public.visibility_names()
returns table (username text, plan text)
language sql
stable security definer
set search_path = public
as $$
  select x.username, x.plan from (
    select p.username, public.plan_of(p.id) as plan
    from public.profiles p
    where p.show_in_header and coalesce(trim(p.username), '') <> ''
      and not exists (select 1 from public.user_bans b
                      where b.user_id = p.id and b.lifted_at is null and (b.banned_until is null or b.banned_until > now()))
  ) x
  where x.plan in ('pole', 'alliance')
  order by random()
  limit 300;
$$;
revoke execute on function public.visibility_names() from public, anon;
grant execute on function public.visibility_names() to authenticated;

-- ---------------------------------------------------------
-- 3) Coaching
-- ---------------------------------------------------------
create table if not exists public.coaching_offers (
  id               uuid primary key default gen_random_uuid(),
  coach_id         uuid not null references auth.users(id) on delete cascade,
  title            text not null check (char_length(title) between 3 and 100),
  description      text check (char_length(description) <= 2000),
  category         text not null default 'Fahrtechnik'
                   check (category in ('Fahrtechnik', 'Setup', 'Rennstrategie', 'Einsteiger', 'Datenanalyse', 'Sonstiges')),
  simulation       text check (char_length(simulation) <= 60),
  duration_minutes integer not null check (duration_minutes between 15 and 600),
  price_cents      integer not null check (price_cents between 500 and 100000),   -- 5 € bis 1.000 €
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists coaching_offers_coach_idx on public.coaching_offers (coach_id);

create table if not exists public.coaching_bookings (
  id               uuid primary key default gen_random_uuid(),
  offer_id         uuid references public.coaching_offers(id) on delete set null,
  coach_id         uuid not null references auth.users(id) on delete cascade,
  buyer_id         uuid not null references auth.users(id) on delete cascade,
  offer_title      text not null,
  duration_minutes integer not null,
  price_cents      integer not null check (price_cents >= 0),   -- erhält der Coach zu 100 %
  fee_cents        integer not null check (fee_cents >= 0),     -- 10 % nur für Paddock
  total_cents      integer not null check (total_cents = price_cents + fee_cents),
  preferred_time   text check (char_length(preferred_time) <= 200),
  message          text check (char_length(message) <= 1000),
  status           text not null default 'angefragt'
                   check (status in ('angefragt', 'angenommen', 'abgelehnt', 'storniert', 'bezahlt', 'erledigt')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (buyer_id <> coach_id)
);
create index if not exists coaching_bookings_buyer_idx on public.coaching_bookings (buyer_id, created_at desc);
create index if not exists coaching_bookings_coach_idx on public.coaching_bookings (coach_id, created_at desc);

alter table public.coaching_offers enable row level security;
alter table public.coaching_bookings enable row level security;
-- Schreiben nur über die Funktionen unten (sie prüfen Abo, Grenzen und Preise)
revoke insert, update on public.coaching_offers, public.coaching_bookings from anon, authenticated;
revoke delete on public.coaching_bookings from anon, authenticated;
revoke all on public.coaching_offers, public.coaching_bookings from anon;

drop policy if exists "GSRA Coachings ansehen" on public.coaching_offers;
create policy "GSRA Coachings ansehen" on public.coaching_offers for select to authenticated
  using (active or coach_id = (select auth.uid()) or (select public.is_moderator()));
drop policy if exists "GSRA eigenes Coaching löschen" on public.coaching_offers;
create policy "GSRA eigenes Coaching löschen" on public.coaching_offers for delete to authenticated
  using (coach_id = (select auth.uid()) or (select public.is_moderator()));
drop policy if exists "GSRA eigene Coaching-Anfragen" on public.coaching_bookings;
create policy "GSRA eigene Coaching-Anfragen" on public.coaching_bookings for select to authenticated
  using (buyer_id = (select auth.uid()) or coach_id = (select auth.uid()) or (select public.is_moderator()));

do $$
declare t text;
begin
  foreach t in array array['coaching_offers', 'coaching_bookings'] loop
    execute format('drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.%I', t);
    execute format('create policy "Gesperrte Konten haben keinen Zugriff" on public.%I as restrictive for all to authenticated '
                   'using (not (select public.is_banned())) with check (not (select public.is_banned()))', t);
    execute format('drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.%I', t);
    execute format('create policy "GSRA Zwei-Faktor erforderlich" on public.%I as restrictive for all to authenticated '
                   'using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

-- Zufriedenheit im Profil: neue Skala, dazu Coaching-Kennzahlen (steht hinter den Coaching-Tabellen)
create or replace function public.profile_reputation(_user uuid)
returns jsonb
language sql
stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'marktplatz', (select jsonb_build_object(
        'anzahl', count(*),
        'ideal', count(*) filter (where rating = 1),
        'in_ordnung', count(*) filter (where rating = 0),
        'mangelhaft', count(*) filter (where rating = -1),
        'schlecht', count(*) filter (where rating = -2),
        'freundlich', count(*) filter (where 'freundlich' = any(tags)),
        'zuverlaessig', count(*) filter (where 'zuverlaessig' = any(tags)),
        'schnelle_antwort', count(*) filter (where 'schnelle_antwort' = any(tags)),
        'wie_beschrieben', count(*) filter (where 'wie_beschrieben' = any(tags)))
      from public.seller_ratings where seller_id = _user),
    'setups', (select jsonb_build_object(
        'anzahl', count(*),
        'ideal', count(*) filter (where r.verdict = 'ideal'),
        'in_ordnung', count(*) filter (where r.verdict = 'in_ordnung'),
        'mangelhaft', count(*) filter (where r.verdict = 'mangelhaft'),
        'schlecht', count(*) filter (where r.verdict = 'schlecht'))
      from public.setup_reviews r join public.setups s on s.id::text = r.setup_id
      where s.uploader_id::text = _user::text),
    'setup_stimmen', (select jsonb_build_object(
        'setups', count(*), 'likes', coalesce(sum(likes), 0), 'dislikes', coalesce(sum(dislikes), 0))
      from public.setups where uploader_id::text = _user::text),
    'coaching', (select jsonb_build_object(
        'angebote', count(*) filter (where o.active),
        'erledigt', (select count(*) from public.coaching_bookings b where b.coach_id = _user and b.status = 'erledigt'))
      from public.coaching_offers o where o.coach_id = _user)
  );
$$;

-- Servicegebühr in Prozent für die angemeldete Person: 0 mit Pole/Alliance, sonst 10
create or replace function public.coaching_fee_percent()
returns integer
language sql
stable security definer
set search_path = public
as $$
  select case when public.plan_of(auth.uid()) in ('pole', 'alliance') then 0 else 10 end;
$$;

-- Angebot anlegen oder ändern (nur mit Pole oder Alliance; Deaktivieren geht immer)
create or replace function public.coaching_save_offer(_id uuid, _title text, _description text, _category text,
                                                      _simulation text, _duration integer, _price_cents integer, _active boolean default true)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me  uuid := auth.uid();
  _row uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if coalesce(_active, true) and public.plan_of(_me) not in ('pole', 'alliance') then
    raise exception 'Coachings anbieten können Mitglieder mit Pole oder Alliance.';
  end if;
  if char_length(trim(coalesce(_title, ''))) < 3 then raise exception 'Bitte gib einen Titel mit mindestens 3 Zeichen an.'; end if;
  if _duration is null or _duration < 15 or _duration > 600 then raise exception 'Die Dauer muss zwischen 15 Minuten und 10 Stunden liegen.'; end if;
  if _price_cents is null or _price_cents < 500 or _price_cents > 100000 then raise exception 'Der Preis muss zwischen 5 € und 1.000 € liegen.'; end if;

  if _id is null then
    if (select count(*) from public.coaching_offers where coach_id = _me) >= 20 then
      raise exception 'Du kannst höchstens 20 Coaching-Angebote anlegen.';
    end if;
    if (select count(*) from public.coaching_offers where coach_id = _me and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'Zu viele neue Angebote in kurzer Zeit. Bitte versuche es später erneut.';
    end if;
    insert into public.coaching_offers (coach_id, title, description, category, simulation, duration_minutes, price_cents, active)
    values (_me, left(trim(_title), 100), nullif(left(trim(coalesce(_description, '')), 2000), ''),
            coalesce(nullif(_category, ''), 'Fahrtechnik'), nullif(left(trim(coalesce(_simulation, '')), 60), ''),
            _duration, _price_cents, coalesce(_active, true))
    returning id into _row;
  else
    update public.coaching_offers
    set title = left(trim(_title), 100), description = nullif(left(trim(coalesce(_description, '')), 2000), ''),
        category = coalesce(nullif(_category, ''), 'Fahrtechnik'), simulation = nullif(left(trim(coalesce(_simulation, '')), 60), ''),
        duration_minutes = _duration, price_cents = _price_cents, active = coalesce(_active, true), updated_at = now()
    where id = _id and coach_id = _me
    returning id into _row;
    if _row is null then raise exception 'Dieses Angebot gibt es nicht oder es gehört dir nicht.'; end if;
  end if;
  return _row;
end;
$$;

-- Coaching anfragen: Preis und Gebühr legt die Datenbank fest (nicht die Webseite)
create or replace function public.coaching_book(_offer_id uuid, _message text default null, _preferred_time text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _me    uuid := auth.uid();
  _offer record;
  _fee   integer;
  _id    uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _offer from public.coaching_offers where id = _offer_id and active;
  if _offer.id is null then raise exception 'Dieses Coaching wird nicht mehr angeboten.'; end if;
  if _offer.coach_id = _me then raise exception 'Dein eigenes Coaching kannst du nicht buchen.'; end if;
  if public.plan_of(_offer.coach_id) not in ('pole', 'alliance') then
    raise exception 'Dieser Coach bietet gerade keine Coachings an.';
  end if;
  if exists (select 1 from public.coaching_bookings where buyer_id = _me and offer_id = _offer_id and status in ('angefragt', 'angenommen')) then
    raise exception 'Du hast dieses Coaching bereits angefragt.';
  end if;
  if (select count(*) from public.coaching_bookings where buyer_id = _me and status = 'angefragt') >= 5 then
    raise exception 'Du hast schon 5 offene Anfragen. Warte bitte auf eine Antwort, bevor du weitere stellst.';
  end if;
  if (select count(*) from public.coaching_bookings where buyer_id = _me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Zu viele Anfragen in kurzer Zeit. Bitte versuche es später erneut.';
  end if;

  _fee := case when public.plan_of(_me) in ('pole', 'alliance') then 0 else round(_offer.price_cents * 0.10)::integer end;
  insert into public.coaching_bookings (offer_id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents,
                                        preferred_time, message)
  values (_offer.id, _offer.coach_id, _me, _offer.title, _offer.duration_minutes, _offer.price_cents, _fee, _offer.price_cents + _fee,
          nullif(left(trim(coalesce(_preferred_time, '')), 200), ''), nullif(left(trim(coalesce(_message, '')), 1000), ''))
  returning id into _id;
  return jsonb_build_object('id', _id, 'price_cents', _offer.price_cents, 'fee_cents', _fee, 'total_cents', _offer.price_cents + _fee);
end;
$$;

-- Coach nimmt eine Anfrage an oder lehnt sie ab
create or replace function public.coaching_respond(_booking_id uuid, _accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  update public.coaching_bookings
  set status = case when _accept then 'angenommen' else 'abgelehnt' end, updated_at = now()
  where id = _booking_id and coach_id = auth.uid() and status = 'angefragt';
  if not found then raise exception 'Diese Anfrage gibt es nicht mehr oder sie wurde schon beantwortet.'; end if;
end;
$$;

-- Anfrage zurückziehen (Käufer) bzw. absagen (Coach), solange nichts bezahlt ist
create or replace function public.coaching_cancel(_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  update public.coaching_bookings set status = 'storniert', updated_at = now()
  where id = _booking_id and (buyer_id = auth.uid() or coach_id = auth.uid()) and status in ('angefragt', 'angenommen');
  if not found then raise exception 'Diese Anfrage lässt sich nicht mehr stornieren.'; end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.coaching_fee_percent()',
    'public.coaching_save_offer(uuid, text, text, text, text, integer, integer, boolean)',
    'public.coaching_book(uuid, text, text)', 'public.coaching_respond(uuid, boolean)', 'public.coaching_cancel(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Coaches und ihre Kunden dürfen sich im Messenger schreiben (wie Verkäufer im Marktplatz)
do $$
declare _def text;
begin
  select pg_get_functiondef(p.oid) into _def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'start_direct_chat';
  if _def is not null and position('coaching_offers' in _def) = 0
     and position('and not exists (select 1 from public.marketplace where user_id = _other)' in _def) > 0 then
    execute replace(_def, 'and not exists (select 1 from public.marketplace where user_id = _other)',
      'and not exists (select 1 from public.marketplace where user_id = _other)'
      || ' and not exists (select 1 from public.coaching_offers where coach_id = _other and active)'
      || ' and not exists (select 1 from public.coaching_bookings b where (b.coach_id = _me and b.buyer_id = _other)'
      || ' or (b.buyer_id = _me and b.coach_id = _other))');
  end if;
end $$;

-- Entfernt das Moderationsteam ein fremdes Angebot, steht das im Protokoll
create or replace function public.coaching_log_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from old.coach_id then
    insert into public.moderation_log (actor_id, action, target_user, details)
    values (auth.uid(), 'coaching_geloescht', old.coach_id, jsonb_build_object('titel', old.title));
  end if;
  return null;
end;
$$;
revoke execute on function public.coaching_log_delete() from public, anon, authenticated;
drop trigger if exists gsra_coaching_log on public.coaching_offers;
create trigger gsra_coaching_log after delete on public.coaching_offers for each row execute function public.coaching_log_delete();

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Bewertungsskala Ideal bis Schlecht' as pruefung,
       case when (select count(*) from public.setup_reviews where verdict not in ('ideal', 'in_ordnung', 'mangelhaft', 'schlecht')) = 0
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Visibility-Header (Abschalten im Dashboard)',
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
                         and column_name = 'show_in_header') then 'bereit' else 'FEHLT' end
union all
select 'Coaching-Tabellen geschützt',
       count(*)::text || ' von 2'
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('coaching_offers', 'coaching_bookings') and c.relrowsecurity
union all
select 'Coaches im Messenger erreichbar',
       case when (select prosrc from pg_proc where proname = 'start_direct_chat' and pronamespace = 'public'::regnamespace) like '%coaching_offers%'
            then 'bereit' else 'FEHLT' end;
