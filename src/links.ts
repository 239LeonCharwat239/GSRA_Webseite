// GSRA – Links in Nutzertexten anklickbar machen und vor fremden Seiten warnen (Entscheidung 24.11.2026).
// Vorbild: große Messenger zeigen vor dem Öffnen eines Links aus einem Chat das echte Ziel an. Betrugslinks tarnen
// sich gern („gsra-support.example“, Schriftzeichen, die wie lateinische Buchstaben aussehen) – deshalb zeigt der
// Hinweis die Adresse so, wie der Browser sie wirklich aufruft (ungewöhnliche Zeichen erscheinen als „xn--…“).
//  * textMitLinks(): Text sicher ausgeben (nur Textknoten, nie HTML), Adressen werden zu Links mit rel="… ugc"
//  * Ein Klick auf einen Link aus Nutzerinhalten (rel enthält „ugc“ oder data-extern) öffnet zuerst den Hinweis –
//    überall dort, wo dieses Modul geladen ist (Messenger, Marktplatz, Coaching, Dashboard, Liveries).
// Links auf die GSRA selbst öffnen ohne Hinweis.

import { dialog } from "./fenster";

const ADRESSE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const ENDE_ABSCHNEIDEN = /[.,;:!?)\]}'"»“”]+$/;

function ziel(roh: string): URL | null {
  try {
    const url = new URL(/^www\./i.test(roh) ? `https://${roh}` : roh);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function zeilen(el: HTMLElement, text: string) {
  text.split("\n").forEach((teil, i) => {
    if (i > 0) el.appendChild(document.createElement("br"));
    if (teil) el.appendChild(document.createTextNode(teil));
  });
}

export function textMitLinks(el: HTMLElement, text: string) {
  el.replaceChildren();
  let pos = 0;
  for (const treffer of text.matchAll(ADRESSE)) {
    let roh = treffer[0];
    const rest = ENDE_ABSCHNEIDEN.exec(roh)?.[0] || "";
    if (rest) roh = roh.slice(0, -rest.length);
    const url = ziel(roh);
    const start = treffer.index ?? 0;
    if (!url || roh.length < 8) continue;
    zeilen(el, text.slice(pos, start));
    const a = document.createElement("a");
    a.href = url.href;
    a.textContent = roh;
    a.target = "_blank";
    a.rel = "noopener noreferrer nofollow ugc";
    a.className = "gsra-nutzerlink";
    el.appendChild(a);
    pos = start + roh.length;
  }
  zeilen(el, text.slice(pos));
}

const eigeneSeite = (url: URL) => url.origin === window.location.origin || /(^|\.)gsra\.(de|com|net|eu)$/i.test(url.hostname);

async function warnen(url: URL): Promise<boolean> {
  const hinweise = [
    `Dieser Link führt zu: ${url.hostname}`,
    url.protocol === "http:" ? "Die Verbindung zu dieser Seite ist nicht verschlüsselt." : "",
    /(^|\.)xn--/i.test(url.hostname) ? "Achtung: Die Adresse enthält ungewöhnliche Schriftzeichen und könnte eine bekannte Seite nachahmen." : "",
    "Öffne ihn nur, wenn du dem Absender vertraust. Die GSRA fragt nie per Chat nach Passwörtern, Codes oder Zahlungen.",
  ].filter(Boolean);
  return Boolean(await dialog({
    icon: "fa-arrow-up-right-from-square",
    title: "Du verlässt die GSRA",
    message: hinweise.join("\n\n"),
    confirmText: "Link öffnen",
    cancelText: "Abbrechen",
  }));
}

function klickAbfangen(e: MouseEvent) {
  if (e.defaultPrevented || e.button > 1) return;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || !(/(^|\s)ugc(\s|$)/.test(a.rel) || a.hasAttribute("data-extern"))) return;
  const url = ziel(a.href);
  if (!url || eigeneSeite(url)) return;
  e.preventDefault();
  e.stopPropagation();
  void warnen(url).then((ok) => {
    if (ok) window.open(url.href, "_blank", "noopener,noreferrer");
  });
}

declare global {
  interface Window {
    gsraTextMitLinks?: typeof textMitLinks;
    gsraLinkWarnung?: boolean;
  }
}
if (!window.gsraLinkWarnung) {
  window.gsraLinkWarnung = true;
  document.addEventListener("click", klickAbfangen, true);
  document.addEventListener("auxclick", klickAbfangen, true);
}
window.gsraTextMitLinks = textMitLinks;
