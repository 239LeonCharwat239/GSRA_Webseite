// Diagramme für „Genau hinsehen“: mehrere Kurven übereinander mit gemeinsamem Fadenkreuz und Zoom.
// Gezeichnet wird auf <canvas>; Werte unter der Maus stehen als Text (textContent) über jedem Diagramm.

export type Reihe = { name: string; werte: ArrayLike<number>; farbe: string; einheit: string; stellen: number; faktor?: number };
export type Plot = { titel: string; reihen: Reihe[]; hoehe: number; min?: number; max?: number; nulllinie?: boolean; deltaFlaeche?: boolean; stufen?: boolean };
export type Marke = { i: number; text: string };

const ACHSE = "rgba(255,255,255,0.10)";
const SCHRIFT = "rgba(255,255,255,0.55)";
const LINKS = 46;

type Eintrag = { plot: Plot; canvas: HTMLCanvasElement; werte: HTMLElement };

export class Diagramme {
  private eintraege: Eintrag[] = [];
  private marken: Marke[] = [];
  private n = 0;
  private von = 0;
  private bis = 0;
  private cursor: number | null = null;
  private ziehenAb: number | null = null;
  private ziehenBis: number | null = null;
  private readonly ziel: HTMLElement;
  private readonly xText: (i: number) => string;
  onBereich: (von: number, bis: number, ganz: boolean) => void = () => {};
  onCursor: (i: number | null) => void = () => {};

  constructor(ziel: HTMLElement, xText: (i: number) => string) {
    this.ziel = ziel;
    this.xText = xText;
    new ResizeObserver(() => this.zeichnen()).observe(ziel);
  }

  setzen(plots: Plot[], marken: Marke[], n: number) {
    this.ziel.replaceChildren();
    this.eintraege = plots.map((plot) => {
      const box = document.createElement("div");
      box.className = "diagramm";
      const kopf = document.createElement("div");
      kopf.className = "diagramm-kopf";
      const titel = document.createElement("strong");
      titel.textContent = plot.titel;
      const werte = document.createElement("span");
      werte.className = "diagramm-werte";
      kopf.append(titel, werte);
      const canvas = document.createElement("canvas");
      canvas.style.height = `${plot.hoehe}px`;
      box.append(kopf, canvas);
      this.ziel.append(box);
      this.ereignisse(canvas);
      return { plot, canvas, werte };
    });
    this.marken = marken;
    if (n !== this.n) {
      this.n = n;
      this.von = 0;
      this.bis = n;
    }
    this.zeichnen();
  }

  bereich(von: number, bis: number) {
    this.von = Math.max(0, Math.min(von, this.n - 5));
    this.bis = Math.min(this.n, Math.max(bis, this.von + 5));
    this.onBereich(this.von, this.bis, this.von === 0 && this.bis === this.n);
    this.zeichnen();
  }

  private index(canvas: HTMLCanvasElement, clientX: number) {
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left - LINKS;
    const breite = r.width - LINKS - 8;
    const f = Math.min(1, Math.max(0, x / breite));
    return Math.round(this.von + f * (this.bis - this.von));
  }

