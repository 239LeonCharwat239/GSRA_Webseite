-- =========================================================
-- GSRA 058: „Neues im Messenger?“ in EINER Abfrage (für die GSRA-App, 26.11.)
-- =========================================================
-- Die Seitenleiste der App zeigt am Messenger einen roten Punkt wie die Webseite. Die Webseite merkt sich den
-- Lesestand im Browser; die App fragt stattdessen den Lesestand der Datenbank (chat_reads, setzt der Messenger beim
-- Lesen) – so stimmt er auf allen Geräten.
--
-- Sicherheit: Die Funktion läuft mit den Rechten der aufrufenden Person (security invoker) – sie sieht also nur
-- Nachrichten, die diese Person ohnehin lesen darf. Sie gibt nur ja/nein zurück, keine Inhalte. Nur für Angemeldete.
-- Darf mehrfach laufen. Ändert keine Daten.

create or replace function public.messenger_hinweis()
returns boolean
language plpgsql
stable
security invoker
set search_path to 'public'
as $$
declare
  _ich uuid := auth.uid();
begin
  if _ich is null then
    return false;
  end if;
  return exists (select 1 from public.friendships f where f.friend_id = _ich and f.status = 'pending')
      or exists (select 1 from public.user_warnings w where w.user_id = _ich and w.acknowledged_at is null)
      or exists (
           select 1
           from public.messages m
           where m.sender_id is distinct from _ich
             and m.created_at > now() - interval '30 days'
             and m.created_at > coalesce((select r.last_read_at from public.chat_reads r
                                          where r.chat_id = m.chat_id and r.user_id = _ich), '-infinity'::timestamptz)
         );
end;
$$;

revoke execute on function public.messenger_hinweis() from public, anon;
grant execute on function public.messenger_hinweis() to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------
select 'Messenger-Hinweis 058' as pruefung,
       case when to_regprocedure('public.messenger_hinweis()') is not null
             and not (select prosecdef from pg_proc where oid = 'public.messenger_hinweis()'::regprocedure)
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Nur für Angemeldete',
       case when not has_function_privilege('anon', 'public.messenger_hinweis()', 'execute')
             and has_function_privilege('authenticated', 'public.messenger_hinweis()', 'execute')
            then 'ja' else 'NEIN' end;
