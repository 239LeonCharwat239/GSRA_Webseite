// Erzeugt supabase/pruefungen/datenbank_pruefung.sql: eine reine LESE-Abfrage für den Supabase SQL Editor, die die
// Live-Datenbank mit dem im Nachbau getesteten Stand vergleicht (Wunsch 26.11.: „prüf, ob ein doppelt oder später
// ausgeführtes älteres Skript etwas zurückgesetzt hat, und ob es Lücken bei den Rechten gibt“).
//
// Verglichen werden – jeweils nach ALLEN Skripten in der richtigen Reihenfolge –:
//  * Funktionen: Inhalt (Prüfsumme des Quelltexts), Besitzerrechte (security definer), fester search_path,
//    wer sie ausführen darf (Gäste / Angemeldete). Eine ältere Fassung mit anderen Parametern fällt als Warnung auf.
//  * Tabellen: Zugriffsschutz (RLS) und Rechte von Gästen und Angemeldeten (lesen/anlegen/ändern/löschen),
//    dazu einzelne Spalten-Rechte.
//  * Zugriffsregeln (RLS-Policies) in public und storage: Befehl, Rollen, Art, Ausdrücke. Zusätzliche, nicht aus den
//    Skripten stammende Regeln werden mit ihrem Ausdruck gezeigt.
//  * Prüfregeln (Constraints), Trigger, Speicher (Buckets), Zeitpläne (pg_cron).
//  * Allgemein: Tabellen ohne RLS, Sichten, die Zugriffsregeln umgehen, Besitzerrechte ohne festen search_path.
// Die Abfrage ändert nichts (nur SELECT, keine Funktionen werden aufgerufen außer Prüf-Funktionen von Postgres).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Im Supabase-Dashboard erzeugte Regeln enden auf eine Zufallskennung („Public Upload & Read 1ps738_1“). Der Nachbau
// kennt sie als „Public Upload & Read (Altregel)“ und prüft sie im schlimmsten Fall – live wird der Name zusammengefasst.
const REGELNAME = `case when n.nspname = 'storage' and pol.polname ~ '^Public Upload & Read [A-Za-z0-9]+_[0-9]+$'
      then 'Public Upload & Read (Altregel)' else pol.polname::text end`;

const esc = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const b = (x) => (x ? "true" : "false");
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** VALUES-Liste; leer → typisierte leere Menge */
function werte(name, spalten, typen, zeilen) {
  if (!zeilen.length) {
    return `${name}(${spalten.join(", ")}) as (select ${typen.map((t, i) => `null::${t} as ${spalten[i]}`).join(", ")} where false)`;
  }
  return `${name}(${spalten.join(", ")}) as (values\n    ${zeilen.map((z) => `(${z.join(", ")})`).join(",\n    ")})`;
}

