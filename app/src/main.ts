// GSRA-App – Oberfläche: Live, Runden, Vergleich, Sprit & Stint.
// Daten kommen aus der Simulation (Rust, Ereignisse „gsra://…“) oder aus der Demo. Alle Texte per textContent.

import { Rundenzaehler, type Runde } from "./runden.ts";
import { abtasten, kurvenFinden, kurvenName, meterText, sekunden, vergleichen, zahl, zeitBei, RASTER, type Befund, type Spur } from "./analyse.ts";
import { bisZiel, rundenzeitSchnitt, verbrauchProRunde } from "./sprit.ts";
import { DemoQuelle } from "./demo.ts";
import { Diagramme, verlaufZeichnen, type Plot } from "./diagramm.ts";
import type { Feld, Probe, Sitzung, Status } from "./typen.ts";
import { angemeldet, beiKontoWechsel, hinweis, kontoStarten } from "./konto-ansicht.ts";
import { aufnahmeAbspielen, beiFehlenderStimme, funkBeschaeftigt, funkLaden, funkSpeichern, piepen, sprechen, spotterSprechen, stimmenFuer, systemTonSetzen } from "./funk.ts";
import { absicht, ansage, mitPunkt, nichtVerstanden, nochDran, zahlIn } from "./ansagen.ts";
import { spracheName, spracheVonText } from "./sprachen.ts";
import { gedaechtnisVerdichten, kiFragen, kiVerfuegbar, merkenSpeichern, persoenlichkeitLaden, type Persoenlichkeit } from "./ki.ts";
import { messwerteKodieren } from "../../src/stint-messwerte.ts";
import { bremspunkte, sparAuswerten, sparBasis, sparText, sparTipp, type Bremspunkt, type SparAuswertung, type SparBasis } from "./sparen.ts";
import { Chat, pruefSatz, pruefSaetze } from "./chat.ts";
import { Spotter, spotterSatz } from "./spotter.ts";
import { abstandSatz, type Gegner } from "./vorlagen.ts";
import { Feldrunden, deltaZu, verlustIn, type FeldRunde } from "./feldreferenz.ts";
import { CrashWaechter, crashSatz, Fahrverhalten, schadenBild, type Einschlag } from "./crash.ts";
import { bremsStellen, bremsStellenAusReferenz, Mitfahrer, mitfahrBefehl } from "./mitfahren.ts";
import { referenzAnsicht } from "./referenz-ansicht.ts";
import { fahrerSatz, NachbarWaechter, StrafenWaechter, strafeAus, strafeSatz, werMitInfo, type Strafe } from "./fahrer-info.ts";
import { eigeneRundeTeilen, feldRundeTeilen, referenzenLaden, referenzLoeschen, type Referenz, type SitzungsInfo } from "./referenz.ts";
import { namenErsetzen } from "./datenschutz.ts";
import { karteBauen, karteZeichnen, verlustJeAbschnitt, type Karte } from "./strecke.ts";
import { Rennbeobachter, berichtErstellen, rundenzeitText, stelleText } from "./rennbericht.ts";
import { startbildZeigen } from "./startbild.ts";
import { istRennen, liveNachbarn, livePlatz } from "./feld-live.ts";
import { webAktiv, webEinrichten, webSuche, webVerbergen, webZeigen } from "./webbereich.ts";
import { sprechtasteEinrichten } from "./sprechtaste.ts";
import { messengerHinweis } from "./konto.ts";
import { reEinstellungenEinrichten } from "./re-einstellungen.ts";
import { fensterEinrichten, profilbildZeigen, sichtbarkeitStarten } from "./kopf.ts";
import { aktualisierungEinrichten } from "./aktualisierung.ts";
import { eigeneStimmeEinrichten } from "./eigene-stimme.ts";
import { ablegen, alleRunden, alsRunde, rundenDerStrecke, streckeLoeschen, streckenKarten, type ArchivRunde, type StreckenKarte } from "./rundenarchiv.ts";

startbildZeigen();

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
};
const neu = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text?: string) => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text != null) e.textContent = text;
  return e;
};

export const zeitText = (s: number | null | undefined) => {
  if (s == null || !Number.isFinite(s) || s <= 0) return "–";
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(3).padStart(6, "0").replace(".", ",")}`;
};
const liter = (l: number | null | undefined, stellen = 1) => (l == null || !Number.isFinite(l) ? "–" : `${zahl(l, stellen)} l`);

// ---------------------------------------------------------------- Zustand
const zaehler = new Rundenzaehler();
let sitzung: Sitzung | null = null;
let status: Status | null = null;
const istApp = "__TAURI_INTERNALS__" in window;
const verlauf = { tempo: [] as number[], gas: [] as number[], bremse: [] as number[] };
let groessterMeter = 0;
// Streckenkarte (entsteht aus der ersten gültigen Runde) und Farben der letzten Runde gegen die Bestzeit
let karte: Karte | null = null;
let letzterVerlust: Float64Array | null = null;
let kurvenMarken: { i: number; text: string }[] = [];
let spiegeln = (() => { try { return localStorage.getItem("gsra_karte_spiegeln") === "1"; } catch { return false; } })();

// Rennbericht: Plätze und Zweikämpfe aus dem Stand aller Autos
const beobachter = new Rennbeobachter();
/** Aktueller Platz: im Rennen live aus der gefahrenen Strecke, sonst der offizielle */
function platzJetzt(): number | null {
  if (istRennen(sitzung?.sitzungsart ?? (demo.laeuft ? "Rennen" : null))) {
    const p = livePlatz(letztesFeld);
    if (p != null) return p;
  }
  return beobachter.platz;
}
const typischeRundenzeit = () => rundenzeitSchnitt(zaehler.runden) ?? zaehler.beste?.zeit ?? 90;
// Spotter: „Auto links/rechts“ sofort und ohne KI (Wunsch 25.11.)
let letzteSeite: number | null = null;
const spotter = new Spotter((s) => {
  const sprache = ansageSprache();
  spotterSprechen(spotterSatz(s, sprache), funkE, sprache);
});

// Sprache der festen Ansagen (Wunsch 26.11.: alle Sprachen, nicht nur Deutsch): die eingestellte Sprache, bei
// „Automatisch“ die Sprache der letzten Frage (sonst Deutsch)
let frageSprache: string | null = null;
function ansageSprache(frage?: string): string {
  const s = persoenlichkeit?.sprache ?? "auto"; // ohne Anmeldung: Sprache der Frage
  if (s !== "auto") return s;
  const erkannt = frage ? spracheVonText(frage) : null;
  if (erkannt) frageSprache = erkannt;
  return frageSprache ?? "de";
}
/** Rundenzeit in der Schreibweise der Sprache (1:27,120 bzw. 1:27.120) */
const zeitIn = (code: string, s: number | null | undefined) => (mitPunkt(code) ? zeitText(s).replace(",", ".") : zeitText(s));

let letztesFeld: Feld | null = null;
// Referenz aus der Lobby: schnellste geprüfte Runde eines anderen Fahrers; die schnellste mit demselben Auto wird
// anonym als GSRA-Referenzrunde geteilt (SQL 060; abschaltbar unter Renningenieur › Funk & Stimme)
const feldRef = new Feldrunden();
let referenzen: Referenz[] = [];
let referenzFuer = "";
const geteilt = new Set<string>();
const geteilteRunden = new WeakMap<object, string>(); // eigene Runden, die geteilt wurden (Knopf zeigt „zurücknehmen“)
const feldTeilenAn = () => { try { return localStorage.getItem("gsra-feld-teilen") !== "0"; } catch { return true; } };
const sitzungsInfo = (): SitzungsInfo => ({ strecke: sitzung?.strecke ?? null, fahrzeug: sitzung?.fahrzeug ?? null, laengeM: laenge() });
/** GSRA-Referenzrunden für Strecke und Auto laden (angemeldet, echte Sitzung) */
async function referenzenAktualisieren(erzwingen = false) {
  const schluessel = `${sitzung?.strecke ?? ""}|${sitzung?.fahrzeug ?? ""}|${angemeldet()}`;
  if (!erzwingen && schluessel === referenzFuer) return;
  referenzFuer = schluessel;
  referenzen = angemeldet() && !demo.laeuft ? await referenzenLaden(sitzungsInfo()).catch(() => []) : [];
}
function feldRundeMelden(f: Feld) {
  const s = schnellsteGleichesAuto();
  const auto = s ? (sitzung?.fahrer ?? []).find((x) => x.idx === s.idx)?.fahrzeug : null;
  if (!s || !istApp || demo.laeuft || !angemeldet() || !feldTeilenAn() || s.idx === f.ich) return;
  if (!sitzung?.strecke || !sitzung.fahrzeug || !auto || auto !== sitzung.fahrzeug) return; // nur sicher gleiches Auto
  const kennung = `${sitzung.strecke}|${auto}|${s.zeit.toFixed(3)}`;
  if (geteilt.has(kennung)) return;
  geteilt.add(kennung);
  void feldRundeTeilen(sitzungsInfo(), s).then(() => referenzenAktualisieren(true), () => { /* später erneut */ geteilt.delete(kennung); });
}
let feldRefBekannt = 0;
function feldAufnehmen(f: Feld) {
  if (!f || !Array.isArray(f.anteil)) return;
  letztesFeld = f;
  beobachter.aufnehmen(f, typischeRundenzeit());
  feldRef.laengeSetzen(laenge());
  feldRef.aufnehmen(f);
  feldRundeMelden(f);
  neueNachbarnMelden(f);
  // neue Referenzrunde? Dann den Vergleich auffrischen
  const s = feldRef.schnellste();
  const kennung = s ? s.idx * 1e6 + Math.round(s.zeit * 1000) : 0;
  if (kennung !== feldRefBekannt) {
    feldRefBekannt = kennung;
    if (aktiverReiter === "vergleich") feldRefZeigen();
  }
}

/** Neuer Vorder- oder Hintermann im Rennen: Name mit iRating, Lizenz und X ansagen (Wunsch 28.11.) */
const nachbarWaechter = new NachbarWaechter();
function neueNachbarnMelden(f: Feld) {
  if (f.zeit == null || !istRennen(sitzung?.sitzungsart ?? (demo.laeuft ? "Rennen" : null))) return;
  const n = nachbarn();
  const kurz = (x: Nachbar) => (x ? { idx: x.idx, abstand: x.abstand_s } : null);
  for (const seite of nachbarWaechter.pruefen(f.zeit, { vor: kurz(n.vor), hinter: kurz(n.hinter) })) {
    const x = n[seite];
    if (!x) continue;
    const code = ansageSprache();
    const wer = werMitInfo(x.name, x.nummer, x);
    chat?.melden([fahrerSatz(code, seite === "vor" ? "neuVor" : "neuHinter", wer), strafeSatz(code, x.strafe, `#${x.nummer || x.idx}`)].filter(Boolean).join(" "));
  }
}
/** „Fahr eine Runde mit mir“: Piepton an den Bremspunkten (mitfahren.ts). Referenz: schnellste GSRA-Referenzrunde mit
 *  Pedalen, wenn sie schneller ist als deine Bestzeit – sonst deine Bestzeit */
let mitfahrer: Mitfahrer | null = null;
function mitfahrenUmschalten(an = !mitfahrer): string {
  const en = ansageSprache() !== "de";
  const knopf = $("lMitfahren");
  const info = $("lMitfahrenText");
  if (!an) {
    mitfahrer = null;
    knopf.setAttribute("aria-pressed", "false");
    knopf.textContent = "Fahr eine Runde mit mir";
    info.textContent = "";
    return en ? "Okay, no more beeps." : "Alles klar, kein Piepen mehr.";
  }
  const L = laenge();
  const eigene = zaehler.beste && zaehler.beste.punkte.length > 10 ? zaehler.beste : null;
  const ref = referenzen.find((r) => r.bremse);
  let stellen: number[] = [];
  let quelle = "";
  if (L && ref?.bremse && (!eigene || ref.zeit < eigene.zeit)) {
    stellen = bremsStellenAusReferenz(ref.bremse, L);
    quelle = `${en ? "the GSRA reference lap" : "der GSRA-Referenzrunde"} ${zeitText(ref.zeit)}`;
  } else if (L && eigene) {
    stellen = bremsStellen(eigene.punkte.map((x) => x.a), eigene.punkte.map((x) => x.b), L);
    quelle = `${en ? "your best lap" : "deiner Bestzeit"} ${zeitText(eigene.zeit)}`;
  }
  if (!L || !stellen.length) return en ? "Do one clean lap first – then I can beep at the braking points." : "Fahr erst eine saubere Runde – dann piepe ich dir an den Bremspunkten.";
  mitfahrer = new Mitfahrer(stellen, L);
  knopf.setAttribute("aria-pressed", "true");
  knopf.textContent = "Piepton aus";
  info.textContent = `${stellen.length} Bremspunkte · ${quelle}`;
  return en ? `Got it – I will beep at ${stellen.length} braking points from ${quelle}.` : `Alles klar – ich piepe an ${stellen.length} Bremspunkten aus ${quelle}.`;
}

/** Eigene Strafe, Verwarnung oder Fleischball sofort ansagen */
const strafenWaechter = new StrafenWaechter();

const demo = new DemoQuelle((liste) => proben(liste), (f) => feldAufnehmen(f));
// Messenger: der Messenger der Webseite (1:1, Wunsch 27.11.) – in der App nur der rote Punkt für neue Nachrichten

const laenge = () => sitzung?.streckenlaengeM ?? (groessterMeter > 500 ? groessterMeter : null);

// ---------------------------------------------------------------- Reiter
let aktiverReiter = "live";
/** Seitenleiste: markiert den gewählten Bereich und blendet die passende Seite ein */
function navMarkieren(knopf: HTMLElement | null, seite: string) {
  for (const b of document.querySelectorAll<HTMLButtonElement>(".navi button")) {
    if (b === knopf) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  for (const s of document.querySelectorAll<HTMLElement>("[data-seite]")) s.classList.toggle("aktiv", s.dataset.seite === seite);
  $("seitenTitel").textContent = knopf?.querySelector("span")?.textContent ?? "";
  $("sitzungText").hidden = seite === "web";
}
function reiterZeigen(name: string) {
  aktiverReiter = name;
  webVerbergen();
  navMarkieren(document.querySelector<HTMLElement>(`[data-reiter="${name}"]`), name);
  if (name === "vergleich") {
    void streckenZeigen();
    vergleichZeigen();
  }
  if (name === "sprit") spritZeigen();
  if (name === "runden") rundenZeigen();
  if (name === "bericht") berichtZeigen();
  if (name === "live") live();
  // Spracherkennung schon laden, wenn der Renningenieur geöffnet wird – dann geht die erste Frage ohne Ladezeit
  if (name === "chat") void sprechtaste.then((s) => s?.vorbereiten());
}
/** Eine GSRA-Seite (Messenger, Setups …) direkt in der App */
function webBereichZeigen(seite: string, anker?: string) {
  const knopf = document.querySelector<HTMLElement>(`[data-web="${CSS.escape(seite)}"], [data-webseite="${CSS.escape(seite)}"]`);
  if (!knopf) return;
  aktiverReiter = "web";
  navMarkieren(knopf, "web");
  void webZeigen(seite, knopf.querySelector("span")?.textContent ?? "GSRA", anker);
}
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-reiter]")) b.addEventListener("click", () => {
  reiterZeigen(b.dataset.reiter ?? "live");
  // Unterpunkt (z. B. „Renningenieur einstellen“): markieren und hinscrollen
  if (b.dataset.anker) {
    navMarkieren(b, b.dataset.reiter ?? "live");
    document.getElementById(b.dataset.anker)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
$("lDemo").addEventListener("click", () => $("demoKnopf").click());
// Verweise wie „im Renningenieur einstellen“: Bereich öffnen und zur Karte scrollen
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-gehe]")) b.addEventListener("click", () => {
  reiterZeigen("chat");
  document.getElementById(b.dataset.gehe ?? "")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-web]")) b.addEventListener("click", () => webBereichZeigen(b.dataset.web ?? "index.html"));

