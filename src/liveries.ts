// GSRA – Liveries (Garage), SQL 046, Entscheidungen vom 24.11.2026.
// Wie Coachings, nur ohne Bezahlung über die GSRA: Painter stellen Angebote ein (Fahrzeugklassen, Simulationen,
// Preis ab, Lieferzeit, Beispielbilder), Kunden fragen im Messenger an und regeln Bezahlung und Korrekturen selbst.
// Painter wird, wer die Voraussetzungen der Coach-Lizenz erfüllt oder schon Coach ist; Pro-Painter trägt das
// Admin-Team ein. Alle Texte gehen mit textContent auf die Seite; Links in Beschreibungen öffnen erst nach dem
// Warnhinweis (src/links.ts). Bilder werden auf dem Gerät verkleinert und ohne Standortdaten gespeichert.
import "./links";
import { CACHE_EIN_JAHR, vorschau } from "./bilder";
import { dialog, profilZeigen, supabaseClient, toast } from "./fenster";

type Klasse = "formel" | "prototyp" | "gt" | "tourenwagen" | "cup" | "stockcar" | "rallye" | "kart" | "sonstige";
type Angebot = {
  id: string; painter_id: string; title: string; description: string; classes: Klasse[]; simulations: string[];
  price_from_cents: number | null; delivery_days: number | null; images: string[]; active: boolean; updated_at: string;
};
type Profil = { id: string; username: string | null; avatar_url: string | null; gsra_id: number | null; role?: string | null };
type Fortschritt = { mitglied_tage: number; setup_punkte: number; bewertungen: number; schnitt: number; alle: boolean;
  erfuellt: { dauer: boolean; setups: boolean; bewertungen: boolean; verhalten: boolean } };
type Status = { aktiv: boolean; pro: boolean; coach: boolean; erteilt_am: string | null;
  entzogen: { am: string; grund: string | null; automatisch: boolean } | null;
  regeln: { mitglied_tage: number; setup_punkte: number; bewertungen: number; schnitt: number; ruhe_tage: number };
  fortschritt: Fortschritt };
type Fehler = { message: string } | null;
type Antwort<T> = Promise<{ data: T | null; error: Fehler }>;
type Abfrage = {
  select: (s: string) => Abfrage; eq: (k: string, v: unknown) => Abfrage; in: (k: string, v: unknown[]) => Abfrage;
  order: (k: string, o?: { ascending: boolean }) => Abfrage; limit: (n: number) => Abfrage;
  maybeSingle: () => Antwort<unknown>; then: Promise<{ data: unknown; error: Fehler }>["then"];
};
type Client = {
  from: (t: string) => Abfrage;
  rpc: (name: string, args?: Record<string, unknown>) => Antwort<unknown>;
  auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
  storage: { from: (b: string) => {
    upload: (p: string, d: Blob, o: Record<string, string>) => Promise<{ error: Fehler }>;
    remove: (p: string[]) => Promise<{ error: Fehler }>;
    getPublicUrl: (p: string) => { data: { publicUrl: string } };
  } };
};

export const KLASSEN: Record<Klasse, string> = {
  formel: "Formelfahrzeuge", prototyp: "Prototypen", gt: "GT-Fahrzeuge", tourenwagen: "Tourenwagen", cup: "Markenpokale",
  stockcar: "Stock Cars", rallye: "Rallye & Rallycross", kart: "Kart", sonstige: "Sonstige",
};
const SIMULATIONEN = ["iRacing", "Assetto Corsa Competizione", "Le Mans Ultimate", "Assetto Corsa", "Assetto Corsa EVO",
  "Automobilista 2", "rFactor 2", "RaceRoom", "Gran Turismo 7", "Forza Motorsport", "F1 25", "BeamNG.drive"];
const MAX_BILDER = 6;
const MAX_ANGEBOTE = 5;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const client = () => supabaseClient<Client>();

const fehlt = (e: Fehler) => /could not find the function|schema cache|does not exist/i.test(e?.message || "");
const euro = (cent: number) => (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: cent % 100 ? 2 : 0 });
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text = "") => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text) e.textContent = text;
  return e;
};

const zustand = {
  ich: null as string | null,
  moderator: false,
  status: null as Status | null,
  angebote: [] as Angebot[],
  profile: new Map<string, Profil>(),
  proPainter: new Set<string>(),
  filter: { klasse: "" as Klasse | "", sim: "", suche: "" },
  bearbeiten: null as Angebot | null,
  formBilder: [] as { pfad: string; neu: boolean }[],
  entfernteBilder: [] as string[],
};

