// Prüfungen der App-Logik (ohne Fenster): Runden, Sprit, Vergleich, Demo
// Aufruf: npm test   (Node führt TypeScript direkt aus)
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rundenzaehler, type Punkt } from "../src/runden.ts";
import { abtasten, kurvenFinden, vergleichen, zeitBei, RASTER } from "../src/analyse.ts";
import { bisZiel, verbrauchProRunde, rundenzeitSchnitt } from "../src/sprit.ts";
import { DemoFahrt, DEMO_KURVEN, DEMO_LAENGE, DEMO_BOXENSTOPP_ALLE, idealeFahrweise, profil, type Profil } from "../src/demo.ts";
import type { Probe } from "../src/typen.ts";
import { karteBauen, verlustJeAbschnitt } from "../src/strecke.ts";
import { Rennbeobachter, berichtErstellen } from "../src/rennbericht.ts";
import type { Feld } from "../src/typen.ts";

function fahren(fahrt: DemoFahrt, runden: number, z = new Rundenzaehler()) {
  const fertige = [];
  const ziel = fahrt.runde + runden;
  let letzteSim: number[] = [];
  while (fahrt.runde < ziel) {
    const vorher = fahrt.letzteRunde;
    const r = z.aufnehmen(fahrt.weiter(1 / 60));
    if (fahrt.letzteRunde !== vorher && fahrt.letzteRunde != null) letzteSim.push(fahrt.letzteRunde);
    if (r) fertige.push(r);
  }
  return { z, fertige, letzteSim };
}

/** Punkte einer Runde aus einem Demo-Profil (ein Punkt alle 2 m) */
function punkteAus(p: Profil): Punkt[] {
  const out: Punkt[] = [];
  for (let m = 0; m <= DEMO_LAENGE; m += 2) out.push({ a: m / DEMO_LAENGE, t: p.t[m], v: p.v[m], g: p.g[m], b: p.b[m], gang: 3, l: p.l[m], r: p.h[m] });
  return out;
}

test("Runden werden erkannt, Rundenzeit auf wenige Tausendstel genau", () => {
  const fahrt = new DemoFahrt(3);
  const { fertige, letzteSim } = fahren(fahrt, 6);
  // erste (angefangene) Runde zählt nicht → 5 fertige Runden
  assert.equal(fertige.length, 5);
  for (const r of fertige) assert.ok(r.zeit > 60 && r.zeit < 120, `Rundenzeit ${r.zeit}`);
  // Vergleich mit der „Simulation“: letzte 5 Rundenzeiten
  const sim = letzteSim.slice(-5);
  fertige.forEach((r, i) => assert.ok(Math.abs(r.zeit - sim[i]) < 0.02, `Runde ${r.nr}: ${r.zeit} statt ${sim[i]}`));
  assert.ok(fertige.every((r) => r.gueltig));
  assert.ok(fertige[0].punkte.length > 3000);
});

test("Boxenstopp: Ein- und Ausfahrtsrunde ungültig, Nachtanken verfälscht den Verbrauch nicht", () => {
  const fahrt = new DemoFahrt(5);
  const { fertige, z } = fahren(fahrt, DEMO_BOXENSTOPP_ALLE + 2);
  const box = fertige.filter((r) => r.inBox);
  assert.equal(box.length, 2);
  assert.ok(box.every((r) => !r.gueltig && r.grund === "Boxengasse"));
  const raus = box[1];
  assert.equal(raus.sprit, null, "Ausfahrtsrunde mit Nachtanken hat keinen Verbrauch");
  const v = verbrauchProRunde(z.runden, 5)!;
  assert.ok(v > 2 && v < 3.5, `Verbrauch ${v}`);
  // Sprit nach dem Tanken wieder fast voll
  assert.ok(fahrt.sprit > 50);
});

