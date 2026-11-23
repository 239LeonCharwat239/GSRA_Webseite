-- =========================================================
-- GSRA 042 – E-Mail bei Anmeldung von einem neuen Gerät (23.11.)
--  * Die Datenbank prüft alle 5 Minuten selbst, welche Anmeldungen neu sind (Tabelle auth.sessions; gelesen nur von
--    einer Funktion für den Server). Ein Angreifer kann die Prüfung deshalb nicht umgehen – anders als bei einer
--    Meldung, die der Browser nach dem Login schickt.
--  * Gerät = Browser + Betriebssystem + Geräteart aus der Kennung des Browsers, z. B. „Chrome auf Windows (Computer)“.
--    Gespeichert wird nur diese Beschreibung, keine IP-Adresse. Die E-Mail nennt zusätzlich einen gekürzten
--    Netzwerk-Hinweis (z. B. 84.132.x.x), damit man die eigene Anmeldung erkennt; er wird nach dem Versand gelöscht.
--  * Erste Anmeldung eines Kontos (noch kein bekanntes Gerät): ohne E-Mail. Beim Einspielen werden die Geräte aller
--    laufenden Sitzungen als bekannt übernommen – es gibt also keine Welle von E-Mails.
--  * Höchstens 3 E-Mails pro Konto und Stunde (gegen eine E-Mail-Flut bei vielen Anmeldungen).
--  * Versand: Server-Funktion „geraete-hinweise“ (Gmail wie bei den Coaching-Erinnerungen, dieselben Secrets).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Der Zeitplan braucht pg_cron und pg_net (wie 033).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Bekannte Geräte, offene Hinweise, Stand der Prüfung
-- ---------------------------------------------------------
create table if not exists public.known_devices (
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 120),
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  primary key (user_id, label)
);

create table if not exists public.device_alerts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text not null,
  ip_hint    text,
  login_at   timestamptz not null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index if not exists device_alerts_open_idx on public.device_alerts (created_at) where sent_at is null;
create index if not exists device_alerts_user_idx on public.device_alerts (user_id, created_at desc);

create table if not exists public.device_seen_sessions (
  session_id uuid primary key,
  seen_at    timestamptz not null default now()
);

create table if not exists public.device_scan (
  id            integer primary key default 1 check (id = 1),
  last_run      timestamptz not null default '-infinity',
  scanned_until timestamptz not null default now()
);
insert into public.device_scan (id) values (1) on conflict (id) do nothing;

alter table public.known_devices enable row level security;
alter table public.device_alerts enable row level security;
alter table public.device_seen_sessions enable row level security;
alter table public.device_scan enable row level security;
revoke all on public.known_devices, public.device_alerts, public.device_seen_sessions, public.device_scan from anon, authenticated;