const bildUrl = (pfad: string) => client()?.storage.from("liveries").getPublicUrl(pfad).data.publicUrl || "";
const vorschauPfad = (pfad: string) => pfad.replace(/\.(jpe?g|png|webp)$/i, ".vorschau.jpg");
const nameVon = (id: string) => zustand.profile.get(id)?.username || "Painter";

// ---------------------------------------------------------
// Laden
// ---------------------------------------------------------
async function laden() {
  const sb = client();
  if (!sb) return;
  const liste = $("lvListe");
  if (liste) liste.innerHTML = '<p class="lv-leer"><i class="fa-solid fa-spinner fa-spin"></i> Angebote werden geladen …</p>';
  const { data, error } = await (sb.from("livery_offers").select("*").order("updated_at", { ascending: false }).limit(200) as unknown as Promise<{ data: Angebot[] | null; error: Fehler }>);
  if (error) {
    if (liste) liste.innerHTML = `<p class="lv-leer">${fehlt(error) ? "Die Liveries sind gleich verfügbar – die Datenbank wird gerade aktualisiert." : "Die Angebote konnten nicht geladen werden."}</p>`;
    return;
  }
  zustand.angebote = data || [];
  const ids = [...new Set(zustand.angebote.map((a) => a.painter_id))];
  if (ids.length) {
    const [profile, pros] = await Promise.all([
      sb.from("profiles").select("id, username, avatar_url, gsra_id").in("id", ids) as unknown as Promise<{ data: Profil[] | null }>,
      sb.from("pro_painters").select("user_id") as unknown as Promise<{ data: { user_id: string }[] | null }>,
    ]);
    (profile.data || []).forEach((p) => zustand.profile.set(p.id, p));
    zustand.proPainter = new Set((pros.data || []).map((p) => p.user_id));
  }
  zeigen();
}

// ---------------------------------------------------------
// Übersicht
// ---------------------------------------------------------
function passt(a: Angebot) {
  const f = zustand.filter;
  if (!a.active && a.painter_id !== zustand.ich) return false;
  if (f.klasse && !a.classes.includes(f.klasse)) return false;
  if (f.sim && !a.simulations.includes(f.sim)) return false;
  if (f.suche) {
    const t = `${a.title} ${a.description} ${nameVon(a.painter_id)}`.toLowerCase();
    if (!f.suche.toLowerCase().split(/\s+/).every((w) => t.includes(w))) return false;
  }
  return true;
}

function karte(a: Angebot): HTMLElement {
  const k = el("article", `lv-karte${a.active ? "" : " pausiert"}`);
  k.tabIndex = 0;
  k.setAttribute("role", "button");
  k.setAttribute("aria-label", `${a.title} von ${nameVon(a.painter_id)} – Details öffnen`);
  const bild = el("div", "lv-karte-bild");
  if (a.images[0]) {
    const img = el("img");
    img.src = bildUrl(vorschauPfad(a.images[0]));
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => { if (!img.dataset.voll) { img.dataset.voll = "1"; img.src = bildUrl(a.images[0]); } }, { once: false });
    bild.appendChild(img);
  } else {
    bild.innerHTML = '<i class="fa-solid fa-palette" aria-hidden="true"></i>';
  }
  if (a.images.length > 1) bild.appendChild(el("span", "lv-anzahl", `${a.images.length} Bilder`));
  if (!a.active) bild.appendChild(el("span", "lv-pausiert", "Pausiert"));
  const body = el("div", "lv-karte-text");
  const wer = el("div", "lv-painter");
  wer.appendChild(el("span", "", nameVon(a.painter_id)));
  if (zustand.proPainter.has(a.painter_id)) wer.appendChild(el("em", "lv-pro", "Pro-Painter"));
  body.append(wer, el("h3", "", a.title));
  const klassen = el("div", "lv-tags");
  a.classes.forEach((c) => klassen.appendChild(el("span", "", KLASSEN[c] || c)));
  body.appendChild(klassen);
  const fuss = el("div", "lv-karte-fuss");
  fuss.appendChild(el("strong", "", a.price_from_cents != null ? `ab ${euro(a.price_from_cents)}` : "Preis auf Anfrage"));
  if (a.delivery_days) fuss.appendChild(el("span", "", `ca. ${a.delivery_days} ${a.delivery_days === 1 ? "Tag" : "Tage"}`));
  body.appendChild(fuss);
  k.append(bild, body);
  const oeffnen = () => details(a);
  k.addEventListener("click", oeffnen);
  k.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oeffnen(); } });
  return k;
}

