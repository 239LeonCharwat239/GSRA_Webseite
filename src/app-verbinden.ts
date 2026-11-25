// GSRA – App verbinden (SQL 051): Die GSRA-App öffnet diese Seite mit
//   app-verbinden.html#c=<challenge>&p=<port>&s=<state>&g=<Gerätename>
// Wer angemeldet ist, bestätigt hier. Die Datenbank liefert einen Einmal-Code, den diese Seite direkt an die App auf
// DEMSELBEN PC schickt (http://127.0.0.1:<port>) – ein weitergeleiteter Link nützt also niemandem.
//
// Sicherheit:
//  * Alle Werte aus der Adresse werden streng geprüft (Format, Port-Bereich); der Gerätename wird nur als Text gezeigt.
//  * Die Werte stehen hinter „#“ (gehen nicht an den Server) und werden nach dem Lesen aus der Adresse entfernt.
//    Für den Umweg über die Anmeldeseite merkt sich der Tab sie höchstens 10 Minuten (sessionStorage).
//  * Bestätigen nur per Klick; die Seite darf nicht in fremden Seiten eingebettet werden (X-Frame-Options DENY).

import { supabaseClient } from "./fenster";

type Fehler = { message: string } | null;
type Client = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Fehler }>;
  from: (t: string) => any;
  auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
};
type Anfrage = { c: string; p: number; s: string; g: string; zeit: number };

const SPEICHER = "gsra_app_verbinden";
const GUELTIG_MS = 10 * 60 * 1000;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text = "") => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text) e.textContent = text;
  return e;
};
const icon = (name: string) => {
  const i = el("i", `fa-solid ${name}`);
  i.setAttribute("aria-hidden", "true");
  return i;
};
const karte = () => document.getElementById("avKarte");

