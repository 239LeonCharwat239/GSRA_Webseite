// GSRA – Globale Suche (SQL 040). Erste TypeScript-Datei der Webseite (Vite baut sie, siehe vite.config.ts).
// Die Wissens-Texte (Nachschlagewerk, Hilfe) werden erst beim ersten Suchen nachgeladen – jede Seite bleibt schlank.
type WissenDaten = typeof import("./wissen-daten");
let wissenDaten: Promise<WissenDaten> | null = null;
const ladeWissen = () => (wissenDaten ??= import("./wissen-daten"));
//
// Eine Lupe oben auf jeder Seite (auch Strg+K oder „/“) öffnet das Suchfenster. Die Treffer kommen aus einer
// Datenbank-Funktion, die mit den Rechten der suchenden Person läuft: Gäste finden nur Öffentliches, Nachrichten
// gibt es nur aus eigenen Chats, Gruppen und Foren. Alles wird hier zusätzlich sicher ausgegeben (kein HTML aus Daten).

type Setup = { id: string; simulation: string | null; car_model: string | null; track_name: string | null; setup_type: string | null; is_pro: boolean };
type Inserat = { id: string; title: string | null; price: number | null; status: string | null; image: string | null };
type Mitglied = { id: string; username: string; gsra_id: number | null; avatar_url: string | null };
type Forum = { id: string; title: string; is_public: boolean; is_member: boolean };
type Nachricht = { id: string; chat_id: string; created_at: string; chat_title: string | null; partner: string | null; sender: string | null; mine: boolean; snippet: string };
type Coaching = { id: string; coach_id: string; title: string; category: string | null; simulation: string | null; price_cents: number; coach: string | null };
type Rennen = { id: string; title: string | null; simulation: string | null; track: string | null; event_date: string };
type Ergebnis = {
  mitglieder?: Mitglied[]; nachrichten?: Nachricht[]; foren?: Forum[]; setups?: Setup[];
  marktplatz?: Inserat[]; coaching?: Coaching[]; rennen?: Rennen[];
};
type Treffer = { href: string; icon: string; avatar?: string | null; titel: string; unter: string; markieren: boolean };
type WissenTreffer = { id: string; art: "begriff" | "hilfe"; titel: string; unter: string };

