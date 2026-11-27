// Eigene Stimme (Wunsch 26.11.): Die App bildet aus einer kurzen Aufnahme die Stimme nach (stimme.rs, Pocket TTS) –
// nur mit bestätigter Zustimmung, nur auf dem PC. Hier: Bedienung (Modell laden, Aufnahme wählen, an/aus, Probe).
// Die Aufnahme wird im Browser-Teil nur gelesen, auf eine Spur gemischt, auf 24 kHz gebracht und als 16-Bit-Werte an
// die App gegeben; gespeichert wird sie nur im Datenordner der App.
import { eigeneStimmeSetzen, type FunkEinstellungen, sprechen, vorwaermen } from "./funk.ts";

type Aufruf = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
interface Stand { installiert: boolean; laedt: boolean; groesse_mb: number; fehlt_mb: number; referenz_s: number | null }
interface Fortschritt { prozent: number; fertig: boolean; fehler: string | null }

const RATE = 24_000;
const MAX_S = 20;
const MAX_BYTES = 30 * 1024 * 1024;
const SPEICHER = "gsra-eigene-stimme";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
};

/** Audiodatei → eine Spur, 24 kHz, höchstens 20 s, als 16-Bit-Werte */
export async function aufnahmeVorbereiten(datei: File): Promise<{ ton: number[]; sekunden: number; gekuerzt: boolean }> {
  if (datei.size > MAX_BYTES) throw new Error("Die Datei ist zu groß (höchstens 30 MB).");
  if (datei.type && !/^audio\//.test(datei.type) && !/\.(ogg|opus|mp3|m4a|wav|webm)$/i.test(datei.name)) throw new Error("Bitte eine Audiodatei wählen.");
  const kontext = new AudioContext();
  let puffer: AudioBuffer;
  try {
    puffer = await kontext.decodeAudioData(await datei.arrayBuffer());
  } catch {
    throw new Error("Diese Audiodatei kann ich nicht lesen.");
  } finally {
    void kontext.close();
  }
  const sekunden = Math.min(puffer.duration, MAX_S);
  const offline = new OfflineAudioContext(1, Math.ceil(sekunden * RATE), RATE);
  const quelle = new AudioBufferSourceNode(offline, { buffer: puffer });
  quelle.connect(offline.destination); // mehrere Spuren werden dabei zu einer gemischt
  quelle.start();
  const fertig = await offline.startRendering();
  const daten = fertig.getChannelData(0);
  const ton = Array.from(daten, (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32767))));
  return { ton, sekunden, gekuerzt: puffer.duration > MAX_S + 0.5 };
}

