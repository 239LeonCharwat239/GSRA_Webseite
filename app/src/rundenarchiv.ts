// Rundenarchiv (Wunsch 26.11.: „Kärtchen für Strecken – schnellste und letzte Runden, über Sitzungen hinweg
// vergleichen“). Jede Runde aus einer echten Sitzung wird auf diesem PC gespeichert (IndexedDB, nichts geht ins Netz):
//  * je Strecke und Auto die 5 schnellsten gültigen Runden und die 20 letzten Runden – ältere werden gelöscht;
//  * gespeichert werden die Messpunkte (höchstens 2.000 je Runde, als 32-Bit-Zahlen, etwa 64 KB), daraus entstehen
//    Vergleich, Diagramme und Streckenkarte genau wie bei Runden der laufenden Sitzung.
import type { Punkt, Runde } from "./runden.ts";

export type ArchivRunde = {
  id?: number;
  strecke: string;
  fahrzeug: string | null;
  laengeM: number | null;
  sitzung: string | null;
  datum: string;
  nr: number;
  zeit: number;
  gueltig: boolean;
  grund: string | null;
  /** je Punkt 8 Werte: a, t, v, g, b, gang, l, r */
  daten: Float32Array;
};
export type StreckenKarte = { strecke: string; runden: number; beste: number | null; besteAuto: string | null; zuletzt: string; autos: string[] };

export const MAX_PUNKTE = 2000;
export const BESTE_JE_AUTO = 5;
export const LETZTE_JE_AUTO = 20;
const DB = "gsra-rundenarchiv";
const SPEICHER = "runden";

/** Messpunkte verdichten: höchstens max Punkte (jeder k-te, der letzte bleibt immer) */
export function packen(punkte: Punkt[], max = MAX_PUNKTE): Float32Array {
  const schritt = Math.max(1, Math.ceil(punkte.length / max));
  const auswahl = punkte.filter((_, i) => i % schritt === 0 || i === punkte.length - 1);
  const d = new Float32Array(auswahl.length * 8);
  auswahl.forEach((p, i) => d.set([p.a, p.t, p.v, p.g, p.b, p.gang, p.l, p.r], i * 8));
  return d;
}
export function entpacken(d: Float32Array): Punkt[] {
  const p: Punkt[] = [];
  for (let i = 0; i + 7 < d.length; i += 8) p.push({ a: d[i], t: d[i + 1], v: d[i + 2], g: d[i + 3], b: d[i + 4], gang: d[i + 5], l: d[i + 6], r: d[i + 7] });
  return p;
}
export function alsRunde(a: ArchivRunde): Runde {
  return { nr: a.nr, zeit: a.zeit, gueltig: a.gueltig, grund: a.grund, sprit: null, spritEnde: null, inBox: false, punkte: entpacken(a.daten) };
}

/** Welche Runden einer Strecke bleiben? Je Auto die schnellsten gültigen und die letzten – Rückgabe: zu löschende ids */
export function aufraeumen(liste: ArchivRunde[]): number[] {
  const bleibt = new Set<number>();
  const autos = new Map<string, ArchivRunde[]>();
  for (const r of liste) autos.set(r.fahrzeug ?? "", [...(autos.get(r.fahrzeug ?? "") ?? []), r]);
  for (const runden of autos.values()) {
    runden.filter((r) => r.gueltig).sort((a, b) => a.zeit - b.zeit).slice(0, BESTE_JE_AUTO).forEach((r) => bleibt.add(r.id!));
    [...runden].sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, LETZTE_JE_AUTO).forEach((r) => bleibt.add(r.id!));
  }
  return liste.filter((r) => r.id != null && !bleibt.has(r.id)).map((r) => r.id!);
}

