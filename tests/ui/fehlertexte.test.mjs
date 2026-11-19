// Prüft den Übersetzer für Fehlermeldungen aus ui-dialogs.js (Sicherheitsbericht Nr. 15), ohne Browser.
// Deutsche Meldungen der Datenbank müssen unverändert bleiben, technische Texte werden verständlich übersetzt.
// Start im Hauptordner: node tests/ui/fehlertexte.test.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "ui-dialogs.js"), "utf8");
const start = src.indexOf("const GSRA_FRIENDLY_ERRORS");
const end = src.indexOf("window.gsraFriendlyError");
if (start < 0 || end < 0) {
    console.log("FEHLER Übersetzer in ui-dialogs.js nicht gefunden");
    process.exit(1);
}
globalThis.window = {};
const warn = console.warn;
console.warn = () => {};
const friendly = new Function(`${src.slice(start, end)}; return gsraFriendlyError;`)();

const cases = [
    // [Eingabe, erwartet: "gleich" = unverändert, sonst ein Teil des Ergebnisses]
    ["Du hast schon 5 offene Anfragen. Warte bitte auf eine Antwort, bevor du weitere stellst.", "gleich"],
    ["Dieser Termin ist leider nicht mehr frei. Bitte wähle einen anderen.", "gleich"],
    ["Bitte melde dich an.", "gleich"],
    ["Der Status konnte nicht geändert werden.", "gleich"],
    ["Zu viele Anfragen in kurzer Zeit. Bitte versuche es später erneut.", "gleich"],
    ["Unbekannte Zeitzone.", "gleich"],
    ["Das Stripe-Konto konnte nicht angelegt werden. Stripe meldet: Your card was declined.", "gleich"],
    ["TypeError: Failed to fetch", "Keine Verbindung"],
    ["permission denied for table setups", "Berechtigung"],
    ["new row violates row-level security policy for table \"objects\"", "Berechtigung"],
    ["JWT expired", "Anmeldung ist abgelaufen"],
    ["duplicate key value violates unique constraint \"profiles_username_key\"", "gibt es bereits"],
    ["Could not find the function public.foo in the schema cache", "nicht verfügbar"],
    ["new row for relation \"profiles\" violates check constraint \"profiles_country_check\"", "Eingabe ist ungültig"],
    ["Fehler beim Löschen: permission denied for table setups", "Fehler beim Löschen: Dafür fehlt"],
    ["Speichern nicht möglich: duplicate key value violates unique constraint", "Speichern nicht möglich: Das gibt es bereits"],
    ["The object exceeded the maximum allowed size", "zu groß"],
    ["Unexpected token < in JSON at position 0", "nicht geklappt"],
    ["Something went wrong", "nicht geklappt"],
    ["", "nicht geklappt"]
];
let failures = 0;
for (const [input, expect] of cases) {
    const out = friendly(input);
    const ok = expect === "gleich" ? out === input : out.includes(expect);
    if (!ok) failures++;
    console.log(`${ok ? "OK    " : "FEHLER"} ${JSON.stringify(input).slice(0, 70)} → ${out}`);
}
console.warn = warn;
console.log(failures === 0 ? "\nALLE PRÜFUNGEN BESTANDEN" : `\n${failures} PRÜFUNG(EN) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
