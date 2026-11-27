// Automatische Aktualisierung (Wunsch 27.11.: „dass die App laufend aktualisiert wird, sobald ich pushe“).
// Ablauf: GitHub baut bei jedem Push mit App-Änderungen eine neue Version und signiert sie (app-installer.yml).
// Die App fragt 10 s nach dem Start, danach alle 30 Minuten und beim Zurückkehren ins Fenster nach, lädt eine neue
// Version still im Hintergrund und zeigt dann „Neue Version bereit · Jetzt neu starten“. Installiert wird nur auf Klick
// oder beim Schließen über die eigene Fensterleiste – nie mitten in einer Sitzung. Die Signatur prüft das Update-Modul
// (Rust) gegen den öffentlichen Schlüssel in tauri.conf.json; ein Update ohne gültige Signatur wird verworfen.
// Fund 27.11.: Die erste Fassung verschluckte Fehler – jetzt zeigt das Konto-Menü Version, letzte Prüfung und den
// genauen Fehler, und „Nach Updates suchen“ prüft sofort.
import type { Update } from "@tauri-apps/plugin-updater";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
};

const ERSTE_SUCHE_MS = 10_000;
const ALLE_MS = 30 * 60_000;

export type Aktualisierung = {
  /** Vor dem Schließen: Liegt ein Update bereit, wird es jetzt installiert (die App schließt sich dabei selbst) */
  vorDemSchliessen: () => Promise<boolean>;
};

/** Fehlermeldung des Update-Moduls lesbar machen (kommt als Text oder Error) */
export function fehlerText(e: unknown): string {
  const t = typeof e === "string" ? e : e instanceof Error ? e.message : JSON.stringify(e);
  return (t || "unbekannter Fehler").replace(/\s+/g, " ").slice(0, 300);
}

/** @param ruhig true = gerade keine Sitzung, keine Demo, kein Funk – dann darf sich die App sofort neu starten */
export async function aktualisierungEinrichten(istApp: boolean, hinweis: (t: string, art?: "ok" | "fehler") => void,
  ruhig: () => boolean = () => false): Promise<Aktualisierung> {
  const nichts: Aktualisierung = { vorDemSchliessen: async () => false };
  if (!istApp) return nichts;
  const { check } = await import("@tauri-apps/plugin-updater");
  const { getVersion } = await import("@tauri-apps/api/app");
  const version = await getVersion().catch(() => "?");
  const stand = $("updStand");
  const zeit = () => new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  stand.textContent = `Version ${version}`;
  let bereit: Update | null = null;
  let sucht = false;
  let zuletzt = 0;
  const start = Date.now();
  let gleichUhr = 0;

  const installieren = async () => {
    if (!bereit) return false;
    const knopf = $<HTMLButtonElement>("updKnopf");
    knopf.disabled = true;
    knopf.textContent = "Wird installiert …";
    try {
      await bereit.install(); // Windows: die App schließt sich, der Installer läuft kurz und startet sie neu
      return true;
    } catch (e) {
      knopf.disabled = false;
      knopf.textContent = "Jetzt neu starten";
      hinweis(`Das Update ließ sich nicht installieren: ${fehlerText(e)}`, "fehler");
      return false;
    }
  };

  const suchen = async (vonHand: boolean) => {
    if (bereit) {
      if (vonHand) hinweis(`Version ${bereit.version} ist schon geladen – klick links unten auf „Jetzt neu starten“.`, "ok");
      return;
    }
    if (sucht) return;
    sucht = true;
    zuletzt = Date.now();
    const knopf = $<HTMLButtonElement>("updSuchen");
    knopf.disabled = true;
    try {
      stand.textContent = `Version ${version} · suche nach Updates …`;
      const u = await check({ timeout: 30_000 });
      if (!u) {
        stand.textContent = `Version ${version} · aktuell (geprüft ${zeit()})`;
        if (vonHand) hinweis(`Du hast die neueste Version (${version}).`, "ok");
        return;
      }
      stand.textContent = `Version ${version} · lade ${u.version.slice(0, 20)} …`;
      $("updText").textContent = `Version ${u.version.slice(0, 20)} wird geladen …`;
      $<HTMLButtonElement>("updKnopf").hidden = true;
      $("updHinweis").hidden = false;
      await u.download(); // die Signatur prüft das Update-Modul dabei
      bereit = u;
      stand.textContent = `Version ${version} · ${u.version.slice(0, 20)} bereit`;
      $("updText").textContent = `Neue Version ${u.version.slice(0, 20)} bereit`;
      $<HTMLButtonElement>("updKnopf").hidden = false;
      // Ganz automatisch (Wunsch 27.11.): Kurz nach dem Start und ohne laufende Sitzung installiert sie sich gleich
      // selbst (die App startet nach wenigen Sekunden neu); sonst beim Schließen oder auf Klick – nie mitten im Rennen.
      if (Date.now() - start < 3 * 60_000 && ruhig()) {
        let sek = 8;
        $("updText").textContent = `Neue Version ${u.version.slice(0, 20)} – die App aktualisiert sich in ${sek} s`;
        $<HTMLButtonElement>("updSpaeter").hidden = false;
        gleichUhr = window.setInterval(() => {
          sek--;
          if (!ruhig()) { spaeter(); return; }
          if (sek > 0) $("updText").textContent = `Neue Version ${u.version.slice(0, 20)} – die App aktualisiert sich in ${sek} s`;
          else { window.clearInterval(gleichUhr); void installieren(); }
        }, 1000);
      } else {
        hinweis(`Neue Version ${u.version.slice(0, 20)} ist geladen – sie installiert sich beim Schließen der App oder mit „Jetzt neu starten“.`, "ok");
      }
    } catch (e) {
      $("updHinweis").hidden = !bereit;
      stand.textContent = `Version ${version} · Update-Prüfung fehlgeschlagen (${zeit()}): ${fehlerText(e)}`;
      if (vonHand) hinweis(`Update-Prüfung fehlgeschlagen: ${fehlerText(e)}`, "fehler");
    } finally {
      sucht = false;
      knopf.disabled = false;
    }
  };

  const spaeter = () => {
    window.clearInterval(gleichUhr);
    $<HTMLButtonElement>("updSpaeter").hidden = true;
    if (bereit) $("updText").textContent = `Neue Version ${bereit.version.slice(0, 20)} bereit – installiert sich beim Schließen`;
  };
  $("updKnopf").addEventListener("click", () => { window.clearInterval(gleichUhr); void installieren(); });
  $("updSpaeter").addEventListener("click", spaeter);
  $("updSuchen").addEventListener("click", () => void suchen(true));
  window.setTimeout(() => void suchen(false), ERSTE_SUCHE_MS);
  window.setInterval(() => void suchen(false), ALLE_MS);
  // Zurück im Fenster und die letzte Prüfung ist eine Weile her: gleich noch einmal
  window.addEventListener("focus", () => { if (Date.now() - zuletzt > 10 * 60_000) void suchen(false); });
  return { vorDemSchliessen: installieren };
}
