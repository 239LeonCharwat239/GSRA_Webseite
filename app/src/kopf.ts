// Kopfzeile der App wie auf der Webseite (Wunsch 26.11.): Logo, Slogan und die „Sichtbarkeits-Leiste“ – Namen der
// Mitglieder mit Pole oder Alliance fahren hinter der Kopfzeile von links nach rechts (gleiche Regeln wie auf der
// Webseite: Datenbank-Funktion visibility_names, wer das nicht möchte, schaltet es im Dashboard ab; bei „Bewegung
// reduzieren“ aus). Dazu die eigene Fensterleiste: minimieren, maximieren, Vollbild (F11), schließen.

import { sb } from "./konto.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
};

type Name = { username?: unknown; plan?: unknown };

/** Namen fahren lassen – fair gemischt, jeder kommt gleich oft dran, nie zwei Namen in einer Spur */
export async function sichtbarkeitStarten(): Promise<void> {
  const ebene = $("sichtbarkeit");
  if (ebene.dataset.laeuft || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { data, error } = await sb().rpc("visibility_names");
  const namen = (Array.isArray(data) ? (data as Name[]) : [])
    .filter((n) => typeof n.username === "string" && n.username.trim())
    .map((n) => ({ name: String(n.username).trim().slice(0, 30), alliance: n.plan === "alliance" }));
  if (error || !namen.length) return;
  ebene.dataset.laeuft = "1";
  let reihe: typeof namen = [];
  const naechster = () => {
    if (!reihe.length) {
      reihe = namen.slice();
      for (let i = reihe.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [reihe[i], reihe[j]] = [reihe[j], reihe[i]];
      }
    }
    return reihe.pop()!;
  };
  const spuren = [8, 34, 60];
  const belegt = new Set<number>();
  const starten = () => {
    if (document.hidden) return;
    const frei = spuren.filter((s) => !belegt.has(s));
    if (!frei.length) return;
    const n = naechster();
    const spur = frei[Math.floor(Math.random() * frei.length)];
    belegt.add(spur);
    const el = document.createElement("span");
    el.className = `gsra-vis-name ${n.alliance ? "alliance" : "pole"}`;
    const innen = document.createElement("span");
    innen.className = "gsra-vis-inner";
    innen.textContent = n.name;
    el.append(innen);
    el.style.top = `${spur}%`;
    el.style.animationDuration = `${14 + Math.random() * 10}s`;
    el.style.animationTimingFunction = ["linear", "cubic-bezier(.55, .05, .45, .95)", "cubic-bezier(.25, .7, .35, 1)", "cubic-bezier(.7, 0, .85, .6)"][Math.floor(Math.random() * 4)];
    innen.style.setProperty("--bob", `${2.2 + Math.random() * 1.8}s`);
    innen.style.setProperty("--amp", `${2 + Math.random() * 3}px`);
    el.addEventListener("animationend", () => {
      belegt.delete(spur);
      el.remove();
    });
    ebene.append(el);
  };
  starten();
  window.setInterval(starten, 3800);
}

/** Eigene Fensterleiste (das Fenster hat keinen Windows-Rahmen) */
/** @param vorSchliessen true = übernimmt das Schließen selbst (z. B. Update installieren) */
export async function fensterEinrichten(istApp: boolean, vorSchliessen: () => Promise<boolean> = async () => false): Promise<void> {
  if (!istApp) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const fenster = getCurrentWindow();
  $("fensterKnoepfe").hidden = false;
  const vollbild = async () => {
    const an = !(await fenster.isFullscreen());
    await fenster.setFullscreen(an);
    document.body.classList.toggle("vollbild", an);
    $("fVoll").title = an ? "Vollbild verlassen (F11)" : "Vollbild (F11)";
  };
  $("fMin").addEventListener("click", () => void fenster.minimize());
  $("fMax").addEventListener("click", () => void fenster.toggleMaximize());
  $("fVoll").addEventListener("click", () => void vollbild());
  $("fZu").addEventListener("click", async () => {
    if (!(await vorSchliessen().catch(() => false))) void fenster.close();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      void vollbild();
    }
  });
}
