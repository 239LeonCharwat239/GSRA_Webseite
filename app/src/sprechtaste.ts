// Sprechtaste (Wunsch 26.11.): gedrückt halten → sprechen → loslassen → der Renningenieur antwortet per Funk.
// Mikrofon und Spracherkennung laufen in Rust (src-tauri/src/sprache.rs), der Ton verlässt den PC nie.
// Hier: Knopf in der App, Auswahl der globalen Taste, Installation des Sprachmodells mit Fortschritt.

type Aufruf = <T>(befehl: string, daten?: Record<string, unknown>) => Promise<T>;
interface Status {
  installiert: boolean;
  laedt: boolean;
  groesse_mb: number;
  taste: string | null;
  tasten: string[];
}
interface Meldung {
  zustand: "hoert" | "erkennt" | "text" | "fehler" | "leer";
  text: string;
}
interface Fortschritt {
  prozent: number;
  fertig: boolean;
  fehler: string | null;
}

const SPEICHER = "gsra-sprechtaste";
const TASTEN_NAMEN: Record<string, string> = {
  Pause: "Pause", ScrollLock: "Rollen (Scroll Lock)", Insert: "Einfg", Home: "Pos1", End: "Ende", PageUp: "Bild ↑", PageDown: "Bild ↓",
  NumpadAdd: "Ziffernblock +", NumpadSubtract: "Ziffernblock −", NumpadMultiply: "Ziffernblock ×", NumpadDivide: "Ziffernblock ÷",
};
const tastenName = (t: string) => TASTEN_NAMEN[t] ?? t.replace(/^Numpad(\d)$/, "Ziffernblock $1");

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
};

function gespeicherteTaste(): string {
  try { return localStorage.getItem(SPEICHER) ?? ""; } catch { return ""; }
}
function tasteMerken(t: string) {
  try { if (t) localStorage.setItem(SPEICHER, t); else localStorage.removeItem(SPEICHER); } catch { /* egal */ }
}

/**
 * @param beiText erkannter Text (wie eine getippte Frage)
 * @param hinweis kurze Meldung unten (auch wenn gerade ein anderer Bereich offen ist)
 */
export async function sprechtasteEinrichten(istApp: boolean, beiText: (text: string) => void, hinweis: (t: string, art?: "ok" | "fehler") => void): Promise<void> {
  const knopf = $<HTMLButtonElement>("sKnopf");
  const status = $("sStatus");
  const auswahl = $<HTMLSelectElement>("sTaste");
  if (!istApp) {
    knopf.disabled = true;
    status.textContent = "Sprechen geht in der GSRA-App für Windows.";
    $("sEinstellung").hidden = true;
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const aufrufen = invoke as Aufruf;

  let stand = await aufrufen<Status>("sprache_status");
  for (const t of stand.tasten) {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = tastenName(t);
    auswahl.append(o);
  }

  const zeigen = () => {
    knopf.disabled = !stand.installiert;
    $("sInstallieren").hidden = stand.installiert || stand.laedt;
    $("sInstallieren").textContent = `Spracherkennung installieren (einmalig ${stand.groesse_mb} MB)`;
    $("sBalken").hidden = !stand.laedt;
    auswahl.disabled = !stand.installiert;
    $("sInstallText").textContent = stand.installiert ? "Installiert – bereit." : stand.laedt ? "Wird geladen …" : "";
    if (!stand.installiert && !stand.laedt) status.textContent = "Richte die Sprechtaste unten einmal ein.";
    else if (status.textContent === "Richte die Sprechtaste unten einmal ein.") status.textContent = "";
  };
  zeigen();

  // Globale Taste wie zuletzt gewählt
  const belegen = async (taste: string) => {
    try {
      await aufrufen("sprechtaste_belegen", { taste: taste || null });
      tasteMerken(taste);
      auswahl.value = taste;
      if (taste) void aufrufen("sprache_vorbereiten");
      return true;
    } catch (e) {
      auswahl.value = "";
      tasteMerken("");
      hinweis(typeof e === "string" ? e : "Diese Taste geht nicht.", "fehler");
      return false;
    }
  };
  const merk = gespeicherteTaste();
  if (stand.installiert && merk && stand.tasten.includes(merk)) void belegen(merk);
  auswahl.addEventListener("change", async () => {
    if (await belegen(auswahl.value)) {
      hinweis(auswahl.value ? `Sprechtaste: ${tastenName(auswahl.value)} – gedrückt halten und sprechen.` : "Globale Sprechtaste aus.", "ok");
    }
  });

  // Installation (nur nach Klick)
  await listen<Fortschritt>("gsra://sprache-laden", (e) => {
    const f = e.payload;
    $("sBalkenWert").style.width = `${Math.max(0, Math.min(100, f.prozent))}%`;
    if (f.fehler) {
      stand = { ...stand, laedt: false };
      zeigen();
      $("sInstallText").textContent = f.fehler;
      hinweis(f.fehler, "fehler");
    } else if (f.fertig) {
      stand = { ...stand, laedt: false, installiert: true };
      zeigen();
      hinweis("Spracherkennung installiert. Wähle unten eine Taste oder halte den Knopf gedrückt.", "ok");
      void aufrufen("sprache_vorbereiten");
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

  // Was gerade passiert (Knopf in der App UND globale Taste)
  await listen<Meldung>("gsra://sprache", (e) => {
    const m = e.payload;
    document.body.classList.toggle("hoert", m.zustand === "hoert");
    knopf.classList.toggle("aktiv", m.zustand === "hoert");
    if (m.zustand === "hoert") status.textContent = "Ich höre …";
    else if (m.zustand === "erkennt") status.textContent = "Verstehe …";
    else if (m.zustand === "text") {
      status.textContent = "";
      beiText(m.text);
    } else {
      status.textContent = m.text;
      if (m.zustand === "fehler") hinweis(m.text, "fehler");
    }
  });

  // Knopf: gedrückt halten (Maus, Touch, Leertaste/Enter)
  let unten = false;
  const druecken = (an: boolean) => {
    if (knopf.disabled || unten === an) return;
    unten = an;
    void aufrufen("sprechtaste", { gedrueckt: an }).catch(() => { unten = false; });
  };
  knopf.addEventListener("pointerdown", (e) => { knopf.setPointerCapture(e.pointerId); druecken(true); });
  for (const art of ["pointerup", "pointercancel", "lostpointercapture"]) knopf.addEventListener(art, () => druecken(false));
  knopf.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); druecken(true); } });
  knopf.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); druecken(false); } });
  knopf.addEventListener("blur", () => druecken(false));
}
