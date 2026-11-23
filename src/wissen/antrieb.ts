// GSRA – Nachschlagewerk: Antrieb, Motor & Getriebe
import { kategorie } from "./begriff";

export const ANTRIEB = kategorie("Antrieb, Motor & Getriebe", [
  { id: "zweitaktmotor", begriff: "Zweitaktmotor", englisch: "Two-Stroke Engine",
    kurz: "Motor, der pro Kurbelwellenumdrehung einmal zündet.",
    text: [
      "Beim Zweitakter laufen Ansaugen, Verdichten, Arbeiten und Ausstoßen in nur zwei Kolbenhüben ab. Jede Umdrehung der Kurbelwelle liefert einen Arbeitstakt – doppelt so viele wie beim Viertakter.",
      "Dadurch sind Zweitakter leicht, einfach aufgebaut und leistungsstark für ihre Größe. Ihr Nachteil sind höherer Verbrauch, mehr Emissionen und ein schmales nutzbares Drehzahlband.",
      "Im Motorsport findet man sie heute vor allem im Kartsport und bei kleinen Motorrädern."
    ],
    tipp: "Zweitakt-Karts haben ein sehr schmales Leistungsband. Halte die Drehzahl in Kurven hoch – fällt sie zu tief, fehlt beim Herausbeschleunigen spürbar Kraft.",
    siehe: ["viertaktmotor", "drehzahl", "leistung"] },

  { id: "viertaktmotor", begriff: "Viertaktmotor", englisch: "Four-Stroke Engine",
    kurz: "Motor mit vier Arbeitstakten über zwei Kurbelwellenumdrehungen.",
    text: [
      "Der Viertakter arbeitet in vier Schritten: Ansaugen, Verdichten, Arbeiten (Zündung und Verbrennung) und Ausstoßen. Gesteuert wird der Gaswechsel über Ventile, die von Nockenwellen betätigt werden.",
      "Er ist effizienter und sauberer als ein Zweitakter und lässt sich über einen breiten Drehzahlbereich gut nutzen. Fast alle Automobilrennfahrzeuge nutzen Viertaktmotoren – ob als Saugmotor oder mit Aufladung.",
      "Anzahl und Anordnung der Zylinder (etwa Reihe, V oder Boxer) prägen Laufkultur, Bauraum und Schwerpunkt."
    ],
    tipp: "Jeder Motor hat seinen eigenen Charakter. Finde heraus, wo das Drehmoment am stärksten ist – das bestimmt den idealen Schaltpunkt mehr als die Höchstdrehzahl.",
    siehe: ["zweitaktmotor", "hubraum", "drehmoment"] },

  { id: "hubraum", begriff: "Hubraum", englisch: "Displacement",
    kurz: "Das gesamte Volumen, das die Kolben aller Zylinder bei einem Hub verdrängen.",
    text: [
      "Der Hubraum ergibt sich aus Zylinderbohrung, Kolbenhub und Zylinderzahl und wird meist in Kubikzentimetern oder Litern angegeben. Ein Vierliter-Motor verdrängt bei jeder Kurbelwellenumdrehung insgesamt zwei Liter, über zwei Umdrehungen vier Liter.",
      "Mehr Hubraum bedeutet grundsätzlich mehr Drehmoment und Leistung, weil mehr Luft und Kraftstoff verbrannt werden können. Durch Aufladung lässt sich aus kleinem Hubraum jedoch ebenfalls viel Leistung gewinnen.",
      "Viele Rennserien begrenzen den Hubraum oder gleichen Unterschiede über Balance of Performance aus."
    ],
    tipp: "Großvolumige Saugmotoren reagieren sehr direkt auf das Gaspedal – gut für die Dosierung am Kurvenausgang, aber gnadenlos bei zu viel Gas.",
    siehe: ["bohrung-hub", "saugmotor", "drehmoment"] },

  { id: "bohrung-hub", begriff: "Bohrung und Hub", englisch: "Bore and Stroke",
    kurz: "Durchmesser des Zylinders und Weg des Kolbens.",
    text: [
      "Die Bohrung ist der Durchmesser eines Zylinders, der Hub der Weg, den der Kolben zwischen oberem und unterem Totpunkt zurücklegt. Ihr Verhältnis prägt den Charakter eines Motors.",
      "Kurzhubige Motoren mit großer Bohrung drehen hoch und liefern ihre Leistung bei hohen Drehzahlen – typisch für Rennmotoren. Langhubige Motoren entwickeln viel Drehmoment bei niedrigen Drehzahlen, drehen aber weniger hoch.",
      "Der Grund: Bei langem Hub erreicht der Kolben schon bei geringerer Drehzahl hohe Geschwindigkeiten, was die mechanische Belastung begrenzt."
    ],
    tipp: "Ein kurzhubiger Rennmotor will gedreht werden. Wer zu früh schaltet, fällt aus dem Leistungsband.",
    siehe: ["hubraum", "drehzahl", "leistung"] },

  { id: "verdichtung", begriff: "Verdichtungsverhältnis", englisch: "Compression Ratio",
    kurz: "Wie stark das Gemisch im Zylinder zusammengedrückt wird.",
    text: [
      "Das Verdichtungsverhältnis vergleicht das Volumen im Zylinder, wenn der Kolben ganz unten steht, mit dem Volumen, wenn er ganz oben steht. Ein Wert von 12 zu 1 bedeutet, dass das Gemisch auf ein Zwölftel zusammengedrückt wird.",
      "Höhere Verdichtung verbessert den Wirkungsgrad und die Leistung, erhöht aber die Gefahr unkontrollierter Selbstzündung (Klopfen). Aufgeladene Motoren haben meist eine geringere Verdichtung, weil der Lader bereits vorverdichtet.",
      "Die Verdichtung ist eine Konstruktionsgröße und im Setup nicht verstellbar."
    ],
    tipp: "Für dich als Fahrer erklärt die Verdichtung, warum Kraftstoffqualität und Ladedruck im echten Motorsport so streng geregelt sind.",
    siehe: ["ladedruck", "hubraum", "turbolader"] },

  { id: "drehmoment", begriff: "Drehmoment", englisch: "Torque",
    kurz: "Die Drehkraft des Motors an der Kurbelwelle.",
    text: [
      "Das Drehmoment, gemessen in Newtonmetern, beschreibt, mit welcher Kraft der Motor die Kurbelwelle dreht. Es bestimmt, wie stark ein Auto in einem bestimmten Gang beschleunigt.",
      "Der Verlauf über die Drehzahl, die Drehmomentkurve, prägt das Fahrgefühl: Ein früh anliegendes, breites Drehmoment macht ein Auto leicht zu fahren; ein spitzer Verlauf verlangt, die Drehzahl im richtigen Bereich zu halten.",
      "Getriebe vervielfachen das Drehmoment: In niedrigen Gängen kommt an den Rädern ein Vielfaches davon an – das ist der Grund, warum der Grip in den unteren Gängen oft nicht ausreicht."
    ],
    tipp: "Am Kurvenausgang ist ein Gang höher oft schneller, wenn der Motor dort noch genug Drehmoment hat – das Auto bleibt ruhiger und die Reifen werden geschont.",
    siehe: ["leistung", "drehzahl", "uebersetzung", "short-shifting"] },

  { id: "leistung", begriff: "Leistung", englisch: "Power",
    kurz: "Drehmoment mal Drehzahl – wie viel Arbeit der Motor pro Zeit verrichtet.",
    text: [
      "Leistung wird in Kilowatt oder PS angegeben und ergibt sich aus Drehmoment und Drehzahl. Ein Motor kann daher bei hoher Drehzahl viel Leistung liefern, auch wenn sein Drehmoment dort schon sinkt.",
      "Für die Höchstgeschwindigkeit zählt die Leistung, weil sie gegen den Luftwiderstand arbeitet. Für die Beschleunigung kommt es auf die Leistung an, die bei der jeweiligen Geschwindigkeit an den Rädern ankommt – und damit auf Getriebe und Schaltpunkte.",
      "Das Verhältnis von Leistung zu Gewicht ist eine der wichtigsten Kenngrößen eines Rennfahrzeugs."
    ],
    tipp: "Der ideale Schaltpunkt liegt dort, wo die Zugkraft im nächsten Gang höher ist als im aktuellen – das ist oft vor dem Drehzahlbegrenzer, nicht direkt daran.",
    siehe: ["drehmoment", "drehzahl", "uebersetzung"] },

  { id: "drehzahl", begriff: "Drehzahl", englisch: "RPM",
    kurz: "Umdrehungen der Kurbelwelle pro Minute.",
    text: [
      "Die Drehzahl zeigt, wie schnell sich der Motor dreht. Sie bestimmt zusammen mit dem Drehmoment die Leistung und ist die wichtigste Anzeige für den richtigen Schaltzeitpunkt.",
      "Jeder Motor hat ein nutzbares Drehzahlband, in dem er kräftig zieht. Darunter fehlt Kraft, darüber greift der Begrenzer ein. Schaltanzeigen mit Leuchtdioden im Lenkrad helfen, den Schaltpunkt exakt zu treffen.",
      "In vielen Simulationen lässt sich die Schaltanzeige an den gewünschten Punkt anpassen."
    ],
    tipp: "Schalte nach Schaltanzeige, nicht nach Gehör. Prüfe in der Telemetrie, ob du in jedem Gang den gleichen, idealen Punkt triffst.",
    siehe: ["drehzahlbegrenzer", "leistung", "short-shifting"] },

  { id: "drehzahlbegrenzer", begriff: "Drehzahlbegrenzer", englisch: "Rev Limiter",
    kurz: "Schützt den Motor, indem er die maximale Drehzahl begrenzt.",
    text: [
      "Erreicht der Motor seine Höchstdrehzahl, unterbricht der Begrenzer kurzzeitig Zündung oder Einspritzung. Die Drehzahl kann nicht weiter steigen, der Motor ist vor Schäden geschützt.",
      "Wer im Begrenzer fährt, verliert Zeit: Das Auto beschleunigt nicht mehr, und die stotternde Leistung kann das Heck unruhig machen. Viele Rennfahrzeuge schalten bei zu langem Begrenzerbetrieb sogar in einen Schutzmodus.",
      "Läuft der Motor am Ende einer Geraden in den Begrenzer, ist die Übersetzung zu kurz."
    ],
    tipp: "Erreichst du auf der längsten Geraden schon vor dem Bremspunkt den Begrenzer, verlängere den letzten Gang oder den Achsantrieb.",
    siehe: ["drehzahl", "uebersetzung", "achsantrieb"] },

  { id: "saugmotor", begriff: "Saugmotor", englisch: "Naturally Aspirated",
    kurz: "Motor ohne Aufladung, der Luft nur durch die Kolbenbewegung ansaugt.",
    text: [
      "Ein Saugmotor füllt seine Zylinder allein durch den Unterdruck, den der abwärts gehende Kolben erzeugt. Es gibt keinen Turbolader und keinen Kompressor.",
      "Seine Stärke ist die direkte, lineare Gasannahme: Jede Pedalbewegung setzt sich sofort in Leistung um. Das macht die Dosierung am Kurvenausgang sehr berechenbar.",
      "Um viel Leistung zu erreichen, braucht ein Saugmotor viel Hubraum oder hohe Drehzahlen. Viele Rennfahrer schätzen ihn wegen seines Klangs und seiner Präzision."
    ],
    tipp: "Mit einem Saugmotor kannst du am Kurvenausgang sehr fein dosieren – nutze das, um früher ans Gas zu gehen.",
    siehe: ["turbolader", "kompressor", "hubraum"] },

  { id: "turbolader", begriff: "Turbolader", englisch: "Turbocharger",
    kurz: "Nutzt die Abgasenergie, um zusätzliche Luft in den Motor zu pressen.",
    text: [
      "Ein Turbolader besteht aus einer Turbine im Abgasstrom und einem Verdichter auf der Ansaugseite, die auf einer gemeinsamen Welle sitzen. Die Abgase treiben die Turbine an, der Verdichter presst Luft in die Zylinder.",
      "Mehr Luft bedeutet, dass mehr Kraftstoff verbrannt werden kann – ein kleiner Motor liefert so viel Leistung. Weil der Lader die ohnehin vorhandene Abgasenergie nutzt, ist die Aufladung effizient.",
      "Der Nachteil ist die verzögerte Reaktion: Bevor der Lader Druck aufbaut, muss erst genug Abgas strömen – das Turboloch."
    ],
    tipp: "Bei Turbomotoren gehst du am Kurvenausgang etwas früher und sanfter ans Gas, damit der Ladedruck rechtzeitig anliegt, ohne dass die Leistung schlagartig einsetzt.",
    siehe: ["turboloch", "ladedruck", "wastegate", "ladeluftkuehler"] },

  { id: "kompressor", begriff: "Kompressor", englisch: "Supercharger",
    kurz: "Mechanisch angetriebener Lader, der direkt vom Motor betrieben wird.",
    text: [
      "Ein Kompressor wird über einen Riemen oder Zahnräder direkt von der Kurbelwelle angetrieben. Er presst wie ein Turbolader zusätzliche Luft in den Motor.",
      "Weil er fest mit der Motordrehzahl gekoppelt ist, liefert er sofort Ladedruck – es gibt kein Turboloch. Dafür kostet sein Antrieb einen Teil der Motorleistung.",
      "Kompressoren findet man in Dragstern, manchen Sportwagen und historischen Rennfahrzeugen."
    ],
    tipp: "Ein Kompressormotor reagiert ähnlich direkt wie ein Saugmotor, bietet aber deutlich mehr Kraft – sanftes Dosieren bleibt Pflicht.",
    siehe: ["turbolader", "saugmotor", "ladedruck"] },

  { id: "ladedruck", begriff: "Ladedruck", englisch: "Boost",
    kurz: "Überdruck, mit dem ein Lader die Luft in den Motor presst.",
    text: [
      "Der Ladedruck gibt an, wie stark die Ansaugluft über den Umgebungsdruck hinaus verdichtet wird, meist in bar. Mehr Ladedruck bedeutet mehr Luft, mehr Kraftstoff und mehr Leistung.",
      "Er wird über das Wastegate oder eine elektronische Regelung begrenzt, um den Motor zu schützen. Manche Fahrzeuge erlauben dem Fahrer, den Ladedruck in Stufen zu verändern – mehr für Überholmanöver, weniger zum Sparen.",
      "In Rennserien ist der Ladedruck häufig ein Mittel der Balance of Performance."
    ],
    tipp: "Wenn dein Fahrzeug einen verstellbaren Ladedruck hat, nutze die höhere Stufe gezielt für Angriffe – sie erhöht auch den Verbrauch.",
    siehe: ["turbolader", "wastegate", "bop", "motorkennfeld"] },

  { id: "wastegate", begriff: "Wastegate", englisch: "Wastegate",
    kurz: "Ventil, das Abgas an der Turbine vorbeileitet und so den Ladedruck begrenzt.",
    text: [
      "Erreicht der Ladedruck seinen Höchstwert, öffnet das Wastegate und leitet einen Teil der Abgase an der Turbine vorbei. Die Turbine dreht nicht weiter hoch, der Ladedruck bleibt konstant.",
      "Ohne Wastegate würde der Druck immer weiter steigen und den Motor beschädigen. Moderne Systeme werden elektronisch gesteuert und ermöglichen fein abgestimmte Ladedruckverläufe.",
      "Das typische Zischen beim Gaswegnehmen stammt dagegen meist vom Schubumluftventil."
    ],
    tipp: "Für das Fahren ist das Wastegate unsichtbar – es erklärt aber, warum Turbomotoren ab einer bestimmten Drehzahl keine weitere Leistung zulegen.",
    siehe: ["ladedruck", "blow-off", "turbolader"] },

  { id: "blow-off", begriff: "Schubumluftventil", englisch: "Blow-off / Pop-off Valve",
    kurz: "Lässt beim Gaswegnehmen den überschüssigen Ladedruck ab.",
    text: [
      "Schließt der Fahrer die Drosselklappe, staut sich die vom Verdichter geförderte Luft davor. Das Blow-off-Ventil lässt sie ab – mit dem bekannten Zischen – und schützt so den Turbolader vor Druckspitzen.",
      "Ein Pop-off-Ventil ist eine Variante, die einen maximalen Ladedruck begrenzt. In manchen Rennserien wurde es vorgeschrieben, um die Leistung von Turbomotoren zu deckeln.",
      "Beide Ventile sorgen dafür, dass der Lader möglichst schnell wieder Druck aufbauen kann."
    ],
    tipp: "Das Zischen beim Schalten gehört bei vielen Turbofahrzeugen in Simulationen zum Klangbild – es ist kein Defekt.",
    siehe: ["wastegate", "turbolader", "turboloch"] },

  { id: "turboloch", begriff: "Turboloch", englisch: "Turbo Lag",
    kurz: "Verzögerung zwischen Gasgeben und dem Einsetzen des Ladedrucks.",
    text: [
      "Ein Turbolader braucht Abgas, um sich zu drehen. Gibt der Fahrer bei niedriger Drehzahl Gas, dauert es einen Moment, bis genug Abgas strömt und der Ladedruck aufgebaut ist. In dieser Zeit fehlt Leistung – das Turboloch.",
      "Setzt der Ladedruck dann ein, kommt die Leistung oft schlagartig. Das kann am Kurvenausgang das Heck zum Ausbrechen bringen.",
      "Moderne Motoren verringern das Turboloch durch kleinere Lader, Anti-Lag-Systeme oder elektrische Unterstützung."
    ],
    tipp: "Gib bei Turbomotoren am Kurvenausgang etwas früher und gleichmäßiger Gas, damit der Druck schon steht, wenn du die volle Leistung brauchst.",
    siehe: ["turbolader", "mgu-h", "power-oversteer"] },

  { id: "ladeluftkuehler", begriff: "Ladeluftkühler", englisch: "Intercooler",
    kurz: "Kühlt die vom Lader verdichtete Luft, bevor sie in den Motor strömt.",
    text: [
      "Beim Verdichten erwärmt sich die Luft stark. Warme Luft ist dünner und enthält weniger Sauerstoff, außerdem erhöht sie die Klopfgefahr. Der Ladeluftkühler senkt ihre Temperatur.",
      "Kühlere Ladeluft bedeutet mehr Leistung und einen standfesteren Motor. Ist der Kühler schlecht angeströmt – etwa im Windschatten oder bei heißem Wetter – sinkt die Leistung spürbar.",
      "Ladeluftkühler arbeiten mit Luft- oder Wasserkühlung."
    ],
    tipp: "Lange Phasen direkt im Windschatten erwärmen die Ladeluft – bei Turbofahrzeugen kann das auf den folgenden Geraden etwas Leistung kosten.",
    siehe: ["turbolader", "lufteinlaesse", "windschatten"] },

  { id: "h-schaltung", begriff: "H-Schaltung", englisch: "Manual H-Pattern Gearbox",
    kurz: "Klassisches Schaltgetriebe mit Kupplungspedal und Schaltkulisse in H-Form.",
    text: [
      "Beim H-Schaltgetriebe wählt der Fahrer die Gänge über einen Schalthebel in einer H-förmigen Kulisse und betätigt dazu das Kupplungspedal. Jeder Gang kann direkt angewählt werden.",
      "Die Bedienung erfordert Koordination: Kuppeln, Schalten, beim Herunterschalten Zwischengas geben – und das alles, während gebremst und eingelenkt wird. Fehler kosten Zeit oder beschädigen das Getriebe.",
      "Historische Rennwagen und viele Straßenfahrzeuge nutzen diese Bauart. In Simulationen benötigt man dafür einen eigenen H-Schalter und ein Kupplungspedal."
    ],
    tipp: "Übe Heel-and-Toe zuerst langsam. Ein sauberer Gangwechsel mit angeglichener Drehzahl ist schneller und stabiler als ein hastiger.",
    siehe: ["heel-and-toe", "kupplung", "double-clutching", "sequenzielles-getriebe"] },

  { id: "sequenzielles-getriebe", begriff: "Sequenzielles Getriebe", englisch: "Sequential Gearbox",
    kurz: "Getriebe, bei dem die Gänge nur nacheinander hoch- oder heruntergeschaltet werden.",
    text: [
      "Bei einem sequenziellen Getriebe schaltet man mit einem Hebel oder Schaltwippen nur einen Gang nach oben oder unten. Ein Überspringen von Gängen ist nicht möglich – vom fünften in den zweiten muss man dreimal schalten.",
      "Die Schaltvorgänge sind sehr schnell, und Fehlschaltungen sind kaum möglich. Viele Rennfahrzeuge schalten zudem ohne Kupplung, oft mit automatischer Zündunterbrechung beim Hochschalten und Zwischengas beim Herunterschalten.",
      "Sequenzielle Getriebe sind in GT-Fahrzeugen, Prototypen, Tourenwagen und im Rallyesport Standard."
    ],
    tipp: "Schalte beim Anbremsen nicht zu früh herunter – jeder Gang muss die Drehzahl verkraften. Viele Fahrzeuge verweigern sonst den Gangwechsel.",
    siehe: ["h-schaltung", "schaltwippen", "flat-shifting", "doppelkupplung"] },

  { id: "doppelkupplung", begriff: "Doppelkupplungsgetriebe", englisch: "DCT / DSG",
    kurz: "Getriebe mit zwei Kupplungen, das ohne Zugkraftunterbrechung schaltet.",
    text: [
      "Ein Doppelkupplungsgetriebe besteht aus zwei Teilgetrieben: eines für die ungeraden, eines für die geraden Gänge. Während ein Gang eingelegt ist, ist der nächste bereits vorgewählt. Beim Schalten öffnet die eine Kupplung, während die andere schließt.",
      "Der Gangwechsel geschieht in Millisekunden und fast ohne Zugkraftunterbrechung. Das bringt Beschleunigung und Komfort.",
      "Man findet es vor allem in Sportwagen und seriennahen Rennfahrzeugen; reine Rennfahrzeuge nutzen meist leichtere sequenzielle Getriebe."
    ],
    tipp: "In Fahrzeugen mit Doppelkupplung kannst du am Kurvenausgang ohne Bedenken hochschalten – der Wechsel stört die Balance kaum.",
    siehe: ["sequenzielles-getriebe", "schaltwippen", "cvt"] },

  { id: "cvt", begriff: "Stufenloses Getriebe", englisch: "CVT",
    kurz: "Getriebe ohne feste Gänge, das die Übersetzung stufenlos verändert.",
    text: [
      "Ein stufenloses Getriebe verändert die Übersetzung kontinuierlich, meist über ein Band zwischen zwei kegelförmigen Scheiben. So kann der Motor immer bei der idealen Drehzahl laufen.",
      "Im Straßenverkehr bringt das Effizienz und Komfort. Im Motorsport wurde die Technik in den 1990er-Jahren in der Formel 1 getestet und dann verboten, weil sie einen enormen Vorteil versprach.",
      "Heute findet man stufenlose Getriebe vor allem in Rollern, Schneemobilen und manchen Serienfahrzeugen."
    ],
    tipp: "Im Simracing begegnet dir ein stufenloses Getriebe selten – es erklärt aber, warum ein Motor ideal immer im besten Drehzahlbereich laufen würde.",
    siehe: ["doppelkupplung", "uebersetzung", "drehzahl"] },

  { id: "schaltwippen", begriff: "Schaltwippen", englisch: "Paddle Shifters",
    kurz: "Hebel hinter dem Lenkrad zum Hoch- und Herunterschalten.",
    text: [
      "Schaltwippen sitzen hinter dem Lenkrad: rechts meist zum Hochschalten, links zum Herunterschalten. Der Fahrer kann schalten, ohne die Hände vom Lenkrad zu nehmen.",
      "Sie werden mit sequenziellen und Doppelkupplungsgetrieben kombiniert. Weil sie sich mit dem Lenkrad drehen, sind sie auch bei eingeschlagener Lenkung erreichbar.",
      "Im Simracing gehören sie zur Grundausstattung fast jedes Lenkrads; manche Lenkräder haben zusätzlich Kupplungswippen."
    ],
    tipp: "Schalte in schnellen Kurvenpassagen nur, wenn das Lenkrad weitgehend gerade steht – ein Gangwechsel unter hoher Querbeschleunigung kann das Auto aus dem Gleichgewicht bringen.",
    siehe: ["sequenzielles-getriebe", "dual-clutch-paddles", "flat-shifting"] },

  { id: "uebersetzung", begriff: "Übersetzungsverhältnisse", englisch: "Gear Ratios",
    kurz: "Das Verhältnis zwischen Motor- und Raddrehzahl in jedem Gang.",
    text: [
      "Jeder Gang hat ein Übersetzungsverhältnis. Kurze Übersetzungen beschleunigen kräftig, erreichen aber früh den Begrenzer; lange Übersetzungen erlauben hohe Geschwindigkeiten, beschleunigen aber schwächer.",
      "Die Abstimmung der Gänge auf eine Strecke ist ein wichtiger Teil des Setups: Der höchste Gang sollte am Ende der längsten Geraden knapp unter dem Begrenzer liegen, und in den wichtigsten Kurven sollte ein Gang passen, der beim Herausbeschleunigen im besten Drehzahlbereich liegt.",
      "In vielen Fahrzeugen sind die Gänge fest, und nur der Achsantrieb lässt sich verändern."
    ],
    tipp: "Wenn du in einer wichtigen Kurve zwischen zwei Gängen hängst, passe die Übersetzung so an, dass der Motor am Ausgang im kräftigsten Bereich liegt.",
    siehe: ["achsantrieb", "drehzahlbegrenzer", "drehmoment"] },

  { id: "achsantrieb", begriff: "Achsantrieb", englisch: "Final Drive",
    kurz: "Letzte Übersetzungsstufe, die alle Gänge gemeinsam kürzer oder länger macht.",
    text: [
      "Der Achsantrieb sitzt zwischen Getriebe und Differential und multipliziert die Übersetzung jedes Gangs. Ein kürzerer Achsantrieb macht alle Gänge kürzer: mehr Beschleunigung, weniger Höchstgeschwindigkeit.",
      "Weil er alle Gänge gleichzeitig verändert, ist er ein schneller Weg, ein Auto an eine Strecke anzupassen – etwa an eine besonders lange oder kurze Gerade.",
      "In vielen Simulationen ist er die einzige verstellbare Getriebegröße."
    ],
    tipp: "Prüfe die Höchstdrehzahl im letzten Gang auf der längsten Geraden, auch im Windschatten. Läuft der Motor dort in den Begrenzer, wähle einen längeren Achsantrieb.",
    siehe: ["uebersetzung", "drehzahlbegrenzer", "windschatten"] },

  { id: "differential", begriff: "Differential", englisch: "Differential",
    kurz: "Erlaubt den Antriebsrädern einer Achse, unterschiedlich schnell zu drehen.",
    text: [
      "In einer Kurve legt das äußere Rad einen längeren Weg zurück als das innere und muss sich schneller drehen. Das Differential verteilt das Antriebsmoment so, dass beide Räder angetrieben werden und trotzdem unterschiedlich schnell laufen können.",
      "Ein offenes Differential schickt das Moment allerdings dorthin, wo der geringste Widerstand ist – hebt ein Rad ab oder rutscht, dreht es durch. Sperrdifferentiale verhindern das, indem sie die Drehzahlunterschiede begrenzen.",
      "Wie stark ein Differential sperrt, beeinflusst Einlenken, Kurvenmitte und Traktion erheblich und ist deshalb eine der wichtigsten Setup-Einstellungen."
    ],
    tipp: "Mehr Sperre verbessert die Traktion, lässt das Auto aber schwerer einlenken. Weniger Sperre macht das Einlenken leichter, kostet aber Traktion am Kurvenausgang.",
    siehe: ["offenes-differential", "sperrdifferential", "diff-vorspannung", "sperrwirkung"] },

  { id: "offenes-differential", begriff: "Offenes Differential", englisch: "Open Differential",
    kurz: "Differential ohne Sperre – das Moment geht zum Rad mit dem geringsten Widerstand.",
    text: [
      "Ein offenes Differential verteilt das Moment immer gleich auf beide Räder, und zwar so viel, wie das Rad mit dem geringeren Grip übertragen kann. Hebt ein Rad ab oder rutscht es, dreht es durch, und das andere bekommt kaum Kraft.",
      "Im Straßenverkehr ist das unproblematisch und sehr komfortabel. Im Rennsport, wo das kurveninnere Rad stark entlastet wird, kostet es am Kurvenausgang viel Traktion.",
      "Deshalb nutzen Rennfahrzeuge fast immer ein Sperrdifferential."
    ],
    tipp: "Dreht in langsamen Kurven das innere Hinterrad durch, während das Auto kaum beschleunigt, fehlt Sperrwirkung.",
    siehe: ["differential", "sperrdifferential", "traktion"] },

  { id: "sperrdifferential", begriff: "Sperrdifferential", englisch: "Limited-Slip Differential (LSD)",
    kurz: "Differential, das den Drehzahlunterschied der Räder begrenzt.",
    text: [
      "Ein Sperrdifferential lässt Drehzahlunterschiede zu, bremst sie aber ab einem gewissen Punkt. Dadurch wird auch das Rad mit mehr Grip angetrieben, wenn das andere zu rutschen beginnt.",
      "Es gibt verschiedene Bauarten: Lamellensperren mit Reibscheiben, Visco-Sperren mit zähem Öl, Torsen-Differentiale mit Schneckenrädern und elektronisch gesteuerte Systeme.",
      "Bei Lamellensperren lassen sich die Sperrwerte getrennt für Zug (Gas) und Schub (Gaswegnehmen) sowie die Vorspannung einstellen – die wichtigsten Diff-Parameter im Setup."
    ],
    tipp: "Beginne bei Problemen am Kurvenausgang mit der Zugseite und bei Problemen beim Einlenken mit der Schubseite und der Vorspannung.",
    siehe: ["lamellensperre", "visco-sperre", "torsen", "e-diff"] },

  { id: "visco-sperre", begriff: "Visco-Sperre", englisch: "Viscous Limited-Slip Differential",
    kurz: "Sperrdifferential, das über zähes Silikonöl wirkt.",
    text: [
      "In einer Visco-Sperre drehen sich Lamellen in zähem Silikonöl. Entsteht ein Drehzahlunterschied zwischen den Rädern, erwärmt sich das Öl und wird zäher, die Sperrwirkung steigt.",
      "Die Sperre reagiert also auf den Drehzahlunterschied, nicht auf das Moment. Sie arbeitet weich und wartungsarm, reagiert aber träge und lässt sich nicht fein einstellen.",
      "Man findet sie in manchen Straßensportwagen und älteren seriennahen Rennfahrzeugen."
    ],
    tipp: "Visco-Sperren greifen verzögert – rechne damit, dass das Auto am Kurvenausgang erst kurz rutscht, bevor die Traktion kommt.",
    siehe: ["sperrdifferential", "lamellensperre", "traktion"] },

  { id: "lamellensperre", begriff: "Lamellensperre", englisch: "Clutch-Type / Plate LSD",
    kurz: "Sperrdifferential mit Reiblamellen, im Rennsport am weitesten verbreitet.",
    text: [
      "Eine Lamellensperre nutzt ein Paket aus Reibscheiben, die über Rampen zusammengepresst werden, sobald Moment anliegt. Je steiler die Rampe, desto stärker die Sperrwirkung.",
      "Weil es getrennte Rampen für Zug und Schub gibt, lässt sich die Sperre für Gasgeben und Gaswegnehmen unterschiedlich einstellen. Dazu kommt eine Vorspannung, die auch ohne Moment für Grundsperrwirkung sorgt.",
      "Die drei Werte – Zug, Schub und Vorspannung – prägen das Fahrverhalten in jeder Phase einer Kurve."
    ],
    tipp: "Viele Setups geben die Rampen als Winkel an: Ein kleinerer Winkel bedeutet meist mehr Sperre. Prüfe in deiner Simulation, wie die Werte zu lesen sind.",
    siehe: ["sperrdifferential", "diff-zug", "diff-schub", "diff-vorspannung"] },

  { id: "torsen", begriff: "Torsen-Differential", englisch: "Torsen Differential",
    kurz: "Selbstsperrendes Differential mit Schneckenrädern, das auf das Moment reagiert.",
    text: [
      "Das Torsen-Differential – der Name steht für torque sensing – nutzt Schneckenräder, die sich unter Last gegenseitig hemmen. Es verteilt das Moment abhängig davon, wie viel jedes Rad übertragen kann.",
      "Es reagiert ohne Verzögerung und verschleißfrei. Seine Schwäche: Hat ein Rad gar keinen Grip, etwa weil es abhebt, kann es kaum Moment umverteilen.",
      "Man findet es in Allradfahrzeugen als Mitteldifferential und in manchen Sportwagen an der Hinterachse."
    ],
    tipp: "Bei Fahrzeugen mit Torsen-Differential ist eine sanfte Gasannahme besonders wichtig, damit kein Rad komplett entlastet durchdreht.",
    siehe: ["sperrdifferential", "differential", "e-diff"] },

  { id: "e-diff", begriff: "Elektronisches Differential", englisch: "E-Diff",
    kurz: "Sperrdifferential, dessen Sperrwirkung ein Rechner situationsabhängig regelt.",
    text: [
      "Ein elektronisches Differential nutzt eine hydraulisch oder elektrisch betätigte Lamellenkupplung, die ein Steuergerät in jedem Moment neu einstellt – abhängig von Lenkwinkel, Geschwindigkeit, Gaspedal und Raddrehzahlen.",
      "So kann es beim Einlenken offen sein, damit das Auto leicht dreht, und am Kurvenausgang sperren, um Traktion zu liefern. Der Fahrer kann oft zwischen Modi wählen oder Einstellungen für bestimmte Kurvenphasen verändern.",
      "In der Formel 1 und vielen modernen Sportwagen sind elektronische Differentiale Standard."
    ],
    tipp: "Wenn dein Fahrzeug Diff-Einstellungen für Einlenken, Kurvenmitte und Ausgang anbietet, verändere sie getrennt: So löst du Probleme in genau der Phase, in der sie auftreten.",
    siehe: ["sperrdifferential", "lamellensperre", "sperrwirkung"] },

  { id: "spool", begriff: "Starre Achse (Spool)", englisch: "Spool / Locked Differential",
    kurz: "Beide Antriebsräder sind fest verbunden und drehen immer gleich schnell.",
    text: [
      "Bei einer starren Verbindung gibt es kein Differential: Beide Räder drehen immer gleich schnell. Das ergibt maximale Traktion, weil nie ein Rad allein durchdrehen kann.",
      "In Kurven muss jedoch ein Rad radieren, weil das äußere eigentlich schneller drehen müsste. Das Auto schiebt beim Einlenken stark und ist schwer zu drehen.",
      "Starre Achsen findet man beim Driften, im Kartsport, bei Dragstern und auf manchen Ovalen."
    ],
    tipp: "Mit starrer Achse musst du das Auto vor der Kurve über Gewichtsverlagerung oder Lastwechsel zum Drehen bringen – reines Lenken reicht oft nicht.",
    siehe: ["differential", "drift", "sperrwirkung"] },

  { id: "sperrwirkung", begriff: "Sperrwirkung", englisch: "Diff Lock",
    kurz: "Wie stark ein Differential den Drehzahlausgleich der Räder unterbindet.",
    text: [
      "Die Sperrwirkung, meist in Prozent angegeben, beschreibt, wie stark ein Differential die Räder koppelt. Null Prozent entspricht einem offenen Differential, hundert Prozent einer starren Achse.",
      "Mehr Sperre bringt Traktion und Stabilität, macht das Auto aber in Kurven träger, weil das innere Rad gegen das äußere arbeitet. Weniger Sperre macht das Auto agil, kostet aber Traktion und kann zu Übersteuern beim Lastwechsel führen.",
      "Bei Lamellensperren unterscheidet man Sperrwirkung unter Zug und unter Schub."
    ],
    tipp: "Untersteuert das Auto in der Kurvenmitte mit leichtem Gas, kann zu viel Sperrwirkung die Ursache sein.",
    siehe: ["diff-zug", "diff-schub", "diff-vorspannung", "differential"] },

  { id: "diff-vorspannung", begriff: "Differential-Vorspannung", englisch: "Diff Preload",
    kurz: "Grundsperrwirkung des Differentials, auch ohne anliegendes Moment.",
    text: [
      "Die Vorspannung presst die Lamellen einer Sperre schon ohne Last zusammen. Damit wirkt eine Grundsperre in allen Situationen – auch beim Rollen ohne Gas und beim Wechsel zwischen Gas und Bremse.",
      "Mehr Vorspannung stabilisiert das Auto bei Lastwechseln und beim Einlenken, macht es aber träger in langsamen Kurven. Weniger Vorspannung erleichtert das Einlenken, kann aber Unruhe bei Lastwechseln verursachen.",
      "Sie wirkt besonders in der Phase, in der weder Gas noch Bremse eindeutig anliegen – also in der Kurvenmitte."
    ],
    tipp: "Ist das Auto in der Kurvenmitte bei konstantem, leichtem Gas unruhig, kann mehr Vorspannung helfen. Schiebt es in langsamen Kurven über die Vorderräder, weniger.",
    siehe: ["sperrwirkung", "diff-zug", "diff-schub"] },

  { id: "diff-schub", begriff: "Differential auf Schub", englisch: "Diff Coast",
    kurz: "Sperrwirkung des Differentials beim Gaswegnehmen und Anbremsen.",
    text: [
      "Nimmt der Fahrer Gas weg, wirkt die Motorbremse über das Differential auf die Antriebsräder. Die Schubseite bestimmt, wie stark die Räder dabei gekoppelt sind.",
      "Mehr Sperre auf Schub stabilisiert das Heck beim Anbremsen, weil die Räder gemeinsam verzögern. Das Auto lenkt aber schwerer ein und kann untersteuern. Weniger Sperre lässt das Auto beim Einlenken leichter drehen, kann das Heck aber unruhig machen.",
      "Die Schubseite ist eng mit Motorbremse und Bremsbalance verknüpft."
    ],
    tipp: "Untersteuert dein Auto beim Einlenken, öffne die Schubseite ein Stück. Wird das Heck beim Anbremsen nervös, schließe sie wieder.",
    siehe: ["diff-zug", "motorbremse", "untersteuern", "sperrwirkung"] },

  { id: "diff-zug", begriff: "Differential auf Zug", englisch: "Diff Power",
    kurz: "Sperrwirkung des Differentials beim Gasgeben.",
    text: [
      "Unter Last – also beim Beschleunigen – bestimmt die Zugseite, wie stark die Antriebsräder gekoppelt sind. Mehr Sperre bringt beide Räder gleichmäßig auf die Straße und verbessert die Traktion.",
      "Zu viel Sperre auf Zug lässt das Auto am Kurvenausgang untersteuern oder – bei hoher Leistung – plötzlich übersteuern, wenn beide Räder gleichzeitig die Haftung verlieren. Zu wenig Sperre lässt das innere Rad durchdrehen.",
      "Die richtige Einstellung hängt von Leistung, Reifen und Streckencharakter ab."
    ],
    tipp: "Dreht das kurveninnere Rad am Ausgang durch, erhöhe die Zugsperre. Schiebt das Auto beim Gasgeben gerade nach außen, reduziere sie.",
    siehe: ["diff-schub", "traktion", "power-oversteer", "sperrwirkung"] },

  { id: "kupplung", begriff: "Kupplung", englisch: "Clutch",
    kurz: "Verbindet und trennt Motor und Getriebe.",
    text: [
      "Die Kupplung überträgt die Kraft vom Motor auf das Getriebe. Beim Anfahren und Schalten wird sie geöffnet, damit sich die Drehzahlen angleichen können.",
      "Rennkupplungen sind klein, leicht und haben mehrere Scheiben. Sie greifen sehr abrupt, was das Anfahren schwierig macht. Viele moderne Rennfahrzeuge benötigen die Kupplung nur noch beim Start und beim Anhalten in der Box.",
      "In Simulationen wird die Kupplung über ein Pedal oder über Kupplungswippen am Lenkrad bedient."
    ],
    tipp: "Wenn dein Fahrzeug ein sequenzielles Getriebe hat, brauchst du die Kupplung meist nur beim Start. Finde vorher den Schleifpunkt.",
    siehe: ["schleifpunkt", "h-schaltung", "dual-clutch-paddles"] },

  { id: "schleifpunkt", begriff: "Schleifpunkt", englisch: "Bite Point",
    kurz: "Punkt, an dem die Kupplung beginnt, Kraft zu übertragen.",
    text: [
      "Beim Lösen der Kupplung gibt es einen Punkt, an dem die Scheiben zu greifen beginnen. Ab hier überträgt die Kupplung Moment, und das Auto setzt sich in Bewegung.",
      "Bei Rennstarts ist es entscheidend, die Kupplung genau am Schleifpunkt zu halten: Zu wenig, und der Motor würgt ab oder das Auto kriecht; zu viel, und die Räder drehen durch.",
      "In vielen Simulationen lässt sich der Schleifpunkt der Kupplungswippen festlegen, damit der Start reproduzierbar wird."
    ],
    tipp: "Übe Starts im Training und notiere dir, bei welcher Wippen- oder Pedalstellung das Auto am besten losfährt.",
    siehe: ["kupplung", "stehender-start", "launch-control", "dual-clutch-paddles"] },

  { id: "anti-stall", begriff: "Abwürgeschutz", englisch: "Anti-Stall",
    kurz: "Elektronik, die verhindert, dass der Motor bei zu niedriger Drehzahl ausgeht.",
    text: [
      "Fällt die Drehzahl zu tief – etwa nach einem Dreher oder bei einem verpatzten Start –, öffnet der Abwürgeschutz automatisch die Kupplung oder erhöht die Drehzahl, damit der Motor nicht ausgeht.",
      "Bei Rennfahrzeugen, deren Motor sich nur schwer neu starten lässt, rettet das oft das Rennen. In manchen Serien führt das Auslösen allerdings zu einer Verzögerung, die beim Start Zeit kostet.",
      "In Simulationen kann der Abwürgeschutz bei einem schlechten Start aktiv werden und das Auto kurz zögern lassen."
    ],
    tipp: "Auch mit Abwürgeschutz gilt: Halte nach einem Dreher die Kupplung gedrückt, bis du wieder in Fahrtrichtung stehst.",
    siehe: ["kupplung", "launch-control", "schleifpunkt"] },
]);
