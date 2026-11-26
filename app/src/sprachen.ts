// Sprachen des Renningenieurs (SQL 059) und eine schlanke Spracherkennung für Text – damit bei „Automatisch“ die
// Sprachausgabe die passende Stimme nimmt. Ohne Netz, ohne Bibliothek: Schriftzeichen und häufige Wörter.

/** Sprachen, in denen man mit dem Renningenieur SPRECHEN kann (Spracherkennung Parakeet v3) */
export const SPRECH_SPRACHEN: Record<string, string> = {
  de: "Deutsch", en: "Englisch", es: "Spanisch", fr: "Französisch", it: "Italienisch", pt: "Portugiesisch",
  nl: "Niederländisch", pl: "Polnisch", ru: "Russisch", uk: "Ukrainisch", sv: "Schwedisch", da: "Dänisch",
  fi: "Finnisch", cs: "Tschechisch", sk: "Slowakisch", sl: "Slowenisch", hr: "Kroatisch", hu: "Ungarisch",
  ro: "Rumänisch", bg: "Bulgarisch", el: "Griechisch", et: "Estnisch", lv: "Lettisch", lt: "Litauisch", mt: "Maltesisch",
};
/** Zusätzlich nur zum Schreiben (die Spracherkennung versteht sie noch nicht) */
export const NUR_TEXT: Record<string, string> = { tr: "Türkisch", zh: "Chinesisch", ja: "Japanisch" };

export const LAENDERCODE: Record<string, string> = {
  de: "de-DE", en: "en-GB", es: "es-ES", fr: "fr-FR", it: "it-IT", pt: "pt-PT", nl: "nl-NL", pl: "pl-PL", ru: "ru-RU",
  uk: "uk-UA", sv: "sv-SE", da: "da-DK", fi: "fi-FI", cs: "cs-CZ", sk: "sk-SK", sl: "sl-SI", hr: "hr-HR", hu: "hu-HU",
  ro: "ro-RO", bg: "bg-BG", el: "el-GR", et: "et-EE", lv: "lv-LV", lt: "lt-LT", mt: "mt-MT", tr: "tr-TR", zh: "zh-CN", ja: "ja-JP",
};

export function spracheName(code: string): string {
  if (code === "auto") return "Automatisch";
  return SPRECH_SPRACHEN[code] ?? NUR_TEXT[code] ?? code;
}