/** Gerätename: nur druckbare Zeichen, höchstens 60 */
export const geraetName = (roh: string) => roh.replace(/[\u0000-\u001f\u007f<>`"]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "PC";

/** Liest und prüft die Anfrage der App aus „#c=…&p=…&s=…&g=…“ */
export function anfrageLesen(hash: string, jetzt = Date.now()): Anfrage | null {
  const w = new URLSearchParams(hash.replace(/^#/, ""));
  const c = w.get("c") || "";
  const s = w.get("s") || "";
  const p = Number(w.get("p"));
  if (!/^[A-Za-z0-9_-]{43}$/.test(c) || !/^[A-Za-z0-9_-]{22,64}$/.test(s)) return null;
  if (!Number.isInteger(p) || p < 1024 || p > 65535) return null;
  return { c, p, s, g: geraetName(w.get("g") || ""), zeit: jetzt };
}

function merken(a: Anfrage) {
  try { sessionStorage.setItem(SPEICHER, JSON.stringify(a)); } catch { /* privater Modus: dann ohne Umweg */ }
}
function gemerkt(): Anfrage | null {
  try {
    const roh = JSON.parse(sessionStorage.getItem(SPEICHER) || "null") as Anfrage | null;
    if (!roh || Date.now() - Number(roh.zeit) > GUELTIG_MS) return null;
    const a = anfrageLesen(`c=${roh.c}&p=${roh.p}&s=${roh.s}&g=${encodeURIComponent(roh.g)}`, Number(roh.zeit));
    return a;
  } catch {
    return null;
  }
}
function vergessen() {
  try { sessionStorage.removeItem(SPEICHER); } catch { /* egal */ }
}

function zeigen(...inhalt: Node[]) {
  karte()?.replaceChildren(...inhalt);
}

function hinweis(titel: string, text: string, ic = "fa-circle-info") {
  const kopf = el("h2");
  kopf.append(icon(ic), ` ${titel}`);
  zeigen(kopf, el("p", "av-text", text));
}

async function bestaetigen(sb: Client, a: Anfrage, knopf: HTMLButtonElement) {
  knopf.disabled = true;
  knopf.textContent = "Wird verbunden …";
  const { data, error } = await sb.rpc("app_link_approve", { _challenge: a.c, _geraet: a.g });
  const code = typeof data === "string" ? data : "";
  if (error || !/^[0-9a-f]{64}$/.test(code)) {
    knopf.disabled = false;
    knopf.textContent = "Ja, App anmelden";
    const f = karte()?.querySelector(".av-fehler") || el("p", "av-fehler");
    f.textContent = error?.message || "Das hat nicht geklappt. Bitte versuche es noch einmal.";
    karte()?.append(f);
    return;
  }
  vergessen();
  hinweis("Fertig – zurück zur App", "Die GSRA-App auf diesem PC wird jetzt angemeldet. Du kannst diesen Tab danach schließen. Meldet sich die App nicht? Prüfe, ob sie noch läuft, und starte die Anmeldung dort neu.", "fa-circle-check");
  // Nur an die App auf diesem PC (feste Adresse 127.0.0.1, geprüfter Port)
  window.location.href = `http://127.0.0.1:${a.p}/gsra-anmeldung?a=${code}&s=${a.s}`;
}

async function starten() {
  // Anfrage aus der Adresse lesen und sofort aus der Adresse entfernen
  let a: Anfrage | null = null;
  if (location.hash.length > 1) {
    a = anfrageLesen(location.hash);
    history.replaceState(null, "", location.pathname + location.search);
    if (a) merken(a);
  }
  a ??= gemerkt();
  if (!a) {
    hinweis("Bitte in der App starten", "Diese Seite öffnet die GSRA-App für dich. Klicke in der App auf „Mit der Webseite anmelden“ – dann kommst du automatisch hierher. War die Anfrage älter als 10 Minuten, starte sie bitte neu.", "fa-desktop");
    return;
  }
  const sb = supabaseClient<Client>();
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  const ich = data.session?.user.id;
  if (!ich) {
    // Die Kopfzeile zeigt den Anmelde-Hinweis; nach der Anmeldung geht es mit der gemerkten Anfrage weiter
    hinweis("Bitte zuerst anmelden", "Melde dich auf der Webseite an. Danach kommst du hierher zurück und bestätigst die App mit einem Klick.", "fa-right-to-bracket");
    return;
  }
  const { data: profil } = await sb.from("profiles").select("username").eq("id", ich).maybeSingle();
  const name = (profil as { username?: string } | null)?.username || "dein Konto";

  const kopf = el("h2");
  kopf.append(icon("fa-desktop"), " GSRA-App anmelden?");
  const frage = el("p", "av-text");
  frage.append("Die GSRA-App auf ", el("strong", "", a.g), " möchte sich mit ", el("strong", "", name), " anmelden.");
  const warnung = el("p", "av-warnung");
  warnung.append(icon("fa-triangle-exclamation"), " Bestätige nur, wenn du gerade selbst in der GSRA-App auf „Mit der Webseite anmelden“ geklickt hast. Hat dir jemand diesen Link geschickt, brich ab.");
  const ja = el("button", "gsra-dialog-btn primary", "Ja, App anmelden");
  ja.type = "button";
  const nein = el("button", "gsra-dialog-btn secondary", "Abbrechen");
  nein.type = "button";
  const aktionen = el("div", "gsra-dialog-actions av-aktionen");
  aktionen.append(nein, ja);
  ja.addEventListener("click", () => void bestaetigen(sb, a, ja));
  nein.addEventListener("click", () => {
    vergessen();
    hinweis("Abgebrochen", "Die App wurde nicht angemeldet. Du kannst dieses Fenster schließen.", "fa-ban");
  });
  zeigen(kopf, frage, warnung, aktionen);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void starten());
else void starten();
// Ist die Seite schon offen und die App schickt eine neue Anfrage (nur der Teil nach „#“ ändert sich)
window.addEventListener("hashchange", () => {
  if (location.hash.length > 1) void starten();
});
