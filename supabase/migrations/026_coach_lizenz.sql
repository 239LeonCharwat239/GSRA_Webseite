-- =========================================================
-- GSRA 026 – Coach-Lizenz statt Abo (16.11.)
-- Coach wird man über Leistung, nicht über ein Abo (Entscheidungen vom 16.11.):
--   * mindestens 3 Monate Mitglied
--   * mindestens 25 Setup-Punkte (Likes minus Dislikes über alle eigenen Setups)
--   * mindestens 5 Bewertungen (Marktplatz und Setups zusammen) mit Ø „Ideal“ (≥ 2,5 auf der Skala 0–3)
--   * keine Sperre und keine Verwarnung in den letzten 90 Tagen
-- Wer alles erfüllt, holt sich die Lizenz auf der Coaching-Seite; sie bleibt dann dauerhaft gültig.
-- Entzug: automatisch bei Verwarnung oder Sperre, zusätzlich durch Moderatoren mit Begründung (Protokoll).
-- Beim Entzug werden die Angebote pausiert; bezahlte Coachings bleiben erstattbar.
-- Pole/Alliance sind fürs Coachen nicht mehr nötig; Käufer mit Abo zahlen weiterhin keine Servicegebühr.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 024 und 025 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Regeln (an einer Stelle, später leicht anpassbar)
-- ---------------------------------------------------------
create or replace function public.coach_license_rules()
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object('mitglied_tage', 90, 'setup_punkte', 25, 'bewertungen', 5, 'schnitt', 2.5, 'ruhe_tage', 90);
$$;

