// GSRA – Anhänge im Chat: Fotos, Videos und Setups (SQL 041). TypeScript-Modul, von Vite gebaut.
//
// Die Büroklammer öffnet drei Kacheln. Fotos und Videos laufen wie bisher über das vorhandene Eingabefeld.
// Setups: Datei wählen (Chrome/Edge starten im zuletzt genutzten Setup-Ordner), die Simulation wird an der
// Dateiendung (und bei .json am Inhalt) erkannt. Im Chat erscheint eine Setup-Karte: herunterladen oder – in
// Chrome/Edge am PC – direkt in den eigenen Setup-Ordner speichern (Auto-/Streckenordner wie beim Absender).
// Sicherheit: Dateien liegen im privaten Chat-Speicher; die Datenbank prüft Ordner, Endung, Größe und
// Ordner-Hinweis (SQL 041). Hier wird nichts aus Daten als HTML ausgegeben.

type SimInfo = { key: string; label: string; ext: string; ordner: string; autoOrdner: boolean };
type SetupMeta = { kind: "setup"; sim: string; size: number; sub?: string };
type ChatNachricht = { id: string; file_path?: string | null; file_name?: string | null; file_meta?: SetupMeta | null; sender_id?: string };
type Kontext = { chatId: string | null; userId: string | null; canPost: boolean };
type Rechte = { queryPermission?: (o: { mode: string }) => Promise<string>; requestPermission?: (o: { mode: string }) => Promise<string> };
type OrdnerHandle = FileSystemDirectoryHandle & Rechte;
type Waehler = {
  showOpenFilePicker?: (o?: object) => Promise<FileSystemFileHandle[]>;
  showDirectoryPicker?: (o?: object) => Promise<OrdnerHandle>;
  showSaveFilePicker?: (o?: object) => Promise<FileSystemFileHandle>;
};

const MAX_BYTES = 5 * 1024 * 1024;
const SETUP_TYP = "application/vnd.gsra.setup";

// Wie im Setup Hub und in der Datenbank (chat_setup_sims)
const SIMS: SimInfo[] = [
  { key: "iRacing", label: "iRacing", ext: "sto", ordner: "Dokumente\\iRacing\\setups", autoOrdner: true },
  { key: "ACC", label: "Assetto Corsa Competizione", ext: "json", ordner: "Dokumente\\Assetto Corsa Competizione\\Setups", autoOrdner: true },
  { key: "Assetto Corsa", label: "Assetto Corsa", ext: "ini", ordner: "Dokumente\\Assetto Corsa\\setups", autoOrdner: true },
  { key: "Assetto Corsa EVO", label: "Assetto Corsa EVO", ext: "ini", ordner: "den Setup-Ordner von Assetto Corsa EVO", autoOrdner: true },
  { key: "Le Mans Ultimate", label: "Le Mans Ultimate", ext: "svm", ordner: "Spielordner\\UserData\\player\\Settings", autoOrdner: true },
  { key: "rFactor 2", label: "rFactor 2", ext: "svm", ordner: "Spielordner\\UserData\\player\\Settings", autoOrdner: true },
  { key: "Automobilista 2", label: "Automobilista 2", ext: "svm", ordner: "den Setup-Ordner von Automobilista 2", autoOrdner: false },
  { key: "RaceRoom", label: "RaceRoom", ext: "usr", ordner: "den Setup-Ordner von RaceRoom", autoOrdner: false },
  { key: "Rennsport", label: "Rennsport", ext: "json", ordner: "den Setup-Ordner von Rennsport", autoOrdner: false },
  { key: "BeamNG.drive", label: "BeamNG.drive", ext: "pc", ordner: "den Setup-Ordner von BeamNG.drive", autoOrdner: false },
  { key: "Richard Burns Rally", label: "Richard Burns Rally", ext: "ini", ordner: "den Setup-Ordner von RBR", autoOrdner: false },
];
const ENDUNGEN = [...new Set(SIMS.map((s) => s.ext))];
const simOf = (key: string | undefined) => SIMS.find((s) => s.key === key);

