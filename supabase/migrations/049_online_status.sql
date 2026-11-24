-- =========================================================
-- GSRA 049 – „Zuletzt online“ genau ab dem Abmelden (Fund vom 24.11.2026)
-- Bisher setzte das Abmelden die letzte Aktivität künstlich 3 Minuten und 10 Sekunden zurück, damit die Person
-- sofort als offline galt. Folge: Direkt nach dem Abmelden stand dort „zuletzt online vor 3–4 Min.“ statt
-- „gerade eben“. Ab jetzt merkt sich die Datenbank den Zeitpunkt des Abmeldens getrennt (offline_at):
--   * Abmelden: offline_at = jetzt, last_seen_at = jetzt → sofort offline, „zuletzt online gerade eben“
--   * Lebenszeichen (jede Minute, solange eine GSRA-Seite offen ist): offline_at wird gelöscht → wieder online
--   * last_seen_of (Profilkarten) berücksichtigt offline_at ebenfalls
-- Sichtbarkeit unverändert: genaue Zeit nur für Freunde und einen selbst, alle anderen nur den Tag.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 004 und 012 voraus.
-- =========================================================

alter table public.user_presence add column if not exists offline_at timestamptz;

create or replace function public.touch_presence(_game text default null, _set_game boolean default false,
                                                 _offline boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then return; end if;
  if _offline then
    update public.user_presence
    set last_seen_at = now(), offline_at = now(), current_game = null, updated_at = now()
    where user_id = auth.uid();
    return;
  end if;
  insert into public.user_presence (user_id, last_seen_at, current_game, updated_at, offline_at)
  values (auth.uid(), now(), case when _set_game then nullif(left(trim(_game), 40), '') end, now(), null)
  on conflict (user_id) do update set
    current_game = case
      when _set_game then nullif(left(trim(_game), 40), '')
      when public.user_presence.last_seen_at < now() - interval '5 minutes' or public.user_presence.offline_at is not null then null
      else public.user_presence.current_game
    end,
    last_seen_at = now(),
    offline_at = null,
    updated_at = now();
end;
$$;

create or replace function public.last_seen_of(_user uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when auth.uid() is null then null
    when exists (select 1 from public.user_blocks b
                 where (b.blocker_id = _user and b.blocked_id = auth.uid()) or (b.blocker_id = auth.uid() and b.blocked_id = _user)) then null
    else (select jsonb_build_object(
            'online', p.offline_at is null and p.last_seen_at > now() - interval '3 minutes',
            'exact', _user = auth.uid() or public.is_friend(_user),
            'last_seen_at', case when _user = auth.uid() or public.is_friend(_user) then p.last_seen_at
                                 else date_trunc('hour', p.last_seen_at) end)
          from public.user_presence p where p.user_id = _user)
  end;
$$;

revoke execute on function public.touch_presence(text, boolean, boolean) from public, anon;
grant execute on function public.touch_presence(text, boolean, boolean) to authenticated;
revoke execute on function public.last_seen_of(uuid) from public, anon;
grant execute on function public.last_seen_of(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „ja“)
-- ---------------------------------------------------------
select 'Abmelde-Zeitpunkt für „zuletzt online“' as pruefung,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_presence' and column_name = 'offline_at')
             and position('offline_at' in pg_get_functiondef('public.touch_presence(text, boolean, boolean)'::regprocedure)) > 0
             and position('offline_at' in pg_get_functiondef('public.last_seen_of(uuid)'::regprocedure)) > 0
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Gäste ausgeschlossen',
       case when not has_function_privilege('anon', 'public.touch_presence(text, boolean, boolean)', 'execute')
             and not has_function_privilege('anon', 'public.last_seen_of(uuid)', 'execute') then 'ja' else 'NEIN' end;