function zeigen() {
  const liste = $("lvListe");
  if (!liste) return;
  const treffer = zustand.angebote.filter(passt);
  const anzahl = $("lvAnzahl");
  if (anzahl) anzahl.textContent = zustand.angebote.length ? String(treffer.length) : "";
  liste.replaceChildren();
  if (!treffer.length) {
    liste.appendChild(el("p", "lv-leer", zustand.angebote.length
      ? "Keine Angebote zu diesem Filter. Probiere eine andere Klasse oder Simulation."
      : "Noch keine Livery-Angebote. Bist du Painter? Lege unten dein erstes Angebot an."));
    return;
  }
  treffer.forEach((a) => liste.appendChild(karte(a)));
}

function filterAufbauen() {
  const klasse = $<HTMLSelectElement>("lvKlasse");
  (Object.keys(KLASSEN) as Klasse[]).forEach((k) => { const o = el("option", "", KLASSEN[k]); o.value = k; klasse?.appendChild(o); });
  klasse?.addEventListener("change", () => { zustand.filter.klasse = klasse.value as Klasse | ""; zeigen(); });
  const sim = $<HTMLSelectElement>("lvSim");
  SIMULATIONEN.forEach((s) => { const o = el("option", "", s); o.value = s; sim?.appendChild(o); });
  sim?.addEventListener("change", () => { zustand.filter.sim = sim.value; zeigen(); });
  const suche = $<HTMLInputElement>("lvSuche");
  let t = 0;
  suche?.addEventListener("input", () => { window.clearTimeout(t); t = window.setTimeout(() => { zustand.filter.suche = suche.value.trim(); zeigen(); }, 200); });
}

