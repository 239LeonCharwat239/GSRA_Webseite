// GSRA – Liveries (Garage), SQL 046/048. Überarbeitet 24.11.2026: gleicher Aufbau wie die Coaching-Seite
// (Schritte, Reiter „Painter / Pro-Painter / Als Painter“, Kategorien, Suche, Filterzeile, Karten, Formular als Dialog).
// Painter wird, wer die Voraussetzungen der Coach-Lizenz erfüllt oder schon Coach ist; Pro-Painter trägt das
// Admin-Team ein. Angefragt wird im Messenger, bezahlt untereinander – die GSRA ist nicht Vertragspartner.
// Alle Texte gehen mit textContent auf die Seite; Links in Beschreibungen öffnen erst nach dem Warnhinweis
// (src/links.ts). Bilder werden auf dem Gerät verkleinert und ohne Standortdaten gespeichert (src/bilder.ts).
import "./links";
import { CACHE_EIN_JAHR, vorschau } from "./bilder";
import { dialog, profilZeigen, supabaseClient, toast } from "./fenster";

type Klasse = "formel" | "prototyp" | "gt" | "tourenwagen" | "cup" | "stockcar" | "rallye" | "kart" | "sonstige";
type Angebot = {
  id: string; painter_id: string; title: string; description: string; classes: Klasse[]; simulations: string[];
  price_from_cents: number | null; delivery_days: number | null; images: string[]; active: boolean; updated_at: string;
};
type Profil = { id: string; username: string | null; avatar_url: string | null; gsra_id: number | null };
type Fortschritt = { mitglied_tage: number; setup_punkte: number; bewertungen: number; schnitt: number; alle: boolean;
  erfuellt: { dauer: boolean; setups: boolean; bewertungen: boolean; verhalten: boolean } };
type Status = { aktiv: boolean; pro: boolean; coach: boolean; erteilt_am: string | null;
  entzogen: { am: string; grund: string | null; automatisch: boolean } | null;
  regeln: { mitglied_tage: number; setup_punkte: number; bewertungen: number; schnitt: number; ruhe_tage: number };
  fortschritt: Fortschritt };
type Fehler = { message: string } | null;
type Ergebnis<T> = { data: T | null; error: Fehler };
type Client = {
  from: (t: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<Ergebnis<unknown>>;
  auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
  storage: { from: (b: string) => {
    upload: (p: string, d: Blob, o: Record<string, string>) => Promise<{ error: Fehler }>;
    remove: (p: string[]) => Promise<{ error: Fehler }>;
    getPublicUrl: (p: string) => { data: { publicUrl: string } };
  } };
};

export const KLASSEN: Record<Klasse, { text: string; icon: string }> = {
  formel: { text: "Formelfahrzeuge", icon: "fa-flag-checkered" },
  prototyp: { text: "Prototypen", icon: "fa-gauge-high" },
  gt: { text: "GT-Fahrzeuge", icon: "fa-car" },
  tourenwagen: { text: "Tourenwagen", icon: "fa-car-side" },
  cup: { text: "Markenpokale", icon: "fa-trophy" },
  stockcar: { text: "Stock Cars", icon: "fa-road" },
  rallye: { text: "Rallye & Rallycross", icon: "fa-mountain" },
  kart: { text: "Kart", icon: "fa-circle-dot" },
  sonstige: { text: "Sonstige", icon: "fa-palette" },
};
const SIMULATIONEN = ["iRacing", "Assetto Corsa Competizione", "Le Mans Ultimate", "Assetto Corsa", "Assetto Corsa EVO",
  "Automobilista 2", "rFactor 2", "RaceRoom", "Gran Turismo 7", "Forza Motorsport", "F1 25", "BeamNG.drive"];
const MAX_BILDER = 6;
const MAX_ANGEBOTE = 5;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const client = () => supabaseClient<Client>();
const euro = (cent: number) => (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: cent % 100 ? 2 : 0 });
const datum = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text = "") => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text) e.textContent = text;
  return e;
};
const iconText = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse: string, icon: string, text: string) => {
  const e = el(tag, klasse);
  e.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> `;
  e.append(text);
  return e;
};
const fehlt = (e: Fehler) => /could not find the function|schema cache|does not exist/i.test(e?.message || "");

const zustand = {
  ich: null as string | null,
  moderator: false,
  status: null as Status | null,
  angebote: [] as Angebot[],
  profile: new Map<string, Profil>(),
  proPainter: new Set<string>(),
  tab: "angebote" as "angebote" | "pro" | "painter",
  filter: { klasse: "" as Klasse | "", sim: "", suche: "", min: NaN, max: NaN, tage: 0, sort: "neu" },
  bearbeiten: null as Angebot | null,
  formBilder: [] as { pfad: string; neu: boolean }[],
  entfernteBilder: [] as string[],
  laedt: 0,
};

const bildUrl = (pfad: string) => client()?.storage.from("liveries").getPublicUrl(pfad).data.publicUrl || "";
const vorschauPfad = (pfad: string) => pfad.replace(/\.(jpe?g|png|webp)$/i, ".vorschau.jpg");
const nameVon = (id: string) => zustand.profile.get(id)?.username || "Painter";
const istPro = (id: string) => zustand.proPainter.has(id);

function avatar(id: string): HTMLElement {
  const a = el("span", "co-avatar");
  const url = zustand.profile.get(id)?.avatar_url || "";
  if (/^https:\/\//i.test(url)) {
    const img = el("img");
    img.src = (window as unknown as { gsraAvatarKlein?: (u: string) => string }).gsraAvatarKlein?.(url) || url;
    img.alt = "";
    img.loading = "lazy";
    a.appendChild(img);
  } else {
    a.textContent = nameVon(id).trim().charAt(0).toUpperCase() || "?";
  }
  return a;
}

// ---------------------------------------------------------
// Laden
// ---------------------------------------------------------
async function laden() {
  const sb = client();
  if (!sb) return;
  const { data, error } = await sb.from("livery_offers").select("*").order("updated_at", { ascending: false }).limit(300) as Ergebnis<Angebot[]>;
  if (error) {
    const liste = $("lvListe");
    if (liste) liste.innerHTML = `<div class="co-empty">${fehlt(error) ? "Die Liveries sind gleich verfügbar – die Datenbank wird gerade aktualisiert." : "Die Liveries konnten nicht geladen werden."}</div>`;
    return;
  }
  zustand.angebote = data || [];
  const ids = [...new Set([...zustand.angebote.map((a) => a.painter_id), ...(zustand.ich ? [zustand.ich] : [])])];
  const [profile, pros] = await Promise.all([
    ids.length ? sb.from("profiles").select("id, username, avatar_url, gsra_id").in("id", ids) as Promise<Ergebnis<Profil[]>> : Promise.resolve({ data: [], error: null }),
    sb.from("pro_painters").select("user_id") as Promise<Ergebnis<{ user_id: string }[]>>,
  ]);
  (profile.data || []).forEach((p) => zustand.profile.set(p.id, p));
  zustand.proPainter = new Set((pros.data || []).map((p) => p.user_id));
  statistik();
  zeigen();
}

function statistik() {
  const box = $("lvStats");
  if (!box) return;
  const aktiv = zustand.angebote.filter((a) => a.active);
  const painter = new Set(aktiv.map((a) => a.painter_id));
  const stat = (icon: string, zahl: number, text: string) => {
    const s = el("span", "co-stat");
    s.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> `;
    s.append(el("strong", "", String(zahl)), ` ${text}`);
    return s;
  };
  box.replaceChildren(stat("fa-brush", painter.size, painter.size === 1 ? "Painter" : "Painter"),
    stat("fa-palette", aktiv.length, aktiv.length === 1 ? "Angebot" : "Angebote"),
    stat("fa-crown", [...painter].filter(istPro).length, "Pro-Painter"));
  box.hidden = !aktiv.length;
}

