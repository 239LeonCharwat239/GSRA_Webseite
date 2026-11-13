-- =========================================================
-- GSRA 022 – Moderatoren dürfen Events im Rennkalender anlegen, ändern und löschen (13.11.)
-- Bisher nur Admins. Wie alle Moderations-Rechte nur mit bestätigtem Zwei-Faktor-Code (is_moderator()
-- umfasst Moderatoren und Admins). Jede Änderung landet weiterhin im Protokoll (021).
-- Einmal im SQL Editor ausführen (darf mehrfach laufen). Setzt 021 voraus.
-- =========================================================

alter policy "GSRA: Events anlegen (Admins)" on public.events
  with check ((select public.is_moderator()));
alter policy "GSRA: Events ändern (Admins)" on public.events
  using ((select public.is_moderator())) with check ((select public.is_moderator()));
alter policy "GSRA: Events löschen (Admins)" on public.events
  using ((select public.is_moderator()));
alter policy "GSRA: Events nur von Admins anlegen" on public.events
  with check ((select public.is_moderator()));
alter policy "GSRA: Events nur von Admins ändern" on public.events
  using ((select public.is_moderator())) with check ((select public.is_moderator()));
alter policy "GSRA: Events nur von Admins löschen" on public.events
  using ((select public.is_moderator()));

notify pgrst, 'reload schema';

-- Kontrolle (ändert nichts) – erwartet: 6 von 6
select 'Event-Regeln für das Moderationsteam' as pruefung,
       count(*) filter (where coalesce(qual, '') || coalesce(with_check, '') like '%is_moderator()%')::text || ' von 6' as ergebnis
from pg_policies
where schemaname = 'public' and tablename = 'events' and cmd in ('INSERT', 'UPDATE', 'DELETE')
  and policyname like 'GSRA: Events%';
