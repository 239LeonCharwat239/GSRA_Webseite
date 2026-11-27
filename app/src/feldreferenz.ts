// Referenz aus der Lobby (Wunsch 25.11.): Die schnellste Runde eines anderen Fahrers im selben Rennen wird aus dem
// Stand aller Autos rekonstruiert – Streckenanteil über die Zeit, zehnmal pro Sekunde. Daraus entsteht der
// Zeitverlauf über die ganze Runde, also genau das, was man für „Wo verliere ich gegen den Schnellsten?“ braucht.
// Pedale und Gänge fremder Autos gibt die Simulation nicht heraus – die Referenz zeigt WO, nicht WIE.
//
// Datenschutz: der Vergleich läuft auf diesem PC. Nur die schnellste Runde mit demselben Auto wird anonym als
// GSRA-Referenzrunde geteilt (Strecke, Auto, Zeitverlauf – ohne Name, Startnummer, Kennung; abschaltbar; referenz.ts).
// Prüfungen gegen falsche Referenzen: nur vollständige Runden ohne Box, ohne Lücken (Auto nicht auf der Strecke,
// fehlende Daten), ohne Rückwärtssprünge und ohne „Teleport“ (unmögliches Tempo); die Zeit muss zur Rundenzeit der
// Simulation passen und darf nicht deutlich schneller sein als der Rest des Feldes (Abkürzung, Fehler).
import { RASTER } from "./analyse.ts";
import type { Feld } from "./typen.ts";

export type FeldRunde = {
  idx: number;
  runde: number;
  /** Rundenzeit in Sekunden */
  zeit: number;
  /** Zeit ab Rundenbeginn an RASTER+1 Punkten (Anteil 0…1) */
  t: Float64Array;
};

type Lauf = { runde: number; start: number | null; punkte: Array<{ z: number; a: number }>; kaputt: boolean };

const MAX_LUECKE = 1.5; // s zwischen zwei Messungen
const MAX_TEMPO = 110; // m/s (≈ 400 km/h) – schneller ist ein Sprung, keine Fahrt
const MAX_ZURUECK = 0.002; // Anteil – kleine Rückschritte sind Messrauschen

export class Feldrunden {
  private readonly laeufe = new Map<number, Lauf>();
  private readonly offen = new Map<number, { r: FeldRunde; bis: number }>();
  readonly beste = new Map<number, FeldRunde>();
  private readonly alle: number[] = [];

  /** Streckenlänge für die Tempo-Prüfung (ohne Länge nur die übrigen Prüfungen) */
  private laengeM: number | null;

  constructor(laengeM: number | null = null) {
    this.laengeM = laengeM;
  }

  laengeSetzen(m: number | null) {
    this.laengeM = m;
  }

  zuruecksetzen() {
    this.laeufe.clear();
    this.offen.clear();
    this.beste.clear();
    this.alle.length = 0;
  }

  aufnehmen(f: Feld): void {
    const z = f.zeit;
    if (z == null || !Number.isFinite(z)) return;
    for (let i = 0; i < f.anteil.length; i++) {
      if (i === f.ich) continue;
      this.pruefeOffen(i, f, z);
      const a = f.anteil[i];
      const r = f.runde[i];
      const lauf = this.laeufe.get(i);
      if (a == null || r == null || a < 0 || a > 1) {
        if (lauf) lauf.kaputt = true; // nicht auf der Strecke / keine Daten
        continue;
      }
      if (f.inBox?.[i]) {
        if (lauf) lauf.kaputt = true;
      }
      if (!lauf) {
        this.laeufe.set(i, { runde: r, start: null, punkte: [{ z, a }], kaputt: false });
        continue;
      }
      const vorher = lauf.punkte[lauf.punkte.length - 1];
      if (r === lauf.runde + 1 && a < 0.5 && vorher.a > 0.5) {
        // Ziellinie überquert: Zeitpunkt der Überquerung linear einschätzen
        const weg = 1 - vorher.a + a;
        const kreuz = weg > 0 ? vorher.z + ((z - vorher.z) * (1 - vorher.a)) / weg : z;
        if (lauf.start != null && !lauf.kaputt && z - vorher.z <= MAX_LUECKE) this.abschliessen(i, lauf, kreuz, f);
        this.laeufe.set(i, { runde: r, start: z - vorher.z <= MAX_LUECKE ? kreuz : null, punkte: [{ z, a }], kaputt: false });
        continue;
      }
      if (r !== lauf.runde) {
        // unerwarteter Rundensprung (Zurücksetzen, Verbindungsabbruch): neu anfangen
        this.laeufe.set(i, { runde: r, start: null, punkte: [{ z, a }], kaputt: false });
        continue;
      }
      const dz = z - vorher.z;
      const da = a - vorher.a;
      if (dz <= 0) continue;
      if (dz > MAX_LUECKE || da < -MAX_ZURUECK) lauf.kaputt = true;
      if (this.laengeM && da > 0 && (da * this.laengeM) / dz > MAX_TEMPO) lauf.kaputt = true;
      if (da > 0) lauf.punkte.push({ z, a });
    }
  }