// ---------------------------------------------------------
// Details (Bilder, Beschreibung, Anfrage im Messenger)
// ---------------------------------------------------------
function details(a: Angebot) {
  document.getElementById("lvDetails")?.remove();
  const overlay = el("div", "gsra-dialog-overlay");
  overlay.id = "lvDetails";
  const box = el("div", "gsra-dialog lv-details");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", a.title);
  const zu = el("button", "gsra-dialog-close");
  zu.type = "button";
  zu.title = "Schließen";
  zu.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  box.appendChild(zu);

  if (a.images.length) {
    const gross = el("img", "lv-details-bild");
    gross.alt = `Beispiel: ${a.title}`;
    gross.src = bildUrl(a.images[0]);
    box.appendChild(gross);
    if (a.images.length > 1) {
      const leiste = el("div", "lv-details-leiste");
      a.images.forEach((p, i) => {
        const t = el("img");
        t.src = bildUrl(vorschauPfad(p));
        t.alt = `Bild ${i + 1}`;
        t.loading = "lazy";
        t.tabIndex = 0;
        if (i === 0) t.classList.add("aktiv");
        const wahl = () => { gross.src = bildUrl(p); leiste.querySelectorAll("img").forEach((x) => x.classList.remove("aktiv")); t.classList.add("aktiv"); };
        t.addEventListener("click", wahl);
        t.addEventListener("keydown", (e) => { if (e.key === "Enter") wahl(); });
        leiste.appendChild(t);
      });
      box.appendChild(leiste);
    }
  }
  const kopf = el("div", "lv-details-kopf");
  const wer = el("button", "lv-painter-link");
  wer.type = "button";
  wer.textContent = nameVon(a.painter_id);
  wer.title = "Profil ansehen";
  wer.addEventListener("click", () => profilZeigen(a.painter_id));
  kopf.appendChild(wer);
  if (zustand.proPainter.has(a.painter_id)) kopf.appendChild(el("em", "lv-pro", "Pro-Painter"));
  box.append(kopf, el("h3", "gsra-dialog-title", a.title));
  const fakten = el("div", "lv-tags");
  a.classes.forEach((c) => fakten.appendChild(el("span", "", KLASSEN[c] || c)));
  a.simulations.forEach((s) => fakten.appendChild(el("span", "sim", s)));
  box.appendChild(fakten);
  const preis = el("p", "lv-details-preis");
  preis.textContent = `${a.price_from_cents != null ? `ab ${euro(a.price_from_cents)}` : "Preis auf Anfrage"}${a.delivery_days ? ` · Lieferzeit ca. ${a.delivery_days} ${a.delivery_days === 1 ? "Tag" : "Tage"}` : ""}`;
  box.appendChild(preis);
  if (a.description) {
    const text = el("p", "lv-details-text");
    if (window.gsraTextMitLinks) window.gsraTextMitLinks(text, a.description);
    else text.textContent = a.description;
    box.appendChild(text);
  }
  box.appendChild(el("p", "lv-details-hinweis",
    "Bezahlung und Absprachen regelt ihr direkt miteinander – die GSRA ist nicht Vertragspartner. Vereinbart Entwürfe und Korrekturen vorher und zahlt nur Personen, denen ihr vertraut."));

  const aktionen = el("div", "gsra-dialog-actions");
  if (a.painter_id !== zustand.ich) {
    const anfragen = el("a", "gsra-dialog-btn primary");
    anfragen.href = `messenger.html?sellerId=${encodeURIComponent(a.painter_id)}&sellerName=${encodeURIComponent(nameVon(a.painter_id))}&itemTitle=${encodeURIComponent(`Livery: ${a.title}`)}`;
    anfragen.innerHTML = '<i class="fa-solid fa-comment"></i> Im Messenger anfragen';
    aktionen.appendChild(anfragen);
  }
  if (zustand.moderator && a.painter_id !== zustand.ich) {
    const weg = el("button", "gsra-dialog-btn secondary");
    weg.type = "button";
    weg.innerHTML = '<i class="fa-solid fa-trash"></i> Angebot entfernen (Moderation)';
    weg.addEventListener("click", async () => {
      const ok = await dialog({ icon: "fa-trash", title: "Angebot entfernen?", message: "Das Angebot wird gelöscht; der Schritt steht im Moderationsprotokoll.",
        confirmText: "Entfernen", cancelText: "Abbrechen", danger: true });
      if (!ok) return;
      const { error } = await client()!.rpc("livery_offer_delete", { _id: a.id });
      if (error) { toast(error.message, "error"); return; }
      schliessen();
      toast("Das Angebot wurde entfernt.", "success");
      void laden();
    });
    aktionen.appendChild(weg);
  }
  if (aktionen.children.length) box.appendChild(aktionen);
  overlay.appendChild(box);
  const schliessen = () => { overlay.remove(); document.removeEventListener("keydown", esc); };
  const esc = (e: KeyboardEvent) => { if (e.key === "Escape") schliessen(); };
  zu.addEventListener("click", schliessen);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) schliessen(); });
  document.addEventListener("keydown", esc);
  document.body.appendChild(overlay);
  zu.focus();
}

