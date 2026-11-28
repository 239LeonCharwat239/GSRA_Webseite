// Boxenstopp per Zuruf (Wunsch 28./29.11.): „Box: 20 Liter, vier neue Reifen, kein Fast Repair“ – die App versteht den
// Satz (Deutsch und Englisch), stellt die Box in iRacing ein (boxenfunk.rs, offizielle SDK-Befehle) und sagt ehrlich,
// ob sich das lohnt: wie viel Sprit bis ins Ziel nötig ist, ob er reicht, was ein Stopp ungefähr kostet.
// Alles ohne KI (sofort, kostenlos); Fragen wie „Wie viel soll ich nachtanken?“ beantwortet die Empfehlung.

export type BoxArt = "alles_loeschen" | "scheibe" | "tanken" | "reifen_vl" | "reifen_vr" | "reifen_hl" | "reifen_hr"
  | "keine_reifen" | "fast_repair" | "keine_scheibe" | "kein_fast_repair" | "nicht_tanken";
export type BoxBefehl = { art: BoxArt; wert?: number };
export type SpritWunsch = { art: "liter"; liter: number } | { art: "voll" } | { art: "noetig" } | { art: "kein" };
export type BoxWunsch = { befehle: BoxBefehl[]; sprit: SpritWunsch | null; reifen: Array<"vl" | "vr" | "hl" | "hr"> | "keine" | null; fastRepair: boolean | null; scheibe: boolean | null; loeschen: boolean };

/** Lage für die Empfehlung (alles optional – was fehlt, wird nicht behauptet) */
export type BoxLage = {
  sprit: number | null; verbrauch: number | null; rundenzeit: number | null; anteil: number | null;
  restZeit: number | null; restRunden: number | null; tank: number | null; boxVerlust: number | null;
};

const FRAGE = /^\s*(hey\s+\w+[,!]?\s*)?(wie\s*viel|wieviel|wie\s+lange|reicht|soll\s+ich|muss\s+ich|brauch\w*\s+ich|lohnt|was\s+(meinst|sagst|empfiehlst)|how\s+much|do\s+i\s+need|should\s+i|is\s+it\s+worth|will\s+.*\s+last)/i;
const BOX_THEMA = /\b(box\w*|pit\w*|tank\w*|sprit|benzin|fuel|liter\w*|litre\w*|reifen|tyres?|tires?|fast\s*-?\s*repair|schnellreparatur|scheibe|abreißfolie|abreissfolie|tear\s*-?\s*off\w*|windscreen|windshield)\b/i;

const AUFTRAG = /\b(box\w*|pit\w*|stell\w*|einstell\w*|wechsel\w*|neue\w*|nimm|gib|mach\w*|(nach)?tank\w*|liter\w*|litre\w*|voll\w*|fast\s*-?\s*repair|schnellreparatur|scheibe|abrei\w*|tear|change|new|set|fill|give|put|keine?n?|ohne|no|clear|reset)\b/i;

