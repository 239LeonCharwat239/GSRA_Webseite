// Sprit sparen mit Lift & Coast (Wunsch 25.11.): „Ich möchte Sprit sparen“ → der Renningenieur erklärt, wo du
// früher vom Gas gehst, und sagt nach jeder Runde ehrlich, ob es reicht und was es kostet.
//
//  * Basis: Verbrauch und Rundenzeit der letzten sauberen Runden VOR dem Sparen.
//  * Rollstrecke: Meter, auf denen weder Gas noch Bremse gegeben wird (über 60 km/h) – das ist Lift & Coast.
//  * Wo es sich lohnt: vor den Bremspunkten mit dem höchsten Tempo (dort spart früheres Gas-Wegnehmen am meisten
//    Sprit und kostet am wenigsten Zeit). Faustregel: etwa eine Sekunde vor dem Bremspunkt vom Gas.
import type { Runde } from "./runden.ts";

export type SparBasis = { verbrauch: number; zeit: number; rollM: number; runden: number };
export type Bremspunkt = { a: number; meter: number; tempoKmh: number; liftM: number };
export type SparAuswertung = {
  runde: number;
  verbrauch: number;
  /** Anteil gespart gegenüber der Basis (0,05 = 5 %) – negativ = mehr verbraucht */
  ersparnis: number;
  /** Sekunden langsamer als die Basis (negativ = schneller); null bei ungültiger Runde */
  zeitVerlust: number | null;
  rollM: number;
  ziel: number;
  erreicht: boolean;
};

const MIN_TEMPO = 60 / 3.6;

const sauber = (r: Runde) => r.gueltig && !r.inBox && r.sprit != null && r.sprit > 0 && r.punkte.length > 10;

/** Meter ohne Gas und ohne Bremse (über 60 km/h) in einer Runde */
export function rollMeter(r: Runde, laengeM: number): number {
  let m = 0;
  for (let i = 1; i < r.punkte.length; i++) {
    const p = r.punkte[i], q = r.punkte[i - 1];
    const da = p.a - q.a;
    if (!(da > 0) || da > 0.02) continue; // Sprung (Start/Ziel, Datenlücke) nicht mitzählen
    if (p.g < 0.05 && p.b < 0.05 && q.g < 0.05 && q.b < 0.05 && p.v > MIN_TEMPO) m += da * laengeM;
  }
  return m;
}

/** Basis aus den letzten sauberen Runden vor dem Sparen */
export function sparBasis(runden: Runde[], laengeM: number, anzahl = 3): SparBasis | null {
  const liste = runden.filter(sauber).slice(-anzahl);
  if (!liste.length) return null;
  const schnitt = (f: (r: Runde) => number) => liste.reduce((s, r) => s + f(r), 0) / liste.length;
  return { verbrauch: schnitt((r) => r.sprit as number), zeit: schnitt((r) => r.zeit), rollM: schnitt((r) => rollMeter(r, laengeM)), runden: liste.length };
}

/** Empfohlene Strecke vor dem Bremspunkt: etwa eine Sekunde Rollen, auf 5 m gerundet (mindestens 20 m) */
export const liftMeter = (tempoKmh: number) => Math.max(20, Math.round(tempoKmh / 3.6 / 5) * 5);

/** Die Bremspunkte mit dem höchsten Tempo – dort lohnt sich Lift & Coast am meisten */
export function bremspunkte(r: Runde, laengeM: number, anzahl = 3): Bremspunkt[] {
  const kandidaten: Bremspunkt[] = [];
  for (let i = 1; i < r.punkte.length; i++) {
    const p = r.punkte[i], q = r.punkte[i - 1];
    if (!(q.b < 0.2 && p.b >= 0.2)) continue;
    // Tempo kurz vor dem Bremsen (höchster Wert der letzten Punkte)
    let tempo = 0;
    for (let k = Math.max(0, i - 6); k <= i; k++) tempo = Math.max(tempo, r.punkte[k].v);
    const tempoKmh = tempo * 3.6;
    if (tempoKmh < 90) continue;
    const nah = kandidaten.find((x) => Math.abs(x.a - p.a) < 0.03);
    if (nah) { if (tempoKmh > nah.tempoKmh) Object.assign(nah, { a: p.a, meter: p.a * laengeM, tempoKmh }); continue; }
    kandidaten.push({ a: p.a, meter: p.a * laengeM, tempoKmh, liftM: 0 });
  }
  return kandidaten.sort((x, y) => y.tempoKmh - x.tempoKmh).slice(0, anzahl)
    .map((b) => ({ ...b, tempoKmh: Math.round(b.tempoKmh), liftM: liftMeter(b.tempoKmh) }))
    .sort((x, y) => x.a - y.a);
}