  private abschliessen(idx: number, lauf: Lauf, ende: number, f: Feld) {
    const start = lauf.start as number;
    const zeit = ende - start;
    if (!(zeit > 20)) return;
    const pkt = [{ z: start, a: 0 }, ...lauf.punkte, { z: ende, a: 1 }];
    const t = new Float64Array(RASTER + 1);
    let j = 0;
    for (let k = 0; k <= RASTER; k++) {
      const a = k / RASTER;
      while (j < pkt.length - 2 && pkt[j + 1].a < a) j++;
      const p = pkt[j], q = pkt[j + 1];
      const anteil = q.a > p.a ? Math.min(1, Math.max(0, (a - p.a) / (q.a - p.a))) : 0;
      t[k] = p.z + (q.z - p.z) * anteil - start;
    }
    // Erst übernehmen, wenn die Rundenzeit der Simulation passt (kommt oft ein paar Zehntel später)
    this.offen.set(idx, { r: { idx, runde: lauf.runde, zeit, t }, bis: f.zeit! + 3 });
  }

  private pruefeOffen(idx: number, f: Feld, z: number) {
    const o = this.offen.get(idx);
    if (!o) return;
    const sim = f.letzte?.[idx];
    if (sim != null && sim > 0 && Math.abs(sim - o.r.zeit) <= 0.3) {
      this.offen.delete(idx);
      this.uebernehmen(o.r);
      return;
    }
    if (z >= o.bis) {
      this.offen.delete(idx);
      // Passte die Rundenzeit der Simulation nie: verwerfen. Liefert die Simulation gar keine Rundenzeiten,
      // reichen die übrigen Prüfungen.
      const keineZeiten = !f.letzte || f.letzte.every((x) => x == null || !(x > 0));
      if (keineZeiten) this.uebernehmen(o.r);
    }
  }

  private uebernehmen(r: FeldRunde) {
    this.alle.push(r.zeit);
    // deutlich schneller als der Rest des Feldes (Abkürzung, Messfehler)? Dann nicht als Referenz
    const sortiert = [...this.alle].sort((x, y) => x - y);
    const median = sortiert[Math.floor(sortiert.length / 2)];
    if (sortiert.length >= 3 && r.zeit < median * 0.9) return;
    const bisher = this.beste.get(r.idx);
    if (!bisher || r.zeit < bisher.zeit) this.beste.set(r.idx, r);
  }

  /** Die schnellste geprüfte Runde im Feld (null = noch keine) */
  schnellste(): FeldRunde | null {
    let best: FeldRunde | null = null;
    for (const r of this.beste.values()) if (!best || r.zeit < best.zeit) best = r;
    return best;
  }
}

/** Zeitunterschied über die Runde: positiv = eigene Runde langsamer als die Referenz */
export function deltaZu(ref: FeldRunde, eigeneT: Float64Array): Float64Array {
  const d = new Float64Array(ref.t.length);
  for (let i = 0; i < d.length; i++) d[i] = (eigeneT[i] ?? 0) - ref.t[i];
  return d;
}

/** Verlust je Abschnitt [start, ende] (Rasterpunkte), z. B. je Kurve */
export function verlustIn(d: Float64Array, start: number, ende: number): number {
  const s = Math.max(0, Math.min(d.length - 1, start));
  const e = Math.max(0, Math.min(d.length - 1, ende));
  return d[e] - d[s];
}
