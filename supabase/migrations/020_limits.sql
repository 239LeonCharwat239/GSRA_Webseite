-- =========================================================
-- GSRA 020 – Limits gegen Spam (Maßnahme 10 des Sicherheitsberichts, 13.11.)
-- Bisher konnte ein Skript unbegrenzt Nachrichten, Freundschaftsanfragen, Gruppen, Chats, Setups und
-- Inserate anlegen. Ab jetzt gelten großzügige Obergrenzen pro Konto – normale Nutzung stößt nie daran:
--   Nachrichten ............ 30 pro Minute, 600 pro Stunde
--   Freundschaftsanfragen .. 20 pro Stunde, 60 pro Tag
--   neue Gruppen/Foren ..... 5 pro Stunde, 20 pro Tag
--   neue Direktchats ....... 30 pro Stunde
--   Setups hochladen ....... 20 pro Stunde
--   Inserate anlegen ....... 20 pro Stunde (zusätzlich zur Grenze von 100 aktiven Inseraten)
-- Website-Admins (mit bestätigtem Code) sind ausgenommen. Die Meldung beginnt immer mit „Zu viele“.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Am Ende stehen Kontrollzeilen.
-- =========================================================

create or replace function public.gsra_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
begin
  -- Server (Stripe, E-Mail) und Website-Admins sind ausgenommen
  if _me is null or public.is_site_admin() then
    return new;
  end if;

  if tg_table_name = 'messages' then
    if (select count(*) from public.messages where sender_id = _me and created_at > now() - interval '1 minute') >= 30 then
      raise exception 'Zu viele Nachrichten in kurzer Zeit. Bitte warte einen Moment.';
    end if;
    if (select count(*) from public.messages where sender_id = _me and created_at > now() - interval '1 hour') >= 600 then
      raise exception 'Zu viele Nachrichten in der letzten Stunde. Bitte versuche es später erneut.';
    end if;

  elsif tg_table_name = 'friendships' then
    if new.user_id = _me and new.status = 'pending' then
      if (select count(*) from public.friendships where user_id = _me and created_at > now() - interval '1 hour') >= 20 then
        raise exception 'Zu viele Freundschaftsanfragen in kurzer Zeit. Bitte versuche es in einer Stunde erneut.';
      end if;
      if (select count(*) from public.friendships where user_id = _me and created_at > now() - interval '1 day') >= 60 then
        raise exception 'Zu viele Freundschaftsanfragen heute. Bitte versuche es morgen erneut.';
      end if;
    end if;

  elsif tg_table_name = 'chats' then
    if new.title is not null and new.user1_id = new.user2_id then
      if (select count(*) from public.chats where user1_id = _me and user2_id = _me and title is not null
          and created_at > now() - interval '1 hour') >= 5 then
        raise exception 'Zu viele neue Gruppen in kurzer Zeit. Bitte versuche es in einer Stunde erneut.';
      end if;
      if (select count(*) from public.chats where user1_id = _me and user2_id = _me and title is not null
          and created_at > now() - interval '1 day') >= 20 then
        raise exception 'Zu viele neue Gruppen heute. Bitte versuche es morgen erneut.';
      end if;
    elsif new.user1_id <> new.user2_id then
      if (select count(*) from public.chats where user1_id <> user2_id and (user1_id = _me or user2_id = _me)
          and created_at > now() - interval '1 hour') >= 30 then
        raise exception 'Zu viele neue Chats in kurzer Zeit. Bitte versuche es in einer Stunde erneut.';
      end if;
    end if;

  elsif tg_table_name = 'setups' then
    if (select count(*) from public.setups where (uploader_id)::text = _me::text and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'Zu viele Setups in kurzer Zeit. Bitte versuche es in einer Stunde erneut.';
    end if;

  elsif tg_table_name = 'marketplace' then
    if (select count(*) from public.marketplace where user_id = _me and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'Zu viele neue Inserate in kurzer Zeit. Bitte versuche es in einer Stunde erneut.';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger-Funktion: niemand ruft sie direkt auf (wie in 017 für alle Trigger-Funktionen)
revoke execute on function public.gsra_rate_limit() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['messages', 'friendships', 'chats', 'setups', 'marketplace'] loop
    execute format('drop trigger if exists gsra_rate_limit on public.%I', t);
    execute format('create trigger gsra_rate_limit before insert on public.%I for each row execute function public.gsra_rate_limit()', t);
  end loop;
end $$;

-- Schnelles Zählen (nur falls noch nicht vorhanden)
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at);
create index if not exists friendships_user_created_idx on public.friendships (user_id, created_at);
create index if not exists chats_user1_created_idx on public.chats (user1_id, created_at);
create index if not exists chats_user2_created_idx on public.chats (user2_id, created_at);

-- ---------------------------------------------------------
-- Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Tabellen mit Spam-Limit' as pruefung,
       count(*)::text || ' von 5' as ergebnis
from pg_trigger tr join pg_class c on c.oid = tr.tgrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and tr.tgname = 'gsra_rate_limit'
  and c.relname in ('messages', 'friendships', 'chats', 'setups', 'marketplace')
union all
select 'Limit-Funktion direkt aufrufbar',
       case when has_function_privilege('authenticated', 'public.gsra_rate_limit()', 'EXECUTE')
              or has_function_privilege('anon', 'public.gsra_rate_limit()', 'EXECUTE') then 'ja (FEHLER)' else 'nein' end;
