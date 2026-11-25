// GSRA – Ladeanimation: Das Globus-Netz aus dem Logo bildet sich, die Buchstaben fliegen von links nach rechts
// ein und glänzen, dann beginnt alles von vorn. Gemeinsam genutzt von Webseite (z. B. Messenger) und App (Startbild).
//
// * Reines SVG im Code – keine Bilddatei, erscheint also sofort, auch wenn das Netz langsam ist.
// * Sicherheit: kein HTML aus Zeichenketten; Text nur über textContent; keine style-Attribute im Markup (passt zur CSP).
// * Wer „Bewegung reduzieren“ eingestellt hat, sieht das fertige Logo, das nur sanft pulsiert.
// * Läuft das Logo nicht mehr auf der Seite (z. B. weil die Chats geladen sind), hört die Animation von selbst auf.

const SVG_NS = "http://www.w3.org/2000/svg";

// Buchstaben und Zielflagge, aus dem Logo nachgezeichnet (Koordinaten wie gsra-logo.png, 555 × 388 Pixel)
const BUCHSTABEN: ReadonlyArray<{ d: string; farbe: string; hell: string }> = [
  {
    farbe: "#0149d5", hell: "#6f9bff",
    d: "M74 143.5L79.5 142.7L183.5 142.7L184.2 143.5L163.9 165.5L158.5 170.2L85.5 170.3L79.5 172.2L75.2 175.5L51.8 206.5L51 209.5L51.5 210.5L53.5 211.4L119.5 211.4L123.5 210L125.7 207.5L127 204.5L126.7 202.5L124.5 201.4L79.5 201.4L79 200.5L84.5 193.9L94.5 182.8L96.5 181.5L163.5 181.5L165.4 182.5L162.8 197.5L157.1 211.5L129.5 237.8L127.5 238.3L27.5 237.8L22.5 236.7L16.5 233.5L13.3 230.5L10.9 225.5L10.1 221.5L10.3 217.5L12.3 209.5L15.3 203.5L22.5 192.5L45.9 161.5L52.6 154.5L62.6 147.5L67.5 145.3Z",
  },
  {
    farbe: "#0149d5", hell: "#6f9bff",
    d: "M204.2 143.5L212.5 142.6L304.5 142.6L305 143.5L304.5 144.1L278.5 170.9L211.5 171L207.5 172.3L204.1 176.5L204.1 180.5L206.5 181.9L260.5 181.8L266.5 182.4L273.5 184.9L278.6 189.5L280.3 193.5L280.8 197.5L280.5 202.5L278.7 210.5L273.7 220.5L268.5 226.8L262.5 231.8L256.5 235L246.5 237.9L239.5 238.4L143.5 238.3L142.5 237.5L168.5 212L240.5 211.8L244.5 210.6L246.5 208.5L248 204.5L247.5 202.7L246.5 202L191.5 201.8L182.5 199.9L177.5 197L175 194.5L172.2 188.5L171.8 182.5L173.1 174.5L176.2 166.5L181.2 158.5L188.5 151.1L196.5 146.1Z",
  },
  {
    farbe: "#0149d5", hell: "#6f9bff",
    d: "M316.4 142.5L395.5 142.6L403.5 144.2L409.5 147.3L411.7 149.5L414 152.5L415.7 156.5L415.7 167.5L411.9 180.5L409.5 185.3L405.1 191.5L398.5 198.6L389.5 203.8L381.5 206.2L368.5 206.9L367 207.5L370.3 211.5L398.7 238.5L354.5 238.5L321.2 207.5L318.5 206.5L317.4 207.5L315.4 213.5L308.5 238.2L306.5 238.7L277.2 238.5L277.2 236.5L285.7 210.5L292.5 182.2L370.5 181.8L374.5 180.3L377.4 175.5L377.2 172.5L374.5 171L290.5 170.7L290.9 169.5L298.1 161.5Z",
  },
  {
    farbe: "#f8c602", hell: "#fff1a8",
    d: "M476 142.5L481.5 142.3L486.5 143.3L492.9 147.5L533.8 223.5L540.9 237.5L540.8 238.5L425.8 238.5L426.5 237L451.5 212L488.7 211.5L486.9 206.5L472.5 180.1L468.5 182.8L412.5 238.3L411.5 238.6L406.6 234.5L391.7 220.5L392.5 219L456.6 155.5L464 147.5L469.5 144.2Z",
  },
];
const FLAGGE = "M483 247.5L489.5 247.6L490.8 248.5L475.7 266.5L475.4 267.5L476.5 267.9L482.5 268L493.9 267.5L510.5 248.6L512.5 247.4L539.2 247.5L539.5 248.5L538.8 249.5L522.5 267.7L499.5 268.3L497.5 268.9L480.5 289.5L478.5 290.8L456.9 290.5L459.1 286.5L472.8 269.5L471.5 268.6L467.5 268.6L456.5 269.2L440.5 288.1L437.5 290.7L415.2 290.5L417 288.5L420 284.5L422 280.5L424.1 277.5L431.5 268.5L450.5 267.6L467.5 247.8Z";
const NETZ_FARBE = "#d7d8da";
const FLAGGEN_FARBE = "#cdcfd3";
const FUNKEN_FARBE = "#f8c602";