// ---------------------------------------------------------------- Verbindung / Status
/** Welche Simulation läuft (nur Programmname, simulation.rs) – alle 5 s, solange keine Verbindung besteht */
let simulation: { name: string; live: boolean } | null = null;
async function simulationPruefen() {
  if (!istApp || status?.verbunden || demo.laeuft) return;
  const { invoke } = await import("@tauri-apps/api/core");
  const neu = await invoke<{ name: string; live: boolean } | null>("simulation_erkennen").catch(() => null);
  if (neu?.name !== simulation?.name) {
    simulation = neu;
    statusZeigen();
  }
}
setInterval(() => void simulationPruefen(), 5_000);
void simulationPruefen();

function statusZeigen() {
  const led = $("led");
  const text = $("statusText");
  const knopf = $<HTMLButtonElement>("demoKnopf");
  const raffer = $<HTMLSelectElement>("zeitraffer");
  knopf.textContent = demo.laeuft ? "Demo beenden" : "Demo starten";
  raffer.hidden = !demo.laeuft;
  if (demo.laeuft) {
    led.className = "led demo";
    text.textContent = "Demo läuft";
  } else if (status?.verbunden) {
    led.className = "led an";
    text.textContent = "Verbunden mit iRacing";
  } else if (istApp) {
    led.className = "led warten";
    // Läuft eine andere Simulation, sagen wir das ehrlich (Live-Werte gibt es vorerst für iRacing)
    text.textContent = simulation && !simulation.live
      ? `${simulation.name} erkannt – Live-Werte dafür kommen bald`
      : simulation?.live ? `${simulation.name} erkannt – verbinde …` : status?.meldung ?? "Warte auf eine Simulation …";
  } else {
    led.className = "led aus";
    text.textContent = "Browser-Vorschau";
  }
  // Ohne Simulation und ohne Demo: Startkarte statt lauter Striche
  const leer = !demo.laeuft && !status?.verbunden && !zaehler.runden.length;
  $("lWarten").hidden = !leer;
  document.querySelector<HTMLElement>('[data-seite="live"]')?.classList.toggle("wartet", leer);
  const s = sitzung;
  $("sitzungText").textContent = s ? [s.strecke, s.streckenlaengeM ? meterText(s.streckenlaengeM) : null, s.fahrzeug, s.sitzungsart].filter(Boolean).join(" · ") : "";
}

function allesZuruecksetzen() {
  zaehler.zuruecksetzen();
  verlauf.tempo.length = verlauf.gas.length = verlauf.bremse.length = 0;
  groessterMeter = 0;
  karte = null;
  letzterVerlust = null;
  kurvenMarken = [];
  beobachter.zuruecksetzen();
  spurCache = new WeakMap();
  $("lFunkText").textContent = "Fahr eine Runde – danach sage ich dir, wo du Zeit liegen lässt.";
  funkNr++; // eine noch laufende KI-Antwort gehört zur alten Sitzung
  $("lFunkQuelle").textContent = "Kurz gesagt";
  $("lFunkQuelle").className = "";
  $("bKiText").hidden = true;
  $("bKiStatus").textContent = "";
  letztesFeld = null;
  letzterBefund = null;
  letzteAbstaende = new Map();
  letzteSeite = null;
  spotter.zuruecksetzen();
  feldRef.zuruecksetzen();
  feldRefBekannt = 0;
  if (spar.aktiv) sparBeenden();
  spar.runden = [];
  sparZeigen();
  phaseSetzen("rennen");
  chat?.leeren();
  rundenZeigen();
  live();
}

$("demoKnopf").addEventListener("click", () => {
  if (demo.laeuft) {
    demo.stop();
    void nachbesprechung(true); // Sitzung vorbei → Nachbesprechung kommt von selbst
  } else {
    allesZuruecksetzen();
    sitzung = demo.fahrt.sitzung();
    demo.start();
  }
  statusZeigen();
});
$<HTMLSelectElement>("zeitraffer").addEventListener("change", (e) => {
  const v = Number((e.target as HTMLSelectElement).value);
  demo.faktor = [1, 4, 12].includes(v) ? v : 1;
});

async function appVerbinden() {
  const { listen } = await import("@tauri-apps/api/event");
  const { invoke } = await import("@tauri-apps/api/core");
  await listen<Probe[]>("gsra://proben", (e) => {
    if (!demo.laeuft && Array.isArray(e.payload)) proben(e.payload);
  });
  await listen<Sitzung>("gsra://sitzung", (e) => {
    if (!demo.laeuft) {
      sitzung = e.payload;
      statusZeigen();
    }
  });
  await listen<Status>("gsra://status", (e) => statusSetzen(e.payload));
  await listen<Feld>("gsra://feld", (e) => {
    if (!demo.laeuft) feldAufnehmen(e.payload);
  });
  statusSetzen(await invoke<Status>("status"));
}

function statusSetzen(s: Status) {
  const vorher = status?.verbunden;
  status = s;
  if (s.verbunden && !vorher) {
    // Simulation erkannt: Demo beenden, neu anfangen
    if (demo.laeuft) demo.stop();
    allesZuruecksetzen();
  } else if (vorher && !s.verbunden && !demo.laeuft) {
    // Simulation beendet (Sitzung verlassen) → Nachbesprechung kommt von selbst
    void nachbesprechung(true);
  }
  if (!demo.laeuft && s.sitzung) {
    if (sitzung && (sitzung.strecke !== s.sitzung.strecke || sitzung.fahrzeug !== s.sitzung.fahrzeug || sitzung.sitzungsart !== s.sitzung.sitzungsart)) fahrverhalten.zuruecksetzen();
    sitzung = s.sitzung;
    void referenzenAktualisieren();
  }
  statusZeigen();
}

// ---------------------------------------------------------------- Messpunkte
let geplant = false;
function proben(liste: Probe[]) {
  for (const p of liste) {
    if (p.seite != null) {
      letzteSeite = p.seite;
      spotter.aufnehmen(p.seite, p.zeit);
    }
    const einschlag = demo.laeuft ? null : crashWaechter.aufnehmen(p);
    if (einschlag) {
      fahrverhalten.einschlag();
      nachEinschlag(einschlag);
    }
    if (!demo.laeuft) fahrverhalten.aufnehmen(p);
    if (mitfahrer && p.anteil != null && mitfahrer.aufnehmen(p.anteil, p.tempo ?? 0)) piepen(funkE);
    const strafe = demo.laeuft ? null : strafenWaechter.pruefen(p.flaggen);
    if (strafe) chat?.melden(fahrerSatz(ansageSprache(), strafe === "strafe" ? "duStrafe" : strafe === "verwarnung" ? "duVerwarnung" : "duReparatur"));
    const r = zaehler.aufnehmen(p);
    if (p.meter != null && p.meter > groessterMeter && p.meter < 100_000) groessterMeter = p.meter;
    verlauf.tempo.push(p.tempo ?? 0);
    verlauf.gas.push(p.gas ?? 0);
    verlauf.bremse.push(p.bremse ?? 0);
    if (r) rundeFertig(r);
  }
  for (const w of [verlauf.tempo, verlauf.gas, verlauf.bremse]) if (w.length > 600) w.splice(0, w.length - 600);
  if (!geplant) {
    geplant = true;
    requestAnimationFrame(() => {
      geplant = false;
      live();
    });
  }
}

/** Nach einem Einschlag fragt der Renningenieur nach (fertiger Satz, keine KI-Kosten) – kurz warten, bis das Auto steht
 *  oder weiterfährt; höchstens einmal pro Minute */
const crashWaechter = new CrashWaechter();
const fahrverhalten = new Fahrverhalten(); // Schaden aus dem Fahrverhalten (schiefe Lenkung, Topspeed) und eigene Ausflug-Zählung
let crashGefragt = -Infinity;
function nachEinschlag(e: Einschlag) {
  if (e.zeit - crashGefragt < 60 && e.zeit >= crashGefragt) return;
  crashGefragt = e.zeit;
  window.setTimeout(() => chat?.melden(crashSatz(ansageSprache())), 2200);
}

/** Rundenmeldung in anderen Sprachen als Deutsch: kurz, ohne die (deutsche) Kurvenanalyse – die formuliert
 *  angemeldet die KI in der richtigen Sprache */
function rundenSatz(code: string, r: Runde, beste: Runde | null, gegner: { vor: Gegner | null; hinter: Gegner | null }): string {
  const teile = [
    !r.gueltig ? ansage(code, "rundeUngueltig", { nr: r.nr })
      : beste === r ? ansage(code, "neueBestzeit", { zeit: zeitIn(code, r.zeit) })
      : beste ? ansage(code, "hinterBest", { zeit: zeitIn(code, r.zeit), d: zahlIn(code, r.zeit - beste.zeit, 3) })
      : ansage(code, "runde", { nr: r.nr, zeit: zeitIn(code, r.zeit) }),
  ];
  const wer = (g: Gegner) => `${g.nummer ? `#${g.nummer} ` : ""}${g.name}`;
  if (gegner.vor && gegner.vor.abstand <= 3) teile.push(ansage(code, "vor", { wer: wer(gegner.vor), s: zahlIn(code, gegner.vor.abstand) }));
  if (gegner.hinter && gegner.hinter.abstand <= 1.5 && (gegner.hinter.trend == null || gegner.hinter.trend <= 0.05)) {
    teile.push(ansage(code, "hinter", { wer: wer(gegner.hinter), s: zahlIn(code, gegner.hinter.abstand) }));
  }
  return teile.join(" ");
}

function rundeFertig(r: Runde) {
  $("rundenAnzahl").textContent = String(zaehler.runden.length);
  const beste = zaehler.beste;
  let text: string;
  let befund: Befund | undefined;
  if (!r.gueltig) text = `Runde ${r.nr} zählt nicht (${r.grund ?? "ungültig"}).`;
  else if (beste === r) {
    const zweite = zaehler.runden.filter((x) => x.gueltig && x !== r).reduce<Runde | null>((b, x) => (!b || x.zeit < b.zeit ? x : b), null);
    text = `Neue Bestzeit: ${zeitText(r.zeit)}${zweite ? ` – ${zahl(zweite.zeit - r.zeit, 3)} s schneller als vorher` : ""}. Stark!`;
  } else if (beste) {
    const v = vergleichen(spur(beste), spur(r), laenge() ?? 4000);
    letzterVerlust = verlustJeAbschnitt(v.delta);
    const b = v.befunde[0];
    befund = b;
    text = `${zeitText(r.zeit)} – ${zahl(r.zeit - beste.zeit, 3)} s hinter deiner Bestzeit.`;
    if (b) {
      const ursache = b.ursachen[0] ? `${b.ursachen[0].charAt(0).toUpperCase()}${b.ursachen[0].slice(1)}. ` : "";
      text += ` Die meiste Zeit liegt in ${kurvenName(b.kurve, laenge() ?? 4000)} (${sekunden(b.verlust)}). ${ursache}${b.tipp}`;
    }
  } else text = `Runde ${r.nr}: ${zeitText(r.zeit)}.`;
  if (befund) letzterBefund = befund;
  else if (beste === r) letzterBefund = null;
  const sparSatz = sparRunde(r);
  // Abstände nach vorn/hinten mit Tendenz – als Vorlage, ohne KI (Thema „Abstände“)
  const gegner = gegnerMitTrend();
  const code = ansageSprache();
  // Gegen den Schnellsten im Feld (Wunsch 27.11.: eigene Runden gegeneinander bringen wenig, der Schnellste zeigt, wo
  // die echte Zeit liegt)
  const g = r.gueltig ? gegenSchnellsten() : null;
  const top = g?.verluste[0];
  const schnellster = g && g.rueckstand > 0.05
    ? `Auf den Schnellsten (${g.name.split(/\s+/).at(-1)}, ${zeitText(g.zeit)}) fehlen dir ${zahl(g.rueckstand, 2)} s${top && top.verlust > 0.02 ? ` – am meisten in Kurve ${top.kurve} (${zahl(top.verlust, 2)} s)` : ""}.`
    : null;
  const vorlage = code === "de"
    ? [sparSatz ?? text, schnellster, abstandSatz(persoenlichkeit?.art ?? "kumpel", gegner.vor, gegner.hinter)].filter(Boolean).join(" ")
    : rundenSatz(code, r, beste, gegner);
  funkMelden(vorlage, { ...rundenLage(r, befund), vor_mir: gegner.vor, hinter_mir: gegner.hinter });
  // Karte aus der ersten gültigen Runde mit Fahrtrichtung; Kurvennummern aus der Bestzeit
  if (!karte && r.gueltig) karte = karteBauen(r.punkte);
  if (beste && beste.punkte.length > 10) kurvenMarken = kurvenFinden(spur(beste), laenge() ?? 4000).map((k) => ({ i: k.scheitel, text: String(k.nr) }));
  if (beste === r) letzterVerlust = null;
  // Rundenarchiv: jede Runde mit Messpunkten auf diesem PC ablegen (Strecken-Kärtchen im Vergleich)
  void ablegen(r, {
    strecke: sitzung?.strecke ?? (demo.laeuft ? "Demo-Strecke" : null), fahrzeug: sitzung?.fahrzeug ?? (demo.laeuft ? "Demo-Auto" : null),
    laengeM: laenge(), sitzung: sitzung?.sitzungsart ?? (demo.laeuft ? "Demo" : null),
  }).then((ok) => { if (ok && aktiverReiter === "vergleich") void streckenZeigen(); }, () => { /* ohne Archiv weiter */ });
  if (aktiverReiter === "runden") rundenZeigen();
  if (aktiverReiter === "vergleich") vergleichZeigen();
  if (aktiverReiter === "sprit") spritZeigen();
  if (aktiverReiter === "bericht") berichtZeigen();
}

