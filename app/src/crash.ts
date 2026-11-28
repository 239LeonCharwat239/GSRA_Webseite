// Crash und Schaden (Fund 28.11.: „mir sind zahlreiche Achsen durchgebrochen“, aber der Renningenieur wusste nichts –
// iRacing meldet die Reparaturzeit (PitRepairLeft) oft erst in der Box). Darum erkennt die App einen Einschlag selbst:
//  * harte Beschleunigungsspitze (LatAccel/LongAccel), die plötzlich kommt – Kurven und Bremsen bauen sich langsam auf,
//  * Tempo bricht innerhalb einer Viertelsekunde um mindestens 50 km/h ein (kein Auto bremst so),
//  * +4 Vorfallpunkte auf einmal (harter Kontakt).
// Danach fragt der Renningenieur mit einem fertigen Satz (ohne KI-Kosten) „Alles okay?“, und die KI bekommt den Einschlag
// zusammen mit Fleischball-Flagge und Motor-Warnungen mit, wenn man nach Schaden fragt.
import type { Probe } from "./typen.ts";

const G = 9.81;
const SPITZE_G = 4.5; // so stark muss die Spitze sein …
const SPRUNG_G = 3; // … und so plötzlich kommen (gegenüber dem kleinsten Wert der letzten 0,15 s)
const EINBRUCH_KMH = 50; // Tempo-Einbruch in …
const EINBRUCH_S = 0.25; // … dieser Zeit
const RUHE_S = 8; // ein Crash ist ein Ereignis, auch wenn er mehrere Messpunkte dauert
const FLEISCHBALL = 0x0010_0000; // SessionFlags: schwarze Flagge mit orangem Punkt = Pflicht-Reparatur

export type Einschlag = {
  /** Sitzungszeit des Einschlags (s) */
  zeit: number;
  /** stärkste gemessene Beschleunigung (g) */
  g: number;
  tempoVorherKmh: number;
  /** Vorfallpunkte, die dabei dazukamen (iRacing: 4 = harter Kontakt) */
  vorfaelle: number;
};

type Punkt = { zeit: number; tempo: number; g: number | null };

export class CrashWaechter {
  private verlauf: Punkt[] = [];
  private vorfaelle: number | null = null;
  private vorfaelleSeit: { zeit: number; wert: number } | null = null;
  letzter: Einschlag | null = null;

  zuruecksetzen() {
    this.verlauf = [];
    this.vorfaelle = null;
    this.vorfaelleSeit = null;
    this.letzter = null;
  }

