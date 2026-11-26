// Sprechtaste (Wunsch 26.11.): Halten, Antippen oder Signalwort – ausgelöst über den Knopf in der App, eine Taste
// auf der Tastatur oder einen Knopf am Lenkrad. Mikrofon und Spracherkennung laufen in Rust (src-tauri/src/sprache.rs,
// lenkrad.rs), der Ton verlässt den PC nie. Hier: Bedienung, Einrichtung, Installation des Sprachmodells.

type Aufruf = <T>(befehl: string, daten?: Record<string, unknown>) => Promise<T>;
interface Status {
  installiert: boolean;
  laedt: boolean;
  groesse_mb: number;
  fehlt_mb: number;
  taste: string | null;
  tasten: string[];
}
interface Meldung {
  zustand: "hoert" | "erkennt" | "text" | "fehler" | "leer" | "signal" | "dauerhaft" | "dauerhaft-aus";
  text: string;
}
interface Fortschritt { prozent: number; fertig: boolean; fehler: string | null }
type Art = "halten" | "antippen" | "signalwort";
/** Belegung: Tastatur-Taste (z. B. „F9“) oder Lenkrad-Knopf („VID_…&PID_…#12“) */
interface Belegung { art: "tastatur" | "lenkrad"; wert: string; name: string }

const SPEICHER = { art: "gsra-sprechart", belegung: "gsra-sprechbelegung", woerter: "gsra-signalwoerter" };
const TASTEN_NAMEN: Record<string, string> = {
  Pause: "Pause", ScrollLock: "Rollen", Insert: "Einfg", Home: "Pos1", End: "Ende", PageUp: "Bild ↑", PageDown: "Bild ↓",
  NumpadAdd: "Ziffernblock +", NumpadSubtract: "Ziffernblock −", NumpadMultiply: "Ziffernblock ×", NumpadDivide: "Ziffernblock ÷",
};
const tastenName = (t: string) => TASTEN_NAMEN[t] ?? t.replace(/^Numpad(\d)$/, "Ziffernblock $1");
const KNOPF_TEXT: Record<Art, string> = { halten: "Halten und sprechen", antippen: "Antippen und sprechen", signalwort: "Antippen oder Signalwort sagen" };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
};
const lesen = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const schreiben = (k: string, v: string) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* egal */ } };

function belegungLesen(): Belegung | null {
  try {
    const b = JSON.parse(lesen(SPEICHER.belegung) || "null") as Belegung | null;
    return b && (b.art === "tastatur" || b.art === "lenkrad") && typeof b.wert === "string" && typeof b.name === "string" ? b : null;
  } catch { return null; }
}

export interface SprechtasteSteuerung {
  /** Signalwörter neu setzen (z. B. wenn der Renningenieur einen neuen Namen bekommt) */
  nameGeaendert: (name: string) => void;
}

/**
 * @param beiText erkannter Text (wie eine getippte Frage)
 * @param hinweis kurze Meldung unten (auch wenn gerade ein anderer Bereich offen ist)
 */