export async function eigeneStimmeEinrichten(istApp: boolean, hinweis: (t: string, art?: "ok" | "fehler") => void,
  funk: () => FunkEinstellungen, name: () => string, vorab: () => string[] = () => []): Promise<void> {
  const bereich = $("esBereich");
  if (!istApp) {
    bereich.hidden = true;
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const aufrufen = invoke as Aufruf;
  const an = $<HTMLInputElement>("esAn");
  const einverstanden = $<HTMLInputElement>("esEinverstanden");
  const datei = $<HTMLInputElement>("esDatei");
  let stand = await aufrufen<Stand>("stimme_status");
  try { an.checked = localStorage.getItem(SPEICHER) === "1"; } catch { /* egal */ }

  // Nur bei echter Änderung neu setzen (sonst ginge der Speicher fertiger Sätze verloren)
  let gesetzt = "";
  const anwenden = () => {
    const aktiv = an.checked && stand.installiert && stand.referenz_s != null;
    const schluessel = aktiv ? `an|${stand.referenz_s}` : "aus";
    if (schluessel === gesetzt) return;
    gesetzt = schluessel;
    eigeneStimmeSetzen(aktiv ? {
      sprache: "de",
      erzeugen: async (text) => {
        const roh = await aufrufen<ArrayBuffer>("stimme_sprechen", { text });
        const rate = new DataView(roh).getInt32(0, true);
        return { rate, ton: new Float32Array(roh, 4, (roh.byteLength - 4) / 4) };
      },
      abbrechen: () => { void aufrufen("stimme_abbrechen").catch(() => undefined); },
    } : null);
    if (!aktiv) return;
    // Modell laden und die häufigsten kurzen Sätze vorab erzeugen („Moment …“, „Nicht verstanden …“) – kommen dann sofort
    void aufrufen("stimme_vorbereiten");
    window.setTimeout(() => void vorwaermen(vorab()), 4000);
  };
  const zeigen = () => {
    const knopf = $<HTMLButtonElement>("esInstallieren");
    knopf.hidden = stand.installiert || stand.laedt;
    knopf.textContent = stand.fehlt_mb < stand.groesse_mb ? `Stimm-Modell ergänzen (noch ${stand.fehlt_mb} MB)` : `Stimm-Modell laden (einmalig ${stand.groesse_mb} MB)`;
    $("esBalken").hidden = !stand.laedt;
    $("esStand").textContent = !stand.installiert ? (stand.laedt ? "Wird geladen …" : "")
      : stand.referenz_s != null ? `Bereit – Aufnahme mit ${stand.referenz_s.toFixed(1).replace(".", ",")} s gespeichert.` : "Modell bereit – jetzt eine Aufnahme wählen.";
    const ohneModell = !stand.installiert;
    datei.disabled = ohneModell || !einverstanden.checked;
    $("esDateiKnopf").classList.toggle("aus", datei.disabled);
    an.disabled = ohneModell || stand.referenz_s == null;
    $<HTMLButtonElement>("esProbe").disabled = an.disabled || !an.checked;
    $("esLoeschen").hidden = stand.referenz_s == null;
    anwenden();
  };
  zeigen();

  await listen<Fortschritt>("gsra://stimme-laden", async (e) => {
    $("esBalkenWert").style.width = `${Math.max(0, Math.min(100, e.payload.prozent))}%`;
    if (e.payload.fehler) {
      stand = { ...stand, laedt: false };
      zeigen();
      $("esStand").textContent = e.payload.fehler;
      hinweis(e.payload.fehler, "fehler");
    } else if (e.payload.fertig) {
      stand = await aufrufen<Stand>("stimme_status");
      zeigen();
      hinweis("Stimm-Modell geladen. Jetzt eine Aufnahme wählen.", "ok");
    } else $("esStand").textContent = `Wird geladen … ${e.payload.prozent} %`;
  });
  $("esInstallieren").addEventListener("click", async () => {
    try {
      await aufrufen("stimme_installieren");
      stand = { ...stand, laedt: true };
      zeigen();
    } catch (err) {
      hinweis(typeof err === "string" ? err : "Das Laden ließ sich nicht starten.", "fehler");
    }
  });
  einverstanden.addEventListener("change", zeigen);
  datei.addEventListener("change", async () => {
    const f = datei.files?.[0];
    datei.value = "";
    if (!f) return;
    if (!einverstanden.checked) {
      hinweis("Bitte zuerst bestätigen, dass die Person zugestimmt hat.", "fehler");
      return;
    }
    $("esStand").textContent = "Aufnahme wird vorbereitet …";
    try {
      const a = await aufnahmeVorbereiten(f);
      const sek = await aufrufen<number>("stimme_referenz_setzen", { ton: a.ton, rate: RATE, einverstanden: true });
      stand = await aufrufen<Stand>("stimme_status");
      an.checked = true;
      try { localStorage.setItem(SPEICHER, "1"); } catch { /* egal */ }
      einverstanden.checked = false; // gilt nur für diese eine Aufnahme
      zeigen();
      hinweis(`Aufnahme übernommen (${sek.toFixed(1).replace(".", ",")} s${a.gekuerzt ? ", auf 20 s gekürzt" : ""}). Hör dir die Probe an.`, "ok");
    } catch (err) {
      zeigen();
      hinweis(err instanceof Error ? err.message : typeof err === "string" ? err : "Die Aufnahme ließ sich nicht übernehmen.", "fehler");
    }
  });
  an.addEventListener("change", () => {
    try { localStorage.setItem(SPEICHER, an.checked ? "1" : "0"); } catch { /* egal */ }
    zeigen();
  });
  $("esProbe").addEventListener("click", () => {
    $("esStand").textContent = "Die Stimme spricht gleich …";
    void sprechen(`Funkcheck. Hier ist ${name()}, ich höre dich laut und deutlich. Sprit reicht noch für 7 Runden, wir holen dich am Ende der 23. Runde rein.`,
      { ...funk(), vorlesen: true }, { sprache: "de", sofort: true }).finally(zeigen);
  });
  $("esLoeschen").addEventListener("click", async () => {
    try {
      await aufrufen("stimme_referenz_loeschen");
      stand = await aufrufen<Stand>("stimme_status");
      an.checked = false;
      try { localStorage.setItem(SPEICHER, "0"); } catch { /* egal */ }
      zeigen();
      hinweis("Aufnahme gelöscht – der Renningenieur spricht wieder mit der Windows-Stimme.", "ok");
    } catch (err) {
      hinweis(typeof err === "string" ? err : "Löschen ging nicht.", "fehler");
    }
  });
}
