import { istRennen, liveNachbarn, livePlatz, liveReihenfolge } from "../src/feld-live.ts";
import { fehlendeWoerter, TESTSAETZE, trefferquote, woerter } from "../src/sprachtest.ts";
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
import { messwerteKodieren, messwerteLesen } from "../../src/stint-messwerte.ts";
import { bremspunkte, liftMeter, sparAuswerten, sparBasis, sparText, sparTipp } from "../src/sparen.ts";
import { SPOTTER_SAETZE, Spotter, seiteAus, spotterSatz, type Seite } from "../src/spotter.ts";
import { abstandSatz, rufname } from "../src/vorlagen.ts";
import { Feldrunden, deltaZu, verlustIn } from "../src/feldreferenz.ts";
import { namenErsetzen } from "../src/datenschutz.ts";
import { aufRaster, PUNKTE, verdichten, zeitverlauf } from "../src/referenz.ts";
import { CRASH_SAETZE, CrashWaechter, Fahrverhalten, schadenBild, schadenMeldung } from "../src/crash.ts";
import { FAHRER_SAETZE, NachbarWaechter, StrafenWaechter, strafeAus, werMitInfo } from "../src/fahrer-info.ts";
import { bilanzSatz, bremsStellen, bremsStellenAusReferenz, Mitfahrer, mitfahrBefehl } from "../src/mitfahren.ts";
import { istStrategieFrage, planen, planSatz, StrategieWaechter, wiedereinstieg, wiedereinstiegSatz } from "../src/strategie.ts";
import { boxAntwort, boxBefehle, boxEnglisch, boxFrage, boxStand, boxVerlustMessen, boxWunschLesen, empfehlung, spritBisZiel, type BoxLage } from "../src/boxenfunk.ts";
import { amSatzende } from "../src/kuerzen.ts";
import { spracheVonText, SPRECH_SPRACHEN, LAENDERCODE } from "../src/sprachen.ts";
import { aufraeumen, entpacken, packen, streckenKarten, BESTE_JE_AUTO, LETZTE_JE_AUTO, type ArchivRunde } from "../src/rundenarchiv.ts";
import { ANSAGE_SPRACHEN, absicht, ansage, FERTIGE_SAETZE, nichtVerstanden, ordnungWort, pruefenIn, zahlenAusschreiben, zahlIn, zahlWort, zumSprechen } from "../src/ansagen.ts";

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

test("Sprit sparen: Lift & Coast spart messbar Sprit, kostet etwas Zeit und wird richtig bewertet", () => {
  const fahrt = new DemoFahrt(21);
  const z = new Rundenzaehler();
  fahren(fahrt, 4, z); // Basis ohne Sparen (Runde 1 ist angefangen und zählt nicht)
  const basis = sparBasis(z.runden, DEMO_LAENGE)!;
  assert.ok(basis && basis.verbrauch > 2 && basis.verbrauch < 3.5, JSON.stringify(basis));
  assert.ok(basis.rollM < 30, `ohne Sparen kaum Rollen: ${basis.rollM} m`);
  const punkte = bremspunkte(z.runden.filter((r) => r.gueltig).at(-1)!, DEMO_LAENGE, 3);
  assert.equal(punkte.length, 3);
  for (const p of punkte) assert.ok(p.tempoKmh > 90 && p.liftM >= 20 && p.liftM <= 120, JSON.stringify(p));
  fahrt.sparen = true;
  const { fertige } = fahren(fahrt, 4, z);
  const sparRunden = fertige.slice(1).filter((r) => !r.inBox && r.sprit != null); // erste Runde fing noch ohne Sparen an
  assert.ok(sparRunden.length >= 2);
  for (const r of sparRunden) {
    const a = sparAuswerten(r, basis, 0.05, DEMO_LAENGE)!;
    assert.ok(a.ersparnis > 0.02, `Runde ${r.nr}: nur ${a.ersparnis}`);
    assert.ok(a.rollM > basis.rollM + 100, `Rollstrecke ${a.rollM} m`);
    assert.ok((a.zeitVerlust ?? 0) > 0 && (a.zeitVerlust ?? 9) < 3, `Zeitverlust ${a.zeitVerlust}`);
    const text = sparText(a, sparTipp(r, punkte, DEMO_LAENGE), (b) => `vor Kurve bei ${Math.round(b.meter)} m`);
    assert.match(text, /^Runde \d+: \d+,\d\d l, \d+,\d % gespart \(Ziel 5,0 %\)/);
  }
});

test("Sprit sparen: Texte für zu wenig, genug und zu viel", () => {
  const a = { runde: 7, verbrauch: 2.6, ersparnis: 0.02, zeitVerlust: 0.2, rollM: 120, ziel: 0.05, erreicht: false };
  const tipp = { a: 0.3, meter: 1260, tempoKmh: 230, liftM: 65, gerollt: 20 };
  assert.match(sparText(a, tipp, () => "vor Kurve 3"), /Noch nicht genug: Geh vor Kurve 3 etwa 65 m vor dem Bremspunkt vom Gas und lass rollen \(bisher 20 m\)\./);
  assert.match(sparText({ ...a, ersparnis: 0.055, erreicht: true }, null, () => ""), /Ziel erreicht – genau so weiter\./);
  assert.match(sparText({ ...a, ersparnis: 0.11, zeitVerlust: 0.9, erreicht: true }, null, () => ""), /mehr als nötig/);
  assert.match(sparText({ ...a, ersparnis: -0.03 }, null, () => ""), /3,0 % MEHR als vorher/);
  assert.equal(liftMeter(250), 70);
  assert.equal(liftMeter(50), 20);
});

test("Spotter: sofort bei Auto daneben, „Frei“ erst nach echtem Nebeneinander, keine Dauerschleife", () => {
  const gesagt: string[] = [];
  const s = new Spotter((x) => gesagt.push(x));
  const folge = (werte: Array<[number, number]>) => { for (const [t, roh] of werte) s.aufnehmen(roh, t); };
  folge([[0, 1], [0.1, 1], [0.2, 2]]);
  assert.deepEqual(gesagt, ["links"], "sofort „links“");
  folge([[0.3, 2], [0.5, 2], [1.0, 2]]);
  assert.deepEqual(gesagt, ["links"], "keine Wiederholung, solange er daneben ist");
  folge([[1.1, 1], [1.2, 2]]); // kurz flackernd frei → nicht „frei“, nicht noch einmal „links“
  assert.deepEqual(gesagt, ["links"]);
  folge([[1.3, 1], [1.5, 1], [1.8, 1]]); // jetzt wirklich frei (≥ 0,45 s)
  assert.deepEqual(gesagt, ["links", "frei"]);
  folge([[3, 3], [3.1, 1], [3.6, 1], [3.7, 1]]); // nur angetippt (< 0,6 s daneben) → kein „frei“
  assert.deepEqual(gesagt, ["links", "frei", "rechts"]);
  folge([[5, 4], [5.1, 5], [5.2, 0], [5.3, 99]]); // beidseitig, zwei links; 0 = Spotter aus, Unsinn wird ignoriert
  assert.deepEqual(gesagt.slice(3), ["beide", "zweiLinks"]);
  // lange nebeneinander: nach 2 s „Noch da“, danach nur alle 3,2 s (2,5 s Ruhe nach dem Satz) statt im 2-s-Takt
  const lang: Seite[] = [];
  const s2 = new Spotter((x) => lang.push(x));
  for (let t = 0; t <= 12; t += 0.1) s2.aufnehmen(2, Math.round(t * 10) / 10);
  assert.deepEqual(lang, ["links", "noch", "noch", "noch", "noch"], "links bei 0, noch bei 2 / 5,2 / 8,4 / 11,6");
  assert.equal(seiteAus(6), "zweiRechts");
  assert.equal(seiteAus(0), null);
  // Alle 12 Sprachen haben alle 6 Ansagen
  for (const [sprache, saetze] of Object.entries(SPOTTER_SAETZE)) {
    assert.equal(Object.keys(saetze).length, 7, sprache);
    for (const t of Object.values(saetze)) assert.ok(t.length >= 2 && t.length <= 30, `${sprache}: ${t}`);
  }
  // alle 28 Sprachen des Renningenieurs (Fund 26.11.: 16 Sprachen fehlten, dort sprach der Spotter Deutsch)
  assert.deepEqual(Object.keys(SPOTTER_SAETZE).sort(), Object.keys(LAENDERCODE).sort());
  assert.equal(spotterSatz("links", "en"), "Car left");
  assert.equal(spotterSatz("frei", "xx"), "Frei");
});

