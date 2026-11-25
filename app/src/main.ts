// GSRA-App – Oberfläche: Live, Runden, Vergleich, Sprit & Stint.
// Daten kommen aus der Simulation (Rust, Ereignisse „gsra://…“) oder aus der Demo. Alle Texte per textContent.

import { Rundenzaehler, type Runde } from "./runden.ts";
import { abtasten, kurvenFinden, kurvenName, meterText, sekunden, vergleichen, zahl, zeitBei, RASTER, type Befund, type Spur } from "./analyse.ts";
import { bisZiel, rundenzeitSchnitt, verbrauchProRunde } from "./sprit.ts";
import { DemoQuelle } from "./demo.ts";
import { Diagramme, verlaufZeichnen, type Plot } from "./diagramm.ts";
import type { Feld, Probe, Sitzung, Status } from "./typen.ts";
import { angemeldet, beiKontoWechsel, hinweis, kontoStarten } from "./konto-ansicht.ts";
import { aufnahmeAbspielen, funkLaden, funkSpeichern, sprechen, spotterSprechen, stimmenFuer } from "./funk.ts";
import { kiFragen, kiVerfuegbar, merkenSpeichern, persoenlichkeitLaden, type Persoenlichkeit } from "./ki.ts";
import { messwerteKodieren } from "../../src/stint-messwerte.ts";
import { bremspunkte, sparAuswerten, sparBasis, sparText, sparTipp, type Bremspunkt, type SparAuswertung, type SparBasis } from "./sparen.ts";
import { Chat, pruefSatz } from "./chat.ts";
import { Spotter, spotterSatz } from "./spotter.ts";
import { abstandSatz, type Gegner } from "./vorlagen.ts";
import { Feldrunden, deltaZu, verlustIn } from "./feldreferenz.ts";
import { namenErsetzen } from "./datenschutz.ts";
import { karteBauen, karteZeichnen, verlustJeAbschnitt, type Karte } from "./strecke.ts";
import { Rennbeobachter, berichtErstellen, rundenzeitText, stelleText } from "./rennbericht.ts";
import { startbildZeigen } from "./startbild.ts";

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
const typischeRundenzeit = () => rundenzeitSchnitt(zaehler.runden) ?? zaehler.beste?.zeit ?? 90;
// Spotter: „Auto links/rechts“ sofort und ohne KI (Wunsch 25.11.)
let letzteSeite: number | null = null;
const spotter = new Spotter((s) => {
  const sprache = persoenlichkeit?.sprache ?? "de";
  spotterSprechen(spotterSatz(s, sprache), funkE, sprache);
});

let letztesFeld: Feld | null = null;
// Referenz aus der Lobby: schnellste geprüfte Runde eines anderen Fahrers (nur auf diesem PC)
const feldRef = new Feldrunden();
let feldRefBekannt = 0;
function feldAufnehmen(f: Feld) {
  if (!f || !Array.isArray(f.anteil)) return;
  letztesFeld = f;
  beobachter.aufnehmen(f, typischeRundenzeit());
  feldRef.laengeSetzen(laenge());
  feldRef.aufnehmen(f);
  // neue Referenzrunde? Dann den Vergleich auffrischen
  const s = feldRef.schnellste();
  const kennung = s ? s.idx * 1e6 + Math.round(s.zeit * 1000) : 0;
  if (kennung !== feldRefBekannt) {
    feldRefBekannt = kennung;
    if (aktiverReiter === "vergleich") feldRefZeigen();
  }
}

const demo = new DemoQuelle((liste) => proben(liste), (f) => feldAufnehmen(f));

const laenge = () => sitzung?.streckenlaengeM ?? (groessterMeter > 500 ? groessterMeter : null);

