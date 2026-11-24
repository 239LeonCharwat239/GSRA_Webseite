// GSRA – Bilder vor dem Hochladen klein rechnen (alles auf dem Gerät, ohne Metadaten wie den Aufnahmeort).
// Spart Datenvolumen: Listen laden kleine Fassungen, das große Bild erst beim Öffnen.
//  * klein(): Profilbild-Fassung für Listen (128 × 128 px statt 512 × 512 px – etwa ein Zehntel der Größe)
//  * vorschau(): Vorschaubild für Kacheln (längste Seite 640 px)
//  * kachel(): fester Bildausschnitt, z. B. 16:9 für Video-Vorschaubilder
// Namensregel im Speicher: Datei „…_k.png“ hat eine kleine Fassung „…_k.klein.jpg“, Datei „…_v.jpg“ ein Vorschaubild
// „…_v.vorschau.jpg“ (siehe supabase-client.js). Alte Dateien ohne Kennzeichen laden einfach das Original.
// Klassische Skripte nutzen window.gsraBilder.

export const CACHE_EIN_JAHR = "31536000"; // Dateinamen sind eindeutig – Browser dürfen sie lange zwischenspeichern

async function bitmapVon(datei: Blob): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function" || !/^image\/(jpeg|png|webp)$/.test(datei.type)) return null;
  try {
    return await createImageBitmap(datei, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

function alsJpeg(canvas: HTMLCanvasElement, qualitaet: number): Promise<Blob | null> {
  return new Promise((fertig) => canvas.toBlob((b) => fertig(b && b.size > 0 ? b : null), "image/jpeg", qualitaet));
}

// Ausschnitt mittig (wie object-fit: cover) in genau breite × hoehe Pixel
export async function kachel(datei: Blob, breite: number, hoehe: number, qualitaet = 0.82): Promise<Blob | null> {
  const bild = await bitmapVon(datei);
  if (!bild) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = breite;
    canvas.height = hoehe;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const faktor = Math.max(breite / bild.width, hoehe / bild.height);
    const w = bild.width * faktor;
    const h = bild.height * faktor;
    ctx.fillStyle = "#0b0f19"; // transparente PNG nicht schwarz-grau, sondern im Seiten-Dunkelblau
    ctx.fillRect(0, 0, breite, hoehe);
    ctx.drawImage(bild, (breite - w) / 2, (hoehe - h) / 2, w, h);
    return await alsJpeg(canvas, qualitaet);
  } finally {
    bild.close();
  }
}

// Längste Seite höchstens maxSeite Pixel (kleinere Bilder werden nur neu gespeichert)
export async function vorschau(datei: Blob, maxSeite = 640, qualitaet = 0.78): Promise<Blob | null> {
  const bild = await bitmapVon(datei);
  if (!bild) return null;
  try {
    const faktor = Math.min(1, maxSeite / Math.max(bild.width, bild.height, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bild.width * faktor));
    canvas.height = Math.max(1, Math.round(bild.height * faktor));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bild, 0, 0, canvas.width, canvas.height);
    return await alsJpeg(canvas, qualitaet);
  } finally {
    bild.close();
  }
}

export const klein = (datei: Blob, seite = 128): Promise<Blob | null> => kachel(datei, seite, seite, 0.8);

declare global {
  interface Window {
    gsraBilder?: { klein: typeof klein; vorschau: typeof vorschau; kachel: typeof kachel; cache: string };
  }
}
window.gsraBilder = { klein, vorschau, kachel, cache: CACHE_EIN_JAHR };
