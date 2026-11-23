// GSRA – Stint-Planer (Prototyp, 22.11.). Rechnet vollständig im Browser, ohne Datenbank.
// Eingaben → Stintplan (Fahrer, Rennzeit/Uhrzeit, Runden, Sprit, Reifen, Boxenstopps) + Vergleich „Vollgas gegen Sprit sparen“.
// Teilen: Der Plan steckt im Link (#plan=…); beim Öffnen wird jeder Wert auf sinnvolle Grenzen geprüft.
// Später: Verbrauch und Rundenzeiten automatisch aus der GSRA-App (iRacing, ACC, LMU).

type Fahrer = { name: string; rundenzeit: number | null };
type Plan = {
  modus: "zeit" | "runden"; dauerMin: number; runden: number; start: string;
  rundenzeit: number; verbrauch: number; tank: number; reserve: number; reifenRunden: number;
  boxgasse: number; tankrate: number; reifenzeit: number; fahrerwechsel: number; parallel: boolean;
  fahrer: Fahrer[]; stintsAmStueck: number; sparProzent: number; sparVerlust: number;
};
type Stopp = { dauer: number; sprit: number; reifen: boolean; fahrerwechsel: boolean };
type Stint = { nr: number; fahrer: string; start: number; ende: number; runden: number; spritStart: number; stopp: Stopp | null };
type Ergebnis = { stints: Stint[]; rennzeit: number; runden: number; boxzeit: number; sprit: number; fehler?: string };

const STANDARD: Plan = {
  modus: "zeit", dauerMin: 120, runden: 60, start: "",
  rundenzeit: 105, verbrauch: 3.1, tank: 100, reserve: 1, reifenRunden: 0,
  boxgasse: 30, tankrate: 2.5, reifenzeit: 20, fahrerwechsel: 15, parallel: false,
  fahrer: [{ name: "Fahrer 1", rundenzeit: null }, { name: "Fahrer 2", rundenzeit: null }],
  stintsAmStueck: 1, sparProzent: 5, sparVerlust: 0.3,
};
const SPEICHER = "gsra_stintplaner_v1";