// ---------------------------------------------------------
// Filter und Übersicht
// ---------------------------------------------------------
function passt(a: Angebot) {
  const f = zustand.filter;
  if (!a.active) return false;
  if (f.klasse && !a.classes.includes(f.klasse)) return false;
  if (f.sim && !a.simulations.includes(f.sim)) return false;
  const preis = a.price_from_cents == null ? null : a.price_from_cents / 100;
  if (Number.isFinite(f.min) && (preis == null || preis < f.min)) return false;
  if (Number.isFinite(f.max) && preis != null && preis > f.max) return false;
  if (f.tage && (a.delivery_days == null || a.delivery_days > f.tage)) return false;
  if (f.suche) {
    const p = zustand.profile.get(a.painter_id);
    const t = `${a.title} ${a.description} ${p?.username || ""} ${a.simulations.join(" ")} ${a.classes.map((k) => KLASSEN[k]?.text || "").join(" ")}`.toLowerCase();
    if (!f.suche.toLowerCase().split(/\s+/).filter(Boolean).every((w) => t.includes(w))) return false;
  }
  return true;
}

function sortiert(liste: Angebot[]) {
  const s = zustand.filter.sort;
  const preis = (a: Angebot) => a.price_from_cents ?? Number.POSITIVE_INFINITY;
  return [...liste].sort((a, b) =>
    s === "preis-auf" ? preis(a) - preis(b)
      : s === "preis-ab" ? (b.price_from_cents ?? -1) - (a.price_from_cents ?? -1)
        : s === "schnell" ? (a.delivery_days ?? 999) - (b.delivery_days ?? 999)
          : b.updated_at.localeCompare(a.updated_at));
}

