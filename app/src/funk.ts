// Funk des Renningenieurs in der App – alles läuft auf dem PC, nichts wird hochgeladen.
//  * Sprachausgabe über die Stimmen des Systems (natürliche Stimmen zuerst).
//  * Funk-Klang: Klick und kurzes Rauschen vor und nach jedem Spruch, leises Rauschen darunter.
//  * Testaufnahme: eine eigene Sprachaufnahme (z. B. WhatsApp-Sprachnachricht) läuft durch einen echten Funk-Filter
//    (Bandbegrenzung wie ein Funkgerät, leichte Verzerrung, Kompressor). Die Datei wird nur gelesen, nicht gespeichert.
// Hinweis: Die Systemstimmen lassen sich technisch nicht durch den Filter schicken (der Browser gibt sie nicht als
// Ton-Daten heraus) – deshalb dort nur Klick und Rauschen. Mit einer KI-Stimme (später) geht der volle Filter.

import { LAENDERCODE, spracheVonText } from "./sprachen.ts";
import { zahlenAusschreiben, zumSprechen } from "./ansagen.ts";

export type Stimmlage = "ruhig" | "energisch" | "tief" | "hell";
/** namenAnKi: Namen anderer Fahrer an den KI-Renningenieur schicken (aus = nur Startnummern; Datenschutz) */
export type FunkEinstellungen = { vorlesen: boolean; klang: boolean; lautstaerke: number; stimme: string; spotter: boolean; namenAnKi: boolean };

const SPEICHER = "gsra_funk";
const STANDARD: FunkEinstellungen = { vorlesen: false, klang: true, lautstaerke: 0.8, stimme: "", spotter: true, namenAnKi: true };

export function funkLaden(): FunkEinstellungen {
  try {
    const roh = JSON.parse(localStorage.getItem(SPEICHER) || "{}") as Partial<FunkEinstellungen>;
    return {
      vorlesen: typeof roh.vorlesen === "boolean" ? roh.vorlesen : STANDARD.vorlesen,
      klang: typeof roh.klang === "boolean" ? roh.klang : STANDARD.klang,
      lautstaerke: typeof roh.lautstaerke === "number" && roh.lautstaerke >= 0 && roh.lautstaerke <= 1 ? roh.lautstaerke : STANDARD.lautstaerke,
      stimme: typeof roh.stimme === "string" ? roh.stimme.slice(0, 200) : "",
      spotter: typeof roh.spotter === "boolean" ? roh.spotter : STANDARD.spotter,
      namenAnKi: typeof roh.namenAnKi === "boolean" ? roh.namenAnKi : STANDARD.namenAnKi,
    };
  } catch {
    return { ...STANDARD };
  }
}
export function funkSpeichern(e: FunkEinstellungen): void {
  try { localStorage.setItem(SPEICHER, JSON.stringify(e)); } catch { /* privater Modus: dann eben nur für diese Sitzung */ }
}

// ---------------------------------------------------------------- Ton-Bausteine (Web Audio)
let ctx: AudioContext | null = null;
function audio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function rauschen(c: AudioContext, sekunden: number): AudioBuffer {
  const p = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * sekunden)), c.sampleRate);
  const d = p.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return p;
}

/** Funkgerät nachbilden: nur das Sprachband (≈ 300–3.400 Hz), mittig betont, leicht übersteuert, stark komprimiert */
function funkKette(c: AudioContext, ziel: AudioNode): AudioNode {
  const hoch = new BiquadFilterNode(c, { type: "highpass", frequency: 320, Q: 0.8 });
  const tief = new BiquadFilterNode(c, { type: "lowpass", frequency: 3300, Q: 0.9 });
  const mitte = new BiquadFilterNode(c, { type: "peaking", frequency: 1700, Q: 1.1, gain: 6 });
  const kurve = new Float32Array(1024);
  for (let i = 0; i < kurve.length; i++) { const x = (i / (kurve.length - 1)) * 2 - 1; kurve[i] = Math.tanh(2.4 * x) / Math.tanh(2.4); }
  const verzerrung = new WaveShaperNode(c, { curve: kurve, oversample: "2x" });
  const kompressor = new DynamicsCompressorNode(c, { threshold: -26, knee: 6, ratio: 8, attack: 0.003, release: 0.12 });
  hoch.connect(tief).connect(mitte).connect(verzerrung).connect(kompressor).connect(ziel);
  return hoch;
}

