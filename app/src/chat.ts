// Chat mit dem Renningenieur (Wunsch 25.11.): Rückfragen schreiben – im Rennen und danach.
//  * Einfache Fragen („Wer fährt vor mir?“) beantwortet er sofort (schnelles Modell).
//  * Schwierige Fragen („Warum verliere ich in Kurve 4 Zeit?“) wie ein echter Renningenieur: sofort „Wir schauen
//    uns das an“, einige Sekunden später die gründliche Antwort (stärkeres Modell mit Nachdenken).
//  * Ohne Anmeldung oder ohne Verbindung antwortet er auf einfache Fakten aus den Messwerten, ohne KI.
//  * Alles per textContent; der Verlauf bleibt nur in dieser Sitzung der App (wird nicht gespeichert).
import { kiFragen, kiVerfuegbar } from "./ki.ts";
import { ansage, nochDran, pruefenIn } from "./ansagen.ts";

export type ChatBeitrag = { wer: "fahrer" | "ingenieur"; text: string };
export type ChatUmgebung = {
  lage: () => Record<string, unknown>;
  angemeldet: () => boolean;
  art: () => string;
  name: () => string;
  /** Antwort ohne KI auf einfache Fakten – null, wenn die Frage dafür nicht passt */
  lokal: (frage: string) => string | null;
  /** Sprache der Antwort (eingestellte Sprache; bei „Automatisch“ die Sprache der Frage) */
  sprache: (frage?: string) => string;
  /** wichtig = Crash, Strafe, Schaden: auch sprechen, wenn „Vorlesen“ aus ist, aber per Sprechtaste gefunkt wird */
  vorlesen: (text: string, wichtig?: boolean) => void;
  /** Die Antwort dauert: kurzer Zwischenspruch („Moment, ich schau nach.“) – nur sprechen, nicht in den Verlauf */
  warten?: (text: string) => void;
  /** „Ich möchte Sprit sparen“: Spar-Modus einschalten; gibt eine kurze Rückmeldung (oder null) */
  sparenStarten: () => string | null;
  /** Befehle, die die App selbst ausführt („Fahr eine Runde mit mir“, später Boxenstopp) – IMMER vor der KI
   *  (Fund 28.11.: mit KI ging der Befehl an die KI, die keinen Piepton hat); null = kein Befehl */
  befehl?: (frage: string) => string | null;
};

const SCHWIERIG = /\b(warum|wieso|weshalb|wie kann ich|wie werde ich|was mache ich|was mach ich|analys|vergleich|verbesser|strategie|setup|abstimmung|wo verliere|wo lasse|wo lass|erklär|schneller werden|besser werden|trail|reifenverschleiß|untersteuer|übersteuer)/i;
const SPAREN = /sprit\s*spar|spritspar|sparen|lift\s*(and|&|und)?\s*coast/i;

/** Braucht die Frage eine gründliche Analyse (dann „Wir schauen uns das an“ vorweg)? */
export function istSchwierig(frage: string): boolean {
  return SCHWIERIG.test(frage) || frage.trim().length > 110;
}
export const willSparen = (frage: string) => SPAREN.test(frage);

const PRUEF_SAETZE: Record<string, string[]> = {
  kumpel: ["Moment, ich schau mir das kurz an.", "Ich guck mir die Daten an, gib mir ein paar Sekunden.", "Verstanden, wir prüfen das."],
  profi: ["Verstanden. Wir prüfen das.", "Copy. Ich analysiere die Daten.", "Verstanden, Rückmeldung folgt."],
  motivator: ["Ich check das sofort für dich!", "Bin dran, gleich weißt du mehr!", "Moment, ich hol dir die Antwort!"],
  knapp: ["Copy. Prüfe.", "Moment.", "Prüfe."],
  locker: ["Sekunde, ich check das kurz.", "Yo, ich schau mir das an – gib mir 'nen Moment.", "Okay, ich digg mich kurz in die Daten."],
};

/** Alle „Wir schauen uns das an“-Sätze einer Art (für die eigene Stimme vorab erzeugt) */
export function pruefSaetze(art: string): string[] {
  return PRUEF_SAETZE[art] ?? PRUEF_SAETZE.kumpel;
}