// ---------------------------------------------------------------- Funk und KI-Renningenieur
let funkE = funkLaden();
let persoenlichkeit: Persoenlichkeit | null = null;
let funkNr = 0;

const runden3 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);

/** Datenschutz-Schalter „Fahrernamen an die KI“: aus = Namen anderer Fahrer werden vor dem Senden durch die
 *  Startnummer ersetzt (Spotter, Vorlagen-Funk und Anzeigen bleiben auf dem PC und behalten die Namen) */
function kiLage(roh: Record<string, unknown>): Record<string, unknown> {
  // Bei „Automatisch“: Funk ohne Frage in der Sprache, in der zuletzt gefragt wurde (Regel 7 der Edge Function)
  const lage = persoenlichkeit?.sprache === "auto" && frageSprache ? { ...roh, sprache_letzte_frage: frageSprache } : roh;
  if (funkE.namenAnKi) return lage;
  return namenErsetzen(lage, sitzung?.fahrer ?? []) as Record<string, unknown>;
}

/** Schaden am Auto (Wunsch 27.11., Fund 28.11.): Reparaturzeit, Fleischball, Motor-Warnungen und der zuletzt gemessene
 *  Einschlag (crash.ts); null = Simulation liefert nichts */
function schadenLage(): Record<string, unknown> | string | null {
  const p = zaehler.jetzt;
  return schadenBild(p ?? null, crashWaechter.letzter, p?.zeit ?? null, fahrverhalten.auswirkung());
}

/** Nur gemessene Fakten nach einer Runde – daraus formuliert die KI den Funkspruch */
function rundenLage(r: Runde, b: Befund | undefined): Record<string, unknown> {
  const beste = zaehler.beste;
  const v = verbrauchProRunde(zaehler.runden);
  const sprit = zaehler.jetzt?.sprit ?? null;
  return {
    anlass: "runde",
    sitzung: sitzung?.sitzungsart ?? (demo.laeuft ? "Demo" : null),
    strecke: sitzung?.strecke ?? null,
    fahrzeug: sitzung?.fahrzeug ?? null,
    runde: r.nr,
    gueltig: r.gueltig,
    ungueltig_weil: r.gueltig ? null : r.grund ?? "ungültig",
    zeit_s: runden3(r.zeit),
    // fertig geschriebene Zeiten (Fund 27.11.: aus 103,4 s machte die KI „1,3“ statt „1:43,4“)
    zeit_text: zeitText(r.zeit),
    bestzeit_s: runden3(beste?.zeit),
    bestzeit_text: beste ? zeitText(beste.zeit) : null,
    neue_bestzeit: beste === r,
    hinter_bestzeit_s: beste && beste !== r && r.gueltig ? runden3(r.zeit - beste.zeit) : null,
    groesster_verlust: b ? { stelle: kurvenName(b.kurve, laenge() ?? 4000), verlust_s: runden3(b.verlust), ursache: b.ursachen[0] ?? null, tipp: b.tipp } : null,
    sprit_l: runden3(sprit),
    sprit_reicht_runden: v && sprit != null ? Math.floor((sprit / v) * 10) / 10 : null,
    platz: platzJetzt(),
    sparen: sparLage(),
    gegen_schnellsten: gegenSchnellstenLage(),
    schaden: schadenLage(),
  };
}

/** Ansage nach der Runde: Vorlage sofort, angemeldet danach die Formulierung des KI-Renningenieurs */
function funkMelden(vorlage: string, lage: Record<string, unknown>) {
  const nr = ++funkNr;
  const quelle = $("lFunkQuelle");
  $("lFunkText").textContent = vorlage;
  quelle.textContent = "Kurz gesagt";
  quelle.className = "";
  if (!angemeldet() || !kiVerfuegbar()) {
    if (funkE.vorlesen) void vorlesen(vorlage);
    return;
  }
  quelle.textContent = "Renningenieur formuliert …";
  void kiFragen("funk", kiLage(lage)).then((e) => {
    if (nr !== funkNr) return; // inzwischen neue Runde
    if ("text" in e) {
      $("lFunkText").textContent = e.text;
      quelle.textContent = `KI-Renningenieur ${persoenlichkeit?.name ?? ""}`.trim();
      quelle.className = "quelle-ki";
      if (funkE.vorlesen) void vorlesen(e.text);
    } else {
      quelle.textContent = "Kurz gesagt";
      if (funkE.vorlesen) void vorlesen(vorlage);
    }
  });
}

function vorlesen(text: string) {
  return sprechen(text, funkE, { sprache: persoenlichkeit?.sprache ?? "de", stimmlage: persoenlichkeit?.stimme ?? "ruhig" });
}

function stimmenFuellen() {
  const auswahl = $<HTMLSelectElement>("fStimme");
  const stimmen = stimmenFuer(persoenlichkeit?.sprache ?? "de");
  auswahl.replaceChildren(neu("option", "", "Automatisch (natürlichste)"));
  (auswahl.firstElementChild as HTMLOptionElement).value = "";
  for (const v of stimmen) {
    const o = neu("option", "", `${v.name.slice(0, 60)}${v.localService ? "" : " (online)"}`);
    o.value = v.voiceURI;
    auswahl.append(o);
  }
  auswahl.value = stimmen.some((v) => v.voiceURI === funkE.stimme) ? funkE.stimme : "";
}

function funkEinrichten() {
  const vorlesenFeld = $<HTMLInputElement>("fVorlesen");
  const klangFeld = $<HTMLInputElement>("fKlang");
  const laut = $<HTMLInputElement>("fLaut");
  const spotterFeld = $<HTMLInputElement>("fSpotter");
  const namenFeld = $<HTMLInputElement>("fNamen");
  vorlesenFeld.checked = funkE.vorlesen;
  klangFeld.checked = funkE.klang;
  spotterFeld.checked = funkE.spotter;
  namenFeld.checked = funkE.namenAnKi;
  laut.value = String(funkE.lautstaerke);
  const merken = () => {
    funkE = { vorlesen: vorlesenFeld.checked, klang: klangFeld.checked, lautstaerke: Number(laut.value), stimme: $<HTMLSelectElement>("fStimme").value, spotter: spotterFeld.checked, namenAnKi: namenFeld.checked };
    funkSpeichern(funkE);
  };
  for (const f of [vorlesenFeld, klangFeld, spotterFeld, namenFeld, laut, $("fStimme")]) f.addEventListener("change", merken);
  // Referenzrunden aus dem Feld anonym teilen (SQL 060) – eigener Schalter, nur auf diesem PC gemerkt
  const teilenFeld = $<HTMLInputElement>("fFeldTeilen");
  teilenFeld.checked = feldTeilenAn();
  teilenFeld.addEventListener("change", () => { try { localStorage.setItem("gsra-feld-teilen", teilenFeld.checked ? "1" : "0"); } catch { /* egal */ } });
  stimmenFuellen();
  if ("speechSynthesis" in window) window.speechSynthesis.addEventListener("voiceschanged", stimmenFuellen);
  $("fProbe").addEventListener("click", () => {
    const code = ansageSprache();
    void sprechen(ansage(code, "probe", { name: persoenlichkeit?.name ?? "Kim" }), { ...funkE, vorlesen: true }, { sprache: code, stimmlage: persoenlichkeit?.stimme ?? "ruhig", sofort: true });
  });
  $<HTMLInputElement>("fAufnahme").addEventListener("change", async (e) => {
    const feld = e.target as HTMLInputElement;
    const datei = feld.files?.[0];
    feld.value = "";
    if (!datei) return;
    try {
      const sek = await aufnahmeAbspielen(datei, funkE);
      hinweis(`Spiele „${datei.name.slice(0, 60)}“ (${Math.round(sek)} s) durch den Funk – die Datei bleibt auf deinem PC.`, "ok");
    } catch (err) {
      hinweis(err instanceof Error ? err.message : "Die Aufnahme lässt sich nicht abspielen.", "fehler");
    }
  });
  beiKontoWechsel(async () => {
    persoenlichkeit = angemeldet() ? await persoenlichkeitLaden().catch(() => null) : null;
    stimmenFuellen();
    $("fHinweis").textContent = angemeldet()
      ? `Dein KI-Renningenieur ${persoenlichkeit?.name ?? ""} formuliert die Ansagen in seinem Stil.`.replace("  ", " ")
      : "Angemeldet formuliert dein KI-Renningenieur die Ansagen in seinem Stil (einstellbar unter Renningenieur, ganz unten).";
  });
}

// KI-Nachbesprechung (Bericht): nur Fakten aus dem Bericht, Namen der Gegner aus der Startliste
function berichtLage(): Record<string, unknown> {
  const b = berichtErstellen(zaehler.runden, beobachter, laenge() ?? 4000, sitzung?.fahrer ?? []);
  const alleKurven = b.kurven.map((k) => k.kurve);
  return {
    sitzung: sitzung?.sitzungsart ?? (demo.laeuft ? "Demo" : null),
    strecke: sitzung?.strecke ?? null,
    fahrzeug: sitzung?.fahrzeug ?? null,
    runden: b.runden,
    gueltige_runden: b.gueltig,
    bestzeit_s: runden3(b.beste),
    ideal_s: runden3(b.ideal),
    schnitt_s: runden3(b.schnitt),
    streuung_s: runden3(b.konstanz),
    start_platz: b.startPlatz,
    end_platz: b.endPlatz,
    sprit_pro_runde_l: runden3(b.sprit),
    boxenstopps: b.stopps,
    // Kurven in Fahrtrichtung (Kurve 1 zuerst); „rang“ = wo am meisten Zeit liegt (Fund 28.11.: KI las die nach Verlust
    // sortierte Liste als Reihenfolge – „nach Kurve 6 folgt Kurve 5“)
    kurven_anzahl: alleKurven.length,
    kurven_zaehlung: "Kurve 1 ist die erste Kurve nach Start/Ziel, dann in Fahrtrichtung weiter; kann von der offiziellen Nummerierung abweichen",
    zeitverlust_kurven: b.kurven.filter((k) => k.runden > 0 && k.schnitt > 0.005).slice(0, 6)
      .map((k, i) => ({ kurve: `Kurve ${k.kurve.nr}`, nr: k.kurve.nr, rang: i + 1, bei_m: Math.round((k.kurve.scheitel / RASTER) * (laenge() ?? 4000)), schnitt_verlust_s: runden3(k.schnitt), tipp: k.tipp || null }))
      .sort((x, y) => x.nr - y.nr),
    zweikaempfe: b.kaempfe.slice(0, 8).map((k) => ({
      gegner: k.name, runden: k.dauerRunden, knappster_abstand_s: runden3(k.minAbstand),
      ueberholungen: k.ueberholungen.slice(0, 4).map((u) => ({ ich_vorbei: u.ichVorbei, wo: stelleText(Math.round(u.anteil * RASTER), alleKurven) })),
    })),
    gegen_schnellsten: gegenSchnellstenLage(),
  };
}

function kiTextZeigen(text: string) {
  const ziel = $("bKiText");
  ziel.replaceChildren(...text.split(/\n{2,}/).map((a) => neu("p", "", a.trim())).filter((p) => p.textContent));
  ziel.hidden = false;
}

// Nachbesprechung (Wunsch 25.11.): kommt nach der Sitzung VON SELBST – im Chat und im Bericht. Danach kann man
// Rückfragen zum Rennen stellen; das Wichtigste merkt sich der Renningenieur fürs nächste Mal (SQL 054).
let phase: "rennen" | "nachbesprechung" = "rennen";
let nachbesprechungLaeuft = false;

function phaseSetzen(p: typeof phase) {
  phase = p;
  $("cSchnellRennen").hidden = p !== "rennen";
  $("cSchnellDanach").hidden = p !== "nachbesprechung";
}

async function nachbesprechung(automatisch: boolean) {
  const status = $("bKiStatus");
  if (!zaehler.runden.some((r) => r.gueltig)) {
    if (!automatisch) status.textContent = "Für eine Nachbesprechung brauche ich mindestens eine gültige Runde.";
    return;
  }
  if (nachbesprechungLaeuft) return;
  nachbesprechungLaeuft = true;
  phaseSetzen("nachbesprechung");
  if (automatisch) {
    reiterZeigen("chat");
    hinweis("Sitzung vorbei – dein Renningenieur bespricht sie jetzt mit dir.", "ok");
    // Von selbst ein kurzer Abschluss am Funk (Wunsch 27.11.: „Starkes Rennen, bis auf Platz 8 vorgearbeitet – gleich
    // folgt die Nachbesprechung“); Plätze aus der offiziellen Wertung, nur im Rennen
    const start = beobachter.startPlatz;
    const ende = beobachter.platz;
    if (ansageSprache() === "de" && istRennen(sitzung?.sitzungsart ?? (demo.laeuft ? "Rennen" : null)) && start != null && ende != null) {
      const diff = start - ende;
      const satz = diff > 0 ? `Zielflagge! Starkes Rennen – du hast dich von Platz ${start} auf Platz ${ende} vorgearbeitet. Gleich kommt die Nachbesprechung.`
        : diff < 0 ? `Zielflagge! Platz ${ende} – heute lief nicht alles rund, aber genau dafür gibt es die Nachbesprechung. Die kommt gleich.`
        : `Zielflagge! Platz ${ende} gehalten – sauber nach Hause gefahren. Gleich kommt die Nachbesprechung.`;
      chat?.melden(satz, "nachbesprechung");
    }
  }
  const b = berichtErstellen(zaehler.runden, beobachter, laenge() ?? 4000, sitzung?.fahrer ?? []);
  const vorlage = b.saetze.join(" ");
  try {
    if (angemeldet() && kiVerfuegbar("nachbesprechung")) {
      status.textContent = "Dein Renningenieur schaut sich die Sitzung an …";
      chat?.melden(pruefSatz(persoenlichkeit?.art ?? "kumpel"), "pruefen");
      const e = await kiFragen("nachbesprechung", kiLage({ ...berichtLage(), phase: "nachbesprechung" }));
      if ("text" in e) {
        status.textContent = "";
        kiTextZeigen(e.text);
        chat?.melden(e.text, "nachbesprechung");
        if (e.merken?.length) {
          const n = await merkenSpeichern(e.merken);
          if (n) hinweis(`Dein Renningenieur hat sich ${n === 1 ? "einen Punkt" : `${n} Punkte`} für das nächste Mal gemerkt.`, "ok");
          // ab 10 eigenen Einträgen verdichtet er sein Gedächtnis (still; die Datenbank entscheidet, ob es nötig ist)
          void gedaechtnisVerdichten().then((v) => { if (v) hinweis(`Dein Renningenieur hat sein Gedächtnis aufgeräumt: ${v} Punkte zusammengefasst.`, "ok"); });
        }
        return;
      }
      status.textContent = e.grund === "einrichtung" ? "Der KI-Renningenieur wird gerade eingerichtet – bis dahin die Kurzfassung." : e.fehler;
    } else if (!angemeldet()) {
      status.textContent = "Angemeldet bespricht dein KI-Renningenieur die Sitzung ausführlich mit dir.";
    }
    chat?.melden(vorlage, "nachbesprechung");
  } finally {
    nachbesprechungLaeuft = false;
  }
}

