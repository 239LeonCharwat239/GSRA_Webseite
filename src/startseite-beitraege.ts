// GSRA – Startseite wie eine Zeitung (SQL 056, Wunsch 26.11.): Admins veröffentlichen Beiträge mit Überschrift,
// bis zu 6 Bildern und Text (z. B. „Wir sind auf der Simracing Expo 2027 – besucht uns an Stand XYZ“).
//  * Alle (auch Gäste) lesen die veröffentlichten Beiträge; der neueste bzw. angeheftete ist der Aufmacher.
//  * Schreiben, Ändern, Löschen nur über die geprüften Datenbank-Funktionen (Admin mit Zwei-Faktor); die Seite
//    zeigt die Knöpfe nur Admins, entscheiden tut die Datenbank.
//  * Bilder werden auf dem Gerät verkleinert (längste Seite 1.920 px, JPEG, ohne Standortdaten) und nur im eigenen
//    Ordner des Speichers „startseite“ abgelegt (höchstens 3 MB, nur JPEG/WebP/PNG – prüft auch der Speicher).
//  * Alles per textContent – kein HTML aus Beiträgen.
import { CACHE_EIN_JAHR, vorschau } from "./bilder";
import { dialog, supabaseClient, toast } from "./fenster";

type Fehler = { message: string } | null;
type Beitrag = { id: string; titel: string; text: string; bilder: string[]; veroeffentlicht: boolean; angeheftet: boolean; created_at: string };
type Client = {
  from: (t: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Fehler }>;
  auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
  storage: { from: (b: string) => {
    upload: (pfad: string, datei: Blob, o: Record<string, unknown>) => Promise<{ error: Fehler }>;
    remove: (pfade: string[]) => Promise<{ error: Fehler }>;
    getPublicUrl: (pfad: string) => { data: { publicUrl: string } };
  } };
};

const SPEICHER = "startseite";
const MAX_BILDER = 6;
const MAX_TEXT = 7000;
const client = () => supabaseClient<Client>();
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text = "") => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text) e.textContent = text;
  return e;
};
const icon = (name: string) => { const i = el("i", `fa-solid ${name}`); i.setAttribute("aria-hidden", "true"); return i; };
const knopf = (klasse: string, iconName: string, text: string) => { const b = el("button", klasse); b.type = "button"; b.append(icon(iconName), ` ${text}`); return b; };
const datum = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
const bildUrl = (pfad: string) => client()?.storage.from(SPEICHER).getPublicUrl(pfad).data.publicUrl || "";

const zustand = { admin: false, ich: null as string | null, beitraege: [] as Beitrag[] };

// ---------------------------------------------------------------- Anzeige
function bildBox(b: Beitrag): HTMLElement | null {
  if (!b.bilder.length) return null;
  const fig = el("figure", "hn-bilder");
  const gross = el("img", "hn-bild");
  gross.src = bildUrl(b.bilder[0]);
  gross.alt = b.titel;
  gross.loading = "lazy";
  gross.decoding = "async";
  fig.append(gross);
  if (b.bilder.length > 1) {
    const leiste = el("div", "hn-minis");
    b.bilder.forEach((p, i) => {
      const m = el("button", `hn-mini${i === 0 ? " aktiv" : ""}`);
      m.type = "button";
      m.setAttribute("aria-label", `Bild ${i + 1} von ${b.bilder.length}`);
      const img = el("img");
      img.src = bildUrl(p);
      img.alt = "";
      img.loading = "lazy";
      m.append(img);
      m.addEventListener("click", () => {
        gross.src = bildUrl(p);
        leiste.querySelectorAll(".hn-mini").forEach((x) => x.classList.toggle("aktiv", x === m));
      });
      leiste.append(m);
    });
    fig.append(leiste);
  }
  return fig;
}

