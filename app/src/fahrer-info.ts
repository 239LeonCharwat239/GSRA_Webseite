// Fahrer-Infos am Funk (Wunsch 28.11.): Bei „Wer ist vor/hinter mir?“ gleich iRating, Lizenz mit Safety Rating und
// Vorfallpunkte („X“) dazu, offene Strafen und Verwarnungen – und automatisch, wenn ein neues Auto vor oder hinter dir
// auftaucht. Eigene Strafen, Verwarnungen und die Fleischball-Flagge sagt der Renningenieur sofort an. Alles aus
// iRacing (Fahrerliste der Sitzung, SessionFlags / CarIdxSessionFlags), fertige Sätze ohne KI-Kosten.
/** Was für die Ansage reicht (aus der Fahrerliste der Sitzung) */
type Info = { irating?: number | null; lizenz?: string | null; vorfaelle?: number | null };

// SessionFlags (irsdk_Flags)
const SCHWARZ = 0x0001_0000; // Strafe (Durchfahrt, Stop-and-Go, …)
const DISQUALIFIZIERT = 0x0002_0000;
const VERWARNUNG = 0x0008_0000; // schwarz-weiße Flagge
const REPARATUR = 0x0010_0000; // Fleischball

export type Strafe = "strafe" | "verwarnung" | "reparatur" | null;

export function strafeAus(flaggen: number | null | undefined): Strafe {
  if (flaggen == null || !Number.isFinite(flaggen) || flaggen < 0) return null;
  if (flaggen & (SCHWARZ | DISQUALIFIZIERT)) return "strafe";
  if (flaggen & REPARATUR) return "reparatur";
  if (flaggen & VERWARNUNG) return "verwarnung";
  return null;
}

/** „iRating 2345, A 4.99, 3 X“ – Zahlen und Kürzel, die Simracer in jeder Sprache so sagen */
export function fahrerZusatz(f: Info | null | undefined): string {
  if (!f) return "";
  const teile = [
    f.irating ? `iRating ${f.irating}` : null,
    f.lizenz ? f.lizenz : null,
    f.vorfaelle != null ? `${f.vorfaelle} X` : null,
  ].filter(Boolean);
  return teile.join(", ");
}

/** „#27 Anna Beispiel (iRating 2345, A 4.99, 3 X)“ */
export function werMitInfo(name: string, nummer: string, f: Info | null | undefined): string {
  const z = fahrerZusatz(f);
  return `${nummer ? `#${nummer} ` : ""}${name}${z ? ` (${z})` : ""}`;
}

