// GSRA – Stint-Planer (Pole und Alliance). Rechnet im Browser; Pläne liegen im Konto (SQL 045) und werden mit dem
// Team live abgeglichen. Jede Eingabe wird beim Laden auf sinnvolle Grenzen geprüft (pruefen), alle Texte werden mit
// textContent ausgegeben. Teilen per Link (#plan=…) funktioniert weiterhin.
// Später: Verbrauch, Rundenzeiten und Live-Stand automatisch aus der GSRA-App (iRacing, ACC, LMU).

type Fahrer = { name: string; rundenzeit: number | null };
type Rennen = { simulation: string; fahrzeug: string; strecke: string; notizen: string };
type Live = { aktiv: boolean; rennzeitMin: number; runde: number; sprit: number; stand: string };
type Plan = {
  modus: "zeit" | "runden"; dauerMin: number; runden: number; start: string;
  rundenzeit: number; verbrauch: number; tank: number; reserve: number; reifenRunden: number;
  boxgasse: number; tankrate: number; reifenzeit: number; fahrerwechsel: number; parallel: boolean;
  fahrer: Fahrer[]; stintsAmStueck: number; sparProzent: number; sparVerlust: number;
  rennen: Rennen; live: Live;
};
type Stopp = { dauer: number; sprit: number; reifen: boolean; fahrerwechsel: boolean };
type Stint = { nr: number; fahrer: string; fahrerIdx: number; start: number; ende: number; startRunde: number; runden: number; spritStart: number; stopp: Stopp | null };
type Ergebnis = { stints: Stint[]; rennzeit: number; runden: number; boxzeit: number; sprit: number; fehler?: string };
type Ab = { zeit: number; runden: number; sprit: number; fahrerIdx: number; stintsDesFahrers: number };

const STANDARD: Plan = {
  modus: "zeit", dauerMin: 120, runden: 60, start: "",
  rundenzeit: 105, verbrauch: 3.1, tank: 100, reserve: 1, reifenRunden: 0,
  boxgasse: 30, tankrate: 2.5, reifenzeit: 20, fahrerwechsel: 15, parallel: false,
  fahrer: [{ name: "Fahrer 1", rundenzeit: null }, { name: "Fahrer 2", rundenzeit: null }],
  stintsAmStueck: 1, sparProzent: 5, sparVerlust: 0.3,
  rennen: { simulation: "", fahrzeug: "", strecke: "", notizen: "" },
  live: { aktiv: false, rennzeitMin: 0, runde: 0, sprit: 0, stand: "" },
};
const SPEICHER = "gsra_stintplaner_v1";

