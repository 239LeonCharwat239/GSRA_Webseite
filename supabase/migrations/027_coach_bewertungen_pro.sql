-- =========================================================
-- GSRA 027 – Coach-Bewertungen und Pro-Coaches (17.11.)
-- 1) Käufer bewerten ihren Coach nach dem Coaching: Skala Ideal, In Ordnung, Mangelhaft, Schlecht,
--    Merkmale und Kommentar. Nur wer das Coaching bezahlt hat und dessen Termin vorbei ist, eine Bewertung
--    pro Coaching (änderbar). Die Zufriedenheit erscheint auf jeder Coach-Karte und im Profil.
-- 2) Pro-Coaches: die Pro-Fahrer der GSRA (dieselbe Liste wie im Setup Hub, von Admins ausgewählt) dürfen
--    ohne Lizenz coachen und erscheinen oben in einem eigenen Bereich. Verwarnung oder Sperre stoppt auch sie.
--    Die Liste pflegen Admins jetzt im Admin-Bereich; Änderungen stehen im Protokoll.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 014, 021, 024–026 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Coach-Bewertungen
-- ---------------------------------------------------------
create table if not exists public.coaching_reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references public.coaching_bookings(id) on delete cascade,
  coach_id    uuid not null references auth.users(id) on delete cascade,
  buyer_id    uuid not null references auth.users(id) on delete cascade,
  rating      smallint not null check (rating in (-2, -1, 0, 1)),   -- 1 Ideal, 0 In Ordnung, -1 Mangelhaft, -2 Schlecht
  tags        text[] not null default '{}'
              check (tags <@ array['kompetent', 'erklaert_gut', 'puenktlich', 'hat_geholfen']::text[]),
  comment     text check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (buyer_id <> coach_id)
);
create index if not exists coaching_reviews_coach_idx on public.coaching_reviews (coach_id, created_at desc);

alter table public.coaching_reviews enable row level security;
revoke insert, update on public.coaching_reviews from anon, authenticated;
revoke all on public.coaching_reviews from anon;
drop policy if exists "GSRA Coach-Bewertungen lesen" on public.coaching_reviews;
create policy "GSRA Coach-Bewertungen lesen" on public.coaching_reviews for select to authenticated using (true);
drop policy if exists "GSRA Coach-Bewertung löschen" on public.coaching_reviews;
create policy "GSRA Coach-Bewertung löschen" on public.coaching_reviews for delete to authenticated
  using (buyer_id = (select auth.uid()) or (select public.is_moderator()));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.coaching_reviews;
