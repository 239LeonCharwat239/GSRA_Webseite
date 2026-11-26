-- =========================================================
-- GSRA – 056: Startseite wie eine Zeitung – Beiträge der Admins mit Bildern (Wunsch 26.11.)
-- =========================================================
-- Admins veröffentlichen auf der Startseite kurze Beiträge: Überschrift, bis zu 6 Bilder, Text (bis ≈ 1.000 Wörter),
-- z. B. „Wir sind auf der Simracing Expo 2027 – besucht uns an Stand XYZ“. Alle (auch Gäste) lesen die
-- veröffentlichten Beiträge; wichtige lassen sich oben anheften.
-- Abgesichert:
--  * Schreiben, Ändern, Löschen nur über geprüfte Funktionen und nur durch Admins mit bestätigter
--    Zwei-Faktor-Anmeldung (is_site_admin, 018); jede Aktion steht im Moderationsprotokoll.
--  * Texte mit Grenzen in der Datenbank (Überschrift 3–140 Zeichen, Text bis 7.000), Steuerzeichen entfernt
--    (Absätze bleiben); Ausgabe auf der Webseite nur per textContent.
--  * Bilder nur im eigenen Speicher „startseite“: öffentlich lesbar, höchstens 3 MB, nur JPEG/WebP/PNG, hochladen
--    und löschen nur Admins und nur im eigenen Ordner; ein Beitrag darf nur Bilder aus diesem Speicher nennen.
--  * Gegen Versehen/Spam: höchstens 30 Beiträge pro Tag.
-- Darf mehrfach laufen. Am Ende: Kontrollabfrage („bereit“ …).
-- =========================================================