// ---------- Werkzeuge ----------
const zahl = (v: unknown, min: number, max: number, std: number) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std;
};
// „1:47.5“, „1:47,5“ oder „107.5“ → Sekunden
function zeitLesen(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const m = /^(?:(\d{1,2}):)?(\d{1,4}(?:\.\d{1,3})?)$/.exec(t);
  if (!m) return null;
  const s = (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
  return s >= 20 && s <= 1200 ? s : null;
}
const rundenzeitText = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
function dauerText(s: number): string {
  const sek = Math.round(s);
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), r = sek % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")} h` : `${m}:${String(r).padStart(2, "0")} min`;
}
const liter = (l: number) => `${l.toFixed(1).replace(".", ",")} l`;
function uhrzeit(plan: Plan, sek: number): string | null {
  if (!plan.start) return null;
  const d = new Date(plan.start);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + sek * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function pruefen(roh: Partial<Plan>): Plan {
  const fahrer = Array.isArray(roh.fahrer) ? roh.fahrer.slice(0, 8).map((f, i) => ({
    name: String(f?.name ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 30) || `Fahrer ${i + 1}`,
    rundenzeit: f?.rundenzeit == null ? null : zahl(f.rundenzeit, 20, 1200, STANDARD.rundenzeit),
  })) : STANDARD.fahrer;
  return {
    modus: roh.modus === "runden" ? "runden" : "zeit",
    dauerMin: zahl(roh.dauerMin, 5, 2000, STANDARD.dauerMin),
    runden: Math.round(zahl(roh.runden, 1, 5000, STANDARD.runden)),
    start: typeof roh.start === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(roh.start) ? roh.start : "",
    rundenzeit: zahl(roh.rundenzeit, 20, 1200, STANDARD.rundenzeit),
    verbrauch: zahl(roh.verbrauch, 0.05, 50, STANDARD.verbrauch),
    tank: zahl(roh.tank, 1, 500, STANDARD.tank),
    reserve: zahl(roh.reserve, 0, 50, STANDARD.reserve),
    reifenRunden: Math.round(zahl(roh.reifenRunden, 0, 2000, 0)),
    boxgasse: zahl(roh.boxgasse, 0, 300, STANDARD.boxgasse),
    tankrate: zahl(roh.tankrate, 0.1, 20, STANDARD.tankrate),
    reifenzeit: zahl(roh.reifenzeit, 0, 120, STANDARD.reifenzeit),
    fahrerwechsel: zahl(roh.fahrerwechsel, 0, 120, STANDARD.fahrerwechsel),
    parallel: Boolean(roh.parallel),
    fahrer: fahrer.length ? fahrer : STANDARD.fahrer,
    stintsAmStueck: Math.round(zahl(roh.stintsAmStueck, 1, 6, 1)),
    sparProzent: zahl(roh.sparProzent, 0, 30, STANDARD.sparProzent),
    sparVerlust: zahl(roh.sparVerlust, 0, 5, STANDARD.sparVerlust),
  };
}

// ---------- Berechnung ----------
export function berechnen(p: Plan, verbrauchFaktor = 1, zeitPlus = 0): Ergebnis {
  const verbrauch = p.verbrauch * verbrauchFaktor;
  const maxRunden = Math.floor((p.tank - p.reserve) / verbrauch);
  const leer: Ergebnis = { stints: [], rennzeit: 0, runden: 0, boxzeit: 0, sprit: 0 };
  if (maxRunden < 1) return { ...leer, fehler: "Mit dieser Tankgröße, Reserve und diesem Verbrauch schafft das Auto keine einzige Runde." };
  const reifenGrenze = p.reifenRunden > 0 ? p.reifenRunden : Infinity;
  const dauer = p.dauerMin * 60;
  const rundenzeitVon = (i: number) => (p.fahrer[i]?.rundenzeit ?? p.rundenzeit) + zeitPlus;
  const restRunden = (zeit: number, runden: number, lt: number) =>
    p.modus === "runden" ? p.runden - runden : zeit >= dauer ? 0 : Math.ceil((dauer - zeit) / lt);

  const stints: Stint[] = [];
  let zeit = 0, runden = 0, boxzeit = 0, sprit = 0, reifenRunden = 0;
  let fahrerIdx = 0, stintsDesFahrers = 0;
  while (stints.length < 300) {
    const lt = rundenzeitVon(fahrerIdx);
    const rest = restRunden(zeit, runden, lt);
    if (rest <= 0) break;
    const r = Math.min(maxRunden, rest);
    const stint: Stint = {
      nr: stints.length + 1, fahrer: p.fahrer[fahrerIdx]?.name || `Fahrer ${fahrerIdx + 1}`,
      start: zeit, ende: zeit + r * lt, runden: r, spritStart: Math.min(p.tank, r * verbrauch + p.reserve), stopp: null,
    };
    zeit += r * lt;
    runden += r;
    sprit += r * verbrauch;
    reifenRunden += r;
    stintsDesFahrers++;
    stints.push(stint);

    // Nächster Stint nötig? Dann Boxenstopp einplanen
    let naechsterFahrer = fahrerIdx;
    const wechsel = p.fahrer.length > 1 && stintsDesFahrers >= p.stintsAmStueck;
    if (wechsel) naechsterFahrer = (fahrerIdx + 1) % p.fahrer.length;
    const restDanach = restRunden(zeit, runden, rundenzeitVon(naechsterFahrer));
    if (restDanach <= 0) break;
    const naechsteRunden = Math.min(maxRunden, restDanach);
    const nachtanken = Math.min(p.tank - p.reserve, naechsteRunden * verbrauch);
    const reifen = reifenRunden + naechsteRunden > reifenGrenze;
    const teile = [nachtanken / p.tankrate, reifen ? p.reifenzeit : 0, wechsel ? p.fahrerwechsel : 0];
    const service = p.parallel ? Math.max(...teile) : teile.reduce((a, b) => a + b, 0);
    const dauerStopp = p.boxgasse + service;
    stint.stopp = { dauer: dauerStopp, sprit: nachtanken, reifen, fahrerwechsel: wechsel };
    zeit += dauerStopp;
    boxzeit += dauerStopp;
    if (reifen) reifenRunden = 0;
    if (wechsel) { fahrerIdx = naechsterFahrer; stintsDesFahrers = 0; }
  }
  return { stints, rennzeit: zeit, runden, boxzeit, sprit: sprit + p.reserve };
}

// ---------- Oberfläche ----------
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
};
const feld = (name: string) => document.querySelector<HTMLInputElement>(`[name="${name}"]`);

