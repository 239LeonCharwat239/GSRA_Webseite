// GSRA – Unterstützen-Seite (SQL 043): einmalig oder monatlich über Stripe, freiwillig auf der Unterstützerwand.
// Beträge erscheinen nirgends öffentlich. Alle Texte aus der Datenbank werden mit textContent ausgegeben,
// Profilbilder nur von https-Adressen. Den Betrag prüft zusätzlich der Server (create-checkout).

type Art = "support_once" | "support_monthly";
type Status = {
  unterstuetzer: boolean;
  oeffentlich: boolean;
  seit: string | null;
  monatlich: boolean;
  monatlich_bis: string | null;
  gekuendigt: boolean;
};
type WandEintrag = { username: string; avatar_url: string | null; seit: string };

const GRENZEN: Record<Art, { min: number; max: number; vorschlaege: number[]; standard: number }> = {
  support_once: { min: 3, max: 500, vorschlaege: [5, 10, 25, 50], standard: 10 },
  support_monthly: { min: 2, max: 100, vorschlaege: [3, 5, 10, 20], standard: 5 },
};

// eslint-artige Hilfen ohne Abhängigkeiten
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
};
const icon = (name: string) => {
  const i = el("i", `fa-solid ${name}`);
  i.setAttribute("aria-hidden", "true");
  return i;
};
const toast = (text: string, art: "success" | "error" | "info" = "info") =>
  (window as unknown as { showToast?: (t: string, a: string) => void }).showToast?.(text, art);
const monat = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("de-DE", { month: "long", year: "numeric" }) : "";
const tag = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

const sb = () => (window as any).supabaseClient;

let art: Art = "support_once";
let betrag = GRENZEN.support_once.standard;
let angemeldet = false;

// ---------- Betrag wählen ----------
function betraegeZeigen() {
  const box = $("utBetraege");
  const eigen = $<HTMLInputElement>("utEigen");
  const eigenText = $("utEigenText");
  if (!box || !eigen || !eigenText) return;
  const g = GRENZEN[art];
  box.replaceChildren();
  for (const wert of g.vorschlaege) {
    const knopf = el("button", `ut-betrag${wert === betrag ? " aktiv" : ""}`, `${wert} €${art === "support_monthly" ? " / Monat" : ""}`);
    knopf.type = "button";
    knopf.setAttribute("role", "radio");
    knopf.setAttribute("aria-checked", String(wert === betrag));
    knopf.addEventListener("click", () => {
      betrag = wert;
      eigen.value = "";
      betraegeZeigen();
    });
    box.append(knopf);
  }
  eigen.min = String(g.min);
  eigen.max = String(g.max);
  eigenText.textContent = `Eigener Betrag in Euro (${g.min}–${g.max} €${art === "support_monthly" ? " pro Monat" : ""})`;
}

function gewaehlterBetrag(): number | null {
  const eigen = $<HTMLInputElement>("utEigen");
  const g = GRENZEN[art];
  const roh = eigen?.value.trim() ?? "";
  const wert = roh ? Number(roh.replace(",", ".")) : betrag;
  if (!Number.isInteger(wert) || wert < g.min || wert > g.max) return null;
  return wert;
}

// ---------- Bezahlen ----------
async function weiter(knopf: HTMLButtonElement) {
  if (!angemeldet) {
    location.href = `login.html?weiter=${encodeURIComponent("unterstuetzen.html")}`;
    return;
  }
  const wert = gewaehlterBetrag();
  const g = GRENZEN[art];
  if (wert === null) {
    toast(`Bitte wähle einen ganzen Betrag zwischen ${g.min} € und ${g.max} €.`, "error");
    $<HTMLInputElement>("utEigen")?.focus();
    return;
  }
  knopf.disabled = true;
  try {
    // Sichtbarkeit zuerst speichern – sie gilt dann sofort nach der Zahlung
    const sichtbar = $<HTMLInputElement>("utOeffentlich")?.checked ?? false;
    await sb()?.rpc("set_supporter_visibility", { _show: sichtbar });
    const { data, error } = await sb().functions.invoke("create-checkout", { body: { kind: art, amount_eur: wert } });
    let meldung: string | undefined = data?.error;
    if (error) {
      try { meldung = (await error.context?.json())?.error || meldung; } catch { /* keine Details */ }
    }
    if (!data?.url || !/^https:\/\//.test(data.url)) throw new Error(meldung || "Die Bezahlseite ist gerade nicht erreichbar. Bitte versuche es später erneut.");
    location.href = data.url;
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), "error");
    knopf.disabled = false;
  }
}

async function portalOeffnen(knopf: HTMLButtonElement) {
  knopf.disabled = true;
  try {
    const { data, error } = await sb().functions.invoke("billing-portal", { body: { return_page: "unterstuetzen" } });
    let meldung: string | undefined = data?.error;
    if (error) {
      try { meldung = (await error.context?.json())?.error || meldung; } catch { /* keine Details */ }
    }
    if (!data?.url || !/^https:\/\//.test(data.url)) throw new Error(meldung || "Die Verwaltung ist gerade nicht erreichbar.");
    location.href = data.url;
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), "error");
    knopf.disabled = false;
  }
}

