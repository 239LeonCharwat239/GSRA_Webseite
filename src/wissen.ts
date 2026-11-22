// GSRA – Hilfe-Center (hilfe.html) und Nachschlagewerk (nachschlagewerk.html).
// Beide Seiten: Suchfeld, Themen-Filter, aufklappbare Einträge; Links wie hilfe.html#konto öffnen den Eintrag direkt.
// Ausgabe nur über textContent – Inhalte kommen aus src/wissen-daten.ts.
import { BEGRIFF_KATEGORIEN, BEGRIFFE, HILFE, HILFE_THEMEN, type Begriff, type HilfeArtikel } from "./wissen-daten";

const normal = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
};
const icon = (name: string) => { const i = el("i", `fa-solid ${name}`); i.setAttribute("aria-hidden", "true"); return i; };

type Filter = { suche: string; thema: string };

function chips(box: HTMLElement, eintraege: Array<{ key: string; label: string; icon?: string }>, aktiv: () => string, waehlen: (k: string) => void) {
  box.replaceChildren(...eintraege.map((t) => {
    const b = el("button", `wissen-chip${aktiv() === t.key ? " active" : ""}`);
    b.type = "button";
    b.setAttribute("aria-pressed", String(aktiv() === t.key));
    if (t.icon) b.appendChild(icon(t.icon));
    b.append(t.label);
    b.addEventListener("click", () => waehlen(t.key));
    return b;
  }));
}

function oeffneAusAdresse(liste: HTMLElement) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!/^[\w-]{1,60}$/.test(id)) return;
  const ziel = liste.querySelector<HTMLDetailsElement>(`details[data-id="${id}"]`);
  if (!ziel) return;
  ziel.open = true;
  ziel.classList.add("wissen-markiert");
  setTimeout(() => ziel.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
  setTimeout(() => ziel.classList.remove("wissen-markiert"), 2200);
}

// ---------- Hilfe-Center ----------
function hilfeArtikel(a: HilfeArtikel): HTMLDetailsElement {
  const d = el("details", "wissen-eintrag");
  d.dataset.id = a.id;
  const s = el("summary");
  s.append(el("span", "", a.frage), icon("fa-chevron-down"));
  const inhalt = el("div", "wissen-inhalt");
  a.antwort.forEach((p) => inhalt.appendChild(el("p", "", p)));
  if (a.links?.length) {
    const l = el("div", "wissen-links");
    a.links.forEach((k) => {
      const link = el("a", "wissen-link", k.label);
      link.href = /^[a-z-]+\.html(#[\w-]+)?$/.test(k.href) ? k.href : "index.html"; // nur eigene Seiten
      link.prepend(icon("fa-arrow-right"));
      l.appendChild(link);
    });
    inhalt.appendChild(l);
  }
  d.append(s, inhalt);
  return d;
}

function starteHilfe() {
  const liste = document.getElementById("wissenListe") as HTMLElement;
  const chipBox = document.getElementById("wissenFilter") as HTMLElement;
  const eingabe = document.getElementById("wissenSuche") as HTMLInputElement;
  const f: Filter = { suche: "", thema: "alle" };
  const themen = [{ key: "alle", label: "Alle Themen", icon: "fa-layer-group" }, ...HILFE_THEMEN.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))];

  const zeige = () => {
    chips(chipBox, themen, () => f.thema, (k) => { f.thema = k; zeige(); });
    const q = normal(f.suche);
    const treffer = HILFE.filter((a) => (f.thema === "alle" || a.thema === f.thema)
      && (!q || normal(`${a.frage} ${a.antwort.join(" ")}`).includes(q)));
    const gruppen = HILFE_THEMEN.map((t) => ({ t, artikel: treffer.filter((a) => a.thema === t.key) })).filter((g) => g.artikel.length);
    if (!gruppen.length) {
      const leer = el("div", "wissen-leer");
      leer.append(icon("fa-circle-question"), el("strong", "", "Dazu haben wir noch keine Antwort"),
        el("span", "", "Frag im offiziellen GSRA-Forum im Messenger – das Team hilft dir weiter."));
      liste.replaceChildren(leer);
      return;
    }
    liste.replaceChildren(...gruppen.map(({ t, artikel }) => {
      const sek = el("section", "wissen-gruppe");
      const h = el("h2", "wissen-gruppe-titel");
      h.append(icon(t.icon), t.label, el("span", "", String(artikel.length)));
      sek.appendChild(h);
      artikel.forEach((a) => sek.appendChild(hilfeArtikel(a)));
      return sek;
    }));
  };
  let timer: number | undefined;
  eingabe.addEventListener("input", () => { window.clearTimeout(timer); timer = window.setTimeout(() => { f.suche = eingabe.value.trim(); zeige(); }, 150); });
  zeige();
  oeffneAusAdresse(liste);
  window.addEventListener("hashchange", () => oeffneAusAdresse(liste));
}

