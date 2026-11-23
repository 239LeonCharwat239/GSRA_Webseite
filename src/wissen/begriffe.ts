// GSRA – Nachschlagewerk: alle Begriffe aus den Kategorie-Dateien.
// Die globale Suche lädt diese Datei erst beim ersten Suchen nach (src/suche.ts) – jede Seite bleibt schlank.
// Eindeutige ids und gültige „Siehe auch“-Verweise prüft tests/wissen/begriffe.mjs (Teil von „npm run pruefen“).
import { AERODYNAMIK } from "./aerodynamik";
import { ANTRIEB } from "./antrieb";
import { BREMSEN } from "./bremsen";
import { FAHRTECHNIK } from "./fahrtechnik";
import { FAHRWERK } from "./fahrwerk";
import { REIFEN } from "./reifen";
import { SIMRACING } from "./simracing";
import { STRATEGIE } from "./strategie";
import type { Begriff } from "./begriff";

export { BEGRIFF_KATEGORIEN, type Begriff, type Kategorie } from "./begriff";

export const BEGRIFFE: Begriff[] = [
  ...FAHRWERK, ...AERODYNAMIK, ...REIFEN, ...BREMSEN, ...ANTRIEB, ...FAHRTECHNIK, ...STRATEGIE, ...SIMRACING,
];
