// Chat mit dem Renningenieur (Wunsch 25.11.): Rückfragen schreiben – im Rennen und danach.
//  * Einfache Fragen („Wer fährt vor mir?“) beantwortet er sofort (schnelles Modell).
//  * Schwierige Fragen („Warum verliere ich in Kurve 4 Zeit?“) wie ein echter Renningenieur: sofort „Wir schauen
//    uns das an“, einige Sekunden später die gründliche Antwort (stärkeres Modell mit Nachdenken).
//  * Ohne Anmeldung oder ohne Verbindung antwortet er auf einfache Fakten aus den Messwerten, ohne KI.
//  * Alles per textContent; der Verlauf bleibt nur in dieser Sitzung der App (wird nicht gespeichert).
import { kiFragen, kiVerfuegbar } from "./ki.ts";

export type ChatBeitrag = { wer: "fahrer" | "ingenieur"; text: string };
export type ChatUmgebung = {
  lage: () => Record<string, unknown>;
  angemeldet: () => boolean;
  art: () => string;
  name: () => string;
  /** Antwort ohne KI auf einfache Fakten – null, wenn die Frage dafür nicht passt */
  lokal: (frage: string) => string | null;
  vorlesen: (text: string) => void;
  /** „Ich möchte Sprit sparen“: Spar-Modus einschalten; gibt eine kurze Rückmeldung (oder null) */
  sparenStarten: () => string | null;
};

const SCHWIERIG = /\b(warum|wieso|weshalb|wie kann ich|wie werde ich|was mache ich|was mach ich|analys|vergleich|verbesser|strategie|setup|abstimmung|wo verliere|wo lasse|wo lass|erklär|schneller werden|besser werden|trail|reifenverschleiß|untersteuer|übersteuer)/i;
const SPAREN = /sprit\s*spar|spritspar|sparen|lift\s*(and|&|und)?\s*coast/i;

/** Braucht die Frage eine gründliche Analyse (dann „Wir schauen uns das an“ vorweg)? */
export function istSchwierig(frage: string): boolean {
  return SCHWIERIG.test(frage) || frage.trim().length > 110;
}
export const willSparen = (frage: string) => SPAREN.test(frage);

/** „Wir schauen uns das an“ – passend zur Art des Renningenieurs, mit etwas Abwechslung */
export function pruefSatz(art: string, zufall = Math.random()): string {
  const saetze: Record<string, string[]> = {
    kumpel: ["Moment, ich schau mir das kurz an.", "Gute Frage – ich guck mir die Daten an, gib mir ein paar Sekunden.", "Verstanden, wir prüfen das."],
    profi: ["Verstanden. Wir prüfen das.", "Copy. Ich analysiere die Daten.", "Verstanden, Rückmeldung folgt."],
    motivator: ["Starke Frage – ich check das sofort für dich!", "Bin dran, gleich weißt du mehr!", "Moment, ich hol dir die Antwort!"],
    knapp: ["Copy. Prüfe.", "Moment.", "Prüfe."],
    locker: ["Sekunde, ich check das kurz.", "Yo, ich schau mir das an – gib mir 'nen Moment.", "Okay, ich digg mich kurz in die Daten."],
  };
  const liste = saetze[art] ?? saetze.kumpel;
  return liste[Math.min(liste.length - 1, Math.floor(zufall * liste.length))];
}

export class Chat {
  private readonly verlauf: ChatBeitrag[] = [];
  private laeuft = 0;

  constructor(private readonly liste: HTMLElement, private readonly u: ChatUmgebung) {}

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

  private sagen(text: string, klasse = "") {
    const b: ChatBeitrag = { wer: "ingenieur", text };
    this.verlauf.push(b);
    this.blase(b, klasse);
    this.u.vorlesen(text);
  }

  leeren() {
    this.verlauf.length = 0;
    this.liste.replaceChildren();
  }

  /** Der Renningenieur meldet sich von selbst (z. B. mit der Nachbesprechung nach der Sitzung) */
  melden(text: string, klasse = "") {
    this.sagen(text, klasse);
  }

  async senden(eingabe: string): Promise<void> {
    const frage = eingabe.replace(/\s+/g, " ").trim().slice(0, 400);
    if (frage.length < 2) return;
    const nr = ++this.laeuft;
    const vorher = this.verlauf.slice(-8);
    this.verlauf.push({ wer: "fahrer", text: frage });
    this.blase({ wer: "fahrer", text: frage });

    let sparHinweis: string | null = null;
    if (willSparen(frage)) sparHinweis = this.u.sparenStarten();

    const ohneKi = () => this.u.lokal(frage) ?? sparHinweis
      ?? (this.u.angemeldet()
        ? "Dafür brauche ich die KI – sie ist gerade nicht erreichbar. Einfache Dinge wie Sprit, Abstände oder Rundenzeiten kann ich dir trotzdem sagen."
        : "Melde dich oben rechts an – dann kann ich dir dazu ausführlich antworten. Sprit, Abstände und Rundenzeiten sage ich dir auch so.");
    if (!this.u.angemeldet() || !kiVerfuegbar()) {
      this.sagen(ohneKi());
      return;
    }

    const schwierig = istSchwierig(frage);
    let wartet: HTMLElement | null = null;
    if (schwierig) this.sagen(pruefSatz(this.u.art()), "pruefen");
    else wartet = this.blase({ wer: "ingenieur", text: "…" }, "tippt");

    const e = await kiFragen(schwierig ? "analyse" : "frage", this.u.lage(), { frage, verlauf: vorher });
    wartet?.remove();
    if (nr !== this.laeuft && !schwierig) return; // überholt von einer neueren Frage
    if ("text" in e) this.sagen(e.text);
    else this.sagen(this.u.lokal(frage) ?? sparHinweis ?? (e.grund === "einrichtung"
      ? "Der KI-Renningenieur wird gerade eingerichtet – Sprit, Abstände und Rundenzeiten kann ich dir aber schon sagen."
      : "Funkstörung – das hat gerade nicht geklappt. Frag mich gleich noch einmal."));
  }
}
