// Bilder und Sprachnachrichten im Messenger der App (Wunsch 26.11.) – gleiche Regeln wie auf der Webseite:
//  * Speicher „chat_attachments“ ist privat (SQL 032): Anzeigen nur über kurzlebige Links (2 Stunden), die Supabase
//    nur Mitgliedern des Chats ausstellt. In der Nachricht steht – wie auf der Webseite – die Adresse der Datei.
//  * Hochladen nur in den eigenen Ordner eines Chats, in dem man schreiben darf: <Chat-ID>/<Nutzer-ID>/<Datei>.
//  * Fotos werden vor dem Senden auf höchstens 1920 px verkleinert und neu gespeichert (ohne Standort- und
//    Gerätedaten); dazu ein kleines Vorschaubild („chatv_…vorschau.jpg“), damit der Chat schnell lädt.
//  * Sprachnachrichten: Aufnahme im Browser-Teil (Opus), Länge und Lautstärke-Verlauf wie auf der Webseite.
import { sb } from "./konto.ts";

const BUCKET = "chat_attachments";
const MARK = `/storage/v1/object/public/${BUCKET}/`;
const LEBENSDAUER = 2 * 3600;
const ERNEUERN = 15 * 60 * 1000;
export const MAX_FOTO_SEITE = 1920;
export const VORSCHAU_SEITE = 640;
export const MAX_BYTES = 50 * 1024 * 1024;
export const MAX_FOTOS = 6;
export const MAX_SPRACH_S = 120;
export const BALKEN = 48;
const MIT_VORSCHAU = /^(chatv_\d+_[a-z0-9]+)(?:_(\d{1,5})s)?\.[A-Za-z0-9]{1,5}$/;

const links = new Map<string, { url: string; bis: number }>();

/** Pfad im Speicher aus der gespeicherten Adresse (fremde Adressen: null) */
export function pfadVon(adresse: string | null | undefined): string | null {
  const t = String(adresse ?? "");
  const i = t.indexOf(MARK);
  if (i < 0) return null;
  try {
    const p = decodeURIComponent(t.slice(i + MARK.length).split(/[?#]/)[0]);
    // nur harmlose Pfade (keine „..“, keine Steuerzeichen)
    return p && !p.split("/").some((teil) => teil === ".." || teil === ".") && !/[\u0000-\u001f]/.test(p) ? p : null;
  } catch {
    return null;
  }
}
/** Vorschaubild zu einem neuen Foto/Video („chatv_…“) – sonst null */
export function vorschauPfad(pfad: string | null): string | null {
  if (!pfad) return null;
  const s = pfad.lastIndexOf("/");
  const m = MIT_VORSCHAU.exec(pfad.slice(s + 1));
  return m ? `${pfad.slice(0, s + 1)}${m[1]}.vorschau.jpg` : null;
}
export const istVideo = (pfad: string) => /\.(mp4|mov|webm|3gp|m4v)$/i.test(pfad);
export const uploadPfad = (chatId: string, userId: string, name: string) => `${chatId}/${userId}/${name}`;

/** Kurzlebige Links für mehrere Anhänge auf einmal holen (nur fehlende oder bald ablaufende) */
export async function signieren(adressen: (string | null | undefined)[]): Promise<void> {
  const pfade = [...new Set(adressen.map(pfadVon).filter((p): p is string => Boolean(p)).flatMap((p) => [p, vorschauPfad(p)]).filter((p): p is string => Boolean(p)))]
    .filter((p) => !((links.get(p)?.bis ?? 0) - Date.now() > ERNEUERN));
  for (let i = 0; i < pfade.length; i += 100) {
    try {
      const { data } = await sb().storage.from(BUCKET).createSignedUrls(pfade.slice(i, i + 100), LEBENSDAUER);
      for (const e of data ?? []) {
        if (e.signedUrl && e.path && !e.error && /^https:\/\//.test(e.signedUrl)) links.set(e.path, { url: e.signedUrl, bis: Date.now() + LEBENSDAUER * 1000 });
      }
    } catch { /* ohne Link: Anhang wird als nicht verfügbar gezeigt */ }
  }
}
/** Anzeigbarer Link für einen Pfad (nur nach signieren) */
export const linkFuer = (pfad: string | null) => (pfad ? links.get(pfad)?.url ?? null : null);

// ---------------------------------------------------------------- Fotos vorbereiten
async function alsJpeg(bild: ImageBitmap, seite: number, qualitaet: number): Promise<Blob | null> {
  const f = Math.min(1, seite / Math.max(bild.width, bild.height, 1));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bild.width * f));
  c.height = Math.max(1, Math.round(bild.height * f));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bild, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, "image/jpeg", qualitaet));
}

/** Foto verkleinern und neu speichern (ohne Metadaten) + Vorschaubild; GIFs bleiben (Animation), ohne Vorschau */
export async function fotoVorbereiten(datei: File): Promise<{ datei: Blob; endung: string; vorschau: Blob | null }> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(datei.type)) throw new Error("Nur Fotos (JPEG, PNG, WebP, GIF) – Videos gehen über „Alle Funktionen“.");
  if (datei.size > MAX_BYTES) throw new Error("Das Foto ist größer als 50 MB.");
  if (datei.type === "image/gif") return { datei, endung: "gif", vorschau: null };
  let bild: ImageBitmap;
  try {
    bild = await createImageBitmap(datei, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Dieses Foto kann ich nicht lesen.");
  }
  try {
    const gross = await alsJpeg(bild, MAX_FOTO_SEITE, 0.86);
    if (!gross) throw new Error("Das Foto ließ sich nicht vorbereiten.");
    return { datei: gross, endung: "jpg", vorschau: await alsJpeg(bild, VORSCHAU_SEITE, 0.78) };
  } finally {
    bild.close();
  }
}