test("Zeit rückwärts verwirft die laufende Runde, Datenlücke macht sie ungültig", () => {
  const z = new Rundenzaehler();
  const p = (zeit: number, anteil: number): Probe => ({ tick: 0, zeit, runde: 1, anteil, meter: null, tempo: 50, drehzahl: null, gang: 3, gas: 1, bremse: 0, lenkung: 0, sprit: 30, rundenzeit: null, letzteRunde: null, besteRunde: null, aufStrecke: true, inBox: false, richtung: null });
  z.aufnehmen(p(0, 0.95));
  z.aufnehmen(p(1, 0.01)); // Linie → Runde beginnt
  for (let i = 1; i < 50; i++) z.aufnehmen(p(1 + i, 0.01 + i * 0.02));
  z.aufnehmen(p(60, 0.995)); // 10 s Lücke
  const r = z.aufnehmen(p(60.5, 0.005));
  assert.ok(r && !r.gueltig && r.grund === "Datenlücke");
  // Zeit springt zurück → keine laufende Runde mehr
  z.aufnehmen(p(10, 0.5));
  assert.equal(z.laufend, null);
  // Unsinn wird ignoriert
  assert.equal(z.aufnehmen({ ...p(70, 2), anteil: 2 }), null);
  assert.equal(z.aufnehmen({ ...p(70, 0.5), zeit: Number.NaN }), null);
});

test("zeitBei interpoliert und meldet fehlende Daten", () => {
  const pk: Punkt[] = [0, 0.5, 1].map((a, i) => ({ a, t: i * 10, v: 0, g: 0, b: 0, gang: 0, l: 0, r: 0 }));
  assert.equal(zeitBei(pk, 0.25), 5);
  assert.equal(zeitBei(pk, 1), 20);
  assert.equal(zeitBei([], 0.3), null);
});

test("Kurven der Demo-Strecke werden gefunden", () => {
  const ideal = abtasten(punkteAus(profil(idealeFahrweise())));
  const kurven = kurvenFinden(ideal, DEMO_LAENGE);
  assert.equal(kurven.length, DEMO_KURVEN.length);
  kurven.forEach((k, i) => {
    const meter = (k.scheitel / RASTER) * DEMO_LAENGE;
    assert.ok(Math.abs(meter - DEMO_KURVEN[i].bei) < 60, `Kurve ${i + 1} bei ${meter} statt ${DEMO_KURVEN[i].bei}`);
    assert.ok(k.start < k.scheitel && k.scheitel < k.ende);
  });
  // Kurven teilen die Runde lückenlos auf
  for (let i = 1; i < kurven.length; i++) assert.equal(kurven[i].start, kurven[i - 1].ende);
});

test("Vergleich: gleiche Runde ohne Befund, Fehler in Kurve 4 wird gefunden und erklärt", () => {
  const ref = abtasten(punkteAus(profil(idealeFahrweise())));
  const gleich = vergleichen(ref, ref, DEMO_LAENGE);
  assert.equal(gleich.befunde.length, 0);
  assert.equal(gleich.gesamt, 0);

  // zu früh bremsen (weniger Bremskraft) und langsamer durch Kurve 4
  const f = idealeFahrweise();
  f.bremse[3] = 0.7;
  f.tempo[3] = 0.93;
  const fehler = abtasten(punkteAus(profil(f)));
  const v = vergleichen(ref, fehler, DEMO_LAENGE);
  assert.ok(v.gesamt > 0.1, `Verlust ${v.gesamt}`);
  assert.equal(v.befunde[0].kurve.nr, 4);
  assert.ok(v.befunde[0].bremsDiffM! > 4, `Bremspunkt ${v.befunde[0].bremsDiffM}`);
  assert.ok(v.befunde[0].scheitelDiffKmh < -2);
  assert.ok(v.befunde[0].ursachen.some((u) => u.includes("früher")));
  assert.match(v.zusammenfassung, /langsamer als die Referenz.*Kurve 4/);
  // Verlust der Kurven ergibt (fast) den Gesamtverlust
  const summe = v.befunde.reduce((s, b) => s + b.verlust, 0);
  assert.ok(Math.abs(summe - v.gesamt) < 0.05);

  // umgekehrt: Referenz mit Fehler → Stärke in Kurve 4
  const umgekehrt = vergleichen(fehler, ref, DEMO_LAENGE);
  assert.ok(umgekehrt.gesamt < 0);
  assert.equal(umgekehrt.staerken[0].kurve.nr, 4);
  assert.match(umgekehrt.zusammenfassung, /schneller/);
});