const MIN_ZEICHEN = 2;
const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c] as string);
const sicherBild = (url: string | null | undefined): string | null => (url && /^https:\/\//i.test(url) ? url : null);
const datum = (iso: string): string => {
  const d = new Date(iso);
  const tage = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  const zeit = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (tage === 0) return `heute, ${zeit}`;
  if (tage === 1) return `gestern, ${zeit}`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const euro = (cent: number): string => (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

// Rubriken in der Reihenfolge der Anzeige
const RUBRIKEN: Array<{ key: keyof Ergebnis; titel: string; icon: string; alle?: (q: string) => string; treffer: (x: any) => Treffer }> = [
  {
    key: "mitglieder", titel: "Mitglieder", icon: "fa-user",
    treffer: (m: Mitglied) => ({ href: `messenger.html?profil=${encodeURIComponent(m.id)}`, icon: "fa-user", avatar: sicherBild(m.avatar_url),
      titel: m.username, unter: m.gsra_id ? `GSRA-ID ${m.gsra_id}` : "Mitglied", markieren: true }),
  },
  {
    key: "nachrichten", titel: "Nachrichten", icon: "fa-comment",
    treffer: (n: Nachricht) => ({
      href: `messenger.html?chat=${encodeURIComponent(n.chat_id)}&msg=${encodeURIComponent(n.id)}`, icon: "fa-comment",
      // Gruppe/Forum: „Max in „GT3 Talk““ · Direktchat: „Max“ bzw. „Du an Max“
      titel: n.chat_title ? `${n.mine ? "Du" : n.sender || "Jemand"} in „${n.chat_title}“`
        : n.mine ? `Du an ${n.partner || "deinen Chatpartner"}` : n.sender || "Jemand",
      unter: `${n.snippet.length >= 150 ? "… " : ""}${n.snippet}${n.snippet.length >= 150 ? " …" : ""} · ${datum(n.created_at)}`, markieren: true,
    }),
  },
  {
    key: "foren", titel: "Foren und Gruppen", icon: "fa-users",
    treffer: (f: Forum) => ({
      href: f.is_member ? `messenger.html?chat=${encodeURIComponent(f.id)}` : `messenger.html?forum=${encodeURIComponent(f.id)}&titel=${encodeURIComponent(f.title)}`,
      icon: f.is_public ? "fa-bullhorn" : "fa-users", titel: f.title,
      unter: f.is_member ? (f.is_public ? "Forum · du bist Mitglied" : "Gruppe · du bist Mitglied") : "Öffentliches Forum · ansehen und beitreten", markieren: true,
    }),
  },
  {
    key: "setups", titel: "Setups", icon: "fa-sliders", alle: (q) => `setups.html?suche=${encodeURIComponent(q)}`,
    treffer: (s: Setup) => ({ href: `setups.html?suche=${encodeURIComponent(s.car_model || s.track_name || "")}`, icon: s.is_pro ? "fa-crown" : "fa-sliders",
      titel: `${s.car_model || "Setup"}`, unter: [s.simulation, s.track_name, s.setup_type, s.is_pro ? "Pro" : null].filter(Boolean).join(" · "), markieren: true }),
  },
  {
    key: "marktplatz", titel: "Marktplatz", icon: "fa-store",
    treffer: (m: Inserat) => ({ href: `marktplatz.html?inserat=${encodeURIComponent(m.id)}`, icon: "fa-store", avatar: sicherBild(m.image),
      titel: m.title || "Inserat", unter: [m.price != null ? euro(Number(m.price) * 100) : null, m.status === "reserviert" ? "reserviert" : null].filter(Boolean).join(" · "), markieren: true }),
  },
  {
    key: "coaching", titel: "Coaching", icon: "fa-chalkboard-user",
    treffer: (c: Coaching) => ({ href: `coaching.html?coach=${encodeURIComponent(c.coach_id)}`, icon: "fa-chalkboard-user",
      titel: c.title, unter: [c.coach ? `mit ${c.coach}` : null, c.category, c.simulation, euro(c.price_cents)].filter(Boolean).join(" · "), markieren: true }),
  },
  {
    key: "rennen", titel: "Rennen", icon: "fa-flag-checkered",
    treffer: (r: Rennen) => ({ href: "kalender.html", icon: "fa-flag-checkered", titel: r.title || "Rennen",
      unter: [datum(r.event_date), r.simulation, r.track].filter(Boolean).join(" · "), markieren: true }),
  },
];

// Wissen (Nachschlagewerk und Hilfe-Center) wird direkt hier durchsucht – ohne Datenbank-Abfrage
const normal = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
async function sucheWissen(begriff: string): Promise<WissenTreffer[]> {
  const q = normal(begriff);
  if (q.length < 2) return [];
  let daten: WissenDaten;
  try { daten = await ladeWissen(); } catch { return []; }
  const { BEGRIFFE, HILFE } = daten;
  const begriffe: WissenTreffer[] = BEGRIFFE
    .filter((b) => normal(`${b.begriff} ${b.englisch || ""} ${b.kurz}`).includes(q))
    .map((b) => ({ id: b.id, art: "begriff", titel: b.begriff + (b.englisch ? ` (${b.englisch})` : ""), unter: `Nachschlagewerk · ${b.kurz}` }));
  const hilfe: WissenTreffer[] = HILFE
    .filter((a) => normal(`${a.frage} ${a.antwort.join(" ")}`).includes(q))
    .map((a) => ({ id: a.id, art: "hilfe", titel: a.frage, unter: `Hilfe-Center · ${a.antwort[0]}` }));
  return [...begriffe.slice(0, 4), ...hilfe.slice(0, 3)];
}

function markiere(text: string, begriff: string): string {
  const sicher = esc(text);
  const muster = esc(begriff).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return muster ? sicher.replace(new RegExp(muster, "gi"), (m) => `<mark>${m}</mark>`) : sicher;
}

function baueOberflaeche() {
  const knopf = document.createElement("button");
  knopf.type = "button";
  knopf.className = "gsra-search-btn";
  knopf.title = "Suche (Strg+K)";
  knopf.setAttribute("aria-label", "Suche öffnen");
  knopf.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';

  const fenster = document.createElement("div");
  fenster.className = "gsra-search";
  fenster.hidden = true;
  fenster.setAttribute("role", "dialog");
  fenster.setAttribute("aria-modal", "true");
  fenster.setAttribute("aria-label", "Suche");
  fenster.innerHTML = `
    <div class="gsra-search-panel">
      <div class="gsra-search-bar">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="search" maxlength="60" autocomplete="off" spellcheck="false" aria-label="Suchbegriff"
               placeholder="Suche: Mitglieder, Nachrichten, Setups, Inserate, Coaches, Rennen …">
        <button type="button" class="gsra-search-close" aria-label="Suche schließen"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="gsra-search-results" role="listbox" aria-label="Suchergebnisse"></div>
      <div class="gsra-search-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> auswählen</span><span><kbd>Enter</kbd> öffnen</span><span><kbd>Esc</kbd> schließen</span>
      </div>
    </div>`;
  document.body.appendChild(fenster);

  // Rechts zu den Werkzeugen der Navigation (auth-nav.js); gibt es die noch nicht, holt auth-nav die Lupe später dorthin
  const header = document.querySelector("header");
  const nav = header?.querySelector("nav");
  const werkzeuge = header?.querySelector(".gsra-nav-tools");
  if (werkzeuge) werkzeuge.prepend(knopf);
  else if (header && nav) header.insertBefore(knopf, nav);
  return { knopf, fenster };
}

function starte() {
  const { knopf, fenster } = baueOberflaeche();
  const eingabe = fenster.querySelector("input") as HTMLInputElement;
  const liste = fenster.querySelector(".gsra-search-results") as HTMLElement;
  let angemeldet = false;
  let anfrage = 0;
  let timer: number | undefined;
  let aktiv = -1;

  const items = () => [...liste.querySelectorAll<HTMLAnchorElement>(".gsra-search-item")];
  const setzeAktiv = (i: number) => {
    const alle = items();
    if (!alle.length) return;
    aktiv = (i + alle.length) % alle.length;
    alle.forEach((el, n) => el.classList.toggle("active", n === aktiv));
    alle[aktiv].scrollIntoView({ block: "nearest" });
  };

  const hinweis = () => {
    aktiv = -1;
    liste.innerHTML = `
      <div class="gsra-search-empty">
        <i class="fa-solid fa-magnifying-glass"></i>
        <strong>Durchsuche die ganze GSRA</strong>
        <span>${angemeldet ? "Mitglieder, deine Nachrichten, Foren und Gruppen, Setups, Inserate, Coaches und Rennen." : "Setups und Inserate – melde dich an, um auch Mitglieder, Nachrichten, Foren und Rennen zu finden."}</span>
      </div>`;
  };

  const zeige = (ergebnis: Ergebnis, begriff: string, wissen: WissenTreffer[]) => {
    aktiv = -1;
    const teile: string[] = [];
    for (const r of RUBRIKEN) {
      const daten = (ergebnis[r.key] || []) as any[];
      if (!daten.length) continue;
      teile.push(`<section class="gsra-search-group"><h3><i class="fa-solid ${r.icon}"></i> ${esc(r.titel)} <span>${daten.length}</span></h3>`);
      for (const d of daten) {
        const t = r.treffer(d);
        const bild = t.avatar ? `<img src="${esc(t.avatar)}" alt="" loading="lazy">` : `<i class="fa-solid ${t.icon}"></i>`;
        teile.push(`<a class="gsra-search-item" role="option" href="${esc(t.href)}">
          <span class="gsra-search-icon">${bild}</span>
          <span class="gsra-search-text"><strong>${t.markieren ? markiere(t.titel, begriff) : esc(t.titel)}</strong><small>${markiere(t.unter, begriff)}</small></span>
          <i class="fa-solid fa-arrow-right gsra-search-go"></i></a>`);
      }
      if (r.alle) teile.push(`<a class="gsra-search-all" href="${esc(r.alle(begriff))}">Alle ${esc(r.titel)} zu „${esc(begriff)}“ <i class="fa-solid fa-angle-right"></i></a>`);
      teile.push("</section>");
    }
    if (wissen.length) {
      teile.push(`<section class="gsra-search-group"><h3><i class="fa-solid fa-book-open"></i> Wissen <span>${wissen.length}</span></h3>`);
      for (const w of wissen) {
        const href = `${w.art === "begriff" ? "nachschlagewerk" : "hilfe"}.html#${encodeURIComponent(w.id)}`;
        teile.push(`<a class="gsra-search-item" role="option" href="${esc(href)}">
          <span class="gsra-search-icon"><i class="fa-solid ${w.art === "begriff" ? "fa-book" : "fa-circle-question"}"></i></span>
          <span class="gsra-search-text"><strong>${markiere(w.titel, begriff)}</strong><small>${markiere(w.unter, begriff)}</small></span>
          <i class="fa-solid fa-arrow-right gsra-search-go"></i></a>`);
      }
      teile.push("</section>");
    }
    if (!teile.length) {
      liste.innerHTML = `<div class="gsra-search-empty"><i class="fa-regular fa-face-meh"></i><strong>Keine Treffer für „${esc(begriff)}“</strong>
        <span>${begriff.length < 3 && angemeldet ? "Nachrichten werden ab 3 Zeichen durchsucht." : "Probiere einen anderen Begriff – kleine Tippfehler sind erlaubt."}</span></div>`;
      return;
    }
    if (!angemeldet) teile.push('<p class="gsra-search-note"><i class="fa-solid fa-lock"></i> <a href="login.html">Melde dich an</a>, um auch Mitglieder, Nachrichten, Foren und Rennen zu finden.</p>');
    liste.innerHTML = teile.join("");
  };

  const suche = async () => {
    const begriff = eingabe.value.trim().replace(/\s+/g, " ").slice(0, 60);
    if (begriff.length < MIN_ZEICHEN) return hinweis();
    const nr = ++anfrage;
    liste.classList.add("loading");
    try {
      const client = (window as any).supabaseClient;
      const [{ data, error }, wissen] = await Promise.all([client.rpc("gsra_search", { _q: begriff }), sucheWissen(begriff)]);
      if (nr !== anfrage) return; // eine neuere Eingabe ist schon unterwegs
      if (error) throw error;
      zeige((data || {}) as Ergebnis, begriff, wissen);
    } catch {
      if (nr === anfrage) liste.innerHTML = '<div class="gsra-search-empty"><i class="fa-solid fa-triangle-exclamation"></i><strong>Die Suche ist gerade nicht erreichbar</strong><span>Bitte versuche es gleich noch einmal.</span></div>';
    } finally {
      if (nr === anfrage) liste.classList.remove("loading");
    }
  };

  let vorher: Element | null = null;
  const oeffnen = async () => {
    if (!fenster.hidden) return eingabe.focus();
    vorher = document.activeElement;
    try {
      const { data } = await (window as any).supabaseClient?.auth.getSession();
      angemeldet = Boolean(data?.session);
    } catch { angemeldet = false; }
    fenster.hidden = false;
    document.body.classList.add("gsra-search-open");
    if (!eingabe.value.trim()) hinweis(); else suche();
    eingabe.focus();
    eingabe.select();
  };
  const schliessen = () => {
    fenster.hidden = true;
    document.body.classList.remove("gsra-search-open");
    if (vorher instanceof HTMLElement) vorher.focus();
  };

  knopf.addEventListener("click", oeffnen);
  fenster.querySelector(".gsra-search-close")?.addEventListener("click", schliessen);
  fenster.addEventListener("mousedown", (e) => { if (e.target === fenster) schliessen(); });
  eingabe.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(suche, 220);
  });
  eingabe.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setzeAktiv(aktiv + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setzeAktiv(aktiv - 1); }
    else if (e.key === "Enter") {
      const ziel = items()[aktiv] || items()[0];
      if (ziel) { e.preventDefault(); window.location.href = ziel.href; }
    }
  });
  document.addEventListener("keydown", (e) => {
    const tippt = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); oeffnen(); }
    else if (e.key === "/" && !tippt && fenster.hidden) { e.preventDefault(); oeffnen(); }
    else if (e.key === "Escape" && !fenster.hidden) schliessen();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", starte);
else starte();

export {};
