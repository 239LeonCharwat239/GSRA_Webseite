// Spotter (Wunsch 25.11.): „Auto links“, „Auto rechts“, „Frei“ – sofort, ohne KI und ohne Kosten, in allen
// Sprachen des Renningenieurs. Grundlage ist der Spotter-Wert der Simulation (iRacing: CarLeftRight).
//  * Sofort ansagen, wenn ein Auto neben dir auftaucht (keine Verzögerung durch Funk-Klick).
//  * „Frei“ erst, wenn die Seite eine kurze Zeit wirklich frei bleibt (kein Flattern bei Zentimeter-Abständen),
//    und nur, wenn vorher jemand länger neben dir war.
//  * Dieselbe Ansage nicht im Sekundentakt wiederholen.

export type Seite = "frei" | "links" | "rechts" | "beide" | "zweiLinks" | "zweiRechts";

/** iRacing CarLeftRight → Seite (0 = Spotter aus) */
export function seiteAus(roh: number | null | undefined): Seite | null {
  return ({ 1: "frei", 2: "links", 3: "rechts", 4: "beide", 5: "zweiLinks", 6: "zweiRechts" } as Record<number, Seite>)[roh ?? -1] ?? null;
}

/** Kurze Spotter-Sätze in den Sprachen des Renningenieurs */
export const SPOTTER_SAETZE: Record<string, Record<Seite, string>> = {
  de: { links: "Auto links", rechts: "Auto rechts", beide: "Links und rechts", zweiLinks: "Zwei Autos links", zweiRechts: "Zwei Autos rechts", frei: "Frei" },
  en: { links: "Car left", rechts: "Car right", beide: "Three wide", zweiLinks: "Two cars left", zweiRechts: "Two cars right", frei: "Clear" },
  es: { links: "Coche a la izquierda", rechts: "Coche a la derecha", beide: "Tres en paralelo", zweiLinks: "Dos coches a la izquierda", zweiRechts: "Dos coches a la derecha", frei: "Libre" },
  fr: { links: "Voiture à gauche", rechts: "Voiture à droite", beide: "Trois de front", zweiLinks: "Deux voitures à gauche", zweiRechts: "Deux voitures à droite", frei: "Libre" },
  pt: { links: "Carro à esquerda", rechts: "Carro à direita", beide: "Três lado a lado", zweiLinks: "Dois carros à esquerda", zweiRechts: "Dois carros à direita", frei: "Livre" },
  it: { links: "Macchina a sinistra", rechts: "Macchina a destra", beide: "Tre affiancati", zweiLinks: "Due macchine a sinistra", zweiRechts: "Due macchine a destra", frei: "Libero" },
  nl: { links: "Auto links", rechts: "Auto rechts", beide: "Drie naast elkaar", zweiLinks: "Twee auto's links", zweiRechts: "Twee auto's rechts", frei: "Vrij" },
  pl: { links: "Auto z lewej", rechts: "Auto z prawej", beide: "Trzy obok siebie", zweiLinks: "Dwa auta z lewej", zweiRechts: "Dwa auta z prawej", frei: "Czysto" },
  tr: { links: "Solda araç", rechts: "Sağda araç", beide: "Üç araç yan yana", zweiLinks: "Solda iki araç", zweiRechts: "Sağda iki araç", frei: "Temiz" },
  ru: { links: "Машина слева", rechts: "Машина справа", beide: "Три в ряд", zweiLinks: "Две машины слева", zweiRechts: "Две машины справа", frei: "Чисто" },
  zh: { links: "左边有车", rechts: "右边有车", beide: "三车并排", zweiLinks: "左边两辆车", zweiRechts: "右边两辆车", frei: "安全" },
  ja: { links: "左に車", rechts: "右に車", beide: "3台並走", zweiLinks: "左に2台", zweiRechts: "右に2台", frei: "クリア" },
};

export const spotterSatz = (seite: Seite, sprache: string) => (SPOTTER_SAETZE[sprache] ?? SPOTTER_SAETZE.de)[seite];

const FREI_NACH = 0.45; // s – so lange muss es frei bleiben
const MIN_NEBEN = 0.6; // s – nur nach echtem Nebeneinander „Frei“ sagen
const NICHT_WIEDERHOLEN = 1.5; // s – dieselbe Ansage nicht öfter

export class Spotter {
  private aktuell: Seite = "frei";
  private nebenSeit: number | null = null;
  private zuletzt: { seite: Seite; zeit: number } | null = null;
  private freiSeit: number | null = null;

  private readonly sagen: (seite: Seite) => void;

  constructor(sagen: (seite: Seite) => void) {
    this.sagen = sagen;
  }

  zuruecksetzen() {
    this.aktuell = "frei";
    this.nebenSeit = null;
    this.zuletzt = null;
    this.freiSeit = null;
  }

  /** Neuer Wert der Simulation; zeit in Sekunden (Sitzungszeit) */
  aufnehmen(roh: number | null | undefined, zeit: number | null): void {
    const s = seiteAus(roh);
    if (!s || zeit == null || !Number.isFinite(zeit)) return;
    if (s !== "frei") {
      this.freiSeit = null;
      if (this.nebenSeit == null) this.nebenSeit = zeit;
      if (s !== this.aktuell) {
        this.aktuell = s;
        if (!(this.zuletzt && this.zuletzt.seite === s && zeit - this.zuletzt.zeit < NICHT_WIEDERHOLEN)) this.melden(s, zeit);
      }
      return;
    }
    // frei: erst nach einer kurzen Bestätigung, und nur wenn vorher wirklich jemand neben dir war
    if (this.aktuell === "frei") return;
    this.freiSeit ??= zeit;
    if (zeit - this.freiSeit >= FREI_NACH) {
      const warNeben = this.nebenSeit != null && this.freiSeit - this.nebenSeit >= MIN_NEBEN;
      this.aktuell = "frei";
      this.nebenSeit = null;
      this.freiSeit = null;
      if (warNeben) this.melden("frei", zeit);
    }
  }

  private melden(s: Seite, zeit: number) {
    this.zuletzt = { seite: s, zeit };
    this.sagen(s);
  }
}
