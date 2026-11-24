// GSRA-App: Oberfläche (Vite). Tauri lädt im fertigen Programm den Ordner dist/.
import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname,
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 0, // keine data:-Skripte, passt zur strengen CSP
  },
});