create policy "Gesperrte Konten haben keinen Zugriff" on public.coaching_reviews as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));
drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.coaching_reviews;
create policy "GSRA Zwei-Faktor erforderlich" on public.coaching_reviews as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Bewerten: nur der Käufer, nur bezahlte Coachings nach dem Termin (oder vom Coach als erledigt gemeldet)
create or replace function public.review_coaching(_booking_id uuid, _rating integer, _tags text[] default '{}', _comment text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
  _b  public.coaching_bookings;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _rating is null or _rating not in (-2, -1, 0, 1) then raise exception 'Bitte wähle eine Bewertung von Ideal bis Schlecht.'; end if;
  select * into _b from public.coaching_bookings where id = _booking_id and buyer_id = _me;
  if _b.id is null then raise exception 'Bewerten kannst du nur Coachings, die du selbst gebucht hast.'; end if;
  if not (_b.status = 'erledigt'
          or (_b.status = 'bezahlt' and _b.scheduled_at is not null
              and _b.scheduled_at + make_interval(mins => _b.duration_minutes) < now())) then
    raise exception 'Bewerten kannst du ein bezahltes Coaching, sobald der Termin vorbei ist.';
  end if;
  insert into public.coaching_reviews (booking_id, coach_id, buyer_id, rating, tags, comment)
  values (_b.id, _b.coach_id, _me, _rating,
          coalesce((select array_agg(distinct t) from unnest(coalesce(_tags, '{}')) t
                    where t in ('kompetent', 'erklaert_gut', 'puenktlich', 'hat_geholfen')), '{}'),
          nullif(left(trim(coalesce(_comment, '')), 1000), ''))
  on conflict (booking_id) do update
    set rating = excluded.rating, tags = excluded.tags, comment = excluded.comment, updated_at = now();
end;
$$;

-- Entfernt das Moderationsteam eine fremde Bewertung, steht das im Protokoll
create or replace function public.coaching_review_log_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from old.buyer_id then
    insert into public.moderation_log (actor_id, action, target_user, details)
    values (auth.uid(), 'coaching_bewertung_geloescht', old.buyer_id, jsonb_build_object('coach', old.coach_id));
  end if;
  return null;
end;
$$;
revoke execute on function public.coaching_review_log_delete() from public, anon, authenticated;
drop trigger if exists gsra_coaching_review_log on public.coaching_reviews;
create trigger gsra_coaching_review_log after delete on public.coaching_reviews for each row execute function public.coaching_review_log_delete();

-- ---------------------------------------------------------
-- 2) Pro-Coaches: Pro-Fahrer coachen ohne Lizenz (Entzug durch Moderation oder Verwarnung/Sperre gilt auch für sie)
-- ---------------------------------------------------------
create or replace function public.coach_license_active(_user uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select not exists (select 1 from public.user_bans b
                     where b.user_id = _user and b.lifted_at is null and (b.banned_until is null or b.banned_until > now()))
     and not exists (select 1 from public.coach_licenses l where l.user_id = _user and l.revoked_at is not null)
     and (exists (select 1 from public.coach_licenses l where l.user_id = _user and l.granted_at is not null)
          or exists (select 1 from public.pro_creators p where p.user_id = _user));
$$;

-- Automatischer Entzug: auch Pro-Fahrer ohne eigene Lizenz werden gestoppt
create or replace function public.coach_license_auto_revoke()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _reason text := case when tg_table_name = 'user_bans' then 'Automatisch: Sperre' else 'Automatisch: Verwarnung' end;
  _hit    boolean := false;
begin
  update public.coach_licenses set revoked_at = now(), revoked_reason = _reason, revoked_by = null, auto_revoked = true
  where user_id = new.user_id and granted_at is not null and revoked_at is null;
  _hit := found;
  if not _hit and exists (select 1 from public.pro_creators where user_id = new.user_id)
     and not exists (select 1 from public.coach_licenses where user_id = new.user_id) then
    insert into public.coach_licenses (user_id, granted_at, revoked_at, revoked_reason, auto_revoked)
    values (new.user_id, null, now(), _reason, true);
    _hit := true;
  end if;
  if _hit then
    update public.coaching_offers set active = false, updated_at = now() where coach_id = new.user_id and active;
    insert into public.moderation_log (actor_id, action, target_user, details)
    values (auth.uid(), 'coach_lizenz_automatisch', new.user_id, jsonb_build_object('grund', _reason));
  end if;
  return null;
end;
$$;
revoke execute on function public.coach_license_auto_revoke() from public, anon, authenticated;

-- Stand der Lizenz: zusätzlich „Pro-Coach“
create or replace function public.coach_license_status(_user uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _l public.coach_licenses;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if _user is distinct from auth.uid() and not public.is_moderator() then
    return jsonb_build_object('aktiv', public.coach_license_active(_user), 'pro', public.is_pro_creator(_user));
  end if;
  select * into _l from public.coach_licenses where user_id = _user;
  return jsonb_build_object(
    'aktiv', public.coach_license_active(_user),
    'pro', public.is_pro_creator(_user),
    'erteilt_am', _l.granted_at,
    'entzogen', case when _l.revoked_at is null then null
                     else jsonb_build_object('am', _l.revoked_at, 'grund', _l.revoked_reason, 'automatisch', _l.auto_revoked) end,
    'regeln', public.coach_license_rules(),
    'fortschritt', public.coach_license_progress(_user));
end;
$$;

-- Pro-Fahrer-Liste: Änderungen durch Admins stehen im Protokoll
create or replace function public.pro_creators_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.moderation_log (actor_id, action, target_user, details) values (auth.uid(), 'pro_fahrer_hinzugefuegt', new.user_id, '{}'::jsonb);
  else
    insert into public.moderation_log (actor_id, action, target_user, details) values (auth.uid(), 'pro_fahrer_entfernt', old.user_id, '{}'::jsonb);
  end if;
  return null;
end;
$$;
revoke execute on function public.pro_creators_log() from public, anon, authenticated;
drop trigger if exists gsra_pro_creators_log on public.pro_creators;
create trigger gsra_pro_creators_log after insert or delete on public.pro_creators for each row execute function public.pro_creators_log();
-- Wer einträgt, wird automatisch vermerkt (nicht vom Browser vorgebbar)
create or replace function public.pro_creators_added_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.added_by := auth.uid();
  new.added_at := now();
  return new;
end;
$$;
revoke execute on function public.pro_creators_added_by() from public, anon, authenticated;
drop trigger if exists gsra_pro_creators_added_by on public.pro_creators;
create trigger gsra_pro_creators_added_by before insert on public.pro_creators for each row execute function public.pro_creators_added_by();

-- ---------------------------------------------------------
-- 3) Profil: Coach-Zufriedenheit
-- ---------------------------------------------------------
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
        'angebote', (select count(*) from public.coaching_offers o where o.coach_id = _user and o.active),
        'erledigt', (select count(*) from public.coaching_bookings b where b.coach_id = _user and b.status = 'erledigt'),
        'lizenz', public.coach_license_active(_user),
        'pro', public.is_pro_creator(_user),
        'anzahl', count(*),
        'ideal', count(*) filter (where rating = 1),
        'in_ordnung', count(*) filter (where rating = 0),
        'mangelhaft', count(*) filter (where rating = -1),
        'schlecht', count(*) filter (where rating = -2),
        'kompetent', count(*) filter (where 'kompetent' = any(tags)),
        'erklaert_gut', count(*) filter (where 'erklaert_gut' = any(tags)),
        'puenktlich', count(*) filter (where 'puenktlich' = any(tags)),
        'hat_geholfen', count(*) filter (where 'hat_geholfen' = any(tags)))
      from public.coaching_reviews where coach_id = _user)
  );
$$;

do $$
begin
  revoke execute on function public.review_coaching(uuid, integer, text[], text) from public, anon;
  grant execute on function public.review_coaching(uuid, integer, text[], text) to authenticated;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Coach-Bewertungen geschützt' as pruefung,
       case when (select relrowsecurity from pg_class where oid = 'public.coaching_reviews'::regclass)
                 and not has_table_privilege('authenticated', 'public.coaching_reviews', 'INSERT')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Pro-Coaches ohne Lizenz',
       case when (select prosrc from pg_proc where proname = 'coach_license_active' and pronamespace = 'public'::regnamespace) like '%pro_creators%'
            then 'bereit' else 'FEHLT' end
union all
select 'Protokoll für Pro-Fahrer und Bewertungen',
       count(*)::text || ' von 2'
from pg_trigger where tgname in ('gsra_pro_creators_log', 'gsra_coaching_review_log');
