// GSRA – Fotos und Videos vor dem Senden im Chat vorbereiten: Vorschaubilder und kleinere Videos.
// Alles läuft auf dem Gerät der sendenden Person; hochgeladen wird erst das fertige, verkleinerte Ergebnis.
//
// - Vorschaubild (JPEG, längste Seite 640 px) für Fotos und Videos: Der Chat zeigt zuerst nur das kleine Bild,
//   das Original lädt erst beim Öffnen. Videos werden im Chat gar nicht mehr vorgeladen. Das spart Ladezeit auf dem
//   Handy und Datenvolumen bei Supabase (ein Foto: etwa 50 KB statt 1–3 MB, ein Video: 0 statt einige MB).
// - Videos über 8 MB oder mit mehr als 1280 px werden auf höchstens 1280 px (720p, H.264) umgerechnet – das ergibt
//   meist ein Viertel der Größe. Die Umrechnung nutzt die Video-Hardware des Geräts (WebCodecs) über die Bibliothek
//   „mediabunny“, die erst geladen wird, wenn wirklich ein Video verkleinert werden muss.
// - Die Speicher-Grenze von 50 MB (SQL 032) gilt weiterhin; ein Video, das auch verkleinert größer ist, wird abgelehnt.
//
// Der Messenger ist ein klassisches Skript und ruft window.gsraMedienVorbereiten(datei, fortschritt) auf.

export const MAX_UPLOAD = 50 * 1024 * 1024;
const MAX_EINGANG_VIDEO = 1024 * 1024 * 1024;
const VORSCHAU_SEITE = 640;
const VIDEO_SEITE = 1280;
const VIDEO_UMRECHNEN_AB = 8 * 1024 * 1024;

export type Vorbereitet = {
  datei: File;
  vorschau: Blob | null;
  dauer: number | null;
};

export class MedienFehler extends Error {}

const istVideo = (d: Blob) => d.type.startsWith("video/");
// Animierte GIFs bleiben unverändert (ein Standbild würde die Animation verstecken); HEIC kann der Browser oft nicht lesen
const vorschauFuerBild = (d: Blob) => /^image\/(jpeg|png|webp)$/.test(d.type);

function alsJpeg(quelle: CanvasImageSource, breite: number, hoehe: number): Promise<Blob | null> {
  const faktor = Math.min(1, VORSCHAU_SEITE / Math.max(breite, hoehe, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(breite * faktor));
  canvas.height = Math.max(1, Math.round(hoehe * faktor));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(quelle, 0, 0, canvas.width, canvas.height);
  return new Promise((fertig) => canvas.toBlob((b) => fertig(b && b.size > 0 ? b : null), "image/jpeg", 0.75));
}

export async function bildVorschau(datei: Blob): Promise<Blob | null> {
  if (!vorschauFuerBild(datei) || typeof createImageBitmap !== "function") return null;
  try {
    const bild = await createImageBitmap(datei, { imageOrientation: "from-image" });
    try {
      return await alsJpeg(bild, bild.width, bild.height);
    } finally {
      bild.close();
    }
  } catch {
    return null;
  }
}

// Länge und ein Standbild eines Videos – über ein unsichtbares Video-Element (nur lokal auf dem Gerät)
export function videoAnalyse(datei: Blob): Promise<{ vorschau: Blob | null; dauer: number | null; seite: number }> {
  return new Promise((fertig) => {
    const adresse = URL.createObjectURL(datei);
    const video = document.createElement("video");
    let erledigt = false;
    const ende = (vorschau: Blob | null) => {
      if (erledigt) return;
      erledigt = true;
      window.clearTimeout(notbremse);
      const dauer = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      const seite = Math.max(video.videoWidth, video.videoHeight);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(adresse);
      fertig({ vorschau, dauer, seite });
    };
    const notbremse = window.setTimeout(() => ende(null), 15000);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.addEventListener("error", () => ende(null), { once: true });
    video.addEventListener("loadedmetadata", () => {
      // Ein Bild aus dem ersten Drittel (höchstens Sekunde 1) – das allererste Bild ist oft schwarz
      video.currentTime = Number.isFinite(video.duration) ? Math.min(1, video.duration / 3) : 0.1;
    }, { once: true });
    video.addEventListener("seeked", () => {
      if (!video.videoWidth || !video.videoHeight) { ende(null); return; }
      void alsJpeg(video, video.videoWidth, video.videoHeight).then(ende, () => ende(null));
    }, { once: true });
    video.src = adresse;
  });
}

// Video auf höchstens 1280 px (H.264) umrechnen. null = nicht möglich oder nicht kleiner → Original verwenden.
export async function videoVerkleinern(datei: File, fortschritt?: (anteil: number) => void): Promise<File | null> {
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return null;
  try {
    const { umrechnen } = await import("./video-umrechnen");
    const ergebnis = await umrechnen(datei, VIDEO_SEITE, fortschritt);
    if (!ergebnis || ergebnis.byteLength === 0 || ergebnis.byteLength >= datei.size) return null;
    const name = `${datei.name.replace(/\.[^.]+$/, "") || "video"}.mp4`;
    return new File([ergebnis], name, { type: "video/mp4", lastModified: Date.now() });
  } catch (err) {
    console.warn("Video konnte nicht verkleinert werden, das Original wird verwendet:", err);
    return null;
  }
}

export async function vorbereiten(original: File, fortschritt?: (anteil: number) => void): Promise<Vorbereitet> {
  if (istVideo(original)) {
    if (original.size > MAX_EINGANG_VIDEO) throw new MedienFehler("Das Video ist zu groß (höchstens 1 GB). Bitte kürze es vor dem Senden.");
    const { vorschau, dauer, seite } = await videoAnalyse(original);
    let datei = original;
    // Große Dateien und hohe Auflösungen (z. B. kurze 4K-Clips) umrechnen; kleine Videos bleiben unverändert.
    // seite = 0: Der Browser kann das Video nicht abspielen – die Umrechnung versucht es trotzdem (eigene Decoder).
    if (original.size > VIDEO_UMRECHNEN_AB || seite > VIDEO_SEITE || seite === 0) {
      datei = (await videoVerkleinern(original, fortschritt)) ?? original;
    }
    if (datei.size > MAX_UPLOAD) {
      throw new MedienFehler("Das Video ist auch verkleinert noch größer als 50 MB. Bitte kürze es vor dem Senden.");
    }
    return { datei, vorschau, dauer };
  }
  if (original.size > MAX_UPLOAD) throw new MedienFehler("Die Datei ist größer als 50 MB und kann nicht gesendet werden.");
  return { datei: original, vorschau: await bildVorschau(original), dauer: null };
}

declare global {
  interface Window {
    gsraMedienVorbereiten?: typeof vorbereiten;
    gsraMedienFehler?: typeof MedienFehler;
  }
}
window.gsraMedienVorbereiten = vorbereiten;
window.gsraMedienFehler = MedienFehler;