// Globus-Netz wie im Logo: Umriss, zwei innere Längengrade, Mittellinie, je ein Breitengrad oben und unten.
// Die Längengrade starten am Nordpol und laufen nach unten, die Breitengrade von links nach rechts.
const MX = 275.5, OBEN = 20, UNTEN = 346, RY = 163, RX = 160, RX_INNEN = 93.5;
// Ablauf (Wunsch 25.11.): ERST zeichnet sich das ganze Netz, DANN fliegen die Buchstaben in mittlerem Tempo ein.
const NETZ: ReadonlyArray<{ d: string; von: number; bis: number }> = [
  { d: `M${MX} ${OBEN}A${RX} ${RY} 0 0 0 ${MX} ${UNTEN}`, von: 0.0, bis: 0.22 },
  { d: `M${MX} ${OBEN}A${RX} ${RY} 0 0 1 ${MX} ${UNTEN}`, von: 0.0, bis: 0.22 },
  { d: `M${MX} ${OBEN}A${RX_INNEN} ${RY} 0 0 0 ${MX} ${UNTEN}`, von: 0.02, bis: 0.24 },
  { d: `M${MX} ${OBEN}A${RX_INNEN} ${RY} 0 0 1 ${MX} ${UNTEN}`, von: 0.02, bis: 0.24 },
  { d: `M${MX} ${OBEN}L${MX} ${UNTEN}`, von: 0.04, bis: 0.25 },
  { d: "M144 88Q275.5 130 407 88", von: 0.1, bis: 0.3 },
  { d: "M147 280Q275.5 240 404 280", von: 0.13, bis: 0.33 },
];
const NETZ_FERTIG = 0.33;
// Funken an den Knoten des Netzes (Zeitpunkt = wann die Linie dort ankommt); am Ende sind sie wieder weg
const FUNKEN: ReadonlyArray<[number, number, number]> = [
  [MX, OBEN, 0.01], [186, 98, 0.13], [MX, 109, 0.2], [365, 98, 0.27],
  [188, 270, 0.16], [MX, 260, 0.23], [363, 270, 0.3], [MX, UNTEN, 0.23],
];
// Buchstaben: Start erst nach dem Netz, je Buchstabe gut 0,6 s Flug, nacheinander von links
const FLUG_START = NETZ_FERTIG + 0.02, FLUG_ABSTAND = 0.06, FLUG_DAUER = 0.14;
// Ausschnitt mit den Buchstaben (das Netz ist dort ausgespart, wie im Logo)
const BAND_OBEN = 133, BAND_UNTEN = 249;

const SCHLEIFE_MS = 4400;
const FERTIG_ANTEIL = 0.84; // ab hier ist das Logo vollständig (Glanz durch)
const AUS_VON = 0.92, AUS_BIS = 0.98; // in der Schleife: kurz ausblenden, dann von vorn

let zaehler = 0;

function el<K extends keyof SVGElementTagNameMap>(name: K, attribute: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attribute)) e.setAttribute(k, String(v));
  return e;
}

