// Emoji-Auswahl auf Deutsch ("Suchen", Kategorien) – gilt auch für die Reaktions-Auswahl.
// Eigene Datei, damit die Sicherheitsregeln (CSP) eingebettete Skripte verbieten können.
import de from "https://cdn.jsdelivr.net/npm/emoji-picker-element@1.29.1/i18n/de.js";

window.gsraEmojiI18n = de;
document.querySelectorAll("emoji-picker").forEach(picker => { picker.i18n = de; });
