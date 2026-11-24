-- =========================================================
-- GSRA 047 – Selbstlöschende Nachrichten und aktive Anmeldungen (Entscheidungen vom 24.11.2026)
--
-- Selbstlöschende Nachrichten
--   * Pro Chat einstellbar: aus, 1 Stunde, 1 Tag, 7 Tage, 30 Tage. In Einzelchats dürfen beide umstellen,
--     in Gruppen nur Gruppenadmins, im offiziellen Forum niemand. Jede Änderung erscheint als Hinweis im Chat.
--   * Gilt für Nachrichten ab dem Einschalten: Jede neue Nachricht bekommt ihr Ablaufdatum beim Senden (von der
--     Datenbank gesetzt, nicht vom Browser). Alle 5 Minuten löscht die Datenbank abgelaufene Nachrichten.
--   * Beweissicherung bleibt: Wie bei jeder gelöschten Nachricht sehen nur Admins für Meldungen die Kopie
--     (bis 180 Tage, siehe 004) – Missbrauch lässt sich so weiter melden und prüfen.
-- Aktive Anmeldungen
--   * Liste der eigenen Anmeldungen (Gerät, grober Netzbereich, angemeldet seit, zuletzt aktiv)
--   * Einzelne Anmeldung beenden: Das Gerät kann sich nicht mehr erneuern und ist spätestens nach einer Stunde
--     abgemeldet (so lange gilt ein bereits ausgestellter Anmelde-Schlüssel).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 001, 003, 004 und 042 voraus.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Einstellung am Chat, Ablaufdatum an der Nachricht
-- ---------------------------------------------------------
alter table public.chats add column if not exists auto_delete_seconds integer;
alter table public.chats drop constraint if exists chats_auto_delete_seconds_check;
alter table public.chats add constraint chats_auto_delete_seconds_check
  check (auto_delete_seconds is null or auto_delete_seconds in (3600, 86400, 604800, 2592000));
alter table public.messages add column if not exists expires_at timestamptz;
create index if not exists messages_expires_idx on public.messages (expires_at) where expires_at is not null;

