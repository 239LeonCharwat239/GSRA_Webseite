-- =========================================================
-- GSRA 046 – Liveries (Garage) und Videos (Community) – Entscheidungen vom 24.11.2026
--
-- Liveries: wie Coachings, nur ohne Bezahlung über die GSRA
--   * Painter wird, wer die Voraussetzungen der Coach-Lizenz erfüllt (oder schon Coach ist): Painter-Lizenz holen.
--   * Pro-Painter trägt das Admin-Team ein (wie Pro-Fahrer) – sie brauchen keine Lizenz.
--   * Entzug wie bei Coaches: durch die Moderation mit Begründung oder automatisch bei Verwarnung/Sperre;
--     die Angebote werden dann pausiert.
--   * Angebote: Titel, Beschreibung, Fahrzeugklassen, Simulationen, „Preis ab“, Lieferzeit, bis zu 6 Beispielbilder.
--     Bezahlung und Absprachen regeln Painter und Kunde selbst im Messenger – die GSRA ist nicht Vertragspartner.
-- Videos: Vorschaubild + Titel + Text + Hashtags; ein Klick öffnet das Video auf der Plattform des Kanals.
--   * Hochladen dürfen nur Pro-Fahrer (vom Admin-Team eingetragen) und Admins – keine Moderatoren, keine Abos.
--   * Gespeichert wird nur das Vorschaubild (klein, öffentlich, lange zwischengespeichert), nie das Video selbst.
-- Schreiben nur über geprüfte Funktionen, Lesen nur angemeldet, gesperrte Konten ausgeschlossen, Grenzen gegen Spam.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 014, 021, 026 und 027 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Painter-Lizenz und Pro-Painter
-- ---------------------------------------------------------
create table if not exists public.painter_licenses (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  granted_at      timestamptz,                       -- leer = nie erteilt (z. B. Pro-Painter, der gesperrt wurde)
  revoked_at      timestamptz,
  revoked_reason  text check (char_length(revoked_reason) <= 300),
  revoked_by      uuid references auth.users(id) on delete set null,
  auto_revoked    boolean not null default false
);
alter table public.painter_licenses enable row level security;
revoke all on public.painter_licenses from anon, authenticated;
grant select on public.painter_licenses to authenticated;
drop policy if exists "GSRA eigene Painter-Lizenz" on public.painter_licenses;
create policy "GSRA eigene Painter-Lizenz" on public.painter_licenses for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_moderator()));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.painter_licenses;
create policy "Gesperrte Konten haben keinen Zugriff" on public.painter_licenses as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));

create table if not exists public.pro_painters (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  added_by  uuid references auth.users(id) on delete set null,
  added_at  timestamptz not null default now()
);
alter table public.pro_painters enable row level security;
revoke all on public.pro_painters from anon, authenticated;
grant select, insert, delete on public.pro_painters to authenticated;
drop policy if exists "GSRA Pro-Painter lesen" on public.pro_painters;
create policy "GSRA Pro-Painter lesen" on public.pro_painters for select to authenticated using (true);
drop policy if exists "GSRA Pro-Painter eintragen (Admins)" on public.pro_painters;
create policy "GSRA Pro-Painter eintragen (Admins)" on public.pro_painters for insert to authenticated
  with check ((select public.is_site_admin()));
drop policy if exists "GSRA Pro-Painter entfernen (Admins)" on public.pro_painters;
create policy "GSRA Pro-Painter entfernen (Admins)" on public.pro_painters for delete to authenticated
  using ((select public.is_site_admin()));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.pro_painters;
create policy "Gesperrte Konten haben keinen Zugriff" on public.pro_painters as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));
drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.pro_painters;
create policy "GSRA Zwei-Faktor erforderlich" on public.pro_painters as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Wer einträgt, vermerkt die Datenbank selbst; jede Änderung steht im Moderationsprotokoll
create or replace function public.pro_painters_stamp()
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
create or replace function public.pro_painters_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.moderation_log (actor_id, action, target_user, details) values (auth.uid(), 'pro_painter_hinzugefuegt', new.user_id, '{}'::jsonb);
  else
    insert into public.moderation_log (actor_id, action, target_user, details) values (auth.uid(), 'pro_painter_entfernt', old.user_id, '{}'::jsonb);
  end if;
  return null;
