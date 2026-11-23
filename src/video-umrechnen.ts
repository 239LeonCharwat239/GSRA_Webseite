// GSRA – Videos im Browser auf höchstens 1280 px (H.264) umrechnen. Wird von src/medien-vorbereiten.ts erst
// geladen, wenn wirklich ein Video verkleinert werden muss. Die einzelnen Bausteine werden gezielt importiert,
// damit nur die nötigen Teile der Bibliothek „mediabunny“ (MPL-2.0, feste Version in package.json) mitkommen.
import {
  BlobSource, BufferTarget, Conversion, Input, MATROSKA, MP4, Mp4OutputFormat, Output, QTFF, QUALITY_MEDIUM, WEBM,
} from "mediabunny";

// verkleinern = false: nur neu verpacken (Bild und Ton werden unverändert kopiert, das geht schnell) – so werden auch
// kleine Videos ohne Metadaten hochgeladen. Handys speichern dort oft den Aufnahmeort (GPS) und das Gerät.
export async function umrechnen(datei: File, laengsteSeite: number, fortschritt?: (anteil: number) => void, verkleinern = true): Promise<ArrayBuffer | null> {
  // Nur die Formate, die Handys und Kameras für Videos nutzen (MP4, MOV, WebM, MKV)
  const input = new Input({ source: new BlobSource(datei), formats: [MP4, QTFF, WEBM, MATROSKA] });
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const conversion = await Conversion.init({
    input,
    output,
    tracks: "primary",
    showWarnings: false,
    // Keine Metadaten übernehmen (Aufnahmeort, Gerät, Datum) – die Drehung des Bildes bleibt erhalten
    tags: {},
    video: async (spur) => {
      if (!verkleinern) return {};
      const breite = await spur.getDisplayWidth();
      const hoehe = await spur.getDisplayHeight();
      const groesse = Math.max(breite, hoehe) > laengsteSeite ? (breite >= hoehe ? { width: laengsteSeite } : { height: laengsteSeite }) : {};
      return { ...groesse, codec: "avc", quality: QUALITY_MEDIUM, forceTranscode: true };
    },
    audio: verkleinern ? { quality: QUALITY_MEDIUM } : {},
  });
  // Fehlt nach der Umrechnung Bild oder Ton (z. B. kein passender Encoder im Browser), bleibt es beim Original
  if (!conversion.isValid || conversion.discardedTracks.some((d) => d.track.isVideoTrack() || d.track.isAudioTrack())) return null;
  conversion.onProgress = (anteil) => fortschritt?.(Math.max(0, Math.min(1, anteil)));
  await conversion.execute();
  return target.buffer;
}