/** Klick + kurzes Rauschen (Taste am Funkgerät gedrückt bzw. losgelassen) */
function funkKlick(c: AudioContext, ziel: AudioNode, wann: number, lautstaerke: number, lang = 0.11): void {
  const quelle = new AudioBufferSourceNode(c, { buffer: rauschen(c, lang) });
  const band = new BiquadFilterNode(c, { type: "bandpass", frequency: 2200, Q: 0.7 });
  const g = new GainNode(c, { gain: 0 });
  g.gain.setValueAtTime(0, wann);
  g.gain.linearRampToValueAtTime(0.35 * lautstaerke, wann + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, wann + lang);
  quelle.connect(band).connect(g).connect(ziel);
  quelle.start(wann);
  const ton = new OscillatorNode(c, { type: "square", frequency: 1250 });
  const tg = new GainNode(c, { gain: 0 });
  tg.gain.setValueAtTime(0.06 * lautstaerke, wann);
  tg.gain.exponentialRampToValueAtTime(0.0005, wann + 0.035);
  ton.connect(tg).connect(ziel);
  ton.start(wann);
  ton.stop(wann + 0.04);
}

/** Leises Funk-Rauschen unter einem Spruch; gibt eine Funktion zum Ausblenden zurück */
function rauschBett(c: AudioContext, lautstaerke: number): () => void {
  const quelle = new AudioBufferSourceNode(c, { buffer: rauschen(c, 2), loop: true });
  const band = new BiquadFilterNode(c, { type: "bandpass", frequency: 1800, Q: 0.5 });
  const g = new GainNode(c, { gain: 0 });
  g.gain.linearRampToValueAtTime(0.025 * lautstaerke, c.currentTime + 0.05);
  quelle.connect(band).connect(g).connect(c.destination);
  quelle.start();
  return () => {
    const t = c.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.08);
    quelle.stop(t + 0.1);
  };
}

// ---------------------------------------------------------------- Sprachausgabe
/** Stimmen für eine Sprache, die natürlichsten zuerst (neuronale/Online-Stimmen klingen am menschlichsten) */
export function stimmenFuer(sprache: string): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  const code = (sprache || "de").slice(0, 2).toLowerCase();
  const rang = (v: SpeechSynthesisVoice) => (/natural|neural/i.test(v.name) ? 0 : /online/i.test(v.name) ? 1 : !v.localService ? 2 : 3);
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(code)).sort((a, b) => rang(a) - rang(b));
}

/** Gibt es auf diesem PC Stimmen, aber keine für die Sprache? Dann lieber schweigen als mit fremder Stimme
 *  vorlesen (Fund 26.11.: Bulgarisch wurde von der deutschen Stimme gelesen). Leere Liste = Stimmen noch nicht geladen. */
export function stimmeFehlt(sprache: string): boolean {
  if (!("speechSynthesis" in window)) return false;
  return window.speechSynthesis.getVoices().length > 0 && stimmenFuer(sprache).length === 0;
}
let fehltMelden: ((sprache: string) => void) | null = null;
/** Wird aufgerufen, wenn für eine Sprache keine Stimme installiert ist (Hinweis in der App) */
export function beiFehlenderStimme(f: (sprache: string) => void): void {
  fehltMelden = f;
}

/** Eigene (geklonte) Stimme aus der App (stimme.rs): erzeugt den Ton auf dem PC; null = Systemstimmen */
export type EigeneStimme = {
  sprache: string;
  erzeugen: (text: string) => Promise<{ rate: number; ton: Float32Array }>;
  /** laufende Erzeugung in der App abbrechen (veralteter Spruch) */
  abbrechen?: () => void;
};
type Ton = { rate: number; ton: Float32Array };
let eigene: EigeneStimme | null = null;
// Kurze Sätze der eigenen Stimme bleiben fertig erzeugt im Speicher („Moment, ich schau nach.“) – kommen dann sofort
const tonSpeicher = new Map<string, Promise<Ton>>();
const SPEICHER_MAX = 60;
const SPEICHER_LAENGE = 90;
export function eigeneStimmeSetzen(s: EigeneStimme | null): void {
  eigene = s;
  tonSpeicher.clear();
}