test("Spät am Gas wird erkannt", () => {
  const ref = abtasten(punkteAus(profil(idealeFahrweise())));
  const f = idealeFahrweise();
  f.ausgang[5] = 0.55;
  const v = vergleichen(ref, abtasten(punkteAus(profil(f))), DEMO_LAENGE);
  assert.equal(v.befunde[0].kurve.nr, 6);
  assert.ok(v.befunde[0].tipp.includes("Gas"));
});

test("Sprit bis zum Ziel", () => {
  const b = bisZiel({ sprit: 20, verbrauch: 2.5, rundenzeit: 100, rest: { sekunden: 30 * 60 } })!;
  assert.equal(b.rundenNoetig, 18);
  assert.equal(b.spritNoetig, 18 * 2.5 + 1.25);
  assert.equal(b.nachtanken, 18 * 2.5 + 1.25 - 20);
  assert.equal(b.reicht, false);
  assert.equal(bisZiel({ sprit: 50, verbrauch: 2.5, rundenzeit: null, rest: { runden: 10 } })!.reicht, true);
  assert.equal(bisZiel({ sprit: 50, verbrauch: 0, rundenzeit: 90, rest: { runden: 10 } }), null);
  assert.equal(bisZiel({ sprit: 50, verbrauch: 2, rundenzeit: null, rest: { sekunden: 600 } }), null);
  assert.equal(rundenzeitSchnitt([]), null);
});

test("Streckenkarte: aus Tempo und Fahrtrichtung, geschlossen, passende Größe", () => {
  const punkte = punkteAus(profil(idealeFahrweise()));
  const k = karteBauen(punkte)!;
  assert.ok(k, "Karte gebaut");
  assert.equal(k.x.length, RASTER + 1);
  assert.ok(Math.abs(k.laenge - DEMO_LAENGE) < 30, `Länge ${k.laenge}`);
  // geschlossen: Ende = Anfang
  assert.ok(Math.hypot(k.x[RASTER] - k.x[0], k.y[RASTER] - k.y[0]) < 1);
  // echte Fläche (kein Strich): Ausdehnung in beide Richtungen mehrere hundert Meter
  const breite = Math.max(...k.x) - Math.min(...k.x);
  const hoehe = Math.max(...k.y) - Math.min(...k.y);
  assert.ok(breite > 300 && hoehe > 300, `${breite} × ${hoehe}`);
  // Abstand benachbarter Rasterpunkte ≈ Streckenlänge / Raster
  const schritt = Math.hypot(k.x[501] - k.x[500], k.y[501] - k.y[500]);
  assert.ok(Math.abs(schritt - DEMO_LAENGE / RASTER) < 1.5, `Schritt ${schritt}`);
});

test("Streckenkarte: ohne Fahrtrichtung oder mit Lücke keine (falsche) Karte", () => {
  const punkte = punkteAus(profil(idealeFahrweise()));
  assert.equal(karteBauen(punkte.map((p) => ({ ...p, r: Number.NaN }))), null);
  const mitLuecke = punkte.map((p, i) => (i > 1000 ? { ...p, t: p.t + 5 } : p));
  assert.equal(karteBauen(mitLuecke), null);
  assert.equal(karteBauen(punkte.slice(0, 20)), null);
});

test("Zeitverlust je Abschnitt zeigt die Kurve mit dem Fehler", () => {
  const ref = abtasten(punkteAus(profil(idealeFahrweise())));
  const f = idealeFahrweise();
  f.bremse[3] = 0.7;
  f.tempo[3] = 0.93;
  const v = vergleichen(ref, abtasten(punkteAus(profil(f))), DEMO_LAENGE);
  const verlust = verlustJeAbschnitt(v.delta);
  let max = 0;
  for (let i = 1; i < verlust.length; i++) if (verlust[i] > verlust[max]) max = i;
  const meter = (max / RASTER) * DEMO_LAENGE;
  assert.ok(Math.abs(meter - DEMO_KURVEN[3].bei) < 300, `größter Verlust bei ${meter} m`);
});