-- Die Einstellung ändert nur die Funktion unten – auch Gruppenadmins können sie nicht direkt setzen
create or replace function public.chats_timer_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('gsra.chat_timer', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.auto_delete_seconds := null;
  else
    new.auto_delete_seconds := old.auto_delete_seconds;
  end if;
  return new;
end;
$$;
revoke execute on function public.chats_timer_guard() from public, anon, authenticated;
drop trigger if exists gsra_chats_timer_guard on public.chats;
create trigger gsra_chats_timer_guard before insert or update on public.chats for each row execute function public.chats_timer_guard();

-- Ablaufdatum setzt die Datenbank beim Senden; danach ist es nicht mehr änderbar
create or replace function public.messages_set_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _secs integer;
begin
  if tg_op = 'INSERT' then
    select c.auto_delete_seconds into _secs from public.chats c where c.id = new.chat_id;
    new.expires_at := case when _secs is null then null else now() + make_interval(secs => _secs) end;
  else
    new.expires_at := old.expires_at;
  end if;
  return new;
end;
$$;
revoke execute on function public.messages_set_expiry() from public, anon, authenticated;
drop trigger if exists gsra_messages_set_expiry on public.messages;
create trigger gsra_messages_set_expiry before insert or update on public.messages for each row execute function public.messages_set_expiry();

-- Umschalten (mit Hinweis im Chat)
create or replace function public.chat_set_auto_delete(_chat uuid, _seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _me    uuid := auth.uid();
  _c     public.chats;
  _name  text;
  _label text;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _seconds is not null and _seconds not in (3600, 86400, 604800, 2592000) then
    raise exception 'Bitte wähle 1 Stunde, 1 Tag, 7 Tage, 30 Tage oder „Aus“.';
  end if;
  select * into _c from public.chats where id = _chat;
  if _c.id is null or not public.is_chat_participant(_chat) then raise exception 'Diesen Chat gibt es nicht.'; end if;
  if _c.title = 'GSRA Official / Community Forum' and _c.user1_id = _c.user2_id then
    raise exception 'Im offiziellen Forum gibt es keine selbstlöschenden Nachrichten.';
  end if;
  if _c.title is not null and _c.user1_id = _c.user2_id then
    if not public.is_group_admin(_chat) then raise exception 'Das können nur Gruppenadmins einstellen.'; end if;
  elsif _me not in (_c.user1_id, _c.user2_id) then
    raise exception 'Diesen Chat gibt es nicht.';
  end if;
  if _c.auto_delete_seconds is not distinct from _seconds then return _seconds; end if;

  perform set_config('gsra.chat_timer', '1', true);
  update public.chats set auto_delete_seconds = _seconds where id = _chat;
  perform set_config('gsra.chat_timer', '', true);

  select coalesce(nullif(trim(username), ''), 'Jemand') into _name from public.profiles where id = _me;
  _label := case _seconds when 3600 then '1 Stunde' when 86400 then '1 Tag' when 604800 then '7 Tage' when 2592000 then '30 Tage' end;
  insert into public.messages (chat_id, sender_id, text)
  values (_chat, _me, case when _seconds is null
                           then coalesce(_name, 'Jemand') || ' hat selbstlöschende Nachrichten ausgeschaltet.'
                           else coalesce(_name, 'Jemand') || ' hat selbstlöschende Nachrichten eingeschaltet (' || _label || ').' end);
  return _seconds;
end;
$$;

-- Beweissicherung (aus 004) mit eigener Kennzeichnung für abgelaufene Nachrichten
create or replace function public.messages_keep_history()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.message_history (message_id, chat_id, sender_id, text, image_url, audio_url, transcript,
                                        change_type, changed_by, original_created_at)
    values (old.id, old.chat_id, old.sender_id, old.text, old.image_url, old.audio_url, old.transcript,
            case when coalesce(current_setting('gsra.ablauf', true), '') = '1' then 'abgelaufen (selbstlöschend)' else 'endgültig gelöscht' end,
            auth.uid(), old.created_at);
  elsif new.text is distinct from old.text or new.image_url is distinct from old.image_url
        or new.audio_url is distinct from old.audio_url then
    insert into public.message_history (message_id, chat_id, sender_id, text, image_url, audio_url, transcript,
                                        change_type, changed_by, original_created_at)
    values (old.id, old.chat_id, old.sender_id, old.text, old.image_url, old.audio_url, old.transcript,
            case when new.text in ('Du hast diese Nachricht gelöscht', 'Diese Nachricht wurde gelöscht',
                                   'Diese Nachricht wurde von einem Gruppenadmin gelöscht')
                 then 'gelöscht' else 'bearbeitet' end,
            auth.uid(), old.created_at);
  else
    return null;
  end if;
  delete from public.message_history where changed_at < now() - interval '180 days';
  return null;
end;
$$;

-- Abgelaufene Nachrichten löschen (läuft alle 5 Minuten, höchstens 5.000 je Lauf)
create or replace function public.chat_expire_run()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _chats uuid[];
begin
  perform set_config('gsra.ablauf', '1', true);
  with weg as (
    delete from public.messages
    where id in (select id from public.messages where expires_at is not null and expires_at <= now() order by expires_at limit 5000)
    returning chat_id
  )
  select array_agg(distinct chat_id) into _chats from weg;
  perform set_config('gsra.ablauf', '', true);
  -- Vorschau in der Chatliste: Text der abgelaufenen Nachricht nicht stehen lassen (eigener Schritt,
  -- damit die Abfrage die eben gelöschten Nachrichten nicht mehr sieht)
  update public.chats c
     set last_message = coalesce((select m.text from public.messages m where m.chat_id = c.id order by m.created_at desc limit 1), '')
   where c.id = any(coalesce(_chats, '{}'));
  return coalesce(cardinality(_chats), 0);
end;
$$;
revoke execute on function public.chat_expire_run() from public, anon, authenticated;

-- ---------------------------------------------------------
-- 2) Aktive Anmeldungen ansehen und einzeln beenden
-- ---------------------------------------------------------
create or replace function public.my_sessions()
returns table (id uuid, geraet text, netz text, angemeldet_am timestamptz, zuletzt_aktiv timestamptz, aktuell boolean)
language plpgsql
stable security definer
set search_path = public
as $$
declare
  _aktiv text := 'coalesce(s.updated_at, s.created_at)';
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if to_regclass('auth.sessions') is null then return; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'sessions' and column_name = 'refreshed_at') then
    _aktiv := 'greatest(coalesce(s.refreshed_at at time zone ''UTC'', s.created_at), coalesce(s.updated_at, s.created_at))';
  end if;
  return query execute format($q$
    select s.id, public.device_label(s.user_agent), public.ip_hint(s.ip), s.created_at, %s,
           s.id::text = coalesce(auth.jwt() ->> 'session_id', '')
    from auth.sessions s
    where s.user_id = auth.uid()
    order by 5 desc
    limit 50 $q$, _aktiv);