function berichtKiEinrichten() {
  $("bKiKnopf").addEventListener("click", () => void nachbesprechung(false));
  $("cNachbesprechung").addEventListener("click", () => void nachbesprechung(false));
  $("bVorlesen").addEventListener("click", () => {
    const ki = $("bKiText");
    const text = !ki.hidden && ki.textContent ? Array.from(ki.children, (p) => p.textContent).join(" ") : Array.from($("bSaetze").children, (li) => li.textContent).join(" ");
    void vorlesen(text);
  });
}

// ---------------------------------------------------------------- Sprit sparen (Lift & Coast)
let letzterBefund: Befund | null = null;
const spar = {
  aktiv: false,
  ziel: 0.05,
  startNr: 0,
  basis: null as SparBasis | null,
  punkte: [] as Bremspunkt[],
  runden: [] as SparAuswertung[],
};

/** „vor Kurve 3“ – Kurve nach dem Bremspunkt (Nummern wie in der App) */
function sparStelle(b: Bremspunkt): string {
  const beste = zaehler.beste;
  const L = laenge() ?? 4000;
  if (beste && beste.punkte.length > 10) {
    const i = b.a * RASTER;
    const k = kurvenFinden(spur(beste), L).find((x) => x.ende >= i);
    if (k) return `vor Kurve ${k.nr}`;
  }
  return `bei ${meterText(b.meter)}`;
}

function sparStarten(): string | null {
  const L = laenge() ?? 4000;
  const basis = sparBasis(zaehler.runden, L);
  const beste = zaehler.beste;
  spar.ziel = Number($<HTMLSelectElement>("spZiel").value) || 0.05;
  if (!basis || !beste) {
    $("spStatus").textContent = "Fahr zuerst eine normale, saubere Runde – dann kenne ich deinen Verbrauch und sage dir, wo du sparen kannst.";
    return "Fahr erst eine normale, saubere Runde – dann kenne ich deinen Verbrauch und zeige dir, wo du früher vom Gas gehst.";
  }
  // Bewertet wird erst die nächste volle Runde (die laufende hat ohne Sparen begonnen)
  const startNr = zaehler.laufend?.nr ?? zaehler.runden.at(-1)?.nr ?? 0;
  Object.assign(spar, { aktiv: true, basis, startNr, punkte: bremspunkte(beste, L, 3), runden: [] });
  if (demo.laeuft) demo.fahrt.sparen = true;
  sparZeigen();
  const ziel = `${Math.round(spar.ziel * 100)} %`;
  const erste = spar.punkte.length ? spar.punkte.reduce((m, x) => (x.tempoKmh > m.tempoKmh ? x : m)) : null;
  return `Spar-Modus an: Ziel ${ziel} weniger als deine ${zahl(basis.verbrauch, 2)} l pro Runde.` +
    (erste ? ` Fang ${sparStelle(erste)} an – etwa ${erste.liftM} m vor dem Bremspunkt vom Gas und rollen lassen.` : "");
}

function sparBeenden() {
  spar.aktiv = false;
  demo.fahrt.sparen = false;
  sparZeigen();
}

/** Nach einer Runde im Spar-Modus: Bewertung als Funkspruch (null = Spar-Modus aus) */
function sparRunde(r: Runde): string | null {
  if (!spar.aktiv || !spar.basis || r.nr <= spar.startNr) return null;
  const L = laenge() ?? 4000;
  const a = sparAuswerten(r, spar.basis, spar.ziel, L);
  if (!a) return null;
  spar.runden.push(a);
  if (aktiverReiter === "sprit") sparZeigen();
  return sparText(a, sparTipp(r, spar.punkte, L), sparStelle);
}

function sparLage(): Record<string, unknown> | null {
  if (!spar.aktiv || !spar.basis) return null;
  const a = spar.runden.at(-1);
  return {
    ziel_prozent: Math.round(spar.ziel * 100),
    basis_verbrauch_l: runden3(spar.basis.verbrauch),
    letzte_ersparnis_prozent: a ? Math.round(a.ersparnis * 1000) / 10 : null,
    letzter_zeitverlust_s: a?.zeitVerlust != null ? runden3(a.zeitVerlust) : null,
    ausrollen_m: a ? Math.round(a.rollM) : null,
    ziel_erreicht: a?.erreicht ?? null,
    frueher_vom_gas: spar.punkte.map((b) => ({ wo: sparStelle(b), tempo_kmh: b.tempoKmh, meter_vor_bremspunkt: b.liftM })),
  };
}

function sparZeigen() {
  const knopf = $<HTMLButtonElement>("spKnopf");
  knopf.textContent = spar.aktiv ? "Spar-Modus beenden" : "Spar-Modus starten";
  const tipps = $("spTipps");
  tipps.hidden = !spar.aktiv || !spar.punkte.length;
  if (spar.aktiv && spar.basis) {
    $("spStatus").textContent = `Ziel: ${Math.round(spar.ziel * 100)} % weniger als ${zahl(spar.basis.verbrauch, 2)} l pro Runde (Basis aus ${spar.basis.runden} ${spar.basis.runden === 1 ? "Runde" : "Runden"}).`;
    const ul = neu("ul");
    for (const b of spar.punkte) ul.append(neu("li", "", `${sparStelle(b)} (${b.tempoKmh} km/h): etwa ${b.liftM} m vor dem Bremspunkt vom Gas, rollen lassen`));
    tipps.replaceChildren(neu("strong", "", "Hier lohnt sich Lift & Coast am meisten:"), ul);
  }
  const tabelle = $("spTabelle");
  tabelle.hidden = !spar.runden.length;
  $("spZeilen").replaceChildren(...spar.runden.slice(-8).reverse().map((a) => {
    const tr = neu("tr");
    tr.append(
      neu("td", "", String(a.runde)),
      neu("td", "", liter(a.verbrauch, 2)),
      neu("td", a.erreicht ? "gut" : "warn", `${a.ersparnis >= 0 ? "−" : "+"}${zahl(Math.abs(a.ersparnis) * 100, 1)} %`),
      neu("td", "", a.zeitVerlust == null ? "–" : `${a.zeitVerlust >= 0 ? "+" : "−"}${zahl(Math.abs(a.zeitVerlust), 2)} s`),
      neu("td", "", `${Math.round(a.rollM)} m`),
    );
    return tr;
  }));
}

$("spKnopf").addEventListener("click", () => {
  if (spar.aktiv) sparBeenden();
  else {
    const satz = sparStarten();
    if (satz && spar.aktiv && funkE.vorlesen) void vorlesen(satz);
  }
});

// ---------------------------------------------------------------- Chat mit dem Renningenieur
type Nachbar = {
  idx: number; name: string; nummer: string; abstand_s: number | null;
  irating: number | null; lizenz: string | null; vorfaelle: number | null; strafe: Strafe;
} | null;

// Abstände der letzten Runde je Auto – daraus die Tendenz („holt 0,3 pro Runde“)
let letzteAbstaende = new Map<number, number>();
function gegnerMitTrend(): { vor: Gegner | null; hinter: Gegner | null } {
  const { vor, hinter } = nachbarn();
  const neu = new Map<number, number>();
  const mach = (n: Nachbar): Gegner | null => {
    if (!n || n.abstand_s == null) return null;
    const vorher = letzteAbstaende.get(n.idx);
    neu.set(n.idx, n.abstand_s);
    return { name: n.name, nummer: n.nummer, abstand: n.abstand_s, trend: vorher != null ? Math.round((n.abstand_s - vorher) * 100) / 100 : null };
  };
  const ergebnis = { vor: mach(vor), hinter: mach(hinter) };
  letzteAbstaende = neu;
  return ergebnis;
}
function nachbarn(): { vor: Nachbar; hinter: Nachbar } {
  const f = letztesFeld;
  const fahrer = sitzung?.fahrer ?? [];
  if (!f || f.ich == null) return { vor: null, hinter: null };
  const meinPlatz = f.platz[f.ich];
  if (meinPlatz == null || meinPlatz <= 0) return { vor: null, hinter: null };
  const fortschritt = (i: number) => (f.runde[i] ?? 0) + Math.max(0, f.anteil[i] ?? 0);
  const auto = (i: number | null): Nachbar => {
    if (i == null || i < 0) return null;
    const info = fahrer.find((x) => x.idx === i);
    const abstand = Math.abs(fortschritt(i) - fortschritt(f.ich!)) * typischeRundenzeit();
    return {
      idx: i, name: info?.name ?? `Auto ${i}`, nummer: info?.nummer ?? "", abstand_s: Number.isFinite(abstand) ? Math.round(abstand * 10) / 10 : null,
      irating: info?.irating ?? null, lizenz: info?.lizenz || null, vorfaelle: info?.vorfaelle ?? null, strafe: strafeAus(f.flaggen?.[i]),
    };
  };
  // Im Rennen live (Fund 27.11.: der offizielle Platz von iRacing gilt erst ab der Ziellinie), sonst offiziell
  if (istRennen(sitzung?.sitzungsart ?? (demo.laeuft ? "Rennen" : null))) {
    const live = liveNachbarn(f);
    if (live.vor != null || live.hinter != null) return { vor: auto(live.vor), hinter: auto(live.hinter) };
  }
  const finden = (platz: number) => auto(f.platz.findIndex((p) => p === platz));
  return { vor: meinPlatz > 1 ? finden(meinPlatz - 1) : null, hinter: finden(meinPlatz + 1) };
}

/** Alle Fakten für eine Rückfrage – nur Messwerte, keine Vermutungen */
function chatLage(): Record<string, unknown> {
  const g = zaehler.runden.filter((r) => r.gueltig);
  const letzte = zaehler.runden.at(-1);
  const v = verbrauchProRunde(zaehler.runden);
  const sprit = zaehler.jetzt?.sprit ?? null;
  const { vor, hinter } = nachbarn();
  const b = g.length >= 2 ? berichtErstellen(zaehler.runden, beobachter, laenge() ?? 4000, sitzung?.fahrer ?? []) : null;
  if (phase === "nachbesprechung") return { anlass: "frage", phase, ...berichtLage(), vergleich: vergleichFuerKi };
  return {
    anlass: "frage",
    phase,
    sitzung: sitzung?.sitzungsart ?? (demo.laeuft ? "Demo" : null),
    strecke: sitzung?.strecke ?? null,
    fahrzeug: sitzung?.fahrzeug ?? null,
    aktuelle_runde: zaehler.laufend?.nr ?? null,
    gefahrene_runden: zaehler.runden.length,
    letzte_runde_s: letzte ? runden3(letzte.zeit) : null,
    letzte_runde_text: letzte ? zeitText(letzte.zeit) : null,
    bestzeit_text: zaehler.beste ? zeitText(zaehler.beste.zeit) : null,
    letzte_runde_gueltig: letzte?.gueltig ?? null,
    bestzeit_s: runden3(zaehler.beste?.zeit),
    schnitt_s: runden3(rundenzeitSchnitt(zaehler.runden)),
    sprit_l: runden3(sprit),
    verbrauch_pro_runde_l: runden3(v),
    sprit_reicht_runden: v && sprit != null ? Math.floor((sprit / v) * 10) / 10 : null,
    platz: platzJetzt(),
    vor_mir: vor,
    hinter_mir: hinter,
    letzte_runde_groesster_verlust: letzterBefund ? { stelle: kurvenName(letzterBefund.kurve, laenge() ?? 4000), verlust_s: runden3(letzterBefund.verlust), ursachen: letzterBefund.ursachen.slice(0, 3), tipp: letzterBefund.tipp } : null,
    im_schnitt_verlust: b ? b.kurven.filter((k) => k.runden > 0 && k.schnitt > 0.005).slice(0, 3).map((k, i) => ({ kurve: `Kurve ${k.kurve.nr}`, nr: k.kurve.nr, rang: i + 1, schnitt_verlust_s: runden3(k.schnitt), tipp: k.tipp || null })).sort((x, y) => x.nr - y.nr) : [],
    zweikaempfe: b ? b.kaempfe.slice(-3).map((k) => ({ gegner: k.name, runden: k.dauerRunden, knappster_abstand_s: runden3(k.minAbstand) })) : [],
    sparen: sparLage(),
    gegen_schnellsten: gegenSchnellstenLage(),
    schaden: schadenLage(),
    ich: meineFahrerLage(),
    vergleich: vergleichFuerKi,
  };
}

/** Eigene iRating, Lizenz, Vorfallpunkte und offene Strafe (für „Wie viele X habe ich?“, „Habe ich eine Strafe?“) */
function meineFahrerLage(): Record<string, unknown> {
  const p = zaehler.jetzt;
  const ich = letztesFeld?.ich;
  const info = ich != null ? (sitzung?.fahrer ?? []).find((x) => x.idx === ich) : undefined;
  const strafe = strafeAus(p?.flaggen);
  return {
    irating: info?.irating ?? null,
    lizenz: info?.lizenz || null,
    // höchster Wert aus Telemetrie (eigener/Fahrer/Team-Zähler) und Fahrerliste der Sitzung
    vorfallpunkte_x: Math.max(p?.vorfaelle ?? -1, info?.vorfaelle ?? -1) >= 0 ? Math.max(p?.vorfaelle ?? -1, info?.vorfaelle ?? -1) : null,
    // eigene Zählung der App (iRacing zählt X nicht in jeder Sitzungsart, z. B. nicht im Test Drive)
    ausfluege_neben_strecke_gezaehlt: fahrverhalten.ausfluege,
    einschlaege_gemessen: crashWaechter.letzter ? 1 : 0,
    ungueltige_runden: zaehler.runden.filter((r) => !r.gueltig && r.grund && /Strecke|Vorfall/.test(r.grund)).length,
    strafe: strafe === "strafe" ? "Strafe offen (schwarze Flagge) – Details in der Black Box" : strafe === "verwarnung" ? "Verwarnung (schwarz-weiße Flagge)" : strafe === "reparatur" ? "Fleischball: Pflicht-Reparatur" : p?.flaggen != null ? "keine" : null,
  };
}