test("Zweikampf: Gegner kommt näher und geht vorbei – mit Stelle und Richtung", () => {
  const b = new Rennbeobachter();
  const T = 90; // Rundenzeit
  // ich fahre gleichmäßig, Auto 1 startet 2 s hinter mir und ist 0,1 s pro 10 s schneller
  for (let s = 0; s <= 400; s += 0.25) {
    const mein = s / T;
    const er = (s - 2 + s * 0.01) / T;
    const f: Feld = { zeit: s, ich: 0, anteil: [mein % 1, er % 1], runde: [Math.floor(mein) + 1, Math.floor(er) + 1], platz: [er > mein ? 2 : 1, er > mein ? 1 : 2], inBox: [0, 0] };
    b.aufnehmen(f, T);
  }
  const k = b.alleKaempfe();
  assert.equal(k.length, 1, JSON.stringify(k));
  assert.equal(k[0].idx, 1);
  assert.equal(k[0].ueberholungen.length, 1);
  assert.equal(k[0].ueberholungen[0].ichVorbei, false, "er ist an mir vorbei");
  assert.equal(b.startPlatz, 1);
  assert.equal(b.platz, 2);
  // Zeit läuft zurück (neue Sitzung): alles vergessen
  b.aufnehmen({ zeit: 1, ich: 0, anteil: [0.1, 0.5], runde: [1, 1], platz: [1, 2], inBox: [0, 0] }, T);
  assert.equal(b.alleKaempfe().length, 0);
});

test("Rennbeobachter ignoriert Unsinn und überrundete Autos", () => {
  const b = new Rennbeobachter();
  for (let s = 0; s < 100; s += 0.25) {
    // Auto 1 ist eine Runde zurück, aber auf der Strecke direkt neben mir: kein Zweikampf um den Platz
    b.aufnehmen({ zeit: s, ich: 0, anteil: [0.3, 0.301], runde: [5, 4], platz: [1, 3], inBox: [0, 0] }, 90);
    b.aufnehmen({ zeit: s, ich: 7, anteil: [0.3], runde: [5], platz: [1], inBox: [0] }, 90); // ungültiger eigener Index
    b.aufnehmen({ zeit: Number.NaN, ich: 0, anteil: [0.3, 0.3], runde: [5, 5], platz: [1, 2], inBox: [0, 0] }, 90);
  }
  assert.equal(b.alleKaempfe().length, 0);
});

test("Rennbericht mit der Demo: Zweikampf mit Namen, Ideal-Runde, Konstanz, Kurve mit Verlust", () => {
  const fahrt = new DemoFahrt(11);
  const z = new Rundenzaehler();
  const beob = new Rennbeobachter();
  let naechstes = 0;
  while (fahrt.runde < 16) {
    const r = z.aufnehmen(fahrt.weiter(1 / 60));
    void r;
    if (fahrt.zeit >= naechstes) {
      naechstes = fahrt.zeit + 0.25;
      beob.aufnehmen(fahrt.feld(), 87);
    }
  }
  const b = berichtErstellen(z.runden, beob, DEMO_LAENGE, fahrt.sitzung().fahrer);
  assert.ok(b.gueltig >= 10, `gültig ${b.gueltig}`);
  assert.ok(b.beste != null && b.ideal != null && b.ideal <= b.beste, `${b.ideal} ≤ ${b.beste}`);
  assert.ok(b.konstanz != null && b.konstanz > 0 && b.konstanz < 2, `Konstanz ${b.konstanz}`);
  assert.equal(b.kurven.length, DEMO_KURVEN.length);
  assert.ok(b.kurven[0].schnitt >= b.kurven[1].schnitt, "nach Verlust sortiert");
  assert.ok(b.kaempfe.length >= 1, "mindestens ein Zweikampf");
  assert.ok(b.kaempfe.some((k) => k.name.includes("Lena Weber") || k.name.includes("Tom Becker")), JSON.stringify(b.kaempfe.map((k) => k.name)));
  assert.ok(b.stopps >= 1, "Boxenstopp erkannt");
  assert.ok(b.saetze.some((s) => s.startsWith("Zweikampf mit #")), b.saetze.join(" | "));
  assert.ok(b.saetze.some((s) => s.includes("Ideal-Runde") || s.includes("konstant")), b.saetze.join(" | "));
});

test("Rennbericht ohne gültige Runde: freundlicher Hinweis statt Fehler", () => {
  const b = berichtErstellen([], null, 4000);
  assert.equal(b.gueltig, 0);
  assert.equal(b.beste, null);
  assert.match(b.saetze[0], /Fahr ein paar Runden/);
});