function karte(a: Angebot, eigen = false): HTMLElement {
  const pro = istPro(a.painter_id);
  const k = el("article", `co-card lv-card${pro ? " pro" : ""}${a.active ? "" : " pausiert"}`);
  if (pro) k.appendChild(iconText("span", "co-pro-ribbon", "fa-crown", "Pro-Painter"));

  const bild = el("button", "lv-card-bild");
  bild.type = "button";
  bild.setAttribute("aria-label", `${a.title} – Details und Beispielbilder`);
  if (a.images[0]) {
    const img = el("img");
    img.src = bildUrl(vorschauPfad(a.images[0]));
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => { if (!img.dataset.voll) { img.dataset.voll = "1"; img.src = bildUrl(a.images[0]); } });
    bild.appendChild(img);
  } else {
    bild.appendChild(iconText("span", "lv-card-leer", "fa-palette", "Noch keine Beispielbilder"));
  }
  if (a.images.length > 1) bild.appendChild(iconText("span", "lv-card-zahl", "fa-images", String(a.images.length)));
  if (!a.active) bild.appendChild(el("span", "lv-card-pause", "Pausiert"));
  bild.addEventListener("click", () => details(a));
  k.appendChild(bild);

  const kopf = el("div", "co-card-head");
  const wer = el("button", "co-coach");
  wer.type = "button";
  wer.title = "Profil ansehen";
  wer.appendChild(avatar(a.painter_id));
  const t = el("span", "co-coach-text");
  t.appendChild(el("strong", "", nameVon(a.painter_id)));
  t.appendChild(el("small", "", pro ? "Pro-Painter der GSRA" : "GSRA-Painter"));
  wer.appendChild(t);
  wer.addEventListener("click", () => profilZeigen(a.painter_id));
  kopf.appendChild(wer);
  const erste = a.classes[0];
  if (erste) kopf.appendChild(iconText("span", "co-cat", KLASSEN[erste]?.icon || "fa-tag", KLASSEN[erste]?.text || erste));
  k.appendChild(kopf);

  k.appendChild(el("h3", "co-card-title", a.title));
  const meta = el("div", "co-meta");
  if (a.classes.length > 1) meta.appendChild(iconText("span", "", "fa-layer-group", a.classes.slice(1).map((c) => KLASSEN[c]?.text || c).join(", ")));
  if (a.simulations.length) meta.appendChild(iconText("span", "", "fa-gamepad", a.simulations.slice(0, 3).join(", ") + (a.simulations.length > 3 ? ` +${a.simulations.length - 3}` : "")));
  if (a.delivery_days) meta.appendChild(iconText("span", "", "fa-clock", `ca. ${a.delivery_days} ${a.delivery_days === 1 ? "Tag" : "Tage"}`));
  if (meta.childElementCount) k.appendChild(meta);
  if (a.description) k.appendChild(el("p", "co-desc", a.description));

  const fuss = el("div", "co-card-foot");
  const preis = el("div", "co-price");
  preis.appendChild(el("span", "co-price-main", a.price_from_cents != null ? `ab ${euro(a.price_from_cents)}` : "auf Anfrage"));
  preis.appendChild(el("span", "co-price-note", "Bezahlung untereinander"));
  fuss.appendChild(preis);
  const aktionen = el("div", "co-actions");
  if (eigen) {
    const knopf = (icon: string, text: string, fn: () => void, extra = "") => {
      const b = iconText("button", `co-btn ${extra}`.trim(), icon, text);
      b.type = "button";
      b.addEventListener("click", fn);
      aktionen.appendChild(b);
    };
    knopf("fa-pen", "Bearbeiten", () => formOeffnen(a));
    knopf(a.active ? "fa-pause" : "fa-play", a.active ? "Pausieren" : "Aktivieren", () => void umschalten(a));
    knopf("fa-trash", "Löschen", () => void loeschen(a), "danger");
  } else {
    const ansehen = iconText("button", "co-btn", "fa-images", "Ansehen");
    ansehen.type = "button";
    ansehen.addEventListener("click", () => details(a));
    aktionen.appendChild(ansehen);
    if (a.painter_id !== zustand.ich) {
      const anfragen = iconText("a", "co-btn primary", "fa-comment", "Anfragen");
      (anfragen as HTMLAnchorElement).href = anfrageLink(a);
      aktionen.appendChild(anfragen);
    }
  }
  fuss.appendChild(aktionen);
  k.appendChild(fuss);
  return k;
}

const anfrageLink = (a: Angebot) => `messenger.html?sellerId=${encodeURIComponent(a.painter_id)}&sellerName=${encodeURIComponent(nameVon(a.painter_id))}&itemTitle=${encodeURIComponent(`Livery: ${a.title}`)}`;

function leer(text: string, knopf?: { text: string; fn: () => void }) {
  const box = el("div", "co-empty");
  box.appendChild(el("span", "", text));
  if (knopf) {
    const b = el("button", "co-btn primary", knopf.text);
    b.type = "button";
    b.addEventListener("click", knopf.fn);
    box.append(" ", b);
  }
  return box;
}

function zeigen() {
  const alle = sortiert(zustand.angebote.filter(passt));
  const info = (id: string, n: number, gesamt: number) => {
    const p = $(id);
    if (p) p.textContent = gesamt ? `${n} von ${gesamt} ${gesamt === 1 ? "Angebot" : "Angeboten"}` : "";
  };
  const aktivGesamt = zustand.angebote.filter((a) => a.active);
  const liste = $("lvListe");
  if (liste) {
    liste.replaceChildren(...alle.map((a) => karte(a)));
    if (!alle.length) liste.appendChild(leer(aktivGesamt.length ? "Keine Liveries zu diesen Filtern." : "Noch keine Livery-Angebote – sei der erste Painter!",
      aktivGesamt.length ? { text: "Filter zurücksetzen", fn: filterZuruecksetzen } : { text: "Livery anbieten", fn: anbietenKlick }));
  }
  info("lvInfo", alle.length, aktivGesamt.length);
  const pros = alle.filter((a) => istPro(a.painter_id));
  const proListe = $("lvProListe");
  if (proListe) {
    proListe.replaceChildren(...pros.map((a) => karte(a)));
    if (!pros.length) proListe.appendChild(leer("Noch keine Angebote von Pro-Paintern."));
  }
  info("lvProInfo", pros.length, aktivGesamt.filter((a) => istPro(a.painter_id)).length);
  meineZeigen();
}

