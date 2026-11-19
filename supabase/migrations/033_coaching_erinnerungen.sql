-- =========================================================
-- GSRA 033 – Coaching: Erinnerungen vor dem Termin und alte Anfragen automatisch beenden (19.11.)
--  * Erinnerung per E-Mail an Kunde und Coach: 24 Stunden und 1 Stunde vor dem Termin. Den Versand übernimmt die
--    Server-Funktion „coaching-reminders“ (Gmail wie bei der Kündigungsbestätigung); ein Zeitplan in der Datenbank
--    ruft sie alle 15 Minuten auf. Jede Erinnerung wird genau einmal verschickt: Die Datenbank vermerkt sie, bevor
--    die E-Mail rausgeht.
--  * Neuer Status „abgelaufen“: Anfragen ohne Antwort nach 7 Tagen oder wenn ihr Termin (fast) erreicht ist, und
--    angenommene, aber nie bezahlte Coachings nach dem Termin. Damit blockieren sie keine Zeiten und zählen nicht
--    mehr zu den 5 offenen Anfragen.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 024–030 voraus.
-- Der Zeitplan braucht die Erweiterungen pg_cron und pg_net. Das Skript versucht, sie einzuschalten; klappt das
-- nicht, zeigt die Kontrolle „Zeitplan: fehlt“ – dann unter Database → Extensions pg_cron und pg_net einschalten
-- und das Skript erneut ausführen.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Status „abgelaufen“ und Vermerke für Erinnerungen
-- ---------------------------------------------------------
alter table public.coaching_bookings drop constraint if exists coaching_bookings_status_check;
alter table public.coaching_bookings add constraint coaching_bookings_status_check
  check (status in ('angefragt', 'angenommen', 'abgelehnt', 'storniert', 'bezahlt', 'erledigt', 'erstattet', 'abgelaufen'));
alter table public.coaching_bookings
  add column if not exists reminded_24h_at timestamptz,
  add column if not exists reminded_1h_at  timestamptz;
create index if not exists coaching_bookings_upcoming_idx on public.coaching_bookings (scheduled_at)
  where status in ('angefragt', 'angenommen', 'bezahlt');

-- ---------------------------------------------------------
-- 2) Alte Anfragen beenden (darf jeder anstoßen: ändert nur, was ohnehin abgelaufen ist)
-- ---------------------------------------------------------
create or replace function public.coaching_expire_stale()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _n integer;
begin
  update public.coaching_bookings
  set status = 'abgelaufen', updated_at = now()
  where (status = 'angefragt'
         and (created_at < now() - interval '7 days'
              or (scheduled_at is not null and scheduled_at < now() + interval '1 hour')))
     or (status = 'angenommen' and scheduled_at is not null and scheduled_at < now());
  get diagnostics _n = row_count;
  return _n;
end;
$$;

-- ---------------------------------------------------------
-- 3) Erinnerungen: fällige heraussuchen und vermerken (nur für die Server-Funktion)
--    Höchstens ein Lauf alle 4 Minuten, egal wie oft die Funktion aufgerufen wird.
-- ---------------------------------------------------------
create table if not exists public.coaching_reminder_runs (
  id        integer primary key default 1 check (id = 1),
  last_run  timestamptz not null default '-infinity'
);
alter table public.coaching_reminder_runs enable row level security;
revoke all on public.coaching_reminder_runs from anon, authenticated;
insert into public.coaching_reminder_runs (id) values (1) on conflict (id) do nothing;