-- Die eigene Geräteliste darf man lesen (für eine spätere Anzeige im Dashboard), sonst nichts
grant select on public.known_devices to authenticated;
drop policy if exists "GSRA: Eigene Geräte lesen" on public.known_devices;
create policy "GSRA: Eigene Geräte lesen" on public.known_devices
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------
-- 2) Hilfsfunktionen: Gerätebeschreibung und gekürzter Netzwerk-Hinweis
-- ---------------------------------------------------------
create or replace function public.device_label(_ua text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  _u text := coalesce(_ua, '');
  _browser text;
  _system text;
  _art text;
begin
  if _u = '' then return 'Unbekanntes Gerät'; end if;
  -- Reihenfolge wichtig: Edge, Opera und Samsung geben sich zusätzlich als Chrome aus, Chrome zusätzlich als Safari
  _browser := case
    when _u ~* 'GSRA-App' then 'GSRA-App'
    when _u ~* 'Edg(e|A|iOS)?/' then 'Edge'
    when _u ~* '(OPR|Opera)/' then 'Opera'
    when _u ~* 'SamsungBrowser/' then 'Samsung Internet'
    when _u ~* '(Firefox|FxiOS)/' then 'Firefox'
    when _u ~* '(Chrome|CriOS|Chromium)/' then 'Chrome'
    when _u ~* 'Safari/' then 'Safari'
    else 'Browser' end;
  _system := case
    when _u ~* '(iPhone|iPad|iPod)' then 'iOS'
    when _u ~* 'Android' then 'Android'
    when _u ~* 'Windows' then 'Windows'
    when _u ~* 'CrOS' then 'ChromeOS'
    when _u ~* '(Macintosh|Mac OS X)' then 'macOS'
    when _u ~* 'Linux' then 'Linux'
    else 'unbekanntem System' end;
  _art := case
    when _u ~* '(iPad|Tablet)' or (_u ~* 'Android' and _u !~* 'Mobile') then 'Tablet'
    when _u ~* '(Mobile|iPhone|iPod)' then 'Handy'
    else 'Computer' end;
  return left(_browser || ' auf ' || _system || ' (' || _art || ')', 120);
end;
$$;

create or replace function public.ip_hint(_ip inet)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when _ip is null then null
    when family(_ip) = 4 then split_part(host(_ip), '.', 1) || '.' || split_part(host(_ip), '.', 2) || '.x.x'
    else split_part(host(_ip), ':', 1) || ':' || split_part(host(_ip), ':', 2) || ':…'
  end;
$$;

-- ---------------------------------------------------------
-- 3) Prüfung neuer Anmeldungen und fällige Hinweise (nur für die Server-Funktion)
--    Höchstens ein Lauf pro Minute, egal wie oft die Funktion aufgerufen wird.
-- ---------------------------------------------------------
create or replace function public.device_alert_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _from timestamptz;
  _until timestamptz := now();
  _s record;
  _label text;
  _out jsonb;
begin
  update public.device_scan set last_run = now()
  where id = 1 and last_run < now() - interval '1 minute';
  if not found then return jsonb_build_object('lauf', false, 'hinweise', '[]'::jsonb); end if;

  if to_regclass('auth.sessions') is not null then
    -- 10 Minuten Überlappung, damit keine Anmeldung durchrutscht; doppelt geprüfte Sitzungen fängt device_seen_sessions ab
    select scanned_until - interval '10 minutes' into _from from public.device_scan where id = 1;
    for _s in
      select s.id, s.user_id, s.created_at, s.user_agent, s.ip
      from auth.sessions s
      where s.created_at > _from and s.created_at <= _until
      order by s.created_at
      limit 5000
    loop
      insert into public.device_seen_sessions (session_id) values (_s.id) on conflict do nothing;
      if not found then continue; end if;
      _label := public.device_label(_s.user_agent);
      if exists (select 1 from public.known_devices k where k.user_id = _s.user_id and k.label = _label) then
        update public.known_devices set last_seen = greatest(last_seen, _s.created_at)
        where user_id = _s.user_id and label = _label;
      elsif not exists (select 1 from public.known_devices k where k.user_id = _s.user_id) then
        -- Erstes Gerät des Kontos: still merken
        insert into public.known_devices (user_id, label, first_seen, last_seen)
        values (_s.user_id, _label, _s.created_at, _s.created_at) on conflict do nothing;
      else
        insert into public.known_devices (user_id, label, first_seen, last_seen)
        values (_s.user_id, _label, _s.created_at, _s.created_at) on conflict do nothing;
        if (select count(*) from public.device_alerts a
            where a.user_id = _s.user_id and a.created_at > now() - interval '1 hour') < 3 then
          insert into public.device_alerts (user_id, label, ip_hint, login_at)
          values (_s.user_id, _label, public.ip_hint(_s.ip), _s.created_at);
        end if;
      end if;
    end loop;
    update public.device_scan set scanned_until = _until where id = 1;
  end if;

  -- Fällige Hinweise ausgeben und vermerken (lieber einer verpasst als doppelt verschickt)
  with picked as (
    update public.device_alerts a set sent_at = now()
    where a.sent_at is null and a.created_at > now() - interval '1 day'
    returning a.id, a.user_id, a.label, a.ip_hint, a.login_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'user_id', p.user_id, 'geraet', p.label, 'netz', p.ip_hint, 'zeit', p.login_at,
           'name', coalesce((select pr.username from public.profiles pr where pr.id = p.user_id), 'Fahrer'))
         order by p.login_at), '[]'::jsonb)
  into _out
  from picked p;

  -- Netzwerk-Hinweise nach dem Versand löschen, alte Einträge aufräumen
  update public.device_alerts set ip_hint = null where sent_at is not null and ip_hint is not null;
  delete from public.device_alerts where created_at < now() - interval '30 days';
  delete from public.device_seen_sessions where seen_at < now() - interval '2 days';

  return jsonb_build_object('lauf', true, 'hinweise', _out);
