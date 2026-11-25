-- =========================================================
-- GSRA – 054: KI-Renningenieur merkt sich Erkenntnisse aus der Nachbesprechung
-- =========================================================
-- Wunsch 25.11.: Nach dem Rennen bespricht der Renningenieur die Sitzung von selbst („lief so und so, mit Fahrer X
-- ist das passiert, so könntest du es ändern“) – und MERKT sich das Wichtigste, damit er beim nächsten Mal darauf
-- zurückkommt („Kurve 4 war letztes Mal dein Problem – heute schon besser“).
-- Dafür trägt die App nach der Nachbesprechung höchstens zwei kurze Einträge in das Gedächtnis ein (Tabelle aus 048,
-- Herkunft „renningenieur“). Die Person sieht und löscht sie wie bisher auf der Webseite unter „Renningenieur“.
-- Abgesichert: nur die eigene Person, nicht gesperrt, Zwei-Faktor bestätigt (falls eingerichtet); nur die Arten
-- Stärke, Schwäche, Ziel; Text bereinigt (2–200 Zeichen); gleicher Text wird nicht doppelt gespeichert; höchstens
-- 6 Einträge des Renningenieurs am Tag; ist das Gedächtnis voll (100), ersetzt er seinen ältesten eigenen Eintrag –
-- Einträge der Person selbst rührt er nie an.
-- Darf mehrfach laufen. Am Ende: Kontrollabfrage („bereit“ …).
-- =========================================================

create or replace function public.race_engineer_learn(_art text, _text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me  uuid := auth.uid();
  _txt text := public.race_engineer_clean(_text, 200);
  _id  uuid;
  _alt uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if not public.mfa_ok() then raise exception 'Bitte bestätige zuerst deine Zwei-Faktor-Anmeldung.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _art is null or _art not in ('staerke', 'schwaeche', 'ziel') then raise exception 'Unbekannte Art.'; end if;
  if _txt is null or char_length(_txt) < 2 then raise exception 'Leerer Eintrag.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('gsra-renningenieur-merken:' || _me::text, 0));

  -- Schon bekannt? Dann nichts Neues anlegen
  select id into _id from public.race_engineer_memory
   where user_id = _me and lower(text) = lower(_txt) limit 1;
  if _id is not null then return _id; end if;

  if (select count(*) from public.race_engineer_memory
       where user_id = _me and quelle = 'renningenieur' and created_at > now() - interval '1 day') >= 6 then
    raise exception 'Für heute hat sich dein Renningenieur genug gemerkt.';
  end if;

  if (select count(*) from public.race_engineer_memory where user_id = _me) >= 100 then
    select id into _alt from public.race_engineer_memory
     where user_id = _me and quelle = 'renningenieur' order by created_at limit 1;
    if _alt is null then raise exception 'Das Gedächtnis ist voll (100 Einträge).'; end if;
    delete from public.race_engineer_memory where id = _alt;
  end if;

  insert into public.race_engineer_memory (user_id, art, text, quelle)
  values (_me, _art, _txt, 'renningenieur') returning id into _id;
  return _id;
end;
$$;

revoke execute on function public.race_engineer_learn(text, text) from public, anon;
grant execute on function public.race_engineer_learn(text, text) to authenticated;

-- ---------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------
select 'Renningenieur 054' as pruefung,
       case when to_regprocedure('public.race_engineer_learn(text, text)') is not null then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Gäste ausgeschlossen',
       case when not has_function_privilege('anon', 'public.race_engineer_learn(text, text)', 'execute') then 'ja' else 'NEIN' end
union all
select 'Gedächtnis nicht direkt beschreibbar',
       case when not has_table_privilege('authenticated', 'public.race_engineer_memory', 'insert') then 'ja' else 'NEIN' end;
