// Rennbericht nach der Sitzung – das, was ein Renningenieur nach dem Rennen mit dir bespricht:
//  * Konstanz deiner Runden, Ideal-Runde aus deinen besten Abschnitten
//  * wo du im Schnitt Zeit lässt (Kurve für Kurve gegen deine Bestzeit) – mit dem passenden Tipp
//  * Plätze gutgemacht oder verloren, Zweikämpfe: mit wem, wie lange, wo überholt wurde
//  * Sprit und Boxenstopps
// Alles in kurzen Sätzen („Kurz gesagt“) und als Zahlen zum Nachsehen. Später formuliert der KI-Renningenieur
// daraus die Nachbesprechung – die Fakten bleiben dieselben (nichts wird erfunden).

import type { Feld, FahrerInfo } from "./typen.ts";
import type { Runde } from "./runden.ts";
import { abtasten, kurvenFinden, vergleichen, zahl, RASTER, type Kurve, type Spur } from "./analyse.ts";
import { verbrauchProRunde } from "./sprit.ts";

const NAH = 1.0; // Sekunden: darunter gilt ein Auto als „im Zweikampf“
const PAUSE = 8; // Sekunden weiter weg, bis ein Zweikampf als beendet gilt
const MIN_DAUER = 10; // Sekunden – kürzere Begegnungen sind kein Zweikampf (außer es wurde überholt)
const ZUSAMMEN = 45; // Sekunden – neuer Kontakt mit demselben Auto kurz danach gehört zum selben Zweikampf

export type Ueberholung = { zeit: number; anteil: number; ichVorbei: boolean };
export type Zweikampf = { idx: number; von: number; bis: number; minAbstand: number; ueberholungen: Ueberholung[] };
type Offen = Zweikampf & { zuletzt: number; vorzeichen: number };

/** Beobachtet das Feld (viermal pro Sekunde) und merkt sich Plätze und Zweikämpfe */
export class Rennbeobachter {
  startPlatz: number | null = null;
  platz: number | null = null;
  readonly kaempfe: Zweikampf[] = [];
  private offen = new Map<number, Offen>();
  private letzteZeit: number | null = null;

  zuruecksetzen() {
    this.startPlatz = null;
    this.platz = null;
    this.kaempfe.length = 0;
    this.offen.clear();
    this.letzteZeit = null;
  }

  /** @param rundenzeit typische Rundenzeit in Sekunden (wandelt Abstände auf der Strecke in Sekunden um) */
  aufnehmen(f: Feld, rundenzeit: number) {
    const zeit = f.zeit;
    const ich = f.ich;
    if (zeit == null || !Number.isFinite(zeit) || ich == null || ich < 0 || ich >= f.anteil.length) return;
    if (!(rundenzeit > 10 && rundenzeit < 3600)) return;
    if (this.letzteZeit != null && zeit < this.letzteZeit - 1) this.zuruecksetzen(); // neue Sitzung
    this.letzteZeit = zeit;
    const meinA = f.anteil[ich];
    const meineR = f.runde[ich];
    if (meinA == null || meinA < 0 || meineR == null) return;
    const p = f.platz[ich];
    if (p != null && p > 0) {
      this.platz = p;
      this.startPlatz ??= p;
    }
    const mein = meineR + meinA;
    for (let i = 0; i < f.anteil.length; i++) {
      if (i === ich) continue;
      const a = f.anteil[i];
      const r = f.runde[i];
      const offen = this.offen.get(i);
      const inBox = (f.inBox[i] ?? 0) !== 0;
      if (a == null || a < 0 || r == null || inBox) {
        if (offen && zeit - offen.zuletzt > PAUSE) this.schliessen(i);
        continue;
      }
      const d = r + a - mein; // Runden: positiv = vor mir
      const abstand = d * rundenzeit;
      if (Math.abs(d) < 0.5 && Math.abs(abstand) <= NAH) {
        const s = Math.sign(abstand);
        if (!offen) {
          this.offen.set(i, { idx: i, von: zeit, bis: zeit, zuletzt: zeit, minAbstand: Math.abs(abstand), vorzeichen: s, ueberholungen: [] });
        } else {
          if (s !== 0 && offen.vorzeichen !== 0 && s !== offen.vorzeichen) {
            // Reihenfolge gedreht: liegt das Auto jetzt hinter mir, war ich es, der vorbeigegangen ist
            offen.ueberholungen.push({ zeit, anteil: meinA, ichVorbei: s < 0 });
          }
          if (s !== 0) offen.vorzeichen = s;
          offen.zuletzt = zeit;
          offen.bis = zeit;
          offen.minAbstand = Math.min(offen.minAbstand, Math.abs(abstand));
        }
      } else if (offen && zeit - offen.zuletzt > PAUSE) {
        this.schliessen(i);
      }
    }
  }