create table if not exists public.home_posts (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid references auth.users(id) on delete set null,
  titel            text not null check (char_length(titel) between 3 and 140),
  text             text not null default '' check (char_length(text) <= 7000),
  bilder           text[] not null default '{}' check (coalesce(array_length(bilder, 1), 0) <= 6),
  veroeffentlicht  boolean not null default true,
  angeheftet       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists home_posts_liste_idx on public.home_posts (veroeffentlicht, angeheftet desc, created_at desc);

alter table public.home_posts enable row level security;
revoke all on public.home_posts from public, anon, authenticated;
grant select on public.home_posts to anon, authenticated;

-- Gäste lesen nur Veröffentlichtes (ohne Admin-Prüfung – die dürfen Gäste nicht aufrufen); Angemeldete ebenso,
-- Admins zusätzlich ihre Entwürfe
drop policy if exists "GSRA Startseite lesen" on public.home_posts;
create policy "GSRA Startseite lesen" on public.home_posts for select to anon
  using (veroeffentlicht);
drop policy if exists "GSRA Startseite lesen angemeldet" on public.home_posts;
create policy "GSRA Startseite lesen angemeldet" on public.home_posts for select to authenticated
  using (veroeffentlicht or (select public.is_site_admin()));

-- Pfad eines Startseiten-Bildes: <Admin-ID>/<Dateiname>
create or replace function public.home_bild_ok(_pfad text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(_pfad ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,79}\.(jpe?g|webp|png)$'
                  and _pfad !~ '\.\.', false);
$$;

create or replace function public.home_post_save(_id uuid, _titel text, _text text, _bilder text[],
                                                 _veroeffentlicht boolean, _angeheftet boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me    uuid := auth.uid();
  _t     text := btrim(regexp_replace(coalesce(_titel, ''), '[[:cntrl:]]', ' ', 'g'));
  _body  text := btrim(regexp_replace(regexp_replace(coalesce(_text, ''), '\r\n?', E'\n', 'g'), '[\x01-\x09\x0B-\x1F\x7F]', ' ', 'g'));
  _b     text[] := coalesce(_bilder, '{}');
  _p     text;
  _neu   uuid;
begin
  if _me is null or not public.is_site_admin() then
    raise exception 'Beiträge auf der Startseite schreiben nur Admins (mit bestätigter Zwei-Faktor-Anmeldung).';
  end if;
  if char_length(_t) < 3 or char_length(_t) > 140 then raise exception 'Die Überschrift braucht 3 bis 140 Zeichen.'; end if;
  if char_length(_body) > 7000 then raise exception 'Der Text darf höchstens 7.000 Zeichen haben.'; end if;
  if coalesce(array_length(_b, 1), 0) > 6 then raise exception 'Höchstens 6 Bilder pro Beitrag.'; end if;
  foreach _p in array _b loop
    if not public.home_bild_ok(_p) then raise exception 'Ungültiges Bild.'; end if;
  end loop;

  if _id is null then
    if (select count(*) from public.home_posts where created_at > now() - interval '1 day') >= 30 then
      raise exception 'Heute sind schon 30 Beiträge erschienen – bitte morgen weiter.';
    end if;
    insert into public.home_posts (author_id, titel, text, bilder, veroeffentlicht, angeheftet)
    values (_me, _t, _body, _b, coalesce(_veroeffentlicht, true), coalesce(_angeheftet, false))
    returning id into _neu;
    insert into public.moderation_log (actor_id, action, details) values (_me, 'startseite_beitrag_neu', jsonb_build_object('beitrag', _neu, 'titel', _t));
    return _neu;
  end if;

  update public.home_posts
     set titel = _t, text = _body, bilder = _b, veroeffentlicht = coalesce(_veroeffentlicht, veroeffentlicht),
         angeheftet = coalesce(_angeheftet, angeheftet), updated_at = now()
   where id = _id
  returning id into _neu;
  if _neu is null then raise exception 'Diesen Beitrag gibt es nicht.'; end if;
  insert into public.moderation_log (actor_id, action, details) values (_me, 'startseite_beitrag_geaendert', jsonb_build_object('beitrag', _id, 'titel', _t));
  return _neu;
end;
$$;

-- Löschen: gibt die Bildpfade zurück, damit die Webseite die Dateien aus dem Speicher entfernt
create or replace function public.home_post_delete(_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  _bilder text[];
  _titel  text;
begin
  if auth.uid() is null or not public.is_site_admin() then
    raise exception 'Beiträge auf der Startseite löschen nur Admins (mit bestätigter Zwei-Faktor-Anmeldung).';
  end if;
  delete from public.home_posts where id = _id returning bilder, titel into _bilder, _titel;
  if _titel is null then raise exception 'Diesen Beitrag gibt es nicht.'; end if;
  insert into public.moderation_log (actor_id, action, details) values (auth.uid(), 'startseite_beitrag_geloescht', jsonb_build_object('beitrag', _id, 'titel', _titel));
  return coalesce(_bilder, '{}');
end;
$$;

-- ---------------------------------------------------------
-- Speicher für Startseiten-Bilder
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('startseite', 'startseite', true, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "GSRA Startseite Bilder hochladen" on storage.objects;
create policy "GSRA Startseite Bilder hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'startseite' and public.is_site_admin()
              and (storage.foldername(name))[1] = auth.uid()::text and public.home_bild_ok(name));
-- Zusätzlich einschränkend: Auch ältere, großzügige Regeln öffnen diesen Speicher nicht
drop policy if exists "GSRA Startseite nur Admins" on storage.objects;
create policy "GSRA Startseite nur Admins" on storage.objects
  as restrictive for insert
  with check (bucket_id <> 'startseite' or (public.is_site_admin() and public.home_bild_ok(name)));
drop policy if exists "GSRA Startseite Bilder löschen" on storage.objects;
create policy "GSRA Startseite Bilder löschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'startseite' and public.is_site_admin());

-- ---------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------
revoke execute on function public.home_post_save(uuid, text, text, text[], boolean, boolean) from public, anon;
revoke execute on function public.home_post_delete(uuid) from public, anon;
grant execute on function public.home_post_save(uuid, text, text, text[], boolean, boolean) to authenticated;
grant execute on function public.home_post_delete(uuid) to authenticated;
revoke execute on function public.home_bild_ok(text) from public;
grant execute on function public.home_bild_ok(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------
select 'Startseite 056' as pruefung,
       case when to_regclass('public.home_posts') is not null
             and to_regprocedure('public.home_post_save(uuid, text, text, text[], boolean, boolean)') is not null
             and to_regprocedure('public.home_post_delete(uuid)') is not null
             and exists (select 1 from storage.buckets where id = 'startseite' and public and file_size_limit <= 3145728)
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Schreiben nur über Funktionen',
       case when not has_table_privilege('authenticated', 'public.home_posts', 'insert')
             and not has_table_privilege('authenticated', 'public.home_posts', 'update')
             and not has_table_privilege('authenticated', 'public.home_posts', 'delete')
            then 'ja' else 'NEIN' end
union all
select 'Gäste ausgeschlossen vom Schreiben',
       case when not has_function_privilege('anon', 'public.home_post_save(uuid, text, text, text[], boolean, boolean)', 'execute')
            then 'ja' else 'NEIN' end;