function filterAufbauen() {
  const chips = $("lvKlassen");
  const chip = (wert: Klasse | "", text: string, icon: string) => {
    const b = iconText("button", `co-chip${zustand.filter.klasse === wert ? " active" : ""}`, icon, text);
    b.type = "button";
    b.setAttribute("aria-pressed", String(zustand.filter.klasse === wert));
    b.addEventListener("click", () => {
      zustand.filter.klasse = wert;
      chips?.querySelectorAll(".co-chip").forEach((c) => { c.classList.remove("active"); c.setAttribute("aria-pressed", "false"); });
      b.classList.add("active");
      b.setAttribute("aria-pressed", "true");
      zeigen();
    });
    return b;
  };
  chips?.replaceChildren(chip("", "Alle", "fa-layer-group"), ...(Object.keys(KLASSEN) as Klasse[]).map((k) => chip(k, KLASSEN[k].text, KLASSEN[k].icon)));
  const sim = $<HTMLSelectElement>("lvSim");
  SIMULATIONEN.forEach((s) => { const o = el("option", "", s); o.value = s; sim?.appendChild(o); });
  const neu = () => {
    zustand.filter.sim = sim?.value || "";
    zustand.filter.min = parseFloat($<HTMLInputElement>("lvMinPreis")?.value || "");
    zustand.filter.max = parseFloat($<HTMLInputElement>("lvMaxPreis")?.value || "");
    zustand.filter.tage = Number($<HTMLSelectElement>("lvLieferzeit")?.value || 0);
    zustand.filter.sort = $<HTMLSelectElement>("lvSort")?.value || "neu";
    zeigen();
  };
  ["lvSim", "lvLieferzeit", "lvSort"].forEach((id) => $(id)?.addEventListener("change", neu));
  ["lvMinPreis", "lvMaxPreis"].forEach((id) => $(id)?.addEventListener("input", neu));
  const suche = $<HTMLInputElement>("lvSuche");
  let t = 0;
  suche?.addEventListener("input", () => { window.clearTimeout(t); t = window.setTimeout(() => { zustand.filter.suche = suche.value.trim(); zeigen(); }, 200); });
  $("lvReset")?.addEventListener("click", filterZuruecksetzen);
}

function filterZuruecksetzen() {
  zustand.filter = { klasse: "", sim: "", suche: "", min: NaN, max: NaN, tage: 0, sort: "neu" };
  ["lvSuche", "lvMinPreis", "lvMaxPreis"].forEach((id) => { const i = $<HTMLInputElement>(id); if (i) i.value = ""; });
  ["lvSim", "lvLieferzeit"].forEach((id) => { const s = $<HTMLSelectElement>(id); if (s) s.value = ""; });
  const sort = $<HTMLSelectElement>("lvSort");
  if (sort) sort.value = "neu";
  filterAufbauenChips();
  zeigen();
}
const filterAufbauenChips = () => $("lvKlassen")?.querySelectorAll(".co-chip").forEach((c, i) => c.classList.toggle("active", i === 0));

