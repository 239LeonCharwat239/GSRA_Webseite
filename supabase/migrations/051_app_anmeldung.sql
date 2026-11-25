-- =========================================================
-- GSRA – 051: GSRA-App über die Webseite anmelden (Kopplung, ohne Passwort in der App)
-- =========================================================
-- Ablauf (wie bei großen Desktop-Apps, Verfahren „Loopback + PKCE“):
--  1) Die App erzeugt ein Geheimnis (bleibt in der App) und schickt nur dessen Prüfsumme („challenge“) mit,
--     wenn sie die Seite app-verbinden.html im Browser öffnet.
--  2) Wer auf der Webseite angemeldet ist, bestätigt dort. app_link_approve legt eine Kopplung an (5 Minuten gültig)
--     und gibt einmalig einen Zufallscode zurück; gespeichert wird nur dessen Prüfsumme.
--  3) Die Webseite schickt den Code direkt an die App auf DIESEM PC (http://127.0.0.1:<port>) – ein fremder Rechner
--     bekommt ihn nie, auch nicht über einen weitergeleiteten Link.
--  4) Die App tauscht Code + Geheimnis bei der Server-Funktion „app-anmelden“ ein. Nur sie darf app_link_take
--     aufrufen: Code genau einmal, nur mit passendem Geheimnis, nur bis zum Ablauf, nicht für gesperrte Konten.
--     Danach meldet sich die App mit einem einmaligen Anmelde-Schlüssel an; Konten mit Zwei-Faktor geben den Code
--     zusätzlich in der App ein (019 gilt weiter).
-- Abgesichert: Tabelle für niemanden lesbar oder beschreibbar; Bestätigen nur angemeldet, nicht gesperrt, mit
-- Zwei-Faktor-Bestätigung (falls eingerichtet), höchstens 10 Kopplungen pro Stunde; Codes nur als Prüfsumme.
-- Darf mehrfach laufen. Am Ende: Kontrollabfrage („bereit“ …).
-- =========================================================

create table if not exists public.app_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  challenge   text not null check (challenge ~ '^[A-Za-z0-9_-]{43}$'),
  code_hash   text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  geraet      text not null check (char_length(geraet) between 1 and 60),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '5 minutes',
  used_at     timestamptz
);
create index if not exists app_links_user_idx on public.app_links (user_id, created_at desc);
alter table public.app_links enable row level security;
revoke all on public.app_links from public, anon, authenticated;
-- Keine Regel = kein Zugriff für Angemeldete und Gäste; nur die Funktionen unten arbeiten mit der Tabelle.

-- Bestätigen auf der Webseite (angemeldete Person): gibt den Einmal-Code zurück
create or replace function public.app_link_approve(_challenge text, _geraet text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _me   uuid := auth.uid();
  _code text;
  _g    text := nullif(left(btrim(regexp_replace(regexp_replace(coalesce(_geraet, ''), '[\x01-\x1F\x7F<>`"]', '', 'g'), '\s+', ' ', 'g')), 60), '');
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if not public.mfa_ok() then raise exception 'Bitte bestätige zuerst deine Zwei-Faktor-Anmeldung.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _challenge is null or _challenge !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'Ungültige Anfrage der App. Bitte starte die Anmeldung in der App neu.';
  end if;
  delete from public.app_links where expires_at < now() - interval '1 day';
  if (select count(*) from public.app_links where user_id = _me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Zu viele Anmeldungen in kurzer Zeit. Bitte warte etwas.';
  end if;
  -- 2 × 122 Zufallsbits aus dem sicheren Zufallsgenerator der Datenbank
  _code := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.app_links (user_id, challenge, code_hash, geraet)
  values (_me, _challenge, encode(sha256(convert_to(_code, 'UTF8')), 'hex'), coalesce(_g, 'PC'));
  return _code;
end;
$$;

-- Nur für die Server-Funktion „app-anmelden“: Code einlösen. Jeder Code zählt genau EINEN Versuch – auch ein
-- falsches Geheimnis verbraucht ihn.
create or replace function public.app_link_take(_code_hash text, _challenge text)
returns table (konto uuid, adresse text)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid   uuid;
  _ch    text;
  _bis   timestamptz;
begin
  if _code_hash is null or _code_hash !~ '^[0-9a-f]{64}$' or _challenge is null or _challenge !~ '^[A-Za-z0-9_-]{43,128}$' then
    return;
  end if;
  update public.app_links l set used_at = now()
   where l.code_hash = _code_hash and l.used_at is null
   returning l.user_id, l.challenge, l.expires_at into _uid, _ch, _bis;
  if _uid is null or _ch <> _challenge or _bis <= now() then return; end if;
  if exists (select 1 from public.user_bans b where b.user_id = _uid and b.lifted_at is null
             and (b.banned_until is null or b.banned_until > now())) then
    return;
  end if;
  return query select u.id, u.email::text from auth.users u where u.id = _uid and u.email is not null;
end;
$$;

do $$
begin
  revoke execute on function public.app_link_approve(text, text) from public, anon;
  grant execute on function public.app_link_approve(text, text) to authenticated;
  revoke execute on function public.app_link_take(text, text) from public, anon, authenticated;
  begin
    grant execute on function public.app_link_take(text, text) to service_role;
  exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
  end;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------
select 'App-Anmeldung' as pruefung,
       case when to_regclass('public.app_links') is not null
             and to_regprocedure('public.app_link_approve(text, text)') is not null
             and to_regprocedure('public.app_link_take(text, text)') is not null
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Einlösen nur für den Server',
       case when not has_function_privilege('authenticated', 'public.app_link_take(text, text)', 'execute')
             and not has_function_privilege('anon', 'public.app_link_take(text, text)', 'execute')
            then 'ja' else 'NEIN' end
union all
select 'Tabelle für Webseite gesperrt',
       case when not has_table_privilege('authenticated', 'public.app_links', 'select')
             and not has_table_privilege('anon', 'public.app_links', 'select')
            then 'ja' else 'NEIN' end;