  private ereignisse(canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointermove", (e) => {
      this.cursor = this.index(canvas, e.clientX);
      if (this.ziehenAb != null) this.ziehenBis = this.cursor;
      this.zeichnen();
      this.onCursor(this.cursor);
    });
    canvas.addEventListener("pointerleave", () => {
      this.cursor = null;
      this.zeichnen();
      this.onCursor(null);
    });
    canvas.addEventListener("pointerdown", (e) => {
      this.ziehenAb = this.index(canvas, e.clientX);
      this.ziehenBis = null;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointerup", () => {
      const a = this.ziehenAb;
      const b = this.ziehenBis;
      this.ziehenAb = null;
      this.ziehenBis = null;
      if (a != null && b != null && Math.abs(b - a) >= 5) this.bereich(Math.min(a, b), Math.max(a, b));
      else this.zeichnen();
    });
    canvas.addEventListener("dblclick", () => this.bereich(0, this.n));
  }

  zeichnen() {
    for (const e of this.eintraege) this.plotZeichnen(e);
  }

  private plotZeichnen({ plot, canvas, werte }: Eintrag) {
    const dpr = window.devicePixelRatio || 1;
    const breite = canvas.clientWidth;
    const hoehe = plot.hoehe;
    if (!breite) return;
    canvas.width = Math.round(breite * dpr);
    canvas.height = Math.round(hoehe * dpr);
    const c = canvas.getContext("2d");
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, breite, hoehe);

    const { von, bis } = this;
    let min = plot.min ?? Infinity;
    let max = plot.max ?? -Infinity;
    if (plot.min == null || plot.max == null) {
      for (const r of plot.reihen) {
        const f = r.faktor ?? 1;
        for (let i = von; i <= bis; i++) {
          const w = r.werte[i] * f;
          if (plot.min == null && w < min) min = w;
          if (plot.max == null && w > max) max = w;
        }
      }
      if (plot.nulllinie) {
        const m = Math.max(Math.abs(min), Math.abs(max), 0.05);
        if (plot.min == null) min = -m;
        if (plot.max == null) max = m;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      min = (Number.isFinite(min) ? min : 0) - 1;
      max = (Number.isFinite(max) ? max : 0) + 1;
    }
    const oben = 6;
    const unten = hoehe - 16;
    const rechts = breite - 8;
    const x = (i: number) => LINKS + ((i - von) / Math.max(1, bis - von)) * (rechts - LINKS);
    const y = (w: number) => unten - ((w - min) / (max - min)) * (unten - oben);

    // Achsen und Beschriftung
    c.font = "11px 'Segoe UI', system-ui, sans-serif";
    c.fillStyle = SCHRIFT;
    c.strokeStyle = ACHSE;
    c.lineWidth = 1;
    c.textAlign = "right";
    c.textBaseline = "middle";
    const ersteReihe = plot.reihen[0];
    for (const w of [min, (min + max) / 2, max]) {
      c.beginPath();
      c.moveTo(LINKS, Math.round(y(w)) + 0.5);
      c.lineTo(rechts, Math.round(y(w)) + 0.5);
      c.stroke();
      c.fillText(w.toFixed(ersteReihe ? Math.min(ersteReihe.stellen, 2) : 0).replace(".", ","), LINKS - 6, y(w));
    }
    if (plot.nulllinie && min < 0 && max > 0) {
      c.strokeStyle = "rgba(255,255,255,0.35)";
      c.beginPath();
      c.moveTo(LINKS, Math.round(y(0)) + 0.5);
      c.lineTo(rechts, Math.round(y(0)) + 0.5);
      c.stroke();
    }
    c.textAlign = "center";
    c.textBaseline = "top";
    for (let k = 0; k <= 4; k++) {
      const i = Math.round(von + ((bis - von) * k) / 4);
      c.fillText(this.xText(i), Math.min(rechts - 20, Math.max(LINKS + 20, x(i))), unten + 3);
    }

    // Kurven-Marken
    c.setLineDash([3, 4]);
    for (const m of this.marken) {
      if (m.i < von || m.i > bis) continue;
      c.strokeStyle = "rgba(255,255,255,0.12)";
      c.beginPath();
      c.moveTo(Math.round(x(m.i)) + 0.5, oben);
      c.lineTo(Math.round(x(m.i)) + 0.5, unten);
      c.stroke();
      c.fillStyle = "rgba(255,255,255,0.4)";
      c.fillText(m.text, x(m.i), oben);
    }
    c.setLineDash([]);

    // Delta-Fläche: rot = Zeit verloren, grün = gewonnen
    if (plot.deltaFlaeche && ersteReihe) {
      const w = ersteReihe.werte;
      for (const [farbe, zeichen] of [["rgba(239,68,68,0.22)", 1], ["rgba(34,197,94,0.22)", -1]] as const) {
        c.fillStyle = farbe;
        c.beginPath();
        c.moveTo(x(von), y(0));
        for (let i = von; i <= bis; i++) c.lineTo(x(i), y(zeichen > 0 ? Math.max(0, w[i]) : Math.min(0, w[i])));
        c.lineTo(x(bis), y(0));
        c.closePath();
        c.fill();
      }
    }

    // Linien (bei vielen Punkten nur jeden k-ten zeichnen)
    const schritt = Math.max(1, Math.floor((bis - von) / (rechts - LINKS)));
    for (const r of plot.reihen) {
      const f = r.faktor ?? 1;
      c.strokeStyle = r.farbe;
      c.lineWidth = 1.6;
      c.beginPath();
      let vorher: number | null = null;
      for (let i = von; i <= bis; i += schritt) {
        const yy = y(r.werte[i] * f);
        if (vorher == null) c.moveTo(x(i), yy);
        else if (plot.stufen) {
          c.lineTo(x(i), vorher);
          c.lineTo(x(i), yy);
        } else c.lineTo(x(i), yy);
        vorher = yy;
      }
      c.stroke();
    }

    // Auswahl beim Ziehen
    if (this.ziehenAb != null && this.ziehenBis != null) {
      c.fillStyle = "rgba(0,85,255,0.18)";
      const a = x(Math.min(this.ziehenAb, this.ziehenBis));
      const b = x(Math.max(this.ziehenAb, this.ziehenBis));
      c.fillRect(a, oben, b - a, unten - oben);
    }

    // Fadenkreuz und Werte
    const i = this.cursor;
    if (i != null && i >= von && i <= bis) {
      c.strokeStyle = "rgba(255,255,255,0.6)";
      c.beginPath();
      c.moveTo(Math.round(x(i)) + 0.5, oben);
      c.lineTo(Math.round(x(i)) + 0.5, unten);
      c.stroke();
      werte.replaceChildren(
        ...plot.reihen.map((r) => {
          const s = document.createElement("span");
          s.style.color = r.farbe;
          const w = r.werte[i] * (r.faktor ?? 1);
          const vz = plot.nulllinie && w > 0 ? "+" : "";
          s.textContent = `${r.name} ${vz}${w.toFixed(r.stellen).replace(".", ",").replace("-", "−")} ${r.einheit}`;
          return s;
        }),
        Object.assign(document.createElement("span"), { className: "diagramm-ort", textContent: this.xText(i) }),
      );
    } else werte.replaceChildren();
  }
}