/** Text für die eigene Stimme: wie zum Vorlesen aufbereitet, Zahlen in Worten (die Stimme liest keine Ziffern) */
const fuerEigene = (satz: string, sprache: string) => zahlenAusschreiben(zumSprechen(satz, sprache));

function eigenerTon(stimme: EigeneStimme, text: string): Promise<Ton> {
  const da = tonSpeicher.get(text);
  if (da) {
    tonSpeicher.delete(text);
    tonSpeicher.set(text, da); // zuletzt benutzt nach hinten
    return da;
  }
  const p = stimme.erzeugen(text);
  if (text.length <= SPEICHER_LAENGE) {
    tonSpeicher.set(text, p);
    p.catch(() => tonSpeicher.delete(text));
    while (tonSpeicher.size > SPEICHER_MAX) tonSpeicher.delete(tonSpeicher.keys().next().value as string);
  }
  return p;
}

/** Kurze Sätze vorab mit der eigenen Stimme erzeugen (im Leerlauf, einer nach dem anderen) */
export async function vorwaermen(saetzeListe: string[]): Promise<void> {
  for (const s of saetzeListe) {
    const stimme = eigene;
    if (!stimme) return;
    while (aktuell) await new Promise((ok) => window.setTimeout(ok, 500)); // Funk hat Vorrang
    await eigenerTon(stimme, fuerEigene(s, stimme.sprache)).catch(() => undefined);
  }
}

/** Text in Sätze teilen – so beginnt der Funk mit dem ersten Satz, während die nächsten noch entstehen.
 *  „23. Runde“ wird nicht geteilt (Punkt nach einer Zahl), sehr lange Sätze an Komma oder Gedankenstrich. */
export function saetze(text: string): string[] {
  const teile = text.replace(/\s+/g, " ").trim().split(/(?<=[^\d\s][.!?…])\s+(?=\S)/u);
  const ergebnis: string[] = [];
  for (let s of teile) {
    while (s.length > 160) {
      const mitte = s.length / 2;
      const stellen = [...s.matchAll(/, | – | - /g)].map((m) => m.index! + 1).filter((i) => i > 30 && i < s.length - 30);
      if (!stellen.length) break;
      const i = stellen.reduce((b, x) => (Math.abs(x - mitte) < Math.abs(b - mitte) ? x : b));
      ergebnis.push(s.slice(0, i).trim());
      s = s.slice(i).replace(/^[–-]\s*/, "").trim();
    }
    if (s) ergebnis.push(s);
  }
  return ergebnis;
}

/** Für die eigene Stimme: Sätze unter 30 Zeichen an den nächsten hängen (fertige kurze Sätze aus dem Speicher bleiben einzeln) */
export function stueckeFuerEigene(liste: string[], fertig: (s: string) => boolean = () => false): string[] {
  const ergebnis: string[] = [];
  let offen = "";
  for (const s of liste) {
    offen = offen ? `${offen} ${s}` : s;
    if (offen.length >= 30 || fertig(offen)) {
      ergebnis.push(offen);
      offen = "";
    }
  }
  if (offen) {
    if (ergebnis.length && !fertig(offen)) ergebnis[ergebnis.length - 1] += ` ${offen}`;
    else ergebnis.push(offen);
  }
  return ergebnis;
}