/** Versteht einen Box-Zuruf; null = kein Box-Befehl (z. B. eine Frage oder ein anderes Thema) */
export function boxWunschLesen(text: string): BoxWunsch | null {
  const t = text.toLowerCase().replace(/[„“"!?]/g, " ").replace(/\s+/g, " ");
  // Nur echte Aufträge („Box: neue Reifen“), keine Feststellungen („meine Reifen sind kaputt“) und keine Fragen
  if (!BOX_THEMA.test(t) || !AUFTRAG.test(t) || FRAGE.test(t)) return null;
  const w: BoxWunsch = { befehle: [], sprit: null, reifen: null, fastRepair: null, scheibe: null, loeschen: false };

  if (/\b(box|pit)\w*\s+(zurücksetzen|löschen|leeren|leer|reset)|alles\s+(löschen|zurücksetzen|raus)|clear\s+(all|the\s+pit|pit)/.test(t)) w.loeschen = true;

  // Sprit
  const liter = t.match(/(\d+(?:[.,]\d+)?)\s*(l\b|liter\w*|litre\w*|liters?)/);
  if (/\b(nicht|kein\w*|ohne)\s+(nach)?tank\w*|\bkein(en)?\s+(sprit|benzin)|\bno\s+fuel|don'?t\s+(re)?fuel/.test(t)) w.sprit = { art: "kein" };
  else if (liter) w.sprit = { art: "liter", liter: Math.round(Number(liter[1].replace(",", "."))) };
  else if (/voll\s*tank|tank\s+voll|\bvoll\b|full\s+tank|fill\s+(it\s+|her\s+)?up|\bfull\s+fuel/.test(t)) w.sprit = { art: "voll" };
  else if (/so\s*viel\s+wie\s+nötig|was\s+nötig\s+ist|bis\s+ins\s+ziel|bis\s+zum\s+ende|genug\s+(sprit\s+)?(bis|für)|enough\s+(fuel\s+)?to\s+(finish|the\s+end)|what\s+we\s+need|to\s+the\s+end|\b(nach)?tanken\b|\bfuel\b/.test(t)) w.sprit = { art: "noetig" };

  // Reifen
  if (/\b(keine|ohne)\s+(neuen\s+)?reifen|reifen\s+(drauf\s+)?(lassen|bleiben)|\bno\s+(new\s+)?(tyres|tires)|keep\s+the\s+(tyres|tires)/.test(t)) w.reifen = "keine";
  else if (/reifen|tyres?|tires?/.test(t)) {
    const vorne = /\bvorne?\b|vorder|\bfront/.test(t), hinten = /\bhinten\b|hinter|\brear/.test(t);
    const links = /\blinks\b|\bleft/.test(t), rechts = /\brechts\b|\bright/.test(t);
    const alle: Array<"vl" | "vr" | "hl" | "hr"> = ["vl", "vr", "hl", "hr"];
    let r = alle;
    if (vorne && !hinten) r = r.filter((x) => x.startsWith("v"));
    if (hinten && !vorne) r = r.filter((x) => x.startsWith("h"));
    if (links && !rechts) r = r.filter((x) => x.endsWith("l"));
    if (rechts && !links) r = r.filter((x) => x.endsWith("r"));
    w.reifen = r;
  }

  // Fast Repair und Scheibe (Verneinung zuerst)
  if (/\b(kein\w*|ohne|nicht)\s+(den\s+|die\s+)?(fast\s*-?\s*repair|schnellreparatur)|(fast\s*-?\s*repair|schnellreparatur)\s+(aus|nein|weg|nicht)|\bno\s+fast\s*-?\s*repair/.test(t)) w.fastRepair = false;
  else if (/fast\s*-?\s*repair|schnellreparatur/.test(t)) w.fastRepair = true;
  if (/\b(keine|ohne)\s+(scheibe|abrei(ß|ss)folie)|\bno\s+tear\s*-?\s*off/.test(t)) w.scheibe = false;
  else if (/scheibe|abrei(ß|ss)folie|tear\s*-?\s*off|windscreen|windshield/.test(t)) w.scheibe = true;

  if (!w.loeschen && !w.sprit && !w.reifen && w.fastRepair == null && w.scheibe == null) return null;
  return w;
}

/** Wie viel Sprit bis ins Ziel? (Runden bis zur Zielflagge, nötige Liter inkl. halber Runde Reserve) */
export function spritBisZiel(l: BoxLage): { runden: number; noetig: number; fehlt: number; passt: number | null } | null {
  if (!l.verbrauch || l.verbrauch <= 0 || l.sprit == null) return null;
  const anteil = Math.min(1, Math.max(0, l.anteil ?? 0));
  let runden: number | null = null;
  if (l.restRunden != null && l.restRunden >= 0 && l.restRunden < 10_000) runden = l.restRunden + (1 - anteil);
  else if (l.restZeit != null && l.restZeit >= 0 && l.rundenzeit && l.rundenzeit > 10) {
    // Zeitrennen: nach Ablauf der Zeit wird die laufende Runde noch zu Ende gefahren
    runden = Math.ceil(anteil + l.restZeit / l.rundenzeit) - anteil;
  }
  if (runden == null || !Number.isFinite(runden)) return null;
  const noetig = (runden + 0.5) * l.verbrauch;
  const fehlt = Math.max(0, Math.ceil(noetig - l.sprit));
  const passt = l.tank != null ? Math.max(0, Math.floor(l.tank - l.sprit)) : null;
  return { runden: Math.round(runden * 10) / 10, noetig: Math.round(noetig * 10) / 10, fehlt, passt };
}

const z = (x: number, en: boolean) => (en ? String(x) : String(x).replace(".", ","));

/** Befehle für iRacing aus dem Wunsch; Sprit „nötig“/„voll“ wird hier ausgerechnet */
export function boxBefehle(w: BoxWunsch, l: BoxLage): { befehle: BoxBefehl[]; liter: number | null } {
  const befehle: BoxBefehl[] = [];
  let liter: number | null = null;
  if (w.loeschen) befehle.push({ art: "alles_loeschen" });
  if (w.sprit?.art === "kein") befehle.push({ art: "nicht_tanken" });
  else if (w.sprit) {
    const b = spritBisZiel(l);
    const platz = l.tank != null && l.sprit != null ? Math.max(0, Math.floor(l.tank - l.sprit)) : null;
    liter = w.sprit.art === "liter" ? w.sprit.liter : w.sprit.art === "voll" ? platz ?? 300 : b ? b.fehlt : null;
    if (liter != null) {
      liter = Math.max(0, Math.min(300, platz != null ? Math.min(liter, platz) : liter));
      befehle.push({ art: "tanken", wert: liter });
    }
  }
  if (w.reifen === "keine") befehle.push({ art: "keine_reifen" });
  else if (w.reifen) {
    if (w.reifen.length < 4) befehle.push({ art: "keine_reifen" }); // nur die genannten Reifen
    for (const r of w.reifen) befehle.push({ art: `reifen_${r}` as BoxArt });
  }
  if (w.fastRepair === true) befehle.push({ art: "fast_repair" });
  if (w.fastRepair === false) befehle.push({ art: "kein_fast_repair" });
  if (w.scheibe === true) befehle.push({ art: "scheibe" });
  if (w.scheibe === false) befehle.push({ art: "keine_scheibe" });
  return { befehle, liter };
}

/** Rückmeldung am Funk: was eingestellt ist – und ehrlich, ob es sich lohnt (Deutsch oder Englisch) */
export function boxAntwort(w: BoxWunsch, l: BoxLage, liter: number | null, en: boolean): string {
  const teile: string[] = [];
  if (w.loeschen) teile.push(en ? "pit settings cleared" : "Box zurückgesetzt");
  if (w.sprit?.art === "kein") teile.push(en ? "no fuel" : "kein Sprit");
  else if (w.sprit && liter != null) teile.push(en ? `${liter} litres of fuel` : `${liter} Liter`);
  else if (w.sprit) teile.push(en ? "fuel: I don't know your consumption yet – say an amount" : "Sprit: Deinen Verbrauch kenne ich noch nicht – sag mir eine Menge");
  if (w.reifen === "keine") teile.push(en ? "no tyres" : "keine Reifen");
  else if (w.reifen) {
    const namen = en ? { vl: "front left", vr: "front right", hl: "rear left", hr: "rear right" } : { vl: "vorne links", vr: "vorne rechts", hl: "hinten links", hr: "hinten rechts" };
    teile.push(w.reifen.length === 4 ? (en ? "four new tyres" : "vier neue Reifen")
      : w.reifen.length === 2 && w.reifen.every((x) => x.startsWith("v")) ? (en ? "front tyres" : "Reifen vorne")
      : w.reifen.length === 2 && w.reifen.every((x) => x.startsWith("h")) ? (en ? "rear tyres" : "Reifen hinten")
      : `${en ? "tyres" : "Reifen"} ${w.reifen.map((x) => namen[x]).join(", ")}`);
  }
  if (w.fastRepair === true) teile.push("Fast Repair");
  if (w.fastRepair === false) teile.push(en ? "no fast repair" : "kein Fast Repair");
  if (w.scheibe === true) teile.push(en ? "tear-off" : "Scheibe");
  if (w.scheibe === false) teile.push(en ? "no tear-off" : "keine Scheibe");
  const satz = `${en ? "Box is set" : "Box ist eingestellt"}: ${teile.join(", ")}.`;
  return [satz, empfehlung(l, en, liter)].filter(Boolean).join(" ");
}

/** Ehrlicher Rat: reicht der Sprit, lohnt der Stopp, was kostet er ungefähr */
export function empfehlung(l: BoxLage, en: boolean, liter: number | null = null): string | null {
  const b = spritBisZiel(l);
  if (!b) return null;
  const kosten = l.boxVerlust != null && l.boxVerlust > 5 ? (en ? ` A stop costs you about ${Math.round(l.boxVerlust)} seconds.` : ` Ein Stopp kostet dich etwa ${Math.round(l.boxVerlust)} Sekunden.`) : "";
  if (b.fehlt <= 0) {
    const reserve = Math.max(0, Math.floor((l.sprit ?? 0) - b.noetig + 0.5 * (l.verbrauch ?? 0)));
    return en
      ? `Honestly, you don't need fuel: it lasts to the flag with about ${reserve} litres to spare.${kosten} I wouldn't stop just for fuel.`
      : `Ehrlich gesagt brauchst du keinen Sprit: Er reicht bis ins Ziel, etwa ${reserve} Liter bleiben übrig.${kosten} Nur zum Tanken würde ich nicht reinkommen.`;
  }
  const zuWenig = liter != null && liter < b.fehlt;
  const zuViel = liter != null && liter > b.fehlt + Math.max(2, (l.verbrauch ?? 0) * 1.5);
  const tankZuKlein = b.passt != null && b.fehlt > b.passt;
  const basis = en
    ? `To the flag you need about ${b.fehlt} more litres (${z(b.runden, true)} laps).`
    : `Bis ins Ziel brauchst du noch etwa ${b.fehlt} Liter (${z(b.runden, false)} Runden).`;
  const hinweis = tankZuKlein
    ? (en ? ` That doesn't fit in one stop – you'll need two, or save fuel.` : ` Das passt nicht in einen Stopp – entweder zweimal rein oder Sprit sparen.`)
    : zuWenig ? (en ? ` ${liter} litres won't be enough.` : ` ${liter} Liter reichen dafür nicht.`)
    : zuViel ? (en ? ` ${liter} litres is more than you need – extra weight costs time.` : ` ${liter} Liter sind mehr als nötig – das Gewicht kostet Zeit.`)
    : "";
  return `${basis}${hinweis}${kosten}`;
}

/** Was ist gerade in der Box eingestellt? (PitSvFlags / PitSvFuel aus iRacing) */
export function boxStand(haken: number | null | undefined, sprit: number | null | undefined, en: boolean): string | null {
  if (haken == null) return null;
  const reifen = [0x01, 0x02, 0x04, 0x08].filter((b) => haken & b).length;
  const teile = [
    haken & 0x10 ? (en ? `${Math.round(sprit ?? 0)} litres` : `${Math.round(sprit ?? 0)} Liter`) : en ? "no fuel" : "kein Sprit",
    reifen === 4 ? (en ? "four tyres" : "vier Reifen") : reifen ? (en ? `${reifen} tyres` : `${reifen} Reifen`) : en ? "no tyres" : "keine Reifen",
    haken & 0x40 ? "Fast Repair" : null,
    haken & 0x20 ? (en ? "tear-off" : "Scheibe") : null,
  ].filter(Boolean);
  return `${en ? "Currently in the box" : "In der Box eingestellt"}: ${teile.join(", ")}.`;
}

const STAND_FRAGE = /was\s+(ist|steht)\s+(in\s+der\s+box|eingestellt)|box\s*-?\s*(stand|status|einstellung)|what('?s| is)\s+(set|selected)\s+(in\s+the\s+)?(pit|box)|pit\s+(status|settings)/i;
const SPRIT_FRAGE = /(wie\s*viel|wieviel).*(nach)?tank|(wie\s*viel|wieviel)\s+sprit\s+(brauch|fehlt)|soll\s+ich\s+(nach)?tanken|reicht\s+(der|mein)\s+sprit|brauch\w*\s+ich\s+sprit|lohnt\s+sich\s+(ein\s+)?(stopp|boxenstopp|tanken)|how\s+much\s+fuel|do\s+i\s+need\s+fuel|should\s+i\s+(pit|box|refuel)|is\s+(a\s+)?(stop|pit)\s+worth/i;

/** Fragen zur Box, die die App selbst beantwortet: Stand der Box oder Sprit-Empfehlung; null = keine solche Frage */
export function boxFrage(text: string): "stand" | "sprit" | null {
  if (STAND_FRAGE.test(text)) return "stand";
  if (SPRIT_FRAGE.test(text)) return "sprit";
  return null;
}

/** Was ein Boxenstopp kostet – gemessen an deinen eigenen Stopps: Einfahrts- und Ausfahrtsrunde gegen eine normale Runde.
 *  null = noch kein Stopp in dieser Sitzung (dann wird nichts behauptet). */
export function boxVerlustMessen(runden: Array<{ zeit: number; inBox: boolean; gueltig: boolean }>): number | null {
  const sauber = runden.filter((r) => r.gueltig && !r.inBox).map((r) => r.zeit).sort((a, b) => a - b);
  if (sauber.length < 2) return null;
  const normal = sauber[Math.floor(sauber.length / 2)];
  const verluste: number[] = [];
  let gruppe: number[] = [];
  for (const r of [...runden, null]) {
    if (r && r.inBox) { gruppe.push(r.zeit); continue; }
    if (gruppe.length) {
      const v = gruppe.reduce((a, b) => a + b, 0) - gruppe.length * normal;
      if (v > 5 && v < 300) verluste.push(v);
      gruppe = [];
    }
  }
  return verluste.length ? Math.round(verluste.reduce((a, b) => a + b, 0) / verluste.length) : null;
}

/** Englisch oder Deutsch? „Box“ und „Fast Repair“ sagen beide – entscheidend sind die übrigen Wörter */
export function boxEnglisch(text: string): boolean {
  const de = /\b(liter|reifen|tank\w*|nachtank\w*|kein\w*|sprit|vier|vorne|hinten|neue\w*|bitte|und|nicht|ohne|scheibe|voll\w*|wie|soll)\b|[äöüß]/i.test(text);
  const en = /\b(litres?|tyres?|tires?|fuel|pit|new|four|front|rear|clear|please|and|how|should)\b/i.test(text);
  return en && !de;
}