end;
$$;
revoke execute on function public.pro_painters_stamp() from public, anon, authenticated;
revoke execute on function public.pro_painters_log() from public, anon, authenticated;
drop trigger if exists gsra_pro_painters_stamp on public.pro_painters;
create trigger gsra_pro_painters_stamp before insert on public.pro_painters for each row execute function public.pro_painters_stamp();
drop trigger if exists gsra_pro_painters_log on public.pro_painters;
create trigger gsra_pro_painters_log after insert or delete on public.pro_painters for each row execute function public.pro_painters_log();

create or replace function public.is_pro_painter(_user uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (select 1 from public.pro_painters where user_id = _user);
$$;

-- Aktiver Painter: nicht gesperrt, Lizenz nicht entzogen, und Lizenz erteilt oder Pro-Painter
create or replace function public.painter_active(_user uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select _user is not null
     and not exists (select 1 from public.user_bans b
                     where b.user_id = _user and b.lifted_at is null and (b.banned_until is null or b.banned_until > now()))
     and not exists (select 1 from public.painter_licenses l where l.user_id = _user and l.revoked_at is not null)
     and (exists (select 1 from public.painter_licenses l where l.user_id = _user and l.granted_at is not null)
          or exists (select 1 from public.pro_painters p where p.user_id = _user));
$$;

-- Stand: für sich selbst (und die Moderation) mit Fortschritt, für andere nur „aktiv/Pro“
create or replace function public.painter_status(_user uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _l public.painter_licenses;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if _user is distinct from auth.uid() and not public.is_moderator() then
    return jsonb_build_object('aktiv', public.painter_active(_user), 'pro', public.is_pro_painter(_user));
  end if;
  select * into _l from public.painter_licenses where user_id = _user;
  return jsonb_build_object(
    'aktiv', public.painter_active(_user),
    'pro', public.is_pro_painter(_user),
    'coach', public.coach_license_active(_user),
    'erteilt_am', _l.granted_at,
    'entzogen', case when _l.revoked_at is null then null
                     else jsonb_build_object('am', _l.revoked_at, 'grund', _l.revoked_reason, 'automatisch', _l.auto_revoked) end,
    'regeln', public.coach_license_rules(),
    'fortschritt', public.coach_license_progress(_user));
end;
$$;

-- Lizenz holen: gleiche Voraussetzungen wie die Coach-Lizenz (oder bereits aktive Coach-Lizenz)
create or replace function public.painter_claim_license()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
  _l  public.painter_licenses;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  select * into _l from public.painter_licenses where user_id = _me;
  if _l.granted_at is not null and _l.revoked_at is null then return 'schon_aktiv'; end if;
  if _l.revoked_at is not null and not _l.auto_revoked then
    raise exception 'Deine Painter-Lizenz wurde vom Moderationsteam entzogen. Bei Fragen wende dich bitte an die GSRA.';
  end if;
  if not ((public.coach_license_progress(_me) ->> 'alle')::boolean or public.coach_license_active(_me)) then
    raise exception 'Du erfüllst noch nicht alle Voraussetzungen für die Painter-Lizenz.';
  end if;
  insert into public.painter_licenses (user_id, granted_at) values (_me, now())
  on conflict (user_id) do update set granted_at = now(), revoked_at = null, revoked_reason = null, revoked_by = null, auto_revoked = false;
  insert into public.moderation_log (actor_id, action, target_user, details) values (_me, 'painter_lizenz_erteilt', _me, '{}'::jsonb);
  return 'erteilt';
end;
$$;

-- Moderation: entziehen (mit Begründung, Angebote pausieren) und wiederherstellen
create or replace function public.painter_license_revoke(_user uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then raise exception 'Nur für das Moderationsteam.'; end if;
  if _user is null or _user = auth.uid() then raise exception 'Die eigene Painter-Lizenz lässt sich nicht entziehen.'; end if;
  if char_length(trim(coalesce(_reason, ''))) < 5 then raise exception 'Bitte gib eine Begründung an (mindestens 5 Zeichen).'; end if;
  insert into public.painter_licenses (user_id, granted_at, revoked_at, revoked_reason, revoked_by, auto_revoked)
  values (_user, null, now(), left(trim(_reason), 300), auth.uid(), false)
  on conflict (user_id) do update set revoked_at = now(), revoked_reason = excluded.revoked_reason,
                                      revoked_by = excluded.revoked_by, auto_revoked = false;
  update public.livery_offers set active = false, updated_at = now() where painter_id = _user and active;
  insert into public.moderation_log (actor_id, action, target_user, details)
  values (auth.uid(), 'painter_lizenz_entzogen', _user, jsonb_build_object('grund', left(trim(_reason), 300)));
end;
$$;

create or replace function public.painter_license_restore(_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then raise exception 'Nur für das Moderationsteam.'; end if;
  update public.painter_licenses set revoked_at = null, revoked_reason = null, revoked_by = null, auto_revoked = false
  where user_id = _user and revoked_at is not null;
  if not found then raise exception 'Diese Person hat keine entzogene Painter-Lizenz.'; end if;
  delete from public.painter_licenses where user_id = _user and granted_at is null;
  insert into public.moderation_log (actor_id, action, target_user, details) values (auth.uid(), 'painter_lizenz_wiederhergestellt', _user, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------
-- 2) Livery-Angebote
-- ---------------------------------------------------------
create table if not exists public.livery_offers (
  id               uuid primary key default gen_random_uuid(),
  painter_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title            text not null check (char_length(title) between 3 and 80),
  description      text not null default '' check (char_length(description) <= 2000),
  classes          text[] not null default '{}'
                   check (cardinality(classes) between 1 and 9
                          and classes <@ array['formel', 'prototyp', 'gt', 'tourenwagen', 'cup', 'stockcar', 'rallye', 'kart', 'sonstige']),
  simulations      text[] not null default '{}' check (cardinality(simulations) <= 12),
  price_from_cents integer check (price_from_cents is null or price_from_cents between 0 and 500000),
  delivery_days    integer check (delivery_days is null or delivery_days between 1 and 120),
  images           text[] not null default '{}' check (cardinality(images) <= 6),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists livery_offers_painter_idx on public.livery_offers (painter_id);
create index if not exists livery_offers_updated_idx on public.livery_offers (updated_at desc);
alter table public.livery_offers enable row level security;
revoke all on public.livery_offers from anon, authenticated;
grant select on public.livery_offers to authenticated;   -- schreiben nur über die Funktionen unten
drop policy if exists "GSRA Livery-Angebote ansehen" on public.livery_offers;
create policy "GSRA Livery-Angebote ansehen" on public.livery_offers for select to authenticated
  using (painter_id = (select auth.uid())
         or (active and public.painter_active(painter_id))
         or (select public.is_moderator()));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.livery_offers;
create policy "Gesperrte Konten haben keinen Zugriff" on public.livery_offers as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));

create table if not exists public.livery_saves (
  user_id  uuid not null references auth.users(id) on delete cascade,
  saved_at timestamptz not null default now()
);
create index if not exists livery_saves_idx on public.livery_saves (user_id, saved_at);
alter table public.livery_saves enable row level security;
revoke all on public.livery_saves from anon, authenticated;

-- Anlegen oder ändern (Deaktivieren geht immer, Aktivieren nur mit aktiver Lizenz); höchstens 5 Angebote
create or replace function public.livery_offer_save(_id uuid, _title text, _description text, _classes text[], _simulations text[],
                                                    _price_from_cents integer, _delivery_days integer, _images text[], _active boolean default true)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me   uuid := auth.uid();
  _row  uuid;
  _sim  text;
  _img  text;
  _clean_sims text[] := '{}';
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if coalesce(_active, true) and not public.painter_active(_me) then
    raise exception 'Liveries anbieten können Painter mit Lizenz und Pro-Painter.';
  end if;
  if (select count(*) from public.livery_saves where user_id = _me and saved_at > now() - interval '1 hour') >= 30 then
    raise exception 'Zu viele Änderungen in kurzer Zeit. Bitte warte etwas.';
  end if;
  if char_length(trim(coalesce(_title, ''))) < 3 or char_length(trim(_title)) > 80 then
    raise exception 'Der Titel braucht 3 bis 80 Zeichen.';
  end if;
  if char_length(coalesce(_description, '')) > 2000 then raise exception 'Die Beschreibung darf höchstens 2.000 Zeichen haben.'; end if;
  if coalesce(cardinality(_classes), 0) = 0 then raise exception 'Bitte wähle mindestens eine Fahrzeugklasse.'; end if;
  foreach _sim in array coalesce(_simulations, '{}') loop
    _sim := trim(_sim);
    if char_length(_sim) between 2 and 40 and _sim !~ '[<>"`]' then _clean_sims := array_append(_clean_sims, _sim); end if;
  end loop;
  -- Beispielbilder: nur eigene Dateien im Speicher „liveries“
  foreach _img in array coalesce(_images, '{}') loop
    if _img !~ ('^' || _me::text || '/[A-Za-z0-9_.-]+\.(jpg|jpeg|webp|png)$') or char_length(_img) > 160 then
      raise exception 'Ungültiges Beispielbild.';
    end if;
  end loop;

  if _id is null then
    if (select count(*) from public.livery_offers where painter_id = _me) >= 5 then
      raise exception 'Du kannst höchstens 5 Livery-Angebote anlegen.';
    end if;
    insert into public.livery_offers (painter_id, title, description, classes, simulations, price_from_cents, delivery_days, images, active)
    values (_me, trim(_title), regexp_replace(coalesce(_description, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'),
            _classes, _clean_sims, _price_from_cents, _delivery_days, coalesce(_images, '{}'), coalesce(_active, true))
    returning id into _row;
  else
    update public.livery_offers
       set title = trim(_title), description = regexp_replace(coalesce(_description, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'),
           classes = _classes, simulations = _clean_sims, price_from_cents = _price_from_cents, delivery_days = _delivery_days,
           images = coalesce(_images, '{}'), active = coalesce(_active, true), updated_at = now()
     where id = _id and painter_id = _me
    returning id into _row;
    if _row is null then raise exception 'Dieses Angebot gehört dir nicht.'; end if;
  end if;
  insert into public.livery_saves (user_id) values (_me);
  delete from public.livery_saves where saved_at < now() - interval '1 day';
  return _row;
end;
$$;

-- Löschen: eigene Angebote; die Moderation darf alle löschen. Gibt die Bildpfade zurück (zum Aufräumen im Speicher).
create or replace function public.livery_offer_delete(_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  _imgs text[];
  _owner uuid;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  select painter_id, images into _owner, _imgs from public.livery_offers where id = _id;
  if _owner is null then raise exception 'Dieses Angebot gibt es nicht mehr.'; end if;
  if _owner <> auth.uid() and not public.is_moderator() then raise exception 'Dieses Angebot gehört dir nicht.'; end if;
  delete from public.livery_offers where id = _id;
  if _owner <> auth.uid() then
    insert into public.moderation_log (actor_id, action, target_user, details)
    values (auth.uid(), 'livery_angebot_geloescht', _owner, jsonb_build_object('angebot', _id));
  end if;
  return coalesce(_imgs, '{}');
end;
$$;

-- Automatischer Entzug bei Verwarnung oder Sperre (auch Pro-Painter ohne Lizenz), Angebote pausieren
create or replace function public.painter_license_auto_revoke()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _reason text := case when tg_table_name = 'user_bans' then 'Automatisch: Sperre' else 'Automatisch: Verwarnung' end;
  _hit    boolean := false;
begin
  update public.painter_licenses set revoked_at = now(), revoked_reason = _reason, revoked_by = null, auto_revoked = true
  where user_id = new.user_id and granted_at is not null and revoked_at is null;
  _hit := found;
  if not _hit and exists (select 1 from public.pro_painters where user_id = new.user_id)
     and not exists (select 1 from public.painter_licenses where user_id = new.user_id) then
    insert into public.painter_licenses (user_id, granted_at, revoked_at, revoked_reason, auto_revoked)
    values (new.user_id, null, now(), _reason, true);
    _hit := true;
  end if;
  if _hit then
    update public.livery_offers set active = false, updated_at = now() where painter_id = new.user_id and active;
    insert into public.moderation_log (actor_id, action, target_user, details)
    values (auth.uid(), 'painter_lizenz_automatisch', new.user_id, jsonb_build_object('grund', _reason));
  end if;
  return null;
end;
$$;
revoke execute on function public.painter_license_auto_revoke() from public, anon, authenticated;
drop trigger if exists gsra_painter_license_warning on public.user_warnings;
create trigger gsra_painter_license_warning after insert on public.user_warnings for each row execute function public.painter_license_auto_revoke();
drop trigger if exists gsra_painter_license_ban on public.user_bans;
create trigger gsra_painter_license_ban after insert on public.user_bans for each row execute function public.painter_license_auto_revoke();

-- ---------------------------------------------------------
-- 3) Videos (nur Vorschaubild und Link – das Video bleibt auf der Plattform des Kanals)
-- ---------------------------------------------------------
create table if not exists public.pro_videos (
  id           uuid primary key default gen_random_uuid(),
  uploader_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url          text not null check (char_length(url) between 12 and 500 and url ~ '^https://[^[:space:]<>"''`]+$'),
  title        text not null check (char_length(title) between 3 and 100),
  description  text not null default '' check (char_length(description) <= 1500),
  tags         text[] not null default '{}' check (cardinality(tags) <= 10),
  thumbnail    text check (thumbnail is null or char_length(thumbnail) <= 160),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists pro_videos_created_idx on public.pro_videos (created_at desc);
create index if not exists pro_videos_uploader_idx on public.pro_videos (uploader_id);
alter table public.pro_videos enable row level security;
revoke all on public.pro_videos from anon, authenticated;
grant select on public.pro_videos to authenticated;

-- Hochladen dürfen Pro-Fahrer und Admins (Moderatoren und Abos nicht)
create or replace function public.video_uploader_ok(_user uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select _user is not null
     and not exists (select 1 from public.user_bans b
                     where b.user_id = _user and b.lifted_at is null and (b.banned_until is null or b.banned_until > now()))
     and (public.is_pro_creator(_user) or exists (select 1 from public.profiles p where p.id = _user and p.role = 'admin'));
$$;

drop policy if exists "GSRA Videos ansehen" on public.pro_videos;
create policy "GSRA Videos ansehen" on public.pro_videos for select to authenticated
  using (uploader_id = (select auth.uid()) or public.video_uploader_ok(uploader_id) or (select public.is_moderator()));
drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.pro_videos;
create policy "Gesperrte Konten haben keinen Zugriff" on public.pro_videos as restrictive for all to authenticated
  using (not (select public.is_banned())) with check (not (select public.is_banned()));

create or replace function public.video_save(_id uuid, _url text, _title text, _description text, _tags text[], _thumbnail text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me   uuid := auth.uid();
  _row  uuid;
  _tag  text;
  _clean text[] := '{}';
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if not public.video_uploader_ok(_me) then raise exception 'Videos veröffentlichen können Pro-Fahrer und Admins.'; end if;
  if _id is null and (select count(*) from public.pro_videos where uploader_id = _me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Du hast heute schon 20 Videos veröffentlicht. Morgen geht es weiter.';
  end if;
  _url := trim(coalesce(_url, ''));
  if char_length(_url) < 12 or char_length(_url) > 500 or _url !~ '^https://[^[:space:]<>"''`]+$' then
    raise exception 'Bitte gib einen gültigen Link an, der mit https:// beginnt.';
  end if;
  if char_length(trim(coalesce(_title, ''))) < 3 or char_length(trim(_title)) > 100 then
    raise exception 'Der Titel braucht 3 bis 100 Zeichen.';
  end if;
  if char_length(coalesce(_description, '')) > 1500 then raise exception 'Der Text darf höchstens 1.500 Zeichen haben.'; end if;
  foreach _tag in array coalesce(_tags, '{}') loop
    _tag := ltrim(trim(_tag), '#');
    if _tag ~ '^[A-Za-z0-9_ÄÖÜäöüß-]+$' and char_length(_tag) <= 30 and not (_tag = any(_clean)) then
      _clean := array_append(_clean, _tag);
    end if;
  end loop;
  if cardinality(_clean) > 10 then _clean := _clean[1:10]; end if;
  if _thumbnail is not null and (_thumbnail !~ ('^' || _me::text || '/[A-Za-z0-9_.-]+\.(jpg|jpeg|webp)$') or char_length(_thumbnail) > 160) then
    raise exception 'Ungültiges Vorschaubild.';
  end if;
  if _id is null then
    insert into public.pro_videos (uploader_id, url, title, description, tags, thumbnail)
    values (_me, _url, trim(_title), regexp_replace(coalesce(_description, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'), _clean, _thumbnail)
    returning id into _row;
  else
    update public.pro_videos
       set url = _url, title = trim(_title), description = regexp_replace(coalesce(_description, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'),
           tags = _clean, thumbnail = _thumbnail, updated_at = now()
     where id = _id and uploader_id = _me
    returning id into _row;
    if _row is null then raise exception 'Dieses Video gehört dir nicht.'; end if;
  end if;
  return _row;
end;
$$;

-- Löschen: eigene Videos, Admins und Moderation alle (Protokoll). Gibt das Vorschaubild zurück (zum Aufräumen).
create or replace function public.video_delete(_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner uuid;
  _thumb text;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  select uploader_id, thumbnail into _owner, _thumb from public.pro_videos where id = _id;
  if _owner is null then raise exception 'Dieses Video gibt es nicht mehr.'; end if;
  if _owner <> auth.uid() and not (public.is_moderator() or public.is_site_admin()) then
    raise exception 'Dieses Video gehört dir nicht.';
  end if;
  delete from public.pro_videos where id = _id;
  if _owner <> auth.uid() then
    insert into public.moderation_log (actor_id, action, target_user, details)
    values (auth.uid(), 'video_geloescht', _owner, jsonb_build_object('video', _id));
  end if;
  return _thumb;
end;
$$;

-- ---------------------------------------------------------
-- 4) Speicher: Beispielbilder (liveries) und Vorschaubilder (videos) – öffentlich, klein, nur eigener Ordner
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('liveries', 'liveries', true, 3145728, array['image/jpeg', 'image/webp', 'image/png']),
       ('videos', 'videos', true, 1048576, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.gsra_upload_allowed(_bucket text, _name text)
returns boolean
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _first text := split_part(coalesce(_name, ''), '/', 1);
begin
  if auth.uid() is null or public.is_banned() or _first <> auth.uid()::text then return false; end if;
  if coalesce(array_length(string_to_array(_name, '/'), 1), 0) <> 2 then return false; end if;
  if _bucket = 'liveries' then return public.painter_active(auth.uid()); end if;
  if _bucket = 'videos' then return public.video_uploader_ok(auth.uid()); end if;
  return false;
end;
$$;

drop policy if exists "GSRA Liveries und Videos hochladen" on storage.objects;
create policy "GSRA Liveries und Videos hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('liveries', 'videos') and public.gsra_upload_allowed(bucket_id, name));
-- Zusätzlich einschränkend: Auch ältere, großzügige Regeln öffnen diese beiden Speicher nicht
drop policy if exists "GSRA Liveries und Videos nur berechtigt" on storage.objects;
create policy "GSRA Liveries und Videos nur berechtigt" on storage.objects
  as restrictive for insert
  with check (bucket_id not in ('liveries', 'videos') or public.gsra_upload_allowed(bucket_id, name));
drop policy if exists "GSRA Liveries und Videos eigene löschen" on storage.objects;
create policy "GSRA Liveries und Videos eigene löschen" on storage.objects
  for delete to authenticated
  using (bucket_id in ('liveries', 'videos') and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------
-- 5) Rechte: nur angemeldet; interne Prüfungen nicht direkt aufrufbar
-- ---------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.painter_status(uuid)', 'public.painter_claim_license()', 'public.painter_license_revoke(uuid, text)',
    'public.painter_license_restore(uuid)', 'public.livery_offer_save(uuid, text, text, text[], text[], integer, integer, text[], boolean)',
    'public.livery_offer_delete(uuid)', 'public.video_save(uuid, text, text, text, text[], text)', 'public.video_delete(uuid)',
    'public.painter_active(uuid)', 'public.is_pro_painter(uuid)', 'public.video_uploader_ok(uuid)',
    'public.gsra_upload_allowed(text, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „ja“, „ja“, „bereit“)
-- ---------------------------------------------------------
select 'Painter, Angebote und Videos' as pruefung,
       case when to_regclass('public.painter_licenses') is not null and to_regclass('public.livery_offers') is not null
             and to_regclass('public.pro_videos') is not null and to_regprocedure('public.livery_offer_save(uuid, text, text, text[], text[], integer, integer, text[], boolean)') is not null
             and to_regprocedure('public.video_save(uuid, text, text, text, text[], text)') is not null
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Schreiben nur über geprüfte Funktionen',
       case when not has_table_privilege('authenticated', 'public.livery_offers', 'insert')
             and not has_table_privilege('authenticated', 'public.livery_offers', 'update')
             and not has_table_privilege('authenticated', 'public.pro_videos', 'insert')
             and not has_table_privilege('authenticated', 'public.painter_licenses', 'insert')
            then 'ja' else 'NEIN' end
union all
select 'Gäste ausgeschlossen',
       case when not has_table_privilege('anon', 'public.livery_offers', 'select')
             and not has_table_privilege('anon', 'public.pro_videos', 'select')
             and not has_function_privilege('anon', 'public.video_save(uuid, text, text, text, text[], text)', 'execute')
            then 'ja' else 'NEIN' end
union all
select 'Speicher für Beispiel- und Vorschaubilder',
       case when (select count(*) from storage.buckets where id in ('liveries', 'videos') and public and file_size_limit <= 3145728) = 2
            then 'bereit' else 'FEHLT' end;