// ---------- Eigener Stand ----------
function standZeigen(s: Status) {
  const box = $("utMein");
  if (!box) return;
  const haken = $<HTMLInputElement>("utOeffentlich");
  if (haken) haken.checked = s.oeffentlich;
  if (!s.unterstuetzer) { box.hidden = true; return; }
  box.replaceChildren();
  const kopf = el("div", "ut-mein-kopf");
  kopf.append(icon("fa-heart"), el("strong", "", `Danke! Du unterstützt die GSRA seit ${monat(s.seit)}.`));
  box.append(kopf);
  if (s.monatlich) {
    box.append(el("p", "", s.gekuendigt
      ? `Deine monatliche Unterstützung endet zum ${tag(s.monatlich_bis)}.`
      : `Deine monatliche Unterstützung läuft und verlängert sich am ${tag(s.monatlich_bis)}.`));
  }
  const zeile = el("div", "ut-mein-aktionen");
  const schalter = el("label", "ut-haken klein");
  const cb = el("input");
  cb.type = "checkbox";
  cb.checked = s.oeffentlich;
  cb.addEventListener("change", async () => {
    cb.disabled = true;
    const { error } = await sb().rpc("set_supporter_visibility", { _show: cb.checked });
    cb.disabled = false;
    if (error) { cb.checked = !cb.checked; toast("Die Einstellung konnte nicht gespeichert werden.", "error"); return; }
    if (haken) haken.checked = cb.checked;
    toast(cb.checked ? "Du erscheinst jetzt auf der Unterstützerwand." : "Du erscheinst nicht mehr auf der Unterstützerwand.", "success");
    void wandLaden();
  });
  schalter.append(cb, el("span", "", "Auf der Unterstützerwand und mit Abzeichen zeigen"));
  zeile.append(schalter);
  if (s.monatlich) {
    const verwalten = el("button", "ut-btn", "Abo verwalten");
    verwalten.type = "button";
    verwalten.prepend(icon("fa-gear"), " ");
    verwalten.addEventListener("click", () => void portalOeffnen(verwalten));
    zeile.append(verwalten);
  }
  box.append(zeile);
  box.hidden = false;
}

async function standLaden(): Promise<Status | null> {
  const { data, error } = await sb().rpc("my_support");
  if (error || !data) return null;
  standZeigen(data as Status);
  return data as Status;
}

// ---------- Unterstützerwand ----------
async function wandLaden() {
  const box = $("utWand");
  if (!box || !sb()) return;
  const { data, error } = await sb().rpc("supporter_wall");
  box.replaceChildren();
  if (error) { box.append(el("p", "ut-leer", "Die Unterstützerwand ist gerade nicht erreichbar.")); return; }
  const liste = (data || []) as WandEintrag[];
  if (!liste.length) { box.append(el("p", "ut-leer", "Noch steht hier niemand – werde die erste Person auf der Wand.")); return; }
  for (const e of liste) {
    const karte = el("div", "ut-person");
    const bild = el("span", "ut-avatar");
    if (e.avatar_url && /^https:\/\//.test(e.avatar_url)) {
      const img = el("img");
      img.src = e.avatar_url;
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      bild.append(img);
    } else {
      bild.textContent = (e.username || "?").trim().charAt(0).toUpperCase();
    }
    const text = el("span", "ut-person-text");
    text.append(el("strong", "", e.username), el("small", "", `seit ${monat(e.seit)}`));
    karte.append(bild, text);
    box.append(karte);
  }
}

// ---------- Start ----------
async function starten() {
  const weiterKnopf = $<HTMLButtonElement>("utWeiter");
  if (!weiterKnopf) return;
  document.querySelectorAll<HTMLInputElement>('input[name="art"]').forEach((r) => r.addEventListener("change", () => {
    art = r.value === "support_monthly" ? "support_monthly" : "support_once";
    betrag = GRENZEN[art].standard;
    const eigen = $<HTMLInputElement>("utEigen");
    if (eigen) eigen.value = "";
    betraegeZeigen();
  }));
  $<HTMLInputElement>("utEigen")?.addEventListener("input", () => {
    document.querySelectorAll(".ut-betrag").forEach((k) => { k.classList.remove("aktiv"); k.setAttribute("aria-checked", "false"); });
  });
  weiterKnopf.addEventListener("click", () => void weiter(weiterKnopf));
  betraegeZeigen();

  try {
    const { data } = await sb()?.auth.getSession() ?? { data: null };
    angemeldet = Boolean(data?.session);
  } catch { angemeldet = false; }
  if (!angemeldet) {
    const text = weiterKnopf.querySelector("span");
    if (text) text.textContent = "Anmelden, um zu unterstützen";
  }

  // Zurück von der Bezahlseite
  const ruecksprung = new URLSearchParams(location.search).get("unterstuetzung");
  if (ruecksprung) history.replaceState(null, "", location.pathname);
  if (ruecksprung === "danke") {
    const danke = $("utDanke");
    if (danke) {
      danke.replaceChildren(icon("fa-heart"), el("strong", "", "Vielen Dank für deine Unterstützung!"),
        el("span", "", "Die Bestätigung von Stripe kann ein paar Sekunden dauern – dein Stand aktualisiert sich gleich."));
      danke.hidden = false;
    }
  } else if (ruecksprung === "abbruch") {
    toast("Die Bezahlung wurde abgebrochen – es wurde nichts abgebucht.", "info");
  }

  void wandLaden();
  if (angemeldet) {
    const stand = await standLaden();
    // Nach der Zahlung kommt die Bestätigung per Webhook – kurz nachfragen, bis sie da ist
    if (ruecksprung === "danke" && !stand?.unterstuetzer) {
      for (const warten of [3000, 6000, 12000]) {
        await new Promise((ok) => setTimeout(ok, warten));
        if ((await standLaden())?.unterstuetzer) { void wandLaden(); break; }
      }
    }
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void starten());
else void starten();