// ---------- Nachschlagewerk ----------
function begriffKarte(b: Begriff): HTMLDetailsElement {
  const d = el("details", "wissen-eintrag begriff");
  d.dataset.id = b.id;
  const s = el("summary");
  const kopf = el("span", "begriff-kopf");
  kopf.append(el("small", "begriff-kategorie", b.kategorie));
  const name = el("strong", "begriff-name", b.begriff);
  if (b.englisch) name.appendChild(el("em", "", ` · ${b.englisch}`));
  kopf.append(name, el("span", "begriff-kurz", b.kurz));
  s.append(kopf, icon("fa-chevron-down"));
  const inhalt = el("div", "wissen-inhalt");
  inhalt.appendChild(el("p", "", b.text));
  if (b.tipp) {
    const tipp = el("p", "begriff-tipp");
    tipp.append(icon("fa-screwdriver-wrench"), el("strong", "", "Praxis-Tipp: "), b.tipp);
    inhalt.appendChild(tipp);
  }
  d.append(s, inhalt);
  return d;
}

function starteNachschlagewerk() {
  const liste = document.getElementById("wissenListe") as HTMLElement;
  const chipBox = document.getElementById("wissenFilter") as HTMLElement;
  const eingabe = document.getElementById("wissenSuche") as HTMLInputElement;
  const zaehler = document.getElementById("wissenZahl");
  const f: Filter = { suche: "", thema: "alle" };
  const kategorien = [{ key: "alle", label: "Alle" }, ...BEGRIFF_KATEGORIEN.map((k) => ({ key: k, label: k }))];
  const sortiert = [...BEGRIFFE].sort((a, b) => a.begriff.localeCompare(b.begriff, "de"));

  const zeige = () => {
    chips(chipBox, kategorien, () => f.thema, (k) => { f.thema = k; zeige(); });
    const q = normal(f.suche);
    const treffer = sortiert.filter((b) => (f.thema === "alle" || b.kategorie === f.thema)
      && (!q || normal(`${b.begriff} ${b.englisch || ""} ${b.kurz} ${b.text} ${b.tipp || ""}`).includes(q)));
    if (zaehler) zaehler.textContent = `${treffer.length} ${treffer.length === 1 ? "Begriff" : "Begriffe"}`;
    if (!treffer.length) {
      const leer = el("div", "wissen-leer");
      leer.append(icon("fa-book-open"), el("strong", "", "Diesen Begriff gibt es noch nicht"),
        el("span", "", "Das Nachschlagewerk wächst laufend – schlag uns Begriffe im offiziellen GSRA-Forum vor."));
      liste.replaceChildren(leer);
      return;
    }
    liste.replaceChildren(...treffer.map(begriffKarte));
  };
  let timer: number | undefined;
  eingabe.addEventListener("input", () => { window.clearTimeout(timer); timer = window.setTimeout(() => { f.suche = eingabe.value.trim(); zeige(); }, 150); });
  zeige();
  oeffneAusAdresse(liste);
  window.addEventListener("hashchange", () => oeffneAusAdresse(liste));
}

const seite = document.body.dataset.wissen;
if (seite === "hilfe") starteHilfe();
else if (seite === "nachschlagewerk") starteNachschlagewerk();

export {};