// Schlüsselbilder für einen Abschnitt [von, bis] einer Runde: davor Anfangs-, danach Endzustand.
// Die Kurve (easing) gilt nur innerhalb des Abschnitts – als Kurve der ganzen Runde würde sie die Zeitpunkte verschieben.
function abschnitt(von: number, bis: number, anfang: Keyframe, ende: Keyframe, kurve = "linear", mitte?: Keyframe & { offset: number }): Keyframe[] {
  const bilder: Keyframe[] = [];
  if (von > 0) bilder.push({ ...anfang, offset: 0 });
  bilder.push({ ...anfang, offset: von, easing: kurve });
  if (mitte) bilder.push({ ...mitte, offset: von + (bis - von) * mitte.offset, easing: "ease-out" });
  bilder.push({ ...ende, offset: bis });
  if (bis < 1) bilder.push({ ...ende, offset: 1 });
  return bilder;
}

export interface LadeLogo {
  /** Das SVG – einfach irgendwo einhängen; die Größe kommt aus CSS (Breite), die Höhe ergibt sich. */
  element: SVGSVGElement;
  /** Erfüllt, sobald das Logo das erste Mal vollständig zu sehen ist. */
  fertig: Promise<void>;
  stoppen(): void;
}

/**
 * Animiertes GSRA-Logo. `schleife: false` spielt den Aufbau einmal (z. B. Startbild der App) und bleibt
 * dann als fertiges Logo stehen; sonst wiederholt es sich, solange das Logo auf der Seite ist.
 */
