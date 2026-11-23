// GSRA – Karriere-Timeline (SQL 044): Stationen im Profil und Bearbeiten im Dashboard.
// Eigene Einträge (Teams, Meisterschaften, Erfolge …) plus automatische Meilensteine aus der Datenbank, die niemand
// fälschen kann. Alle Texte werden mit textContent ausgegeben; Links nur https, in neuem Tab ohne Verweis-Daten.
// Profile (Messenger, Marktplatz, Coaching) rufen window.gsraRenderCareer(container, userId) auf.

type Art = "team" | "meisterschaft" | "erfolg" | "rennen" | "lizenz" | "sonstiges";
type Eintrag = { id: string; year: number; month: number | null; kind: Art; title: string; detail: string | null; link: string | null };
type Meilensteine = {
  mitglied_seit?: string | null; erstes_setup?: string | null; setups?: number; coach_seit?: string | null;
  pro_fahrer?: boolean; unterstuetzer_seit?: string | null;
};

const ARTEN: Record<Art, { label: string; icon: string }> = {
  team: { label: "Team", icon: "fa-people-group" },
  meisterschaft: { label: "Meisterschaft", icon: "fa-trophy" },
  erfolg: { label: "Erfolg", icon: "fa-medal" },
  rennen: { label: "Rennen", icon: "fa-flag-checkered" },
  lizenz: { label: "Lizenz", icon: "fa-id-card" },
  sonstiges: { label: "Station", icon: "fa-star" },
};
const MONATE = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];

const sb = () => (window as any).supabaseClient;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
};
const icon = (name: string) => { const i = el("i", `fa-solid ${name}`); i.setAttribute("aria-hidden", "true"); return i; };
const toast = (text: string, art: "success" | "error" | "info" = "info") =>
  (window as unknown as { showToast?: (t: string, a: string) => void }).showToast?.(text, art);