test("Demo: beim Überholen ist ein Auto neben dir (Spotter-Wert wie in iRacing)", () => {
  const fahrt = new DemoFahrt(4);
  const werte = new Set<number>();
  while (fahrt.runde < 12) werte.add(fahrt.weiter(1 / 30).seite ?? -1);
  assert.ok(werte.has(1), "meist frei");
  assert.ok(werte.has(2) || werte.has(3), `jemand neben dir: ${[...werte]}`);
  const f = fahrt.feld();
  assert.equal(f.letzte?.length, 4);
  assert.ok((f.letzte?.[1] ?? 0) > 60, "Rundenzeiten der Gegner");
});

test("Vorlagen-Funk: Vordermann mit Abstand und Tendenz, im Stil, ohne KI", () => {
  const vor = { name: "Tom Becker", nummer: "7", abstand: 1.24, trend: -0.31 };
  const hinter = { name: "Mia Schulz", nummer: "11", abstand: 0.8, trend: -0.2 };
  const k = abstandSatz("kumpel", vor, null, () => 0)!;
  assert.match(k, /^Becker ist 1,2 vor dir – du holst 0,3 pro Runde/);
  assert.match(abstandSatz("profi", vor, null, () => 0)!, /^Abstand nach vorn 1,2, Becker\. Tendenz minus 0,3 pro Runde\./);
  assert.match(abstandSatz("locker", { ...vor, trend: 0.4 }, null, () => 0)!, /zieht grad 0,4 pro Runde weg/);
  assert.match(abstandSatz("knapp", vor, hinter, () => 0)!, /^Vorne Becker, 1,2, minus 0,3\. Hinten Schulz, 0,8\.$/);
  assert.equal(abstandSatz("kumpel", { ...vor, abstand: 5 }, { ...hinter, abstand: 3 }), null, "weit weg: nichts sagen");
  assert.equal(abstandSatz("kumpel", { ...vor, trend: null }, null, () => 0), "Becker ist 1,2 vor dir.", "ohne Tendenz keine Behauptung");
  assert.match(abstandSatz("kumpel", { ...vor, trend: 0.01 }, null, () => 0)!, /Abstand bleibt gleich/);
  assert.equal(rufname({ name: "Auto 12", nummer: "12", abstand: 1, trend: null }), "die 12");
  assert.equal(abstandSatz("unbekannt", vor, null, () => 0.99)!.length > 10, true, "unbekannte Art → Kumpel");
});

test("Referenz aus der Lobby: schnellste Runde im Feld aus den Positionsdaten, mit Zeitverlauf", () => {
  const fahrt = new DemoFahrt(9);
  const z = new Rundenzaehler();
  const ref = new Feldrunden(DEMO_LAENGE);
  let naechstes = 0;
  while (fahrt.runde < 6) {
    z.aufnehmen(fahrt.weiter(1 / 60));
    if (fahrt.zeit >= naechstes) { naechstes = fahrt.zeit + 0.1; ref.aufnehmen(fahrt.feld()); }
  }
  const T = profil(idealeFahrweise()).t[DEMO_LAENGE];
  assert.equal(ref.beste.size, 3, "alle drei Gegner haben eine geprüfte Runde");
  const s = ref.schnellste()!;
  assert.equal(s.idx, 3, "Mia Schulz (Faktor 0,99) ist die Schnellste");
  assert.ok(Math.abs(s.zeit - T * 0.99) < 0.15, `Rundenzeit ${s.zeit} statt ${T * 0.99}`);
  assert.ok(Math.abs(s.t[RASTER] - s.zeit) < 1e-6 && s.t[0] === 0, "Zeitverlauf von 0 bis Rundenzeit");
  for (let i = 1; i <= RASTER; i++) assert.ok(s.t[i] >= s.t[i - 1], "Zeit läuft nur vorwärts");
  // Eigene beste Runde dagegen: Rückstand am Ziel = Unterschied der Rundenzeiten
  const beste = z.beste!;
  const d = deltaZu(s, abtasten(beste.punkte).t);
  assert.ok(Math.abs(d[RASTER] - (beste.zeit - s.zeit)) < 0.1, `Rückstand ${d[RASTER]} vs ${beste.zeit - s.zeit}`);
  assert.ok(Math.abs(verlustIn(d, 0, RASTER) - d[RASTER]) < 1e-9);
});

test("Referenz aus der Lobby: Sprünge, Lücken und falsche Rundenzeiten werden nicht übernommen", () => {
  const L = 4000;
  const feld = (zeit: number, a: number[], runde: number[], letzte: number[] = [-1, -1]): Feld =>
    ({ zeit, ich: 0, anteil: [0.5, ...a], runde: [1, ...runde], platz: [1, 2], inBox: [0, 0], letzte, beste: letzte });
  // Gleichmäßige Runde von 80 s: sauber → übernommen
  const fahren = (ref: Feldrunden, stoerung?: (zeit: number, a: number) => number | null, letzte = 80) => {
    for (let k = 0; k <= 2 * 800 + 20; k++) {
      const zeit = k * 0.1;
      const gesamt = zeit / 80 + 0.5; // startet bei halber Runde
      let a: number | null = gesamt % 1;
      if (stoerung) a = stoerung(zeit, a);
      ref.aufnehmen(feld(zeit, [a ?? -1], [1 + Math.floor(gesamt)], [-1, zeit > 100 ? letzte : -1]));
    }
  };
  const sauber = new Feldrunden(L);
  fahren(sauber);
  assert.ok(Math.abs((sauber.schnellste()?.zeit ?? 0) - 80) < 0.05, "saubere Runde erkannt");
  const sprung = new Feldrunden(L);
  fahren(sprung, (z, a) => (z > 70 && z < 70.15 ? Math.min(0.99, a + 0.2) : a)); // Teleport um 800 m
  assert.equal(sprung.beste.size, 0, "Teleport: keine Referenz");
  const weg = new Feldrunden(L);
  fahren(weg, (z, a) => (z > 60 && z < 61 ? null : a)); // kurz nicht auf der Strecke
  assert.equal(weg.beste.size, 0, "Auto war nicht auf der Strecke: keine Referenz");
  const falsch = new Feldrunden(L);
  fahren(falsch, undefined, 75); // Simulation meldet eine andere Rundenzeit
  assert.equal(falsch.beste.size, 0, "Rundenzeit passt nicht zur Simulation: keine Referenz");
  const ohneZeiten = new Feldrunden(L);
  for (let k = 0; k <= 1620; k++) {
    const zeit = k * 0.1, gesamt = zeit / 80 + 0.5;
    ohneZeiten.aufnehmen({ zeit, ich: 0, anteil: [0.5, gesamt % 1], runde: [1, 1 + Math.floor(gesamt)], platz: [1, 2], inBox: [0, 0] });
  }
  assert.equal(ohneZeiten.beste.size, 1, "Simulation ohne Rundenzeiten: die übrigen Prüfungen reichen");
});