function planAusFormular(): Plan {
  const wert = (n: string) => feld(n)?.value ?? "";
  const fahrer: Fahrer[] = [...document.querySelectorAll<HTMLElement>(".sp-fahrer-zeile")].map((z) => ({
    name: (z.querySelector<HTMLInputElement>(".sp-fahrer-name")?.value || "").trim(),
    rundenzeit: zeitLesen(z.querySelector<HTMLInputElement>(".sp-fahrer-zeit")?.value || ""),
  }));
  return pruefen({
    modus: (document.querySelector<HTMLInputElement>('[name="modus"]:checked')?.value as Plan["modus"]) || "zeit",
    dauerMin: zahl(wert("dauerStd"), 0, 33, 0) * 60 + zahl(wert("dauerMin"), 0, 59, 0),
    runden: Number(wert("runden")), start: wert("start"),
    rundenzeit: zeitLesen(wert("rundenzeit")) ?? undefined, verbrauch: Number(wert("verbrauch").replace(",", ".")),
    tank: Number(wert("tank").replace(",", ".")), reserve: Number(wert("reserve").replace(",", ".")),
    reifenRunden: Number(wert("reifenRunden")), boxgasse: Number(wert("boxgasse").replace(",", ".")),
    tankrate: Number(wert("tankrate").replace(",", ".")), reifenzeit: Number(wert("reifenzeit").replace(",", ".")),
    fahrerwechsel: Number(wert("fahrerwechsel").replace(",", ".")), parallel: Boolean(feld("parallel")?.checked),
    fahrer, stintsAmStueck: Number(wert("stintsAmStueck")),
    sparProzent: Number(wert("sparProzent").replace(",", ".")), sparVerlust: Number(wert("sparVerlust").replace(",", ".")),
  });
}

function fahrerZeile(f: Fahrer, liste: HTMLElement) {
  const z = el("div", "sp-fahrer-zeile");
  const name = el("input", "sp-fahrer-name");
  name.type = "text"; name.maxLength = 30; name.value = f.name; name.placeholder = "Name"; name.setAttribute("aria-label", "Name des Fahrers");
  const zeit = el("input", "sp-fahrer-zeit");
  zeit.type = "text"; zeit.inputMode = "decimal"; zeit.maxLength = 9; zeit.placeholder = "Rundenzeit (optional)";
  zeit.value = f.rundenzeit ? rundenzeitText(f.rundenzeit) : ""; zeit.setAttribute("aria-label", "Eigene Rundenzeit dieses Fahrers");
  const weg = el("button", "sp-icon-btn");
  weg.type = "button"; weg.title = "Fahrer entfernen"; weg.setAttribute("aria-label", "Fahrer entfernen");
  weg.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  weg.addEventListener("click", () => { if (liste.children.length > 1) { z.remove(); aktualisieren(); } });
  z.append(name, zeit, weg);
  liste.appendChild(z);
}

function formularFuellen(p: Plan) {
  const setze = (n: string, v: string) => { const f = feld(n); if (f) f.value = v; };
  const modus = document.querySelector<HTMLInputElement>(`[name="modus"][value="${p.modus}"]`);
  if (modus) modus.checked = true;
  setze("dauerStd", String(Math.floor(p.dauerMin / 60)));
  setze("dauerMin", String(Math.round(p.dauerMin % 60)));
  setze("runden", String(p.runden));
  setze("start", p.start);
  setze("rundenzeit", rundenzeitText(p.rundenzeit));
  for (const k of ["verbrauch", "tank", "reserve", "reifenRunden", "boxgasse", "tankrate", "reifenzeit", "fahrerwechsel", "stintsAmStueck", "sparProzent", "sparVerlust"] as const)
    setze(k, String(p[k]).replace(".", ","));
  const parallel = feld("parallel");
  if (parallel) parallel.checked = p.parallel;
  const liste = document.getElementById("spFahrer") as HTMLElement;
  liste.replaceChildren();
  p.fahrer.forEach((f) => fahrerZeile(f, liste));
}

