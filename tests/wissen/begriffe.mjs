// Prüfung des Nachschlagewerks (src/wissen/*.ts) – läuft mit „npm run pruefen“ und bei jedem Push.
// Prüft: eindeutige ids im richtigen Format, gültige „Siehe auch“-Verweise, vollständige Einträge
// (Kurzbeschreibung, mindestens zwei Absätze, Praxis-Tipp) und keine Namen fremder Anbieter in den Texten.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ORDNER = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "wissen");
const NICHT_INHALT = new Set(["begriff.ts", "begriffe.ts"]);
// Redaktionelle Regel: keine Hersteller- oder Plattformnamen (Simulationen sind erlaubt)
const VERBOTEN = /\b(whatsapp|discord|telegram|signal-app|fanatec|logitech|thrustmaster|simucube|moza|heusinkveld|asetek|buttkicker|nvidia|amd|intel|google|youtube|twitch|facebook|instagram|tiktok|garage61|trading paints|crew chief)\b/i;

const fehler = [];
const eintraege = [];
for (const datei of readdirSync(ORDNER).filter((d) => d.endsWith(".ts") && !NICHT_INHALT.has(d)).sort()) {
  const text = readFileSync(join(ORDNER, datei), "utf8");
  const kategorie = /kategorie\("([^"]+)"/.exec(text)?.[1] || "?";
  const teile = text.split(/\n\s*\{ id: "/).slice(1);
  for (const teil of teile) {
    const id = teil.slice(0, teil.indexOf('"'));
    const siehe = /siehe: \[([^\]]*)\]/.exec(teil)?.[1].match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) || [];
    const absaetze = (/text: \[([\s\S]*?)\n\s*\],/.exec(teil)?.[1].match(/^\s*"/gm) || []).length;
    eintraege.push({ datei, kategorie, id, siehe, absaetze, kurz: /kurz: "/.test(teil), tipp: /tipp: "/.test(teil), teil });
  }
}

const ids = new Set();
for (const e of eintraege) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) fehler.push(`${e.datei}: ungültige id „${e.id}“`);
  if (ids.has(e.id)) fehler.push(`${e.datei}: id „${e.id}“ doppelt`);
  ids.add(e.id);
  if (!e.kurz) fehler.push(`${e.id}: Kurzbeschreibung fehlt`);
  if (e.absaetze < 2) fehler.push(`${e.id}: zu kurz erklärt (${e.absaetze} Absatz)`);
  if (!e.tipp) fehler.push(`${e.id}: Praxis-Tipp fehlt`);
  const treffer = VERBOTEN.exec(e.teil);
  if (treffer) fehler.push(`${e.id}: Name eines fremden Anbieters („${treffer[0]}“)`);
}
for (const e of eintraege) {
  for (const s of e.siehe) {
    if (!ids.has(s)) fehler.push(`${e.id}: Verweis auf unbekannten Begriff „${s}“`);
    if (s === e.id) fehler.push(`${e.id}: verweist auf sich selbst`);
  }
}

const proKategorie = Object.entries(eintraege.reduce((acc, e) => ({ ...acc, [e.kategorie]: (acc[e.kategorie] || 0) + 1 }), {}));
console.log(`Nachschlagewerk: ${eintraege.length} Begriffe in ${proKategorie.length} Kategorien`);
proKategorie.forEach(([k, n]) => console.log(`  ${k}: ${n}`));
if (fehler.length) {
  fehler.forEach((f) => console.log(`::error file=src/wissen::${f}`));
  console.log(`${fehler.length} Fehler im Nachschlagewerk.`);
  process.exit(1);
}
console.log("Nachschlagewerk: alle ids eindeutig, alle Verweise gültig, alle Einträge vollständig – 0 Fehler.");
