// KI-Renningenieur in der App: schickt die gemessenen Fakten an die Server-Funktion „renningenieur“ (SQL 052/053)
// und bekommt Funkspruch, Antwort auf eine Rückfrage oder die Nachbesprechung im eingestellten Stil zurück.
//  * Nur angemeldet (die Anmeldung der App, Zwei-Faktor bestätigt). Sonst bleibt es bei den Ansagen aus Vorlagen.
//  * Klappt etwas nicht (offline, Grenze, noch nicht eingerichtet), bleibt die Vorlage stehen – ohne Fehlermeldung
//    mitten im Rennen. Nach „noch nicht eingerichtet“ fragt die App in dieser Sitzung nicht weiter nach.
//  * Grenzen sind unsichtbar (Entscheidung 24.11.): Die App zeigt keine Kontingente an.
import { SUPABASE_ANON_KEY, SUPABASE_URL, sb } from "./konto.ts";

export type KiArt = "funk" | "nachbesprechung" | "frage" | "analyse";
export type Merken = { art: "staerke" | "schwaeche" | "ziel"; text: string };
export type KiErgebnis = { text: string; merken?: Merken[] } | { fehler: string; grund: string };
export type KiChat = { frage: string; verlauf: Array<{ wer: "fahrer" | "ingenieur"; text: string }> };

let eingerichtet = true;
let pauseAlle = 0;
const pauseArt = new Map<KiArt, number>();

export function kiVerfuegbar(art: KiArt = "funk"): boolean {
  const jetzt = Date.now();
  return eingerichtet && jetzt >= pauseAlle && jetzt >= (pauseArt.get(art) ?? 0);
}

export type Persoenlichkeit = { name: string; art: string; stimme: "ruhig" | "energisch" | "tief" | "hell"; sprache: string };
const STIMMEN = ["ruhig", "energisch", "tief", "hell"] as const;
const ARTEN = ["kumpel", "profi", "motivator", "knapp", "locker"] as const;

/** Name, Art, Stimmlage und Sprache des eigenen Renningenieurs (eingestellt auf der Webseite); null = nicht angemeldet */
export async function persoenlichkeitLaden(): Promise<Persoenlichkeit | null> {
  const { data } = await sb().auth.getSession();
  const ich = data.session?.user.id;
  if (!ich) return null;
  const { data: e } = await sb().from("race_engineer_settings").select("name, art, stimme, sprache").eq("user_id", ich).maybeSingle();
  const roh = (e ?? {}) as { name?: unknown; art?: unknown; stimme?: unknown; sprache?: unknown };
  return {
    name: typeof roh.name === "string" && roh.name.trim() ? roh.name.trim().slice(0, 24) : "Kim",
    art: ARTEN.find((a) => a === roh.art) ?? "kumpel",
    stimme: STIMMEN.find((s) => s === roh.stimme) ?? "ruhig",
    sprache: typeof roh.sprache === "string" && /^[a-z]{2}$/.test(roh.sprache) ? roh.sprache : "de",
  };
}

/** Erkenntnisse aus der Nachbesprechung ins eigene Gedächtnis des Renningenieurs (SQL 054); Fehler sind egal */
export async function merkenSpeichern(liste: Merken[]): Promise<number> {
  let gespeichert = 0;
  for (const m of liste.slice(0, 2)) {
    const { error } = await sb().rpc("race_engineer_learn", { _art: m.art, _text: m.text });
    if (!error) gespeichert++;
  }
  return gespeichert;
}

export async function kiFragen(art: KiArt, lage: Record<string, unknown>, chat?: KiChat): Promise<KiErgebnis> {
  if (!eingerichtet) return { fehler: "Der KI-Renningenieur ist noch nicht eingerichtet.", grund: "einrichtung" };
  if (!kiVerfuegbar(art)) return { fehler: "Kurze Pause.", grund: "grenze" };
  const { data } = await sb().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { fehler: "Bitte melde dich in der App an.", grund: "anmeldung" };
  const body = chat
    ? { art, lage, frage: chat.frage.slice(0, 7000), verlauf: chat.verlauf.slice(-8).map((b) => ({ wer: b.wer, text: b.text.slice(0, 2000) })) }
    : { art, lage };
  let antwort: Response;
  try {
    antwort = await fetch(`${SUPABASE_URL}/functions/v1/renningenieur`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(art === "funk" || art === "frage" ? 15_000 : 70_000),
    });
  } catch {
    return { fehler: "Keine Verbindung zum Renningenieur.", grund: "netz" };
  }
  const daten = (await antwort.json().catch(() => ({}))) as { text?: unknown; fehler?: unknown; grund?: unknown; merken?: unknown };
  if (antwort.ok && typeof daten.text === "string" && daten.text.trim()) {
    const merken = Array.isArray(daten.merken)
      ? daten.merken.slice(0, 10).flatMap((m): Merken[] => {
          const e = m as { art?: unknown; text?: unknown };
          const art = (["staerke", "schwaeche", "ziel"] as const).find((a) => a === e?.art);
          return art && typeof e.text === "string" && e.text.trim().length >= 2 ? [{ art, text: e.text.trim().slice(0, 200) }] : [];
        }).slice(0, 2)
      : [];
    return { text: daten.text.trim().slice(0, 2400), merken };
  }
  const grund = typeof daten.grund === "string" ? daten.grund : String(antwort.status);
  if (antwort.status === 503 && grund === "einrichtung") eingerichtet = false;
  if (antwort.status === 429) {
    // Minute: kurz alle warten; Tagesgrenze: nur diese Art; Monat/Deckel: alle eine Weile
    if (grund === "minute") pauseAlle = Date.now() + 60_000;
    else if (grund === "tag") pauseArt.set(art, Date.now() + 60 * 60_000);
    else pauseAlle = Date.now() + 30 * 60_000;
  }
  return { fehler: typeof daten.fehler === "string" ? daten.fehler.slice(0, 200) : "Der Renningenieur ist gerade nicht erreichbar.", grund };
}
