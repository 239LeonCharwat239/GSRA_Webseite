// Rundenvergleich: zwei Runden auf dasselbe Raster legen, Zeitunterschied über die Strecke berechnen,
// Kurven erkennen und für jede Kurve sagen, WO und WARUM Zeit verloren geht.
//
// Zwei Ebenen (Grundidee der App):
//  * „Kurz gesagt“: wenige klare Sätze mit Tipp – für Einsteiger
//  * „Genau hinsehen“: dieselben Daten als Diagramme (Tempo, Delta, Pedale, Gang) – für die Tiefe

import type { Punkt } from "./runden.ts";

export const RASTER = 1000;

/** Eine Runde auf RASTER+1 gleich verteilten Punkten (Anteil 0…1) */
export type Spur = { t: Float64Array; v: Float64Array; g: Float64Array; b: Float64Array; gang: Float64Array; l: Float64Array };

/** Legt die Punkte einer Runde auf das Raster (lineare Interpolation über den Streckenanteil) */
export function abtasten(punkte: Punkt[], n = RASTER): Spur {
  const s: Spur = { t: new Float64Array(n + 1), v: new Float64Array(n + 1), g: new Float64Array(n + 1), b: new Float64Array(n + 1), gang: new Float64Array(n + 1), l: new Float64Array(n + 1) };
  if (punkte.length < 2) return s;
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const a = i / n;
    while (j < punkte.length - 2 && punkte[j + 1].a < a) j++;
    const p = punkte[j];
    const q = punkte[j + 1];
    const f = q.a > p.a ? Math.min(1, Math.max(0, (a - p.a) / (q.a - p.a))) : 0;
    s.t[i] = p.t + (q.t - p.t) * f;
    s.v[i] = p.v + (q.v - p.v) * f;
    s.g[i] = p.g + (q.g - p.g) * f;
    s.b[i] = p.b + (q.b - p.b) * f;
    s.l[i] = p.l + (q.l - p.l) * f;
    s.gang[i] = f < 0.5 ? p.gang : q.gang;
  }
  return s;
}

/** Zeit der Runde beim Anteil a (für das Live-Delta); null ohne Daten */
export function zeitBei(punkte: Punkt[], a: number): number | null {
  if (punkte.length < 2 || a < punkte[0].a) return null;
  let lo = 0;
  let hi = punkte.length - 1;
  if (a >= punkte[hi].a) return punkte[hi].t;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (punkte[m].a <= a) lo = m;
    else hi = m;
  }
  const p = punkte[lo];
  const q = punkte[hi];
  return q.a > p.a ? p.t + ((q.t - p.t) * (a - p.a)) / (q.a - p.a) : p.t;
}

/** Zeitunterschied über die Strecke: positiv = Vergleichsrunde langsamer */
export function delta(ref: Spur, x: Spur): Float64Array {
  const d = new Float64Array(ref.t.length);
  for (let i = 0; i < d.length; i++) d[i] = x.t[i] - ref.t[i];
  return d;
}

export type Kurve = { nr: number; start: number; scheitel: number; ende: number };

function glaetten(v: Float64Array, fenster: number): Float64Array {
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - fenster); k <= Math.min(v.length - 1, i + fenster); k++) {
      s += v[k];
      n++;
    }
    out[i] = s / n;
  }
  return out;
}

const argMax = (v: Float64Array, von: number, bis: number) => {
  let b = von;
  for (let i = von; i <= bis; i++) if (v[i] > v[b]) b = i;
  return b;
};

/**
 * Kurven = deutliche Tempo-Tiefpunkte der Referenzrunde (mind. 15 km/h langsamer als davor UND danach).
 * Jede Kurve reicht vom schnellsten Punkt davor (Bremsbeginn) bis zum schnellsten Punkt danach (Ausgang) –
 * so teilen die Kurven die Runde lückenlos auf.
 */
