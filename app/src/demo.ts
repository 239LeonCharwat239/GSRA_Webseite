// Demo-Quelle: ein ausgedachter Rundkurs („GSRA-Testring“, 4,2 km, 8 Kurven) mit einem Fahrer, der jede Runde
// etwas anders fährt – manchmal bremst er zu früh, ist im Scheitelpunkt zu langsam oder kommt spät aufs Gas.
// Damit lässt sich die ganze App ohne Simulation ausprobieren und testen (auch im Browser).
//
// Physik bewusst einfach: Höchsttempo je Kurve, Beschleunigung nimmt mit dem Tempo ab, Bremsen mit fester
// Verzögerung. Daraus entsteht ein Tempoverlauf über die Strecke (1 Punkt pro Meter) und die Zeit dazu.

import type { Feld, Probe, Sitzung } from "./typen.ts";

/** richtung: +1 = Rechtskurve, -1 = Linkskurve; winkel: wie weit die Kurve dreht (Grad, Summe der Runde = 360) */
type KurveDef = { bei: number; v: number; laenge: number; richtung: 1 | -1; winkel: number };

export const DEMO_LAENGE = 4200;
export const DEMO_KURVEN: KurveDef[] = [
  { bei: 420, v: 24, laenge: 60, richtung: 1, winkel: 169 },
  { bei: 900, v: 38, laenge: 90, richtung: -1, winkel: -133 },
  { bei: 1350, v: 52, laenge: 120, richtung: 1, winkel: 146 },
  { bei: 1700, v: 30, laenge: 70, richtung: -1, winkel: -80 },
  { bei: 2300, v: 60, laenge: 150, richtung: 1, winkel: 137 },
  { bei: 2900, v: 27, laenge: 60, richtung: 1, winkel: 100 },
  { bei: 3300, v: 44, laenge: 100, richtung: -1, winkel: -109 },
  { bei: 3750, v: 35, laenge: 80, richtung: 1, winkel: 130 },
];
const V_MAX = 78; // m/s ≈ 280 km/h
const VERZOEGERUNG = 14; // m/s² bei voller Bremse
const BOXEN_TEMPO = 22; // m/s ≈ 80 km/h
const GANG_AB = [0, 20, 32, 44, 56, 67];
const VERBRAUCH_PRO_M = 0.0008; // Liter pro Meter bei Vollgas (Teil davon auch ohne Gas)

/** Wie der Fahrer eine Runde fährt: je Kurve Faktor für Kurventempo, Bremskraft, Beschleunigung am Ausgang */
export type Fahrweise = { tempo: number[]; bremse: number[]; ausgang: number[] };
export type Profil = { v: Float64Array; g: Float64Array; b: Float64Array; l: Float64Array; t: Float64Array; sprit: Float64Array; boxe: Uint8Array; h: Float64Array };

export const idealeFahrweise = (): Fahrweise => ({ tempo: DEMO_KURVEN.map(() => 1), bremse: DEMO_KURVEN.map(() => 1), ausgang: DEMO_KURVEN.map(() => 1) });

const beschleunigung = (v: number) => 8.5 * (1 - v / (V_MAX + 4)) + 0.6;

/** Fahrtrichtung je Meter (Bogenmaß zur Nordrichtung, im Uhrzeigersinn): in jeder Kurve gleichmäßig gedreht */
let richtungenSpeicher: Float64Array | null = null;
function richtungen(): Float64Array {
  if (richtungenSpeicher) return richtungenSpeicher;
  const h = new Float64Array(DEMO_LAENGE + 1);
  for (let m = 1; m <= DEMO_LAENGE; m++) {
    let dh = 0;
    for (const k of DEMO_KURVEN) {
      const von = k.bei - k.laenge / 2;
      if (m - 1 >= von && m - 1 < von + k.laenge) dh = (k.winkel * Math.PI) / 180 / k.laenge;
    }
    h[m] = h[m - 1] + dh;
  }
  richtungenSpeicher = h;
  return h;
}