const w = window as unknown as Window & Waehler & Record<string, any>;
const toast = (text: string, art: "success" | "error" | "info" = "info") => (typeof w.showToast === "function" ? w.showToast(text, art) : alert(text));
const client = () => w.supabaseClient;
const kontext = (): Kontext => (w.gsraMessenger?.context?.() as Kontext) || { chatId: null, userId: null, canPost: false };
const groesse = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1).replace(".", ",")} KB` : `${(b / 1048576).toFixed(1).replace(".", ",")} MB`);
const kannOrdner = () => typeof w.showDirectoryPicker === "function";
// Nur harmlose Namen für Ordner und Dateien (die Datenbank prüft dasselbe)
const sichererTeil = (s: string) => /^[A-Za-z0-9 ._()+-]{1,80}$/.test(s) && s !== "." && s !== "..";
const sichererName = (s: string) => s.length >= 1 && s.length <= 120 && !/[/\\<>:"|?*\u0000-\u001f]/.test(s) && !s.startsWith(".");

// ---------- Gemerkte Setup-Ordner (pro Simulation, nur in diesem Browser) ----------
function db(): Promise<IDBDatabase> {
  return new Promise((ok, fehler) => {
    const r = indexedDB.open("gsra-setup-ordner", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("ordner");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fehler(r.error);
  });
}
async function ordnerLesen(sim: string): Promise<OrdnerHandle | null> {
  try {
    const d = await db();
    return await new Promise((ok) => {
      const r = d.transaction("ordner").objectStore("ordner").get(sim);
      r.onsuccess = () => ok((r.result as OrdnerHandle) || null);
      r.onerror = () => ok(null);
    });
  } catch { return null; }
}
async function ordnerMerken(sim: string, h: OrdnerHandle) {
  try {
    const d = await db();
    d.transaction("ordner", "readwrite").objectStore("ordner").put(h, sim);
  } catch { /* ohne Speicher: dann beim nächsten Mal erneut wählen */ }
}
async function alleOrdner(): Promise<Array<{ sim: string; h: OrdnerHandle }>> {
  const liste: Array<{ sim: string; h: OrdnerHandle }> = [];
  for (const s of SIMS) {
    const h = await ordnerLesen(s.key);
    if (h) liste.push({ sim: s.key, h });
  }
  return liste;
}

// ---------- Kleines Auswahlfenster im GSRA-Design ----------
function auswahl(titel: string, text: string, knoepfe: Array<{ label: string; wert: string; haupt?: boolean }>): Promise<string | null> {
  return new Promise((ok) => {
    const o = document.createElement("div");
    o.className = "gsra-dialog-overlay gsra-attach-dialog";
    const box = document.createElement("div");
    box.className = "gsra-dialog";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    const h = document.createElement("h3");
    h.className = "gsra-dialog-title";
    h.textContent = titel;
    const p = document.createElement("p");
    p.className = "gsra-dialog-message";
    p.textContent = text;
    const leiste = document.createElement("div");
    leiste.className = "gsra-dialog-actions gsra-attach-choices";
    const fertig = (wert: string | null) => { o.remove(); document.removeEventListener("keydown", esc); ok(wert); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") fertig(null); };
    for (const k of knoepfe) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `gsra-dialog-btn ${k.haupt ? "primary" : "secondary"}`;
      b.textContent = k.label;
      b.addEventListener("click", () => fertig(k.wert));
      leiste.appendChild(b);
    }
    const ab = document.createElement("button");
    ab.type = "button";
    ab.className = "gsra-dialog-btn secondary";
    ab.textContent = "Abbrechen";
    ab.addEventListener("click", () => fertig(null));
    leiste.appendChild(ab);
    box.append(h, p, leiste);
    o.appendChild(box);
    o.addEventListener("mousedown", (e) => { if (e.target === o) fertig(null); });
    document.addEventListener("keydown", esc);
    document.body.appendChild(o);
    (leiste.querySelector("button") as HTMLButtonElement | null)?.focus();
  });
}

// ---------- Senden ----------
async function erkenneSim(datei: File, ausOrdner: string | null): Promise<{ sim: SimInfo; unterordner?: string } | null> {
  const ext = (datei.name.split(".").pop() || "").toLowerCase();
  if (ausOrdner) {
    const s = simOf(ausOrdner);
    if (s && s.ext === ext) return { sim: s };
  }
  let kandidaten = SIMS.filter((s) => s.ext === ext);
  if (ext === "json") {
    // ACC-Setups nennen das Auto in der Datei („carName“) – das ist zugleich der Auto-Ordner
    try {
      const inhalt = JSON.parse(await datei.slice(0, 200000).text());
      if (inhalt && typeof inhalt.carName === "string") {
        const auto = inhalt.carName.trim();
        return { sim: simOf("ACC") as SimInfo, unterordner: sichererTeil(auto) ? auto : undefined };
      }
      kandidaten = kandidaten.filter((s) => s.key !== "ACC");
    } catch { /* keine lesbare JSON-Datei */ }
  }
  if (kandidaten.length === 1) return { sim: kandidaten[0] };
  if (!kandidaten.length) return null;
  const wahl = await auswahl("Welche Simulation?", `„${datei.name}“ passt zu mehreren Simulationen. Für welche ist das Setup?`,
    kandidaten.map((s, i) => ({ label: s.label, wert: s.key, haupt: i === 0 })));
  return wahl ? { sim: simOf(wahl) as SimInfo } : null;
}

async function waehleSetupDatei(): Promise<{ datei: File; handle?: FileSystemFileHandle } | null> {
  if (typeof w.showOpenFilePicker === "function") {
    const gemerkt = await alleOrdner();
    try {
      const [handle] = await w.showOpenFilePicker({
        id: "gsra-setup",
        startIn: gemerkt[0]?.h || "documents",
        multiple: false,
        types: [{ description: "Setup-Dateien", accept: { "application/octet-stream": ENDUNGEN.map((e) => `.${e}`) } }],
      });
      return handle ? { datei: await handle.getFile(), handle } : null;
    } catch { return null; } // abgebrochen
  }
  // Andere Browser: normale Dateiauswahl
  return new Promise((ok) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ENDUNGEN.map((e) => `.${e}`).join(",");
    input.addEventListener("change", () => ok(input.files?.[0] ? { datei: input.files[0] } : null));
    input.click();
  });
}

async function setupSenden() {
  const k = kontext();
  if (!k.chatId || !k.userId || !k.canPost) return toast("Öffne zuerst einen Chat, in dem du schreiben darfst.", "info");
  const gewaehlt = await waehleSetupDatei();
  if (!gewaehlt) return;
  const { datei, handle } = gewaehlt;
  const ext = (datei.name.split(".").pop() || "").toLowerCase();
  if (!ENDUNGEN.includes(ext)) return toast(`Das ist keine Setup-Datei. Erlaubt: ${ENDUNGEN.map((e) => `.${e}`).join(", ")}.`, "error");
  if (datei.size < 1 || datei.size > MAX_BYTES) return toast("Setup-Dateien dürfen höchstens 5 MB groß sein.", "error");
  if (!sichererName(datei.name)) return toast("Der Dateiname enthält Zeichen, die nicht erlaubt sind.", "error");

  // Liegt die Datei in einem gemerkten Setup-Ordner? Dann kennen wir Simulation und Auto-/Streckenordner.
  let ausOrdner: string | null = null;
  let unterordner: string | undefined;
  if (handle) {
    for (const { sim, h } of await alleOrdner()) {
      try {
        const pfad = await h.resolve(handle);
        if (pfad && pfad.length) {
          ausOrdner = sim;
          const teile = pfad.slice(0, -1);
          if (teile.length && teile.length <= 4 && teile.every(sichererTeil)) unterordner = teile.join("/");
          break;
        }
      } catch { /* anderer Ordner */ }
    }
  }
  const erkannt = await erkenneSim(datei, ausOrdner);
  if (!erkannt) return toast("Diese Datei konnte keiner Simulation zugeordnet werden.", "error");
  unterordner = unterordner || erkannt.unterordner;

  const ok = await auswahl("Setup senden?",
    `${datei.name} · ${erkannt.sim.label} · ${groesse(datei.size)}${unterordner ? ` · Ordner: ${unterordner.replace(/\//g, " › ")}` : ""}`,
    [{ label: "Senden", wert: "ja", haupt: true }]);
  if (ok !== "ja") return;

  const pfad = `${k.chatId}/${k.userId}/setup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const meta: SetupMeta = { kind: "setup", sim: erkannt.sim.key, size: datei.size, ...(unterordner ? { sub: unterordner } : {}) };
  try {
    const sb = client();
    const hoch = await sb.storage.from("chat_attachments").upload(pfad, datei, { contentType: SETUP_TYP, upsert: false });
    if (hoch.error) throw hoch.error;
    const { error } = await sb.from("messages").insert([{
      chat_id: k.chatId, sender_id: k.userId, text: `[Setup] ${datei.name}`, file_path: pfad, file_name: datei.name, file_meta: meta,
    }]);
    if (error) {
      await sb.storage.from("chat_attachments").remove([pfad]); // nichts Verwaistes liegen lassen
      throw error;
    }
    await sb.from("chats").update({ last_message: `[Setup] ${datei.name}` }).eq("id", k.chatId);
    w.gsraMessenger?.afterSend?.();
  } catch (e: any) {
    const fallback = "Das Setup konnte nicht gesendet werden.";
    toast(typeof w.gsraFriendlyError === "function" ? w.gsraFriendlyError(String(e?.message || ""), fallback) : fallback, "error");
  }
}