export async function pruefungErzeugen(db, migrationsOrdner) {
  const dateien = readdirSync(migrationsOrdner).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  const letzte = dateien[dateien.length - 1].slice(0, 3);
  const korpus = dateien.map((f) => readFileSync(join(migrationsOrdner, f), "utf8")).join("\n").toLowerCase();
  const q = async (sql) => (await db.query(sql)).rows;

  const ausMig = {
    funktion: (n) => new RegExp(`function\\s+(public\\.)?"?${reEsc(n.toLowerCase())}"?\\s*\\(`).test(korpus),
    tabelle: (n) => new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?"?${reEsc(n.toLowerCase())}"?\\s*\\(`).test(korpus),
    regel: (n) => new RegExp(`create\\s+policy\\s+("${reEsc(n.toLowerCase())}"|${reEsc(n.toLowerCase())}\\s)`).test(korpus),
    pruefregel: (n) => new RegExp(`constraint\\s+"?${reEsc(n.toLowerCase())}"?\\s`).test(korpus),
    trigger: (n) => new RegExp(`trigger\\s+"?${reEsc(n.toLowerCase())}"?\\s`).test(korpus),
    speicher: (n) => korpus.includes(`'${n.toLowerCase()}'`),
  };

  const funktionen = await q(`
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig, p.proname as name,
           md5(replace(p.prosrc, chr(13), '')) as h, p.prosecdef as secdef, coalesce(array_to_string(p.proconfig, ';'), '') as cfg,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    order by 1`);
  const tabellen = await q(`
    select c.relname as name, c.relrowsecurity as rls,
      has_table_privilege('anon', c.oid, 'SELECT') as a_s, has_table_privilege('anon', c.oid, 'INSERT') as a_i,
      has_table_privilege('anon', c.oid, 'UPDATE') as a_u, has_table_privilege('anon', c.oid, 'DELETE') as a_d,
      has_table_privilege('authenticated', c.oid, 'SELECT') as m_s, has_table_privilege('authenticated', c.oid, 'INSERT') as m_i,
      has_table_privilege('authenticated', c.oid, 'UPDATE') as m_u, has_table_privilege('authenticated', c.oid, 'DELETE') as m_d
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`);
  const spalten = await q(`
    select c.relname as tab, a.attname as col,
      (case when has_column_privilege('anon', c.oid, a.attnum, 'SELECT') then 's' else '-' end ||
       case when has_column_privilege('anon', c.oid, a.attnum, 'INSERT') then 'i' else '-' end ||
       case when has_column_privilege('anon', c.oid, a.attnum, 'UPDATE') then 'u' else '-' end) as anon,
      (case when has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT') then 's' else '-' end ||
       case when has_column_privilege('authenticated', c.oid, a.attnum, 'INSERT') then 'i' else '-' end ||
       case when has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE') then 'u' else '-' end) as auth
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped and a.attacl is not null
    order by 1, 2`);
  const regeln = await q(`
    select n.nspname as schema, c.relname as tab, ${REGELNAME} as name, pol.polcmd::text as cmd, pol.polpermissive as perm,
      coalesce((select string_agg(x, ',' order by x) from (select case when r = 0 then 'public' else pg_get_userbyid(r)::text end as x
                from unnest(pol.polroles) r) s), '') as roles,
      md5(coalesce(pg_get_expr(pol.polqual, pol.polrelid), '')) as hq, md5(coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')) as hw,
      -- „schlimmster Fall“: erlaubend, für alle, ohne Bedingung – dieser Zugriff ist im Nachbau als harmlos bewiesen
      (pol.polpermissive and pol.polroles = '{0}'::oid[]
        and coalesce(pg_get_expr(pol.polqual, pol.polrelid), 'true') = 'true'
        and coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), 'true') = 'true') as wc
    from pg_policy pol join pg_class c on c.oid = pol.polrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage') order by 1, 2, 3`);
  const pruefregeln = await q(`
    select c.relname as tab, con.conname as name, con.contype::text as typ, md5(pg_get_constraintdef(con.oid)) as h, con.convalidated as gueltig
    from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' order by 1, 2`);
  const trigger = await q(`
    select n.nspname as schema, c.relname as tab, t.tgname as name, p.proname as fn
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace join pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal and n.nspname in ('public', 'storage') order by 1, 2, 3`);
  const speicher = await q(`
    select id, public, file_size_limit::bigint as groesse,
      coalesce((select string_agg(m, ',' order by m) from unnest(allowed_mime_types) m), '') as mime
    from storage.buckets order by 1`);

  const migTabellen = new Set(tabellen.filter((t) => ausMig.tabelle(t.name)).map((t) => t.name));
  const zeitplaene = [...korpus.matchAll(/cron\.schedule\('([a-z0-9-]+)'/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i).sort();

  const ef = funktionen.map((f) => [esc(f.sig), esc(f.name), esc(f.h), b(f.secdef), esc(f.cfg), b(f.anon), b(f.auth), b(ausMig.funktion(f.name))]);
  const et = tabellen.map((t) => [esc(t.name), b(t.rls), ...["a_s", "a_i", "a_u", "a_d", "m_s", "m_i", "m_u", "m_d"].map((k) => b(t[k])), b(migTabellen.has(t.name))]);
  const ek = spalten.map((s) => [esc(s.tab), esc(s.col), esc(s.anon), esc(s.auth)]);
  const ep = regeln.map((r) => [esc(r.schema), esc(r.tab), esc(r.name), esc(r.cmd), b(r.perm), esc(r.roles), esc(r.hq), esc(r.hw), b(ausMig.regel(r.name)), b(r.wc && !ausMig.regel(r.name))]);
  const ec = pruefregeln.filter((c) => migTabellen.has(c.tab) || ausMig.pruefregel(c.name)).map((c) => [esc(c.tab), esc(c.name), esc(c.typ), esc(c.h), b(c.gueltig)]);
  const etr = trigger.filter((t) => ausMig.trigger(t.name)).map((t) => [esc(t.schema), esc(t.tab), esc(t.name), esc(t.fn)]);
  const eb = speicher.map((s) => [esc(s.id), b(s.public), s.groesse == null ? "null::bigint" : `${s.groesse}::bigint`, esc(s.mime), b(ausMig.speicher(s.id))]);
  const ez = zeitplaene.map((z) => [esc(z)]);

  const sql = `-- GSRA: Prüfung der Live-Datenbank gegen den getesteten Stand (Skripte 001–${letzte})
-- NUR LESEN: ändert nichts. Im Supabase SQL Editor komplett einfügen und ausführen („Run“).
-- Ergebnis: erste Zeile „GESAMT“. Steht dort nicht „Alles in Ordnung“, das Ergebnis bitte an Claude schicken.
-- Erzeugt automatisch aus dem Nachbau (tests/db/datenbank.test.mjs, PRUEFUNG_SCHREIBEN=1) – nicht von Hand ändern.
-- Erfasst: ${funktionen.length} Funktionen, ${tabellen.length} Tabellen, ${spalten.length} Spalten-Rechte, ${regeln.length} Zugriffsregeln,
--          ${ec.length} Prüfregeln, ${etr.length} Trigger, ${speicher.length} Speicher, ${zeitplaene.length} Zeitpläne.
with
${werte("ef", ["sig", "name", "h", "secdef", "cfg", "anon", "auth", "mig"], ["text", "text", "text", "boolean", "text", "boolean", "boolean", "boolean"], ef)},
${werte("et", ["name", "rls", "a_s", "a_i", "a_u", "a_d", "m_s", "m_i", "m_u", "m_d", "mig"], ["text", "boolean", "boolean", "boolean", "boolean", "boolean", "boolean", "boolean", "boolean", "boolean", "boolean"], et)},
${werte("ek", ["tab", "col", "anon", "auth"], ["text", "text", "text", "text"], ek)},
${werte("ep", ["schema", "tab", "name", "cmd", "perm", "roles", "hq", "hw", "mig", "wc"], ["text", "text", "text", "text", "boolean", "text", "text", "text", "boolean", "boolean"], ep)},
${werte("ec", ["tab", "name", "typ", "h", "gueltig"], ["text", "text", "text", "text", "boolean"], ec)},
${werte("etr", ["schema", "tab", "name", "fn"], ["text", "text", "text", "text"], etr)},
${werte("eb", ["id", "public", "groesse", "mime", "mig"], ["text", "boolean", "bigint", "text", "boolean"], eb)},
${werte("ez", ["name"], ["text"], ez)},
lf as (
  select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig, p.proname::text as name,
         md5(replace(p.prosrc, chr(13), '')) as h, p.prosecdef as secdef, coalesce(array_to_string(p.proconfig, ';'), '') as cfg,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
         p.prorettype = 'trigger'::regtype as trig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')),
lt as (
  select c.relname::text as name, c.relrowsecurity as rls,
    has_table_privilege('anon', c.oid, 'SELECT') as a_s, has_table_privilege('anon', c.oid, 'INSERT') as a_i,
    has_table_privilege('anon', c.oid, 'UPDATE') as a_u, has_table_privilege('anon', c.oid, 'DELETE') as a_d,
    has_table_privilege('authenticated', c.oid, 'SELECT') as m_s, has_table_privilege('authenticated', c.oid, 'INSERT') as m_i,
    has_table_privilege('authenticated', c.oid, 'UPDATE') as m_u, has_table_privilege('authenticated', c.oid, 'DELETE') as m_d
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')),
lk as (
  select ek.tab, ek.col,
    (case when has_column_privilege('anon', c.oid, a.attnum, 'SELECT') then 's' else '-' end ||
     case when has_column_privilege('anon', c.oid, a.attnum, 'INSERT') then 'i' else '-' end ||
     case when has_column_privilege('anon', c.oid, a.attnum, 'UPDATE') then 'u' else '-' end) as anon,
    (case when has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT') then 's' else '-' end ||
     case when has_column_privilege('authenticated', c.oid, a.attnum, 'INSERT') then 'i' else '-' end ||
     case when has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE') then 'u' else '-' end) as auth
  from ek join pg_namespace n on n.nspname = 'public' join pg_class c on c.relnamespace = n.oid and c.relname = ek.tab
  join pg_attribute a on a.attrelid = c.oid and a.attname = ek.col and not a.attisdropped),
lp as (
  select n.nspname::text as schema, c.relname::text as tab, ${REGELNAME} as name, pol.polcmd::text as cmd, pol.polpermissive as perm,
    coalesce((select string_agg(x, ',' order by x) from (select case when r = 0 then 'public' else pg_get_userbyid(r)::text end as x
              from unnest(pol.polroles) r) s), '') as roles,
    md5(coalesce(pg_get_expr(pol.polqual, pol.polrelid), '')) as hq, md5(coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')) as hw,
    left(concat_ws(' | ', 'USING ' || pg_get_expr(pol.polqual, pol.polrelid), 'CHECK ' || pg_get_expr(pol.polwithcheck, pol.polrelid)), 400) as ausdruck
  from pg_policy pol join pg_class c on c.oid = pol.polrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')),
lc as (
  select c.relname::text as tab, con.conname::text as name, con.contype::text as typ, md5(pg_get_constraintdef(con.oid)) as h,
    con.convalidated as gueltig, left(pg_get_constraintdef(con.oid), 300) as def
  from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'),
ltr as (
  select n.nspname::text as schema, c.relname::text as tab, t.tgname::text as name, p.proname::text as fn, t.tgenabled::text as an
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal and n.nspname in ('public', 'storage')),
lb as (
  select id::text as id, public, file_size_limit::bigint as groesse,
    coalesce((select string_agg(m, ',' order by m) from unnest(allowed_mime_types) m), '') as mime
  from storage.buckets),
befehl(c, t) as (values ('r', 'lesen'), ('a', 'anlegen'), ('w', 'ändern'), ('d', 'löschen'), ('*', 'alles')),
befunde(bereich, objekt, status, details) as (
  -- Funktionen
  select 'Funktion', coalesce(e.sig, l.sig),
    case
      when l.sig is null and e.mig then 'FEHLER'
      when l.sig is null then 'HINWEIS'
      when e.sig is null and l.name in (select name from ef where mig) and not l.trig then 'WARNUNG'
      when e.sig is null and l.secdef and not l.trig and (l.anon or l.cfg not like '%search_path%') then 'WARNUNG'
      when e.sig is null then 'HINWEIS'
      when (l.anon and not e.anon) or (l.auth and not e.auth) or (l.secdef and l.cfg not like '%search_path%') then 'FEHLER'
      when e.mig and l.h <> e.h then 'ABWEICHUNG'
      when l.secdef <> e.secdef or l.cfg <> e.cfg or l.anon <> e.anon or l.auth <> e.auth then 'ABWEICHUNG'
      else 'ok' end,
    case
      when l.sig is null then 'fehlt in der Datenbank'
      when e.sig is null and l.name in (select name from ef where mig) then 'ältere Fassung mit anderen Parametern (vermutlich ein älteres Skript erneut ausgeführt) – Gäste: ' || case when l.anon then 'ja' else 'nein' end || ', Angemeldete: ' || case when l.auth then 'ja' else 'nein' end
      when e.sig is null and l.trig then 'Trigger-Funktion, nicht aus den Skripten (nicht direkt aufrufbar)'
      when e.sig is null then 'nicht aus den Skripten – Besitzerrechte: ' || case when l.secdef then 'ja' else 'nein' end || ', Gäste: ' || case when l.anon then 'ja' else 'nein' end || ', fester search_path: ' || case when l.cfg like '%search_path%' then 'ja' else 'nein' end
      else nullif(concat_ws('; ',
        case when e.mig and l.h <> e.h then 'anderer Inhalt als nach dem letzten Skript (älteres Skript danach erneut ausgeführt?)' end,
        case when l.anon <> e.anon then 'Gäste dürfen ausführen: live ' || case when l.anon then 'ja' else 'nein' end || ', erwartet ' || case when e.anon then 'ja' else 'nein' end end,
        case when l.auth <> e.auth then 'Angemeldete dürfen ausführen: live ' || case when l.auth then 'ja' else 'nein' end || ', erwartet ' || case when e.auth then 'ja' else 'nein' end end,
        case when l.secdef <> e.secdef then 'Besitzerrechte: live ' || case when l.secdef then 'ja' else 'nein' end end,
        case when l.cfg <> e.cfg then 'Einstellung live „' || l.cfg || '“, erwartet „' || e.cfg || '“' end), '') end
  from ef e full join lf l on l.sig = e.sig
  union all
  -- Tabellen: Zugriffsschutz und Rechte
  select 'Tabelle', coalesce(e.name, l.name),
    case
      when l.name is null and e.mig then 'FEHLER'
      when l.name is null then 'HINWEIS'
      when not l.rls then 'FEHLER'
      when e.name is null then 'HINWEIS'
      when (l.a_s and not e.a_s) or (l.a_i and not e.a_i) or (l.a_u and not e.a_u) or (l.a_d and not e.a_d)
        or (l.m_s and not e.m_s) or (l.m_i and not e.m_i) or (l.m_u and not e.m_u) or (l.m_d and not e.m_d) then 'FEHLER'
      when (l.a_s, l.a_i, l.a_u, l.a_d, l.m_s, l.m_i, l.m_u, l.m_d) is distinct from (e.a_s, e.a_i, e.a_u, e.a_d, e.m_s, e.m_i, e.m_u, e.m_d) then 'ABWEICHUNG'
      else 'ok' end,
    case
      when l.name is null then 'fehlt in der Datenbank'
      when not l.rls then 'Zugriffsschutz (RLS) ist AUS – jeder mit Tabellenrechten sieht und ändert alles'
      else 'Rechte live: Gäste ' || case when l.a_s then 'l' else '-' end || case when l.a_i then 'a' else '-' end || case when l.a_u then 'ä' else '-' end || case when l.a_d then 'x' else '-' end
        || ', Angemeldete ' || case when l.m_s then 'l' else '-' end || case when l.m_i then 'a' else '-' end || case when l.m_u then 'ä' else '-' end || case when l.m_d then 'x' else '-' end
        || coalesce('; erwartet: Gäste ' || case when e.a_s then 'l' else '-' end || case when e.a_i then 'a' else '-' end || case when e.a_u then 'ä' else '-' end || case when e.a_d then 'x' else '-' end
        || ', Angemeldete ' || case when e.m_s then 'l' else '-' end || case when e.m_i then 'a' else '-' end || case when e.m_u then 'ä' else '-' end || case when e.m_d then 'x' else '-' end, '; nicht aus den Skripten')
        || ' (l = lesen, a = anlegen, ä = ändern, x = löschen; die Zeilen schützt zusätzlich RLS)' end
  from et e full join lt l on l.name = e.name
  union all
  -- Spalten-Rechte
  select 'Spalten-Recht', e.tab || '.' || e.col,
    case
      when l.col is null then 'FEHLER'
      when exists (select 1 from generate_series(1, 3) i
                   where (substr(l.anon, i, 1) <> '-' and substr(e.anon, i, 1) = '-') or (substr(l.auth, i, 1) <> '-' and substr(e.auth, i, 1) = '-')) then 'FEHLER'
      when l.anon <> e.anon or l.auth <> e.auth then 'ABWEICHUNG'
      else 'ok' end,
    case when l.col is null then 'Spalte fehlt' else 'live Gäste ' || l.anon || ', Angemeldete ' || l.auth || '; erwartet ' || e.anon || ' / ' || e.auth || ' (s = lesen, i = anlegen, u = ändern)' end
  from ek e left join lk l on l.tab = e.tab and l.col = e.col
  union all
  -- Zugriffsregeln (RLS)
  select 'Zugriffsregel', coalesce(e.schema, l.schema) || '.' || coalesce(e.tab, l.tab) || ': ' || coalesce(e.name, l.name),
    case
      when l.name is null and e.mig then 'FEHLER'
      when l.name is null then 'ok'
      -- Zusätzliche erlaubende Regel, aber genau dieser Zugriff (Tabelle + Befehl) ist im Nachbau im schlimmsten Fall
      -- (für alle, ohne Bedingung) geprüft und durch einschränkende Regeln abgesichert → nur Hinweis
      when e.name is null and l.perm and exists (select 1 from ep x where x.wc and x.schema = l.schema and x.tab = l.tab
                                                  and (x.cmd = l.cmd or x.cmd = '*')) then 'HINWEIS'
      when e.name is null and l.perm then 'WARNUNG'
      when e.name is null then 'HINWEIS'
      when e.mig and ((l.perm and not e.perm) or (l.cmd = '*' and e.cmd <> '*')
        or (l.roles ~ '(^|,)(public|anon)(,|$)' and e.roles !~ '(^|,)(public|anon)(,|$)')) then 'FEHLER'
      when (l.hq <> e.hq or l.hw <> e.hw or l.cmd <> e.cmd or l.roles <> e.roles or l.perm <> e.perm) and e.mig then 'ABWEICHUNG'
      when (l.hq <> e.hq or l.hw <> e.hw or l.cmd <> e.cmd or l.roles <> e.roles or l.perm <> e.perm) then 'HINWEIS'
      else 'ok' end,
    case
      when l.name is null then 'Regel fehlt'
      when e.name is null and l.perm and exists (select 1 from ep x where x.wc and x.schema = l.schema and x.tab = l.tab
                                                  and (x.cmd = l.cmd or x.cmd = '*'))
        then 'zusätzliche Altregel – derselbe Zugriff (' || (select t from befehl where c = l.cmd) || ') ist im Nachbau im schlimmsten Fall geprüft: ' || coalesce(l.ausdruck, '')
      when e.name is null then 'nicht aus den Skripten – ' || case when l.perm then 'erlaubend' else 'einschränkend' end || ', ' || (select t from befehl where c = l.cmd) || ', für ' || coalesce(nullif(l.roles, ''), 'alle') || ': ' || coalesce(l.ausdruck, '')
      when not e.mig then 'bekannte Altregel, im Nachbau im schlimmsten Fall geprüft – live: ' || (select t from befehl where c = l.cmd) || ', für ' || l.roles || ': ' || coalesce(l.ausdruck, '')
      else (select t from befehl where c = l.cmd) || ' (erwartet ' || (select t from befehl where c = e.cmd) || '), für ' || l.roles || ' (erwartet ' || e.roles || '), '
        || case when l.perm then 'erlaubend' else 'einschränkend' end || case when l.hq <> e.hq or l.hw <> e.hw then ', anderer Ausdruck' else '' end || ': ' || coalesce(l.ausdruck, '') end
  from ep e full join lp l on l.schema = e.schema and l.tab = e.tab and l.name = e.name
  union all
  -- Prüfregeln (Constraints)
  select 'Prüfregel', e.tab || ': ' || e.name,
    case when l.name is null then 'FEHLER' when l.h <> e.h then 'ABWEICHUNG' when e.gueltig and not l.gueltig then 'WARNUNG' else 'ok' end,
    case when l.name is null then 'fehlt' when not l.gueltig then 'nicht für alle bestehenden Daten geprüft (NOT VALID): ' || l.def else 'live: ' || l.def end
  from ec e left join lc l on l.tab = e.tab and l.name = e.name
  union all
  -- Trigger
  select 'Trigger', e.schema || '.' || e.tab || ': ' || e.name,
    case when l.name is null then 'FEHLER' when l.an = 'D' then 'FEHLER' when l.fn <> e.fn then 'ABWEICHUNG' else 'ok' end,
    case when l.name is null then 'fehlt' when l.an = 'D' then 'abgeschaltet' else 'ruft ' || l.fn || ' (erwartet ' || e.fn || ')' end
  from etr e left join ltr l on l.schema = e.schema and l.tab = e.tab and l.name = e.name
  union all
  select 'Trigger', l.schema || '.' || l.tab || ': ' || l.fn, 'WARNUNG', count(*) || ' Trigger rufen dieselbe Funktion (erwartet ' || coalesce(max(x.n), 0) || ')'
  from ltr l left join (select schema, tab, fn, count(*) as n from etr group by 1, 2, 3) x on x.schema = l.schema and x.tab = l.tab and x.fn = l.fn
  where l.schema = 'public' group by l.schema, l.tab, l.fn having count(*) > greatest(coalesce(max(x.n), 1), 1)
  union all
  -- Speicher (Buckets)
  select 'Speicher', coalesce(e.id, l.id),
    case
      when l.id is null and e.mig then 'FEHLER'
      when l.id is null then 'HINWEIS'
      when e.id is null then 'HINWEIS'
      when l.public and not e.public then 'FEHLER'
      when e.groesse is not null and (l.groesse is null or l.groesse > e.groesse) then 'WARNUNG'
      when e.mime <> '' and l.mime <> e.mime then 'WARNUNG'
      when l.public <> e.public or l.groesse is distinct from e.groesse or l.mime <> e.mime then 'ABWEICHUNG'
      else 'ok' end,
    case when l.id is null then 'fehlt' else 'öffentlich: ' || case when l.public then 'ja' else 'nein' end || ', Größe: ' || coalesce(l.groesse::text, 'ohne Grenze') || ', Typen: ' || coalesce(nullif(l.mime, ''), 'alle')
      || coalesce('; erwartet: ' || case when e.public then 'öffentlich' else 'privat' end || ', ' || coalesce(e.groesse::text, 'ohne Grenze') || ', ' || coalesce(nullif(e.mime, ''), 'alle'), '; nicht aus den Skripten') end
  from eb e full join lb l on l.id = e.id
  union all
  -- Zeitpläne (pg_cron)
  select 'Zeitplan', z.name,
    case when to_regclass('cron.job') is null then 'HINWEIS'
         when (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from cron.job where jobname = %L and active', z.name), false, true, '')))[1]::text::int = 0 then 'FEHLER'
         else 'ok' end,
    case when to_regclass('cron.job') is null then 'pg_cron nicht vorhanden – Zeitpläne nicht prüfbar' else 'fehlt oder ist abgeschaltet' end
  from ez z
  union all
  -- Allgemein: Sichten, die Zugriffsregeln umgehen
  select 'Sicht', c.relname::text, 'WARNUNG', 'Sicht ohne security_invoker – liest mit Besitzerrechten an RLS vorbei (Gäste: '
    || case when has_table_privilege('anon', c.oid, 'SELECT') then 'ja' else 'nein' end || ')'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v', 'm') and coalesce(array_to_string(c.reloptions, ','), '') !~* 'security_invoker=(true|on|1)'
    and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('authenticated', c.oid, 'SELECT'))
)
select nr, bereich, objekt, status, details from (
  select 0 as nr, 'GESAMT' as bereich, '' as objekt,
    case when count(*) filter (where status in ('FEHLER', 'WARNUNG', 'ABWEICHUNG')) = 0 then 'Alles in Ordnung'
         else 'Bitte an Claude schicken' end as status,
    count(*) filter (where status = 'FEHLER') || ' Fehler, ' || count(*) filter (where status = 'WARNUNG') || ' Warnungen, '
      || count(*) filter (where status = 'ABWEICHUNG') || ' Abweichungen, ' || count(*) filter (where status = 'HINWEIS') || ' Hinweise – '
      || count(*) || ' Prüfungen gegen den getesteten Stand nach Skript ${letzte}' as details, 0 as rang
  from befunde
  union all
  select 1, bereich, count(*) || ' geprüft', case when count(*) filter (where status <> 'ok' and status <> 'HINWEIS') = 0 then 'ok' else 'prüfen' end,
    count(*) filter (where status = 'ok') || ' in Ordnung', 0 from befunde group by bereich
  union all
  select 2, bereich, objekt, status, details,
    case status when 'FEHLER' then 1 when 'WARNUNG' then 2 when 'ABWEICHUNG' then 3 else 4 end
  from befunde where status <> 'ok'
) x order by nr, rang, bereich, objekt;
`;
  return {
    sql,
    umfang: { funktionen: funktionen.length, tabellen: tabellen.length, spalten: spalten.length, regeln: regeln.length, pruefregeln: ec.length, trigger: etr.length, speicher: speicher.length, zeitplaene: zeitplaene.length },
  };
}
