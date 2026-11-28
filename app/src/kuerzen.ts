// Texte kürzen, ohne mitten im Wort oder Satz abzubrechen (Fund 28.11.: die Nachbesprechung brach mitten im Wort ab).
// Gleiche Regel wie amSatzende() in supabase/functions/renningenieur/index.ts (dort läuft Deno, hier die App).

/** Höchstens max Zeichen – bis zum letzten vollständigen Satz; gibt es keinen sinnvollen, am Wortende mit „…“ */
export function amSatzende(t: string, max: number, abgebrochen = false): string {
  let s = t.trim();
  if (s.length <= max && !abgebrochen) return s;
  s = s.slice(0, max);
  const ende = Math.max(...[". ", "! ", "? ", "… ", ".\n", "!\n", "?\n"].map((z) => s.lastIndexOf(z)));
  const letzt = /[.!?…]$/.test(s) ? s.length - 1 : -1;
  const stelle = Math.max(ende, letzt);
  // abgebrochen: jeder ganze Satz ist besser als ein halber; sonst nur, wenn nicht zu viel wegfällt
  if (stelle > 0 && (abgebrochen || stelle >= max * 0.4)) return s.slice(0, stelle + 1).trim();
  const wort = s.lastIndexOf(" ");
  return `${s.slice(0, wort > 0 ? wort : s.length).replace(/[,;:–-]\s*$/, "").trim()} …`;
}