// ---------------------------------------------------------------- Warteschlange (Fund 26.11.: Sprüche schnitten sich ab)
// Sprüche laufen nacheinander. Wartet mehr als MAX_WARTEND, fällt der älteste wartende weg (veraltete Rundenmeldung).
// Nur funkStoppen() und Sprüche mit „sofort“ (Probe-Knöpfe) brechen den laufenden ab. Der Spotter ruft dazwischen:
// Die Systemstimme wiederholt danach den unterbrochenen Satz, die eigene Stimme wird währenddessen nur leiser.
export type SprechOptionen = { sprache?: string; stimmlage?: Stimmlage; sofort?: boolean };
type Auftrag = { saetze: string[]; sprache: string; e: FunkEinstellungen; opt: SprechOptionen; index: number; abgebrochen: boolean; fertig: () => void };
const MAX_WARTEND = 3;
const warteschlange: Auftrag[] = [];
let aktuell: Auftrag | null = null;
let aktiveQuelle: AudioBufferSourceNode | null = null;
let ingenieurPegel: GainNode | null = null;
let spotterAktiv = false;
let spotterEnde: Promise<void> = Promise.resolve();

/** Läuft gerade ein Spruch oder wartet einer? */
export const funkBeschaeftigt = () => Boolean(aktuell) || warteschlange.length > 0;

export function funkStoppen(): void {
  for (const w of warteschlange.splice(0)) {
    w.abgebrochen = true;
    w.fertig();
  }
  if (aktuell) aktuell.abgebrochen = true;
  eigene?.abbrechen?.();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  aktiveQuelle?.stop();
  aktiveQuelle = null;
  aktiveAufnahme?.stop();
  aktiveAufnahme = null;
}

/** Spruch vorlesen – mit Funk-Klang, wenn eingeschaltet. Läuft schon einer, kommt dieser danach dran. */
export function sprechen(text: string, e: FunkEinstellungen, opt: SprechOptionen = {}): Promise<void> {
  const roh = text.replace(/\s+/g, " ").trim().slice(0, 2400);
  if (!roh || !("speechSynthesis" in window)) return Promise.resolve();
  // „Automatisch“: Stimme in der Sprache der Antwort (sonst Deutsch)
  const sprache = opt.sprache === "auto" ? (spracheVonText(roh) ?? "de") : opt.sprache || "de";
  if (opt.sofort) funkStoppen();
  return new Promise((fertig) => {
    warteschlange.push({ saetze: saetze(roh), sprache, e, opt, index: 0, abgebrochen: false, fertig });
    while (warteschlange.length > MAX_WARTEND) {
      // der älteste wartende fällt weg – aber nie einer, der ausdrücklich sofort kommen soll (Probe-Knöpfe)
      const i = warteschlange.findIndex((w) => !w.opt.sofort);
      const alt = warteschlange.splice(Math.max(0, i), 1)[0];
      alt.abgebrochen = true;
      alt.fertig();
    }
    if (!aktuell) void naechster();
  });
}

async function naechster(): Promise<void> {
  const a = warteschlange.shift();
  aktuell = a ?? null;
  if (!a) return;
  try {
    await auftragSprechen(a);
  } catch { /* nächster Spruch trotzdem */ }
  a.fertig();
  void naechster();
}

const warten = (ms: number) => new Promise<void>((ok) => window.setTimeout(ok, ms));

async function auftragSprechen(a: Auftrag): Promise<void> {
  // Klick und Rauschen erst, wenn der erste Ton bereit ist (sonst rauscht es während der Erzeugung)
  let bettAus: (() => void) | null = null;
  const beginnen = async () => {
    if (bettAus || !a.e.klang || a.abgebrochen) return;
    const c = audio();
    funkKlick(c, c.destination, c.currentTime + 0.01, a.e.lautstaerke);
    bettAus = rauschBett(c, a.e.lautstaerke);
    await warten(160);
  };
  try {
    const stimme = eigene;
    if (stimme && stimme.sprache === a.sprache) {
      try {
        await eigeneSprechen(a, stimme, beginnen);
        return;
      } catch {
        if (a.abgebrochen) return; // sonst: Rest mit der Systemstimme
      }
    }
    await systemSprechen(a, beginnen);
  } finally {
    if (bettAus) {
      (bettAus as () => void)();
      if (!a.abgebrochen) { const c = audio(); funkKlick(c, c.destination, c.currentTime + 0.02, a.e.lautstaerke, 0.16); }
    }
  }
}