test("Datenschutz: Fahrernamen an die KI lassen sich durch Startnummern ersetzen (auch Nachnamen allein)", () => {
  const fahrer = [{ name: "Du", nummer: "1" }, { name: "Tom Becker", nummer: "7" }, { name: "Mia Schulz", nummer: "11" }, { name: "Xi", nummer: "" }];
  const lage = {
    vor_mir: { name: "Tom Becker", nummer: "7", abstand: 1.2 },
    zweikaempfe: [{ gegner: "#7 Tom Becker", wo: "in Kurve 6" }, { gegner: "Mia Schulz" }],
    gegen_schnellsten: { fahrer: "#11 Mia Schulz", hinweis: "Schulz ist in Kurve 4 schneller" },
    frage: "Was mache ich gegen Becker?", runde: 7, gueltig: true, nichts: null,
  };
  const aus = namenErsetzen(lage, fahrer) as typeof lage;
  const json = JSON.stringify(aus);
  assert.ok(!/Becker|Schulz/.test(json), json);
  assert.equal(aus.vor_mir.name, "#7");
  assert.equal(aus.zweikaempfe[0].gegner, "#7");
  assert.equal(aus.gegen_schnellsten.fahrer, "#11");
  assert.equal(aus.gegen_schnellsten.hinweis, "#11 ist in Kurve 4 schneller");
  assert.equal(aus.frage, "Was mache ich gegen #7?");
  assert.equal(aus.runde, 7);
  assert.equal(aus.nichts, null);
  assert.equal(JSON.stringify(namenErsetzen({ a: "Du bist schnell" }, fahrer)), JSON.stringify({ a: "Du bist schnell" }), "„Du“ bleibt");
  const kurz = namenErsetzen({ a: "Max fährt maximal am Limit, Maximilian nicht", b: "Xi vorn" }, [{ name: "Max", nummer: "3" }, { name: "Xi", nummer: "" }]) as { a: string; b: string };
  assert.equal(kurz.a, "#3 fährt maximal am Limit, Maximilian nicht", "nur ganze Wörter");
  assert.equal(kurz.b, "ein Fahrer vorn");
});

test("Stint-Planer: Messwerte hin und zurück, Umlaute bleiben, Schadcode wird entschärft", () => {
  const kodiert = messwerteKodieren({ rundenzeit: 87.4567, verbrauch: 2.6789, runden: 5, simulation: "iRacing", strecke: "Nürburgring <script>alert(1)</script>", fahrzeug: "BMW M4 GT3" });
  assert.match(kodiert, /^[A-Za-z0-9_-]+$/);
  const m = messwerteLesen(`#messwerte=${kodiert}`);
  assert.ok(m);
  assert.equal(m.rundenzeit, 87.457);
  assert.equal(m.verbrauch, 2.679);
  assert.equal(m.runden, 5);
  assert.equal(m.fahrzeug, "BMW M4 GT3");
  assert.ok(m.strecke.startsWith("Nürburgring") && !m.strecke.includes("<"));
});

test("Stint-Planer: unsinnige oder fremde Links werden nicht übernommen", () => {
  const link = (o: unknown) => `#messwerte=${Buffer.from(JSON.stringify(o)).toString("base64url")}`;
  assert.equal(messwerteLesen("#plan=abc"), null);
  assert.equal(messwerteLesen("#messwerte=%%%"), null);
  assert.equal(messwerteLesen(link({ v: 2, rz: 90 })), null); // unbekannte Fassung
  assert.equal(messwerteLesen(link({ v: 1, rz: 5, vb: 900 })), null); // außerhalb der Grenzen
  assert.equal(messwerteLesen(link({ v: 1, rz: "90", vb: null })), null); // Text statt Zahl
  const nurVerbrauch = messwerteLesen(link({ v: 1, vb: 3.1, n: 99999, strecke: "x".repeat(500) }));
  assert.equal(nurVerbrauch?.rundenzeit, null);
  assert.equal(nurVerbrauch?.runden, 1);
  assert.equal(nurVerbrauch?.strecke.length, 60);
  assert.equal(messwerteLesen(`#messwerte=${Buffer.from("kein json").toString("base64url")}`), null);
});
test("Sprache einer Antwort erkennen (Stimmwahl bei „Automatisch“)", () => {
  assert.equal(spracheVonText("Sprit reicht noch für sieben Runden, die 27 ist 1,2 vor dir."), "de");
  assert.equal(spracheVonText("Fuel is fine, box this lap. The car behind is 1.2 seconds away."), "en");
  assert.equal(spracheVonText("Tienes combustible para siete vueltas, el coche de detrás está a 1,2."), "es");
  assert.equal(spracheVonText("Il te reste de l'essence pour sept tours, la voiture derrière est à 1,2."), "fr");
  assert.equal(spracheVonText("Topliva hvatit — топлива хватит на семь кругов."), "ru");
  assert.equal(spracheVonText("Пального вистачить на сім кіл."), "uk");
  assert.equal(spracheVonText("燃料は大丈夫です"), "ja");
  assert.equal(spracheVonText("Brandstof is goed, de auto achter je is dichtbij."), "nl");
  assert.equal(spracheVonText("123 456"), null);
  assert.equal(Object.keys(SPRECH_SPRACHEN).length, 25, "Parakeet v3 versteht 25 Sprachen");
});
test("Ansagen: alle 28 Sprachen vollständig, gleiche Platzhalter wie Deutsch, keine deutschen Reste", () => {
  assert.deepEqual([...ANSAGE_SPRACHEN].sort(), Object.keys(LAENDERCODE).sort());
  const platzhalter = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const schluessel = ["probe", "vor", "hinter", "niemand", "sprit", "letzte", "beste", "platz", "nochNichts", "anmelden", "keineKi", "stoerung", "einrichtung", "rundeUngueltig", "neueBestzeit", "hinterBest", "runde", "nachbesprechung"] as const;
  for (const code of ANSAGE_SPRACHEN) {
    for (const k of schluessel) {
      const roh = ansage(code, k, Object.fromEntries(["name", "wer", "s", "l", "v", "r", "zeit", "nr", "p", "d"].map((x) => [`${x}`, `{${x}}`])));
      assert.equal(platzhalter(roh), platzhalter(ansage("de", k, Object.fromEntries(["name", "wer", "s", "l", "v", "r", "zeit", "nr", "p", "d"].map((x) => [`${x}`, `{${x}}`])))), `${code}.${k}`);
      if (code !== "de") assert.ok(!/\b(Runde|Sprit|Bestzeit|hinter dir)\b/.test(roh), `${code}.${k} enthält Deutsch: ${roh}`);
    }
    if (code !== "de") assert.ok(pruefenIn(code), code);
  }
  // Probefunk: Deutsch „am Ende der 23. Runde“ (Wunsch 26.11.), Englisch „lap 23“ – nie „Round 23“
  assert.match(ansage("de", "probe", { name: "Lars" }), /Hier ist Lars.*am Ende der 23\. Runde/);
  assert.match(ansage("en", "probe", { name: "Lars" }), /This is Lars.*end of lap 23/);
  assert.ok(!/round/i.test(ansage("en", "probe", { name: "Lars" })));
  assert.match(ansage("bg", "probe", { name: "Ларс" }), /Тук е Ларс/);
  assert.equal(ansage("xx", "platz", { p: 3 }), "Du liegst auf Platz 3.");
});

test("Vorlesen: Einheiten ausgeschrieben, Komma je Sprache, Rundenzeit wie am Funk", () => {
  // Fund 26.11.: „4L“ statt „4 Liter“
  assert.equal(zumSprechen("Du hast 4 l im Tank, 2,35 l pro Runde.", "de"), "Du hast 4 Liter im Tank, 2,35 Liter pro Runde.");
  assert.equal(zumSprechen("4L übrig", "de"), "4 Liter übrig");
  assert.equal(zumSprechen("You have 4 l left, gap 1,2 s.", "en"), "You have 4 litres left, gap 1.2 seconds.");
  assert.equal(zumSprechen("Bestzeit 1:27,120 – 0,3 s schneller", "de"), "Bestzeit 1 27,1 – 0,3 Sekunden schneller");
  assert.equal(zumSprechen("Best lap 1:27.120", "en"), "Best lap 1 27.1");
  assert.equal(zumSprechen("Имаш 4 l, 240 km/h, 80 m", "bg"), "Имаш 4 литра, 240 километра в час, 80 метра");
  // nichts verschlimmbessern: Wörter mit l/s/m am Anfang, Uhrzeiten ohne Nachkommastelle
  assert.equal(zumSprechen("Kurve 3 links, Box um 14:30", "de"), "Kurve 3 links, Box um 14:30");
  assert.equal(zumSprechen("die 27 ist 1,2 vor dir", "en"), "die 27 ist 1.2 vor dir");
  assert.equal(zahlIn("de", 1.25, 2), "1,25");
  assert.equal(zahlIn("en", 1.25, 2), "1.25");
});

