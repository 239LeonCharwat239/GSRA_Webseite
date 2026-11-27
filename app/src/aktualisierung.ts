// Automatische Aktualisierung (Wunsch 27.11.: „dass die App laufend aktualisiert wird, sobald ich pushe“).
// Ablauf: GitHub baut bei jedem Push mit App-Änderungen eine neue Version und signiert sie (app-installer.yml).
// Die App fragt 15 s nach dem Start und danach alle 3 Stunden nach, lädt eine neue Version still im Hintergrund und
// zeigt dann „Neue Version bereit · Jetzt neu starten“. Installiert wird nur auf Klick oder beim Schließen über die
// eigene Fensterleiste – nie mitten in einer Sitzung. Die Signatur prüft das Update-Modul (Rust) gegen den
// öffentlichen Schlüssel in tauri.conf.json; ein Update ohne gültige Signatur wird verworfen.
import type { Update } from "@tauri-apps/plugin-updater";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
};

const ERSTE_SUCHE_MS = 15_000;
const ALLE_MS = 3 * 3600_000;

export type Aktualisierung = {
  /** Vor dem Schließen: Liegt ein Update bereit, wird es jetzt installiert (die App schließt sich dabei selbst) */
  vorDemSchliessen: () => Promise<boolean>;
};

export async function aktualisierungEinrichten(istApp: boolean, hinweis: (t: string, art?: "ok" | "fehler") => void): Promise<Aktualisierung> {
  const nichts: Aktualisierung = { vorDemSchliessen: async () => false };
  if (!istApp) return nichts;
  const { check } = await import("@tauri-apps/plugin-updater");
  let bereit: Update | null = null;
  let sucht = false;

  const installieren = async () => {
    if (!bereit) return false;
    const knopf = $<HTMLButtonElement>("updKnopf");
    knopf.disabled = true;
    knopf.textContent = "Wird installiert …";
    try {
      await bereit.install(); // Windows: die App schließt sich, der Installer läuft kurz und startet sie neu
      return true;
    } catch {
      knopf.disabled = false;
      knopf.textContent = "Jetzt neu starten";
      hinweis("Das Update ließ sich nicht installieren – beim nächsten Start versuche ich es noch einmal.", "fehler");
      return false;
    }
  };

  const suchen = async () => {
    if (bereit || sucht) return;
    sucht = true;
    try {
      const u = await check({ timeout: 30_000 });
      if (!u) return;
      await u.download(); // still im Hintergrund; die Signatur wird beim Installieren geprüft
      bereit = u;
      $("updText").textContent = `Neue Version ${u.version.slice(0, 20)} bereit`;
      $("updHinweis").hidden = false;
      hinweis(`Neue Version ${u.version.slice(0, 20)} ist geladen – sie wird beim nächsten Neustart installiert.`, "ok");
    } catch {
      /* offline oder GitHub nicht erreichbar: später noch einmal */
    } finally {
      sucht = false;
    }
  };

  $("updKnopf").addEventListener("click", () => void installieren());
  window.setTimeout(() => void suchen(), ERSTE_SUCHE_MS);
  window.setInterval(() => void suchen(), ALLE_MS);
  return { vorDemSchliessen: installieren };
}