// ---------------------------------------------------------
// Eigener Painter-Bereich
// ---------------------------------------------------------
async function meinBereich() {
  const sb = client();
  const box = $("lvMein");
  const inhalt = $("lvMeinInhalt");
  const badge = $("lvStatusBadge");
  if (!sb || !box || !inhalt || !zustand.ich) return;
  const { data, error } = await sb.rpc("painter_status", { _user: zustand.ich });
  if (error) return; // SQL 046 fehlt noch: Bereich bleibt verborgen
  const s = data as Status;
  zustand.status = s;
  box.hidden = false;
  inhalt.replaceChildren();
  if (badge) {
    badge.className = s.aktiv ? "lv-status aktiv" : "lv-status";
    badge.textContent = s.aktiv ? (s.pro ? "Pro-Painter" : "Painter") : "noch keine Lizenz";
  }

  if (s.aktiv) {
    const eigene = zustand.angebote.filter((a) => a.painter_id === zustand.ich);
    inhalt.appendChild(el("p", "lv-mein-text", eigene.length
      ? "Deine Angebote. Pausierte Angebote sieht nur du."
      : "Lege dein erstes Angebot an: Welche Fahrzeugklassen gestaltest du, für welche Simulationen, ab welchem Preis?"));
    const liste = el("ul", "lv-mein-liste");
    eigene.forEach((a) => {
      const li = el("li");
      const t = el("span", "lv-mein-titel", a.title);
      if (!a.active) t.appendChild(el("em", "lv-pausiert-text", " (pausiert)"));
      const knoepfe = el("span", "lv-mein-knoepfe");
      const knopf = (icon: string, text: string, fn: () => void) => {
        const b = el("button", "lv-btn klein");
        b.type = "button";
        b.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> `;
        b.append(text);
        b.addEventListener("click", fn);
        knoepfe.appendChild(b);
      };
      knopf("fa-pen", "Bearbeiten", () => formOeffnen(a));
      knopf(a.active ? "fa-pause" : "fa-play", a.active ? "Pausieren" : "Aktivieren", () => void umschalten(a));
      knopf("fa-trash", "Löschen", () => void loeschen(a));
      li.append(t, knoepfe);
      liste.appendChild(li);
    });
    inhalt.appendChild(liste);
    if (eigene.length < MAX_ANGEBOTE) {
      const neu = el("button", "lv-btn primaer");
      neu.type = "button";
      neu.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i> Neues Angebot';
      neu.addEventListener("click", () => formOeffnen(null));
      inhalt.appendChild(neu);
    } else {
      inhalt.appendChild(el("p", "lv-mein-text", `Du hast die höchstens ${MAX_ANGEBOTE} Angebote angelegt.`));
    }
    return;
  }

  if (s.entzogen && !s.entzogen.automatisch) {
    inhalt.appendChild(el("p", "lv-mein-text warnung",
      `Deine Painter-Lizenz wurde vom Moderationsteam entzogen${s.entzogen.grund ? ` (Grund: ${s.entzogen.grund})` : ""}. Bei Fragen wende dich bitte an die GSRA.`));
    return;
  }
  // Voraussetzungen wie bei der Coach-Lizenz
  const r = s.regeln;
  const f = s.fortschritt;
  inhalt.appendChild(el("p", "lv-mein-text", s.entzogen?.automatisch
    ? "Deine Painter-Lizenz ruht wegen einer Verwarnung oder Sperre. Sobald du die Voraussetzungen wieder erfüllst, kannst du sie neu holen."
    : "Painter wird, wer die Voraussetzungen der Coach-Lizenz erfüllt – oder schon Coach ist. Dann kannst du hier Angebote einstellen."));
  const punkte = el("ul", "lv-voraus");
  const punkt = (ok: boolean, text: string) => {
    const li = el("li", ok ? "ok" : "");
    li.innerHTML = `<i class="fa-solid ${ok ? "fa-circle-check" : "fa-circle"}" aria-hidden="true"></i> `;
    li.append(text);
    punkte.appendChild(li);
  };
  punkt(f.erfuellt.dauer, `Mindestens ${r.mitglied_tage} Tage Mitglied (bisher ${f.mitglied_tage})`);
  punkt(f.erfuellt.setups, `Mindestens ${r.setup_punkte} Setup-Punkte (bisher ${f.setup_punkte})`);
  punkt(f.erfuellt.bewertungen, `Mindestens ${r.bewertungen} Bewertungen mit Ø „Ideal“ (bisher ${f.bewertungen}, Ø ${String(f.schnitt).replace(".", ",")})`);
  punkt(f.erfuellt.verhalten, `Keine Verwarnung oder Sperre in den letzten ${r.ruhe_tage} Tagen`);
  punkt(s.coach, "oder: aktive Coach-Lizenz");
  inhalt.appendChild(punkte);
  const holen = el("button", "lv-btn primaer");
  holen.type = "button";
  holen.disabled = !(f.alle || s.coach);
  holen.innerHTML = '<i class="fa-solid fa-id-badge" aria-hidden="true"></i> Painter-Lizenz holen';
  holen.addEventListener("click", async () => {
    holen.disabled = true;
    const { error: e } = await client()!.rpc("painter_claim_license");
    if (e) { holen.disabled = false; toast(e.message, "error"); return; }
    toast("Willkommen als Painter! Du kannst jetzt Angebote einstellen.", "success");
    void meinBereich();
  });
  inhalt.appendChild(holen);
}

async function umschalten(a: Angebot) {
  const { error } = await client()!.rpc("livery_offer_save", {
    _id: a.id, _title: a.title, _description: a.description, _classes: a.classes, _simulations: a.simulations,
    _price_from_cents: a.price_from_cents, _delivery_days: a.delivery_days, _images: a.images, _active: !a.active,
  });
  if (error) { toast(error.message, "error"); return; }
  toast(a.active ? "Das Angebot ist pausiert." : "Das Angebot ist wieder sichtbar.", "success");
  await laden();
  void meinBereich();
}

async function bilderLoeschen(pfade: string[]) {
  if (!pfade.length) return;
  await client()?.storage.from("liveries").remove(pfade.flatMap((p) => [p, vorschauPfad(p)])).catch(() => undefined);
}

async function loeschen(a: Angebot) {
  const ok = await dialog({ icon: "fa-trash", title: "Angebot löschen?", message: `„${a.title}“ und seine Beispielbilder werden endgültig gelöscht.`,
    confirmText: "Löschen", cancelText: "Abbrechen", danger: true });
  if (!ok) return;
  const { data, error } = await client()!.rpc("livery_offer_delete", { _id: a.id });
  if (error) { toast(error.message, "error"); return; }
  await bilderLoeschen((data as string[] | null) || []);
  toast("Das Angebot wurde gelöscht.", "success");
  await laden();
  void meinBereich();
}

// ---------------------------------------------------------
// Formular: anlegen und bearbeiten
// ---------------------------------------------------------
function chipsAufbauen(box: HTMLElement | null, name: string, werte: [string, string][], gewaehlt: string[]) {
  if (!box) return;
  box.replaceChildren();
  werte.forEach(([wert, text]) => {
    const l = el("label", "lv-chip-check");
    const i = el("input");
    i.type = "checkbox";
    i.name = name;
    i.value = wert;
    i.checked = gewaehlt.includes(wert);
    l.append(i, el("span", "", text));
    box.appendChild(l);
  });
}

function bilderZeigen() {
  const box = $("lvFormBilder");
  if (!box) return;
  box.replaceChildren();
  zustand.formBilder.forEach((b, i) => {
    const fig = el("figure");
    const img = el("img");
    img.src = bildUrl(vorschauPfad(b.pfad));
    img.alt = `Beispielbild ${i + 1}`;
    const weg = el("button", "lv-bild-weg");
    weg.type = "button";
    weg.title = "Bild entfernen";
    weg.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    weg.addEventListener("click", () => {
      zustand.formBilder.splice(i, 1);
      if (b.neu) void bilderLoeschen([b.pfad]);
      else zustand.entfernteBilder.push(b.pfad);
      bilderZeigen();
    });
    fig.append(img, weg);
    box.appendChild(fig);
  });
}

function formOeffnen(a: Angebot | null) {
  const form = $<HTMLFormElement>("lvForm");
  if (!form) return;
  zustand.bearbeiten = a;
  zustand.formBilder = (a?.images || []).map((p) => ({ pfad: p, neu: false }));
  zustand.entfernteBilder = [];
  form.reset();
  $("lvFormTitel")!.textContent = a ? "Angebot bearbeiten" : "Neues Angebot";
  (form.elements.namedItem("title") as HTMLInputElement).value = a?.title || "";
  (form.elements.namedItem("description") as HTMLTextAreaElement).value = a?.description || "";
  (form.elements.namedItem("price") as HTMLInputElement).value = a?.price_from_cents != null ? String(a.price_from_cents / 100).replace(".", ",") : "";
  (form.elements.namedItem("days") as HTMLInputElement).value = a?.delivery_days ? String(a.delivery_days) : "";
  (form.elements.namedItem("active") as HTMLInputElement).checked = a ? a.active : true;
  chipsAufbauen($("lvFormKlassen"), "klasse", Object.entries(KLASSEN), a?.classes || []);
  chipsAufbauen($("lvFormSims"), "sim", SIMULATIONEN.map((s) => [s, s]), a?.simulations || []);
  bilderZeigen();
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function bilderHochladen(dateien: FileList) {
  const sb = client();
  if (!sb || !zustand.ich) return;
  const frei = MAX_BILDER - zustand.formBilder.length;
  if (frei <= 0) { toast(`Höchstens ${MAX_BILDER} Beispielbilder.`, "error"); return; }
  for (const datei of Array.from(dateien).slice(0, frei)) {
    if (!/^image\/(jpeg|png|webp)$/.test(datei.type)) { toast("Bitte nur Bilder (JPG, PNG oder WebP).", "error"); continue; }
    if (datei.size > 40 * 1024 * 1024) { toast("Ein Bild ist zu groß (höchstens 40 MB vor dem Verkleinern).", "error"); continue; }
    const [gross, klein] = await Promise.all([vorschau(datei, 1920, 0.86), vorschau(datei, 640, 0.78)]);
    if (!gross || !klein) { toast("Ein Bild konnte nicht verarbeitet werden.", "error"); continue; }
    if (gross.size > 3 * 1024 * 1024) { toast("Ein Bild ist auch verkleinert noch größer als 3 MB.", "error"); continue; }
    const pfad = `${zustand.ich}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const optionen = { contentType: "image/jpeg", cacheControl: CACHE_EIN_JAHR };
    const a = await sb.storage.from("liveries").upload(vorschauPfad(pfad), klein, optionen);
    const b = a.error ? a : await sb.storage.from("liveries").upload(pfad, gross, optionen);
    if (b.error) { toast(`Das Bild konnte nicht hochgeladen werden: ${b.error.message}`, "error"); continue; }
    zustand.formBilder.push({ pfad, neu: true });
    bilderZeigen();
  }
}

async function speichern(e: SubmitEvent) {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  const wert = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value.trim();
  const klassen = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="klasse"]:checked')).map((i) => i.value);
  const sims = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="sim"]:checked')).map((i) => i.value);
  const preisText = wert("price").replace(/\s|€/g, "").replace(",", ".");
  const preis = preisText ? Math.round(Number(preisText) * 100) : null;
  const tage = wert("days") ? Number(wert("days")) : null;
  if (wert("title").length < 3) { toast("Bitte gib einen Titel mit mindestens 3 Zeichen an.", "error"); return; }
  if (!klassen.length) { toast("Bitte wähle mindestens eine Fahrzeugklasse.", "error"); return; }
  if (preis !== null && (!Number.isFinite(preis) || preis < 0 || preis > 500000)) { toast("Der Preis muss zwischen 0 und 5.000 € liegen.", "error"); return; }
  if (tage !== null && (!Number.isInteger(tage) || tage < 1 || tage > 120)) { toast("Die Lieferzeit muss zwischen 1 und 120 Tagen liegen.", "error"); return; }
  const knopf = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (knopf) knopf.disabled = true;
  const { error } = await client()!.rpc("livery_offer_save", {
    _id: zustand.bearbeiten?.id ?? null, _title: wert("title"), _description: (form.elements.namedItem("description") as HTMLTextAreaElement).value,
    _classes: klassen, _simulations: sims, _price_from_cents: preis, _delivery_days: tage,
    _images: zustand.formBilder.map((b) => b.pfad), _active: (form.elements.namedItem("active") as HTMLInputElement).checked,
  });
  if (knopf) knopf.disabled = false;
  if (error) { toast(error.message, "error"); return; }
  await bilderLoeschen(zustand.entfernteBilder);
  form.hidden = true;
  zustand.formBilder = [];
  toast("Dein Angebot ist gespeichert.", "success");
  await laden();
  void meinBereich();
}

function formAbbrechen() {
  const form = $<HTMLFormElement>("lvForm");
  // Schon hochgeladene, aber nicht gespeicherte Bilder wieder entfernen – nichts Verwaistes liegen lassen
  void bilderLoeschen(zustand.formBilder.filter((b) => b.neu).map((b) => b.pfad));
  zustand.formBilder = [];
  if (form) form.hidden = true;
}

// ---------------------------------------------------------
// Start
// ---------------------------------------------------------
async function starten() {
  const sb = client();
  if (!sb) return;
  filterAufbauen();
  const { data } = await sb.auth.getSession();
  zustand.ich = data.session?.user.id || null;
  if (!zustand.ich) return; // Gäste: Hinweis zur Anmeldung zeigt auth-nav.js
  const ich = await (sb.from("profiles").select("role").eq("id", zustand.ich).maybeSingle() as Antwort<{ role: string | null }>);
  zustand.moderator = ["moderator", "admin"].includes(ich.data?.role || "");
  await laden();
  void meinBereich();
  $("lvForm")?.addEventListener("submit", (e) => void speichern(e as SubmitEvent));
  $("lvFormAbbrechen")?.addEventListener("click", formAbbrechen);
  const datei = $<HTMLInputElement>("lvFormDatei");
  datei?.addEventListener("change", async () => {
    if (datei.files?.length) await bilderHochladen(datei.files);
    datei.value = "";
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void starten());
else void starten();
