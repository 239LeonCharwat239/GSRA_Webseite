// GSRA – Typen für die TypeScript-Prüfung der Webseite (tsconfig.json, Sicherheitsbericht Nr. 17).
// Die Seite ist reines JavaScript ohne Build-Schritt; diese Datei beschreibt nur, was die Skripte untereinander teilen.

// Gemeinsame Funktionen und Objekte, die sich die Skripte über window teilen
// (Supabase-Client, Dialoge, Bot-Schutz, Datumsauswahl, Bewertungen …). Bewusst offen gehalten.
interface Window {
  [key: string]: any;
}

// Der Supabase-Client: supabase-client.js legt ihn als window.supabaseClient und window.supabase ab
// (vorher ist window.supabase die Bibliothek vom CDN mit createClient).
declare var supabaseClient: any;
declare var supabase: any;

// Schritt 1: Elemente aus getElementById/querySelector werden in diesem Projekt fast immer als Formularfelder,
// Knöpfe oder Links benutzt. Statt hunderter einzelner Umwandlungen gelten diese Eigenschaften hier für alle
// Elemente. Strengere Typen folgen Datei für Datei (Schritt 2).
interface Element {
  value: any;
  checked: boolean;
  disabled: boolean;
  required: boolean;
  readOnly: boolean;
  hidden: boolean | "until-found" | string;
  title: string;
  name: any;
  type: any;
  href: any;
  src: any;
  alt: any;
  placeholder: string;
  maxLength: number;
  inputMode: string;
  autocomplete: any;
  files: FileList | null;
  dataset: DOMStringMap;
  style: CSSStyleDeclaration;
  offsetParent: Element | null;
  offsetTop: number;
  offsetHeight: number;
  offsetWidth: number;
  focus(options?: FocusOptions): void;
  blur(): void;
  click(): void;
  select(): void;
}

// Ereignisse: Ziel ist im Projekt immer ein Element, Tastatur-/Maus-Daten werden direkt gelesen
interface EventTarget {
  closest?: any;
  matches?: any;
  value?: any;
  dataset?: DOMStringMap;
  classList?: DOMTokenList;
}
interface Event {
  key?: any;
  clientX?: any;
  clientY?: any;
  dataTransfer?: any;
  submitter?: any;
  // Eigene Ereignisse (z. B. „emoji-click“ der Emoji-Auswahl) tragen ihre Daten in detail
  detail?: any;
}

// Emoji-Auswahl (Web-Komponente vom CDN): deutsche Texte werden über i18n gesetzt
interface GsraEmojiPicker extends HTMLElement {
  i18n: any;
}
interface HTMLElementTagNameMap {
  "emoji-picker": GsraEmojiPicker;
}

// Emoji-Auswahl: deutsche Texte werden direkt vom CDN geladen (feste Version)
declare module "https://cdn.jsdelivr.net/npm/emoji-picker-element@1.29.1/i18n/de.js" {
  const de: any;
  export default de;
}
