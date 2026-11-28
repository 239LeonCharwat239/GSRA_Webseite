// „Fahr eine Runde mit mir“ (Wunsch 27./28.11.): Ein kurzer Piepton genau dort, wo in der Referenzrunde die Bremse
// kommt – so lernt man die Bremspunkte, ohne auf den Bildschirm zu schauen. Referenz: die schnellste GSRA-Referenzrunde
// mit Pedalwerten (geteilte eigene Runden), sonst deine eigene Bestzeit. Von fremden Autos gibt es keine Pedale.

/** Bremspunkte als Streckenanteil: Bremse von unter 15 % auf mindestens 30 %, nach mindestens 60 m ohne Bremse.
 *  Der Übergang wird zwischen zwei Messpunkten genau eingerechnet (wichtig bei 201 Stützstellen). */
export function bremsStellen(anteil: ArrayLike<number>, bremse: ArrayLike<number>, laengeM: number): number[] {
  const stellen: number[] = [];
  const n = Math.min(anteil.length, bremse.length);
  const AUS = 0.15, AN = 0.3;
  let freiSeit: number | null = null; // Anteil, ab dem die Bremse los war
  for (let i = 1; i < n; i++) {
    const a0 = anteil[i - 1], a1 = anteil[i];
    const b0 = bremse[i - 1], b1 = bremse[i];
    if (![a0, a1, b0, b1].every(Number.isFinite)) continue;
    if (b0 < AUS && freiSeit == null) freiSeit = a0;
    if (b1 >= AN && b0 < AN && freiSeit != null && (a1 - freiSeit) * laengeM >= 60) {
      const f = b1 === b0 ? 0 : Math.max(0, Math.min(1, (AN - b0) / (b1 - b0)));
      const a = a0 + (a1 - a0) * f;
      if (!stellen.length || (a - stellen[stellen.length - 1]) * laengeM >= 80) stellen.push(a);
      freiSeit = null;
    }
    if (b1 >= AUS) freiSeit = null;
  }
  return stellen;
}

/** Bremse in Prozent (0–100, wie in der Datenbank) → Bremspunkte; 201 Stützstellen über die Runde */
export function bremsStellenAusReferenz(bremseProzent: number[], laengeM: number): number[] {
  const n = bremseProzent.length;
  const a = Array.from({ length: n }, (_, i) => i / (n - 1));
  return bremsStellen(a, bremseProzent.map((x) => x / 100), laengeM);
}

/** Sagt, wann gepiept wird: wenn das Auto den nächsten Bremspunkt erreicht (mit kurzem Vorlauf für die Tonausgabe) */
export class Mitfahrer {
  private vorher: number | null = null;
  readonly stellen: number[];
  private readonly laengeM: number;
  private readonly vorlaufS: number;
  private gepiept = new Set<number>();

  constructor(stellen: number[], laengeM: number, vorlaufS = 0.08) {
    this.stellen = [...stellen].sort((x, y) => x - y);
    this.laengeM = laengeM;
    this.vorlaufS = vorlaufS;
  }

  /** anteil 0…1, tempo in m/s; true = jetzt piepen */
  aufnehmen(anteil: number, tempo: number): boolean {
    if (!Number.isFinite(anteil) || anteil < 0 || anteil > 1.0001) return false;
    const vorher = this.vorher;
    this.vorher = anteil;
    if (vorher == null) return false;
    if (anteil < vorher - 0.5) this.gepiept.clear(); // neue Runde
    if (anteil < vorher) return false; // rückwärts / zurückgesetzt
    const vorlauf = Math.max(0, tempo) * this.vorlaufS / this.laengeM;
    for (let i = 0; i < this.stellen.length; i++) {
      const s = this.stellen[i];
      if (this.gepiept.has(i)) continue;
      // erreicht (mit Vorlauf), aber nicht schon weit vorbei (Sprung, Box)
      if (anteil + vorlauf >= s && vorher + vorlauf < s) {
        this.gepiept.add(i);
        if (anteil + vorlauf - s <= 30 / this.laengeM) return true;
      }
    }
    return false;
  }
}

// Funk-Befehl (Deutsch und Englisch) – wird VOR der KI ausgewertet (chat.ts „befehl“)
const MITFAHREN_AN = /fahr\w*\s+(eine\s+|ne\s+|einer\s+)?runde\s+mit|mitfahren|bremspunkt|piepton\s*(an|ein)|piep\w*\s+(mir|an\s+den)|ride\s+along|(drive|do)\s+a\s+lap\s+with\s+me|beep\s+(at\s+)?(the\s+)?brak|braking\s+points?/i;
const MITFAHREN_AUS = /(piep\w*|mitfahren|beep\w*)\s*(aus|stopp?|off|beenden)|kein\s+piep|no\s+more\s+beep/i;

/** „Fahr eine Runde mit mir“ → "an", „Piepton aus“ → "aus", sonst null */
export function mitfahrBefehl(frage: string): "an" | "aus" | null {
  if (MITFAHREN_AUS.test(frage)) return "aus";
  if (MITFAHREN_AN.test(frage)) return "an";
  return null;
}
