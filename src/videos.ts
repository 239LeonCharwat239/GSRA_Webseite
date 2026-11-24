// GSRA – Videos (Community), SQL 046/048. Überarbeitet 24.11.2026: Aufbau wie Coaching und Liveries,
// Suche nach Titel, Hashtag, Creator-Name oder GSRA-ID (z. B. „100007“ oder „#100007“), Veröffentlichen als Dialog.
// Kacheln mit Vorschaubild, Titel, Text und Hashtags; ein Klick aufs Bild öffnet das Video auf der Plattform des
// Kanals (neuer Tab, ohne Verweis-Daten). Gespeichert wird bei der GSRA nur das Vorschaubild (960 × 540 px).
// Veröffentlichen dürfen Pro-Fahrer und Admins (die Datenbank prüft das selbst).
import "./links";
import { CACHE_EIN_JAHR, kachel } from "./bilder";
import { dialog, profilZeigen, supabaseClient, toast } from "./fenster";

type Video = { id: string; uploader_id: string; url: string; title: string; description: string; tags: string[]; thumbnail: string | null; created_at: string };
type Profil = { id: string; username: string | null; role?: string | null; gsra_id: number | null; avatar_url: string | null };
type Fehler = { message: string } | null;
type Client = {
  from: (t: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Fehler }>;
  auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
  storage: { from: (b: string) => {
    upload: (p: string, d: Blob, o: Record<string, string>) => Promise<{ error: Fehler }>;
    remove: (p: string[]) => Promise<{ error: Fehler }>;
    getPublicUrl: (p: string) => { data: { publicUrl: string } };
  } };
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const client = () => supabaseClient<Client>();
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

const zustand = {
  ich: null as string | null,
  darfHochladen: false,
  moderation: false,
  videos: [] as Video[],
  profile: new Map<string, Profil>(),
  pros: new Set<string>(),
  tag: "",
  suche: "",
  bild: null as Blob | null,
  markiert: "",
};

const bildUrl = (pfad: string) => client()?.storage.from("videos").getPublicUrl(pfad).data.publicUrl || "";
const sicher = (url: string): URL | null => { try { const u = new URL(url); return u.protocol === "https:" ? u : null; } catch { return null; } };
const datum = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const nameVon = (id: string) => zustand.profile.get(id)?.username || "GSRA";

export function hashtags(text: string): string[] {
  const roh = text.split(/[\s,;]+/).map((t) => t.replace(/^#+/, "").trim()).filter((t) => /^[A-Za-z0-9_ÄÖÜäöüß-]{1,30}$/.test(t));
  return [...new Set(roh)].slice(0, 10);
}

// Wer ist gemeint? GSRA-ID („100007“, „#100007“) oder genau ein Creator-Name
function creatorAusSuche(): Profil | null {
  const s = zustand.suche.trim();
  if (!s) return null;
  const nr = /^#?(\d{3,12})$/.exec(s)?.[1];
  const alle = [...zustand.profile.values()].filter((p) => zustand.videos.some((v) => v.uploader_id === p.id));
  if (nr) return alle.find((p) => String(p.gsra_id) === nr) || null;
  const genau = alle.filter((p) => (p.username || "").toLowerCase() === s.toLowerCase());
  return genau.length === 1 ? genau[0] : null;
}

async function laden() {
  const sb = client();
  const liste = $("vdListe");
  if (!sb || !liste) return;
  const { data, error } = await sb.from("pro_videos").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) {
    liste.innerHTML = `<div class="co-empty">${/schema cache|does not exist|could not find/i.test(error.message) ? "Die Videos sind gleich verfügbar – die Datenbank wird gerade aktualisiert." : "Die Videos konnten nicht geladen werden."}</div>`;
    return;
  }
  zustand.videos = ((data as Video[]) || []).filter((v) => sicher(v.url)); // nur https-Links (die Datenbank prüft das ohnehin)
  const ids = [...new Set(zustand.videos.map((v) => v.uploader_id))];
  if (ids.length) {
    const [p, pros] = await Promise.all([
      sb.from("profiles").select("id, username, role, gsra_id, avatar_url").in("id", ids),
      sb.from("pro_creators").select("user_id").in("user_id", ids),
    ]);
    ((p.data as Profil[]) || []).forEach((x) => zustand.profile.set(x.id, x));
    zustand.pros = new Set(((pros.data as { user_id: string }[]) || []).map((x) => x.user_id));
  }
  statistik();
  zeigen();
}

function statistik() {
  const box = $("vdStats");
  if (!box) return;
  const creator = new Set(zustand.videos.map((v) => v.uploader_id));
  const stat = (icon: string, zahl: number, text: string) => {
    const s = el("span", "co-stat");
    s.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> `;
    s.append(el("strong", "", String(zahl)), ` ${text}`);
    return s;
  };
  box.replaceChildren(stat("fa-film", zustand.videos.length, zustand.videos.length === 1 ? "Video" : "Videos"),
    stat("fa-crown", creator.size, "Creator"));
  box.hidden = !zustand.videos.length;
}

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

function karte(v: Video): HTMLElement | null {
  const url = sicher(v.url);
  if (!url) return null;
  const k = el("article", `co-card vd-card${zustand.markiert === v.id ? " vd-markiert" : ""}`);
  k.id = `video-${v.id}`;
  const link = el("a", "vd-bild");
  link.href = url.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `${v.title} auf ${url.hostname} ansehen (neuer Tab)`);
  if (v.thumbnail) {
    const img = el("img");
    img.src = bildUrl(v.thumbnail);
    img.alt = "";
    img.loading = "lazy";
    link.appendChild(img);
  } else {
    link.appendChild(el("span", "vd-ohne-bild", v.title));
  }
  link.insertAdjacentHTML("beforeend", '<span class="vd-play" aria-hidden="true"><i class="fa-solid fa-play"></i></span>');
  link.appendChild(iconText("span", "vd-host", "fa-arrow-up-right-from-square", url.hostname.replace(/^www\./, "")));
  k.appendChild(link);

  const kopf = el("div", "co-card-head");
  const wer = el("button", "co-coach");
  wer.type = "button";
  wer.title = "Alle Videos dieses Creators";
  wer.appendChild(avatar(v.uploader_id));
  const t = el("span", "co-coach-text");
  t.appendChild(el("strong", "", nameVon(v.uploader_id)));
  const p = zustand.profile.get(v.uploader_id);
  t.appendChild(el("small", "", `${zustand.pros.has(v.uploader_id) ? "Pro-Fahrer" : p?.role === "admin" ? "GSRA-Team" : "Creator"}${p?.gsra_id ? ` · #${p.gsra_id}` : ""}`));
  wer.appendChild(t);
  wer.addEventListener("click", () => creatorWaehlen(v.uploader_id));
  kopf.appendChild(wer);
  kopf.appendChild(el("time", "vd-datum", datum(v.created_at)));
  k.appendChild(kopf);

  k.appendChild(el("h3", "co-card-title", v.title));
  if (v.description) {
    const text = el("p", "co-desc vd-text");
    if (window.gsraTextMitLinks) window.gsraTextMitLinks(text, v.description);
    else text.textContent = v.description;
    k.appendChild(text);
  }
  if (v.tags.length) {
    const tags = el("div", "vd-tags");
    v.tags.forEach((tag) => {
      const b = el("button", "", `#${tag}`);
      b.type = "button";
      b.addEventListener("click", () => { zustand.tag = tag; zeigen(); $("vdSuche")?.scrollIntoView({ behavior: "smooth", block: "center" }); });
      tags.appendChild(b);
    });
    k.appendChild(tags);
  }
  if (v.uploader_id === zustand.ich || zustand.moderation) {
    const fuss = el("div", "co-actions vd-aktionen");
    const weg = iconText("button", "co-btn danger", "fa-trash", "Entfernen");
    weg.type = "button";
    weg.addEventListener("click", () => void loeschen(v));
    fuss.appendChild(weg);
    k.appendChild(fuss);
  }
  return k;
}