/** Tempo, Pedale, Lenkung, Zeit und Verbrauch über die Strecke (Index = Meter) */
export function profil(f: Fahrweise, boxe: { rein?: boolean; raus?: boolean } = {}, startTempo?: number): Profil {
  const L = DEMO_LAENGE;
  const vlim = new Float64Array(L + 1).fill(V_MAX);
  const kurveAn = new Int16Array(L + 1).fill(-1);
  const ausgangAn = new Float64Array(L + 1).fill(1);
  const naechste = new Int16Array(L + 1).fill(-1);
  const inBox = new Uint8Array(L + 1);
  DEMO_KURVEN.forEach((k, i) => {
    const von = Math.round(k.bei - k.laenge / 2);
    const bis = Math.round(k.bei + k.laenge / 2);
    for (let m = von; m <= bis; m++) {
      vlim[m] = Math.min(vlim[m], k.v * f.tempo[i]);
      kurveAn[m] = i;
    }
    for (let m = bis; m <= Math.min(L, bis + 80); m++) ausgangAn[m] = f.ausgang[i];
  });
  if (boxe.raus) for (let m = 0; m <= 250; m++) { vlim[m] = Math.min(vlim[m], BOXEN_TEMPO); inBox[m] = 1; }
  if (boxe.rein) for (let m = L - 300; m <= L; m++) { vlim[m] = Math.min(vlim[m], BOXEN_TEMPO); inBox[m] = 1; }
  // Kurve, auf die man gerade zufährt (für die Bremskraft)
  let k = 0;
  for (let m = L; m >= 0; m--) {
    if (kurveAn[m] >= 0) k = kurveAn[m];
    naechste[m] = k;
  }

  const v = new Float64Array(L + 1);
  v[0] = Math.min(vlim[0], startTempo ?? vlim[0]);
  for (let durchgang = 0; durchgang < 2; durchgang++) {
    for (let m = 0; m < L; m++) v[m + 1] = Math.min(vlim[m + 1], Math.sqrt(v[m] * v[m] + 2 * beschleunigung(v[m]) * ausgangAn[m]));
    if (startTempo == null) v[0] = Math.min(vlim[0], v[L]);
  }
  for (let m = L - 1; m >= 0; m--) {
    const dez = VERZOEGERUNG * f.bremse[naechste[m]];
    v[m] = Math.min(v[m], Math.sqrt(v[m + 1] * v[m + 1] + 2 * dez));
  }

  const g = new Float64Array(L + 1);
  const b = new Float64Array(L + 1);
  const l = new Float64Array(L + 1);
  const t = new Float64Array(L + 1);
  const sprit = new Float64Array(L + 1);
  for (let m = 0; m <= L; m++) {
    const n = Math.min(L, m + 1);
    const dv2 = v[n] * v[n] - v[m] * v[m];
    if (dv2 < -0.5) {
      b[m] = Math.min(1, -dv2 / 2 / VERZOEGERUNG);
      g[m] = 0;
    } else if (dv2 > 0.05) {
      g[m] = Math.min(1, Math.max(0.3, dv2 / 2 / beschleunigung(v[m])));
    } else {
      g[m] = v[m] >= V_MAX - 0.5 ? 1 : 0.45;
    }
    const ki = kurveAn[m];
    if (ki >= 0) {
      const kd = DEMO_KURVEN[ki];
      const pos = (m - (kd.bei - kd.laenge / 2)) / kd.laenge;
      l[m] = -kd.richtung * Math.sin(Math.PI * pos) * Math.min(2.2, 22 / Math.max(v[m], 12)); // links = positiv
    }
    if (m > 0) {
      t[m] = t[m - 1] + 2 / (v[m - 1] + v[m]);
      sprit[m] = sprit[m - 1] + VERBRAUCH_PRO_M * (0.25 + 0.75 * g[m - 1]);
    }
  }
  return { v, g, b, l, t, sprit, boxe: inBox, h: richtungen() };
}

const gangVon = (v: number) => {
  let gang = 1;
  for (let i = 1; i < GANG_AB.length; i++) if (v >= GANG_AB[i]) gang = i + 1;
  return gang;
};
const drehzahlVon = (v: number, gang: number) => {
  const lo = GANG_AB[gang - 1];
  const hi = gang < GANG_AB.length ? GANG_AB[gang] : V_MAX;
  return 4000 + Math.min(1, Math.max(0, (v - lo) / (hi - lo))) * 4200;
};

