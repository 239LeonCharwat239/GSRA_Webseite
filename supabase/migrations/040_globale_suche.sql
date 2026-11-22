-- =========================================================
-- GSRA 040 – Globale Suche (Entscheidung 22.11.)
-- Ein Suchfeld für die ganze Webseite, Treffer nach Rubriken: Mitglieder, Nachrichten, Foren und Gruppen,
-- Setups, Marktplatz, Coaching, Rennen.
-- Sicherheit: Die Suche läuft mit den Rechten der suchenden Person (security invoker). Es gelten also genau die
-- Regeln der Tabellen – Gäste finden nur Öffentliches, Nachrichten nur aus eigenen Chats, Gruppen und Foren
-- (nicht von Blockierten, nicht „für mich gelöscht“, keine gelöschten Nachrichten). Öffentliche Foren findet
-- auch, wer noch nicht Mitglied ist (wie bisher in der Forensuche, ohne Inhalte).
-- Tempo: Trigramm-Indizes (pg_trgm) – schnell auch bei sehr vielen Einträgen; Namen und Fahrzeuge werden auch
-- mit kleinen Tippfehlern gefunden („Porche“ → „Porsche“). Nachrichten ab 3 Zeichen, sonst ab 2 Zeichen.
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 003, 009, 014, 024 und 026 voraus.
-- =========================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
-- Die Suche läuft mit den Rechten der suchenden Person – sie braucht dafür die Such-Operatoren aus „extensions“
-- (in Supabase meist schon so eingestellt; hier sichergestellt)
grant usage on schema extensions to anon, authenticated;

-- ---------------------------------------------------------
-- 1) Such-Indizes
-- ---------------------------------------------------------
create index if not exists messages_text_trgm_idx        on public.messages        using gin (text extensions.gin_trgm_ops);
create index if not exists profiles_username_trgm_idx    on public.profiles        using gin (username extensions.gin_trgm_ops);
create index if not exists setups_car_trgm_idx           on public.setups          using gin (car_model extensions.gin_trgm_ops);
create index if not exists setups_track_trgm_idx         on public.setups          using gin (track_name extensions.gin_trgm_ops);
create index if not exists marketplace_title_trgm_idx    on public.marketplace     using gin (title extensions.gin_trgm_ops);
create index if not exists chats_title_trgm_idx          on public.chats           using gin (title extensions.gin_trgm_ops);
create index if not exists coaching_offers_title_trgm_idx on public.coaching_offers using gin (title extensions.gin_trgm_ops);
create index if not exists events_title_trgm_idx         on public.events          using gin (title extensions.gin_trgm_ops);

-- ---------------------------------------------------------
-- 2) Suchfunktion
-- ---------------------------------------------------------
create or replace function public.gsra_search(_q text)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public', 'extensions'
as $$
declare
  _me   uuid := auth.uid();
  _term text := left(btrim(regexp_replace(coalesce(_q, ''), '\s+', ' ', 'g')), 60);
  _like text;
  _res  jsonb := '{}'::jsonb;