/** Kärtchen je Strecke: Anzahl, Bestzeit (mit Auto), zuletzt gefahren */
export function streckenKarten(liste: ArchivRunde[]): StreckenKarte[] {
  const m = new Map<string, StreckenKarte>();
  for (const r of liste) {
    const k = m.get(r.strecke) ?? { strecke: r.strecke, runden: 0, beste: null, besteAuto: null, zuletzt: r.datum, autos: [] };
    k.runden++;
    if (r.gueltig && (k.beste == null || r.zeit < k.beste)) { k.beste = r.zeit; k.besteAuto = r.fahrzeug; }
    if (r.datum > k.zuletzt) k.zuletzt = r.datum;
    if (r.fahrzeug && !k.autos.includes(r.fahrzeug)) k.autos.push(r.fahrzeug);
    m.set(r.strecke, k);
  }
  return [...m.values()].sort((a, b) => b.zuletzt.localeCompare(a.zuletzt));
}

// ---------------------------------------------------------------- IndexedDB
function oeffnen(): Promise<IDBDatabase> {
  return new Promise((ok, fehler) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const s = r.result.createObjectStore(SPEICHER, { keyPath: "id", autoIncrement: true });
      s.createIndex("strecke", "strecke");
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fehler(r.error);
  });
}
const anfrage = <T>(r: IDBRequest<T>) => new Promise<T>((ok, fehler) => { r.onsuccess = () => ok(r.result); r.onerror = () => fehler(r.error); });

/** Alle Runden (ohne Messpunkte wäre schneller – bei 25 Runden je Auto und Strecke ist das unkritisch) */
export async function alleRunden(): Promise<ArchivRunde[]> {
  const db = await oeffnen();
  return anfrage(db.transaction(SPEICHER).objectStore(SPEICHER).getAll() as IDBRequest<ArchivRunde[]>);
}
export async function rundenDerStrecke(strecke: string): Promise<ArchivRunde[]> {
  const db = await oeffnen();
  const liste = await anfrage(db.transaction(SPEICHER).objectStore(SPEICHER).index("strecke").getAll(strecke) as IDBRequest<ArchivRunde[]>);
  return liste.sort((a, b) => b.datum.localeCompare(a.datum));
}

/** Runde ablegen und die Strecke aufräumen. Nur echte Runden mit genug Messpunkten. */
export async function ablegen(r: Runde, info: { strecke: string | null; fahrzeug: string | null; laengeM: number | null; sitzung: string | null }): Promise<boolean> {
  const strecke = info.strecke?.trim().slice(0, 120);
  if (!strecke || r.punkte.length < 50 || !(r.zeit > 0)) return false;
  const eintrag: ArchivRunde = {
    strecke, fahrzeug: info.fahrzeug?.trim().slice(0, 120) || null, laengeM: info.laengeM, sitzung: info.sitzung?.slice(0, 40) ?? null,
    datum: new Date().toISOString(), nr: r.nr, zeit: r.zeit, gueltig: r.gueltig, grund: r.grund?.slice(0, 80) ?? null, daten: packen(r.punkte),
  };
  const db = await oeffnen();
  await anfrage(db.transaction(SPEICHER, "readwrite").objectStore(SPEICHER).add(eintrag));
  const weg = aufraeumen(await rundenDerStrecke(strecke));
  if (weg.length) {
    const t = db.transaction(SPEICHER, "readwrite");
    for (const id of weg) t.objectStore(SPEICHER).delete(id);
    await new Promise<void>((ok) => { t.oncomplete = () => ok(); t.onerror = () => ok(); });
  }
  return true;
}

export async function streckeLoeschen(strecke: string): Promise<void> {
  const db = await oeffnen();
  const ids = (await rundenDerStrecke(strecke)).map((r) => r.id!).filter((id) => id != null);
  const t = db.transaction(SPEICHER, "readwrite");
  for (const id of ids) t.objectStore(SPEICHER).delete(id);
  await new Promise<void>((ok) => { t.oncomplete = () => ok(); t.onerror = () => ok(); });
}
