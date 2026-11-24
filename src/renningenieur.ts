// GSRA – KI-Renningenieur (Garage), SQL 048. Grundstein vom 24.11.2026:
//  * Persönlichkeit: Name, Anrede, Art (Kumpel, Profi, Motivator, Knapp), Gesprächigkeit, Stimme, Sprache, Themen
//  * Probefunk: Beispiel-Ansagen und -Antworten im gewählten Stil, gesprochen über die Sprachausgabe des Browsers
//    (läuft auf dem Gerät, keine Daten nach außen). Im Rennen kommen Fakten später aus den Live-Daten der App und
//    die Formulierung von einer KI – die Fakten bleiben dabei immer die gemessenen Werte.
//  * Gedächtnis: Einträge, die nur die Person selbst sieht und jederzeit löscht
// Alles wird mit textContent ausgegeben; geschrieben wird nur über geprüfte Datenbank-Funktionen.
import { dialog, supabaseClient, toast } from "./fenster";

type Art = "kumpel" | "profi" | "motivator" | "knapp";
type Thema = "sprit" | "abstaende" | "flaggen" | "reifen" | "coaching" | "wetter";
type Einstellungen = { name: string; rufname: string | null; art: Art; gespraechig: "still" | "normal" | "viel";
  stimme: "ruhig" | "energisch" | "tief" | "hell"; sprache: "de" | "en"; themen: Record<Thema, boolean> };
type Eintrag = { id: string; art: string; text: string; quelle: string; created_at: string };
type Fehler = { message: string } | null;
type Client = {
  from: (t: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Fehler }>;
  auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
};

const THEMEN: Record<Thema, { text: string; icon: string }> = {
  sprit: { text: "Sprit und Boxenfenster", icon: "fa-gas-pump" },
  abstaende: { text: "Abstände und Gegner", icon: "fa-people-arrows" },
  flaggen: { text: "Flaggen und Unfälle", icon: "fa-flag" },
  reifen: { text: "Reifen und Temperaturen", icon: "fa-circle-notch" },
  coaching: { text: "Coaching-Tipps", icon: "fa-graduation-cap" },
  wetter: { text: "Wetter", icon: "fa-cloud-rain" },
};
const ARTEN_GEDAECHTNIS: Record<string, string> = { vorliebe: "Vorliebe", ziel: "Ziel", staerke: "Stärke", schwaeche: "Daran arbeite ich", notiz: "Notiz" };
const STANDARD: Einstellungen = { name: "Kim", rufname: null, art: "kumpel", gespraechig: "normal", stimme: "ruhig", sprache: "de",
  themen: { sprit: true, abstaende: true, flaggen: true, reifen: true, coaching: true, wetter: true } };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const client = () => supabaseClient<Client>();
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text = "") => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text) e.textContent = text;
  return e;
};

const zustand = { ich: null as string | null, e: { ...STANDARD } as Einstellungen, gedaechtnis: [] as Eintrag[] };

