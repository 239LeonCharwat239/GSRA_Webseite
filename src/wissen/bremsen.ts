// GSRA – Nachschlagewerk: Bremsen & Elektronik
import { kategorie } from "./begriff";

export const BREMSEN = kategorie("Bremsen & Elektronik", [
  { id: "bremsbalance", begriff: "Bremsbalance", englisch: "Brake Bias / Brake Balance",
    kurz: "Verteilung der Bremskraft zwischen Vorder- und Hinterachse.",
    text: [
      "Die Bremsbalance gibt an, welcher Anteil der Bremskraft auf die Vorderachse wirkt, zum Beispiel 58 Prozent. Weil sich beim Bremsen Last nach vorn verlagert, kann die Vorderachse mehr Bremskraft übertragen als die Hinterachse.",
      "Liegt die Balance zu weit vorn, blockieren zuerst die Vorderräder: Das Auto bleibt stabil, lässt sich aber kaum noch lenken. Liegt sie zu weit hinten, blockieren die Hinterräder, und das Heck kann ausbrechen.",
      "Die optimale Balance ändert sich mit Kraftstoffmenge, Reifenzustand, Abtrieb und Grip. Deshalb lässt sie sich in vielen Fahrzeugen während der Fahrt verstellen."
    ],
    tipp: "Blockieren beim harten Anbremsen zuerst die Vorderräder, schiebe die Balance einen Schritt nach hinten. Wird das Heck unruhig, wieder nach vorn. Im Regen meist etwas weiter nach vorn.",
    siehe: ["blockieren", "brake-migration", "abs", "gewichtsverlagerung"] },

  { id: "bremsdruck", begriff: "Bremsdruck", englisch: "Brake Pressure",
    kurz: "Hydraulischer Druck im Bremssystem – bestimmt die Bremskraft.",
    text: [
      "Wenn du das Bremspedal trittst, erzeugt der Hauptbremszylinder einen Druck in der Bremsflüssigkeit, der die Kolben in den Bremssätteln gegen die Scheiben presst. Je höher der Druck, desto stärker die Bremswirkung.",
      "In der Telemetrie wird der Bremsdruck oder die Pedalstellung als Kurve über die Zeit angezeigt. Ein typisches gutes Bremsmanöver beginnt mit einem schnellen, hohen Spitzenwert und baut den Druck dann kontrolliert ab, während das Auto langsamer wird und weniger Abtrieb hat.",
      "Viele Simulationen erlauben zusätzlich, den maximalen Bremsdruck einzustellen, damit das Pedal zur eigenen Pedalerie passt."
    ],
    tipp: "Vergleiche deine Bremsdruckkurve mit einer schnelleren Runde: Erreichst du den Spitzenwert zu langsam, verschenkst du Bremsweg; bleibt er zu lange hoch, blockieren die Räder.",
    siehe: ["threshold-braking", "trail-braking", "hauptbremszylinder", "load-cell"] },

  { id: "bremsscheibe", begriff: "Bremsscheibe", englisch: "Brake Disc / Rotor",
    kurz: "Rotierende Scheibe, gegen die die Bremsbeläge gepresst werden.",
    text: [
      "Die Bremsscheibe ist fest mit dem Rad verbunden und dreht sich mit. Beim Bremsen reiben die Beläge an ihr und wandeln Bewegungsenergie in Wärme um.",
      "Im Rennsport bestehen Scheiben aus Grauguss, Stahl oder bei Spitzenfahrzeugen aus Kohlefaser-Keramik oder Kohlenstoff. Kohlenstoffbremsen arbeiten erst bei sehr hohen Temperaturen optimal und verzögern dann außerordentlich stark.",
      "Innenbelüftete Scheiben mit Kühlkanälen leiten die enorme Wärme besser ab."
    ],
    tipp: "Behalte die Bremstemperaturen im Blick: Zu kalte Scheiben – etwa hinter dem Safety Car – bremsen schlechter; zu heiße lassen nach.",
    siehe: ["bremsbelag", "bremsfading", "bremsbelueftung", "brake-warming"] },

  { id: "bremsbelag", begriff: "Bremsbelag", englisch: "Brake Pad",
    kurz: "Reibmaterial, das gegen die Bremsscheibe gedrückt wird.",
    text: [
      "Bremsbeläge bestehen aus einer Trägerplatte und einem Reibmaterial, dessen Zusammensetzung das Bremsverhalten bestimmt. Rennbeläge sind für sehr hohe Temperaturen ausgelegt.",
      "Unterschiedliche Belagmischungen bieten mehr oder weniger Anfangsbiss, unterschiedliche Temperaturfenster und Verschleiß. Für Langstreckenrennen werden Beläge gewählt, die eine ganze Distanz durchhalten oder mit einem planbaren Wechsel auskommen.",
      "In manchen Simulationen lässt sich die Belagmischung im Setup wählen, und ihr Verschleiß wird über die Renndauer simuliert."
    ],
    tipp: "Im Langstreckenrennen: Prüfe vor dem Start, ob die Beläge die geplante Distanz schaffen, und plane einen Wechsel rechtzeitig in die Stoppstrategie ein.",
    siehe: ["bremsscheibe", "verglasung-bremsbelaege", "bremsfading"] },

  { id: "bremssattel", begriff: "Bremssattel", englisch: "Brake Caliper",
    kurz: "Bauteil, das die Beläge mit Hydraulikkolben gegen die Scheibe drückt.",
    text: [
      "Der Bremssattel umgreift die Bremsscheibe. In ihm sitzen Kolben, die vom Bremsdruck nach außen gedrückt werden und die Beläge gegen die Scheibe pressen.",
      "Rennbremssättel haben oft vier bis acht Kolben und sind fest mit dem Radträger verschraubt. Eine hohe Steifigkeit sorgt dafür, dass sich der Sattel unter Last nicht aufweitet – das Pedal bleibt hart und präzise.",
      "Größe und Anzahl der Kolben bestimmen zusammen mit dem Hauptbremszylinder, wie viel Pedalkraft für eine bestimmte Bremswirkung nötig ist."
    ],
    tipp: "Ein weiches, langes Pedalgefühl deutet im echten Auto auf überhitzte Flüssigkeit oder Luft im System hin – in Simulationen meist auf Fading durch Überhitzung.",
    siehe: ["hauptbremszylinder", "bremsbelag", "bremsdruck"] },

  { id: "hauptbremszylinder", begriff: "Hauptbremszylinder", englisch: "Master Cylinder",
    kurz: "Wandelt die Pedalkraft in hydraulischen Druck um.",
    text: [
      "Der Hauptbremszylinder sitzt am Bremspedal. Tritt der Fahrer, drückt ein Kolben die Bremsflüssigkeit in die Leitungen zu den Sätteln.",
      "Im Rennsport gibt es meist zwei Hauptbremszylinder, einen für jede Achse. Über eine Waage (Balance Bar) zwischen ihnen wird die Bremsbalance eingestellt. Ihr Durchmesser bestimmt, wie viel Druck je Pedalkraft entsteht: Kleinere Zylinder erzeugen mehr Druck, brauchen aber mehr Pedalweg.",
      "In Simulationen findest du das oft als Einstellung des Pedaldrucks oder der Bremsbalance."
    ],
    tipp: "Wenn dein Bremspedal zu hart ist und du den maximalen Druck nicht erreichst, erhöhe im Setup oder in den Pedaleinstellungen die Bremskraft statt das Pedal mit Gewalt zu treten.",
    siehe: ["bremsbalance", "bremsdruck", "load-cell"] },

  { id: "bremsfluessigkeit", begriff: "Bremsflüssigkeit", englisch: "Brake Fluid",
    kurz: "Hydraulikflüssigkeit, die den Druck vom Pedal zu den Bremsen überträgt.",
    text: [
      "Bremsflüssigkeit ist nahezu nicht komprimierbar und überträgt so den Pedaldruck direkt auf die Kolben. Ihr Siedepunkt ist entscheidend: Wird sie zu heiß, bilden sich Dampfblasen.",
      "Dampf lässt sich – anders als Flüssigkeit – zusammendrücken. Das Pedal wird weich und lang, im Extremfall fällt die Bremswirkung fast ganz aus. Rennbremsflüssigkeiten haben deshalb sehr hohe Siedepunkte.",
      "Flüssigkeit nimmt mit der Zeit Wasser auf, was den Siedepunkt senkt – im echten Motorsport wird sie deshalb häufig gewechselt."
    ],
    tipp: "Im Simracing spielt die Flüssigkeit kaum eine Rolle. Sie erklärt aber, warum Bremsen bei extremer Belastung nicht nur an den Belägen nachlassen.",
    siehe: ["bremsfading", "stahlflexleitungen", "hauptbremszylinder"] },

  { id: "stahlflexleitungen", begriff: "Stahlflexleitungen", englisch: "Braided Brake Lines",
    kurz: "Bremsschläuche mit Stahlgeflecht, die sich unter Druck kaum aufweiten.",
    text: [
      "Normale Gummibremsschläuche dehnen sich unter hohem Druck leicht aus. Ein Teil des Pedalwegs geht dadurch verloren, das Pedal wirkt weicher.",
      "Stahlflexleitungen sind mit einem Geflecht aus Edelstahl ummantelt. Sie weiten sich kaum auf, das Pedal wird fester und präziser zu dosieren.",
      "Im Rennsport sind sie Standard; im Breitensport ein beliebtes Nachrüstteil."
    ],
    tipp: "Ein festes, präzises Pedal ist im Simracing genauso wichtig – deshalb sind Pedalerien mit Druckmessung so beliebt.",
    siehe: ["bremsfluessigkeit", "load-cell", "hydraulikpedale"] },

  { id: "blockieren", begriff: "Blockieren", englisch: "Lock-up",
    kurz: "Ein Rad hört beim Bremsen auf zu drehen und rutscht.",
    text: [
      "Übersteigt die Bremskraft den Grip eines Reifens, blockiert das Rad. Ein rutschender Reifen überträgt weniger Bremskraft als ein rollender und kann keine Seitenführung mehr aufbauen.",
      "Blockierende Vorderräder machen das Auto unlenkbar – es fährt geradeaus weiter. Blockierende Hinterräder lassen das Heck ausbrechen. Zudem entstehen Bremsplatten.",
      "Häufige Ursachen sind zu viel Bremsdruck bei nachlassendem Abtrieb, eine falsche Bremsbalance, Bodenwellen oder entlastete Räder in der Kurve."
    ],
    tipp: "Löse den Druck bei einem Blockieren sofort leicht. Am häufigsten blockiert das kurveninnere Vorderrad beim späten Bremsen in die Kurve – dort hilft weniger Druck beim Einlenken.",
    siehe: ["bremsplatte", "bremsbalance", "abs", "threshold-braking"] },

  { id: "bremsfading", begriff: "Bremsfading", englisch: "Brake Fade",
    kurz: "Nachlassende Bremswirkung durch Überhitzung.",
    text: [
      "Werden die Bremsen zu heiß, sinkt der Reibwert der Beläge, und die Bremswirkung lässt spürbar nach. Bei extremer Hitze kann zusätzlich die Bremsflüssigkeit sieden.",
      "Fading tritt nach mehreren harten Bremsungen kurz hintereinander auf, bei zu wenig Bremskühlung oder bei sehr hohen Außentemperaturen. Der Bremsweg wird länger, das Pedal fühlt sich anders an.",
      "Viele Simulationen modellieren Bremstemperaturen und Fading – besonders bei historischen Fahrzeugen mit schwachen Bremsen."
    ],
    tipp: "Wenn die Bremse nachlässt, bremse etwas früher und weniger hart und nutze den Windschatten nicht zu lange hinter anderen Autos. Im Setup: mehr Bremskühlung.",
    siehe: ["bremsbelueftung", "bremsfluessigkeit", "bremsscheibe"] },

  { id: "verglasung-bremsbelaege", begriff: "Verglasung der Bremsbeläge", englisch: "Pad Glazing",
    kurz: "Die Belagoberfläche wird glatt und hart und bremst schlechter.",
    text: [
      "Werden Bremsbeläge stark überhitzt und kühlen danach ab, oder werden sie dauerhaft mit geringem Druck geschleift, kann sich ihre Oberfläche verhärten. Sie wird glänzend und verliert Reibwert.",
      "Die Folge ist eine schwächere Bremswirkung, die sich nicht wie Fading nach dem Abkühlen erholt. Erst Abrieb legt wieder frisches Material frei.",
      "Im echten Motorsport werden neue Beläge deshalb sorgfältig eingefahren."
    ],
    tipp: "Vermeide langes Schleifen der Bremse mit wenig Druck. Bremse kurz und kräftig, statt lange und zaghaft.",
    siehe: ["bremsbelag", "bremsfading", "left-foot-braking"] },

  { id: "trail-braking", begriff: "Trail Braking", englisch: "Trail Braking",
    kurz: "Bremsen bis in die Kurve hinein, während der Bremsdruck schrittweise gelöst wird.",
    text: [
      "Statt vor der Kurve vollständig abzubremsen und erst danach einzulenken, wird der Bremsdruck beim Einlenken kontrolliert abgebaut. Bremsen und Lenken überlagern sich.",
      "Die verbleibende Last auf der Vorderachse erhöht dort den Grip und hilft beim Einlenken. Zugleich wird der Bremsweg optimal genutzt, weil die Reifen bis zum Scheitelpunkt an ihrer Grenze arbeiten.",
      "Trail Braking ist eine der wichtigsten Techniken schneller Fahrer, braucht aber Gefühl: Zu viel Restdruck lässt das Heck ausbrechen oder das kurveninnere Rad blockieren."
    ],
    tipp: "Beginne mit wenig Restdruck und lass ihn bis kurz vor dem Scheitelpunkt auslaufen. In der Telemetrie zeigt sich eine gute Ausführung als gleichmäßig abfallende Bremskurve, die mit dem Lenkwinkel überlappt.",
    siehe: ["threshold-braking", "grip-kreis", "gewichtsverlagerung", "einlenkpunkt"] },

  { id: "threshold-braking", begriff: "Bremsen am Limit", englisch: "Threshold Braking",
    kurz: "Bremsen knapp unter der Blockiergrenze für den kürzesten Bremsweg.",
    text: [
      "Der kürzeste Bremsweg entsteht, wenn die Reifen genau an ihrer Haftgrenze arbeiten – mit optimalem Längsschlupf, aber ohne zu blockieren. Diese Technik heißt Threshold Braking.",
      "Weil der Abtrieb mit sinkender Geschwindigkeit abnimmt, muss der Bremsdruck im Verlauf des Bremsvorgangs reduziert werden, um an der Grenze zu bleiben. Am Anfang ist der höchste Druck möglich.",
      "Mit ABS übernimmt die Elektronik einen Teil dieser Arbeit; ohne ABS ist es eine Fähigkeit, die viel Übung erfordert."
    ],
    tipp: "Trete am Bremspunkt schnell und kräftig auf das Pedal und baue den Druck dann gleichmäßig ab. Ein Pedal mit Druckmessung hilft, das Gefühl dafür zu entwickeln.",
    siehe: ["trail-braking", "laengsschlupf", "blockieren", "bremsdruck"] },

  { id: "left-foot-braking", begriff: "Bremsen mit links", englisch: "Left-Foot Braking",
    kurz: "Bremsen mit dem linken Fuß, während der rechte das Gas bedient.",
    text: [
      "In Fahrzeugen ohne Kupplungspedal oder mit sequenziellem Getriebe bremsen viele Rennfahrer mit dem linken Fuß. So entfällt der Wechsel zwischen den Pedalen, und Gas und Bremse können sich überlappen.",
      "Das ermöglicht feinste Korrekturen: Mit einem Hauch Bremse lässt sich das Auto beim Einlenken stabilisieren, mit etwas Gas während des Bremsens das Heck beruhigen.",
      "Die Technik erfordert Übung, weil der linke Fuß meist nicht an feine Dosierung gewöhnt ist. Gleichzeitiges Bremsen und Gasgeben belastet zudem Bremsen und Kraftstoffverbrauch."
    ],
    tipp: "Übe Bremsen mit links zuerst mit früheren Bremspunkten, bis der Druck sitzt. Achte darauf, den Fuß auf der Geraden komplett vom Pedal zu nehmen, sonst schleift die Bremse.",
    siehe: ["trail-braking", "verglasung-bremsbelaege", "sequenzielles-getriebe"] },

  { id: "abs", begriff: "ABS", englisch: "Anti-Lock Braking System",
    kurz: "Antiblockiersystem, das ein Blockieren der Räder verhindert.",
    text: [
      "Das ABS überwacht die Drehzahl jedes Rades. Droht eines zu blockieren, reduziert es den Bremsdruck an diesem Rad für Sekundenbruchteile und erhöht ihn danach wieder. So bleibt das Fahrzeug lenkbar und der Bremsweg kurz.",
      "Im Rennsport ist ABS je nach Fahrzeugklasse erlaubt – bei GT-Fahrzeugen meist ja, bei Formelfahrzeugen und Prototypen oft nicht. Rennversionen lassen sich in Stufen einstellen: Niedrige Stufen erlauben mehr Schlupf und kürzere Bremswege, hohe greifen früher ein und sind sicherer.",
      "Wer sich voll auf ABS verlässt, bremst meist nicht optimal: Ein dauerhaft regelndes System verlängert den Bremsweg."
    ],
    tipp: "Senke die ABS-Stufe, solange du die Räder noch kontrolliert hältst. Im Regen und auf abgefahrenen Reifen hilft eine höhere Stufe.",
    siehe: ["blockieren", "threshold-braking", "traktionskontrolle", "laengsschlupf"] },

  { id: "traktionskontrolle", begriff: "Traktionskontrolle", englisch: "Traction Control (TC)",
    kurz: "Elektronik, die das Durchdrehen der Antriebsräder begrenzt.",
    text: [
      "Die Traktionskontrolle vergleicht die Drehzahl der Antriebsräder mit der Fahrzeuggeschwindigkeit. Dreht ein Rad zu stark durch, nimmt sie Motorleistung weg – etwa über Zündung, Drosselklappe oder Einspritzung.",
      "Rennsysteme sind meist in Stufen einstellbar und oft in mehrere Parameter aufgeteilt: wie viel Schlupf erlaubt ist, wie stark eingegriffen wird und wie schnell. Hohe Stufen sind sicher, kosten aber Beschleunigung; niedrige Stufen sind schneller, verlangen aber Gefühl.",
      "Bei nachlassenden Reifen oder im Regen kann eine höhere Stufe im Verlauf eines Stints Zeit retten."
    ],
    tipp: "Hörst und spürst du die Traktionskontrolle am Kurvenausgang ständig eingreifen, ist entweder die Stufe zu hoch oder du gibst zu früh zu viel Gas.",
    siehe: ["tc-slip", "tc-cut", "tc-gain", "traktion"] },

  { id: "tc-slip", begriff: "TC Slip", englisch: "TC Slip",
    kurz: "Wie viel Radschlupf die Traktionskontrolle zulässt, bevor sie eingreift.",
    text: [
      "Bei mehrstufigen Systemen legt der Slip-Wert fest, ab welchem Schlupf die Traktionskontrolle Leistung reduziert. Ein höherer Schwellenwert lässt die Räder stärker arbeiten, ein niedrigerer greift früher ein.",
      "Etwas Schlupf ist für maximale Beschleunigung nötig. Ein zu niedriger Wert bremst das Auto unnötig ein, ein zu hoher lässt die Reifen durchdrehen und überhitzen.",
      "In manchen Fahrzeugen wird dieser Wert einfach als TC-Stufe bezeichnet."
    ],
    tipp: "Stelle den Slip so ein, dass das Heck am Kurvenausgang leicht arbeitet, ohne wegzulaufen. Bei frischen Reifen geht oft weniger, bei alten mehr Regelung.",
    siehe: ["traktionskontrolle", "tc-cut", "laengsschlupf"] },

  { id: "tc-cut", begriff: "TC Cut", englisch: "TC Cut",
    kurz: "Wie stark die Traktionskontrolle die Leistung bei einem Eingriff reduziert.",
    text: [
      "Erkennt die Traktionskontrolle zu viel Schlupf, nimmt sie Leistung weg. Der Cut-Wert bestimmt, wie viel. Ein starker Cut stoppt das Durchdrehen sofort, kostet aber viel Vortrieb; ein schwacher Cut regelt sanfter.",
      "Bei manchen Fahrzeugen lässt sich der Cut separat vom Slip einstellen. So kann man ein System bauen, das früh, aber sanft eingreift – oder spät, aber entschlossen.",
      "Ein zu starker Cut fühlt sich an wie ein Stottern des Motors am Kurvenausgang."
    ],
    tipp: "Spürst du am Kurvenausgang ein deutliches Stottern, versuche einen geringeren Cut bei gleichem Slip.",
    siehe: ["traktionskontrolle", "tc-slip", "tc-gain"] },

  { id: "tc-gain", begriff: "TC Gain", englisch: "TC Gain",
    kurz: "Wie schnell und aggressiv die Traktionskontrolle reagiert.",
    text: [
      "Der Gain-Wert beschreibt die Empfindlichkeit der Regelung: Wie schnell erkennt und beantwortet das System eine Schlupfänderung?",
      "Ein hoher Gain reagiert sofort und hält den Schlupf eng um den Zielwert, kann aber nervös wirken. Ein niedriger Gain regelt ruhiger, lässt dafür kurzzeitig mehr Schlupf zu.",
      "Welche Parameter verfügbar sind und wie sie heißen, unterscheidet sich je nach Fahrzeug und Simulation."
    ],
    tipp: "Ändere bei mehrteiliger Traktionskontrolle immer nur einen Parameter. Beginne mit dem Slip, verfeinere dann Cut und Gain.",
    siehe: ["traktionskontrolle", "tc-slip", "tc-cut"] },

  { id: "motorbremse", begriff: "Motorbremse", englisch: "Engine Braking",
    kurz: "Bremswirkung des Motors beim Gaswegnehmen.",
    text: [
      "Nimmt der Fahrer das Gas weg, wird der Motor von den Rädern angetrieben und bremst das Fahrzeug über die Antriebsachse. Diese Wirkung kommt zur eigentlichen Bremse hinzu.",
      "Eine starke Motorbremse verzögert vor allem die Hinterräder und kann das Heck beim Anbremsen und Herunterschalten unruhig machen. Viele Rennfahrzeuge erlauben deshalb, sie einzustellen – etwa durch eine leicht geöffnete Drosselklappe beim Bremsen.",
      "Sie hängt eng mit der Bremsbalance und dem Differential auf Schub zusammen: Alle drei bestimmen, wie stabil das Heck beim Anbremsen bleibt."
    ],
    tipp: "Neigt das Heck beim Anbremsen und Herunterschalten zum Ausbrechen, reduziere die Motorbremse oder öffne das Differential auf Schub.",
    siehe: ["bremsbalance", "diff-schub", "zwischengas"] },

  { id: "brake-migration", begriff: "Bremsbalance-Verlauf", englisch: "Brake Migration",
    kurz: "Automatische Verschiebung der Bremsbalance während eines Bremsvorgangs.",
    text: [
      "Bei manchen Fahrzeugen, vor allem in der Formel 1 und bei modernen Prototypen, kann die Bremsbalance im Verlauf eines Bremsvorgangs automatisch wandern. Am Anfang, bei viel Abtrieb und hohem Druck, liegt sie weiter vorn; mit abnehmendem Druck wandert sie nach hinten – oder umgekehrt.",
      "So lässt sich die Balance an die wechselnden Bedingungen anpassen: Hohe Geschwindigkeit mit viel Abtrieb verträgt andere Werte als das Ende der Bremszone mit wenig Abtrieb und eingeschlagener Lenkung.",
      "Der Verlauf wird meist in Prozent und in Abhängigkeit vom Pedaldruck angegeben."
    ],
    tipp: "Blockiert das Vorderrad erst gegen Ende der Bremszone, kann eine Migration nach hinten mit abnehmendem Druck helfen.",
    siehe: ["bremsbalance", "brake-by-wire", "trail-braking"] },

  { id: "brake-warming", begriff: "Bremsen aufwärmen", englisch: "Brake Warming",
    kurz: "Bremsen gezielt auf Temperatur bringen, damit sie optimal arbeiten.",
    text: [
      "Rennbremsen arbeiten nur in einem bestimmten Temperaturbereich gut. Nach langen Gelbphasen, hinter dem Safety Car oder auf der Out-Lap kühlen sie aus und bremsen schwächer.",
      "Fahrer wärmen die Bremsen deshalb gezielt auf, etwa durch kräftiges Bremsen auf Geraden oder durch leichtes Schleifen mit dem linken Fuß. Bei Kohlenstoffbremsen ist das besonders wichtig, weil sie kalt kaum verzögern.",
      "Gleichzeitig dürfen die Bremsen nicht überhitzen – auch das ist ein Balanceakt."
    ],
    tipp: "Bremse vor einem Neustart einige Male kräftig, aber kontrolliert – das bringt Wärme in Bremsen und Reifen.",
    siehe: ["bremsscheibe", "reifen-warmup", "safety-car"] },

  { id: "brake-by-wire", begriff: "Brake-by-Wire", englisch: "Brake-by-Wire (BBW)",
    kurz: "Elektronisch gesteuerte Bremse, bei der ein Rechner die Kraftverteilung regelt.",
    text: [
      "Bei Hybridfahrzeugen bremst nicht nur die Reibungsbremse, sondern auch der Elektromotor, der Energie zurückgewinnt. Damit die Gesamtbremswirkung gleich bleibt, berechnet ein Steuergerät, wie viel Kraft die Reibungsbremse liefern muss.",
      "Der Fahrer tritt das Pedal wie gewohnt, ein Rechner verteilt die Bremskraft. So bleibt die Bremse berechenbar, auch wenn die Rückgewinnung schwankt – etwa bei voller Batterie.",
      "In der Formel 1 und bei Hybrid-Prototypen ist das an der Hinterachse Standard."
    ],
    tipp: "Bei Hybridfahrzeugen kann sich das Bremsgefühl je nach Ladezustand leicht ändern. Achte besonders in den ersten Runden auf die Bremspunkte.",
    siehe: ["harvest", "ers", "bremsbalance"] },

  { id: "launch-control", begriff: "Startautomatik", englisch: "Launch Control",
    kurz: "Elektronik, die beim stehenden Start Drehzahl und Schlupf optimal regelt.",
    text: [
      "Beim stehenden Start entscheidet der erste Meter. Die Startautomatik hält den Motor auf einer festgelegten Drehzahl und regelt beim Losfahren den Radschlupf, damit möglichst viel Kraft auf die Straße kommt.",
      "Wo sie erlaubt ist, stellt der Fahrer die Drehzahl vorher ein und lässt beim Start nur die Kupplung kommen. Wo sie verboten ist, muss er Kupplung und Gas selbst dosieren.",
      "Viele Rennserien und Simulationen erlauben sie für bestimmte Fahrzeugklassen."
    ],
    tipp: "Ohne Startautomatik: Finde den Schleifpunkt der Kupplung und übe den Start im Training. Zu viel Drehzahl lässt die Räder durchdrehen, zu wenig würgt den Motor ab.",
    siehe: ["stehender-start", "schleifpunkt", "anti-stall"] },

  { id: "pit-limiter", begriff: "Boxengassenbegrenzer", englisch: "Pit Limiter",
    kurz: "Hält das Fahrzeug in der Boxengasse automatisch auf der erlaubten Geschwindigkeit.",
    text: [
      "In der Boxengasse gilt ein Tempolimit, häufig 60 oder 80 km/h. Der Begrenzer regelt die Motorleistung so, dass dieses Limit nicht überschritten wird – der Fahrer kann voll Gas geben.",
      "Er muss vor der Linie zur Boxeneinfahrt aktiviert und erst nach der Linie am Ende der Boxengasse deaktiviert werden. Wer zu spät aktiviert oder zu früh löst, riskiert eine Strafe.",
      "Ein Teil der Boxenstopp-Zeit hängt davon ab, wie gut man bis zur Linie bremst und danach wieder beschleunigt."
    ],
    tipp: "Bremse so spät wie möglich, aber sicher auf die Boxengeschwindigkeit herunter und aktiviere den Begrenzer kurz vor der Linie. Beim Herausfahren erst nach der Linie lösen.",
    siehe: ["boxengasse", "boxeneinfahrt", "boxenstopp-verlust"] },

  { id: "motorkennfeld", begriff: "Motorkennfeld", englisch: "Engine Map / Throttle Map / Mapping",
    kurz: "Programm in der Motorsteuerung, das Leistung, Gasannahme und Verbrauch festlegt.",
    text: [
      "Ein Kennfeld bestimmt, wie viel Leistung der Motor bei welcher Gaspedalstellung und Drehzahl abgibt, wie stark er verbraucht und wie er auf das Pedal reagiert.",
      "Rennfahrzeuge haben oft mehrere Kennfelder: leistungsstarke für Qualifying und Überholmanöver, sparsame für lange Stints, sanfte für Regen. Ein Gaspedal-Kennfeld (Throttle Map) legt fest, wie linear das Pedal anspricht – eine sanfte Kurve hilft bei schlechter Traktion.",
      "In Langstreckenrennen wird häufig zwischen Kennfeldern gewechselt, um Kraftstoff zu sparen oder zu überholen."
    ],
    tipp: "Im Regen hilft ein Kennfeld mit weicher Gasannahme. Im Rennen spart ein Sparmodus auf langen Geraden Kraftstoff, ohne in den Kurven Zeit zu kosten.",
    siehe: ["spritsparen", "traktion", "pedalkurve"] },

  { id: "ers", begriff: "Energierückgewinnung", englisch: "ERS / Hybrid System",
    kurz: "Hybridsystem, das Energie speichert und als Zusatzleistung wieder abgibt.",
    text: [
      "Ein Energierückgewinnungssystem wandelt beim Bremsen oder aus Abgaswärme Energie in Strom um, speichert ihn in einer Batterie oder einem Kondensator und gibt ihn beim Beschleunigen als zusätzliche Leistung ab.",
      "Im Rennsport bringt das nicht nur Leistung, sondern auch Strategie: Wann wird Energie gesammelt, wann eingesetzt? Viele Serien begrenzen, wie viel Energie pro Runde oder Stint genutzt werden darf.",
      "In der Formel 1 und bei Hybrid-Prototypen ist ERS ein zentraler Teil des Antriebs."
    ],
    tipp: "Setze die gespeicherte Energie dort ein, wo sie am meisten bringt: beim Herausbeschleunigen aus langsamen Kurven vor langen Geraden und beim Überholen.",
    siehe: ["mgu-k", "mgu-h", "deploy", "harvest"] },

  { id: "mgu-k", begriff: "MGU-K", englisch: "Motor Generator Unit – Kinetic",
    kurz: "Elektromotor, der Bremsenergie zurückgewinnt und als Leistung wieder abgibt.",
    text: [
      "Die MGU-K ist mit dem Antriebsstrang verbunden. Beim Bremsen arbeitet sie als Generator, bremst das Fahrzeug mit und lädt den Energiespeicher. Beim Beschleunigen wird sie zum Motor und liefert zusätzliche Leistung.",
      "In der Formel 1 ist ihre Leistung seit 2026 deutlich gestiegen und macht einen großen Teil der Gesamtleistung aus. Wie viel Energie sie pro Runde zurückgewinnen und abgeben darf, regelt das Reglement.",
      "Ihre Bremswirkung erklärt, warum Hybridfahrzeuge ein Brake-by-Wire-System brauchen."
    ],
    tipp: "Ein Teil der Bremswirkung stammt bei Hybridfahrzeugen aus der Rückgewinnung. Ist der Speicher voll, kann sich das Bremsgefühl ändern.",
    siehe: ["ers", "mgu-h", "brake-by-wire", "harvest"] },

  { id: "mgu-h", begriff: "MGU-H", englisch: "Motor Generator Unit – Heat",
    kurz: "Elektromaschine am Turbolader, die Energie aus den Abgasen gewinnt.",
    text: [
      "Die MGU-H sitzt auf der Welle des Turboladers. Sie wandelt überschüssige Energie aus dem Abgasstrom in Strom um oder treibt den Lader elektrisch an, um das Turboloch zu vermeiden.",
      "Sie war technisch beeindruckend, aber sehr teuer und komplex. In der Formel 1 wurde sie mit dem Reglement 2026 abgeschafft.",
      "In Simulationen aus der Zeit zwischen 2014 und 2025 spielt sie weiterhin eine Rolle."
    ],
    tipp: "Bei Fahrzeugen mit MGU-H gibt es praktisch kein Turboloch – die Leistung ist sofort da, was die Dosierung am Kurvenausgang erleichtert.",
    siehe: ["ers", "mgu-k", "turboloch", "turbolader"] },

  { id: "deploy", begriff: "Energieabgabe", englisch: "Deploy / Deployment",
    kurz: "Einsatz gespeicherter Hybridenergie als zusätzliche Leistung.",
    text: [
      "Deployment bezeichnet, wann und wie viel elektrische Energie abgegeben wird. Das kann automatisch nach einem Modus geschehen oder vom Fahrer gezielt über einen Knopf ausgelöst werden.",
      "Weil die Energie pro Runde begrenzt ist, entscheidet die Strategie: Wird sie gleichmäßig verteilt, auf bestimmten Geraden konzentriert oder für Überholmanöver aufgespart?",
      "Viele Fahrzeuge bieten verschiedene Deploy-Modi, etwa für Qualifying, Rennen, Angriff und Verteidigung."
    ],
    tipp: "Spare Energie in Runden ohne Zweikampf und setze sie gezielt ein, wenn du angreifen oder dich verteidigen musst.",
    siehe: ["harvest", "soc", "ers"] },

  { id: "harvest", begriff: "Energierückgewinnung beim Bremsen", englisch: "Harvest / Harvesting",
    kurz: "Sammeln von Energie für den Hybridspeicher.",
    text: [
      "Harvesting bezeichnet das Sammeln von Energie – vor allem beim Bremsen, teilweise auch beim Gaswegnehmen am Ende von Geraden. Die Elektromaschine arbeitet dann als Generator.",
      "Bei einigen Fahrzeugen kann der Fahrer zwischen Modi wählen, die mehr oder weniger Energie sammeln. Mehr Rückgewinnung bremst stärker mit dem Elektromotor und kann das Fahrverhalten beim Anbremsen verändern.",
      "Moderne Reglements erlauben teils auch Rückgewinnung über Teillast, was Fahrstil und Strategie beeinflusst."
    ],
    tipp: "Achte bei hohem Rückgewinnungsmodus auf das Heck beim Anbremsen – die zusätzliche Bremswirkung an der Hinterachse kann es unruhig machen.",
    siehe: ["deploy", "mgu-k", "brake-by-wire", "lift-coast"] },

  { id: "soc", begriff: "Ladezustand", englisch: "State of Charge (SoC)",
    kurz: "Füllstand des Hybrid-Energiespeichers in Prozent.",
    text: [
      "Der Ladezustand zeigt, wie viel Energie im Speicher bereitsteht. Ein voller Speicher erlaubt viel Zusatzleistung, ein leerer gar keine.",
      "Fahrer und Ingenieure planen den Ladezustand über eine Runde und einen Stint: Wo wird geladen, wo wird abgegeben, wie viel Reserve bleibt für Zweikämpfe?",
      "Ein leerer Speicher am Ende einer Geraden kann im Zweikampf entscheidend sein."
    ],
    tipp: "Behalte den Ladezustand im Display. Geht er zur Neige, wechsle in einen Modus, der mehr sammelt, bevor du ihn für einen Angriff brauchst.",
    siehe: ["deploy", "harvest", "ers"] },
]);
