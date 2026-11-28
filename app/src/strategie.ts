// Strategievorschläge (Wunsch 27.–29.11.): Wie viele Stopps, wann das Box-Fenster offen ist, ob Sprit sparen einen Stopp
// spart und wo du nach dem Stopp wieder rauskommst. Gerechnet aus deinem Verbrauch, der Restzeit bzw. den Restrunden,
// der Tankgröße und dem gemessenen Zeitverlust deiner Stopps – ohne KI, sofort. Sätze auf Deutsch oder Englisch.
import { spritBisZiel, type BoxLage } from "./boxenfunk.ts";

export type StrategieLage = BoxLage & { runde: number | null };

export type Plan = {
  /** Runden bis zur Zielflagge (ab jetzt, mit Bruchteil) */
  runden: number;
  /** fehlende Liter bis ins Ziel (inkl. halber Runde Reserve) */
  fehlt: number;
  stopps: number;
  /** erster Stopp: frühestens / spätestens am Ende dieser Runde (Rundennummern) */
  fensterVon: number | null;
  fensterBis: number | null;
  /** Liter beim (ersten) Stopp */
  liter: number | null;
  /** ohne Stopp ins Ziel: so viel pro Runde sparen (nur wenn höchstens 12 %) */
  sparenL: number | null;
  sparenProzent: number | null;
  /** Sparen lohnt sich, solange es pro Runde weniger kostet als dieser Wert (Stopp-Verlust / Runden) */
  sparenGrenzeS: number | null;
};

const RESERVE = 0.5; // Runden

export function planen(l: StrategieLage): Plan | null {
  const b = spritBisZiel(l);
  const v = l.verbrauch;
  if (!b || !v || v <= 0 || l.sprit == null || l.runde == null) return null;
  const s = l.sprit;
  const d0 = 1 - Math.min(1, Math.max(0, l.anteil ?? 0)); // bis zum Ende der laufenden Runde
  if (b.fehlt <= 0) return { runden: b.runden, fehlt: 0, stopps: 0, fensterVon: null, fensterBis: null, liter: null, sparenL: null, sparenProzent: null, sparenGrenzeS: null };
  const tank = l.tank;
  const nachfuellbar = tank ? Math.max(1, tank - RESERVE * v) : Infinity;
  const stopps = Math.max(1, Math.ceil(b.fehlt / nachfuellbar));
  // spätestens: bis dahin reicht der Sprit (mit Reserve); frühestens: danach passt der Rest in den Tank (nur bei 1 Stopp)
  const kMax = Math.floor((s - RESERVE * v) / v - d0);
  const kMin = stopps === 1 && tank ? Math.ceil(b.runden + RESERVE - tank / v - d0) : 0;
  const fensterBis = l.runde + Math.max(0, kMax);
  const fensterVon = Math.min(fensterBis, l.runde + Math.max(0, kMin));
  const liter = Math.min(b.fehlt, Number.isFinite(nachfuellbar) ? Math.floor(nachfuellbar) : b.fehlt);
  // Ohne Stopp: nötiger Verbrauch pro Runde, damit es mit Reserve reicht
  let sparenL: number | null = null, sparenProzent: number | null = null;
  if (stopps === 1) {
    const noetig = s / (b.runden + RESERVE);
    const spar = v - noetig;
    if (spar > 0 && spar / v <= 0.12) {
      sparenL = Math.round(spar * 100) / 100;
      sparenProzent = Math.round((spar / v) * 100);
    }
  }
  const sparenGrenzeS = sparenL != null && l.boxVerlust != null && b.runden > 0 ? Math.round((l.boxVerlust / b.runden) * 10) / 10 : null;
  return { runden: b.runden, fehlt: b.fehlt, stopps, fensterVon, fensterBis, liter, sparenL, sparenProzent, sparenGrenzeS };
}

export type Hintermann = { name: string; abstand: number };

/** Wo kommst du nach dem Stopp wieder raus? Abstände zu den Autos hinter dir in Sekunden */
export function wiedereinstieg(platz: number | null, hinter: Hintermann[], verlust: number | null): { platz: number; vor: Hintermann | null; hinter: Hintermann | null } | null {
  if (platz == null || verlust == null || verlust <= 0) return null;
  const sortiert = [...hinter].filter((h) => Number.isFinite(h.abstand) && h.abstand > 0).sort((a, b) => a.abstand - b.abstand);
  const davor = sortiert.filter((h) => h.abstand < verlust);
  const danach = sortiert.find((h) => h.abstand >= verlust) ?? null;
  return { platz: platz + davor.length, vor: davor.at(-1) ?? null, hinter: danach };
}

const z = (x: number, en: boolean) => (en ? String(x) : String(x).replace(".", ","));