export function ladeLogo(optionen: { schleife?: boolean } = {}): LadeLogo {
  const schleife = optionen.schleife !== false;
  const id = `gsra-lade-${++zaehler}`;
  const svg = el("svg", { viewBox: "6 8 543 352", class: "gsra-lade-logo", "aria-hidden": "true", focusable: "false" });

  const defs = el("defs");
  const maske = el("mask", { id: `${id}-band`, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 555, height: 388 });
  maske.append(el("rect", { x: 0, y: 0, width: 555, height: 388, fill: "#fff" }), el("rect", { x: 0, y: BAND_OBEN, width: 555, height: BAND_UNTEN - BAND_OBEN, fill: "#000" }));
  const schnitt = el("clipPath", { id: `${id}-buchstaben` });
  for (const b of BUCHSTABEN) schnitt.append(el("path", { d: b.d }));
  const verlauf = el("linearGradient", { id: `${id}-glanz`, x1: 0, y1: 0, x2: 1, y2: 0 });
  for (const [o, a] of [[0, 0], [0.45, 0.85], [0.55, 0.85], [1, 0]] as const) verlauf.append(el("stop", { offset: o, "stop-color": "#fff", "stop-opacity": a }));
  defs.append(maske, schnitt, verlauf);

  const alles = el("g");
  const netz = el("g", { mask: `url(#${id}-band)`, fill: "none", stroke: NETZ_FARBE, "stroke-width": 16, "stroke-linecap": "round" });
  const linien = NETZ.map((n) => { const p = el("path", { d: n.d, pathLength: 1, "stroke-dasharray": "1 1" }); netz.append(p); return p; });
  const funken = el("g", { fill: FUNKEN_FARBE });
  const punkte = FUNKEN.map(([x, y]) => { const c = el("circle", { cx: x, cy: y, r: 9, opacity: 0 }); funken.append(c); return c; });
  const flagge = el("path", { d: FLAGGE, fill: FLAGGEN_FARBE });
  const buchstaben = BUCHSTABEN.map((b) => el("path", { d: b.d, fill: b.farbe }));
  const glanzGruppe = el("g", { "clip-path": `url(#${id}-buchstaben)` });
  const glanz = el("rect", { x: -40, y: 120, width: 80, height: 140, fill: `url(#${id}-glanz)`, opacity: 0 });
  glanzGruppe.append(glanz);
  alles.append(netz, funken, flagge, ...buchstaben, glanzGruppe);
  svg.append(defs, alles);

  const ruhig = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animationen: Animation[] = [];
  let stopp = false;
  let fertigMelden: () => void = () => {};
  const fertig = new Promise<void>((ok) => { fertigMelden = ok; });

  if (ruhig || typeof svg.animate !== "function") {
    // Fertiges Logo; in der Schleife nur sanftes Pulsieren als „lädt noch“-Zeichen
    for (const p of linien) p.setAttribute("stroke-dasharray", "none");
    if (schleife && typeof svg.animate === "function") {
      animationen.push(alles.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], { duration: 1800, iterations: Infinity, easing: "ease-in-out" }));
    }
    fertigMelden();
    return { element: svg, fertig, stoppen: () => animationen.forEach((a) => a.cancel()) };
  }

  const zeit: KeyframeAnimationOptions = { duration: SCHLEIFE_MS, fill: "forwards" };
  const fuege = (ziel: Element, bilder: Keyframe[], extra: KeyframeAnimationOptions = {}) => animationen.push(ziel.animate(bilder, { ...zeit, ...extra }));

  // 1. Das Netz zeichnet sich (Linien wachsen vom Nordpol bzw. von links)
  NETZ.forEach((n, i) => fuege(linien[i], abschnitt(n.von, n.bis, { strokeDashoffset: 1 }, { strokeDashoffset: 0 }, "ease-in-out")));
  FUNKEN.forEach(([, , t], i) => fuege(punkte[i], abschnitt(t, Math.min(t + 0.1, 1), { opacity: 0, r: "2px" }, { opacity: 0, r: "4px" }, "ease-out", { opacity: 1, r: "11px", offset: 0.3 })));
  // 2. Buchstaben fliegen nacheinander von links ein, leuchten dabei hell und landen in ihrer Farbe
  buchstaben.forEach((b, i) => {
    const von = FLUG_START + i * FLUG_ABSTAND, bis = von + FLUG_DAUER;
    fuege(b, abschnitt(von, bis,
      { transform: "translateX(-300px)", opacity: 0, fill: BUCHSTABEN[i].hell },
      { transform: "translateX(0px)", opacity: 1, fill: BUCHSTABEN[i].farbe },
      "cubic-bezier(.2,.7,.3,1)",
      { transform: "translateX(9px)", opacity: 1, fill: BUCHSTABEN[i].hell, offset: 0.72 }));
  });
  // 3. Zielflagge rutscht hinterher
  const flugEnde = FLUG_START + (BUCHSTABEN.length - 1) * FLUG_ABSTAND + FLUG_DAUER;
  fuege(flagge, abschnitt(flugEnde - 0.03, flugEnde + 0.05, { transform: "translateX(-40px)", opacity: 0 }, { transform: "translateX(0px)", opacity: 1 }, "ease-out"));
  // 4. Glanz zieht schräg über die Buchstaben
  fuege(glanz, abschnitt(flugEnde + 0.03, FERTIG_ANTEIL, { transform: "translateX(-60px) skewX(-22deg)", opacity: 1 }, { transform: "translateX(780px) skewX(-22deg)", opacity: 1 }, "ease-in-out"));
  // 5. In der Schleife kurz ausblenden und von vorn
  if (schleife) fuege(alles, abschnitt(AUS_VON, AUS_BIS, { opacity: 1 }, { opacity: 0 }));

  const takt = animationen[animationen.length - 1];
  window.setTimeout(() => fertigMelden(), SCHLEIFE_MS * FERTIG_ANTEIL);
  if (schleife) {
    takt.onfinish = () => {
      if (stopp) return;
      if (!svg.isConnected) { animationen.forEach((a) => a.cancel()); return; }
      for (const a of animationen) { a.currentTime = 0; a.play(); }
    };
  }
  return {
    element: svg,
    fertig,
    stoppen: () => { stopp = true; animationen.forEach((a) => a.cancel()); },
  };
}

/** Ladeanzeige mit Logo und Text (z. B. „Chats werden geladen …“) – für Listen und leere Bereiche. */
export function ladeAnzeige(text = "Wird geladen …"): HTMLDivElement {
  const box = document.createElement("div");
  box.className = "gsra-lade";
  box.setAttribute("role", "status");
  const logo = ladeLogo();
  const zeile = document.createElement("p");
  zeile.className = "gsra-lade-text";
  zeile.textContent = text;
  box.append(logo.element, zeile);
  return box;
}

/** Ersetzt jeden Platzhalter <… data-gsra-laden="Text"> durch die Ladeanzeige (Webseite). */
export function ladeAnzeigenEinsetzen(wurzel: ParentNode = document): void {
  for (const platz of Array.from(wurzel.querySelectorAll<HTMLElement>("[data-gsra-laden]"))) {
    if (platz.dataset.gsraLadenAktiv) continue;
    platz.dataset.gsraLadenAktiv = "1";
    const text = (platz.dataset.gsraLaden || platz.textContent || "").trim().slice(0, 80) || "Wird geladen …";
    platz.replaceChildren(ladeAnzeige(text));
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => ladeAnzeigenEinsetzen());
  else ladeAnzeigenEinsetzen();
}