function kachel(titel: string, wert: string, icon: string) {
  const k = el("div", "sp-kachel");
  const i = el("i", `fa-solid ${icon}`);
  k.append(i, el("strong", "", wert), el("span", "", titel));
  return k;
}

function zeigen(p: Plan) {
  const basis = berechnen(p);
  const spar = p.sparProzent > 0 ? berechnen(p, 1 - p.sparProzent / 100, p.sparVerlust) : null;
  const ziel = document.getElementById("spErgebnis") as HTMLElement;
  ziel.replaceChildren();
  if (basis.fehler) {
    const f = el("div", "sp-fehler");
    f.append(el("i", "fa-solid fa-triangle-exclamation"), el("span", "", basis.fehler));
    ziel.appendChild(f);
    return;
  }
  document.querySelectorAll<HTMLElement>(".sp-nur-zeit").forEach((e) => { e.hidden = p.modus !== "zeit"; });
  document.querySelectorAll<HTMLElement>(".sp-nur-runden").forEach((e) => { e.hidden = p.modus !== "runden"; });

  const kacheln = el("div", "sp-kacheln");
  kacheln.append(
    kachel("Boxenstopps", String(basis.stints.length - 1), "fa-wrench"),
    kachel(p.modus === "zeit" ? "Runden (geschätzt)" : "Runden", String(basis.runden), "fa-flag-checkered"),
    kachel(p.modus === "zeit" ? "Renndauer" : "Gesamtzeit (geschätzt)", dauerText(basis.rennzeit), "fa-stopwatch"),
    kachel("Kraftstoff gesamt", liter(basis.sprit), "fa-gas-pump"),
    kachel("Zeit in der Box", dauerText(basis.boxzeit), "fa-hourglass-half"),
  );
  ziel.appendChild(kacheln);

  // Vergleich Vollgas gegen Sprit sparen
  if (spar && !spar.fehler) {
    const box = el("div", "sp-vergleich");
    const besser = p.modus === "runden" ? spar.rennzeit < basis.rennzeit : spar.runden > basis.runden;
    const gleich = p.modus === "runden" ? Math.abs(spar.rennzeit - basis.rennzeit) < 1 : spar.runden === basis.runden;
    const diff = p.modus === "runden" ? dauerText(Math.abs(basis.rennzeit - spar.rennzeit)) : `${Math.abs(spar.runden - basis.runden)} Runde(n)`;
    box.append(el("h3", "", `Vergleich: ${p.sparProzent.toString().replace(".", ",")} % Sprit sparen (je Runde ${p.sparVerlust.toString().replace(".", ",")} s langsamer)`));
    const zeilen = el("div", "sp-vergleich-zeilen");
    const zeile = (titel: string, e: Ergebnis) => {
      const z = el("div", "sp-vergleich-zeile");
      z.append(el("strong", "", titel), el("span", "", `${e.stints.length - 1} Stopps · ${e.runden} Runden · ${dauerText(e.rennzeit)}`));
      return z;
    };
    zeilen.append(zeile("Vollgas", basis), zeile("Sprit sparen", spar));
    const fazit = el("p", `sp-fazit${besser && !gleich ? " gut" : ""}`);
    fazit.textContent = gleich ? "Beide Varianten liegen gleichauf – Vollgas ist einfacher zu fahren."
      : besser ? `Sprit sparen ist schneller: ${diff} Vorsprung, weil ${basis.stints.length - spar.stints.length} Stopp(s) weniger nötig sind.`
      : `Vollgas ist schneller: ${diff} Vorsprung – der Zeitverlust beim Sparen wiegt den gesparten Stopp nicht auf.`;
    box.append(zeilen, fazit);
    ziel.appendChild(box);
  }

  // Stintplan
  const tabelle = el("table", "sp-tabelle");
  const kopf = el("tr");
  ["#", "Fahrer", "Start", "Ende", "Runden", "Sprit zu Beginn", "Boxenstopp danach"].forEach((t) => kopf.appendChild(el("th", "", t)));
  tabelle.appendChild(el("thead")).appendChild(kopf);
  const koerper = el("tbody");
  for (const s of basis.stints) {
    const tr = el("tr");
    const zeitZelle = (sek: number) => {
      const td = el("td");
      td.append(el("span", "", dauerText(sek)));
      const u = uhrzeit(p, sek);
      if (u) td.append(el("small", "", `${u} Uhr`));
      return td;
    };
    tr.append(el("td", "sp-nr", String(s.nr)), el("td", "sp-fahrer", s.fahrer), zeitZelle(s.start), zeitZelle(s.ende),
      el("td", "", String(s.runden)), el("td", "", liter(s.spritStart)));
    const stopp = el("td", "sp-stopp");
    if (s.stopp) {
      stopp.append(el("span", "", `${dauerText(s.stopp.dauer)} · +${liter(s.stopp.sprit)}`));
      const tags = el("span", "sp-tags");
      if (s.stopp.reifen) tags.append(el("em", "reifen", "Reifen"));
      if (s.stopp.fahrerwechsel) tags.append(el("em", "wechsel", "Fahrerwechsel"));
      if (tags.childElementCount) stopp.append(tags);
    } else stopp.append(el("span", "sp-ziel", "Ziel"));
    tr.appendChild(stopp);
    koerper.appendChild(tr);
  }
  tabelle.appendChild(koerper);
  const rahmen = el("div", "sp-tabelle-rahmen");
  rahmen.appendChild(tabelle);
  ziel.append(el("h3", "sp-titel", "Stintplan"), rahmen);

  // Fahrzeiten je Fahrer
  if (p.fahrer.length > 1) {
    const summe = new Map<string, { zeit: number; runden: number; stints: number }>();
    for (const s of basis.stints) {
      const e = summe.get(s.fahrer) || { zeit: 0, runden: 0, stints: 0 };
      e.zeit += s.ende - s.start; e.runden += s.runden; e.stints++;
      summe.set(s.fahrer, e);
    }
    const liste = el("div", "sp-fahrerzeiten");
    for (const [name, e] of summe) {
      const z = el("div", "sp-fahrerzeit");
      z.append(el("strong", "", name), el("span", "", `${e.stints} Stint(s) · ${e.runden} Runden · ${dauerText(e.zeit)} am Steuer`));
      liste.appendChild(z);
    }
    ziel.append(el("h3", "sp-titel", "Fahrzeiten"), liste);
  }
}