  /** Neuer Messpunkt; gibt den Einschlag zurück, sobald einer erkannt ist (einmal je Ereignis) */
  aufnehmen(p: Probe): Einschlag | null {
    const zeit = p.zeit;
    if (zeit == null || !Number.isFinite(zeit)) return null;
    const vorher = this.verlauf.at(-1);
    if (vorher && (zeit < vorher.zeit || zeit - vorher.zeit > 1)) this.verlauf = []; // Sprung (Wiederholung, Neustart)
    const tempo = (p.tempo ?? 0) * 3.6;
    const g = p.querBeschl != null && p.laengsBeschl != null ? Math.hypot(p.querBeschl, p.laengsBeschl) / G : null;
    this.verlauf.push({ zeit, tempo, g });
    while (this.verlauf.length && zeit - this.verlauf[0].zeit > 0.5) this.verlauf.shift();

    // Vorfallpunkte: Zuwachs innerhalb von 2 s zählt zusammen
    let neueVorfaelle = 0;
    if (p.vorfaelle != null) {
      if (this.vorfaelle != null && p.vorfaelle > this.vorfaelle) {
        if (!this.vorfaelleSeit || zeit - this.vorfaelleSeit.zeit > 2) this.vorfaelleSeit = { zeit, wert: this.vorfaelle };
        neueVorfaelle = p.vorfaelle - this.vorfaelleSeit.wert;
      }
      this.vorfaelle = p.vorfaelle;
    }

    // Laufendes Ereignis: stärkste Spitze nachtragen, sonst nichts Neues
    if (this.letzter && zeit - this.letzter.zeit < RUHE_S) {
      if (zeit - this.letzter.zeit < 1 && g != null) this.letzter.g = Math.max(this.letzter.g, Math.round(g * 10) / 10);
      if (neueVorfaelle > this.letzter.vorfaelle) this.letzter.vorfaelle = neueVorfaelle;
      return null;
    }
    if (this.letzter && zeit < this.letzter.zeit) this.letzter = null; // Sitzung neu

    // Nur im Auto auf der Strecke oder daneben – nicht im Stand in der Box, nicht beim Abschleppen/Zurücksetzen
    const imAuto = p.aufStrecke !== false && p.inBox !== true && p.lage !== -1 && p.lage !== 1;
    if (!imAuto) return null;

    const juengst = this.verlauf.filter((x) => zeit - x.zeit <= 0.15 && x.g != null).map((x) => x.g as number);
    const spitze = g != null && g >= SPITZE_G && juengst.length > 1 && g - Math.min(...juengst) >= SPRUNG_G;
    const fenster = this.verlauf.filter((x) => zeit - x.zeit <= EINBRUCH_S);
    const vorherMax = Math.max(...fenster.map((x) => x.tempo));
    const einbruch = fenster.length > 2 && vorherMax - tempo >= EINBRUCH_KMH;
    const kontakt = neueVorfaelle >= 4;
    if (!spitze && !einbruch && !kontakt) return null;

    const tempoVorher = Math.max(...this.verlauf.map((x) => x.tempo));
    const staerke = Math.max(g ?? 0, einbruch ? (vorherMax - tempo) / 3.6 / EINBRUCH_S / G : 0);
    this.letzter = { zeit, g: Math.round(staerke * 10) / 10, tempoVorherKmh: Math.round(tempoVorher), vorfaelle: Math.max(0, neueVorfaelle) };
    return this.letzter;
  }
}

/** Schaden für den Renningenieur: Reparaturzeit (falls iRacing sie schon meldet), Fleischball, Motor-Warnungen und
 *  der letzte Einschlag. null = keine Angaben (Simulation liefert nichts). */
export function schadenBild(p: Probe | null, einschlag: Einschlag | null, jetzt: number | null): Record<string, unknown> | string | null {
  if (!p) return null;
  const pflicht = Math.round(p.reparatur ?? 0);
  const optional = Math.round(p.reparaturOptional ?? 0);
  const fleischball = p.flaggen != null && (p.flaggen & FLEISCHBALL) !== 0;
  const w = p.motorWarnung ?? 0;
  const warnungen = [
    w & 0x01 ? "Wassertemperatur" : null,
    w & 0x02 ? "Benzindruck" : null,
    w & 0x04 ? "Öldruck" : null,
    w & 0x40 ? "Öltemperatur" : null,
  ].filter((x): x is string => Boolean(x));
  const vor = einschlag && jetzt != null && jetzt >= einschlag.zeit ? Math.round(jetzt - einschlag.zeit) : null;
  const einschlagText = einschlag && vor != null && vor <= 20 * 60
    ? { vor_s: vor, staerke_g: einschlag.g, tempo_vorher_kmh: einschlag.tempoVorherKmh, vorfallpunkte_dazu: einschlag.vorfaelle }
    : null;
  const nichts = pflicht <= 0 && optional <= 0 && !fleischball && !warnungen.length && !einschlagText;
  if (nichts) {
    const bekannt = p.reparatur != null || p.flaggen != null || p.motorWarnung != null;
    return bekannt ? "kein Schaden gemeldet und kein Einschlag gemessen" : null;
  }
  return {
    ...(pflicht > 0 ? { pflicht_reparatur_s: pflicht } : {}),
    ...(optional > 0 ? { optionale_reparatur_s: optional } : {}),
    ...(fleischball ? { fleischball_flagge: "Pflicht-Reparatur: sofort an die Box" } : {}),
    ...(warnungen.length ? { motor_warnungen: warnungen } : {}),
    ...(einschlagText ? { letzter_einschlag: einschlagText } : {}),
    hinweis: "iRacing zeigt die genaue Reparaturzeit oft erst in der Box. Nach einem harten Einschlag ist Schaden an Aufhängung oder Lenkung wahrscheinlich.",
  };
}