// Häufige kurze Wörter je Sprache (Kleinschreibung) – genug, um kurze Funksprüche zu unterscheiden
const WOERTER: Record<string, string[]> = {
  de: ["der", "die", "das", "und", "ist", "du", "nicht", "ich", "mit", "auf", "noch", "runde", "vor", "dir", "hinter", "sprit", "reicht", "wer"],
  en: ["the", "and", "is", "you", "your", "to", "of", "it", "lap", "fuel", "behind", "ahead", "box", "this", "what", "how", "are"],
  es: ["el", "la", "que", "de", "y", "es", "tu", "los", "las", "vuelta", "combustible", "detrás", "delante", "por", "con", "para"],
  fr: ["le", "la", "les", "et", "est", "tu", "vous", "de", "des", "tour", "essence", "derrière", "devant", "pas", "une", "avec"],
  it: ["il", "la", "che", "e", "è", "di", "sei", "giro", "benzina", "dietro", "davanti", "non", "per", "con", "gli"],
  pt: ["o", "a", "que", "de", "e", "é", "você", "volta", "combustível", "atrás", "frente", "não", "com", "para", "os"],
  nl: ["de", "het", "en", "is", "je", "jij", "niet", "een", "ronde", "brandstof", "achter", "voor", "met", "wat", "hoe"],
  pl: ["i", "w", "nie", "jest", "na", "się", "to", "jak", "okrążenie", "paliwo", "za", "przed", "ty", "co", "czy"],
  sv: ["och", "är", "du", "det", "att", "inte", "en", "varv", "bränsle", "bakom", "framför", "med", "vad", "hur"],
  da: ["og", "er", "du", "det", "at", "ikke", "en", "omgang", "brændstof", "bag", "foran", "med", "hvad", "hvordan"],
  fi: ["ja", "on", "sinä", "ei", "se", "kierros", "polttoaine", "takana", "edessä", "mitä", "kuinka", "olet"],
  cs: ["a", "je", "se", "na", "ne", "to", "kolo", "palivo", "za", "před", "jak", "co", "jsi"],
  sk: ["a", "je", "sa", "na", "nie", "to", "kolo", "palivo", "za", "pred", "ako", "čo", "si"],
  sl: ["in", "je", "se", "na", "ne", "to", "krog", "gorivo", "za", "pred", "kako", "kaj", "si"],
  hr: ["i", "je", "se", "na", "ne", "to", "krug", "gorivo", "iza", "ispred", "kako", "što", "si"],
  hu: ["és", "a", "az", "nem", "van", "egy", "kör", "üzemanyag", "mögött", "előtt", "mi", "hogy", "vagy"],
  ro: ["și", "este", "nu", "în", "de", "tu", "tur", "combustibil", "în spate", "în față", "ce", "cum", "eu"],
  et: ["ja", "on", "sa", "ei", "see", "ring", "kütus", "taga", "ees", "mis", "kuidas"],
  lv: ["un", "ir", "tu", "ne", "tas", "aplis", "degviela", "aiz", "priekšā", "kas", "kā"],
  lt: ["ir", "yra", "tu", "ne", "tai", "ratas", "kuras", "už", "prieš", "kas", "kaip"],
  mt: ["u", "il", "huwa", "int", "mhux", "dawra", "fjuwil", "wara", "quddiem", "x'", "kif"],
  tr: ["ve", "bir", "bu", "sen", "değil", "tur", "yakıt", "arkanda", "önünde", "ne", "nasıl", "mi"],
};

/** Sprache eines Textes schätzen (für die Stimmauswahl bei „Automatisch“); null = unklar */
export function spracheVonText(text: string): string | null {
  const t = text.toLowerCase();
  if (/[぀-ヿ]/.test(t)) return "ja";
  if (/[一-鿿]/.test(t)) return "zh";
  if (/[Ͱ-Ͽ]/.test(t)) return "el";
  if (/[Ѐ-ӿ]/.test(t)) {
    if (/[іїєґ]/.test(t)) return "uk";
    if (/[щъ].*|ще |това/.test(t) && !/[ыэё]/.test(t)) return "bg";
    return "ru";
  }
  const woerter = t.split(/[^\p{L}']+/u).filter(Boolean);
  if (!woerter.length) return null;
  let beste: string | null = null;
  let punkte = 0;
  for (const [code, liste] of Object.entries(WOERTER)) {
    const menge = new Set(liste);
    let p = woerter.reduce((s, w) => s + (menge.has(w) ? 1 : 0), 0);
    // Sonderzeichen geben zusätzliche Hinweise
    if (code === "de" && /[äöüß]/.test(t)) p += 1.5;
    if (code === "es" && /[ñ¿¡]/.test(t)) p += 1.5;
    if (code === "fr" && /[çœ]|[àâêëîôû]/.test(t)) p += 1;
    if (code === "pt" && /[ãõ]/.test(t)) p += 1.5;
    if (code === "pl" && /[ąęłńśźż]/.test(t)) p += 1.5;
    if (code === "cs" && /[ěřů]/.test(t)) p += 1.5;
    if (code === "tr" && /[ığş]/.test(t)) p += 1.5;
    if (code === "ro" && /[ăâîșț]/.test(t)) p += 1;
    if (code === "hu" && /[őű]/.test(t)) p += 1.5;
    if ((code === "sv" || code === "fi") && /[å]/.test(t)) p += code === "sv" ? 1 : 0;
    if (code === "da" && /[æø]/.test(t)) p += 1.5;
    if (p > punkte) { punkte = p; beste = code; }
  }
  return punkte >= 1 ? beste : null;
}