export function kurvenFinden(ref: Spur, laengeM: number): Kurve[] {
  const n = ref.v.length - 1;
  if (n < 10) return [];
  const schritt = laengeM / n;
  const v = glaetten(ref.v, 2);
  const umgebung = Math.max(3, Math.round(60 / schritt));
  const weit = Math.max(umgebung, Math.round(400 / schritt));
  const tiefe = 15 / 3.6;
  // Tiefpunkte sammeln; zwei Tiefpunkte ohne deutlichen Tempo-Anstieg dazwischen sind DIESELBE Kurve
  // (z. B. eine lange Kurve mit gleichbleibendem Tempo) – dann zählt die Mitte bzw. der tiefere Punkt.
  const gruppen: { von: number; bis: number }[] = [];
  for (let i = 1; i < n; i++) {
    let tief = true;
    for (let k = Math.max(0, i - umgebung); k <= Math.min(n, i + umgebung); k++) if (v[k] < v[i]) { tief = false; break; }
    if (!tief) continue;
    const vorher = v[argMax(v, Math.max(0, i - weit), i)];
    const nachher = v[argMax(v, i, Math.min(n, i + weit))];
    if (vorher - v[i] < tiefe || nachher - v[i] < tiefe) continue;
    const letzte = gruppen[gruppen.length - 1];
    if (letzte) {
      const anstieg = v[argMax(v, letzte.bis, i)] - Math.max(v[i], v[letzte.bis]);
      if (anstieg < 2 || (i - letzte.bis) * schritt < 40) {
        if (v[i] < v[letzte.bis] - 0.3) { letzte.von = i; letzte.bis = i; }
        else if (v[i] <= v[letzte.bis] + 0.3) letzte.bis = i;
        continue;
      }
    }
    gruppen.push({ von: i, bis: i });
  }
  const scheitel = gruppen.map((g) => Math.round((g.von + g.bis) / 2));
  return scheitel.map((s, k) => ({
    nr: k + 1,
    scheitel: s,
    start: argMax(v, k === 0 ? 0 : scheitel[k - 1], s),
    ende: argMax(v, s, k === scheitel.length - 1 ? n : scheitel[k + 1]),
  }));
}

export type Befund = {
  kurve: Kurve;
  /** Sekunden: positiv = Vergleichsrunde verliert hier Zeit */
  verlust: number;
  /** Meter: positiv = Vergleichsrunde bremst früher */
  bremsDiffM: number | null;
  /** km/h: negativ = Vergleichsrunde langsamer im langsamsten Punkt */
  scheitelDiffKmh: number;
  /** Meter: positiv = Vergleichsrunde geht später voll aufs Gas */
  gasDiffM: number | null;
  ursachen: string[];
  tipp: string;
};

export type Vergleich = {
  gesamt: number;
  kurven: Kurve[];
  delta: Float64Array;
  befunde: Befund[];
  staerken: Befund[];
  zusammenfassung: string;
};

const erstes = (w: Float64Array, von: number, bis: number, ueber: number) => {
  for (let i = von; i <= bis; i++) if (w[i] > ueber) return i;
  return null;
};
const minimum = (w: Float64Array, von: number, bis: number) => {
  let m = Infinity;
  let at = von;
  for (let i = von; i <= bis; i++) if (w[i] < m) { m = w[i]; at = i; }
  return { m, at };
};

export const zahl = (x: number, stellen = 1) => x.toFixed(stellen).replace(".", ",").replace("-", "−");
export const meterText = (m: number) => `${Math.round(m).toLocaleString("de-DE")} m`;
export const sekunden = (s: number) => `${s > 0 ? "+" : s < 0 ? "−" : "±"}${Math.abs(s).toFixed(3).replace(".", ",")} s`;

export function kurvenName(k: Kurve, laengeM: number, n = RASTER) {
  return `Kurve ${k.nr} (bei ${meterText((k.scheitel / n) * laengeM)})`;
}