begin
  if char_length(_term) < 2 then return _res; end if;
  -- % und _ sind in LIKE Platzhalter – als normale Zeichen suchen
  _like := '%' || replace(replace(replace(_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- Setups (für alle sichtbar; Pro Setups erscheinen als Vorschau wie im Setup Hub)
  _res := _res || jsonb_build_object('setups', coalesce((
    select jsonb_agg(x) from (
      select s.id, s.simulation, s.car_model, s.track_name, s.setup_type, coalesce(s.is_pro, false) as is_pro
      from public.setups s
      where s.car_model ilike _like or s.track_name ilike _like or s.car_model % _term or s.track_name % _term
      order by greatest(similarity(coalesce(s.car_model, ''), _term), similarity(coalesce(s.track_name, ''), _term)) desc, s.created_at desc
      limit 5) x), '[]'::jsonb));

  -- Marktplatz (verkaufte Inserate nicht)
  _res := _res || jsonb_build_object('marktplatz', coalesce((
    select jsonb_agg(x) from (
      select m.id, m.title, m.price, m.status, (m.images)[1] as image
      from public.marketplace m
      where coalesce(m.status, 'aktiv') <> 'verkauft' and (m.title ilike _like or m.title % _term)
      order by similarity(coalesce(m.title, ''), _term) desc, m.created_at desc
      limit 5) x), '[]'::jsonb));

  if _me is null then return _res; end if;   -- alles Weitere nur für Angemeldete

  -- Mitglieder (Name oder GSRA-ID; nicht man selbst, keine Blockierten)
  _res := _res || jsonb_build_object('mitglieder', coalesce((
    select jsonb_agg(x) from (
      select p.id, p.username, p.gsra_id, p.avatar_url
      from public.profiles p
      where p.id <> _me and p.username is not null and not public.i_blocked(p.id)
        and (p.username ilike _like or p.username % _term or p.gsra_id::text = _term)
      order by coalesce(p.gsra_id::text = _term, false) desc, similarity(p.username, _term) desc
      limit 5) x), '[]'::jsonb));

  -- Foren und Gruppen: eigene (auch private) und öffentliche Foren
  _res := _res || jsonb_build_object('foren', coalesce((
    select jsonb_agg(x) from (
      select g.id, g.title, g.is_public, g.is_member from (
        select c.id, c.title, coalesce(c.is_public, false) as is_public, true as is_member
        from public.chats c
        where c.title is not null and c.user1_id = c.user2_id and c.title ilike _like
          and (exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = _me)
               or (c.title = 'GSRA Official / Community Forum'))
        union
        select f.id, f.title, true, f.is_member from public.search_public_groups(_term) f
      ) g
      order by g.is_member desc, g.title
      limit 5) x), '[]'::jsonb));

  -- Nachrichten aus eigenen Chats, Gruppen und Foren (ab 3 Zeichen)
  if char_length(_term) >= 3 then
    _res := _res || jsonb_build_object('nachrichten', coalesce((
      select jsonb_agg(x) from (
        select m.id, m.chat_id, m.created_at,
               case when c.title is not null and c.user1_id = c.user2_id then c.title end as chat_title,
               (select p.username from public.profiles p
                 where p.id = case when c.user1_id = _me then c.user2_id else c.user1_id end) as partner,
               (select p.username from public.profiles p where p.id = m.sender_id) as sender,
               m.sender_id = _me as mine,
               substr(m.text, greatest(1, strpos(lower(m.text), lower(_term)) - 50), 160) as snippet
        from public.messages m
        join public.chats c on c.id = m.chat_id
        where m.text ilike _like
          and (c.user1_id = _me or c.user2_id = _me
               or exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = _me)
               or (c.title = 'GSRA Official / Community Forum' and c.user1_id = c.user2_id))
          and m.text not in ('Du hast diese Nachricht gelöscht', 'Diese Nachricht wurde gelöscht',
                             'Diese Nachricht wurde von einem Gruppenadmin gelöscht')
          and not exists (select 1 from public.message_hides h where h.user_id = _me and h.message_id = m.id)
        order by m.created_at desc
        limit 8) x), '[]'::jsonb));
  end if;

  -- Coaching (nur aktive Angebote mit gültiger Lizenz – die Tabellenregel prüft das zusätzlich)
  _res := _res || jsonb_build_object('coaching', coalesce((
    select jsonb_agg(x) from (
      select o.id, o.coach_id, o.title, o.category, o.simulation, o.price_cents,
             (select p.username from public.profiles p where p.id = o.coach_id) as coach
      from public.coaching_offers o
      where o.active and (o.title ilike _like or o.title % _term or o.category ilike _like or o.simulation ilike _like
                          or exists (select 1 from public.profiles p where p.id = o.coach_id and p.username ilike _like))
      order by similarity(o.title, _term) desc, o.created_at desc
      limit 5) x), '[]'::jsonb));

  -- Rennen (anstehende und laufende)
  _res := _res || jsonb_build_object('rennen', coalesce((
    select jsonb_agg(x) from (
      select e.id, e.title, e.simulation, e.track, e.event_date
      from public.events e
      where e.event_date >= now() - interval '6 hours'
        and (e.title ilike _like or e.track ilike _like or e.simulation ilike _like or e.title % _term)
      order by e.event_date
      limit 5) x), '[]'::jsonb));

  return _res;
end;
$$;

revoke execute on function public.gsra_search(text) from public;
grant execute on function public.gsra_search(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Kontrolle (erwartet: „bereit“, „bereit“, „ja“)
-- ---------------------------------------------------------
select 'Such-Indizes (8 Stück, Tippfehler-tolerant)' as pruefung,
       case when (select count(*) from pg_indexes where schemaname = 'public' and indexname like '%_trgm_idx') >= 8
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Suchfunktion (läuft mit den Rechten der suchenden Person)',
       case when to_regprocedure('public.gsra_search(text)') is not null
             and not (select prosecdef from pg_proc where oid = 'public.gsra_search(text)'::regprocedure)
            then 'bereit' else 'FEHLT' end
union all
select 'Für Gäste und Mitglieder aufrufbar',
       case when has_function_privilege('anon', 'public.gsra_search(text)', 'execute')
             and has_function_privilege('authenticated', 'public.gsra_search(text)', 'execute') then 'ja' else 'NEIN' end;