/** Kleines Live-Diagramm: Tempo, Gas, Bremse der letzten Sekunden */
export function verlaufZeichnen(canvas: HTMLCanvasElement, tempo: number[], gas: number[], bremse: number[], vMax: number) {
  const dpr = window.devicePixelRatio || 1;
  const breite = canvas.clientWidth;
  const hoehe = canvas.clientHeight;
  if (!breite || !hoehe) return;
  canvas.width = Math.round(breite * dpr);
  canvas.height = Math.round(hoehe * dpr);
  const c = canvas.getContext("2d");
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, breite, hoehe);
  const n = 600;
  const x = (i: number, len: number) => breite - ((len - 1 - i) / (n - 1)) * breite;
  const linie = (w: number[], farbe: string, skala: number, breiteL: number) => {
    c.strokeStyle = farbe;
    c.lineWidth = breiteL;
    c.beginPath();
    w.forEach((v, i) => {
      const yy = hoehe - 4 - (v / skala) * (hoehe - 8);
      if (i === 0) c.moveTo(x(i, w.length), yy);
      else c.lineTo(x(i, w.length), yy);
    });
    c.stroke();
  };
  c.strokeStyle = ACHSE;
  for (const f of [0.25, 0.5, 0.75]) {
    c.beginPath();
    c.moveTo(0, Math.round(hoehe * f) + 0.5);
    c.lineTo(breite, Math.round(hoehe * f) + 0.5);
    c.stroke();
  }
  linie(gas, "rgba(34,197,94,0.9)", 1, 1.4);
  linie(bremse, "rgba(239,68,68,0.95)", 1, 1.4);
  linie(tempo, "#ffffff", vMax, 2);
}
