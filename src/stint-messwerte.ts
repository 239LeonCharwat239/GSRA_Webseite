// GSRA – Messwerte aus der GSRA-App für den Stint-Planer (gemeinsam: App baut den Link, Webseite liest ihn).
// Link: …/stintplaner.html#messwerte=<base64url(JSON)>. Der Anker geht nie an einen Server.
// Sicherheit: Jeder kann so einen Link bauen – deshalb liest die Webseite nur Zahlen in sinnvollen Grenzen und
// kurze, bereinigte Texte, zeigt alles per textContent und übernimmt erst nach Bestätigung.

export type Messwerte = {
  rundenzeit: number | null; // Sekunden (Schnitt der letzten gültigen Runden)
  verbrauch: number | null; // Liter pro Runde
  runden: number; // aus wie vielen Runden gemessen
  simulation: string;
  strecke: string;
  fahrzeug: string;
};

const TEXT_MAX = 60;
const textSauber = (v: unknown, max = TEXT_MAX) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
const zahlIn = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;

const base64urlKodieren = (b: Uint8Array) => btoa(Array.from(b, (x) => String.fromCharCode(x)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function messwerteKodieren(m: Messwerte): string {
  const roh = {
    v: 1,
    rz: m.rundenzeit != null ? Math.round(m.rundenzeit * 1000) / 1000 : null,
    vb: m.verbrauch != null ? Math.round(m.verbrauch * 1000) / 1000 : null,
    n: Math.round(m.runden),
    sim: textSauber(m.simulation, 40),
    strecke: textSauber(m.strecke),
    auto: textSauber(m.fahrzeug),
  };
  return base64urlKodieren(new TextEncoder().encode(JSON.stringify(roh)));
}

/** Liest die Messwerte aus dem Anker der Adresse; null, wenn keine oder ungültige Werte dabei sind */
export function messwerteLesen(anker: string): Messwerte | null {
  const m = /^#messwerte=([A-Za-z0-9_-]{8,2000})$/.exec(anker);
  if (!m) return null;
  let roh: Record<string, unknown>;
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    roh = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
  if (!roh || typeof roh !== "object" || roh.v !== 1) return null;
  const rundenzeit = zahlIn(roh.rz, 20, 1200);
  const verbrauch = zahlIn(roh.vb, 0.05, 40);
  if (rundenzeit == null && verbrauch == null) return null;
  const n = zahlIn(roh.n, 1, 1000);
  return {
    rundenzeit,
    verbrauch,
    runden: n == null ? 1 : Math.round(n),
    simulation: textSauber(roh.sim, 40),
    strecke: textSauber(roh.strecke),
    fahrzeug: textSauber(roh.auto),
  };
}