function creatorWaehlen(id: string) {
  const p = zustand.profile.get(id);
  zustand.suche = p?.gsra_id ? String(p.gsra_id) : p?.username || "";
  const i = $<HTMLInputElement>("vdSuche");
  if (i) i.value = zustand.suche;
  zustand.tag = "";
  zeigen();
  $("vdFilter")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function filterZeile(creator: Profil | null) {
  const box = $("vdFilter");
  if (!box) return;
  box.replaceChildren();
  box.hidden = !creator && !zustand.tag;
  if (creator) {
    const c = el("div", "vd-creator");
    c.appendChild(avatar(creator.id));
    const t = el("div", "vd-creator-text");
    t.appendChild(el("strong", "", `Videos von ${creator.username || "GSRA"}`));
    t.appendChild(el("small", "", `${zustand.pros.has(creator.id) ? "Pro-Fahrer" : "GSRA-Team"}${creator.gsra_id ? ` · GSRA-ID #${creator.gsra_id}` : ""}`));
    c.appendChild(t);
    const profil = iconText("button", "co-btn", "fa-id-card", "Profil");
    profil.type = "button";
    profil.addEventListener("click", () => profilZeigen(creator.id));
    const alle = iconText("button", "co-btn", "fa-xmark", "Alle Videos");
    alle.type = "button";
    alle.addEventListener("click", () => { zustand.suche = ""; const i = $<HTMLInputElement>("vdSuche"); if (i) i.value = ""; zeigen(); });
    c.append(profil, alle);
    box.appendChild(c);
  }
  if (zustand.tag) {
    const chip = el("button", "gsra-filter-chip", `#${zustand.tag}`);
    chip.type = "button";
    chip.title = "Hashtag-Filter aufheben";
    chip.insertAdjacentHTML("beforeend", ' <i class="fa-solid fa-xmark" aria-hidden="true"></i>');
    chip.addEventListener("click", () => { zustand.tag = ""; zeigen(); });
    box.appendChild(chip);
  }
}

function zeigen() {
  const liste = $("vdListe");
  if (!liste) return;
  const creator = creatorAusSuche();
  const s = zustand.suche.toLowerCase().replace(/^#/, "");
  const treffer = zustand.videos.filter((v) => {
    if (zustand.tag && !v.tags.includes(zustand.tag)) return false;
    if (creator) return v.uploader_id === creator.id;
    if (!s) return true;
    const p = zustand.profile.get(v.uploader_id);
    return `${v.title} ${v.description} ${v.tags.join(" ")} ${p?.username || ""} ${p?.gsra_id || ""}`.toLowerCase().includes(s);
  });
  filterZeile(creator);
  const anzahl = $("vdAnzahl");
  if (anzahl) anzahl.textContent = zustand.videos.length ? `${treffer.length} von ${zustand.videos.length}` : "";
  liste.replaceChildren();
  treffer.forEach((v) => { const k = karte(v); if (k) liste.appendChild(k); });
  if (!liste.childElementCount) {
    liste.appendChild(el("div", "co-empty", zustand.videos.length
      ? (/^#?\d{3,12}$/.test(zustand.suche.trim()) ? "Zu dieser GSRA-ID gibt es keine Videos." : "Keine Videos zu dieser Suche.")
      : "Bald findest du hier die neuesten Videos unserer Pro-Fahrer."));
  }
}

async function loeschen(v: Video) {
  const ok = await dialog({ icon: "fa-trash", title: "Video entfernen?", message: `„${v.title}“ verschwindet aus der Übersicht. Das Video selbst bleibt auf der Plattform des Kanals.`,
    confirmText: "Entfernen", cancelText: "Abbrechen", danger: true });
  if (!ok) return;
  const { error } = await client()!.rpc("video_delete", { _id: v.id });
  if (error) { toast(error.message, "error"); return; }
  toast("Das Video wurde entfernt.", "success"); // Vorschaubild räumt die Datenbank auf (SQL 048)
  void laden();
}

// ---------------------------------------------------------
// Veröffentlichen
// ---------------------------------------------------------
function vorschauLeeren() {
  zustand.bild = null;
  const box = $("vdVorschau");
  box?.querySelector("img")?.remove();
  box?.classList.remove("mit-bild");
}

async function bildWaehlen(datei: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(datei.type)) { toast("Bitte ein Bild (JPG, PNG oder WebP).", "error"); return; }
  const box = $("vdVorschau");
  box?.classList.add("laedt");
  const fertig = await kachel(datei, 960, 540, 0.82);
  box?.classList.remove("laedt");
  if (!fertig) { toast("Das Bild konnte nicht verarbeitet werden. Versuche es mit einem anderen Bild (JPG oder PNG).", "error"); return; }
  if (fertig.size > 1024 * 1024) { toast("Das Vorschaubild ist zu groß.", "error"); return; }
  zustand.bild = fertig;
  if (box) {
    box.querySelector("img")?.remove();
    const img = el("img");
    img.src = URL.createObjectURL(fertig);
    img.alt = "Vorschau";
    img.onload = () => URL.revokeObjectURL(img.src);
    box.appendChild(img);
    box.classList.add("mit-bild");
  }
}

function dialogOeffnen() {
  const modal = $("vdModal");
  const form = $<HTMLFormElement>("vdForm");
  if (!modal || !form) return;
  form.reset();
  vorschauLeeren();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  (form.elements.namedItem("url") as HTMLInputElement).focus();
}

function dialogSchliessen() {
  const modal = $("vdModal");
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
}

async function veroeffentlichen(e: SubmitEvent) {
  e.preventDefault();
  const sb = client();
  const form = e.currentTarget as HTMLFormElement;
  if (!sb || !zustand.ich) return;
  const wert = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement).value || "").trim();
  if (!sicher(wert("url"))) { toast("Bitte gib einen Link an, der mit https:// beginnt.", "error"); return; }
  if (wert("title").length < 3) { toast("Bitte gib einen Titel mit mindestens 3 Zeichen an.", "error"); return; }
  const knopf = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (knopf) { knopf.disabled = true; knopf.textContent = "Wird veröffentlicht …"; }
  let pfad: string | null = null;
  let schritt = "Vorschaubild hochladen";
  try {
    if (zustand.bild) {
      pfad = `${zustand.ich}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await sb.storage.from("videos").upload(pfad, zustand.bild, { contentType: "image/jpeg", cacheControl: CACHE_EIN_JAHR });
      if (error) throw error;
    }
    schritt = "Video speichern";
    const tags = hashtags(`${wert("tags")} ${(wert("description").match(/#[A-Za-z0-9_ÄÖÜäöüß-]+/g) || []).join(" ")}`);
    const { error } = await sb.rpc("video_save", { _id: null, _url: wert("url"), _title: wert("title"), _description: wert("description"), _tags: tags, _thumbnail: pfad });
    if (error) throw error;
    toast("Dein Video ist veröffentlicht.", "success");
    dialogSchliessen();
    vorschauLeeren();
    await laden();
  } catch (err) {
    if (pfad) await sb.storage.from("videos").remove([pfad]).catch(() => undefined); // nichts Verwaistes liegen lassen
    const text = (err as { message?: string })?.message || "unbekannter Fehler";
    console.error(`Video veröffentlichen (${schritt}):`, text);
    toast(`${schritt} hat nicht geklappt: ${text}`, "error");
  } finally {
    if (knopf) { knopf.disabled = false; knopf.textContent = "Veröffentlichen"; }
  }
}

async function starten() {
  const sb = client();
  if (!sb) return;
  const params = new URLSearchParams(location.search);
  zustand.markiert = params.get("video") || "";
  zustand.suche = (params.get("suche") || params.get("creator") || "").slice(0, 60);
  const suche = $<HTMLInputElement>("vdSuche");
  if (suche) suche.value = zustand.suche;

  $("vdForm")?.addEventListener("submit", (e) => void veroeffentlichen(e as SubmitEvent));
  document.querySelectorAll<HTMLElement>('[data-close="vdModal"]').forEach((b) => b.addEventListener("click", dialogSchliessen));
  $("vdModal")?.addEventListener("mousedown", (e) => { if (e.target === e.currentTarget) dialogSchliessen(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("vdModal")?.hidden) dialogSchliessen(); });
  const datei = $<HTMLInputElement>("vdDatei");
  datei?.addEventListener("change", async () => { if (datei.files?.[0]) await bildWaehlen(datei.files[0]); datei.value = ""; });
  const zone = $("vdVorschau");
  zone?.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag"); });
  ["dragleave", "dragend"].forEach((t) => zone?.addEventListener(t, () => zone.classList.remove("drag")));
  zone?.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag");
    const f = (e as DragEvent).dataTransfer?.files?.[0];
    if (f) void bildWaehlen(f);
  });
  let t = 0;
  suche?.addEventListener("input", () => { window.clearTimeout(t); t = window.setTimeout(() => { zustand.suche = suche.value.trim(); zeigen(); }, 200); });

  const { data } = await sb.auth.getSession();
  zustand.ich = data.session?.user.id || null;
  if (!zustand.ich) return;
  const [ich, pro] = await Promise.all([
    sb.from("profiles").select("role").eq("id", zustand.ich).maybeSingle(),
    sb.from("pro_creators").select("user_id").eq("user_id", zustand.ich).maybeSingle(),
  ]);
  const rolle = (ich.data as { role?: string } | null)?.role || "";
  zustand.moderation = rolle === "moderator" || rolle === "admin";
  zustand.darfHochladen = rolle === "admin" || Boolean(pro.data);
  const neu = $("vdNeu");
  if (neu) {
    neu.hidden = !zustand.darfHochladen;
    neu.addEventListener("click", dialogOeffnen);
  }
  await laden();
  if (zustand.markiert) document.getElementById(`video-${zustand.markiert}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void starten());
else void starten();
