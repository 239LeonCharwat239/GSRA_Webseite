// GSRA – TypeScript-Prüfung pro Seite (Sicherheitsbericht Nr. 17)
//
// Die Webseite ist reines JavaScript ohne Build-Schritt. Jede HTML-Seite lädt ihre Skripte als klassische
// <script>-Dateien; im Browser teilen sich nur die Skripte EINER Seite einen gemeinsamen Namensraum.
// Deshalb prüft dieses Skript jede Seite einzeln – mit genau den Dateien, die sie lädt, in genau dieser Reihenfolge.
// So findet TypeScript echte Fehler (z. B. eine Funktion, deren Datei auf der Seite gar nicht geladen wird,
// falsche Eigenschaften, Tippfehler) und meldet keine Scheinkonflikte zwischen Seiten, die sich nie begegnen.
//
// Aufruf:  cd tests/typ && npm ci --ignore-scripts && npm run pruefen
// Ergebnis: Exit-Code 0 = keine Fehler, 1 = Fehler (Liste mit Datei:Zeile und betroffenen Seiten)

import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TYPEN = join(ROOT, "types", "gsra.d.ts");

// Einstellungen aus tsconfig.json übernehmen (eine Quelle der Wahrheit, auch für den Editor)
const configPfad = join(ROOT, "tsconfig.json");
const gelesen = ts.readConfigFile(configPfad, ts.sys.readFile);
if (gelesen.error) {
  console.error(ts.flattenDiagnosticMessageText(gelesen.error.messageText, "\n"));
  process.exit(2);
}
const config = ts.parseJsonConfigFileContent(gelesen.config, ts.sys, ROOT);
const optionen = { ...config.options, checkJs: true, noEmit: true };

// Alle Seiten im Hauptordner und ihre lokalen Skripte (externe Bibliotheken vom CDN werden nicht geprüft)
const seiten = readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const SKRIPT = /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;
const alleDateien = new Set(readdirSync(ROOT).filter((f) => f.endsWith(".js")));
const eingebunden = new Set();

const fehler = new Map(); // Schlüssel: Datei:Zeile:Code:Text → { text, seiten:Set }
let geprueft = 0;

function merke(diag, seite) {
  const text = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
  let ort = "(Einstellungen)";
  if (diag.file && diag.start !== undefined) {
    const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
    const rel = diag.file.fileName.replace(/\\/g, "/").replace(ROOT.replace(/\\/g, "/") + "/", "");
    ort = `${rel}:${line + 1}:${character + 1}`;
  }
  const key = `${ort} TS${diag.code} ${text}`;
  if (!fehler.has(key)) fehler.set(key, { ort, code: diag.code, text, seiten: new Set() });
  fehler.get(key).seiten.add(seite);
}

for (const seite of seiten) {
  const html = readFileSync(join(ROOT, seite), "utf8");
  const skripte = [];
  for (const m of html.matchAll(SKRIPT)) {
    const src = m[1];
    if (/^https?:/i.test(src)) continue;
    const datei = src.split("?")[0].replace(/^\.?\//, "");
    // TypeScript-Module (Vite) liegen unter src/ – sie werden mit ihren Importen geprüft
    if (/^src\/.+\.ts$/.test(datei)) {
      try { readFileSync(join(ROOT, datei)); } catch {
        merke({ messageText: `Seite lädt ein Modul, das es nicht gibt: ${datei}`, code: 0 }, seite);
        continue;
      }
      skripte.push(join(ROOT, datei));
      continue;
    }
    if (datei.includes("/")) {
      merke({ messageText: `Skript außerhalb des Hauptordners wird nicht geprüft: ${datei}`, code: 0 }, seite);
      continue;
    }
    if (!alleDateien.has(datei)) {
      merke({ messageText: `Seite lädt ein Skript, das es nicht gibt: ${datei}`, code: 0 }, seite);
      continue;
    }
    skripte.push(join(ROOT, datei));
    eingebunden.add(datei);
  }
  if (!skripte.length) continue;
  const programm = ts.createProgram([TYPEN, ...skripte], optionen);
  for (const d of ts.getPreEmitDiagnostics(programm)) merke(d, seite);
  geprueft++;
}

// Dateien, die keine Seite lädt, einzeln prüfen (sonst blieben sie ungeprüft)
for (const datei of [...alleDateien].filter((d) => !eingebunden.has(d)).sort()) {
  const programm = ts.createProgram([TYPEN, join(ROOT, datei)], optionen);
  for (const d of ts.getPreEmitDiagnostics(programm)) merke(d, `(ohne Seite) ${datei}`);
}

const liste = [...fehler.values()].sort((a, b) => a.ort.localeCompare(b.ort, "de", { numeric: true }));
for (const f of liste) {
  const s = [...f.seiten];
  const seitenText = s.length > 3 ? `${s.slice(0, 3).join(", ")} +${s.length - 3}` : s.join(", ");
  console.log(`${f.ort}  TS${f.code}  ${f.text}   [${seitenText}]`);
  // In GitHub erscheint der Fehler zusätzlich direkt an der Codezeile
  if (process.env.GITHUB_ACTIONS) {
    const [datei, zeile, spalte] = f.ort.split(":");
    const text = `TS${f.code}: ${f.text} (Seiten: ${s.join(", ")})`.replace(/%/g, "%25").replace(/\r?\n/g, "%0A");
    console.log(zeile ? `::error file=${datei},line=${zeile},col=${spalte}::${text}` : `::error::${text}`);
  }
}
console.log(`\n${geprueft} Seiten, ${eingebunden.size} Skripte geprüft – ${liste.length} Fehler (TypeScript ${ts.version}).`);
process.exit(liste.length ? 1 : 0);