// ---------------------------------------------------------------- Reiter
let aktiverReiter = "live";
function reiterZeigen(name: string) {
  aktiverReiter = name;
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-reiter]")) b.setAttribute("aria-selected", String(b.dataset.reiter === name));
  for (const s of document.querySelectorAll<HTMLElement>("[data-seite]")) s.classList.toggle("aktiv", s.dataset.seite === name);
  if (name === "vergleich") vergleichZeigen();
  if (name === "sprit") spritZeigen();
  if (name === "runden") rundenZeigen();
  if (name === "bericht") berichtZeigen();
}
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-reiter]")) b.addEventListener("click", () => reiterZeigen(b.dataset.reiter ?? "live"));

// ---------------------------------------------------------------- Verbindung / Status
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
    text.textContent = status?.meldung ?? "Warte auf iRacing …";
  } else {
    led.className = "led aus";
    text.textContent = "Browser-Vorschau";
  }
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
  if (!demo.laeuft && s.sitzung) sitzung = s.sitzung;
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
  const abstand = abstandSatz(persoenlichkeit?.art ?? "kumpel", gegner.vor, gegner.hinter);
  funkMelden([sparSatz ?? text, abstand].filter(Boolean).join(" "), { ...rundenLage(r, befund), vor_mir: gegner.vor, hinter_mir: gegner.hinter });
  // Karte aus der ersten gültigen Runde mit Fahrtrichtung; Kurvennummern aus der Bestzeit
  if (!karte && r.gueltig) karte = karteBauen(r.punkte);
  if (beste && beste.punkte.length > 10) kurvenMarken = kurvenFinden(spur(beste), laenge() ?? 4000).map((k) => ({ i: k.scheitel, text: String(k.nr) }));
  if (beste === r) letzterVerlust = null;
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
function kiLage(lage: Record<string, unknown>): Record<string, unknown> {
  if (funkE.namenAnKi) return lage;
  return namenErsetzen(lage, sitzung?.fahrer ?? []) as Record<string, unknown>;
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
    bestzeit_s: runden3(beste?.zeit),
    neue_bestzeit: beste === r,
    hinter_bestzeit_s: beste && beste !== r && r.gueltig ? runden3(r.zeit - beste.zeit) : null,
    groesster_verlust: b ? { stelle: kurvenName(b.kurve, laenge() ?? 4000), verlust_s: runden3(b.verlust), ursache: b.ursachen[0] ?? null, tipp: b.tipp } : null,
    sprit_l: runden3(sprit),
    sprit_reicht_runden: v && sprit != null ? Math.floor((sprit / v) * 10) / 10 : null,
    platz: beobachter.platz,
    sparen: sparLage(),
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
  stimmenFuellen();
  if ("speechSynthesis" in window) window.speechSynthesis.addEventListener("voiceschanged", stimmenFuellen);
  $("fProbe").addEventListener("click", () => {
    const name = persoenlichkeit?.name ?? "Kim";
    void vorlesen(`Funkcheck. Hier ist ${name}, ich höre dich laut und deutlich. Sprit reicht für sieben Runden, Box in Runde 23.`);
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
      : "Angemeldet formuliert dein KI-Renningenieur die Ansagen in seinem Stil (eingestellt auf der Webseite unter „Renningenieur“).";
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
    zeitverlust_kurven: b.kurven.filter((k) => k.runden > 0 && k.schnitt > 0.005).slice(0, 6)
      .map((k) => ({ kurve: `Kurve ${k.kurve.nr}`, schnitt_verlust_s: runden3(k.schnitt), tipp: k.tipp || null })),
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
type Nachbar = { idx: number; name: string; nummer: string; abstand_s: number | null } | null;

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
  const finden = (platz: number): Nachbar => {
    const i = f.platz.findIndex((p) => p === platz);
    if (i < 0) return null;
    const info = fahrer.find((x) => x.idx === i);
    const abstand = Math.abs(fortschritt(i) - fortschritt(f.ich!)) * typischeRundenzeit();
    return { idx: i, name: info?.name ?? `Auto ${i}`, nummer: info?.nummer ?? "", abstand_s: Number.isFinite(abstand) ? Math.round(abstand * 10) / 10 : null };
  };
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
  if (phase === "nachbesprechung") return { anlass: "frage", phase, ...berichtLage() };
  return {
    anlass: "frage",
    phase,
    sitzung: sitzung?.sitzungsart ?? (demo.laeuft ? "Demo" : null),
    strecke: sitzung?.strecke ?? null,
    fahrzeug: sitzung?.fahrzeug ?? null,
    aktuelle_runde: zaehler.laufend?.nr ?? null,
    gefahrene_runden: zaehler.runden.length,
    letzte_runde_s: letzte ? runden3(letzte.zeit) : null,
    letzte_runde_gueltig: letzte?.gueltig ?? null,
    bestzeit_s: runden3(zaehler.beste?.zeit),
    schnitt_s: runden3(rundenzeitSchnitt(zaehler.runden)),
    sprit_l: runden3(sprit),
    verbrauch_pro_runde_l: runden3(v),
    sprit_reicht_runden: v && sprit != null ? Math.floor((sprit / v) * 10) / 10 : null,
    platz: beobachter.platz,
    vor_mir: vor,
    hinter_mir: hinter,
    letzte_runde_groesster_verlust: letzterBefund ? { stelle: kurvenName(letzterBefund.kurve, laenge() ?? 4000), verlust_s: runden3(letzterBefund.verlust), ursachen: letzterBefund.ursachen.slice(0, 3), tipp: letzterBefund.tipp } : null,
    im_schnitt_verlust: b ? b.kurven.filter((k) => k.runden > 0 && k.schnitt > 0.005).slice(0, 3).map((k) => ({ kurve: `Kurve ${k.kurve.nr}`, schnitt_verlust_s: runden3(k.schnitt), tipp: k.tipp || null })) : [],
    zweikaempfe: b ? b.kaempfe.slice(-3).map((k) => ({ gegner: k.name, runden: k.dauerRunden, knappster_abstand_s: runden3(k.minAbstand) })) : [],
    sparen: sparLage(),
    gegen_schnellsten: gegenSchnellstenLage(),
  };
}

/** Einfache Fakten ohne KI (sofort, auch offline) */
function lokaleAntwort(frage: string): string | null {
  const t = frage.toLowerCase();
  const { vor, hinter } = nachbarn();
  const nachbarText = (n: Nachbar, wo: string) => n
    ? `${wo} fährt ${n.nummer ? `#${n.nummer} ` : ""}${n.name}${n.abstand_s != null ? `, etwa ${zahl(n.abstand_s, 1)} s` : ""}.`
    : `${wo} ist gerade niemand – oder ich habe noch keine Daten vom Feld.`;
  const live = /vor mir|vordermann|vorne|vorn\b|vorder|hinter mir|hintermann|hinten/.test(t);
  if (live && phase === "nachbesprechung") return "Die Sitzung ist vorbei – frag mich lieber, was du in den Zweikämpfen oder an einer Stelle besser machen kannst.";
  if (/vor mir|vordermann|vorne|vorn\b|vorder/.test(t)) return nachbarText(vor, "Vor dir");
  if (/hinter mir|hintermann|hinten/.test(t)) return nachbarText(hinter, "Hinter dir");
  if (/sprit|tank|reicht|verbrauch/.test(t) && !/spar/.test(t)) {
    const v = verbrauchProRunde(zaehler.runden);
    const sprit = zaehler.jetzt?.sprit;
    if (!v || sprit == null) return "Für den Verbrauch brauche ich erst eine saubere Runde.";
    return `Du hast ${zahl(sprit, 1)} l im Tank und verbrauchst ${zahl(v, 2)} l pro Runde – das reicht für etwa ${zahl(Math.floor((sprit / v) * 10) / 10, 1)} Runden. Ob es bis ins Ziel reicht, siehst du unter „Sprit & Stint“.`;
  }
  if (/letzte runde/.test(t)) {
    const r = zaehler.runden.at(-1);
    return r ? `Deine letzte Runde: ${zeitText(r.zeit)}${r.gueltig ? "" : ` (zählt nicht: ${r.grund ?? "ungültig"})`}.` : "Du hast noch keine Runde beendet.";
  }
  if (/bestzeit|beste runde|schnellste/.test(t)) return zaehler.beste ? `Deine Bestzeit: ${zeitText(zaehler.beste.zeit)} in Runde ${zaehler.beste.nr}.` : "Noch keine gültige Runde – noch keine Bestzeit.";
  if (/platz|position/.test(t)) return beobachter.platz != null ? `Du liegst auf Platz ${beobachter.platz}.` : "Den Platz kenne ich nur im Rennen mit anderen Autos.";
  return null;
}

let chat: Chat | null = null;
function chatEinrichten() {
  chat = new Chat($("cListe"), {
    lage: () => kiLage(chatLage()),
    angemeldet,
    art: () => persoenlichkeit?.art ?? "kumpel",
    name: () => persoenlichkeit?.name ?? "Renningenieur",
    lokal: lokaleAntwort,
    vorlesen: (text) => { if (funkE.vorlesen) void vorlesen(text); },
    sparenStarten: () => {
      if (!spar.aktiv) return sparStarten();
      const a = spar.runden.at(-1);
      return a ? sparText(a, null, sparStelle) : "Der Spar-Modus läuft schon – nach der nächsten Runde sage ich dir, ob es reicht.";
    },
  });
  const feld = $<HTMLInputElement>("cFeld");
  $<HTMLFormElement>("cForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = feld.value;
    feld.value = "";
    void chat?.senden(text);
  });
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
  $("rundenAnzahl").textContent = String(runden.length);
  $("rLeer").hidden = runden.length > 0;
  $("rTabelle").hidden = runden.length === 0;
  const zeilen = [...runden].reverse().slice(0, 200).map((r) => {
    const tr = neu("tr", r === beste ? "beste" : r.gueltig ? "" : "ungueltig");
    tr.append(neu("td", "", String(r.nr)), neu("td", "zeit", zeitText(r.zeit)));
    tr.append(neu("td", "", beste && r.gueltig && r !== beste ? `+${zahl(r.zeit - beste.zeit, 3)}` : r === beste ? "Bestzeit" : "–"));
    tr.append(neu("td", "", liter(r.sprit, 2)));
    tr.append(neu("td", r.gueltig ? "ok" : "warn", r.gueltig ? "gültig" : (r.grund ?? "ungültig")));
    const td = neu("td");
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

function auswahlFuellen() {
  const mitDaten = zaehler.runden.filter((r) => r.punkte.length > 10);
  const beste = zaehler.beste;
  if (!auswahl.ref || !mitDaten.includes(auswahl.ref)) auswahl.ref = beste ?? mitDaten[0] ?? null;
  if (!auswahl.x || !mitDaten.includes(auswahl.x) || auswahl.x === auswahl.ref) {
    auswahl.x = [...mitDaten].reverse().find((r) => r !== auswahl.ref && r.gueltig) ?? [...mitDaten].reverse().find((r) => r !== auswahl.ref) ?? null;
  }
  for (const [id, gewaehlt] of [["vRef", auswahl.ref], ["vX", auswahl.x]] as const) {
    const sel = $<HTMLSelectElement>(id);
    const optionen = [...mitDaten].reverse().map((r) => {
      const o = neu("option", "", rundenName(r, beste));
      o.value = String(zaehler.runden.indexOf(r));
      o.selected = r === gewaehlt;
      return o;
    });
    if (!gewaehlt) {
      const leer = neu("option", "", id === "vRef" ? "– noch keine Runde –" : "– noch keine zweite Runde –");
      leer.value = "";
      leer.disabled = true;
      leer.selected = true;
      optionen.unshift(leer);
    }
    sel.replaceChildren(...optionen);
  }
}
for (const id of ["vRef", "vX"] as const) {
  $<HTMLSelectElement>(id).addEventListener("change", (e) => {
    const r = zaehler.runden[Number((e.target as HTMLSelectElement).value)] ?? null;
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
  const l = laenge() ?? 4000;
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

function gegenSchnellsten(): GegenSchnellsten | null {
  const s = feldRef.schnellste();
  const beste = zaehler.beste;
  if (!s || !beste || beste.punkte.length < 10) return null;
  const L = laenge() ?? 4000;
  const meine = spur(beste);
  const d = deltaZu(s, meine.t);
  const kurven = kurvenFinden(meine, L);
  const info = (sitzung?.fahrer ?? []).find((x) => x.idx === s.idx);
  return {
    name: info?.name ?? `Auto ${s.idx}`, nummer: info?.nummer ?? "", zeit: s.zeit, meine: beste.zeit, rueckstand: beste.zeit - s.zeit, delta: d,
    verluste: kurven.map((k) => ({ kurve: k.nr, verlust: verlustIn(d, k.start, k.ende) })).sort((a, b) => b.verlust - a.verlust),
  };
}

function gegenSchnellstenLage(): Record<string, unknown> | null {
  const g = gegenSchnellsten();
  if (!g) return null;
  return {
    fahrer: `${g.nummer ? `#${g.nummer} ` : ""}${g.name}`, seine_zeit_s: runden3(g.zeit), meine_bestzeit_s: runden3(g.meine), rueckstand_s: runden3(g.rueckstand),
    groesste_verluste: g.verluste.filter((v) => v.verlust > 0.02).slice(0, 3).map((v) => ({ kurve: `Kurve ${v.kurve}`, verlust_s: runden3(v.verlust) })),
    hier_schneller: g.verluste.filter((v) => v.verlust < -0.02).slice(-2).map((v) => ({ kurve: `Kurve ${v.kurve}`, gewinn_s: runden3(-v.verlust) })),
  };
}

function feldRefZeigen() {
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
  $("vKurz").hidden = !bereit || ebene !== "kurz";
  $("vGenau").hidden = !bereit || ebene !== "genau";
  if (!bereit || !ref || !x) return;
  const l = laenge() ?? 4000;
  const sr = spur(ref);
  const sx = spur(x);
  const v = vergleichen(sr, sx, l);
  // Karte: rot, wo die Vergleichsrunde Zeit verliert; die teuersten Kurven hervorgehoben
  vKarteDaten = {
    verlust: verlustJeAbschnitt(v.delta),
    marken: v.kurven.map((k) => ({ i: k.scheitel, text: String(k.nr), wichtig: v.befunde.some((b) => b.kurve.nr === k.nr) })),
    karte: karte ?? karteBauen(ref.punkte),
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

  const xText = (i: number) => (laenge() ? meterText((i / RASTER) * l) : `${Math.round((i / RASTER) * 100)} %`);
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
  try {
    if (istApp) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("stintplaner_oeffnen", { messwerte: daten });
    } else {
      window.open(`https://gsra-webseite.vercel.app/stintplaner.html#messwerte=${daten}`, "_blank", "noopener");
    }
    anzeige.textContent = "Der Stint-Planer öffnet sich im Browser – bestätige dort die Übernahme.";
  } catch (e) {
    anzeige.textContent = typeof e === "string" ? e : "Der Browser konnte nicht geöffnet werden.";
  }
});

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
funkEinrichten();
berichtKiEinrichten();
chatEinrichten();
sparZeigen();
void kontoStarten(istApp);
window.addEventListener("resize", () => {
  if (aktiverReiter === "live") live();
});
