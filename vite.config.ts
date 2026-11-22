// GSRA – Build der Webseite mit Vite (Entscheidung 22.11.2026, siehe CLAUDE.md)
//
// Vercel baut bei jedem Push mit „npm run build“ und veröffentlicht NUR den Ordner dist/ –
// Datenbank-Skripte, Tests, Server-Funktionen und Einstellungen sind damit nicht mehr öffentlich abrufbar.
//
// Übergang auf TypeScript, Seite für Seite:
//  * Neue Dateien sind TypeScript-Module (<script type="module" src="…ts">); Vite übersetzt, verkleinert und
//    versieht sie mit einem eindeutigen Namen (assets/name-HASH.js), Browser dürfen sie daher lange zwischenspeichern.
//  * Noch nicht umgestellte Skripte („klassische“ <script src="…js">) gehen unverändert mit – wie bisher.
import { createLogger, defineConfig, type Plugin } from "vite";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = import.meta.dirname;
const dateien = readdirSync(ROOT);
const seiten = dateien.filter((f) => f.endsWith(".html"));
// Klassische Skripte und Dateien, die per Name im Code stehen (z. B. das Logo im Login-Fenster)
const unveraendert = [...dateien.filter((f) => f.endsWith(".js")), "GSRA_Logo_ohne Hintergrund.png"];

function klassischeDateien(): Plugin {
  return {
    name: "gsra-klassische-dateien",
    apply: "build",
    generateBundle() {
      for (const datei of unveraendert) {
        this.emitFile({ type: "asset", fileName: datei, source: readFileSync(resolve(ROOT, datei)) });
      }
    },
  };
}

// Klassische Skripte kann Vite nicht bündeln – das ist gewollt (siehe oben); nur dieser Hinweis wird ausgeblendet,
// alle anderen Warnungen bleiben sichtbar
const logger = createLogger();
const warn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
  if (/can't be bundled without type="module"/.test(msg)) return;
  warn(msg, options);
};

export default defineConfig({
  root: ROOT,
  publicDir: false,
  customLogger: logger,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 0, // keine eingebetteten data:-Dateien, alles als eigene Datei (passt zur CSP)
    rolldownOptions: {
      input: Object.fromEntries(seiten.map((s) => [s.replace(/\.html$/, ""), resolve(ROOT, s)])),
    },
  },
  plugins: [klassischeDateien()],
});
