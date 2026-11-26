// Die GSRA-Webseite in der App (Wunsch 26.11.): Übersicht aller Funktionen der Webseite.
// In der App öffnet sich jede Seite im eigenen Fenster „GSRA“ (nur GSRA-Seiten, fremde Links im normalen Browser –
// geprüft in src-tauri/src/webseite.rs). In der Browser-Vorschau öffnet sich ein neuer Tab.

const WEBSEITE = "https://gsra-webseite.vercel.app";

interface Kachel {
  seite: string;
  titel: string;
  text: string;
  bild: string; // Pfad eines einfachen Strich-Symbols (24 × 24)
}
interface Gruppe {
  titel: string;
  kacheln: Kachel[];
}

export const GRUPPEN: Gruppe[] = [
  {
    titel: "Community",
    kacheln: [
      { seite: "index.html", titel: "Neuigkeiten", text: "Aktuelles aus der GSRA, nächste Rennen und Termine", bild: "M4 5h13v14H6a2 2 0 0 1-2-2V5zm13 4h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5M8 17h3" },
      { seite: "messenger.html", titel: "Messenger", text: "Mit Freunden chatten, Gruppen, Foren und offizielle Ankündigungen", bild: "M4 5h16v11H9l-5 4V5z" },
      { seite: "kalender.html", titel: "Kalender", text: "Alle anstehenden Rennen und Events der Community", bild: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" },
      { seite: "videos.html", titel: "Videos", text: "Hotlaps, Onboards, Rennen und Tutorials", bild: "M4 5h16v14H4zM10 9l5 3-5 3z" },
    ],
  },
  {
    titel: "Schneller werden",
    kacheln: [
      { seite: "coaching.html", titel: "Coaching", text: "Von erfahrenen Fahrern aus der Community lernen", bild: "M12 4l9 4-9 4-9-4 9-4zM7 10v5c3 2 7 2 10 0v-5" },
      { seite: "setups.html", titel: "Setups", text: "Setups für 17 Simulationen – geteilt und bewertet", bild: "M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4" },
      { seite: "stintplaner.html", titel: "Stint-Planer", text: "Sprit, Stints, Fahrerwechsel und Boxenstopps planen", bild: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" },
      { seite: "nachschlagewerk.html", titel: "Nachschlagewerk", text: "Über 300 Begriffe aus Motorsport und Simracing erklärt", bild: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11" },
    ],
  },
  {
    titel: "Markt",
    kacheln: [
      { seite: "marktplatz.html", titel: "Marktplatz", text: "Simracing-Hardware kaufen und verkaufen", bild: "M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2" },
      { seite: "liveries.html", titel: "Liveries", text: "Painter aus der Community gestalten dein Design", bild: "M14 4l6 6-8 8H6v-6l8-8zM12 6l6 6" },
    ],
  },
  {
    titel: "Dein Konto",
    kacheln: [
      { seite: "dashboard.html", titel: "Dashboard", text: "Profil, Inserate, Setups und GSRA-ID verwalten", bild: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0" },
      { seite: "renningenieur.html", titel: "Renningenieur einstellen", text: "Name, Stil, Sprache – und was er sich gemerkt hat", bild: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4zM17 14h3v5h-3z" },
      { seite: "abo.html", titel: "Mitgliedschaft", text: "Paddock kostenlos, Pole und Alliance mit mehr Werkzeugen", bild: "M4 8l4 4 4-7 4 7 4-4-2 11H6L4 8z" },
      { seite: "hilfe.html", titel: "Hilfe", text: "So funktionieren Messenger, Setups, Abos und Sicherheit", bild: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" },
    ],
  },
];

const SVG = "http://www.w3.org/2000/svg";
function symbol(pfad: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVG, "path");
  p.setAttribute("d", pfad);
  svg.append(p);
  return svg;
}

/** Öffnet eine Seite der Webseite – in der App im GSRA-Fenster, sonst in einem neuen Tab */
export async function webseiteOeffnen(seite: string, istApp: boolean): Promise<void> {
  if (!GRUPPEN.some((g) => g.kacheln.some((k) => k.seite === seite))) throw "Diese Seite gibt es in der App nicht.";
  if (istApp) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("webseite_oeffnen", { seite });
  } else {
    window.open(`${WEBSEITE}/${seite}`, "_blank", "noopener");
  }
}

/** Baut die Übersicht in `ziel` (nur feste Texte, alles per textContent) */
export function webseiteEinrichten(ziel: HTMLElement, meldung: HTMLElement, istApp: boolean): void {
  ziel.replaceChildren();
  for (const g of GRUPPEN) {
    const block = document.createElement("section");
    block.className = "gsra-gruppe";
    const h = document.createElement("h2");
    h.textContent = g.titel;
    const raster = document.createElement("div");
    raster.className = "gsra-raster";
    for (const k of g.kacheln) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gsra-kachel";
      const t = document.createElement("strong");
      t.textContent = k.titel;
      const s = document.createElement("span");
      s.textContent = k.text;
      const text = document.createElement("span");
      text.className = "gsra-kachel-text";
      text.append(t, s);
      b.append(symbol(k.bild), text);
      b.addEventListener("click", async () => {
        meldung.textContent = "";
        try {
          await webseiteOeffnen(k.seite, istApp);
        } catch (e) {
          meldung.textContent = typeof e === "string" ? e : "Die Seite konnte nicht geöffnet werden.";
        }
      });
      raster.append(b);
    }
    block.append(h, raster);
    ziel.append(block);
  }
}