-- ---------------------------------------------------------
-- 2) Lizenzen: jeder sieht nur seine eigene, schreiben nur die Funktionen unten
-- ---------------------------------------------------------
create table if not exists public.coach_licenses (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  granted_at      timestamptz,                       -- leer = nie erteilt (z. B. vorsorglich gesperrt)
  revoked_at      timestamptz,
  revoked_reason  text check (char_length(revoked_reason) <= 300),
  revoked_by      uuid references auth.users(id) on delete set null,
  auto_revoked    boolean not null default false     -- automatisch (Verwarnung/Sperre) oder durch die Moderation
);
alter table public.coach_licenses enable row level security;
revoke all on public.coach_licenses from anon, authenticated;
grant select on public.coach_licenses to authenticated;
drop policy if exists "GSRA eigene Coach-Lizenz" on public.coach_licenses;
create policy "GSRA eigene Coach-Lizenz" on public.coach_licenses for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_moderator()));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.coach_licenses;
create policy "Gesperrte Konten haben keinen Zugriff" on public.coach_licenses as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));
drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.coach_licenses;
create policy "GSRA Zwei-Faktor erforderlich" on public.coach_licenses as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Aktive Lizenz: erteilt, nicht entzogen und gerade nicht gesperrt
create or replace function public.coach_license_active(_user uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (select 1 from public.coach_licenses l where l.user_id = _user and l.granted_at is not null and l.revoked_at is null)
     and not exists (select 1 from public.user_bans b
                     where b.user_id = _user and b.lifted_at is null and (b.banned_until is null or b.banned_until > now()));
$$;

-- Fortschritt zu den Voraussetzungen (nur intern; nach außen über coach_license_status)
create or replace function public.coach_license_progress(_user uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _r      jsonb := public.coach_license_rules();
  _days   integer;
  _points integer;
  _n      integer;
  _avg    numeric;
  _clean  boolean;
  _ok     jsonb;
begin
  select coalesce(floor(extract(epoch from (now() - created_at)) / 86400)::integer, 0) into _days from auth.users where id = _user;
  select coalesce(sum(coalesce(likes, 0)) - sum(coalesce(dislikes, 0)), 0)::integer into _points
    from public.setups where uploader_id::text = _user::text;
  -- Skala 0–3: Ideal 3, In Ordnung 2, Mangelhaft 1, Schlecht 0 (Marktplatz: rating -2..1 → +2)
  select count(*), avg(score) into _n, _avg from (
    select (rating + 2)::numeric as score from public.seller_ratings where seller_id = _user
    union all
    select case r.verdict when 'ideal' then 3 when 'in_ordnung' then 2 when 'mangelhaft' then 1 else 0 end::numeric
      from public.setup_reviews r join public.setups s on s.id::text = r.setup_id
     where s.uploader_id::text = _user::text
  ) x;
  _clean := not exists (select 1 from public.user_warnings w
                        where w.user_id = _user and w.created_at > now() - make_interval(days => (_r ->> 'ruhe_tage')::integer))
        and not exists (select 1 from public.user_bans b
                        where b.user_id = _user
                          and (b.created_at > now() - make_interval(days => (_r ->> 'ruhe_tage')::integer)
                               or (b.lifted_at is null and (b.banned_until is null or b.banned_until > now()))));
  _ok := jsonb_build_object(
    'dauer', coalesce(_days, 0) >= (_r ->> 'mitglied_tage')::integer,
    'setups', _points >= (_r ->> 'setup_punkte')::integer,
    'bewertungen', _n >= (_r ->> 'bewertungen')::integer and coalesce(_avg, 0) >= (_r ->> 'schnitt')::numeric,
    'verhalten', _clean);
  return jsonb_build_object(
    'mitglied_tage', coalesce(_days, 0), 'setup_punkte', _points, 'bewertungen', _n, 'schnitt', round(coalesce(_avg, 0), 2),
    'erfuellt', _ok,
    'alle', (_ok ->> 'dauer')::boolean and (_ok ->> 'setups')::boolean and (_ok ->> 'bewertungen')::boolean and (_ok ->> 'verhalten')::boolean);
end;
$$;

-- Stand der Lizenz: für sich selbst (und die Moderation) mit Fortschritt, für andere nur „aktiv ja/nein“
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
    return jsonb_build_object('aktiv', public.coach_license_active(_user));
  end if;
  select * into _l from public.coach_licenses where user_id = _user;
  return jsonb_build_object(
    'aktiv', public.coach_license_active(_user),
    'erteilt_am', _l.granted_at,
    'entzogen', case when _l.revoked_at is null then null
                     else jsonb_build_object('am', _l.revoked_at, 'grund', _l.revoked_reason, 'automatisch', _l.auto_revoked) end,
    'regeln', public.coach_license_rules(),
    'fortschritt', public.coach_license_progress(_user));
end;
$$;

-- Lizenz holen, sobald alle Voraussetzungen erfüllt sind
create or replace function public.coach_claim_license()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
  _l  public.coach_licenses;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _l from public.coach_licenses where user_id = _me;
  if _l.granted_at is not null and _l.revoked_at is null then return 'schon_aktiv'; end if;
  if _l.revoked_at is not null and not _l.auto_revoked then
    raise exception 'Deine Coach-Lizenz wurde vom Moderationsteam entzogen. Bei Fragen wende dich bitte an die GSRA.';
  end if;
  if not (public.coach_license_progress(_me) ->> 'alle')::boolean then
    raise exception 'Du erfüllst noch nicht alle Voraussetzungen für die Coach-Lizenz.';
  end if;
  insert into public.coach_licenses (user_id, granted_at) values (_me, now())
  on conflict (user_id) do update set granted_at = now(), revoked_at = null, revoked_reason = null, revoked_by = null, auto_revoked = false;
  insert into public.moderation_log (actor_id, action, target_user, details) values (_me, 'coach_lizenz_erteilt', _me, '{}'::jsonb);
  return 'erteilt';
end;
$$;

-- Moderation: Lizenz entziehen (mit Begründung) und wiederherstellen
create or replace function public.coach_license_revoke(_user uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then raise exception 'Nur für das Moderationsteam.'; end if;
  if _user is null or _user = auth.uid() then raise exception 'Die eigene Coach-Lizenz lässt sich nicht entziehen.'; end if;
  if char_length(trim(coalesce(_reason, ''))) < 5 then raise exception 'Bitte gib eine Begründung an (mindestens 5 Zeichen).'; end if;
  insert into public.coach_licenses (user_id, granted_at, revoked_at, revoked_reason, revoked_by, auto_revoked)
  values (_user, null, now(), left(trim(_reason), 300), auth.uid(), false)
  on conflict (user_id) do update set revoked_at = now(), revoked_reason = excluded.revoked_reason,
                                      revoked_by = excluded.revoked_by, auto_revoked = false;
  update public.coaching_offers set active = false, updated_at = now() where coach_id = _user and active;
  insert into public.moderation_log (actor_id, action, target_user, details)
  values (auth.uid(), 'coach_lizenz_entzogen', _user, jsonb_build_object('grund', left(trim(_reason), 300)));
end;
$$;

create or replace function public.coach_license_restore(_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then raise exception 'Nur für das Moderationsteam.'; end if;
  update public.coach_licenses set revoked_at = null, revoked_reason = null, revoked_by = null, auto_revoked = false
  where user_id = _user and revoked_at is not null;
  if not found then raise exception 'Diese Person hat keine entzogene Coach-Lizenz.'; end if;
  delete from public.coach_licenses where user_id = _user and granted_at is null;
  insert into public.moderation_log (actor_id, action, target_user, details) values (auth.uid(), 'coach_lizenz_wiederhergestellt', _user, '{}'::jsonb);
end;
$$;

-- Automatischer Entzug bei Verwarnung oder Sperre (Angebote werden pausiert)
create or replace function public.coach_license_auto_revoke()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _reason text := case when tg_table_name = 'user_bans' then 'Automatisch: Sperre' else 'Automatisch: Verwarnung' end;
begin
  update public.coach_licenses set revoked_at = now(), revoked_reason = _reason, revoked_by = null, auto_revoked = true
  where user_id = new.user_id and granted_at is not null and revoked_at is null;
  if found then
    update public.coaching_offers set active = false, updated_at = now() where coach_id = new.user_id and active;
    insert into public.moderation_log (actor_id, action, target_user, details)
    values (auth.uid(), 'coach_lizenz_automatisch', new.user_id, jsonb_build_object('grund', _reason));
  end if;
  return null;
end;
$$;
revoke execute on function public.coach_license_auto_revoke() from public, anon, authenticated;
drop trigger if exists gsra_coach_license_warning on public.user_warnings;
create trigger gsra_coach_license_warning after insert on public.user_warnings for each row execute function public.coach_license_auto_revoke();
drop trigger if exists gsra_coach_license_ban on public.user_bans;
create trigger gsra_coach_license_ban after insert on public.user_bans for each row execute function public.coach_license_auto_revoke();

-- ---------------------------------------------------------
-- 3) Coaching: Lizenz statt Abo
-- ---------------------------------------------------------
-- Angebote anderer sieht man nur, solange der Coach eine aktive Lizenz hat
drop policy if exists "GSRA Coachings ansehen" on public.coaching_offers;
create policy "GSRA Coachings ansehen" on public.coaching_offers for select to authenticated
  using ((active and public.coach_license_active(coach_id)) or coach_id = (select auth.uid()) or (select public.is_moderator()));

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
  if coalesce(_active, true) and not public.coach_license_active(_me) then
    raise exception 'Coachings anbieten können Mitglieder mit GSRA-Coach-Lizenz.';
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
  if not public.coach_license_active(_offer.coach_id) then
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

  -- Servicegebühr: 10 % für Paddock, keine mit Pole oder Alliance (unverändert)
  _fee := case when public.plan_of(_me) in ('pole', 'alliance') then 0 else round(_offer.price_cents * 0.10)::integer end;
  insert into public.coaching_bookings (offer_id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents,
                                        preferred_time, message)
  values (_offer.id, _offer.coach_id, _me, _offer.title, _offer.duration_minutes, _offer.price_cents, _fee, _offer.price_cents + _fee,
          nullif(left(trim(coalesce(_preferred_time, '')), 200), ''), nullif(left(trim(coalesce(_message, '')), 1000), ''))
  returning id into _id;
  return jsonb_build_object('id', _id, 'price_cents', _offer.price_cents, 'fee_cents', _fee, 'total_cents', _offer.price_cents + _fee);
end;
$$;

-- Bezahlen nur, solange der Coach seine Lizenz hat (bereits Bezahltes bleibt erstattbar)
create or replace function public.coaching_checkout_info(_booking_id uuid, _user uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _b   public.coaching_bookings;
  _acc public.coach_payout_accounts;
begin
  if public.coaching_user_banned(_user) then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _b from public.coaching_bookings where id = _booking_id and buyer_id = _user;
  if _b.id is null then raise exception 'Diese Anfrage gibt es nicht.'; end if;
  if _b.status = 'bezahlt' then raise exception 'Dieses Coaching ist schon bezahlt.'; end if;
  if _b.status <> 'angenommen' then raise exception 'Bezahlen kannst du, sobald der Coach deine Anfrage angenommen hat.'; end if;
  if _b.scheduled_at is null or _b.scheduled_at <= now() then
    raise exception 'Der Termin liegt in der Vergangenheit. Bitte stimmt im Messenger einen neuen Termin ab.';
  end if;
  if not public.coach_license_active(_b.coach_id) then
    raise exception 'Dieser Coach bietet derzeit keine Coachings an. Du kannst die Anfrage zurückziehen.';
  end if;
  select * into _acc from public.coach_payout_accounts where user_id = _b.coach_id;
  if _acc.user_id is null or not _acc.charges_enabled then
    raise exception 'Der Coach richtet die Bezahlung gerade noch ein. Bitte versuche es später erneut.';
  end if;
  return jsonb_build_object(
    'total_cents', _b.total_cents, 'fee_cents', _b.fee_cents, 'price_cents', _b.price_cents,
    'title', _b.offer_title, 'duration_minutes', _b.duration_minutes, 'scheduled_at', _b.scheduled_at,
    'coach_name', (select username from public.profiles where id = _b.coach_id),
    'stripe_account_id', _acc.stripe_account_id,
    'stripe_session_id', _b.stripe_session_id, 'checkout_started_at', _b.checkout_started_at);
end;
$$;

-- Profil: Coaching-Kennzahlen mit Lizenz-Hinweis
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
        'erledigt', (select count(*) from public.coaching_bookings b where b.coach_id = _user and b.status = 'erledigt'),
        'lizenz', public.coach_license_active(_user))
      from public.coaching_offers o where o.coach_id = _user)
  );
$$;

-- Rechte
do $$
declare f text;
begin
  foreach f in array array['public.coach_license_active(uuid)', 'public.coach_license_status(uuid)', 'public.coach_claim_license()',
    'public.coach_license_revoke(uuid, text)', 'public.coach_license_restore(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  revoke execute on function public.coach_license_progress(uuid) from public, anon, authenticated;
  begin
    grant execute on function public.coach_license_active(uuid) to service_role;
    grant execute on function public.coach_license_progress(uuid) to service_role;
  exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
  end;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Coach-Lizenzen geschützt' as pruefung,
       case when (select relrowsecurity from pg_class where oid = 'public.coach_licenses'::regclass)
                 and not has_table_privilege('authenticated', 'public.coach_licenses', 'INSERT')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Angebote nur mit Lizenz',
       case when (select prosrc from pg_proc where proname = 'coaching_save_offer' and pronamespace = 'public'::regnamespace) like '%coach_license_active%'
            then 'bereit' else 'FEHLT' end
union all
select 'Automatischer Entzug bei Verwarnung und Sperre',
       count(*)::text || ' von 2'
from pg_trigger where tgname in ('gsra_coach_license_warning', 'gsra_coach_license_ban');