/** „Wir schauen uns das an“ – passend zur Art des Renningenieurs, mit etwas Abwechslung */
export function pruefSatz(art: string, zufall = Math.random()): string {
  const liste = pruefSaetze(art);
  return liste[Math.min(liste.length - 1, Math.floor(zufall * liste.length))];
}

export class Chat {
  private readonly verlauf: ChatBeitrag[] = [];
  private laeuft = 0;

  private readonly liste: HTMLElement;
  private readonly u: ChatUmgebung;

  constructor(liste: HTMLElement, u: ChatUmgebung) {
    this.liste = liste;
    this.u = u;
  }

  private blase(b: ChatBeitrag, klasse = ""): HTMLElement {
    const el = document.createElement("div");
    el.className = `chat-beitrag ${b.wer}${klasse ? ` ${klasse}` : ""}`;
    const wer = document.createElement("span");
    wer.className = "chat-wer";
    wer.textContent = b.wer === "fahrer" ? "Du" : this.u.name();
    const text = document.createElement("p");
    text.textContent = b.text;
    el.append(wer, text);
    this.liste.append(el);
    this.liste.scrollTop = this.liste.scrollHeight;
    return el;
  }

  private sagen(text: string, klasse = "", wichtig = false) {
    const b: ChatBeitrag = { wer: "ingenieur", text };
    this.verlauf.push(b);
    this.blase(b, klasse);
    this.u.vorlesen(text, wichtig);
  }

  leeren() {
    this.verlauf.length = 0;
    this.liste.replaceChildren();
  }

  /** Der Renningenieur meldet sich von selbst (z. B. mit der Nachbesprechung nach der Sitzung) */
  melden(text: string, klasse = "", wichtig = false) {
    this.sagen(text, klasse, wichtig);
  }

  async senden(eingabe: string): Promise<void> {
    // Zeilen bleiben erhalten (mehrzeilige Eingabe); bis etwa 1.000 Wörter
    const frage = eingabe.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 7000);
    if (frage.length < 2) return;
    const nr = ++this.laeuft;
    const vorher = this.verlauf.slice(-8);
    this.verlauf.push({ wer: "fahrer", text: frage });
    this.blase({ wer: "fahrer", text: frage });

    const befehl = this.u.befehl?.(frage) ?? null;
    if (befehl) {
      this.sagen(befehl);
      return;
    }

    let sparHinweis: string | null = null;
    if (willSparen(frage)) sparHinweis = this.u.sparenStarten();

    const code = this.u.sprache(frage);
    const ohneKi = () => this.u.lokal(frage) ?? sparHinweis ?? ansage(code, this.u.angemeldet() ? "keineKi" : "anmelden");
    if (!this.u.angemeldet() || !kiVerfuegbar()) {
      this.sagen(ohneKi());
      return;
    }

    const schwierig = istSchwierig(frage);
    let wartet: HTMLElement | null = null;
    if (schwierig) this.sagen((code === "de" ? null : pruefenIn(code)) ?? pruefSatz(this.u.art()), "pruefen");
    else wartet = this.blase({ wer: "ingenieur", text: "…" }, "tippt");

    // Dauert es länger als 2,5 s, sagt er Bescheid (wie ein echter Renningenieur), nach 9 s noch einmal kurz
    const zwischen = code === "de" ? pruefSatz(this.u.art()) : pruefenIn(code) ?? pruefSatz(this.u.art());
    const uhren = [
      schwierig ? 0 : window.setTimeout(() => {
        if (wartet) wartet.querySelector("p")!.textContent = zwischen;
        this.u.warten?.(zwischen);
      }, 2500),
      window.setTimeout(() => this.u.warten?.(nochDran(code)), 9000),
    ];
    const e = await kiFragen(schwierig ? "analyse" : "frage", this.u.lage(), { frage, verlauf: vorher });
    uhren.forEach((u) => window.clearTimeout(u));
    wartet?.remove();
    if (nr !== this.laeuft && !schwierig) return; // überholt von einer neueren Frage
    if ("text" in e) this.sagen(e.text);
    else this.sagen(this.u.lokal(frage) ?? sparHinweis ?? ansage(code, e.grund === "einrichtung" ? "einrichtung" : "stoerung"));
  }
}
