// GSRA-Seiten DIREKT in der App (Wunsch 26.11.: „nicht weiterleiten – alle Funktionen in der App“).
// Die Seitenleiste wählt einen Bereich (Messenger, Kalender, Setups …); in der App legt sich die Seite passgenau über
// die Inhaltsfläche (#webFlaeche) – die Prüfung, was geladen werden darf, macht src-tauri/src/webbereich.rs.
// In der Browser-Vorschau erscheint an dieser Stelle nur ein Hinweis mit Link.

import { ladeLogo } from "../../src/ladeanimation.ts";

const WEBSEITE = "https://gsra-webseite.vercel.app";

type Aufruf = <T>(befehl: string, daten?: Record<string, unknown>) => Promise<T>;
interface Ort {
  seite: string;
  host: string;
  gsra: boolean;
  laedt: boolean;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
};

let istApp = false;
let aktiv: string | null = null;
let aufrufenFn: Aufruf | null = null;
let titelAktiv = "";

async function aufrufen<T>(befehl: string, daten?: Record<string, unknown>): Promise<T> {
  if (!aufrufenFn) aufrufenFn = (await import("@tauri-apps/api/core")).invoke as Aufruf;
  return aufrufenFn<T>(befehl, daten);
}

function flaeche() {
  const r = $("webFlaeche").getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), breite: Math.round(r.width), hoehe: Math.round(r.height) };
}

function ortZeigen(text: string, art: "laedt" | "gsra" | "zahlung" | "fremd" | "fehler") {
  const ort = $("webOrt");
  ort.textContent = text;
  ort.dataset.art = art;
}

const dialogOffen = () => [...document.querySelectorAll("dialog")].some((d) => d.open);

/** Zeigt eine GSRA-Seite in der Inhaltsfläche (anker nur für den Stint-Planer: „messwerte=…“) */
export async function webZeigen(seite: string, titel: string, anker?: string): Promise<void> {
  aktiv = seite;
  titelAktiv = titel;
  document.body.classList.add("web-aktiv");
  $("webLeiste").hidden = !istApp;
  const vorschau = $("webVorschau");
  if (!istApp) {
    vorschau.hidden = false;
    $("webVorschauText").textContent = `In der App erscheint hier „${titel}“ direkt – ohne Browser und ohne Weiterleitung.`;
    $("webVorschauKnopf").hidden = false;
    return;
  }
  vorschau.hidden = false;
  $("webVorschauText").textContent = `${titel} wird geladen …`;
  $("webVorschauKnopf").hidden = true;
  ortZeigen("Lädt …", "laedt");
  if (dialogOffen()) return; // erscheint, sobald der Dialog zu ist
  await new Promise((r) => requestAnimationFrame(() => r(null))); // Fläche ist sichtbar und vermessen
  if (aktiv !== seite) return;
  try {
    await aufrufen("bereich_zeigen", { seite, anker: anker ?? null, ...flaeche() });
  } catch (e) {
    ortZeigen("Fehler", "fehler");
    $("webVorschauText").textContent = typeof e === "string" ? e : "Die Seite konnte nicht geöffnet werden.";
  }
}

/** Blendet die GSRA-Seiten aus (z. B. beim Wechsel zur Telemetrie) */
export function webVerbergen(): void {
  if (!aktiv) return;
  aktiv = null;
  document.body.classList.remove("web-aktiv");
  $("webLeiste").hidden = true;
  if (istApp) void aufrufen("bereich_verbergen").catch(() => {});
}

export const webAktiv = () => aktiv;

/** Suche der Webseite öffnen (Lupe in der Kopfzeile der App, Strg+K). Ist keine GSRA-Seite offen, öffnet sie die
 *  Neuigkeiten und darin die Suche – die Treffer führen auf die Seiten in der App. */
export async function webSuche(oeffneStartseite: () => void): Promise<void> {
  if (!istApp) return;
  if (!aktiv) {
    oeffneStartseite();
    for (const ms of [900, 1800, 3500]) {
      await new Promise((ok) => window.setTimeout(ok, ms));
      if (aktiv && (await aufrufen("bereich_aktion", { seite: aktiv, aktion: "suche" }).then(() => true, () => false))) return;
    }
    return;
  }
  await aufrufen("bereich_aktion", { seite: aktiv, aktion: "suche" }).catch(() => {});
}

export async function webEinrichten(app: boolean): Promise<void> {
  istApp = app;
  // Ladeanimation der GSRA statt weißem Bildschirm: Die Seite bleibt versteckt, bis sie fertig ist (webbereich.rs),
  // darunter läuft das animierte Logo
  $("webVorschauLogo").replaceChildren(ladeLogo().element);
  $("webVorschauKnopf").addEventListener("click", () => {
    if (aktiv) window.open(`${WEBSEITE}/${aktiv}`, "_blank", "noopener");
  });
  for (const [id, aktion] of [["webZurueck", "zurueck"], ["webVor", "vor"], ["webNeu", "neu"]] as const) {
    $(id).addEventListener("click", () => {
      if (aktiv) void aufrufen("bereich_aktion", { seite: aktiv, aktion }).catch(() => {});
    });
  }
  // Klick auf den Seitentitel = zurück zur Startseite des Bereichs
  $("seitenTitel").addEventListener("click", () => {
    if (aktiv && istApp) void aufrufen("bereich_aktion", { seite: aktiv, aktion: "anfang" }).catch(() => {});
  });
  if (!istApp) return;

  // Fenstergröße geändert → Seite wandert mit
  let geplant = false;
  new ResizeObserver(() => {
    if (!aktiv || geplant || dialogOffen()) return;
    geplant = true;
    requestAnimationFrame(() => {
      geplant = false;
      if (aktiv) void aufrufen("bereich_flaeche", flaeche()).catch(() => {});
    });
  }).observe($("webFlaeche"));

  // Dialoge der App (Anmeldung, Datenschutz) liegen über allem: Seite solange ausblenden
  const beobachter = new MutationObserver(() => {
    if (!aktiv) return;
    if (dialogOffen()) void aufrufen("bereich_verbergen").catch(() => {});
    else void webZeigen(aktiv, titelAktiv);
  });
  for (const d of document.querySelectorAll("dialog")) beobachter.observe(d, { attributes: true, attributeFilter: ["open"] });

  // Wo bin ich gerade? (kommt nur von der App selbst, nie von der Webseite)
  const { listen } = await import("@tauri-apps/api/event");
  await listen<Ort>("gsra://web", (e) => {
    const o = e.payload;
    if (!o || o.seite !== aktiv) return;
    if (o.laedt) ortZeigen("Lädt …", "laedt");
    else if (o.gsra) ortZeigen("GSRA · sicher verbunden", "gsra");
    else if (o.host === "stripe.com" || o.host.endsWith(".stripe.com")) ortZeigen(`Sichere Zahlung · ${o.host}`, "zahlung");
    else ortZeigen(o.host || "Seite", "fremd");
  });
}