/** „Alles okay?“ nach einem Einschlag – fertige Sätze, ohne KI (28 Sprachen wie der Spotter) */
export const CRASH_SAETZE: Record<string, string> = {
  de: "Alles okay bei dir? Das war ein harter Einschlag. Wenn das Auto zieht oder sich komisch anfühlt, komm an die Box.",
  en: "You okay? That was a big hit. If the car pulls or feels wrong, bring it into the pits.",
  es: "¿Estás bien? Ha sido un golpe fuerte. Si el coche tira hacia un lado o se siente raro, entra en boxes.",
  fr: "Ça va ? C'était un gros choc. Si la voiture tire ou se comporte bizarrement, rentre aux stands.",
  pt: "Estás bem? Foi uma pancada forte. Se o carro puxar ou estiver estranho, vem às boxes.",
  it: "Tutto bene? È stato un colpo forte. Se la macchina tira o sembra strana, rientra ai box.",
  nl: "Alles goed? Dat was een flinke klap. Als de auto trekt of raar aanvoelt, kom dan naar de pits.",
  pl: "Wszystko w porządku? To było mocne uderzenie. Jeśli auto ściąga albo dziwnie się prowadzi, zjedź do boksu.",
  tr: "İyi misin? Sert bir darbeydi. Araç çekiyorsa ya da garip hissettiriyorsa pite gel.",
  ru: "Ты в порядке? Это был сильный удар. Если машину уводит или она ведёт себя странно, заезжай в боксы.",
  zh: "你还好吗？刚才撞得很重。如果赛车跑偏或感觉不对，就进维修区。",
  ja: "大丈夫？かなり強くぶつかったね。車が流れたり違和感があったら、ピットに入って。",
  uk: "Ти в порядку? Це був сильний удар. Якщо машину веде вбік або вона поводиться дивно, заїжджай у бокси.",
  sv: "Är du okej? Det var en rejäl smäll. Om bilen drar eller känns konstig, kör in i depån.",
  da: "Er du okay? Det var et hårdt slag. Hvis bilen trækker eller føles mærkelig, så kør i pit.",
  fi: "Oletko kunnossa? Se oli kova isku. Jos auto vetää sivulle tai tuntuu oudolta, tule varikolle.",
  cs: "Jsi v pořádku? To byla tvrdá rána. Jestli auto táhne nebo se chová divně, zajeď do boxů.",
  sk: "Si v poriadku? To bol tvrdý náraz. Ak auto ťahá alebo sa správa divne, zíď do boxov.",
  sl: "Si v redu? To je bil močan udarec. Če avto vleče ali se čudno obnaša, pridi v bokse.",
  hr: "Jesi li dobro? To je bio jak udarac. Ako auto vuče ili se čudno ponaša, dođi u boks.",
  hu: "Minden rendben? Ez kemény ütközés volt. Ha húz az autó vagy furcsán viselkedik, gyere be a boxba.",
  ro: "Ești bine? A fost un impact puternic. Dacă mașina trage sau se simte ciudat, intră la boxe.",
  bg: "Добре ли си? Това беше силен удар. Ако колата дърпа или се държи странно, влез в бокса.",
  el: "Είσαι καλά; Ήταν δυνατό χτύπημα. Αν το αυτοκίνητο τραβάει ή φέρεται περίεργα, μπες στα πιτ.",
  et: "Kas kõik on korras? See oli kõva löök. Kui auto tõmbab või tundub imelik, tule boksi.",
  lv: "Vai viss kārtībā? Tas bija spēcīgs trieciens. Ja mašīna velk uz sāniem vai jūtas dīvaini, iebrauc boksos.",
  lt: "Ar viskas gerai? Tai buvo stiprus smūgis. Jei automobilis traukia ar elgiasi keistai, užsuk į boksus.",
  mt: "Kollox sew? Dik kienet daqqa qawwija. Jekk il-karozza tiġbed jew tħossha stramba, idħol fil-pits.",
};
export const crashSatz = (sprache: string) => CRASH_SAETZE[sprache] ?? CRASH_SAETZE.de;