function tabWechseln(tab: typeof zustand.tab) {
  zustand.tab = tab;
  document.querySelectorAll<HTMLElement>(".co-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll<HTMLElement>(".co-panel").forEach((p) => { p.hidden = p.dataset.panel !== tab; });
  const filter = $("lvFilterArea");
  if (filter) filter.hidden = tab === "painter";
  const url = new URL(location.href);
  if (tab === "angebote") url.searchParams.delete("tab"); else url.searchParams.set("tab", tab);
  history.replaceState(null, "", url);
}

// ---------------------------------------------------------
// Details (Bilder, Beschreibung, Anfrage)
// ---------------------------------------------------------
function details(a: Angebot) {
  document.getElementById("lvDetails")?.remove();
  const overlay = el("div", "gsra-dialog-overlay");
  overlay.id = "lvDetails";
  const box = el("div", "gsra-dialog co-dialog lv-details");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", a.title);
  const zu = el("button", "gsra-dialog-close");
  zu.type = "button";
  zu.title = "Schließen";
  zu.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  box.appendChild(zu);

  if (a.images.length) {
    const buehne = el("div", "lv-buehne");
    const gross = el("img");
    gross.alt = `Beispiel: ${a.title}`;
    gross.src = bildUrl(a.images[0]);
    buehne.appendChild(gross);
    box.appendChild(buehne);
    if (a.images.length > 1) {
      const leiste = el("div", "lv-leiste");
      a.images.forEach((p, i) => {
        const t = el("button", i === 0 ? "aktiv" : "");
        t.type = "button";
        t.setAttribute("aria-label", `Bild ${i + 1}`);
        const img = el("img");
        img.src = bildUrl(vorschauPfad(p));
        img.alt = "";
        img.loading = "lazy";
        t.appendChild(img);
        t.addEventListener("click", () => { gross.src = bildUrl(p); leiste.querySelectorAll("button").forEach((x) => x.classList.remove("aktiv")); t.classList.add("aktiv"); });
        leiste.appendChild(t);
      });
      box.appendChild(leiste);
    }
  }
  const kopf = el("div", "co-card-head");
  const wer = el("button", "co-coach");
  wer.type = "button";
  wer.appendChild(avatar(a.painter_id));
  const t = el("span", "co-coach-text");
  t.appendChild(el("strong", "", nameVon(a.painter_id)));
  t.appendChild(el("small", "", `${istPro(a.painter_id) ? "Pro-Painter" : "GSRA-Painter"} · aktualisiert ${datum(a.updated_at)}`));
  wer.appendChild(t);
  wer.addEventListener("click", () => profilZeigen(a.painter_id));
  kopf.appendChild(wer);
  box.append(kopf, el("h3", "gsra-dialog-title lv-details-titel", a.title));
  const meta = el("div", "co-meta");
  a.classes.forEach((c) => meta.appendChild(iconText("span", "", KLASSEN[c]?.icon || "fa-tag", KLASSEN[c]?.text || c)));
  if (a.simulations.length) meta.appendChild(iconText("span", "", "fa-gamepad", a.simulations.join(", ")));
  if (a.delivery_days) meta.appendChild(iconText("span", "", "fa-clock", `Lieferzeit ca. ${a.delivery_days} ${a.delivery_days === 1 ? "Tag" : "Tage"}`));
  box.appendChild(meta);
  if (a.description) {
    const text = el("p", "lv-details-text");
    if (window.gsraTextMitLinks) window.gsraTextMitLinks(text, a.description);
    else text.textContent = a.description;
    box.appendChild(text);
  }
  const preis = el("div", "co-price");
  preis.appendChild(el("span", "co-price-main", a.price_from_cents != null ? `ab ${euro(a.price_from_cents)}` : "Preis auf Anfrage"));
  box.appendChild(preis);
  box.appendChild(iconText("p", "co-form-note", "fa-handshake",
    "Absprachen und Bezahlung regelt ihr direkt miteinander – die GSRA ist nicht Vertragspartner. Vereinbart Entwurf, Korrekturrunden und Lieferung vorher und zahlt nur, wem ihr vertraut."));

  const aktionen = el("div", "gsra-dialog-actions");
  if (a.painter_id !== zustand.ich) {
    const anfragen = iconText("a", "gsra-dialog-btn primary", "fa-comment", "Im Messenger anfragen");
    (anfragen as HTMLAnchorElement).href = anfrageLink(a);
    aktionen.appendChild(anfragen);
  } else {
    const bearbeiten = iconText("button", "gsra-dialog-btn primary", "fa-pen", "Bearbeiten");
    bearbeiten.addEventListener("click", () => { schliessen(); formOeffnen(a); });
    aktionen.appendChild(bearbeiten);
  }
  if (zustand.moderator && a.painter_id !== zustand.ich) {
    const weg = iconText("button", "gsra-dialog-btn secondary", "fa-trash", "Entfernen (Moderation)");
    weg.addEventListener("click", async () => {
      const ok = await dialog({ icon: "fa-trash", title: "Angebot entfernen?", message: "Das Angebot wird gelöscht; der Schritt steht im Moderationsprotokoll.",
        confirmText: "Entfernen", cancelText: "Abbrechen", danger: true });
      if (!ok) return;
      const { error } = await client()!.rpc("livery_offer_delete", { _id: a.id });
      if (error) { toast(error.message, "error"); return; }
      schliessen();
      toast("Das Angebot wurde entfernt.", "success");
      void neuLaden();
    });
    aktionen.appendChild(weg);
  }
  box.appendChild(aktionen);
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
// Als Painter: Lizenz, eigene Angebote
// ---------------------------------------------------------
async function statusLaden() {
  const sb = client();
  if (!sb || !zustand.ich) return;
  const { data, error } = await sb.rpc("painter_status", { _user: zustand.ich });
  zustand.status = error ? null : (data as Status);
  lizenzBox();
  meineZeigen();
}

function lizenzBox() {
  const box = $("lvLizenz");
  const s = zustand.status;
  if (!box) return;
  box.hidden = !s;
  if (!s) return;
  box.className = `co-license ${s.aktiv ? "active" : ""}`;
  box.replaceChildren();
  const kopf = el("div", "co-payout-head");
  kopf.innerHTML = `<i class="fa-solid ${s.aktiv ? "fa-brush" : "fa-award"}"></i>`;
  const text = el("div", "co-payout-text");
  const erfuellt = Object.values(s.fortschritt?.erfuellt || {}).filter(Boolean).length;
  if (s.aktiv) {
    text.appendChild(el("strong", "", s.pro ? "Pro-Painter der GSRA" : "GSRA-Painter-Lizenz aktiv"));
    text.appendChild(el("span", "", s.pro && !s.erteilt_am
      ? "Die GSRA hat dich als Pro-Painter ausgewählt: Du bietest ohne Lizenz an und erscheinst bei den Pro-Paintern. Verwarnungen oder Sperren stoppen die Angebote automatisch."
      : `Seit ${s.erteilt_am ? datum(s.erteilt_am) : "–"}. Bleib fair und zuverlässig: Verwarnungen oder Sperren pausieren deine Angebote automatisch.`));
  } else if (s.entzogen && !s.entzogen.automatisch) {
    box.classList.add("banned");
    text.appendChild(el("strong", "", "Painter-Lizenz entzogen"));
    text.appendChild(el("span", "", `Das Moderationsteam hat deine Lizenz am ${datum(s.entzogen.am)} entzogen. Begründung: ${s.entzogen.grund || "–"}`));
  } else {
    text.appendChild(el("strong", "", s.entzogen ? "Painter-Lizenz ruht" : "Noch keine Painter-Lizenz"));
    text.appendChild(el("span", "", s.coach
      ? "Du bist GSRA-Coach – damit kannst du dir die Painter-Lizenz sofort holen."
      : `${erfuellt} von 4 Voraussetzungen erfüllt – die gleichen wie für die Coach-Lizenz. Ein Abo ist nicht nötig.`));
  }
  kopf.appendChild(text);
  const aktionen = el("div", "co-actions");
  const knopf = s.aktiv
    ? iconText("button", "co-btn primary", "fa-plus", "Livery anbieten")
    : iconText("button", `co-btn ${s.entzogen && !s.entzogen.automatisch ? "" : "primary"}`, "fa-list-check", "Voraussetzungen ansehen");
  knopf.addEventListener("click", s.aktiv ? () => formOeffnen(null) : lizenzDialog);
  aktionen.appendChild(knopf);
  box.append(kopf, aktionen);
}

function lizenzDialog() {
  const s = zustand.status;
  if (!s) { toast("Melde dich an, um Painter zu werden.", "info"); return; }
  document.getElementById("lvLizenzDialog")?.remove();
  const overlay = el("div", "gsra-dialog-overlay");
  overlay.id = "lvLizenzDialog";
  const box = el("div", "gsra-dialog co-dialog co-license-dialog");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.innerHTML = '<button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button><div class="gsra-dialog-icon"><i class="fa-solid fa-brush"></i></div>';
  box.appendChild(el("h3", "gsra-dialog-title", "GSRA-Painter-Lizenz"));
  const body = el("div", "co-license-body");
  body.appendChild(el("p", "co-license-intro", "Painter wird man bei der GSRA über Leistung in der Community – mit denselben Voraussetzungen wie für die Coach-Lizenz. Bist du schon Coach, geht es sofort."));
  const r = s.regeln;
  const f = s.fortschritt;
  const ok = f?.erfuellt || { dauer: false, setups: false, bewertungen: false, verhalten: false };
  const liste = el("ul", "co-criteria");
  const punkt = (fertig: boolean, titel: string, detail: string) => {
    const li = el("li", fertig ? "done" : "");
    li.innerHTML = `<i class="fa-solid ${fertig ? "fa-circle-check" : "fa-circle"}"></i>`;
    const t = el("span");
    t.append(el("strong", "", titel), el("small", "", detail));
    li.appendChild(t);
    liste.appendChild(li);
  };
  punkt(ok.dauer, `Mindestens ${Math.round(r.mitglied_tage / 30)} Monate Mitglied`, `${Math.min(f.mitglied_tage, r.mitglied_tage)} von ${r.mitglied_tage} Tagen`);
  punkt(ok.setups, `${r.setup_punkte} Setup-Punkte`, `${f.setup_punkte} von ${r.setup_punkte} Punkten (Likes minus Dislikes deiner Setups)`);
  punkt(ok.bewertungen, `${r.bewertungen} Bewertungen mit Ø „Ideal“`, `${f.bewertungen} Bewertung${f.bewertungen === 1 ? "" : "en"} (Marktplatz und Setups)`);
  punkt(ok.verhalten, "Faires Verhalten", `Keine Sperre und keine Verwarnung in den letzten ${r.ruhe_tage} Tagen`);
  punkt(s.coach, "oder: GSRA-Coach", s.coach ? "Du bist Coach – das genügt." : "Mit aktiver Coach-Lizenz gilt alles als erfüllt.");
  body.appendChild(liste);
  box.appendChild(body);
  const gesperrt = Boolean(s.entzogen && !s.entzogen.automatisch);
  const bereit = !gesperrt && (f.alle || s.coach);
  const aktionen = el("div", "gsra-dialog-actions");
  const zu = el("button", "gsra-dialog-btn secondary", "Schließen");
  zu.type = "button";
  const holen = el("button", "gsra-dialog-btn primary", s.aktiv ? "Du bist schon Painter" : bereit ? "Lizenz holen" : "Noch nicht alles erfüllt");
  holen.type = "button";
  holen.disabled = s.aktiv || !bereit;
  holen.addEventListener("click", async () => {
    holen.disabled = true;
    const { error } = await client()!.rpc("painter_claim_license");
    if (error) { holen.disabled = false; toast(error.message, "error"); return; }
    schliessen();
    toast("Glückwunsch – du bist jetzt GSRA-Painter!", "success");
    await statusLaden();
    tabWechseln("painter");
  });
  aktionen.append(zu, holen);
  box.appendChild(aktionen);
  overlay.appendChild(box);
  const schliessen = () => overlay.remove();
  zu.addEventListener("click", schliessen);
  box.querySelector(".gsra-dialog-close")?.addEventListener("click", schliessen);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) schliessen(); });
  document.body.appendChild(overlay);
}

