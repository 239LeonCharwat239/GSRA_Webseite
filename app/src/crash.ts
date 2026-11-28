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
export function schadenBild(p: Probe | null, einschlag: Einschlag | null, jetzt: number | null, aus: Auswirkung | null = null): Record<string, unknown> | string | null {
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
  const spuerbar = aus && (aus.lenkungSchiefGrad != null || aus.topspeedJetztKmh != null)
    ? {
        ...(aus.lenkungSchiefGrad != null ? { lenkrad_auf_geraden_schief_grad: aus.lenkungSchiefGrad } : {}),
        ...(aus.topspeedJetztKmh != null ? { topspeed_vorher_kmh: aus.topspeedVorherKmh, topspeed_jetzt_kmh: aus.topspeedJetztKmh } : {}),
      }
    : null;
  const laeuft = aus?.messung && (!aus.messung.lenkung || !aus.messung.topspeed)
    ? `Auswirkung am Auto wird noch gemessen: ${[!aus.messung.lenkung ? "Lenkung nach ein paar Sekunden Vollgas geradeaus" : null, !aus.messung.topspeed ? "Topspeed nach der nächsten ganzen Runde" : null].filter(Boolean).join(", ")}`
    : null;
  const nichts = pflicht <= 0 && optional <= 0 && !fleischball && !warnungen.length && !einschlagText && !spuerbar && !laeuft;
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
    ...(spuerbar ? { am_auto_gemessen: spuerbar } : {}),
    ...(laeuft ? { messung_laeuft: laeuft } : {}),
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

// ---------------------------------------------------------------- Schaden aus dem Fahrverhalten (Fund 28.11.)
// iRacing meldet die Reparaturzeit (PitRepairLeft) meist erst in der Box – „womöglich Schaden, aber ich sehe nichts“.
// Was man im Fahren SIEHT: Nach einem Einschlag steht das Lenkrad auf Geraden schief (Spur/Aufhängung verbogen) und
// der Topspeed fällt (Aero, Motor). Beides misst die App selbst und vergleicht mit der Zeit vor dem Einschlag.

const GERADE_TEMPO = 27; // m/s (~100 km/h)
const GERADE_QUER = 1.5; // m/s² – kaum Querkraft
const LENK_FENSTER = 900; // Messpunkte (~15 s Geradeaus-Fahrt bei 60 Hz)

export type Auswirkung = {
  lenkungSchiefGrad: number | null; topspeedVorherKmh: number | null; topspeedJetztKmh: number | null; ausfluege: number;
  /** nach einem Einschlag: was schon gemessen ist (null = kein Einschlag) */
  messung: { lenkung: boolean; topspeed: boolean } | null;
};

export class Fahrverhalten {
  private vorCrash: number[] = []; // Lenkwinkel geradeaus vor dem Einschlag (rad)
  private nachCrash: number[] = [];
  private topVorher = 0; // höchstes Tempo vor dem Einschlag (m/s)
  private topRunde = 0; // höchstes Tempo seit dem Einschlag in der aktuellen Runde
  private topLetzte: number | null = null; // höchstes Tempo der letzten ganzen Runde nach dem Einschlag
  private crash = false;
  private runde: number | null = null;
  private vorherLage: number | null = null;
  private ausflugZeit = -Infinity;
  ausfluege = 0;

  zuruecksetzen() {
    this.vorCrash = [];
    this.nachCrash = [];
    this.topVorher = 0;
    this.topRunde = 0;
    this.topLetzte = null;
    this.crash = false;
    this.runde = null;
    this.vorherLage = null;
    this.ausflugZeit = -Infinity;
    this.ausfluege = 0;
  }

  /** Einschlag erkannt: ab jetzt wird „nachher“ gemessen */
  einschlag() {
    this.crash = true;
    this.nachCrash = [];
    this.topRunde = 0;
    this.topLetzte = null;
  }

  aufnehmen(p: Probe): void {
    // eigene Zählung der Ausflüge neben die Strecke (iRacing zählt X nicht in jeder Sitzungsart)
    if (p.lage === 0 && this.vorherLage !== 0 && p.zeit != null && p.zeit - this.ausflugZeit > 3) {
      this.ausfluege++;
      this.ausflugZeit = p.zeit;
    }
    if (p.lage != null) this.vorherLage = p.lage;
    if (p.inBox || p.aufStrecke === false) return;
    const v = p.tempo ?? 0;
    if (p.runde != null && p.runde !== this.runde) {
      if (this.crash && this.runde != null && this.topRunde > 0) this.topLetzte = this.topRunde;
      this.topRunde = 0;
      this.runde = p.runde;
    }
    if (this.crash) this.topRunde = Math.max(this.topRunde, v);
    else this.topVorher = Math.max(this.topVorher, v);
    const geradeaus = v > GERADE_TEMPO && p.querBeschl != null && Math.abs(p.querBeschl) < GERADE_QUER
      && (p.gas ?? 0) > 0.8 && (p.bremse ?? 0) < 0.05 && p.lenkung != null && Math.abs(p.lenkung) < 0.5;
    if (!geradeaus) return;
    const ziel = this.crash ? this.nachCrash : this.vorCrash;
    ziel.push(p.lenkung as number);
    if (ziel.length > LENK_FENSTER) ziel.shift();
  }

  /** Was man am Auto merkt; null-Werte = (noch) nichts Auffälliges oder zu wenig Daten */
  auswirkung(): Auswirkung {
    const mittel = (w: number[]) => w.reduce((a, b) => a + b, 0) / w.length;
    let schief: number | null = null;
    if (this.crash && this.nachCrash.length >= 120) {
      const basis = this.vorCrash.length >= 120 ? mittel(this.vorCrash) : 0;
      const grad = ((mittel(this.nachCrash) - basis) * 180) / Math.PI;
      if (Math.abs(grad) >= 2) schief = Math.round(Math.abs(grad) * 10) / 10;
    }
    const vorher = this.topVorher > 0 ? Math.round(this.topVorher * 3.6) : null;
    const jetzt = this.topLetzte != null ? Math.round(this.topLetzte * 3.6) : null;
    const verlust = vorher != null && jetzt != null && vorher - jetzt >= 4;
    return {
      lenkungSchiefGrad: schief, topspeedVorherKmh: verlust ? vorher : null, topspeedJetztKmh: verlust ? jetzt : null, ausfluege: this.ausfluege,
      messung: this.crash ? { lenkung: this.nachCrash.length >= 120, topspeed: this.topLetzte != null } : null,
    };
  }
}

/** Nach einem Einschlag das Messergebnis von selbst ansagen (wie der Crew Chief in iRacing: „aero damage is slowing
 *  you“) – jedes Ergebnis einmal; gesagt merkt sich, was schon angesagt ist. Deutsch oder Englisch. */
export function schadenMeldung(a: Auswirkung, gesagt: Set<string>, en: boolean): string | null {
  if (!a.messung) return null;
  if (a.lenkungSchiefGrad != null && !gesagt.has("lenkung")) {
    gesagt.add("lenkung");
    const g = String(a.lenkungSchiefGrad).replace(".", en ? "." : ",");
    return en ? `Damage check: on the straights your steering is ${g} degrees off centre – the alignment is bent, the car will pull. If it gets worse, box.`
      : `Schaden-Check: Auf den Geraden steht dein Lenkrad ${g} Grad schief – Spur oder Aufhängung sind verbogen, das Auto zieht. Wird es schlimmer, komm an die Box.`;
  }
  if (a.topspeedJetztKmh != null && a.topspeedVorherKmh != null && !gesagt.has("topspeed")) {
    gesagt.add("topspeed");
    const d = a.topspeedVorherKmh - a.topspeedJetztKmh;
    return en ? `Damage check: you've lost about ${d} km/h of top speed (${a.topspeedJetztKmh} instead of ${a.topspeedVorherKmh}) – probably aero or engine damage.`
      : `Schaden-Check: Dir fehlen etwa ${d} km/h Topspeed (${a.topspeedJetztKmh} statt ${a.topspeedVorherKmh}) – wahrscheinlich Aero- oder Motorschaden.`;
  }
  if (a.messung.lenkung && a.messung.topspeed && a.lenkungSchiefGrad == null && a.topspeedJetztKmh == null && !gesagt.has("ok")) {
    gesagt.add("ok");
    return en ? "Good news: after the hit I can't measure anything wrong with the car – steering straight, top speed as before."
      : "Gute Nachricht: Nach dem Einschlag messe ich am Auto nichts Auffälliges – Lenkung gerade, Topspeed wie vorher.";
  }
  return null;
}
