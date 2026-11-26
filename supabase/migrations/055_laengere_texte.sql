-- =========================================================
-- GSRA – 055: Längere Beschreibungen (Wunsch 26.11.) – mit echter Grenze in der Datenbank
-- =========================================================
-- * Profil-Beschreibung („Über mich“ im Dashboard): bis 7.000 Zeichen (≈ 1.000 Wörter).
--   SICHERHEITSLÜCKE geschlossen: Bisher begrenzte nur das Eingabefeld (300 Zeichen) – in der Datenbank gab es
--   KEINE Grenze, jemand hätte direkt riesige Texte speichern können (Speicher, Ladezeit für alle, die das Profil
--   öffnen). Jetzt prüft die Datenbank selbst.
-- * Karriere-Einträge, Beschreibung: bis 7.000 Zeichen (vorher 300); Absätze (Zeilenumbrüche) bleiben erhalten,
--   andere Steuerzeichen werden weiterhin entfernt.
-- * Gedächtnis des Renningenieurs (eigene Einträge): bis 1.000 Zeichen (vorher 200). Was sich der Renningenieur
--   selbst merkt, bleibt kurz (200 Zeichen, 054).
-- Darf mehrfach laufen. Am Ende: Kontrollabfrage („bereit“ …).
-- =========================================================

-- 1) Profil-Beschreibung: Grenze in der Datenbank (bestehende Texte sind über das Eingabefeld ohnehin ≤ 300)
alter table public.profiles drop constraint if exists profiles_bio_laenge;
alter table public.profiles add constraint profiles_bio_laenge
  check (bio is null or char_length(bio) <= 7000) not valid;
do $$
begin
  alter table public.profiles validate constraint profiles_bio_laenge;
exception when check_violation then
  raise notice 'Hinweis: Es gibt ältere Beschreibungen über 7.000 Zeichen – sie bleiben, neue Änderungen werden geprüft.';
end $$;

-- 2) Karriere: alte Grenze für „detail“ entfernen (egal, wie sie heißt), neue setzen
do $$
declare c record;
begin
  for c in select distinct con.conname
             from pg_constraint con
             join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
            where con.conrelid = 'public.career_entries'::regclass
              and con.contype = 'c'
              and a.attname = 'detail'
  loop
    execute format('alter table public.career_entries drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.career_entries add constraint career_entries_detail_check
  check (detail is null or char_length(detail) <= 7000);

-- Absätze in der Beschreibung behalten: nur Steuerzeichen AUSSER Zeilenumbruch entfernen
create or replace function public.career_entries_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.title := btrim(regexp_replace(new.title, '[[:cntrl:]]', ' ', 'g'));
  new.detail := nullif(btrim(regexp_replace(regexp_replace(coalesce(new.detail, ''), '\r\n?', E'\n', 'g'),
                                            '[\x01-\x09\x0B-\x1F\x7F]', ' ', 'g')), '');
  new.link := nullif(btrim(coalesce(new.link, '')), '');
  if tg_op = 'INSERT' and (select count(*) from public.career_entries c where c.user_id = new.user_id) >= 40 then
    raise exception 'Du hast schon 40 Karriere-Einträge. Lösche einen älteren, um einen neuen hinzuzufügen.';
  end if;
  if tg_op = 'UPDATE' then new.user_id := old.user_id; new.created_at := old.created_at; end if;
  return new;
end;
$$;
revoke execute on function public.career_entries_guard() from public, anon, authenticated;

-- 3) Gedächtnis des Renningenieurs: eigene Einträge bis 1.000 Zeichen
do $$
declare c record;
begin
  for c in select distinct con.conname
             from pg_constraint con
             join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
            where con.conrelid = 'public.race_engineer_memory'::regclass
              and con.contype = 'c'
              and a.attname = 'text'
  loop
    execute format('alter table public.race_engineer_memory drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.race_engineer_memory add constraint race_engineer_memory_text_check
  check (char_length(text) between 2 and 1000);

create or replace function public.race_engineer_remember(_art text, _text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me  uuid := auth.uid();
  _txt text := public.race_engineer_clean(_text, 1000);
  _id  uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  if public.is_banned() then raise exception 'Dein Konto ist gesperrt.'; end if;
  if _txt is null or char_length(_txt) < 2 then raise exception 'Bitte schreib, was sich dein Renningenieur merken soll.'; end if;
  if _art is null or _art not in ('vorliebe', 'ziel', 'staerke', 'schwaeche', 'notiz') then raise exception 'Unbekannte Art.'; end if;
  if (select count(*) from public.race_engineer_memory where user_id = _me) >= 100 then
    raise exception 'Das Gedächtnis ist voll (100 Einträge). Lösche zuerst ältere Einträge.';
  end if;
  if (select count(*) from public.race_engineer_memory where user_id = _me and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Zu viele Einträge in kurzer Zeit. Bitte warte etwas.';
  end if;
  insert into public.race_engineer_memory (user_id, art, text, quelle) values (_me, _art, _txt, 'fahrer') returning id into _id;
  return _id;
end;
$$;
revoke execute on function public.race_engineer_remember(text, text) from public, anon;
grant execute on function public.race_engineer_remember(text, text) to authenticated;

-- ---------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------
select 'Längere Texte 055' as pruefung,
       case when exists (select 1 from pg_constraint where conname = 'profiles_bio_laenge' and pg_get_constraintdef(oid) like '%7000%')
             and exists (select 1 from pg_constraint where conname = 'career_entries_detail_check' and pg_get_constraintdef(oid) like '%7000%')
             and exists (select 1 from pg_constraint where conname = 'race_engineer_memory_text_check' and pg_get_constraintdef(oid) like '%1000%')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Je genau eine Grenze',
       case when (select count(*) from pg_constraint con join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
                   where con.conrelid = 'public.career_entries'::regclass and con.contype = 'c' and a.attname = 'detail') = 1
             and (select count(*) from pg_constraint con join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
                   where con.conrelid = 'public.race_engineer_memory'::regclass and con.contype = 'c' and a.attname = 'text') = 1
            then 'ja' else 'NEIN' end;
