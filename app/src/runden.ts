// Runden erkennen und aufzeichnen.
//
// Eine Runde beginnt, wenn das Auto die Ziellinie überquert (Streckenanteil springt von fast 1 auf fast 0).
// Den genauen Zeitpunkt rechnen wir zwischen den beiden Messpunkten aus (lineare Interpolation) – so ist die
// Rundenzeit auf wenige Tausendstel genau, auch wenn nur 60 Messpunkte pro Sekunde ankommen.
//
// Ungültig (für Bestzeit und Vergleich) ist eine Runde mit Boxengasse, Zurücksetzen, Datenlücke oder ohne Auto
// auf der Strecke. Den Verbrauch rechnen wir nur, wenn nicht nachgetankt wurde.

import type { Probe } from "./typen.ts";

/** Ein Punkt der Runde: a = Anteil 0…1, t = Sekunden seit Rundenbeginn, r = Fahrtrichtung (Bogenmaß, NaN = unbekannt) */
export type Punkt = { a: number; t: number; v: number; g: number; b: number; gang: number; l: number; r: number };

export type Runde = {
  nr: number;
  zeit: number;
  gueltig: boolean;
  grund: string | null;
  /** verbrauchter Sprit in Litern (null: unbekannt oder nachgetankt) */
  sprit: number | null;
  spritEnde: number | null;
  inBox: boolean;
  punkte: Punkt[];
  /** Warum die Runde nicht als Referenz geteilt werden darf (neben der Strecke, Vorfallpunkte); null = sauber */
  sperre?: string | null;
};

type Laufend = {
  nr: number;
  start: number;
  punkte: Punkt[];
  grund: string | null;
  spritStart: number | null;
  nachgetankt: boolean;
  inBox: boolean;
  abseits: string | null;
  vorfaelleStart: number | null;
};

const MAX_LUECKE = 1.0; // Sekunden ohne Daten → Runde ungültig
const MIN_RUNDE = 10; // kürzere „Runden“ sind Messfehler

const mische = (x: number | null, y: number | null, f: number) => (x == null || y == null ? (y ?? x ?? 0) : x + (y - x) * f);

/** Winkel zwischen zwei Richtungen mischen (über den kürzeren Weg, z. B. 350° → 10°) */
export function winkelMischen(x: number | null, y: number | null, f: number): number {
  if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return y ?? x ?? Number.NaN;
  let d = (y - x) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return x + d * f;
}

function punkt(p: Probe, a: number, t: number): Punkt {
  return { a, t, v: p.tempo ?? 0, g: p.gas ?? 0, b: p.bremse ?? 0, gang: p.gang ?? 0, l: p.lenkung ?? 0, r: p.richtung ?? Number.NaN };
}

function zwischen(p: Probe, q: Probe, f: number, a: number, t: number): Punkt {
  return { a, t, v: mische(p.tempo, q.tempo, f), g: mische(p.gas, q.gas, f), b: mische(p.bremse, q.bremse, f), gang: f < 0.5 ? (p.gang ?? 0) : (q.gang ?? 0), l: mische(p.lenkung, q.lenkung, f), r: winkelMischen(p.richtung, q.richtung, f) };
}

export class Rundenzaehler {
  readonly runden: Runde[] = [];
  private aktuell: Laufend | null = null;
  private vorher: Probe | null = null;
  private letzte: Probe | null = null;
  private readonly max: number;

  constructor(max = 300) {
    this.max = max;
  }

  zuruecksetzen() {
    this.runden.length = 0;
    this.aktuell = null;
    this.vorher = null;
    this.letzte = null;
  }

  /** Letzter Messpunkt (für die Live-Ansicht) */
  get jetzt(): Probe | null {
    return this.letzte;
  }

  /** Laufende Runde: Nummer, Sekunden seit Rundenbeginn, Punkte */
  get laufend(): { nr: number; t: number; a: number; punkte: Punkt[]; grund: string | null } | null {
    const l = this.aktuell;
    const p = this.letzte;
    if (!l || !p || p.zeit == null || p.anteil == null) return null;
    return { nr: l.nr, t: p.zeit - l.start, a: p.anteil, punkte: l.punkte, grund: l.grund };
  }

  /** Beste gültige Runde */
  get beste(): Runde | null {
    let b: Runde | null = null;
    for (const r of this.runden) if (r.gueltig && (!b || r.zeit < b.zeit)) b = r;
    return b;
  }