/** Reproduzierbarer Zufall (gleiche Demo bei gleichem Startwert) */
export function zufall(start: number) {
  let s = start >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_BOXENSTOPP_ALLE = 12;

/** Gegner der Demo: fahren die Ideallinie, aber mit eigenem Tempo (faktor > 1 = langsamer) und Vorsprung in Sekunden.
 *  Lena ist etwa gleich schnell (langer Zweikampf), Tom langsamer (wird eingeholt), Mia führt. Namen ausgedacht. */
export const DEMO_GEGNER = [
  { idx: 1, name: "Lena Weber", nummer: "27", faktor: 1.008, vorsprung: 1.5 },
  { idx: 2, name: "Tom Becker", nummer: "7", faktor: 1.022, vorsprung: 6 },
  { idx: 3, name: "Mia Schulz", nummer: "11", faktor: 0.99, vorsprung: 12 },
];

export class DemoFahrt {
  zeit = 0;
  runde = 1;
  sprit = 40;
  letzteRunde: number | null = null;
  besteRunde: number | null = null;
  private start = 0;
  private spritStart = 40;
  private p: Profil;
  private tick = 0;
  private nachgetankt = false;
  private meter = 0;
  private ideal: Profil | null = null;
  private readonly rnd: () => number;

  constructor(startwert = 7) {
    this.rnd = zufall(startwert);
    this.p = profil(this.fahrweise());
  }

  sitzung(): Sitzung {
    return {
      strecke: "GSRA-Testring (Demo)", streckenlaengeM: DEMO_LAENGE, fahrzeug: "Demo-GT3", sitzungsart: "Rennen",
      fahrer: [{ idx: 0, name: "Du", nummer: "1" }, ...DEMO_GEGNER.map((g) => ({ idx: g.idx, name: g.name, nummer: g.nummer }))],
    };
  }

  private gauss() {
    return Math.sqrt(-2 * Math.log(1 - this.rnd())) * Math.cos(2 * Math.PI * this.rnd());
  }

  private fahrweise(): Fahrweise {
    const f: Fahrweise = {
      tempo: DEMO_KURVEN.map(() => 1 - Math.abs(this.gauss() * 0.012)),
      bremse: DEMO_KURVEN.map(() => 1 - Math.abs(this.gauss() * 0.04)),
      ausgang: DEMO_KURVEN.map(() => 1 - Math.abs(this.gauss() * 0.08)),
    };
    // jede 4. Runde ein deutlicher Fehler in einer Kurve
    if (this.runde % 4 === 0) {
      const k = Math.floor(this.rnd() * DEMO_KURVEN.length);
      f.tempo[k] -= 0.05;
      f.bremse[k] -= 0.18;
      f.ausgang[k] -= 0.2;
    }
    for (const liste of [f.tempo, f.bremse, f.ausgang]) for (let i = 0; i < liste.length; i++) liste[i] = Math.max(0.5, liste[i]);
    return f;
  }

  private neueRunde() {
    const dauer = this.p.t[DEMO_LAENGE];
    const warRein = this.p.boxe[DEMO_LAENGE] === 1;
    this.start += dauer;
    if (!warRein) {
      this.letzteRunde = dauer;
      if (this.p.boxe[0] === 0 && (this.besteRunde == null || dauer < this.besteRunde)) this.besteRunde = dauer;
    }
    this.runde++;
    const rein = this.runde % DEMO_BOXENSTOPP_ALLE === 0;
    const endTempo = this.p.v[DEMO_LAENGE];
    this.p = profil(this.fahrweise(), { rein, raus: warRein }, endTempo);
    this.spritStart = this.sprit;
    this.nachgetankt = false;
  }

  /** Stand aller Autos (Index 0 = du, 1–3 = Gegner) mit Plätzen nach dem Fortschritt im Rennen */
  feld(): Feld {
    const ideal = (this.ideal ??= profil(idealeFahrweise()));
    const T = ideal.t[DEMO_LAENGE];
    const anteil: number[] = [this.meter / DEMO_LAENGE];
    const runde: number[] = [this.runde];
    for (const g of DEMO_GEGNER) {
      const e = Math.max(0, (this.zeit + g.vorsprung) / g.faktor);
      const runden = Math.floor(e / T);
      const rest = e - runden * T;
      let lo = 0;
      let hi = DEMO_LAENGE;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (ideal.t[m] <= rest) lo = m;
        else hi = m;
      }
      anteil.push(lo / DEMO_LAENGE);
      runde.push(runden + 1);
    }
    const fortschritt = anteil.map((a, i) => runde[i] + a);
    const platz = fortschritt.map((f) => 1 + fortschritt.filter((x) => x > f).length);
    return { zeit: this.zeit, ich: 0, anteil, runde, platz, inBox: anteil.map(() => 0) };
  }

  /** Nächster Messpunkt nach `dt` Sekunden */
  weiter(dt: number): Probe {
    this.zeit += dt;
    this.tick++;
    while (this.zeit - this.start >= this.p.t[DEMO_LAENGE]) this.neueRunde();
    const tRunde = this.zeit - this.start;
    const t = this.p.t;
    let lo = 0;
    let hi = DEMO_LAENGE;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (t[m] <= tRunde) lo = m;
      else hi = m;
    }
    const f = t[hi] > t[lo] ? (tRunde - t[lo]) / (t[hi] - t[lo]) : 0;
    const meter = lo + f;
    this.meter = meter;
    const w = (a: Float64Array) => a[lo] + (a[hi] - a[lo]) * f;
    const tempo = w(this.p.v);
    const gang = gangVon(tempo);
    // Nachtanken an der Box (80 m nach der Linie in der Ausfahrtsrunde)
    if (this.p.boxe[0] === 1 && !this.nachgetankt && meter > 80) {
      this.nachgetankt = true;
      this.spritStart = 60 + w(this.p.sprit);
    }
    this.sprit = Math.max(0, this.spritStart - w(this.p.sprit));
    return {
      tick: this.tick,
      zeit: this.zeit,
      runde: this.runde,
      anteil: meter / DEMO_LAENGE,
      meter,
      tempo,
      drehzahl: drehzahlVon(tempo, gang),
      gang,
      gas: w(this.p.g),
      bremse: w(this.p.b),
      lenkung: w(this.p.l),
      sprit: this.sprit,
      rundenzeit: tRunde,
      letzteRunde: this.letzteRunde,
      besteRunde: this.besteRunde,
      aufStrecke: true,
      inBox: this.p.boxe[Math.round(meter)] === 1,
      richtung: w(this.p.h),
    };
  }
}

