-- =========================================================
-- GSRA Setup Hub: Pro Setups veröffentlichen NUR eingetragene Pro-Fahrer (Tabelle pro_creators).
-- Website-Admins dürfen Pro Setups weiterhin sehen, moderieren und löschen, aber nicht selbst veröffentlichen.
-- Voraussetzung: gsra_setup_hub.sql. Einmal im SQL Editor ausführen (darf mehrfach laufen).
-- =========================================================

create or replace function public.setups_validate()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  _ext text := public.setup_allowed_ext(new.simulation);
begin
  if new.is_pro and (tg_op = 'INSERT' or not old.is_pro) and auth.uid() is not null
     and not public.is_pro_creator(auth.uid()) then
    raise exception 'Pro Setups können nur GSRA-Pro-Fahrer veröffentlichen.';
  end if;
  if tg_op = 'INSERT' and _ext is not null then
    if _ext = '' then
      if new.file_url is not null or new.file_name is not null then
        raise exception 'Für % gibt es keine Setup-Datei – bitte trage die Werte ein oder lade Screenshots hoch.', new.simulation;
      end if;
    elsif new.file_name is null or lower(new.file_name) !~ ('\.' || _ext || '$') then
      raise exception 'Für % sind nur .%-Dateien erlaubt.', new.simulation, _ext;
    elsif not new.is_pro and new.file_url is null then
      raise exception 'Die Setup-Datei fehlt.';
    elsif new.is_pro and new.file_url is not null then
      raise exception 'Pro Setups werden nicht öffentlich verlinkt.';
    end if;
  end if;
  return new;
end;
$$;

-- Privater Pro-Speicher: hochladen nur Pro-Fahrer (in den eigenen Ordner)
drop policy if exists "GSRA Pro Setups hochladen" on storage.objects;
create policy "GSRA Pro Setups hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'setups-pro' and (storage.foldername(name))[1] = auth.uid()::text
              and (select public.is_pro_creator(auth.uid())));

drop policy if exists "GSRA Pro Setups nur Pro-Fahrer laden hoch" on storage.objects;
create policy "GSRA Pro Setups nur Pro-Fahrer laden hoch" on storage.objects
  as restrictive for insert
  with check (bucket_id <> 'setups-pro' or ((storage.foldername(name))[1] = auth.uid()::text
              and (select public.is_pro_creator(auth.uid()))));

-- Kontrolle (ändert nichts)
select 'Pro Setups nur für Pro-Fahrer' as pruefung,
       case when position('is_site_admin' in pg_get_functiondef('public.setups_validate()'::regprocedure)) = 0
            then 'bereit' else 'FEHLT' end as ergebnis;