end;
$$;

revoke execute on function public.device_label(text) from public, anon, authenticated;
revoke execute on function public.ip_hint(inet) from public, anon, authenticated;
revoke execute on function public.device_alert_run() from public, anon, authenticated;
do $$
begin
  execute 'grant execute on function public.device_alert_run() to service_role';
exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
end $$;

-- ---------------------------------------------------------
-- 4) Beim Einspielen: Geräte aller laufenden Sitzungen als bekannt übernehmen (keine E-Mail-Welle)
-- ---------------------------------------------------------
do $$
begin
  if to_regclass('auth.sessions') is not null then
    insert into public.known_devices (user_id, label, first_seen, last_seen)
    select s.user_id, public.device_label(s.user_agent), min(s.created_at), max(s.created_at)
    from auth.sessions s
    where s.user_id is not null
    group by 1, 2
    on conflict do nothing;
    insert into public.device_seen_sessions (session_id)
    select s.id from auth.sessions s where s.created_at > now() - interval '2 days'
    on conflict do nothing;
  end if;
end $$;

-- ---------------------------------------------------------
-- 5) Zeitplan: alle 5 Minuten die Server-Funktion aufrufen (öffentlicher Schlüssel wie in 033 – unbedenklich:
--    Die Funktion verschickt nur fällige Hinweise, jeden genau einmal, höchstens einen Lauf pro Minute)
-- ---------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron konnte nicht eingeschaltet werden: %', sqlerrm;
  end;
  begin
    create extension if not exists pg_net with schema extensions;
  exception when others then
    raise notice 'pg_net konnte nicht eingeschaltet werden: %', sqlerrm;
  end;
end $$;

do $$
declare
  _key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xcXl2cG1kZGFhc3RhY2xkYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzAzNzUsImV4cCI6MjEwMzAwNjM3NX0.OWY2FUS7n9Jw-6FP0Hp1B9aY6AUAkEpZ6Xd7MpS0GLI';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'gsra-geraete-hinweise') then
    perform cron.unschedule('gsra-geraete-hinweise');
  end if;
  perform cron.schedule('gsra-geraete-hinweise', '*/5 * * * *', format($cmd$
    select net.http_post(
      url := 'https://mqqyvpmddaastacldbyy.supabase.co/functions/v1/geraete-hinweise',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer %1$s', 'apikey', '%1$s'),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000)
  $cmd$, _key));
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „ja“, „ja“, „aktiv (alle 5 Minuten)“)
-- ---------------------------------------------------------
select 'Geräte, Hinweise und Prüfung' as pruefung,
       case when to_regclass('public.known_devices') is not null and to_regclass('public.device_alerts') is not null
             and to_regprocedure('public.device_alert_run()') is not null then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Prüfung nur für den Server',
       case when not has_function_privilege('authenticated', 'public.device_alert_run()', 'execute')
             and not has_function_privilege('anon', 'public.device_alert_run()', 'execute')
             and not has_table_privilege('authenticated', 'public.device_alerts', 'select') then 'ja' else 'NEIN' end
union all
select 'Anmeldungen lesbar (auth.sessions)',
       case when to_regclass('auth.sessions') is null then 'NEIN – auth.sessions fehlt'
            when not exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'sessions' and column_name = 'user_agent')
              then 'NEIN – Spalte user_agent fehlt'
            when has_table_privilege('auth.sessions', 'select') then 'ja' else 'NEIN – keine Leserechte' end
union all
select 'Zeitplan',
       case when not exists (select 1 from pg_extension where extname = 'pg_cron') or not exists (select 1 from pg_extension where extname = 'pg_net')
            then 'fehlt – pg_cron und pg_net unter Database → Extensions einschalten' else 'aktiv (alle 5 Minuten)' end;