/** Der Plan in einem Satz */
export function planSatz(p: Plan, en: boolean): string {
  if (p.stopps === 0) return en ? "Strategy: your fuel lasts to the flag – no stop needed." : "Strategie: Dein Sprit reicht bis ins Ziel – kein Stopp nötig.";
  const fenster = p.fensterVon != null && p.fensterBis != null
    ? p.fensterVon === p.fensterBis
      ? (en ? `box at the end of lap ${p.fensterBis}` : `Box am Ende von Runde ${p.fensterBis}`)
      : (en ? `pit window laps ${p.fensterVon} to ${p.fensterBis}` : `Box-Fenster Runde ${p.fensterVon} bis ${p.fensterBis}`)
    : "";
  const teil = p.stopps === 1
    ? (en ? `Strategy: one stop, ${fenster}, about ${p.liter} litres.` : `Strategie: ein Stopp, ${fenster}, etwa ${p.liter} Liter.`)
    : (en ? `Strategy: ${p.stopps} stops – first one at the latest at the end of lap ${p.fensterBis}.` : `Strategie: ${p.stopps} Stopps – der erste spätestens am Ende von Runde ${p.fensterBis}.`);
  const sparen = p.sparenL != null
    ? en
      ? ` Or save ${z(p.sparenL, true)} litres per lap (${p.sparenProzent} %) and run to the end without stopping${p.sparenGrenzeS != null ? ` – worth it as long as it costs you less than ${z(p.sparenGrenzeS, true)} seconds per lap` : ""}.`
      : ` Oder du sparst ${z(p.sparenL, false)} Liter pro Runde (${p.sparenProzent} %) und kommst ohne Stopp durch${p.sparenGrenzeS != null ? ` – lohnt sich, solange es dich weniger als ${z(p.sparenGrenzeS, false)} Sekunden pro Runde kostet` : ""}.`
    : "";
  return `${teil}${sparen}`;
}

export function wiedereinstiegSatz(w: NonNullable<ReturnType<typeof wiedereinstieg>>, en: boolean): string {
  const nach = w.hinter ? (en ? `, just ahead of ${w.hinter.name}` : `, knapp vor ${w.hinter.name}`) : "";
  const vor = w.vor ? (en ? ` – behind ${w.vor.name}` : ` – hinter ${w.vor.name}`) : "";
  return en ? `If you stop now, you come out around P${w.platz}${vor}${nach}.` : `Kommst du jetzt rein, kommst du etwa auf Platz ${w.platz} raus${vor}${nach}.`;
}

/** Meldet sich von selbst: Plan (einmal und wenn er sich ändert), Box-Fenster offen, letzte Runde zum Reinkommen */
export class StrategieWaechter {
  private planKennung = "";
  private gemeldet = new Set<string>();

  zuruecksetzen() {
    this.planKennung = "";
    this.gemeldet.clear();
  }

  /** nach jeder Runde; gibt die Ansagen zurück (meist keine) – wichtig = „diese Runde rein“ */
  pruefen(p: Plan | null, runde: number | null, en: boolean): Array<{ text: string; wichtig: boolean }> {
    if (!p || runde == null) return [];
    const raus: Array<{ text: string; wichtig: boolean }> = [];
    const kennung = `${p.stopps}|${p.fensterBis ?? ""}|${p.sparenL != null}`;
    // neuer Plan: erst ansagen, wenn er sich wirklich geändert hat (Fenster verschiebt sich um mehr als eine Runde)
    const alt = this.planKennung.split("|");
    const geaendert = !this.planKennung || alt[0] !== String(p.stopps) || Math.abs(Number(alt[1] || 0) - (p.fensterBis ?? 0)) > 1 || alt[2] !== String(p.sparenL != null);
    if (geaendert) {
      this.planKennung = kennung;
      raus.push({ text: planSatz(p, en), wichtig: false });
    }
    if (p.stopps > 0 && p.fensterVon != null && p.fensterBis != null) {
      if (runde >= p.fensterBis && !this.gemeldet.has(`muss${p.fensterBis}`)) {
        this.gemeldet.add(`muss${p.fensterBis}`);
        raus.push({ text: en ? `Box this lap – otherwise the fuel won't last.` : `Diese Runde musst du rein, sonst reicht der Sprit nicht.`, wichtig: true });
      } else if (runde >= p.fensterVon && runde < p.fensterBis && !this.gemeldet.has(`offen${p.fensterVon}`)) {
        this.gemeldet.add(`offen${p.fensterVon}`);
        raus.push({ text: en ? `Pit window is open – you can box any time until the end of lap ${p.fensterBis}.` : `Das Box-Fenster ist offen – du kannst ab jetzt rein, spätestens am Ende von Runde ${p.fensterBis}.`, wichtig: false });
      }
    }
    return raus;
  }
}

const STRATEGIE_FRAGE = /strategie|wann\s+(soll|muss)\s+ich\s+(rein|an\s+die\s+box|in\s+die\s+box|stoppen)|wie\s*viele\s+stopps|box-?fenster|(what'?s|what\s+is)\s+the\s+strategy|when\s+(should|do)\s+i\s+(pit|box|stop)|how\s+many\s+stops|pit\s+window/i;
/** „Was ist die Strategie?“, „Wann soll ich rein?“ – die App antwortet selbst */
export const istStrategieFrage = (text: string) => STRATEGIE_FRAGE.test(text);