/** Foto hochladen; Antwort: Adresse für die Nachricht */
export async function fotoHochladen(chatId: string, userId: string, datei: File): Promise<string> {
  const f = await fotoVorbereiten(datei);
  const speicher = sb().storage.from(BUCKET);
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let praefix = "chat_";
  if (f.vorschau) {
    const { error } = await speicher.upload(uploadPfad(chatId, userId, `chatv_${id}.vorschau.jpg`), f.vorschau, { contentType: "image/jpeg" });
    if (!error) praefix = "chatv_";
  }
  const pfad = uploadPfad(chatId, userId, `${praefix}${id}.${f.endung}`);
  const { error } = await speicher.upload(pfad, f.datei, { contentType: f.endung === "gif" ? "image/gif" : "image/jpeg" });
  if (error) throw error;
  return speicher.getPublicUrl(pfad).data.publicUrl;
}

// ---------------------------------------------------------------- Sprachnachrichten
/** Lautstärke-Verlauf auf eine feste Zahl Balken (0–1), wie auf der Webseite */
export function verlaufVerdichten(pegel: number[], balken = BALKEN): number[] {
  if (!pegel.length) return Array<number>(balken).fill(0.08);
  const max = Math.max(...pegel, 0.0001);
  return Array.from({ length: balken }, (_, i) => {
    const a = Math.floor((i * pegel.length) / balken);
    const b = Math.max(a + 1, Math.floor(((i + 1) * pegel.length) / balken));
    const stueck = pegel.slice(a, b);
    const wert = stueck.reduce((s, x) => s + x, 0) / stueck.length / max;
    return Math.round(Math.max(0.08, Math.min(1, wert)) * 100) / 100;
  });
}
export const dauerText = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export type Aufnahme = { stoppen: () => Promise<{ blob: Blob; typ: string; dauer: number; verlauf: number[] }>; abbrechen: () => void; sekunden: () => number };

/** Mikrofon an, Aufnahme starten (Opus, wenn möglich); höchstens MAX_SPRACH_S Sekunden */
export async function aufnahmeStarten(zuLang: () => void): Promise<Aufnahme> {
  const strom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const typ = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const rec = new MediaRecorder(strom, typ ? { mimeType: typ, audioBitsPerSecond: 32_000 } : undefined);
  const teile: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) teile.push(e.data); };
  const kontext = new AudioContext();
  const analyse = kontext.createAnalyser();
  analyse.fftSize = 512;
  kontext.createMediaStreamSource(strom).connect(analyse);
  const puffer = new Float32Array(analyse.fftSize);
  const pegel: number[] = [];
  const messen = window.setInterval(() => {
    analyse.getFloatTimeDomainData(puffer);
    pegel.push(Math.sqrt(puffer.reduce((s, x) => s + x * x, 0) / puffer.length));
  }, 100);
  const start = performance.now();
  const grenze = window.setTimeout(zuLang, MAX_SPRACH_S * 1000);
  rec.start(250);
  const aufraeumen = () => {
    window.clearInterval(messen);
    window.clearTimeout(grenze);
    strom.getTracks().forEach((t) => t.stop());
    void kontext.close();
  };
  return {
    sekunden: () => (performance.now() - start) / 1000,
    abbrechen: () => {
      if (rec.state !== "inactive") rec.stop();
      aufraeumen();
    },
    stoppen: () => new Promise((ok) => {
      const dauer = Math.min(MAX_SPRACH_S, (performance.now() - start) / 1000);
      rec.addEventListener("stop", () => {
        aufraeumen();
        const t = (rec.mimeType || teile[0]?.type || "audio/webm").split(";")[0];
        ok({ blob: new Blob(teile, { type: t }), typ: t, dauer, verlauf: verlaufVerdichten(pegel) });
      }, { once: true });
      if (rec.state !== "inactive") rec.stop();
      else rec.dispatchEvent(new Event("stop"));
    }),
  };
}

/** Sprachnachricht hochladen; Antwort: Adresse für die Nachricht */
export async function sprachHochladen(chatId: string, userId: string, blob: Blob, typ: string): Promise<string> {
  if (blob.size > MAX_BYTES) throw new Error("Die Sprachnachricht ist zu groß.");
  const endung = typ.includes("mp4") ? "m4a" : typ.includes("ogg") ? "ogg" : "webm";
  const pfad = uploadPfad(chatId, userId, `voice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${endung}`);
  const { error } = await sb().storage.from(BUCKET).upload(pfad, blob, { contentType: typ });
  if (error) throw error;
  return sb().storage.from(BUCKET).getPublicUrl(pfad).data.publicUrl;
}

/** Aufnahme für die Mitschrift auf dem PC: eine Spur, 16 kHz, 16-Bit-Werte (höchstens 125 s) */
export async function alsSechzehnKilohertz(blob: Blob): Promise<number[]> {
  const kontext = new AudioContext();
  let puffer: AudioBuffer;
  try {
    puffer = await kontext.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void kontext.close();
  }
  const sekunden = Math.min(puffer.duration, 125);
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(sekunden * 16_000)), 16_000);
  const quelle = new AudioBufferSourceNode(offline, { buffer: puffer });
  quelle.connect(offline.destination);
  quelle.start();
  const daten = (await offline.startRendering()).getChannelData(0);
  return Array.from(daten, (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32767))));
}