test("Fragen werden in jeder Sprache erkannt (feste Antworten ohne KI)", () => {
  assert.equal(absicht("Hey Lars, reicht der Sprit?", "de"), "sprit");
  assert.equal(absicht("Wer fährt vor mir?", "de"), "vor");
  assert.equal(absicht("Was war meine letzte Runde?", "de"), "letzte");
  assert.equal(absicht("Wie kann ich Sprit sparen?", "de"), null);
  assert.equal(absicht("How much fuel do I have?", "en"), "sprit");
  assert.equal(absicht("Who is behind me?", "en"), "hinter");
  assert.equal(absicht("What was my best lap?", "en"), "beste");
  assert.equal(absicht("Колко гориво ми остава?", "bg"), "sprit");
  assert.equal(absicht("Кой е пред мен?", "bg"), "vor");
  assert.equal(absicht("Która jest moja pozycja?", "pl"), "platz");
  assert.equal(absicht("¿Quién va delante?", "es"), "vor");
  assert.equal(absicht("Mennyi üzemanyagom van?", "hu"), "sprit");
  assert.equal(absicht("Warum verliere ich in Kurve 4 Zeit?", "de"), null);
  assert.equal(absicht("¿Puedes analizar mi frenada?", "es"), null);
  assert.equal(absicht("Tko je iza mene?", "hr"), "hinter");
  assert.equal(absicht("Napravi analizu", "hr"), null);
});
test("Eigene Stimme: deutsche Zahlen in Worten (die geklonte Stimme liest keine Ziffern)", () => {
  assert.equal(zahlWort(0), "null");
  assert.equal(zahlWort(1), "eins");
  assert.equal(zahlWort(21), "einundzwanzig");
  assert.equal(zahlWort(23), "dreiundzwanzig");
  assert.equal(zahlWort(30), "dreißig");
  assert.equal(zahlWort(101), "hunderteins".replace(/^/, "ein"));
  assert.equal(zahlWort(1300), "eintausenddreihundert");
  assert.equal(zahlWort(250_000), "zweihundertfünfzigtausend");
  assert.equal(ordnungWort(1), "ersten");
  assert.equal(ordnungWort(3), "dritten");
  assert.equal(ordnungWort(12), "zwölften");
  assert.equal(ordnungWort(23), "dreiundzwanzigsten");
  assert.equal(zahlenAusschreiben("Wir holen dich am Ende der 23. Runde rein."), "Wir holen dich am Ende der dreiundzwanzigsten Runde rein.");
  assert.equal(zahlenAusschreiben("Du liegst auf Platz 3. Stark!"), "Du liegst auf Platz drei. Stark!");
  assert.equal(zahlenAusschreiben("#27 ist 1,25 Sekunden vor dir"), "Nummer siebenundzwanzig ist eins Komma zwei fünf Sekunden vor dir");
  // zusammen mit dem Aufbereiten: Rundenzeit wie am Funk, Einheiten ausgeschrieben
  assert.equal(zahlenAusschreiben(zumSprechen("Bestzeit 1:27,120, 4 l im Tank", "de")), "Bestzeit eins siebenundzwanzig Komma eins, vier Liter im Tank");
});
test("Rundenarchiv: Messpunkte verdichten, je Auto 5 schnellste + 20 letzte behalten, Kärtchen je Strecke", () => {
  const punkte = Array.from({ length: 5400 }, (_, i) => ({ a: i / 5399, t: i / 60, v: 50 + (i % 7), g: 1, b: 0, gang: 4, l: 0.5, r: 0.1 }));
  const d = packen(punkte);
  const zurueck = entpacken(d);
  assert.ok(zurueck.length <= 2000 && zurueck.length > 1700, `Punkte: ${zurueck.length}`);
  assert.equal(zurueck.at(-1)!.a, 1, "der letzte Punkt bleibt");
  assert.ok(Math.abs(zurueck[10].t - punkte[30].t) < 1e-4);
  // die Lücke zwischen zwei Punkten bleibt klein (sonst baut die Karte nicht)
  assert.ok(zurueck.every((p, i) => i === 0 || p.t - zurueck[i - 1].t < 0.2));

  const runde = (id: number, zeit: number, tag: number, gueltig = true, fahrzeug = "BMW M4 GT3", strecke = "Monza"): ArchivRunde =>
    ({ id, strecke, fahrzeug, laengeM: 5793, sitzung: "Practice", datum: new Date(Date.UTC(2026, 10, tag, 12, id % 60)).toISOString(), nr: id, zeit, gueltig, grund: null, daten: new Float32Array(0) });
  const liste: ArchivRunde[] = [];
  for (let i = 1; i <= 40; i++) liste.push(runde(i, 110 - (i === 3 ? 5 : 0) + (i % 5), 1 + Math.floor(i / 3), i % 9 !== 0));
  liste.push(runde(100, 120, 1, true, "Porsche 911 GT3 R"));
  const weg = new Set(aufraeumen(liste));
  const bleibt = liste.filter((r) => !weg.has(r.id!));
  const bmw = bleibt.filter((r) => r.fahrzeug === "BMW M4 GT3");
  assert.ok(bmw.some((r) => r.id === 3), "die schnellste Runde bleibt, auch wenn sie alt ist");
  assert.ok(bmw.length <= BESTE_JE_AUTO + LETZTE_JE_AUTO && bmw.length >= LETZTE_JE_AUTO);
  assert.ok(bleibt.some((r) => r.id === 100), "jedes Auto behält seine Runden");
  const neueste20 = [...liste].filter((r) => r.fahrzeug === "BMW M4 GT3").sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 20);
  assert.ok(neueste20.every((r) => !weg.has(r.id!)), "die 20 letzten bleiben");

  const karten = streckenKarten([...bleibt, runde(200, 95, 20, true, "Ferrari 296", "Spa")]);
  assert.equal(karten[0].strecke, "Spa", "zuletzt gefahrene Strecke zuerst");
  const monza = karten.find((k) => k.strecke === "Monza")!;
  assert.equal(monza.beste, Math.min(...bleibt.filter((r) => r.gueltig && r.strecke === "Monza").map((r) => r.zeit)));
  assert.deepEqual(monza.autos.sort(), ["BMW M4 GT3", "Porsche 911 GT3 R"]);
});
test("Funk: Sätze teilen (erster Satz kommt sofort), „23. Runde“ bleibt zusammen, fertige Sätze in allen Sprachen", async () => {
  // funk.ts braucht ein Fenster – hier genügt ein kleiner Ersatz
  (globalThis as unknown as { window: object }).window ??= {};
  const { saetze, stueckeFuerEigene } = await import("../src/funk.ts");
  // eigene Stimme: sehr kurze Sätze hängen am nächsten, fertige (gespeicherte) bleiben einzeln
  assert.deepEqual(stueckeFuerEigene(["Funkcheck.", "Hier ist Lars, ich höre dich.", "Box."]), ["Funkcheck. Hier ist Lars, ich höre dich. Box."]);
  assert.deepEqual(stueckeFuerEigene(["Moment.", "Sprit reicht noch für sieben Runden."], (s) => s === "Moment."), ["Moment.", "Sprit reicht noch für sieben Runden."]);
  assert.deepEqual(stueckeFuerEigene(["Ein ziemlich langer erster Satz mit Inhalt.", "Kurz."]), ["Ein ziemlich langer erster Satz mit Inhalt. Kurz."]);
  assert.deepEqual(saetze("Funkcheck. Hier ist Lars, ich höre dich. Wir holen dich am Ende der 23. Runde rein."),
    ["Funkcheck.", "Hier ist Lars, ich höre dich.", "Wir holen dich am Ende der 23. Runde rein."]);
  assert.deepEqual(saetze("Sprit reicht? Ja! Gut…  Weiter"), ["Sprit reicht?", "Ja!", "Gut…", "Weiter"]);
  assert.deepEqual(saetze("Bestzeit 1:27,120 – 0,3 s schneller."), ["Bestzeit 1:27,120 – 0,3 s schneller."]);
  const lang = `${"Die Abstände nach vorne und hinten bleiben gleich, ".repeat(3)}und der Sprit reicht bis ins Ziel, wenn du so weiterfährst.`;
  const teile = saetze(lang);
  assert.ok(teile.length >= 2 && teile.every((s) => s.length <= 160), teile.join(" | "));
  assert.equal(teile.join(" ").replace(/\s+/g, " "), lang.replace(/\s+/g, " ").trim());
  // „Nicht verstanden“, „Noch dran“ und „Wir prüfen“ für jede Sprache des Renningenieurs
  for (const [name, liste] of Object.entries(FERTIGE_SAETZE)) {
    const erwartet = name === "PRUEFEN" ? ANSAGE_SPRACHEN.filter((c) => c !== "de") : ANSAGE_SPRACHEN;
    assert.deepEqual(Object.keys(liste).sort(), [...erwartet].sort(), name);
  }
  assert.match(nichtVerstanden("de"), /nicht verstanden/);
  assert.match(nichtVerstanden("bg"), /не те разбрах/);
  assert.equal(nichtVerstanden("xx"), nichtVerstanden("de"));
});
test("Sprachtest: Trefferquote nach Wortfehlern, Umlaute und Satzzeichen egal", () => {
  assert.equal(TESTSAETZE.length, 10);
  assert.deepEqual(woerter("Wer ist vor mir?"), ["wer", "ist", "vor", "mir"]);
  assert.equal(trefferquote("Wer ist vor mir?", "wer ist vor mir"), 1);
  assert.equal(trefferquote("Wer ist vor mir?", "Bewehrst vor mir."), 0.5, "zwei Wörter falsch (eins vertauscht, eins fehlt) von vier");
  assert.equal(trefferquote("Hey Kim, reicht der Sprit?", "Hey Tim reicht der Sprit"), 0.8);
  assert.equal(trefferquote("Größe", "groesse"), 1);
  assert.equal(trefferquote("Box diese Runde.", ""), 0);
  assert.deepEqual(fehlendeWoerter("Hey Kim, reicht der Sprit?", "Hey Tim reicht der Sprit"), ["Kim,"]);
});
test("Live-Platz: Reihenfolge nach gefahrener Strecke statt offiziellem Platz vom Rundenbeginn", () => {
  // Offiziell (Stand Ziellinie): ich (Auto 2) auf Platz 4. Inzwischen habe ich Auto 0 und 1 überholt.
  const f = {
    zeit: 100, ich: 2,
    anteil: [0.55, 0.60, 0.66, 0.70, -1, 0.10],
    runde: [5, 5, 5, 5, 5, 6],
    platz: [2, 3, 4, 1, 5, 0],
    inBox: [0, 0, 0, 0, 0, 0],
  };
  assert.deepEqual(liveReihenfolge(f), [3, 2, 1, 0], "Auto 4 nicht auf der Strecke, Auto 5 ohne Wertung (Pace-Car)");
  assert.equal(livePlatz(f), 2, "jetzt Platz 2 statt 4");
  assert.deepEqual(liveNachbarn(f), { vor: 3, hinter: 1 });
  // überrundetes Auto zählt hinter mir, auch wenn es auf der Strecke vor mir fährt
  const g = { ...f, anteil: [0.9, 0.60, 0.66, 0.70, -1, 0.10], runde: [4, 5, 5, 5, 5, 6] };
  assert.deepEqual(liveReihenfolge(g), [3, 2, 1, 0]);
  assert.equal(livePlatz({ ...f, ich: 4 }), null, "nicht auf der Strecke: kein Live-Platz");
  assert.ok(istRennen("Race") && istRennen("Rennen") && !istRennen("Practice") && !istRennen("Open Qualify"));
});

