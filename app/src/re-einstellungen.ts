// „Renningenieur einstellen“ direkt in der App (Wunsch 26.11.) – gleiche Einstellungen wie auf der Webseite.
// Speichern nur über die geprüfte Datenbank-Funktion race_engineer_save (SQL 059); alle Texte per textContent.

import { gedaechtnisLaden, gedaechtnisLoeschen, gedaechtnisMerken, reLaden, reSpeichern, type ReEinstellungen, type ReThema } from "./konto.ts";
import { NUR_TEXT, SPRECH_SPRACHEN, spracheName } from "./sprachen.ts";

const STANDARD: ReEinstellungen = {
  name: "Kim", rufname: null, art: "kumpel", gespraechig: "normal", stimme: "ruhig", sprache: "auto",
  themen: { sprit: true, abstaende: true, flaggen: true, reifen: true, coaching: true, wetter: true },
};
const THEMEN: Record<ReThema, string> = { sprit: "Sprit", abstaende: "Abstände", flaggen: "Flaggen", reifen: "Reifen", coaching: "Fahrtipps", wetter: "Wetter" };
const GEDAECHTNIS_ARTEN: Record<string, string> = { vorliebe: "Vorliebe", ziel: "Ziel", staerke: "Stärke", schwaeche: "Daran arbeite ich", notiz: "Notiz" };

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

interface Umgebung {
  angemeldet: () => boolean;
  hinweis: (t: string, art?: "ok" | "fehler") => void;
  /** nach dem Speichern: Persönlichkeit neu laden (Name, Stimme, Sprache, Signalwort) */
  gespeichert: () => void;
  /** Probefunk mit dem Stand des Formulars */
  probe: (e: ReEinstellungen) => void;
}

let sprache = "auto";