/** Einfache Fakten ohne KI (sofort, auch offline) */
function lokaleAntwort(frage: string): string | null {
  // In der Sprache der Antwort; erkannt wird die Frage in jeder Sprache (Stichwörter aus ansagen.ts)
  const code = ansageSprache(frage);
  const befehl = mitfahrBefehl(frage);
  if (befehl) return mitfahrenUmschalten(befehl === "an");
  const a = absicht(frage, code);
  if (!a) return null;
  const z = (x: number, stellen = 1) => zahlIn(code, x, stellen);
  if ((a === "vor" || a === "hinter") && phase === "nachbesprechung") return ansage(code, "nachbesprechung");
  if (a === "vor" || a === "hinter") {
    const n = nachbarn()[a];
    if (!n) return ansage(code, "niemand");
    if (n.abstand_s == null) return ansage(code, "nochNichts");
    // mit iRating, Lizenz/SR und X (Wunsch 28.11.) und – falls offen – Strafe oder Verwarnung
    const satz = ansage(code, a, { wer: werMitInfo(n.name, n.nummer, n), s: z(n.abstand_s) });
    return [satz, strafeSatz(code, n.strafe, n.nummer ? `#${n.nummer}` : n.name)].filter(Boolean).join(" ");
  }
  if (a === "sprit") {
    const v = verbrauchProRunde(zaehler.runden);
    const sprit = zaehler.jetzt?.sprit;
    if (!v || sprit == null) return ansage(code, "nochNichts");
    const satz = ansage(code, "sprit", { l: z(sprit), v: z(v, 2), r: z(Math.floor((sprit / v) * 10) / 10) });
    return code === "de" ? `${satz} Ob es bis ins Ziel reicht, siehst du unter „Sprit & Stint“.` : satz;
  }
  if (a === "letzte") {
    const r = zaehler.runden.at(-1);
    if (!r) return ansage(code, "nochNichts");
    return `${ansage(code, "letzte", { zeit: zeitIn(code, r.zeit) })}${r.gueltig ? "" : ` ${ansage(code, "rundeUngueltig", { nr: r.nr })}`}`;
  }
  if (a === "beste") return zaehler.beste ? ansage(code, "beste", { zeit: zeitIn(code, zaehler.beste.zeit), nr: zaehler.beste.nr }) : ansage(code, "nochNichts");
  const p = platzJetzt();
  return p != null ? ansage(code, "platz", { p }) : ansage(code, "nochNichts");
}

let chat: Chat | null = null;
/** Wer per Sprechtaste fragt, bekommt die Antwort auch gesprochen (Funk) – auch wenn „Vorlesen“ aus ist */
let sprachfrageZeit = 0;
function chatEinrichten() {
  chat = new Chat($("cListe"), {
    lage: () => kiLage(chatLage()),
    angemeldet,
    art: () => persoenlichkeit?.art ?? "kumpel",
    name: () => persoenlichkeit?.name ?? "Renningenieur",
    lokal: lokaleAntwort,
    befehl: (frage) => { const b = mitfahrBefehl(frage); return b ? mitfahrenUmschalten(b === "an") : null; },
    sprache: (frage) => ansageSprache(frage),
    // „Moment, ich schau nach“ nur, wenn die Antwort auch gesprochen wird (Frage per Sprechtaste oder Vorlesen an)
    warten: (text) => { if (funkE.vorlesen || Date.now() - sprachfrageZeit < 120_000) void vorlesen(text); },
    vorlesen: (text) => {
      const perSprache = Date.now() - sprachfrageZeit < 120_000;
      if (funkE.vorlesen || perSprache) void vorlesen(text);
      if (perSprache && aktiverReiter !== "chat") hinweis(`${persoenlichkeit?.name ?? "Renningenieur"}: ${text.slice(0, 220)}`, "ok");
    },
    sparenStarten: () => {
      const a = spar.runden.at(-1);
      const satz = !spar.aktiv ? sparStarten() : a ? sparText(a, null, sparStelle) : "Der Spar-Modus läuft schon – nach der nächsten Runde sage ich dir, ob es reicht.";
      // Die Spar-Sätze gibt es nur auf Deutsch; in anderen Sprachen erklärt es die KI
      return ansageSprache() === "de" ? satz : null;
    },
  });
  // Mehrzeilige Eingabe wie im Messenger: wächst mit (bis zur Höchsthöhe), Enter sendet, Shift+Enter = neue Zeile
  const feld = $<HTMLTextAreaElement>("cFeld");
  const hoehe = () => { feld.style.height = "auto"; feld.style.height = `${Math.min(feld.scrollHeight, 220)}px`; };
  const senden = () => {
    const text = feld.value;
    if (!text.trim()) return;
    feld.value = "";
    hoehe();
    void chat?.senden(text);
  };
  feld.addEventListener("input", hoehe);
  feld.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); senden(); }
  });
  $<HTMLFormElement>("cForm").addEventListener("submit", (e) => { e.preventDefault(); senden(); });
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-frage]")) {
    b.addEventListener("click", () => void chat?.senden(b.dataset.frage ?? ""));
  }
}

// ---------------------------------------------------------------- Live
function live() {
  const p = zaehler.jetzt;
  const l = zaehler.laufend;
  const beste = zaehler.beste;
  // Spotter-Anzeige: 2 links, 3 rechts, 4 beidseitig, 5 zwei links, 6 zwei rechts
  const s = letzteSeite ?? 1;
  $("spotterLinks").classList.toggle("an", s === 2 || s === 4 || s === 5);
  $("spotterRechts").classList.toggle("an", s === 3 || s === 4 || s === 6);
  $("spotterLinks").textContent = s === 5 ? "◀◀ Zwei links" : "◀ Auto links";
  $("spotterRechts").textContent = s === 6 ? "Zwei rechts ▶▶" : "Auto rechts ▶";
  $("lTempo").textContent = p?.tempo != null ? String(Math.round(p.tempo * 3.6)) : "–";
  $("lGang").textContent = p?.gang == null ? "–" : p.gang === 0 ? "N" : p.gang < 0 ? "R" : String(p.gang);
  const rpm = p?.drehzahl ?? 0;
  $("lDrehzahl").style.width = `${Math.min(100, Math.max(0, (rpm / 8500) * 100))}%`;
  $("lDrehzahl").classList.toggle("schalten", rpm > 7900);
  $("lDrehzahlText").textContent = p?.drehzahl != null ? `${Math.round(rpm).toLocaleString("de-DE")} U/min` : "U/min";
  $("lGas").style.height = `${Math.round((p?.gas ?? 0) * 100)}%`;
  $("lBremse").style.height = `${Math.round((p?.bremse ?? 0) * 100)}%`;
  $("lRunde").textContent = l ? String(l.nr) : p?.runde != null ? String(p.runde) : "–";
  $("lRundenzeit").textContent = l ? zeitText(l.t) : "Warte auf die Ziellinie";
  const letzte = zaehler.runden[zaehler.runden.length - 1];
  $("lLetzte").textContent = letzte ? zeitText(letzte.zeit) : "–";
  $("lBeste").textContent = beste ? `Beste: ${zeitText(beste.zeit)}` : " ";

  // Live-Delta: aktuelle Rundenzeit gegen die Bestzeit an derselben Stelle der Strecke
  const deltaEl = $("lDelta");
  let d: number | null = null;
  if (l && beste && !l.grund) {
    const t = zeitBei(beste.punkte, l.a);
    if (t != null) d = l.t - t;
  }
  deltaEl.textContent = d == null ? "–" : sekunden(d).replace(/(\d),(\d{2})\d/, "$1,$2");
  deltaEl.className = d == null ? "" : d > 0.005 ? "langsamer" : d < -0.005 ? "schneller" : "";
  // Delta-Balken: Mitte = gleich schnell, volle Breite = 1 Sekunde
  const anteil = d == null ? 0 : Math.max(-1, Math.min(1, d));
  const balken = $("lDeltaBalken");
  balken.style.width = `${Math.abs(anteil) * 50}%`;
  balken.style.left = `${anteil < 0 ? 50 - Math.abs(anteil) * 50 : 50}%`;
  balken.className = deltaEl.className;
  // Position im Feld (nur im Rennen mit anderen Autos)
  const platz = platzJetzt();
  const feld = sitzung?.fahrer?.length ?? 0;
  $("lPlatz").textContent = platz != null ? `P${platz}` : "–";
  $("lPlatzInfo").textContent = platz != null ? (feld > 1 ? `von ${feld}` : "im Feld") : "nur im Rennen";
  $("lDeltaInfo").textContent = !beste ? "Noch keine gültige Runde" : l?.grund ? `Diese Runde zählt nicht: ${l.grund}` : "Plus = langsamer als deine Bestzeit";

  const v = verbrauchProRunde(zaehler.runden);
  $("lSprit").textContent = liter(p?.sprit);
  $("lSpritInfo").textContent = v && p?.sprit != null ? `reicht für ${zahl(p.sprit / v, 1)} Runden` : "Verbrauch nach der ersten Runde";

  const c = document.getElementById("lVerlauf") as HTMLCanvasElement | null;
  if (c && aktiverReiter === "live") verlaufZeichnen(c, verlauf.tempo, verlauf.gas, verlauf.bremse, 85);
  if (aktiverReiter === "live") liveKarte(l ? l.a * RASTER : null);
  if (aktiverReiter === "sprit") spritKacheln();
}

// ---------------------------------------------------------------- Runden
function rundenZeigen() {
  const runden = zaehler.runden;
  const beste = zaehler.beste;
  // schnellste Runde ohne Sperre (neben der Strecke, Vorfallpunkte) – nur die darf Referenz werden
  const besteSauber = zaehler.runden.filter((x) => x.gueltig && !x.sperre && x.punkte.length > 10).reduce<Runde | null>((b, x) => (!b || x.zeit < b.zeit ? x : b), null);
  $("rundenAnzahl").textContent = String(runden.length);
  $("rLeer").hidden = runden.length > 0;
  $("rTabelle").hidden = runden.length === 0;
  // Kennzahlen: Bestzeit, Schnitt und Konstanz aus den gültigen Runden (Ausreißer über +5 % zählen nicht zur Konstanz)
  const gueltige = runden.filter((r) => r.gueltig);
  $("rBeste").textContent = beste ? zeitText(beste.zeit) : "–";
  $("rBesteInfo").textContent = beste ? `in Runde ${beste.nr}` : "noch keine gültige Runde";
  const schnitt = rundenzeitSchnitt(runden);
  $("rSchnitt").textContent = schnitt != null ? zeitText(schnitt) : "–";
  $("rSchnittInfo").textContent = schnitt != null && beste ? `+${zahl(schnitt - beste.zeit, 3)} s zur Besten` : "gültige Runden";
  $("rGueltig").textContent = runden.length ? `${gueltige.length}/${runden.length}` : "–";
  $("rGueltigInfo").textContent = runden.length ? `${Math.round((gueltige.length / runden.length) * 100)} % sauber gefahren` : " ";
  const normal = beste ? gueltige.filter((r) => r.zeit <= beste.zeit * 1.05) : [];
  const mittel = normal.reduce((s, r) => s + r.zeit, 0) / Math.max(1, normal.length);
  const streuung = normal.length >= 3 ? Math.sqrt(normal.reduce((s, r) => s + (r.zeit - mittel) ** 2, 0) / normal.length) : null;
  $("rKonstanz").textContent = streuung != null ? `± ${zahl(streuung, 2)} s` : "–";
  $("rKonstanzInfo").textContent = streuung == null ? "ab 3 sauberen Runden" : streuung < 0.3 ? "sehr konstant" : streuung < 0.7 ? "ordentlich – da geht noch was" : "schwankt stark";
  const zeilen = [...runden].reverse().slice(0, 200).map((r) => {
    const tr = neu("tr", r === beste ? "beste" : r.gueltig ? "" : "ungueltig");
    tr.append(neu("td", "", String(r.nr)), neu("td", "zeit", zeitText(r.zeit)));
    // Abstand zur Besten als Balken (volle Breite = 2 s)
    const abstand = neu("td", "r-abstand");
    if (beste && r.gueltig && r !== beste) {
      const d = r.zeit - beste.zeit;
      const balken = neu("span", "r-balken");
      const fuell = neu("i");
      fuell.style.width = `${Math.min(100, (d / 2) * 100)}%`;
      balken.append(fuell);
      abstand.append(neu("span", "r-abstand-zahl", `+${zahl(d, 3)}`), balken);
    } else abstand.append(neu("span", r === beste ? "r-abstand-zahl beste" : "r-abstand-zahl", r === beste ? "Bestzeit" : "–"));
    tr.append(abstand);
    tr.append(neu("td", "", liter(r.sprit, 2)));
    const zustand = neu("td");
    zustand.append(neu("span", `etikett ${r.gueltig ? "ok" : "warn"}`, r.gueltig ? "gültig" : (r.grund ?? "ungültig")));
    tr.append(zustand);
    const td = neu("td", "r-aktionen");
    // Teilen nur für die schnellste SAUBERE Runde (Wunsch 28.11.: ungültige Runden blockieren – neben der Strecke,
    // Vorfallpunkte); ist die Bestzeit selbst nicht sauber, steht dort der Grund
    const teilbar = istApp && !demo.laeuft && angemeldet() && Boolean(sitzung?.strecke && sitzung.fahrzeug);
    if (teilbar && r === beste && r.sperre && r !== besteSauber) {
      const gesperrt = neu("button", "knopf leise", "Nicht teilbar");
      gesperrt.type = "button";
      gesperrt.disabled = true;
      gesperrt.title = `Diese Runde kann keine Referenz sein: ${r.sperre}.${besteSauber ? ` Teilbar ist Runde ${besteSauber.nr}.` : ""}`;
      td.append(gesperrt);
    }
    if ((r === besteSauber || geteilteRunden.has(r)) && teilbar && r.gueltig && !r.sperre && r.punkte.length > 10 && sitzung?.strecke && sitzung.fahrzeug) {
      const teilen = neu("button", "knopf leise", "Als Referenz teilen");
      teilen.type = "button";
      teilen.title = "Diese Runde anonym als GSRA-Referenzrunde teilen (mit Tempo, Gas und Bremse)";
      if (geteilteRunden.has(r)) teilen.textContent = "Geteilt ✓ · zurücknehmen";
      teilen.addEventListener("click", async () => {
        let geteiltId = geteilteRunden.get(r) ?? null;
        teilen.disabled = true;
        try {
          if (geteiltId) {
            // zweiter Klick: wieder zurücknehmen
            await referenzLoeschen(geteiltId);
            geteilteRunden.delete(r);
            teilen.textContent = "Als Referenz teilen";
            hinweis("Referenzrunde gelöscht.", "ok");
          } else {
            geteiltId = await eigeneRundeTeilen(sitzungsInfo(), r.zeit, spur(r));
            if (geteiltId) geteilteRunden.set(r, geteiltId);
            teilen.textContent = geteiltId ? "Geteilt ✓ · zurücknehmen" : "Zu langsam für die Top 50";
            hinweis(geteiltId ? "Danke! Deine Runde ist jetzt eine anonyme GSRA-Referenzrunde." : "Für diese Strecke gibt es schon 50 schnellere Referenzrunden.", "ok");
            if (!geteiltId) return; // bleibt aus
          }
          teilen.disabled = false;
          void referenzenAktualisieren(true);
        } catch (e) {
          teilen.disabled = false;
          hinweis(e instanceof Error ? e.message : "Das hat nicht geklappt.", "fehler");
        }
      });
      td.append(teilen);
    }
    if (r.punkte.length > 10 && beste && r !== beste) {
      const b = neu("button", "knopf leise", "Vergleichen");
      b.type = "button";
      b.title = "Mit deiner Bestzeit vergleichen";
      b.addEventListener("click", () => {
        auswahl = { ref: beste, x: r };
        reiterZeigen("vergleich");
      });
      td.append(b);
    }
    tr.append(td);
    return tr;
  });
  $("rZeilen").replaceChildren(...zeilen);
}