/** Vergleicht x mit der Referenz und erklärt die größten Unterschiede */
export function vergleichen(ref: Spur, x: Spur, laengeM: number): Vergleich {
  const n = ref.t.length - 1;
  const schritt = laengeM / n;
  const d = delta(ref, x);
  const kurven = kurvenFinden(ref, laengeM);
  const alle: Befund[] = kurven.map((k) => {
    const verlust = d[k.ende] - d[k.start];
    const bR = erstes(ref.b, k.start, k.scheitel, 0.15);
    const bX = erstes(x.b, k.start, k.scheitel, 0.15);
    const bremsDiffM = bR != null && bX != null ? (bR - bX) * schritt : null;
    const minR = minimum(ref.v, k.start, k.ende);
    const minX = minimum(x.v, k.start, k.ende);
    const scheitelDiffKmh = (minX.m - minR.m) * 3.6;
    const gR = erstes(ref.g, minR.at, k.ende, 0.9);
    const gX = erstes(x.g, minX.at, k.ende, 0.9);
    const gasDiffM = gR != null && gX != null ? (gX - gR) * schritt : null;

    const ursachen: string[] = [];
    let tipp = "Der Unterschied verteilt sich über die ganze Kurve – unter „Genau hinsehen“ siehst du Tempo und Pedale im Detail.";
    // Schwellen so, dass die gerundete Zahl im Satz nie unter der Schwelle liegt (kein „1 km/h langsamer“)
    const frueh = bremsDiffM != null && bremsDiffM >= 4.5;
    const ueberbremst = bremsDiffM != null && bremsDiffM <= -4.5 && scheitelDiffKmh <= -2.5;
    const langsam = scheitelDiffKmh <= -2.5;
    const spaetGas = gasDiffM != null && gasDiffM >= 8.5;
    if (frueh) ursachen.push(`du bremst ${Math.round(bremsDiffM!)} m früher`);
    if (ueberbremst) ursachen.push(`du bremst ${Math.round(-bremsDiffM!)} m später, kommst aber langsamer durch`);
    if (langsam) ursachen.push(`im langsamsten Punkt bist du ${zahl(-scheitelDiffKmh, 0)} km/h langsamer`);
    if (spaetGas) ursachen.push(`du gehst ${Math.round(gasDiffM!)} m später voll aufs Gas`);
    if (ueberbremst) tipp = "Später bremsen bringt hier nichts: Bremse etwas früher, dafür sauber, und nimm mehr Tempo durch die Kurvenmitte.";
    else if (frueh) tipp = "Verschiebe den Bremspunkt in kleinen Schritten (etwa 5 m) nach hinten – merk dir dafür einen festen Punkt neben der Strecke.";
    else if (langsam) tipp = "Lass die Bremse zum Einlenken hin weicher los (Trail-Braking), damit mehr Tempo in die Kurve geht.";
    else if (spaetGas) tipp = "Öffne die Lenkung etwas früher und geh dann gleichmäßig aufs Gas – ein guter Kurvenausgang zahlt sich auf der ganzen Geraden aus.";
    return { kurve: k, verlust, bremsDiffM, scheitelDiffKmh, gasDiffM, ursachen, tipp };
  });

  const gesamt = d[n];
  const befunde = alle.filter((b) => b.verlust > 0.04).sort((a, b) => b.verlust - a.verlust).slice(0, 3);
  const staerken = alle.filter((b) => b.verlust < -0.04).sort((a, b) => a.verlust - b.verlust).slice(0, 2);

  let zusammenfassung: string;
  if (Math.abs(gesamt) < 0.0005) zusammenfassung = "Beide Runden sind gleich schnell.";
  else if (gesamt < 0) zusammenfassung = `Diese Runde ist ${zahl(-gesamt, 3)} s schneller als die Referenz – stark!`;
  else {
    zusammenfassung = `Diese Runde ist ${zahl(gesamt, 3)} s langsamer als die Referenz.`;
    if (befunde.length) {
      const summe = befunde.reduce((s, b) => s + b.verlust, 0);
      const namen = befunde.map((b) => `Kurve ${b.kurve.nr}`);
      const liste = namen.length > 1 ? `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}` : namen[0];
      zusammenfassung += ` Am meisten verlierst du in ${liste} (zusammen ${zahl(summe, 2)} s).`;
    }
  }
  return { gesamt, kurven, delta: d, befunde, staerken, zusammenfassung };
}
