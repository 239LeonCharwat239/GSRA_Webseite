// Live-Platz im Rennen (Fund 27.11.: „Er nennt mir die Position vom Rundenbeginn, obwohl ich schon zwei überholt
// habe“). iRacing aktualisiert den offiziellen Platz (CarIdxPosition) nur an der Ziellinie. Overlays rechnen den
// Platz deshalb selbst: Reihenfolge nach gefahrener Strecke = Runde + Streckenanteil. Das macht die App jetzt auch –
// im Rennen. Im Training und Qualifying zählt weiter der offizielle Platz (nach Bestzeit).
import type { Feld } from "./typen.ts";

/** Ist die Sitzung ein Rennen? (iRacing: „Race“, Demo: „Rennen“) */
export const istRennen = (sitzungsart: string | null | undefined) => /race|rennen/i.test(sitzungsart ?? "");

/** Autos im Rennen in Live-Reihenfolge (vorne → hinten); null = ich nicht auf der Strecke oder keine Daten.
 *  Mitgezählt werden Autos mit offizieller Wertung (platz > 0), die gerade auf der Strecke oder in der Box sind. */
export function liveReihenfolge(f: Feld | null): number[] | null {
  if (!f || f.ich == null) return null;
  const autos: { i: number; strecke: number }[] = [];
  for (let i = 0; i < f.anteil.length; i++) {
    const a = f.anteil[i];
    const r = f.runde[i];
    const p = f.platz[i];
    if (a == null || a < 0 || r == null || r < 0 || p == null || p <= 0) continue;
    autos.push({ i, strecke: r + Math.min(a, 0.999999) });
  }
  if (!autos.some((x) => x.i === f.ich)) return null;
  return autos.sort((x, y) => y.strecke - x.strecke || (f.platz[x.i] ?? 0) - (f.platz[y.i] ?? 0)).map((x) => x.i);
}

/** Mein Live-Platz (1 = vorne) oder null */
export function livePlatz(f: Feld | null): number | null {
  const reihe = liveReihenfolge(f);
  if (!reihe || f?.ich == null) return null;
  return reihe.indexOf(f.ich) + 1;
}

/** Wer ist live direkt vor bzw. hinter mir (Auto-Index) */
export function liveNachbarn(f: Feld | null): { vor: number | null; hinter: number | null } {
  const reihe = liveReihenfolge(f);
  if (!reihe || f?.ich == null) return { vor: null, hinter: null };
  const k = reihe.indexOf(f.ich);
  return { vor: k > 0 ? reihe[k - 1] : null, hinter: k < reihe.length - 1 ? reihe[k + 1] : null };
}
