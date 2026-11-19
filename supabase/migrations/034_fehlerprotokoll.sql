-- =========================================================
-- GSRA 034 – Fehlerprotokoll der Webseite (Sicherheitsbericht Nr. 12, 19.11.)
-- Die Webseite meldet JavaScript-Fehler und technische Fehlermeldungen, damit das Team Probleme bemerkt, bevor
-- sich jemand beschwert. Gespeichert wird nur das Nötigste: Seite (ohne Parameter), Fehlertext, Datei/Zeile,
-- Browser-Kennung und – falls angemeldet – die Konto-ID (beim Löschen des Kontos entfernt).
--  * Lesen und Löschen: nur Website-Admins (Moderationsseite → „Fehler“).
--  * Schreiben: nur über die Funktion log_client_error, auch ohne Anmeldung (Fehler passieren auch beim Login).
--    Gleicher Fehler auf derselben Seite innerhalb von 10 Minuten wird nur gezählt; höchstens 30 neue Einträge
--    pro Konto und 500 insgesamt pro Stunde – mehr wird verworfen.
--  * Einträge verschwinden nach 30 Tagen automatisch.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen).
-- =========================================================

create table if not exists public.client_errors (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  count       integer not null default 1 check (count >= 1),
  user_id     uuid references auth.users(id) on delete set null,
  page        text not null check (char_length(page) <= 200),
  message     text not null check (char_length(message) between 1 and 500),
  source      text check (char_length(source) <= 300),
  line        integer,
  col         integer,
  user_agent  text check (char_length(user_agent) <= 300)
);
create index if not exists client_errors_seen_idx on public.client_errors (last_seen desc);
create index if not exists client_errors_created_idx on public.client_errors (created_at);

alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
grant select, delete on public.client_errors to authenticated;
drop policy if exists "GSRA Fehlerprotokoll nur Admins" on public.client_errors;
create policy "GSRA Fehlerprotokoll nur Admins" on public.client_errors for select to authenticated
  using ((select public.is_site_admin()));
drop policy if exists "GSRA Fehlerprotokoll leeren nur Admins" on public.client_errors;
create policy "GSRA Fehlerprotokoll leeren nur Admins" on public.client_errors for delete to authenticated
  using ((select public.is_site_admin()));

create or replace function public.log_client_error(_page text, _message text, _source text default null,
                                                   _line integer default null, _col integer default null,
                                                   _user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid  uuid := auth.uid();
  _msg  text := left(btrim(regexp_replace(coalesce(_message, ''), '\s+', ' ', 'g')), 500);
  _pg   text := left(split_part(split_part(coalesce(_page, ''), '?', 1), '#', 1), 200);
  _src  text := nullif(left(split_part(split_part(coalesce(_source, ''), '?', 1), '#', 1), 300), '');
  _id   bigint;
begin
  if _msg = '' then return; end if;
  -- Gleicher Fehler auf derselben Seite kurz hintereinander: nur zählen
  select id into _id from public.client_errors
  where page = _pg and message = _msg and user_id is not distinct from _uid and last_seen > now() - interval '10 minutes'
  order by id desc limit 1;
  if _id is not null then
    update public.client_errors set count = count + 1, last_seen = now() where id = _id;
    return;
  end if;
  -- Obergrenzen gegen Missbrauch
  if _uid is not null and (select count(*) from public.client_errors where user_id = _uid and created_at > now() - interval '1 hour') >= 30 then
    return;
  end if;
  if (select count(*) from public.client_errors where created_at > now() - interval '1 hour') >= 500 then
    return;
  end if;
  insert into public.client_errors (user_id, page, message, source, line, col, user_agent)
  values (_uid, _pg, _msg, _src, _line, _col, nullif(left(coalesce(_user_agent, ''), 300), ''));
  -- Aufräumen: nach 30 Tagen weg
  delete from public.client_errors where created_at < now() - interval '30 days';
end;
$$;

revoke execute on function public.log_client_error(text, text, text, integer, integer, text) from public;
grant execute on function public.log_client_error(text, text, text, integer, integer, text) to anon, authenticated;

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „nur Admins“)
-- ---------------------------------------------------------
select 'Fehlerprotokoll' as pruefung,
       case when to_regclass('public.client_errors') is not null
             and to_regprocedure('public.log_client_error(text, text, text, integer, integer, text)') is not null
             and (select relrowsecurity from pg_class where oid = 'public.client_errors'::regclass)
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Lesen',
       case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'client_errors') = 2
             and not has_table_privilege('anon', 'public.client_errors', 'select')
            then 'nur Admins' else 'PRÜFEN' end;