// ---------- Empfangen: herunterladen oder direkt in den Setup-Ordner ----------
async function signierterLink(msg: ChatNachricht, alsDownload: boolean): Promise<string | null> {
  const { data } = await client().storage.from("chat_attachments")
    .createSignedUrl(msg.file_path, 120, alsDownload ? { download: msg.file_name || true } : undefined);
  return data?.signedUrl || null;
}

async function herunterladen(msg: ChatNachricht) {
  const url = await signierterLink(msg, true);
  if (!url) return toast("Die Datei ist gerade nicht verfügbar.", "error");
  const sim = simOf(msg.file_meta?.sim);
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (sim) toast(`Heruntergeladen – lege die Datei in ${sim.ordner}${msg.file_meta?.sub ? `\\${msg.file_meta.sub.replace(/\//g, "\\")}` : ""}.`, "info");
}

async function berechtigt(h: OrdnerHandle): Promise<boolean> {
  try {
    if ((await h.queryPermission?.({ mode: "readwrite" })) === "granted") return true;
    return (await h.requestPermission?.({ mode: "readwrite" })) === "granted";
  } catch { return false; }
}

async function inOrdnerSpeichern(msg: ChatNachricht) {
  const sim = simOf(msg.file_meta?.sim);
  const name = msg.file_name || "";
  if (!sim || !sichererName(name)) return toast("Dieses Setup kann nicht gespeichert werden.", "error");
  let wurzel = await ordnerLesen(sim.key);
  if (!wurzel) {
    const los = await auswahl(`${sim.label}-Ordner festlegen`,
      `Wähle einmal deinen Setup-Ordner von ${sim.label} (${sim.ordner}). Danach speichert GSRA Setups direkt dort hinein.`,
      [{ label: "Ordner wählen", wert: "ja", haupt: true }]);
    if (los !== "ja") return;
    try {
      wurzel = (await w.showDirectoryPicker?.({ id: `gsra-${sim.ext}`, mode: "readwrite", startIn: "documents" })) || null;
    } catch { return; }
    if (!wurzel) return;
    await ordnerMerken(sim.key, wurzel);
  }
  if (!(await berechtigt(wurzel))) return toast("Ohne deine Erlaubnis kann GSRA nicht in den Ordner speichern.", "info");

  const link = await signierterLink(msg, false);
  if (!link) return toast("Die Datei ist gerade nicht verfügbar.", "error");
  let inhalt: Blob;
  try {
    const antwort = await fetch(link);
    if (!antwort.ok) throw new Error(String(antwort.status));
    inhalt = await antwort.blob();
  } catch { return toast("Die Datei konnte nicht geladen werden.", "error"); }

  try {
    let ziel: FileSystemDirectoryHandle = wurzel;
    const teile = (msg.file_meta?.sub || "").split("/").filter(Boolean);
    let dateiHandle: FileSystemFileHandle;
    if (teile.length && teile.every(sichererTeil)) {
      for (const t of teile) ziel = await ziel.getDirectoryHandle(t, { create: true });
      const vorhanden = await ziel.getFileHandle(name).then(() => true, () => false);
      if (vorhanden) {
        const ueber = await auswahl("Datei ersetzen?", `„${name}“ gibt es in diesem Ordner schon.`, [{ label: "Ersetzen", wert: "ja", haupt: true }]);
        if (ueber !== "ja") return;
      }
      dateiHandle = await ziel.getFileHandle(name, { create: true });
    } else if (sim.autoOrdner && typeof w.showSaveFilePicker === "function") {
      // Auto-/Streckenordner unbekannt: Speichern-Fenster startet im Setup-Ordner, du wählst den Unterordner
      try {
        dateiHandle = await w.showSaveFilePicker({ id: `gsra-${sim.ext}-ziel`, startIn: wurzel, suggestedName: name });
      } catch { return; }
    } else {
      dateiHandle = await ziel.getFileHandle(name, { create: true });
    }
    const schreiber = await dateiHandle.createWritable();
    await schreiber.write(inhalt);
    await schreiber.close();
    toast(`Gespeichert in ${sim.label}${teile.length ? ` › ${teile.join(" › ")}` : ""} › ${name}`, "success");
  } catch {
    toast("Speichern im Ordner hat nicht geklappt – lade die Datei stattdessen herunter.", "error");
  }
}

function setupKarte(bubble: HTMLElement, msg: ChatNachricht) {
  const meta = msg.file_meta;
  const sim = simOf(meta?.sim);
  if (!meta || !sim || !msg.file_path) return;
  const karte = document.createElement("div");
  karte.className = "gsra-setup-card";
  const kopf = document.createElement("div");
  kopf.className = "gsra-setup-head";
  const icon = document.createElement("span");
  icon.className = "gsra-setup-icon";
  icon.innerHTML = '<i class="fa-solid fa-sliders"></i>';
  const text = document.createElement("div");
  text.className = "gsra-setup-text";
  const titel = document.createElement("strong");
  titel.textContent = msg.file_name || "Setup";
  const info = document.createElement("small");
  info.textContent = [sim.label, groesse(Number(meta.size) || 0), meta.sub ? `Ordner: ${meta.sub.replace(/\//g, " › ")}` : null].filter(Boolean).join(" · ");
  text.append(titel, info);
  kopf.append(icon, text);
  const aktionen = document.createElement("div");
  aktionen.className = "gsra-setup-actions";
  const laden = document.createElement("button");
  laden.type = "button";
  laden.className = "gsra-setup-btn";
  laden.innerHTML = '<i class="fa-solid fa-download"></i> Herunterladen';
  laden.addEventListener("click", (e) => { e.stopPropagation(); herunterladen(msg); });
  aktionen.appendChild(laden);
  if (kannOrdner()) {
    const speichern = document.createElement("button");
    speichern.type = "button";
    speichern.className = "gsra-setup-btn primary";
    speichern.innerHTML = '<i class="fa-solid fa-folder-plus"></i> ';
    speichern.append(`In ${sim.key === "ACC" ? "ACC" : sim.label} speichern`);
    speichern.addEventListener("click", (e) => { e.stopPropagation(); inOrdnerSpeichern(msg); });
    aktionen.appendChild(speichern);
  }
  karte.append(kopf, aktionen);
  bubble.appendChild(karte);
}

// ---------- Büroklammer: drei Kacheln ----------
function anhangMenue() {
  const knopf = document.getElementById("attachMenuBtn") as HTMLButtonElement | null;
  const eingabe = document.getElementById("imageUploadInput") as HTMLInputElement | null;
  if (!knopf || !eingabe) return;
  const menue = document.createElement("div");
  menue.className = "gsra-attach-menu";
  menue.hidden = true;
  menue.setAttribute("role", "menu");
  const kacheln: Array<{ icon: string; titel: string; text: string; aktion: () => void }> = [
    { icon: "fa-image", titel: "Fotos", text: "aus deinen Bildern", aktion: () => { eingabe.accept = "image/*"; eingabe.click(); } },
    { icon: "fa-film", titel: "Videos", text: "aus deinen Videos", aktion: () => { eingabe.accept = "video/*"; eingabe.click(); } },
    { icon: "fa-sliders", titel: "Setups", text: "iRacing, ACC, AC …", aktion: () => { setupSenden(); } },
  ];
  for (const k of kacheln) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "gsra-attach-tile";
    b.setAttribute("role", "menuitem");
    b.innerHTML = `<span class="gsra-attach-icon"><i class="fa-solid ${k.icon}"></i></span><strong></strong><small></small>`;
    (b.querySelector("strong") as HTMLElement).textContent = k.titel;
    (b.querySelector("small") as HTMLElement).textContent = k.text;
    b.addEventListener("click", () => { zu(); k.aktion(); });
    menue.appendChild(b);
  }
  // An die Eingabeleiste hängen, nicht an die Werkzeugleiste: deren abgeschrägte Ecken (clip-path) würden das Menü abschneiden
  ((knopf.closest("form") as HTMLElement | null) || (knopf.parentElement as HTMLElement)).appendChild(menue);
  const zu = () => { menue.hidden = true; knopf.setAttribute("aria-expanded", "false"); };
  knopf.setAttribute("aria-haspopup", "menu");
  knopf.addEventListener("click", (e) => {
    e.stopPropagation();
    if (eingabe.disabled) return;
    menue.hidden = !menue.hidden;
    knopf.setAttribute("aria-expanded", String(!menue.hidden));
    if (!menue.hidden) (menue.querySelector("button") as HTMLButtonElement | null)?.focus();
  });
  document.addEventListener("click", (e) => { if (!menue.hidden && !menue.contains(e.target as Node)) zu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menue.hidden) { zu(); knopf.focus(); } });
  // Nach der Auswahl wieder beides erlauben (Einfügen per Ziehen bleibt so unverändert)
  eingabe.addEventListener("change", () => setTimeout(() => { eingabe.accept = "image/*,video/*"; }, 0));
}

w.gsraChatSetups = { renderCard: setupKarte, send: setupSenden };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", anhangMenue);
else anhangMenue();

export {};
