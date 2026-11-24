// GSRA – Videos (Community), SQL 046, Entscheidung vom 24.11.2026.
// Kacheln mit Vorschaubild, Titel, Text und Hashtags; ein Klick aufs Bild öffnet das Video auf der Plattform des
// Kanals (neuer Tab, ohne Verweis-Daten). Gespeichert wird bei der GSRA nur das Vorschaubild (960 × 540 px, etwa
// 60–120 KB, ein Jahr zwischenspeicherbar) – kein Video, kein eingebetteter fremder Player, also auch keine
// Daten an fremde Dienste, solange niemand klickt. Veröffentlichen dürfen Pro-Fahrer und Admins.
import "./links";
import { CACHE_EIN_JAHR, kachel } from "./bilder";
import { dialog, profilZeigen, supabaseClient, toast } from "./fenster";

type Video = { id: string; uploader_id: string; url: string; title: string; description: string; tags: string[]; thumbnail: string | null; created_at: string };
type Profil = { id: string; username: string | null; role?: string | null };
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
};

const bildUrl = (pfad: string) => client()?.storage.from("videos").getPublicUrl(pfad).data.publicUrl || "";
const sicher = (url: string): URL | null => { try { const u = new URL(url); return u.protocol === "https:" ? u : null; } catch { return null; } };
const datum = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

