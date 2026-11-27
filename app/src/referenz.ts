// Referenzrunden der GSRA (SQL 060, Wunsch 27./28.11.): schnelle Runden je Strecke und Auto, damit der Renningenieur
// gegen echte Bestwerte vergleicht – nicht nur eigene Runden gegeneinander.
//  * Eigene Runde: nur auf Klick („Als Referenz teilen“), mit Tempo, Gas und Bremse; angezeigt anonym.
//  * Schnellste Runde eines anderen Autos aus der Sitzung: automatisch und anonym (ohne Name, Startnummer, Kennung) –
//    abschaltbar. Von fremden Autos gibt es nur die Zeit über die Strecke, keine Pedale.
// Gespeichert werden je Runde 201 Stützstellen (alle 0,5 % der Strecke). Prüfen und begrenzen tut die Datenbank.
import { RASTER, type Spur } from "./analyse.ts";
import type { FeldRunde } from "./feldreferenz.ts";
import { sb } from "./konto.ts";

export const PUNKTE = 201;

/** RASTER+1 Werte → 201 Werte (lineare Zwischenwerte), mal Faktor, auf 3 Nachkommastellen */
export function verdichten(werte: ArrayLike<number>, faktor = 1): number[] {
  const n = werte.length - 1;
  return Array.from({ length: PUNKTE }, (_, i) => {
    const x = (i / (PUNKTE - 1)) * n;
    const a = Math.floor(x);
    const b = Math.min(n, a + 1);
    const f = x - a;
    const w = ((werte[a] ?? 0) * (1 - f) + (werte[b] ?? 0) * f) * faktor;
    return Math.round((Number.isFinite(w) ? w : 0) * 1000) / 1000;
  });
}

/** 201 Werte → RASTER+1 Werte (für den Vergleich mit eigenen Runden) */
export function aufRaster(werte: number[]): Float64Array {
  const t = new Float64Array(RASTER + 1);
  for (let i = 0; i <= RASTER; i++) {
    const x = (i / RASTER) * (werte.length - 1);
    const a = Math.floor(x);
    const b = Math.min(werte.length - 1, a + 1);
    t[i] = werte[a] * (1 - (x - a)) + werte[b] * (x - a);
  }
  return t;
}

/** Zeitverlauf für die Datenbank: beginnt bei 0, steigt nie (Messrauschen glätten) */
export function zeitverlauf(t: ArrayLike<number>): number[] {
  const v = verdichten(t);
  const start = v[0];
  let vorher = 0;
  return v.map((x) => (vorher = Math.max(vorher, Math.round((x - start) * 1000) / 1000)));
}

const begrenzt = (werte: number[], max: number) => werte.map((w) => Math.max(0, Math.min(max, w)));

export type Referenz = {
  id: string;
  zeit: number;
  quelle: "eigen" | "feld";
  eigene: boolean;
  /** Zeit ab Rundenbeginn an RASTER+1 Punkten */
  t: Float64Array;
  laengeM: number | null;
};

export type SitzungsInfo = { strecke: string | null; fahrzeug: string | null; laengeM: number | null };

/** Die schnellsten Referenzrunden für Strecke und Auto (angemeldet; sonst leer) */
export async function referenzenLaden(s: SitzungsInfo, anzahl = 5): Promise<Referenz[]> {
  if (!s.strecke || !s.fahrzeug) return [];
  const { data, error } = await sb().rpc("reference_laps_get", { _strecke: s.strecke, _fahrzeug: s.fahrzeug, _anzahl: anzahl });
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>)
    .filter((r) => Array.isArray(r.zeitverlauf) && (r.zeitverlauf as unknown[]).length === PUNKTE)
    .map((r) => ({
      id: String(r.id),
      zeit: Number(r.zeit_s),
      quelle: r.quelle === "feld" ? "feld" : "eigen",
      eigene: r.eigene === true,
      t: aufRaster((r.zeitverlauf as unknown[]).map(Number)),
      laengeM: r.laenge_m == null ? null : Number(r.laenge_m),
    }));
}

/** Eigene Runde als Referenz teilen (nur auf Klick); Antwort: Kennung oder null (zu langsam für die besten 50) */
export async function eigeneRundeTeilen(s: SitzungsInfo, zeit: number, spur: Spur): Promise<string | null> {
  const { data, error } = await sb().rpc("reference_lap_add", {
    _strecke: s.strecke, _fahrzeug: s.fahrzeug, _laenge_m: s.laengeM, _zeit_s: zeit, _quelle: "eigen",
    _zeitverlauf: zeitverlauf(spur.t),
    _tempo: begrenzt(verdichten(spur.v, 3.6), 500),
    _gas: begrenzt(verdichten(spur.g, 100), 100),
    _bremse: begrenzt(verdichten(spur.b, 100), 100),
  });
  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : null;
}

/** Schnellste Runde eines anderen Autos anonym teilen (ohne Name, Nummer, Kennung) */
export async function feldRundeTeilen(s: SitzungsInfo, f: FeldRunde): Promise<string | null> {
  const { data, error } = await sb().rpc("reference_lap_add", {
    _strecke: s.strecke, _fahrzeug: s.fahrzeug, _laenge_m: s.laengeM, _zeit_s: f.zeit, _quelle: "feld",
    _zeitverlauf: zeitverlauf(f.t),
  });
  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : null;
}

/** Eigene geteilte Referenzrunde wieder löschen (nur die eigenen; die Datenbank prüft das) */
export async function referenzLoeschen(id: string): Promise<boolean> {
  const { data, error } = await sb().rpc("reference_lap_delete", { _id: id });
  if (error) throw new Error(error.message);
  return data === true;
}