function meineZeigen() {
  const box = $("lvMeine");
  if (!box || !zustand.ich) return;
  const eigene = zustand.angebote.filter((a) => a.painter_id === zustand.ich);
  const anzahl = $("lvMeineAnzahl");
  if (anzahl) anzahl.textContent = `${eigene.length} von ${MAX_ANGEBOTE}`;
  const neu = $("lvAnbieten2");
  if (neu) neu.hidden = !zustand.status?.aktiv || eigene.length >= MAX_ANGEBOTE;
  box.replaceChildren(...eigene.map((a) => karte(a, true)));
  if (!eigene.length) box.appendChild(leer(zustand.status?.aktiv
    ? "Du hast noch kein Angebot. Zeig mit Beispielbildern, was du gestaltest."
    : "Sobald du Painter bist, verwaltest du hier deine Angebote."));
}

function anbietenKlick() {
  if (!zustand.ich) { toast("Melde dich an, um Liveries anzubieten.", "info"); return; }
  if (zustand.status?.aktiv) {
    if (zustand.angebote.filter((a) => a.painter_id === zustand.ich).length >= MAX_ANGEBOTE) {
      toast(`Du hast schon ${MAX_ANGEBOTE} Angebote. Bearbeite oder lösche eines.`, "info");
      tabWechseln("painter");
      return;
    }
    formOeffnen(null);
  } else {
    tabWechseln("painter");
    lizenzDialog();
  }
}