create or replace function public.coaching_reminder_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _due jsonb;
begin
  -- Sperre gegen zu häufige Läufe (gleichzeitige Aufrufe warten bzw. gehen leer aus)
  update public.coaching_reminder_runs set last_run = now()
  where id = 1 and last_run < now() - interval '4 minutes';
  if not found then return jsonb_build_object('lauf', false, 'erinnerungen', '[]'::jsonb); end if;

  perform public.coaching_expire_stale();

  with soon as (
    -- 1 Stunde vorher: nur bezahlte Coachings (dann entfällt auch die 24-Stunden-Erinnerung, falls noch offen)
    update public.coaching_bookings b
    set reminded_1h_at = now(), reminded_24h_at = coalesce(b.reminded_24h_at, now())
    where b.status = 'bezahlt' and b.reminded_1h_at is null
      and b.scheduled_at > now() and b.scheduled_at <= now() + interval '75 minutes'
    returning b.id, '1h'::text as art
  ), day as (
    -- 24 Stunden vorher: bezahlte und angenommene (noch unbezahlte) Coachings
    update public.coaching_bookings b
    set reminded_24h_at = now()
    where b.status in ('bezahlt', 'angenommen') and b.reminded_24h_at is null
      and b.scheduled_at > now() + interval '75 minutes' and b.scheduled_at <= now() + interval '24 hours'
      and b.id not in (select id from soon)
    returning b.id, '24h'::text as art
  ), picked as (
    select * from soon union all select * from day
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'art', p.art, 'status', b.status, 'titel', b.offer_title, 'termin', b.scheduled_at,
           'dauer', b.duration_minutes, 'coach_id', b.coach_id, 'kunde_id', b.buyer_id,
           'coach_name', coalesce((select username from public.profiles where id = b.coach_id), 'dein Coach'),
           'kunde_name', coalesce((select username from public.profiles where id = b.buyer_id), 'dein Kunde'))
         order by b.scheduled_at), '[]'::jsonb)
  into _due
  from picked p join public.coaching_bookings b on b.id = p.id;

  return jsonb_build_object('lauf', true, 'erinnerungen', _due);
end;
$$;

-- Rechte: Aufräumen darf jeder Angemeldete anstoßen, die Erinnerungen nur die Server-Funktion
revoke execute on function public.coaching_expire_stale() from public, anon;
grant execute on function public.coaching_expire_stale() to authenticated;
revoke execute on function public.coaching_reminder_run() from public, anon, authenticated;
do $$
begin
  execute 'grant execute on function public.coaching_expire_stale() to service_role';
  execute 'grant execute on function public.coaching_reminder_run() to service_role';
exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
end $$;

-- ---------------------------------------------------------
-- 4) Zeitplan: alle 15 Minuten die Server-Funktion aufrufen
--    Der Aufruf nutzt den öffentlichen Schlüssel der Webseite (steht ohnehin in supabase-client.js). Das ist hier
--    unbedenklich: Die Funktion verschickt nur fällige Erinnerungen, jede genau einmal, höchstens alle 4 Minuten.
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
  if exists (select 1 from cron.job where jobname = 'gsra-coaching-erinnerungen') then
    perform cron.unschedule('gsra-coaching-erinnerungen');
  end if;
  perform cron.schedule('gsra-coaching-erinnerungen', '*/15 * * * *', format($cmd$
    select net.http_post(
      url := 'https://mqqyvpmddaastacldbyy.supabase.co/functions/v1/coaching-reminders',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer %1$s', 'apikey', '%1$s'),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000)
  $cmd$, _key));
end $$;

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „bereit“, „ja“, „aktiv (alle 15 Minuten)“)
-- ---------------------------------------------------------
select 'Status „abgelaufen“ und Vermerke' as pruefung,
       case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'coaching_bookings'
                  and column_name in ('reminded_24h_at', 'reminded_1h_at')) = 2
             and pg_get_constraintdef((select oid from pg_constraint where conname = 'coaching_bookings_status_check')) like '%abgelaufen%'
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Erinnerungen und Aufräumen',
       case when to_regprocedure('public.coaching_reminder_run()') is not null and to_regprocedure('public.coaching_expire_stale()') is not null
            then 'bereit' else 'FEHLT' end
union all
select 'Erinnerungen nur für den Server',
       case when not has_function_privilege('authenticated', 'public.coaching_reminder_run()', 'execute')
             and not has_function_privilege('anon', 'public.coaching_reminder_run()', 'execute') then 'ja' else 'NEIN' end
union all
select 'Zeitplan',
       case when not exists (select 1 from pg_extension where extname = 'pg_cron') then 'fehlt – pg_cron unter Database → Extensions einschalten'
            when not exists (select 1 from pg_extension where extname = 'pg_net') then 'fehlt – pg_net unter Database → Extensions einschalten'
            else 'aktiv (alle 15 Minuten)' end;