  /** Nimmt einen Messpunkt auf; liefert die gerade beendete Runde oder null */
  aufnehmen(p: Probe): Runde | null {
    if (p.zeit == null || p.anteil == null || !Number.isFinite(p.zeit) || !Number.isFinite(p.anteil)) return null;
    if (p.anteil < 0 || p.anteil > 1.0001) return null;
    this.letzte = p;
    const q = this.vorher;
    this.vorher = p;
    if (!q || q.zeit == null || q.anteil == null) return null;

    const dt = p.zeit - q.zeit;
    if (dt < -0.001) {
      // Zeit läuft rückwärts (Wiederholung, neue Sitzung): laufende Runde verwerfen
      this.aktuell = null;
      return null;
    }
    if (dt <= 0) return null;
    const l = this.aktuell;
    if (l && dt > MAX_LUECKE) l.grund ??= "Datenlücke";

    const ueberLinie = q.anteil > 0.9 && p.anteil < 0.1;
    if (!ueberLinie) {
      if (!l) return null;
      if (q.anteil < 0.1 && p.anteil > 0.9) l.grund ??= "Rückwärts über die Linie";
      else if (p.anteil < q.anteil - 0.02) l.grund ??= "Zurückgesetzt";
      if (p.inBox) {
        l.inBox = true;
        l.grund ??= "Boxengasse";
      }
      if (p.aufStrecke === false) l.grund ??= "Nicht auf der Strecke";
      // Für Referenzrunden (Wunsch 28.11.): alle vier Räder neben der Strecke oder neue Vorfallpunkte → nicht teilbar
      if (p.lage === 0) l.abseits ??= "Neben der Strecke";
      if (l.vorfaelleStart == null && p.vorfaelle != null) l.vorfaelleStart = p.vorfaelle;
      else if (p.vorfaelle != null && l.vorfaelleStart != null && p.vorfaelle > l.vorfaelleStart) l.abseits ??= "Vorfallpunkte in der Runde";
      if (p.sprit != null && q.sprit != null && p.sprit > q.sprit + 0.3) l.nachgetankt = true;
      const letzter = l.punkte[l.punkte.length - 1];
      if (!letzter || p.anteil > letzter.a) l.punkte.push(punkt(p, p.anteil, p.zeit - l.start));
      return null;
    }

    // Ziellinie: genauen Zeitpunkt zwischen q und p berechnen
    const vorDerLinie = 1 - q.anteil;
    const f = vorDerLinie / (vorDerLinie + p.anteil);
    const tLinie = q.zeit + f * dt;
    const spritLinie = q.sprit != null && p.sprit != null ? mische(q.sprit, p.sprit, f) : (p.sprit ?? q.sprit);

    let fertig: Runde | null = null;
    if (l) {
      const zeit = tLinie - l.start;
      l.punkte.push(zwischen(q, p, f, 1, zeit));
      if (p.inBox || q.inBox) {
        l.inBox = true;
        l.grund ??= "Boxengasse";
      }
      // Fund 28.11.: Runden neben der Strecke oder mit neuen X galten als gültig – jetzt zählen sie nicht (wie in iRacing)
      const vorfaelle = l.vorfaelleStart != null && p.vorfaelle != null && p.vorfaelle > l.vorfaelleStart ? "Vorfallpunkte in der Runde" : null;
      const sperrGrund = l.abseits ?? vorfaelle;
      const gueltig = l.grund == null && zeit >= MIN_RUNDE && !sperrGrund;
      const sprit = !l.nachgetankt && l.spritStart != null && spritLinie != null && l.spritStart - spritLinie >= 0 ? l.spritStart - spritLinie : null;
      fertig = { nr: l.nr, zeit, gueltig, grund: l.grund ?? (zeit < MIN_RUNDE ? "Zu kurz" : sperrGrund), sprit, spritEnde: spritLinie, inBox: l.inBox, punkte: l.punkte,
        sperre: gueltig ? null : (l.grund ?? sperrGrund ?? "Ungültig") };
      this.runden.push(fertig);
      // Speicher begrenzen: alte Runden verlieren ihre Punkte (Zeit und Sprit bleiben), die beste behält sie
      if (this.runden.length > this.max) {
        const beste = this.beste;
        for (const r of this.runden.slice(0, this.runden.length - this.max)) if (r !== beste) r.punkte = [];
      }
    }
    const nr = p.runde ?? (l ? l.nr + 1 : 1);
    this.aktuell = {
      nr,
      start: tLinie,
      punkte: [zwischen(q, p, f, 0, 0), punkt(p, p.anteil, p.zeit - tLinie)],
      grund: p.inBox ? "Boxengasse" : null,
      spritStart: spritLinie,
      nachgetankt: false,
      inBox: !!p.inBox,
      abseits: p.lage === 0 ? "Neben der Strecke" : null,
      vorfaelleStart: p.vorfaelle ?? null,
    };
    return fertig;
  }
}