// ---------------------------------------------------------
// Beispiel-Funk im gewählten Stil (Beispieldaten – im Rennen kommen die Werte aus der Simulation)
// ---------------------------------------------------------
const ANSAGEN: Record<Thema, Record<Art, string>> = {
  sprit: {
    kumpel: "Sprit sieht gut aus – reicht noch für sieben Runden. Wir holen dich in Runde 23 rein, alles entspannt.",
    profi: "Kraftstoff für sieben Runden. Boxenstopp in Runde 23.",
    motivator: "Sprit passt perfekt, sieben Runden Reserve! Bis Runde 23 kannst du voll angreifen.",
    knapp: "Sprit: sieben Runden. Box Runde 23.",
  },
  abstaende: {
    kumpel: "Startnummer 27 ist 1,2 Sekunden vor dir, und du holst pro Runde zwei Zehntel. Das wird was.",
    profi: "Abstand nach vorn 1,2 Sekunden, Tendenz minus zwei Zehntel pro Runde. Nach hinten 2,0 stabil.",
    motivator: "Nur noch 1,2 Sekunden auf die 27 – du bist schneller, hol ihn dir!",
    knapp: "Vorne 1,2. Hinten 2,0.",
  },
  flaggen: {
    kumpel: "Achtung, Gelb in Sektor 2 – Unfall in Kurve 9. Fahr rechts vorbei und lass es kurz ruhig angehen.",
    profi: "Gelbe Flagge Sektor 2, Fahrzeug in Kurve 9 links. Überholverbot.",
    motivator: "Gelb in Sektor 2, Kurve 9 – kurz vorsichtig, danach gehört die Strecke wieder dir!",
    knapp: "Gelb Sektor 2. Kurve 9 links.",
  },
  reifen: {
    kumpel: "Vorne links wird es warm, 92 Grad. Nimm in den schnellen Rechtskurven ein bisschen Druck raus.",
    profi: "Reifen vorne links 92 Grad, oberhalb des Fensters. Last in schnellen Rechtskurven reduzieren.",
    motivator: "Reifen sind noch top – nur vorne links etwas heiß. Ein bisschen sauberer, dann hält das bis zum Stopp!",
    knapp: "Vorne links 92 Grad. Rechtskurven schonen.",
  },
  coaching: {
    kumpel: "Kleiner Tipp: In Kurve 4 kannst du etwa zehn Meter später bremsen – deine Bestzeit zeigt, dass da Luft ist.",
    profi: "Kurve 4: Bremspunkt zehn Meter später möglich, Potenzial etwa eine Zehntel.",
    motivator: "In Kurve 4 liegt noch eine Zehntel – zehn Meter später bremsen, du kannst das!",
    knapp: "Kurve 4: zehn Meter später bremsen.",
  },
  wetter: {
    kumpel: "Regen kommt in etwa zwölf Minuten. Wir bleiben draußen, ich sag dir rechtzeitig Bescheid.",
    profi: "Regen in etwa zwölf Minuten erwartet. Wir bleiben auf Slicks, Wechselpunkt beobachte ich.",
    motivator: "Regen in zwölf Minuten – genau dein Wetter. Ich sag dir, wann wir wechseln!",
    knapp: "Regen in zwölf Minuten. Draußen bleiben.",
  },
};
const FRAGEN: Array<{ frage: string; thema: Thema; antwort: Record<Art, string> }> = [
  { frage: "Wie viel Sprit habe ich noch?", thema: "sprit", antwort: {
    kumpel: "Noch 18,4 Liter – das reicht für sieben Runden. Bis zum Stopp brauchst du dir keinen Kopf zu machen.",
    profi: "18,4 Liter, sieben Runden bei aktuellem Verbrauch. Stopp in Runde 23 bleibt.",
    motivator: "18,4 Liter, sieben Runden – genug, um weiter Druck zu machen!", knapp: "18,4 Liter. Sieben Runden." } },
  { frage: "Wie heißt der Fahrer vor mir?", thema: "abstaende", antwort: {
    kumpel: "Vor dir fährt die Startnummer 27 – im Rennen sage ich dir hier seinen Namen aus der Startliste. Er ist 1,2 Sekunden weg und in Sektor 3 langsamer als du.",
    profi: "Vor dir Startnummer 27, 1,2 Sekunden. Im Rennen nenne ich den Namen aus der Startliste. Er verliert in Sektor 3.",
    motivator: "Startnummer 27 – den Namen sage ich dir im Rennen live. Und er ist in Sektor 3 langsamer als du!",
    knapp: "Startnummer 27. 1,2 Sekunden." } },
  { frage: "Wie sind meine Reifen?", thema: "reifen", antwort: {
    kumpel: "Drücke passen, hinten beide im Fenster. Nur vorne links ist mit 92 Grad etwas heiß – sonst alles im grünen Bereich.",
    profi: "Heißdrücke im Zielbereich. Vorne links 92 Grad, übrige zwischen 82 und 86.",
    motivator: "Die Reifen sind gut drauf – vorne links nur ein Tick heiß. Weiter so!", knapp: "Vorne links 92 Grad. Rest gut." } },
  { frage: "Erklär mir kurz Trail Braking.", thema: "coaching", antwort: {
    kumpel: "Klar: Du bremst hart an und lässt die Bremse beim Einlenken langsam los. So bleibt Gewicht auf der Vorderachse und das Auto lenkt besser ein.",
    profi: "Bremsdruck beim Einlenken schrittweise abbauen. Die Last bleibt auf der Vorderachse, das Auto dreht williger in die Kurve.",
    motivator: "Spät und hart bremsen, dann die Bremse sanft bis in die Kurve mitnehmen – damit holst du richtig Zeit!",
    knapp: "Bremse beim Einlenken langsam lösen. Mehr Grip vorne." } },
];

