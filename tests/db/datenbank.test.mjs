// Nachbau-Test der Datenbank: spielt alle Skripte aus supabase/migrations der Reihe nach ein (jedes zweimal,
// damit Wiederholbarkeit geprüft ist) und prüft erlaubte UND verbotene Zugriffe als Gast, Nutzer und Admin.
// Ausgangslage: absichtlich offene Altregeln wie in der ursprünglichen Datenbank.
// Start: im Ordner tests/db „npm install“ (einmalig) und dann „npm test“.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations");
const BY_NUMBER = Object.fromEntries(readdirSync(MIGRATIONS).filter(f => /^\d{3}_.+\.sql$/.test(f)).map(f => [f.slice(0, 3), join(MIGRATIONS, f)]));
const [ROLES_SQL, GUARD_SQL, AUSBAU_SQL, AUSBAU2_SQL, AUSBAU3_SQL, SICHERHEIT_SQL, NAMEN_SQL, ORT_SQL, MARKT_SQL, UMKREIS_SQL, ZAHLUNG_SQL, ZAHLUNG2_SQL, KUENDIGUNG_SQL, SETUPHUB_SQL, PRONUR_SQL, SICHERHEIT2_SQL, ADVISOR_SQL, ADMIN_MFA_SQL, MFA_PFLICHT_SQL] =
    Array.from({ length: 19 }, (_, i) => BY_NUMBER[String(i + 1).padStart(3, "0")]);
const unknown = Object.keys(BY_NUMBER).filter(n => Number(n) > 19);
if (unknown.length) console.log(`Hinweis: Skripte ${unknown.join(", ")} sind noch nicht im Test berücksichtigt.\n`);
// ALT_SETUPS=1: Tabelle setups wie in der echten Datenbank ohne uploader_id (und weitere Spalten der Seite)
const ALT_SETUPS = process.env.ALT_SETUPS === "1";
const db = new PGlite();

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
create table public.events (id uuid primary key default gen_random_uuid(), title text, simulation text, track text, event_date timestamptz, password text);

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