// ---------------------------------------------------------------- Vergleich
let spurCache = new WeakMap<Runde, Spur>();
function spur(r: Runde): Spur {
  let s = spurCache.get(r);
  if (!s) {
    s = abtasten(r.punkte);
    spurCache.set(r, s);
  }
  return s;
}

let auswahl: { ref: Runde | null; x: Runde | null } = { ref: null, x: null };
let ebene: "kurz" | "genau" = "kurz";
let diagramme: Diagramme | null = null;
let zoom: { von: number; bis: number } | null = null;

const rundenName = (r: Runde, beste: Runde | null) => `Runde ${r.nr} · ${zeitText(r.zeit)}${r === beste ? " · Bestzeit" : ""}${r.gueltig ? "" : ` · ${r.grund ?? "ungültig"}`}`;
const datumKurz = (iso: string) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Gespeicherte Runden der gewählten Strecke (Rundenarchiv) – zusätzlich zu den Runden dieser Sitzung
const archiv = { strecke: null as string | null, runden: [] as Runde[], info: new Map<Runde, ArchivRunde>() };
const archivKarten = new Map<Runde, Karte | null>();
/** Streckenlänge für den Vergleich: aus der gespeicherten Referenzrunde, sonst aus der laufenden Sitzung */
function vLaenge(): number {
  const a = auswahl.ref ? archiv.info.get(auswahl.ref) : undefined;
  return a?.laengeM ?? laenge() ?? 4000;
}
const rundeBeschreiben = (r: Runde) => {
  const a = archiv.info.get(r);
  return a ? `gespeicherte Runde vom ${datumKurz(a.datum)}${a.fahrzeug ? ` (${a.fahrzeug})` : ""}` : `Runde ${r.nr} dieser Sitzung`;
};

function auswahlFuellen() {
  const sitzungRunden = zaehler.runden.filter((r) => r.punkte.length > 10);
  const alle = [...sitzungRunden, ...archiv.runden];
  const beste = zaehler.beste;
  const archivBeste = archiv.runden.filter((r) => r.gueltig).reduce<Runde | null>((b, r) => (!b || r.zeit < b.zeit ? r : b), null);
  if (!auswahl.ref || !alle.includes(auswahl.ref)) auswahl.ref = archivBeste ?? beste ?? sitzungRunden[0] ?? archiv.runden[0] ?? null;
  if (!auswahl.x || !alle.includes(auswahl.x) || auswahl.x === auswahl.ref) {
    const kandidaten = [...[...sitzungRunden].reverse(), ...archiv.runden];
    auswahl.x = kandidaten.find((r) => r !== auswahl.ref && r.gueltig) ?? kandidaten.find((r) => r !== auswahl.ref) ?? null;
  }
  const option = (wert: string, text: string, an: boolean) => {
    const o = neu("option", "", text);
    o.value = wert;
    o.selected = an;
    return o;
  };
  for (const [id, gewaehlt] of [["vRef", auswahl.ref], ["vX", auswahl.x]] as const) {
    const sel = $<HTMLSelectElement>(id);
    const teile: HTMLElement[] = [];
    if (!gewaehlt) {
      const leer = option("", id === "vRef" ? "– noch keine Runde –" : "– noch keine zweite Runde –", true);
      leer.disabled = true;
      teile.push(leer);
    }
    if (sitzungRunden.length) {
      const g = neu("optgroup");
      g.label = "Diese Sitzung";
      g.append(...[...sitzungRunden].reverse().map((r) => option(`s:${zaehler.runden.indexOf(r)}`, rundenName(r, beste), r === gewaehlt)));
      teile.push(g);
    }
    if (archiv.runden.length) {
      const g = neu("optgroup");
      g.label = `Gespeichert – ${archiv.strecke ?? ""}`;
      g.append(...archiv.runden.map((r, i) => {
        const a = archiv.info.get(r);
        return option(`a:${i}`, `${a ? datumKurz(a.datum) : ""} · ${zeitText(r.zeit)}${a?.fahrzeug ? ` · ${a.fahrzeug.slice(0, 32)}` : ""}${r === archivBeste ? " · Bestzeit" : ""}${r.gueltig ? "" : " · ungültig"}`, r === gewaehlt);
      }));
      teile.push(g);
    }
    sel.replaceChildren(...teile);
  }
}

/** Kärtchen je gespeicherter Strecke; Klick lädt ihre Runden in die Auswahl */
async function streckenZeigen() {
  const box = $("vStrecken");
  let karten: StreckenKarte[] = [];
  try { karten = streckenKarten(await alleRunden()); } catch { /* ohne IndexedDB: nur diese Sitzung */ }
  if (!karten.length) {
    box.replaceChildren(neu("p", "hinweis", "Noch keine gespeicherten Runden – nach jeder Runde (auch in der Demo) landet sie hier, sortiert nach Strecke."));
    return;
  }
  const elemente: HTMLElement[] = karten.map((k) => {
    const an = k.strecke === archiv.strecke;
    const b = neu("button", `strecke-karte${an ? " aktiv" : ""}`);
    b.type = "button";
    b.setAttribute("role", "listitem");
    b.setAttribute("aria-pressed", String(an));
    b.title = an ? "Gespeicherte Runden ausblenden" : "Gespeicherte Runden dieser Strecke vergleichen";
    b.append(neu("strong", "", k.strecke), neu("span", "strecke-zeit", k.beste ? zeitText(k.beste) : "–"),
      neu("small", "", `${k.runden} ${k.runden === 1 ? "Runde" : "Runden"}${k.besteAuto ? ` · ${k.besteAuto}` : ""} · zuletzt ${datumKurz(k.zuletzt)}`));
    b.addEventListener("click", () => void streckeWaehlen(an ? null : k.strecke));
    return b;
  });
  if (archiv.strecke) {
    const weg = neu("button", "knopf leise strecke-loeschen", "Gespeicherte Runden dieser Strecke löschen");
    weg.type = "button";
    let sicher = false;
    weg.addEventListener("click", () => {
      if (!sicher) {
        sicher = true;
        weg.textContent = `Wirklich alle Runden von „${archiv.strecke}“ löschen? Nochmal klicken.`;
        window.setTimeout(() => { sicher = false; weg.textContent = "Gespeicherte Runden dieser Strecke löschen"; }, 5000);
        return;
      }
      const s = archiv.strecke;
      if (s) void streckeLoeschen(s).then(() => streckeWaehlen(null)).then(() => hinweis(`Gespeicherte Runden von „${s}“ gelöscht.`, "ok"));
    });
    elemente.push(weg);
  }
  box.replaceChildren(...elemente);
}

async function streckeWaehlen(strecke: string | null) {
  archiv.strecke = strecke;
  archiv.runden = [];
  archiv.info.clear();
  archivKarten.clear();
  if (strecke) {
    for (const a of await rundenDerStrecke(strecke).catch(() => [] as ArchivRunde[])) {
      const r = alsRunde(a);
      archiv.runden.push(r);
      archiv.info.set(r, a);
    }
  }
  auswahl = { ref: null, x: null };
  zoom = null;
  void streckenZeigen();
  vergleichZeigen();
}

function archivKarte(r: Runde): Karte | null {
  if (!archivKarten.has(r)) archivKarten.set(r, karteBauen(r.punkte));
  return archivKarten.get(r) ?? null;
}

// Renningenieur erklärt den Vergleich (Wunsch 26.11.) – im Chat, danach sind Rückfragen möglich
let vergleichFuerKi: Record<string, unknown> | null = null;
function vergleichLage(): Record<string, unknown> | null {
  const { ref, x } = auswahl;
  if (!ref || !x || ref === x) return null;
  const l = vLaenge();
  const v = vergleichen(spur(ref), spur(x), l);
  return {
    strecke: archiv.info.get(ref)?.strecke ?? sitzung?.strecke ?? null,
    referenz: { runde: rundeBeschreiben(ref), zeit_s: runden3(ref.zeit), gueltig: ref.gueltig },
    vergleich: { runde: rundeBeschreiben(x), zeit_s: runden3(x.zeit), gueltig: x.gueltig },
    unterschied_s: runden3(x.zeit - ref.zeit),
    zusammenfassung: v.zusammenfassung.slice(0, 400),
    groesste_verluste: v.befunde.slice(0, 4).map((b) => ({ stelle: kurvenName(b.kurve, l), verlust_s: runden3(b.verlust), ursachen: b.ursachen.slice(0, 2), tipp: b.tipp.slice(0, 180) })),
    hier_schneller: v.staerken.slice(0, 3).map((b) => ({ stelle: kurvenName(b.kurve, l), gewinn_s: runden3(Math.abs(b.verlust)) })),
  };
}
$("vKi").addEventListener("click", () => {
  const lage = vergleichLage();
  if (!lage) {
    hinweis("Wähle zuerst zwei verschiedene Runden.", "fehler");
    return;
  }
  vergleichFuerKi = lage;
  reiterZeigen("chat");
  if (angemeldet() && kiVerfuegbar()) {
    void chat?.senden("Erklär mir diesen Vergleich: Wo verliere ich die meiste Zeit, warum, und wie hole ich sie mir zurück?");
    return;
  }
  // Ohne KI: die Auswertung der App als Nachricht, mit Hinweis auf die ausführliche Erklärung
  const schonGesagt = new Set<string>();
  const verluste = (lage.groesste_verluste as { stelle: string; verlust_s: number | null; tipp: string }[])
    .map((b) => {
      const tipp = schonGesagt.has(b.tipp) ? "" : ` – ${b.tipp}`; // gleicher Tipp nur einmal
      schonGesagt.add(b.tipp);
      return `${b.stelle}: ${zahl(b.verlust_s ?? 0, 2)} s${tipp}${tipp ? "" : "."}`;
    });
  chat?.melden([String(lage.zusammenfassung), ...verluste,
    angemeldet() ? "" : "Angemeldet erklärt dir dein KI-Renningenieur das ausführlich, und du kannst nachfragen."].filter(Boolean).join(" "), "nachbesprechung");
});

for (const id of ["vRef", "vX"] as const) {
  $<HTMLSelectElement>(id).addEventListener("change", (e) => {
    const [art, nr] = (e.target as HTMLSelectElement).value.split(":");
    const r = (art === "a" ? archiv.runden[Number(nr)] : zaehler.runden[Number(nr)]) ?? null;
    if (id === "vRef") auswahl.ref = r;
    else auswahl.x = r;
    zoom = null;
    vergleichZeigen();
  });
}
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-ebene]")) {
  b.addEventListener("click", () => {
    ebene = b.dataset.ebene === "genau" ? "genau" : "kurz";
    vergleichZeigen();
  });
}
$("vGanz").addEventListener("click", () => diagramme?.bereich(0, RASTER));

function befundKarte(b: Befund, staerke: boolean) {
  const l = vLaenge();
  const karte = neu("article", staerke ? "befund staerke" : "befund");
  const kopf = neu("div", "befund-kopf");
  kopf.append(neu("strong", "", kurvenName(b.kurve, l)), neu("span", staerke ? "gewinn" : "verlust", sekunden(b.verlust)));
  karte.append(kopf);
  if (staerke) {
    karte.append(neu("p", "", "Hier bist du schneller als in der Referenz – genau so weitermachen."));
  } else {
    if (b.ursachen.length) {
      const ul = neu("ul", "ursachen");
      for (const u of b.ursachen) ul.append(neu("li", "", u.charAt(0).toUpperCase() + u.slice(1)));
      karte.append(ul);
    }
    karte.append(neu("p", "tipp-text", b.tipp));
  }
  const knopf = neu("button", "knopf leise", "Genau hinsehen");
  knopf.type = "button";
  knopf.addEventListener("click", () => {
    ebene = "genau";
    const rand = Math.round(RASTER * 0.01);
    zoom = { von: Math.max(0, b.kurve.start - rand), bis: Math.min(RASTER, b.kurve.ende + rand) };
    vergleichZeigen();
  });
  karte.append(knopf);
  return karte;
}

// ---------------------------------------------------------------- Streckenkarte
let vKarteDaten: { verlust: Float64Array; marken: { i: number; text: string; wichtig: boolean }[]; karte: Karte | null } | null = null;
let vCursor: number | null = null;

function liveKarte(punkt: number | null) {
  const c = document.getElementById("lStrecke") as HTMLCanvasElement | null;
  const h = $("lStreckeHinweis");
  if (!c) return;
  if (!karte) {
    c.hidden = true;
    h.hidden = false;
    h.textContent = zaehler.runden.some((r) => r.gueltig)
      ? "Für die Karte fehlt die Fahrtrichtung aus der Simulation."
      : "Die Karte entsteht nach deiner ersten gültigen Runde.";
    return;
  }
  c.hidden = false;
  h.hidden = true;
  karteZeichnen(c, karte, { verlust: letzterVerlust, marken: kurvenMarken, punkt, spiegeln });
}

function vKarteZeichnen() {
  const c = document.getElementById("vStrecke") as HTMLCanvasElement | null;
  const h = $("vStreckeHinweis");
  const d = vKarteDaten;
  if (!c || !d) return;
  if (!d.karte) {
    c.hidden = true;
    h.textContent = "Für die Karte fehlt die Fahrtrichtung aus der Simulation.";
    return;
  }
  c.hidden = false;
  h.textContent = ebene === "genau" ? "Gelber Punkt = Stelle unter der Maus im Diagramm." : "Rote Kreise = Kurven mit dem größten Zeitverlust.";
  karteZeichnen(c, d.karte, { verlust: d.verlust, marken: d.marken, punkt: ebene === "genau" ? vCursor : null, spiegeln });
}

// ---------------------------------------------------------------- Referenz aus der Lobby (Schnellster im Feld)
type GegenSchnellsten = { name: string; nummer: string; zeit: number; meine: number; rueckstand: number; delta: Float64Array;
  verluste: Array<{ kurve: number; verlust: number }> };

