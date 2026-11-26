// Messenger direkt in der App (Wunsch 26.11.: Webseite nativ übertragen – Messenger zuerst).
// Chatliste, Lesen, Schreiben, Live-Updates, Lesestand (mark_chat_read), ungelesene Chats; dazu Fotos und
// Sprachnachrichten senden und ansehen/anhören (chat-medien.ts, privater Speicher mit kurzlebigen Links).
// Gleiche Datenbank und gleiche Regeln wie die Webseite: Was jemand sehen und schreiben darf, entscheiden die
// Zugriffsregeln der Datenbank (RLS, Sperren, Zwei-Faktor, Spam-Grenzen) – die App fragt nur mit der eigenen
// Anmeldung. Alle Texte per textContent, nie als HTML. Reaktionen, Gruppen verwalten, Freunde, Videos senden:
// vorerst über „Alle Funktionen“ (Webansicht des Messengers).

import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "./konto.ts";
import { aufnahmeStarten, dauerText, fotoHochladen, istVideo, linkFuer, MAX_FOTOS, pfadVon, signieren, sprachHochladen, vorschauPfad, type Aufnahme } from "./chat-medien.ts";

type Chat = { id: string; title: string | null; user1_id: string; user2_id: string; last_message: string | null; created_at: string };
type Nachricht = {
  id: string; chat_id: string; sender_id: string; text: string | null; image_url: string | null; audio_url?: string | null;
  created_at: string; is_edited?: boolean | null; voice_duration?: number | null; voice_waveform?: unknown; transcript?: string | null;
};
const SPALTEN = "id, chat_id, sender_id, text, image_url, audio_url, created_at, is_edited, voice_duration, voice_waveform, transcript";
type Profil = { id: string; username: string | null };
type Eintrag = Chat & { name: string; art: "direkt" | "gruppe" | "forum"; zuletzt: string; vorschau: string; ungelesen: boolean };

const FORUM = "GSRA Official / Community Forum";
const MAX_NACHRICHTEN = 80;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
};
const neu = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text = "") => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text) e.textContent = text;
  return e;
};
const uhrzeit = (iso: string) => {
  const d = new Date(iso);
  const heute = new Date().toDateString() === d.toDateString();
  return heute ? d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
};

interface Umgebung {
  hinweis: (t: string, art?: "ok" | "fehler") => void;
  /** Webansicht des Messengers öffnen (alle Funktionen) */
  webansicht: () => void;
  /** Liste geändert (für den roten Punkt in der Seitenleiste) */
  ungelesen: (gibt: boolean) => void;
  /** Mitschrift einer Sprachnachricht auf dem PC (Spracherkennung der App); null = nicht verfügbar */
  mitschrift?: (blob: Blob) => Promise<string | null>;
}