function beitragKarte(b: Beitrag, aufmacher: boolean): HTMLElement {
  const art = el("article", `hn-beitrag${aufmacher ? " hn-aufmacher" : ""}`);
  const bilder = bildBox(b);
  if (bilder) art.append(bilder);
  const inhalt = el("div", "hn-inhalt");
  const zeile = el("p", "hn-zeile");
  zeile.append(icon("fa-newspaper"), ` ${datum(b.created_at)}`);
  if (b.angeheftet) { const a = el("span", "hn-marke"); a.append(icon("fa-thumbtack"), " Angeheftet"); zeile.append(a); }
  if (!b.veroeffentlicht) { const a = el("span", "hn-marke entwurf"); a.append(icon("fa-eye-slash"), " Entwurf – nur für Admins sichtbar"); zeile.append(a); }
  const titel = el("h3", "hn-titel", b.titel);
  inhalt.append(zeile, titel);
  if (b.text) {
    const text = el("p", "hn-text", b.text);
    inhalt.append(text);
    if (!aufmacher && b.text.length > 280) {
      text.classList.add("gekuerzt");
      const mehr = knopf("hn-mehr", "fa-angle-down", "Weiterlesen");
      mehr.addEventListener("click", () => {
        const zu = text.classList.toggle("gekuerzt");
        mehr.replaceChildren(icon(zu ? "fa-angle-down" : "fa-angle-up"), zu ? " Weiterlesen" : " Weniger");
      });
      inhalt.append(mehr);
    }
  }
  if (zustand.admin) {
    const leiste = el("div", "hn-admin");
    const bearbeiten = knopf("hn-knopf", "fa-pen", "Bearbeiten");
    bearbeiten.addEventListener("click", () => editor(b));
    const loeschen = knopf("hn-knopf gefahr", "fa-trash", "Löschen");
    loeschen.addEventListener("click", () => void entfernen(b));
    leiste.append(bearbeiten, loeschen);
    inhalt.append(leiste);
  }
  art.append(inhalt);
  return art;
}

function zeigen() {
  const box = $("homeNews");
  const liste = $("hnListe");
  if (!box || !liste) return;
  box.hidden = !zustand.beitraege.length && !zustand.admin;
  const neu = $("hnNeu");
  if (neu) neu.hidden = !zustand.admin;
  liste.replaceChildren();
  if (!zustand.beitraege.length) {
    liste.append(el("p", "hn-leer", "Noch keine Beiträge. Mit „Neuer Beitrag“ erscheint hier die erste Meldung für alle."));
    return;
  }
  const [erster, ...rest] = zustand.beitraege;
  liste.append(beitragKarte(erster, true));
  if (rest.length) {
    const raster = el("div", "hn-raster");
    for (const b of rest) raster.append(beitragKarte(b, false));
    liste.append(raster);
  }
}

async function laden() {
  const sb = client();
  if (!sb) return;
  const { data, error } = await sb.from("home_posts").select("id, titel, text, bilder, veroeffentlicht, angeheftet, created_at")
    .order("angeheftet", { ascending: false }).order("created_at", { ascending: false }).limit(13);
  if (error) {
    // 056 noch nicht ausgeführt: Bereich einfach weglassen
    zustand.beitraege = [];
  } else {
    zustand.beitraege = ((data ?? []) as Beitrag[]).filter((b) => b && typeof b.titel === "string")
      .map((b) => ({ ...b, bilder: Array.isArray(b.bilder) ? b.bilder.filter((p) => typeof p === "string") : [] }));
  }
  zeigen();
}

