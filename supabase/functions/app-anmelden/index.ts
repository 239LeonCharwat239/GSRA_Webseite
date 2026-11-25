// GSRA – Supabase Edge Function „app-anmelden“ (SQL 051)
// Die GSRA-App für den PC tauscht hier den Einmal-Code (kommt von der Webseite direkt an die App auf demselben PC)
// und ihr eigenes Geheimnis gegen einen einmaligen Anmelde-Schlüssel ein. Mit diesem Schlüssel meldet sich die App
// an (verifyOtp); Konten mit Zwei-Faktor bestätigen danach zusätzlich ihren Code in der App.
//
// Sicherheit:
//  * Ob ein Code gilt, entscheidet nur die Datenbank (app_link_take): genau ein Versuch pro Code, nur mit passendem
//    Geheimnis (Prüfsumme wie bei PKCE), nur 5 Minuten, nicht für gesperrte Konten.
//  * Die Funktion nimmt nur Code und Geheimnis an (feste Formate), keine E-Mail-Adresse, kein Konto von außen.
//  * Antworten verraten nicht, ob ein Konto existiert. Kein Schlüssel und keine Adresse wird protokolliert.
//  * Browser-Zugriff (CORS) nur aus der App selbst. „Verify JWT“ bleibt an (die App schickt den öffentlichen Schlüssel).
// Keine eigenen Secrets nötig (SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase).
import { createClient } from "jsr:@supabase/supabase-js@2";

// Herkunft der App-Oberfläche: Tauri unter Windows bzw. macOS/Linux, dazu die Entwicklungs-Vorschau
const APP_HERKUNFT = new Set(["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost", "http://localhost:1420"]);

function kopf(herkunft: string | null): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (herkunft && APP_HERKUNFT.has(herkunft)) {
    h["Access-Control-Allow-Origin"] = herkunft;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
    h["Vary"] = "Origin";
  }
  return h;
}

const sha256 = async (text: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const base64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const UNGUELTIG = "Die Anmeldung ist abgelaufen oder ungültig. Bitte starte sie in der App neu.";

Deno.serve(async (req) => {
  const herkunft = req.headers.get("origin");
  const antwort = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: kopf(herkunft) });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: kopf(herkunft) });
  if (req.method !== "POST") return antwort({ fehler: "Nur POST erlaubt." }, 405);

  let daten: { code?: unknown; geheimnis?: unknown };
  try {
    daten = await req.json();
  } catch {
    return antwort({ fehler: "Ungültige Anfrage." }, 400);
  }
  const code = typeof daten?.code === "string" ? daten.code : "";
  const geheimnis = typeof daten?.geheimnis === "string" ? daten.geheimnis : "";
  if (!/^[0-9a-f]{64}$/.test(code) || !/^[A-Za-z0-9_-]{43,128}$/.test(geheimnis)) {
    return antwort({ fehler: "Ungültige Anfrage." }, 400);
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc("app_link_take", {
      _code_hash: hex(await sha256(code)),
      _challenge: base64url(await sha256(geheimnis)),
    });
    if (error) {
      console.error("App-Anmeldung (Datenbank):", error.message);
      return antwort({ fehler: "Die Anmeldung hat gerade nicht geklappt. Bitte versuche es gleich noch einmal." }, 500);
    }
    const zeile = (data as Array<{ konto: string; adresse: string }> | null)?.[0];
    if (!zeile?.adresse) return antwort({ fehler: UNGUELTIG }, 400);

    // Einmaliger Anmelde-Schlüssel (es wird KEINE E-Mail verschickt)
    const { data: link, error: fehler } = await admin.auth.admin.generateLink({ type: "magiclink", email: zeile.adresse });
    const tokenHash = link?.properties?.hashed_token;
    if (fehler || !tokenHash) {
      console.error("App-Anmeldung (Schlüssel):", fehler?.message ?? "kein Schlüssel");
      return antwort({ fehler: "Die Anmeldung hat gerade nicht geklappt. Bitte versuche es gleich noch einmal." }, 500);
    }
    return antwort({ token_hash: tokenHash });
  } catch (e) {
    console.error("App-Anmeldung:", e instanceof Error ? e.message : "unbekannter Fehler");
    return antwort({ fehler: "Die Anmeldung hat gerade nicht geklappt. Bitte versuche es gleich noch einmal." }, 500);
  }
});