/** Schnellste Runde im Feld mit DEMSELBEN Auto (Rennen mit mehreren Klassen: andere Autos zählen nicht) */
function schnellsteGleichesAuto(): FeldRunde | null {
  const mein = sitzung?.fahrzeug ?? null;
  const fahrer = sitzung?.fahrer ?? [];
  let best: FeldRunde | null = null;
  for (const r of feldRef.beste.values()) {
    const auto = fahrer.find((x) => x.idx === r.idx)?.fahrzeug;
    if (mein && auto && auto !== mein) continue;
    if (!best || r.zeit < best.zeit) best = r;
  }
  return best;
}

function gegenSchnellsten(): GegenSchnellsten | null {
  // Schnellster im Feld (gleiches Auto) – oder die schnellste GSRA-Referenzrunde, wenn sie noch schneller ist
  const lobby = schnellsteGleichesAuto();
  const ref = referenzen[0];
  const s: FeldRunde | null = ref && (!lobby || ref.zeit < lobby.zeit - 0.0005) ? { idx: -1, runde: 0, zeit: ref.zeit, t: ref.t } : lobby;
  const beste = zaehler.beste;
  if (!s || !beste || beste.punkte.length < 10) return null;
  const L = laenge() ?? 4000;
  const meine = spur(beste);
  const d = deltaZu(s, meine.t);
  const kurven = kurvenFinden(meine, L);
  const info = (sitzung?.fahrer ?? []).find((x) => x.idx === s.idx);
  return {
    name: s.idx === -1 ? "GSRA-Referenzrunde" : info?.name ?? `Auto ${s.idx}`, nummer: s.idx === -1 ? "" : info?.nummer ?? "", zeit: s.zeit, meine: beste.zeit, rueckstand: beste.zeit - s.zeit, delta: d,
    verluste: kurven.map((k) => ({ kurve: k.nr, verlust: verlustIn(d, k.start, k.ende) })).sort((a, b) => b.verlust - a.verlust),
  };
}

function gegenSchnellstenLage(): Record<string, unknown> | null {
  const g = gegenSchnellsten();
  if (!g) return null;
  return {
    fahrer: `${g.nummer ? `#${g.nummer} ` : ""}${g.name}`, seine_zeit_s: runden3(g.zeit), seine_zeit_text: zeitText(g.zeit),
    meine_bestzeit_s: runden3(g.meine), meine_bestzeit_text: zeitText(g.meine), rueckstand_s: runden3(g.rueckstand),
    // nach Kurvennummer (Fahrtrichtung) sortiert, „rang“ = wo am meisten liegt (Fund 28.11.: „nach Kurve 6 folgt Kurve 5“)
    groesste_verluste: g.verluste.filter((v) => v.verlust > 0.02).slice(0, 3).map((v, i) => ({ kurve: `Kurve ${v.kurve}`, rang: i + 1, verlust_s: runden3(v.verlust) }))
      .sort((a, b) => Number(a.kurve.slice(6)) - Number(b.kurve.slice(6))),
    hier_schneller: g.verluste.filter((v) => v.verlust < -0.02).slice(-2).map((v) => ({ kurve: `Kurve ${v.kurve}`, gewinn_s: runden3(-v.verlust) }))
      .sort((a, b) => Number(a.kurve.slice(6)) - Number(b.kurve.slice(6))),
  };
}

// GSRA-Referenzrunden als Kärtchen (SQL 061) – lädt höchstens einmal pro Minute nach
const refAnsicht = referenzAnsicht({
  angemeldet: () => angemeldet() && !demo.laeuft,
  zeitText: (s) => zeitText(s),
  aktuell: () => ({ strecke: sitzung?.strecke ?? null, fahrzeug: sitzung?.fahrzeug ?? null }),
  hinweis: (t, art) => hinweis(t, art ?? "ok"),
  geaendert: () => void referenzenAktualisieren(true),
});
beiKontoWechsel(() => void refAnsicht.zeigen(true).catch(() => undefined));

function feldRefZeigen() {
  void refAnsicht.zeigen().catch(() => undefined);
  const g = gegenSchnellsten();
  const text = $("fRefText");
  const liste = $("fRefListe");
  const c = document.getElementById("fRefStrecke") as HTMLCanvasElement | null;
  if (!g) {
    text.textContent = zaehler.beste
      ? "Sobald ein anderes Auto in deiner Sitzung eine saubere Runde gefahren ist, vergleiche ich dich hier mit dem Schnellsten im Feld."
      : "Fahr eine gültige Runde – dann vergleiche ich dich mit dem Schnellsten in deiner Lobby.";
    liste.replaceChildren();
    if (c) c.hidden = true;
    return;
  }
  const wer = `${g.nummer ? `#${g.nummer} ` : ""}${g.name}`;
  text.textContent = g.rueckstand > 0.005
    ? `Schnellste Runde im Feld: ${wer}, ${zeitText(g.zeit)}. Deine Bestzeit ${zeitText(g.meine)} – ${zahl(g.rueckstand, 2)} s langsamer.`
    : `Du bist der Schnellste im Feld! ${wer} kommt mit ${zeitText(g.zeit)} am nächsten (${zahl(-g.rueckstand, 2)} s langsamer als du).`;
  const saetze: string[] = [];
  const verlust = g.verluste.filter((v) => v.verlust > 0.02).slice(0, 3);
  if (verlust.length) saetze.push(`Am meisten verlierst du in ${verlust.map((v) => `Kurve ${v.kurve} (${zahl(v.verlust, 2)} s)`).join(", ")}.`);
  const gewinn = g.verluste.filter((v) => v.verlust < -0.02).slice(-2).reverse();
  if (gewinn.length) saetze.push(`Schneller als ${g.name.split(/\s+/).at(-1)} bist du in ${gewinn.map((v) => `Kurve ${v.kurve} (${zahl(-v.verlust, 2)} s)`).join(" und ")}.`);
  saetze.push("Tipp: Schau dir die rote Stelle im Reiter „Vergleich“ mit deinen eigenen Runden genauer an – Bremspunkt und Gas zeigen dir, WIE du die Zeit holst.");
  liste.replaceChildren(...saetze.map((s) => neu("li", "", s)));
  if (c) {
    c.hidden = !karte;
    if (karte) karteZeichnen(c, karte, { verlust: verlustJeAbschnitt(g.delta), marken: kurvenMarken, punkt: null, spiegeln });
  }
}

const spiegelnFeld = $<HTMLInputElement>("spiegeln");
spiegelnFeld.checked = spiegeln;
spiegelnFeld.addEventListener("change", () => {
  spiegeln = spiegelnFeld.checked;
  try {
    localStorage.setItem("gsra_karte_spiegeln", spiegeln ? "1" : "0");
  } catch {
    /* privater Modus: nur für diese Sitzung */
  }
  live();
  vKarteZeichnen();
  feldRefZeigen();
});

function vergleichZeigen() {
  auswahlFuellen();
  feldRefZeigen();
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-ebene]")) b.setAttribute("aria-selected", String(b.dataset.ebene === ebene));
  const { ref, x } = auswahl;
  const bereit = !!ref && !!x && ref !== x;
  $("vLeer").hidden = bereit;
  $("vRaster").hidden = !bereit;
  $("vWerte").hidden = !bereit;
  if (bereit && ref && x) {
    $("vRefZeit").textContent = zeitText(ref.zeit);
    $("vRefInfo").textContent = rundeBeschreiben(ref);
    $("vXZeit").textContent = zeitText(x.zeit);
    $("vXInfo").textContent = rundeBeschreiben(x);
    const d = x.zeit - ref.zeit;
    const u = $("vUnterschied");
    u.textContent = `${d > 0 ? "+" : d < 0 ? "−" : "±"}${zahl(Math.abs(d), 3)} s`;
    u.className = d > 0.0005 ? "langsamer" : d < -0.0005 ? "schneller" : "";
    $("vUnterschiedInfo").textContent = d > 0.0005 ? "langsamer als die Referenz" : d < -0.0005 ? "schneller als die Referenz" : "gleich schnell";
  }
  $("vKurz").hidden = !bereit || ebene !== "kurz";
  $("vGenau").hidden = !bereit || ebene !== "genau";
  if (!bereit || !ref || !x) return;
  const l = vLaenge();
  const sr = spur(ref);
  const sx = spur(x);
  const v = vergleichen(sr, sx, l);
  // Karte: rot, wo die Vergleichsrunde Zeit verliert; die teuersten Kurven hervorgehoben
  vKarteDaten = {
    verlust: verlustJeAbschnitt(v.delta),
    marken: v.kurven.map((k) => ({ i: k.scheitel, text: String(k.nr), wichtig: v.befunde.some((b) => b.kurve.nr === k.nr) })),
    karte: archiv.info.has(ref) ? archivKarte(ref) : karte ?? karteBauen(ref.punkte),
  };
  vCursor = null;
  vKarteZeichnen();

  if (ebene === "kurz") {
    $("vZusammen").textContent = v.zusammenfassung;
    const befunde = v.befunde.map((b) => befundKarte(b, false));
    if (!befunde.length && v.gesamt > 0) befunde.push(neu("p", "hinweis", "Keine einzelne Kurve sticht heraus – der Unterschied verteilt sich über die Runde."));
    $("vBefunde").replaceChildren(...befunde);
    const st = $("vStaerken");
    st.replaceChildren();
    if (v.staerken.length) {
      st.append(neu("h3", "", "Hier bist du schneller"));
      for (const b of v.staerken) st.append(befundKarte(b, true));
    }
    return;
  }

  const xText = (i: number) => (laenge() || archiv.info.get(ref)?.laengeM ? meterText((i / RASTER) * l) : `${Math.round((i / RASTER) * 100)} %`);
  if (!diagramme) {
    diagramme = new Diagramme($("vDiagramme"), xText);
    diagramme.onBereich = (von, bis, ganz) => {
      zoom = ganz ? null : { von, bis };
      $("vBereich").textContent = ganz ? "Ganze Runde" : `${xText(von)} – ${xText(bis)}`;
      $("vGanz").hidden = ganz;
    };
    // Stelle unter der Maus auch auf der Karte zeigen
    diagramme.onCursor = (i) => {
      vCursor = i;
      vKarteZeichnen();
    };
  }
  const BLAU = "#4d8dff";
  const GELB = "#ffcc00";
  const plots: Plot[] = [
    { titel: "Zeitunterschied (Delta)", hoehe: 120, nulllinie: true, deltaFlaeche: true, reihen: [{ name: "Delta", werte: v.delta, farbe: "#ffffff", einheit: "s", stellen: 3 }] },
    { titel: "Tempo", hoehe: 190, reihen: [{ name: "Referenz", werte: sr.v, farbe: BLAU, einheit: "km/h", stellen: 0, faktor: 3.6 }, { name: "Vergleich", werte: sx.v, farbe: GELB, einheit: "km/h", stellen: 0, faktor: 3.6 }] },
    { titel: "Gas", hoehe: 90, min: 0, max: 100, reihen: [{ name: "Referenz", werte: sr.g, farbe: BLAU, einheit: "%", stellen: 0, faktor: 100 }, { name: "Vergleich", werte: sx.g, farbe: GELB, einheit: "%", stellen: 0, faktor: 100 }] },
    { titel: "Bremse", hoehe: 90, min: 0, max: 100, reihen: [{ name: "Referenz", werte: sr.b, farbe: BLAU, einheit: "%", stellen: 0, faktor: 100 }, { name: "Vergleich", werte: sx.b, farbe: GELB, einheit: "%", stellen: 0, faktor: 100 }] },
    { titel: "Gang", hoehe: 80, stufen: true, reihen: [{ name: "Referenz", werte: sr.gang, farbe: BLAU, einheit: "", stellen: 0 }, { name: "Vergleich", werte: sx.gang, farbe: GELB, einheit: "", stellen: 0 }] },
    { titel: "Lenkung", hoehe: 90, nulllinie: true, reihen: [{ name: "Referenz", werte: sr.l, farbe: BLAU, einheit: "°", stellen: 0, faktor: 57.2958 }, { name: "Vergleich", werte: sx.l, farbe: GELB, einheit: "°", stellen: 0, faktor: 57.2958 }] },
  ];
  diagramme.setzen(plots, v.kurven.map((k) => ({ i: k.scheitel, text: `K${k.nr}` })), RASTER);
  if (zoom) diagramme.bereich(zoom.von, zoom.bis);
  else diagramme.bereich(0, RASTER);
}

// ---------------------------------------------------------------- Bericht (Nachbesprechung)
function berichtZeigen() {
  const b = berichtErstellen(zaehler.runden, beobachter, laenge() ?? 4000, sitzung?.fahrer ?? []);
  $("bRunden").textContent = b.runden ? String(b.gueltig) : "–";
  $("bRundenInfo").textContent = b.runden ? `gültig von ${b.runden}` : "gültig";
  $("bBeste").textContent = rundenzeitText(b.beste);
  $("bSchnitt").textContent = b.schnitt != null ? `Schnitt ${rundenzeitText(b.schnitt)}` : " ";
  $("bIdeal").textContent = rundenzeitText(b.ideal);
  $("bKonstanz").textContent = b.konstanz != null ? `±${zahl(b.konstanz, 2)} s` : "–";
  const diff = b.startPlatz != null && b.endPlatz != null ? b.startPlatz - b.endPlatz : null;
  $("bPlaetze").textContent = diff == null ? "–" : diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : "±0";
  $("bPlaetzeInfo").textContent = b.startPlatz != null && b.endPlatz != null ? `von P${b.startPlatz} auf P${b.endPlatz}` : "nur im Rennen mit Gegnern";
  $("bSprit").textContent = b.sprit != null ? liter(b.sprit, 2) : "–";
  $("bStopps").textContent = b.sprit != null ? `pro Runde · ${b.stopps} ${b.stopps === 1 ? "Boxenstopp" : "Boxenstopps"}` : " ";

  $("bSaetze").replaceChildren(...b.saetze.map((s) => neu("li", "", s)));

  const kurven = b.kurven.filter((k) => k.runden > 0 && k.schnitt > 0.005).slice(0, 6);
  $("bKurvenLeer").hidden = kurven.length > 0;
  $("bKurven").hidden = kurven.length === 0;
  $("bKurvenZeilen").replaceChildren(
    ...kurven.map((k) => {
      const tr = neu("tr");
      tr.append(neu("td", "zeit", `Kurve ${k.kurve.nr}`), neu("td", "", meterText(k.meter)), neu("td", "warn", `Ø ${zahl(k.schnitt, 2)} s`), neu("td", "tipp-zelle", k.tipp || "–"));
      return tr;
    }),
  );

  const alleKurven = b.kurven.map((k) => k.kurve);
  $("bKaempfeLeer").hidden = b.kaempfe.length > 0;
  $("bKaempfe").replaceChildren(
    ...b.kaempfe.slice(0, 12).map((k) => {
      const li = neu("li");
      const kopf = neu("div", "kampf-kopf");
      kopf.append(neu("strong", "", k.name), neu("span", "", `etwa ${k.dauerRunden} ${k.dauerRunden === 1 ? "Runde" : "Runden"}`));
      li.append(kopf);
      if (k.ueberholungen.length) {
        const ul = neu("ul", "ueberholungen");
        for (const u of k.ueberholungen.slice(0, 6)) {
          ul.append(neu("li", u.ichVorbei ? "gut" : "schlecht", `${u.ichVorbei ? "Vorbei" : "Überholt worden"} ${stelleText(Math.round(u.anteil * RASTER), alleKurven)}`));
        }
        li.append(ul);
      } else li.append(neu("p", "", `Reihenfolge gehalten – knappster Abstand ${zahl(k.minAbstand, 1)} s.`));
      return li;
    }),
  );
}