test("Referenzrunden: 201 Stützstellen hin und zurück, Zeitverlauf beginnt bei 0 und steigt nie", () => {
  // gleichmäßige Runde über 90 s auf dem Raster der App
  const t = Float64Array.from({ length: RASTER + 1 }, (_, i) => 3 + (i / RASTER) * 90);
  const v = verdichten(t);
  assert.equal(v.length, PUNKTE);
  assert.equal(v[0], 3);
  assert.equal(v[PUNKTE - 1], 93);
  assert.equal(verdichten([0, 1], 3.6)[PUNKTE - 1], 3.6, "Faktor (m/s → km/h)");
  assert.equal(verdichten([0, Number.NaN])[PUNKTE - 1], 0, "kaputte Werte werden 0, nicht NaN");
  // Messrauschen: kleiner Rückschritt wird geglättet, Start bei 0
  const rauschen = Float64Array.from(t, (x, i) => (i === 400 ? x - 0.5 : x));
  const z = zeitverlauf(rauschen);
  assert.equal(z[0], 0);
  assert.ok(z.every((x, i) => i === 0 || x >= z[i - 1]), "nie fallend");
  assert.ok(Math.abs(z[PUNKTE - 1] - 90) < 0.001);
  // zurück aufs Raster: passt zur Ausgangsrunde
  const r = aufRaster(zeitverlauf(t));
  assert.equal(r.length, RASTER + 1);
  for (const i of [0, Math.floor(RASTER / 3), RASTER]) assert.ok(Math.abs(r[i] - (t[i] - 3)) < 0.01, `Punkt ${i}`);
});

test("Crash: Einschlag wird erkannt, Kurven und hartes Bremsen nicht; Schaden für die KI", () => {
  const w = new CrashWaechter();
  const p = (zeit: number, kmh: number, quer: number, laengs: number, extra: Partial<Probe> = {}): Probe =>
    ({ zeit, tempo: kmh / 3.6, querBeschl: quer, laengsBeschl: laengs, aufStrecke: true, inBox: false, lage: 3, vorfaelle: 0, ...extra }) as Probe;
  const ereignisse: number[] = [];
  const fahren = (von: number, bis: number, f: (t: number) => Probe) => {
    for (let t = von; t < bis; t += 1 / 60) { const e = w.aufnehmen(f(Math.round(t * 600) / 600)); if (e) ereignisse.push(e.zeit); }
  };
  // 10 s schnelle Kurven (bis 4 g, langsam aufgebaut) und Vollbremsung mit 4 g: kein Einschlag
  fahren(0, 5, (t) => p(t, 220, 40 * Math.sin(t), -2));
  fahren(5, 7, (t) => p(t, 280 - (t - 5) * 140, 3, -39));
  assert.deepEqual(ereignisse, [], "Kurven und Bremsen sind kein Crash");
  // Einschlag in die Mauer: Spitze 18 g, Tempo von 160 auf 40 km/h
  fahren(7, 8, (t) => p(t, 160, 5, 0));
  fahren(8, 8.1, (t) => p(t, 40, 30, -176));
  fahren(8.1, 12, (t) => p(t, 30, 1, 0));
  assert.equal(ereignisse.length, 1, "ein Ereignis, nicht mehrere Messpunkte");
  assert.ok(w.letzter && w.letzter.g >= 15 && w.letzter.tempoVorherKmh >= 150, JSON.stringify(w.letzter));
  // nur Vorfallpunkte (+4, harter Kontakt ohne gemessene Spitze) nach der Ruhezeit
  fahren(30, 31, (t) => p(t, 150, 2, 0, { vorfaelle: 4 }));
  fahren(31, 32, (t) => p(t, 150, 2, 0, { vorfaelle: 8 }));
  assert.equal(ereignisse.length, 2);
  // im Stand in der Box oder beim Abschleppen nie
  const w2 = new CrashWaechter();
  for (let t = 0; t < 1; t += 1 / 60) assert.equal(w2.aufnehmen(p(t, t < 0.5 ? 200 : 0, 0, 0, { aufStrecke: false, lage: -1 })), null);
  // Schaden-Bild: Einschlag, Fleischball, Motor-Warnung; ohne alles ehrlich „kein Schaden“
  const bild = schadenBild(p(40, 100, 0, 0, { reparatur: 0, flaggen: 0x100000, motorWarnung: 0x05 }), w.letzter, 40) as Record<string, unknown>;
  assert.ok(bild.letzter_einschlag && bild.fleischball_flagge, JSON.stringify(bild));
  assert.deepEqual(bild.motor_warnungen, ["Wassertemperatur", "Öldruck"]);
  assert.equal(schadenBild(p(5, 100, 0, 0, { reparatur: 0, flaggen: 0 }), null, 5), "kein Schaden gemeldet und kein Einschlag gemessen");
  assert.equal(schadenBild(p(5, 100, 0, 0), null, 5), null, "Simulation liefert nichts");
  // „Alles okay?“ in allen 28 Sprachen
  assert.deepEqual(Object.keys(CRASH_SAETZE).sort(), Object.keys(LAENDERCODE).sort());
});