/** Wie viele Meter wurde vor diesem Bremspunkt schon gerollt (in dieser Runde)? */
export function rollVor(r: Runde, b: Bremspunkt, laengeM: number, fensterM = 250): number {
  const von = b.a - fensterM / laengeM;
  let m = 0;
  for (let i = 1; i < r.punkte.length; i++) {
    const p = r.punkte[i], q = r.punkte[i - 1];
    if (p.a < von || p.a > b.a + 0.002) continue;
    const da = p.a - q.a;
    if (da > 0 && da <= 0.02 && p.g < 0.05 && p.b < 0.05 && q.g < 0.05 && p.v > MIN_TEMPO) m += da * laengeM;
  }
  return m;
}

/** Die Bremszone, an der in dieser Runde am meisten Rollen fehlt (dort setzt der nächste Tipp an) */
export function sparTipp(r: Runde, punkte: Bremspunkt[], laengeM: number): (Bremspunkt & { gerollt: number }) | null {
  let bester: (Bremspunkt & { gerollt: number }) | null = null;
  for (const b of punkte) {
    const gerollt = rollVor(r, b, laengeM);
    const fehlt = b.liftM - gerollt;
    if (fehlt > 10 && (!bester || fehlt > bester.liftM - bester.gerollt)) bester = { ...b, gerollt };
  }
  return bester;
}

/** Eine Runde im Spar-Modus bewerten */
export function sparAuswerten(r: Runde, basis: SparBasis, ziel: number, laengeM: number): SparAuswertung | null {
  if (r.inBox || r.sprit == null || !(r.sprit > 0) || !(basis.verbrauch > 0)) return null;
  const ersparnis = 1 - r.sprit / basis.verbrauch;
  return {
    runde: r.nr,
    verbrauch: r.sprit,
    ersparnis,
    zeitVerlust: r.gueltig ? r.zeit - basis.zeit : null,
    rollM: rollMeter(r, laengeM),
    ziel,
    erreicht: ersparnis >= ziel - 0.005,
  };
}

const prozent = (x: number) => `${(Math.round(x * 1000) / 10).toFixed(1).replace(".", ",")} %`;
const sek = (x: number) => `${Math.abs(x).toFixed(2).replace(".", ",")} s`;

/** Kurzer Funkspruch zur Spar-Runde (ohne KI) – nennt Ergebnis, Preis und den nächsten Schritt */
export function sparText(a: SparAuswertung, tipp: (Bremspunkt & { gerollt: number }) | null, stelle: (b: Bremspunkt) => string): string {
  const teile = [`Runde ${a.runde}: ${a.verbrauch.toFixed(2).replace(".", ",")} l`];
  teile.push(a.ersparnis >= 0 ? `${prozent(a.ersparnis)} gespart (Ziel ${prozent(a.ziel)})` : `${prozent(-a.ersparnis)} MEHR als vorher`);
  if (a.zeitVerlust != null) teile.push(a.zeitVerlust > 0.02 ? `${sek(a.zeitVerlust)} langsamer` : a.zeitVerlust < -0.02 ? `sogar ${sek(a.zeitVerlust)} schneller` : "ohne Zeitverlust");
  let satz = `${teile.join(", ")}.`;
  if (a.erreicht && a.ersparnis > a.ziel + 0.03 && (a.zeitVerlust ?? 0) > 0.3) {
    satz += " Du sparst mehr als nötig – lass etwas später rollen, das kostet weniger Zeit.";
  } else if (a.erreicht) {
    satz += " Ziel erreicht – genau so weiter.";
  } else if (tipp) {
    satz += ` Noch nicht genug: Geh ${stelle(tipp)} etwa ${tipp.liftM} m vor dem Bremspunkt vom Gas und lass rollen` +
      (tipp.gerollt >= 5 ? ` (bisher ${Math.round(tipp.gerollt)} m).` : ".");
  } else {
    satz += " Noch nicht genug: Geh vor den schnellen Bremszonen noch etwas früher vom Gas.";
  }
  return satz;
}