/** Eigene Stimme: Die Sätze entstehen nacheinander und der Wiedergabe voraus – der erste spricht, sobald er fertig ist */
async function eigeneSprechen(a: Auftrag, stimme: EigeneStimme, beginnen: () => Promise<void>): Promise<void> {
  // Jeder Satz kostet rund 1 s Anlauf (Messung 27.11.): sehr kurze Sätze („Funkcheck.“) mit dem nächsten zusammenlegen,
  // sonst entsteht nach einem einzelnen Wort eine lange Pause
  if (a.index === 0) a.saetze = stueckeFuerEigene(a.saetze, (s) => tonSpeicher.has(fuerEigene(s, a.sprache)));
  const texte = a.saetze.map((s) => fuerEigene(s, a.sprache));
  const toene: Promise<Ton>[] = [];
  let kette: Promise<unknown> = Promise.resolve();
  for (let i = a.index; i < texte.length; i++) {
    const p = kette.then(() => (a.abgebrochen ? Promise.reject(new Error("abgebrochen")) : eigenerTon(stimme, texte[i])));
    p.catch(() => undefined); // abgebrochene Sätze sind kein Fehler
    toene[i] = p;
    kette = p.catch(() => undefined);
  }
  for (let i = a.index; i < texte.length; i++) {
    const { rate, ton } = await toene[i];
    if (a.abgebrochen) return;
    await beginnen();
    await tonAbspielen(rate, ton, a.e);
    if (a.abgebrochen) return;
    a.index = i + 1;
  }
}

/** Ton der eigenen Stimme abspielen – durch den echten Funk-Filter; während der Spotter spricht, leiser */
function tonAbspielen(rate: number, ton: Float32Array, e: FunkEinstellungen): Promise<void> {
  if (!ton.length) return Promise.resolve();
  const c = audio();
  const puffer = c.createBuffer(1, ton.length, rate);
  puffer.copyToChannel(ton as Float32Array<ArrayBuffer>, 0);
  const ausgang = new GainNode(c, { gain: Math.max(0, Math.min(1, e.lautstaerke)) });
  ausgang.connect(c.destination);
  const pegel = new GainNode(c, { gain: spotterAktiv ? 0.25 : 1 });
  pegel.connect(ausgang);
  ingenieurPegel = pegel;
  const quelle = new AudioBufferSourceNode(c, { buffer: puffer });
  quelle.connect(e.klang ? funkKette(c, pegel) : pegel);
  aktiveQuelle = quelle;
  return new Promise((fertig) => {
    quelle.onended = () => {
      if (aktiveQuelle === quelle) aktiveQuelle = null;
      fertig();
    };
    quelle.start();
  });
}

/** Systemstimme: Satz für Satz; unterbricht der Spotter, kommt der unterbrochene Satz danach noch einmal */
async function systemSprechen(a: Auftrag, beginnen: () => Promise<void>): Promise<void> {
  if (stimmeFehlt(a.sprache)) {
    fehltMelden?.(a.sprache);
    return;
  }
  const alle = stimmenFuer(a.sprache);
  const gewaehlt = (a.opt.sprache === "auto" ? undefined : alle.find((v) => v.voiceURI === a.e.stimme)) || alle[0];
  const [tempo, hoehe] = { ruhig: [1.0, 1], energisch: [1.1, 1.08], tief: [0.96, 0.78], hell: [1.03, 1.25] }[a.opt.stimmlage || "ruhig"];
  await beginnen();
  while (a.index < a.saetze.length && !a.abgebrochen) {
    while (spotterAktiv) await spotterEnde;
    if (a.abgebrochen) return;
    const u = new SpeechSynthesisUtterance(zumSprechen(a.saetze[a.index], a.sprache));
    if (gewaehlt) u.voice = gewaehlt;
    u.lang = gewaehlt?.lang || LAENDERCODE[a.sprache] || "de-DE";
    u.rate = tempo;
    u.pitch = hoehe;
    u.volume = Math.max(0, Math.min(1, a.e.lautstaerke));
    const unterbrochen = await new Promise<boolean>((ok) => {
      u.onend = () => ok(false);
      u.onerror = (ev) => ok(ev.error === "interrupted" || ev.error === "canceled");
      window.speechSynthesis.speak(u);
    });
    if (a.abgebrochen) return;
    // Spotter war dazwischen: NICHT wiederholen (Fund 27.11.: das Wiederholen nervt im Rennen) – weiter mit dem nächsten Satz
    if (unterbrochen) while (spotterAktiv) await spotterEnde;
    a.index++;
  }
}

