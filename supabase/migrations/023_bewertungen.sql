-- =========================================================
-- GSRA 023 – Bewertungen (15.11.)
-- 1) Verkäufer im Marktplatz bewerten (ähnlich Kleinanzeigen): „TOP“, „OK“ oder „Na ja“, dazu Merkmale
--    (freundlich, zuverlässig, antwortet schnell, Artikel wie beschrieben) und ein kurzer Kommentar.
--    Bewerten darf nur, wer mit dem Verkäufer zu diesem Inserat wirklich Kontakt hatte: Es gibt einen
--    Direktchat, in dem beide geschrieben haben. Eine Bewertung pro Person und Inserat (änderbar).
-- 2) Setups kommentieren und bewerten: „hilfreich“, „okay“, „nicht hilfreich“, „entspricht nicht der
--    Beschreibung“ plus Kommentar. Nicht das eigene Setup; Pro Setups nur mit Zugang zu Pro Setups.
-- 3) Zufriedenheit im Profil: eine Zusammenfassung je Bereich (Marktplatz, Setups – Coaching folgt).
-- Schreiben nur über die Datenbank-Funktionen (prüfen die Regeln), lesen dürfen alle Angemeldeten.
-- Eigene Bewertungen löschen: selbst; fremde: Moderationsteam (landet im Protokoll).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 019 und 021 voraus.
-- =========================================================

-- 1) Tabellen
create table if not exists public.seller_ratings (
  id            uuid primary key default gen_random_uuid(),
  listing_id    text not null,
  listing_title text,
  seller_id     uuid not null references auth.users(id) on delete cascade,
  rater_id      uuid not null references auth.users(id) on delete cascade,
  rating        smallint not null check (rating in (-1, 0, 1)),   -- 1 = TOP, 0 = OK, -1 = Na ja
  tags          text[] not null default '{}'
                check (tags <@ array['freundlich', 'zuverlaessig', 'schnelle_antwort', 'wie_beschrieben']::text[]),
  comment       text check (char_length(comment) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (rater_id, listing_id),
  check (rater_id <> seller_id)
);
create index if not exists seller_ratings_seller_idx on public.seller_ratings (seller_id, created_at desc);

create table if not exists public.setup_reviews (
  id         uuid primary key default gen_random_uuid(),
  setup_id   text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  verdict    text not null check (verdict in ('hilfreich', 'okay', 'nicht_hilfreich', 'nicht_wie_beschrieben')),
  comment    text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (setup_id, user_id)
);
create index if not exists setup_reviews_setup_idx on public.setup_reviews (setup_id, created_at desc);

-- 2) Zugriff: lesen alle Angemeldeten, schreiben nur über die Funktionen, löschen selbst bzw. Moderationsteam
alter table public.seller_ratings enable row level security;
alter table public.setup_reviews enable row level security;
revoke insert, update on public.seller_ratings, public.setup_reviews from anon, authenticated;
revoke all on public.seller_ratings, public.setup_reviews from anon;

drop policy if exists "GSRA Bewertungen lesen" on public.seller_ratings;
create policy "GSRA Bewertungen lesen" on public.seller_ratings for select to authenticated using (true);
drop policy if exists "GSRA eigene Bewertung löschen" on public.seller_ratings;
create policy "GSRA eigene Bewertung löschen" on public.seller_ratings for delete to authenticated
  using (rater_id = (select auth.uid()) or (select public.is_moderator()));

drop policy if exists "GSRA Kommentare lesen" on public.setup_reviews;
create policy "GSRA Kommentare lesen" on public.setup_reviews for select to authenticated using (true);
drop policy if exists "GSRA eigenen Kommentar löschen" on public.setup_reviews;
create policy "GSRA eigenen Kommentar löschen" on public.setup_reviews for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_moderator()));

-- Wie überall: gesperrte Konten und Anmeldungen ohne Zwei-Faktor-Code (wo eingerichtet) haben keinen Zugriff
do $$
declare t text;
begin
  foreach t in array array['seller_ratings', 'setup_reviews'] loop
    execute format('drop policy if exists "Gesperrte Konten haben keinen Zugriff" on public.%I', t);
    execute format('create policy "Gesperrte Konten haben keinen Zugriff" on public.%I as restrictive for all to authenticated '
                   'using (not (select public.is_banned())) with check (not (select public.is_banned()))', t);
    execute format('drop policy if exists "GSRA Zwei-Faktor erforderlich" on public.%I', t);
    execute format('create policy "GSRA Zwei-Faktor erforderlich" on public.%I as restrictive for all to authenticated '
                   'using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

-- 3) Verkäufer bewerten
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
  if _rating not in (-1, 0, 1) then raise exception 'Bitte wähle „TOP“, „OK“ oder „Na ja“.'; end if;
  select m.id::text as id, m.user_id, m.title into _item from public.marketplace m where m.id::text = _listing_id;
  if _item.id is null then raise exception 'Dieses Inserat gibt es nicht mehr.'; end if;
  if _item.user_id = _me then raise exception 'Dein eigenes Inserat kannst du nicht bewerten.'; end if;
  -- Nur nach echtem Kontakt: Direktchat mit dem Verkäufer, in dem beide geschrieben haben
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