let timer: number | undefined;
function aktualisieren() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const p = planAusFormular();
    zeigen(p);
    try { localStorage.setItem(SPEICHER, JSON.stringify(p)); } catch { /* ohne Speicher */ }
  }, 120);
}

function teilen() {
  const p = planAusFormular();
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  const daten = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const link = `${location.origin}${location.pathname}#plan=${daten}`;
  const w = window as unknown as { showToast?: (t: string, a: string) => void };
  navigator.clipboard?.writeText(link).then(
    () => w.showToast?.("Link zum Plan kopiert – im Team-Chat einfügen.", "success"),
    () => w.showToast?.("Kopieren nicht möglich – bitte den Link aus der Adresszeile nehmen.", "info"));
  history.replaceState(null, "", `#plan=${daten}`);
}

function planLaden(): Plan {
  const m = /#plan=([\w-]{1,6000})$/.exec(location.hash);
  if (m) {
    try {
      const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
      const text = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
      return pruefen(JSON.parse(text));
    } catch { /* ungültiger Link → gespeicherter Stand */ }
  }
  try {
    const gespeichert = localStorage.getItem(SPEICHER);
    if (gespeichert) return pruefen(JSON.parse(gespeichert));
  } catch { /* egal */ }
  return { ...STANDARD };
}