test("Fahrer-Infos: iRating, Lizenz, X und Strafen; neuer Vorder-/Hintermann; eigene Strafe einmal", () => {
  assert.equal(werMitInfo("Anna Beispiel", "27", { irating: 2345, lizenz: "A 4.99", vorfaelle: 3 }), "#27 Anna Beispiel (iRating 2345, A 4.99, 3 X)");
  assert.equal(werMitInfo("Ben", "", null), "Ben");
  assert.equal(strafeAus(0x10000), "strafe");
  assert.equal(strafeAus(0x80000), "verwarnung");
  assert.equal(strafeAus(0x100000 | 0x4), "reparatur");
  assert.equal(strafeAus(0x4), null);
  assert.equal(strafeAus(null), null);
  // eigene Strafe: nur beim Dazukommen, nicht bei jedem Messpunkt
  const s = new StrafenWaechter();
  assert.deepEqual([0, 0x10000, 0x10000, 0, 0x80000].map((f) => s.pruefen(f)), [null, "strafe", null, null, "verwarnung"]);
  // neuer Nachbar: erster still, dann erst nach 3 s stabil und bis 2,5 s Abstand; höchstens alle 15 s
  const w = new NachbarWaechter();
  const lauf = (von: number, bis: number, vor: number | null, abstand = 1) => {
    const raus: string[] = [];
    for (let t = von; t <= bis; t += 0.5) raus.push(...w.pruefen(t, { vor: vor == null ? null : { idx: vor, abstand }, hinter: null }));
    return raus;
  };
  assert.deepEqual(lauf(0, 5, 7), [], "der erste nach dem Start wird still übernommen");
  assert.deepEqual(lauf(5.5, 7, 9), [], "noch nicht 3 s stabil");
  assert.deepEqual(lauf(7.5, 10, 9), ["vor"]);
  assert.deepEqual(lauf(10.5, 20, 4), [], "Sperre 15 s");
  assert.deepEqual(lauf(20.5, 40, 5, 6), [], "zu weit weg");
  // alle 28 Sprachen mit Platzhalter
  assert.deepEqual(Object.keys(FAHRER_SAETZE).sort(), Object.keys(LAENDERCODE).sort());
  for (const [code, x] of Object.entries(FAHRER_SAETZE)) for (const k of ["neuVor", "neuHinter", "strafe", "verwarnung"] as const) assert.ok(x[k].includes("{wer}"), `${code}.${k}`);
});

test("Referenz teilen: Runde neben der Strecke oder mit Vorfallpunkten ist gesperrt", () => {
  const z = new Rundenzaehler();
  const p = (zeit: number, anteil: number, extra: Partial<Probe> = {}): Probe =>
    ({ zeit, anteil, tempo: 50, gas: 1, bremse: 0, sprit: 50, aufStrecke: true, inBox: false, lage: 3, vorfaelle: 0, ...extra }) as Probe;
  const runde = (start: number, extra: (a: number) => Partial<Probe>) => {
    let fertig = null;
    for (let i = 0; i <= 100; i++) { const a = (i % 100) / 100 + 0.0001; const r = z.aufnehmen(p(start + i * 0.6, i === 100 ? 0.0002 : a, extra(a))); if (r) fertig = r; }
    return fertig;
  };
  runde(0, () => ({}));
  const sauber = runde(60, () => ({}));
  const abseits = runde(120, (a) => (a > 0.4 && a < 0.45 ? { lage: 0 } : {}));
  const x = runde(180, (a) => (a > 0.5 ? { vorfaelle: 2 } : {}));
  assert.equal(sauber?.sperre ?? null, null);
  assert.equal(abseits?.gueltig, false, "neben der Strecke zählt nicht (Fund 28.11.) …");
  assert.equal(abseits?.grund, "Neben der Strecke");
  assert.equal(abseits?.sperre, "Neben der Strecke", "… und ist keine Referenz");
  assert.equal(sauber?.gueltig, true);
  assert.equal(x?.sperre, "Vorfallpunkte in der Runde");
  assert.equal(x?.gueltig, false, "neue X: Runde zählt nicht");
});

test("Fahr eine Runde mit mir: Bremspunkte finden und genau dort piepen", () => {
  // 4-km-Runde: Bremszonen bei 25 % und 70 %, dazwischen kurzes Antippen (zählt nicht, zu nah)
  const L = 4000;
  const a = Array.from({ length: 2001 }, (_, i) => i / 2000);
  const b = a.map((x) => (x >= 0.25 && x < 0.28) || (x >= 0.7 && x < 0.74) || (x >= 0.285 && x < 0.287) ? 0.9 : 0);
  const stellen = bremsStellen(a, b, L);
  assert.equal(stellen.length, 2, JSON.stringify(stellen));
  assert.ok(Math.abs(stellen[0] - 0.25) * L < 3 && Math.abs(stellen[1] - 0.7) * L < 3, "auf wenige Meter genau");
  // aus der Datenbank (201 Stützstellen, Prozent): Übergang wird eingerechnet
  const ref = Array.from({ length: 201 }, (_, i) => (i >= 50 && i < 56 ? 80 : 0));
  const r = bremsStellenAusReferenz(ref, L);
  assert.equal(r.length, 1);
  assert.ok(Math.abs(r[0] - 0.25) * L < 25, `${r[0] * L} m`);
  // Mitfahren: 50 m/s, 60 Messpunkte pro Sekunde, zwei Runden – je Bremspunkt genau ein Piep, kurz vor dem Punkt
  const m = new Mitfahrer(stellen, L);
  const pieps: number[] = [];
  let anteil = 0;
  for (let i = 0; i < 2 * 80 * 60; i++) {
    anteil = (anteil + 50 / 60 / L) % 1;
    if (m.aufnehmen(anteil, 50)) pieps.push(anteil);
  }
  assert.equal(pieps.length, 4, "zwei Bremspunkte, zwei Runden");
  for (const p of pieps) {
    const naechste = stellen.reduce((x, y) => (Math.abs(y - p) < Math.abs(x - p) ? y : x));
    const vorMeter = (naechste - p) * L;
    assert.ok(vorMeter >= -1 && vorMeter <= 5, `Piep ${vorMeter.toFixed(1)} m vor dem Bremspunkt`);
  }
  // Sprung (zurückgesetzt, Box): kein Piep für übersprungene Punkte
  const m2 = new Mitfahrer(stellen, L);
  m2.aufnehmen(0.1, 50);
  assert.equal(m2.aufnehmen(0.5, 50), false);
});