-- 4) Setup kommentieren und bewerten
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
  if _verdict not in ('hilfreich', 'okay', 'nicht_hilfreich', 'nicht_wie_beschrieben') then
    raise exception 'Bitte wähle eine Bewertung aus.';
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

-- 5) Zufriedenheit im Profil (Zusammenfassung je Bereich)
create or replace function public.profile_reputation(_user uuid)
returns jsonb
language sql
stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'marktplatz', (select jsonb_build_object(
        'anzahl', count(*),
        'top', count(*) filter (where rating = 1),
        'ok', count(*) filter (where rating = 0),
        'naja', count(*) filter (where rating = -1),
        'freundlich', count(*) filter (where 'freundlich' = any(tags)),
        'zuverlaessig', count(*) filter (where 'zuverlaessig' = any(tags)),
        'schnelle_antwort', count(*) filter (where 'schnelle_antwort' = any(tags)),
        'wie_beschrieben', count(*) filter (where 'wie_beschrieben' = any(tags)))
      from public.seller_ratings where seller_id = _user),
    'setups', (select jsonb_build_object(
        'anzahl', count(*),
        'hilfreich', count(*) filter (where r.verdict = 'hilfreich'),
        'okay', count(*) filter (where r.verdict = 'okay'),
        'nicht_hilfreich', count(*) filter (where r.verdict = 'nicht_hilfreich'),
        'nicht_wie_beschrieben', count(*) filter (where r.verdict = 'nicht_wie_beschrieben'))
      from public.setup_reviews r join public.setups s on s.id::text = r.setup_id
      where s.uploader_id::text = _user::text),
    'setup_stimmen', (select jsonb_build_object(
        'setups', count(*), 'likes', coalesce(sum(likes), 0), 'dislikes', coalesce(sum(dislikes), 0))
      from public.setups where uploader_id::text = _user::text)
  );
$$;

revoke execute on function public.rate_seller(text, integer, text[], text) from public, anon;
grant execute on function public.rate_seller(text, integer, text[], text) to authenticated;
revoke execute on function public.review_setup(text, text, text) from public, anon;
grant execute on function public.review_setup(text, text, text) to authenticated;
revoke execute on function public.profile_reputation(uuid) from public, anon;
grant execute on function public.profile_reputation(uuid) to authenticated;

-- 6) Löscht das Moderationsteam eine fremde Bewertung, steht das im Protokoll (021)
create or replace function public.review_log_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'seller_ratings' then
    if auth.uid() is distinct from old.rater_id then
      insert into public.moderation_log (actor_id, action, target_user, details)
      values (auth.uid(), 'bewertung_geloescht', old.rater_id,
              jsonb_build_object('inserat', old.listing_title, 'kommentar', left(coalesce(old.comment, ''), 300)));
    end if;
  elsif auth.uid() is distinct from old.user_id then
    insert into public.moderation_log (actor_id, action, target_user, details)
    values (auth.uid(), 'kommentar_geloescht', old.user_id,
            jsonb_build_object('setup', old.setup_id, 'kommentar', left(coalesce(old.comment, ''), 300)));
  end if;
  return null;
end;
$$;
revoke execute on function public.review_log_delete() from public, anon, authenticated;
drop trigger if exists gsra_review_log on public.seller_ratings;
create trigger gsra_review_log after delete on public.seller_ratings for each row execute function public.review_log_delete();
drop trigger if exists gsra_review_log on public.setup_reviews;
create trigger gsra_review_log after delete on public.setup_reviews for each row execute function public.review_log_delete();

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Tabellen für Bewertungen' as pruefung,
       count(*)::text || ' von 2' as ergebnis
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('seller_ratings', 'setup_reviews') and c.relrowsecurity
union all
select 'Funktionen für Gäste gesperrt',
       case when not has_function_privilege('anon', 'public.rate_seller(text, integer, text[], text)', 'EXECUTE')
             and not has_function_privilege('anon', 'public.review_setup(text, text, text)', 'EXECUTE')
             and not has_function_privilege('anon', 'public.profile_reputation(uuid)', 'EXECUTE')
            then 'ja' else 'NEIN' end
union all
select 'Direktes Schreiben gesperrt (nur über die Funktionen)',
       case when not has_table_privilege('authenticated', 'public.seller_ratings', 'INSERT')
             and not has_table_privilege('authenticated', 'public.setup_reviews', 'UPDATE')
            then 'ja' else 'NEIN' end;