/** Spotter-Ansage: sofort, kurz, hat Vorrang (Sicherheit). Eigene, zweite Stimme, damit man Spotter und
 *  Renningenieur auseinanderhält. Der Renningenieur macht danach mit dem nächsten Satz weiter (der unterbrochene
 *  Satz wird nicht wiederholt). */
export function spotterSprechen(text: string, e: FunkEinstellungen, sprache: string): void {
  if (!e.spotter || !text || !("speechSynthesis" in window)) return;
  const code = sprache === "auto" ? "de" : sprache; // Spotter-Sätze kommen aus festen Vorlagen
  if (stimmeFehlt(code)) return; // keine fremde Stimme; der Hinweis kommt beim Funk
  const u = new SpeechSynthesisUtterance(text);
  const alle = stimmenFuer(code);
  const ingenieur = alle.find((v) => v.voiceURI === e.stimme) || alle[0];
  const andere = alle.find((v) => v !== ingenieur) || ingenieur;
  if (andere) u.voice = andere;
  u.lang = andere?.lang || LAENDERCODE[code] || "de-DE";
  u.rate = 1.25;
  u.volume = Math.max(0, Math.min(1, e.lautstaerke));
  spotterAktiv = true;
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
  if (ingenieurPegel) ingenieurPegel.gain.setTargetAtTime(0.25, audio().currentTime, 0.03);
  spotterEnde = new Promise((ok) => {
    const ende = () => {
      if (spotterEnde === aktuellesEnde) {
        spotterAktiv = false;
        if (ingenieurPegel) ingenieurPegel.gain.setTargetAtTime(1, audio().currentTime, 0.08);
      }
      ok();
    };
    u.onend = ende;
    u.onerror = ende;
  });
  const aktuellesEnde = spotterEnde;
  window.speechSynthesis.speak(u);
}
// ---------------------------------------------------------------- Testaufnahme durch den Funk-Filter
let aktiveAufnahme: AudioBufferSourceNode | null = null;
export const AUFNAHME_MAX_BYTES = 20 * 1024 * 1024;

/** Eigene Aufnahme (Datei vom PC) durch den Funk-Filter abspielen. Gibt die Länge in Sekunden zurück. */
export async function aufnahmeAbspielen(datei: File, e: FunkEinstellungen): Promise<number> {
  if (datei.size > AUFNAHME_MAX_BYTES) throw new Error("Die Datei ist zu groß (höchstens 20 MB).");
  if (datei.type && !/^audio\//.test(datei.type) && !/\.(ogg|opus|mp3|m4a|wav|webm)$/i.test(datei.name)) throw new Error("Bitte eine Audiodatei wählen.");
  const c = audio();
  let puffer: AudioBuffer;
  try {
    puffer = await c.decodeAudioData(await datei.arrayBuffer());
  } catch {
    throw new Error("Diese Audiodatei kann ich nicht abspielen.");
  }
  funkStoppen();
  const lautstaerke = Math.max(0, Math.min(1, e.lautstaerke));
  const quelle = new AudioBufferSourceNode(c, { buffer: puffer });
  const ausgang = new GainNode(c, { gain: 0.9 * lautstaerke });
  ausgang.connect(c.destination);
  const start = c.currentTime + 0.18;
  if (e.klang) {
    quelle.connect(funkKette(c, ausgang));
    funkKlick(c, c.destination, c.currentTime + 0.02, lautstaerke);
    const aus = rauschBett(c, lautstaerke);
    quelle.onended = () => { aus(); funkKlick(c, c.destination, c.currentTime + 0.02, lautstaerke, 0.16); };
  } else quelle.connect(ausgang);
  quelle.start(start);
  aktiveAufnahme = quelle;
  return puffer.duration;
}