const datum = (iso: string) => {
  const d = new Date(iso);
  return { jahr: d.getFullYear(), monat: d.getMonth() + 1, text: d.toLocaleDateString("de-DE", { month: "long", year: "numeric" }) };
};
const sichererLink = (link: string | null) => (link && /^https:\/\/[^\s<>"'`]+$/.test(link) ? link : null);

type Punkt = { jahr: number; monat: number | null; icon: string; art: string; titel: string; text?: string | null; link?: string | null; auto?: boolean };

function punkte(eintraege: Eintrag[], m: Meilensteine): Punkt[] {
  const liste: Punkt[] = eintraege.map((e) => ({
    jahr: e.year, monat: e.month, icon: ARTEN[e.kind]?.icon || "fa-star", art: ARTEN[e.kind]?.label || "Station",
    titel: e.title, text: e.detail, link: sichererLink(e.link),
  }));
  const auto = (iso: string | null | undefined, icn: string, titel: string, text: string) => {
    if (!iso) return;
    const d = datum(iso);
    liste.push({ jahr: d.jahr, monat: d.monat, icon: icn, art: "GSRA", titel, text, auto: true });
  };
  auto(m.mitglied_seit, "fa-flag", "Mitglied der GSRA", "Der Global Simracing Alliance beigetreten.");
  auto(m.erstes_setup, "fa-sliders", "Erstes Setup geteilt",
    m.setups && m.setups > 1 ? `Inzwischen ${m.setups} Setups im Setup Hub geteilt.` : "Das erste Setup im Setup Hub geteilt.");
  auto(m.coach_seit, "fa-chalkboard-user", "GSRA-Coach", "Coach-Lizenz der GSRA erhalten.");
  auto(m.unterstuetzer_seit, "fa-heart", "Unterstützt die GSRA", "Hilft mit, die Plattform weiterzuentwickeln.");
  return liste.sort((a, b) => b.jahr - a.jahr || (b.monat ?? 0) - (a.monat ?? 0));
}

function zeichne(box: HTMLElement, liste: Punkt[], proFahrer: boolean) {
  box.replaceChildren();
  if (!liste.length && !proFahrer) { box.hidden = true; return; }
  const kopf = el("h4", "gsra-career-titel");
  kopf.append(icon("fa-road"), "Karriere");
  if (proFahrer) {
    const pro = el("span", "gsra-career-pro");
    pro.append(icon("fa-bolt"), "Pro-Fahrer");
    kopf.append(pro);
  }
  const ol = el("ol", "gsra-career-liste");
  for (const p of liste) {
    const li = el("li", `gsra-career-punkt${p.auto ? " auto" : ""}`);
    const punkt = el("span", "gsra-career-icon");
    punkt.append(icon(p.icon));
    const inhalt = el("div", "gsra-career-inhalt");
    const zeit = el("small", "gsra-career-zeit", `${p.monat ? `${MONATE[p.monat - 1]} ` : ""}${p.jahr} · ${p.art}`);
    const titel = el("strong", "", p.titel);
    inhalt.append(zeit, titel);
    if (p.text) inhalt.append(el("p", "", p.text));
    if (p.link) {
      const a = el("a", "gsra-career-link", "Mehr erfahren");
      a.href = p.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer nofollow ugc";
      a.prepend(icon("fa-arrow-up-right-from-square"));
      inhalt.append(a);
    }
    li.append(punkt, inhalt);
    ol.append(li);
  }
  // Lange Karrieren zuerst gekürzt (die neuesten 6), Rest auf Wunsch
  box.append(kopf, ol);
  if (liste.length > 6) {
    [...ol.children].slice(6).forEach((c) => c.classList.add("versteckt"));
    const mehr = el("button", "gsra-career-mehr", `Alle ${liste.length} Stationen zeigen`);
    mehr.type = "button";
    mehr.addEventListener("click", () => { ol.querySelectorAll(".versteckt").forEach((c) => c.classList.remove("versteckt")); mehr.remove(); });
    box.append(mehr);
  }
  box.hidden = false;
}

async function laden(userId: string): Promise<{ eintraege: Eintrag[]; m: Meilensteine } | null> {
  const client = sb();
  if (!client || !userId) return null;
  const [e, m] = await Promise.all([
    client.from("career_entries").select("id, year, month, kind, title, detail, link").eq("user_id", userId)
      .order("year", { ascending: false }).order("month", { ascending: false, nullsFirst: false }).limit(40),
    client.rpc("career_milestones", { _user: userId }),
  ]);
  if (e.error && m.error) return null; // SQL 044 noch nicht eingespielt oder nicht angemeldet
  return { eintraege: (e.data || []) as Eintrag[], m: (m.data || {}) as Meilensteine };
}

export async function zeigeKarriere(box: HTMLElement, userId: string) {
  box.hidden = true;
  box.dataset.careerUser = userId;
  const daten = await laden(userId);
  if (!daten || box.dataset.careerUser !== userId) return;
  zeichne(box, punkte(daten.eintraege, daten.m), Boolean(daten.m.pro_fahrer));
}

// ---------- Dashboard: eigene Karriere bearbeiten ----------
async function editor(box: HTMLElement) {
  const client = sb();
  if (!client) return;
  const { data } = await client.auth.getSession();
  const ich: string | undefined = data?.session?.user?.id;
  if (!ich) return;
  const liste = box.querySelector<HTMLElement>("#careerListe");
  const form = box.querySelector<HTMLFormElement>("#careerForm");
  const vorschau = box.querySelector<HTMLElement>("#careerVorschau");
  if (!liste || !form || !vorschau) return;
  let bearbeiteId: string | null = null;
  const feld = <T extends HTMLElement>(n: string) => form.querySelector<T>(`[name="${n}"]`) as T;

  const neuLaden = async () => {
    const daten = await laden(ich);
    if (!daten) { box.hidden = true; return; }
    box.hidden = false;
    liste.replaceChildren();
    if (!daten.eintraege.length) liste.append(el("li", "career-leer", "Noch keine Stationen eingetragen. Füge deine erste hinzu – zum Beispiel dein Team oder eine Meisterschaft."));
    for (const e of daten.eintraege) {
      const li = el("li", "career-zeile");
      const text = el("span", "career-text");
      text.append(el("strong", "", e.title), el("small", "", `${e.month ? `${MONATE[e.month - 1]} ` : ""}${e.year} · ${ARTEN[e.kind]?.label || "Station"}`));
      const aendern = el("button", "career-knopf", "");
      aendern.type = "button"; aendern.title = "Bearbeiten"; aendern.setAttribute("aria-label", `${e.title} bearbeiten`);
      aendern.append(icon("fa-pen"));
      aendern.addEventListener("click", () => {
        bearbeiteId = e.id;
        feld<HTMLInputElement>("year").value = String(e.year);
        feld<HTMLSelectElement>("month").value = e.month ? String(e.month) : "";
        feld<HTMLSelectElement>("kind").value = e.kind;
        feld<HTMLInputElement>("title").value = e.title;
        feld<HTMLTextAreaElement>("detail").value = e.detail || "";
        feld<HTMLInputElement>("link").value = e.link || "";
        (form.querySelector("button[type=submit]") as HTMLButtonElement).textContent = "Änderung speichern";
        feld<HTMLInputElement>("title").focus();
      });
      const weg = el("button", "career-knopf gefahr", "");
      weg.type = "button"; weg.title = "Löschen"; weg.setAttribute("aria-label", `${e.title} löschen`);
      weg.append(icon("fa-trash"));
      weg.addEventListener("click", async () => {
        const dialog = (window as any).showDialog;
        const ok = typeof dialog === "function"
          ? await dialog({ icon: "fa-trash", title: "Station löschen?", message: `„${e.title}“ wird aus deiner Karriere entfernt.`, confirmText: "Löschen", cancelText: "Abbrechen" })
          : true;
        if (!ok) return;
        const { error } = await client.from("career_entries").delete().eq("id", e.id);
        if (error) return toast("Die Station konnte nicht gelöscht werden.", "error");
        toast("Station gelöscht.", "success");
        void neuLaden();
      });
      li.append(text, aendern, weg);
      liste.append(li);
    }
    zeichne(vorschau, punkte(daten.eintraege, daten.m), Boolean(daten.m.pro_fahrer));
  };

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const jahr = Number(feld<HTMLInputElement>("year").value);
    const monat = feld<HTMLSelectElement>("month").value ? Number(feld<HTMLSelectElement>("month").value) : null;
    const titel = feld<HTMLInputElement>("title").value.trim();
    const detail = feld<HTMLTextAreaElement>("detail").value.trim();
    const link = feld<HTMLInputElement>("link").value.trim();
    if (!Number.isInteger(jahr) || jahr < 1950 || jahr > 2100) return toast("Bitte gib ein Jahr zwischen 1950 und 2100 an.", "error");
    if (!titel) return toast("Bitte gib einen Titel an.", "error");
    if (link && !sichererLink(link)) return toast("Links müssen mit https:// beginnen.", "error");
    const werte = { year: jahr, month: monat, kind: feld<HTMLSelectElement>("kind").value, title: titel.slice(0, 80), detail: detail.slice(0, 300) || null, link: link || null };
    const knopf = form.querySelector("button[type=submit]") as HTMLButtonElement;
    knopf.disabled = true;
    const { error } = bearbeiteId
      ? await client.from("career_entries").update(werte).eq("id", bearbeiteId)
      : await client.from("career_entries").insert({ ...werte, user_id: ich });
    knopf.disabled = false;
    if (error) {
      const meldung = /40 Karriere-Einträge/.test(error.message || "") ? error.message : "Die Station konnte nicht gespeichert werden.";
      return toast(meldung, "error");
    }
    toast(bearbeiteId ? "Station aktualisiert." : "Station hinzugefügt.", "success");
    bearbeiteId = null;
    form.reset();
    knopf.textContent = "Station hinzufügen";
    void neuLaden();
  });
  form.addEventListener("reset", () => {
    bearbeiteId = null;
    (form.querySelector("button[type=submit]") as HTMLButtonElement).textContent = "Station hinzufügen";
  });
  await neuLaden();
}

declare global {
  interface Window { gsraRenderCareer?: typeof zeigeKarriere }
}
window.gsraRenderCareer = zeigeKarriere;

const dashboardBox = document.getElementById("careerCard");
if (dashboardBox) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void editor(dashboardBox));
  else void editor(dashboardBox);
}
