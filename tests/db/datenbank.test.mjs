// Nachbau-Test der Datenbank: spielt alle Skripte aus supabase/migrations der Reihe nach ein (jedes zweimal,
// damit Wiederholbarkeit geprüft ist) und prüft erlaubte UND verbotene Zugriffe als Gast, Nutzer und Admin.
// Ausgangslage: absichtlich offene Altregeln wie in der ursprünglichen Datenbank.
// Start: im Ordner tests/db „npm install“ (einmalig) und dann „npm test“.
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations");
const BY_NUMBER = Object.fromEntries(readdirSync(MIGRATIONS).filter(f => /^\d{3}_.+\.sql$/.test(f)).map(f => [f.slice(0, 3), join(MIGRATIONS, f)]));
const [ROLES_SQL, GUARD_SQL, AUSBAU_SQL, AUSBAU2_SQL, AUSBAU3_SQL, SICHERHEIT_SQL, NAMEN_SQL, ORT_SQL, MARKT_SQL, UMKREIS_SQL, ZAHLUNG_SQL, ZAHLUNG2_SQL, KUENDIGUNG_SQL, SETUPHUB_SQL, PRONUR_SQL, SICHERHEIT2_SQL, ADVISOR_SQL, ADMIN_MFA_SQL, MFA_PFLICHT_SQL, LIMITS_SQL, MODERATION_SQL, EVENTS_SQL, BEWERTUNGEN_SQL, COACHING_SQL, BEZAHLUNG_SQL, LIZENZ_SQL, PRO_SQL, ROLLE_SQL, SPRACHEN_SQL, KALENDER_SQL, ALLE_SPRACHEN_SQL, ANHAENGE_SQL, ERINNERUNG_SQL, FEHLER_SQL, REKLAMATION_SQL, COACH_SPERRE_SQL, URLAUB_SQL, VARIANTEN_SQL, ZAEHLER_SQL, SUCHE_SQL, CHAT_SETUPS_SQL, GERAET_SQL, UNTERSTUETZER_SQL, KARRIERE_SQL, STINTPLAN_SQL, LIVERIES_SQL, CHATSICHER_SQL, AUFRAEUMEN_SQL, ONLINE_SQL, RE_STIL_SQL, APP_LOGIN_SQL] =
    Array.from({ length: 51 }, (_, i) => BY_NUMBER[String(i + 1).padStart(3, "0")]);
const unknown = Object.keys(BY_NUMBER).filter(n => Number(n) > 51);
if (unknown.length) console.log(`Hinweis: Skripte ${unknown.join(", ")} sind noch nicht im Test berücksichtigt.\n`);
// ALT_SETUPS=1: Tabelle setups wie in der echten Datenbank ohne uploader_id (und weitere Spalten der Seite)
const ALT_SETUPS = process.env.ALT_SETUPS === "1";
const db = new PGlite({ extensions: { pg_trgm } }); // pg_trgm: Such-Indizes wie in Supabase (SQL 040)

const U = {
    admin: "10000000-0000-0000-0000-000000000001", anna: "10000000-0000-0000-0000-000000000002",
    max: "10000000-0000-0000-0000-000000000003", lena: "10000000-0000-0000-0000-000000000004",
    tim: "10000000-0000-0000-0000-000000000005", seller: "10000000-0000-0000-0000-000000000006"
};
const FORUM = "20000000-0000-0000-0000-0000000000ff", G = "20000000-0000-0000-0000-000000000001", D = "20000000-0000-0000-0000-000000000002";

let failures = 0;
const check = (label, ok, detail = "") => { console.log(`${ok ? "OK    " : "FEHLER"} ${label}${detail ? "  → " + detail : ""}`); if (!ok) failures++; };

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, created_at timestamptz default now(), banned_until timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; grant execute on function auth.jwt() to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid default auth.uid());
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[] := string_to_array(name, '/'); begin return _parts[1:array_length(_parts, 1) - 1]; end $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated; grant all on storage.objects to anon, authenticated; grant select on storage.buckets to anon, authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;
insert into storage.buckets (id, name, public) values ('chat_attachments', 'chat_attachments', true), ('marketplace', 'marketplace', true), ('setups', 'setups', true);
-- Altregeln: jeder darf in Marktplatz, Setups und Chat-Anhänge hochladen, ersetzen und löschen
create policy "Public uploads" on storage.objects for insert with check (bucket_id in ('marketplace', 'setups', 'chat_attachments'));
create policy "Public updates" on storage.objects for update using (bucket_id in ('marketplace', 'setups'));
create policy "Public deletes" on storage.objects for delete using (bucket_id in ('marketplace', 'setups'));
create policy "Public reads" on storage.objects for select using (true);

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, username text, full_name text, role text default 'user');
create table public.chats (id uuid primary key default gen_random_uuid(), user1_id uuid references auth.users(id) on delete cascade, user2_id uuid references auth.users(id) on delete cascade, title text, last_message text, created_at timestamptz default now());
create table public.messages (
  id uuid primary key default gen_random_uuid(), chat_id uuid references public.chats(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade, text text, image_url text,
  reply_to uuid references public.messages(id) on delete set null, reactions jsonb default '{}',
  is_edited boolean default false, edit_count int default 0, edited_at timestamptz,
  last_reaction_user uuid, last_reaction_emoji text, last_reaction_at timestamptz, created_at timestamptz default now());
create table public.chat_favorites (user_id uuid references auth.users(id) on delete cascade, chat_id uuid references public.chats(id) on delete cascade);
create table public.friendships (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, friend_id uuid references auth.users(id) on delete cascade, status text default 'pending');
create table public.marketplace (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), title text, price numeric, images text[], seller_name text, category text, condition text, location text, description text, created_at timestamptz default now());
${ALT_SETUPS
    ? "create table public.setups (id uuid primary key default gen_random_uuid(), car_model text, track_name text, file_url text, created_at timestamptz default now());"
    : "create table public.setups (id uuid primary key default gen_random_uuid(), simulation text, car_model text, track_name text, file_url text, file_name text, uploader_id uuid, likes integer default 0, dislikes integer default 0, created_at timestamptz default now());"}
create table public.events (id uuid primary key default gen_random_uuid(), title text, simulation text, track text, event_date timestamptz, password text,
  server_password text, description text, created_at timestamptz default now());   -- server_password/description wie in der echten Datenbank

CREATE OR REPLACE FUNCTION public.is_chat_participant(_chat_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  select exists (select 1 from public.chats c where c.id = _chat_id and ((c.title is not null and c.user1_id = c.user2_id) or c.user1_id = auth.uid() or c.user2_id = auth.uid())); $f$;

alter table public.profiles enable row level security; alter table public.chats enable row level security;
alter table public.messages enable row level security; alter table public.chat_favorites enable row level security;
alter table public.friendships enable row level security;
create policy "Profile lesen" on public.profiles for select using (true);
create policy "Eigenes Profil bearbeiten" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Nutzer können ihre eigenen Chats sehen" on public.chats for select to authenticated using (auth.uid() = user1_id or auth.uid() = user2_id or (title is not null and user1_id = user2_id));
create policy ci on public.chats for insert to authenticated with check (auth.uid() = user1_id or auth.uid() = user2_id);
create policy r_select on public.messages for select using (true);
create policy r_insert on public.messages for insert with check (auth.uid() = sender_id);
create policy r_upd on public.messages for update using (true) with check (true);
create policy fav on public.chat_favorites for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Alte offene Freundes-Regel" on public.friendships for all using (true) with check (true);

-- Absichtlich unsichere Ausgangslage für die drei Bereiche:
alter table public.marketplace enable row level security;
create policy "Enable all for everyone" on public.marketplace for all using (true) with check (true);   -- alles offen
-- setups: RLS AUS (jeder darf alles)
alter table public.events enable row level security;
create policy "Events offen" on public.events for all using (true) with check (true);                  -- alles offen

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

insert into auth.users (id, created_at) values
  ('${U.max}', now() - interval '30 days'), ('${U.admin}', now() - interval '60 days'), ('${U.anna}', now() - interval '20 days'),
  ('${U.lena}', now() - interval '10 days'), ('${U.tim}', now() - interval '5 days'), ('${U.seller}', now() - interval '3 days'),
  ('10000000-0000-0000-0000-000000000007', now() - interval '2 days');
insert into public.profiles (id, username, role) values
  ('${U.admin}', 'GSRA Admin', 'admin'), ('${U.anna}', 'Anna_GT3', 'user'), ('${U.max}', 'Max', 'user'),
  ('${U.lena}', 'Lena', 'user'), ('${U.tim}', 'Tim', 'user'), ('${U.seller}', 'Verkäufer', 'user'),
  ('10000000-0000-0000-0000-000000000007', 'max', 'user');
insert into public.chats (id, user1_id, user2_id, title) values
  ('${FORUM}', '${U.admin}', '${U.admin}', 'GSRA Official / Community Forum'), ('${G}', '${U.anna}', '${U.anna}', 'GT3 Setup Talk'), ('${D}', '${U.anna}', '${U.max}', null);
insert into public.messages (chat_id, sender_id, text) values ('${G}', '${U.anna}', 'Hallo');
insert into public.marketplace (id, user_id, title, price) values
  ('30000000-0000-0000-0000-000000000001', '${U.tim}', 'Fanatec DD1', 499), ('30000000-0000-0000-0000-000000000002', '${U.max}', 'Heusinkveld Pedale', 650);
${ALT_SETUPS ? `insert into public.setups (id, car_model, track_name, file_url) values
  ('40000000-0000-0000-0000-000000000001', 'BMW M4 GT3', 'Spa', 'https://x.supabase.co/storage/v1/object/public/setups/a.sto'),
  ('40000000-0000-0000-0000-000000000002', 'Porsche 992', 'Monza', 'https://x.supabase.co/storage/v1/object/public/setups/b.sto'),
  ('40000000-0000-0000-0000-000000000003', 'Altes Setup', 'Monza', '#');` : `insert into public.setups (id, simulation, car_model, track_name, file_url, file_name, uploader_id, likes, dislikes) values
  ('40000000-0000-0000-0000-000000000001', 'iRacing', 'BMW M4 GT3', 'Spa', 'https://x.supabase.co/storage/v1/object/public/setups/a.sto', 'a.sto', '${U.anna}', 7, 2),
  ('40000000-0000-0000-0000-000000000002', 'iRacing', 'Porsche 992', 'Monza', 'https://x.supabase.co/storage/v1/object/public/setups/b.sto', 'b.sto', '${U.max}', 0, 0),
  ('40000000-0000-0000-0000-000000000003', 'ACC', 'Altes Setup', 'Monza', '#', 'alt.sto', '${U.tim}', 3, 1);`}
insert into public.events (title, simulation, track, event_date, password) values ('GT3 Sprint Cup', 'iRacing', 'Spa', now() + interval '2 days', 'geheim123');
insert into storage.objects (bucket_id, name, owner) values ('marketplace', '${U.tim}/fanatec.jpg', '${U.tim}'), ('marketplace', 'alt_ohne_ordner.jpg', '${U.tim}');
`);

for (const file of [ROLES_SQL, GUARD_SQL, AUSBAU_SQL, AUSBAU2_SQL, AUSBAU3_SQL, SICHERHEIT_SQL]) await db.exec(readFileSync(file, "utf8"));
if (ALT_SETUPS) {
    // Neue Spalten sind da: gleiche Ausgangslage wie im Normalfall herstellen (ohne den Download-Link anzufassen)
    const cols = (await db.query(`select string_agg(column_name, ',' order by ordinal_position) as c from information_schema.columns where table_schema = 'public' and table_name = 'setups'`)).rows[0].c;
    check("Fehlende Spalten wurden ergänzt", ["uploader_id", "simulation", "file_name", "likes", "dislikes"].every(c => cols.split(",").includes(c)), cols);
    await db.exec(`
      update public.setups set simulation = 'iRacing', file_name = 'a.sto', uploader_id = '${U.anna}', likes = 7, dislikes = 2 where id = '40000000-0000-0000-0000-000000000001';
      update public.setups set simulation = 'iRacing', file_name = 'b.sto', uploader_id = '${U.max}', likes = 0, dislikes = 0 where id = '40000000-0000-0000-0000-000000000002';
      update public.setups set simulation = 'ACC', file_name = 'alt.sto', uploader_id = '${U.tim}', likes = 3, dislikes = 1 where id = '40000000-0000-0000-0000-000000000003';`);
}
const out = await db.exec(readFileSync(SICHERHEIT_SQL, "utf8")); // zweiter Lauf: muss wiederholbar sein
console.log("Kontrollabfrage:\n  " + out[out.length - 1].rows.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "), "\n");

const as = async (uid, fn) => {
    await db.exec(uid ? `set request.jwt.claim.sub = '${uid}'; set role authenticated;` : `set request.jwt.claim.sub = ''; set role anon;`);
    try { return await fn(); } finally { await db.exec(`reset role; set request.jwt.claim.sub = '';`); }
};
const q = async (sql) => { try { return { rows: (await db.query(sql)).rows, error: null }; } catch (e) { return { rows: [], error: e.message }; } };
const one = async (sql) => (await db.query(sql)).rows[0];
const M1 = "30000000-0000-0000-0000-000000000001", M2 = "30000000-0000-0000-0000-000000000002";
const S1 = "40000000-0000-0000-0000-000000000001", S2 = "40000000-0000-0000-0000-000000000002";

// --- Lesen ---
await as(null, async () => {
    check("Gäste sehen Inserate", (await q(`select id from public.marketplace`)).rows.length === 2);
    check("Gäste sehen Setups", (await q(`select id from public.setups`)).rows.length === 3);
    check("Gäste sehen keine Events (Server-Passwörter)", (await q(`select id from public.events`)).rows.length === 0);
    const w = await q(`insert into public.marketplace (user_id, title) values ('${U.tim}', 'Spam') returning id`);
    check("Gäste können keine Inserate anlegen", w.error !== null, w.error || "durchgelassen!");
    const u = await q(`update public.setups set car_model = 'gehackt' returning id`);
    check("Gäste können keine Setups ändern", u.error !== null || u.rows.length === 0, u.error || "durchgelassen!");
});

// --- Marktplatz ---
await as(U.max, async () => {
    const own = await q(`insert into public.marketplace (user_id, title, price) values ('${U.max}', 'Lenkrad', 200) returning id`);
    check("Eigenes Inserat anlegen", own.error === null && own.rows.length === 1, own.error || "");
    const fake = await q(`insert into public.marketplace (user_id, title) values ('${U.tim}', 'Im Namen von Tim') returning id`);
    check("Inserat im Namen anderer anlegen verboten (trotz offener Altregel)", fake.error !== null, fake.error || "durchgelassen!");
    const upd = await q(`update public.marketplace set price = 1 where id = '${M1}' returning id`);
    check("Fremdes Inserat ändern verboten", upd.rows.length === 0, upd.error || `${upd.rows.length} geändert`);
    const steal = await q(`update public.marketplace set user_id = '${U.max}' where id = '${M1}' returning id`);
    check("Fremdes Inserat übernehmen verboten", steal.rows.length === 0, steal.error || "durchgelassen!");
    const give = await q(`update public.marketplace set user_id = '${U.tim}' where id = '${M2}' returning id`);
    check("Eigenes Inserat jemand anderem zuschieben verboten", give.error !== null || give.rows.length === 0, give.error || "durchgelassen!");
    const del = await q(`delete from public.marketplace where id = '${M1}' returning id`);
    check("Fremdes Inserat löschen verboten", del.rows.length === 0, del.error || "durchgelassen!");
    const ownUpd = await q(`update public.marketplace set price = 600 where id = '${M2}' returning price`);
    check("Eigenes Inserat ändern", ownUpd.rows.length === 1 && Number(ownUpd.rows[0].price) === 600, ownUpd.error || "");
});
await as(U.admin, async () => {
    const del = await q(`delete from public.marketplace where id = '${M1}' returning id`);
    check("Website-Admin löscht fremdes Inserat", del.rows.length === 1, del.error || "");
});

// --- Setups ---
await as(U.max, async () => {
    const ins = await q(`insert into public.setups (simulation, car_model, track_name, file_url, file_name, uploader_id) values ('iRacing', 'Ferrari 296', 'Imola', 'https://x/c.sto', 'c.sto', '${U.max}') returning id`);
    check("Eigenes Setup hochladen", ins.error === null, ins.error || "");
    const fake = await q(`insert into public.setups (car_model, file_url, uploader_id) values ('x', 'https://x/d.sto', '${U.anna}') returning id`);
    check("Setup im Namen anderer verboten (RLS war vorher aus)", fake.error !== null, fake.error || "durchgelassen!");
    const js = await q(`insert into public.setups (car_model, file_url, uploader_id) values ('x', 'javascript:alert(1)', '${U.max}') returning id`);
    check("Download-Link muss https sein", js.error !== null, js.error || "durchgelassen!");
    const likes = await q(`update public.setups set likes = 9999 where id = '${S1}' returning id`);
    check("Zähler fremder Setups direkt ändern verboten", likes.rows.length === 0, likes.error || "durchgelassen!");
    const name = await q(`update public.setups set car_model = '<img src=x onerror=alert(1)>' where id = '${S1}' returning id`);
    check("Fremde Setups umbenennen verboten", name.rows.length === 0, name.error || "durchgelassen!");
    const del = await q(`delete from public.setups where id = '${S1}' returning id`);
    check("Fremde Setups löschen verboten", del.rows.length === 0, del.error || "durchgelassen!");

    // Abstimmen: eine Stimme pro Person
    const v1 = await q(`select * from public.vote_setup('${S1}', 1)`);
    check("Daumen hoch zählt", v1.error === null && v1.rows[0]?.new_likes === 8 && v1.rows[0]?.my_vote === 1, v1.error || JSON.stringify(v1.rows[0]));
    const v2 = await q(`select * from public.vote_setup('${S1}', 1)`);
    check("Zweites Mal zählt nicht doppelt", v2.rows[0]?.new_likes === 8, JSON.stringify(v2.rows[0]));
    const v3 = await q(`select * from public.vote_setup('${S1}', -1)`);
    check("Wechsel zu Daumen runter", v3.rows[0]?.new_likes === 7 && v3.rows[0]?.new_dislikes === 3, JSON.stringify(v3.rows[0]));
    const mine = await q(`select vote from public.setup_votes`);
    check("Eigene Stimme sichtbar", mine.rows.length === 1 && mine.rows[0].vote === -1);
    const v4 = await q(`select * from public.vote_setup('${S1}', 0)`);
    check("Stimme zurücknehmen", v4.rows[0]?.new_likes === 7 && v4.rows[0]?.new_dislikes === 2 && (await q(`select 1 from public.setup_votes`)).rows.length === 0, JSON.stringify(v4.rows[0]));
    const self = await q(`select * from public.vote_setup('${S2}', 1)`);
    check("Eigenes Setup bewerten verboten", self.error?.includes("Eigene Setups"), self.error || "durchgelassen!");
    const direct = await q(`insert into public.setup_votes (setup_id, user_id, vote) values ('${S1}', '${U.max}', 1)`);
    check("Stimmen nur über die Funktion", direct.error !== null, direct.error || "durchgelassen!");
    await q(`select * from public.vote_setup('${S1}', 1)`);
    const legacy = await q(`select * from public.vote_setup('40000000-0000-0000-0000-000000000003', 1)`);
    check("Ältere Einträge ohne https-Link lassen sich weiter bewerten", legacy.error === null && legacy.rows[0]?.new_likes === 4, legacy.error || JSON.stringify(legacy.rows[0]));
    const http = await q(`update public.setups set file_url = 'http://unsicher.example/x.sto' where id = '${S2}' returning id`);
    check("Eigenen Download-Link auf http ändern verboten", http.error !== null, http.error || "durchgelassen!");
});
await as(U.tim, async () => {
    const r = await q(`update public.setups set car_model = 'Altes Setup (überarbeitet)' where id = '40000000-0000-0000-0000-000000000003' returning id`);
    check("Eigentümer ändert älteren Eintrag (Link bleibt unverändert)", r.rows.length === 1, r.error || "");
});
await as(U.lena, async () => {
    const v = await q(`select * from public.vote_setup('${S1}', 1)`);
    check("Zweite Person zählt zusätzlich", v.rows[0]?.new_likes === 9, JSON.stringify(v.rows[0]));
    const others = await q(`select * from public.setup_votes`);
    check("Fremde Stimmen nicht sichtbar", others.rows.length === 1 && others.rows[0].user_id === U.lena);
});
await as(null, async () => {
    const v = await q(`select * from public.vote_setup('${S1}', 1)`);
    check("Ohne Login keine Stimme", v.error !== null, v.error || "durchgelassen!");
});
await as(U.anna, async () => {
    const del = await q(`delete from public.setups where id = '${S1}' returning id`);
    check("Eigentümerin löscht ihr Setup (Stimmen werden mitgelöscht)", del.rows.length === 1 && Number((await one(`select count(*) as n from public.setup_votes`)).n) >= 0, del.error || "");
});
const votesLeft = Number((await one(`select count(*) as n from public.setup_votes where setup_id = '${S1}'`)).n);
check("Keine verwaisten Stimmen", votesLeft === 0, String(votesLeft));

// --- Rennkalender ---
await as(U.max, async () => {
    const r = await q(`select title, password from public.events`);
    check("Angemeldete sehen Events", r.rows.length === 1 && r.rows[0].password === "geheim123");
    const ins = await q(`insert into public.events (title, simulation, track, event_date) values ('<script>alert(1)</script>', 'iRacing', 'x', now()) returning id`);
    check("Nur Admins legen Events an (trotz offener Altregel)", ins.error !== null, ins.error || "durchgelassen!");
    const upd = await q(`update public.events set title = 'gehackt' returning id`);
    check("Nur Admins ändern Events", upd.rows.length === 0, upd.error || "durchgelassen!");
    const del = await q(`delete from public.events returning id`);
    check("Nur Admins löschen Events", del.rows.length === 0, del.error || "durchgelassen!");
});
await as(U.admin, async () => {
    const ins = await q(`insert into public.events (title, simulation, track, event_date) values ('Endurance Cup', 'ACC', 'Monza', now() + interval '5 days') returning id`);
    check("Admin legt Event an", ins.error === null, ins.error || "");
    const del = await q(`delete from public.events where title = 'Endurance Cup' returning id`);
    check("Admin löscht Event", del.rows.length === 1, del.error || "");
});

// --- Gesperrte Konten ---
await db.exec(`insert into public.user_bans (user_id, reason) values ('${U.seller}', 'Spam')`);
await as(U.seller, async () => {
    const r = await q(`select id from public.marketplace`);
    check("Gesperrte sehen keine Inserate", r.rows.length === 0);
    const v = await q(`select * from public.vote_setup('${S2}', 1)`);
    check("Gesperrte können nicht abstimmen", v.error !== null, v.error || "durchgelassen!");
});

// --- Dateispeicher ---
await as(U.max, async () => {
    const root = await q(`insert into storage.objects (bucket_id, name) values ('marketplace', 'bild.jpg') returning id`);
    check("Marktplatz: Upload ohne eigenen Ordner verboten (trotz offener Altregel)", root.error !== null, root.error || "durchgelassen!");
    const own = await q(`insert into storage.objects (bucket_id, name) values ('marketplace', '${U.max}/bild.jpg') returning id`);
    check("Marktplatz: Upload in den eigenen Ordner", own.error === null, own.error || "");
    const foreign = await q(`insert into storage.objects (bucket_id, name) values ('setups', '${U.tim}/x.sto') returning id`);
    check("Setups: Upload in fremden Ordner verboten", foreign.error !== null, foreign.error || "durchgelassen!");
    const ownSetup = await q(`insert into storage.objects (bucket_id, name) values ('setups', '${U.max}/spa.sto') returning id`);
    check("Setups: Upload in den eigenen Ordner", ownSetup.error === null, ownSetup.error || "");
    const chat = await q(`insert into storage.objects (bucket_id, name) values ('chat_attachments', 'chat_123.png') returning id`);
    check("Chat-Anhänge bleiben unberührt", chat.error === null, chat.error || "");
    const avatar = await q(`insert into storage.objects (bucket_id, name) values ('avatars', '${U.max}/profil.png') returning id`);
    check("Profilbilder bleiben unberührt", avatar.error === null, avatar.error || "");
    const delForeign = await q(`delete from storage.objects where name = '${U.tim}/fanatec.jpg' returning id`);
    check("Fremde Marktplatz-Bilder löschen verboten", delForeign.rows.length === 0, delForeign.error || "durchgelassen!");
    const replace = await q(`update storage.objects set name = '${U.tim}/fanatec.jpg' where name = '${U.tim}/fanatec.jpg' returning id`);
    check("Fremde Marktplatz-Bilder ersetzen verboten", replace.rows.length === 0, replace.error || "durchgelassen!");
    const delOld = await q(`delete from storage.objects where name = 'alt_ohne_ordner.jpg' returning id`);
    check("Alte Bilder ohne Ordner kann niemand Fremdes löschen", delOld.rows.length === 0, delOld.error || "durchgelassen!");
    const delOwn = await q(`delete from storage.objects where name = '${U.max}/bild.jpg' returning id`);
    check("Eigene Marktplatz-Bilder löschen", delOwn.rows.length === 1, delOwn.error || "");
});
const buckets = (await db.query(`select id, file_size_limit, allowed_mime_types from storage.buckets where id in ('marketplace', 'setups') order by id`)).rows;
check("Marktplatz: höchstens 8 MB, JPEG/PNG/WebP", Number(buckets[0].file_size_limit) === 8388608 && buckets[0].allowed_mime_types.join() === "image/jpeg,image/png,image/webp", JSON.stringify(buckets[0]));
check("Setups: höchstens 5 MB", Number(buckets[1].file_size_limit) === 5242880, JSON.stringify(buckets[1]));

// --- Eindeutige Benutzernamen (gsra_namen.sql) ---
if (NAMEN_SQL) {
    await db.exec(readFileSync(NAMEN_SQL, "utf8"));
    const ctl = await db.exec(readFileSync(NAMEN_SQL, "utf8")); // zweiter Lauf
    console.log("Kontrolle Namen:\n  " + ctl[ctl.length - 1].rows.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    const DUP = "10000000-0000-0000-0000-000000000007";
    await as(null, async () => {
        const free = await q(`select public.username_available('Neuer Fahrer') as ok, public.username_available(' LENA ') as lena`);
        check("Gäste prüfen, ob ein Name frei ist", free.rows[0]?.ok === true && free.rows[0]?.lena === false, free.error || JSON.stringify(free.rows[0]));
    });
    await as(DUP, async () => {
        const keep = await q(`update public.profiles set full_name = 'Max Zwei' where id = '${DUP}' returning id`);
        check("Bestehender doppelter Name bleibt nutzbar", keep.rows.length === 1, keep.error || "");
        const caseOnly = await q(`update public.profiles set username = 'MAX' where id = '${DUP}' returning username`);
        check("Nur Groß-/Kleinschreibung ändern ist erlaubt", caseOnly.rows.length === 1, caseOnly.error || "");
    });
    await as(U.anna, async () => {
        const taken = await q(`update public.profiles set username = 'lena' where id = '${U.anna}' returning id`);
        check("Vergebenen Namen wählen verboten", taken.error?.includes("bereits vergeben"), taken.error || "durchgelassen!");
        const ok = await q(`update public.profiles set username = 'Anna Neu' where id = '${U.anna}' returning username`);
        check("Freien Namen wählen erlaubt", ok.rows[0]?.username === "Anna Neu", ok.error || "");
    });
    // „Anlegen oder ändern“ wie im Dashboard (ohne Zugriffsregeln des Nachbaus, die Datenbank-Regel greift trotzdem)
    const upsert = await q(`insert into public.profiles (id, username) values ('${U.anna}', 'Anna Neu') on conflict (id) do update set username = excluded.username returning id`);
    check("Profil speichern (anlegen oder ändern) mit eigenem Namen klappt", upsert.rows.length === 1, upsert.error || "");
    const upsertDup = await q(`insert into public.profiles (id, username) values ('${U.anna}', 'Lena') on conflict (id) do update set username = excluded.username returning id`);
    check("Anlegen oder ändern mit vergebenem Namen verboten", upsertDup.error?.includes("bereits vergeben"), upsertDup.error || "durchgelassen!");
    await db.exec(`insert into auth.users (id) values ('10000000-0000-0000-0000-000000000008')`);
    const newDup = await q(`insert into public.profiles (id, username) values ('10000000-0000-0000-0000-000000000008', ' tim ') returning id`);
    check("Neues Konto mit vergebenem Namen verboten", newDup.error?.includes("bereits vergeben"), newDup.error || "durchgelassen!");
    const newOk = await q(`insert into public.profiles (id, username) values ('10000000-0000-0000-0000-000000000008', 'Neuling') returning id`);
    check("Neues Konto mit freiem Namen", newOk.rows.length === 1, newOk.error || "");
}

// --- Marktplatz-Ausbau (gsra_marktplatz_ort.sql + gsra_marktplatz_2.sql) ---
if (MARKT_SQL) {
    for (const f of [ORT_SQL, MARKT_SQL, ORT_SQL, MARKT_SQL]) await db.exec(readFileSync(f, "utf8"));
    const ctl = await db.exec(readFileSync(MARKT_SQL, "utf8"));
    console.log("Kontrolle Marktplatz:\n  " + ctl[ctl.length - 1].rows.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    let firstId = null;
    await as(U.max, async () => {
        const ins = await q(`insert into public.marketplace (user_id, title, price, category, subcategory, manufacturer, model, torque_nm, latitude, longitude)
                             values ('${U.max}', 'Simucube 2 Pro', 899, 'Wheelbases', 'Direct Drive (DD)', 'Simucube', '2 Pro', 25, 53.55, 9.99) returning id, status`);
        firstId = ins.rows[0]?.id;
        check("Inserat mit Unterkategorie, Hersteller, Nm und Koordinaten", ins.rows[0]?.status === "aktiv", ins.error || "");
        const bad = await q(`update public.marketplace set status = 'weg' where id = '${firstId}' returning id`);
        check("Unbekannter Status abgelehnt", bad.error !== null, bad.error || "durchgelassen!");
        const badNm = await q(`update public.marketplace set torque_nm = 5000 where id = '${firstId}' returning id`);
        check("Unsinnige technische Werte abgelehnt", badNm.error !== null, badNm.error || "durchgelassen!");
        const res = await q(`update public.marketplace set status = 'reserviert' where id = '${firstId}' returning status, status_changed_at`);
        check("Reservieren setzt den Zeitpunkt", res.rows[0]?.status === "reserviert" && res.rows[0]?.status_changed_at !== null, res.error || JSON.stringify(res.rows[0]));
        const badCoords = await q(`update public.marketplace set latitude = 300 where id = '${firstId}' returning id`);
        check("Ungültige Koordinaten abgelehnt", badCoords.error !== null, badCoords.error || "durchgelassen!");
        // Limit: Max hat jetzt 2 nicht verkaufte Inserate – bis 100 auffüllen, das 101. scheitert
        const have = Number((await one(`select count(*) as n from public.marketplace where user_id = '${U.max}' and status <> 'verkauft'`)).n);
        for (let i = have; i < 100; i++) await q(`insert into public.marketplace (user_id, title, price) values ('${U.max}', 'Füller ${i}', 1)`);
        const over = await q(`insert into public.marketplace (user_id, title, price) values ('${U.max}', 'Zu viel', 1) returning id`);
        check("Das 101. Inserat wird abgelehnt", over.error?.includes("höchstens 100"), over.error || "durchgelassen!");
        await q(`update public.marketplace set status = 'verkauft' where id = '${firstId}'`);
        const again = await q(`insert into public.marketplace (user_id, title, price) values ('${U.max}', 'Nach Verkauf', 1) returning id`);
        check("Nach einem Verkauf ist wieder Platz", again.rows.length === 1, again.error || "");
        const revive = await q(`update public.marketplace set status = 'aktiv' where id = '${firstId}' returning id`);
        check("Verkauftes wieder aktivieren scheitert am Limit", revive.error?.includes("höchstens 100"), revive.error || "durchgelassen!");
    });
    await as(U.tim, async () => {
        const rep = await q(`select public.report_listing('${firstId}', 'Betrug oder Fake-Angebot', 'Preis zu gut') as id`);
        check("Inserat melden", rep.error === null && rep.rows[0]?.id, rep.error || "");
        const twice = await q(`select public.report_listing('${firstId}', 'Betrug oder Fake-Angebot') as id`);
        check("Dasselbe Inserat nicht doppelt melden", twice.error?.includes("bereits gemeldet"), twice.error || "durchgelassen!");
        const own = await q(`select public.report_listing((select id::text from public.marketplace where user_id = '${U.tim}' limit 1), 'Spam') as id`);
        check("Eigenes Inserat melden verboten (oder keins vorhanden)", own.error !== null, own.error || "durchgelassen!");
    });
    await as(null, async () => {
        const anon = await q(`select public.report_listing('${firstId}', 'Spam') as id`);
        check("Ohne Anmeldung nicht melden", anon.error !== null, anon.error || "durchgelassen!");
    });
    await as(U.admin, async () => {
        const r = await q(`select scope, reported_id, context ->> 'title' as title from public.reports where scope = 'inserat'`);
        check("Admin sieht die Meldung mit Kopie des Inserats", r.rows[0]?.title === "Simucube 2 Pro" && r.rows[0]?.reported_id === U.max, r.error || JSON.stringify(r.rows));
    });
    const blocks = Number((await one(`select count(*) as n from public.user_blocks where blocker_id = '${U.tim}' and blocked_id = '${U.max}'`)).n);
    check("Melden eines Inserats blockiert den Verkäufer nicht", blocks === 0, String(blocks));
}

// --- Umkreissuche (gsra_marktplatz_3.sql) ---
if (UMKREIS_SQL) {
    await db.exec(readFileSync(UMKREIS_SQL, "utf8"));
    const ctl = await db.exec(readFileSync(UMKREIS_SQL, "utf8"));
    console.log("Kontrolle Umkreis:\n  " + ctl[ctl.length - 1].rows.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    await db.exec(`
      insert into public.marketplace (user_id, title, price, category, condition, location, latitude, longitude, country_code, created_at) values
        ('${U.tim}', 'Hamburg Lenkrad', 100, 'Lenkraeder', 'Gebraucht', 'Hamburg, Deutschland', 53.55, 9.99, 'DE', now() - interval '1 hour'),
        ('${U.tim}', 'Lübeck Pedale', 200, 'Pedale', 'Neu', 'Lübeck, Deutschland', 53.87, 10.69, 'DE', now() - interval '2 hours'),
        ('${U.tim}', 'Berlin Rig', 300, 'Rigs', 'Gebraucht', 'Berlin, Deutschland', 52.52, 13.40, 'DE', now() - interval '3 hours'),
        ('${U.tim}', 'Wien Sitz', 150, 'Sitze', 'Gebraucht', 'Wien, Österreich', 48.21, 16.37, 'AT', now() - interval '4 hours'),
        ('${U.tim}', 'Texas Monitor', 400, 'Monitore', 'Gebraucht', 'Austin, USA', 30.27, -97.74, 'US', now() - interval '5 hours'),
        ('${U.tim}', 'Ohne Ort_100%', 50, 'Sonstiges', 'Gebraucht', 'irgendwo', null, null, null, now() - interval '6 hours');`);
    await as(null, async () => {
        const titles = async (args) => (await q(`select item ->> 'title' as t, distance_km, total_count from public.search_marketplace(${args})`));
        const r50 = await titles(`_lat => 53.55, _lon => 9.99, _radius_km => 50, _sort => 'distance'`);
        check("50 km um Hamburg: nur Hamburg (Lübeck ist ~60 km)", r50.rows.map(r => r.t).join() === "Hamburg Lenkrad", r50.error || r50.rows.map(r => `${r.t} ${r.distance_km}`).join(", "));
        const r100 = await titles(`_lat => 53.55, _lon => 9.99, _radius_km => 100, _sort => 'distance'`);
        check("100 km: Hamburg und Lübeck, nach Entfernung sortiert", r100.rows.map(r => r.t).join() === "Hamburg Lenkrad,Lübeck Pedale" && r100.rows[1].distance_km > 50 && r100.rows[1].distance_km < 70, r100.rows.map(r => `${r.t} ${r.distance_km}`).join(", "));
        const r300 = await titles(`_lat => 53.55, _lon => 9.99, _radius_km => 300, _sort => 'distance'`);
        check("300 km: zusätzlich Berlin", r300.rows.map(r => r.t).join() === "Hamburg Lenkrad,Lübeck Pedale,Berlin Rig", r300.rows.map(r => r.t).join());
        const eu = await titles(`_europe => true`);
        check("Europaweit ohne USA und ohne Inserate ohne Ort", !eu.rows.some(r => /Texas|Ohne Ort/.test(r.t)) && eu.rows.some(r => r.t === "Wien Sitz"), eu.rows.map(r => r.t).join());
        const tx = await titles(`_search => 'Texas'`), noPlace = await titles(`_search => 'Ohne Ort'`), sold = await titles(`_search => 'Simucube'`);
        check("Weltweit: alle nicht verkauften (auch ohne Ort)", tx.rows.length === 1 && noPlace.rows.length === 1 && sold.rows.length === 0, `${tx.rows.length}/${noPlace.rows.length}/${sold.rows.length}`);
        const pct = await titles(`_search => '100%'`);
        check("Sonderzeichen in der Suche (%) werden wörtlich gesucht", pct.rows.map(r => r.t).join() === "Ohne Ort_100%", pct.rows.map(r => r.t).join());
        const cond = await titles(`_condition => 'Neu'`);
        check("Filter Zustand", cond.rows.every(r => r.t !== "Hamburg Lenkrad") && cond.rows.some(r => r.t === "Lübeck Pedale"), cond.rows.map(r => r.t).join());
        const page = await titles(`_limit => 2, _offset => 2, _sort => 'price-desc'`);
        check("Seitenweise mit Gesamtzahl", page.rows.length === 2 && Number(page.rows[0].total_count) >= 6, page.rows.map(r => `${r.t}`).join() + " / " + page.rows[0]?.total_count);
    });
    await db.exec(`insert into public.user_bans (user_id, reason) values ('${U.max}', 'Test')`);
    await as(U.max, async () => {
        const r = await q(`select count(*) as n from public.search_marketplace()`);
        check("Gesperrte sehen auch über die Suche nichts", Number(r.rows[0]?.n) === 0, r.error || String(r.rows[0]?.n));
    });
    await db.exec(`delete from public.user_bans where user_id = '${U.max}' and reason = 'Test'`);
}

// --- Zahlungen: Abos, Teams, Boni (gsra_zahlungen_1.sql) ---
if (ZAHLUNG_SQL) {
    await db.exec(`alter table public.profiles add column if not exists gsra_id bigint; alter table public.profiles add column if not exists avatar_url text;`);
    // Weitere Personen für ein volles Team
    const extra = Array.from({ length: 10 }, (_, i) => `20000000-0000-0000-0000-0000000000${String(i + 10)}`);
    await db.exec(extra.map((id, i) => `insert into auth.users (id) values ('${id}'); insert into public.profiles (id, username, gsra_id) values ('${id}', 'Teamfahrer ${i}', ${200 + i});`).join("\n"));
    await db.exec(readFileSync(ZAHLUNG_SQL, "utf8"));
    const ctl = await db.exec(readFileSync(ZAHLUNG_SQL, "utf8"));
    console.log("Kontrolle Zahlungen:\n  " + ctl[ctl.length - 1].rows.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    const plan = async (u) => (await one(`select public.plan_of('${u}') as p`)).p;
    check("Ohne Abo: Paddock", await plan(U.anna) === "paddock");

    // Pole (wie vom Webhook mit Dienstschlüssel)
    await db.exec(`select public.stripe_sync_subscription('sub_pole_1', 'pole', '${U.anna}', 'cus_anna', 'active', now() + interval '30 days', false)`);
    check("Pole nach Abschluss", await plan(U.anna) === "pole");
    await as(U.tim, async () => {
        const other = await q(`select public.plan_of('${U.anna}') as p`);
        check("Abo anderer sichtbar (Profil)", other.rows[0]?.p === "pole", other.error || "");
        const peek = await q(`select * from public.user_plans`);
        check("Abo-Details anderer nicht lesbar", peek.rows.length === 0, JSON.stringify(peek.rows));
        const hack = await q(`select public.stripe_sync_subscription('sub_x', 'pole', '${U.tim}', 'cus_x', 'active', now() + interval '1 year', false)`);
        check("Abo selbst eintragen verboten", hack.error !== null, hack.error || "durchgelassen!");
        const ins = await q(`insert into public.user_plans (user_id) values ('${U.tim}')`);
        check("Abo-Tabelle nicht direkt beschreibbar", ins.error !== null, ins.error || "durchgelassen!");
    });
    await db.exec(`select public.stripe_sync_subscription('sub_pole_1', 'pole', '${U.anna}', 'cus_anna', 'canceled', now(), false)`);
    check("Nach Kündigung wieder Paddock", await plan(U.anna) === "paddock");

    // Alliance: Teamleitung Tim, Mitglieder per GSRA-ID, höchstens 10
    await db.exec(`select public.stripe_sync_subscription('sub_team_1', 'alliance', '${U.tim}', 'cus_tim', 'active', now() + interval '30 days', false)`);
    check("Alliance für die Teamleitung", await plan(U.tim) === "alliance");
    await as(U.tim, async () => {
        for (let i = 0; i < 9; i++) await q(`select public.team_add_member(${200 + i})`);
        const full = await q(`select public.team_add_member(209)`);
        check("Das 11. Mitglied wird abgelehnt", full.error?.includes("höchstens 10"), full.error || "durchgelassen!");
        const unknown = await q(`select public.team_add_member(999999)`);
        check("Unbekannte GSRA-ID", unknown.error?.includes("kein Konto"), unknown.error || "");
        const leaveOwner = await q(`select public.team_remove_member('${U.tim}')`);
        check("Teamleitung kann nicht austreten", leaveOwner.error !== null, leaveOwner.error || "durchgelassen!");
        const m = await q(`select public.my_membership() as m`);
        check("Teamübersicht mit 10 Personen", m.rows[0]?.m?.team?.members?.length === 10 && m.rows[0].m.team.is_owner === true, m.error || JSON.stringify(m.rows[0]?.m?.team?.members?.length));
    });
    check("Mitglied hat Alliance", await plan(extra[0]) === "alliance");
    await as(extra[0], async () => {
        const add = await q(`select public.team_add_member(209)`);
        check("Mitglied kann niemanden hinzufügen", add.error !== null, add.error || "durchgelassen!");
        const seen = await q(`select count(*) as n from public.team_members`);
        check("Mitglied sieht das eigene Team", Number(seen.rows[0]?.n) === 10, seen.error || String(seen.rows[0]?.n));
        const leave = await q(`select public.team_remove_member('${extra[0]}')`);
        check("Mitglied kann austreten", leave.error === null, leave.error || "");
    });
    check("Nach Austritt wieder Paddock", await plan(extra[0]) === "paddock");
    await as(U.anna, async () => {
        const seen = await q(`select count(*) as n from public.team_members`);
        check("Fremde sehen keine Teammitglieder", Number(seen.rows[0]?.n) === 0, String(seen.rows[0]?.n));
    });

    // Randfälle: eigenes Pole-Abo, beendete Teams, erneutes Abschließen
    await db.exec(`update public.profiles set gsra_id = 300 where id = '${U.anna}'`);
    await db.exec(`select public.stripe_sync_subscription('sub_pole_2', 'pole', '${U.anna}', 'cus_anna', 'active', now() + interval '30 days', false)`);
    await as(U.tim, async () => {
        const dbl = await q(`select public.team_add_member(300)`);
        check("Laufendes Pole-Abo: kein Doppelzahlen im Team", dbl.error?.includes("Pole-Abo"), dbl.error || "durchgelassen!");
    });
    await db.exec(`select public.stripe_sync_subscription('sub_pole_2', 'pole', '${U.anna}', 'cus_anna', 'active', now() + interval '30 days', true)`);
    await as(U.tim, async () => {
        const ok = await q(`select public.team_add_member(300)`);
        check("Gekündigtes Pole-Abo: Beitritt möglich", ok.error === null, ok.error || "");
    });
    check("Mitglied mit auslaufendem Pole: Alliance", await plan(U.anna) === "alliance");
    await db.exec(`select public.stripe_sync_subscription('sub_team_1', 'alliance', '${U.tim}', 'cus_tim', 'canceled', now(), false)`);
    check("Team beendet: Mitglied fällt auf Pole/Paddock zurück", await plan(extra[1]) === "paddock" && await plan(U.anna) === "pole");
    await db.exec(`select public.stripe_sync_subscription('sub_team_2', 'alliance', '${U.max}', 'cus_max', 'active', now() + interval '30 days', false)`);
    await as(U.max, async () => {
        const join = await q(`select public.team_add_member(201)`);
        check("Mitglied eines beendeten Teams kann neuem Team beitreten", join.error === null, join.error || "");
    });
    check("Neues Team wirkt", await plan(extra[1]) === "alliance" && await plan(U.max) === "alliance");
    await db.exec(`select public.stripe_sync_subscription('sub_team_3', 'alliance', '${U.tim}', 'cus_tim', 'active', now() + interval '30 days', false)`);
    const timTeams = Number((await one(`select count(*) as n from public.teams where owner_id = '${U.tim}'`)).n);
    check("Erneutes Alliance-Abo belebt das alte Team wieder", await plan(U.tim) === "alliance" && timTeams === 1 && await plan(extra[2]) === "alliance",
        `${await plan(U.tim)} / ${timTeams} / ${await plan(extra[2])}`);

    // Boni: nur per Zahlung, einmal pro Stripe-Sitzung
    const listing = (await one(`select id::text as id from public.marketplace where user_id = '${U.tim}' and status <> 'verkauft' order by created_at limit 1`)).id;
    await as(U.tim, async () => {
        await q(`update public.marketplace set highlighted = true, top_ad = true, bump_since = now() where id = '${listing}'`);
        const r = await one(`select highlighted, top_ad, bump_since from public.marketplace where id = '${listing}'`);
        check("Boni nicht selbst einschaltbar", r.highlighted === false && r.top_ad === false && r.bump_since === null, JSON.stringify(r));
        const pay = await q(`select public.stripe_apply_payment('cs_1', 'top', '${U.tim}', '${listing}', 599, 'eur', 'cus_tim')`);
        check("Zahlung nicht selbst verbuchbar", pay.error !== null, pay.error || "durchgelassen!");
    });
    const first = (await one(`select public.stripe_apply_payment('cs_1', 'top', '${U.tim}', '${listing}', 599, 'eur', 'cus_tim') as r`)).r;
    const again = (await one(`select public.stripe_apply_payment('cs_1', 'top', '${U.tim}', '${listing}', 599, 'eur', 'cus_tim') as r`)).r;
    await db.exec(`select public.stripe_apply_payment('cs_2', 'highlight', '${U.tim}', '${listing}', 299, 'eur', 'cus_tim')`);
    const after = await one(`select highlighted, top_ad from public.marketplace where id = '${listing}'`);
    check("Bezahlte Boni sind aktiv, doppelte Meldung zählt nicht", first === "verbucht" && again === "bereits verbucht" && after.highlighted && after.top_ad,
        `${first}/${again}/${JSON.stringify(after)}`);
    await as(U.tim, async () => {
        await q(`update public.marketplace set highlighted = false, title = title || ' (bearbeitet)' where id = '${listing}'`);
        const r = await one(`select highlighted, title from public.marketplace where id = '${listing}'`);
        check("Bearbeiten lässt bezahlte Boni bestehen", r.highlighted === true && r.title.endsWith("(bearbeitet)"), JSON.stringify(r));
    });
    await as(null, async () => {
        const top = await q(`select item ->> 'id' as id from public.search_marketplace(_top_only => true)`);
        check("Top-Anzeigen-Suche liefert nur Top-Anzeigen", top.rows.length === 1 && top.rows[0].id === listing, top.error || JSON.stringify(top.rows));
    });
    // Hochschieben: vor 15 Tagen gekauft, Inserat 30 Tage alt → zählt wie vor 1 Tag eingestellt
    await db.exec(`
      insert into public.marketplace (user_id, title, price, category, created_at) values ('${U.tim}', 'Alt aber hochgeschoben', 1, 'Bundles', now() - interval '30 days'),
                                                                                       ('${U.tim}', 'Vor 2 Tagen', 1, 'Bundles', now() - interval '2 days');
      update public.marketplace set bump_since = now() - interval '15 days' where title = 'Alt aber hochgeschoben';`);
    await as(null, async () => {
        const order = await q(`select item ->> 'title' as t from public.search_marketplace(_search => 'Alt aber', _limit => 5)
                               union all select item ->> 'title' from public.search_marketplace(_search => 'Vor 2 Tagen', _limit => 5)`);
        const ranked = await q(`select item ->> 'title' as t from public.search_marketplace(_category => 'Bundles', _limit => 60)`);
        check("Wöchentlich hochgeschoben steht vor neueren Inseraten", ranked.rows.map(r => r.t).join() === "Alt aber hochgeschoben,Vor 2 Tagen", ranked.error || ranked.rows.map(r => r.t).join() + " / " + order.rows.length);
    });

    // --- Zahlungen 2: Einladungslinks, mehrere Boni pro Zahlung, zuletzt online ---
    if (ZAHLUNG2_SQL) {
        await db.exec(readFileSync(ZAHLUNG2_SQL, "utf8"));
        const ctl2 = await db.exec(readFileSync(ZAHLUNG2_SQL, "utf8"));
        console.log("Kontrolle Zahlungen 2:\n  " + ctl2[ctl2.length - 1].rows.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
        const size = async () => Number((await one(`select count(*) as n from public.team_members tm join public.teams t on t.id = tm.team_id where t.owner_id = '${U.tim}'`)).n);
        check("Ausgangslage: Tims Team hat 9 Personen", await size() === 9, String(await size()));
        let token = null;
        await as(U.seller, async () => {
            const notOwner = await q(`select public.team_invite_link()`);
            check("Ohne eigenes Team kein Einladungslink", notOwner.error?.includes("Teamleitung"), notOwner.error || "durchgelassen!");
        });
        await as(U.tim, async () => {
            const link = await q(`select public.team_invite_link() as l`);
            token = link.rows[0]?.l?.token;
            const again = await q(`select public.team_invite_link() as l`);
            check("Einladungslink wird erstellt und bleibt gleich", token?.length === 32 && again.rows[0]?.l?.token === token, link.error || JSON.stringify(link.rows[0]));
            const m = await q(`select public.my_membership() as m`);
            check("Teamleitung sieht den Link in der Übersicht", m.rows[0]?.m?.team?.invite_token === token, m.error || "");
            const self = await q(`select public.team_join('${token}')`);
            check("Teamleitung kann nicht doppelt beitreten", self.error?.includes("bereits in diesem Team"), self.error || "durchgelassen!");
        });
        await as(null, async () => {
            const info = await q(`select public.team_invite_info('${token}') as i`);
            check("Einladung auch ohne Anmeldung lesbar", info.rows[0]?.i?.valid === true && info.rows[0].i.owner_name && Number(info.rows[0].i.members) === 9, info.error || JSON.stringify(info.rows[0]));
            const join = await q(`select public.team_join('${token}')`);
            check("Ohne Anmeldung kein Beitritt", join.error !== null, join.error || "durchgelassen!");
            const bad = await q(`select public.team_invite_info('falsch') as i`);
            check("Falscher Link ist ungültig", bad.rows[0]?.i?.valid === false, bad.error || "");
        });
        await as(U.seller, async () => {
            const join = await q(`select public.team_join('${token}') as j`);
            check("Beitritt per Link", join.error === null && join.rows[0]?.j?.owner_name, join.error || "");
            const m = await q(`select public.my_membership() as m`);
            check("Mitglied sieht keinen Einladungslink", m.rows[0]?.m?.team && !m.rows[0].m.team.invite_token && m.rows[0].m.team.members.length === 10, m.error || JSON.stringify(m.rows[0]?.m?.team));
        });
        check("Beigetretene Person hat Alliance", await plan(U.seller) === "alliance");
        await as(extra[0], async () => {
            const full = await q(`select public.team_join('${token}')`);
            check("Volles Team: Beitritt per Link abgelehnt", full.error?.includes("höchstens 10"), full.error || "durchgelassen!");
        });
        await as(extra[1], async () => {
            const other = await q(`select public.team_join('${token}')`);
            check("Mitglied eines anderen aktiven Teams: abgelehnt", other.error?.includes("anderen Teams"), other.error || "durchgelassen!");
        });
        let newToken = null;
        await as(U.tim, async () => {
            const renewed = await q(`select public.team_invite_link(true) as l`);
            newToken = renewed.rows[0]?.l?.token;
        });
        await as(extra[0], async () => {
            const old = await q(`select public.team_join('${token}')`);
            check("Neuer Link macht den alten ungültig", old.error?.includes("ungültig"), old.error || "durchgelassen!");
        });
        await db.exec(`update public.teams set invite_created_at = now() - interval '15 days' where owner_id = '${U.tim}'`);
        await as(null, async () => {
            const info = await q(`select public.team_invite_info('${newToken}') as i`);
            check("Link läuft nach 14 Tagen ab", info.rows[0]?.i?.valid === false, JSON.stringify(info.rows[0]));
        });

        // Mehrere Boni in einer Zahlung
        const other = (await one(`select id::text as id from public.marketplace where title = 'Vor 2 Tagen'`)).id;
        const r1 = (await one(`select public.stripe_apply_payment('cs_multi', 'highlight', '${U.tim}', '${other}', 299, 'eur', 'cus_tim') as r`)).r;
        const r2 = (await one(`select public.stripe_apply_payment('cs_multi', 'top', '${U.tim}', '${other}', 599, 'eur', 'cus_tim') as r`)).r;
        const r3 = (await one(`select public.stripe_apply_payment('cs_multi', 'top', '${U.tim}', '${other}', 599, 'eur', 'cus_tim') as r`)).r;
        const both = await one(`select highlighted, top_ad from public.marketplace where id = '${other}'`);
        check("Zwei Boni in einer Zahlung, Wiederholung zählt nicht", r1 === "verbucht" && r2 === "verbucht" && r3 === "bereits verbucht" && both.highlighted && both.top_ad, `${r1}/${r2}/${r3}/${JSON.stringify(both)}`);

        // Zuletzt online
        await db.exec(`insert into public.user_presence (user_id, last_seen_at) values ('${U.tim}', now() - interval '2 hours 17 minutes') on conflict (user_id) do update set last_seen_at = excluded.last_seen_at`);
        await as(null, async () => {
            const r = await q(`select public.last_seen_of('${U.tim}') as s`);
            check("Gäste sehen keinen Online-Status", r.error !== null || r.rows[0]?.s === null, r.error || JSON.stringify(r.rows[0]));
        });
        await as(U.tim, async () => {
            const r = await one(`select public.last_seen_of('${U.tim}') as s`);
            check("Selbst: genaue Zeit", r.s?.exact === true && r.s.online === false && new Date(r.s.last_seen_at).getMinutes() !== 0, JSON.stringify(r.s));
        });
        await as(U.seller, async () => {
            const friends = Number((await one(`select count(*) as n from public.friendships where status = 'accepted' and ((user_id = '${U.seller}' and friend_id = '${U.tim}') or (user_id = '${U.tim}' and friend_id = '${U.seller}'))`)).n);
            const r = await q(`select public.last_seen_of('${U.tim}') as s`);
            const s = r.rows[0]?.s;
            check("Andere: nur auf die Stunde genau", r.error === null && s && (friends > 0 ? s.exact === true : (s.exact === false && new Date(s.last_seen_at).getMinutes() === 0)), r.error || JSON.stringify(s) + " Freunde: " + friends);
        });
    }
}

// --- Kündigungen („Verträge hier kündigen“) ---
if (KUENDIGUNG_SQL) {
    await db.exec(`alter table auth.users add column if not exists email text; update auth.users set email = 'tim@test.de' where id = '${U.tim}'`);
    await db.exec(readFileSync(KUENDIGUNG_SQL, "utf8"));
    const ctlK = await db.exec(readFileSync(KUENDIGUNG_SQL, "utf8"));
    console.log("Kontrolle Kündigungen:\n  " + ctlK[ctlK.length - 1].rows.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    // Wie die Server-Funktion (Dienstschlüssel): Konto per E-Mail finden und Kündigung festhalten
    const found = (await one(`select public.cancellation_user_by_email(' TIM@test.de ') as id`)).id;
    check("Konto per E-Mail gefunden (Groß-/Kleinschreibung egal)", found === U.tim, String(found));
    await db.exec(`insert into public.cancellations (reference, user_id, name, email, contract, kind, status)
                   values ('K-TEST-1', '${U.tim}', 'Tim', 'tim@test.de', 'pole', 'ordentlich', 'vorgemerkt'),
                          ('K-TEST-2', null, 'Fremd', 'x@y.de', 'alliance', 'ausserordentlich', 'kein_vertrag')`);
    await as(U.tim, async () => {
        const own = await q(`select reference from public.cancellations`);
        check("Eigene Kündigung sichtbar, fremde nicht", own.rows.map(r => r.reference).join() === "K-TEST-1", own.error || JSON.stringify(own.rows));
        const lookup = await q(`select public.cancellation_user_by_email('tim@test.de')`);
        check("E-Mail-Suche nicht für Angemeldete", lookup.error !== null, lookup.error || "durchgelassen!");
        const ins = await q(`insert into public.cancellations (reference, name, email, contract, kind) values ('K-HACK', 'a', 'a@b.de', 'pole', 'ordentlich')`);
        check("Kündigungen nicht direkt eintragbar", ins.error !== null, ins.error || "durchgelassen!");
        await q(`update public.cancellations set status = 'erledigt' where reference = 'K-TEST-1'`);
        const st = (await one(`select status from public.cancellations where reference = 'K-TEST-1'`)).status;
        check("Nutzer können den Status nicht ändern", st === "vorgemerkt", st);
    });
    await as(null, async () => {
        const r = await q(`select count(*) as n from public.cancellations`);
        check("Gäste sehen keine Kündigungen", r.error !== null || Number(r.rows[0]?.n) === 0, r.error || String(r.rows[0]?.n));
        const lookup = await q(`select public.cancellation_user_by_email('tim@test.de')`);
        check("E-Mail-Suche nicht für Gäste", lookup.error !== null, lookup.error || "durchgelassen!");
    });
    await as(U.admin, async () => {
        const all = await q(`select count(*) as n from public.cancellations`);
        check("Admins sehen alle Kündigungen", Number(all.rows[0]?.n) === 2, all.error || String(all.rows[0]?.n));
        const upd = await q(`update public.cancellations set status = 'erledigt', handled_by = '${U.admin}', handled_at = now() where reference = 'K-TEST-2' returning status`);
        check("Admins können als erledigt markieren", upd.rows[0]?.status === "erledigt", upd.error || JSON.stringify(upd.rows));
    });
}

// --- Setup Hub: Formate je Simulation, Setups ohne Datei, Pro Setups nur für Abonnenten ---
if (SETUPHUB_SQL && ZAHLUNG_SQL) {
    const FREE = "30000000-0000-0000-0000-000000000001", PRO = "30000000-0000-0000-0000-000000000002", SUB = "30000000-0000-0000-0000-000000000003";
    await db.exec(`insert into auth.users (id) values ('${FREE}'), ('${PRO}'), ('${SUB}');
                   insert into public.profiles (id, username) values ('${FREE}', 'Gratisfahrer'), ('${PRO}', 'Profi'), ('${SUB}', 'Abonnent');`);
    await db.exec(readFileSync(SETUPHUB_SQL, "utf8"));
    const ctlS = await db.exec(readFileSync(SETUPHUB_SQL, "utf8"));
    console.log("Kontrolle Setup Hub:\n  " + ctlS[ctlS.length - 1].rows.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    await db.exec(`insert into public.pro_creators (user_id) values ('${PRO}');
                   select public.stripe_sync_subscription('sub_hub', 'pole', '${SUB}', 'cus_hub', 'active', now() + interval '30 days', false);`);

    let manualId = null, proId = null;
    await as(FREE, async () => {
        const wrong = await q(`insert into public.setups (simulation, car_model, track_name, file_url, file_name, uploader_id) values ('iRacing', 'BMW M4 GT3', 'Spa', 'https://x/a.json', 'a.json', '${FREE}')`);
        check("iRacing nur mit .sto", wrong.error?.includes(".sto"), wrong.error || "durchgelassen!");
        const ok = await q(`insert into public.setups (simulation, car_model, track_name, file_url, file_name, uploader_id) values ('iRacing', 'BMW M4 GT3', 'Spa', 'https://x/a.sto', 'Spa_Q.STO', '${FREE}') returning id`);
        check("iRacing mit .sto (Groß-/Kleinschreibung egal)", ok.error === null, ok.error || "");
        const acc = await q(`insert into public.setups (simulation, car_model, track_name, file_url, file_name, uploader_id) values ('ACC', 'Ferrari 296 GT3', 'Monza', 'https://x/b.sto', 'b.sto', '${FREE}')`);
        check("ACC nur mit .json", acc.error?.includes(".json"), acc.error || "durchgelassen!");
        const f1File = await q(`insert into public.setups (simulation, car_model, track_name, file_url, file_name, uploader_id) values ('F1 25', 'Red Bull', 'Monaco', 'https://x/c.ini', 'c.ini', '${FREE}')`);
        check("F1 ohne Datei", f1File.error?.includes("keine Setup-Datei"), f1File.error || "durchgelassen!");
        const f1 = await q(`insert into public.setups (simulation, car_model, track_name, setup_type, uploader_id) values ('F1 25', 'Red Bull', 'Monaco', 'Qualifying', '${FREE}') returning id`);
        manualId = f1.rows[0]?.id;
        check("F1 mit Werten statt Datei", f1.error === null && manualId, f1.error || "");
        const content = await q(`insert into public.setup_contents (setup_id, manual_values) values ('${manualId}', 'Frontflügel 30, Heckflügel 25')`);
        check("Werte zum eigenen Setup speichern", content.error === null, content.error || "");
        const pro = await q(`insert into public.setups (simulation, car_model, track_name, file_name, is_pro, uploader_id) values ('iRacing', 'Porsche 963', 'Le Mans', 'lm.sto', true, '${FREE}')`);
        check("Pro Setups nur von Pro-Fahrern", pro.error?.includes("Pro-Fahrer"), pro.error || "durchgelassen!");
        const flip = await q(`update public.setups set is_pro = true where id = '${ok.rows[0]?.id}'`);
        check("Eigenes Setup nicht selbst zu Pro machen", flip.error?.includes("Pro-Fahrer"), flip.error || "durchgelassen!");
        const proBucket = await q(`insert into storage.objects (bucket_id, name) values ('setups-pro', '${FREE}/x.sto')`);
        check("Pro-Speicher: kein Hochladen ohne Pro-Fahrer", proBucket.error !== null, proBucket.error || "durchgelassen!");
    });
    await as(U.anna, async () => {
        const foreign = await q(`insert into public.setup_contents (setup_id, manual_values) values ('${manualId}', 'x') on conflict (setup_id) do update set manual_values = 'gehackt'`);
        const val = (await one(`select manual_values from public.setup_contents where setup_id = '${manualId}'`)).manual_values;
        check("Fremde Werte nicht änderbar", val === "Frontflügel 30, Heckflügel 25", (foreign.error || "") + " / " + val);
    });
    await as(PRO, async () => {
        const linked = await q(`insert into public.setups (simulation, car_model, track_name, file_url, file_name, is_pro, uploader_id) values ('iRacing', 'Porsche 963', 'Le Mans', 'https://x/lm.sto', 'lm.sto', true, '${PRO}')`);
        check("Pro Setups ohne öffentlichen Link", linked.error?.includes("nicht öffentlich"), linked.error || "durchgelassen!");
        const p = await q(`insert into public.setups (simulation, car_model, track_name, file_name, is_pro, uploader_id) values ('iRacing', 'Porsche 963', 'Le Mans', 'lm.sto', true, '${PRO}') returning id`);
        proId = p.rows[0]?.id;
        check("Pro-Fahrer veröffentlicht Pro Setup", p.error === null && proId, p.error || "");
        const c = await q(`insert into public.setup_contents (setup_id, pro_file_path) values ('${proId}', '${PRO}/lm.sto')`);
        const f = await q(`insert into storage.objects (bucket_id, name) values ('setups-pro', '${PRO}/lm.sto')`);
        check("Pro-Datei im privaten Speicher", c.error === null && f.error === null, (c.error || "") + (f.error || ""));
    });
    const seesPro = async (u) => as(u, async () => {
        const row = await q(`select count(*) as n from public.setups where id = '${proId}'`);
        const content = await q(`select count(*) as n from public.setup_contents where setup_id = '${proId}'`);
        const file = await q(`select count(*) as n from storage.objects where bucket_id = 'setups-pro'`);
        return `${row.rows[0]?.n}/${content.rows[0]?.n ?? "x"}/${file.rows[0]?.n ?? "x"}`;
    });
    check("Paddock sieht Pro Setup (Vorschau), aber keine Datei und keine Inhalte", await seesPro(FREE) === "1/0/0", await seesPro(FREE));
    check("Pole sieht Pro-Inhalte und Datei", await seesPro(SUB) === "1/1/1", await seesPro(SUB));
    check("Gäste sehen keine Pro-Datei", (await seesPro(null)).endsWith("/0"), await seesPro(null));
    await as(SUB, async () => {
        const manual = await q(`select manual_values from public.setup_contents where setup_id = '${manualId}'`);
        check("Werte normaler Setups für alle Angemeldeten", manual.rows[0]?.manual_values?.startsWith("Frontflügel"), manual.error || JSON.stringify(manual.rows));
    });

    // Pro Setups nur noch von Pro-Fahrern – auch Admins nicht
    if (PRONUR_SQL) {
        await db.exec(readFileSync(PRONUR_SQL, "utf8"));
        const ctlP = await db.exec(readFileSync(PRONUR_SQL, "utf8"));
        console.log("Kontrolle Pro nur Profis:\n  " + ctlP[ctlP.length - 1].rows.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
        await as(U.admin, async () => {
            const adminPro = await q(`insert into public.setups (simulation, car_model, track_name, file_name, is_pro, uploader_id) values ('iRacing', 'Audi R8', 'Spa', 'spa.sto', true, '${U.admin}')`);
            check("Admins veröffentlichen keine Pro Setups", adminPro.error?.includes("Pro-Fahrer"), adminPro.error || "durchgelassen!");
            const adminFile = await q(`insert into storage.objects (bucket_id, name) values ('setups-pro', '${U.admin}/spa.sto')`);
            check("Admins laden nichts in den Pro-Speicher", adminFile.error !== null, adminFile.error || "durchgelassen!");
            const seeContent = await q(`select count(*) as n from public.setup_contents where setup_id = '${proId}'`);
            check("Admins sehen Pro-Inhalte weiterhin (Moderation)", Number(seeContent.rows[0]?.n) === 1, seeContent.error || "");
        });
        await as(PRO, async () => {
            const again = await q(`insert into public.setups (simulation, car_model, track_name, file_name, is_pro, uploader_id) values ('ACC', 'BMW M4 GT3', 'Monza', 'monza.json', true, '${PRO}') returning id`);
            check("Pro-Fahrer veröffentlicht weiterhin", again.error === null, again.error || "");
        });
    }
}

// --- Sicherheit 2: Chat-Anhänge nicht auflistbar, Profile nicht für Gäste ---
if (SICHERHEIT2_SQL) {
    await db.exec(`insert into storage.objects (bucket_id, name, owner) values ('chat_attachments', 'chat_1_abcde.jpg', '${U.max}'), ('chat_attachments', 'voice_2_fghij.webm', '${U.anna}')`);
    const totalChat = async () => Number((await one(`select count(*) as n from storage.objects where bucket_id = 'chat_attachments'`)).n);
    const before = await as(null, async () => Number((await q(`select count(*) as n from storage.objects where bucket_id = 'chat_attachments'`)).rows[0]?.n));
    check("Vorher (wie in eurer Datenbank): Gäste können Chat-Anhänge auflisten", before === await totalChat() && before > 0, `${before} von ${await totalChat()}`);
    await db.exec(readFileSync(SICHERHEIT2_SQL, "utf8"));
    const ctl = await db.exec(readFileSync(SICHERHEIT2_SQL, "utf8"));
    console.log("Kontrolle Sicherheit 2:\n  " + ctl[ctl.length - 1].rows.slice(0, 2).map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    await as(null, async () => {
        const list = await q(`select count(*) as n from storage.objects where bucket_id = 'chat_attachments'`);
        check("Gäste können Chat-Anhänge nicht mehr auflisten", Number(list.rows[0]?.n) === 0, list.error || String(list.rows[0]?.n));
        const up = await q(`insert into storage.objects (bucket_id, name) values ('chat_attachments', 'chat_gast.jpg')`);
        check("Gäste können keine Chat-Anhänge hochladen", up.error !== null, up.error || "durchgelassen!");
        const prof = await q(`select count(*) as n from public.profiles`);
        check("Gäste sehen keine Profile", prof.error !== null || Number(prof.rows[0]?.n) === 0, prof.error || String(prof.rows[0]?.n));
        const market = await q(`select count(*) as n from storage.objects where bucket_id = 'marketplace'`);
        check("Andere Speicher bleiben unverändert (Marktplatz-Bilder)", Number(market.rows[0]?.n) > 0, market.error || String(market.rows[0]?.n));
    });
    await as(U.max, async () => {
        const list = await q(`select count(*) as n from storage.objects where bucket_id = 'chat_attachments'`);
        check("Angemeldete können Chat-Anhänge nicht auflisten", Number(list.rows[0]?.n) === 0, String(list.rows[0]?.n));
        const up = await q(`insert into storage.objects (bucket_id, name) values ('chat_attachments', 'chat_3_klmno.jpg')`);
        check("Angemeldete können weiter Anhänge senden", up.error === null, up.error || "");
        const del = await q(`delete from storage.objects where bucket_id = 'chat_attachments' and name = 'voice_2_fghij.webm' returning id`);
        check("Fremde Anhänge nicht löschbar", del.rows.length === 0, del.error || JSON.stringify(del.rows));
        const prof = await q(`select count(*) as n from public.profiles`);
        check("Angemeldete sehen Profile weiterhin", Number(prof.rows[0]?.n) > 0, prof.error || "");
    });
    await as(U.admin, async () => {
        const list = await q(`select count(*) as n from storage.objects where bucket_id = 'chat_attachments'`);
        check("Admins sehen Chat-Anhänge (Moderation)", Number(list.rows[0]?.n) === await totalChat(), list.error || `${list.rows[0]?.n} von ${await totalChat()}`);
    });
}

// --- 017: Hinweise des Security Advisors ---
if (ADVISOR_SQL) {
    const anonCan = async (fn) => (await one(`select has_function_privilege('anon', '${fn}', 'EXECUTE') as ok`)).ok;
    check("Vorher (wie in eurer Datenbank): Gäste dürfen is_site_admin() aufrufen", await anonCan("public.is_site_admin()"));
    await db.exec(readFileSync(ADVISOR_SQL, "utf8"));
    const ctl = await db.exec(readFileSync(ADVISOR_SQL, "utf8")); // zweiter Lauf: muss wiederholbar sein
    const rows = ctl[ctl.length - 1].rows;
    console.log("Kontrolle 017:\n  " + rows.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 017: alle vier Zählungen sind 0", rows.slice(0, 4).every(r => r.ergebnis === "0"), rows.slice(0, 4).map(r => r.ergebnis).join(", "));
    check("Für Gäste nur Namensprüfung und Einladungslink", rows[4].ergebnis === "team_invite_info, username_available", rows[4].ergebnis);
    const trig = await one(`select has_function_privilege('authenticated', 'public.marketplace_rules()', 'EXECUTE') as ok`);
    check("Trigger-Funktionen sind nicht direkt aufrufbar", trig.ok === false);
    const svc = await one(`select has_function_privilege('authenticated', 'public.stripe_apply_payment(text, text, uuid, text, integer, text, text)', 'EXECUTE') as ok`);
    check("Zahlungsfunktionen bleiben für Nutzer gesperrt", svc.ok === false);

    await as(null, async () => {
        const name = await q(`select public.username_available('Ganz_Neu_017') as ok`);
        check("Gast: Namensprüfung bei der Registrierung klappt", name.error === null && name.rows[0]?.ok === true, name.error || "");
        const inv = await q(`select public.team_invite_info('gibt-es-nicht')`);
        check("Gast: Einladungslink ansehen klappt", inv.error === null, inv.error || "");
        const adm = await q(`select public.is_site_admin()`);
        check("Gast: is_site_admin() nicht mehr aufrufbar", adm.error !== null, adm.error || "durchgelassen!");
        const plan = await q(`select public.plan_of('${U.max}')`);
        check("Gast: plan_of() nicht mehr aufrufbar", plan.error !== null, plan.error || "durchgelassen!");
        const pro = await q(`select public.can_see_pro('${U.max}')`);
        check("Gast: can_see_pro() nicht mehr aufrufbar", pro.error !== null, pro.error || "durchgelassen!");
        const setups = await q(`select count(*) as n from public.setups`);
        check("Gast: Setups-Liste lesbar wie bisher", setups.error === null && Number(setups.rows[0]?.n) > 0, setups.error || "");
        const market = await q(`select count(*) as n from public.marketplace`);
        check("Gast: Marktplatz lesbar wie bisher", market.error === null && Number(market.rows[0]?.n) > 0, market.error || "");
        const files = await q(`select count(*) as n from storage.objects where bucket_id = 'marketplace'`);
        check("Gast: Marktplatz-Dateien nicht mehr auflistbar", files.error !== null || Number(files.rows[0]?.n) === 0, files.error || String(files.rows[0]?.n));
    });

    await as(U.max, async () => {
        const plan = await q(`select public.plan_of('${U.max}') as p`);
        check("Nutzer: plan_of() weiterhin aufrufbar", plan.error === null, plan.error || "");
        const adm = await q(`select public.is_site_admin() as a`);
        check("Nutzer: is_site_admin() weiterhin aufrufbar (= nein)", adm.error === null && adm.rows[0]?.a === false, adm.error || "");
        const foreign = await q(`select count(*) as n from storage.objects where bucket_id = 'marketplace' and name like '${U.tim}/%'`);
        check("Nutzer: fremde Marktplatz-Dateien nicht auflistbar", Number(foreign.rows[0]?.n) === 0, foreign.error || String(foreign.rows[0]?.n));
        const up = await q(`insert into storage.objects (bucket_id, name) values ('marketplace', '${U.max}/017.jpg')`);
        check("Nutzer: eigenes Bild hochladen klappt", up.error === null, up.error || "");
        const mine = await q(`select count(*) as n from storage.objects where name = '${U.max}/017.jpg'`);
        check("Nutzer: eigene Datei sichtbar", Number(mine.rows[0]?.n) === 1, mine.error || String(mine.rows[0]?.n));
        const del = await q(`delete from storage.objects where name = '${U.max}/017.jpg' returning id`);
        check("Nutzer: eigene Datei löschen klappt", del.rows.length === 1, del.error || (del.rows.length ? "" : "nichts gelöscht"));
        const av = await q(`insert into storage.objects (bucket_id, name) values ('avatars', '${U.max}/neu017.png')`);
        const avDel = await q(`delete from storage.objects where name = '${U.max}/neu017.png' returning id`);
        check("Nutzer: Profilbild hochladen und wieder löschen klappt", av.error === null && avDel.rows.length === 1, av.error || avDel.error || (avDel.rows.length ? "" : "nichts gelöscht"));
        const delForeign = await q(`delete from storage.objects where name = '${U.tim}/fanatec.jpg' returning id`);
        check("Nutzer: fremde Datei nicht löschbar", delForeign.rows.length === 0, delForeign.error || (delForeign.rows.length ? "gelöscht!" : ""));

        const msg = await q(`insert into public.messages (chat_id, sender_id, text) values ('${D}', '${U.max}', 'Test 017') returning id`);
        check("Nutzer: Nachricht im eigenen Chat senden klappt", msg.error === null, msg.error || "");
        if (msg.rows[0]) {
            const edit = await q(`update public.messages set text = 'Test 017 (bearbeitet)' where id = '${msg.rows[0].id}' returning id`);
            check("Nutzer: eigene Nachricht bearbeiten klappt (Trigger laufen weiter)", edit.rows.length === 1, edit.error || (edit.rows.length ? "" : "nichts geändert"));
        }
        const spoof = await q(`insert into public.messages (chat_id, sender_id, text) values ('${D}', '${U.anna}', 'Ich bin Anna')`);
        check("Nutzer: Nachricht im Namen anderer nicht möglich", spoof.error !== null, spoof.error || "durchgelassen!");
        const other = await q(`update public.messages set text = 'gehackt' where chat_id = '${G}' returning id`);
        check("Nutzer: Nachrichten in fremden Chats nicht änderbar", other.rows.length === 0, other.error || (other.rows.length ? "geändert!" : ""));

    });

    await as(U.anna, async () => {
        const maxMsg = await one(`select id from public.messages where chat_id = '${D}' and sender_id = '${U.max}' order by created_at desc limit 1`);
        const react = await q(`update public.messages set reactions = coalesce(reactions, '{}'::jsonb) || jsonb_build_object('${U.anna}', '👍') where id = '${maxMsg?.id}' returning id`);
        check("Nutzer: auf Nachricht im eigenen Chat reagieren klappt", react.rows.length === 1, react.error || (react.rows.length ? "" : "nichts geändert"));
        const listing = await q(`insert into public.marketplace (user_id, title, price) values ('${U.anna}', 'Test 017', 10) returning id`);
        check("Nutzer: Inserat anlegen klappt (Marktplatz-Trigger laufen weiter)", listing.error === null, listing.error || "");
    });

    const someSetup = await one(`select id, uploader_id from public.setups where uploader_id is not null and uploader_id <> '${U.lena}' order by created_at limit 1`);
    const stranger = someSetup.uploader_id === U.max ? U.tim : U.max;
    await as(stranger, async () => {
        const r = await q(`update public.setups set track_name = 'gehackt' where id = '${someSetup.id}' returning id`);
        check("Nutzer: fremdes Setup nicht änderbar", r.rows.length === 0, r.error || (r.rows.length ? "geändert!" : ""));
    });
    await as(someSetup.uploader_id, async () => {
        const r = await q(`update public.setups set track_name = 'Spa-Francorchamps' where id = '${someSetup.id}' returning id`);
        check("Nutzer: eigenes Setup ändern klappt", r.rows.length === 1, r.error || (r.rows.length ? "" : "nichts geändert"));
    });

    await as(U.admin, async () => {
        const all = await q(`select count(*) as n from storage.objects where bucket_id = 'marketplace' and name like '${U.tim}/%'`);
        check("Admin: sieht weiterhin alle Dateien (Moderation)", Number(all.rows[0]?.n) > 0, all.error || String(all.rows[0]?.n));
    });
}

// --- 018: Admin-Rechte nur mit Zwei-Faktor-Anmeldung ---
if (ADMIN_MFA_SQL) {
    // Supabase-Tabelle der eingerichteten Faktoren (im Nachbau vereinfacht)
    await db.exec(`create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status text)`);
    const withAal = async (uid, aal, fn) => as(uid, async () => {
        await db.exec(`set request.jwt.claims = '${JSON.stringify({ sub: uid, aal })}'`);
        try { return await fn(); } finally { await db.exec(`set request.jwt.claims = ''`); }
    });
    const before = await withAal(U.admin, "aal1", async () => (await q(`select public.is_site_admin() as a`)).rows[0]?.a);
    check("Vorher: Admin hat Admin-Rechte auch ohne zweiten Faktor", before === true);
    await db.exec(readFileSync(ADMIN_MFA_SQL, "utf8"));
    const ctl = await db.exec(readFileSync(ADMIN_MFA_SQL, "utf8")); // zweiter Lauf
    console.log("Kontrolle 018:\n  " + ctl[ctl.length - 1].rows.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 018: bereit, Gäste ausgeschlossen", ctl[ctl.length - 1].rows[0].ergebnis === "bereit" && ctl[ctl.length - 1].rows[2].ergebnis === "nein");

    const allChat = Number((await one(`select count(*) as n from storage.objects where bucket_id = 'chat_attachments'`)).n);
    await withAal(U.admin, "aal1", async () => {
        const a = await q(`select public.is_site_admin() as a`);
        check("Admin nur mit Passwort: keine Admin-Rechte", a.rows[0]?.a === false, a.error || String(a.rows[0]?.a));
        const files = await q(`select count(*) as n from storage.objects where bucket_id = 'chat_attachments'`);
        check("Admin nur mit Passwort: sieht keine fremden Chat-Anhänge", Number(files.rows[0]?.n) === 0, files.error || String(files.rows[0]?.n));
    });
    await withAal(U.admin, "aal2", async () => {
        const a = await q(`select public.is_site_admin() as a`);
        check("Admin mit zweitem Faktor: Admin-Rechte wie bisher", a.rows[0]?.a === true, a.error || String(a.rows[0]?.a));
        const files = await q(`select count(*) as n from storage.objects where bucket_id = 'chat_attachments'`);
        check("Admin mit zweitem Faktor: Moderation sieht alle Chat-Anhänge", Number(files.rows[0]?.n) === allChat, files.error || `${files.rows[0]?.n} von ${allChat}`);
    });
    await withAal(U.max, "aal2", async () => {
        const a = await q(`select public.is_site_admin() as a`);
        check("Normaler Nutzer mit zweitem Faktor: kein Admin", a.rows[0]?.a === false, a.error || String(a.rows[0]?.a));
    });
    await as(null, async () => {
        const a = await q(`select public.is_site_admin()`);
        check("Gast: is_site_admin() weiterhin nicht aufrufbar", a.error !== null, a.error || "durchgelassen!");
    });

    // --- 019: Wer Zwei-Faktor eingerichtet hat, braucht den Code für JEDEN Zugriff ---
    if (MFA_PFLICHT_SQL) {
        await db.exec(`insert into auth.mfa_factors (user_id, status) values ('${U.admin}', 'verified'), ('${U.anna}', 'unverified')`);
        const msgsAal1Before = await withAal(U.admin, "aal1", async () => (await q(`select count(*) as n from public.profiles`)).rows[0]?.n);
        check("Vorher (Lücke): Admin ohne Code liest Profile", Number(msgsAal1Before) > 0, String(msgsAal1Before));
        await db.exec(readFileSync(MFA_PFLICHT_SQL, "utf8"));
        const ctl19 = await db.exec(readFileSync(MFA_PFLICHT_SQL, "utf8")); // zweiter Lauf
        const rows19 = ctl19[ctl19.length - 1].rows;
        console.log("Kontrolle 019:\n  " + rows19.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
        check("Kontrolle 019: alle Tabellen und der Speicher geschützt", rows19[0].ergebnis === "0" && rows19[1].ergebnis === "bereit" && rows19[2].ergebnis === "bereit", rows19.map(r => r.ergebnis).join(", "));

        await withAal(U.admin, "aal1", async () => {
            const prof = await q(`select count(*) as n from public.profiles`);
            check("Admin ohne Code: liest keine Profile", prof.error !== null || Number(prof.rows[0]?.n) === 0, prof.error || String(prof.rows[0]?.n));
            const chats = await q(`select count(*) as n from public.messages`);
            check("Admin ohne Code: liest keine Nachrichten", chats.error !== null || Number(chats.rows[0]?.n) === 0, chats.error || String(chats.rows[0]?.n));
            const send = await q(`insert into public.messages (chat_id, sender_id, text) values ('${FORUM}', '${U.admin}', 'Gefälscht')`);
            check("Admin ohne Code: kann nichts schreiben", send.error !== null, send.error || "durchgelassen!");
            const banned = await q(`select public.is_banned() as b`);
            check("Admin ohne Code: Datenbank-Funktionen sehen ihn als gesperrt", banned.rows[0]?.b === true, banned.error || String(banned.rows[0]?.b));
            const rpc = await q(`select public.start_direct_chat('${U.max}', 'Hallo, hier ist der GSRA Admin')`);
            check("Admin ohne Code: kann keinen Chat starten", rpc.error !== null, rpc.error || "durchgelassen!");
            const file = await q(`insert into storage.objects (bucket_id, name) values ('avatars', '${U.admin}/x.png')`);
            check("Admin ohne Code: kann nichts hochladen", file.error !== null, file.error || "durchgelassen!");
        });
        await withAal(U.admin, "aal2", async () => {
            const prof = await q(`select count(*) as n from public.profiles`);
            check("Admin mit Code: liest Profile wie bisher", Number(prof.rows[0]?.n) > 0, prof.error || String(prof.rows[0]?.n));
            const banned = await q(`select public.is_banned() as b, public.is_site_admin() as a`);
            check("Admin mit Code: nicht gesperrt und Admin", banned.rows[0]?.b === false && banned.rows[0]?.a === true, banned.error || JSON.stringify(banned.rows[0]));
            const send = await q(`insert into public.messages (chat_id, sender_id, text) values ('${FORUM}', '${U.admin}', 'Offizielle Info') returning id`);
            check("Admin mit Code: schreibt im offiziellen Forum", send.error === null, send.error || "");
        });
        await withAal(U.max, "aal1", async () => {
            const prof = await q(`select count(*) as n from public.profiles`);
            check("Nutzer ohne Zwei-Faktor: unverändert alles wie bisher", Number(prof.rows[0]?.n) > 0, prof.error || String(prof.rows[0]?.n));
            const banned = await q(`select public.is_banned() as b`);
            check("Nutzer ohne Zwei-Faktor: nicht gesperrt", banned.rows[0]?.b === false, banned.error || String(banned.rows[0]?.b));
        });
        await withAal(U.anna, "aal1", async () => {
            const prof = await q(`select count(*) as n from public.profiles`);
            check("Einrichtung nur begonnen (nicht bestätigt): noch kein Code nötig", Number(prof.rows[0]?.n) > 0, prof.error || String(prof.rows[0]?.n));
        });
        await as(null, async () => {
            const name = await q(`select public.username_available('Noch_Frei_019') as ok`);
            check("Gast: Registrierung weiterhin möglich", name.error === null && name.rows[0]?.ok === true, name.error || "");
            const setups = await q(`select count(*) as n from public.setups`);
            check("Gast: Setups weiterhin lesbar", setups.error === null, setups.error || "");
        });
        await db.exec(`delete from auth.mfa_factors`);
    }
}

// --- 020: Limits gegen Spam ---
if (LIMITS_SQL) {
    await db.exec(readFileSync(LIMITS_SQL, "utf8"));
    const ctl20 = await db.exec(readFileSync(LIMITS_SQL, "utf8")); // zweiter Lauf
    const rows20 = ctl20[ctl20.length - 1].rows;
    console.log("Kontrolle 020:\n  " + rows20.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 020: Limits auf 5 Tabellen, Funktion nicht direkt aufrufbar", rows20[0].ergebnis === "5 von 5" && rows20[1].ergebnis === "nein", rows20.map(r => r.ergebnis).join(", "));

    // Füllt bis zur Grenze auf: erwartet genau „rest“ erfolgreiche Einfügungen, danach eine Ablehnung mit „Zu viele“
    const untilLimit = async (sqlFor, rest) => {
        let ok = 0, error = null;
        for (let i = 0; i < rest + 5 && !error; i++) {
            const r = await q(sqlFor(i));
            if (r.error) error = r.error; else ok++;
        }
        return { ok, error };
    };
    const recent = async (sql) => Number((await one(sql)).n);

    const msgPrior = await recent(`select count(*) as n from public.messages where sender_id = '${U.max}' and created_at > now() - interval '1 minute'`);
    const msgs = await as(U.max, () => untilLimit(i => `insert into public.messages (chat_id, sender_id, text) values ('${D}', '${U.max}', 'Nachricht ${i}')`, 30 - msgPrior));
    check("Nachrichten: 30 pro Minute erlaubt, dann gestoppt", msgs.ok === 30 - msgPrior && /Zu viele Nachrichten/.test(msgs.error || ""), `${msgs.ok} + ${msgPrior} vorher, ${msgs.error || "keine Grenze!"}`);

    await as(U.admin, async () => {
        await db.exec(`set request.jwt.claims = '${JSON.stringify({ sub: U.admin, aal: "aal2" })}'`);
        try {
            const adm = await untilLimit(i => `insert into public.messages (chat_id, sender_id, text) values ('${FORUM}', '${U.admin}', 'Ankündigung ${i}')`, 35);
            check("Admin mit Code: keine Grenze (z. B. viele Ankündigungen)", adm.ok >= 35 && adm.error === null, adm.error || `${adm.ok} gesendet`);
        } finally { await db.exec(`set request.jwt.claims = ''`); }
    });

    const targets = Array.from({ length: 25 }, (_, i) => `70000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`);
    await db.exec(`insert into auth.users (id) values ${targets.map(t => `('${t}')`).join(", ")};
                   insert into public.profiles (id, username) values ${targets.map((t, i) => `('${t}', 'Zielperson ${i}')`).join(", ")};`);
    const frPrior = await recent(`select count(*) as n from public.friendships where user_id = '${U.anna}' and created_at > now() - interval '1 hour'`);
    const fr = await as(U.anna, () => untilLimit(i => `select public.send_friend_request('${targets[i]}')`, 20 - frPrior));
    check("Freundschaftsanfragen: 20 pro Stunde, dann gestoppt", fr.ok === 20 - frPrior && /Zu viele Freundschaftsanfragen/.test(fr.error || ""), `${fr.ok} + ${frPrior} vorher, ${fr.error || "keine Grenze!"}`);

    const grPrior = await recent(`select count(*) as n from public.chats where user1_id = '${U.max}' and user2_id = '${U.max}' and title is not null and created_at > now() - interval '1 hour'`);
    const gr = await as(U.max, () => untilLimit(i => `insert into public.chats (user1_id, user2_id, title) values ('${U.max}', '${U.max}', 'Spam-Gruppe ${i}')`, 5 - grPrior));
    check("Gruppen: 5 pro Stunde, dann gestoppt", gr.ok === 5 - grPrior && /Zu viele neue Gruppen/.test(gr.error || ""), `${gr.ok} + ${grPrior} vorher, ${gr.error || "keine Grenze!"}`);

    const mkPrior = await recent(`select count(*) as n from public.marketplace where user_id = '${U.anna}' and created_at > now() - interval '1 hour'`);
    const mk = await as(U.anna, () => untilLimit(i => `insert into public.marketplace (user_id, title, price) values ('${U.anna}', 'Spam ${i}', 1)`, 20 - mkPrior));
    check("Inserate: 20 pro Stunde, dann gestoppt", mk.ok === 20 - mkPrior && /Zu viele neue Inserate/.test(mk.error || ""), `${mk.ok} + ${mkPrior} vorher, ${mk.error || "keine Grenze!"}`);

    const stPrior = await recent(`select count(*) as n from public.setups where uploader_id::text = '${U.tim}' and created_at > now() - interval '1 hour'`);
    const st = await as(U.tim, () => untilLimit(i => `insert into public.setups (simulation, car_model, track_name, file_name, file_url, uploader_id) values ('ACC', 'BMW M4 GT3', 'Monza ${i}', 'monza${i}.json', 'https://x.supabase.co/storage/v1/object/public/setups/${U.tim}/monza${i}.json', '${U.tim}')`, 20 - stPrior));
    check("Setups: 20 pro Stunde, dann gestoppt", st.ok === 20 - stPrior && /Zu viele Setups/.test(st.error || ""), `${st.ok} + ${stPrior} vorher, ${st.error || "keine Grenze!"}`);

    await as(U.lena, async () => {
        const normal = await q(`select public.send_friend_request('${targets[24]}')`);
        check("Andere Nutzer sind nicht betroffen", normal.error === null, normal.error || "");
    });
}

// --- 021: Moderator-Rolle und Protokoll ---
if (MODERATION_SQL) {
    const MOD = "80000000-0000-0000-0000-000000000001", MOD2 = "80000000-0000-0000-0000-000000000002";
    const T1 = "80000000-0000-0000-0000-000000000011", T2 = "80000000-0000-0000-0000-000000000012", NEU = "80000000-0000-0000-0000-000000000099";
    await db.exec(`insert into auth.users (id) values ('${MOD}'), ('${MOD2}'), ('${T1}'), ('${T2}'), ('${NEU}');
      insert into public.profiles (id, username, gsra_id) values ('${MOD}', 'Moderator Mia', 900001), ('${MOD2}', 'Moderator Max', 900002),
        ('${T1}', 'Störenfried 1', 900011), ('${T2}', 'Störenfried 2', 900012);`);
    const report = async (reported) => (await one(`insert into public.reports (reporter_id, reported_id, reason) values ('${U.anna}', '${reported}', 'Beleidigung') returning id`)).id;
    const R1 = await report(T1), R2 = await report(T1), R3 = await report(T2), R4 = await report(MOD2), R5 = await report(T2);
    const adminGsra = (await one(`select gsra_id from public.profiles where id = '${U.admin}'`)).gsra_id;

    await db.exec(readFileSync(MODERATION_SQL, "utf8"));
    const ctl21 = await db.exec(readFileSync(MODERATION_SQL, "utf8")); // zweiter Lauf
    const rows21 = ctl21[ctl21.length - 1].rows;
    console.log("Kontrolle 021:\n  " + rows21.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 021: 5 Meldungs-Funktionen, 7 Tabellen mit Protokoll", rows21[0].ergebnis === "5 von 5" && rows21[1].ergebnis === "7 von 7", rows21.map(r => r.ergebnis).join(", "));
    await db.exec(`update public.profiles set role = 'moderator' where id in ('${MOD}', '${MOD2}')`);

    const withClaims = (uid, aal, fn) => as(uid, async () => {
        await db.exec(`set request.jwt.claims = '${JSON.stringify({ sub: uid, aal })}'`);
        try { return await fn(); } finally { await db.exec(`set request.jwt.claims = ''`); }
    });

    await withClaims(MOD, "aal1", async () => {
        const r = await q(`select count(*) as n from public.reports`);
        check("Moderator ohne Code: sieht keine Meldungen", Number(r.rows[0]?.n) === 0, r.error || String(r.rows[0]?.n));
        const w = await q(`select public.admin_warn_user('${R1}', 'Bitte freundlich bleiben')`);
        check("Moderator ohne Code: kann nicht verwarnen", w.error !== null, w.error || "durchgelassen!");
    });
    await withClaims(MOD, "aal2", async () => {
        const r = await q(`select count(*) as n from public.reports where status = 'offen'`);
        check("Moderator mit Code: sieht offene Meldungen", Number(r.rows[0]?.n) >= 5, r.error || String(r.rows[0]?.n));
        const w = await q(`select public.admin_warn_user('${R1}', 'Bitte freundlich bleiben')`);
        check("Moderator: verwarnt", w.error === null, w.error || "");
        const perm = await q(`select public.admin_ban_user('${R2}', null)`);
        check("Moderator: dauerhaft sperren verboten", /nur ein Administrator/.test(perm.error || ""), perm.error || "durchgelassen!");
        const ban = await q(`select public.admin_ban_user('${R2}', 30)`);
        check("Moderator: 30 Tage sperren erlaubt", ban.error === null, ban.error || "");
        const lift = await q(`select public.admin_lift_ban('${T1}')`);
        check("Moderator: befristete Sperre aufheben erlaubt", lift.error === null, lift.error || "");
        const team = await q(`select public.admin_ban_user('${R4}', 30)`);
        check("Moderator: kann keinen anderen Moderator sperren", /Moderationsteams/.test(team.error || ""), team.error || "durchgelassen!");
        const dismiss = await q(`select public.admin_dismiss_report('${R3}')`);
        check("Moderator: Meldung verwerfen", dismiss.error === null, dismiss.error || "");
        const role = await q(`select public.admin_set_role(900011, 'moderator')`);
        check("Moderator: kann keine Rollen vergeben", role.error !== null, role.error || "durchgelassen!");
        const log = await q(`select count(*) as n from public.moderation_log`);
        check("Moderator: sieht das Protokoll nicht", Number(log.rows[0]?.n) === 0, log.error || String(log.rows[0]?.n));
        const ev = await q(`insert into public.events (title) values ('Moderator-Event') returning id`);
        check("Moderator: vor 022 noch keine Events", ev.error !== null, ev.error || "durchgelassen!");
    });

    await withClaims(U.admin, "aal2", async () => {
        const perm = await q(`select public.admin_ban_user('${R5}', null)`);
        check("Admin: dauerhaft sperren erlaubt", perm.error === null, perm.error || "");
        await withClaims(MOD, "aal2", async () => {
            const lift = await q(`select public.admin_lift_ban('${T2}')`);
            check("Moderator: dauerhafte Sperre aufheben verboten", /nur ein Administrator/.test(lift.error || ""), lift.error || "durchgelassen!");
        });
        await db.exec(`set request.jwt.claims = '${JSON.stringify({ sub: U.admin, aal: "aal2" })}'`);
        await db.exec(`set request.jwt.claim.sub = '${U.admin}'; set role authenticated;`);
        const lift = await q(`select public.admin_lift_ban('${T2}')`);
        check("Admin: dauerhafte Sperre aufheben erlaubt", lift.error === null, lift.error || "");
        const set = await q(`select public.admin_set_role(900011, 'moderator') as name`);
        check("Admin: Moderator ernennen per GSRA-ID", set.error === null && set.rows[0]?.name === "Störenfried 1", set.error || JSON.stringify(set.rows[0]));
        const back = await q(`select public.admin_set_role(900011, 'user')`);
        check("Admin: Rolle wieder entziehen", back.error === null, back.error || "");
        const self = await q(`select public.admin_set_role(${adminGsra}, 'user')`);
        check("Admin: eigene Rolle nicht änderbar", self.error !== null, self.error || "durchgelassen!");
        const makeAdmin = await q(`select public.admin_set_role(900011, 'admin')`);
        check("Admin: über die Webseite keine neuen Admins", makeAdmin.error !== null, makeAdmin.error || "durchgelassen!");
        const del = await q(`delete from public.marketplace where user_id = '${U.tim}' returning id`);
        check("Admin: fremdes Inserat löschen (wird protokolliert)", del.error === null && del.rows.length > 0, del.error || "nichts gelöscht");
        const log = await q(`select action, actor_id from public.moderation_log order by id`);
        const actions = log.rows.map(r => r.action);
        const expected = ["rolle", "verwarnung", "sperre", "sperre_aufgehoben", "meldung_verworfen", "inserat_geloescht"];
        check("Protokoll enthält alle Aktionen", expected.every(a => actions.includes(a)), [...new Set(actions)].join(", "));
        check("Protokoll nennt, wer gehandelt hat", log.rows.some(r => r.action === "verwarnung" && r.actor_id === MOD) && log.rows.some(r => r.action === "inserat_geloescht" && r.actor_id === U.admin),
            JSON.stringify(log.rows.filter(r => ["verwarnung", "inserat_geloescht"].includes(r.action))));
        const wipe = await q(`delete from public.moderation_log returning id`);
        check("Protokoll lässt sich nicht löschen (auch nicht als Admin)", wipe.error !== null || wipe.rows.length === 0, wipe.error || `${wipe.rows.length} gelöscht!`);
    });

    await as(NEU, async () => {
        const fake = await q(`insert into public.profiles (id, username, role) values ('${NEU}', 'Neu', 'moderator')`);
        check("Neues Konto kann sich nicht selbst zum Moderator machen", fake.error !== null, fake.error || "durchgelassen!");
        const forge = await q(`insert into public.moderation_log (action) values ('gefälscht')`);
        check("Niemand kann Protokoll-Einträge fälschen", forge.error !== null, forge.error || "durchgelassen!");
    });
    await withClaims(U.admin, "aal1", async () => {
        const del = await q(`select public.delete_own_account()`);
        check("Admin ohne Code: kann sein Konto trotzdem nicht selbst löschen", /Admins und Moderatoren/.test(del.error || ""), del.error || "durchgelassen!");
    });

    // --- 022: Moderatoren verwalten Events im Rennkalender ---
    if (EVENTS_SQL) {
        await db.exec(readFileSync(EVENTS_SQL, "utf8"));
        const ctl22 = await db.exec(readFileSync(EVENTS_SQL, "utf8")); // zweiter Lauf
        const r22 = ctl22[ctl22.length - 1].rows[0];
        check("Kontrolle 022: alle Event-Regeln für das Moderationsteam", r22.ergebnis === "6 von 6", r22.ergebnis);
        await withClaims(MOD, "aal1", async () => {
            const ev = await q(`insert into public.events (title) values ('Ohne Code') returning id`);
            check("Moderator ohne Code: kein Event anlegen", ev.error !== null, ev.error || "durchgelassen!");
        });
        let eventId = null;
        await withClaims(MOD, "aal2", async () => {
            const ev = await q(`insert into public.events (title, simulation, track, event_date) values ('GT3 Nachtrennen', 'iRacing', 'Spa', now() + interval '7 days') returning id`);
            check("Moderator mit Code: legt Event an", ev.error === null, ev.error || "");
            eventId = ev.rows[0]?.id;
            const upd = await q(`update public.events set track = 'Monza' where id = '${eventId}' returning id`);
            check("Moderator: ändert Event", upd.rows.length === 1, upd.error || "nichts geändert");
            const del = await q(`delete from public.events where id = '${eventId}' returning id`);
            check("Moderator: löscht Event", del.rows.length === 1, del.error || "nichts gelöscht");
        });
        await withClaims(U.max, "aal2", async () => {
            const ev = await q(`insert into public.events (title) values ('Normales Mitglied') returning id`);
            check("Normales Mitglied: kein Event anlegen", ev.error !== null, ev.error || "durchgelassen!");
        });
        await withClaims(U.admin, "aal2", async () => {
            const ev = await q(`insert into public.events (title) values ('Admin-Event') returning id`);
            check("Admin: legt weiterhin Events an", ev.error === null, ev.error || "");
            const log = await q(`select count(*) as n from public.moderation_log where action like 'event_%' and actor_id = '${MOD}'`);
            check("Event-Änderungen des Moderators stehen im Protokoll", Number(log.rows[0]?.n) === 3, log.error || String(log.rows[0]?.n));
        });
    }

    // --- 023: Verkäufer bewerten, Setups kommentieren, Zufriedenheit im Profil ---
    if (BEWERTUNGEN_SQL) {
        const V = "90000000-0000-0000-0000-000000000001", K = "90000000-0000-0000-0000-000000000002";
        const K2 = "90000000-0000-0000-0000-000000000003", K3 = "90000000-0000-0000-0000-000000000004";
        await db.exec(`insert into auth.users (id) values ('${V}'), ('${K}'), ('${K2}'), ('${K3}');
          insert into public.profiles (id, username, gsra_id) values ('${V}', 'Verkäufer Vera', 910001), ('${K}', 'Käufer Kai', 910002),
            ('${K2}', 'Käufer ohne Kontakt', 910003), ('${K3}', 'Käufer ohne Antwort', 910004);`);
        const L = (await one(`insert into public.marketplace (user_id, title, price) values ('${V}', 'Fanatec CSL DD', 350) returning id::text as id`)).id;
        // Kai und Vera haben geschrieben (beide Seiten), K3 hat nur selbst geschrieben
        const chatKV = (await one(`insert into public.chats (user1_id, user2_id) values ('${K}', '${V}') returning id`)).id;
        const chatK3 = (await one(`insert into public.chats (user1_id, user2_id) values ('${K3}', '${V}') returning id`)).id;
        await db.exec(`insert into public.messages (chat_id, sender_id, text) values ('${chatKV}', '${K}', 'Ist das Lenkrad noch da?'),
            ('${chatKV}', '${V}', 'Ja, gerne!'), ('${chatK3}', '${K3}', 'Hallo?')`);

        await db.exec(readFileSync(BEWERTUNGEN_SQL, "utf8"));
        const ctl23 = await db.exec(readFileSync(BEWERTUNGEN_SQL, "utf8")); // zweiter Lauf
        const rows23 = ctl23[ctl23.length - 1].rows;
        console.log("Kontrolle 023:\n  " + rows23.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
        check("Kontrolle 023: Tabellen geschützt, nur über Funktionen", rows23[0].ergebnis === "2 von 2" && rows23[1].ergebnis === "ja" && rows23[2].ergebnis === "ja", rows23.map(r => r.ergebnis).join(", "));

        await as(K, async () => {
            const r1 = await q(`select public.rate_seller('${L}', 1, array['freundlich', 'schnelle_antwort', 'spam'], 'Super Abwicklung!')`);
            check("Käufer mit Kontakt: bewertet den Verkäufer", r1.error === null, r1.error || "");
            const row = await q(`select rating, tags, comment, listing_title from public.seller_ratings where rater_id = '${K}'`);
            check("Bewertung gespeichert, unbekannte Merkmale verworfen", row.rows[0]?.rating === 1 && JSON.stringify(row.rows[0]?.tags) === '["freundlich","schnelle_antwort"]' && row.rows[0]?.listing_title === "Fanatec CSL DD", JSON.stringify(row.rows[0]));
            const r2 = await q(`select public.rate_seller('${L}', 0, array['zuverlaessig'], 'Doch nur okay')`);
            const count = await q(`select count(*) as n, min(rating) as r from public.seller_ratings where rater_id = '${K}'`);
            check("Erneut bewerten ändert die Bewertung (keine zweite)", r2.error === null && Number(count.rows[0]?.n) === 1 && Number(count.rows[0]?.r) === 0, r2.error || JSON.stringify(count.rows[0]));
            const direct = await q(`insert into public.seller_ratings (listing_id, seller_id, rater_id, rating) values ('${L}', '${V}', '${K}', 1)`);
            check("Direkt in die Tabelle schreiben verboten", direct.error !== null, direct.error || "durchgelassen!");
            const fake = await q(`update public.seller_ratings set rating = 1`);
            check("Bewertungen nicht direkt änderbar", fake.error !== null, fake.error || "durchgelassen!");
            const rep = await q(`select public.profile_reputation('${V}') as r`);
            const m = rep.rows[0]?.r?.marktplatz;
            check("Zufriedenheit im Profil zählt die Bewertung", m?.anzahl === 1 && m?.ok === 1 && m?.zuverlaessig === 1, rep.error || JSON.stringify(m));
        });
        await as(K2, async () => {
            const r = await q(`select public.rate_seller('${L}', -1)`);
            check("Ohne Kontakt keine Bewertung", /sobald du mit dem Verkäufer/.test(r.error || ""), r.error || "durchgelassen!");
            const del = await q(`delete from public.seller_ratings returning id`);
            check("Fremde Bewertungen nicht löschbar", del.rows.length === 0, del.error || `${del.rows.length} gelöscht!`);
        });
        await as(K3, async () => {
            const r = await q(`select public.rate_seller('${L}', -1)`);
            check("Ohne Antwort des Verkäufers keine Bewertung", /sobald du mit dem Verkäufer/.test(r.error || ""), r.error || "durchgelassen!");
        });
        await as(V, async () => {
            const r = await q(`select public.rate_seller('${L}', 1)`);
            check("Eigenes Inserat nicht bewertbar", /eigenes Inserat/.test(r.error || ""), r.error || "durchgelassen!");
        });
        await as(null, async () => {
            const r = await q(`select public.profile_reputation('${V}')`);
            check("Gäste sehen keine Bewertungen", r.error !== null, r.error || "durchgelassen!");
            const t = await q(`select count(*) as n from public.seller_ratings`);
            check("Gäste lesen die Tabelle nicht", t.error !== null || Number(t.rows[0]?.n) === 0, t.error || String(t.rows[0]?.n));
        });

        // Setups: Community-Setup von Vera und ein Pro Setup von Vera (als Pro-Fahrerin)
        await db.exec(`insert into public.pro_creators (user_id) values ('${V}')`);
        const SV = (await one(`insert into public.setups (simulation, car_model, track_name, file_name, file_url, uploader_id) values ('ACC', 'Porsche 992', 'Monza', 'monza.json', 'https://x.supabase.co/storage/v1/object/public/setups/${V}/monza.json', '${V}') returning id::text as id`)).id;
        const SP = (await one(`insert into public.setups (simulation, car_model, track_name, file_name, is_pro, uploader_id) values ('ACC', 'BMW M4 GT3', 'Spa', 'spa.json', true, '${V}') returning id::text as id`)).id;
        await as(K, async () => {
            const r = await q(`select public.review_setup('${SV}', 'hilfreich', 'Top Setup, 3 Zehntel schneller!')`);
            check("Setup kommentieren und bewerten", r.error === null, r.error || "");
            const again = await q(`select public.review_setup('${SV}', 'nicht_wie_beschrieben', 'Doch nicht wie beschrieben')`);
            const n = await q(`select count(*) as n, max(verdict) as v from public.setup_reviews where user_id = '${K}'`);
            check("Erneut kommentieren ändert den eigenen Kommentar", again.error === null && Number(n.rows[0]?.n) === 1 && n.rows[0]?.v === "nicht_wie_beschrieben", again.error || JSON.stringify(n.rows[0]));
            const bad = await q(`select public.review_setup('${SV}', 'super')`);
            check("Unbekannte Bewertung abgelehnt", bad.error !== null, bad.error || "durchgelassen!");
            const pro = await q(`select public.review_setup('${SP}', 'hilfreich')`);
            check("Pro Setup ohne Zugang nicht bewertbar", /Pro Setups bewerten nur/.test(pro.error || ""), pro.error || "durchgelassen!");
            const rep = await q(`select public.profile_reputation('${V}') as r`);
            check("Zufriedenheit mit Setups im Profil", rep.rows[0]?.r?.setups?.anzahl === 1 && rep.rows[0]?.r?.setups?.nicht_wie_beschrieben === 1, rep.error || JSON.stringify(rep.rows[0]?.r?.setups));
        });
        await as(V, async () => {
            const r = await q(`select public.review_setup('${SV}', 'hilfreich')`);
            check("Eigenes Setup nicht bewertbar", /eigenes Setup/.test(r.error || ""), r.error || "durchgelassen!");
        });
        await as(K2, async () => {
            const r = await q(`select public.review_setup('${SV}', 'okay', 'Geht so')`);
            const del = await q(`delete from public.setup_reviews where user_id = '${K2}' returning id`);
            check("Eigenen Kommentar löschen", r.error === null && del.rows.length === 1, r.error || del.error || "nichts gelöscht");
        });
        await withClaims(MOD, "aal2", async () => {
            const del = await q(`delete from public.seller_ratings where rater_id = '${K}' returning id`);
            check("Moderator entfernt eine unpassende Bewertung", del.rows.length === 1, del.error || "nichts gelöscht");
        });
        await withClaims(U.admin, "aal2", async () => {
            const log = await q(`select count(*) as n from public.moderation_log where action = 'bewertung_geloescht' and actor_id = '${MOD}'`);
            check("Entfernte Bewertung steht im Protokoll", Number(log.rows[0]?.n) === 1, log.error || String(log.rows[0]?.n));
        });

        // --- 024: Skala Ideal bis Schlecht, Visibility-Header, Coaching ---
        if (COACHING_SQL) {
            await db.exec(readFileSync(COACHING_SQL, "utf8"));
            const ctl24 = await db.exec(readFileSync(COACHING_SQL, "utf8")); // zweiter Lauf
            const rows24 = ctl24[ctl24.length - 1].rows;
            console.log("Kontrolle 024:\n  " + rows24.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
            check("Kontrolle 024: Skala, Visibility, Coaching, Messenger", rows24.map(r => r.ergebnis).join(",") === "bereit,bereit,2 von 2,bereit", rows24.map(r => r.ergebnis).join(", "));
            const migrated = await one(`select verdict from public.setup_reviews where user_id = '${K}'`);
            check("Alte Setup-Bewertung übernommen (nicht wie beschrieben → Schlecht)", migrated?.verdict === "schlecht", JSON.stringify(migrated));

            // Abos: Vera (Coach) und K2 mit Pole, Kai bleibt Paddock
            await db.exec(`insert into public.user_plans (user_id, status, current_period_end) values ('${V}', 'active', now() + interval '20 days'), ('${K2}', 'active', now() + interval '20 days')`);

            await as(K, async () => {
                const r = await q(`select public.rate_seller('${L}', -2, array['zuverlaessig'], 'Leider schlecht')`);
                check("Neue Skala: „Schlecht“ wird gespeichert", r.error === null, r.error || "");
                const bad = await q(`select public.rate_seller('${L}', -3)`);
                check("Werte außerhalb der Skala abgelehnt", bad.error !== null, bad.error || "durchgelassen!");
                const sv = await q(`select public.review_setup('${SV}', 'ideal', 'Ideal!')`);
                const old = await q(`select public.review_setup('${SV}', 'hilfreich')`);
                check("Setups: neue Skala gilt, alte Werte abgelehnt", sv.error === null && old.error !== null, sv.error || old.error || "alter Wert durchgelassen!");
                const rep = await q(`select public.profile_reputation('${V}') as r`);
                const r2 = rep.rows[0]?.r;
                check("Zufriedenheit zählt nach neuer Skala", r2?.marktplatz?.schlecht === 1 && r2?.setups?.ideal === 1, rep.error || JSON.stringify({ m: r2?.marktplatz, s: r2?.setups }));

                const names = await q(`select username, plan from public.visibility_names()`);
                const list = names.rows.map(x => x.username);
                check("Visibility-Header: zahlende Mitglieder erscheinen", list.includes("Verkäufer Vera") && !list.includes("Käufer Kai"), names.error || list.join(", "));
            });
            await as(V, async () => {
                const off = await q(`update public.profiles set show_in_header = false where id = '${V}' returning id`);
                check("Eigenen Namen im Header abschalten", off.rows.length === 1, off.error || "nichts geändert");
            });
            await as(K, async () => {
                const names = await q(`select username from public.visibility_names()`);
                check("Abgeschaltet: Name erscheint nicht mehr", !names.rows.some(x => x.username === "Verkäufer Vera"), names.rows.map(x => x.username).join(", "));
            });
            await as(null, async () => {
                const names = await q(`select * from public.visibility_names()`);
                check("Gäste bekommen keine Namensliste", names.error !== null, names.error || "durchgelassen!");
            });

            // Coaching
            let offerId = null;
            await as(V, async () => {
                const o = await q(`select public.coaching_save_offer(null, '2 Stunden mit mir fahren', 'Linien und Bremspunkte', 'Fahrtechnik', 'iRacing', 120, 4000, true) as id`);
                check("Coach mit Pole legt ein Angebot an", o.error === null, o.error || "");
                offerId = o.rows[0]?.id;
                const cheap = await q(`select public.coaching_save_offer(null, 'Zu billig', null, 'Setup', null, 60, 100, true)`);
                check("Preis unter 5 € abgelehnt", /zwischen 5 €/.test(cheap.error || ""), cheap.error || "durchgelassen!");
                const direct = await q(`insert into public.coaching_offers (coach_id, title, duration_minutes, price_cents) values ('${V}', 'Direkt', 60, 1000)`);
                check("Angebote nicht direkt in die Tabelle schreibbar", direct.error !== null, direct.error || "durchgelassen!");
                const own = await q(`select public.coaching_book('${offerId}')`);
                check("Eigenes Coaching nicht buchbar", /eigenes Coaching/.test(own.error || ""), own.error || "durchgelassen!");
            });
            await as(K, async () => {
                const o = await q(`select public.coaching_save_offer(null, 'Paddock-Coaching', null, 'Setup', null, 60, 2000, true)`);
                check("Mit Paddock keine Angebote", /Pole oder Alliance/.test(o.error || ""), o.error || "durchgelassen!");
                const fee = await q(`select public.coaching_fee_percent() as p`);
                check("Paddock: 10 % Servicegebühr", fee.rows[0]?.p === 10, fee.error || String(fee.rows[0]?.p));
                const b = await q(`select public.coaching_book('${offerId}', 'Hallo, wann hast du Zeit?', 'Wochenende') as r`);
                const r = b.rows[0]?.r;
                check("Paddock bucht: Coach erhält 40 €, Käufer zahlt 44 €", b.error === null && r?.price_cents === 4000 && r?.fee_cents === 400 && r?.total_cents === 4400, b.error || JSON.stringify(r));
                const twice = await q(`select public.coaching_book('${offerId}')`);
                check("Gleiches Coaching nicht doppelt anfragen", /bereits angefragt/.test(twice.error || ""), twice.error || "durchgelassen!");
                const hack = await q(`update public.coaching_bookings set fee_cents = 0, total_cents = price_cents`);
                check("Preis und Gebühr nicht manipulierbar", hack.error !== null, hack.error || "durchgelassen!");
                const fake = await q(`insert into public.coaching_bookings (coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents) values ('${V}', '${K}', 'x', 60, 1, 0, 1)`);
                check("Buchungen nicht direkt eintragbar", fake.error !== null, fake.error || "durchgelassen!");
            });
            await as(K2, async () => {
                const b = await q(`select public.coaching_book('${offerId}') as r`);
                check("Pole bucht: keine Servicegebühr", b.error === null && b.rows[0]?.r?.fee_cents === 0 && b.rows[0]?.r?.total_cents === 4000, b.error || JSON.stringify(b.rows[0]?.r));
                const mine = await q(`select count(*) as n from public.coaching_bookings`);
                check("Jeder sieht nur seine eigenen Anfragen", Number(mine.rows[0]?.n) === 1, mine.error || String(mine.rows[0]?.n));
                const respond = await q(`select public.coaching_respond(b.id, true) from public.coaching_bookings b`);
                check("Käufer kann seine Anfrage nicht selbst annehmen", respond.error !== null, respond.error || "durchgelassen!");
                const offer2 = await q(`select public.coaching_save_offer(null, 'Setup-Beratung', null, 'Setup', 'ACC', 60, 2500, true) as id`);
                check("Weiterer Coach mit Pole legt Angebot an", offer2.error === null, offer2.error || "");
            });
            await as(K3, async () => {
                const chat = await q(`select public.start_direct_chat('${K2}', 'Hallo, ich interessiere mich für dein Coaching')`);
                check("Interessenten können Coaches im Messenger anschreiben", chat.error === null, chat.error || "");
            });
            await as(V, async () => {
                const list = await q(`select id, status, buyer_id from public.coaching_bookings order by created_at`);
                check("Coach sieht die Anfragen zu seinen Angeboten", list.rows.length === 2, list.error || String(list.rows.length));
                const kaiReq = list.rows.find(x => x.buyer_id === K);
                const acc = await q(`select public.coaching_respond('${kaiReq?.id}', true)`);
                const st = await q(`select status from public.coaching_bookings where id = '${kaiReq?.id}'`);
                check("Coach nimmt an", acc.error === null && st.rows[0]?.status === "angenommen", acc.error || JSON.stringify(st.rows[0]));
            });
            await as(K, async () => {
                const id = (await q(`select id from public.coaching_bookings`)).rows[0]?.id;
                const c = await q(`select public.coaching_cancel('${id}')`);
                check("Käufer storniert (vor der Bezahlung)", c.error === null, c.error || "");
            });
            await withClaims(MOD, "aal2", async () => {
                const del = await q(`delete from public.coaching_offers where id = '${offerId}' returning id`);
                check("Moderator entfernt ein Angebot", del.rows.length === 1, del.error || (del.rows.length ? "" : "nichts gelöscht"));
            });
            await withClaims(U.admin, "aal2", async () => {
                const log = await q(`select count(*) as n from public.moderation_log where action = 'coaching_geloescht'`);
                check("Entferntes Angebot steht im Protokoll", Number(log.rows[0]?.n) === 1, log.error || String(log.rows[0]?.n));
            });
            // Käufer erreicht den Coach auch dann, wenn der alle Angebote pausiert hat – Fremde dann aber nicht mehr
            let offer2Id = null;
            await as(K2, async () => { offer2Id = (await q(`select id from public.coaching_offers where coach_id = '${K2}'`)).rows[0]?.id; });
            await as(K, async () => {
                const b = await q(`select public.coaching_book('${offer2Id}') as r`);
                check("Paddock fragt zweites Coaching an", b.error === null, b.error || "");
            });
            await as(K2, async () => {
                const pause = await q(`select public.coaching_save_offer('${offer2Id}', 'Setup-Beratung', null, 'Setup', 'ACC', 60, 2500, false)`);
                check("Coach pausiert sein Angebot", pause.error === null, pause.error || "");
            });
            await as(K, async () => {
                const chat = await q(`select public.start_direct_chat('${K2}', 'Hallo, wann passt es dir?')`);
                check("Käufer schreibt dem Coach trotz pausiertem Angebot", chat.error === null, chat.error || "");
            });
            await as(U.lena, async () => {
                const chat = await q(`select public.start_direct_chat('${K2}', 'Hallo')`);
                check("Fremde erreichen einen Coach ohne aktives Angebot nicht", /befreundet/.test(chat.error || ""), chat.error || "durchgelassen!");
            });
            await as(null, async () => {
                const o = await q(`select count(*) as n from public.coaching_offers`);
                check("Gäste sehen keine Coachings", o.error !== null || Number(o.rows[0]?.n) === 0, o.error || String(o.rows[0]?.n));
            });

            // --- 025: Coaching bezahlen (Stripe Connect, Coach trägt die Stripe-Gebühren) ---
            // Aufrufe außerhalb von as(...) laufen wie die Server-Funktionen (service_role)
            if (BEZAHLUNG_SQL) {
                await db.exec(readFileSync(BEZAHLUNG_SQL, "utf8"));
                const ctl25 = await db.exec(readFileSync(BEZAHLUNG_SQL, "utf8")); // zweiter Lauf
                const rows25 = ctl25[ctl25.length - 1].rows;
                console.log("Kontrolle 025:\n  " + rows25.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                check("Kontrolle 025: Konten, Spalten, Server-Funktionen", rows25.map(r => r.ergebnis).join(",") === "bereit,3 von 3,bereit", rows25.map(r => r.ergebnis).join(", "));

                const bk = (await one(`select id from public.coaching_bookings where buyer_id = '${K}' and offer_id = '${offer2Id}' and status = 'angefragt'`))?.id;
                await as(K2, async () => {
                    const soon = await q(`select public.coaching_respond('${bk}', true, now() + interval '30 minutes')`);
                    check("Termin muss mindestens 1 Stunde in der Zukunft liegen", /mindestens 1 Stunde/.test(soon.error || ""), soon.error || "durchgelassen!");
                    const none = await q(`select public.coaching_respond('${bk}', true, null)`);
                    check("Annehmen nur mit Termin", none.error !== null, none.error || "durchgelassen!");
                    const ok = await q(`select public.coaching_respond('${bk}', true, now() + interval '3 days')`);
                    check("Coach nimmt mit festem Termin an", ok.error === null, ok.error || "");
                });
                await as(K, async () => {
                    const ins = await q(`insert into public.coach_payout_accounts (user_id, stripe_account_id) values ('${K}', 'acct_fake')`);
                    check("Auszahlungskonto nicht selbst eintragbar", ins.error !== null, ins.error || "durchgelassen!");
                    const paid = await q(`select public.coaching_mark_paid('${bk}', 'cs_x', 'pi_x', 1, 'acct_x')`);
                    check("Zahlung nicht selbst als bezahlt verbuchbar", paid.error !== null, paid.error || "durchgelassen!");
                    const info = await q(`select public.coaching_checkout_info('${bk}', '${K}')`);
                    const refund = await q(`select public.coaching_refund_info('${bk}', '${K}')`);
                    check("Stripe-Funktionen nur für den Server", info.error !== null && refund.error !== null, info.error || refund.error || "durchgelassen!");
                    const ready = await q(`select public.coach_payment_ready('${K2}') as r`);
                    check("Coach ohne Stripe-Konto: Bezahlen noch nicht möglich", ready.rows[0]?.r === false, ready.error || String(ready.rows[0]?.r));
                });
                const notReady = await q(`select public.coaching_checkout_info('${bk}', '${K}')`);
                check("Bezahlseite erst, wenn der Coach Stripe eingerichtet hat", /richtet die Bezahlung/.test(notReady.error || ""), notReady.error || "durchgelassen!");

                await db.exec(`insert into public.coach_payout_accounts (user_id, stripe_account_id, country, charges_enabled, details_submitted) values ('${K2}', 'acct_k2test', 'DE', true, true)`);
                await as(K, async () => {
                    const ready = await q(`select public.coach_payment_ready('${K2}') as r`);
                    const seen = await q(`select count(*) as n from public.coach_payout_accounts`);
                    check("Käufer sieht nur „bereit“, nicht das Stripe-Konto des Coaches", ready.rows[0]?.r === true && Number(seen.rows[0]?.n) === 0, ready.error || seen.error || `${ready.rows[0]?.r}/${seen.rows[0]?.n}`);
                });
                await as(K2, async () => {
                    const own = await q(`select stripe_account_id from public.coach_payout_accounts`);
                    check("Coach sieht sein eigenes Auszahlungskonto", own.rows.length === 1 && own.rows[0].stripe_account_id === "acct_k2test", own.error || JSON.stringify(own.rows));
                    const move = await q(`select public.coaching_set_time('${bk}', now() + interval '2 days')`);
                    check("Coach verschiebt den Termin vor der Bezahlung", move.error === null, move.error || "");
                });
                const stranger = await q(`select public.coaching_checkout_info('${bk}', '${K2}')`);
                check("Nur der Käufer bekommt die Bezahlseite", stranger.error !== null, stranger.error || "durchgelassen!");
                const info = (await one(`select public.coaching_checkout_info('${bk}', '${K}') as r`)).r;
                check("Bezahlseite: Betrag und Gebühr aus der Datenbank (25 € + 2,50 €)", info?.total_cents === 2750 && info?.fee_cents === 250 && info?.stripe_account_id === "acct_k2test", JSON.stringify(info));

                await db.exec(`select public.coaching_checkout_started('${bk}', 'cs_gsra1')`);
                const wrongAmount = (await one(`select public.coaching_mark_paid('${bk}', 'cs_gsra1', 'pi_1', 1000, 'acct_k2test') as r`)).r;
                const wrongAccount = (await one(`select public.coaching_mark_paid('${bk}', 'cs_gsra1', 'pi_1', 2750, 'acct_fremd') as r`)).r;
                check("Falscher Betrag oder falsches Konto: wird erstattet statt verbucht", wrongAmount === "erstatten" && wrongAccount === "erstatten", `${wrongAmount}/${wrongAccount}`);
                const ownPage = (await one(`select public.coaching_mark_paid('${bk}', 'cs_vom_coach_gebaut', 'pi_1', 2750, 'acct_k2test') as r`)).r;
                check("Selbst gebaute Bezahlseite des Coaches zählt nicht (Gebühr nicht umgehbar)", ownPage === "erstatten", ownPage);
                const paid1 = (await one(`select public.coaching_mark_paid('${bk}', 'cs_gsra1', 'pi_1', 2750, 'acct_k2test') as r`)).r;
                const paid2 = (await one(`select public.coaching_mark_paid('${bk}', 'cs_gsra1', 'pi_1', 2750, 'acct_k2test') as r`)).r;
                check("Zahlung verbucht, doppelte Meldung nur einmal", paid1 === "bezahlt" && paid2 === "schon_verbucht", `${paid1}/${paid2}`);

                await as(K, async () => {
                    const c = await q(`select public.coaching_cancel('${bk}')`);
                    check("Bezahltes Coaching nicht ohne Erstattung stornierbar", c.error !== null, c.error || "durchgelassen!");
                });
                await as(K2, async () => {
                    const move = await q(`select public.coaching_set_time('${bk}', now() + interval '5 days')`);
                    check("Nach der Bezahlung kein Verschieben (Stornofrist bleibt fair)", move.error !== null, move.error || "durchgelassen!");
                    const done = await q(`select public.coaching_mark_done('${bk}')`);
                    check("Erledigt erst ab dem Termin", done.error !== null, done.error || "durchgelassen!");
                });
                const early = await q(`select public.coaching_refund_info('${bk}', '${K}') as r`);
                check("Käufer storniert 2 Tage vorher: Erstattung erlaubt", early.error === null && early.rows[0]?.r?.payment_intent === "pi_1", early.error || JSON.stringify(early.rows[0]?.r));
                await db.exec(`update public.coaching_bookings set scheduled_at = now() + interval '10 hours' where id = '${bk}'`);
                const late = await q(`select public.coaching_refund_info('${bk}', '${K}')`);
                check("Weniger als 24 Stunden vorher: keine kostenlose Stornierung", /24 Stunden/.test(late.error || ""), late.error || "durchgelassen!");
                const byCoach = await q(`select public.coaching_refund_info('${bk}', '${K2}') as r`);
                check("Coach sagt ab: Erstattung immer möglich", byCoach.error === null && byCoach.rows[0]?.r?.by === "coach", byCoach.error || JSON.stringify(byCoach.rows[0]?.r));
                const other = await q(`select public.coaching_refund_info('${bk}', '${U.lena}')`);
                check("Fremde können nichts erstatten", other.error !== null, other.error || "durchgelassen!");
                await db.exec(`select public.coaching_mark_refunded('pi_1', '${K2}')`);
                const st = await one(`select status, refunded_at is not null as r from public.coaching_bookings where id = '${bk}'`);
                check("Erstattung verbucht", st?.status === "erstattet" && st?.r === true, JSON.stringify(st));
                const late2 = (await one(`select public.coaching_mark_paid('${bk}', 'cs_gsra1', 'pi_2', 2750, 'acct_k2test') as r`)).r;
                check("Zahlung für eine erledigte/erstattete Anfrage wird zurückerstattet", late2 === "erstatten", late2);

                // Erledigt: zweite Anfrage, bezahlt, Termin vorbei
                await as(K2, async () => { await q(`select public.coaching_save_offer('${offer2Id}', 'Setup-Beratung', null, 'Setup', 'ACC', 60, 2500, true)`); });
                await as(K3, async () => { await q(`select public.coaching_book('${offer2Id}')`); });
                const bk3 = (await one(`select id, total_cents from public.coaching_bookings where buyer_id = '${K3}' and offer_id = '${offer2Id}'`));
                await as(K2, async () => { await q(`select public.coaching_respond('${bk3?.id}', true, now() + interval '3 days')`); });
                await db.exec(`select public.coaching_checkout_started('${bk3?.id}', 'cs_gsra3')`);
                await db.exec(`select public.coaching_mark_paid('${bk3?.id}', 'cs_gsra3', 'pi_3', ${bk3?.total_cents}, 'acct_k2test')`);
                await db.exec(`update public.coaching_bookings set scheduled_at = now() - interval '2 hours' where id = '${bk3?.id}'`);
                await as(K3, async () => {
                    const r = await q(`select public.coaching_mark_done('${bk3?.id}')`);
                    check("Nur der Coach meldet „erledigt“", r.error !== null, r.error || "durchgelassen!");
                });
                await as(K2, async () => {
                    const r = await q(`select public.coaching_mark_done('${bk3?.id}')`);
                    check("Coach meldet nach dem Termin „erledigt“", r.error === null, r.error || "");
                    const rep = await q(`select public.profile_reputation('${K2}') as r`);
                    check("Profil zählt erledigte Coachings", rep.rows[0]?.r?.coaching?.erledigt === 1, rep.error || JSON.stringify(rep.rows[0]?.r?.coaching));
                });
                await as(null, async () => {
                    const r = await q(`select count(*) as n from public.coach_payout_accounts`);
                    const f = await q(`select public.coach_payment_ready('${K2}')`);
                    check("Gäste: keine Auszahlungskonten, keine Abfrage", (r.error !== null || Number(r.rows[0]?.n) === 0) && f.error !== null, r.error || f.error || "durchgelassen!");
                });

                // --- 026: Coach-Lizenz statt Abo (3 Monate, 25 Setup-Punkte, 5 Bewertungen mit Ø Ideal, sauberes Verhalten) ---
                if (LIZENZ_SQL) {
                    await db.exec(readFileSync(LIZENZ_SQL, "utf8"));
                    const ctl26 = await db.exec(readFileSync(LIZENZ_SQL, "utf8")); // zweiter Lauf
                    const rows26 = ctl26[ctl26.length - 1].rows;
                    console.log("Kontrolle 026:\n  " + rows26.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                    check("Kontrolle 026: Lizenzen, Angebote, automatischer Entzug", rows26.map(r => r.ergebnis).join(",") === "bereit,bereit,2 von 2", rows26.map(r => r.ergebnis).join(", "));

                    await as(K, async () => {
                        const seen = await q(`select count(*) as n from public.coaching_offers where coach_id = '${K2}'`);
                        check("Ohne Lizenz: Angebote eines Pole-Coaches nicht mehr sichtbar", Number(seen.rows[0]?.n) === 0, seen.error || String(seen.rows[0]?.n));
                        const book = await q(`select public.coaching_book('${offer2Id}')`);
                        check("Ohne Lizenz nicht buchbar", /keine Coachings an/.test(book.error || ""), book.error || "durchgelassen!");
                        const other = await q(`select public.coach_license_status('${K2}') as r`);
                        check("Fremde sehen nur „Lizenz ja/nein“, keinen Fortschritt", other.rows[0]?.r?.aktiv === false && other.rows[0]?.r?.fortschritt === undefined, other.error || JSON.stringify(other.rows[0]?.r));
                    });
                    await as(K2, async () => {
                        const save = await q(`select public.coaching_save_offer(null, 'Neues Angebot', null, 'Setup', null, 60, 2000, true)`);
                        check("Pole allein reicht nicht mehr zum Anbieten", /Coach-Lizenz/.test(save.error || ""), save.error || "durchgelassen!");
                        const st = await q(`select public.coach_license_status('${K2}') as r`);
                        const r = st.rows[0]?.r;
                        check("Eigener Fortschritt mit Regeln sichtbar", r?.fortschritt?.alle === false && r?.regeln?.setup_punkte === 25 && r?.regeln?.mitglied_tage === 90, st.error || JSON.stringify(r));
                        const claim = await q(`select public.coach_claim_license()`);
                        check("Lizenz erst, wenn alle Voraussetzungen erfüllt sind", /noch nicht alle/.test(claim.error || ""), claim.error || "durchgelassen!");
                        const ins = await q(`insert into public.coach_licenses (user_id, granted_at) values ('${K2}', now())`);
                        check("Lizenz nicht selbst eintragbar", ins.error !== null, ins.error || "durchgelassen!");
                    });

                    // K3 erfüllt alles: 100 Tage dabei, Setup mit 30 − 2 = 28 Punkten, 5 Bewertungen (4× Ideal, 1× In Ordnung → Ø 2,8)
                    await db.exec(`update auth.users set created_at = now() - interval '100 days' where id = '${K3}'`);
                    const S3 = (await one(`insert into public.setups (simulation, car_model, track_name, file_name, file_url, uploader_id, likes, dislikes) values ('ACC', 'Audi R8', 'Spa', 'k3.json', 'https://x.supabase.co/storage/v1/object/public/setups/${K3}/k3.json', '${K3}', 30, 2) returning id::text as id`)).id;
                    const reviewers = [U.anna, U.max, U.lena, U.tim, U.seller];
                    for (const [i, rid] of reviewers.entries()) {
                        await db.exec(`insert into public.setup_reviews (setup_id, user_id, verdict) values ('${S3}', '${rid}', '${i === 4 ? "in_ordnung" : "ideal"}')`);
                    }
                    await as(K3, async () => {
                        const st = (await q(`select public.coach_license_status('${K3}') as r`)).rows[0]?.r;
                        check("Voraussetzungen erfüllt (Dauer, Punkte, Bewertungen, Verhalten)", st?.fortschritt?.alle === true && st?.fortschritt?.setup_punkte === 28 && Number(st?.fortschritt?.schnitt) === 2.8, JSON.stringify(st?.fortschritt));
                        const claim = await q(`select public.coach_claim_license() as r`);
                        check("Lizenz geholt – ohne Abo", claim.rows[0]?.r === "erteilt", claim.error || claim.rows[0]?.r);
                        const offer = await q(`select public.coaching_save_offer(null, 'Spa ohne Abo', null, 'Fahrtechnik', 'ACC', 60, 3000, true) as id`);
                        check("Mit Lizenz: Angebot anlegen", offer.error === null, offer.error || "");
                    });
                    const k3Offer = (await one(`select id from public.coaching_offers where coach_id = '${K3}'`))?.id;
                    await as(K, async () => {
                        const seen = await q(`select count(*) as n from public.coaching_offers where coach_id = '${K3}'`);
                        const rep = await q(`select public.profile_reputation('${K3}') as r`);
                        check("Angebot des lizenzierten Coaches sichtbar, Profil zeigt die Lizenz", Number(seen.rows[0]?.n) === 1 && rep.rows[0]?.r?.coaching?.lizenz === true, seen.error || rep.error || JSON.stringify(rep.rows[0]?.r?.coaching));
                        const b = await q(`select public.coaching_book('${k3Offer}') as r`);
                        check("Lizenzierter Coach ist buchbar", b.error === null, b.error || "");
                    });

                    // Automatischer Entzug bei einer Verwarnung: Angebote pausiert, Bezahlen gesperrt, Protokoll
                    const kBooking = (await one(`select id from public.coaching_bookings where buyer_id = '${K}' and offer_id = '${k3Offer}'`))?.id;
                    await as(K3, async () => { await q(`select public.coaching_respond('${kBooking}', true, now() + interval '3 days')`); });
                    await db.exec(`insert into public.coach_payout_accounts (user_id, stripe_account_id, charges_enabled, details_submitted) values ('${K3}', 'acct_k3test', true, true)`);
                    await db.exec(`insert into public.user_warnings (user_id, text) values ('${K3}', 'Bitte freundlich bleiben')`);
                    const lic = await one(`select revoked_at is not null as weg, auto_revoked, revoked_reason from public.coach_licenses where user_id = '${K3}'`);
                    const paused = await one(`select active from public.coaching_offers where id = '${k3Offer}'`);
                    check("Verwarnung entzieht die Lizenz automatisch und pausiert die Angebote", lic?.weg === true && lic?.auto_revoked === true && paused?.active === false, JSON.stringify({ lic, paused }));
                    const blocked = await q(`select public.coaching_checkout_info('${kBooking}', '${K}')`);
                    check("Nach dem Entzug kein Bezahlen mehr", /keine Coachings an/.test(blocked.error || ""), blocked.error || "durchgelassen!");
                    await as(K3, async () => {
                        const again = await q(`select public.coach_claim_license()`);
                        check("Nach Verwarnung erst nach 90 Tagen wieder erhältlich", /noch nicht alle/.test(again.error || ""), again.error || "durchgelassen!");
                        const reactivate = await q(`select public.coaching_save_offer('${k3Offer}', 'Spa ohne Abo', null, 'Fahrtechnik', 'ACC', 60, 3000, true)`);
                        check("Pausiertes Angebot ohne Lizenz nicht wieder aktivierbar", /Coach-Lizenz/.test(reactivate.error || ""), reactivate.error || "durchgelassen!");
                    });

                    // Moderation: wiederherstellen und mit Begründung entziehen (beides im Protokoll)
                    await withClaims(K3, "aal2", async () => {
                        const self = await q(`select public.coach_license_restore('${K3}')`);
                        check("Nur das Moderationsteam stellt Lizenzen wieder her", /Moderationsteam/.test(self.error || ""), self.error || "durchgelassen!");
                    });
                    await withClaims(MOD, "aal2", async () => {
                        const restore = await q(`select public.coach_license_restore('${K3}')`);
                        const active = await q(`select public.coach_license_active('${K3}') as r`);
                        check("Moderator stellt die Lizenz wieder her", restore.error === null && active.rows[0]?.r === true, restore.error || String(active.rows[0]?.r));
                        const noReason = await q(`select public.coach_license_revoke('${K3}', '')`);
                        check("Entzug nur mit Begründung", /Begründung/.test(noReason.error || ""), noReason.error || "durchgelassen!");
                        const revoke = await q(`select public.coach_license_revoke('${K3}', 'Mehrfach Termine nicht eingehalten')`);
                        check("Moderator entzieht die Lizenz mit Begründung", revoke.error === null, revoke.error || "");
                    });
                    await as(K3, async () => {
                        const claim = await q(`select public.coach_claim_license()`);
                        check("Von der Moderation entzogen: nicht selbst zurückholbar", /Moderationsteam entzogen/.test(claim.error || ""), claim.error || "durchgelassen!");
                        const own = await q(`select revoked_reason from public.coach_licenses`);
                        check("Coach sieht die Begründung", own.rows[0]?.revoked_reason === "Mehrfach Termine nicht eingehalten", own.error || JSON.stringify(own.rows));
                    });
                    const logged = await one(`select count(*) filter (where action = 'coach_lizenz_automatisch') as a, count(*) filter (where action = 'coach_lizenz_entzogen') as e,
                        count(*) filter (where action = 'coach_lizenz_wiederhergestellt') as w, count(*) filter (where action = 'coach_lizenz_erteilt') as g from public.moderation_log`);
                    check("Protokoll: erteilt, automatisch entzogen, wiederhergestellt, entzogen", [logged.g, logged.a, logged.w, logged.e].every(n => Number(n) === 1), JSON.stringify(logged));
                    // Gesperrt = keine aktive Lizenz, auch wenn sie erteilt ist
                    await withClaims(MOD, "aal2", async () => { await q(`select public.coach_license_restore('${K3}')`); });
                    await db.exec(`insert into public.user_bans (user_id, banned_until, reason) values ('${K3}', now() + interval '7 days', 'Test')`);
                    const banned = await one(`select public.coach_license_active('${K3}') as r`);
                    check("Sperre beendet die Lizenz sofort", banned.r === false, String(banned.r));
                    await as(null, async () => {
                        const r = await q(`select count(*) as n from public.coach_licenses`);
                        const f = await q(`select public.coach_license_status('${K3}')`);
                        check("Gäste: keine Lizenzdaten", (r.error !== null || Number(r.rows[0]?.n) === 0) && f.error !== null, r.error || f.error || "durchgelassen!");
                    });

                    // --- 027: Coach-Bewertungen und Pro-Coaches ---
                    if (PRO_SQL) {
                        await db.exec(readFileSync(PRO_SQL, "utf8"));
                        const ctl27 = await db.exec(readFileSync(PRO_SQL, "utf8")); // zweiter Lauf
                        const rows27 = ctl27[ctl27.length - 1].rows;
                        console.log("Kontrolle 027:\n  " + rows27.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                        check("Kontrolle 027: Bewertungen, Pro-Coaches, Protokoll", rows27.map(r => r.ergebnis).join(",") === "bereit,bereit,2 von 2", rows27.map(r => r.ergebnis).join(", "));

                        // K3 hat bei K2 ein erledigtes Coaching (bk3), K hat bei K3 ein nur angenommenes (kBooking)
                        await as(K3, async () => {
                            const banned = await q(`select public.review_coaching('${bk3?.id}', 1)`);
                            check("Gesperrte Konten bewerten nicht", /gesperrt/.test(banned.error || ""), banned.error || "durchgelassen!");
                        });
                        await db.exec(`update public.user_bans set lifted_at = now() where user_id = '${K3}'`); // Testsperre aus 026 aufheben
                        await as(K3, async () => {
                            const r = await q(`select public.review_coaching('${bk3?.id}', 1, array['kompetent', 'puenktlich', 'unsinn'], 'Sehr hilfreich, endlich schneller in Eau Rouge')`);
                            check("Käufer bewertet sein erledigtes Coaching", r.error === null, r.error || "");
                            const again = await q(`select public.review_coaching('${bk3?.id}', 0, array['puenktlich'], 'Doch eher solide')`);
                            const n = await q(`select count(*) as n, max(rating) as r, max(array_to_string(tags, ',')) as t from public.coaching_reviews where booking_id = '${bk3?.id}'`);
                            check("Eine Bewertung pro Coaching, änderbar; unbekannte Merkmale verworfen", again.error === null && Number(n.rows[0]?.n) === 1 && Number(n.rows[0]?.r) === 0 && n.rows[0]?.t === "puenktlich", again.error || JSON.stringify(n.rows[0]));
                            const direct = await q(`insert into public.coaching_reviews (booking_id, coach_id, buyer_id, rating) values ('${bk3?.id}', '${K2}', '${K3}', 1)`);
                            check("Bewertungen nicht direkt eintragbar", direct.error !== null, direct.error || "durchgelassen!");
                        });
                        await as(K, async () => {
                            const foreign = await q(`select public.review_coaching('${bk3?.id}', -2)`);
                            check("Fremde Coachings nicht bewertbar", /selbst gebucht/.test(foreign.error || ""), foreign.error || "durchgelassen!");
                            const early = await q(`select public.review_coaching('${kBooking}', 1)`);
                            check("Erst nach dem Termin eines bezahlten Coachings bewertbar", /Termin vorbei/.test(early.error || ""), early.error || "durchgelassen!");
                            const read = await q(`select count(*) as n from public.coaching_reviews where coach_id = '${K2}'`);
                            const rep = await q(`select public.profile_reputation('${K2}') as r`);
                            const c = rep.rows[0]?.r?.coaching;
                            check("Mitglieder sehen die Coach-Zufriedenheit (Profil und Karte)", Number(read.rows[0]?.n) === 1 && c?.anzahl === 1 && c?.in_ordnung === 1 && c?.puenktlich === 1, read.error || rep.error || JSON.stringify(c));
                        });
                        await withClaims(MOD, "aal2", async () => {
                            const del = await q(`delete from public.coaching_reviews where booking_id = '${bk3?.id}' returning id`);
                            check("Moderator entfernt eine Bewertung", del.rows.length === 1, del.error || "nichts gelöscht");
                        });
                        const reviewLog = await one(`select count(*) as n from public.moderation_log where action = 'coaching_bewertung_geloescht'`);
                        check("Protokolleintrag zur entfernten Bewertung", Number(reviewLog.n) === 1, String(reviewLog.n));

                        // Pro-Coach: Anna wird von einem Admin zur Pro-Fahrerin gemacht
                        const before = (await one(`select public.coach_license_active('${U.anna}') as r`)).r;
                        await as(K, async () => {
                            const self = await q(`insert into public.pro_creators (user_id) values ('${K}')`);
                            check("Mitglieder machen sich nicht selbst zum Pro", self.error !== null, self.error || "durchgelassen!");
                        });
                        await withClaims(U.admin, "aal2", async () => {
                            const add = await q(`insert into public.pro_creators (user_id, added_by) values ('${U.anna}', '${K}') returning added_by`);
                            check("Admin trägt Pro-Fahrerin ein (eintragende Person setzt die Datenbank)", add.error === null && add.rows[0]?.added_by === U.admin, add.error || JSON.stringify(add.rows[0]));
                        });
                        const after = (await one(`select public.coach_license_active('${U.anna}') as r`)).r;
                        check("Pro-Fahrer coachen ohne Lizenz", before === false && after === true, `${before} → ${after}`);
                        await as(U.anna, async () => {
                            const o = await q(`select public.coaching_save_offer(null, 'Pro-Coaching Nordschleife', null, 'Fahrtechnik', 'iRacing', 120, 9900, true)`);
                            const st = await q(`select public.coach_license_status('${U.anna}') as r`);
                            check("Pro-Coach legt Angebot an und sieht „Pro“", o.error === null && st.rows[0]?.r?.pro === true && st.rows[0]?.r?.aktiv === true, o.error || st.error || JSON.stringify(st.rows[0]?.r));
                        });
                        await db.exec(`insert into public.user_warnings (user_id, text) values ('${U.anna}', 'Test')`);
                        const stopped = await one(`select public.coach_license_active('${U.anna}') as r, (select count(*) from public.coaching_offers where coach_id = '${U.anna}' and active) as n`);
                        check("Verwarnung stoppt auch Pro-Coaches (Angebote pausiert)", stopped.r === false && Number(stopped.n) === 0, JSON.stringify(stopped));
                        await withClaims(MOD, "aal2", async () => { await q(`select public.coach_license_restore('${U.anna}')`); });
                        const back = (await one(`select public.coach_license_active('${U.anna}') as r`)).r;
                        check("Moderation hebt den Stopp auf", back === true, String(back));
                        await withClaims(U.admin, "aal2", async () => {
                            const rm = await q(`delete from public.pro_creators where user_id = '${U.anna}' returning user_id`);
                            check("Admin entfernt Pro-Fahrerin", rm.rows.length === 1, rm.error || "nichts entfernt");
                        });
                        const proLog = await one(`select count(*) filter (where action = 'pro_fahrer_hinzugefuegt') as a, count(*) filter (where action = 'pro_fahrer_entfernt') as e from public.moderation_log where target_user = '${U.anna}'`);
                        const gone = (await one(`select public.coach_license_active('${U.anna}') as r`)).r;
                        check("Pro-Liste im Protokoll, ohne Pro und Lizenz kein Coaching", Number(proLog.a) === 1 && Number(proLog.e) === 1 && gone === false, JSON.stringify({ proLog, gone }));
                        await as(null, async () => {
                            const r = await q(`select count(*) as n from public.coaching_reviews`);
                            const f = await q(`select public.review_coaching('${bk3?.id}', 1)`);
                            check("Gäste: keine Coach-Bewertungen", (r.error !== null || Number(r.rows[0]?.n) === 0) && f.error !== null, r.error || f.error || "durchgelassen!");
                        });

                        // --- 028: Rolle „moderator“ in der alten Rollen-Regel der echten Datenbank ---
                        if (ROLLE_SQL) {
                            // Nachbau der alten Regel (nur user/admin), die live den Fehler auslöste
                            await db.exec(`alter table public.profiles drop constraint if exists profiles_role_check;
                                alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin')) not valid`);
                            await withClaims(U.admin, "aal2", async () => {
                                const broken = await q(`select public.admin_set_role(900011, 'moderator')`);
                                check("Vorher: Moderator ernennen scheitert an profiles_role_check (wie live)", /profiles_role_check/.test(broken.error || ""), broken.error || "kein Fehler");
                            });
                            await db.exec(readFileSync(ROLLE_SQL, "utf8"));
                            const ctl28 = await db.exec(readFileSync(ROLLE_SQL, "utf8")); // zweiter Lauf
                            const rows28 = ctl28[ctl28.length - 1].rows;
                            console.log("Kontrolle 028:\n  " + rows28.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                            check("Kontrolle 028: Rolle „moderator“ erlaubt", rows28[0]?.ergebnis === "bereit", rows28.map(r => r.ergebnis).join(", "));
                            await withClaims(U.admin, "aal2", async () => {
                                const set = await q(`select public.admin_set_role(900011, 'moderator') as name`);
                                const role = await q(`select role from public.profiles where gsra_id = 900011`);
                                const back = await q(`select public.admin_set_role(900011, 'user')`);
                                const role2 = await q(`select role from public.profiles where gsra_id = 900011`);
                                check("Nachher: Admin ernennt Moderator und entzieht die Rolle wieder", set.error === null && role.rows[0]?.role === "moderator" && back.error === null && role2.rows[0]?.role === "user",
                                    set.error || back.error || `${role.rows[0]?.role} → ${role2.rows[0]?.role}`);
                            });
                            await withClaims(MOD, "aal2", async () => {
                                const r = await q(`select public.admin_set_role(900011, 'moderator')`);
                                check("Moderatoren ernennen keine Moderatoren", /Nur für Administratoren/.test(r.error || ""), r.error || "durchgelassen!");
                            });
                            const bogus = await q(`update public.profiles set role = 'superheld' where gsra_id = 900011`);
                            check("Unbekannte Rollen bleiben ausgeschlossen", /profiles_role_check/.test(bogus.error || ""), bogus.error || "durchgelassen!");
                        }

                        // --- 029: Nation und Sprachen im Profil ---
                        if (SPRACHEN_SQL) {
                            await db.exec(readFileSync(SPRACHEN_SQL, "utf8"));
                            const ctl29 = await db.exec(readFileSync(SPRACHEN_SQL, "utf8")); // zweiter Lauf
                            const rows29 = ctl29[ctl29.length - 1].rows;
                            console.log("Kontrolle 029:\n  " + rows29.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                            check("Kontrolle 029: Spalten und Prüfregeln", rows29.map(r => r.ergebnis).join(",") === "2 von 2,2 von 2", rows29.map(r => r.ergebnis).join(", "));
                            await as(K3, async () => {
                                const ok = await q(`update public.profiles set country = 'DE', languages = array['de', 'en'] where id = '${K3}' returning country, languages`);
                                check("Eigene Nation und Sprachen speichern", ok.error === null && ok.rows[0]?.country === "DE" && ok.rows[0]?.languages?.join(",") === "de,en", ok.error || JSON.stringify(ok.rows[0]));
                                const badCountry = await q(`update public.profiles set country = 'Deutschland' where id = '${K3}'`);
                                const badLang = await q(`update public.profiles set languages = array['klingonisch'] where id = '${K3}'`);
                                check("Nur gültige Ländercodes und bekannte Sprachen", badCountry.error !== null && badLang.error !== null, badCountry.error || badLang.error || "durchgelassen!");
                                const other = await q(`update public.profiles set country = 'FR' where id = '${K2}' returning id`);
                                check("Fremde Profile nicht änderbar", other.error !== null || other.rows.length === 0, other.error || (other.rows.length ? "geändert!" : "0 Zeilen geändert"));
                                const role = await q(`update public.profiles set role = 'admin', country = 'AT' where id = '${K3}' returning role, country`);
                                check("Rolle bleibt beim Speichern geschützt", role.rows[0]?.role !== "admin", role.error || JSON.stringify(role.rows[0]));
                            });
                            await as(K, async () => {
                                const seen = await q(`select country, languages from public.profiles where id = '${K3}'`);
                                check("Mitglieder sehen Nation und Sprachen", seen.rows[0]?.country === "AT" && seen.rows[0]?.languages?.length === 2, seen.error || JSON.stringify(seen.rows[0]));
                            });
                        }

                        // --- 030: Verfügbarkeitskalender für Coaches ---
                        if (KALENDER_SQL) {
                            await db.exec(readFileSync(KALENDER_SQL, "utf8"));
                            const ctl30 = await db.exec(readFileSync(KALENDER_SQL, "utf8")); // zweiter Lauf
                            const rows30 = ctl30[ctl30.length - 1].rows;
                            console.log("Kontrolle 030:\n  " + rows30.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                            check("Kontrolle 030: Tabellen geschützt, Funktionen bereit, Internes nicht aufrufbar", rows30.map(r => r.ergebnis).join(",") === "3 von 3,bereit,ja", rows30.map(r => r.ergebnis).join(", "));

                            // Max wird Pro-Coach und bietet 60 Minuten an; Zeiten: jeden Tag 18–22 Uhr (Berlin), ein Tag gesperrt
                            await withClaims(U.admin, "aal2", async () => { await q(`insert into public.pro_creators (user_id) values ('${U.max}')`); });
                            let maxOffer = null;
                            await as(U.max, async () => {
                                maxOffer = (await q(`select public.coaching_save_offer(null, 'Kalender-Coaching Spa', null, 'Fahrtechnik', 'iRacing', 60, 3000, true) as id`)).rows[0]?.id;
                            });
                            check("Kalender-Test: Coach mit Angebot", Boolean(maxOffer), String(maxOffer));
                            const WIN = JSON.stringify([1, 2, 3, 4, 5, 6, 7].map(t => ({ tag: t, von: 1080, bis: 1320 })));
                            const BLOCKED = `(now() at time zone 'Europe/Berlin')::date + 3`;
                            await as(K, async () => {
                                const r = await q(`select public.coach_save_calendar('Europe/Berlin', '${WIN}'::jsonb)`);
                                check("Ohne Coach-Lizenz kein Kalender", /Coach-Lizenz/.test(r.error || ""), r.error || "durchgelassen!");
                            });
                            await as(U.max, async () => {
                                const overlap = await q(`select public.coach_save_calendar('Europe/Berlin', '[{"tag":1,"von":1080,"bis":1200},{"tag":1,"von":1140,"bis":1260}]'::jsonb)`);
                                const tz = await q(`select public.coach_save_calendar('Mars/Olympus', '${WIN}'::jsonb)`);
                                const odd = await q(`select public.coach_save_calendar('Europe/Berlin', '[{"tag":1,"von":1081,"bis":1200}]'::jsonb)`);
                                const day = await q(`select public.coach_save_calendar('Europe/Berlin', '[{"tag":8,"von":1080,"bis":1200}]'::jsonb)`);
                                check("Ungültige Zeiten abgelehnt (Überschneidung, Zeitzone, Viertelstunden, Wochentag)",
                                    /überschneiden/.test(overlap.error || "") && /Zeitzone/.test(tz.error || "") && /30 Minuten/.test(odd.error || "") && /ungültig/.test(day.error || ""),
                                    [overlap.error, tz.error, odd.error, day.error].join(" | "));
                                const ok = await q(`select public.coach_save_calendar('Europe/Berlin', '${WIN}'::jsonb, array[${BLOCKED}]) as r`);
                                check("Coach speichert Zeiten und einen gesperrten Tag", ok.rows[0]?.r?.fenster === 7 && ok.rows[0]?.r?.gesperrt === 1, ok.error || JSON.stringify(ok.rows[0]?.r));
                                const direct = await q(`insert into public.coach_availability (coach_id, weekday, start_min, end_min) values ('${U.max}', 1, 0, 60)`);
                                check("Zeiten nicht direkt eintragbar", direct.error !== null, direct.error || "durchgelassen!");
                                const own = await q(`select count(*) as n from public.coach_availability`);
                                check("Coach sieht seine Zeiten", Number(own.rows[0]?.n) === 7, own.error || String(own.rows[0]?.n));
                            });

                            let slots = [];
                            await as(K, async () => {
                                const seen = await q(`select count(*) as n from public.coach_availability`);
                                check("Andere sehen die Zeiten nicht direkt", Number(seen.rows[0]?.n) === 0, seen.error || String(seen.rows[0]?.n));
                                const fs = await q(`select public.coaching_free_slots('${maxOffer}') as r`);
                                slots = fs.rows[0]?.r?.slots || [];
                                check("Kunde sieht freie Termine", fs.rows[0]?.r?.kalender === true && slots.length > 20, fs.error || JSON.stringify(fs.rows[0]?.r).slice(0, 200));
                                const v = await q(`select count(*) filter (where s < now() + interval '24 hours') as zu_frueh,
                                        count(*) filter (where (s at time zone 'Europe/Berlin')::time not between '18:00' and '21:00'
                                                           or extract(minute from (s at time zone 'Europe/Berlin')) not in (0, 30)) as ausserhalb,
                                        count(*) filter (where (s at time zone 'Europe/Berlin')::date = ${BLOCKED}) as gesperrt
                                    from jsonb_array_elements_text((public.coaching_free_slots('${maxOffer}'))->'slots') t(v), lateral (select v::timestamptz as s) x`);
                                const r = v.rows[0] || {};
                                check("Termine nur 24 h voraus, im Zeitfenster (60 Min. passen bis 21 Uhr), nicht am gesperrten Tag",
                                    Number(r.zu_frueh) === 0 && Number(r.ausserhalb) === 0 && Number(r.gesperrt) === 0, v.error || JSON.stringify(r));
                                const old = await q(`select public.coaching_book('${maxOffer}', 'Hallo', 'Samstag abends')`);
                                check("Mit Kalender kein Wunschtermin per Text", /freien Termin/.test(old.error || ""), old.error || "durchgelassen!");
                                const wrong = await q(`select public.coaching_book_at('${maxOffer}', date_trunc('day', now() + interval '3 days') + interval '10 hours')`);
                                check("Termin außerhalb der Zeiten abgelehnt", /nicht mehr frei/.test(wrong.error || ""), wrong.error || "durchgelassen!");
                                const ok = await q(`select public.coaching_book_at('${maxOffer}', '${slots[0]}'::timestamptz, 'Bitte Spa') as r`);
                                check("Kunde bucht einen freien Termin", ok.error === null && new Date(ok.rows[0]?.r?.scheduled_at).getTime() === new Date(slots[0]).getTime(), ok.error || JSON.stringify(ok.rows[0]?.r));
                            });
                            let slot2 = null;
                            await as(U.tim, async () => {
                                const same = await q(`select public.coaching_book_at('${maxOffer}', '${slots[0]}'::timestamptz)`);
                                const half = await q(`select public.coaching_book_at('${maxOffer}', '${slots[0]}'::timestamptz + interval '30 minutes')`);
                                check("Keine Doppelbelegung (gleiche oder überlappende Zeit)", /nicht mehr frei/.test(same.error || "") && /nicht mehr frei/.test(half.error || ""), same.error || half.error || "durchgelassen!");
                                const fs = await q(`select public.coaching_free_slots('${maxOffer}') as r`);
                                const left = (fs.rows[0]?.r?.slots || []).map(s => new Date(s).getTime());
                                const t0 = new Date(slots[0]).getTime();
                                check("Belegte Zeit verschwindet aus den freien Terminen", !left.includes(t0) && !left.includes(t0 + 30 * 60000) && !left.includes(t0 - 30 * 60000), fs.error || "");
                                slot2 = (fs.rows[0]?.r?.slots || [])[0];
                                const ok = await q(`select public.coaching_book_at('${maxOffer}', '${slot2}'::timestamptz)`);
                                check("Zweiter Kunde bucht einen anderen freien Termin", ok.error === null, ok.error || "");
                            });
                            const kb = await one(`select id from public.coaching_bookings where buyer_id = '${K}' and offer_id = '${maxOffer}'`);
                            const tb = await one(`select id from public.coaching_bookings where buyer_id = '${U.tim}' and offer_id = '${maxOffer}'`);
                            await as(U.max, async () => {
                                const clash = await q(`select public.coaching_respond('${tb?.id}', true, '${slots[0]}'::timestamptz)`);
                                check("Annehmen zu einer schon belegten Zeit abgelehnt", /schon ein anderes Coaching/.test(clash.error || ""), clash.error || "durchgelassen!");
                                const acc = await q(`select public.coaching_respond('${kb?.id}', true)`);
                                check("Coach nimmt den gewählten Termin mit einem Klick an", acc.error === null, acc.error || "");
                                const acc2 = await q(`select public.coaching_respond('${tb?.id}', true)`);
                                check("Zweite Anfrage ebenfalls angenommen", acc2.error === null, acc2.error || "");
                                const move = await q(`select public.coaching_set_time('${kb?.id}', '${slot2}'::timestamptz)`);
                                check("Verschieben auf eine belegte Zeit abgelehnt", /schon ein anderes Coaching/.test(move.error || ""), move.error || "durchgelassen!");
                            });
                            const kept = await one(`select scheduled_at = '${slots[0]}'::timestamptz as same, status from public.coaching_bookings where id = '${kb?.id}'`);
                            check("Termin aus dem Kalender bleibt erhalten", kept?.same === true && kept?.status === "angenommen", JSON.stringify(kept));

                            // Lange Coachings: 3 Stunden ab 18 Uhr belegen 18–21 Uhr – für alle Angebote desselben Coaches
                            let longOffer = null;
                            await as(U.max, async () => {
                                longOffer = (await q(`select public.coaching_save_offer(null, 'Langes Coaching Le Mans', null, 'Fahrtechnik', 'iRacing', 180, 9000, true) as id`)).rows[0]?.id;
                            });
                            let long = [];
                            await as(U.tim, async () => {
                                const fs = await q(`select public.coaching_free_slots('${longOffer}') as r`);
                                long = fs.rows[0]?.r?.slots || [];
                                const late = long.filter(s => {
                                    const [h, m] = new Date(s).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour12: false }).split(":").map(Number);
                                    return h * 60 + m > 19 * 60; // Fenster 18–22 Uhr: 3 Stunden passen nur bis Start 19:00
                                });
                                check("3-Stunden-Angebot: nur Startzeiten, bei denen alle 3 Stunden ins Zeitfenster passen", long.length > 0 && late.length === 0, fs.error || JSON.stringify(late.slice(0, 3)));
                                const busy = [slots[0], slot2].map(s => new Date(s).getTime());
                                const clash = long.filter(s => { const t = new Date(s).getTime(); return busy.some(b => t < b + 60 * 60000 && b < t + 180 * 60000); });
                                check("3-Stunden-Termine überschneiden keine bestehende Buchung", clash.length === 0, JSON.stringify(clash));
                                const ok = await q(`select public.coaching_book_at('${longOffer}', '${long[0]}'::timestamptz)`);
                                check("Kunde fragt 3 Stunden an", ok.error === null, ok.error || "");
                            });
                            await as(K3, async () => {
                                const t = new Date(long[0]).getTime();
                                const free60 = ((await q(`select public.coaching_free_slots('${maxOffer}') as r`)).rows[0]?.r?.slots || []).map(s => new Date(s).getTime());
                                const free180 = ((await q(`select public.coaching_free_slots('${longOffer}') as r`)).rows[0]?.r?.slots || []).map(s => new Date(s).getTime());
                                const inside60 = free60.filter(x => x > t - 60 * 60000 && x < t + 180 * 60000);
                                const inside180 = free180.filter(x => x > t - 180 * 60000 && x < t + 180 * 60000);
                                const plus1 = await q(`select public.coaching_book_at('${maxOffer}', '${long[0]}'::timestamptz + interval '1 hour')`);
                                const plus2 = await q(`select public.coaching_book_at('${maxOffer}', '${long[0]}'::timestamptz + interval '2 hours')`);
                                check("3 Stunden angefragt → +1 h und +2 h auch beim 60-Minuten-Angebot belegt, nichts Überlappendes mehr frei",
                                    inside60.length === 0 && inside180.length === 0 && /nicht mehr frei/.test(plus1.error || "") && /nicht mehr frei/.test(plus2.error || ""),
                                    [plus1.error, plus2.error, inside60.length, inside180.length].join(" | "));
                            });
                            const tl = await one(`select id from public.coaching_bookings where buyer_id = '${U.tim}' and offer_id = '${longOffer}'`);
                            await as(U.max, async () => { await q(`select public.coaching_respond('${tl?.id}', false)`); });
                            await as(K3, async () => {
                                const again = ((await q(`select public.coaching_free_slots('${longOffer}') as r`)).rows[0]?.r?.slots || []).map(s => new Date(s).getTime());
                                check("Abgelehnte Anfrage gibt die 3 Stunden wieder frei", again.includes(new Date(long[0]).getTime()), String(again.length));
                            });

                            await as(K, async () => {
                                const list = await q(`select public.coaching_calendar_coaches() as id`);
                                check("Seite erkennt Coaches mit Kalender", list.rows.some(r => r.id === U.max), list.error || JSON.stringify(list.rows));
                            });

                            // Kalender aus: wieder Wunschtermin per Text
                            await as(U.max, async () => {
                                const off = await q(`select public.coach_save_calendar('Europe/Berlin', '[]'::jsonb) as r`);
                                check("Coach schaltet den Kalender aus (keine Zeiten)", off.rows[0]?.r?.fenster === 0, off.error || JSON.stringify(off.rows[0]?.r));
                            });
                            await as(K3, async () => {
                                const fs = await q(`select public.coaching_free_slots('${maxOffer}') as r`);
                                const at = await q(`select public.coaching_book_at('${maxOffer}', now() + interval '3 days')`);
                                const old = await q(`select public.coaching_book('${maxOffer}', null, 'Sonntag')`);
                                check("Ohne Kalender: Anfrage mit Wunschtermin wie bisher", fs.rows[0]?.r?.kalender === false && /keinen Kalender/.test(at.error || "") && old.error === null,
                                    fs.error || at.error || old.error || JSON.stringify(fs.rows[0]?.r));
                            });
                            await as(null, async () => {
                                const fs = await q(`select public.coaching_free_slots('${maxOffer}')`);
                                const save = await q(`select public.coach_save_calendar('Europe/Berlin', '[]'::jsonb)`);
                                const slotsFn = await q(`select * from public.coach_slots('${U.max}', 60, current_date, 7)`);
                                check("Gäste: keine Termine, kein Kalender, keine internen Funktionen", fs.error !== null && save.error !== null && slotsFn.error !== null, fs.error || save.error || slotsFn.error || "durchgelassen!");
                            });
                            await as(K, async () => {
                                const slotsFn = await q(`select * from public.coach_slots('${U.max}', 60, current_date, 7)`);
                                const free = await q(`select public.coach_time_free('${U.max}', now(), 60)`);
                                check("Mitglieder: interne Kalender-Funktionen gesperrt", slotsFn.error !== null && free.error !== null, slotsFn.error || free.error || "durchgelassen!");
                            });
                        }

                        // --- 031: alle Sprachen (Format statt fester Liste) ---
                        if (ALLE_SPRACHEN_SQL) {
                            await as(K3, async () => {
                                const before = await q(`update public.profiles set languages = array['sw', 'he'] where id = '${K3}'`);
                                check("Vorher: Suaheli und Hebräisch nicht erlaubt (feste Liste aus 029)", before.error !== null, before.error || "durchgelassen!");
                            });
                            await db.exec(readFileSync(ALLE_SPRACHEN_SQL, "utf8"));
                            const ctl31 = await db.exec(readFileSync(ALLE_SPRACHEN_SQL, "utf8")); // zweiter Lauf
                            const rows31 = ctl31[ctl31.length - 1].rows;
                            console.log("Kontrolle 031:\n  " + rows31.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                            check("Kontrolle 031: Sprach- und Länderregel", rows31.map(r => r.ergebnis).join(",") === "bereit,bereit", rows31.map(r => r.ergebnis).join(", "));
                            await as(K3, async () => {
                                const ok = await q(`update public.profiles set languages = array['sw', 'he', 'fa', 'de'], country = 'KE' where id = '${K3}' returning languages, country`);
                                check("Nachher: alle Sprachcodes und Länder speicherbar", ok.error === null && ok.rows[0]?.languages?.length === 4 && ok.rows[0]?.country === "KE", ok.error || JSON.stringify(ok.rows[0]));
                                const tooMany = await q(`update public.profiles set languages = array['de','en','fr','es','it','nl','pl','pt','tr'] where id = '${K3}'`);
                                const names = await q(`update public.profiles set languages = array['Deutsch'] where id = '${K3}'`);
                                const upper = await q(`update public.profiles set languages = array['DE'] where id = '${K3}'`);
                                const nul = await q(`update public.profiles set languages = array['de', null] where id = '${K3}'`);
                                const inject = await q(`update public.profiles set languages = array['de,en'] where id = '${K3}'`);
                                check("Weiterhin abgelehnt: mehr als 8, Namen, Großbuchstaben, leere Einträge, Kommas",
                                    [tooMany, names, upper, nul, inject].every(r => r.error !== null), [tooMany, names, upper, nul, inject].map(r => r.error ? "abgelehnt" : "DURCHGELASSEN").join(", "));
                                const empty = await q(`update public.profiles set languages = '{}' where id = '${K3}' returning languages`);
                                check("Keine Sprache angeben bleibt möglich", empty.error === null && empty.rows[0]?.languages?.length === 0, empty.error || JSON.stringify(empty.rows[0]));
                            });
                        }

                        // --- 032: Chat-Anhänge im privaten Speicher (Sicherheitsbericht Nr. 9) ---
                        if (ANHAENGE_SQL) {
                            // Ausgangslage: alter Anhang ohne Ordner im Direktchat Anna ↔ Max
                            await db.exec(`insert into storage.objects (bucket_id, name, owner) values ('chat_attachments', 'chat_alt_123.jpg', '${U.anna}');
                                insert into public.messages (chat_id, sender_id, text, image_url) values ('${D}', '${U.anna}', '[Medien]', 'https://x.supabase.co/storage/v1/object/public/chat_attachments/chat_alt_123.jpg')`);
                            await db.exec(readFileSync(ANHAENGE_SQL, "utf8"));
                            const ctl32 = await db.exec(readFileSync(ANHAENGE_SQL, "utf8")); // zweiter Lauf
                            const rows32 = ctl32[ctl32.length - 1].rows;
                            console.log("Kontrolle 032:\n  " + rows32.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                            check("Kontrolle 032: privat, Lesen und Hochladen nur für Chat-Mitglieder", rows32.slice(0, 3).map(r => r.ergebnis).join(",") === "ja,bereit,bereit", rows32.map(r => r.ergebnis).join(", "));
                            check("Grenzen gesetzt (50 MB, nur Medien)", /^50 MB, \d+ Dateitypen$/.test(rows32[3]?.ergebnis || ""), rows32[3]?.ergebnis);

                            const NEW = `${D}/${U.anna}/chat_neu_1.jpg`;
                            await as(U.anna, async () => {
                                const ok = await q(`insert into storage.objects (bucket_id, name, owner) values ('chat_attachments', '${NEW}', '${U.anna}') returning name`);
                                check("Mitglied lädt in den eigenen Ordner seines Chats hoch", ok.error === null && ok.rows.length === 1, ok.error || "");
                                const flat = await q(`insert into storage.objects (bucket_id, name, owner) values ('chat_attachments', 'chat_flach.jpg', '${U.anna}')`);
                                const foreignFolder = await q(`insert into storage.objects (bucket_id, name, owner) values ('chat_attachments', '${D}/${U.max}/fremd.jpg', '${U.anna}')`);
                                const foreignChat = await q(`insert into storage.objects (bucket_id, name, owner) values ('chat_attachments', '${FORUM}/${U.anna}/forum.jpg', '${U.anna}')`);
                                const junk = await q(`insert into storage.objects (bucket_id, name, owner) values ('chat_attachments', 'kein-chat/${U.anna}/x.jpg', '${U.anna}')`);
                                check("Abgelehnt: ohne Ordner, fremder Ordner, Chat ohne Schreibrecht, unsinniger Pfad",
                                    [flat, foreignFolder, foreignChat, junk].every(r => r.error !== null), [flat, foreignFolder, foreignChat, junk].map(r => r.error ? "abgelehnt" : "DURCHGELASSEN").join(", "));
                            });
                            await as(U.max, async () => {
                                const seen = await q(`select name from storage.objects where bucket_id = 'chat_attachments' order by name`);
                                const names = seen.rows.map(r => r.name);
                                check("Chat-Partner sieht neuen und alten Anhang", names.includes(NEW) && names.includes("chat_alt_123.jpg"), seen.error || JSON.stringify(names));
                            });
                            await as(U.tim, async () => {
                                const seen = await q(`select name from storage.objects where bucket_id = 'chat_attachments'`);
                                const direct = await q(`select public.chat_attachment_allowed('${NEW}') as a, public.chat_attachment_allowed('chat_alt_123.jpg') as b`);
                                check("Fremde sehen die Anhänge nicht", seen.rows.length === 0 && direct.rows[0]?.a === false && direct.rows[0]?.b === false, seen.error || JSON.stringify({ seen: seen.rows, direct: direct.rows[0] }));
                            });
                            await as(null, async () => {
                                const seen = await q(`select name from storage.objects where bucket_id = 'chat_attachments'`);
                                check("Gäste sehen keine Anhänge", seen.error !== null || seen.rows.length === 0, seen.error || JSON.stringify(seen.rows));
                            });
                            await withClaims(MOD, "aal2", async () => {
                                const seen = await q(`select count(*) as n from storage.objects where bucket_id = 'chat_attachments' and name in ('${NEW}', 'chat_alt_123.jpg')`);
                                check("Moderation sieht Anhänge (Prüfung von Meldungen)", Number(seen.rows[0]?.n) === 2, seen.error || String(seen.rows[0]?.n));
                            });
                            await withClaims(MOD, "aal1", async () => {
                                const seen = await q(`select count(*) as n from storage.objects where bucket_id = 'chat_attachments'`);
                                check("Ohne Zwei-Faktor sieht die Moderation nichts", Number(seen.rows[0]?.n) === 0, seen.error || String(seen.rows[0]?.n));
                            });
                            // Gesperrt: auch der eigene Chat ist zu
                            await db.exec(`insert into public.user_bans (user_id, banned_until, reason) values ('${U.max}', now() + interval '1 day', 'Test 032')`);
                            await as(U.max, async () => {
                                const seen = await q(`select count(*) as n from storage.objects where bucket_id = 'chat_attachments'`);
                                check("Gesperrte Konten sehen keine Anhänge", seen.error !== null || Number(seen.rows[0]?.n) === 0, seen.error || String(seen.rows[0]?.n));
                            });
                            await db.exec(`delete from public.user_bans where user_id = '${U.max}' and reason = 'Test 032'`);
                        }

                        // --- 033: Erinnerungen vor dem Termin, alte Anfragen beenden ---
                        if (ERINNERUNG_SQL) {
                            await db.exec(readFileSync(ERINNERUNG_SQL, "utf8"));
                            const ctl33 = await db.exec(readFileSync(ERINNERUNG_SQL, "utf8")); // zweiter Lauf
                            const rows33 = ctl33[ctl33.length - 1].rows;
                            console.log("Kontrolle 033:\n  " + rows33.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                            check("Kontrolle 033: Status, Funktionen, nur Server (Zeitplan braucht pg_cron – im Nachbau nicht vorhanden)",
                                rows33.slice(0, 3).map(r => r.ergebnis).join(",") === "bereit,bereit,ja" && /^fehlt/.test(rows33[3]?.ergebnis || ""), rows33.map(r => r.ergebnis).join(", "));

                            // Testbuchungen bei Max: fällig in 50 Min. (bezahlt), in 20 Std. (bezahlt), in 10 Std. (angenommen, unbezahlt),
                            // in 3 Tagen (bezahlt); alte bzw. verpasste Anfragen; eine frische Anfrage
                            const B = (n) => `33000000-0000-0000-0000-00000000000${n}`;
                            const row = (n, buyer, status, at, created = "now()") =>
                                `('${B(n)}', '${U.max}', '${buyer}', 'Erinnerungstest ${n}', 60, 3000, 0, 3000, '${status}', ${at}, ${created})`;
                            await db.exec(`insert into public.coaching_bookings (id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents, status, scheduled_at, created_at) values
                                ${row(1, U.tim, "bezahlt", "now() + interval '50 minutes'")},
                                ${row(2, U.anna, "bezahlt", "now() + interval '20 hours'")},
                                ${row(3, K3, "angenommen", "now() + interval '10 hours'")},
                                ${row(4, U.tim, "bezahlt", "now() + interval '3 days'")},
                                ${row(5, U.anna, "angefragt", "null", "now() - interval '8 days'")},
                                ${row(6, K3, "angefragt", "now() + interval '30 minutes'")},
                                ${row(7, U.anna, "angenommen", "now() - interval '1 hour'")},
                                ${row(8, U.tim, "angefragt", "now() + interval '5 days'")};
                                update public.coaching_reminder_runs set last_run = '-infinity'`);
                            await as(K, async () => {
                                const run = await q(`select public.coaching_reminder_run()`);
                                check("Erinnerungen nur für den Server", run.error !== null, run.error || "durchgelassen!");
                                const tidy = await q(`select public.coaching_expire_stale() as n`);
                                check("Aufräumen darf jedes Mitglied anstoßen", tidy.error === null, tidy.error || "");
                            });
                            await as(null, async () => {
                                const tidy = await q(`select public.coaching_expire_stale()`);
                                check("Gäste stoßen nichts an", tidy.error !== null, tidy.error || "durchgelassen!");
                            });
                            const st = Object.fromEntries((await q(`select id, status from public.coaching_bookings where id::text like '33000000%'`)).rows.map(r => [r.id.slice(-1), r.status]));
                            check("Abgelaufen: unbeantwortet nach 7 Tagen, Termin verpasst, angenommen aber nie bezahlt; Rest bleibt",
                                st[5] === "abgelaufen" && st[6] === "abgelaufen" && st[7] === "abgelaufen" && st[8] === "angefragt" && st[1] === "bezahlt" && st[3] === "angenommen", JSON.stringify(st));

                            await db.exec(`update public.coaching_reminder_runs set last_run = '-infinity'`);
                            const r1 = (await one(`select public.coaching_reminder_run() as r`)).r;
                            const mine = (r1?.erinnerungen || []).filter(e => String(e.id).startsWith("33000000"));
                            const art = Object.fromEntries(mine.map(e => [e.id.slice(-1), e.art]));
                            check("Fällig: 1 Std. vorher (bezahlt), 24 Std. vorher (bezahlt und unbezahlt) – nicht in 3 Tagen",
                                r1?.lauf === true && art[1] === "1h" && art[2] === "24h" && art[3] === "24h" && !art[4] && mine.length === 3, JSON.stringify(art));
                            check("Erinnerung enthält Namen, Titel und Termin", mine.every(e => e.coach_name && e.kunde_name && e.titel && e.termin), JSON.stringify(mine[0]));
                            const r2 = (await one(`select public.coaching_reminder_run() as r`)).r;
                            check("Höchstens ein Lauf alle 4 Minuten (zweiter Aufruf geht leer aus)", r2?.lauf === false && (r2?.erinnerungen || []).length === 0, JSON.stringify(r2));
                            await db.exec(`update public.coaching_reminder_runs set last_run = '-infinity'`);
                            const r3 = (await one(`select public.coaching_reminder_run() as r`)).r;
                            const again = (r3?.erinnerungen || []).filter(e => String(e.id).startsWith("33000000"));
                            check("Jede Erinnerung genau einmal", r3?.lauf === true && again.length === 0, JSON.stringify(again));
                            const marks = await one(`select reminded_24h_at is not null as tag, reminded_1h_at is not null as stunde from public.coaching_bookings where id = '${B(1)}'`);
                            check("Nach der 1-Stunden-Erinnerung keine 24-Stunden-Erinnerung mehr", marks.tag === true && marks.stunde === true, JSON.stringify(marks));
                            const free = await one(`select public.coach_time_free('${U.max}', now() + interval '5 days 2 hours', 60, null) as f,
                                public.coach_time_free('${U.max}', now() + interval '5 days', 60, null) as busy`);
                            check("Offene Anfragen blockieren ihre Zeit, abgelaufene nicht (Kalender aus 030)", free.f === true && free.busy === false, JSON.stringify(free));
                        }

                        // --- 034: Fehlerprotokoll der Webseite (Sicherheitsbericht Nr. 12) ---
                        if (FEHLER_SQL) {
                            await db.exec(readFileSync(FEHLER_SQL, "utf8"));
                            const ctl34 = await db.exec(readFileSync(FEHLER_SQL, "utf8")); // zweiter Lauf
                            const rows34 = ctl34[ctl34.length - 1].rows;
                            console.log("Kontrolle 034:\n  " + rows34.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                            check("Kontrolle 034: Fehlerprotokoll bereit, Lesen nur Admins", rows34.map(r => r.ergebnis).join(",") === "bereit,nur Admins", rows34.map(r => r.ergebnis).join(", "));
                            await as(null, async () => {
                                const a = await q(`select public.log_client_error('/login.html?token=geheim#x', 'TypeError: x is undefined', '/auth-nav.js?v=2', 10, 5, 'TestBrowser/1.0')`);
                                const b = await q(`select public.log_client_error('/login.html', 'TypeError: x is undefined')`);
                                const empty = await q(`select public.log_client_error('/login.html', '   ')`);
                                check("Gäste melden Fehler (auch beim Login)", a.error === null && b.error === null && empty.error === null, a.error || b.error || empty.error || "");
                                const read = await q(`select count(*) as n from public.client_errors`);
                                const direct = await q(`insert into public.client_errors (page, message) values ('/x', 'Spam')`);
                                check("Gäste lesen nichts und tragen nichts direkt ein", (read.error !== null || Number(read.rows[0]?.n) === 0) && direct.error !== null, read.error || direct.error || "durchgelassen!");
                            });
                            const login = await one(`select count(*) as rows, max(count) as n, max(page) as page, max(source) as source from public.client_errors where message = 'TypeError: x is undefined'`);
                            check("Gleicher Fehler wird gezählt; Seite und Datei ohne Parameter (kein Token im Protokoll)",
                                Number(login.rows) === 1 && Number(login.n) === 2 && login.page === "/login.html" && login.source === "/auth-nav.js", JSON.stringify(login));
                            const noEmpty = await one(`select count(*) as n from public.client_errors where btrim(message) = ''`);
                            check("Leere Meldungen werden verworfen", Number(noEmpty.n) === 0, String(noEmpty.n));
                            await as(U.tim, async () => {
                                for (let i = 0; i < 35; i++) await q(`select public.log_client_error('/messenger.html', 'Fehler Nummer ${i}')`);
                                const own = await q(`select count(*) as n from public.client_errors`);
                                const del = await q(`delete from public.client_errors returning id`);
                                check("Mitglieder sehen und löschen das Protokoll nicht", Number(own.rows[0]?.n || 0) === 0 && (del.error !== null || del.rows.length === 0), own.error || del.error || "");
                            });
                            const tims = await one(`select count(*) as n from public.client_errors where user_id = '${U.tim}'`);
                            check("Höchstens 30 neue Einträge pro Konto und Stunde", Number(tims.n) === 30, String(tims.n));
                            await as(U.lena, async () => { await q(`select public.log_client_error('/dashboard.html', 'Fehler von Lena')`); }); // Konto wird am Ende gelöscht
                            await withClaims(U.admin, "aal1", async () => {
                                const r = await q(`select count(*) as n from public.client_errors`);
                                check("Admin ohne Zwei-Faktor sieht das Protokoll nicht", Number(r.rows[0]?.n || 0) === 0, r.error || String(r.rows[0]?.n));
                            });
                            await withClaims(U.admin, "aal2", async () => {
                                const r = await q(`select count(*) as n from public.client_errors`);
                                check("Admin mit Zwei-Faktor sieht das Protokoll", Number(r.rows[0]?.n) >= 32, r.error || String(r.rows[0]?.n));
                                const del = await q(`delete from public.client_errors where user_id = '${U.tim}' returning id`);
                                check("Admin leert Einträge", del.error === null && del.rows.length === 30, del.error || String(del.rows.length));
                            });
                            await db.exec(`update public.client_errors set created_at = now() - interval '31 days' where message = 'TypeError: x is undefined'`);
                            await as(null, async () => { await q(`select public.log_client_error('/index.html', 'Noch ein Fehler')`); });
                            const old = await one(`select count(*) as n from public.client_errors where message = 'TypeError: x is undefined'`);
                            check("Nach 30 Tagen automatisch gelöscht", Number(old.n) === 0, String(old.n));
                        }

                        // --- 035: Coaching-Reklamation („Problem melden“) ---
                        if (REKLAMATION_SQL) {
                            await db.exec(readFileSync(REKLAMATION_SQL, "utf8"));
                            const ctl35 = await db.exec(readFileSync(REKLAMATION_SQL, "utf8")); // zweiter Lauf
                            const rows35 = ctl35[ctl35.length - 1].rows;
                            console.log("Kontrolle 035:\n  " + rows35.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                            check("Kontrolle 035: Tabelle, Funktionen, Erstattung nur Server (Zeitplan braucht pg_cron)",
                                rows35.slice(0, 3).map(r => r.ergebnis).join(",") === "bereit,bereit,ja" && /^fehlt/.test(rows35[3]?.ergebnis || ""), rows35.map(r => r.ergebnis).join(", "));

                            // Bezahlte Coachings bei Max: vier vergangene (Reklamation möglich), eines in der Zukunft, eines vor 8 Tagen
                            const R = (n) => `35000000-0000-0000-0000-00000000000${n}`;
                            const paid = (n, buyer, at) => `('${R(n)}', '${U.max}', '${buyer}', 'Reklamationstest ${n}', 60, 3000, 300, 3300, 'bezahlt', ${at}, 'pi_035_${n}', now() - interval '9 days')`;
                            await db.exec(`insert into public.coaching_bookings (id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents, status, scheduled_at, stripe_payment_intent, paid_at) values
                                ${paid(1, U.tim, "now() - interval '2 hours'")}, ${paid(2, K3, "now() - interval '3 hours'")},
                                ${paid(3, U.anna, "now() - interval '1 hour'")}, ${paid(4, K, "now() - interval '30 minutes'")},
                                ${paid(5, U.tim, "now() + interval '2 days'")}, ${paid(6, U.tim, "now() - interval '8 days'")}`);
                            const report = (bk, reason, text) => q(`select public.coaching_report_problem('${R(bk)}', '${reason}', '${text}') as id`);
                            await as(U.anna, async () => {
                                const foreign = await report(1, "nicht_erschienen", "Nicht mein Coaching, aber ich melde trotzdem.");
                                check("Nur der Kunde selbst meldet ein Problem", /eigenen Coaching/.test(foreign.error || ""), foreign.error || "durchgelassen!");
                            });
                            let d1 = null;
                            await as(U.tim, async () => {
                                const early = await report(5, "nicht_erschienen", "Der Termin ist erst übermorgen.");
                                const late = await report(6, "nicht_erschienen", "Das ist schon über eine Woche her.");
                                const short = await report(1, "nicht_erschienen", "kurz");
                                const wrong = await report(1, "zu_teuer", "Das war mir einfach zu teuer.");
                                check("Abgelehnt: vor dem Termin, nach 7 Tagen, zu kurze Beschreibung, unbekannter Grund",
                                    /ab Beginn/.test(early.error || "") && /7 Tage/.test(late.error || "") && /10 Zeichen/.test(short.error || "") && /wähle aus/.test(wrong.error || ""),
                                    [early.error, late.error, short.error, wrong.error].join(" | "));
                                const ok = await report(1, "nicht_erschienen", "Der Coach ist nicht im Discord erschienen und hat nicht geantwortet.");
                                d1 = ok.rows[0]?.id;
                                check("Kunde meldet: Coach nicht erschienen", ok.error === null && Boolean(d1), ok.error || "");
                                const twice = await report(1, "mangelhaft", "Und außerdem war es auch noch schlecht.");
                                check("Nur eine Meldung pro Coaching", /schon ein Problem/.test(twice.error || ""), twice.error || "durchgelassen!");
                                const direct = await q(`insert into public.coaching_disputes (booking_id, buyer_id, coach_id, reason, description, respond_until) values ('${R(1)}', '${U.tim}', '${U.max}', 'sonstiges', 'Direkt eingetragen', now())`);
                                check("Reklamationen nicht direkt eintragbar", direct.error !== null, direct.error || "durchgelassen!");
                            });
                            let d2 = null, d3 = null, d4 = null;
                            await as(K3, async () => { d2 = (await report(2, "mangelhaft", "Er hat nur über sein eigenes Setup geredet.")).rows[0]?.id; });
                            await as(U.anna, async () => { d3 = (await report(3, "nicht_erschienen", "Niemand da, keine Antwort im Messenger.")).rows[0]?.id; });
                            await as(K, async () => { d4 = (await report(4, "sonstiges", "Die Verbindung war die ganze Zeit sehr schlecht.")).rows[0]?.id; });
                            check("Weitere Meldungen angelegt (mangelhaft, nicht erschienen, sonstiges)", Boolean(d2 && d3 && d4), JSON.stringify({ d2, d3, d4 }));
                            await db.exec(`update public.coaching_reminder_runs set last_run = '-infinity'`);
                            const run1 = (await one(`select public.coaching_reminder_run() as r`)).r;
                            const neu = (run1?.reklamationen || []).filter(x => x.art === "neu").map(x => x.id);
                            check("Coach wird über neue Meldungen informiert (E-Mail-Liste)", [d1, d2, d3, d4].every(id => neu.includes(id)), JSON.stringify(neu));

                            await as(U.lena, async () => {
                                const seen = await q(`select count(*) as n from public.coaching_disputes`);
                                check("Fremde sehen keine Reklamationen", Number(seen.rows[0]?.n || 0) === 0, seen.error || String(seen.rows[0]?.n));
                            });
                            await as(null, async () => {
                                const seen = await q(`select count(*) as n from public.coaching_disputes`);
                                check("Gäste sehen keine Reklamationen", seen.error !== null || Number(seen.rows[0]?.n) === 0, seen.error || String(seen.rows[0]?.n));
                            });
                            await as(U.anna, async () => {
                                const r = await q(`select public.coaching_dispute_answer('${d1}', false, 'Ich bin gar nicht der Coach hier.')`);
                                check("Nur der Coach antwortet", /nicht dein Coaching/.test(r.error || ""), r.error || "durchgelassen!");
                            });
                            await as(U.max, async () => {
                                const seen = await q(`select count(*) as n from public.coaching_disputes where coach_id = '${U.max}'`);
                                check("Coach sieht die Meldungen zu seinen Coachings", Number(seen.rows[0]?.n) === 4, seen.error || String(seen.rows[0]?.n));
                                const short = await q(`select public.coaching_dispute_answer('${d1}', false, 'nein')`);
                                check("Widerspruch nur mit Begründung", /10 Zeichen/.test(short.error || ""), short.error || "durchgelassen!");
                                const obj = await q(`select public.coaching_dispute_answer('${d1}', false, 'Ich war pünktlich im Discord, der Kunde kam nicht.') as r`);
                                check("Coach widerspricht", obj.rows[0]?.r === "widerspruch", obj.error || JSON.stringify(obj.rows[0]));
                                const acc = await q(`select public.coaching_dispute_answer('${d4}', true, 'Tut mir leid, die Verbindung lag an mir.') as r`);
                                check("Coach erstattet selbst", acc.rows[0]?.r === "erstattung", acc.error || JSON.stringify(acc.rows[0]));
                                const decide = await q(`select public.coaching_dispute_decide('${d1}', 3300, 'Ich entscheide selbst')`);
                                check("Coach entscheidet nicht selbst über Widersprüche", /Moderationsteam/.test(decide.error || ""), decide.error || "durchgelassen!");
                            });
                            await withClaims(MOD, "aal1", async () => {
                                const r = await q(`select public.coaching_dispute_decide('${d1}', 1000, 'Ohne Zwei-Faktor')`);
                                check("Moderation ohne Zwei-Faktor entscheidet nicht", /Moderationsteam/.test(r.error || ""), r.error || "durchgelassen!");
                            });
                            await withClaims(MOD, "aal2", async () => {
                                const early = await q(`select public.coaching_dispute_decide('${d2}', 0, 'Zu früh entschieden')`);
                                check("Moderation wartet die 48 Stunden des Coaches ab", /48 Stunden/.test(early.error || ""), early.error || "durchgelassen!");
                                const tooMuch = await q(`select public.coaching_dispute_decide('${d1}', 5000, 'Mehr als bezahlt')`);
                                check("Nicht mehr erstatten als bezahlt", /zwischen 0/.test(tooMuch.error || ""), tooMuch.error || "durchgelassen!");
                                const part = await q(`select public.coaching_dispute_decide('${d1}', 1000, 'Beide Seiten glaubhaft, Teil-Erstattung') as r`);
                                check("Moderation entscheidet Widerspruch: Teil-Erstattung", part.rows[0]?.r === "erstattung", part.error || JSON.stringify(part.rows[0]));
                            });
                            const logged = await one(`select count(*) as n from public.moderation_log where action = 'coaching_reklamation_entschieden'`);
                            check("Entscheidung steht im Moderationsprotokoll", Number(logged.n) === 1, String(logged.n));

                            // 48 Stunden vorbei: „nicht erschienen“ wird automatisch erstattet, „mangelhaft“ nicht
                            await db.exec(`update public.coaching_disputes set respond_until = now() - interval '1 minute' where id in ('${d2}', '${d3}')`);
                            const auto = (await one(`select public.coaching_disputes_auto() as n`)).n;
                            const st = Object.fromEntries((await q(`select id, status, refund_cents from public.coaching_disputes`)).rows.map(r => [r.id, r]));
                            check("Nach 48 Std. ohne Antwort: „nicht erschienen“ voll erstattet, „mangelhaft“ geht an die Moderation",
                                Number(auto) === 1 && st[d3]?.status === "erstattung" && st[d3]?.refund_cents === 3300 && st[d2]?.status === "offen", JSON.stringify({ auto, d2: st[d2], d3: st[d3] }));
                            await withClaims(MOD, "aal2", async () => {
                                const rej = await q(`select public.coaching_dispute_decide('${d2}', 0, 'Coaching fand statt, Qualität ist Ansichtssache') as r`);
                                check("Moderation lehnt ab (keine Erstattung)", rej.rows[0]?.r === "abgelehnt", rej.error || JSON.stringify(rej.rows[0]));
                                const again = await q(`select public.coaching_dispute_decide('${d2}', 3300, 'Doch erstatten')`);
                                check("Entschieden ist entschieden", /bereits entschieden/.test(again.error || ""), again.error || "durchgelassen!");
                            });
                            await as(K, async () => {
                                const pend = await q(`select public.coaching_dispute_refunds_pending()`);
                                const mark = await q(`select public.coaching_dispute_mark_refunded('${d4}')`);
                                check("Erstattungen auszuführen bleibt dem Server vorbehalten", pend.error !== null && mark.error !== null, pend.error || mark.error || "durchgelassen!");
                            });
                            const pending = (await one(`select public.coaching_dispute_refunds_pending() as r`)).r || [];
                            const byId = Object.fromEntries(pending.map(p => [p.id, p]));
                            check("Server bekommt die offenen Erstattungen mit Betrag und Zahlung",
                                byId[d1]?.refund_cents === 1000 && byId[d3]?.refund_cents === 3300 && byId[d4]?.refund_cents === 3300 && byId[d1]?.payment_intent === "pi_035_1" && !byId[d2],
                                JSON.stringify(pending.map(p => ({ id: p.id.slice(-1), c: p.refund_cents }))));
                            for (const id of [d1, d3, d4]) await db.exec(`select public.coaching_dispute_mark_refunded('${id}')`);
                            const fin = Object.fromEntries((await q(`select d.id, d.status, b.status as booking from public.coaching_disputes d join public.coaching_bookings b on b.id = d.booking_id`)).rows.map(r => [r.id, r]));
                            check("Abschluss: Teil-Erstattung lässt das Coaching bezahlt, volle Erstattung setzt es auf „erstattet“",
                                fin[d1]?.status === "teilweise_erstattet" && fin[d1]?.booking === "bezahlt" && fin[d3]?.status === "erstattet" && fin[d3]?.booking === "erstattet" && fin[d4]?.status === "erstattet",
                                JSON.stringify(fin));
                            await db.exec(`update public.coaching_reminder_runs set last_run = '-infinity'`);
                            const run2 = (await one(`select public.coaching_reminder_run() as r`)).r;
                            const results = (run2?.reklamationen || []).filter(x => x.art === "ergebnis").map(x => x.id);
                            check("Beide Seiten werden über das Ergebnis informiert (E-Mail-Liste)", [d1, d2, d3, d4].every(id => results.includes(id)), JSON.stringify(results));
                        }

                        // --- 036: 5 Tage Antwortfrist, Erinnerung, dauerhafte Coach-Sperre ---
                        if (COACH_SPERRE_SQL && REKLAMATION_SQL) {
                            const S = (n) => `36000000-0000-0000-0000-00000000000${n}`;
                            await db.exec(`insert into public.coaching_bookings (id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents, status, scheduled_at, stripe_payment_intent, paid_at) values
                                ('${S(1)}', '${U.max}', '${U.anna}', 'Fristtest alt', 60, 3000, 300, 3300, 'bezahlt', now() - interval '1 hour', 'pi_036_1', now() - interval '3 days'),
                                ('${S(2)}', '${U.max}', '${K3}', 'Fristtest neu', 60, 3000, 300, 3300, 'bezahlt', now() - interval '2 hours', 'pi_036_2', now() - interval '3 days')`);
                            let oldCase = null;
                            await as(U.anna, async () => { oldCase = (await q(`select public.coaching_report_problem('${S(1)}', 'nicht_erschienen', 'Noch nach alter Regel mit 48 Stunden gemeldet.') as id`)).rows[0]?.id; });
                            const before = await one(`select round(extract(epoch from respond_until - created_at) / 3600) as h from public.coaching_disputes where id = '${oldCase}'`);
                            await db.exec(readFileSync(COACH_SPERRE_SQL, "utf8"));
                            const ctl36 = await db.exec(readFileSync(COACH_SPERRE_SQL, "utf8")); // zweiter Lauf
                            const rows36 = ctl36[ctl36.length - 1].rows;
                            console.log("Kontrolle 036:\n  " + rows36.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                            check("Kontrolle 036: 5 Tage, Sperre bereit, E-Mail-Liste nur Server", rows36.map(r => r.ergebnis).join(",") === "5 Tage,bereit,ja", rows36.map(r => r.ergebnis).join(", "));
                            const after = await one(`select round(extract(epoch from respond_until - created_at) / 3600) as h from public.coaching_disputes where id = '${oldCase}'`);
                            check("Offener Fall von vorher: Frist von 48 Std. auf 5 Tage verlängert", Number(before.h) === 48 && Number(after.h) === 120, JSON.stringify({ before, after }));

                            let newCase = null;
                            await as(K3, async () => {
                                const r = await q(`select public.coaching_report_problem('${S(2)}', 'mangelhaft', 'Der Coach war die ganze Zeit abgelenkt.') as id`);
                                newCase = r.rows[0]?.id;
                                check("Neue Meldung angelegt", r.error === null && Boolean(newCase), r.error || "");
                            });
                            const h = await one(`select extract(epoch from respond_until - now()) / 3600 as h from public.coaching_disputes where id = '${newCase}'`);
                            check("Coach hat 5 Tage Zeit (statt 48 Stunden)", Number(h.h) > 119.9 && Number(h.h) <= 120, String(h.h));
                            await withClaims(MOD, "aal2", async () => {
                                const early = await q(`select public.coaching_dispute_decide('${newCase}', 0, 'Zu früh entschieden')`);
                                check("Moderation wartet die Frist ab (mit Datum in der Meldung)", /bis \d\d\.\d\d\.\d{4}, \d\d:\d\d Uhr Zeit zu antworten/.test(early.error || ""), early.error || "durchgelassen!");
                            });

                            // Erinnerung 24 Std. vor Fristende – genau einmal
                            const runNow = async () => { await db.exec(`update public.coaching_reminder_runs set last_run = '-infinity'`); return (await one(`select public.coaching_reminder_run() as r`)).r; };
                            const r1 = await runNow();
                            const neu36 = (r1?.reklamationen || []).filter(x => x.art === "neu").map(x => x.id);
                            const rem1 = (r1?.reklamationen || []).filter(x => x.art === "erinnerung").map(x => x.id);
                            check("Neue Meldung geht an den Coach, noch keine Erinnerung (Frist weit weg)", neu36.includes(newCase) && neu36.includes(oldCase) && rem1.length === 0, JSON.stringify({ neu36, rem1 }));
                            await db.exec(`update public.coaching_disputes set respond_until = now() + interval '20 hours' where id = '${newCase}'`);
                            const r2 = await runNow();
                            const rem2 = (r2?.reklamationen || []).filter(x => x.art === "erinnerung");
                            const r3 = await runNow();
                            const rem3 = (r3?.reklamationen || []).filter(x => x.art === "erinnerung");
                            check("24 Std. vor Fristende genau eine Erinnerung an den Coach (mit Frist)", rem2.length === 1 && rem2[0].id === newCase && Boolean(rem2[0].frist) && rem3.length === 0,
                                JSON.stringify({ rem2: rem2.map(x => x.id), rem3: rem3.length }));
                            await db.exec(`update public.coaching_disputes set respond_until = now() - interval '1 minute' where id = '${newCase}'`);
                            await as(U.max, async () => {
                                const late = await q(`select public.coaching_dispute_answer('${newCase}', false, 'Ich widerspreche leider zu spät.')`);
                                check("Nach der Frist kein Widerspruch mehr (Erstatten bleibt möglich)", /Frist/.test(late.error || ""), late.error || "durchgelassen!");
                            });

                            // Dauerhafte Coach-Sperre
                            await db.exec(`insert into public.coaching_bookings (id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents, status, scheduled_at) values
                                ('${S(3)}', '${U.max}', '${U.lena}', 'Offene Anfrage', 60, 3000, 300, 3300, 'angefragt', null),
                                ('${S(4)}', '${U.max}', '${U.anna}', 'Angenommen, nicht bezahlt', 60, 3000, 300, 3300, 'angenommen', now() + interval '5 days')`);
                            await db.exec(`insert into public.coaching_bookings (id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents, status, scheduled_at, stripe_payment_intent, paid_at) values
                                ('${S(5)}', '${U.max}', '${K}', 'Morgen früh', 60, 3000, 300, 3300, 'bezahlt', now() + interval '12 hours', 'pi_036_5', now() - interval '1 day')`);
                            const pre = await one(`select count(*) filter (where status = 'angefragt') as a, count(*) filter (where status = 'angenommen') as n,
                                    count(*) filter (where status = 'bezahlt' and stripe_payment_intent is not null and (scheduled_at is null or scheduled_at > now())) as p,
                                    count(*) filter (where status = 'bezahlt' and scheduled_at <= now()) as past
                                from public.coaching_bookings where coach_id = '${U.max}'`);
                            const REASON = "Beleidigungen im Coaching und Drohungen gegenüber Kunden.";
                            await as(K, async () => {
                                const r = await q(`select public.coach_ban_permanent('${U.max}', '${REASON}')`);
                                check("Mitglieder sperren keine Coaches", /nur Administratoren/.test(r.error || ""), r.error || "durchgelassen!");
                            });
                            await withClaims(MOD, "aal2", async () => {
                                const r = await q(`select public.coach_ban_permanent('${U.max}', '${REASON}')`);
                                check("Moderatoren sperren nicht dauerhaft (nur Administratoren)", /nur Administratoren/.test(r.error || ""), r.error || "durchgelassen!");
                            });
                            await withClaims(U.admin, "aal1", async () => {
                                const r = await q(`select public.coach_ban_permanent('${U.max}', '${REASON}')`);
                                check("Admin ohne Zwei-Faktor sperrt nicht", /nur Administratoren/.test(r.error || ""), r.error || "durchgelassen!");
                            });
                            let ban = null;
                            await withClaims(U.admin, "aal2", async () => {
                                const short = await q(`select public.coach_ban_permanent('${U.max}', 'frech')`);
                                const self = await q(`select public.coach_ban_permanent('${U.admin}', '${REASON}')`);
                                check("Sperre nur mit Begründung und nie für sich selbst", /10 Zeichen/.test(short.error || "") && /eigene Konto/.test(self.error || ""), [short.error, self.error].join(" | "));
                                const r = await q(`select public.coach_ban_permanent('${U.max}', '${REASON}') as r`);
                                ban = r.rows[0]?.r;
                                check("Admin sperrt den Coach dauerhaft", r.error === null && ban, r.error || "");
                                const twice = await q(`select public.coach_ban_permanent('${U.max}', '${REASON}')`);
                                check("Doppelt sperren wird erkannt", /bereits dauerhaft/.test(twice.error || ""), twice.error || "durchgelassen!");
                            });
                            check("Rückmeldung: abgelehnte Anfragen, stornierte Annahmen, Erstattungen",
                                ban?.abgelehnt === Number(pre.a) && ban?.storniert === Number(pre.n) && ban?.erstattungen === Number(pre.p) && Number(pre.a) >= 1 && Number(pre.n) >= 1 && Number(pre.p) >= 2,
                                JSON.stringify({ ban, pre }));
                            const postB = await one(`select count(*) filter (where status in ('angefragt', 'angenommen')) as offen,
                                    count(*) filter (where status = 'bezahlt' and scheduled_at <= now()) as past,
                                    (select count(*) from public.coaching_offers where coach_id = '${U.max}' and active) as angebote
                                from public.coaching_bookings where coach_id = '${U.max}'`);
                            check("Keine offenen Anfragen mehr, Angebote pausiert, vergangene Coachings bleiben bezahlt",
                                Number(postB.offen) === 0 && Number(postB.angebote) === 0 && Number(postB.past) === Number(pre.past), JSON.stringify(postB));
                            const refunds = (await q(`select d.booking_id, d.status, d.refund_cents, b.total_cents from public.coaching_disputes d join public.coaching_bookings b on b.id = d.booking_id where d.reason = 'coach_gesperrt'`)).rows;
                            const pend36 = ((await one(`select public.coaching_dispute_refunds_pending() as r`)).r || []).map(p => p.booking_id);
                            check("Künftige bezahlte Termine: volle Erstattung über die Automatik",
                                refunds.length === Number(pre.p) && refunds.every(x => x.status === "erstattung" && x.refund_cents === x.total_cents) && pend36.includes(S(5)) && pend36.includes("35000000-0000-0000-0000-000000000005"),
                                JSON.stringify({ refunds, pend36 }));
                            const lic = await one(`select public.coach_license_active('${U.max}') as a`);
                            check("Lizenz (auch Pro-Coach) nicht mehr aktiv", lic.a === false, String(lic.a));
                            await as(U.max, async () => {
                                const claim = await q(`select public.coach_claim_license()`);
                                const offer = await q(`select public.coaching_save_offer(null, 'Neues Angebot', null, 'Fahrtechnik', 'iRacing', 60, 3000, true)`);
                                const cal = await q(`select public.coach_save_calendar('Europe/Berlin', '[]'::jsonb)`);
                                check("Gesperrter Coach: keine Lizenz, kein Angebot, kein Kalender", /dauerhaft entzogen/.test(claim.error || "") && /Coach-Lizenz/.test(offer.error || "") && /Coach-Lizenz/.test(cal.error || ""),
                                    [claim.error, offer.error, cal.error].join(" | "));
                                const st = await q(`select public.coach_license_status('${U.max}') as s`);
                                const e = st.rows[0]?.s?.entzogen;
                                check("Coach sieht: dauerhaft entzogen, mit Begründung", e?.dauerhaft === true && e?.grund === REASON, st.error || JSON.stringify(e));
                                const banned = await q(`select public.is_banned() as b`);
                                check("Das Konto selbst bleibt nutzbar (keine Kontosperre)", banned.rows[0]?.b === false, banned.error || String(banned.rows[0]?.b));
                            });
                            const maxOffer36 = (await one(`select id from public.coaching_offers where coach_id = '${U.max}' and title = 'Kalender-Coaching Spa'`))?.id;
                            await as(U.tim, async () => {
                                const fs = await q(`select public.coaching_free_slots('${maxOffer36}')`);
                                check("Kunden können nicht mehr buchen", /nicht mehr angeboten/.test(fs.error || ""), fs.error || "durchgelassen!");
                            });
                            // Lange Zeit vergeht, Bewertungen sind gut: trotzdem keine Lizenz
                            await db.exec(`update auth.users set created_at = now() - interval '3 years' where id = '${U.max}'`);
                            await as(U.max, async () => {
                                const claim = await q(`select public.coach_claim_license()`);
                                check("Auch nach Jahren nie wieder selbst holbar", /dauerhaft entzogen/.test(claim.error || ""), claim.error || "durchgelassen!");
                            });
                            await withClaims(MOD, "aal2", async () => {
                                const rev = await q(`select public.coach_license_revoke('${U.max}', 'Moderator will den Grund ändern')`);
                                const res = await q(`select public.coach_license_restore('${U.max}')`);
                                check("Moderatoren können die dauerhafte Sperre weder überschreiben noch aufheben",
                                    /bereits dauerhaft/.test(rev.error || "") && /nur Administratoren/.test(res.error || ""), [rev.error, res.error].join(" | "));
                            });
                            const log36 = await one(`select count(*) as n, max(details ->> 'grund') as g from public.moderation_log where action = 'coach_dauerhaft_gesperrt' and target_user = '${U.max}'`);
                            check("Sperre steht im Moderationsprotokoll", Number(log36.n) === 1 && log36.g === REASON, JSON.stringify(log36));

                            const r4 = await runNow();
                            const bans4 = r4?.sperren || [];
                            const neu4 = (r4?.reklamationen || []).filter(x => x.art === "neu" && x.grund === "coach_gesperrt");
                            const due4 = (r4?.erinnerungen || []).map(x => x.id);
                            const r5 = await runNow();
                            check("Coach bekommt genau eine E-Mail mit Begründung; keine „neue Reklamation“, keine Termin-Erinnerung für Erstattetes",
                                bans4.length === 1 && bans4[0].coach_id === U.max && bans4[0].grund === REASON && (r5?.sperren || []).length === 0 && neu4.length === 0 && !due4.includes(S(5)),
                                JSON.stringify({ bans4, neu4: neu4.length, due4, r5: (r5?.sperren || []).length }));
                            for (const x of refunds) {
                                const id = (await one(`select id from public.coaching_disputes where booking_id = '${x.booking_id}'`)).id;
                                await db.exec(`select public.coaching_dispute_mark_refunded('${id}')`);
                            }
                            const r6 = await runNow();
                            const res6 = (r6?.reklamationen || []).filter(x => x.art === "ergebnis" && x.grund === "coach_gesperrt");
                            const bk = await one(`select status from public.coaching_bookings where id = '${S(5)}'`);
                            check("Nach der Erstattung: Kunden werden informiert, Termin steht auf „erstattet“", res6.length === refunds.length && bk.status === "erstattet", JSON.stringify({ n: res6.length, bk }));

                            await withClaims(U.admin, "aal2", async () => {
                                const res = await q(`select public.coach_license_restore('${U.max}')`);
                                check("Admin kann eine irrtümliche Sperre aufheben", res.error === null, res.error || "");
                            });
                            const lic2 = await one(`select public.coach_license_active('${U.max}') as a, (select count(*) from public.moderation_log where action = 'coach_sperre_aufgehoben') as n`);
                            check("Nach dem Aufheben wieder Pro-Coach, Aufhebung im Protokoll", lic2.a === true && Number(lic2.n) === 1, JSON.stringify(lic2));
                        }

                        // --- 037: Urlaubsmodus, Rabatte, Bitte um Bewertung ---
                        if (URLAUB_SQL && COACH_SPERRE_SQL) {
                            await db.exec(readFileSync(URLAUB_SQL, "utf8"));
                            const ctl37 = await db.exec(readFileSync(URLAUB_SQL, "utf8")); // zweiter Lauf
                            const rows37 = ctl37[ctl37.length - 1].rows;
                            console.log("Kontrolle 037:\n  " + rows37.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                            check("Kontrolle 037: Urlaub, Rabatte, Bewertungsbitte bereit, Internes gesperrt", rows37.map(r => r.ergebnis).join(",") === "bereit,bereit,bereit,ja", rows37.map(r => r.ergebnis).join(", "));
                            const pastAsked = await one(`select count(*) filter (where review_asked_at is null) as n from public.coaching_bookings where scheduled_at + make_interval(mins => duration_minutes) < now()`);
                            check("Schon vergangene Coachings bekommen keine nachträgliche Bewertungs-E-Mail", Number(pastAsked.n) === 0, String(pastAsked.n));

                            // Max: neues Angebot (120 €) und Zeiten jeden Tag 18–22 Uhr
                            const WIN37 = JSON.stringify([1, 2, 3, 4, 5, 6, 7].map(t => ({ tag: t, von: 1080, bis: 1320 })));
                            let offer37 = null;
                            await as(U.max, async () => {
                                offer37 = (await q(`select public.coaching_save_offer(null, 'Urlaubs- und Rabatt-Test', null, 'Fahrtechnik', 'iRacing', 60, 12000, true) as id`)).rows[0]?.id;
                                await q(`select public.coach_save_calendar('Europe/Berlin', '${WIN37}'::jsonb)`);
                            });
                            check("037-Test: Angebot und Kalender angelegt", Boolean(offer37), String(offer37));
                            const freeDays = async (who) => {
                                let days = [];
                                await as(who, async () => {
                                    const r = await q(`select public.coaching_free_slots('${offer37}') as r`);
                                    days = [...new Set((r.rows[0]?.r?.slots || []).map(s => new Date(s).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })))];
                                });
                                return days;
                            };
                            const berlinDay = async (offset) => (await one(`select ((now() at time zone 'Europe/Berlin')::date + ${offset})::text as d`)).d;
                            const d3 = await berlinDay(3), d4 = await berlinDay(4), d7 = await berlinDay(7);

                            await as(K, async () => {
                                const r = await q(`select public.coach_set_away(null, null)`);
                                check("Urlaubsmodus nur für Coaches", /Coach-Lizenz/.test(r.error || ""), r.error || "durchgelassen!");
                            });
                            await as(U.max, async () => {
                                const past = await q(`select public.coach_set_away((now() at time zone 'Europe/Berlin')::date - 1, null)`);
                                const wrong = await q(`select public.coach_set_away('${d4}', '${d3}')`);
                                const long = await q(`select public.coach_set_away('${d3}', '${d3}'::date + 200)`);
                                check("Urlaub: nicht rückwirkend, Ende nach Beginn, höchstens 180 Tage",
                                    /frühestens heute/.test(past.error || "") && /vor dem Beginn/.test(wrong.error || "") && /180 Tage/.test(long.error || ""),
                                    [past.error, wrong.error, long.error].join(" | "));
                                const ok = await q(`select public.coach_set_away('${d3}', '${d4}') as r`);
                                check("Coach plant Urlaub (Tag 3 bis 4)", ok.error === null && ok.rows[0]?.r?.von === d3 && ok.rows[0]?.r?.bis === d4, ok.error || JSON.stringify(ok.rows[0]?.r));
                                const direct = await q(`insert into public.coach_away (coach_id, from_day) values ('${U.max}', current_date)`);
                                check("Urlaub nicht direkt eintragbar", direct.error !== null, direct.error || "durchgelassen!");
                                const own = await q(`select public.coach_away_info('${U.max}') as i`);
                                check("Coach sieht seinen geplanten Urlaub", own.rows[0]?.i?.geplant === true && own.rows[0]?.i?.von === d3, own.error || JSON.stringify(own.rows[0]?.i));
                            });
                            const daysPlanned = await freeDays(K);
                            check("Urlaubstage verschwinden aus den freien Terminen, andere Tage bleiben",
                                !daysPlanned.includes(d3) && !daysPlanned.includes(d4) && daysPlanned.includes(d7), JSON.stringify(daysPlanned.slice(0, 8)));
                            await as(K, async () => {
                                const seen = await q(`select count(*) as n from public.coach_away`);
                                const info = await q(`select public.coach_away_info('${U.max}') as i`);
                                check("Andere sehen keinen geplanten Urlaub und keine Tabelle", Number(seen.rows[0]?.n) === 0 && info.rows[0]?.i?.urlaub === false && !info.rows[0]?.i?.geplant,
                                    seen.error || JSON.stringify(info.rows[0]?.i));
                                const book = await q(`select public.coaching_book_at('${offer37}', ('${d3}'::date + time '19:00') at time zone 'Europe/Berlin')`);
                                check("Buchung an einem Urlaubstag abgelehnt (mit Hinweis)", /im Urlaub/.test(book.error || ""), book.error || "durchgelassen!");
                            });
                            // Ab heute, ohne Ende
                            await as(U.max, async () => { await q(`select public.coach_set_away(null, null)`); });
                            await as(K, async () => {
                                const info = await q(`select public.coach_away_info('${U.max}') as i`);
                                const list = await q(`select public.coaching_away_coaches() as l`);
                                check("Alle sehen: im Urlaub (ohne Enddatum)", info.rows[0]?.i?.urlaub === true && info.rows[0]?.i?.bis === null
                                    && (list.rows[0]?.l || []).some(x => x.coach_id === U.max), JSON.stringify({ i: info.rows[0]?.i, l: list.rows[0]?.l }));
                            });
                            check("Im offenen Urlaub keine freien Termine", (await freeDays(K)).length === 0, "");
                            // Ohne Kalender: Anfrage per Text gesperrt, solange der Urlaub läuft
                            await as(U.max, async () => { await q(`select public.coach_save_calendar('Europe/Berlin', '[]'::jsonb)`); });
                            await as(K3, async () => {
                                const r = await q(`select public.coaching_book('${offer37}', 'Hallo', 'Samstag')`);
                                check("Ohne Kalender: keine Anfrage, solange der Coach im Urlaub ist", /gerade im Urlaub/.test(r.error || ""), r.error || "durchgelassen!");
                            });
                            // Abgelaufener Urlaub zählt nicht mehr
                            await db.exec(`update public.coach_away set from_day = current_date - 10, until_day = current_date - 2 where coach_id = '${U.max}'`);
                            await as(K, async () => {
                                const info = await q(`select public.coach_away_info('${U.max}') as i`);
                                check("Urlaub endet von selbst (Enddatum vorbei)", info.rows[0]?.i?.urlaub === false, JSON.stringify(info.rows[0]?.i));
                            });
                            await as(U.max, async () => {
                                await q(`select public.coach_set_away(null, null)`);
                                const end = await q(`select public.coach_end_away()`);
                                const info = await q(`select public.coach_away_info('${U.max}') as i`);
                                check("Coach beendet den Urlaub mit einem Klick", end.error === null && info.rows[0]?.i?.urlaub === false && !info.rows[0]?.i?.geplant, end.error || JSON.stringify(info.rows[0]?.i));
                                await q(`select public.coach_save_calendar('Europe/Berlin', '${WIN37}'::jsonb)`);
                            });

                            // Rabatte
                            await as(K, async () => {
                                const r = await q(`select public.coaching_set_discount('${offer37}', 20, null)`);
                                check("Nur der Coach selbst gibt Rabatt auf sein Angebot", /gehört dir nicht/.test(r.error || ""), r.error || "durchgelassen!");
                            });
                            await as(U.max, async () => {
                                const low = await q(`select public.coaching_set_discount('${offer37}', 3, null)`);
                                const high = await q(`select public.coaching_set_discount('${offer37}', 80, null)`);
                                const past = await q(`select public.coaching_set_discount('${offer37}', 20, current_date - 3)`);
                                check("Rabatt nur 5–70 % und nicht rückwirkend", /5 und 70/.test(low.error || "") && /5 und 70/.test(high.error || "") && /Vergangenheit/.test(past.error || ""),
                                    [low.error, high.error, past.error].join(" | "));
                                const ok = await q(`select public.coaching_set_discount('${offer37}', 20, (now() at time zone 'Europe/Berlin')::date + 10) as r`);
                                check("Coach gibt 20 % Rabatt (120 € → 96 €)", ok.rows[0]?.r?.preis === 9600 && ok.rows[0]?.r?.prozent === 20, ok.error || JSON.stringify(ok.rows[0]?.r));
                                const direct = await q(`update public.coaching_offers set discount_percent = 70 where id = '${offer37}'`);
                                check("Rabatt nicht direkt änderbar", direct.error !== null || (await one(`select discount_percent as p from public.coaching_offers where id = '${offer37}'`)).p === 20, direct.error || "");
                            });
                            const planK = (await one(`select public.plan_of('${K}') as p`)).p;
                            const feeK = ["pole", "alliance"].includes(planK) ? 0 : 960;
                            let slot37 = null;
                            await as(K, async () => {
                                slot37 = ((await q(`select public.coaching_free_slots('${offer37}') as r`)).rows[0]?.r?.slots || [])[0];
                                const r = await q(`select public.coaching_book_at('${offer37}', '${slot37}'::timestamptz) as r`);
                                check("Buchung zum Rabattpreis, Servicegebühr vom reduzierten Preis", r.rows[0]?.r?.price_cents === 9600 && r.rows[0]?.r?.fee_cents === feeK && r.rows[0]?.r?.total_cents === 9600 + feeK && r.rows[0]?.r?.rabatt === 20,
                                    r.error || JSON.stringify(r.rows[0]?.r));
                            });
                            const stored = await one(`select price_cents, discount_percent from public.coaching_bookings where offer_id = '${offer37}' and buyer_id = '${K}'`);
                            check("Rabatt steht an der Buchung", stored?.price_cents === 9600 && stored?.discount_percent === 20, JSON.stringify(stored));
                            await db.exec(`update public.coaching_offers set discount_until = current_date - 1 where id = '${offer37}'`);
                            const expired = await one(`select public.coaching_effective_price(price_cents, discount_percent, discount_until) as p from public.coaching_offers where id = '${offer37}'`);
                            check("Abgelaufener Rabatt gilt nicht mehr", expired.p === 12000, String(expired.p));
                            await as(U.max, async () => {
                                const off = await q(`select public.coaching_set_discount('${offer37}', 0, null) as r`);
                                check("Rabatt entfernen", off.error === null && off.rows[0]?.r?.prozent === null, off.error || JSON.stringify(off.rows[0]?.r));
                            });

                            // Bitte um Bewertung
                            const B = (n) => `37000000-0000-0000-0000-00000000000${n}`;
                            const pb = (n, buyer, at, dur = 60) => `('${B(n)}', '${U.max}', '${buyer}', 'Bewertungstest ${n}', ${dur}, 3000, 300, 3300, 'bezahlt', ${at}, 'pi_037_${n}', now() - interval '20 days')`;
                            await db.exec(`insert into public.coaching_bookings (id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents, status, scheduled_at, stripe_payment_intent, paid_at) values
                                ${pb(1, K3, "now() - interval '4 hours'")}, ${pb(2, U.anna, "now() - interval '90 minutes'")},
                                ${pb(3, U.tim, "now() - interval '5 hours'")}, ${pb(4, K, "now() - interval '6 hours'")}, ${pb(5, U.anna, "now() - interval '15 days'")}`);
                            await db.exec(`update public.coaching_bookings set review_asked_at = null where id in ('${B(1)}', '${B(2)}', '${B(3)}', '${B(4)}', '${B(5)}')`);
                            await db.exec(`insert into public.coaching_reviews (booking_id, coach_id, buyer_id, rating) values ('${B(3)}', '${U.max}', '${U.tim}', 1)`);
                            await as(K, async () => { await q(`select public.coaching_report_problem('${B(4)}', 'mangelhaft', 'Das Coaching war leider viel zu kurz.')`); });
                            const runNow37 = async () => { await db.exec(`update public.coaching_reminder_runs set last_run = '-infinity'`); return (await one(`select public.coaching_reminder_run() as r`)).r; };
                            const rr1 = await runNow37();
                            const asked = (rr1?.bewertungen || []).map(x => x.id);
                            const rr2 = await runNow37();
                            check("Bewertungsbitte: 2 Std. nach dem Ende, nur einmal; nicht wenn bewertet, reklamiert, zu früh oder zu alt",
                                asked.includes(B(1)) && !asked.includes(B(2)) && !asked.includes(B(3)) && !asked.includes(B(4)) && !asked.includes(B(5)) && (rr2?.bewertungen || []).length === 0
                                && (rr1?.bewertungen || []).find(x => x.id === B(1))?.kunde_id === K3,
                                JSON.stringify({ asked, again: (rr2?.bewertungen || []).length }));
                            await as(K, async () => {
                                const r = await q(`select public.coach_away_on('${U.max}', current_date)`);
                                const b = await q(`select public.coaching_book_internal('${offer37}', null, null, null)`);
                                check("Interne Funktionen für Mitglieder gesperrt", r.error !== null && b.error !== null, r.error || b.error || "durchgelassen!");
                            });
                        }

                        // --- 038: Dauer-Varianten, Bewertung auf der Seite ---
                        if (VARIANTEN_SQL && URLAUB_SQL) {
                            await db.exec(readFileSync(VARIANTEN_SQL, "utf8"));
                            const ctl38 = await db.exec(readFileSync(VARIANTEN_SQL, "utf8")); // zweiter Lauf
                            const rows38 = ctl38[ctl38.length - 1].rows;
                            console.log("Kontrolle 038:\n  " + rows38.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
                            check("Kontrolle 038: Varianten und Bewertungsabfrage bereit, Internes gesperrt", rows38.map(r => r.ergebnis).join(",") === "bereit,bereit,ja", rows38.map(r => r.ergebnis).join(", "));
                            const off38 = (await one(`select id from public.coaching_offers where title = 'Urlaubs- und Rabatt-Test'`))?.id;
                            await as(K, async () => {
                                const r = await q(`select public.coaching_save_variants('${off38}', '[{"dauer":120,"preis":20000}]'::jsonb)`);
                                check("Nur der Coach legt Längen fest", /gehört dir nicht/.test(r.error || ""), r.error || "durchgelassen!");
                            });
                            await as(U.max, async () => {
                                const many = await q(`select public.coaching_save_variants('${off38}', '[{"dauer":90,"preis":9000},{"dauer":120,"preis":20000},{"dauer":150,"preis":22000},{"dauer":180,"preis":28000}]'::jsonb)`);
                                const odd = await q(`select public.coaching_save_variants('${off38}', '[{"dauer":50,"preis":9000}]'::jsonb)`);
                                const cheap = await q(`select public.coaching_save_variants('${off38}', '[{"dauer":120,"preis":100}]'::jsonb)`);
                                const base = await q(`select public.coaching_save_variants('${off38}', '[{"dauer":60,"preis":9000}]'::jsonb)`);
                                const dup = await q(`select public.coaching_save_variants('${off38}', '[{"dauer":120,"preis":9000},{"dauer":120,"preis":9500}]'::jsonb)`);
                                check("Längen: höchstens 3, Viertelstunden, Preis 5–1.000 €, keine doppelten",
                                    /höchstens 3/i.test(many.error || "") && /Viertelstunden/.test(odd.error || "") && /5 € und 1.000 €/.test(cheap.error || "")
                                    && /nur einmal/.test(base.error || "") && /nur einmal/.test(dup.error || ""),
                                    [many.error, odd.error, cheap.error, base.error, dup.error].join(" | "));
                                const ok = await q(`select public.coaching_save_variants('${off38}', '[{"dauer":120,"preis":20000},{"dauer":180,"preis":28000}]'::jsonb) as n`);
                                check("Coach bietet zusätzlich 2 und 3 Stunden an", ok.rows[0]?.n === 2, ok.error || JSON.stringify(ok.rows[0]));
                                const direct = await q(`insert into public.coaching_offer_variants (offer_id, duration_minutes, price_cents) values ('${off38}', 240, 500)`);
                                check("Längen nicht direkt eintragbar", direct.error !== null, direct.error || "durchgelassen!");
                            });
                            let slot180 = null;
                            const planK38 = (await one(`select public.plan_of('${K}') as p`)).p;
                            const fee38 = (cents) => (["pole", "alliance"].includes(planK38) ? 0 : Math.round(cents * 0.1));
                            await as(K, async () => {
                                const seen = await q(`select duration_minutes as d, price_cents as p from public.coaching_offer_variants where offer_id = '${off38}' order by 1`);
                                check("Kunden sehen die Längen mit Preis", seen.rows.map(r => `${r.d}:${r.p}`).join(",") === "120:20000,180:28000", seen.error || JSON.stringify(seen.rows));
                                const fs = await q(`select public.coaching_free_slots_dauer('${off38}', 180) as r`);
                                const slots = fs.rows[0]?.r?.slots || [];
                                const late = slots.filter(s => {
                                    const [h, m] = new Date(s).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour12: false }).split(":").map(Number);
                                    return h * 60 + m > 19 * 60;
                                });
                                check("Freie Termine passen zur gewählten Länge (3 Std. bis Start 19 Uhr)", fs.rows[0]?.r?.dauer === 180 && slots.length > 0 && late.length === 0, fs.error || JSON.stringify(late.slice(0, 2)));
                                const wrong = await q(`select public.coaching_free_slots_dauer('${off38}', 45)`);
                                const bookWrong = await q(`select public.coaching_book_dauer('${off38}', 45, '${slots[0]}'::timestamptz)`);
                                check("Nicht angebotene Länge abgelehnt", /bietet der Coach nicht an/.test(wrong.error || "") && /bietet der Coach nicht an/.test(bookWrong.error || ""), [wrong.error, bookWrong.error].join(" | "));
                                slot180 = slots[slots.length - 1];
                            });
                            const planT38 = (await one(`select public.plan_of('${U.tim}') as p`)).p;
                            const feeT = (cents) => (["pole", "alliance"].includes(planT38) ? 0 : Math.round(cents * 0.1));
                            await as(U.tim, async () => {
                                const ok = await q(`select public.coaching_book_dauer('${off38}', 180, '${slot180}'::timestamptz, 'Langes Training bitte') as r`);
                                const r = ok.rows[0]?.r;
                                check("Kunde bucht 3 Stunden zum Preis der Variante", r?.dauer === 180 && r?.price_cents === 28000 && r?.fee_cents === feeT(28000) && r?.total_cents === 28000 + feeT(28000),
                                    ok.error || JSON.stringify(r));
                            });
                            const st38 = await one(`select duration_minutes as d from public.coaching_bookings where offer_id = '${off38}' and buyer_id = '${U.tim}' and status = 'angefragt'`);
                            check("Buchung speichert die gewählte Länge", st38?.d === 180, JSON.stringify(st38));
                            await as(U.max, async () => { await q(`select public.coaching_set_discount('${off38}', 10, null)`); });
                            await as(U.anna, async () => {
                                const t = new Date(slot180).getTime();
                                const free60 = ((await q(`select public.coaching_free_slots('${off38}') as r`)).rows[0]?.r?.slots || []).map(s => new Date(s).getTime());
                                check("3 Stunden belegt auch die Grund-Dauer (alter Aufruf unverändert)", free60.length > 0 && !free60.some(x => x > t - 60 * 60000 && x < t + 180 * 60000), "");
                                const s120 = ((await q(`select public.coaching_free_slots_dauer('${off38}', 120) as r`)).rows[0]?.r?.slots || [])[0];
                                const ok = await q(`select public.coaching_book_dauer('${off38}', 120, '${s120}'::timestamptz) as r`);
                                check("Rabatt gilt auch für Varianten (2 Std. 200 € − 10 % = 180 €)", ok.rows[0]?.r?.price_cents === 18000 && ok.rows[0]?.r?.rabatt === 10, ok.error || JSON.stringify(ok.rows[0]?.r));
                            });
                            await as(U.max, async () => {
                                await q(`select public.coaching_set_discount('${off38}', 0, null)`);
                                const clear = await q(`select public.coaching_save_variants('${off38}', '[]'::jsonb) as n`);
                                check("Coach entfernt die Längen wieder", clear.rows[0]?.n === 0, clear.error || "");
                            });
                            await as(K3, async () => {
                                const r = await q(`select public.coaching_book_dauer('${off38}', 180, now() + interval '5 days')`);
                                check("Entfernte Länge nicht mehr buchbar", /bietet der Coach nicht an/.test(r.error || ""), r.error || "durchgelassen!");
                            });

                            // Bewertung auf der Seite
                            const V = (n) => `38000000-0000-0000-0000-00000000000${n}`;
                            const pv = (n, buyer, at) => `('${V(n)}', '${U.max}', '${buyer}', 'Abfragetest ${n}', 60, 3000, 300, 3300, 'bezahlt', ${at}, 'pi_038_${n}', now() - interval '20 days')`;
                            await db.exec(`insert into public.coaching_bookings (id, coach_id, buyer_id, offer_title, duration_minutes, price_cents, fee_cents, total_cents, status, scheduled_at, stripe_payment_intent, paid_at) values
                                ${pv(1, K3, "now() - interval '90 minutes'")}, ${pv(2, K3, "now() - interval '4 days'")}, ${pv(3, U.tim, "now() - interval '4 days'")},
                                ${pv(4, U.tim, "now() - interval '26 hours'")}, ${pv(5, K3, "now() + interval '2 days'")}`);
                            let prompts = [];
                            await as(K3, async () => {
                                const r = await q(`select public.coaching_review_prompts() as p`);
                                prompts = (r.rows[0]?.p || []).map(x => x.id);
                                check("Seite fragt nach dem Coaching nach einer Bewertung (neueste zuerst, höchstens 3, nicht vor dem Termin)",
                                    prompts[0] === V(1) && !prompts.includes(V(5)) && prompts.length <= 3, r.error || JSON.stringify(prompts));
                                const foreign = await q(`select public.coaching_review_dismiss('${V(3)}')`);
                                check("Fremde Coachings nicht ausblendbar", /nicht zu deinen Buchungen/.test(foreign.error || ""), foreign.error || "durchgelassen!");
                                const dis = await q(`select public.coaching_review_dismiss('${V(2)}')`);
                                const dis1 = await q(`select public.coaching_review_dismiss('${V(1)}')`);
                                const after = ((await q(`select public.coaching_review_prompts() as p`)).rows[0]?.p || []).map(x => x.id);
                                const flags = await q(`select count(*) filter (where review_dismissed_at is not null) as n from public.coaching_bookings where id in ('${V(1)}', '${V(2)}')`);
                                check("„Nicht bewerten“ blendet die Frage dauerhaft aus", dis.error === null && dis1.error === null && !after.includes(V(1)) && !after.includes(V(2)) && Number(flags.rows[0]?.n) === 2,
                                    dis.error || dis1.error || JSON.stringify({ after, n: flags.rows[0]?.n }));
                            });
                            await as(U.tim, async () => {
                                const r = ((await q(`select public.coaching_review_prompts() as p`)).rows[0]?.p || []).map(x => x.id);
                                check("Jeder sieht nur seine eigenen Coachings", !r.includes(V(1)) && r.includes(V(3)), JSON.stringify(r));
                            });
                            await db.exec(`update public.coaching_bookings set review_asked_at = null where id in ('${V(1)}', '${V(2)}', '${V(3)}', '${V(4)}')`);
                            const runNow38 = async () => { await db.exec(`update public.coaching_reminder_runs set last_run = '-infinity'`); return (await one(`select public.coaching_reminder_run() as r`)).r; };
                            const mails = ((await runNow38())?.bewertungen || []).map(x => x.id);
                            check("E-Mail nur als späte Erinnerung: nach 3 Tagen, nicht nach „Nicht bewerten“, nicht vorher",
                                mails.includes(V(3)) && !mails.includes(V(2)) && !mails.includes(V(1)) && !mails.includes(V(4)), JSON.stringify(mails));
                            await as(K, async () => {
                                const r = await q(`select public.coaching_book_v2('${off38}', null, null, null, null)`);
                                check("Interne Buchungsfunktion für Mitglieder gesperrt", r.error !== null, r.error || "durchgelassen!");
                            });
                        }
                    }
                }
            }
        }
    }
}

// --- 039: Setup-Zähler geschützt (Lücke: eigene Likes selbst setzen → Coach-Lizenz), Download-Zähler ---
if (ZAEHLER_SQL && SETUPHUB_SQL) {
    const T3 = "40000000-0000-0000-0000-000000000003"; // Tims älteres Setup
    const D1 = "60000000-0000-0000-0000-000000000391", D2 = "60000000-0000-0000-0000-000000000392", POLE = "30000000-0000-0000-0000-000000000003";
    await db.exec(`insert into auth.users (id) values ('${D1}'), ('${D2}') on conflict do nothing;
                   insert into public.profiles (id, username) values ('${D1}', 'Lader1'), ('${D2}', 'Lader2') on conflict do nothing;`);
    const counts = async (id) => one(`select coalesce(likes, 0) as l, coalesce(dislikes, 0) as d from public.setups where id = '${id}'`);
    const orig = await counts(T3);
    const vorher = await as(U.tim, async () => (await q(`update public.setups set likes = 500 where id = '${T3}' returning likes`)).rows[0]?.likes);
    check("Vorher (Lücke): Eigentümer konnte die Likes des eigenen Setups selbst setzen", Number(vorher) === 500, String(vorher));
    await db.exec(`update public.setups set likes = ${orig.l} where id = '${T3}'`);

    await db.exec(readFileSync(ZAEHLER_SQL, "utf8"));
    const ctl39 = await db.exec(readFileSync(ZAEHLER_SQL, "utf8")); // zweiter Lauf
    const rows39 = ctl39[ctl39.length - 1].rows;
    console.log("Kontrolle 039:\n  " + rows39.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 039: Zähler geschützt, Download-Zähler bereit", rows39.slice(0, 2).map(r => r.ergebnis).join(",") === "bereit,bereit", rows39.map(r => r.ergebnis).join(", "));

    await as(U.tim, async () => {
        const r = await q(`update public.setups set likes = 500, dislikes = 0, download_count = 99, car_model = 'Altes Setup (Zählertest)' where id = '${T3}' returning likes, dislikes, download_count, car_model`);
        const row = r.rows[0];
        check("Nachher: Eigentümer bearbeitet sein Setup, die Zähler bleiben unverändert",
            r.error === null && row?.car_model === "Altes Setup (Zählertest)" && Number(row?.likes) === Number(orig.l) && Number(row?.dislikes) === Number(orig.d) && Number(row?.download_count) === 0,
            r.error || JSON.stringify(row));
    });
    await as(D1, async () => {
        const ins = await q(`insert into public.setups (simulation, car_model, track_name, file_url, file_name, uploader_id, likes, dislikes, download_count)
                             values ('iRacing', 'Zählertest', 'Spa', 'https://x/z.sto', 'z.sto', '${D1}', 999, 7, 50) returning likes, dislikes, download_count`);
        const n = ins.rows[0];
        check("Nachher: Neues Setup startet immer bei 0 Likes, 0 Dislikes, 0 Downloads",
            ins.error === null && Number(n?.likes) === 0 && Number(n?.dislikes) === 0 && Number(n?.download_count) === 0, ins.error || JSON.stringify(n));
    });
    // Ein vorhandenes öffentliches Setup eines anderen Mitglieds für die weiteren Prüfungen
    const SX = await one(`select id::text as id, uploader_id::text as owner from public.setups
                          where not coalesce(is_pro, false) and uploader_id is not null and uploader_id::text not in ('${D1}', '${D2}', '${POLE}')
                          order by created_at limit 1`);
    await as(U.admin, async () => {
        await q(`update public.setups set likes = 777 where id = '${SX.id}'`);
    });
    check("Auch Website-Admins setzen Zähler nicht direkt", Number((await counts(SX.id)).l) !== 777, String((await counts(SX.id)).l));
    const sxLikes = Number((await counts(SX.id)).l);
    await as(D1, async () => {
        const v = await q(`select * from public.vote_setup('${SX.id}', 1)`);
        check("Abstimmen über die Funktion zählt weiterhin", v.error === null && v.rows[0]?.new_likes === sxLikes + 1, v.error || JSON.stringify(v.rows[0]));
        await q(`select * from public.vote_setup('${SX.id}', 0)`);
    });
    check("Stimme zurücknehmen zählt weiterhin zurück", Number((await counts(SX.id)).l) === sxLikes, String((await counts(SX.id)).l));

    // Download-Zähler
    const dl = async (uid, id) => as(uid, async () => q(`select public.setup_register_download('${id}') as n`));
    const a1 = await dl(D1, SX.id), a2 = await dl(D1, SX.id), b1 = await dl(D2, SX.id);
    check("Download zählt einmal pro Person (zweiter Download derselben Person zählt nicht)",
        a1.rows[0]?.n === 1 && a2.rows[0]?.n === 1 && b1.rows[0]?.n === 2, a1.error || a2.error || b1.error || JSON.stringify([a1.rows[0], a2.rows[0], b1.rows[0]]));
    const own = await dl(SX.owner, SX.id);
    check("Eigene Downloads zählen nicht", own.error === null && own.rows[0]?.n === 2, own.error || JSON.stringify(own.rows[0]));
    const guest = await dl(null, SX.id);
    check("Gäste werden nicht gezählt (Funktion für Gäste gesperrt)", guest.error !== null, guest.error || "durchgelassen!");
    const gone = await dl(D1, "40000000-0000-0000-0000-000000000999");
    check("Unbekanntes Setup: verständliche Meldung", /gibt es nicht mehr/.test(gone.error || ""), gone.error || "durchgelassen!");
    await as(D1, async () => {
        const read = await q(`select * from public.setup_downloads`);
        check("Liste der Downloads nicht lesbar (wer was geladen hat, bleibt privat)", read.error !== null, read.error || `${read.rows.length} Zeilen sichtbar`);
        const fake = await q(`insert into public.setup_downloads (setup_id, user_id) values ('${S2}', '${D1}')`);
        check("Downloads nicht direkt eintragbar", fake.error !== null, fake.error || "durchgelassen!");
    });
    const proSetup = (await one(`select id::text as id from public.setups where is_pro order by created_at limit 1`))?.id;
    if (proSetup) {
        const free = await dl(D1, proSetup);
        check("Pro Setup: ohne Abo kein Download-Zähler", /nur Abonnenten/.test(free.error || ""), free.error || "durchgelassen!");
        const pole = await dl(POLE, proSetup);
        check("Pro Setup: mit Abo wird gezählt", pole.error === null && pole.rows[0]?.n === 1, pole.error || JSON.stringify(pole.rows[0]));
    }
    await db.exec(`insert into public.user_bans (user_id, banned_until, reason) values ('${D2}', now() + interval '1 day', 'Test 039')`);
    const banned = await dl(D2, S2);
    check("Gesperrte Konten zählen nicht", /gesperrt/.test(banned.error || ""), banned.error || "durchgelassen!");
    await db.exec(`delete from public.user_bans where reason = 'Test 039'`);
    const fn = await one(`select has_function_privilege('authenticated', 'public.setups_protect_counters()', 'EXECUTE') as ok`);
    check("Schutzfunktion nicht direkt aufrufbar", fn.ok === false, String(fn.ok));
}

// --- 040: Globale Suche – nur, was die suchende Person auch sonst sehen darf ---
if (SUCHE_SQL && ZAEHLER_SQL) {
    const id = (n) => `70000000-0000-0000-0000-0000000004${String(n).padStart(2, "0")}`;
    const ICH = id(1), PARTNER = id(2), FREMD = id(3);
    const C1 = id(11), C2 = id(12), GRP = id(13), FOR = id(14);
    const M = (n) => id(20 + n);
    await db.exec(`
      insert into auth.users (id) values ('${ICH}'), ('${PARTNER}'), ('${FREMD}');
      insert into public.profiles (id, username, gsra_id) values ('${ICH}', 'Sucherin', 904001), ('${PARTNER}', 'Max Verstappen 123', 904002), ('${FREMD}', 'Wolkenfremder', 904003);
      insert into public.chats (id, user1_id, user2_id, title, is_public) values
        ('${C1}', '${ICH}', '${PARTNER}', null, false),
        ('${C2}', '${FREMD}', '${U.anna}', null, false),
        ('${GRP}', '${FREMD}', '${FREMD}', 'Wolken-Gruppe privat', false),
        ('${FOR}', '${FREMD}', '${FREMD}', 'Wolken-Forum', true);
      insert into public.chat_members (chat_id, user_id, role) values ('${GRP}', '${FREMD}', 'admin'), ('${FOR}', '${FREMD}', 'admin') on conflict do nothing;
      insert into public.messages (id, chat_id, sender_id, text, created_at) values
        ('${M(1)}', '${C1}', '${PARTNER}', 'Schau dir die Wolke über Spa an', now() - interval '2 hours'),
        ('${M(2)}', '${C1}', '${PARTNER}', 'Noch eine Wolke (für mich ausgeblendet)', now() - interval '1 hour'),
        ('${M(3)}', '${C2}', '${FREMD}', 'Geheime Wolke im fremden Chat', now()),
        ('${M(4)}', '${GRP}', '${FREMD}', 'Wolke in der privaten Gruppe', now()),
        ('${M(5)}', '${FOR}', '${FREMD}', 'Wolke im Forum (nur für Mitglieder)', now()),
        ('${M(6)}', '${C1}', '${ICH}', 'Diese Nachricht wurde gelöscht', now());
      insert into public.message_hides (user_id, message_id) values ('${ICH}', '${M(2)}');
      insert into public.setups (simulation, car_model, track_name, file_name, file_url, uploader_id) values ('iRacing', 'Porsche 911 GT3 R', 'Wolkenstein', 'w.sto', 'https://x/w.sto', '${FREMD}');
      insert into public.marketplace (user_id, title, price, status) values ('${FREMD}', 'Wolken-Lenkrad', 100, 'aktiv'), ('${FREMD}', 'Wolken-Pedale', 50, 'verkauft');
      insert into public.events (title, simulation, track, event_date) values ('Wolkenrennen', 'ACC', 'Monza', now() + interval '1 day'), ('Altes Wolkenrennen', 'ACC', 'Monza', now() - interval '3 days');`);
    await db.exec(readFileSync(SUCHE_SQL, "utf8"));
    const ctl40 = await db.exec(readFileSync(SUCHE_SQL, "utf8")); // zweiter Lauf
    const rows40 = ctl40[ctl40.length - 1].rows;
    console.log("Kontrolle 040:\n  " + rows40.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 040: Indizes, Suchfunktion, Rechte", rows40.map(r => r.ergebnis).join(",") === "bereit,bereit,ja", rows40.map(r => r.ergebnis).join(", "));

    // Jeder Suchfehler zählt als eigener Fehler – kein Test soll „aus Versehen“ bestehen
    const suche = async (uid, begriff) => as(uid, async () => {
        const r = await q(`select public.gsra_search('${begriff.replace(/'/g, "''")}') as r`);
        if (r.error) check(`Suche „${begriff}“ ohne Fehler`, false, r.error);
        return r.error ? { error: r.error } : r.rows[0].r;
    });
    const ids = (list) => (list || []).map(x => x.id);

    const ich = await suche(ICH, "Wolke");
    check("Nachricht aus dem eigenen Chat gefunden (mit Absender und Ausschnitt)",
        ids(ich.nachrichten).includes(M(1)) && ich.nachrichten.find(n => n.id === M(1))?.sender === "Max Verstappen 123" && /Wolke/.test(ich.nachrichten.find(n => n.id === M(1))?.snippet || ""),
        JSON.stringify(ich.nachrichten || ich.error));
    check("Fremde Chats, fremde private Gruppen und Foren ohne Mitgliedschaft: keine Nachrichten",
        !ids(ich.nachrichten).some(x => [M(3), M(4), M(5)].includes(x)), JSON.stringify(ids(ich.nachrichten)));
    check("„Für mich gelöscht“ wird nicht gefunden", !ids(ich.nachrichten).includes(M(2)), JSON.stringify(ids(ich.nachrichten)));
    const geloescht = await suche(ICH, "gelöscht");
    check("Gelöschte Nachrichten werden nicht gefunden", !ids(geloescht.nachrichten).includes(M(6)), JSON.stringify(ids(geloescht.nachrichten)));
    check("Öffentliches Forum gefunden (ohne Inhalte), private fremde Gruppe nicht",
        ids(ich.foren).includes(FOR) && ich.foren.find(f => f.id === FOR)?.is_member === false && !ids(ich.foren).includes(GRP), JSON.stringify(ich.foren));
    check("Marktplatz ohne verkaufte Inserate", (ich.marktplatz || []).length === 1 && ich.marktplatz[0].title === "Wolken-Lenkrad", JSON.stringify(ich.marktplatz));
    check("Rennen: nur anstehende", (ich.rennen || []).map(r => r.title).join() === "Wolkenrennen", JSON.stringify(ich.rennen));
    check("Mitglieder: Name gefunden", ids(ich.mitglieder).includes(FREMD), JSON.stringify(ich.mitglieder));
    const perId = await suche(ICH, "904002");
    check("Mitglieder: GSRA-ID gefunden", ids(perId.mitglieder)[0] === PARTNER, JSON.stringify(perId.mitglieder));
    const tipp = await suche(ICH, "Porche");
    check("Tippfehler: „Porche“ findet „Porsche“-Setups", (tipp.setups || []).length > 0 && tipp.setups.every(s => /Porsche/.test(s.car_model)),
        JSON.stringify((tipp.setups || []).map(s => s.car_model)));

    const fremd = await suche(FREMD, "Wolke");
    check("Die andere Seite findet ihre eigenen Nachrichten, aber nicht die aus meinem Chat",
        ids(fremd.nachrichten).includes(M(3)) && ids(fremd.nachrichten).includes(M(4)) && !ids(fremd.nachrichten).includes(M(1)), JSON.stringify(ids(fremd.nachrichten)));

    await db.exec(`insert into public.user_blocks (blocker_id, blocked_id) values ('${ICH}', '${PARTNER}')`);
    const blockiert = await suche(ICH, "Wolke");
    const blockName = await suche(ICH, "Verstappen");
    check("Blockierte: weder ihre Nachrichten noch sie selbst", !ids(blockiert.nachrichten).includes(M(1)) && !ids(blockName.mitglieder).includes(PARTNER),
        JSON.stringify({ n: ids(blockiert.nachrichten), m: ids(blockName.mitglieder) }));
    await db.exec(`delete from public.user_blocks where blocker_id = '${ICH}'`);

    const gast = await suche(null, "Wolke");
    check("Gäste: Setups und Marktplatz, aber keine Mitglieder, Nachrichten, Foren oder Rennen",
        (gast.setups || []).length > 0 && (gast.marktplatz || []).length > 0 && !gast.mitglieder && !gast.nachrichten && !gast.foren && !gast.rennen, JSON.stringify(gast));
    const kurz = await suche(ICH, "W");
    check("Ein Zeichen: keine Suche", JSON.stringify(kurz) === "{}", JSON.stringify(kurz));
    const zwei = await suche(ICH, "Wo");
    check("Zwei Zeichen: Rubriken ja, Nachrichten erst ab 3 Zeichen", Array.isArray(zwei.setups) && zwei.nachrichten === undefined, JSON.stringify(Object.keys(zwei)));
    const platzhalter = await suche(ICH, "%%");
    check("Platzhalter % liefert nicht einfach alles", (platzhalter.setups || []).length === 0 && (platzhalter.marktplatz || []).length === 0 && (platzhalter.mitglieder || []).length === 0,
        JSON.stringify(platzhalter));
    const sqlTest = await suche(ICH, "'); drop table public.messages; --");
    check("Eingaben mit SQL-Zeichen sind harmlos", !sqlTest.error && (await one(`select count(*) as n from public.messages`)).n > 0, sqlTest.error || "");
}

// --- 041: Setups im Chat – nur eigene Datei im eigenen Chat-Ordner, nur Setup-Endungen, nicht austauschbar ---
if (CHAT_SETUPS_SQL && SUCHE_SQL) {
    const id = (n) => `71000000-0000-0000-0000-0000000004${String(n).padStart(2, "0")}`;
    const SEND = id(1), PART = id(2), AUSSEN = id(3), CS = id(11), ANDERER = id(12);
    await db.exec(`
      insert into auth.users (id) values ('${SEND}'), ('${PART}'), ('${AUSSEN}');
      insert into public.profiles (id, username) values ('${SEND}', 'SetupSender'), ('${PART}', 'SetupPartner'), ('${AUSSEN}', 'SetupAussen');
      insert into public.chats (id, user1_id, user2_id, title, is_public) values ('${CS}', '${SEND}', '${PART}', null, false), ('${ANDERER}', '${PART}', '${AUSSEN}', null, false);`);
    await db.exec(readFileSync(CHAT_SETUPS_SQL, "utf8"));
    const ctl41 = await db.exec(readFileSync(CHAT_SETUPS_SQL, "utf8")); // zweiter Lauf
    const rows41 = ctl41[ctl41.length - 1].rows;
    console.log("Kontrolle 041:\n  " + rows41.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 041: Spalten, Schutzregel, Speicher", rows41.map(r => r.ergebnis).join(",") === "bereit,bereit,ja", rows41.map(r => r.ergebnis).join(", "));

    const meta = (o = {}) => JSON.stringify({ kind: "setup", sim: "iRacing", size: 2048, sub: "bmwm4gt3", ...o }).replace(/'/g, "''");
    const send = async (uid, { chat = CS, path, name = "Spa Quali.sto", m = meta() } = {}) => as(uid, async () =>
        q(`insert into public.messages (chat_id, sender_id, text, file_path, file_name, file_meta)
           values ('${chat}', '${uid}', '[Setup] x', '${(path || `${chat}/${uid}/setup_1.sto`).replace(/'/g, "''")}', '${name.replace(/'/g, "''")}', '${m}'::jsonb) returning id`));
    const ok = await send(SEND);
    check("Setup-Datei im eigenen Chat senden", ok.error === null && ok.rows.length === 1, ok.error || "");
    const okAcc = await send(SEND, { path: `${CS}/${SEND}/setup_2.json`, name: "monza_q.json", m: meta({ sim: "ACC", sub: "bmw_m4_gt3/monza" }) });
    check("ACC-Setup mit Auto- und Streckenordner", okAcc.error === null, okAcc.error || "");
    const msgId = ok.rows[0]?.id;

    const fremderOrdner = await send(SEND, { path: `${CS}/${PART}/setup_3.sto` });
    check("Datei aus dem Ordner einer anderen Person: abgelehnt", fremderOrdner.error !== null, fremderOrdner.error || "durchgelassen!");
    const andererChat = await send(SEND, { path: `${ANDERER}/${SEND}/setup_4.sto` });
    check("Datei aus einem anderen Chat: abgelehnt", andererChat.error !== null, andererChat.error || "durchgelassen!");
    const punkte = await send(SEND, { path: `${CS}/${SEND}/..` });
    check("Speichername „..“: abgelehnt", punkte.error !== null, punkte.error || "durchgelassen!");
    const falscheEndung = await send(SEND, { name: "spa.json" });
    check("Endung passt nicht zur Simulation: abgelehnt", /passt nicht zur Simulation/.test(falscheEndung.error || ""), falscheEndung.error || "durchgelassen!");
    const html = await send(SEND, { name: "boese.html", m: meta({ sim: "iRacing" }) });
    check("Keine Webseiten oder Programme als „Setup“ (.html)", html.error !== null, html.error || "durchgelassen!");
    const gross = await send(SEND, { m: meta({ size: 6 * 1024 * 1024 }) });
    check("Größer als 5 MB: abgelehnt", /5 MB/.test(gross.error || ""), gross.error || "durchgelassen!");
    const trick = await send(SEND, { m: meta({ sub: "../../Windows" }) });
    check("Ordner-Hinweis mit „..“: abgelehnt", /Ordner-Hinweis/.test(trick.error || ""), trick.error || "durchgelassen!");
    const skript = await send(SEND, { m: meta({ sub: "<script>alert(1)</script>" }) });
    check("Ordner-Hinweis mit Sonderzeichen: abgelehnt", skript.error !== null, skript.error || "durchgelassen!");
    const extra = await send(SEND, { m: JSON.stringify({ kind: "setup", sim: "iRacing", size: 5, url: "https://boese.example" }) });
    check("Zusätzliche Felder (z. B. fremder Link): abgelehnt", extra.error !== null, extra.error || "durchgelassen!");
    const pfadName = await send(SEND, { name: "../../spa.sto" });
    check("Dateiname mit Pfad: abgelehnt", pfadName.error !== null, pfadName.error || "durchgelassen!");
    const aussen = await send(AUSSEN, { path: `${CS}/${AUSSEN}/setup_5.sto` });
    check("Nicht-Mitglied kann nichts in den Chat schicken", aussen.error !== null || aussen.rows.length === 0, aussen.error || "durchgelassen!");

    await as(SEND, async () => {
        const tausch = await q(`update public.messages set file_path = '${CS}/${SEND}/anders.sto' where id = '${msgId}'`);
        check("Anhang nachträglich austauschen: abgelehnt", /nicht nachträglich austauschen/.test(tausch.error || ""), tausch.error || "durchgelassen!");
        const text = await q(`insert into public.messages (chat_id, sender_id, text) values ('${CS}', '${SEND}', 'Ganz normale Nachricht') returning id`);
        check("Normale Nachrichten unverändert möglich", text.error === null, text.error || "");
    });
    // Entfernen (z. B. „für alle löschen“) räumt auch Name und Angaben mit ab
    await db.exec(`update public.messages set file_path = null where id = '${msgId}'`);
    const weg = await one(`select file_name, file_meta from public.messages where id = '${msgId}'`);
    check("Anhang entfernen räumt Name und Angaben mit ab", weg.file_name === null && weg.file_meta === null, JSON.stringify(weg));
    const fn = await one(`select has_function_privilege('authenticated', 'public.messages_file_guard()', 'EXECUTE') as ok`);
    check("Schutzfunktion nicht direkt aufrufbar", fn.ok === false, String(fn.ok));
}

// --- 042: E-Mail bei neuem Gerät – Prüfung nur für den Server, erstes Gerät still, neues Gerät genau ein Hinweis ---
if (GERAET_SQL && CHAT_SETUPS_SQL) {
    const id = (n) => `72000000-0000-0000-0000-0000000004${String(n).padStart(2, "0")}`;
    const NEU = id(1), ALT = id(2), FLUT = id(3);
    const UA = {
        winChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        winChromeNeu: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
        iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
        ipad: "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
        android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
        samsung: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Safari/537.36",
        linuxFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
        mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    };
    // auth.sessions wie in Supabase (nur die Spalten, die 042 liest)
    await db.exec(`
      create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
        created_at timestamptz default now(), updated_at timestamptz, user_agent text, ip inet);
      insert into auth.users (id) values ('${NEU}'), ('${ALT}'), ('${FLUT}');
      insert into public.profiles (id, username) values ('${NEU}', 'Neufahrer'), ('${ALT}', 'Altfahrer'), ('${FLUT}', 'Flutfahrer');
      insert into auth.sessions (user_id, user_agent, ip, created_at) values ('${ALT}', '${UA.winChrome}', '84.132.10.20', now() - interval '3 days');`);
    await db.exec(readFileSync(GERAET_SQL, "utf8"));
    const ctl42 = await db.exec(readFileSync(GERAET_SQL, "utf8")); // zweiter Lauf
    const rows42 = ctl42[ctl42.length - 1].rows;
    console.log("Kontrolle 042:\n  " + rows42.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 042: Tabellen, nur Server, Anmeldungen lesbar (Zeitplan braucht pg_cron)",
        rows42.slice(0, 3).map(r => r.ergebnis).join(",") === "bereit,ja,ja", rows42.map(r => r.ergebnis).join(", "));

    const label = async (ua) => (await one(`select public.device_label('${ua}') as l`)).l;
    check("Gerätebeschreibung: Chrome auf Windows", await label(UA.winChrome) === "Chrome auf Windows (Computer)", await label(UA.winChrome));
    check("Gerätebeschreibung: Edge wird nicht als Chrome erkannt", await label(UA.winEdge) === "Edge auf Windows (Computer)", await label(UA.winEdge));
    check("Gerätebeschreibung: iPhone, iPad, Android-Handy, Samsung-Tablet, Mac",
        [await label(UA.iphone), await label(UA.ipad), await label(UA.android), await label(UA.samsung), await label(UA.mac)].join(" | ")
        === "Safari auf iOS (Handy) | Safari auf iOS (Tablet) | Chrome auf Android (Handy) | Samsung Internet auf Android (Tablet) | Safari auf macOS (Computer)",
        [await label(UA.iphone), await label(UA.ipad), await label(UA.android), await label(UA.samsung), await label(UA.mac)].join(" | "));
    const hint = await one(`select public.ip_hint('84.132.10.20') as v4, public.ip_hint('2a02:810d:1:2::5') as v6, public.ip_hint(null) as leer`);
    check("Netzwerk-Hinweis nur gekürzt (84.132.x.x, 2a02:810d:…)", hint.v4 === "84.132.x.x" && hint.v6 === "2a02:810d:…" && hint.leer === null, JSON.stringify(hint));
    const seeded = await one(`select count(*)::int as n from public.known_devices where user_id = '${ALT}' and label = 'Chrome auf Windows (Computer)'`);
    check("Beim Einspielen: Geräte laufender Sitzungen gelten als bekannt (keine E-Mail-Welle)", seeded.n === 1, String(seeded.n));

    const login = (uid, ua, ip = "91.12.3.4") => db.exec(`insert into auth.sessions (user_id, user_agent, ip) values ('${uid}', '${ua.replace(/'/g, "''")}', '${ip}')`);
    const run = async () => { await db.exec(`update public.device_scan set last_run = '-infinity'`); return (await one(`select public.device_alert_run() as r`)).r; };

    await login(NEU, UA.linuxFirefox);
    const r1 = await run();
    const neuGeraete = Number((await one(`select count(*) as n from public.known_devices where user_id = '${NEU}'`)).n);
    check("Erste Anmeldung eines Kontos: Gerät still gemerkt, keine E-Mail", r1.lauf === true && r1.hinweise.length === 0 && neuGeraete === 1, JSON.stringify(r1));

    await login(ALT, UA.winChromeNeu);
    const r2 = await run();
    check("Bekanntes Gerät (nur neuere Browser-Version): keine E-Mail", r2.hinweise.length === 0, JSON.stringify(r2));

    await login(ALT, UA.iphone, "91.12.3.4");
    const r3 = await run();
    const h = r3.hinweise[0] || {};
    check("Neues Gerät: genau ein Hinweis mit Gerät, gekürztem Netz und Name",
        r3.hinweise.length === 1 && h.geraet === "Safari auf iOS (Handy)" && h.netz === "91.12.x.x" && h.name === "Altfahrer" && h.user_id === ALT,
        JSON.stringify(r3));
    const r4 = await run();
    check("Kein zweites Mal für denselben Hinweis", r4.hinweise.length === 0, JSON.stringify(r4));
    const ipLeft = Number((await one(`select count(*) as n from public.device_alerts where ip_hint is not null`)).n);
    check("Netzwerk-Hinweis nach dem Versand gelöscht", ipLeft === 0, String(ipLeft));
    const gesperrt = await one(`select public.device_alert_run() as r`);
    check("Höchstens ein Lauf pro Minute (zweiter Aufruf sofort danach läuft nicht)", gesperrt.r.lauf === false, JSON.stringify(gesperrt.r));

    await login(FLUT, UA.winChrome);
    await run();
    for (const ua of [UA.iphone, UA.ipad, UA.android, UA.samsung, UA.mac]) await login(FLUT, ua);
    const flut = await run();
    check("Höchstens 3 E-Mails pro Konto und Stunde (5 neue Geräte → 3 Hinweise)", flut.hinweise.filter(x => x.user_id === FLUT).length === 3, String(flut.hinweise.length));

    await as(ALT, async () => {
        const eigen = await q(`select label from public.known_devices`);
        check("Mitglied sieht nur die eigenen Geräte", eigen.error === null && eigen.rows.length === 2, eigen.error || JSON.stringify(eigen.rows));
        const fremd = await q(`select label from public.known_devices where user_id = '${FLUT}'`);
        check("Geräte anderer Mitglieder unsichtbar", fremd.rows.length === 0, JSON.stringify(fremd.rows));
        const lauf = await q(`select public.device_alert_run()`);
        check("Mitglied kann die Prüfung nicht selbst auslösen", lauf.error !== null, lauf.error || "durchgelassen!");
        const hinweise = await q(`select * from public.device_alerts`);
        check("Mitglied kann keine Hinweise lesen", hinweise.error !== null, hinweise.error || "durchgelassen!");
        const faelschen = await q(`insert into public.known_devices (user_id, label) values ('${ALT}', 'Gefälschtes Gerät')`);
        check("Mitglied kann sich kein Gerät als bekannt eintragen", faelschen.error !== null, faelschen.error || "durchgelassen!");
        const sitzungen = await q(`select * from auth.sessions`);
        check("Anmeldungen (auth.sessions) für Mitglieder nicht lesbar", sitzungen.error !== null || sitzungen.rows.length === 0, sitzungen.error || `${sitzungen.rows.length} Zeilen`);
    });
    await as(null, async () => {
        const gast = await q(`select public.device_alert_run()`);
        check("Gast kann die Prüfung nicht auslösen", gast.error !== null, gast.error || "durchgelassen!");
        const geraete = await q(`select * from public.known_devices`);
        check("Gast sieht keine Geräte", geraete.error !== null || geraete.rows.length === 0, geraete.error || `${geraete.rows.length} Zeilen`);
    });
    await db.exec(`delete from auth.users where id = '${NEU}'`);
    const rest = Number((await one(`select count(*) as n from public.known_devices where user_id = '${NEU}'`)).n);
    check("Konto gelöscht: Geräte verschwinden mit", rest === 0, String(rest));
}

// --- 043: Unterstützen – Beträge privat, Wand nur freiwillig, Verbuchen nur durch den Server ---
if (UNTERSTUETZER_SQL && GERAET_SQL) {
    const id = (n) => `73000000-0000-0000-0000-0000000004${String(n).padStart(2, "0")}`;
    const UNT = id(1), STILL = id(2), NIE = id(3), SPERR = id(4);
    await db.exec(`
      insert into auth.users (id) values ('${UNT}'), ('${STILL}'), ('${NIE}'), ('${SPERR}');
      insert into public.profiles (id, username) values ('${UNT}', 'Unterstützer Uwe'), ('${STILL}', 'Stille Stefanie'), ('${NIE}', 'Noch Nicht'), ('${SPERR}', 'Gesperrter Gerd');`);
    await db.exec(readFileSync(UNTERSTUETZER_SQL, "utf8"));
    const ctl43 = await db.exec(readFileSync(UNTERSTUETZER_SQL, "utf8")); // zweiter Lauf
    const rows43 = ctl43[ctl43.length - 1].rows;
    console.log("Kontrolle 043:\n  " + rows43.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 043: Tabellen, Beträge privat, nur Server, Kündigung", rows43.map(r => r.ergebnis).join(",") === "bereit,ja,ja,bereit", rows43.map(r => r.ergebnis).join(", "));

    const apply = (ref, uid, kind = "einmalig", cents = 1000) => one(`select public.stripe_apply_support('${ref}', '${uid}', '${kind}', ${cents}, 'eur', 'cus_${ref}') as r`);
    const vorher = await as(NIE, async () => (await q(`select public.my_support() as s`)).rows[0]?.s);
    check("Ohne Unterstützung: Status „kein Unterstützer“", vorher?.unterstuetzer === false && vorher?.oeffentlich === false, JSON.stringify(vorher));
    await as(NIE, async () => {
        const sicht = await q(`select public.set_supporter_visibility(true) as v`);
        check("Sichtbarkeit lässt sich schon vor der ersten Unterstützung wählen", sicht.error === null && sicht.rows[0]?.v === true, sicht.error || "");
    });
    const wandLeer = await as(null, async () => q(`select username from public.supporter_wall()`));
    check("Wer noch nicht unterstützt hat, steht nicht auf der Wand (auch wenn „zeigen“ an ist)",
        wandLeer.error === null && !wandLeer.rows.some(r => r.username === "Noch Nicht"), wandLeer.error || JSON.stringify(wandLeer.rows));

    check("Server verbucht eine einmalige Unterstützung", (await apply("cs_043_1", UNT)).r === "verbucht");
    check("Dieselbe Zahlung wird nicht doppelt verbucht", (await apply("cs_043_1", UNT)).r === "bereits verbucht");
    await apply("cs_043_2", STILL, "einmalig", 2500);
    await apply("cs_043_3", SPERR, "einmalig", 500);
    await as(UNT, async () => { await q(`select public.set_supporter_visibility(true)`); });
    await as(SPERR, async () => { await q(`select public.set_supporter_visibility(true)`); });
    await db.exec(`insert into public.user_bans (user_id, banned_until, reason) values ('${SPERR}', now() + interval '1 day', 'Test 043')`);

    await as(null, async () => {
        const wand = await q(`select * from public.supporter_wall()`);
        const namen = wand.rows.map(r => r.username);
        check("Gäste sehen die Unterstützerwand", wand.error === null && namen.includes("Unterstützer Uwe"), wand.error || JSON.stringify(namen));
        check("Wand zeigt nur, wer es eingeschaltet hat (nicht die stille Unterstützerin)", !namen.includes("Stille Stefanie"), JSON.stringify(namen));
        check("Gesperrte Konten erscheinen nicht auf der Wand", !namen.includes("Gesperrter Gerd"), JSON.stringify(namen));
        const spalten = Object.keys(wand.rows[0] || {}).sort().join(",");
        check("Wand enthält keine Beträge (nur Name, Profilbild, Monat)", spalten === "avatar_url,seit,username", spalten);
        const badges = await q(`select * from public.supporter_badges(array['${UNT}', '${STILL}', '${NIE}']::uuid[])`);
        check("Abzeichen nur für öffentliche Unterstützer", badges.error === null && badges.rows.length === 1 && Object.values(badges.rows[0])[0] === UNT,
            badges.error || JSON.stringify(badges.rows));
        const status = await q(`select public.my_support()`);
        check("Gast: kein eigener Status abrufbar", status.error !== null, status.error || "durchgelassen!");
        const sicht = await q(`select public.set_supporter_visibility(true)`);
        check("Gast: Sichtbarkeit nicht änderbar", sicht.error !== null, sicht.error || "durchgelassen!");
        const zahl = await q(`select * from public.support_payments`);
        check("Gast: Zahlungen nicht lesbar", zahl.error !== null, zahl.error || `${zahl.rows.length} Zeilen`);
    });
    await as(STILL, async () => {
        const zahl = await q(`select amount_cents from public.support_payments`);
        check("Mitglied: Beträge nicht lesbar (auch nicht die eigenen)", zahl.error !== null, zahl.error || `${zahl.rows.length} Zeilen`);
        const tab = await q(`select * from public.supporters`);
        check("Mitglied: Tabelle der Unterstützer nicht direkt lesbar", tab.error !== null, tab.error || `${tab.rows.length} Zeilen`);
        const selbst = await q(`select public.stripe_apply_support('cs_fake', '${STILL}', 'einmalig', 1, 'eur', null)`);
        check("Mitglied kann sich nicht selbst als Unterstützer verbuchen", selbst.error !== null, selbst.error || "durchgelassen!");
        const direkt = await q(`insert into public.supporters (user_id, since, show_public) values ('${STILL}', now(), true)`);
        check("Mitglied kann sich nicht direkt eintragen", direkt.error !== null, direkt.error || "durchgelassen!");
        const s = (await q(`select public.my_support() as s`)).rows[0]?.s;
        check("Eigener Status: Unterstützer, nicht öffentlich, kein monatlicher Betrag sichtbar",
            s?.unterstuetzer === true && s?.oeffentlich === false && !("betrag" in (s || {})) && !("amount_cents" in (s || {})), JSON.stringify(s));
    });
    await as(SPERR, async () => {
        const aus = await q(`select public.set_supporter_visibility(false)`);
        check("Gesperrtes Konto kann die Sichtbarkeit nicht ändern", /gesperrt/.test(aus.error || ""), aus.error || "durchgelassen!");
    });
    await db.exec(`delete from public.user_bans where reason = 'Test 043'`);

    // Monatlich: Abo-Stand von Stripe; eine alte, beendete Unterstützung überschreibt keine laufende
    await one(`select public.stripe_sync_support('sub_043_neu', '${STILL}', 'cus_043', 'active', now() + interval '30 days', false)`);
    await one(`select public.stripe_sync_support('sub_043_alt', '${STILL}', 'cus_043', 'canceled', now() - interval '5 days', false)`);
    const monat = await as(STILL, async () => (await q(`select public.my_support() as s`)).rows[0]?.s);
    check("Monatliche Unterstützung läuft; altes beendetes Abo überschreibt sie nicht", monat?.monatlich === true && monat?.gekuendigt === false, JSON.stringify(monat));
    await one(`select public.stripe_sync_support('sub_043_neu', '${STILL}', 'cus_043', 'active', now() + interval '30 days', true)`);
    const gekuendigt = await as(STILL, async () => (await q(`select public.my_support() as s`)).rows[0]?.s);
    check("Gekündigt zum Laufzeitende wird angezeigt", gekuendigt?.monatlich === true && gekuendigt?.gekuendigt === true, JSON.stringify(gekuendigt));
    const neuMonat = await one(`select public.stripe_sync_support('sub_043_x', '${NIE}', null, 'active', now() + interval '30 days', false) as r`);
    const nieStatus = await as(NIE, async () => (await q(`select public.my_support() as s`)).rows[0]?.s);
    check("Erstes monatliches Abo macht zum Unterstützer", neuMonat.r === "abgeglichen" && nieStatus?.unterstuetzer === true && nieStatus?.monatlich === true, JSON.stringify(nieStatus));

    await db.exec(`delete from auth.users where id = '${UNT}'`);
    const nach = await one(`select (select count(*) from public.supporters where user_id = '${UNT}')::int as s,
                                   (select count(*) from public.support_payments where stripe_ref = 'cs_043_1' and user_id is null)::int as p`);
    check("Konto gelöscht: Eintrag weg, Zahlungsbeleg bleibt ohne Personenbezug (Buchhaltung)", nach.s === 0 && nach.p === 1, JSON.stringify(nach));
}

// --- 044: Karriere-Timeline – nur eigene Einträge, Grenzen, keine Gäste ---
if (KARRIERE_SQL && UNTERSTUETZER_SQL) {
    const id = (n) => `74000000-0000-0000-0000-0000000004${String(n).padStart(2, "0")}`;
    const K1 = id(1), K2 = id(2), KB = id(3);
    await db.exec(`
      insert into auth.users (id, created_at) values ('${K1}', now() - interval '400 days'), ('${K2}', now()), ('${KB}', now());
      insert into public.profiles (id, username) values ('${K1}', 'Karriere Kai'), ('${K2}', 'Leser Lars'), ('${KB}', 'Gesperrt Gabi');`);
    await db.exec(readFileSync(KARRIERE_SQL, "utf8"));
    const ctl44 = await db.exec(readFileSync(KARRIERE_SQL, "utf8")); // zweiter Lauf
    const rows44 = ctl44[ctl44.length - 1].rows;
    console.log("Kontrolle 044:\n  " + rows44.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 044: Tabelle, Gäste ausgeschlossen, Schutzregeln", rows44.map(r => r.ergebnis).join(",") === "bereit,ja,ja", rows44.map(r => r.ergebnis).join(", "));

    const neu = (uid, felder) => as(uid, async () => q(`insert into public.career_entries (year, kind, title, detail, link)
        values (${felder.year ?? 2024}, '${felder.kind ?? "team"}', '${(felder.title ?? "Team Blau").replace(/'/g, "''")}', ${felder.detail == null ? "null" : `'${felder.detail.replace(/'/g, "''")}'`},
                ${felder.link == null ? "null" : `'${felder.link.replace(/'/g, "''")}'`}) returning id, user_id, title, detail`));
    const ok1 = await neu(K1, { title: "  Langstrecken-Team Nordschleife\t", detail: "Fahrer\nund Stratege", link: "https://example.org/team" });
    check("Eigener Eintrag wird gespeichert, gehört automatisch der eigenen Person", ok1.error === null && ok1.rows[0]?.user_id === K1, ok1.error || "");
    check("Steuerzeichen und Rand-Leerzeichen werden entfernt", ok1.rows[0]?.title === "Langstrecken-Team Nordschleife" && ok1.rows[0]?.detail === "Fahrer und Stratege", JSON.stringify(ok1.rows[0]));
    const eintrag = ok1.rows[0]?.id;
    for (const [label, felder] of [
        ["Leerer Titel", { title: "   " }],
        ["Link ohne https (http)", { link: "http://example.org" }],
        ["Link mit javascript:", { link: "javascript:alert(1)" }],
        ["Link mit Anführungszeichen", { link: 'https://x.org/"><script>' }],
        ["Jahr außerhalb 1950–2100", { year: 1800 }],
        ["Unbekannte Art", { kind: "werbung" }],
        ["Beschreibung über 300 Zeichen", { detail: "x".repeat(301) }]]) {
        const r = await neu(K1, felder);
        check(`Abgelehnt: ${label}`, r.error !== null, r.error || "durchgelassen!");
    }
    const fremd = await as(K2, async () => q(`insert into public.career_entries (user_id, year, kind, title) values ('${K1}', 2020, 'erfolg', 'Gefälscht') returning id`));
    check("Niemand kann Einträge für andere Personen anlegen", fremd.error !== null, fremd.error || "durchgelassen!");
    await as(K2, async () => {
        const lesen = await q(`select title from public.career_entries where user_id = '${K1}'`);
        check("Andere Mitglieder sehen die Karriere", lesen.error === null && lesen.rows.length === 1, lesen.error || JSON.stringify(lesen.rows));
        const aendern = await q(`update public.career_entries set title = 'Übernommen' where id = '${eintrag}' returning id`);
        check("Fremde Einträge lassen sich nicht ändern", aendern.rows.length === 0, aendern.error || JSON.stringify(aendern.rows));
        const loeschen = await q(`delete from public.career_entries where id = '${eintrag}' returning id`);
        check("Fremde Einträge lassen sich nicht löschen", loeschen.rows.length === 0, loeschen.error || JSON.stringify(loeschen.rows));
    });
    const umhaengen = await as(K1, async () => q(`update public.career_entries set user_id = '${K2}', title = 'Neuer Titel' where id = '${eintrag}' returning user_id, title`));
    check("Eintrag lässt sich nicht einer anderen Person zuschieben", umhaengen.error !== null || umhaengen.rows[0]?.user_id === K1, umhaengen.error || JSON.stringify(umhaengen.rows));
    await as(null, async () => {
        const gast = await q(`select * from public.career_entries`);
        check("Gäste sehen keine Karriere", gast.error !== null, gast.error || `${gast.rows.length} Zeilen`);
        const m = await q(`select public.career_milestones('${K1}')`);
        check("Gäste sehen keine Meilensteine", m.error !== null, m.error || "durchgelassen!");
    });
    await db.exec(`insert into public.user_bans (user_id, banned_until, reason) values ('${KB}', now() + interval '1 day', 'Test 044')`);
    const gesperrt = await neu(KB, { title: "Spam" });
    check("Gesperrte Konten können nichts eintragen", gesperrt.error !== null, gesperrt.error || "durchgelassen!");
    await db.exec(`delete from public.user_bans where reason = 'Test 044'`);
    // Grenze: höchstens 40 Einträge
    await db.exec(`insert into public.career_entries (user_id, year, kind, title) select '${K1}', 2000 + g % 20, 'rennen', 'Rennen ' || g from generate_series(1, 39) g`);
    const zuviel = await neu(K1, { title: "Eintrag 41" });
    check("Höchstens 40 Einträge pro Person", /40 Karriere-Einträge/.test(zuviel.error || ""), zuviel.error || "durchgelassen!");
    // Meilensteine
    await db.exec(`insert into public.supporters (user_id, since, show_public) values ('${K1}', now() - interval '10 days', false) on conflict (user_id) do update set since = excluded.since, show_public = false`);
    const ms = await as(K2, async () => (await q(`select public.career_milestones('${K1}') as m`)).rows[0]?.m);
    check("Meilensteine: Mitglied seit vorhanden, nicht öffentliche Unterstützung bleibt verborgen",
        Boolean(ms?.mitglied_seit) && ms?.unterstuetzer_seit === null && ms?.pro_fahrer === false, JSON.stringify(ms));
    await db.exec(`update public.supporters set show_public = true where user_id = '${K1}'`);
    const ms2 = await as(K2, async () => (await q(`select public.career_milestones('${K1}') as m`)).rows[0]?.m);
    check("Meilensteine: öffentliche Unterstützung erscheint (ohne Betrag)", Boolean(ms2?.unterstuetzer_seit) && !JSON.stringify(ms2).includes("amount"), JSON.stringify(ms2));
    const fn44 = await one(`select has_function_privilege('authenticated', 'public.career_entries_guard()', 'EXECUTE') as ok`);
    check("Schutzfunktion nicht direkt aufrufbar", fn44.ok === false, String(fn44.ok));
}

// --- 045: Stint-Planer – nur Pole/Alliance (Datenbank prüft selbst), Team-Rollen, Versionen, Grenzen ---
if (STINTPLAN_SQL && KARRIERE_SQL) {
    const id = (n) => `75000000-0000-0000-0000-0000000004${String(n).padStart(2, "0")}`;
    const EIG = id(1), MIT = id(2), FREI = id(3), BLOCK = id(4), VIEL = id(5);
    await db.exec(`
      insert into auth.users (id) values ('${EIG}'), ('${MIT}'), ('${FREI}'), ('${BLOCK}'), ('${VIEL}');
      insert into public.profiles (id, username, gsra_id) values ('${EIG}', 'Planerin Pia', 945001), ('${MIT}', 'Mitfahrer Max', 945002),
        ('${FREI}', 'Paddock Paul', 945003), ('${BLOCK}', 'Blockiert Ben', 945004), ('${VIEL}', 'Viel Vera', 945005);
      insert into public.user_plans (user_id, status) values ('${EIG}', 'active'), ('${MIT}', 'active'), ('${BLOCK}', 'active'), ('${VIEL}', 'active');
      insert into public.user_blocks (blocker_id, blocked_id) values ('${EIG}', '${BLOCK}');`);
    await db.exec(readFileSync(STINTPLAN_SQL, "utf8"));
    const ctl45 = await db.exec(readFileSync(STINTPLAN_SQL, "utf8")); // zweiter Lauf
    const rows45 = ctl45[ctl45.length - 1].rows;
    console.log("Kontrolle 045:\n  " + rows45.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 045: Tabellen, Schreiben nur über Funktionen, Gäste ausgeschlossen (Realtime im Nachbau nicht vorhanden)",
        rows45.slice(0, 3).map(r => r.ergebnis).join(",") === "bereit,ja,ja", rows45.map(r => r.ergebnis).join(", "));

    const speichern = (uid, planId, name, data, version) => as(uid, async () =>
        q(`select public.stint_plan_save(${planId ? `'${planId}'` : "null"}, '${name}', '${JSON.stringify(data).replace(/'/g, "''")}'::jsonb, ${version ?? "null"}) as r`));
    const angelegt = await speichern(EIG, null, "24h Spa", { tank: 100, fahrer: [{ name: "<b>Pia</b>" }] });
    const PLAN = angelegt.rows[0]?.r?.id;
    check("Pole-Mitglied legt einen Plan an (Version 1)", angelegt.error === null && Boolean(PLAN) && angelegt.rows[0]?.r?.version === 1, angelegt.error || JSON.stringify(angelegt.rows[0]));
    const paddock = await speichern(FREI, null, "Gratis", {});
    check("Ohne Pole/Alliance kein Speichern (Datenbank prüft das Abo)", /Pole und Alliance/.test(paddock.error || ""), paddock.error || "durchgelassen!");
    await as(null, async () => {
        const gast = await q(`select public.stint_plan_save(null, 'x', '{}'::jsonb, null)`);
        check("Gäste können nichts speichern", gast.error !== null, gast.error || "durchgelassen!");
        const lesen = await q(`select * from public.stint_plans`);
        check("Gäste lesen keine Pläne", lesen.error !== null, lesen.error || `${lesen.rows.length} Zeilen`);
    });
    await as(EIG, async () => {
        const direkt = await q(`insert into public.stint_plans (owner_id, name) values ('${EIG}', 'direkt') returning id`);
        check("Pläne nicht direkt anlegbar (nur über die Funktion)", direkt.error !== null, direkt.error || "durchgelassen!");
        const direktAendern = await q(`update public.stint_plans set name = 'x' where id = '${PLAN}' returning id`);
        check("Pläne nicht direkt änderbar", direktAendern.error !== null, direktAendern.error || "durchgelassen!");
        const unbekannt = await q(`select public.stint_plan_member_add('${PLAN}', 999999, 'ansehen')`);
        check("Unbekannte GSRA-ID: verständliche Meldung", /kein Mitglied/.test(unbekannt.error || ""), unbekannt.error || "durchgelassen!");
        const ohneAbo = await q(`select public.stint_plan_member_add('${PLAN}', 945003, 'ansehen')`);
        check("Mitglied ohne Pole/Alliance kann nicht eingeladen werden", /kein Pole- oder Alliance-Abo/.test(ohneAbo.error || ""), ohneAbo.error || "durchgelassen!");
        const blockiert = await q(`select public.stint_plan_member_add('${PLAN}', 945004, 'ansehen')`);
        check("Blockierte Person kann nicht eingeladen werden", /nicht einladen/.test(blockiert.error || ""), blockiert.error || "durchgelassen!");
        const ok = await q(`select public.stint_plan_member_add('${PLAN}', 945002, 'ansehen') as n`);
        check("Pole-Mitglied per GSRA-ID eingeladen (Rolle: ansehen)", ok.error === null && ok.rows[0]?.n === "Mitfahrer Max", ok.error || JSON.stringify(ok.rows[0]));
    });
    await as(MIT, async () => {
        const lesen = await q(`select name, data from public.stint_plans where id = '${PLAN}'`);
        check("Teammitglied sieht den Plan", lesen.error === null && lesen.rows.length === 1, lesen.error || `${lesen.rows.length} Zeilen`);
        const nurAnsehen = await q(`select public.stint_plan_save('${PLAN}', 'Spa', '{}'::jsonb, 1)`);
        check("Rolle „ansehen“ kann nicht speichern", /nur ansehen/.test(nurAnsehen.error || ""), nurAnsehen.error || "durchgelassen!");
        const einladen = await q(`select public.stint_plan_member_add('${PLAN}', 945005, 'bearbeiten')`);
        check("Mitglieder können niemanden einladen (nur die Eigentümerin)", einladen.error !== null, einladen.error || "durchgelassen!");
        const team = await q(`select username, role from public.stint_plan_team('${PLAN}')`);
        check("Team-Liste mit Eigentümerin und Mitglied", team.error === null && team.rows.length === 2 && team.rows[0].role === "eigentuemer", team.error || JSON.stringify(team.rows));
        const liste = await q(`select name, role from public.stint_plan_list()`);
        check("Geteilter Plan erscheint in der eigenen Liste mit Rolle", liste.rows.some(r => r.name === "24h Spa" && r.role === "ansehen"), JSON.stringify(liste.rows));
    });
    await as(FREI, async () => {
        const lesen = await q(`select id from public.stint_plans`);
        check("Ohne Abo und ohne Einladung: keine fremden Pläne sichtbar", lesen.error === null && lesen.rows.length === 0, lesen.error || `${lesen.rows.length} Zeilen`);
        const team = await q(`select * from public.stint_plan_team('${PLAN}')`);
        check("Fremde sehen das Team nicht", team.error === null && team.rows.length === 0, team.error || `${team.rows.length} Zeilen`);
    });
    await as(EIG, async () => { await q(`select public.stint_plan_member_add('${PLAN}', 945002, 'bearbeiten')`); });
    const v2 = await speichern(MIT, PLAN, "24h Spa", { tank: 110 }, 1);
    check("Rolle „bearbeiten“ speichert (Version 2)", v2.error === null && v2.rows[0]?.r?.version === 2, v2.error || JSON.stringify(v2.rows[0]));
    const alt = await speichern(EIG, PLAN, "24h Spa", { tank: 90 }, 1);
    check("Veraltete Version wird abgelehnt – niemand überschreibt unbemerkt", /gerade von jemand anderem geändert/.test(alt.error || ""), alt.error || "durchgelassen!");
    const gross = await speichern(EIG, PLAN, "Riesig", { notiz: "x".repeat(70000) }, 2);
    check("Pläne über 64 KB werden abgelehnt", /zu groß/.test(gross.error || ""), gross.error || "durchgelassen!");
    // Abo endet → kein Zugriff mehr, auch nicht auf geteilte Pläne
    await db.exec(`update public.user_plans set status = 'canceled', current_period_end = now() - interval '10 days' where user_id = '${MIT}'`);
    const ohne = await as(MIT, async () => q(`select id from public.stint_plans where id = '${PLAN}'`));
    check("Abo beendet: geteilter Plan nicht mehr lesbar", ohne.error === null && ohne.rows.length === 0, ohne.error || `${ohne.rows.length} Zeilen`);
    await db.exec(`update public.user_plans set status = 'active', current_period_end = null where user_id = '${MIT}'`);
    // Gesperrt → kein Zugriff
    await db.exec(`insert into public.user_bans (user_id, banned_until, reason) values ('${MIT}', now() + interval '1 day', 'Test 045')`);
    const gesperrt = await as(MIT, async () => q(`select id from public.stint_plans where id = '${PLAN}'`));
    check("Gesperrtes Konto: kein Zugriff", gesperrt.error === null && gesperrt.rows.length === 0, gesperrt.error || `${gesperrt.rows.length} Zeilen`);
    await db.exec(`delete from public.user_bans where reason = 'Test 045'`);
    await as(MIT, async () => {
        const loeschen = await q(`select public.stint_plan_delete('${PLAN}')`);
        check("Mitglied kann den Plan nicht löschen", loeschen.error !== null, loeschen.error || "durchgelassen!");
        const austreten = await q(`select public.stint_plan_member_remove('${PLAN}', '${MIT}') as ok`);
        check("Mitglied kann selbst austreten", austreten.error === null && austreten.rows[0]?.ok === true, austreten.error || "");
    });
    // Grenzen: 25 Pläne pro Person, 60 Speichervorgänge pro Minute
    for (let i = 0; i < 25; i++) await speichern(VIEL, null, `Plan ${i}`, {});
    const plan26 = await speichern(VIEL, null, "Plan 26", {});
    check("Höchstens 25 eigene Pläne", /25 Stintpläne/.test(plan26.error || ""), plan26.error || "durchgelassen!");
    const vielPlan = (await as(VIEL, async () => q(`select id from public.stint_plans order by created_at limit 1`))).rows[0]?.id;
    let flut = null;
    for (let i = 0; i < 40 && !flut; i++) { const r = await speichern(VIEL, vielPlan, "Flut", { i }, null); if (r.error) flut = r.error; }
    check("Gegen Spam: höchstens 60 Speichervorgänge pro Minute", /Zu viele Speichervorgänge/.test(flut || ""), flut || "durchgelassen!");
    const eigLoeschen = await as(EIG, async () => q(`select public.stint_plan_delete('${PLAN}') as ok`));
    check("Eigentümerin löscht den Plan, das Team verschwindet mit",
        eigLoeschen.error === null && Number((await one(`select count(*) as n from public.stint_plan_members where plan_id = '${PLAN}'`)).n) === 0, eigLoeschen.error || "");
}

// Anmeldung mit vollständigen Ansprüchen (Zwei-Faktor-Stufe, Sitzung) für 046/047
const mitAnspruch = (uid, claims, fn) => as(uid, async () => {
    await db.exec(`set request.jwt.claims = '${JSON.stringify({ sub: uid, ...claims })}'`);
    try { return await fn(); } finally { await db.exec(`set request.jwt.claims = ''`); }
});

// --- 046: Liveries (Painter-Lizenz wie Coach, Pro-Painter durch Admins) und Videos (nur Pro-Fahrer und Admins) ---
if (LIVERIES_SQL && STINTPLAN_SQL) {
    const id = (n) => `76000000-0000-0000-0000-0000000004${String(n).padStart(2, "0")}`;
    const COACH = id(1), NEU = id(2), PROP = id(3), PROF = id(4), MOD6 = id(5), ABO = id(6);
    await db.exec(`
      insert into auth.users (id) values ('${COACH}'), ('${NEU}'), ('${PROP}'), ('${PROF}'), ('${MOD6}'), ('${ABO}');
      insert into public.profiles (id, username, gsra_id) values ('${COACH}', 'Coach Clara', 946001), ('${NEU}', 'Neuling Nils', 946002),
        ('${PROP}', 'Pro-Painter Paula', 946003), ('${PROF}', 'Pro-Fahrer Felix', 946004), ('${MOD6}', 'Moderator Mo', 946005), ('${ABO}', 'Abo Anton', 946006);
      update public.profiles set role = 'moderator' where id = '${MOD6}';
      insert into public.coach_licenses (user_id, granted_at) values ('${COACH}', now());
      insert into public.pro_creators (user_id) values ('${PROF}');
      insert into public.user_plans (user_id, status) values ('${ABO}', 'active');`);
    await db.exec(readFileSync(LIVERIES_SQL, "utf8"));
    const ctl46 = await db.exec(readFileSync(LIVERIES_SQL, "utf8")); // zweiter Lauf
    const rows46 = ctl46[ctl46.length - 1].rows;
    console.log("Kontrolle 046:\n  " + rows46.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 046: bereit, Schreiben nur über Funktionen, Gäste ausgeschlossen, Speicher bereit",
        rows46.map(r => r.ergebnis).join(",") === "bereit,ja,ja,bereit", rows46.map(r => r.ergebnis).join(", "));

    const angebot = (uid, title = "GT3-Designs", extra = "") => as(uid, async () => q(
        `select public.livery_offer_save(null, '${title}', 'Beschreibung', array['gt','prototyp'], array['iRacing','<b>x</b>'], 15000, 7, ${extra || "'{}'"}::text[], true) as id`));
    // Ohne Lizenz kein Angebot; Lizenz nur mit Voraussetzungen (hier: aktive Coach-Lizenz)
    const ohne = await angebot(NEU);
    check("Ohne Painter-Lizenz kein Livery-Angebot", /Painter mit Lizenz/.test(ohne.error || ""), ohne.error || "durchgelassen!");
    const claimNeu = await as(NEU, async () => q(`select public.painter_claim_license() as r`));
    check("Painter-Lizenz nur mit den Voraussetzungen der Coach-Lizenz", /noch nicht alle Voraussetzungen/.test(claimNeu.error || ""), claimNeu.error || "durchgelassen!");
    const claimCoach = await as(COACH, async () => q(`select public.painter_claim_license() as r`));
    check("Wer Coach ist, bekommt die Painter-Lizenz", claimCoach.error === null && claimCoach.rows[0]?.r === "erteilt", claimCoach.error || JSON.stringify(claimCoach.rows[0]));
    const a1 = await angebot(COACH);
    const OFFER = a1.rows[0]?.id;
    check("Painter legt ein Angebot an", a1.error === null && Boolean(OFFER), a1.error || "");
    const gespeichert = await one(`select simulations, painter_id from public.livery_offers where id = '${OFFER}'`);
    check("Simulationen mit Schadcode werden verworfen", JSON.stringify(gespeichert.simulations) === '["iRacing"]', JSON.stringify(gespeichert.simulations));
    const fremdesBild = await angebot(COACH, "Bild", `array['${NEU}/x.jpg']`);
    check("Beispielbilder nur aus dem eigenen Ordner", /Ungültiges Beispielbild/.test(fremdesBild.error || ""), fremdesBild.error || "durchgelassen!");
    const falscheKlasse = await as(COACH, async () => q(`select public.livery_offer_save(null, 'Klasse', '', array['panzer'], '{}', null, null, '{}', true)`));
    check("Nur bekannte Fahrzeugklassen", falscheKlasse.error !== null, falscheKlasse.error || "durchgelassen!");
    await as(COACH, async () => {
        const direkt = await q(`insert into public.livery_offers (painter_id, title, classes) values ('${COACH}', 'Direkt', array['gt'])`);
        check("Angebote nicht direkt anlegbar (nur über die Funktion)", direkt.error !== null, direkt.error || "durchgelassen!");
        const aendern = await q(`update public.livery_offers set active = true where id = '${OFFER}' returning id`);
        check("Angebote nicht direkt änderbar", aendern.error !== null, aendern.error || "durchgelassen!");
        const lizenz = await q(`insert into public.painter_licenses (user_id, granted_at) values ('${NEU}', now())`);
        check("Lizenzen nicht selbst eintragbar", lizenz.error !== null, lizenz.error || "durchgelassen!");
    });
    for (let i = 0; i < 4; i++) await angebot(COACH, `Angebot ${i}`);
    const sechstes = await angebot(COACH, "Zu viel");
    check("Höchstens 5 Angebote je Painter", /höchstens 5/.test(sechstes.error || ""), sechstes.error || "durchgelassen!");
    await as(NEU, async () => {
        const sicht = await q(`select id from public.livery_offers where id = '${OFFER}'`);
        check("Mitglieder sehen aktive Angebote", sicht.error === null && sicht.rows.length === 1, sicht.error || `${sicht.rows.length} Zeilen`);
        const fremd = await q(`select public.livery_offer_delete('${OFFER}')`);
        check("Fremde Angebote nicht löschbar", /gehört dir nicht/.test(fremd.error || ""), fremd.error || "durchgelassen!");
        const hoch = await q(`select public.gsra_upload_allowed('liveries', '${NEU}/bild.jpg') as ok`);
        check("Ohne Lizenz kein Hochladen von Beispielbildern", hoch.rows[0]?.ok === false, JSON.stringify(hoch.rows[0]));
    });
    await as(null, async () => {
        const gast = await q(`select id from public.livery_offers`);
        check("Gäste sehen keine Livery-Angebote", gast.error !== null, gast.error || `${gast.rows.length} Zeilen`);
    });
    // Pro-Painter: nur Admins tragen ein (mit Zwei-Faktor), dann ohne Lizenz anbieten
    const selbstPro = await as(PROP, async () => q(`insert into public.pro_painters (user_id) values ('${PROP}')`));
    check("Niemand macht sich selbst zum Pro-Painter", selbstPro.error !== null, selbstPro.error || "durchgelassen!");
    const proEin = await mitAnspruch(U.admin, { aal: "aal2" }, async () => q(`insert into public.pro_painters (user_id) values ('${PROP}')`));
    check("Admin trägt Pro-Painter ein", proEin.error === null, proEin.error || "");
    const proLog = await one(`select count(*) as n from public.moderation_log where action = 'pro_painter_hinzugefuegt' and target_user = '${PROP}'`);
    check("Eintragen steht im Moderationsprotokoll", Number(proLog.n) === 1, String(proLog.n));
    const proAngebot = await angebot(PROP, "Pro-Livery");
    check("Pro-Painter bietet ohne Lizenz an", proAngebot.error === null, proAngebot.error || "");
    // Moderation: entziehen pausiert die Angebote
    const modOhneGrund = await mitAnspruch(MOD6, { aal: "aal2" }, async () => q(`select public.painter_license_revoke('${COACH}', 'x')`));
    check("Entzug nur mit Begründung", /Begründung/.test(modOhneGrund.error || ""), modOhneGrund.error || "durchgelassen!");
    const modEntzug = await mitAnspruch(MOD6, { aal: "aal2" }, async () => q(`select public.painter_license_revoke('${COACH}', 'Fremde Designs als eigene ausgegeben')`));
    check("Moderation entzieht die Painter-Lizenz", modEntzug.error === null, modEntzug.error || "");
    const pausiert = await one(`select count(*) filter (where active) as aktiv from public.livery_offers where painter_id = '${COACH}'`);
    check("Nach Entzug sind alle Angebote pausiert", Number(pausiert.aktiv) === 0, String(pausiert.aktiv));
    const wiederHolen = await as(COACH, async () => q(`select public.painter_claim_license()`));
    check("Nach Entzug durch die Moderation kein neues Holen", /vom Moderationsteam entzogen/.test(wiederHolen.error || ""), wiederHolen.error || "durchgelassen!");
    const nichtSichtbar = await as(NEU, async () => q(`select id from public.livery_offers where painter_id = '${COACH}'`));
    check("Angebote ohne aktive Lizenz sind unsichtbar", nichtSichtbar.rows.length === 0, `${nichtSichtbar.rows.length} Zeilen`);
    const nutzerEntzug = await as(NEU, async () => q(`select public.painter_license_revoke('${PROP}', 'Ich mag das nicht')`));
    check("Normale Mitglieder können keine Lizenz entziehen", /Moderationsteam/.test(nutzerEntzug.error || ""), nutzerEntzug.error || "durchgelassen!");
    // Verwarnung: Pro-Painter wird automatisch gestoppt
    await db.exec(`insert into public.user_warnings (user_id, text) values ('${PROP}', 'Test 046')`);
    check("Verwarnung stoppt auch Pro-Painter automatisch", (await one(`select public.painter_active('${PROP}') as a`)).a === false);

    // Videos
    const video = (uid, url = "https://video.example/watch?v=1", thumb = "null") => as(uid, async () => q(
        `select public.video_save(null, '${url}', 'Hotlap in Interlagos', 'Heute fahren wir in Brasilien', array['#Fast','Allianz','<script>','Fast'], ${thumb}) as id`));
    const vAbo = await video(ABO);
    check("Abo-Mitglieder können keine Videos veröffentlichen", /Pro-Fahrer und Admins/.test(vAbo.error || ""), vAbo.error || "durchgelassen!");
    const vMod = await mitAnspruch(MOD6, { aal: "aal2" }, async () => q(`select public.video_save(null, 'https://video.example/a', 'Titel', '', '{}', null)`));
    check("Moderatoren können keine Videos veröffentlichen", /Pro-Fahrer und Admins/.test(vMod.error || ""), vMod.error || "durchgelassen!");
    const vPro = await video(PROF);
    const VID = vPro.rows[0]?.id;
    check("Pro-Fahrer veröffentlicht ein Video", vPro.error === null && Boolean(VID), vPro.error || "");
    const tags = (await one(`select tags from public.pro_videos where id = '${VID}'`)).tags;
    check("Hashtags bereinigt (ohne #, ohne Schadcode, ohne Doppelte)", JSON.stringify(tags) === '["Fast","Allianz"]', JSON.stringify(tags));
    const vHttp = await video(PROF, "javascript:alert(1)");
    check("Nur https-Links", /https:\/\//.test(vHttp.error || ""), vHttp.error || "durchgelassen!");
    const vBild = await video(PROF, "https://video.example/b", `'${NEU}/x.jpg'`);
    check("Vorschaubild nur aus dem eigenen Ordner", /Ungültiges Vorschaubild/.test(vBild.error || ""), vBild.error || "durchgelassen!");
    const vAdmin = await mitAnspruch(U.admin, { aal: "aal2" }, async () => q(`select public.video_save(null, 'https://video.example/c', 'Admin-Video', '', '{}', null) as id`));
    check("Admins veröffentlichen Videos", vAdmin.error === null, vAdmin.error || "");
    await as(NEU, async () => {
        const sicht = await q(`select title from public.pro_videos`);
        check("Alle Mitglieder sehen die Videos", sicht.error === null && sicht.rows.length >= 2, sicht.error || `${sicht.rows.length} Zeilen`);
        const direkt = await q(`insert into public.pro_videos (url, title) values ('https://x.example/aa', 'Direkt')`);
        check("Videos nicht direkt anlegbar", direkt.error !== null, direkt.error || "durchgelassen!");
        const loeschen = await q(`select public.video_delete('${VID}')`);
        check("Fremde Videos nicht löschbar", /gehört dir nicht/.test(loeschen.error || ""), loeschen.error || "durchgelassen!");
    });
    await as(null, async () => {
        const gast = await q(`select id from public.pro_videos`);
        check("Gäste sehen keine Videos (Seite nur mit Anmeldung)", gast.error !== null, gast.error || `${gast.rows.length} Zeilen`);
    });
    // Pro-Status weg → Videos verschwinden aus der Liste
    await db.exec(`delete from public.pro_creators where user_id = '${PROF}'`);
    const weg = await as(NEU, async () => q(`select id from public.pro_videos where id = '${VID}'`));
    check("Ohne Pro-Status sind die Videos nicht mehr sichtbar", weg.rows.length === 0, `${weg.rows.length} Zeilen`);
    await db.exec(`insert into public.pro_creators (user_id) values ('${PROF}')`);
    const modLoescht = await mitAnspruch(MOD6, { aal: "aal2" }, async () => q(`select public.video_delete('${VID}') as t`));
    check("Moderation kann Videos entfernen (mit Protokoll)", modLoescht.error === null
        && Number((await one(`select count(*) as n from public.moderation_log where action = 'video_geloescht'`)).n) === 1, modLoescht.error || "");
    const bucketOk = await as(PROF, async () => q(`select public.gsra_upload_allowed('videos', '${PROF}/v.jpg') as a, public.gsra_upload_allowed('videos', '${NEU}/v.jpg') as b`));
    check("Vorschaubilder nur in den eigenen Ordner", bucketOk.rows[0]?.a === true && bucketOk.rows[0]?.b === false, JSON.stringify(bucketOk.rows[0]));
    const fnIntern = await one(`select has_function_privilege('authenticated', 'public.painter_license_auto_revoke()', 'EXECUTE') as ok`);
    check("Automatischer Entzug nicht direkt aufrufbar", fnIntern.ok === false, String(fnIntern.ok));
}

// --- 047: Selbstlöschende Nachrichten, Beweissicherung, aktive Anmeldungen ---
if (CHATSICHER_SQL && LIVERIES_SQL) {
    const id = (n) => `77000000-0000-0000-0000-0000000004${String(n).padStart(2, "0")}`;
    const A = id(1), B = id(2), C = id(3), DC = id(4), GR = id(5);
    const S_A1 = "77000000-0000-0000-0000-0000000005a1", S_A2 = "77000000-0000-0000-0000-0000000005a2", S_B = "77000000-0000-0000-0000-0000000005b1";
    await db.exec(`
      insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}');
      insert into public.profiles (id, username) values ('${A}', 'Alex'), ('${B}', 'Bea'), ('${C}', 'Cem');
      insert into public.chats (id, user1_id, user2_id) values ('${DC}', '${A}', '${B}');
      insert into public.chats (id, user1_id, user2_id, title) values ('${GR}', '${A}', '${A}', 'Team Ablauf');
      insert into public.chat_members (chat_id, user_id, role) values ('${GR}', '${A}', 'admin'), ('${GR}', '${C}', 'member')
        on conflict (chat_id, user_id) do update set role = excluded.role;
      insert into auth.sessions (id, user_id, user_agent, ip, created_at) values
        ('${S_A1}', '${A}', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', '84.132.10.20', now() - interval '2 days'),
        ('${S_A2}', '${A}', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', '91.20.1.2', now() - interval '1 hour'),
        ('${S_B}', '${B}', 'Mozilla/5.0', '10.0.0.1', now());`);
    await db.exec(readFileSync(CHATSICHER_SQL, "utf8"));
    const ctl47 = await db.exec(readFileSync(CHATSICHER_SQL, "utf8")); // zweiter Lauf
    const rows47 = ctl47[ctl47.length - 1].rows;
    console.log("Kontrolle 047:\n  " + rows47.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 047: bereit, Löschlauf intern, Gäste ausgeschlossen, Anmeldungen beendbar (Zeitplan braucht pg_cron)",
        rows47.slice(0, 4).map(r => r.ergebnis).join(",") === "bereit,ja,ja,ja", rows47.map(r => r.ergebnis).join(", "));

    const senden = (uid, chat, text) => as(uid, async () => q(`insert into public.messages (chat_id, sender_id, text) values ('${chat}', '${uid}', '${text}') returning id, expires_at`));
    const vorher = await senden(A, DC, "Vor dem Timer");
    check("Ohne Timer kein Ablaufdatum", vorher.error === null && vorher.rows[0]?.expires_at === null, vorher.error || JSON.stringify(vorher.rows[0]));
    await as(A, async () => {
        const direkt = await q(`update public.chats set auto_delete_seconds = 3600 where id = '${GR}'`);
        const wert = (await one(`select auto_delete_seconds as s from public.chats where id = '${GR}'`)).s;
        check("Timer nicht direkt setzbar (auch nicht als Gruppenadmin)", wert === null, direkt.error || String(wert));
        const falsch = await q(`select public.chat_set_auto_delete('${DC}', 42)`);
        check("Nur feste Zeiten (1 Std., 1 Tag, 7 Tage, 30 Tage)", /Bitte wähle/.test(falsch.error || ""), falsch.error || "durchgelassen!");
        const ok = await q(`select public.chat_set_auto_delete('${DC}', 86400) as s`);
        check("Einzelchat: Teilnehmer schaltet 1 Tag ein", ok.error === null && ok.rows[0]?.s === 86400, ok.error || "");
    });
    const hinweis = await one(`select text from public.messages where chat_id = '${DC}' order by created_at desc limit 1`);
    check("Hinweis im Chat für alle sichtbar", /hat selbstlöschende Nachrichten eingeschaltet \(1 Tag\)/.test(hinweis?.text || ""), hinweis?.text);
    const nachher = await senden(B, DC, "Mit Timer");
    const abl = nachher.rows[0]?.expires_at ? (new Date(nachher.rows[0].expires_at).getTime() - Date.now()) / 3600000 : 0;
    check("Neue Nachricht läuft nach 1 Tag ab (von der Datenbank gesetzt)", nachher.error === null && abl > 23.5 && abl < 24.5, nachher.error || String(abl));
    const MSG = nachher.rows[0]?.id;
    const faelschen = await as(B, async () => q(`update public.messages set expires_at = now() + interval '10 years', text = 'Mit Timer' where id = '${MSG}' returning expires_at`));
    check("Ablaufdatum nachträglich nicht änderbar", faelschen.rows.length === 0 || new Date(faelschen.rows[0].expires_at).getTime() - Date.now() < 2 * 86400000,
        faelschen.error || JSON.stringify(faelschen.rows[0]));
    const fremd = await as(C, async () => q(`select public.chat_set_auto_delete('${DC}', 3600)`));
    check("Fremde können den Timer nicht umstellen", fremd.error !== null, fremd.error || "durchgelassen!");
    const mitglied = await as(C, async () => q(`select public.chat_set_auto_delete('${GR}', 3600)`));
    check("Gruppe: normale Mitglieder können den Timer nicht umstellen", /Gruppenadmins/.test(mitglied.error || ""), mitglied.error || "durchgelassen!");
    const admin = await as(A, async () => q(`select public.chat_set_auto_delete('${GR}', 604800) as s`));
    check("Gruppe: Gruppenadmin schaltet 7 Tage ein", admin.error === null && admin.rows[0]?.s === 604800, admin.error || "");
    const forum = await mitAnspruch(U.admin, { aal: "aal2" }, async () => q(`select public.chat_set_auto_delete('${FORUM}', 3600)`));
    check("Offizielles Forum: keine selbstlöschenden Nachrichten", /offiziellen Forum/.test(forum.error || ""), forum.error || "durchgelassen!");
    const gast = await as(null, async () => q(`select public.chat_set_auto_delete('${DC}', null)`));
    check("Gäste können nichts umstellen", gast.error !== null, gast.error || "durchgelassen!");
    // Ablauf: Nachricht künstlich altern lassen, Löschlauf, Beweissicherung prüfen
    await db.exec(`alter table public.messages disable trigger gsra_messages_set_expiry;
                   update public.messages set expires_at = now() - interval '1 minute' where id = '${MSG}';
                   update public.chats set last_message = 'Mit Timer' where id = '${DC}';
                   alter table public.messages enable trigger gsra_messages_set_expiry;`);
    const lauf = await as(B, async () => q(`select public.chat_expire_run()`));
    check("Löschlauf nicht für Mitglieder aufrufbar", lauf.error !== null, lauf.error || "durchgelassen!");
    await db.exec(`select public.chat_expire_run()`);
    const nochDa = Number((await one(`select count(*) as n from public.messages where id = '${MSG}'`)).n);
    check("Abgelaufene Nachricht ist gelöscht", nochDa === 0, String(nochDa));
    const bleibt = Number((await one(`select count(*) as n from public.messages where chat_id = '${DC}' and text = 'Vor dem Timer'`)).n);
    check("Nachrichten von vor dem Einschalten bleiben", bleibt === 1, String(bleibt));
    const kopie = await one(`select change_type from public.message_history where message_id::text = '${MSG}'`);
    check("Beweissicherung: Kopie nur für Admins, als „abgelaufen“ gekennzeichnet", kopie?.change_type === "abgelaufen (selbstlöschend)", JSON.stringify(kopie));
    const vorschau = (await one(`select last_message from public.chats where id = '${DC}'`)).last_message;
    check("Chatliste zeigt den abgelaufenen Text nicht mehr", vorschau !== "Mit Timer", vorschau);
    const aus = await as(B, async () => q(`select public.chat_set_auto_delete('${DC}', null) as s`));
    const neu = await senden(A, DC, "Wieder dauerhaft");
    check("Ausschalten: neue Nachrichten bleiben dauerhaft", aus.error === null && neu.rows[0]?.expires_at === null, aus.error || JSON.stringify(neu.rows[0]));

    // Aktive Anmeldungen
    const liste = await mitAnspruch(A, { session_id: S_A1 }, async () => q(`select * from public.my_sessions()`));
    check("Eigene Anmeldungen mit Gerät, grobem Netz und „diese Anmeldung“",
        liste.error === null && liste.rows.length === 2 && liste.rows.some(r => r.aktuell && r.id === S_A1) && liste.rows.every(r => /x\.x$/.test(r.netz || "")),
        liste.error || JSON.stringify(liste.rows));
    check("Gerätenamen lesbar (iOS, Windows)", liste.rows.some(r => /iOS/.test(r.geraet)) && liste.rows.some(r => /Windows/.test(r.geraet)), JSON.stringify(liste.rows.map(r => r.geraet)));
    const fremdEnde = await mitAnspruch(A, { session_id: S_A1 }, async () => q(`select public.end_session('${S_B}')`));
    check("Fremde Anmeldungen lassen sich nicht beenden", /bereits beendet/.test(fremdEnde.error || "") && Number((await one(`select count(*) as n from auth.sessions where id = '${S_B}'`)).n) === 1,
        fremdEnde.error || "durchgelassen!");
    const selbst = await mitAnspruch(A, { session_id: S_A1 }, async () => q(`select public.end_session('${S_A1}')`));
    check("Aktuelle Anmeldung nicht über die Liste beendbar (dafür „Abmelden“)", /diese Anmeldung hier/.test(selbst.error || ""), selbst.error || "durchgelassen!");
    const ende = await mitAnspruch(A, { session_id: S_A1 }, async () => q(`select public.end_session('${S_A2}')`));
    check("Andere eigene Anmeldung beendet", ende.error === null && Number((await one(`select count(*) as n from auth.sessions where id = '${S_A2}'`)).n) === 0, ende.error || "");
    const gastListe = await as(null, async () => q(`select * from public.my_sessions()`));
    check("Gäste sehen keine Anmeldungen", gastListe.error !== null, gastListe.error || "durchgelassen!");
    const bListe = await mitAnspruch(B, { session_id: S_B }, async () => q(`select * from public.my_sessions()`));
    check("Jeder sieht nur die eigenen Anmeldungen", bListe.rows.length === 1 && bListe.rows[0].id === S_B, JSON.stringify(bListe.rows));
}

// --- 048: Speicher aufräumen, Suche mit Videos/Liveries, Renningenieur (Einstellungen, Gedächtnis) ---
if (AUFRAEUMEN_SQL && CHATSICHER_SQL) {
    const id = (n) => `78000000-0000-0000-0000-0000000004${String(n).padStart(2, "0")}`;
    const A = id(1), B = id(2), PRO = id(3), CH = id(4);
    const URL = (p) => `https://x.supabase.co/storage/v1/object/public/chat_attachments/${p}`;
    await db.exec(`
      insert into auth.users (id) values ('${A}'), ('${B}'), ('${PRO}');
      insert into public.profiles (id, username, gsra_id, avatar_url) values ('${A}', 'Aufraeum Anna', 948001, 'https://x.supabase.co/storage/v1/object/public/avatars/${A}/111_k.png'),
        ('${B}', 'Bernd Beispiel', 948002, null), ('${PRO}', 'Video Valentin', 948003, null);
      insert into public.pro_creators (user_id) values ('${PRO}');
      insert into public.chats (id, user1_id, user2_id) values ('${CH}', '${A}', '${B}');`);
    await db.exec(readFileSync(AUFRAEUMEN_SQL, "utf8"));
    const ctl48 = await db.exec(readFileSync(AUFRAEUMEN_SQL, "utf8")); // zweiter Lauf
    const rows48 = ctl48[ctl48.length - 1].rows;
    console.log("Kontrolle 048:\n  " + rows48.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 048: Warteschlange, nur Server, Suche, Renningenieur (Zeitplan braucht pg_cron)",
        rows48.slice(0, 4).map(r => r.ergebnis).join(",") === "bereit,ja,bereit,bereit", rows48.map(r => r.ergebnis).join(", "));

    const offen = async () => (await db.query(`select bucket, path from public.storage_cleanup_queue where done_at is null order by path`)).rows.map(r => `${r.bucket}:${r.path}`);
    // Chat-Anhänge: erst nach Ablauf der Beweissicherung und nur, wenn nichts sie mehr nutzt
    const P1 = `${CH}/${A}/chatv_100_abc12_7s.mp4`, P2 = `${CH}/${A}/chat_200_def34.jpg`;
    await as(A, async () => {
        await q(`insert into public.messages (id, chat_id, sender_id, text, image_url) values
          ('78000000-0000-0000-0000-0000000005a1', '${CH}', '${A}', '[Medien]', '${URL(P1)}'),
          ('78000000-0000-0000-0000-0000000005a2', '${CH}', '${A}', '[Medien]', '${URL(P2)}')`);
    });
    await db.exec(`delete from public.messages where id = '78000000-0000-0000-0000-0000000005a1'`);
    check("Gelöschte Nachricht: Anhang noch nicht vorgemerkt (Beweissicherung läuft)", !(await offen()).some(p => p.includes("chatv_100")), JSON.stringify(await offen()));
    await db.exec(`update public.message_history set changed_at = now() - interval '200 days' where message_id::text = '78000000-0000-0000-0000-0000000005a1'`);
    const genommen = (await db.query(`select bucket, path from public.storage_cleanup_take(50)`)).rows.map(r => r.path);
    check("Nach 180 Tagen: Video und sein Vorschaubild zum Löschen vorgemerkt",
        genommen.includes(P1) && genommen.includes(`${CH}/${A}/chatv_100_abc12.vorschau.jpg`), JSON.stringify(genommen));
    check("Noch genutzter Anhang bleibt", !genommen.includes(P2), JSON.stringify(genommen));
    // Bearbeitete Nachricht mit gleichem Bild: Kopie läuft ab, Bild wird aber noch genutzt
    await as(A, async () => { await q(`update public.messages set text = 'mit Text' where id = '78000000-0000-0000-0000-0000000005a2'`); });
    await db.exec(`update public.message_history set changed_at = now() - interval '200 days' where message_id::text = '78000000-0000-0000-0000-0000000005a2';
                   delete from public.message_history where changed_at < now() - interval '180 days'`);
    check("Bearbeitete Nachricht: Bild bleibt, solange die Nachricht es zeigt", !(await offen()).some(p => p.includes("chat_200")), JSON.stringify(await offen()));
    const fertig = await db.query(`select public.storage_cleanup_done(array(select id from public.storage_cleanup_queue where path like '%chatv_100%')) as n`);
    check("Erledigte Dateien werden vermerkt", Number(fertig.rows[0].n) === 2, String(fertig.rows[0].n));
    // Profilbild ersetzt → altes Bild und kleine Fassung
    await as(A, async () => { await q(`update public.profiles set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/${A}/222_k.png' where id = '${A}'`); });
    const nachAvatar = await offen();
    check("Altes Profilbild und kleine Fassung vorgemerkt", nachAvatar.includes(`avatars:${A}/111_k.png`) && nachAvatar.includes(`avatars:${A}/111_k.klein.jpg`), JSON.stringify(nachAvatar));
    // Fremde Profilbild-Adresse wird nicht vorgemerkt (nur der eigene Ordner)
    await as(A, async () => { await q(`update public.profiles set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/${B}/999.png' where id = '${A}'`); });
    await as(A, async () => { await q(`update public.profiles set avatar_url = null where id = '${A}'`); });
    check("Fremder Ordner im Profilbild wird nie vorgemerkt", !(await offen()).some(p => p.includes(`${B}/999`)), JSON.stringify(await offen()));
    // Rechte: nur der Server
    await as(A, async () => {
        const take = await q(`select * from public.storage_cleanup_take(5)`);
        check("Mitglieder können nicht aufräumen lassen", take.error !== null, take.error || "durchgelassen!");
        const lesen = await q(`select * from public.storage_cleanup_queue`);
        check("Warteschlange für Mitglieder nicht lesbar", lesen.error !== null, lesen.error || "durchgelassen!");
        const einreihen = await q(`select public.storage_cleanup_enqueue('avatars', '${B}/fremd.png', 'x')`);
        check("Mitglieder können keine fremden Dateien vormerken", einreihen.error !== null, einreihen.error || "durchgelassen!");
    });
    // Video gelöscht → Vorschaubild
    const vid = await as(PRO, async () => q(`select public.video_save(null, 'https://video.example/aufraeumen', 'Aufräum-Video', 'Kurzer Text', array['Test'], '${PRO}/v1.jpg') as id`));
    await as(PRO, async () => { await q(`select public.video_delete('${vid.rows[0]?.id}')`); });
    check("Gelöschtes Video: Vorschaubild vorgemerkt", (await offen()).includes(`videos:${PRO}/v1.jpg`), JSON.stringify(await offen()));

    // Suche: Videos (auch über die GSRA-ID des Creators) und Liveries – nur für Angemeldete
    await as(PRO, async () => { await q(`select public.video_save(null, 'https://video.example/suche', 'Hotlap Suzuka', 'Schnelle Runde', array['Suzuka'], null)`); });
    const suche = await as(B, async () => q(`select public.gsra_search('Suzuka') as r`));
    check("Suche findet Videos", (suche.rows[0]?.r?.videos || []).some(v => v.title === "Hotlap Suzuka"), JSON.stringify(suche.rows[0]?.r?.videos));
    const sucheId = await as(B, async () => q(`select public.gsra_search('948003') as r`));
    check("Suche findet Videos über die GSRA-ID des Creators", (sucheId.rows[0]?.r?.videos || []).length >= 1, JSON.stringify(sucheId.rows[0]?.r?.videos));
    const sucheLivery = await as(B, async () => q(`select public.gsra_search('Prototypen') as r`));
    check("Suche liefert die Rubrik Liveries", Array.isArray(sucheLivery.rows[0]?.r?.liveries), JSON.stringify(sucheLivery.rows[0]?.r));
    const gastSuche = await as(null, async () => q(`select public.gsra_search('Suzuka') as r`));
    check("Gäste finden keine Videos und Liveries", !gastSuche.rows[0]?.r?.videos && !gastSuche.rows[0]?.r?.liveries, JSON.stringify(gastSuche.rows[0]?.r));

    // Renningenieur
    await as(A, async () => {
        const ok = await q(`select public.race_engineer_save(' <b>Toni</b> ', 'Anna', 'kumpel', 'viel', 'ruhig', 'de', '{"sprit": false, "boese": true}'::jsonb)`);
        check("Renningenieur-Einstellungen gespeichert", ok.error === null, ok.error || "");
        const s = (await q(`select name, rufname, themen from public.race_engineer_settings`)).rows[0];
        check("Name bereinigt, unbekannte Themen verworfen", s?.name === "bToni/b" && s?.themen?.sprit === false && !("boese" in (s?.themen || {})), JSON.stringify(s));
        const falsch = await q(`select public.race_engineer_save('Toni', null, 'boese', 'viel', 'ruhig', 'de', '{}'::jsonb)`);
        check("Nur bekannte Arten", falsch.error !== null, falsch.error || "durchgelassen!");
        const leer = await q(`select public.race_engineer_save('   ', null, 'kumpel', 'viel', 'ruhig', 'de', '{}'::jsonb)`);
        check("Name ist Pflicht", /Namen/.test(leer.error || ""), leer.error || "durchgelassen!");
        const direkt = await q(`insert into public.race_engineer_settings (user_id, name) values ('${A}', 'Direkt')`);
        check("Einstellungen nicht direkt schreibbar", direkt.error !== null, direkt.error || "durchgelassen!");
        const m = await q(`select public.race_engineer_remember('vorliebe', 'Mag kurze Ansagen in schnellen Kurven') as id`);
        check("Gedächtnis: Eintrag angelegt", m.error === null && Boolean(m.rows[0]?.id), m.error || "");
        const mArt = await q(`select public.race_engineer_remember('geheim', 'x y')`);
        check("Gedächtnis: nur bekannte Arten", mArt.error !== null, mArt.error || "durchgelassen!");
        const direktM = await q(`insert into public.race_engineer_memory (user_id, art, text) values ('${A}', 'notiz', 'direkt')`);
        check("Gedächtnis nicht direkt schreibbar", direktM.error !== null, direktM.error || "durchgelassen!");
    });
    await as(B, async () => {
        const fremd = await q(`select * from public.race_engineer_settings`);
        check("Fremde Renningenieur-Einstellungen nicht sichtbar", fremd.error === null && fremd.rows.length === 0, fremd.error || `${fremd.rows.length} Zeilen`);
        const fremdM = await q(`select * from public.race_engineer_memory`);
        check("Fremdes Gedächtnis nicht sichtbar", fremdM.error === null && fremdM.rows.length === 0, fremdM.error || `${fremdM.rows.length} Zeilen`);
        const del = await q(`delete from public.race_engineer_memory returning id`);
        check("Fremdes Gedächtnis nicht löschbar", del.rows.length === 0, `${del.rows.length} gelöscht`);
    });
    await as(A, async () => {
        const del = await q(`delete from public.race_engineer_memory returning id`);
        check("Eigenes Gedächtnis löschbar", del.error === null && del.rows.length === 1, del.error || `${del.rows.length}`);
    });
    await as(null, async () => {
        const gast = await q(`select public.race_engineer_save('Gast', null, 'kumpel', 'normal', 'ruhig', 'de', '{}'::jsonb)`);
        check("Gäste haben keinen Renningenieur", gast.error !== null, gast.error || "durchgelassen!");
    });
}

// --- 049: „Zuletzt online“ ab dem Abmelden (eigener Zeitpunkt statt künstlich zurückgesetzter Aktivität) ---
if (ONLINE_SQL && AUFRAEUMEN_SQL) {
    const id = (n) => `79000000-0000-0000-0000-0000000004${String(n).padStart(2, "0")}`;
    const P = id(1), F = id(2), X = id(3);
    await db.exec(`
      insert into auth.users (id) values ('${P}'), ('${F}'), ('${X}');
      insert into public.profiles (id, username) values ('${P}', 'Presence Pia'), ('${F}', 'Freund Fritz'), ('${X}', 'Fremder Xaver');
      insert into public.friendships (user_id, friend_id, status) values ('${P}', '${F}', 'accepted');`);
    await db.exec(readFileSync(ONLINE_SQL, "utf8"));
    const ctl49 = await db.exec(readFileSync(ONLINE_SQL, "utf8")); // zweiter Lauf
    const rows49 = ctl49[ctl49.length - 1].rows;
    console.log("Kontrolle 049:\n  " + rows49.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 049: bereit, Gäste ausgeschlossen", rows49.map(r => r.ergebnis).join(",") === "bereit,ja", rows49.map(r => r.ergebnis).join(", "));
    await as(P, async () => { await q(`select public.touch_presence()`); });
    const sicht = async () => (await as(F, async () => q(`select public.last_seen_of('${P}') as r`))).rows[0]?.r;
    const an = await sicht();
    check("Lebenszeichen: Freund sieht „online“", an?.online === true && an?.exact === true, JSON.stringify(an));
    await as(P, async () => { await q(`select public.touch_presence(null, false, true)`); });
    const aus = await sicht();
    const sekunden = (Date.now() - new Date(aus?.last_seen_at).getTime()) / 1000;
    check("Abmelden: sofort offline, zuletzt online = jetzt (nicht 3 Minuten zurück)", aus?.online === false && sekunden < 30, JSON.stringify(aus));
    const zeile = await one(`select offline_at, current_game from public.user_presence where user_id = '${P}'`);
    check("Abmelde-Zeitpunkt gespeichert, Spielstatus entfernt", zeile.offline_at !== null && zeile.current_game === null, JSON.stringify(zeile));
    await as(P, async () => { await q(`select public.touch_presence()`); });
    check("Wieder angemeldet: online, Abmelde-Zeitpunkt gelöscht", (await sicht())?.online === true
        && (await one(`select offline_at from public.user_presence where user_id = '${P}'`)).offline_at === null);
    const fremd = (await as(X, async () => q(`select public.last_seen_of('${P}') as r`))).rows[0]?.r;
    check("Fremde sehen weiterhin nur den Tag (keine genaue Zeit)", fremd?.exact === false, JSON.stringify(fremd));
    const gast = await as(null, async () => q(`select public.last_seen_of('${P}')`));
    check("Gäste sehen keinen Online-Status", gast.error !== null, gast.error || "durchgelassen!");
}

// --- 050: Renningenieur – Art „locker“ (Jugendsprache), Sprachen vorbereitet, verständliche Ablehnungen ---
if (RE_STIL_SQL && AUFRAEUMEN_SQL) {
    const id = (n) => `79000000-0000-0000-0000-0000000005${String(n).padStart(2, "0")}`;
    const R = id(1), G = id(2);
    await db.exec(`
      insert into auth.users (id) values ('${R}'), ('${G}');
      insert into public.profiles (id, username) values ('${R}', 'Rennrita Fuenfzig'), ('${G}', 'Gabi Sperrfuenfzig');`);
    // Vorher-Test: „locker“ ist vor 050 nicht erlaubt
    const vorher = await as(R, async () => q(`select public.race_engineer_save('Kim', null, 'locker', 'normal', 'ruhig', 'de', '{}'::jsonb)`));
    check("Vor 050: Art „locker“ abgelehnt (Lücke nachgewiesen)", vorher.error !== null, vorher.error || "durchgelassen");
    await db.exec(readFileSync(RE_STIL_SQL, "utf8"));
    const ctl50 = await db.exec(readFileSync(RE_STIL_SQL, "utf8")); // zweiter Lauf
    const rows50 = ctl50[ctl50.length - 1].rows;
    console.log("Kontrolle 050:\n  " + rows50.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 050: bereit, Gäste ausgeschlossen", rows50.map(r => r.ergebnis).join(",") === "bereit,ja", rows50.map(r => r.ergebnis).join(", "));
    const regeln = await one(`select count(*)::int as n from pg_constraint where conrelid = 'public.race_engineer_settings'::regclass and contype = 'c' and conname in ('race_engineer_settings_art_check', 'race_engineer_settings_sprache_check')`);
    check("Zweimal ausgeführt: genau je eine Regel für Art und Sprache", regeln.n === 2, String(regeln.n));
    await as(R, async () => {
        const ok = await q(`select public.race_engineer_save('Kim', 'Rita', 'locker', 'viel', 'energisch', 'fr', '{"sprit": "ja", "flaggen": false}'::jsonb)`);
        check("Art „locker“ und Sprache Französisch speicherbar", ok.error === null, ok.error || "");
        const s = (await q(`select art, sprache, themen from public.race_engineer_settings`)).rows[0];
        check("Gespeichert: locker, fr; Text statt Wahr/Falsch → Standard", s?.art === "locker" && s?.sprache === "fr" && s?.themen?.sprit === true && s?.themen?.flaggen === false, JSON.stringify(s));
        for (const [werte, muster] of [["'boese', 'normal', 'ruhig', 'de'", /Unbekannte Art/], ["'profi', 'laut', 'ruhig', 'de'", /Gesprächigkeit/],
                                         ["'profi', 'normal', 'roboter', 'de'", /Stimme/], ["'profi', 'normal', 'ruhig', 'xx'", /Sprache/]]) {
            const r = await q(`select public.race_engineer_save('Kim', null, ${werte}, '{}'::jsonb)`);
            check(`Verständliche Ablehnung (${muster.source})`, muster.test(r.error || ""), r.error || "durchgelassen!");
        }
        const liste = await q(`select public.race_engineer_save('Kim', null, 'profi', 'normal', 'ruhig', 'de', '[1, 2]'::jsonb)`);
        check("Themen müssen eine Auswahl-Liste (Objekt) sein", /Themen/.test(liste.error || ""), liste.error || "durchgelassen!");
        const direkt = await q(`update public.race_engineer_settings set art = 'profi' returning user_id`);
        check("Einstellungen weiterhin nicht direkt änderbar", direkt.error !== null || direkt.rows.length === 0, direkt.error || `${direkt.rows.length} geändert`);
    });
    const roh = await q(`insert into public.race_engineer_settings (user_id, name, art) values ('${G}', 'X', 'boese')`);
    check("Datenbank-Regel lehnt unbekannte Arten auch ohne Funktion ab", roh.error !== null, roh.error || "durchgelassen!");
    await db.exec(`insert into public.user_bans (user_id, banned_until, reason) values ('${G}', now() + interval '1 day', 'Test 050')`);
    const gesperrt = await as(G, async () => q(`select public.race_engineer_save('Kim', null, 'locker', 'normal', 'ruhig', 'de', '{}'::jsonb)`));
    check("Gesperrte Konten: kein Renningenieur", /gesperrt/.test(gesperrt.error || ""), gesperrt.error || "durchgelassen!");
    await db.exec(`delete from public.user_bans where reason = 'Test 050'`);
    const gast = await as(null, async () => q(`select public.race_engineer_save('Gast', null, 'locker', 'normal', 'ruhig', 'de', '{}'::jsonb)`));
    check("Gäste: kein Renningenieur", gast.error !== null, gast.error || "durchgelassen!");
}

// --- 051: GSRA-App über die Webseite anmelden (Kopplung mit Einmal-Code und Geheimnis der App) ---
if (APP_LOGIN_SQL && RE_STIL_SQL) {
    const id = (n) => `79000000-0000-0000-0000-0000000006${String(n).padStart(2, "0")}`;
    const A1 = id(1), GS = id(2), ZF = id(3), A4 = id(4);
    await db.exec(`
      alter table auth.users add column if not exists email text;
      insert into auth.users (id, email) values ('${A1}', 'app@test.de'), ('${GS}', 'gesperrt@test.de'), ('${ZF}', 'zweifaktor@test.de'), ('${A4}', 'viel@test.de');
      insert into public.profiles (id, username) values ('${A1}', 'Appfahrer Anton'), ('${GS}', 'Appsperre Gerda'), ('${ZF}', 'Zweifaktor Zora'), ('${A4}', 'Vielklick Viktor');
      insert into auth.mfa_factors (user_id, status) values ('${ZF}', 'verified');`);
    await db.exec(readFileSync(APP_LOGIN_SQL, "utf8"));
    const ctl51 = await db.exec(readFileSync(APP_LOGIN_SQL, "utf8")); // zweiter Lauf
    const rows51 = ctl51[ctl51.length - 1].rows;
    console.log("Kontrolle 051:\n  " + rows51.map(r => `${r.pruefung}: ${r.ergebnis}`).join("\n  "));
    check("Kontrolle 051: bereit, Einlösen nur Server, Tabelle gesperrt", rows51.map(r => r.ergebnis).join(",") === "bereit,ja,ja", rows51.map(r => r.ergebnis).join(", "));

    // „challenge“ wie in der App: base64url(sha256(Geheimnis)) – genau 43 Zeichen
    const CH = createHash("sha256").update("geheimnis-der-app-1").digest("base64url");
    const CH2 = createHash("sha256").update("geheimnis-einer-anderen-app").digest("base64url");
    const sha = (t) => createHash("sha256").update(t, "utf8").digest("hex");
    const take = async (code, ch) => (await q(`select * from public.app_link_take('${sha(code)}', '${ch}')`));

    // Mitglied bestätigt auf der Webseite
    const ok = await as(A1, async () => q(`select public.app_link_approve('${CH}', ' Windows-PC <script>alert(1)</script> ') as code`));
    const code1 = ok.rows[0]?.code || "";
    check("Bestätigen liefert einen Einmal-Code (64 Zeichen)", ok.error === null && /^[0-9a-f]{64}$/.test(code1), ok.error || code1);
    const zeile = await one(`select geraet, code_hash, extract(epoch from expires_at - created_at)::int as sek from public.app_links where user_id = '${A1}'`);
    check("Gespeichert nur die Prüfsumme, Gerätename bereinigt, 5 Minuten gültig",
        zeile.code_hash === sha(code1) && !zeile.geraet.includes("<") && zeile.sek === 300, JSON.stringify(zeile));
    await as(A1, async () => {
        const lesen = await q(`select * from public.app_links`);
        check("Kopplungen für die Webseite nicht lesbar (auch die eigenen nicht)", lesen.error !== null, lesen.error || `${lesen.rows.length} Zeilen`);
        const schreiben = await q(`insert into public.app_links (user_id, challenge, code_hash, geraet) values ('${A1}', '${CH}', '${"a".repeat(64)}', 'x')`);
        check("Kopplungen nicht direkt anlegbar", schreiben.error !== null, schreiben.error || "durchgelassen!");
        const selbst = await q(`select * from public.app_link_take('${sha(code1)}', '${CH}')`);
        check("Einlösen für Angemeldete gesperrt (nur Server-Funktion)", selbst.error !== null, selbst.error || "durchgelassen!");
        const kaputt = await q(`select public.app_link_approve('zu-kurz', 'PC')`);
        check("Ungültige Anfrage der App abgelehnt", /Ungültige Anfrage/.test(kaputt.error || ""), kaputt.error || "durchgelassen!");
    });
    const gast = await as(null, async () => q(`select public.app_link_approve('${CH}', 'PC')`));
    check("Gäste können keine App anmelden", gast.error !== null, gast.error || "durchgelassen!");
    const gastTake = await as(null, async () => q(`select * from public.app_link_take('${sha(code1)}', '${CH}')`));
    check("Gäste können keinen Code einlösen", gastTake.error !== null, gastTake.error || "durchgelassen!");

    // Server-Funktion löst ein: falsches Geheimnis verbraucht den Code
    const falsch = await take(code1, CH2);
    check("Falsches Geheimnis: keine Anmeldung", falsch.error === null && falsch.rows.length === 0, falsch.error || JSON.stringify(falsch.rows));
    const danach = await take(code1, CH);
    check("Nach einem Fehlversuch ist der Code verbraucht", danach.rows.length === 0, JSON.stringify(danach.rows));
    const code2 = (await as(A1, async () => q(`select public.app_link_approve('${CH}', 'PC') as code`))).rows[0]?.code || "";
    const richtig = await take(code2, CH);
    check("Richtiger Code + Geheimnis: Konto und E-Mail für den Anmelde-Schlüssel", richtig.rows[0]?.konto === A1 && richtig.rows[0]?.adresse === "app@test.de", JSON.stringify(richtig.rows));
    check("Code gilt genau einmal", (await take(code2, CH)).rows.length === 0);
    const unbekannt = await take("f".repeat(64), CH);
    check("Unbekannter Code: nichts", unbekannt.rows.length === 0);
    const boese = await q(`select * from public.app_link_take($$'; delete from public.app_links; --$$, '${CH}')`);
    check("Unsinn statt Prüfsumme: nichts, keine Wirkung", boese.error === null && boese.rows.length === 0, boese.error || "");

    // Abgelaufen
    const code3 = (await as(A1, async () => q(`select public.app_link_approve('${CH}', 'PC') as code`))).rows[0]?.code || "";
    await db.exec(`update public.app_links set expires_at = now() - interval '1 second' where code_hash = '${sha(code3)}'`);
    check("Abgelaufener Code: keine Anmeldung", (await take(code3, CH)).rows.length === 0);

    // Gesperrt: weder bestätigen noch (nach der Sperre) einlösen
    const code4 = (await as(GS, async () => q(`select public.app_link_approve('${CH}', 'PC') as code`))).rows[0]?.code || "";
    await db.exec(`insert into public.user_bans (user_id, banned_until, reason) values ('${GS}', now() + interval '1 day', 'Test 051')`);
    const gesperrt = await as(GS, async () => q(`select public.app_link_approve('${CH}', 'PC')`));
    check("Gesperrte Konten können keine App anmelden", /gesperrt/.test(gesperrt.error || ""), gesperrt.error || "durchgelassen!");
    check("Vor der Sperre bestätigter Code wird nach der Sperre nicht eingelöst", (await take(code4, CH)).rows.length === 0);
    await db.exec(`delete from public.user_bans where reason = 'Test 051'`);

    // Zwei-Faktor eingerichtet: Bestätigen nur mit bestätigtem Code (aal2)
    const ohneCode = await as(ZF, async () => q(`select public.app_link_approve('${CH}', 'PC')`));
    check("Mit Zwei-Faktor: ohne bestätigten Code keine App-Anmeldung", /Zwei-Faktor/.test(ohneCode.error || ""), ohneCode.error || "durchgelassen!");
    const mitCode = await mitAnspruch(ZF, { aal: "aal2" }, async () => q(`select public.app_link_approve('${CH}', 'PC') as code`));
    check("Mit Zwei-Faktor und bestätigtem Code: erlaubt", mitCode.error === null && /^[0-9a-f]{64}$/.test(mitCode.rows[0]?.code || ""), mitCode.error || "");

    // Spam-Grenze: höchstens 10 pro Stunde
    let letzter = null;
    for (let i = 0; i < 11; i++) letzter = await as(A4, async () => q(`select public.app_link_approve('${CH}', 'PC')`));
    check("Höchstens 10 App-Anmeldungen pro Stunde", /Zu viele/.test(letzter?.error || ""), letzter?.error || "durchgelassen!");
}

// --- Konto löschen (Ausbau 3) funktioniert weiterhin, die Stimmen verschwinden mit ---
await as(U.lena, async () => {
    await q(`select * from public.vote_setup('${S2}', 1)`);
    await db.exec(`set request.jwt.claims = '{"amr":[{"method":"password","timestamp":${Math.floor(Date.now() / 1000)}}]}'`);
    const del = await q(`select public.delete_own_account()`);
    check("Konto löschen klappt weiterhin (mit abgegebener Stimme)", del.error === null, del.error || "");
});
await db.exec(`set request.jwt.claims = ''`);
const lenaVotes = Number((await one(`select count(*) as n from public.setup_votes where user_id = '${U.lena}'`)).n);
check("Stimmen gelöschter Konten verschwinden", lenaVotes === 0, String(lenaVotes));

console.log(failures === 0 ? "\nALLE PRÜFUNGEN BESTANDEN" : `\n${failures} PRÜFUNG(EN) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