  private schliessen(i: number) {
    const o = this.offen.get(i);
    if (!o) return;
    this.offen.delete(i);
    // Kurz zuvor schon mit demselben Auto gekämpft? Dann ist es derselbe Zweikampf (nur kurz über 1 s Abstand)
    const vorher = [...this.kaempfe].reverse().find((k) => k.idx === o.idx);
    if (vorher && o.von - vorher.bis < ZUSAMMEN) {
      vorher.bis = o.bis;
      vorher.minAbstand = Math.min(vorher.minAbstand, o.minAbstand);
      vorher.ueberholungen.push(...o.ueberholungen);
      return;
    }
    if (o.bis - o.von >= MIN_DAUER || o.ueberholungen.length) {
      this.kaempfe.push({ idx: o.idx, von: o.von, bis: o.bis, minAbstand: o.minAbstand, ueberholungen: o.ueberholungen });
    }
  }

  /** Alle Zweikämpfe inklusive der noch laufenden */
  alleKaempfe(): Zweikampf[] {
    const laufend = [...this.offen.values()]
      .filter((o) => o.bis - o.von >= MIN_DAUER || o.ueberholungen.length)
      .map((o) => ({ idx: o.idx, von: o.von, bis: o.bis, minAbstand: o.minAbstand, ueberholungen: o.ueberholungen }));
    return [...this.kaempfe, ...laufend].sort((a, b) => a.von - b.von);
  }
}

export type KurvenSchnitt = { kurve: Kurve; meter: number; schnitt: number; tipp: string; runden: number };
export type Bericht = {
  runden: number;
  gueltig: number;
  beste: number | null;
  ideal: number | null;
  schnitt: number | null;
  konstanz: number | null;
  sprit: number | null;
  stopps: number;
  startPlatz: number | null;
  endPlatz: number | null;
  kurven: KurvenSchnitt[];
  kaempfe: Array<Zweikampf & { name: string; dauerRunden: number }>;
  saetze: string[];
};

export const rundenzeitText = (s: number | null) => {
  if (s == null || !Number.isFinite(s) || s <= 0) return "–";
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0").replace(".", ",")}`;
};

/** In welcher Kurve liegt die Stelle (Index im Raster)? */
export function stelleText(i: number, kurven: Kurve[]): string {
  const k = kurven.find((x) => i >= x.start && i < x.ende);
  return k ? `in Kurve ${k.nr}` : "auf der Start-Ziel-Geraden";
}

