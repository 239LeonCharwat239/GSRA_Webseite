// Vorlagen-Funk (Wunsch 25.11.): Häufige Ansagen wie „Wer ist vor mir, wie weit, holt er auf?“ kommen ohne KI –
// sofort und kostenlos, aber abwechslungsreich formuliert und im Stil des Renningenieurs (Kumpel, Profi …), damit es
// trotzdem wie ein Mensch am Funk klingt. Die Werte stammen direkt aus der Simulation.

export type Gegner = {
  name: string;
  nummer: string;
  /** Abstand in Sekunden (immer positiv) */
  abstand: number;
  /** Veränderung des Abstands seit der letzten Runde in Sekunden (+ = Abstand wächst, − = schrumpft) */
  trend: number | null;
};

const zahl = (x: number, stellen = 1) => x.toFixed(stellen).replace(".", ",");
/** Nachname reicht am Funk („Becker“); bei Startnummer ohne Namen „die 7“ */
export function rufname(g: Gegner): string {
  const teile = g.name.trim().split(/\s+/);
  const nach = teile.length > 1 ? teile[teile.length - 1] : teile[0];
  return nach && !/^Auto \d+$/.test(g.name) ? nach : g.nummer ? `die ${g.nummer}` : "der Wagen";
}

type Art = "kumpel" | "profi" | "motivator" | "knapp" | "locker";
const waehle = <T>(liste: T[], z: number) => liste[Math.min(liste.length - 1, Math.floor(z * liste.length))];

/** Satz zum Vordermann (bis 3 s) und – wenn er drückt – zum Hintermann (bis 1,5 s); null = nichts Wichtiges */
export function abstandSatz(artRoh: string, vor: Gegner | null, hinter: Gegner | null, zufall: () => number = Math.random): string | null {
  const art: Art = (["kumpel", "profi", "motivator", "knapp", "locker"] as const).find((a) => a === artRoh) ?? "kumpel";
  const teile: string[] = [];
  if (vor && vor.abstand <= 3) {
    const n = rufname(vor), a = zahl(vor.abstand);
    const t = vor.trend;
    const holt = t != null && t < -0.05 ? zahl(-t) : null;
    const weg = t != null && t > 0.05 ? zahl(t) : null;
    const gleich = t != null && !holt && !weg; // Tendenz erst ab der zweiten Runde bekannt
    const vorlagen: Record<Art, string[]> = {
      kumpel: [
        `${n} ist ${a} vor dir${holt ? ` – du holst ${holt} pro Runde, das wird was` : weg ? `, er zieht gerade ${weg} pro Runde weg` : gleich ? ", Abstand bleibt gleich" : ""}.`,
        `Vor dir fährt ${n}, ${a} Sekunden${holt ? `, und du bist ${holt} pro Runde schneller` : weg ? `, er ist im Moment ${weg} pro Runde schneller` : ""}.`,
      ],
      profi: [
        `Abstand nach vorn ${a}, ${n}.${holt ? ` Tendenz minus ${holt} pro Runde.` : weg ? ` Tendenz plus ${weg} pro Runde.` : gleich ? " Stabil." : ""}`,
        `${n} vor dir, ${a} Sekunden${holt ? `, du holst ${holt} je Runde` : weg ? `, verlierst ${weg} je Runde` : gleich ? ", konstant" : ""}.`,
      ],
      motivator: [
        `Nur noch ${a} auf ${n}${holt ? ` – und du holst ${holt} pro Runde, hol ihn dir!` : weg ? ` – dranbleiben, er ist gerade ${weg} schneller!` : " – bleib dran!"}`,
        `${n} ist ${a} vor dir${holt ? ` und du bist schneller – ${holt} pro Runde!` : "! Du kannst das!"}`,
      ],
      knapp: [`Vorne ${n}, ${a}${holt ? `, minus ${holt}` : weg ? `, plus ${weg}` : ""}.`],
      locker: [
        `${n} ist ${a} vor dir${holt ? ` und du holst ${holt} pro Runde – der ist fällig` : weg ? `, der zieht grad ${weg} pro Runde weg` : gleich ? ", Abstand bleibt" : ""}.`,
        `Yo, ${n} vorne, ${a} weg${holt ? ` – du bist ${holt} pro Runde schneller, easy` : ""}.`,
      ],
    };
    teile.push(waehle(vorlagen[art], zufall()));
  }
  if (hinter && hinter.abstand <= 1.5 && (hinter.trend == null || hinter.trend <= 0.05)) {
    const n = rufname(hinter), a = zahl(hinter.abstand);
    const naeher = hinter.trend != null && hinter.trend < -0.05 ? zahl(-hinter.trend) : null;
    const vorlagen: Record<Art, string[]> = {
      kumpel: [`Hinter dir ${n}, ${a}${naeher ? ` – er kommt ${naeher} pro Runde näher` : ""}.`],
      profi: [`Nach hinten ${a}, ${n}${naeher ? `, kommt ${naeher} je Runde näher` : ""}.`],
      motivator: [`${n} ist ${a} hinter dir – halt ihn dir vom Leib!`],
      knapp: [`Hinten ${n}, ${a}.`],
      locker: [`${n} hängt dir ${a} im Nacken${naeher ? `, kommt ${naeher} pro Runde ran` : ""} – bleib cool.`],
    };
    teile.push(waehle(vorlagen[art], zufall()));
  }
  return teile.length ? teile.join(" ") : null;
}
