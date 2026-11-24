// Sprit: Verbrauch pro Runde, wie lange er reicht, wie viel bis zum Ziel fehlt.
// Gezählt werden nur Runden ohne Boxengasse und ohne Nachtanken (sonst stimmt der Verbrauch nicht).

import type { Runde } from "./runden.ts";

/** Durchschnittlicher Verbrauch der letzten `anzahl` sauberen Runden (Liter) */
export function verbrauchProRunde(runden: Runde[], anzahl = 5): number | null {
  const werte = runden.filter((r) => r.sprit != null && !r.inBox && r.sprit > 0).slice(-anzahl).map((r) => r.sprit as number);
  if (!werte.length) return null;
  return werte.reduce((a, b) => a + b, 0) / werte.length;
}

/** Durchschnittliche Rundenzeit der letzten `anzahl` gültigen Runden (Sekunden) */
export function rundenzeitSchnitt(runden: Runde[], anzahl = 5): number | null {
  const werte = runden.filter((r) => r.gueltig).slice(-anzahl).map((r) => r.zeit);
  if (!werte.length) return null;
  return werte.reduce((a, b) => a + b, 0) / werte.length;
}

export type Bedarf = {
  rundenNoetig: number;
  spritNoetig: number;
  nachtanken: number;
  reicht: boolean;
  rundenMitTank: number;
};

/**
 * Bedarf bis zum Ziel.
 * @param rest  entweder Restzeit in Sekunden (Zeitrennen) oder Restrunden
 * @param reserveRunden  Sicherheitsreserve in Runden (Standard: eine halbe)
 */
export function bisZiel(o: { sprit: number; verbrauch: number; rundenzeit: number | null; rest: { sekunden: number } | { runden: number }; reserveRunden?: number }): Bedarf | null {
  if (!(o.verbrauch > 0) || !(o.sprit >= 0)) return null;
  let runden: number;
  if ("sekunden" in o.rest) {
    if (!o.rundenzeit || !(o.rundenzeit > 0) || !(o.rest.sekunden >= 0)) return null;
    // Bei Zeitrennen fährst du die angefangene Runde noch zu Ende
    runden = Math.ceil(o.rest.sekunden / o.rundenzeit);
  } else {
    if (!(o.rest.runden >= 0)) return null;
    runden = Math.ceil(o.rest.runden);
  }
  const reserve = (o.reserveRunden ?? 0.5) * o.verbrauch;
  const spritNoetig = runden * o.verbrauch + reserve;
  const nachtanken = Math.max(0, spritNoetig - o.sprit);
  return { rundenNoetig: runden, spritNoetig, nachtanken, reicht: nachtanken <= 0, rundenMitTank: o.sprit / o.verbrauch };
}