function anrede(e: Einstellungen): string {
  const r = e.rufname?.trim();
  switch (e.art) {
    case "profi": return `${r ? `${r}, ` : ""}hier ist ${e.name}.`;
    case "motivator": return `${r ? `${r}! ` : ""}${e.name} hier – stark gefahren bisher!`;
    case "knapp": return `${e.name}.`;
    default: return `Hey${r ? ` ${r}` : ""}, ${e.name} hier.`;
  }
}

function probefunkTexte(e: Einstellungen): string[] {
  const themen = (Object.keys(ANSAGEN) as Thema[]).filter((t) => e.themen[t]);
  const anzahl = e.gespraechig === "still" ? 2 : e.gespraechig === "normal" ? 4 : themen.length;
  const zeilen = [anrede(e), ...themen.slice(0, anzahl).map((t) => ANSAGEN[t][e.art])];
  if (e.gespraechig === "viel") {
    zeilen.push({ kumpel: "Bleib locker, wir machen das zusammen.", profi: "Weiter so, Rundenzeiten konstant.",
      motivator: "Du fährst ein richtig starkes Rennen – weiter so!", knapp: "Weiter." }[e.art]);
  }
  return zeilen;
}

// ---------------------------------------------------------
// Sprachausgabe (Browser, auf dem Gerät)
// ---------------------------------------------------------
// Die natürlichste verfügbare Stimme des Browsers wählen: neuronale/Online-Stimmen zuerst, dann Cloud-Stimmen des
// Browsers, zuletzt die einfachen Systemstimmen (die klingen am stärksten nach Roboter)
function stimmeWaehlen(sprache: string): SpeechSynthesisVoice | null {
  const code = sprache === "en" ? "en" : "de";
  const stimmen = (window.speechSynthesis?.getVoices?.() || []).filter((v) => v.lang.toLowerCase().startsWith(code));
  const rang = (v: SpeechSynthesisVoice) => (/natural|neural/i.test(v.name) ? 0 : /online/i.test(v.name) ? 1 : !v.localService ? 2 : 3);
  return stimmen.sort((a, b) => rang(a) - rang(b))[0] || null;
}

function sprechen(text: string, e: Einstellungen): Promise<void> {
  return new Promise((fertig) => {
    if (!("speechSynthesis" in window)) { fertig(); return; }
    const u = new SpeechSynthesisUtterance(text);
    const v = stimmeWaehlen(e.sprache);
    if (v) u.voice = v;
    u.lang = e.sprache === "en" ? "en-GB" : "de-DE";
    const art = { ruhig: [0.98, 1], energisch: [1.1, 1.08], tief: [0.95, 0.75], hell: [1.02, 1.3] }[e.stimme];
    u.rate = art[0];
    u.pitch = art[1];
    u.onend = () => fertig();
    u.onerror = () => fertig();
    window.speechSynthesis.speak(u);
  });
}

