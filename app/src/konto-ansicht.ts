// Konto-Knopf in der Kopfzeile der App: anmelden über die Webseite, Zwei-Faktor-Code, abmelden.
// Alle Texte per textContent.

import { abmelden, codeBestaetigen, einloesen, kontoLaden, pruefsumme, zufall, type Konto } from "./konto.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
};

let hinweisTimer: ReturnType<typeof setTimeout> | null = null;
export function hinweis(text: string, art: "info" | "fehler" | "ok" = "info") {
  const h = $("hinweis");
  h.textContent = text;
  h.className = `toast sichtbar ${art}`;
  if (hinweisTimer) clearTimeout(hinweisTimer);
  hinweisTimer = setTimeout(() => (h.className = "toast"), art === "fehler" ? 9000 : 6000);
}

let konto: Konto | null = null;
let wartet = false;
let laufend: { geheimnis: string } | null = null;

function zeigen() {
  const knopf = $<HTMLButtonElement>("kontoKnopf");
  const menue = $("kontoMenue");
  menue.hidden = true;
  knopf.disabled = false;
  if (wartet) {
    knopf.textContent = "Bestätige im Browser …";
    knopf.title = "Klicken, um die Anmeldung abzubrechen";
  } else if (konto) {
    knopf.textContent = konto.braucheCode ? "Code eingeben" : konto.name;
    knopf.title = konto.braucheCode ? "Zwei-Faktor-Code bestätigen" : "Konto";
  } else {
    knopf.textContent = "Anmelden";
    knopf.title = "Mit deinem GSRA-Konto anmelden (über die Webseite)";
  }
  $("kontoName").textContent = konto ? konto.name : "";
}

async function aktualisieren() {
  try {
    konto = await kontoLaden();
  } catch {
    konto = null;
  }
  zeigen();
  if (konto?.braucheCode) codeFragen();
}

function codeFragen() {
  const d = $<HTMLDialogElement>("codeDialog");
  const feld = $<HTMLInputElement>("codeFeld");
  $("codeFehler").textContent = "";
  feld.value = "";
  if (!d.open) d.showModal();
  feld.focus();
}

async function starten(istApp: boolean) {
  if (!istApp) {
    hinweis("Die Anmeldung funktioniert in der installierten GSRA-App (nicht in der Browser-Vorschau).");
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const geheimnis = zufall(32);
  laufend = { geheimnis };
  wartet = true;
  zeigen();
  try {
    await invoke("anmeldung_starten", { challenge: await pruefsumme(geheimnis), zustand: zufall(16) });
    hinweis("Im Browser hat sich die GSRA-Webseite geöffnet – bestätige dort die Anmeldung.");
  } catch (e) {
    laufend = null;
    wartet = false;
    zeigen();
    hinweis(typeof e === "string" ? e : "Die Anmeldung konnte nicht gestartet werden.", "fehler");
  }
}

async function abbrechen() {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("anmeldung_abbrechen").catch(() => {});
  laufend = null;
  wartet = false;
  zeigen();
  hinweis("Anmeldung abgebrochen.");
}

export async function kontoStarten(istApp: boolean) {
  const knopf = $<HTMLButtonElement>("kontoKnopf");
  const menue = $("kontoMenue");
  knopf.addEventListener("click", () => {
    if (wartet) void abbrechen();
    else if (!konto) void starten(istApp);
    else if (konto.braucheCode) codeFragen();
    else menue.hidden = !menue.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!menue.hidden && !menue.contains(e.target as Node) && e.target !== knopf) menue.hidden = true;
  });
  $("abmeldenKnopf").addEventListener("click", async () => {
    await abmelden().catch(() => {});
    konto = null;
    zeigen();
    hinweis("Du bist in der App abgemeldet.");
  });

  // Zwei-Faktor-Code
  const form = $<HTMLFormElement>("codeForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const knopfOk = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (knopfOk) knopfOk.disabled = true;
    try {
      await codeBestaetigen($<HTMLInputElement>("codeFeld").value);
      $<HTMLDialogElement>("codeDialog").close();
      await aktualisieren();
      hinweis(`Angemeldet als ${konto?.name ?? "GSRA-Mitglied"}.`, "ok");
    } catch (err) {
      $("codeFehler").textContent = err instanceof Error ? err.message : "Das hat nicht geklappt.";
    } finally {
      if (knopfOk) knopfOk.disabled = false;
    }
  });
  $("codeAbbrechen").addEventListener("click", async () => {
    $<HTMLDialogElement>("codeDialog").close();
    await abmelden().catch(() => {});
    konto = null;
    zeigen();
    hinweis("Ohne Zwei-Faktor-Code bleibt die App abgemeldet.");
  });

  if (istApp) {
    const { listen } = await import("@tauri-apps/api/event");
    await listen<string>("gsra://anmeldung", async (e) => {
      const l = laufend;
      laufend = null;
      wartet = false;
      if (!l || typeof e.payload !== "string") return zeigen();
      $<HTMLButtonElement>("kontoKnopf").disabled = true;
      $("kontoKnopf").textContent = "Melde an …";
      try {
        await einloesen(e.payload, l.geheimnis);
        await aktualisieren();
        if (konto && !konto.braucheCode) hinweis(`Angemeldet als ${konto.name}.`, "ok");
      } catch (err) {
        zeigen();
        hinweis(err instanceof Error ? err.message : "Die Anmeldung hat nicht geklappt.", "fehler");
      }
    });
    await listen<string>("gsra://anmeldung-ende", () => {
      if (!wartet) return;
      laufend = null;
      wartet = false;
      zeigen();
      hinweis("Die Anmeldung ist abgelaufen. Starte sie bei Bedarf neu.", "fehler");
    });
  }
  await aktualisieren();
}
