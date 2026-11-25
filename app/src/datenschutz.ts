// Datenschutz beim KI-Renningenieur (26.11.): Auf Wunsch bekommt die KI von anderen Fahrern nur die Startnummer,
// keine Namen. Ersetzt wird kurz vor dem Senden in allen Texten der Messwerte (auch Nachnamen allein).
// Spotter, Vorlagen-Funk und Anzeigen laufen auf dem PC und behalten die Namen.

export type Fahrername = { name: string; nummer: string };

/** Ersetzt in allen Texten eines Objekts die Namen anderer Fahrer durch „#Startnummer“ (ohne Nummer: „ein Fahrer“) */
export function namenErsetzen(wert: unknown, fahrer: Fahrername[]): unknown {
  const namen = fahrer.filter((f) => f.name && f.name.trim().length >= 2 && f.name !== "Du").sort((a, b) => b.name.length - a.name.length);
  // nur ganze Wörter ersetzen („Max“ nicht in „Maximal“)
  const wort = (t: string) => new RegExp(`(?<![\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "gu");
  const ersetze = (t: string) => {
    let s = t;
    for (const f of namen) {
      const ersatz = f.nummer ? `#${f.nummer}` : "ein Fahrer";
      s = s.replace(wort(f.name.trim()), ersatz);
      const nach = f.name.trim().split(/\s+/).at(-1);
      if (nach && nach.length >= 3 && nach !== f.name.trim()) s = s.replace(wort(nach), ersatz);
    }
    return s.replace(/(#\w+)\s+\1/g, "$1"); // „#7 #7“ → „#7“
  };
  const geh = (w: unknown): unknown => {
    if (typeof w === "string") return ersetze(w);
    if (Array.isArray(w)) return w.map(geh);
    if (w && typeof w === "object") return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, geh(v)]));
    return w;
  };
  return geh(wert);
}