// ---------- Werkzeuge ----------
// Fehlende oder leere Werte → Standardwert (nicht 0), sonst auf die Grenzen begrenzen
const zahl = (v: unknown, min: number, max: number, std: number) => {
  const roh = typeof v === "number" ? v : String(v ?? "").trim();
  if (roh === "") return std;
  const n = typeof roh === "number" ? roh : Number(roh.replace(",", "."));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std;
};
const text = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f<>]/g, "").trim().slice(0, max);
// „1:47.5“, „1:47,5“ oder „107.5“ → Sekunden
function zeitLesen(t0: string): number | null {
  const t = t0.trim().replace(",", ".");
  if (!t) return null;
  const m = /^(?:(\d{1,2}):)?(\d{1,4}(?:\.\d{1,3})?)$/.exec(t);
  if (!m) return null;
  const s = (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
  return s >= 20 && s <= 1200 ? s : null;
}
// „1:25“ → 85 Minuten
function stundenMinuten(t0: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t0.trim());
  if (m) return Number(m[1]) * 60 + Math.min(59, Number(m[2]));
  const n = Number(t0.replace(",", "."));
  return t0.trim() && Number.isFinite(n) ? n : null;
}
const rundenzeitText = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
function dauerText(s: number): string {
  const sek = Math.round(s);
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), r = sek % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")} h` : `${m}:${String(r).padStart(2, "0")} min`;
}
const liter = (l: number) => `${l.toFixed(1).replace(".", ",")} l`;
const komma = (n: number, stellen = 1) => n.toFixed(stellen).replace(".", ",");
function startZeit(plan: Plan): number | null {
  if (!plan.start) return null;
  const d = new Date(plan.start).getTime();
  return Number.isNaN(d) ? null : d;
}
function uhrzeit(plan: Plan, sek: number): string | null {
  const s = startZeit(plan);
  return s == null ? null : new Date(s + sek * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function pruefen(roh: Partial<Plan>): Plan {
  const fahrer = Array.isArray(roh.fahrer) ? roh.fahrer.slice(0, 8).map((f, i) => ({
    name: text(f?.name, 30) || `Fahrer ${i + 1}`,
    rundenzeit: f?.rundenzeit == null ? null : zahl(f.rundenzeit, 20, 1200, STANDARD.rundenzeit),
  })) : STANDARD.fahrer;
  const r = (roh.rennen || {}) as Partial<Rennen>;
  const l = (roh.live || {}) as Partial<Live>;
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
    rennen: { simulation: text(r.simulation, 40), fahrzeug: text(r.fahrzeug, 60), strecke: text(r.strecke, 60), notizen: text(r.notizen, 500) },
    live: {
      aktiv: Boolean(l.aktiv), rennzeitMin: zahl(l.rennzeitMin, 0, 2000, 0), runde: Math.round(zahl(l.runde, 0, 5000, 0)),
      sprit: zahl(l.sprit, 0, 500, 0), stand: typeof l.stand === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(l.stand) ? l.stand : "",
    },
  };
}

// ---------- Berechnung ----------
// ab: aktueller Stand im Rennen (Rennzeit, Runden, Sprit im Tank, aktueller Fahrer) – ohne: Rennstart mit vollem Bedarf
export function berechnen(p: Plan, verbrauchFaktor = 1, zeitPlus = 0, ab?: Ab): Ergebnis {
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
  let zeit = ab?.zeit ?? 0, runden = ab?.runden ?? 0, boxzeit = 0, sprit = 0, reifenRunden = 0;
  let fahrerIdx = ab ? Math.min(ab.fahrerIdx, p.fahrer.length - 1) : 0, stintsDesFahrers = ab?.stintsDesFahrers ?? 0;
  let tankJetzt: number | null = ab ? ab.sprit : null;
  while (stints.length < 300) {
    const lt = rundenzeitVon(fahrerIdx);
    const rest = restRunden(zeit, runden, lt);
    if (rest <= 0) break;
    const moeglich = tankJetzt == null ? maxRunden : Math.max(0, Math.floor((tankJetzt - p.reserve) / verbrauch));
    const r = Math.min(moeglich, rest);
    const spritStart = tankJetzt == null ? Math.min(p.tank, r * verbrauch + p.reserve) : tankJetzt;
    tankJetzt = null;
    const stint: Stint = {
      nr: stints.length + 1, fahrer: p.fahrer[fahrerIdx]?.name || `Fahrer ${fahrerIdx + 1}`, fahrerIdx,
      start: zeit, ende: zeit + r * lt, startRunde: runden, runden: r, spritStart, stopp: null,
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
    const restSprit = Math.max(0, spritStart - r * verbrauch);
    const nachtanken = Math.max(0, Math.min(p.tank, naechsteRunden * verbrauch + p.reserve) - restSprit);
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
  const getankt = stints.reduce((s, st) => s + (st.stopp?.sprit ?? 0), 0);
  return { stints, rennzeit: zeit, runden, boxzeit, sprit: ab ? getankt : sprit + p.reserve };
}

// Wer fährt laut Plan zu diesem Zeitpunkt (Rennzeit in Sekunden)?
function stintZurZeit(e: Ergebnis, sek: number): Stint | null {
  return e.stints.find((s) => sek >= s.start && sek < (s.stopp ? s.ende + s.stopp.dauer : s.ende)) ?? null;
}

function liveAb(p: Plan, basis: Ergebnis): Ab | null {
  if (!p.live.aktiv || p.live.sprit <= 0) return null;
  const zeit = p.live.rennzeitMin * 60;
  const runden = p.live.runde || (p.modus === "zeit" ? Math.floor(zeit / p.rundenzeit) : 0);
  const aktuell = stintZurZeit(basis, zeit) ?? basis.stints[basis.stints.length - 1];
  if (!aktuell) return null;
  // Wie viele Stints fährt der aktuelle Fahrer schon am Stück?
  let amStueck = 0;
  for (let i = aktuell.nr - 1; i >= 0 && basis.stints[i]?.fahrerIdx === aktuell.fahrerIdx; i--) amStueck++;
  return { zeit, runden, sprit: p.live.sprit, fahrerIdx: aktuell.fahrerIdx, stintsDesFahrers: Math.max(0, amStueck - 1) };
}

// ---------- Oberfläche: Bausteine ----------
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", inhalt?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (inhalt !== undefined) e.textContent = inhalt;
  return e;
};
const icon = (name: string) => { const i = el("i", `fa-solid ${name}`); i.setAttribute("aria-hidden", "true"); return i; };
const feld = (name: string) => document.querySelector<HTMLInputElement>(`#spFormular [name="${name}"]`);
const toast = (t: string, art: "success" | "error" | "info" = "info") =>
  (window as unknown as { showToast?: (t: string, a: string) => void }).showToast?.(t, art);
const sb = () => (window as any).supabaseClient;

function planAusFormular(): Plan {
  const wert = (n: string) => feld(n)?.value ?? "";
  const fahrer: Fahrer[] = [...document.querySelectorAll<HTMLElement>(".sp-fahrer-zeile")].map((z) => ({
    name: (z.querySelector<HTMLInputElement>(".sp-fahrer-name")?.value || "").trim(),
    rundenzeit: zeitLesen(z.querySelector<HTMLInputElement>(".sp-fahrer-zeit")?.value || ""),
  }));
  const liveAktiv = Boolean(feld("liveAktiv")?.checked);
  return pruefen({
    modus: (document.querySelector<HTMLInputElement>('#spFormular [name="modus"]:checked')?.value as Plan["modus"]) || "zeit",
    dauerMin: zahl(wert("dauerStd"), 0, 33, 0) * 60 + zahl(wert("dauerMin"), 0, 59, 0),
    runden: Number(wert("runden")), start: wert("start"),
    rundenzeit: zeitLesen(wert("rundenzeit")) ?? undefined, verbrauch: Number(wert("verbrauch").replace(",", ".")),
    tank: Number(wert("tank").replace(",", ".")), reserve: Number(wert("reserve").replace(",", ".")),
    reifenRunden: Number(wert("reifenRunden")), boxgasse: Number(wert("boxgasse").replace(",", ".")),
    tankrate: Number(wert("tankrate").replace(",", ".")), reifenzeit: Number(wert("reifenzeit").replace(",", ".")),
    fahrerwechsel: Number(wert("fahrerwechsel").replace(",", ".")), parallel: Boolean(feld("parallel")?.checked),
    fahrer, stintsAmStueck: Number(wert("stintsAmStueck")),
    sparProzent: Number(wert("sparProzent").replace(",", ".")), sparVerlust: Number(wert("sparVerlust").replace(",", ".")),
    rennen: { simulation: wert("simulation"), fahrzeug: wert("fahrzeug"), strecke: wert("strecke"),
      notizen: (document.querySelector<HTMLTextAreaElement>('#spFormular [name="notizen"]')?.value ?? "") },
    live: {
      aktiv: liveAktiv, rennzeitMin: stundenMinuten(wert("liveZeit")) ?? 0, runde: Number(wert("liveRunde")) || 0,
      sprit: Number(wert("liveSprit").replace(",", ".")) || 0, stand: liveAktiv ? (zuletzt?.live.stand || new Date().toISOString()) : "",
    },
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
  weg.append(icon("fa-xmark"));
  weg.addEventListener("click", () => { if (liste.children.length > 1) { z.remove(); aktualisieren(); } });
  z.append(name, zeit, weg);
  liste.appendChild(z);
}

function formularFuellen(p: Plan) {
  const setze = (n: string, v: string) => { const f = feld(n); if (f) f.value = v; };
  const modus = document.querySelector<HTMLInputElement>(`#spFormular [name="modus"][value="${p.modus}"]`);
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
  setze("simulation", p.rennen.simulation);
  setze("fahrzeug", p.rennen.fahrzeug);
  setze("strecke", p.rennen.strecke);
  const notizen = document.querySelector<HTMLTextAreaElement>('#spFormular [name="notizen"]');
  if (notizen) notizen.value = p.rennen.notizen;
  const live = feld("liveAktiv");
  if (live) live.checked = p.live.aktiv;
  setze("liveZeit", p.live.aktiv ? `${Math.floor(p.live.rennzeitMin / 60)}:${String(Math.round(p.live.rennzeitMin % 60)).padStart(2, "0")}` : "");
  setze("liveRunde", p.live.aktiv && p.live.runde ? String(p.live.runde) : "");
  setze("liveSprit", p.live.aktiv && p.live.sprit ? komma(p.live.sprit) : "");
  const liste = document.getElementById("spFahrer") as HTMLElement;
  liste.replaceChildren();
  p.fahrer.forEach((f) => fahrerZeile(f, liste));
}

function kachel(titel: string, wert: string, ic: string) {
  const k = el("div", "sp-kachel");
  k.append(icon(ic), el("strong", "", wert), el("span", "", titel));
  return k;
}

// ---------- Empfehlungen (regelbasiert, ohne KI) ----------
function empfehlungen(p: Plan, basis: Ergebnis): string[] {
  const out: string[] = [];
  const stopps = basis.stints.length - 1;
  // Spar-Ziel: kleinste Ersparnis, die einen Stopp spart
  if (stopps > 0) {
    for (let prozent = 0.5; prozent <= 20; prozent += 0.5) {
      const test = berechnen(p, 1 - prozent / 100, 0);
      if (!test.fehler && test.stints.length - 1 < stopps) {
        out.push(`Mit ${komma(prozent)} % weniger Verbrauch (${komma(p.verbrauch * (1 - prozent / 100), 2)} statt ${komma(p.verbrauch, 2)} l pro Runde) sparst du einen Boxenstopp. Ob sich das lohnt, zeigt der Vergleich oben.`);
        break;
      }
    }
  }
  // Kurzer letzter Stint = Splash-and-Dash
  const maxRunden = Math.floor((p.tank - p.reserve) / p.verbrauch);
  const letzter = basis.stints[basis.stints.length - 1];
  const vorletzter = basis.stints[basis.stints.length - 2];
  if (letzter && vorletzter?.stopp && letzter.runden < maxRunden * 0.35) {
    out.push(`Der letzte Stint hat nur ${letzter.runden} Runden – der letzte Stopp ist ein kurzer Tankstopp mit ${liter(vorletzter.stopp.sprit)}. Genau hier lohnt sich Spritsparen am meisten.`);
  }
  // Fahrzeiten ungleich verteilt
  if (p.fahrer.length > 1) {
    const zeiten = new Map<string, number>();
    basis.stints.forEach((s) => zeiten.set(s.fahrer, (zeiten.get(s.fahrer) || 0) + s.ende - s.start));
    const werte = [...zeiten.values()];
    if (werte.length > 1 && Math.max(...werte) > Math.min(...werte) * 1.3) {
      const [langsam] = [...zeiten.entries()].sort((a, b) => b[1] - a[1]);
      out.push(`${langsam[0]} fährt deutlich länger als die anderen. Prüfe „Stints am Stück“ oder die Reihenfolge, wenn die Fahrzeit gleich verteilt sein soll.`);
    } else if (werte.length < p.fahrer.length) {
      out.push(`Nicht alle Fahrer kommen zum Einsatz – bei ${stopps + 1} Stints und „${p.stintsAmStueck} Stints am Stück“ reicht die Zeit nicht für alle.`);
    }
  }
  // Reserve
  if (p.reserve < p.verbrauch * 0.5) {
    out.push("Die Reserve ist kleiner als eine halbe Runde. Plane mehr Puffer für Gelbphasen, Verkehr und eine mögliche Zusatzrunde bei Zeitrennen ein.");
  }
  // Gleichzeitiger Service
  if (!p.parallel && stopps > 0) {
    const mitParallel = berechnen({ ...p, parallel: true });
    const gewinn = basis.boxzeit - mitParallel.boxzeit;
    if (gewinn >= 5) out.push(`Erlaubt deine Serie Tanken, Reifen- und Fahrerwechsel gleichzeitig, sparst du insgesamt etwa ${dauerText(gewinn)} in der Box.`);
  }
  if (p.modus === "zeit") out.push("Zeitrennen enden erst, wenn der Führende nach Ablauf der Zeit die Linie überquert – plane Sprit für eine zusätzliche Runde ein.");
  return out;
}

// ---------- Ergebnis anzeigen ----------
let zuletzt: Plan | null = null;

function zeigen(p: Plan) {
  zuletzt = p;
  const basis = berechnen(p);
  const spar = p.sparProzent > 0 ? berechnen(p, 1 - p.sparProzent / 100, p.sparVerlust) : null;
  const ziel = document.getElementById("spErgebnis") as HTMLElement;
  ziel.replaceChildren();
  document.querySelectorAll<HTMLElement>(".sp-nur-zeit").forEach((e) => { e.hidden = p.modus !== "zeit"; });
  document.querySelectorAll<HTMLElement>(".sp-nur-runden").forEach((e) => { e.hidden = p.modus !== "runden"; });
  document.querySelectorAll<HTMLElement>(".sp-nur-live").forEach((e) => { e.hidden = !p.live.aktiv; });
  if (basis.fehler) {
    const f = el("div", "sp-fehler");
    f.append(icon("fa-triangle-exclamation"), el("span", "", basis.fehler));
    ziel.appendChild(f);
    return;
  }

  // Rennen und Fahrzeug fürs Team
  const info = [p.rennen.simulation, p.rennen.fahrzeug, p.rennen.strecke].filter(Boolean);
  if (info.length || p.rennen.notizen) {
    const box = el("div", "sp-rennkopf");
    if (info.length) box.append(el("strong", "", info.join(" · ")));
    if (p.rennen.notizen) box.append(el("p", "", p.rennen.notizen));
    ziel.appendChild(box);
  }

  // Jetzt im Rennen (aus Startuhrzeit) – wer fährt, nächster Stopp
  const s0 = startZeit(p);
  if (s0 != null) {
    const sek = (Date.now() - s0) / 1000;
    if (sek >= 0 && sek < basis.rennzeit) {
      const st = stintZurZeit(basis, sek);
      if (st) {
        const box = el("div", "sp-jetzt");
        box.append(icon("fa-clock"));
        const t = el("div");
        t.append(el("strong", "", `Jetzt laut Plan: ${st.fahrer} · Stint ${st.nr}`));
        if (st.stopp) {
          const naechster = basis.stints[st.nr];
          t.append(el("span", "", `Nächster Stopp um ${uhrzeit(p, st.ende)} Uhr (in ${dauerText(Math.max(0, st.ende - sek))})${naechster && naechster.fahrer !== st.fahrer ? ` – danach fährt ${naechster.fahrer}` : ""}.`));
        } else t.append(el("span", "", `Letzter Stint – Zielankunft gegen ${uhrzeit(p, st.ende)} Uhr.`));
        box.append(t);
        ziel.appendChild(box);
      }
    }
  }

  // Live-Stand: ab dem aktuellen Stand neu rechnen
  const ab = liveAb(p, basis);
  if (ab) {
    const live = berechnen(p, 1, 0, ab);
    const box = el("div", "sp-live");
    const kopf = el("h3", "", "Live-Stand");
    if (p.live.stand) kopf.append(el("small", "", ` · eingetragen ${new Date(p.live.stand).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`));
    box.append(kopf);
    if (live.fehler) box.append(el("p", "", live.fehler));
    else {
      const erster = live.stints[0];
      const rundenImTank = Math.max(0, Math.floor((p.live.sprit - p.reserve) / p.verbrauch));
      const zeilen = el("ul", "sp-live-liste");
      const z = (t: string) => zeilen.append(el("li", "", t));
      z(`Sprit reicht noch für ${rundenImTank} Runde(n)${erster ? ` – bis Runde ${erster.startRunde + erster.runden}` : ""}.`);
      if (erster?.stopp) {
        const u = uhrzeit(p, erster.ende);
        z(`Nächster Stopp${u ? ` gegen ${u} Uhr` : ""} (Rennzeit ${dauerText(erster.ende)}): ${liter(erster.stopp.sprit)} nachtanken${erster.stopp.reifen ? ", Reifen wechseln" : ""}${erster.stopp.fahrerwechsel ? `, Fahrerwechsel zu ${live.stints[1]?.fahrer ?? "–"}` : ""}.`);
      } else z("Der Sprit reicht bis ins Ziel – kein weiterer Stopp nötig.");
      z(`Noch ${Math.max(0, live.stints.length - 1)} Stopp(s) bis zum Ziel, insgesamt ${liter(live.sprit)} nachtanken.`);
      const planStopps = basis.stints.filter((s) => s.ende > ab.zeit && s.stopp).length;
      if (planStopps !== live.stints.length - 1) z(`Abweichung vom Plan: ${live.stints.length - 1 > planStopps ? "ein Stopp mehr" : "ein Stopp weniger"} als ursprünglich geplant.`);
      box.append(zeilen);
    }
    ziel.appendChild(box);
  }

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
    box.append(el("h3", "", `Vergleich: ${komma(p.sparProzent)} % Sprit sparen (je Runde ${komma(p.sparVerlust)} s langsamer)`));
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

  // Empfehlungen
  const tipps = empfehlungen(p, basis);
  if (tipps.length) {
    const box = el("div", "sp-tipps");
    const kopf = el("h3", "");
    kopf.append(icon("fa-headset"), " Empfehlungen");
    const liste = el("ul");
    tipps.forEach((t) => liste.append(el("li", "", t)));
    box.append(kopf, liste);
    ziel.appendChild(box);
  }

  // Stintplan
  const tabelle = el("table", "sp-tabelle");
  const kopfzeile = el("tr");
  ["#", "Fahrer", "Start", "Ende", "Runden", "Sprit zu Beginn", "Boxenstopp danach"].forEach((t) => kopfzeile.appendChild(el("th", "", t)));
  tabelle.appendChild(el("thead")).appendChild(kopfzeile);
  const koerper = el("tbody");
  const jetzt = s0 != null ? (Date.now() - s0) / 1000 : -1;
  for (const s of basis.stints) {
    const tr = el("tr", jetzt >= s.start && jetzt < (s.stopp ? s.ende + s.stopp.dauer : s.ende) ? "aktuell" : "");
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

  // Was die GSRA-App zusätzlich kann
  const app = el("div", "sp-app");
  const appKopf = el("h3", "");
  appKopf.append(icon("fa-desktop"), " Bald mit der GSRA-App");
  const appListe = el("ul");
  for (const t of ["Verbrauch, Rundenzeiten und Tankgröße automatisch aus der Simulation – kein Tippen mehr",
    "Live-Sprit und Rundenstand für das ganze Team, auch auf dem Handy als zweiter Bildschirm",
    "Tankmenge und Reifen für den nächsten Stopp direkt im Spiel vorbereiten (wo die Simulation es offiziell erlaubt)",
    "Boxenausfahrt-Radar, Undercut-Rechner und Verkehrsvorhersage mit echten Abständen",
    "Später: ein KI-Renningenieur, den du per Knopfdruck fragst"]) appListe.append(el("li", "", t));
  app.append(appKopf, appListe);
  ziel.appendChild(app);
}

// ---------- Konto: Pläne speichern, Team, Live-Abgleich (SQL 045) ----------
type PlanZeile = { id: string; name: string; owner_name: string; role: string; updated_at: string; members: number };
const konto = {
  aktiv: false, ich: "" as string, planId: null as string | null, version: null as number | null, rolle: "eigentuemer",
  name: "Mein Stintplan", plaene: [] as PlanZeile[], kanal: null as any, gespeichert: "", speichernTimer: 0 as number | undefined,
  laeuft: false, ausFremdAenderung: false,
};
const namen = new Map<string, string>();

function status(t: string, art: "" | "ok" | "warn" = "") {
  const s = document.getElementById("spStatus");
  if (!s) return;
  s.textContent = t;
  s.className = `sp-status ${art}`;
}

function nurAnsehen(an: boolean) {
  document.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement>(
    "#spFormular input, #spFormular textarea, #spFormular select, #spFormular button").forEach((e) => {
    if (e.id === "spTeilen") return;
    e.disabled = an;
  });
  const name = document.getElementById("spPlanName") as HTMLInputElement | null;
  if (name) name.disabled = an;
}

function leisteAktualisieren() {
  const wahl = document.getElementById("spPlanWahl") as HTMLSelectElement | null;
  const name = document.getElementById("spPlanName") as HTMLInputElement | null;
  const loeschen = document.getElementById("spPlanLoeschen") as HTMLButtonElement | null;
  const team = document.getElementById("spTeamKnopf") as HTMLButtonElement | null;
  if (!wahl || !name || !loeschen || !team) return;
  wahl.replaceChildren();
  if (!konto.planId) {
    const o = el("option", "", `${konto.name} (noch nicht gespeichert)`);
    o.value = "";
    wahl.append(o);
  }
  for (const p of konto.plaene) {
    const o = el("option", "", p.role === "eigentuemer" ? p.name : `${p.name} – von ${p.owner_name}${p.role === "ansehen" ? " (ansehen)" : ""}`);
    o.value = p.id;
    wahl.append(o);
  }
  wahl.value = konto.planId ?? "";
  name.value = konto.name;
  loeschen.hidden = konto.rolle !== "eigentuemer" || !konto.planId;
  team.disabled = !konto.planId;
  team.title = konto.planId ? "Team verwalten" : "Speichere den Plan zuerst (einfach etwas ändern)";
}

async function listeLaden(): Promise<boolean> {
  const { data, error } = await sb().rpc("stint_plan_list");
  if (error) return false;
  konto.plaene = (data || []) as PlanZeile[];
  return true;
}

async function speichern() {
  if (!konto.aktiv || konto.rolle === "ansehen" || konto.laeuft) return;
  const plan = planAusFormular();
  const json = JSON.stringify(plan);
  const name = (document.getElementById("spPlanName") as HTMLInputElement | null)?.value.trim() || konto.name;
  if (json === konto.gespeichert && name === konto.name && konto.planId) return;
  konto.laeuft = true;
  status("Wird gespeichert …");
  const { data, error } = await sb().rpc("stint_plan_save", { _id: konto.planId, _name: name, _data: plan, _version: konto.version });
  konto.laeuft = false;
  if (error) {
    const msg = String(error.message || "");
    if (/gerade von jemand anderem geändert/.test(msg) && konto.planId) {
      toast("Jemand aus dem Team hat den Plan gerade geändert – er wurde neu geladen.", "info");
      await planOeffnen(konto.planId);
      return;
    }
    status(/Zu viele|Pole und Alliance|nur ansehen|zu groß|25 Stintpläne/.test(msg) ? msg : "Speichern fehlgeschlagen – bitte prüfe deine Verbindung.", "warn");
    return;
  }
  const neu = !konto.planId;
  konto.planId = data.id;
  konto.version = data.version;
  konto.name = name;
  konto.gespeichert = json;
  status(`Gespeichert um ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`, "ok");
  if (neu) {
    await listeLaden();
    leisteAktualisieren();
    abonnieren(konto.planId!);
    history.replaceState(null, "", `${location.pathname}?plan=${konto.planId}`);
  } else {
    const zeile = konto.plaene.find((x) => x.id === konto.planId);
    if (zeile && zeile.name !== name) { zeile.name = name; leisteAktualisieren(); }
  }
}

function speichernBald() {
  if (!konto.aktiv || konto.ausFremdAenderung) return;
  window.clearTimeout(konto.speichernTimer);
  konto.speichernTimer = window.setTimeout(() => void speichern(), 1200);
}

function abonnieren(id: string) {
  const client = sb();
  if (!client?.channel) return;
  if (konto.kanal) { client.removeChannel?.(konto.kanal); konto.kanal = null; }
  konto.kanal = client.channel(`stintplan-${id}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "stint_plans", filter: `id=eq.${id}` }, (payload: any) => {
      const neu = payload?.new;
      if (!neu || neu.id !== konto.planId || (konto.version != null && neu.version <= konto.version)) return;
      konto.version = neu.version;
      if (neu.updated_by === konto.ich) return; // eigene Änderung (Echo)
      konto.ausFremdAenderung = true;
      konto.name = String(neu.name || konto.name);
      const plan = pruefen(neu.data || {});
      formularFuellen(plan);
      konto.gespeichert = JSON.stringify(plan);
      zeigen(plan);
      leisteAktualisieren();
      konto.ausFremdAenderung = false;
      const wer = namen.get(neu.updated_by) || "Jemand aus dem Team";
      status(`${wer} hat den Plan um ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr geändert`, "ok");
    })
    .subscribe();
}

async function planOeffnen(id: string) {
  const { data, error } = await sb().from("stint_plans").select("id, name, data, version, owner_id").eq("id", id).maybeSingle();
  if (error || !data) { toast("Dieser Plan ist nicht (mehr) verfügbar.", "error"); return false; }
  konto.planId = data.id;
  konto.version = data.version;
  konto.name = data.name;
  konto.rolle = konto.plaene.find((x) => x.id === id)?.role || (data.owner_id === konto.ich ? "eigentuemer" : "ansehen");
  const plan = pruefen(data.data || {});
  konto.ausFremdAenderung = true;
  formularFuellen(plan);
  konto.gespeichert = JSON.stringify(plan);
  zeigen(plan);
  konto.ausFremdAenderung = false;
  nurAnsehen(konto.rolle === "ansehen");
  leisteAktualisieren();
  abonnieren(id);
  status(konto.rolle === "ansehen" ? "Nur ansehen – Änderungen erscheinen hier live" : "Alle Änderungen werden automatisch gespeichert", konto.rolle === "ansehen" ? "warn" : "ok");
  history.replaceState(null, "", `${location.pathname}?plan=${id}`);
  void teamNamenLaden(id);
  return true;
}

async function teamNamenLaden(id: string) {
  const { data } = await sb().rpc("stint_plan_team", { _plan: id });
  (data || []).forEach((m: any) => namen.set(m.user_id, m.username));
}

async function neuerPlan() {
  window.clearTimeout(konto.speichernTimer);
  if (konto.kanal) { sb().removeChannel?.(konto.kanal); konto.kanal = null; }
  konto.planId = null;
  konto.version = null;
  konto.rolle = "eigentuemer";
  konto.name = "Neuer Stintplan";
  konto.gespeichert = "";
  nurAnsehen(false);
  formularFuellen({ ...STANDARD });
  zeigen({ ...STANDARD });
  leisteAktualisieren();
  history.replaceState(null, "", location.pathname);
  await speichern();
}

async function planLoeschen() {
  if (!konto.planId || konto.rolle !== "eigentuemer") return;
  const dialog = (window as any).showDialog;
  const ok = typeof dialog === "function"
    ? await dialog({ icon: "fa-trash", title: "Plan löschen?", message: `„${konto.name}“ wird für dich und das ganze Team endgültig gelöscht.`, confirmText: "Löschen", cancelText: "Abbrechen" })
    : window.confirm("Plan löschen?");
  if (!ok) return;
  const { error } = await sb().rpc("stint_plan_delete", { _id: konto.planId });
  if (error) return toast("Der Plan konnte nicht gelöscht werden.", "error");
  toast("Plan gelöscht.", "success");
  await listeLaden();
  if (konto.plaene[0]) await planOeffnen(konto.plaene[0].id);
  else await neuerPlan();
}

// ---------- Team-Fenster ----------
async function teamFenster() {
  if (!konto.planId) return;
  document.getElementById("spTeamDialog")?.remove();
  const overlay = el("div", "gsra-dialog-overlay");
  overlay.id = "spTeamDialog";
  const fenster = el("div", "gsra-dialog sp-team-dialog");
  fenster.setAttribute("role", "dialog");
  fenster.setAttribute("aria-modal", "true");
  const zu = el("button", "gsra-dialog-close");
  zu.type = "button"; zu.title = "Schließen"; zu.append(icon("fa-xmark"));
  const titel = el("h3", "gsra-dialog-title", "Team für diesen Plan");
  const info = el("p", "sp-team-info", "Mitglieder mit Pole oder Alliance sehen den Plan live. Mit „bearbeiten“ können sie ihn auch ändern – etwa den Live-Stand im Rennen eintragen.");
  const liste = el("ul", "sp-team-liste");
  fenster.append(zu, titel, info, liste);
  overlay.append(fenster);
  const schliessen = () => overlay.remove();
  zu.addEventListener("click", schliessen);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) schliessen(); });
  document.body.append(overlay);

  const laden = async () => {
    const { data, error } = await sb().rpc("stint_plan_team", { _plan: konto.planId });
    liste.replaceChildren();
    if (error) { liste.append(el("li", "", "Das Team konnte nicht geladen werden.")); return; }
    for (const m of (data || []) as Array<{ user_id: string; username: string; avatar_url: string | null; gsra_id: number | null; role: string }>) {
      namen.set(m.user_id, m.username);
      const li = el("li", "sp-team-zeile");
      const bild = el("span", "sp-team-bild");
      if (m.avatar_url && /^https:\/\//.test(m.avatar_url)) { const img = el("img"); img.src = m.avatar_url; img.alt = ""; bild.append(img); }
      else bild.textContent = (m.username || "?").charAt(0).toUpperCase();
      const name = el("span", "sp-team-name");
      name.append(el("strong", "", m.user_id === konto.ich ? `${m.username} (Du)` : m.username),
        el("small", "", m.role === "eigentuemer" ? "Angelegt von" : m.role === "bearbeiten" ? "Darf bearbeiten" : "Darf ansehen"));
      li.append(bild, name);
      if (konto.rolle === "eigentuemer" && m.role !== "eigentuemer") {
        const rolle = el("select", "sp-team-rolle");
        rolle.setAttribute("aria-label", `Rolle von ${m.username}`);
        for (const [w, t] of [["ansehen", "Ansehen"], ["bearbeiten", "Bearbeiten"]]) { const o = el("option", "", t); o.value = w; rolle.append(o); }
        rolle.value = m.role;
        rolle.addEventListener("change", async () => {
          if (!m.gsra_id) return;
          const { error: e } = await sb().rpc("stint_plan_member_add", { _plan: konto.planId, _gsra_id: m.gsra_id, _role: rolle.value });
          toast(e ? (e.message || "Die Rolle konnte nicht geändert werden.") : "Rolle geändert.", e ? "error" : "success");
        });
        const weg = el("button", "sp-icon-btn");
        weg.type = "button"; weg.title = "Aus dem Team entfernen"; weg.setAttribute("aria-label", `${m.username} entfernen`);
        weg.append(icon("fa-user-minus"));
        weg.addEventListener("click", async () => {
          const { error: e } = await sb().rpc("stint_plan_member_remove", { _plan: konto.planId, _user: m.user_id });
          if (e) toast("Entfernen fehlgeschlagen.", "error"); else void laden();
        });
        li.append(rolle, weg);
      }
      liste.append(li);
    }
  };

  if (konto.rolle === "eigentuemer") {
    const form = el("form", "sp-team-form");
    const eingabe = el("input");
    eingabe.type = "text"; eingabe.inputMode = "numeric"; eingabe.placeholder = "GSRA-ID, z. B. 100002"; eingabe.maxLength = 12;
    eingabe.setAttribute("aria-label", "GSRA-ID des Mitglieds");
    const rolle = el("select");
    for (const [w, t] of [["bearbeiten", "Darf bearbeiten"], ["ansehen", "Darf ansehen"]]) { const o = el("option", "", t); o.value = w; rolle.append(o); }
    const knopf = el("button", "sp-btn primaer", "Einladen");
    knopf.type = "submit";
    form.append(eingabe, rolle, knopf);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = Number(eingabe.value.replace(/\D/g, ""));
      if (!id) return toast("Bitte gib eine GSRA-ID ein.", "error");
      knopf.disabled = true;
      const { data, error } = await sb().rpc("stint_plan_member_add", { _plan: konto.planId, _gsra_id: id, _role: rolle.value });
      knopf.disabled = false;
      if (error) return toast(error.message || "Einladen fehlgeschlagen.", "error");
      toast(`${data} ist jetzt im Team.`, "success");
      eingabe.value = "";
      void laden();
    });
    fenster.insertBefore(form, liste);
  } else {
    const raus = el("button", "sp-btn gefahr", "Plan verlassen");
    raus.type = "button";
    raus.addEventListener("click", async () => {
      const { error } = await sb().rpc("stint_plan_member_remove", { _plan: konto.planId, _user: konto.ich });
      if (error) return toast("Austreten fehlgeschlagen.", "error");
      schliessen();
      toast("Du hast den Plan verlassen.", "success");
      await listeLaden();
      if (konto.plaene[0]) await planOeffnen(konto.plaene[0].id); else await neuerPlan();
    });
    fenster.append(raus);
  }
  await laden();
}

// ---------- Aktualisieren, Teilen, Laden ----------
let timer: number | undefined;
function aktualisieren() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const p = planAusFormular();
    zeigen(p);
    try { localStorage.setItem(SPEICHER, JSON.stringify(p)); } catch { /* ohne Speicher */ }
    speichernBald();
  }, 120);
}

function teilen() {
  if (konto.planId) {
    const link = `${location.origin}${location.pathname}?plan=${konto.planId}`;
    navigator.clipboard?.writeText(link).then(
      () => toast("Link kopiert – öffnen können ihn alle Mitglieder des Plan-Teams.", "success"),
      () => toast("Kopieren nicht möglich – bitte den Link aus der Adresszeile nehmen.", "info"));
    return;
  }
  const p = planAusFormular();
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  const daten = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const link = `${location.origin}${location.pathname}#plan=${daten}`;
  navigator.clipboard?.writeText(link).then(
    () => toast("Link zum Plan kopiert – im Team-Chat einfügen.", "success"),
    () => toast("Kopieren nicht möglich – bitte den Link aus der Adresszeile nehmen.", "info"));
  history.replaceState(null, "", `#plan=${daten}`);
}

function planAusLinkOderGeraet(): Plan | null {
  const m = /#plan=([\w-]{1,8000})$/.exec(location.hash);
  if (m) {
    try {
      const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
      const t = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
      return pruefen(JSON.parse(t));
    } catch { /* ungültiger Link */ }
  }
  return null;
}
function planVomGeraet(): Plan {
  try {
    const gespeichert = localStorage.getItem(SPEICHER);
    if (gespeichert) return pruefen(JSON.parse(gespeichert));
  } catch { /* egal */ }
  return { ...STANDARD };
}

// ---------- Verbrauch messen ----------
function messenEinrichten() {
  const wert = (id: string) => Number((document.getElementById(id) as HTMLInputElement | null)?.value.replace(",", ".") || "");
  const ergebnis = document.getElementById("spMessErgebnis");
  const rechne = () => {
    const vorher = wert("spMessVorher"), nachher = wert("spMessNachher"), runden = wert("spMessRunden");
    if (!(vorher > nachher) || !(runden >= 1)) { if (ergebnis) ergebnis.textContent = ""; return null; }
    const proRunde = (vorher - nachher) / runden;
    if (ergebnis) ergebnis.textContent = `Durchschnitt: ${komma(proRunde, 2)} l pro Runde.`;
    return proRunde;
  };
  ["spMessVorher", "spMessNachher", "spMessRunden"].forEach((id) => document.getElementById(id)?.addEventListener("input", (e) => { e.stopPropagation(); rechne(); }));
  document.getElementById("spMessUebernehmen")?.addEventListener("click", () => {
    const v = rechne();
    if (v == null) return toast("Bitte Sprit vorher, nachher und die Rundenzahl eintragen.", "error");
    const f = feld("verbrauch");
    if (f) f.value = komma(v, 2);
    aktualisieren();
    toast("Verbrauch übernommen.", "success");
  });
}

// ---------- Zugang: Teil von Pole und Alliance ----------
// Gespeicherte Pläne prüft die Datenbank selbst (SQL 045); diese Prüfung entscheidet nur über die Anzeige.
type Zugang = "frei" | "gast" | "gesperrt" | "fehler";

async function zugangPruefen(): Promise<Zugang> {
  const client = sb();
  if (!client) return "fehler";
  try {
    const { data } = await client.auth.getSession();
    const user = data?.session?.user;
    if (!user) return "gast";
    konto.ich = user.id;
    const [plan, profil] = await Promise.all([
      client.rpc("plan_of", { _user: user.id }),
      client.from("profiles").select("role").eq("id", user.id).maybeSingle(),
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
  karte.append(icon(art === "fehler" ? "fa-triangle-exclamation" : "fa-lock"));
  if (art === "fehler") {
    karte.append(el("h2", "", "Der Zugang konnte nicht geprüft werden"),
      el("p", "", "Bitte lade die Seite neu. Bleibt die Meldung, versuche es in ein paar Minuten noch einmal."));
    const neu = el("button", "sp-btn primaer", "Neu laden");
    neu.type = "button";
    neu.addEventListener("click", () => location.reload());
    karte.append(neu);
  } else {
    karte.append(el("h2", "", "Der Stint-Planer ist Teil von Pole und Alliance"),
      el("p", "", "Plane Kraftstoff, Stints, Reifen- und Fahrerwechsel für Langstreckenrennen – gemeinsam mit deinem Team, live abgeglichen, mit Empfehlungen und dem Live-Stand im Rennen. Mit Pole oder Alliance ist der Planer für dich freigeschaltet."));
    const liste = el("ul", "sp-sperre-liste");
    for (const punkt of ["Pläne im Konto speichern und mit dem Team live bearbeiten", "Rennen nach Zeit oder Runden, bis zu 8 Fahrer",
      "Live-Stand im Rennen: Sprit, nächster Stopp, wer gerade fährt", "Empfehlungen wie Spar-Ziel und Splash-and-Dash"]) {
      liste.append(el("li", "", punkt));
    }
    const abo = el("a", "sp-btn primaer", "Abos ansehen");
    abo.href = "abo.html";
    karte.append(liste, abo);
  }
  ziel.append(karte);
}

async function kontoStarten() {
  const leiste = document.getElementById("spPlanLeiste");
  if (!(await listeLaden())) {
    // SQL 045 fehlt: weiter wie bisher nur auf diesem Gerät
    formularFuellen(planAusLinkOderGeraet() ?? planVomGeraet());
    return;
  }
  konto.aktiv = true;
  if (leiste) leiste.hidden = false;
  document.getElementById("spPlanWahl")?.addEventListener("change", (e) => {
    const id = (e.target as HTMLSelectElement).value;
    if (id) void planOeffnen(id);
  });
  document.getElementById("spPlanName")?.addEventListener("change", () => void speichern());
  document.getElementById("spPlanNeu")?.addEventListener("click", () => void neuerPlan());
  document.getElementById("spPlanLoeschen")?.addEventListener("click", () => void planLoeschen());
  document.getElementById("spTeamKnopf")?.addEventListener("click", () => void teamFenster());

  const ausLink = planAusLinkOderGeraet();
  const wunsch = new URLSearchParams(location.search).get("plan");
  if (ausLink) {
    konto.name = "Plan aus geteiltem Link";
    formularFuellen(ausLink);
    leisteAktualisieren();
    status("Aus einem Link geöffnet – wird beim ersten Ändern als neuer Plan gespeichert");
  } else if (wunsch && /^[0-9a-f-]{36}$/.test(wunsch) && await planOeffnen(wunsch)) {
    /* geöffnet */
  } else if (konto.plaene[0]) {
    await planOeffnen(konto.plaene[0].id);
  } else {
    konto.name = "Mein erster Stintplan";
    formularFuellen(planVomGeraet());
    leisteAktualisieren();
    status("Noch nicht gespeichert – sobald du etwas änderst, liegt der Plan in deinem Konto");
  }
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
  await kontoStarten();
  form.addEventListener("input", aktualisieren);
  form.addEventListener("change", aktualisieren);
  form.addEventListener("submit", (e) => e.preventDefault());
  document.getElementById("spFahrerNeu")?.addEventListener("click", () => {
    const liste = document.getElementById("spFahrer") as HTMLElement;
    if (liste.children.length >= 8) return;
    fahrerZeile({ name: `Fahrer ${liste.children.length + 1}`, rundenzeit: null }, liste);
    aktualisieren();
  });
  // Live-Stand: Zeitpunkt der Eingabe merken (für „eingetragen um …“)
  ["liveZeit", "liveRunde", "liveSprit", "liveAktiv"].forEach((n) => feld(n)?.addEventListener("input", () => {
    if (zuletzt) zuletzt.live.stand = new Date().toISOString();
  }));
  document.getElementById("spTeilen")?.addEventListener("click", teilen);
  document.getElementById("spZurueck")?.addEventListener("click", () => {
    formularFuellen({ ...STANDARD });
    history.replaceState(null, "", konto.planId ? `${location.pathname}?plan=${konto.planId}` : location.pathname);
    aktualisieren();
  });
  messenEinrichten();
  zeigen(planAusFormular());
  // Die Uhr „Jetzt laut Plan“ jede halbe Minute auffrischen
  window.setInterval(() => { if (zuletzt && zuletzt.start) zeigen(zuletzt); }, 30000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void starten());
else void starten();
