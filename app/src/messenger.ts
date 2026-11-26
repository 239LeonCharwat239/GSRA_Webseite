// Messenger direkt in der App (Wunsch 26.11.: Webseite nativ übertragen – Messenger zuerst).
// Erste Fassung: Chatliste, Lesen, Schreiben, Live-Updates, Lesestand (mark_chat_read), ungelesene Chats.
// Gleiche Datenbank und gleiche Regeln wie die Webseite: Was jemand sehen und schreiben darf, entscheiden die
// Zugriffsregeln der Datenbank (RLS, Sperren, Zwei-Faktor, Spam-Grenzen) – die App fragt nur mit der eigenen
// Anmeldung. Alle Texte per textContent, nie als HTML. Bilder, Sprachnachrichten, Reaktionen, Gruppen verwalten:
// vorerst über „Alle Funktionen“ (Webansicht des Messengers).

import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "./konto.ts";

type Chat = { id: string; title: string | null; user1_id: string; user2_id: string; last_message: string | null; created_at: string };
type Nachricht = {
  id: string; chat_id: string; sender_id: string; text: string | null; image_url: string | null; audio_url?: string | null;
  created_at: string; is_edited?: boolean | null;
};
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
    if (n.audio_url) el.append(neu("span", "mx-medium", "🎤 Sprachnachricht – in „Alle Funktionen“ anhören"));
    if (n.image_url) el.append(neu("span", "mx-medium", "🖼 Bild – in „Alle Funktionen“ ansehen"));
    const t = (n.text ?? "").trim();
    if (t && t !== "[Medien]") el.append(neu("p", "", t));
    el.append(neu("small", "mx-zeit", `${uhrzeit(n.created_at)}${n.is_edited ? " · bearbeitet" : ""}`));
    return el;
  }

  async function chatOeffnen(id: string) {
    aktiv = id;
    const eintrag = eintraege.find((e) => e.id === id);
    $("mxTitel").textContent = eintrag?.name ?? "Chat";
    $("mxUnter").textContent = eintrag?.art === "forum" ? "Alle Mitglieder der GSRA" : eintrag?.art === "gruppe" ? "Gruppe" : "Privatchat";
    $("mxForm").hidden = false;
    const verlauf = $("mxVerlauf");
    verlauf.replaceChildren(neu("p", "mx-leer", "Lädt …"));
    const [{ data }, { data: ausgeblendet }] = await Promise.all([
      sb().from("messages").select("id, chat_id, sender_id, text, image_url, audio_url, created_at, is_edited")
        .eq("chat_id", id).order("created_at", { ascending: false }).limit(MAX_NACHRICHTEN),
      sb().from("message_hides").select("message_id").eq("user_id", ich ?? ""),
    ]);
    if (aktiv !== id) return;
    const weg = new Set(((ausgeblendet as { message_id: string }[] | null) ?? []).map((h) => String(h.message_id)));
    const nachrichten = ((data as Nachricht[] | null) ?? []).filter((n) => !weg.has(String(n.id))).reverse();
    await nameVon(nachrichten.map((n) => n.sender_id));
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
        await nameVon([n.sender_id]);
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
      const { data, error } = await sb().from("messages").insert([{ chat_id: aktiv, sender_id: ich, text }]).select("id, chat_id, sender_id, text, image_url, created_at").single();
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

  // Bedienung
  $("mxSuche").addEventListener("input", listeZeigen);
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