export function berichtErstellen(alleRunden: Runde[], beob: Rennbeobachter | null, laengeM: number, fahrer: FahrerInfo[] = []): Bericht {
  const gueltig = alleRunden.filter((r) => r.gueltig && r.punkte.length > 10);
  const zeiten = gueltig.map((r) => r.zeit);
  const besteRunde = gueltig.reduce<Runde | null>((b, r) => (!b || r.zeit < b.zeit ? r : b), null);
  const beste = besteRunde?.zeit ?? null;
  const schnitt = zeiten.length ? zeiten.reduce((a, b) => a + b, 0) / zeiten.length : null;

  // Konstanz: Streuung der Rundenzeiten ohne Ausreißer (z. B. Verkehr, Dreher: mehr als 7 % über der Bestzeit)
  let konstanz: number | null = null;
  if (beste != null) {
    const normal = zeiten.filter((z) => z <= beste * 1.07);
    if (normal.length >= 3) {
      const m = normal.reduce((a, b) => a + b, 0) / normal.length;
      konstanz = Math.sqrt(normal.reduce((s, z) => s + (z - m) ** 2, 0) / normal.length);
    }
  }

  // Kurven aus der Bestzeit; Abschnitte = Grenzen der Kurven (lückenlos über die Runde)
  const spuren = new Map<Runde, Spur>(gueltig.map((r) => [r, abtasten(r.punkte)]));
  const ref = besteRunde ? spuren.get(besteRunde)! : null;
  const kurven = ref ? kurvenFinden(ref, laengeM) : [];

  // Ideal-Runde: je Abschnitt die beste Zeit aus allen gültigen Runden
  let ideal: number | null = null;
  if (ref && gueltig.length >= 2 && kurven.length) {
    const grenzen = [...new Set([0, ...kurven.map((k) => k.start), kurven[kurven.length - 1].ende, RASTER])].sort((a, b) => a - b);
    ideal = 0;
    for (let j = 0; j + 1 < grenzen.length; j++) {
      let min = Infinity;
      for (const s of spuren.values()) min = Math.min(min, s.t[grenzen[j + 1]] - s.t[grenzen[j]]);
      ideal += min;
    }
    if (!(ideal > 0) || ideal > (beste ?? Infinity) + 0.001) ideal = beste;
  }

  // Wo du im Schnitt Zeit lässt: jede gültige Runde gegen die Bestzeit, Kurve für Kurve
  const summe = new Map<number, { verlust: number; n: number; tipps: Map<string, number> }>();
  if (ref) {
    for (const r of gueltig) {
      if (r === besteRunde) continue;
      const v = vergleichen(ref, spuren.get(r)!, laengeM);
      for (const b of v.alle) {
        const e = summe.get(b.kurve.nr) ?? { verlust: 0, n: 0, tipps: new Map<string, number>() };
        e.verlust += b.verlust;
        e.n++;
        if (b.verlust > 0.04) e.tipps.set(b.tipp, (e.tipps.get(b.tipp) ?? 0) + b.verlust);
        summe.set(b.kurve.nr, e);
      }
    }
  }
  const kurvenSchnitt: KurvenSchnitt[] = kurven
    .map((k) => {
      const e = summe.get(k.nr);
      const tipp = e ? [...e.tipps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "" : "";
      return { kurve: k, meter: (k.scheitel / RASTER) * laengeM, schnitt: e && e.n ? e.verlust / e.n : 0, tipp, runden: e?.n ?? 0 };
    })
    .sort((a, b) => b.schnitt - a.schnitt);

  // Sprit und Boxenstopps (Einfahrt und Ausfahrt zählen als ein Stopp)
  const sprit = verbrauchProRunde(alleRunden, 1000);
  let stopps = 0;
  for (let i = 0; i < alleRunden.length; i++) if (alleRunden[i].inBox && !alleRunden[i - 1]?.inBox) stopps++;

  // Zweikämpfe mit Namen
  const name = (idx: number) => {
    const f = fahrer.find((x) => x.idx === idx);
    if (!f) return `Auto ${idx}`;
    return f.nummer ? `#${f.nummer} ${f.name}` : f.name;
  };
  const typisch = schnitt ?? beste ?? 90;
  const kaempfe = (beob?.alleKaempfe() ?? [])
    .map((k) => ({ ...k, name: name(k.idx), dauerRunden: Math.max(1, Math.round((k.bis - k.von) / typisch)) }))
    .sort((a, b) => b.bis - b.von - (a.bis - a.von));

  // Kurz gesagt – in der Reihenfolge, in der ein Renningenieur es sagen würde
  const saetze: string[] = [];
  if (!gueltig.length) {
    saetze.push(alleRunden.length ? "Noch keine gültige Runde – für einen Bericht brauche ich mindestens eine saubere Runde." : "Fahr ein paar Runden – danach bekommst du hier deinen Bericht.");
  } else {
    saetze.push(`${gueltig.length} gültige ${gueltig.length === 1 ? "Runde" : "Runden"}${alleRunden.length > gueltig.length ? ` von ${alleRunden.length}` : ""}, Bestzeit ${rundenzeitText(beste)}.`);
  }
  if (beob?.startPlatz != null && beob.platz != null) {
    const diff = beob.startPlatz - beob.platz;
    if (diff > 0) saetze.push(`Von Platz ${beob.startPlatz} auf Platz ${beob.platz} – ${diff} ${diff === 1 ? "Platz" : "Plätze"} gutgemacht. Stark!`);
    else if (diff < 0) saetze.push(`Von Platz ${beob.startPlatz} auf Platz ${beob.platz} – ${-diff} ${diff === -1 ? "Platz" : "Plätze"} verloren. Schauen wir, wo.`);
    else saetze.push(`Platz ${beob.platz} gehalten.`);
  }
  if (konstanz != null) {
    if (konstanz < 0.3) saetze.push(`Sehr konstant: Deine Runden lagen nur ±${zahl(konstanz, 2)} s auseinander.`);
    else if (konstanz < 0.7) saetze.push(`Ordentlich konstant (±${zahl(konstanz, 2)} s). Da geht noch etwas – gleichmäßige Runden bringen im Rennen oft mehr als eine schnelle.`);
    else saetze.push(`Deine Rundenzeiten schwankten um ±${zahl(konstanz, 2)} s. Konstanz ist dein größter Hebel – fahr lieber zehn saubere Runden als eine schnelle.`);
  }
  if (ideal != null && beste != null && beste - ideal >= 0.05) {
    saetze.push(`Aus deinen besten Abschnitten ergibt sich eine Ideal-Runde von ${rundenzeitText(ideal)} – ${zahl(beste - ideal, 2)} s schneller als deine Bestzeit. Die Zeit steckt schon in dir.`);
  }
  const top = kurvenSchnitt.find((k) => k.schnitt > 0.03);
  if (top) {
    saetze.push(`Im Schnitt lässt du am meisten in Kurve ${top.kurve.nr} liegen (Ø ${zahl(top.schnitt, 2)} s pro Runde).${top.tipp ? ` ${top.tipp}` : ""}`);
  }
  for (const k of kaempfe.slice(0, 3)) {
    const runden = `etwa ${k.dauerRunden} ${k.dauerRunden === 1 ? "Runde" : "Runden"}`;
    // Beim Überholen ist der Abstand zwangsläufig null – dann nur die Dauer nennen
    let satz = `Zweikampf mit ${k.name} (${k.ueberholungen.length ? runden : `${runden}, knappster Abstand ${zahl(k.minAbstand, 1)} s`})`;
    if (!k.ueberholungen.length) satz += ": Reihenfolge gehalten.";
    else {
      const teile = k.ueberholungen.slice(0, 3).map((u) => `${u.ichVorbei ? "vorbei" : "überholt worden"} ${stelleText(Math.round(u.anteil * RASTER), kurven)}`);
      satz += `: ${teile.join(", dann ")}.`;
    }
    saetze.push(satz);
  }
  if (sprit != null) saetze.push(`Verbrauch im Schnitt ${zahl(sprit, 2)} l pro Runde${stopps ? `, ${stopps} ${stopps === 1 ? "Boxenstopp" : "Boxenstopps"}` : ""}.`);

  return {
    runden: alleRunden.length,
    gueltig: gueltig.length,
    beste,
    ideal,
    schnitt,
    konstanz,
    sprit,
    stopps,
    startPlatz: beob?.startPlatz ?? null,
    endPlatz: beob?.platz ?? null,
    kurven: kurvenSchnitt,
    kaempfe,
    saetze,
  };
}