// ---------------------------------------------------------------- Bearbeiten (nur Admins)
function editor(vorlage?: Beitrag) {
  const d = el("dialog", "hn-dialog");
  d.setAttribute("aria-label", vorlage ? "Beitrag bearbeiten" : "Neuer Beitrag");
  const form = el("form");
  form.noValidate = true;
  const kopf = el("h2", "", vorlage ? "Beitrag bearbeiten" : "Neuer Beitrag für die Startseite");
  const titel = el("input") as HTMLInputElement;
  titel.type = "text"; titel.maxLength = 140; titel.required = true; titel.value = vorlage?.titel ?? "";
  titel.placeholder = "Überschrift, z. B. „Wir sind auf der Simracing Expo 2027“";
  const text = el("textarea") as HTMLTextAreaElement;
  text.rows = 8; text.maxLength = MAX_TEXT; text.value = vorlage?.text ?? "";
  text.placeholder = "Text (bis etwa 1.000 Wörter), z. B. „Besucht uns an Stand B12 – wir freuen uns auf euch!“";
  const zaehler = el("small", "hn-zaehler");
  const zaehlen = () => { zaehler.textContent = `${text.value.length.toLocaleString("de-DE")} / ${MAX_TEXT.toLocaleString("de-DE")} Zeichen`; };
  text.addEventListener("input", zaehlen);
  zaehlen();

  // Bilder: vorhandene (Pfade) und neue (Dateien)
  const vorhanden = [...(vorlage?.bilder ?? [])];
  const entfernt: string[] = [];
  const neu: File[] = [];
  const bilderBox = el("div", "hn-bildwahl");
  const datei = el("input") as HTMLInputElement;
  datei.type = "file"; datei.accept = "image/jpeg,image/png,image/webp"; datei.multiple = true;
  const zeichneBilder = () => {
    bilderBox.replaceChildren();
    const eintrag = (src: string, weg: () => void) => {
      const f = el("div", "hn-bildwahl-eintrag");
      const img = el("img"); img.src = src; img.alt = "";
      const x = el("button", "hn-bildwahl-weg"); x.type = "button"; x.setAttribute("aria-label", "Bild entfernen"); x.append(icon("fa-xmark"));
      x.addEventListener("click", () => { weg(); zeichneBilder(); });
      f.append(img, x);
      bilderBox.append(f);
    };
    vorhanden.forEach((p, i) => eintrag(bildUrl(p), () => { entfernt.push(...vorhanden.splice(i, 1)); }));
    neu.forEach((f, i) => eintrag(URL.createObjectURL(f), () => { neu.splice(i, 1); }));
    datei.disabled = vorhanden.length + neu.length >= MAX_BILDER;
  };
  datei.addEventListener("change", () => {
    for (const f of Array.from(datei.files ?? [])) {
      if (vorhanden.length + neu.length >= MAX_BILDER) { toast(`Höchstens ${MAX_BILDER} Bilder pro Beitrag.`, "error"); break; }
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast("Nur JPEG-, PNG- oder WebP-Bilder.", "error"); continue; }
      if (f.size > 40 * 1024 * 1024) { toast("Ein Bild ist zu groß (höchstens 40 MB vor dem Verkleinern).", "error"); continue; }
      neu.push(f);
    }
    datei.value = "";
    zeichneBilder();
  });
  zeichneBilder();

  const sichtbar = el("input") as HTMLInputElement;
  sichtbar.type = "checkbox"; sichtbar.checked = vorlage?.veroeffentlicht ?? true;
  const anheften = el("input") as HTMLInputElement;
  anheften.type = "checkbox"; anheften.checked = vorlage?.angeheftet ?? false;
  const label = (t: string, feld: HTMLElement) => { const l = el("label", "hn-feld"); l.append(el("span", "", t), feld); return l; };
  const haken = (t: string, feld: HTMLInputElement) => { const l = el("label", "hn-haken"); l.append(feld, ` ${t}`); return l; };
  const fehler = el("p", "hn-fehler");
  fehler.setAttribute("aria-live", "polite");
  const abbrechen = el("button", "hn-knopf", "Abbrechen"); abbrechen.type = "button";
  const speichern = el("button", "hn-knopf primaer", vorlage ? "Speichern" : "Veröffentlichen"); speichern.type = "submit";
  const aktionen = el("div", "hn-aktionen"); aktionen.append(abbrechen, speichern);
  form.append(kopf, label("Überschrift", titel), label("Text", text), zaehler,
    label(`Bilder (höchstens ${MAX_BILDER}, werden verkleinert)`, datei), bilderBox,
    haken("Für alle sichtbar (sonst Entwurf, nur Admins sehen ihn)", sichtbar), haken("Oben anheften", anheften), fehler, aktionen);
  d.append(form);
  document.body.append(d);
  abbrechen.addEventListener("click", () => d.close());
  d.addEventListener("close", () => d.remove());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sb = client();
    if (!sb || !zustand.ich) return;
    const t = titel.value.trim();
    if (t.length < 3) { fehler.textContent = "Die Überschrift braucht mindestens 3 Zeichen."; titel.focus(); return; }
    speichern.disabled = true;
    fehler.textContent = neu.length ? "Bilder werden verkleinert und hochgeladen …" : "";
    const hochgeladen: string[] = [];
    try {
      for (const f of neu) {
        const gross = await vorschau(f, 1920, 0.86);
        if (!gross) throw new Error("Ein Bild konnte nicht verarbeitet werden. Versuche es mit einem anderen Bild.");
        if (gross.size > 3 * 1024 * 1024) throw new Error("Ein Bild ist auch verkleinert noch größer als 3 MB.");
        const pfad = `${zustand.ich}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await sb.storage.from(SPEICHER).upload(pfad, gross, { contentType: "image/jpeg", cacheControl: CACHE_EIN_JAHR });
        if (error) throw new Error(`Hochladen fehlgeschlagen: ${error.message}`);
        hochgeladen.push(pfad);
      }
      const { error } = await sb.rpc("home_post_save", {
        _id: vorlage?.id ?? null, _titel: t, _text: text.value.slice(0, MAX_TEXT), _bilder: [...vorhanden, ...hochgeladen],
        _veroeffentlicht: sichtbar.checked, _angeheftet: anheften.checked,
      });
      if (error) throw new Error(error.message);
      if (entfernt.length) void sb.storage.from(SPEICHER).remove(entfernt);
      d.close();
      toast(vorlage ? "Beitrag gespeichert." : "Beitrag veröffentlicht.", "success");
      await laden();
    } catch (err) {
      if (hochgeladen.length) void sb.storage.from(SPEICHER).remove(hochgeladen);
      fehler.textContent = err instanceof Error ? err.message : "Das hat nicht geklappt.";
    } finally {
      speichern.disabled = false;
    }
  });
  d.showModal();
  titel.focus();
}

async function entfernen(b: Beitrag) {
  const sb = client();
  if (!sb) return;
  const ok = await dialog({ icon: "fa-trash", title: "Beitrag löschen?", message: `„${b.titel}“ verschwindet von der Startseite. Das steht im Moderationsprotokoll.`,
    confirmText: "Löschen", cancelText: "Abbrechen", danger: true });
  if (!ok) return;
  const { data, error } = await sb.rpc("home_post_delete", { _id: b.id });
  if (error) { toast(error.message, "error"); return; }
  const pfade = Array.isArray(data) ? data.filter((p): p is string => typeof p === "string") : [];
  if (pfade.length) void sb.storage.from(SPEICHER).remove(pfade);
  toast("Beitrag gelöscht.", "success");
  await laden();
}

// ---------------------------------------------------------------- Start
async function starten() {
  const sb = client();
  if (!$("homeNews") || !sb) return;
  try {
    const { data } = await sb.auth.getSession();
    zustand.ich = data.session?.user.id ?? null;
    if (zustand.ich) {
      // Nur Admins mit bestätigter Zwei-Faktor-Anmeldung bekommen „true“ (018) – die Datenbank prüft beim Speichern erneut
      const { data: adm } = await sb.rpc("is_site_admin");
      zustand.admin = adm === true;
    }
  } catch {
    zustand.admin = false;
  }
  $("hnNeu")?.addEventListener("click", () => editor());
  await laden();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void starten());
else void starten();
