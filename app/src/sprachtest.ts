// Sprachtest (Wunsch 27.11.: „er muss mich verstehen, auch wenn ich ganz normal rede oder nuschle“).
// Zehn typische Funksätze nacheinander einsprechen – ganz normal, nicht deutlich. Die App erkennt jeden Satz mit dem
// Modell auf dem PC und zeigt die Trefferquote (Anteil richtig verstandener Wörter). Der Ton bleibt nur im
// Arbeitsspeicher und ist danach weg. Mit dem Ergebnis entscheiden wir, ob die Erkennung auf dem PC reicht oder die
// Online-Erkennung dazukommt.

/** Testsätze – {name} = Name des Renningenieurs */
export const TESTSAETZE = [
  "Hey {name}, reicht der Sprit bis zum Ende?",
  "Wer ist vor mir und wie groß ist der Abstand?",
  "Wie war meine letzte Runde?",
  "{name}, ist hinter mir jemand schneller?",
  "Welche Position habe ich gerade?",
  "Wo verliere ich die meiste Zeit?",
  "Box diese Runde, wir wechseln die Reifen.",
  "Wie viele Runden fahren wir noch?",
  "Sag mir meine Bestzeit.",
  "Wie kann ich in Kurve drei schneller werden?",
];

/** Wörter zum Vergleichen: klein, ohne Satzzeichen, Umlaute angeglichen */
export function woerter(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Trefferquote 0…1: 1 − (Wortfehler / Wörter im Satz); Wortfehler = Einfügen, Weglassen oder Vertauschen */
export function trefferquote(soll: string, ist: string): number {
  const a = woerter(soll);
  const b = woerter(ist);
  if (!a.length) return b.length ? 0 : 1;
  let vorher = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const jetzt = [i];
    for (let j = 1; j <= b.length; j++) {
      jetzt[j] = Math.min(vorher[j] + 1, jetzt[j - 1] + 1, vorher[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    vorher = jetzt;
  }
  return Math.max(0, 1 - vorher[b.length] / a.length);
}

/** Welche Wörter des Satzes fehlen in der Erkennung? (für die Anzeige) */
export function fehlendeWoerter(soll: string, ist: string): string[] {
  const erkannt = new Set(woerter(ist));
  return soll.split(/\s+/).filter((w) => woerter(w).some((x) => !erkannt.has(x)));
}

type Aufruf = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
};
const neu = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text = "") => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text) e.textContent = text;
  return e;
};

export function sprachtestEinrichten(aufrufen: Aufruf, name: () => string): void {
  let nr = 0;
  const ergebnisse: number[] = [];
  const satz = () => TESTSAETZE[nr].replace("{name}", name());
  const zeigen = () => {
    $("stZaehler").textContent = `Satz ${Math.min(nr + 1, TESTSAETZE.length)} von ${TESTSAETZE.length}`;
    $("stSatz").textContent = nr < TESTSAETZE.length ? `„${satz()}“` : "Fertig!";
    const schnitt = ergebnisse.length ? ergebnisse.reduce((s, x) => s + x, 0) / ergebnisse.length : null;
    $("stGesamt").textContent = schnitt == null ? "–" : `${Math.round(schnitt * 100)} %`;
    $("stGesamt").className = schnitt == null ? "" : schnitt >= 0.95 ? "gut" : schnitt >= 0.85 ? "mittel" : "schlecht";
    $("stUrteil").textContent = schnitt == null ? "richtig verstandene Wörter"
      : schnitt >= 0.95 ? "Sehr gut – die Erkennung auf dem PC reicht für dich."
      : schnitt >= 0.85 ? "Ordentlich – bei Namen und schnellem Sprechen hakt es noch."
      : "Zu ungenau – hier hilft die Online-Erkennung.";
    $<HTMLButtonElement>("stAufnehmen").textContent = nr >= TESTSAETZE.length ? "Noch einmal von vorn" : "Satz einsprechen";
  };
  $("stAufnehmen").addEventListener("click", async () => {
    if (nr >= TESTSAETZE.length) {
      nr = 0;
      ergebnisse.length = 0;
      $("stListe").replaceChildren();
      zeigen();
      return;
    }
    const knopf = $<HTMLButtonElement>("stAufnehmen");
    knopf.disabled = true;
    knopf.textContent = "Sprich jetzt – ganz normal …";
    const soll = satz();
    try {
      const ist = await aufrufen<string>("sprachtest");
      const quote = trefferquote(soll, ist);
      ergebnisse.push(quote);
      const li = neu("li", quote >= 0.95 ? "gut" : quote >= 0.7 ? "mittel" : "schlecht");
      li.append(neu("strong", "", `${Math.round(quote * 100)} %`), neu("span", "", ist || "(nichts erkannt)"));
      const fehlt = fehlendeWoerter(soll, ist);
      if (fehlt.length) li.append(neu("small", "", `nicht verstanden: ${fehlt.join(", ")}`));
      $("stListe").append(li);
      nr++;
    } catch (e) {
      const li = neu("li", "schlecht");
      li.append(neu("strong", "", "–"), neu("span", "", typeof e === "string" ? e : "Die Aufnahme hat nicht geklappt."));
      $("stListe").append(li);
    } finally {
      knopf.disabled = false;
      zeigen();
    }
  });
  zeigen();
}
