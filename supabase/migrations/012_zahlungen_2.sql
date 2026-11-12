-- =========================================================
-- GSRA Zahlungen 2: Team-Einladungslinks, mehrere Boni in einer Zahlung, „zuletzt online“ im Profil
-- Voraussetzung: gsra_zahlungen_1.sql wurde ausgeführt. Einmal komplett im SQL Editor ausführen (darf mehrfach laufen).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Einladungslink fürs Alliance-Team (14 Tage gültig, die Teamleitung kann jederzeit einen neuen erstellen)
-- ---------------------------------------------------------
alter table public.teams add column if not exists invite_token      text;
alter table public.teams add column if not exists invite_created_at timestamptz;
create unique index if not exists teams_invite_token_idx on public.teams (invite_token);

-- Gemeinsame Prüfung für „per GSRA-ID hinzufügen“ und „per Link beitreten“
create or replace function public.team_insert_member(_team uuid, _target uuid, _self boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (select 1 from public.team_members where team_id = _team and user_id = _target) then
    raise exception '%', case when _self then 'Du bist bereits in diesem Team.' else 'Diese Person ist bereits in eurem Team.' end;
  end if;
  if public.plan_of(_target) = 'alliance' then
    raise exception '%', case when _self then 'Du bist bereits Mitglied eines anderen Teams. Verlasse es zuerst.'
                              else 'Diese Person ist bereits Mitglied eines Teams.' end;
  end if;
  if exists (select 1 from public.user_plans p where p.user_id = _target and p.status in ('active', 'trialing', 'past_due')
             and not p.cancel_at_period_end and (p.current_period_end is null or p.current_period_end > now())) then
    raise exception '%', case when _self then 'Du hast ein eigenes Pole-Abo. Kündige es zuerst unter „Abo verwalten“, damit du nicht doppelt zahlst.'
                              else 'Diese Person hat ein eigenes Pole-Abo. Sie sollte es zuerst kündigen, damit sie nicht doppelt zahlt.' end;
  end if;
  -- Mitgliedschaft in einem beendeten Team zählt nicht mehr
  delete from public.team_members where user_id = _target;
  perform pg_advisory_xact_lock(hashtext('gsra_team:' || _team::text));
  if (select count(*) from public.team_members where team_id = _team) >= 10 then
    raise exception 'Das Team ist voll – das Alliance-Abo gilt für höchstens 10 Personen.';
  end if;
  insert into public.team_members (team_id, user_id) values (_team, _target);
end;
$$;
revoke execute on function public.team_insert_member(uuid, uuid, boolean) from public, anon, authenticated;

-- Teamleitung: Mitglied per GSRA-ID hinzufügen (jetzt über die gemeinsame Prüfung)
create or replace function public.team_add_member(_gsra_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me     uuid := auth.uid();
  _team   public.teams%rowtype;
  _target uuid;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  select * into _team from public.teams where owner_id = _me and status in ('active', 'trialing', 'past_due');
  if _team.id is null then raise exception 'Nur die Teamleitung eines aktiven Alliance-Abos kann Mitglieder hinzufügen.'; end if;
  select id into _target from public.profiles where gsra_id = _gsra_id;
  if _target is null then raise exception 'Zu dieser GSRA-ID gibt es kein Konto.'; end if;
  perform public.team_insert_member(_team.id, _target, false);
end;
$$;

-- Teamleitung: Einladungslink holen (neu erstellen, wenn keiner da, abgelaufen oder ausdrücklich gewünscht)
create or replace function public.team_invite_link(_renew boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me   uuid := auth.uid();
  _team public.teams%rowtype;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  select * into _team from public.teams where owner_id = _me and status in ('active', 'trialing', 'past_due');
  if _team.id is null then raise exception 'Nur die Teamleitung eines aktiven Alliance-Abos kann einladen.'; end if;
  if _renew or _team.invite_token is null or _team.invite_created_at < now() - interval '14 days' then
    update public.teams set invite_token = replace(gen_random_uuid()::text, '-', ''), invite_created_at = now()
    where id = _team.id
    returning * into _team;
  end if;
  return jsonb_build_object('token', _team.invite_token, 'expires_at', _team.invite_created_at + interval '14 days');
end;
$$;

-- Was steht hinter einem Einladungslink? (auch ohne Anmeldung, damit die Seite „Einladung von …“ zeigen kann)
create or replace function public.team_invite_info(_token text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((
    select jsonb_build_object(
      'valid', true,
      'owner_name', (select username from public.profiles where id = t.owner_id),
      'members', (select count(*) from public.team_members m where m.team_id = t.id),
      'is_member', exists (select 1 from public.team_members m where m.team_id = t.id and m.user_id = auth.uid()))
    from public.teams t
    where t.invite_token = _token and length(_token) >= 24
      and t.invite_created_at > now() - interval '14 days'
      and t.status in ('active', 'trialing', 'past_due')
  ), jsonb_build_object('valid', false));
$$;

-- Per Einladungslink beitreten
create or replace function public.team_join(_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me   uuid := auth.uid();
  _team public.teams%rowtype;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  select * into _team from public.teams
  where invite_token = _token and length(_token) >= 24
    and invite_created_at > now() - interval '14 days'
    and status in ('active', 'trialing', 'past_due');
  if _team.id is null then raise exception 'Dieser Einladungslink ist ungültig oder abgelaufen. Bitte die Teamleitung um einen neuen Link.'; end if;
  perform public.team_insert_member(_team.id, _me, true);
  return jsonb_build_object('owner_name', (select username from public.profiles where id = _team.owner_id));
end;
$$;

revoke execute on function public.team_invite_link(boolean) from public, anon;
grant execute on function public.team_invite_link(boolean) to authenticated;
revoke execute on function public.team_invite_info(text) from public;
grant execute on function public.team_invite_info(text) to anon, authenticated;
revoke execute on function public.team_join(text) from public, anon;
grant execute on function public.team_join(text) to authenticated;

-- my_membership: Teamleitung sieht zusätzlich den aktuellen Einladungslink
create or replace function public.my_membership()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  _me   uuid := auth.uid();
  _team public.teams%rowtype;
begin
  if _me is null then raise exception 'Bitte melde dich an.'; end if;
  select t.* into _team from public.teams t join public.team_members tm on tm.team_id = t.id where tm.user_id = _me;
  return jsonb_build_object(
    'plan', public.plan_of(_me),
    'pole', (select to_jsonb(p) - 'stripe_subscription_id' from public.user_plans p where p.user_id = _me),
    'team', case when _team.id is null then null else jsonb_build_object(
      'id', _team.id,
      'is_owner', _team.owner_id = _me,
      'owner_name', (select username from public.profiles where id = _team.owner_id),
      'status', _team.status,
      'current_period_end', _team.current_period_end,
      'cancel_at_period_end', _team.cancel_at_period_end,
      'invite_token', case when _team.owner_id = _me and _team.invite_created_at > now() - interval '14 days' then _team.invite_token end,
      'invite_expires_at', case when _team.owner_id = _me then _team.invite_created_at + interval '14 days' end,
      'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', tm.user_id, 'username', p.username,
                                                               'gsra_id', p.gsra_id, 'avatar_url', p.avatar_url,
                                                               'is_owner', tm.user_id = _team.owner_id)
                                            order by tm.user_id <> _team.owner_id, tm.added_at), '[]'::jsonb)
                  from public.team_members tm left join public.profiles p on p.id = tm.user_id
                  where tm.team_id = _team.id)) end,
    'has_customer', exists (select 1 from public.billing_customers c where c.user_id = _me));
end;
$$;

-- ---------------------------------------------------------
-- 2) Mehrere Boni in einer Zahlung (z. B. direkt beim Erstellen des Inserats): ein Beleg pro Bonus
-- ---------------------------------------------------------
alter table public.payments drop constraint if exists payments_stripe_session_id_key;
create unique index if not exists payments_session_kind_idx on public.payments (stripe_session_id, kind);

