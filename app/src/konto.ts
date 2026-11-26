// GSRA-Konto in der App (SQL 051): Anmeldung über die Webseite, Zwei-Faktor-Code, Abmelden.
//
// Ablauf: Geheimnis + Prüfsumme erzeugen → Rust öffnet die Bestätigungsseite und wartet auf 127.0.0.1 →
// Einmal-Code kommt zurück → Server-Funktion „app-anmelden“ tauscht Code + Geheimnis gegen einen einmaligen
// Anmelde-Schlüssel → verifyOtp. Konten mit Zwei-Faktor bestätigen danach ihren Code (sonst sperrt 019 alles).
// Die Adresse und der öffentliche Schlüssel sind dieselben wie auf der Webseite (öffentlich, keine Geheimnisse).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://mqqyvpmddaastacldbyy.supabase.co";
// Öffentlicher Schlüssel (wie in supabase-client.js der Webseite) – Rechte regelt die Datenbank
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xcXl2cG1kZGFhc3RhY2xkYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzAzNzUsImV4cCI6MjEwMzAwNjM3NX0.OWY2FUS7n9Jw-6FP0Hp1B9aY6AUAkEpZ6Xd7MpS0GLI";

let client: SupabaseClient | null = null;
export const sb = () =>
  (client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: "gsra-app-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  }));

export const base64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Zufallswert aus dem sicheren Zufallsgenerator, base64url (32 Byte → 43 Zeichen, 16 Byte → 22 Zeichen) */
export function zufall(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return base64url(b);
}

/** Prüfsumme des Geheimnisses (wie PKCE „S256“) */
export async function pruefsumme(geheimnis: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(geheimnis))));
}

export type Konto = { id: string; name: string; braucheCode: boolean };

/** Code + Geheimnis eintauschen und anmelden */
export async function einloesen(code: string, geheimnis: string): Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(code)) throw new Error("Ungültige Antwort der Webseite.");
  let antwort: Response;
  try {
    antwort = await fetch(`${SUPABASE_URL}/functions/v1/app-anmelden`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ code, geheimnis }),
    });
  } catch {
    throw new Error("Keine Verbindung zur GSRA. Bitte prüfe deine Internetverbindung.");
  }
  const daten = (await antwort.json().catch(() => ({}))) as { token_hash?: unknown; fehler?: unknown };
  if (!antwort.ok || typeof daten.token_hash !== "string") {
    throw new Error(typeof daten.fehler === "string" ? daten.fehler : "Die Anmeldung hat nicht geklappt.");
  }
  const { error } = await sb().auth.verifyOtp({ token_hash: daten.token_hash, type: "email" });
  if (error) throw new Error("Die Anmeldung hat nicht geklappt. Bitte starte sie neu.");
}

/** Aktuelles Konto (null = nicht angemeldet). braucheCode: Zwei-Faktor eingerichtet, aber noch nicht bestätigt */
export async function kontoLaden(): Promise<Konto | null> {
  const { data } = await sb().auth.getSession();
  const sitzung = data.session;
  if (!sitzung) return null;
  const { data: stufe } = await sb().auth.mfa.getAuthenticatorAssuranceLevel();
  const braucheCode = stufe?.nextLevel === "aal2" && stufe.currentLevel !== "aal2";
  let name = "GSRA-Mitglied";
  if (!braucheCode) {
    const { data: profil } = await sb().from("profiles").select("username").eq("id", sitzung.user.id).maybeSingle();
    const n = (profil as { username?: unknown } | null)?.username;
    if (typeof n === "string" && n.trim()) name = n.trim().slice(0, 40);
  }
  return { id: sitzung.user.id, name, braucheCode };
}

/** Zwei-Faktor-Code aus der Authenticator-App bestätigen */
export async function codeBestaetigen(code: string): Promise<void> {
  const sauber = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(sauber)) throw new Error("Bitte gib den 6-stelligen Code aus deiner Authenticator-App ein.");
  const { data, error } = await sb().auth.mfa.listFactors();
  const faktor = data?.totp?.find((f) => f.status === "verified");
  if (error || !faktor) throw new Error("Für dein Konto ist keine Zwei-Faktor-Anmeldung gefunden worden.");
  const { error: fehler } = await sb().auth.mfa.challengeAndVerify({ factorId: faktor.id, code: sauber });
  if (fehler) throw new Error("Der Code stimmt nicht. Bitte versuche es noch einmal.");
}

/** Neues im Messenger? (ungelesene Nachrichten, Freundschaftsanfragen, Verwarnungen – nur ja/nein, SQL 058) */
export async function messengerHinweis(): Promise<boolean> {
  const { data, error } = await sb().rpc("messenger_hinweis");
  return !error && data === true;
}

// ---------------------------------------------------------------- Renningenieur einstellen (wie auf der Webseite)
export type ReThema = "sprit" | "abstaende" | "flaggen" | "reifen" | "coaching" | "wetter";
export type ReEinstellungen = {
  name: string; rufname: string | null; art: string; gespraechig: string; stimme: string; sprache: string; themen: Record<ReThema, boolean>;
};
export type ReEintrag = { id: string; art: string; text: string; quelle: string; created_at: string };

/** Eigene Einstellungen (null = noch nichts gespeichert) */
export async function reLaden(): Promise<Partial<ReEinstellungen> | null> {
  const { data: s } = await sb().auth.getSession();
  if (!s.session) return null;
  const { data, error } = await sb().from("race_engineer_settings").select("name, rufname, art, gespraechig, stimme, sprache, themen")
    .eq("user_id", s.session.user.id).maybeSingle();
  if (error) throw new Error("Die Einstellungen ließen sich nicht laden.");
  return (data as Partial<ReEinstellungen> | null) ?? null;
}

/** Speichern über die geprüfte Datenbank-Funktion (prüft Name, Art, Sprache …) */
export async function reSpeichern(e: ReEinstellungen): Promise<void> {
  const { error } = await sb().rpc("race_engineer_save", {
    _name: e.name, _rufname: e.rufname, _art: e.art, _gespraechig: e.gespraechig, _stimme: e.stimme, _sprache: e.sprache, _themen: e.themen,
  });
  if (error) throw new Error(error.message.slice(0, 200));
}

export async function gedaechtnisLaden(): Promise<ReEintrag[]> {
  const { data, error } = await sb().from("race_engineer_memory").select("id, art, text, quelle, created_at")
    .order("created_at", { ascending: false }).limit(100);
  return error ? [] : ((data as ReEintrag[] | null) ?? []);
}

export async function gedaechtnisMerken(art: string, text: string): Promise<void> {
  const { error } = await sb().rpc("race_engineer_remember", { _art: art, _text: text });
  if (error) throw new Error(error.message.slice(0, 200));
}

export async function gedaechtnisLoeschen(id: string): Promise<void> {
  const { error } = await sb().from("race_engineer_memory").delete().eq("id", id);
  if (error) throw new Error("Der Eintrag ließ sich nicht löschen.");
}

/** Nur diese App abmelden (andere Geräte bleiben angemeldet) */
export async function abmelden(): Promise<void> {
  await sb().auth.signOut({ scope: "local" });
}
