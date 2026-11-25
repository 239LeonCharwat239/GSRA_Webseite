// Streckenkarte: Die Form der Strecke entsteht aus der aufgezeichneten Runde – aus Tempo und Fahrtrichtung
// (Richtung zur Nordrichtung). Schritt für Schritt aufsummiert ergibt das den Weg des Autos; die kleine
// Abweichung zwischen Ende und Anfang (Messungenauigkeit) wird gleichmäßig über die Runde verteilt, damit sich
// die Strecke schließt. So passt die Karte zu jeder Strecke (z. B. Monza), ohne fremde Kartendaten.
//
// Darstellung: Asphalt grau, darüber Farbe je Abschnitt – rot = hier verlierst du Zeit, grün = hier gewinnst du.

import type { Punkt } from "./runden.ts";
import { RASTER } from "./analyse.ts";

export type Karte = { x: Float64Array; y: Float64Array; laenge: number };

const mittelWinkel = (a: number, b: number) => Math.atan2(Math.sin(a) + Math.sin(b), Math.cos(a) + Math.cos(b));

/** Baut die Karte aus einer Runde; null, wenn die Fahrtrichtung fehlt oder die Daten nicht reichen */
export function karteBauen(punkte: Punkt[], n = RASTER): Karte | null {
  const p = punkte.filter((q) => Number.isFinite(q.r) && Number.isFinite(q.t) && Number.isFinite(q.v));
  if (p.length < 50 || p.length < punkte.length * 0.9) return null;
  const x = new Float64Array(p.length);
  const y = new Float64Array(p.length);
  const s = new Float64Array(p.length);
  for (let i = 1; i < p.length; i++) {
    const dt = p[i].t - p[i - 1].t;
    if (!(dt >= 0) || dt > 2) return null; // Lücke: Karte wäre falsch
    const weg = ((p[i].v + p[i - 1].v) / 2) * dt;
    const h = mittelWinkel(p[i].r, p[i - 1].r);
    x[i] = x[i - 1] + weg * Math.sin(h); // Osten
    y[i] = y[i - 1] + weg * Math.cos(h); // Norden
    s[i] = s[i - 1] + weg;
  }
  const gesamt = s[s.length - 1];
  if (!(gesamt > 200)) return null;
  // Schließen: Abweichung Ende → Anfang anteilig über die Strecke verteilen
  const ex = x[x.length - 1] - x[0];
  const ey = y[y.length - 1] - y[0];
  if (Math.hypot(ex, ey) > gesamt * 0.15) return null; // zu ungenau (z. B. abgekürzt oder zurückgesetzt)
  for (let i = 0; i < p.length; i++) {
    x[i] -= (ex * s[i]) / gesamt;
    y[i] -= (ey * s[i]) / gesamt;
  }
  // Auf das Raster des Rundenvergleichs legen (gleicher Index = gleiche Stelle der Strecke)
  const kx = new Float64Array(n + 1);
  const ky = new Float64Array(n + 1);
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const a = i / n;
    while (j < p.length - 2 && p[j + 1].a < a) j++;
    const u = p[j];
    const w = p[j + 1];
    const f = w.a > u.a ? Math.min(1, Math.max(0, (a - u.a) / (w.a - u.a))) : 0;
    kx[i] = x[j] + (x[j + 1] - x[j]) * f;
    ky[i] = y[j] + (y[j + 1] - y[j]) * f;
  }
  return { x: kx, y: ky, laenge: gesamt };
}

/** Zeitverlust je Abschnitt aus dem Delta (geglättet): positiv = verloren */
export function verlustJeAbschnitt(delta: Float64Array, glaetten = 6): Float64Array {
  const n = delta.length - 1;
  const roh = new Float64Array(n);
  for (let i = 0; i < n; i++) roh[i] = delta[i + 1] - delta[i];
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let summe = 0;
    let z = 0;
    for (let k = Math.max(0, i - glaetten); k <= Math.min(n - 1, i + glaetten); k++) {
      summe += roh[k];
      z++;
    }
    out[i] = summe / z;
  }
  return out;
}