type Saetze = { neuVor: string; neuHinter: string; strafe: string; verwarnung: string; duStrafe: string; duVerwarnung: string; duReparatur: string };
export const FAHRER_SAETZE: Record<string, Saetze> = {
  de: { neuVor: "Neu vor dir: {wer}.", neuHinter: "Neu hinter dir: {wer}.", strafe: "{wer} hat eine Strafe offen.", verwarnung: "{wer} hat eine Verwarnung.", duStrafe: "Du hast eine Strafe bekommen – schau in die Black Box.", duVerwarnung: "Verwarnung für dich – pass auf die Streckenbegrenzung auf.", duReparatur: "Fleischball-Flagge: Pflicht-Reparatur, komm an die Box." },
  en: { neuVor: "New car ahead: {wer}.", neuHinter: "New car behind: {wer}.", strafe: "{wer} has a penalty pending.", verwarnung: "{wer} has a warning.", duStrafe: "You've got a penalty – check the black box.", duVerwarnung: "You've got a warning – watch the track limits.", duReparatur: "Meatball flag: mandatory repair, box now." },
  es: { neuVor: "Nuevo coche delante: {wer}.", neuHinter: "Nuevo coche detrás: {wer}.", strafe: "{wer} tiene una sanción pendiente.", verwarnung: "{wer} tiene una advertencia.", duStrafe: "Tienes una sanción: mira la caja negra.", duVerwarnung: "Tienes una advertencia: cuidado con los límites de pista.", duReparatur: "Bandera con disco naranja: reparación obligatoria, entra en boxes." },
  fr: { neuVor: "Nouvelle voiture devant : {wer}.", neuHinter: "Nouvelle voiture derrière : {wer}.", strafe: "{wer} a une pénalité en attente.", verwarnung: "{wer} a un avertissement.", duStrafe: "Tu as une pénalité – regarde la black box.", duVerwarnung: "Avertissement pour toi – attention aux limites de piste.", duReparatur: "Drapeau noir à disque orange : réparation obligatoire, rentre aux stands." },
  pt: { neuVor: "Novo carro à frente: {wer}.", neuHinter: "Novo carro atrás: {wer}.", strafe: "{wer} tem uma penalização pendente.", verwarnung: "{wer} tem um aviso.", duStrafe: "Levaste uma penalização – vê a black box.", duVerwarnung: "Tens um aviso – cuidado com os limites da pista.", duReparatur: "Bandeira com disco laranja: reparação obrigatória, vem às boxes." },
  it: { neuVor: "Nuova macchina davanti: {wer}.", neuHinter: "Nuova macchina dietro: {wer}.", strafe: "{wer} ha una penalità da scontare.", verwarnung: "{wer} ha un avvertimento.", duStrafe: "Hai una penalità: guarda la black box.", duVerwarnung: "Avvertimento per te: attento ai limiti della pista.", duReparatur: "Bandiera nera con disco arancione: riparazione obbligatoria, rientra ai box." },
  nl: { neuVor: "Nieuwe auto voor je: {wer}.", neuHinter: "Nieuwe auto achter je: {wer}.", strafe: "{wer} heeft een straf openstaan.", verwarnung: "{wer} heeft een waarschuwing.", duStrafe: "Je hebt een straf gekregen – kijk in de black box.", duVerwarnung: "Waarschuwing voor jou – let op de baanlimieten.", duReparatur: "Oranje-bolvlag: verplichte reparatie, kom naar de pits." },
  pl: { neuVor: "Nowe auto przed tobą: {wer}.", neuHinter: "Nowe auto za tobą: {wer}.", strafe: "{wer}: kara do odbycia.", verwarnung: "{wer}: ostrzeżenie.", duStrafe: "Dostałeś karę – sprawdź black box.", duVerwarnung: "Ostrzeżenie dla ciebie – uważaj na limity toru.", duReparatur: "Flaga z pomarańczowym kołem: obowiązkowa naprawa, zjedź do boksu." },
  tr: { neuVor: "Önünde yeni araç: {wer}.", neuHinter: "Arkanda yeni araç: {wer}.", strafe: "{wer}: bekleyen ceza.", verwarnung: "{wer}: uyarı.", duStrafe: "Ceza aldın – black box'a bak.", duVerwarnung: "Uyarı aldın – pist sınırlarına dikkat et.", duReparatur: "Turuncu daireli bayrak: zorunlu onarım, pite gel." },
  ru: { neuVor: "Новая машина впереди: {wer}.", neuHinter: "Новая машина сзади: {wer}.", strafe: "{wer}: невыполненный штраф.", verwarnung: "{wer}: предупреждение.", duStrafe: "Тебе штраф – посмотри в блэк-бокс.", duVerwarnung: "Тебе предупреждение – следи за границами трассы.", duReparatur: "Флаг с оранжевым кругом: обязательный ремонт, заезжай в боксы." },
  zh: { neuVor: "前面换了车：{wer}。", neuHinter: "后面换了车：{wer}。", strafe: "{wer}：有未执行的处罚。", verwarnung: "{wer}：收到警告。", duStrafe: "你被处罚了——看一下黑盒。", duVerwarnung: "你收到警告——注意赛道边界。", duReparatur: "橙色圆点旗：必须维修，进维修区。" },
  ja: { neuVor: "前に新しい車：{wer}。", neuHinter: "後ろに新しい車：{wer}。", strafe: "{wer}：ペナルティ未消化。", verwarnung: "{wer}：警告あり。", duStrafe: "ペナルティが出た。ブラックボックスを確認して。", duVerwarnung: "警告が出た。トラックリミットに注意して。", duReparatur: "ミートボールフラッグ：修理が必要、ピットに入って。" },
  uk: { neuVor: "Нова машина попереду: {wer}.", neuHinter: "Нова машина позаду: {wer}.", strafe: "{wer}: невиконаний штраф.", verwarnung: "{wer}: попередження.", duStrafe: "Тобі штраф – подивись у блек-бокс.", duVerwarnung: "Тобі попередження – стеж за межами траси.", duReparatur: "Прапор з помаранчевим колом: обов'язковий ремонт, заїжджай у бокси." },
  sv: { neuVor: "Ny bil framför: {wer}.", neuHinter: "Ny bil bakom: {wer}.", strafe: "{wer}: straff väntar.", verwarnung: "{wer}: varning.", duStrafe: "Du har fått ett straff – kolla black boxen.", duVerwarnung: "Varning till dig – håll koll på banbegränsningarna.", duReparatur: "Flagga med orange prick: obligatorisk reparation, kör in i depån." },
  da: { neuVor: "Ny bil foran: {wer}.", neuHinter: "Ny bil bagved: {wer}.", strafe: "{wer}: straf afventer.", verwarnung: "{wer}: advarsel.", duStrafe: "Du har fået en straf – tjek black boxen.", duVerwarnung: "Advarsel til dig – pas på banegrænserne.", duReparatur: "Flag med orange prik: obligatorisk reparation, kør i pit." },
  fi: { neuVor: "Uusi auto edessä: {wer}.", neuHinter: "Uusi auto takana: {wer}.", strafe: "{wer}: rangaistus odottaa.", verwarnung: "{wer}: varoitus.", duStrafe: "Sait rangaistuksen – katso black box.", duVerwarnung: "Sait varoituksen – varo ratarajoja.", duReparatur: "Oranssipalloinen lippu: pakollinen korjaus, tule varikolle." },
  cs: { neuVor: "Nové auto před tebou: {wer}.", neuHinter: "Nové auto za tebou: {wer}.", strafe: "{wer}: nevykonaný trest.", verwarnung: "{wer}: varování.", duStrafe: "Dostal jsi trest – podívej se do black boxu.", duVerwarnung: "Varování pro tebe – hlídej limity trati.", duReparatur: "Vlajka s oranžovým kruhem: povinná oprava, zajeď do boxů." },
  sk: { neuVor: "Nové auto pred tebou: {wer}.", neuHinter: "Nové auto za tebou: {wer}.", strafe: "{wer}: nevykonaný trest.", verwarnung: "{wer}: varovanie.", duStrafe: "Dostal si trest – pozri sa do black boxu.", duVerwarnung: "Varovanie pre teba – dávaj pozor na limity trate.", duReparatur: "Vlajka s oranžovým kruhom: povinná oprava, zíď do boxov." },
  sl: { neuVor: "Nov avto pred tabo: {wer}.", neuHinter: "Nov avto za tabo: {wer}.", strafe: "{wer}: kazen čaka.", verwarnung: "{wer}: opozorilo.", duStrafe: "Dobil si kazen – poglej v black box.", duVerwarnung: "Opozorilo zate – pazi na meje steze.", duReparatur: "Zastava z oranžnim krogom: obvezno popravilo, pridi v bokse." },
  hr: { neuVor: "Novi auto ispred: {wer}.", neuHinter: "Novi auto iza: {wer}.", strafe: "{wer}: kazna na čekanju.", verwarnung: "{wer}: upozorenje.", duStrafe: "Dobio si kaznu – pogledaj black box.", duVerwarnung: "Upozorenje za tebe – pazi na granice staze.", duReparatur: "Zastava s narančastim krugom: obvezan popravak, dođi u boks." },
  hu: { neuVor: "Új autó előtted: {wer}.", neuHinter: "Új autó mögötted: {wer}.", strafe: "{wer}: büntetés vár rá.", verwarnung: "{wer}: figyelmeztetés.", duStrafe: "Büntetést kaptál – nézd meg a black boxot.", duVerwarnung: "Figyelmeztetést kaptál – figyelj a pályahatárokra.", duReparatur: "Narancs korongos zászló: kötelező javítás, gyere be a boxba." },
  ro: { neuVor: "Mașină nouă în față: {wer}.", neuHinter: "Mașină nouă în spate: {wer}.", strafe: "{wer}: penalizare în așteptare.", verwarnung: "{wer}: avertisment.", duStrafe: "Ai primit o penalizare – verifică black box-ul.", duVerwarnung: "Avertisment pentru tine – atenție la limitele pistei.", duReparatur: "Steag cu disc portocaliu: reparație obligatorie, intră la boxe." },
  bg: { neuVor: "Нова кола пред теб: {wer}.", neuHinter: "Нова кола зад теб: {wer}.", strafe: "{wer}: чакащо наказание.", verwarnung: "{wer}: предупреждение.", duStrafe: "Получи наказание – виж черната кутия.", duVerwarnung: "Предупреждение за теб – внимавай с границите на пистата.", duReparatur: "Флаг с оранжев кръг: задължителен ремонт, влез в бокса." },
  el: { neuVor: "Νέο αυτοκίνητο μπροστά: {wer}.", neuHinter: "Νέο αυτοκίνητο πίσω: {wer}.", strafe: "{wer}: εκκρεμεί ποινή.", verwarnung: "{wer}: προειδοποίηση.", duStrafe: "Πήρες ποινή – δες το black box.", duVerwarnung: "Προειδοποίηση για σένα – πρόσεξε τα όρια της πίστας.", duReparatur: "Σημαία με πορτοκαλί κύκλο: υποχρεωτική επισκευή, μπες στα πιτ." },
  et: { neuVor: "Uus auto ees: {wer}.", neuHinter: "Uus auto taga: {wer}.", strafe: "{wer}: karistus ootel.", verwarnung: "{wer}: hoiatus.", duStrafe: "Said karistuse – vaata black boxi.", duVerwarnung: "Said hoiatuse – jälgi rajapiire.", duReparatur: "Oranži täpiga lipp: kohustuslik remont, tule boksi." },
  lv: { neuVor: "Jauna mašīna priekšā: {wer}.", neuHinter: "Jauna mašīna aizmugurē: {wer}.", strafe: "{wer}: gaida sods.", verwarnung: "{wer}: brīdinājums.", duStrafe: "Tu saņēmi sodu – paskaties black box.", duVerwarnung: "Brīdinājums tev – uzmanies ar trases robežām.", duReparatur: "Karogs ar oranžu apli: obligāts remonts, iebrauc boksos." },
  lt: { neuVor: "Naujas automobilis priekyje: {wer}.", neuHinter: "Naujas automobilis už tavęs: {wer}.", strafe: "{wer}: laukia bauda.", verwarnung: "{wer}: įspėjimas.", duStrafe: "Gavai baudą – pažiūrėk į black box.", duVerwarnung: "Įspėjimas tau – saugokis trasos ribų.", duReparatur: "Vėliava su oranžiniu skrituliu: privalomas remontas, užsuk į boksus." },
  mt: { neuVor: "Karozza ġdida quddiemek: {wer}.", neuHinter: "Karozza ġdida warajk: {wer}.", strafe: "{wer}: penali pendenti.", verwarnung: "{wer}: twissija.", duStrafe: "Ħadt penali – iċċekkja l-black box.", duVerwarnung: "Twissija għalik – oqgħod attent għal-limiti tal-korsa.", duReparatur: "Bandiera b'tond oranġjo: tiswija obbligatorja, idħol fil-pits." },
};

