-- =========================================================
-- GSRA Messenger: Fremde Nachrichten schützen
-- Reaktionen werden in der Nachricht gespeichert, deshalb dürfen andere Teilnehmer sie ändern.
-- Diese Absicherung sorgt dafür, dass sie dabei NUR ihre eigene Reaktion ändern können.
-- Einmal komplett im Supabase SQL Editor ausführen (darf auch mehrfach laufen).
-- =========================================================

-- 1) Ändern: eigene Nachrichten wie bisher, bei fremden nur die eigene Reaktion
create or replace function public.messages_guard_changes()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Ohne Anmeldung (SQL Editor, Dashboard) gibt es keine Einschränkung
  if auth.uid() is null then
    return new;
  end if;

  -- Niemand verschiebt Nachrichten in einen anderen Chat oder ändert Absender und Zeitpunkt
  if new.chat_id is distinct from old.chat_id
     or new.sender_id is distinct from old.sender_id
     or (to_jsonb(new) -> 'created_at') is distinct from (to_jsonb(old) -> 'created_at') then
    raise exception 'Chat, Absender und Zeitpunkt einer Nachricht können nicht geändert werden.';
  end if;

  -- Eigene Nachricht: bearbeiten, löschen und reagieren wie bisher
  if old.sender_id = auth.uid() then
    return new;
  end if;

  -- Fremde Nachricht: Inhalt bleibt unverändert (die Antwort-Verknüpfung darf nur wegfallen, wenn das Original gelöscht wurde)
  if exists (
       select 1
       from unnest(array['text', 'image_url', 'is_edited', 'edit_count', 'edited_at']) as spalte
       where (to_jsonb(new) -> spalte) is distinct from (to_jsonb(old) -> spalte)
     )
     or (new.reply_to is distinct from old.reply_to and new.reply_to is not null) then
    raise exception 'Fremde Nachrichten kannst du nicht bearbeiten, nur mit einer Reaktion versehen.';
  end if;

  -- ... und von den Reaktionen nur die eigene
  if (coalesce(to_jsonb(new) -> 'reactions', '{}'::jsonb) - auth.uid()::text)
       is distinct from (coalesce(to_jsonb(old) -> 'reactions', '{}'::jsonb) - auth.uid()::text)
     or ((to_jsonb(new) ->> 'last_reaction_user') is distinct from (to_jsonb(old) ->> 'last_reaction_user')
         and (to_jsonb(new) ->> 'last_reaction_user') is not null
         and (to_jsonb(new) ->> 'last_reaction_user') <> auth.uid()::text) then
    raise exception 'Du kannst nur deine eigene Reaktion ändern.';
  end if;

  return new;
end;
$$;

-- Der Name beginnt mit „a“, damit die Prüfung vor dem bestehenden Trigger trg_messages_before_update läuft
-- und genau das prüft, was abgeschickt wurde
drop trigger if exists trg_messages_a_guard_update on public.messages;
create trigger trg_messages_a_guard_update
  before update on public.messages
  for each row execute function public.messages_guard_changes();

-- 2) Löschen: eigene Nachrichten immer; fremde nur beim Löschen des ganzen Chats
--    (als Partner im Direktchat bzw. als Gründer der Gruppe)
create or replace function public.messages_guard_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or old.sender_id = auth.uid() then
    return old;
  end if;

  if exists (select 1 from public.chats c
             where c.id = old.chat_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid()))
     -- Wird gerade der ganze Chat gelöscht, ist er hier schon weg – darüber hat bereits die Chat-Regel entschieden
     or not exists (select 1 from public.chats c where c.id = old.chat_id) then
    return old;
  end if;

  raise exception 'Fremde Nachrichten kannst du nicht löschen.';
end;
$$;

drop trigger if exists trg_messages_a_guard_delete on public.messages;
create trigger trg_messages_a_guard_delete
  before delete on public.messages
  for each row execute function public.messages_guard_delete();

-- 3) Kontrolle (ändert nichts): alle Trigger der Nachrichten-Tabelle in der Reihenfolge, in der sie laufen
select tgname as trigger_name,
       case when tgtype & 2 = 2 then 'vorher' else 'nachher' end as zeitpunkt,
       concat_ws(', ',
         case when tgtype & 4 = 4 then 'INSERT' end,
         case when tgtype & 8 = 8 then 'DELETE' end,
         case when tgtype & 16 = 16 then 'UPDATE' end) as bei
from pg_trigger
where tgrelid = 'public.messages'::regclass and not tgisinternal
order by tgname;