export function hashtags(text: string): string[] {
  const roh = text.split(/[\s,;]+/).map((t) => t.replace(/^#+/, "").trim()).filter((t) => /^[A-Za-z0-9_ÄÖÜäöüß-]{1,30}$/.test(t));
  return [...new Set(roh)].slice(0, 10);
}

async function laden() {
  const sb = client();
  const liste = $("vdListe");
  if (!sb || !liste) return;
  liste.innerHTML = '<p class="lv-leer"><i class="fa-solid fa-spinner fa-spin"></i> Videos werden geladen …</p>';
  const { data, error } = await sb.from("pro_videos").select("*").order("created_at", { ascending: false }).limit(120);
  if (error) {
    liste.innerHTML = `<p class="lv-leer">${/schema cache|does not exist|could not find/i.test(error.message) ? "Die Videos sind gleich verfügbar – die Datenbank wird gerade aktualisiert." : "Die Videos konnten nicht geladen werden."}</p>`;
    return;
  }
  zustand.videos = (data as Video[]) || [];
  const ids = [...new Set(zustand.videos.map((v) => v.uploader_id))];
  if (ids.length) {
    const [p, pros] = await Promise.all([
      sb.from("profiles").select("id, username, role").in("id", ids),
      sb.from("pro_creators").select("user_id").in("user_id", ids),
    ]);
    ((p.data as Profil[]) || []).forEach((x) => zustand.profile.set(x.id, x));
    zustand.pros = new Set(((pros.data as { user_id: string }[]) || []).map((x) => x.user_id));
  }
  tagsZeigen();
  zeigen();
}

// Gewählter Hashtag als kleiner Filter oben rechts (wählen per Klick auf einen Hashtag im Video, × hebt ihn auf)
function tagsZeigen() {
  const chip = $<HTMLButtonElement>("vdTagFilter");
  if (!chip) return;
  chip.hidden = !zustand.tag;
  chip.replaceChildren();
  if (!zustand.tag) return;
  chip.append(`#${zustand.tag}`);
  chip.insertAdjacentHTML("beforeend", ' <i class="fa-solid fa-xmark" aria-hidden="true"></i>');
  chip.title = "Filter aufheben";
  chip.setAttribute("aria-label", `Filter #${zustand.tag} aufheben`);
}

function karte(v: Video): HTMLElement | null {
  const url = sicher(v.url);
  if (!url) return null;
  const k = el("article", "vd-karte");
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
  link.appendChild(el("span", "vd-host", url.hostname.replace(/^www\./, "")));
  const text = el("div", "vd-text");
  const kopf = el("div", "vd-wer");
  const name = el("button", "lv-painter-link", zustand.profile.get(v.uploader_id)?.username || "GSRA");
  name.type = "button";
  name.addEventListener("click", () => profilZeigen(v.uploader_id));
  kopf.appendChild(name);
  if (zustand.pros.has(v.uploader_id)) kopf.appendChild(el("em", "lv-pro", "Pro"));
  else if (zustand.profile.get(v.uploader_id)?.role === "admin") kopf.appendChild(el("em", "lv-pro team", "GSRA-Team"));
  kopf.appendChild(el("time", "", datum(v.created_at)));
  text.append(kopf, el("h3", "", v.title));
  if (v.description) {
    const p = el("p", "vd-beschreibung");
    if (window.gsraTextMitLinks) window.gsraTextMitLinks(p, v.description);
    else p.textContent = v.description;
    text.appendChild(p);
    if (v.description.length > 140) {
      const mehr = el("button", "vd-mehr", "Mehr anzeigen");
      mehr.type = "button";
      mehr.addEventListener("click", () => { const offen = p.classList.toggle("offen"); mehr.textContent = offen ? "Weniger anzeigen" : "Mehr anzeigen"; });
      text.appendChild(mehr);
    }
  }
  if (v.tags.length) {
    const tags = el("div", "vd-tags");
    v.tags.forEach((t) => {
      const b = el("button", "", `#${t}`);
      b.type = "button";
      b.addEventListener("click", () => { zustand.tag = t; tagsZeigen(); zeigen(); window.scrollTo({ top: 0, behavior: "smooth" }); });
      tags.appendChild(b);
    });
    text.appendChild(tags);
  }
  if (v.uploader_id === zustand.ich || zustand.moderation) {
    const weg = el("button", "vd-loeschen");
    weg.type = "button";
    weg.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i> Entfernen';
    weg.addEventListener("click", () => void loeschen(v));
    text.appendChild(weg);
  }
  k.append(link, text);
  return k;
}

function zeigen() {
  const liste = $("vdListe");
  if (!liste) return;
  const s = zustand.suche.toLowerCase();
  const treffer = zustand.videos.filter((v) =>
    (!zustand.tag || v.tags.includes(zustand.tag)) &&
    (!s || `${v.title} ${v.description} ${v.tags.join(" ")} ${zustand.profile.get(v.uploader_id)?.username || ""}`.toLowerCase().includes(s)));
  liste.replaceChildren();
  const anzahl = $("vdAnzahl");
  if (anzahl) anzahl.textContent = zustand.videos.length ? `${treffer.length} von ${zustand.videos.length}` : "";
  if (!treffer.length) {
    liste.appendChild(el("p", "lv-leer", zustand.videos.length ? "Keine Videos zu dieser Auswahl." : "Bald findest du hier die neuesten Videos unserer Pro-Fahrer."));
    return;
  }
  treffer.forEach((v) => { const k = karte(v); if (k) liste.appendChild(k); });
}

async function loeschen(v: Video) {
  const ok = await dialog({ icon: "fa-trash", title: "Video entfernen?", message: `„${v.title}“ verschwindet aus der Übersicht. Das Video selbst bleibt auf der Plattform des Kanals.`,
    confirmText: "Entfernen", cancelText: "Abbrechen", danger: true });
  if (!ok) return;
  const { data, error } = await client()!.rpc("video_delete", { _id: v.id });
  if (error) { toast(error.message, "error"); return; }
  if (typeof data === "string" && data.startsWith(`${zustand.ich}/`)) await client()!.storage.from("videos").remove([data]).catch(() => undefined);
  toast("Das Video wurde entfernt.", "success");
  void laden();
}

async function bildWaehlen(datei: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(datei.type)) { toast("Bitte ein Bild (JPG, PNG oder WebP).", "error"); return; }
  const fertig = await kachel(datei, 960, 540, 0.82);
  if (!fertig) { toast("Das Bild konnte nicht verarbeitet werden.", "error"); return; }
  if (fertig.size > 1024 * 1024) { toast("Das Vorschaubild ist zu groß.", "error"); return; }
  zustand.bild = fertig;
  const box = $("vdVorschau");
  if (box) {
    const img = el("img");
    img.src = URL.createObjectURL(fertig);
    img.alt = "Vorschau";
    img.onload = () => URL.revokeObjectURL(img.src);
    box.replaceChildren(img);
  }
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
  if (knopf) knopf.disabled = true;
  let pfad: string | null = null;
  try {
    if (zustand.bild) {
      pfad = `${zustand.ich}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await sb.storage.from("videos").upload(pfad, zustand.bild, { contentType: "image/jpeg", cacheControl: CACHE_EIN_JAHR });
      if (error) throw error;
    }
    const tags = hashtags(`${wert("tags")} ${(wert("description").match(/#[A-Za-z0-9_ÄÖÜäöüß-]+/g) || []).join(" ")}`);
    const { error } = await sb.rpc("video_save", { _id: null, _url: wert("url"), _title: wert("title"), _description: wert("description"), _tags: tags, _thumbnail: pfad });
    if (error) throw error;
    toast("Dein Video ist veröffentlicht.", "success");
    form.reset();
    zustand.bild = null;
    const box = $("vdVorschau");
    if (box) box.innerHTML = '<i class="fa-solid fa-image" aria-hidden="true"></i><span>Noch kein Bild</span>';
    formZu();
    void laden();
  } catch (err) {
    if (pfad) await sb.storage.from("videos").remove([pfad]).catch(() => undefined); // nichts Verwaistes liegen lassen
    toast((err as { message?: string })?.message || "Das Video konnte nicht veröffentlicht werden.", "error");
  } finally {
    if (knopf) knopf.disabled = false;
  }
}

function formZu() {
  const form = $("vdForm");
  if (form) form.hidden = true;
  $("vdNeuAuf")?.setAttribute("aria-expanded", "false");
}

async function starten() {
  const sb = client();
  if (!sb) return;
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
  const neu = $("vdNeuKarte");
  if (neu && zustand.darfHochladen) neu.hidden = false;
  $("vdNeuAuf")?.addEventListener("click", () => {
    const form = $("vdForm");
    if (!form) return;
    form.hidden = !form.hidden;
    $("vdNeuAuf")?.setAttribute("aria-expanded", String(!form.hidden));
  });
  $("vdAbbrechen")?.addEventListener("click", formZu);
  $("vdTagFilter")?.addEventListener("click", () => { zustand.tag = ""; tagsZeigen(); zeigen(); });
  $("vdForm")?.addEventListener("submit", (e) => void veroeffentlichen(e as SubmitEvent));
  const datei = $<HTMLInputElement>("vdDatei");
  datei?.addEventListener("change", async () => { if (datei.files?.[0]) await bildWaehlen(datei.files[0]); datei.value = ""; });
  const suche = $<HTMLInputElement>("vdSuche");
  let t = 0;
  suche?.addEventListener("input", () => { window.clearTimeout(t); t = window.setTimeout(() => { zustand.suche = suche.value.trim(); zeigen(); }, 200); });
  await laden();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void starten());
else void starten();