create or replace function public.stripe_apply_payment(_session_id text, _kind text, _user uuid, _listing_id text,
                                                       _amount_cents integer, _currency text, _customer_id text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _owner text;
begin
  if _customer_id is not null and _user is not null then
    insert into public.billing_customers (user_id, stripe_customer_id) values (_user, _customer_id)
    on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id;
  end if;

  -- Jeder Bonus einer Stripe-Sitzung wird genau einmal verbucht (Stripe kann Meldungen wiederholen)
  insert into public.payments (user_id, kind, listing_id, stripe_session_id, amount_cents, currency)
  values (_user, _kind, _listing_id, _session_id, _amount_cents, _currency)
  on conflict (stripe_session_id, kind) do nothing;
  if not found then return 'bereits verbucht'; end if;

  if _kind in ('highlight', 'bump', 'top') then
    select m.user_id::text into _owner from public.marketplace m where m.id::text = _listing_id;
    if _owner is null then return 'Inserat nicht gefunden'; end if;
    update public.marketplace m set
      highlighted = m.highlighted or _kind = 'highlight',
      top_ad      = m.top_ad or _kind = 'top',
      bump_since  = case when _kind = 'bump' then now() else m.bump_since end
    where m.id::text = _listing_id;
  end if;
  return 'verbucht';
end;
$$;
revoke execute on function public.stripe_apply_payment(text, text, uuid, text, integer, text, text) from public, anon, authenticated;
do $$
begin
  grant execute on function public.stripe_apply_payment(text, text, uuid, text, integer, text, text) to service_role;
exception when undefined_object then null;  -- im Nachbau ohne Rolle service_role
end $$;

-- ---------------------------------------------------------
-- 3) „Zuletzt online“ für alle Angemeldeten (auf allen GSRA-Seiten gemessen, nicht nur im Messenger).
--    Freunde sehen die genaue Uhrzeit, alle anderen nur den Tag. Der Spielstatus bleibt nur für Freunde sichtbar.
-- ---------------------------------------------------------
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
            'online', p.last_seen_at > now() - interval '3 minutes',
            'exact', _user = auth.uid() or public.is_friend(_user),
            'last_seen_at', case when _user = auth.uid() or public.is_friend(_user) then p.last_seen_at
                                 else date_trunc('hour', p.last_seen_at) end)
          from public.user_presence p where p.user_id = _user)
  end;
$$;
revoke execute on function public.last_seen_of(uuid) from public, anon;
grant execute on function public.last_seen_of(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 4) Kontrolle (ändert nichts)
-- ---------------------------------------------------------
select 'Team-Einladungslinks' as pruefung,
       case when to_regprocedure('public.team_join(text)') is not null
             and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'teams' and column_name = 'invite_token')
            then 'bereit' else 'FEHLT' end as ergebnis
union all
select 'Mehrere Boni pro Zahlung',
       case when exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'payments_session_kind_idx')
             and not exists (select 1 from pg_constraint where conname = 'payments_stripe_session_id_key')
            then 'bereit' else 'FEHLT' end
union all
select 'Zuletzt online im Profil',
       case when to_regprocedure('public.last_seen_of(uuid)') is not null then 'bereit' else 'FEHLT' end;