// ---------- Zugang: Teil von Pole und Alliance ----------
// Der Rechner läuft komplett im Browser; die Sperre hier ist deshalb nur die Oberfläche. Sobald Pläne im Konto
// gespeichert oder im Team geteilt werden, prüft die Datenbank das Abo selbst (plan_of in den Zugriffsregeln).
type Zugang = "frei" | "gast" | "gesperrt" | "fehler";

async function zugangPruefen(): Promise<Zugang> {
  const sb = (window as any).supabaseClient;
  if (!sb) return "fehler";
  try {
    const { data } = await sb.auth.getSession();
    const user = data?.session?.user;
    if (!user) return "gast";
    const [plan, profil] = await Promise.all([
      sb.rpc("plan_of", { _user: user.id }),
      sb.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (plan.error) return "fehler";
    if (plan.data === "pole" || plan.data === "alliance" || profil.data?.role === "admin") return "frei";
    return "gesperrt";
  } catch {
    return "fehler";
  }
}

function sperreZeigen(ziel: HTMLElement, art: Exclude<Zugang, "frei">) {
  ziel.replaceChildren();
  if (art === "gast") return; // die Anmelde-Karte über der Seite kommt aus auth-nav.js
  const karte = el("div", "sp-sperre");
  const icon = el("i", `fa-solid ${art === "fehler" ? "fa-triangle-exclamation" : "fa-lock"}`);
  icon.setAttribute("aria-hidden", "true");
  karte.append(icon);
  if (art === "fehler") {
    karte.append(el("h2", "", "Der Zugang konnte nicht geprüft werden"),
      el("p", "", "Bitte lade die Seite neu. Bleibt die Meldung, versuche es in ein paar Minuten noch einmal."));
    const neu = el("button", "sp-btn primaer", "Neu laden");
    neu.type = "button";
    neu.addEventListener("click", () => location.reload());
    karte.append(neu);
  } else {
    karte.append(el("h2", "", "Der Stint-Planer ist Teil von Pole und Alliance"),
      el("p", "", "Plane Kraftstoff, Stints, Reifen- und Fahrerwechsel für Langstreckenrennen – mit echter Uhrzeit, Fahrzeiten je Fahrer und dem Vergleich „Vollgas gegen Sprit sparen“. Mit Pole oder Alliance ist der Planer für dich freigeschaltet."));
    const liste = el("ul", "sp-sperre-liste");
    for (const punkt of ["Rennen nach Zeit oder Runden, mit Startuhrzeit", "Bis zu 8 Fahrer mit eigener Rundenzeit",
      "Kraftstoff, Reifen und Boxenstopps je Stint", "Plan per Link mit dem Team teilen"]) {
      liste.append(el("li", "", punkt));
    }
    const abo = el("a", "sp-btn primaer", "Abos ansehen");
    abo.href = "abo.html";
    karte.append(liste, abo);
  }
  ziel.append(karte);
}

async function starten() {
  const form = document.getElementById("spFormular") as HTMLFormElement | null;
  const zugangBox = document.getElementById("spZugang");
  if (!form || !zugangBox) return;
  const zugang = await zugangPruefen();
  if (zugang !== "frei") { sperreZeigen(zugangBox, zugang); return; }
  zugangBox.remove();
  document.querySelector<HTMLElement>(".sp-beta")?.removeAttribute("hidden");
  document.querySelector<HTMLElement>(".sp-layout")?.removeAttribute("hidden");
  formularFuellen(planLaden());
  form.addEventListener("input", aktualisieren);
  form.addEventListener("change", aktualisieren);
  form.addEventListener("submit", (e) => e.preventDefault());
  document.getElementById("spFahrerNeu")?.addEventListener("click", () => {
    const liste = document.getElementById("spFahrer") as HTMLElement;
    if (liste.children.length >= 8) return;
    fahrerZeile({ name: `Fahrer ${liste.children.length + 1}`, rundenzeit: null }, liste);
    aktualisieren();
  });
  document.getElementById("spTeilen")?.addEventListener("click", teilen);
  document.getElementById("spZurueck")?.addEventListener("click", () => {
    formularFuellen({ ...STANDARD });
    history.replaceState(null, "", location.pathname);
    aktualisieren();
  });
  aktualisieren();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void starten());
else void starten();