export function messengerEinrichten(u: Umgebung) {
  let ich: string | null = null;
  let eintraege: Eintrag[] = [];
  let aktiv: string | null = null;
  const namen = new Map<string, string>();
  let kanalChat: RealtimeChannel | null = null;
  let kanalAlle: RealtimeChannel | null = null;
  let neuLadenGeplant = 0;

  const nameVon = async (ids: string[]) => {
    const fehlt = [...new Set(ids)].filter((id) => id && !namen.has(id));
    if (!fehlt.length) return;
    const { data } = await sb().from("profiles").select("id, username").in("id", fehlt.slice(0, 200));
    for (const p of (data as Profil[] | null) ?? []) namen.set(p.id, (p.username ?? "").trim().slice(0, 40) || "GSRA-Mitglied");
    for (const id of fehlt) if (!namen.has(id)) namen.set(id, "GSRA-Mitglied");
  };

  async function listeLaden() {
    const { data: s } = await sb().auth.getSession();
    ich = s.session?.user.id ?? null;
    $("mxAnmelden").hidden = Boolean(ich);
    $("mx").hidden = !ich;
    if (!ich) return;
    const [{ data: chats }, { data: lese }, { data: gesperrt }] = await Promise.all([
      sb().from("chats").select("id, title, user1_id, user2_id, last_message, created_at").limit(300),
      sb().from("chat_reads").select("chat_id, last_read_at").eq("user_id", ich),
      sb().from("user_blocks").select("blocked_id").eq("blocker_id", ich),
    ]);
    const blockiert = new Set(((gesperrt as { blocked_id: string }[] | null) ?? []).map((b) => b.blocked_id));
    const gelesen = new Map(((lese as { chat_id: string; last_read_at: string | null }[] | null) ?? []).map((r) => [r.chat_id, r.last_read_at]));
    // Offizielles Forum: bei mehreren gilt das älteste (wie auf der Webseite)
    const alle = (chats as Chat[] | null) ?? [];
    const forum = alle.filter((c) => c.title === FORUM).sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    const sichtbar = alle.filter((c) => {
      if (c.title === FORUM) return c.id === forum?.id;
      const direkt = c.user1_id !== c.user2_id;
      if (direkt) return (c.user1_id === ich || c.user2_id === ich) && !blockiert.has(c.user1_id === ich ? c.user2_id : c.user1_id);
      return c.title !== null;
    });
    const andere = sichtbar.filter((c) => c.user1_id !== c.user2_id).map((c) => (c.user1_id === ich ? c.user2_id : c.user1_id));
    await nameVon(andere);
    // Letzte Nachricht je Chat (für Reihenfolge, Vorschau und „ungelesen“)
    const ids = sichtbar.map((c) => c.id);
    const zuletzt = new Map<string, Nachricht>();
    if (ids.length) {
      const { data: letzte } = await sb().from("messages").select("id, chat_id, sender_id, text, image_url, audio_url, created_at")
        .in("chat_id", ids.slice(0, 300)).order("created_at", { ascending: false }).limit(600);
      for (const n of (letzte as Nachricht[] | null) ?? []) if (!zuletzt.has(n.chat_id)) zuletzt.set(n.chat_id, n);
    }
    eintraege = sichtbar.map((c): Eintrag => {
      const art: Eintrag["art"] = c.title === FORUM ? "forum" : c.user1_id !== c.user2_id ? "direkt" : "gruppe";
      const n = zuletzt.get(c.id);
      const name = art === "direkt" ? namen.get(c.user1_id === ich ? c.user2_id : c.user1_id) ?? "GSRA-Mitglied" : (c.title ?? "Gruppe");
      const lesestand = gelesen.get(c.id);
      const ungelesen = Boolean(n && n.sender_id !== ich && (!lesestand || n.created_at > lesestand) && c.id !== aktiv);
      return { ...c, name: art === "forum" ? "GSRA Community-Forum" : name, art, zuletzt: n?.created_at ?? c.created_at, vorschau: vorschauText(n) ?? c.last_message ?? "", ungelesen };
    }).sort((a, b) => (a.art === "forum" ? -1 : b.art === "forum" ? 1 : b.zuletzt.localeCompare(a.zuletzt)));
    listeZeigen();
    u.ungelesen(eintraege.some((e) => e.ungelesen));
    allesBeobachten();
  }

  const vorschauText = (n?: Nachricht) => {
    if (!n) return null;
    if (n.audio_url) return "Sprachnachricht";
    if (n.image_url && (!n.text || n.text === "[Medien]")) return "Bild";
    return (n.text ?? "").replace(/\s+/g, " ").slice(0, 80);
  };

  function listeZeigen() {
    const such = $<HTMLInputElement>("mxSuche").value.trim().toLowerCase();
    const liste = $("mxListe");
    const treffer = eintraege.filter((e) => !such || e.name.toLowerCase().includes(such));
    if (!treffer.length) {
      liste.replaceChildren(neu("li", "mx-leer", eintraege.length ? "Kein Chat gefunden." : "Noch keine Chats – starte einen über „Alle Funktionen“."));
      return;
    }
    liste.replaceChildren(...treffer.map((e) => {
      const li = neu("li");
      const b = neu("button", `mx-eintrag${e.id === aktiv ? " aktiv" : ""}${e.ungelesen ? " ungelesen" : ""}`);
      b.type = "button";
      const bild = neu("span", `mx-bild ${e.art}`, e.art === "forum" ? "G" : e.name.charAt(0).toUpperCase());
      const text = neu("span", "mx-eintrag-text");
      const kopf = neu("span", "mx-eintrag-kopf");
      kopf.append(neu("strong", "", e.name), neu("small", "", uhrzeit(e.zuletzt)));
      text.append(kopf, neu("span", "mx-vorschau", e.vorschau));
      b.append(bild, text);
      if (e.ungelesen) b.append(neu("i", "neu-punkt"));
      b.addEventListener("click", () => void chatOeffnen(e.id));
      li.append(b);
      return li;
    }));
  }

  function blase(n: Nachricht, eintrag: Eintrag | undefined) {
    const eigen = n.sender_id === ich;
    const el = neu("div", `mx-nachricht${eigen ? " eigen" : ""}`);
    el.dataset.id = n.id;
    if (!eigen && eintrag?.art !== "direkt") el.append(neu("span", "mx-wer", namen.get(n.sender_id) ?? "GSRA-Mitglied"));
    if (n.audio_url) el.append(sprachBlase(n));
    if (n.image_url) el.append(bilderBlase(n.image_url));
    const t = (n.text ?? "").trim();
    if (t && t !== "[Medien]" && !(n.audio_url && /^🎤 Sprachnachricht/.test(t))) el.append(neu("p", "", t));
    el.append(neu("small", "mx-zeit", `${uhrzeit(n.created_at)}${n.is_edited ? " · bearbeitet" : ""}`));
    return el;
  }

  /** Fotos und Videos einer Nachricht: Vorschaubild im Chat, groß nach Klick; Videos mit Steuerung */
  function bilderBlase(adressen: string): HTMLElement {
    const box = neu("div", "mx-bilder");
    for (const adresse of adressen.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 12)) {
      const pfad = pfadVon(adresse);
      const original = linkFuer(pfad);
      const klein = linkFuer(vorschauPfad(pfad)) ?? original;
      if (!pfad || !original) {
        box.append(neu("span", "mx-medium", "Anhang nicht verfügbar"));
        continue;
      }
      if (istVideo(pfad)) {
        const v = neu("video", "mx-video");
        v.controls = true;
        v.preload = "none";
        if (klein && klein !== original) v.poster = klein;
        v.src = original;
        box.append(v);
        continue;
      }
      const b = neu("button", "mx-foto");
      b.type = "button";
      b.title = "Groß ansehen";
      const img = neu("img");
      img.alt = "Foto";
      img.loading = "lazy";
      img.src = klein ?? original;
      b.append(img);
      b.addEventListener("click", () => {
        $<HTMLImageElement>("mxBildGross").src = original;
        $<HTMLDialogElement>("mxBildDialog").showModal();
      });
      box.append(b);
    }
    return box;
  }

  /** Sprachnachricht: Abspielen/Pause, Lautstärke-Verlauf als Balken, Länge, Mitschrift */
  function sprachBlase(n: Nachricht): HTMLElement {
    const box = neu("div", "mx-sprache");
    const link = linkFuer(pfadVon(n.audio_url));
    const knopf = neu("button", "mx-sprache-knopf", "▶");
    knopf.type = "button";
    knopf.setAttribute("aria-label", "Sprachnachricht abspielen");
    const balken = neu("span", "mx-sprache-balken");
    const verlauf = Array.isArray(n.voice_waveform) ? (n.voice_waveform as unknown[]).map(Number).filter((x) => Number.isFinite(x)).slice(0, 64) : [];
    for (const w of verlauf.length ? verlauf : Array<number>(32).fill(0.3)) {
      const s = neu("i");
      s.style.height = `${Math.round(Math.max(0.08, Math.min(1, w)) * 100)}%`;
      balken.append(s);
    }
    const dauer = Number(n.voice_duration) || 0;
    const zeit = neu("small", "mx-sprache-zeit", dauer ? dauerText(dauer) : "");
    box.append(knopf, balken, zeit);
    if (!link) {
      knopf.disabled = true;
      zeit.textContent = "nicht verfügbar";
    } else {
      const ton = new Audio();
      ton.preload = "none";
      ton.src = link;
      const zeigen = () => {
        const anteil = ton.duration ? ton.currentTime / ton.duration : 0;
        balken.style.setProperty("--fortschritt", `${Math.round(anteil * 100)}%`);
        zeit.textContent = dauerText(ton.paused && !ton.currentTime ? dauer : ton.currentTime);
      };
      ton.addEventListener("timeupdate", zeigen);
      ton.addEventListener("ended", () => { knopf.textContent = "▶"; ton.currentTime = 0; zeigen(); });
      ton.addEventListener("error", () => { knopf.textContent = "▶"; zeit.textContent = "lässt sich nicht abspielen"; });
      knopf.addEventListener("click", () => {
        if (ton.paused) {
          document.querySelectorAll<HTMLAudioElement>("audio").forEach((a) => a.pause());
          laufend?.pause();
          laufend = ton;
          void ton.play().then(() => { knopf.textContent = "❚❚"; }, () => { zeit.textContent = "lässt sich nicht abspielen"; });
        } else {
          ton.pause();
          knopf.textContent = "▶";
        }
      });
      ton.addEventListener("pause", () => { knopf.textContent = "▶"; });
    }
    const mitschrift = (n.transcript ?? "").trim();
    const kasten = neu("div", "mx-sprache-box");
    kasten.append(box);
    if (mitschrift) kasten.append(neu("p", "mx-mitschrift", `„${mitschrift.slice(0, 1000)}“`));
    return kasten;
  }
  let laufend: HTMLAudioElement | null = null;

  async function chatOeffnen(id: string) {
    aktiv = id;
    const eintrag = eintraege.find((e) => e.id === id);
    $("mxTitel").textContent = eintrag?.name ?? "Chat";
    $("mxUnter").textContent = eintrag?.art === "forum" ? "Alle Mitglieder der GSRA" : eintrag?.art === "gruppe" ? "Gruppe" : "Privatchat";
    $("mxForm").hidden = Boolean(aufnahme);
    const verlauf = $("mxVerlauf");
    verlauf.replaceChildren(neu("p", "mx-leer", "Lädt …"));
    const [{ data }, { data: ausgeblendet }] = await Promise.all([
      sb().from("messages").select(SPALTEN)
        .eq("chat_id", id).order("created_at", { ascending: false }).limit(MAX_NACHRICHTEN),
      sb().from("message_hides").select("message_id").eq("user_id", ich ?? ""),
    ]);
    if (aktiv !== id) return;
    const weg = new Set(((ausgeblendet as { message_id: string }[] | null) ?? []).map((h) => String(h.message_id)));
    const nachrichten = ((data as Nachricht[] | null) ?? []).filter((n) => !weg.has(String(n.id))).reverse();
    await Promise.all([nameVon(nachrichten.map((n) => n.sender_id)), signieren(nachrichten.flatMap((n) => [...String(n.image_url ?? "").split(","), n.audio_url]))]);
    if (aktiv !== id) return;
    verlauf.replaceChildren(...(nachrichten.length ? nachrichten.map((n) => blase(n, eintrag)) : [neu("p", "mx-leer", "Noch keine Nachrichten – schreib die erste.")]));
    verlauf.scrollTop = verlauf.scrollHeight;
    gelesenMelden(id);
    if (eintrag) eintrag.ungelesen = false;
    listeZeigen();
    u.ungelesen(eintraege.some((e) => e.ungelesen));
    chatBeobachten(id);
    $<HTMLTextAreaElement>("mxFeld").focus();
  }

  const gelesenMelden = (id: string) => {
    if (!document.hidden) void sb().rpc("mark_chat_read", { _chat_id: id }).then(() => {}, () => {});
  };

  function chatBeobachten(id: string) {
    if (kanalChat) void sb().removeChannel(kanalChat);
    kanalChat = sb().channel(`app-chat-${id}-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${id}` }, async (p) => {
        const n = p.new as Nachricht;
        if (aktiv !== id || document.querySelector(`.mx-nachricht[data-id="${CSS.escape(String(n.id))}"]`)) return;
        await Promise.all([nameVon([n.sender_id]), signieren([...String(n.image_url ?? "").split(","), n.audio_url])]);
        const verlauf = $("mxVerlauf");
        verlauf.querySelector(".mx-leer")?.remove();
        const unten = verlauf.scrollHeight - verlauf.scrollTop - verlauf.clientHeight < 80;
        verlauf.append(blase(n, eintraege.find((e) => e.id === id)));
        if (unten || n.sender_id === ich) verlauf.scrollTop = verlauf.scrollHeight;
        gelesenMelden(id);
      })
      .subscribe();
  }

  /** Neue Nachrichten in irgendeinem Chat → Liste neu (gebündelt) */
  function allesBeobachten() {
    if (kanalAlle) return;
    kanalAlle = sb().channel(`app-chats-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        window.clearTimeout(neuLadenGeplant);
        neuLadenGeplant = window.setTimeout(() => void listeLaden(), 1200);
      })
      .subscribe();
  }

  async function senden() {
    const feld = $<HTMLTextAreaElement>("mxFeld");
    const text = feld.value.replace(/\r\n?/g, "\n").trim().slice(0, 4000);
    if (!text || !aktiv || !ich) return;
    const knopf = $<HTMLFormElement>("mxForm").querySelector<HTMLButtonElement>('button[type="submit"]');
    if (knopf) knopf.disabled = true;
    try {
      const { data, error } = await sb().from("messages").insert([{ chat_id: aktiv, sender_id: ich, text }]).select(SPALTEN).single();
      if (error) throw error;
      await sb().from("chats").update({ last_message: text.slice(0, 200) }).eq("id", aktiv);
      feld.value = "";
      feld.style.height = "auto";
      const n = data as Nachricht;
      const verlauf = $("mxVerlauf");
      verlauf.querySelector(".mx-leer")?.remove();
      if (!verlauf.querySelector(`.mx-nachricht[data-id="${CSS.escape(String(n.id))}"]`)) verlauf.append(blase(n, eintraege.find((e) => e.id === aktiv)));
      verlauf.scrollTop = verlauf.scrollHeight;
    } catch (err) {
      const t = (err as { message?: string })?.message ?? "";
      u.hinweis(/^Zu viele|gesperrt|Zwei-Faktor/.test(t) ? t : "Die Nachricht ließ sich nicht senden.", "fehler");
    } finally {
      if (knopf) knopf.disabled = false;
    }
  }

  /** Nachricht mit Anhang eintragen (gleiche Felder wie auf der Webseite) und – falls der Chat noch offen ist – zeigen */
  async function eintragen(chat: string, nutzer: string, felder: Record<string, unknown>, vorschau: string, pfade: string[]) {
    const { data, error } = await sb().from("messages").insert([{ chat_id: chat, sender_id: nutzer, ...felder }]).select(SPALTEN).single();
    if (error) {
      // nichts Verwaistes liegen lassen (klappt nur, wenn die Datenbank das Löschen erlaubt)
      if (pfade.length) void sb().storage.from("chat_attachments").remove(pfade).then(() => {}, () => {});
      throw error;
    }
    await sb().from("chats").update({ last_message: vorschau.slice(0, 200) }).eq("id", chat);
    const n = data as Nachricht;
    await signieren([...String(n.image_url ?? "").split(","), n.audio_url]);
    if (aktiv !== chat) return;
    const verlauf = $("mxVerlauf");
    verlauf.querySelector(".mx-leer")?.remove();
    if (!verlauf.querySelector(`.mx-nachricht[data-id="${CSS.escape(String(n.id))}"]`)) verlauf.append(blase(n, eintraege.find((e) => e.id === chat)));
    verlauf.scrollTop = verlauf.scrollHeight;
  }
  const fehlerText = (err: unknown, sonst: string) => {
    const t = (err as { message?: string })?.message ?? "";
    return /^Zu viele|gesperrt|Zwei-Faktor|^Nur Fotos|^Dieses Foto|größer als|zu groß/.test(t) ? t : sonst;
  };

  // ---------- Fotos
  async function fotosSenden(dateien: File[]) {
    if (!aktiv || !ich || !dateien.length) return;
    const chat = aktiv;
    const nutzer = ich;
    if (dateien.length > MAX_FOTOS) u.hinweis(`Höchstens ${MAX_FOTOS} Fotos auf einmal – die ersten ${MAX_FOTOS} werden gesendet.`, "ok");
    const feld = $<HTMLTextAreaElement>("mxFeld");
    const text = feld.value.replace(/\r\n?/g, "\n").trim().slice(0, 4000);
    const knopf = $<HTMLFormElement>("mxForm").querySelector<HTMLButtonElement>('button[type="submit"]');
    if (knopf) { knopf.disabled = true; knopf.textContent = "Lädt …"; }
    const adressen: string[] = [];
    try {
      for (const d of dateien.slice(0, MAX_FOTOS)) adressen.push(await fotoHochladen(chat, nutzer, d));
      const pfade = adressen.map(pfadVon).filter((p): p is string => Boolean(p));
      await eintragen(chat, nutzer, { text: text || "[Medien]", image_url: adressen.join(",") }, text || "[Medien]", pfade.flatMap((p) => [p, vorschauPfad(p) ?? ""]).filter(Boolean));
      feld.value = "";
      feld.style.height = "auto";
    } catch (err) {
      u.hinweis(fehlerText(err, "Die Fotos ließen sich nicht senden."), "fehler");
    } finally {
      if (knopf) { knopf.disabled = false; knopf.textContent = "Senden"; }
    }
  }

  // ---------- Sprachnachrichten
  let aufnahme: Aufnahme | null = null;
  let uhr = 0;
  const aufnahmeEnde = () => {
    window.clearInterval(uhr);
    aufnahme = null;
    $("mxAufnahme").hidden = true;
    $("mxForm").hidden = !aktiv;
  };
  async function aufnahmeBeginnen() {
    if (!aktiv || !ich || aufnahme) return;
    try {
      aufnahme = await aufnahmeStarten(() => void aufnahmeSenden());
    } catch {
      u.hinweis("Kein Zugriff auf das Mikrofon – erlaube es der App in Windows (Einstellungen › Datenschutz und Sicherheit › Mikrofon).", "fehler");
      return;
    }
    $("mxForm").hidden = true;
    $("mxAufnahme").hidden = false;
    $("mxAufnahmeZeit").textContent = "0:00";
    uhr = window.setInterval(() => { $("mxAufnahmeZeit").textContent = dauerText(aufnahme?.sekunden() ?? 0); }, 250);
  }
  async function aufnahmeSenden() {
    const a = aufnahme;
    if (!a || !aktiv || !ich) return;
    const chat = aktiv;
    const nutzer = ich;
    const knopf = $<HTMLButtonElement>("mxAufnahmeSenden");
    knopf.disabled = true;
    try {
      const r = await a.stoppen();
      aufnahmeEnde();
      if (r.dauer < 1 || !r.blob.size) {
        u.hinweis("Die Sprachnachricht ist zu kurz.", "ok");
        return;
      }
      const mitschrift = u.mitschrift ? await u.mitschrift(r.blob).catch(() => null) : null;
      const adresse = await sprachHochladen(chat, nutzer, r.blob, r.typ);
      const text = `🎤 Sprachnachricht (${dauerText(r.dauer)})`;
      await eintragen(chat, nutzer, {
        text, audio_url: adresse, voice_duration: Math.round(r.dauer * 10) / 10, voice_waveform: r.verlauf, transcript: mitschrift?.slice(0, 1000) || null,
      }, text, [pfadVon(adresse) ?? ""].filter(Boolean));
    } catch (err) {
      u.hinweis(fehlerText(err, "Die Sprachnachricht ließ sich nicht senden."), "fehler");
    } finally {
      knopf.disabled = false;
      if (aufnahme === a) aufnahmeEnde();
    }
  }

  // Bedienung
  $("mxSuche").addEventListener("input", listeZeigen);
  const bilder = $<HTMLInputElement>("mxBilder");
  bilder.addEventListener("change", () => {
    const liste = Array.from(bilder.files ?? []);
    bilder.value = "";
    void fotosSenden(liste);
  });
  $("mxMikro").addEventListener("click", () => void aufnahmeBeginnen());
  $("mxAufnahmeSenden").addEventListener("click", () => void aufnahmeSenden());
  $("mxAufnahmeWeg").addEventListener("click", () => { aufnahme?.abbrechen(); aufnahmeEnde(); });
  $("mxBildZu").addEventListener("click", () => $<HTMLDialogElement>("mxBildDialog").close());
  $("mxBildDialog").addEventListener("click", (e) => { if (e.target === e.currentTarget) $<HTMLDialogElement>("mxBildDialog").close(); });
  // Fotos auch per Einfügen (Strg+V) ins Textfeld
  $("mxFeld").addEventListener("paste", (e) => {
    const dateien = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (dateien.length) {
      e.preventDefault();
      void fotosSenden(dateien);
    }
  });
  $("mxWeb").addEventListener("click", () => u.webansicht());
  const feld = $<HTMLTextAreaElement>("mxFeld");
  feld.addEventListener("input", () => { feld.style.height = "auto"; feld.style.height = `${Math.min(feld.scrollHeight, 180)}px`; });
  feld.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); void senden(); } });
  $<HTMLFormElement>("mxForm").addEventListener("submit", (e) => { e.preventDefault(); void senden(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && aktiv) gelesenMelden(aktiv); });

  return {
    /** beim Öffnen des Bereichs */
    oeffnen: () => void listeLaden(),
    /** nach An-/Abmelden */
    zuruecksetzen: () => {
      aufnahme?.abbrechen();
      aufnahmeEnde();
      aktiv = null;
      eintraege = [];
      if (kanalChat) void sb().removeChannel(kanalChat);
      if (kanalAlle) void sb().removeChannel(kanalAlle);
      kanalChat = kanalAlle = null;
      $("mxVerlauf").replaceChildren();
      $("mxTitel").textContent = "Wähle einen Chat";
      $("mxUnter").textContent = "";
      $("mxForm").hidden = true;
      void listeLaden();
    },
  };
}