// ---------------------------------------------------------------- Sprit & Stint
function spritKacheln() {
  const p = zaehler.jetzt;
  const v = verbrauchProRunde(zaehler.runden);
  const schnitt = rundenzeitSchnitt(zaehler.runden);
  $("sTank").textContent = p?.sprit != null ? zahl(p.sprit, 1) : "–";
  $("sVerbrauch").textContent = v ? liter(v, 2) : "–";
  $("sReicht").textContent = v && p?.sprit != null ? zahl(p.sprit / v, 1) : "–";
  $("sSchnitt").textContent = zeitText(schnitt);
}

function spritZeigen() {
  spritKacheln();
  const form = $<HTMLFormElement>("sForm");
  const art = (form.elements.namedItem("art") as HTMLSelectElement).value === "runden" ? "runden" : "zeit";
  $("sRestLabel").textContent = art === "zeit" ? "Restzeit in Minuten" : "Restrunden";
  const rest = Number((form.elements.namedItem("rest") as HTMLInputElement).value);
  const reserve = Number((form.elements.namedItem("reserve") as HTMLInputElement).value);
  const p = zaehler.jetzt;
  const v = verbrauchProRunde(zaehler.runden);
  const ziel = $("sErgebnis");
  ziel.replaceChildren();
  if (!v || p?.sprit == null) {
    ziel.append(neu("p", "leer", "Sobald eine saubere Runde gefahren ist, rechne ich hier aus, ob der Sprit bis ins Ziel reicht."));
    return;
  }
  if (!Number.isFinite(rest) || rest < 0 || rest > 1440 || !Number.isFinite(reserve) || reserve < 0 || reserve > 5) {
    ziel.append(neu("p", "warn", "Bitte gültige Werte eingeben (Restzeit bis 1440 Minuten, Reserve 0–5 Runden)."));
    return;
  }
  const b = bisZiel({ sprit: p.sprit, verbrauch: v, rundenzeit: rundenzeitSchnitt(zaehler.runden), rest: art === "zeit" ? { sekunden: rest * 60 } : { runden: rest }, reserveRunden: reserve });
  if (!b) {
    ziel.append(neu("p", "leer", "Für Zeitrennen brauche ich zuerst eine gültige Runde (Rundenzeit)."));
    return;
  }
  const zeile = (titel: string, wert: string, klasse = "") => {
    const d = neu("div", `ergebnis-zeile ${klasse}`);
    d.append(neu("span", "", titel), neu("strong", "", wert));
    return d;
  };
  ziel.append(
    zeile("Runden bis ins Ziel", String(b.rundenNoetig)),
    zeile("Sprit nötig (mit Reserve)", liter(b.spritNoetig)),
    b.reicht ? zeile("Ergebnis", "Reicht ohne Tankstopp", "gut") : zeile("Nachtanken", `mindestens ${liter(b.nachtanken)}`, "warn"),
  );
}
// Messwerte an den Stint-Planer der Webseite (er fragt vor dem Übernehmen nach)
$("sStintKnopf").addEventListener("click", async () => {
  const anzeige = $("sStintStatus");
  const gueltige = zaehler.runden.filter((r) => r.gueltig);
  const rundenzeit = rundenzeitSchnitt(zaehler.runden);
  const verbrauch = verbrauchProRunde(zaehler.runden);
  if (!gueltige.length || (rundenzeit == null && verbrauch == null)) {
    anzeige.textContent = "Fahr zuerst ein paar saubere Runden – dann kann ich Rundenzeit und Verbrauch übergeben.";
    return;
  }
  const echt = !demo.laeuft && status?.verbunden === true;
  const daten = messwerteKodieren({
    rundenzeit, verbrauch, runden: Math.min(5, gueltige.length),
    simulation: echt ? "iRacing" : "",
    strecke: sitzung?.strecke ?? "", fahrzeug: sitzung?.fahrzeug ?? "",
  });
  if (istApp) {
    anzeige.textContent = "Der Stint-Planer öffnet sich hier in der App – bestätige dort die Übernahme.";
    webBereichZeigen("stintplaner.html", `messwerte=${daten}`);
  } else {
    window.open(`https://gsra-webseite.vercel.app/stintplaner.html#messwerte=${daten}`, "_blank", "noopener");
    anzeige.textContent = "Der Stint-Planer öffnet sich im Browser – bestätige dort die Übernahme.";
  }
});

$("lMitfahren").addEventListener("click", () => hinweis(mitfahrenUmschalten(), "ok"));

// Prüf-Fenster „Werte aus iRacing“ (Fund 28.11.: X und Schaden kamen beim Renningenieur nicht an) – nur wenn aufgeklappt
const LAGE_TEXT: Record<string, string> = { "-1": "nicht im Auto", "0": "neben der Strecke", "1": "Box-Platz", "2": "Boxeneinfahrt", "3": "auf der Strecke" };
window.setInterval(() => {
  const roh = document.getElementById("lRoh") as HTMLDetailsElement | null;
  if (!roh?.open) return;
  const p = zaehler.jetzt;
  const ich = letztesFeld?.ich;
  const info = ich != null ? (sitzung?.fahrer ?? []).find((x) => x.idx === ich) : undefined;
  const a = fahrverhalten.auswirkung();
  const e = crashWaechter.letzter;
  const g = p?.querBeschl != null && p.laengsBeschl != null ? Math.hypot(p.querBeschl, p.laengsBeschl) / 9.81 : null;
  const s = strafeAus(p?.flaggen);
  const w = p?.motorWarnung ?? 0;
  const letzte = zaehler.runden.at(-1);
  const zeilen: Array<[string, string]> = [
    ["X (Telemetrie)", p?.vorfaelle != null ? `${p.vorfaelle} X` : "– (liefert iRacing nicht)"],
    ["X (Fahrerliste)", info?.vorfaelle != null ? `${info.vorfaelle} X` : "–"],
    ["Ausflüge (selbst gezählt)", String(a.ausfluege)],
    ["Lage", p?.lage != null ? (LAGE_TEXT[String(p.lage)] ?? String(p.lage)) : "–"],
    ["Flaggen", p?.flaggen != null ? (s === "strafe" ? "Strafe offen" : s === "verwarnung" ? "Verwarnung" : s === "reparatur" ? "Fleischball" : "keine") : "–"],
    ["Reparatur (Pflicht/optional)", p?.reparatur != null || p?.reparaturOptional != null ? `${Math.round(p?.reparatur ?? 0)} s / ${Math.round(p?.reparaturOptional ?? 0)} s` : "–"],
    ["Motor-Warnungen", p?.motorWarnung != null ? ([w & 1 ? "Wasser" : "", w & 2 ? "Benzindruck" : "", w & 4 ? "Öldruck" : "", w & 0x40 ? "Öltemperatur" : ""].filter(Boolean).join(", ") || "keine") : "–"],
    ["Beschleunigung", g != null ? `${zahl(g, 1)} g` : "–"],
    ["Letzter Einschlag", e && p?.zeit != null ? `vor ${Math.round(p.zeit - e.zeit)} s, ${zahl(e.g, 1)} g, vorher ${e.tempoVorherKmh} km/h` : "keiner"],
    ["Lenkrad auf Geraden", a.lenkungSchiefGrad != null ? `${zahl(a.lenkungSchiefGrad, 1)}° schief` : "gerade"],
    ["Topspeed", a.topspeedJetztKmh != null ? `${a.topspeedJetztKmh} km/h (vorher ${a.topspeedVorherKmh})` : "unverändert"],
    ["Letzte Runde", letzte ? (letzte.gueltig ? "gültig" : `ungültig – ${letzte.grund ?? ""}`) : "–"],
    ["Piepton", mitfahrer ? `an – ${mitfahrer.stellen.length} Bremspunkte` : "aus"],
  ];
  $("lRohListe").replaceChildren(...zeilen.flatMap(([k, v]) => [neu("dt", "", k), neu("dd", "", v)]));
}, 500);
$("sForm").addEventListener("input", () => spritZeigen());
$("sForm").addEventListener("submit", (e) => e.preventDefault());

// ---------------------------------------------------------------- Start
statusZeigen();
live();
if (istApp) {
  appVerbinden().catch(() => {
    status = { simulation: "iracing", verbunden: false, meldung: "Verbindung zur App-Schicht fehlgeschlagen", sitzung: null };
    statusZeigen();
  });
}
// Datenschutz-Hinweis der App
for (const id of ["dsKnopf", "dsKnopf2"]) $(id).addEventListener("click", () => $<HTMLDialogElement>("dsDialog").showModal());
$("dsZu").addEventListener("click", () => $<HTMLDialogElement>("dsDialog").close());

funkEinrichten();
// Windows-Stimme als Ton (systemstimme.rs): Spotter vorne, Renningenieur leiser im Hintergrund statt abgebrochen
if (istApp) {
  systemTonSetzen(async (text, stimme, tempo, hoehe) => {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<ArrayBuffer>("systemstimme", { text, stimme: stimme.name, sprache: stimme.lang, tempo, hoehe });
  });
}
void webEinrichten(istApp);
// Automatische Updates (signiert, von GitHub); ein bereitliegendes Update installiert sich beim Schließen
const aktualisierung = aktualisierungEinrichten(istApp, hinweis, () => !status?.verbunden && !demo.laeuft && !funkBeschaeftigt()).catch(() => null);
void fensterEinrichten(istApp, async () => (await aktualisierung)?.vorDemSchliessen() ?? false).catch(() => { /* ohne eigene Fensterleiste weiter */ });
// Profilbild oben neben dem Konto, Suche der Webseite über die Lupe oder Strg+K (ein Kopf für alles, Wunsch 27.11.)
beiKontoWechsel(() => void profilbildZeigen().catch(() => undefined));
$("kopfSuche").addEventListener("click", () => void webSuche(() => webBereichZeigen("index.html")));
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    void webSuche(() => webBereichZeigen("index.html"));
  }
});
// Namen nur für angemeldete Mitglieder (Datenbank-Regel wie auf der Webseite) – also auch nach der Anmeldung starten
beiKontoWechsel(() => { if (angemeldet()) void sichtbarkeitStarten().catch(() => { /* ohne Namen weiter */ }); });
berichtKiEinrichten();
chatEinrichten();
// Roter Punkt am Messenger (wie auf der Webseite): alle 45 s und beim Zurückkehren in die App nachsehen
function punktSetzen(neu: boolean) {
  $("messengerPunkt").hidden = !neu;
  $("messengerPunktText").hidden = !neu;
  $("navMessenger").classList.toggle("ungelesen", neu);
}
async function messengerPunkt() {
  punktSetzen(angemeldet() && !document.hidden ? await messengerHinweis().catch(() => false) : false);
}
setInterval(() => void messengerPunkt(), 45_000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) void messengerPunkt(); });
beiKontoWechsel(() => void messengerPunkt());
void messengerPunkt();

const sprechtaste = sprechtasteEinrichten(istApp, (text) => {
  sprachfrageZeit = Date.now();
  if (aktiverReiter !== "chat") hinweis(`Du: ${text.slice(0, 160)}`, "ok");
  void chat?.senden(text);
}, hinweis, () => persoenlichkeit?.name ?? "Kim", () => {
  // Nichts verstanden: sofort ein fertiger Satz in der Sprache des Fahrers, statt still zu bleiben
  const code = ansageSprache();
  const satz = nichtVerstanden(code);
  if (aktiverReiter !== "chat") hinweis(satz, "fehler");
  void sprechen(satz, { ...funkE, vorlesen: true }, { sprache: code, stimmlage: persoenlichkeit?.stimme ?? "ruhig" });
}).catch(() => null);

// Eigene Stimme (geklont aus einer Aufnahme mit Zustimmung, nur auf dem PC)
void eigeneStimmeEinrichten(istApp, hinweis, () => funkE, () => persoenlichkeit?.name ?? "Kim",
  () => [...pruefSaetze(persoenlichkeit?.art ?? "kumpel"), nichtVerstanden("de"), nochDran("de")]).catch(() => undefined);

// Renningenieur einstellen (unten im Bereich Renningenieur)
const reEinstellungen = reEinstellungenEinrichten({
  angemeldet,
  hinweis,
  gespeichert: async () => {
    persoenlichkeit = await persoenlichkeitLaden().catch(() => persoenlichkeit);
    stimmenFuellen();
    $("cName").textContent = `${persoenlichkeit?.name ?? "Dein Renningenieur"} beantwortet Einfaches sofort, Schwieriges schaut er sich kurz an`;
    (await sprechtaste)?.nameGeaendert(persoenlichkeit?.name ?? "Kim");
  },
  probe: (e) => {
    // Probefunk in der gewählten Sprache (Fund 26.11.: bisher deutscher Satz, z. B. von der englischen Stimme gelesen)
    const code = e.sprache === "auto" ? (frageSprache ?? "de") : e.sprache;
    void sprechen(ansage(code, "probe", { name: e.name || "Kim" }), { ...funkE, vorlesen: true }, { sprache: code, stimmlage: e.stimme as "ruhig", sofort: true });
  },
});

// Keine Stimme für die Sprache installiert: einmal je Sprache erklären, wie man sie in Windows hinzufügt
const stimmeGemeldet = new Set<string>();
beiFehlenderStimme((code) => {
  if (stimmeGemeldet.has(code)) return;
  stimmeGemeldet.add(code);
  hinweis(`Für ${spracheName(code)} ist auf diesem PC keine Vorlese-Stimme installiert – deshalb bleibt der Funk stumm statt mit einer fremden Stimme zu sprechen. So kommt sie dazu: Windows-Einstellungen › Zeit und Sprache › Sprache und Region › Sprache hinzufügen › ${spracheName(code)} (mit „Sprachausgabe“), danach die App neu starten.`, "fehler");
});
beiKontoWechsel(() => void reEinstellungen.laden());
void reEinstellungen.laden();
sparZeigen();
void kontoStarten(istApp);
window.addEventListener("resize", () => {
  if (aktiverReiter === "live" && !webAktiv()) live();
});
