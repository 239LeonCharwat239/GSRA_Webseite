// Funk des Renningenieurs in der App – alles läuft auf dem PC, nichts wird hochgeladen.
//  * Sprachausgabe über die Stimmen des Systems (natürliche Stimmen zuerst).
//  * Funk-Klang: Klick und kurzes Rauschen vor und nach jedem Spruch, leises Rauschen darunter.
//  * Testaufnahme: eine eigene Sprachaufnahme (z. B. WhatsApp-Sprachnachricht) läuft durch einen echten Funk-Filter
//    (Bandbegrenzung wie ein Funkgerät, leichte Verzerrung, Kompressor). Die Datei wird nur gelesen, nicht gespeichert.
// Hinweis: Die Systemstimmen lassen sich technisch nicht durch den Filter schicken (der Browser gibt sie nicht als
// Ton-Daten heraus) – deshalb dort nur Klick und Rauschen. Mit einer KI-Stimme (später) geht der volle Filter.

import { LAENDERCODE, spracheVonText } from "./sprachen.ts";

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

let laufNr = 0;
export function funkStoppen(): void {
  laufNr++;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  aktiveAufnahme?.stop();
  aktiveAufnahme = null;
}

/** Spruch vorlesen – mit Funk-Klang, wenn eingeschaltet. Ein neuer Spruch unterbricht den alten. */
export function sprechen(text: string, e: FunkEinstellungen, opt: { sprache?: string; stimmlage?: Stimmlage } = {}): Promise<void> {
  const sauber = text.replace(/\s+/g, " ").trim().slice(0, 2400);
  if (!sauber || !("speechSynthesis" in window)) return Promise.resolve();
  funkStoppen();
  const nr = laufNr;
  return new Promise((fertig) => {
    const u = new SpeechSynthesisUtterance(sauber);
    // „Automatisch“: Stimme in der Sprache der Antwort (sonst Deutsch)
    const sprache = opt.sprache === "auto" ? (spracheVonText(sauber) ?? "de") : opt.sprache || "de";
    const alle = stimmenFuer(sprache);
    const gewaehlt = (opt.sprache === "auto" ? undefined : alle.find((v) => v.voiceURI === e.stimme)) || alle[0];
    if (gewaehlt) u.voice = gewaehlt;
    u.lang = gewaehlt?.lang || LAENDERCODE[sprache] || "de-DE";
    const [tempo, hoehe] = { ruhig: [1.0, 1], energisch: [1.1, 1.08], tief: [0.96, 0.78], hell: [1.03, 1.25] }[opt.stimmlage || "ruhig"];
    u.rate = tempo;
    u.pitch = hoehe;
    u.volume = Math.max(0, Math.min(1, e.lautstaerke));
    let bettAus: (() => void) | null = null;
    const ende = () => {
      bettAus?.();
      bettAus = null;
      if (e.klang && nr === laufNr) { const c = audio(); funkKlick(c, c.destination, c.currentTime + 0.02, e.lautstaerke, 0.16); }
      fertig();
    };
    u.onend = ende;
    u.onerror = ende;
    if (e.klang) {
      const c = audio();
      funkKlick(c, c.destination, c.currentTime + 0.01, e.lautstaerke);
      bettAus = rauschBett(c, e.lautstaerke);
      window.setTimeout(() => { if (nr === laufNr) window.speechSynthesis.speak(u); }, 160);
    } else window.speechSynthesis.speak(u);
  });
}

/** Spotter-Ansage: sofort, kurz, unterbricht alles andere (Sicherheit geht vor). Eigene, zweite Stimme, damit man
 *  Spotter und Renningenieur auseinanderhält. */
export function spotterSprechen(text: string, e: FunkEinstellungen, sprache: string): void {
  if (!e.spotter || !text || !("speechSynthesis" in window)) return;
  funkStoppen();
  const u = new SpeechSynthesisUtterance(text);
  const code = sprache === "auto" ? "de" : sprache; // Spotter-Sätze kommen aus festen Vorlagen
  const alle = stimmenFuer(code);
  const ingenieur = alle.find((v) => v.voiceURI === e.stimme) || alle[0];
  const andere = alle.find((v) => v !== ingenieur) || ingenieur;
  if (andere) u.voice = andere;
  u.lang = andere?.lang || LAENDERCODE[code] || "de-DE";
  u.rate = 1.25;
  u.volume = Math.max(0, Math.min(1, e.lautstaerke));
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