export type KartenOptionen = {
  verlust?: Float64Array | null;
  marken?: { i: number; text: string; wichtig?: boolean }[];
  punkt?: number | null;
  spiegeln?: boolean;
};

/** Zeichnet die Karte passend in die Fläche (Norden oben) */
export function karteZeichnen(canvas: HTMLCanvasElement, k: Karte, o: KartenOptionen = {}) {
  const dpr = window.devicePixelRatio || 1;
  const breite = canvas.clientWidth;
  const hoehe = canvas.clientHeight;
  if (!breite || !hoehe) return;
  canvas.width = Math.round(breite * dpr);
  canvas.height = Math.round(hoehe * dpr);
  const c = canvas.getContext("2d");
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, breite, hoehe);

  const sx = o.spiegeln ? -1 : 1;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < k.x.length; i++) {
    const xx = k.x[i] * sx;
    if (xx < minX) minX = xx;
    if (xx > maxX) maxX = xx;
    if (k.y[i] < minY) minY = k.y[i];
    if (k.y[i] > maxY) maxY = k.y[i];
  }
  const rand = 22;
  const mass = Math.min((breite - 2 * rand) / Math.max(1, maxX - minX), (hoehe - 2 * rand) / Math.max(1, maxY - minY));
  const ox = (breite - (maxX - minX) * mass) / 2;
  const oy = (hoehe - (maxY - minY) * mass) / 2;
  const X = (i: number) => ox + (k.x[i] * sx - minX) * mass;
  const Y = (i: number) => hoehe - oy - (k.y[i] - minY) * mass;
  const n = k.x.length - 1;

  const linie = (farbe: string, dicke: number) => {
    c.strokeStyle = farbe;
    c.lineWidth = dicke;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(X(0), Y(0));
    for (let i = 1; i <= n; i++) c.lineTo(X(i), Y(i));
    c.closePath();
    c.stroke();
  };
  linie("rgba(255,255,255,0.10)", 12);
  linie("#2a3346", 7);

  // Zeitverlust: rot / grün je Abschnitt
  if (o.verlust && o.verlust.length === n) {
    let max = 0;
    for (const w of o.verlust) max = Math.max(max, Math.abs(w));
    if (max > 1e-6) {
      c.lineWidth = 5;
      c.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const w = o.verlust[i] / max;
        if (Math.abs(w) < 0.12) continue;
        c.strokeStyle = w > 0 ? `rgba(239,68,68,${Math.min(1, 0.25 + w)})` : `rgba(34,197,94,${Math.min(1, 0.25 - w)})`;
        c.beginPath();
        c.moveTo(X(i), Y(i));
        c.lineTo(X(i + 1), Y(i + 1));
        c.stroke();
      }
    }
  }

  // Start und Ziel: kurzer Querstrich
  const nx = -(Y(1) - Y(0));
  const ny = X(1) - X(0);
  const nl = Math.hypot(nx, ny) || 1;
  c.strokeStyle = "#ffffff";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(X(0) - (nx / nl) * 9, Y(0) - (ny / nl) * 9);
  c.lineTo(X(0) + (nx / nl) * 9, Y(0) + (ny / nl) * 9);
  c.stroke();

  // Kurven-Nummern
  c.font = "bold 11px 'Segoe UI', system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const m of o.marken ?? []) {
    if (m.i < 0 || m.i > n) continue;
    const r = m.wichtig ? 10 : 8;
    c.fillStyle = m.wichtig ? "#ef4444" : "rgba(13,20,36,0.92)";
    c.strokeStyle = m.wichtig ? "#ffffff" : "rgba(255,255,255,0.35)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(X(m.i), Y(m.i), r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#ffffff";
    c.fillText(m.text, X(m.i), Y(m.i) + 0.5);
  }

  // Auto bzw. Stelle unter der Maus
  if (o.punkt != null && o.punkt >= 0 && o.punkt <= n) {
    const i = Math.round(o.punkt);
    c.fillStyle = "#ffcc00";
    c.strokeStyle = "#000";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(X(i), Y(i), 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}