let funkLaeuft = 0;
async function funken(zeilen: Array<{ wer: "fahrer" | "box"; text: string }>) {
  const lauf = ++funkLaeuft;
  window.speechSynthesis?.cancel?.();
  const verlauf = $("reVerlauf");
  const led = $("reLed");
  if (!verlauf) return;
  for (const z of zeilen) {
    if (lauf !== funkLaeuft) return;
    const b = el("div", `re-blase ${z.wer}`);
    b.appendChild(el("small", "", z.wer === "box" ? zustand.e.name : (zustand.e.rufname || "Du")));
    b.appendChild(el("p", "", z.text));
    verlauf.appendChild(b);
    verlauf.scrollTop = verlauf.scrollHeight;
    while (verlauf.childElementCount > 12) verlauf.firstElementChild?.remove();
    if (z.wer === "box") {
      led?.classList.add("an");
      await sprechen(z.text, zustand.e);
      led?.classList.remove("an");
    } else {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// ---------------------------------------------------------
// Formular
// ---------------------------------------------------------
function ausFormular(): Einstellungen {
  const f = $<HTMLFormElement>("reForm")!;
  const wert = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null)?.value?.trim() || "";
  const art = (f.querySelector<HTMLInputElement>('input[name="art"]:checked')?.value || "kumpel") as Art;
  const themen = { ...STANDARD.themen };
  f.querySelectorAll<HTMLInputElement>('input[name="thema"]').forEach((i) => { themen[i.value as Thema] = i.checked; });
  return { name: wert("name") || "Kim", rufname: wert("rufname") || null, art, gespraechig: wert("gespraechig") as Einstellungen["gespraechig"],
    stimme: wert("stimme") as Einstellungen["stimme"], sprache: wert("sprache") as Einstellungen["sprache"], themen };
}

function insFormular(e: Einstellungen) {
  const f = $<HTMLFormElement>("reForm");
  if (!f) return;
  (f.elements.namedItem("name") as HTMLInputElement).value = e.name;
  (f.elements.namedItem("rufname") as HTMLInputElement).value = e.rufname || "";
  (f.elements.namedItem("gespraechig") as HTMLSelectElement).value = e.gespraechig;
  (f.elements.namedItem("stimme") as HTMLSelectElement).value = e.stimme;
  (f.elements.namedItem("sprache") as HTMLSelectElement).value = e.sprache;
  f.querySelectorAll<HTMLInputElement>('input[name="art"]').forEach((i) => { i.checked = i.value === e.art; });
  const box = $("reThemen");
  box?.replaceChildren(...(Object.keys(THEMEN) as Thema[]).map((t) => {
    const l = el("label", `co-chip lv-chip${e.themen[t] !== false ? " active" : ""}`);
    const i = el("input");
    i.type = "checkbox";
    i.name = "thema";
    i.value = t;
    i.checked = e.themen[t] !== false;
    i.addEventListener("change", () => { l.classList.toggle("active", i.checked); vorschauAktualisieren(); });
    l.appendChild(i);
    l.insertAdjacentHTML("beforeend", `<i class="fa-solid ${THEMEN[t].icon}" aria-hidden="true"></i>`);
    l.append(` ${THEMEN[t].text}`);
    return l;
  }));
  vorschauAktualisieren();
}

function vorschauAktualisieren() {
  const e = ausFormular();
  zustand.e = e;
  const name = $("reFunkName");
  if (name) name.textContent = e.name;
  const fragen = $("reFragen");
  fragen?.replaceChildren(...FRAGEN.filter((q) => e.themen[q.thema]).map((q) => {
    const b = el("button", "re-frage", q.frage);
    b.type = "button";
    b.addEventListener("click", () => void funken([{ wer: "fahrer", text: q.frage }, { wer: "box", text: q.antwort[e.art] }]));
    return b;
  }));
}

async function speichern(ev: SubmitEvent) {
  ev.preventDefault();
  const e = ausFormular();
  if (!zustand.ich) { toast("Melde dich an, um deinen Renningenieur zu speichern.", "info"); return; }
  const { error } = await client()!.rpc("race_engineer_save", { _name: e.name, _rufname: e.rufname, _art: e.art, _gespraechig: e.gespraechig,
    _stimme: e.stimme, _sprache: e.sprache, _themen: e.themen });
  if (error) { toast(/schema cache|could not find/i.test(error.message) ? "Der Renningenieur ist gleich verfügbar – die Datenbank wird gerade aktualisiert." : error.message, "error"); return; }
  toast(`${e.name} ist gespeichert.`, "success");
}

// ---------------------------------------------------------
// Gedächtnis
// ---------------------------------------------------------
async function gedaechtnisLaden() {
  const sb = client();
  if (!sb || !zustand.ich) return;
  const { data, error } = await sb.from("race_engineer_memory").select("id, art, text, quelle, created_at").order("created_at", { ascending: false }).limit(100);
  zustand.gedaechtnis = error ? [] : (data as Eintrag[]) || [];
  gedaechtnisZeigen();
}

function gedaechtnisZeigen() {
  const liste = $("reGedaechtnis");
  const anzahl = $("reGedAnzahl");
  if (anzahl) anzahl.textContent = zustand.gedaechtnis.length ? `${zustand.gedaechtnis.length} von 100` : "";
  if (!liste) return;
  liste.replaceChildren();
  if (!zustand.gedaechtnis.length) {
    liste.appendChild(el("li", "re-leer", `${zustand.e.name} weiß noch nichts über dich. Erzähl ihm zum Beispiel, wie er Abstände ansagen soll oder woran du gerade arbeitest.`));
    return;
  }
  zustand.gedaechtnis.forEach((m) => {
    const li = el("li");
    li.appendChild(el("span", `re-art ${m.art}`, ARTEN_GEDAECHTNIS[m.art] || m.art));
    li.appendChild(el("span", "re-eintrag", m.text));
    if (m.quelle === "renningenieur") li.appendChild(el("small", "re-quelle", "gelernt im Rennen"));
    const weg = el("button", "re-weg");
    weg.type = "button";
    weg.title = "Vergessen";
    weg.setAttribute("aria-label", `„${m.text}“ vergessen`);
    weg.innerHTML = '<i class="fa-solid fa-trash"></i>';
    weg.addEventListener("click", async () => {
      const ok = await dialog({ icon: "fa-trash", title: "Eintrag vergessen?", message: `${zustand.e.name} vergisst: „${m.text}“`, confirmText: "Vergessen", cancelText: "Abbrechen", danger: true });
      if (!ok) return;
      const { error } = await client()!.from("race_engineer_memory").delete().eq("id", m.id);
      if (error) { toast(error.message, "error"); return; }
      zustand.gedaechtnis = zustand.gedaechtnis.filter((x) => x.id !== m.id);
      gedaechtnisZeigen();
    });
    li.appendChild(weg);
    liste.appendChild(li);
  });
}

async function merken(ev: SubmitEvent) {
  ev.preventDefault();
  const f = ev.currentTarget as HTMLFormElement;
  const art = (f.elements.namedItem("art") as HTMLSelectElement).value;
  const feld = f.elements.namedItem("text") as HTMLInputElement;
  const text = feld.value.trim();
  if (text.length < 2) { toast("Bitte schreib, was er sich merken soll.", "error"); return; }
  if (!zustand.ich) { toast("Melde dich an, um das Gedächtnis zu nutzen.", "info"); return; }
  const { error } = await client()!.rpc("race_engineer_remember", { _art: art, _text: text });
  if (error) { toast(error.message, "error"); return; }
  feld.value = "";
  toast(`${zustand.e.name} merkt sich das.`, "success");
  await gedaechtnisLaden();
}

// ---------------------------------------------------------
// Start
// ---------------------------------------------------------
async function starten() {
  const sb = client();
  insFormular(STANDARD);
  $("reForm")?.addEventListener("submit", (e) => void speichern(e as SubmitEvent));
  $("reForm")?.addEventListener("change", vorschauAktualisieren);
  $("reForm")?.addEventListener("input", vorschauAktualisieren);
  $("reProbe")?.addEventListener("click", () => {
    const e = ausFormular();
    void funken(probefunkTexte(e).map((text) => ({ wer: "box" as const, text })));
  });
  $("reMerkenForm")?.addEventListener("submit", (e) => void merken(e as SubmitEvent));
  window.speechSynthesis?.getVoices?.(); // Stimmen früh laden (manche Browser liefern sie erst verzögert)
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  zustand.ich = data.session?.user.id || null;
  if (!zustand.ich) { gedaechtnisZeigen(); return; }
  const { data: e } = await sb.from("race_engineer_settings").select("name, rufname, art, gespraechig, stimme, sprache, themen").eq("user_id", zustand.ich).maybeSingle();
  if (e) insFormular({ ...STANDARD, ...(e as Einstellungen), themen: { ...STANDARD.themen, ...((e as Einstellungen).themen || {}) } });
  await gedaechtnisLaden();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void starten());
else void starten();