export function fahrerSatz(sprache: string, k: keyof Saetze, wer = ""): string {
  return (FAHRER_SAETZE[sprache] ?? FAHRER_SAETZE.de)[k].replace("{wer}", wer);
}

/** Satz zur Strafe eines anderen Fahrers (Fleischball wird bei anderen nicht angesagt) */
export function strafeSatz(sprache: string, s: Strafe, wer: string): string | null {
  return s === "strafe" ? fahrerSatz(sprache, "strafe", wer) : s === "verwarnung" ? fahrerSatz(sprache, "verwarnung", wer) : null;
}

/** Eigene Strafen: meldet nur, wenn eine NEU dazukommt (einmal je Flagge) */
export class StrafenWaechter {
  private vorher: Strafe = null;
  pruefen(flaggen: number | null | undefined): Strafe {
    const s = strafeAus(flaggen);
    const neu = s !== null && s !== this.vorher ? s : null;
    this.vorher = s;
    return neu;
  }
}

/** Neuer Vorder- oder Hintermann: erst ansagen, wenn er 3 s stabil dort ist und höchstens 2,5 s Abstand hat;
 *  der erste nach dem Start wird still übernommen; höchstens eine Ansage alle 15 s */
export class NachbarWaechter {
  private kandidat: Record<"vor" | "hinter", { idx: number; seit: number } | null> = { vor: null, hinter: null };
  private bekannt: Record<"vor" | "hinter", number | null | undefined> = { vor: undefined, hinter: undefined };
  private letzteAnsage = -Infinity;

  zuruecksetzen() {
    this.kandidat = { vor: null, hinter: null };
    this.bekannt = { vor: undefined, hinter: undefined };
    this.letzteAnsage = -Infinity;
  }

  pruefen(zeit: number, lage: Record<"vor" | "hinter", { idx: number; abstand: number | null } | null>): Array<"vor" | "hinter"> {
    const melden: Array<"vor" | "hinter"> = [];
    for (const seite of ["vor", "hinter"] as const) {
      const n = lage[seite];
      if (!n) {
        this.kandidat[seite] = null;
        continue;
      }
      const k = this.kandidat[seite];
      if (!k || k.idx !== n.idx || zeit < k.seit) {
        this.kandidat[seite] = { idx: n.idx, seit: zeit };
        continue;
      }
      if (zeit - k.seit < 3 || this.bekannt[seite] === n.idx) continue;
      const erstes = this.bekannt[seite] === undefined;
      this.bekannt[seite] = n.idx;
      if (erstes || n.abstand == null || n.abstand > 2.5 || zeit - this.letzteAnsage < 15) continue;
      this.letzteAnsage = zeit;
      melden.push(seite);
    }
    return melden;
  }
}
