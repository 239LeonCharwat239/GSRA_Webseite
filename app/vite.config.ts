// GSRA-App: Oberfläche (Vite). Tauri lädt im fertigen Programm den Ordner dist/.
import { defineConfig } from "vite";
import { resolve } from "node:path";

// Gemeinsame Bausteine mit der Webseite (z. B. die Ladeanimation) liegen in ../src – nur genau diese Dateien
// darf die Entwicklungs-Vorschau zusätzlich ausliefern, sonst nichts außerhalb des App-Ordners.
const GEMEINSAM = [resolve(import.meta.dirname, "../src/ladeanimation.ts")];

export default defineConfig({
  root: import.meta.dirname,
  clearScreen: false,
  server: { port: 1420, strictPort: true, fs: { allow: [import.meta.dirname, ...GEMEINSAM] } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 0, // keine data:-Skripte, passt zur strengen CSP
  },
});
