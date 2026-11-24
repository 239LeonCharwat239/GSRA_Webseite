// GSRA – Supabase Edge Function „speicher-aufraeumen“ (SQL 048)
// Löscht Dateien aus dem Speicher, die die Datenbank zum Entfernen vorgemerkt hat: Chat-Anhänge nach Ablauf der
// Beweissicherung (180 Tage), alte Profilbilder, Bilder gelöschter Inserate, Livery-Bilder und Video-Vorschaubilder.
// Welche Dateien weg dürfen, entscheidet ausschließlich die Datenbank (storage_cleanup_take); die Funktion selbst
// nimmt keine Pfade von außen an und gibt nur Zahlen zurück – egal, wer sie wie oft aufruft.
// Aufruf stündlich durch den Zeitplan in der Datenbank (pg_cron + pg_net) mit dem öffentlichen Schlüssel.
// „Verify JWT“ bleibt an. Keine eigenen Secrets nötig (SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase).
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const ERLAUBT = new Set(["chat_attachments", "avatars", "marketplace", "liveries", "videos"]);
type Eintrag = { id: number; bucket: string; path: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt." }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.rpc("storage_cleanup_take", { _limit: 200 });
    if (error) {
      console.error("Speicher aufräumen:", error.message);
      return json({ ok: false }, 500);
    }
    const eintraege = ((data as Eintrag[] | null) || []).filter((e) => ERLAUBT.has(e.bucket) && !e.path.includes(".."));
    if (!eintraege.length) return json({ ok: true, entfernt: 0 });

    // Je Speicher in Paketen zu 100 löschen; fehlende Dateien gelten als erledigt
    const erledigt: number[] = [];
    const proBucket = new Map<string, Eintrag[]>();
    eintraege.forEach((e) => proBucket.set(e.bucket, [...(proBucket.get(e.bucket) || []), e]));
    for (const [bucket, liste] of proBucket) {
      for (let i = 0; i < liste.length; i += 100) {
        const paket = liste.slice(i, i + 100);
        const { error: fehler } = await admin.storage.from(bucket).remove(paket.map((e) => e.path));
        if (fehler) {
          console.error(`Speicher aufräumen (${bucket}):`, fehler.message);
          continue; // bleibt vorgemerkt, nächster Versuch beim nächsten Lauf (höchstens 5)
        }
        erledigt.push(...paket.map((e) => e.id));
      }
    }
    if (erledigt.length) {
      const { error: fertigFehler } = await admin.rpc("storage_cleanup_done", { _ids: erledigt });
      if (fertigFehler) console.error("Speicher aufräumen (vermerken):", fertigFehler.message);
    }
    return json({ ok: true, entfernt: erledigt.length });
  } catch (err) {
    console.error("Speicher aufräumen:", err instanceof Error ? err.message : String(err));
    return json({ ok: false }, 500);
  }
});