/** Spielt die Demo in Echtzeit (oder im Zeitraffer) ab und liefert alle 50 ms ein Bündel Messpunkte */
export class DemoQuelle {
  faktor = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private rest = 0;
  readonly fahrt: DemoFahrt;
  private readonly senden: (p: Probe[]) => void;
  private readonly feldSenden: ((f: Feld) => void) | null;
  private naechstesFeld = 0;

  constructor(senden: (p: Probe[]) => void, feldSenden: ((f: Feld) => void) | null = null, startwert = Date.now() % 100000) {
    this.senden = senden;
    this.feldSenden = feldSenden;
    this.fahrt = new DemoFahrt(startwert);
  }

  get laeuft() {
    return this.timer != null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.rest += 0.05 * this.faktor * 60;
      const n = Math.floor(this.rest);
      this.rest -= n;
      const liste: Probe[] = [];
      for (let i = 0; i < n; i++) {
        liste.push(this.fahrt.weiter(1 / 60));
        // Stand aller Autos viermal pro Sekunde (Simulationszeit), wie bei der echten Simulation
        if (this.feldSenden && this.fahrt.zeit >= this.naechstesFeld) {
          this.naechstesFeld = this.fahrt.zeit + 0.25;
          this.feldSenden(this.fahrt.feld());
        }
      }
      if (liste.length) this.senden(liste);
    }, 50);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