test("Kürzen: nie mitten im Wort oder Satz (Nachbesprechung brach ab)", () => {
  const text = "Starkes Rennen von Platz 12 auf 8. In Kurve 4 liegt die meiste Zeit. Bremse dort etwa 10 Meter später und rolle mehr Tempo hinein.";
  assert.equal(amSatzende(text, 500), text, "kurz genug: unverändert");
  assert.equal(amSatzende(text, 80), "Starkes Rennen von Platz 12 auf 8. In Kurve 4 liegt die meiste Zeit.");
  assert.equal(amSatzende("Ein einziger sehr langer Satz ohne Punkt der einfach immer weiter geht", 30), "Ein einziger sehr langer Satz …");
  // von der KI abgebrochen (max_tokens): bis zum letzten ganzen Satz, auch wenn die Länge passt
  assert.equal(amSatzende("Gute Pace heute. Am Ende hast du in Kurve 6 noch etwas verlo", 500, true), "Gute Pace heute.");
  assert.ok(!/\s\S{1,3}$/.test(amSatzende(text, 101)) || amSatzende(text, 101).endsWith("."), "kein abgeschnittenes Wortende");
});

test("Funk-Befehl Piepton wird erkannt (vor der KI) – auch mit Signalwort und Spracherkennung", () => {
  for (const f of ["Fahr eine Runde mit mir", "Hey Lars, fahre eine Runde mit mir.", "fahr ne runde mit mir", "Zeig mir die Bremspunkte", "Piepton an", "Ride along with me", "drive a lap with me"]) assert.equal(mitfahrBefehl(f), "an", f);
  for (const f of ["Piepton aus", "Kein Piepen mehr bitte", "Mitfahren beenden", "beep off"]) assert.equal(mitfahrBefehl(f), "aus", f);
  for (const f of ["Wie war meine Runde?", "Wer ist vor mir?", "Wie viel Sprit habe ich?"]) assert.equal(mitfahrBefehl(f), null, f);
});

test("Schaden aus dem Fahrverhalten: Lenkrad schief und Topspeed weg nach dem Einschlag, Ausflüge gezählt", () => {
  const f = new Fahrverhalten();
  const p = (zeit: number, runde: number, kmh: number, lenkung: number, extra: Partial<Probe> = {}): Probe =>
    ({ zeit, runde, tempo: kmh / 3.6, lenkung, querBeschl: 0.3, gas: 1, bremse: 0, aufStrecke: true, inBox: false, lage: 3, ...extra }) as Probe;
  let t = 0;
  // vorher: geradeaus mit 0° Lenkung, Topspeed 240
  for (let r = 1; r <= 2; r++) for (let i = 0; i < 600; i++) f.aufnehmen(p((t += 1 / 60), r, 200 + (i % 300) / 7.5, 0));
  assert.equal(f.auswirkung().lenkungSchiefGrad, null);
  f.einschlag();
  // nachher: Lenkrad 5° schief auf Geraden, Topspeed nur noch ~225
  for (let r = 3; r <= 4; r++) for (let i = 0; i < 600; i++) f.aufnehmen(p((t += 1 / 60), r, 185 + (i % 300) / 7.5, (5 * Math.PI) / 180));
  f.aufnehmen(p((t += 1 / 60), 5, 150, 0.087));
  const a = f.auswirkung();
  assert.ok(a.lenkungSchiefGrad != null && Math.abs(a.lenkungSchiefGrad - 5) < 0.3, JSON.stringify(a));
  assert.ok(a.topspeedJetztKmh != null && a.topspeedVorherKmh != null && a.topspeedVorherKmh - a.topspeedJetztKmh >= 10, JSON.stringify(a));
  const bild = schadenBild(p(t, 5, 150, 0, { reparatur: 0, flaggen: 0 }), null, t, a) as Record<string, unknown>;
  assert.ok(bild.am_auto_gemessen, JSON.stringify(bild));
  // Ausflüge neben die Strecke: jeder Ausflug einmal (nicht jeder Messpunkt), kurzes Flackern zählt nicht doppelt
  const g = new Fahrverhalten();
  const lagen = [3, 3, 0, 0, 0, 3, 0, 3, 3];
  lagen.forEach((l, i) => g.aufnehmen(p(i * 0.5, 1, 100, 0, { lage: l })));
  for (let i = 0; i < 20; i++) g.aufnehmen(p(10 + i * 0.5, 1, 100, 0, { lage: i === 5 ? 0 : 3 }));
  assert.equal(g.ausfluege, 2);
});

test("Boxenstopp per Zuruf: Sätze verstehen, Feststellungen und Fragen nicht als Befehl", () => {
  const w = boxWunschLesen("Box: 20 Liter, vier neue Reifen, kein Fast Repair")!;
  assert.deepEqual(w.sprit, { art: "liter", liter: 20 });
  assert.deepEqual(w.reifen, ["vl", "vr", "hl", "hr"]);
  assert.equal(w.fastRepair, false);
  assert.equal(boxWunschLesen("Hey Lars, Reifen vorne wechseln und Fast Repair")?.reifen?.toString(), "vl,vr");
  assert.equal(boxWunschLesen("neue Reifen hinten links")?.reifen?.toString(), "hl");
  assert.deepEqual(boxWunschLesen("Box, volltanken")?.sprit, { art: "voll" });
  assert.deepEqual(boxWunschLesen("Tank so viel wie nötig")?.sprit, { art: "noetig" });
  assert.deepEqual(boxWunschLesen("Box, nicht tanken, keine Reifen")?.sprit, { art: "kein" });
  assert.equal(boxWunschLesen("Box, nicht tanken, keine Reifen")?.reifen, "keine");
  assert.equal(boxWunschLesen("Pit: 15 litres, new tyres, no fast repair")?.fastRepair, false);
  assert.equal(boxWunschLesen("Box zurücksetzen")?.loeschen, true);
  // keine Befehle
  for (const t of ["Meine Reifen sind kaputt", "Wie viel Sprit habe ich?", "Soll ich nachtanken?", "Wer ist vor mir?", "Reifenschaden"]) assert.equal(boxWunschLesen(t), null, t);
  assert.equal(boxFrage("Wie viel soll ich nachtanken?"), "sprit");
  assert.equal(boxFrage("Lohnt sich ein Stopp?"), "sprit");
  assert.equal(boxFrage("Was ist in der Box eingestellt?"), "stand");
  assert.equal(boxFrage("Wer ist hinter mir?"), null);
  // Sprache: „Box“ und „Fast Repair“ sagen alle
  assert.equal(boxEnglisch("Box: 20 Liter, vier neue Reifen, kein Fast Repair"), false);
  assert.equal(boxEnglisch("Box, fast repair"), false, "unklar: Deutsch");
  assert.equal(boxEnglisch("Pit: 15 litres, new tyres, no fast repair"), true);
});

