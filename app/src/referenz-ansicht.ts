// GSRA-Referenzrunden als Kärtchen (Wunsch 28.11.): je Strecke und Auto ein Kärtchen mit Bestzeit und Anzahl
// („offiziell“ = per Knopf geteilt, „aus Rennen“ = anonym übernommen). Klick zeigt die schnellsten Runden; eigene
// lassen sich zurücknehmen, Admins (mit Zwei-Faktor) löschen jede – die Datenbank prüft das (SQL 060/061).
// Alles per textContent, keine Namen.
import { referenzAdminLoeschen, referenzDarfLoeschen, referenzKarten, referenzLoeschen, referenzZeilen, type RefKarte } from "./referenz.ts";

type Optionen = {
  angemeldet: () => boolean;
  zeitText: (s: number) => string;
  /** aktuelle Strecke/Auto zuerst zeigen */
  aktuell: () => { strecke: string | null; fahrzeug: string | null };
  hinweis: (text: string, art?: "ok" | "fehler") => void;
  /** nach dem Löschen: Referenzen für den Vergleich neu laden */
  geaendert: () => void;
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse = "", text = "") => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text) e.textContent = text;
  return e;
};
const datum = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("de-DE") : "");

export function referenzAnsicht(o: Optionen) {
  const text = document.getElementById("gRefText")!;
  const karten = document.getElementById("gRefKarten")!;
  const liste = document.getElementById("gRefListe") as HTMLOListElement;
  let gewaehlt: RefKarte | null = null;
  let geladenUm = 0;
  let admin = false;

  async function listeZeigen(k: RefKarte) {
    gewaehlt = k;
    for (const b of karten.querySelectorAll(".strecke-karte")) b.classList.toggle("aktiv", (b as HTMLElement).dataset.schluessel === `${k.strecke}|${k.fahrzeug}`);
    const zeilen = await referenzZeilen(k.strecke, k.fahrzeug, 10);
    liste.hidden = false;
    liste.replaceChildren(...zeilen.map((z) => {
      const li = el("li");
      li.append(el("strong", "ref-zeit", o.zeitText(z.zeit)),
        el("span", `etikett ${z.quelle === "eigen" ? "ok" : ""}`, z.quelle === "eigen" ? "offiziell" : "aus Rennen (anonym)"));
      if (z.mitPedalen) li.append(el("span", "etikett", "mit Pedalen"));
      if (z.eigene) li.append(el("span", "etikett warn", "deine"));
      li.append(el("small", "", datum(z.datum)));
      if (z.eigene || admin) {
        const b = el("button", "knopf leise", z.eigene ? "Zurücknehmen" : "Löschen (Admin)");
        b.type = "button";
        b.addEventListener("click", async () => {
          if (!window.confirm(z.eigene ? "Deine Referenzrunde wirklich zurücknehmen?" : "Diese Referenzrunde wirklich löschen? Das steht im Moderationsprotokoll.")) return;
          b.disabled = true;
          try {
            const ok = z.eigene ? await referenzLoeschen(z.id) : await referenzAdminLoeschen(z.id);
            o.hinweis(ok ? "Referenzrunde gelöscht." : "Die Runde gibt es nicht mehr.", "ok");
            o.geaendert();
            await zeigen(true);
          } catch (e) {
            b.disabled = false;
            o.hinweis(e instanceof Error ? e.message : "Löschen hat nicht geklappt.", "fehler");
          }
        });
        li.append(b);
      }
      return li;
    }));
    if (!zeilen.length) liste.hidden = true;
  }

  async function zeigen(erzwingen = false) {
    if (!o.angemeldet()) {
      text.textContent = "Melde dich an, um die Referenzrunden der GSRA zu sehen.";
      karten.replaceChildren();
      liste.hidden = true;
      return;
    }
    if (!erzwingen && Date.now() - geladenUm < 60_000) return;
    geladenUm = Date.now();
    const [alle, darf] = await Promise.all([referenzKarten(), referenzDarfLoeschen()]);
    admin = darf;
    const { strecke, fahrzeug } = o.aktuell();
    alle.sort((a, b) => Number(b.strecke === strecke && b.fahrzeug === fahrzeug) - Number(a.strecke === strecke && a.fahrzeug === fahrzeug));
    text.textContent = alle.length
      ? `${alle.length} Strecke/Auto-Paare · „offiziell“ = per Knopf geteilt, „aus Rennen“ = schnellste Runde eines anderen Fahrers, ohne Namen.${admin ? " Du bist Admin: du kannst Referenzrunden löschen." : ""}`
      : "Noch keine Referenzrunden. Teile deine Bestzeit in „Runden“ – oder fahr ein Rennen: die schnellste Runde mit deinem Auto kommt anonym dazu.";
    karten.replaceChildren(...alle.slice(0, 60).map((k) => {
      const b = el("button", "strecke-karte");
      b.type = "button";
      b.dataset.schluessel = `${k.strecke}|${k.fahrzeug}`;
      b.append(el("strong", "", k.strecke), el("small", "", k.fahrzeug), el("span", "strecke-zeit", o.zeitText(k.bestzeit)),
        el("small", "", `${k.offiziell} offiziell · ${k.ausRennen} aus Rennen${k.mitPedalen ? " · mit Pedalen" : ""}`));
      b.addEventListener("click", () => void listeZeigen(k));
      return b;
    }));
    if (gewaehlt) {
      const noch = alle.find((k) => k.strecke === gewaehlt!.strecke && k.fahrzeug === gewaehlt!.fahrzeug);
      if (noch) await listeZeigen(noch);
      else { gewaehlt = null; liste.hidden = true; }
    }
  }

  return { zeigen };
}