async function umschalten(a: Angebot) {
  const { error } = await client()!.rpc("livery_offer_save", {
    _id: a.id, _title: a.title, _description: a.description, _classes: a.classes, _simulations: a.simulations,
    _price_from_cents: a.price_from_cents, _delivery_days: a.delivery_days, _images: a.images, _active: !a.active,
  });
  if (error) { toast(error.message, "error"); return; }
  toast(a.active ? "Das Angebot ist pausiert." : "Das Angebot ist wieder sichtbar.", "success");
  await neuLaden();
}

async function loeschen(a: Angebot) {
  const ok = await dialog({ icon: "fa-trash", title: "Angebot löschen?", message: `„${a.title}“ und seine Beispielbilder werden endgültig gelöscht.`,
    confirmText: "Löschen", cancelText: "Abbrechen", danger: true });
  if (!ok) return;
  const { error } = await client()!.rpc("livery_offer_delete", { _id: a.id });
  if (error) { toast(error.message, "error"); return; }
  toast("Das Angebot wurde gelöscht.", "success"); // Bilder räumt die Datenbank auf (SQL 048)
  await neuLaden();
}

async function neuLaden() {
  await laden();
  lizenzBox();
}

// ---------------------------------------------------------
// Formular: anlegen und bearbeiten
// ---------------------------------------------------------
function auswahlChips(box: HTMLElement | null, name: string, werte: { wert: string; text: string; icon?: string }[], gewaehlt: string[]) {
  if (!box) return;
  box.replaceChildren(...werte.map(({ wert, text, icon }) => {
    const l = el("label", `co-chip lv-chip${gewaehlt.includes(wert) ? " active" : ""}`);
    const i = el("input");
    i.type = "checkbox";
    i.name = name;
    i.value = wert;
    i.checked = gewaehlt.includes(wert);
    i.addEventListener("change", () => l.classList.toggle("active", i.checked));
    l.appendChild(i);
    if (icon) l.insertAdjacentHTML("beforeend", `<i class="fa-solid ${icon}" aria-hidden="true"></i>`);
    l.append(` ${text}`);
    return l;
  }));
}

function bilderZeigen() {
  const box = $("lvBilder");
  const drop = $("lvDrop");
  if (!box) return;
  box.replaceChildren();
  zustand.formBilder.forEach((b, i) => {
    const fig = el("figure", i === 0 ? "titel" : "");
    const img = el("img");
    img.src = bildUrl(vorschauPfad(b.pfad));
    img.alt = `Beispielbild ${i + 1}`;
    fig.appendChild(img);
    if (i === 0) fig.appendChild(el("figcaption", "", "Titelbild"));
    const leiste = el("div", "lv-bild-knoepfe");
    if (i > 0) {
      const vor = el("button", "", "");
      vor.type = "button";
      vor.title = "Als Titelbild";
      vor.innerHTML = '<i class="fa-solid fa-star"></i>';
      vor.addEventListener("click", () => { zustand.formBilder.unshift(...zustand.formBilder.splice(i, 1)); bilderZeigen(); });
      leiste.appendChild(vor);
    }
    const weg = el("button", "weg");
    weg.type = "button";
    weg.title = "Bild entfernen";
    weg.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    weg.addEventListener("click", () => {
      zustand.formBilder.splice(i, 1);
      if (b.neu) void client()?.storage.from("liveries").remove([b.pfad, vorschauPfad(b.pfad)]);
      else zustand.entfernteBilder.push(b.pfad);
      bilderZeigen();
    });
    leiste.appendChild(weg);
    fig.appendChild(leiste);
    box.appendChild(fig);
  });
  if (zustand.laedt) {
    const lade = el("figure", "laedt");
    lade.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    lade.appendChild(el("figcaption", "", "wird verkleinert …"));
    box.appendChild(lade);
  }
  if (drop) drop.hidden = zustand.formBilder.length + zustand.laedt >= MAX_BILDER;
}

function formOeffnen(a: Angebot | null) {
  const modal = $("lvModal");
  const form = $<HTMLFormElement>("lvForm");
  if (!modal || !form) return;
  zustand.bearbeiten = a;
  zustand.formBilder = (a?.images || []).map((p) => ({ pfad: p, neu: false }));
  zustand.entfernteBilder = [];
  form.reset();
  $("lvFormTitel")!.textContent = a ? "Livery-Angebot bearbeiten" : "Livery anbieten";
  (form.elements.namedItem("title") as HTMLInputElement).value = a?.title || "";
  (form.elements.namedItem("description") as HTMLTextAreaElement).value = a?.description || "";
  (form.elements.namedItem("price") as HTMLInputElement).value = a?.price_from_cents != null ? String(a.price_from_cents / 100).replace(".", ",") : "";
  (form.elements.namedItem("days") as HTMLInputElement).value = a?.delivery_days ? String(a.delivery_days) : "";
  (form.elements.namedItem("active") as HTMLInputElement).checked = a ? a.active : true;
  auswahlChips($("lvFormKlassen"), "klasse", (Object.keys(KLASSEN) as Klasse[]).map((k) => ({ wert: k, text: KLASSEN[k].text, icon: KLASSEN[k].icon })), a?.classes || []);
  auswahlChips($("lvFormSims"), "sim", SIMULATIONEN.map((s) => ({ wert: s, text: s })), a?.simulations || []);
  bilderZeigen();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  (form.elements.namedItem("title") as HTMLInputElement).focus();
}

