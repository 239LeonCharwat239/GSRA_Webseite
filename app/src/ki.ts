// KI-Renningenieur in der App: schickt die gemessenen Fakten an die Server-Funktion „renningenieur“ (SQL 052) und
// bekommt den Funkspruch bzw. die Nachbesprechung im eingestellten Stil zurück.
//  * Nur angemeldet (die Anmeldung der App, Zwei-Faktor bestätigt). Sonst bleibt es bei den Ansagen aus Vorlagen.
//  * Klappt etwas nicht (offline, Grenze, noch nicht eingerichtet), bleibt die Vorlage stehen – ohne Fehlermeldung
//    mitten im Rennen. Nach „noch nicht eingerichtet“ fragt die App in dieser Sitzung nicht weiter nach.
//  * Grenzen sind unsichtbar (Entscheidung 24.11.): Die App zeigt keine Kontingente an.
import { SUPABASE_ANON_KEY, SUPABASE_URL, sb } from "./konto.ts";

export type KiArt = "funk" | "nachbesprechung";
export type KiErgebnis = { text: string } | { fehler: string; grund: string };

let eingerichtet = true;
let pauseBis = 0;

export function kiVerfuegbar(): boolean {
  return eingerichtet && Date.now() >= pauseBis;
}

export type Persoenlichkeit = { name: string; stimme: "ruhig" | "energisch" | "tief" | "hell"; sprache: string };
const STIMMEN = ["ruhig", "energisch", "tief", "hell"] as const;

/** Name, Stimmlage und Sprache des eigenen Renningenieurs (eingestellt auf der Webseite); null = nicht angemeldet */
export async function persoenlichkeitLaden(): Promise<Persoenlichkeit | null> {
  const { data } = await sb().auth.getSession();
  const ich = data.session?.user.id;
  if (!ich) return null;
  const { data: e } = await sb().from("race_engineer_settings").select("name, stimme, sprache").eq("user_id", ich).maybeSingle();
  const roh = (e ?? {}) as { name?: unknown; stimme?: unknown; sprache?: unknown };
  return {
    name: typeof roh.name === "string" && roh.name.trim() ? roh.name.trim().slice(0, 24) : "Kim",
    stimme: STIMMEN.find((s) => s === roh.stimme) ?? "ruhig",
    sprache: typeof roh.sprache === "string" && /^[a-z]{2}$/.test(roh.sprache) ? roh.sprache : "de",
  };
}

export async function kiFragen(art: KiArt, lage: Record<string, unknown>): Promise<KiErgebnis> {
  if (!eingerichtet) return { fehler: "Der KI-Renningenieur ist noch nicht eingerichtet.", grund: "einrichtung" };
  if (Date.now() < pauseBis) return { fehler: "Kurze Pause.", grund: "grenze" };
  const { data } = await sb().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { fehler: "Bitte melde dich in der App an.", grund: "anmeldung" };
  let antwort: Response;
  try {
    antwort = await fetch(`${SUPABASE_URL}/functions/v1/renningenieur`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ art, lage }),
      signal: AbortSignal.timeout(art === "funk" ? 15_000 : 60_000),
    });
  } catch {
    return { fehler: "Keine Verbindung zum Renningenieur.", grund: "netz" };
  }
  const daten = (await antwort.json().catch(() => ({}))) as { text?: unknown; fehler?: unknown; grund?: unknown };
  if (antwort.ok && typeof daten.text === "string" && daten.text.trim()) return { text: daten.text.trim().slice(0, 2400) };
  const grund = typeof daten.grund === "string" ? daten.grund : String(antwort.status);
  if (antwort.status === 503 && grund === "einrichtung") eingerichtet = false;
  if (antwort.status === 429) pauseBis = Date.now() + (grund === "minute" ? 60_000 : 30 * 60_000);
  return { fehler: typeof daten.fehler === "string" ? daten.fehler.slice(0, 200) : "Der Renningenieur ist gerade nicht erreichbar.", grund };
}