test("Boxenstopp: Sprit bis ins Ziel, ehrlicher Rat, Befehle für iRacing", () => {
  const lage: BoxLage = { sprit: 30, verbrauch: 2.5, rundenzeit: 100, anteil: 0.5, restZeit: 120, restRunden: null, tank: 100, boxVerlust: 28 };
  // 2 Minuten Rest, 30 Liter im Tank: reicht locker – vom Stopp abraten
  const b = spritBisZiel(lage)!;
  assert.equal(b.fehlt, 0);
  assert.match(empfehlung(lage, false)!, /keinen Sprit.*Nur zum Tanken würde ich nicht reinkommen/);
  assert.match(empfehlung(lage, false)!, /28 Sekunden/);
  // langes Rennen: Liter ausrechnen, „so viel wie nötig“ stellt genau das ein
  const lang: BoxLage = { ...lage, restZeit: 3000 };
  const l = spritBisZiel(lang)!;
  assert.ok(l.fehlt > 40 && l.fehlt < 60, JSON.stringify(l));
  const { befehle, liter } = boxBefehle(boxWunschLesen("Box, Sprit so viel wie nötig, vier Reifen")!, lang);
  assert.equal(liter, l.fehlt);
  assert.deepEqual(befehle.map((x) => x.art), ["tanken", "reifen_vl", "reifen_vr", "reifen_hl", "reifen_hr"]);
  // zu wenig angesagt: ehrlich sagen
  assert.match(boxAntwort(boxWunschLesen("Box 10 Liter")!, lang, 10, false), /10 Liter reichen dafür nicht/);
  // voll: nur so viel, wie in den Tank passt
  assert.equal(boxBefehle(boxWunschLesen("Box, volltanken")!, lang).liter, 70);
  // nur Reifen vorne: erst alle Häkchen aus, dann vorne
  assert.deepEqual(boxBefehle(boxWunschLesen("Box, Reifen vorne")!, lang).befehle.map((x) => x.art), ["keine_reifen", "reifen_vl", "reifen_vr"]);
  // Rundenrennen
  assert.equal(spritBisZiel({ ...lage, restZeit: null, restRunden: 10, anteil: 0 })?.runden, 11);
  // Stand der Box aus iRacing
  assert.equal(boxStand(0x10 | 0x0f | 0x40, 22, false), "In der Box eingestellt: 22 Liter, vier Reifen, Fast Repair.");
  assert.equal(boxStand(0, 0, true), "Currently in the box: no fuel, no tyres.");
  // Zeitverlust eines Stopps aus eigenen Runden: Einfahrt + Ausfahrt gegen normale Runde
  const runden = [100, 100.5, 99.8].map((zeit) => ({ zeit, inBox: false, gueltig: true }))
    .concat([{ zeit: 112, inBox: true, gueltig: false }, { zeit: 118, inBox: true, gueltig: false }], [{ zeit: 100.2, inBox: false, gueltig: true }]);
  assert.equal(boxVerlustMessen(runden), 30);
  assert.equal(boxVerlustMessen(runden.filter((r) => !r.inBox)), null);
});

test("Piepton: Bremspunkt-Bilanz nach der Runde; Schaden-Check meldet jedes Ergebnis einmal", () => {
  const L = 4000;
  const m = new Mitfahrer([0.25, 0.5, 0.75], L);
  // Runde: am 1. Punkt 20 m zu früh, am 2. passend, am 3. 30 m zu spät
  const brems = (a: number) => (a >= 0.245 && a < 0.27) || (a >= 0.501 && a < 0.52) || (a >= 0.7575 && a < 0.78) ? 1 : 0;
  let a = 0;
  for (let i = 0; i < 2 * 4800; i++) { a = (a + 50 / 60 / L) % 1; m.aufnehmen(a, 50, brems(a)); }
  const b = m.letzteBilanz!;
  assert.equal(b.gemessen, 3);
  assert.equal(b.passend, 1);
  assert.equal(b.frueh, 1);
  assert.equal(b.spaet, 1);
  assert.equal(b.groesste?.nr, 3);
  assert.match(bilanzSatz(b, false), /1 von 3 passen, 1 zu früh, 1 zu spät\. Am deutlichsten am 3\. Bremspunkt: 3\d Meter zu spät\./);
  // Schaden-Check
  const gesagt = new Set<string>();
  const basis = { lenkungSchiefGrad: null, topspeedVorherKmh: null, topspeedJetztKmh: null, ausfluege: 0 };
  assert.equal(schadenMeldung({ ...basis, messung: { lenkung: false, topspeed: false } }, gesagt, false), null, "noch nichts gemessen");
  assert.match(schadenMeldung({ ...basis, lenkungSchiefGrad: 4.5, messung: { lenkung: true, topspeed: false } }, gesagt, false)!, /4,5 Grad schief/);
  assert.equal(schadenMeldung({ ...basis, lenkungSchiefGrad: 4.5, messung: { lenkung: true, topspeed: false } }, gesagt, false), null, "nur einmal");
  const ok = new Set<string>();
  assert.match(schadenMeldung({ ...basis, messung: { lenkung: true, topspeed: true } }, ok, false)!, /Gute Nachricht/);
  // „gleich weiß ich mehr“: Messung läuft steht im Schadensbild
  const bild = schadenBild({ zeit: 10, reparatur: 0, flaggen: 0 } as Probe, null, 10, { ...basis, messung: { lenkung: false, topspeed: false } }) as Record<string, unknown>;
  assert.match(String(bild.messung_laeuft), /Lenkung.*Topspeed/);
});

test("Strategie: Stopps, Box-Fenster, Sparen statt Stopp, Wiedereinstieg, Ansagen von selbst", () => {
  // 60-Minuten-Rennen, 100-s-Runden, 3 L/Runde, 60-L-Tank, 40 L drin, Runde 5 zur Hälfte
  const lage = { sprit: 40, verbrauch: 3, rundenzeit: 100, anteil: 0.5, restZeit: 3000, restRunden: null, tank: 60, boxVerlust: 30, runde: 5 };
  const p = planen(lage)!;
  assert.equal(p.stopps, 1);
  // Sprit reicht für (40 - 1,5) / 3 = 12,8 Runden ab jetzt → spätestens Ende Runde 5 + floor(12,8 - 0,5) = 17
  assert.equal(p.fensterBis, 17);
  assert.ok(p.fensterVon! >= 5 && p.fensterVon! <= p.fensterBis!, JSON.stringify(p));
  assert.ok(p.liter! > 40 && p.liter! <= 59, JSON.stringify(p));
  assert.equal(p.sparenL, null, "zu viel zum Sparen");
  assert.match(planSatz(p, false), /ein Stopp, Box-Fenster Runde \d+ bis 17, etwa \d+ Liter/);
  // knapp: 6 % sparen reicht – mit Grenze aus dem Stopp-Verlust
  const knapp = planen({ ...lage, sprit: 52, restZeit: 1700, tank: 54 })!;
  assert.equal(knapp.stopps, 1);
  assert.ok(knapp.sparenL != null && knapp.sparenProzent! <= 12, JSON.stringify(knapp));
  assert.match(planSatz(knapp, false), /Oder du sparst .* Liter pro Runde .* ohne Stopp durch – lohnt sich, solange es dich weniger als .* Sekunden pro Runde kostet/);
  // reicht: kein Stopp; zwei Stopps bei kleinem Tank
  assert.equal(planen({ ...lage, restZeit: 600 })!.stopps, 0);
  assert.equal(planen({ ...lage, restZeit: 3600, tank: 45 })!.stopps, 2);
  // Wiedereinstieg: 30 s Verlust, Autos 12 s, 25 s und 41 s hinter dir → Platz 4 + 2 = 6, vor dem mit 41 s
  const w = wiedereinstieg(4, [{ name: "#7 Becker", abstand: 41 }, { name: "#3 Ali", abstand: 12 }, { name: "#9 Kim", abstand: 25 }], 30)!;
  assert.deepEqual([w.platz, w.vor?.name, w.hinter?.name], [6, "#9 Kim", "#7 Becker"]);
  assert.equal(wiedereinstiegSatz(w, false), "Kommst du jetzt rein, kommst du etwa auf Platz 6 raus – hinter #9 Kim, knapp vor #7 Becker.");
  // Wächter: Plan einmal, Fenster offen, „diese Runde rein“ (wichtig), nichts doppelt
  const wa = new StrategieWaechter();
  const plan = { ...p, fensterVon: 10, fensterBis: 17 };
  assert.equal(wa.pruefen(plan, 6, false).length, 1, "Plan beim ersten Mal");
  assert.equal(wa.pruefen(plan, 7, false).length, 0, "nicht jede Runde");
  assert.match(wa.pruefen(plan, 10, false)[0].text, /Box-Fenster ist offen/);
  const muss = wa.pruefen(plan, 17, false);
  assert.ok(muss[0].wichtig && /Diese Runde musst du rein/.test(muss[0].text));
  assert.equal(wa.pruefen(plan, 17, false).length, 0);
  assert.match(wa.pruefen({ ...plan, stopps: 0 }, 18, false)[0].text, /kein Stopp nötig/, "Plan geändert (z. B. durch Sparen)");
  // Fragen
  for (const f of ["Was ist die Strategie?", "Wann soll ich rein?", "Wie viele Stopps brauche ich?", "When should I pit?"]) assert.ok(istStrategieFrage(f), f);
  assert.ok(!istStrategieFrage("Wer ist vor mir?"));
});