function formSchliessen() {
  const modal = $("lvModal");
  // Hochgeladene, aber nicht gespeicherte Bilder wieder entfernen – nichts Verwaistes liegen lassen
  const neu = zustand.formBilder.filter((b) => b.neu).flatMap((b) => [b.pfad, vorschauPfad(b.pfad)]);
  if (neu.length) void client()?.storage.from("liveries").remove(neu);
  zustand.formBilder = [];
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
}

async function bilderHochladen(dateien: File[]) {
  const sb = client();
  if (!sb || !zustand.ich) return;
  const frei = MAX_BILDER - zustand.formBilder.length - zustand.laedt;
  if (frei <= 0) { toast(`Höchstens ${MAX_BILDER} Beispielbilder.`, "error"); return; }
  const auswahl = dateien.filter((d) => /^image\/(jpeg|png|webp)$/.test(d.type)).slice(0, frei);
  if (auswahl.length < dateien.length) toast("Nur JPG, PNG oder WebP – und höchstens 6 Bilder.", "info");
  for (const datei of auswahl) {
    zustand.laedt++;
    bilderZeigen();
    try {
      if (datei.size > 40 * 1024 * 1024) throw new Error("Ein Bild ist zu groß (höchstens 40 MB vor dem Verkleinern).");
      const [gross, klein] = await Promise.all([vorschau(datei, 1920, 0.86), vorschau(datei, 640, 0.78)]);
      if (!gross || !klein) throw new Error("Ein Bild konnte nicht verarbeitet werden. Versuche es mit einem anderen Bild.");
      if (gross.size > 3 * 1024 * 1024) throw new Error("Ein Bild ist auch verkleinert noch größer als 3 MB.");
      const pfad = `${zustand.ich}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const optionen = { contentType: "image/jpeg", cacheControl: CACHE_EIN_JAHR };
      const a = await sb.storage.from("liveries").upload(vorschauPfad(pfad), klein, optionen);
      if (a.error) throw new Error(`Hochladen fehlgeschlagen: ${a.error.message}`);
      const b = await sb.storage.from("liveries").upload(pfad, gross, optionen);
      if (b.error) {
        void sb.storage.from("liveries").remove([vorschauPfad(pfad)]);
        throw new Error(`Hochladen fehlgeschlagen: ${b.error.message}`);
      }
      zustand.formBilder.push({ pfad, neu: true });
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      zustand.laedt--;
      bilderZeigen();
    }
  }
}

async function speichern(e: SubmitEvent) {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  if (zustand.laedt) { toast("Bitte warte, bis alle Bilder hochgeladen sind.", "info"); return; }
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
  zustand.formBilder = []; // gespeichert – nichts mehr aufräumen; entfernte alte Bilder räumt die Datenbank auf (SQL 048)
  formSchliessen();
  toast(zustand.bearbeiten ? "Dein Angebot ist aktualisiert." : "Dein Angebot ist online.", "success");
  await neuLaden();
  tabWechseln("painter");
}

function formEinrichten() {
  $("lvForm")?.addEventListener("submit", (e) => void speichern(e as SubmitEvent));
  document.querySelectorAll<HTMLElement>('[data-close="lvModal"]').forEach((b) => b.addEventListener("click", formSchliessen));
  $("lvModal")?.addEventListener("mousedown", (e) => { if (e.target === e.currentTarget) formSchliessen(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("lvModal")?.hidden) formSchliessen(); });
  const datei = $<HTMLInputElement>("lvDatei");
  datei?.addEventListener("change", async () => {
    if (datei.files?.length) await bilderHochladen(Array.from(datei.files));
    datei.value = "";
  });
  const drop = $("lvDrop");
  drop?.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
  ["dragleave", "dragend"].forEach((t) => drop?.addEventListener(t, () => drop.classList.remove("drag")));
  drop?.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
    const dateien = Array.from((e as DragEvent).dataTransfer?.files || []);
    if (dateien.length) void bilderHochladen(dateien);
  });
}

// ---------------------------------------------------------
// Start
// ---------------------------------------------------------
async function starten() {
  const sb = client();
  if (!sb) return;
  filterAufbauen();
  formEinrichten();
  document.querySelectorAll<HTMLElement>(".co-tab").forEach((b) => b.addEventListener("click", () => tabWechseln(b.dataset.tab as typeof zustand.tab)));
  $("lvAnbieten")?.addEventListener("click", anbietenKlick);
  $("lvAnbieten2")?.addEventListener("click", () => formOeffnen(null));
  const params = new URLSearchParams(location.search);
  const suche = params.get("suche");
  if (suche) {
    zustand.filter.suche = suche.slice(0, 60);
    const i = $<HTMLInputElement>("lvSuche");
    if (i) i.value = zustand.filter.suche;
  }
  const tab = params.get("tab");
  if (tab === "pro" || tab === "painter") tabWechseln(tab);

  const { data } = await sb.auth.getSession();
  zustand.ich = data.session?.user.id || null;
  if (!zustand.ich) return; // Gäste: Hinweis zur Anmeldung zeigt auth-nav.js
  const ich = await sb.from("profiles").select("role").eq("id", zustand.ich).maybeSingle() as Ergebnis<{ role: string | null }>;
  zustand.moderator = ["moderator", "admin"].includes(ich.data?.role || "");
  await laden();
  await statusLaden();
  const angebot = params.get("angebot");
  const ziel = angebot ? zustand.angebote.find((a) => a.id === angebot) : null;
  if (ziel) details(ziel);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void starten());
else void starten();
