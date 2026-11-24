// GSRA – Nachschlagewerk: alle Begriffe aus den Kategorie-Dateien.
// Die globale Suche lädt diese Datei erst beim ersten Suchen nach (src/suche.ts) – jede Seite bleibt schlank.
// Eindeutige ids und gültige „Siehe auch“-Verweise prüft tests/wissen/begriffe.mjs (Teil von „npm run pruefen“).
import { AERODYNAMIK } from "./aerodynamik";
import { ANTRIEB } from "./antrieb";
import { BREMSEN } from "./bremsen";
import { DATENANALYSE } from "./datenanalyse";
import { ELEKTRIK } from "./elektrik";
import { FAHRTECHNIK } from "./fahrtechnik";
import { FAHRWERK } from "./fahrwerk";
import { FAHRZEUGKONZEPTE } from "./fahrzeugkonzepte";
import { REIFEN } from "./reifen";
import { RENNBETRIEB } from "./rennbetrieb";
import { SIMRACING } from "./simracing";
import { STRATEGIE } from "./strategie";
import { STRECKE } from "./strecke";
import type { Begriff } from "./begriff";

export { BEGRIFF_KATEGORIEN, type Begriff, type Kategorie } from "./begriff";

export const BEGRIFFE: Begriff[] = [
  ...FAHRWERK, ...AERODYNAMIK, ...REIFEN, ...BREMSEN, ...ANTRIEB, ...FAHRTECHNIK, ...STRATEGIE, ...SIMRACING,
  ...DATENANALYSE, ...ELEKTRIK, ...STRECKE, ...FAHRZEUGKONZEPTE, ...RENNBETRIEB,
];