/** Ausklappbare Sprachwahl mit Suche (wie auf der Webseite): nur Sprachen, die wirklich gehen */
function sprachwahl(beiWahl: (code: string) => void) {
  const feld = $<HTMLInputElement>("reSpracheFeld");
  const liste = $("reSprachListe");
  const eintraege: Array<[string, string, string]> = [
    ["auto", "Automatisch", "antwortet in deiner Sprache"],
    ...Object.entries(SPRECH_SPRACHEN).sort((a, b) => a[1].localeCompare(b[1], "de")).map(([c, n]) => [c, n, "sprechen und schreiben"] as [string, string, string]),
    ...Object.entries(NUR_TEXT).map(([c, n]) => [c, n, "nur schreiben"] as [string, string, string]),
  ];
  let markiert = -1;
  const zeigen = (offen: boolean) => {
    liste.hidden = !offen;
    feld.setAttribute("aria-expanded", String(offen));
  };
  const fuellen = () => {
    const such = feld.value.trim().toLowerCase();
    const treffer = eintraege.filter(([c, n]) => !such || n.toLowerCase().includes(such) || c === such || (such === spracheName(sprache).toLowerCase()));
    liste.replaceChildren(...treffer.map(([c, n, info], i) => {
      const li = neu("li", c === sprache ? "gewaehlt" : "");
      li.id = `reSprache-${c}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(c === sprache));
      li.append(neu("strong", "", n), neu("small", "", info));
      li.dataset.code = c;
      if (i === markiert) li.classList.add("markiert");
      li.addEventListener("mousedown", (e) => { e.preventDefault(); waehlen(c); });
      return li;
    }));
    if (!treffer.length) liste.append(neu("li", "leer", "Diese Sprache gibt es noch nicht."));
  };
  const waehlen = (code: string) => {
    sprache = code;
    feld.value = spracheName(code);
    markiert = -1;
    zeigen(false);
    beiWahl(code);
  };
  feld.addEventListener("focus", () => { feld.select(); markiert = -1; fuellen(); zeigen(true); });
  feld.addEventListener("input", () => { markiert = 0; fuellen(); zeigen(true); });
  feld.addEventListener("blur", () => { zeigen(false); feld.value = spracheName(sprache); });
  feld.addEventListener("keydown", (e) => {
    const optionen = [...liste.querySelectorAll<HTMLElement>("li[data-code]")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      zeigen(true);
      markiert = Math.max(0, Math.min(optionen.length - 1, markiert + (e.key === "ArrowDown" ? 1 : -1)));
      fuellen();
      liste.querySelector(".markiert")?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = optionen[Math.max(0, markiert)];
      if (o?.dataset.code) waehlen(o.dataset.code);
    } else if (e.key === "Escape") {
      zeigen(false);
      feld.blur();
    }
  });
  return { setzen: (code: string) => { sprache = code; feld.value = spracheName(code); } };
}

function formularLesen(f: HTMLFormElement): ReEinstellungen {
  const wert = (n: string) => ((f.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "").trim();
  const art = (f.querySelector<HTMLInputElement>('input[name="art"]:checked')?.value) ?? "kumpel";
  const themen = { ...STANDARD.themen };
  for (const i of f.querySelectorAll<HTMLInputElement>('input[name="thema"]')) themen[i.value as ReThema] = i.checked;
  return { name: wert("name") || "Kim", rufname: wert("rufname") || null, art, gespraechig: wert("gespraechig"), stimme: wert("stimme"), sprache, themen };
}

export function reEinstellungenEinrichten(u: Umgebung): { laden: () => Promise<void> } {
  const form = $<HTMLFormElement>("reForm");
  const meldung = $("reMeldung");
  const wahl = sprachwahl(() => { meldung.textContent = "Noch nicht gespeichert."; });

  // Themen-Chips
  $("reThemen").replaceChildren(...(Object.keys(THEMEN) as ReThema[]).map((t) => {
    const l = neu("label");
    const i = neu("input");
    i.type = "checkbox";
    i.name = "thema";
    i.value = t;
    l.append(i, neu("span", "", THEMEN[t]));
    return l;
  }));

  const insFormular = (e: ReEinstellungen) => {
    (form.elements.namedItem("name") as HTMLInputElement).value = e.name;
    (form.elements.namedItem("rufname") as HTMLInputElement).value = e.rufname ?? "";
    for (const r of form.querySelectorAll<HTMLInputElement>('input[name="art"]')) r.checked = r.value === e.art;
    (form.elements.namedItem("gespraechig") as HTMLSelectElement).value = e.gespraechig;
    (form.elements.namedItem("stimme") as HTMLSelectElement).value = e.stimme;
    for (const i of form.querySelectorAll<HTMLInputElement>('input[name="thema"]')) i.checked = e.themen[i.value as ReThema] !== false;
    wahl.setzen(e.sprache);
  };

  const gedaechtnisZeigen = async () => {
    const liste = await gedaechtnisLaden();
    $("reGedAnzahl").textContent = liste.length ? `${liste.length} Einträge` : "";
    const ul = $("reGedaechtnis");
    if (!liste.length) {
      ul.replaceChildren(neu("li", "leer", "Noch nichts gemerkt."));
      return;
    }
    ul.replaceChildren(...liste.map((m) => {
      const li = neu("li");
      li.append(neu("span", "re-art", GEDAECHTNIS_ARTEN[m.art] ?? m.art), neu("span", "re-eintrag", m.text));
      if (m.quelle === "renningenieur") li.append(neu("small", "re-quelle", "gelernt im Rennen"));
      const weg = neu("button", "knopf leise re-weg", "Vergessen");
      weg.type = "button";
      weg.addEventListener("click", async () => {
        if (weg.dataset.sicher !== "1") {
          weg.dataset.sicher = "1";
          weg.textContent = "Wirklich vergessen?";
          return;
        }
        try {
          await gedaechtnisLoeschen(m.id);
          void gedaechtnisZeigen();
        } catch (err) {
          u.hinweis(err instanceof Error ? err.message : "Das hat nicht geklappt.", "fehler");
        }
      });
      li.append(weg);
      return li;
    }));
  };

  const laden = async () => {
    const an = u.angemeldet();
    $("reAnmelden").hidden = an;
    form.hidden = !an;
    $("reGedaechtnisBereich").hidden = !an;
    if (!an) return;
    try {
      const e = await reLaden();
      insFormular({ ...STANDARD, ...(e ?? {}), themen: { ...STANDARD.themen, ...(e?.themen ?? {}) } } as ReEinstellungen);
      meldung.textContent = "";
      await gedaechtnisZeigen();
    } catch (err) {
      meldung.textContent = err instanceof Error ? err.message : "Die Einstellungen ließen sich nicht laden.";
    }
  };

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const e = formularLesen(form);
    const knopf = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (knopf) knopf.disabled = true;
    try {
      await reSpeichern(e);
      meldung.textContent = "Gespeichert – gilt jetzt auch auf der Webseite.";
      u.hinweis(`${e.name} ist eingestellt.`, "ok");
      u.gespeichert();
    } catch (err) {
      meldung.textContent = err instanceof Error ? err.message : "Speichern hat nicht geklappt.";
    } finally {
      if (knopf) knopf.disabled = false;
    }
  });
  form.addEventListener("input", (ev) => {
    if ((ev.target as HTMLElement).id !== "reSpracheFeld") meldung.textContent = "Noch nicht gespeichert.";
  });
  $("reProbe").addEventListener("click", () => u.probe(formularLesen(form)));
  $<HTMLFormElement>("reMerken").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.target as HTMLFormElement;
    const feld = f.elements.namedItem("text") as HTMLInputElement;
    const art = (f.elements.namedItem("art") as HTMLSelectElement).value;
    const text = feld.value.trim();
    if (text.length < 2) return u.hinweis("Bitte schreib, was er sich merken soll.", "fehler");
    try {
      await gedaechtnisMerken(art, text);
      feld.value = "";
      void gedaechtnisZeigen();
    } catch (err) {
      u.hinweis(err instanceof Error ? err.message : "Das hat nicht geklappt.", "fehler");
    }
  });
  return { laden };
}