end;
$$;

create or replace function public.end_session(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _n integer;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.'; end if;
  if _id is null then raise exception 'Diese Anmeldung gibt es nicht.'; end if;
  if _id::text = coalesce(auth.jwt() ->> 'session_id', '') then
    raise exception 'Das ist diese Anmeldung hier – nutze dafür „Abmelden“ im Profil-Menü.';
  end if;
  if to_regclass('auth.sessions') is null then raise exception 'Diese Anmeldung gibt es nicht.'; end if;
  execute 'delete from auth.sessions where id = $1 and user_id = $2' using _id, auth.uid();
  get diagnostics _n = row_count;
  if _n = 0 then raise exception 'Diese Anmeldung ist bereits beendet.'; end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.chat_set_auto_delete(uuid, integer)', 'public.my_sessions()', 'public.end_session(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------
-- 3) Zeitplan: alle 5 Minuten abgelaufene Nachrichten löschen (direkt in der Datenbank, ohne Server-Funktion)
-- ---------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron konnte nicht eingeschaltet werden: %', sqlerrm;
  end;
end $$;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then return; end if;
  if exists (select 1 from cron.job where jobname = 'gsra-nachrichten-ablauf') then
    perform cron.unschedule('gsra-nachrichten-ablauf');
  end if;
  perform cron.schedule('gsra-nachrichten-ablauf', '*/5 * * * *', 'select public.chat_expire_run()');
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „ja“, „ja“, „ja“, „aktiv (alle 5 Minuten)“)
-- ---------------------------------------------------------
select 'Selbstlöschende Nachrichten und Anmeldungen' as pruefung,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'expires_at')
             and to_regprocedure('public.chat_set_auto_delete(uuid, integer)') is not null
             and to_regprocedure('public.my_sessions()') is not null and to_regprocedure('public.end_session(uuid)') is not null
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Löschlauf nur für die Datenbank selbst',
       case when not has_function_privilege('authenticated', 'public.chat_expire_run()', 'execute')
             and not has_function_privilege('anon', 'public.chat_expire_run()', 'execute') then 'ja' else 'NEIN' end
union all
select 'Gäste ausgeschlossen',
       case when not has_function_privilege('anon', 'public.my_sessions()', 'execute')
             and not has_function_privilege('anon', 'public.end_session(uuid)', 'execute')
             and not has_function_privilege('anon', 'public.chat_set_auto_delete(uuid, integer)', 'execute') then 'ja' else 'NEIN' end
union all
select 'Anmeldungen beendbar (auth.sessions)',
       case when to_regclass('auth.sessions') is null then 'NEIN – auth.sessions fehlt'
            when has_table_privilege('auth.sessions', 'delete') then 'ja' else 'NEIN – keine Löschrechte' end
union all
select 'Zeitplan',
       case when not exists (select 1 from pg_extension where extname = 'pg_cron')
            then 'fehlt – pg_cron unter Database → Extensions einschalten' else 'aktiv (alle 5 Minuten)' end;