export async function sprechtasteEinrichten(istApp: boolean, beiText: (text: string) => void,
  hinweis: (t: string, art?: "ok" | "fehler") => void, name: () => string): Promise<SprechtasteSteuerung> {
  const knopf = $<HTMLButtonElement>("sKnopf");
  const status = $("sStatus");
  const leer: SprechtasteSteuerung = { nameGeaendert: () => {} };
  if (!istApp) {
    knopf.disabled = true;
    status.textContent = "Sprechen geht in der GSRA-App für Windows.";
    $("sEinstellung").hidden = true;
    return leer;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const aufrufen = invoke as Aufruf;

  let stand = await aufrufen<Status>("sprache_status");
  let art: Art = (["halten", "antippen", "signalwort"] as const).find((a) => a === lesen(SPEICHER.art)) ?? "halten";
  let belegung = belegungLesen();
  const signalFeld = $<HTMLInputElement>("sSignalwoerter");
  signalFeld.value = lesen(SPEICHER.woerter);

  const signalwoerter = () => {
    const eigene = signalFeld.value.split(",").map((w) => w.trim()).filter((w) => /^[\p{L} -]{2,30}$/u.test(w));
    return [...new Set([name(), "Renningenieur", "Race Engineer", ...eigene].filter(Boolean))].slice(0, 6);
  };

  const zeigen = () => {
    knopf.disabled = !stand.installiert;
    knopf.querySelector("span")!.textContent = KNOPF_TEXT[art];
    const knopfInstall = $("sInstallieren");
    knopfInstall.hidden = stand.installiert || stand.laedt;
    knopfInstall.textContent = stand.fehlt_mb < stand.groesse_mb
      ? `Spracherkennung ergänzen (noch ${stand.fehlt_mb} MB)`
      : `Spracherkennung installieren (einmalig ${stand.groesse_mb} MB)`;
    $("sBalken").hidden = !stand.laedt;
    $("sInstallText").textContent = stand.installiert ? "Installiert – bereit." : stand.laedt ? "Wird geladen …" : "";
    for (const r of document.querySelectorAll<HTMLInputElement>('input[name="sArt"]')) {
      r.checked = r.value === art;
      r.disabled = !stand.installiert;
    }
    $("sSignal").hidden = art !== "signalwort";
    $("sBelegung").textContent = belegung ? belegung.name : "Keine";
    $("sEntfernen").hidden = !belegung;
    $<HTMLButtonElement>("sFestlegen").disabled = !stand.installiert;
    if (!stand.installiert && !stand.laedt) status.textContent = "Richte die Sprechtaste unten einmal ein.";
    else if (status.textContent === "Richte die Sprechtaste unten einmal ein.") status.textContent = "";
  };

  const artSetzen = async (neuArt: Art, still = false) => {
    try {
      await aufrufen("hoermodus_setzen", { modus: neuArt, signalwoerter: signalwoerter() });
      art = neuArt;
      schreiben(SPEICHER.art, art);
      if (!still) hinweis(neuArt === "signalwort" ? `Sag „Hey ${name()}“ und dann deine Frage.` : neuArt === "antippen" ? "Einmal drücken – ich höre zu, bis du fertig bist." : "Taste halten, sprechen, loslassen.", "ok");
    } catch (e) {
      hinweis(typeof e === "string" ? e : "Das ging nicht.", "fehler");
    }
    zeigen();
  };

  const belegungAnwenden = async (b: Belegung | null) => {
    await aufrufen("sprechtaste_belegen", { taste: b?.art === "tastatur" ? b.wert : null });
    await aufrufen("lenkrad_belegen", { belegung: b?.art === "lenkrad" ? b.wert : null });
    belegung = b;
    schreiben(SPEICHER.belegung, b ? JSON.stringify(b) : "");
    if (b) void aufrufen("sprache_vorbereiten");
    zeigen();
  };

  zeigen();
  if (stand.installiert) {
    void artSetzen(art, true);
    if (belegung) void belegungAnwenden(belegung).catch(() => { void belegungAnwenden(null); });
  }

  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="sArt"]')) {
    r.addEventListener("change", () => { if (r.checked) void artSetzen(r.value as Art); });
  }
  signalFeld.addEventListener("change", () => {
    schreiben(SPEICHER.woerter, signalFeld.value.trim());
    if (art === "signalwort") void artSetzen("signalwort", true);
  });

  // Taste festlegen: nächste Taste auf der Tastatur ODER nächster Knopf am Lenkrad
  let lernt = false;
  const lernenEnde = () => {
    lernt = false;
    $("sLernen").hidden = true;
    window.removeEventListener("keydown", tasteGedrueckt, true);
    void aufrufen("lenkrad_lernen", { an: false });
  };
  const tasteGedrueckt = (e: KeyboardEvent) => {
    if (!lernt) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      lernenEnde();
      void belegungAnwenden(belegung);
      return;
    }
    if (!stand.tasten.includes(e.code)) {
      hinweis("Diese Taste geht nicht – nimm F6 bis F12, Pause, Pos1, Ende, Bild ↑/↓ oder den Ziffernblock (oder einen Knopf am Lenkrad).", "fehler");
      return;
    }
    lernenEnde();
    void belegungAnwenden({ art: "tastatur", wert: e.code, name: `Tastatur: ${tastenName(e.code)}` })
      .then(() => hinweis(`Sprechtaste: ${tastenName(e.code)}`, "ok"))
      .catch((err) => hinweis(typeof err === "string" ? err : "Diese Taste ist schon belegt.", "fehler"));
  };
  await listen<{ belegung: string; bezeichnung: string }>("gsra://lenkrad", (e) => {
    if (!lernt) return;
    lernenEnde();
    void belegungAnwenden({ art: "lenkrad", wert: e.payload.belegung, name: e.payload.bezeichnung })
      .then(() => hinweis(`Sprechtaste: ${e.payload.bezeichnung}`, "ok"))
      .catch(() => hinweis("Dieser Knopf ließ sich nicht belegen.", "fehler"));
  });
  $("sFestlegen").addEventListener("click", async () => {
    lernt = true;
    $("sLernen").hidden = false;
    await aufrufen("sprechtaste_belegen", { taste: null }); // sonst schluckt Windows die alte Taste
    await aufrufen("lenkrad_lernen", { an: true });
    window.addEventListener("keydown", tasteGedrueckt, true);
    window.setTimeout(() => { if (lernt) { lernenEnde(); void belegungAnwenden(belegung); } }, 20_000);
  });
  $("sEntfernen").addEventListener("click", () => void belegungAnwenden(null));

  // Installation (nur nach Klick)
  await listen<Fortschritt>("gsra://sprache-laden", async (e) => {
    const f = e.payload;
    $("sBalkenWert").style.width = `${Math.max(0, Math.min(100, f.prozent))}%`;
    if (f.fehler) {
      stand = { ...stand, laedt: false };
      zeigen();
      $("sInstallText").textContent = f.fehler;
      hinweis(f.fehler, "fehler");
    } else if (f.fertig) {
      stand = await aufrufen<Status>("sprache_status");
      zeigen();
      hinweis("Spracherkennung installiert. Leg unten fest, wie du sprechen willst.", "ok");
      void aufrufen("sprache_vorbereiten");
      void artSetzen(art, true);
    } else {
      $("sInstallText").textContent = `Wird geladen … ${f.prozent} %`;
    }
  });
  $("sInstallieren").addEventListener("click", async () => {
    try {
      await aufrufen("sprache_installieren");
      stand = { ...stand, laedt: true };
      zeigen();
    } catch (e) {
      hinweis(typeof e === "string" ? e : "Die Installation ließ sich nicht starten.", "fehler");
    }
  });

  // Was gerade passiert (Knopf in der App, Tastatur, Lenkrad, Signalwort)
  await listen<Meldung>("gsra://sprache", (e) => {
    const m = e.payload;
    if (m.zustand === "dauerhaft" || m.zustand === "dauerhaft-aus") {
      document.body.classList.toggle("signalwort-an", m.zustand === "dauerhaft");
      return;
    }
    document.body.classList.toggle("hoert", m.zustand === "hoert");
    knopf.classList.toggle("aktiv", m.zustand === "hoert");
    if (m.zustand === "hoert") status.textContent = "Ich höre …";
    else if (m.zustand === "signal") status.textContent = "Ja?";
    else if (m.zustand === "erkennt") status.textContent = "Verstehe …";
    else if (m.zustand === "text") {
      status.textContent = "";
      beiText(m.text);
    } else {
      status.textContent = m.text;
      if (m.zustand === "fehler") hinweis(m.text, "fehler");
    }
  });

  // Knopf: Halten = gedrückt halten; Antippen/Signalwort = einmal drücken (Rust entscheidet je nach Art)
  let unten = false;
  const druecken = (an: boolean) => {
    if (knopf.disabled || unten === an) return;
    unten = an;
    void aufrufen("sprechtaste", { gedrueckt: an });
  };
  knopf.addEventListener("pointerdown", (e) => { knopf.setPointerCapture(e.pointerId); druecken(true); });
  for (const ereignis of ["pointerup", "pointercancel", "lostpointercapture"]) knopf.addEventListener(ereignis, () => druecken(false));
  knopf.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); druecken(true); } });
  knopf.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); druecken(false); } });
  knopf.addEventListener("blur", () => druecken(false));

  return { nameGeaendert: () => { if (art === "signalwort") void artSetzen("signalwort", true); } };
}
