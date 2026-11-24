// GSRA – Nachschlagewerk: Datentyp und Kategorien. Die Inhalte liegen je Kategorie in einer eigenen Datei
// (src/wissen/*.ts) und werden in src/wissen/begriffe.ts zusammengeführt.
// Redaktionelle Regeln: sachlich, ausführlich und präzise; Tipps in der „du“-Form; keine Namen anderer Anbieter
// (außer Simulationen). Reiner Text – die Seite gibt alles mit textContent aus, nie als HTML.
// Später können je Begriff Videos dazukommen (eigenes Feld, nur Links auf eigene Inhalte).

export const BEGRIFF_KATEGORIEN = [
  "Fahrwerk & Kinematik",
  "Aerodynamik",
  "Reifen & Grip",
  "Bremsen & Elektronik",
  "Antrieb, Motor & Getriebe",
  "Fahrtechnik & Fahrdynamik",
  "Renntaktik, Strategie & Regeln",
  "Simracing & Telemetrie",
  "Telemetrie & Datenanalyse",
  "Elektrik, Sensorik & Cockpit",
  "Strecke, Asphalt & Wetter",
  "Rennklassen & Fahrzeugkonzepte",
  "Rennbetrieb, Sicherheit & Team",
] as const;

export type Kategorie = (typeof BEGRIFF_KATEGORIEN)[number];

export type Begriff = {
  id: string; // Kleinbuchstaben, Ziffern, Bindestriche – zugleich Sprungmarke (nachschlagewerk.html#id)
  begriff: string; // deutscher Name
  englisch?: string; // englische bzw. weitere gebräuchliche Bezeichnungen
  kategorie: Kategorie;
  kurz: string; // ein Satz für Liste und Suche
  text: string[]; // ausführliche Erklärung, ein Eintrag je Absatz
  tipp?: string; // Praxis im Simracing und im Setup
  siehe?: string[]; // verwandte Begriffe (ids)
};

export type Eintrag = Omit<Begriff, "kategorie">;

export const kategorie = (k: Kategorie, liste: Eintrag[]): Begriff[] => liste.map((e) => ({ ...e, kategorie: k }));
