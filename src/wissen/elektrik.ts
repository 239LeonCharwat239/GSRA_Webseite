// GSRA – Nachschlagewerk: Elektrik, Sensorik & Cockpit-Systeme (ergänzt 24.11.2026)
import { kategorie } from "./begriff";

export const ELEKTRIK = kategorie("Elektrik, Sensorik & Cockpit", [
  { id: "ecu", begriff: "Motorsteuergerät", englisch: "ECU (Engine Control Unit)",
    kurz: "Der Rechner, der Motor und viele Fahrzeugsysteme steuert und dabei alle Messwerte aufzeichnet.",
    text: [
      "Das Motorsteuergerät berechnet in jedem Arbeitsspiel, wie viel Kraftstoff eingespritzt wird, wann gezündet wird und wie weit die Drosselklappe öffnet. Grundlage sind Kennfelder, die Drehzahl, Last, Luft- und Wassertemperatur sowie Ladedruck miteinander verknüpfen. Bei einem Turbomotor regelt es zusätzlich den Ladedruck über das Wastegate.",
      "Im Rennwagen übernimmt die ECU meist weit mehr als den Motor: Traktionskontrolle, Startautomatik, Boxengassenbegrenzer, Schaltblitze, Motorkennfelder zum Kraftstoffsparen und die Kommunikation mit Lenkrad, Display und Datenlogger laufen über sie oder über eng verbundene Steuergeräte. In vielen Rennserien schreibt das Reglement ein Einheitssteuergerät vor, damit niemand mit verbotener Software Vorteile erzielt.",
      "Die ECU ist zugleich die wichtigste Datenquelle: Sie liefert Drehzahl, Gaspedalstellung, Gang, Temperaturen und Drücke an die Telemetrie. In der Simulation entspricht ihr das Fahrzeugmodell, das diese Werte ebenfalls für Telemetrie-Programme bereitstellt."
    ],
    tipp: "Wechselst du im Rennen das Motorkennfeld, änderst du nichts anderes als die Kennfelder der ECU – prüfe danach in der Telemetrie, ob Verbrauch und Rundenzeit sich wie erwartet verändern.",
    siehe: ["motorkennfeld", "traktionskontrolle", "launch-control", "telemetrie"] },

  { id: "kabelbaum", begriff: "Kabelbaum", englisch: "Wiring Harness",
    kurz: "Die gebündelte Verkabelung, die alle elektrischen Bauteile des Fahrzeugs verbindet.",
    text: [
      "Der Kabelbaum verbindet Batterie, Steuergeräte, Sensoren, Aktoren, Lenkrad, Display und Beleuchtung. In einem modernen Rennwagen laufen darin Hunderte Leitungen, die zu Strängen gebündelt, ummantelt und mit verriegelnden Steckern versehen sind.",
      "Rennsport-Kabelbäume werden auf geringes Gewicht, Hitzebeständigkeit und Vibrationsfestigkeit ausgelegt. Sie sind oft modular aufgebaut, damit sich beschädigte Abschnitte nach einem Unfall schnell tauschen lassen. Schutz vor Scheuern, Hitze vom Auspuff und Feuchtigkeit ist entscheidend, denn ein Wackelkontakt kann einen ganzen Sensor oder sogar den Motor ausfallen lassen.",
      "Viele rätselhafte Defekte im Rennen – aussetzende Sensoren, springende Anzeigen, sporadische Fehlzündungen – haben ihre Ursache im Kabelbaum und nicht im Bauteil selbst."
    ],
    tipp: "Zeigt ein Messkanal in der Telemetrie plötzlich Sprünge auf null oder unrealistische Spitzen, denke im echten Fahrzeug zuerst an Stecker und Leitungen – im eigenen Cockpit gilt dasselbe für USB-Kabel von Pedalen und Lenkrad.",
    siehe: ["ecu", "telemetrie-kanal", "batterie"] },

  { id: "lichtmaschine", begriff: "Lichtmaschine", englisch: "Alternator",
    kurz: "Der vom Motor angetriebene Generator, der das Bordnetz versorgt und die Batterie lädt.",
    text: [
      "Die Lichtmaschine wandelt einen kleinen Teil der Motorleistung in elektrische Energie um. Sie versorgt Steuergeräte, Kraftstoffpumpen, Lüfter, Beleuchtung und Funk und hält die Batterie geladen.",
      "Im Rennsport wird sie möglichst klein und leicht gebaut, weil jede Antriebsleistung, die sie benötigt, am Rad fehlt. Bei Sprintfahrzeugen verzichten manche Teams sogar ganz auf sie und fahren nur mit einer ausreichend großen Batterie. Bei Langstreckenrennen mit Nachtfahrten und starken Scheinwerfern ist eine zuverlässige Lichtmaschine dagegen unverzichtbar.",
      "Fällt sie aus, läuft das Auto noch eine Weile mit der Batterieladung weiter. Sinkt die Bordspannung zu stark, setzen jedoch Pumpen und Zündung aus – das Fahrzeug bleibt stehen."
    ],
    tipp: "Zeigt das Display eine sinkende Bordspannung, schalte nicht benötigte Verbraucher ab und plane einen frühen Boxenstopp, statt auf der Strecke liegen zu bleiben.",
    siehe: ["batterie", "ecu", "langstreckenrennen"] },

  { id: "batterie", begriff: "Batterie und Lithium-Eisenphosphat-Akku", englisch: "Battery / LiFePO4",
    kurz: "Der Energiespeicher für Start und Bordnetz – im Rennsport meist ein leichter Lithium-Eisenphosphat-Akku.",
    text: [
      "Die Starterbatterie liefert den Strom zum Anlassen und puffert das Bordnetz. Klassische Blei-Säure-Batterien sind schwer; im Rennsport haben sich deshalb Lithium-Eisenphosphat-Akkus durchgesetzt. Sie wiegen bei gleicher Leistung nur einen Bruchteil, halten Vibrationen gut aus und gelten als vergleichsweise sicher gegen Überhitzung.",
      "Lithium-Akkus mögen weder Tiefentladung noch Kälte. Teams achten daher auf passende Ladegeräte und schützen den Akku vor vollständiger Entladung. Der Einbauort wird zudem gezielt gewählt, um die Gewichtsverteilung zu verbessern.",
      "Von der Starterbatterie zu unterscheiden ist der Hochvolt-Speicher eines Hybridfahrzeugs: Er speichert die beim Bremsen zurückgewonnene Energie für den Elektroantrieb und arbeitet mit viel höheren Spannungen."
    ],
    tipp: "Der Ladezustand, den dir ein Hybridfahrzeug in der Simulation anzeigt, betrifft den Hochvolt-Speicher – nicht die Starterbatterie. Plane Energieabgabe und Rückgewinnung danach.",
    siehe: ["soc", "ers", "lichtmaschine", "kill-switch"] },

  { id: "kill-switch", begriff: "Hauptschalter", englisch: "Kill Switch / Master Switch",
    kurz: "Der Notschalter, der die gesamte Elektrik und damit den Motor sofort abschaltet.",
    text: [
      "Jeder Rennwagen besitzt einen Hauptschalter, der den Stromkreis unterbricht und den Motor sofort stoppt. Er ist von innen für den Fahrer und von außen für Streckenposten erreichbar; die Außenseite ist meist mit einem roten Blitz auf blauem Dreieck gekennzeichnet.",
      "Nach einem Unfall schalten Streckenposten so die Elektrik ab, bevor sie das Fahrzeug bergen oder den Fahrer befreien. Das verringert die Brandgefahr durch Kurzschlüsse und verhindert, dass Kraftstoffpumpen weiterlaufen.",
      "Bei Hybridfahrzeugen kommt eine Statusanzeige für das Hochvoltsystem hinzu. Leuchtet sie nicht grün, darf das Fahrzeug nur mit isolierenden Handschuhen berührt werden."
    ],
    tipp: "Kennst du die Lage des Hauptschalters in deinem echten Fahrzeug, kannst du nach einem Unfall schneller reagieren – in der Simulation entspricht ihm die Taste zum Abstellen des Motors.",
    siehe: ["streckenposten", "feuerloeschanlage", "batterie"] },

  { id: "lenkraddisplay", begriff: "Display und Lenkraddisplay", englisch: "Dash / Steering Wheel Display",
    kurz: "Der Bildschirm im Cockpit, der Gang, Drehzahl, Rundenzeiten, Warnungen und Strategiewerte zeigt.",
    text: [
      "Moderne Rennwagen ersetzen klassische Rundinstrumente durch ein frei programmierbares Display, entweder im Armaturenbrett oder direkt im Lenkrad. Es zeigt die wichtigsten Werte: eingelegter Gang, Drehzahl, Geschwindigkeit, Delta zur besten Runde, Kraftstoffstand, Reifendrücke und Einstellungen wie Bremsbalance oder Traktionskontrolle.",
      "Ein gutes Display ist in Seiten aufgeteilt: eine schlanke Rennansicht, eine Seite für das Qualifying und Diagnoseseiten für den Notfall. Warnungen – zu hohe Öltemperatur, sinkender Öldruck, Reifendruckverlust – erscheinen mit Farbe und blinkenden Feldern, damit der Fahrer sie sofort bemerkt.",
      "Im Simracing übernehmen Overlays und separate Displays oder Handys diese Aufgabe. Je weniger Informationen gleichzeitig sichtbar sind, desto schneller erfasst du die wichtigen."
    ],
    tipp: "Beschränke deine Rennansicht auf Gang, Delta, Kraftstoff und Warnungen. Alles andere lenkt beim Fahren ab und gehört auf eine zweite Seite.",
    siehe: ["shift-lights", "delta", "drehregler", "ecu"] },

  { id: "shift-lights", begriff: "Schaltblitz", englisch: "Shift Lights",
    kurz: "Leuchtdioden, die anzeigen, wann der optimale Moment zum Hochschalten erreicht ist.",
    text: [
      "Schaltblitze sind eine Reihe farbiger Leuchtdioden über dem Display oder im Lenkrad. Mit steigender Drehzahl leuchten sie nacheinander auf, meist von Grün über Gelb zu Rot; blinken alle, ist der Schaltpunkt erreicht oder der Begrenzer nah.",
      "Der richtige Schaltpunkt liegt dort, wo die Zugkraft im nächsten Gang höher ist als im aktuellen – nicht automatisch bei der Höchstdrehzahl. Er hängt von Leistungskurve und Übersetzung ab und kann je Gang verschieden sein.",
      "Weil der Blick auf den Drehzahlmesser beim Beschleunigen ablenkt, lassen sich die Leuchten aus dem Augenwinkel deutlich leichter wahrnehmen. In vielen Simulationen und auf Lenkrädern mit eigenen Leuchten lassen sie sich frei einstellen."
    ],
    tipp: "Stelle die Schaltblitze so ein, dass das letzte Signal etwas vor dem idealen Schaltpunkt kommt. So gleichst du deine Reaktionszeit aus und triffst den Punkt genau.",
    siehe: ["drehzahl", "drehzahlbegrenzer", "uebersetzung", "lenkraddisplay"] },

  { id: "drehregler", begriff: "Drehregler", englisch: "Rotary Switch",
    kurz: "Mehrstufige Schalter am Lenkrad, mit denen der Fahrer Fahrzeugeinstellungen während der Fahrt ändert.",
    text: [
      "Drehregler am Lenkrad haben meist zwölf Stufen und steuern einzelne Systeme: Traktionskontrolle, ABS, Motorkennfeld, Bremsbalance, Differential oder Energieabgabe. Weil sie rasten, lässt sich ihre Stellung auch ohne Hinsehen ertasten.",
      "Sie erlauben es, das Auto während eines Stints an veränderte Bedingungen anzupassen: Mit abbauenden Reifen etwas mehr Traktionskontrolle, mit leerer werdendem Tank die Bremsbalance nachjustieren, im Regen ein sanfteres Kennfeld. Bei manchen Fahrzeugen dient ein Regler als Mehrfachschalter, dessen Funktion über einen zweiten Regler gewählt wird.",
      "Im Simracing lassen sich Drehregler auf echte Encoder am Lenkrad oder auf Tasten legen. Wichtig ist, dass jede Funktion immer am selben Platz liegt."
    ],
    tipp: "Ändere im Rennen immer nur eine Einstellung pro Runde und beobachte die Wirkung – so weißt du, was geholfen hat.",
    siehe: ["traktionskontrolle", "abs", "bremsbalance", "motorkennfeld"] },

  { id: "boxenfunk", begriff: "Boxenfunk", englisch: "Pit-to-Car Radio",
    kurz: "Die Sprechverbindung zwischen Fahrer und Team während Training und Rennen.",
    text: [
      "Über den Boxenfunk erhält der Fahrer Informationen, die er selbst nicht sehen kann: Abstände, Strategie, Wetter, Strafen und Warnungen zu Unfällen. Umgekehrt meldet er Probleme mit Reifen, Bremsen oder Balance, die das Team in den Daten oft erst später erkennt.",
      "Guter Funk ist kurz, eindeutig und zum richtigen Zeitpunkt. Ingenieure vermeiden Nachrichten in schnellen Kurven und Bremszonen; Fahrer gewöhnen sich feste Begriffe an, etwa für Über- und Untersteuern an Kurveneingang, Scheitelpunkt und Ausgang. In vielen Serien hört die Rennleitung mit, und manche Anweisungen sind reglementiert.",
      "Im Simracing übernehmen Sprachkanäle des Teams die Rolle des Funks, im Langstreckenrennen oft ergänzt durch einen eigenen Renningenieur, der nicht selbst fährt."
    ],
    tipp: "Vereinbart vor dem Rennen feste, kurze Kommandos („Box diese Runde“, „Plan B“, „Achtung Unfall in Kurve 5“) – im Stress versteht man sie sofort.",
    siehe: ["renningenieur", "spotter", "boxenstopp"] },

  { id: "spotter", begriff: "Spotter", englisch: "Spotter",
    kurz: "Eine Person, die von erhöhter Position das Rennen beobachtet und dem Fahrer Verkehr und Gefahren ansagt.",
    text: [
      "Der Spotter steht – vor allem bei Ovalrennen – auf einem Turm oder der Tribüne und sieht, was der Fahrer nicht sehen kann: Fahrzeuge im toten Winkel, Unfälle vor ihm, Lücken im Verkehr. Mit festen Ansagen wie „Auto innen“, „noch da“ oder „frei“ hilft er, Kollisionen bei hohen Geschwindigkeiten zu vermeiden.",
      "Auf Rundstrecken übernehmen Spiegel, Abstandsanzeigen und der Renningenieur einen Teil dieser Aufgabe. Bei Langstreckenrennen mit vielen Klassen sind zusätzliche Ansagen zu schnelleren Prototypen oder langsameren Fahrzeugen dennoch wertvoll.",
      "In Simulationen gibt es automatische Spotter, die mit Ansagen und Radar-Anzeigen arbeiten. Auch ein Teammitglied im Sprachkanal kann diese Rolle übernehmen."
    ],
    tipp: "Schalte den Spotter der Simulation bei Rennen im engen Feld ein und gewöhne dich an seine Ansagen schon im Training – im Rennen musst du ihnen dann blind vertrauen können.",
    siehe: ["boxenfunk", "steilkurve", "renningenieur"] },

  { id: "transponder", begriff: "Transponder", englisch: "Transponder",
    kurz: "Ein Sender im Fahrzeug, der bei jeder Überfahrt der Ziellinie die Rundenzeit an die Zeitnahme meldet.",
    text: [
      "Der Transponder ist ein kleiner Funksender mit eindeutiger Kennung. Unter der Strecke liegen an der Ziellinie und an Zwischenzeitpunkten Messschleifen; fährt das Fahrzeug darüber, registriert die Zeitnahme die Kennung mit einer Genauigkeit von Tausendstelsekunden.",
      "So entstehen Rundenzeiten, Sektorzeiten, Positionen und Abstände für das ganze Feld. Auch die Geschwindigkeit in der Boxengasse und die Einhaltung von Mindeststandzeiten werden oft über solche Messschleifen überprüft.",
      "Fällt der Transponder aus, fehlen dem Fahrzeug Runden in der Wertung. Teams befestigen ihn deshalb sorgfältig und prüfen ihn vor jeder Sitzung."
    ],
    tipp: "In der Simulation übernimmt das Programm die Zeitnahme – merke dir trotzdem, wo die Sektorgrenzen liegen, denn genau dort entstehen deine Zwischenzeiten.",
    siehe: ["sektorzeiten", "mini-sektoren", "pit-speed-sensor"] },

  { id: "pit-speed-sensor", begriff: "Geschwindigkeitsmessung in der Boxengasse", englisch: "Pit-Speed Sensor",
    kurz: "Die Messung, mit der die Einhaltung der Höchstgeschwindigkeit in der Boxengasse überwacht wird.",
    text: [
      "In der Boxengasse gilt eine feste Höchstgeschwindigkeit, häufig zwischen 50 und 80 km/h. Die Rennleitung überprüft sie über Messschleifen und Zeitmessungen zwischen zwei Punkten; schon eine geringe Überschreitung führt zu einer Strafe.",
      "Im Fahrzeug hält der Boxengassenbegrenzer die Geschwindigkeit ein. Seine Messung beruht auf der Raddrehzahl und kann sich durch Reifendurchmesser oder Schlupf leicht vom offiziellen Wert unterscheiden. Teams stellen ihn daher etwas unter die erlaubte Grenze ein.",
      "Entscheidend ist der Moment des Einschaltens: Wer zu spät aktiviert oder zu früh deaktiviert, ist am Messpunkt zu schnell."
    ],
    tipp: "Aktiviere den Boxengassenbegrenzer in der Simulation schon vor der Linie zur Boxengasse und schalte ihn erst hinter der Ausfahrtslinie ab – lieber einen Meter zu lang als eine Durchfahrtsstrafe.",
    siehe: ["pit-limiter", "boxengasse", "drive-through"] },

  { id: "lenkwinkelsensor", begriff: "Lenkwinkelsensor", englisch: "Steering Angle Sensor",
    kurz: "Misst, wie weit das Lenkrad eingeschlagen ist – eine Schlüsselgröße für Balance und Fahrstil.",
    text: [
      "Der Lenkwinkelsensor sitzt an der Lenksäule und zeichnet den Einschlag in Grad auf. Zusammen mit Geschwindigkeit und Querbeschleunigung zeigt er, ob ein Fahrzeug unter- oder übersteuert: Braucht der Fahrer für die gleiche Querbeschleunigung mehr Lenkwinkel als erwartet, schiebt das Auto über die Vorderräder; korrigiert er gegen, rutscht das Heck.",
      "In der Datenanalyse verrät die Lenkspur außerdem den Fahrstil: viele kleine Korrekturen deuten auf ein nervöses Auto oder einen unruhigen Fahrer hin, ein ruhiger, gleichmäßiger Verlauf auf eine gut abgestimmte Balance.",
      "Simulationen liefern den Lenkwinkel als Telemetrie-Kanal. Er ist einer der aussagekräftigsten Werte, um zwei Runden oder zwei Fahrer zu vergleichen."
    ],
    tipp: "Vergleiche deine Lenkspur mit der eines schnelleren Fahrers: Lenkt er später, aber zügiger ein und öffnet früher, nutzt er den Grip besser als du.",
    siehe: ["lenkwinkel", "eigenlenkgradient", "lenkwinkel-histogramm", "untersteuern"] },

  { id: "federwegsensor", begriff: "Federwegsensor", englisch: "Suspension Potentiometer / Damper Pot",
    kurz: "Misst, wie weit Feder und Dämpfer an jedem Rad ein- und ausfedern.",
    text: [
      "Federwegsensoren sind Wegaufnehmer, die parallel zum Dämpfer montiert werden. Sie messen die Position des Rades relativ zur Karosserie – und aus deren Änderung je Zeit die Dämpfergeschwindigkeit.",
      "Mit diesen Daten lassen sich Wanken, Nicken, Bodenfreiheit und das Verhalten über Bodenwellen und Randsteine genau untersuchen. Ingenieure erkennen, ob ein Auto durchschlägt, ob die Anschlagpuffer zu früh arbeiten und ob Zug- und Druckstufe zur Strecke passen.",
      "Aus vier Federwegen lässt sich außerdem die dynamische Bodenfreiheit an Vorder- und Hinterachse berechnen – eine Grundlage für die aerodynamische Abstimmung."
    ],
    tipp: "Zeigt die Telemetrie in schnellen Kurven einen Federweg nahe dem Maximum, prüfe härtere Federn oder mehr Bodenfreiheit, bevor du an der Aerodynamik drehst.",
    siehe: ["daempfer", "daempfer-histogramm", "bodenfreiheit-verlauf", "durchschlagen"] },

  { id: "beschleunigungssensor", begriff: "Beschleunigungssensor", englisch: "Accelerometer / G-Sensor",
    kurz: "Misst Längs-, Quer- und Vertikalbeschleunigung in Vielfachen der Erdbeschleunigung.",
    text: [
      "Ein Beschleunigungssensor erfasst, wie stark das Fahrzeug beschleunigt, bremst und in Kurven seitlich belastet wird. Die Werte werden in g angegeben: 1 g entspricht der Erdbeschleunigung. Ein GT-Fahrzeug bremst etwa mit 1,5 bis 2 g, ein Formelfahrzeug mit viel Abtrieb mit deutlich mehr.",
      "Kombiniert man Längs- und Querbeschleunigung, entsteht das G-G-Diagramm. Es zeigt, wie gut ein Fahrer den verfügbaren Grip nutzt – vor allem beim Übergang vom Bremsen ins Einlenken und vom Scheitelpunkt ins Beschleunigen.",
      "Die vertikale Beschleunigung verrät Bodenwellen und Randsteine. Für die Fahrwerksabstimmung ist sie deshalb ebenso wertvoll wie die beiden horizontalen Richtungen."
    ],
    tipp: "Bremst du in der Telemetrie mit deutlich weniger Verzögerung als ein schnellerer Fahrer, liegt das Potenzial meist im Anfang der Bremsung: kräftiger und entschlossener zu Beginn.",
    siehe: ["g-g-diagramm", "grip-kreis", "threshold-braking", "gierratensensor"] },

  { id: "gierratensensor", begriff: "Gierratensensor", englisch: "Yaw Rate Sensor",
    kurz: "Misst, wie schnell sich das Fahrzeug um seine Hochachse dreht.",
    text: [
      "Die Gierrate beschreibt die Drehgeschwindigkeit des Fahrzeugs um die senkrechte Achse, gemessen in Grad pro Sekunde. Fährt ein Auto stationär durch eine Kurve, hängt sie direkt von Geschwindigkeit und Kurvenradius ab.",
      "Interessant wird sie im Vergleich zur erwarteten Drehung: Dreht das Auto schneller, als Lenkwinkel und Geschwindigkeit vorgeben, übersteuert es; dreht es langsamer, untersteuert es. Stabilitätssysteme in Straßenautos nutzen genau diese Abweichung, um einzelne Räder abzubremsen.",
      "In der Datenanalyse zeigt die Gierrate, wie bereitwillig sich ein Auto beim Einlenken dreht und wie stabil es beim Herausbeschleunigen bleibt."
    ],
    tipp: "Ein Auto, das am Kurveneingang kaum giert und am Ausgang plötzlich stark, ist schwer zu fahren. Setze zuerst bei der Balance an, nicht beim Fahrstil.",
    siehe: ["eigenlenkgradient", "untersteuern", "uebersteuern", "traegheitsmoment"] },

  { id: "ir-reifensensor", begriff: "Infrarot-Reifentemperatursensor", englisch: "IR Tyre Temperature Sensor",
    kurz: "Berührungslose Sensoren, die die Oberflächentemperatur der Reifen während der Fahrt messen.",
    text: [
      "Infrarotsensoren sind auf die Lauffläche gerichtet und messen deren Temperatur ohne Kontakt – oft an mehreren Stellen über die Breite, also innen, in der Mitte und außen. So entsteht ein Temperaturprofil in Echtzeit, Runde für Runde und Kurve für Kurve.",
      "Damit lassen sich Sturz, Reifendruck und Fahrstil viel genauer beurteilen als mit einer einzelnen Messung nach dem Stopp, weil die Oberfläche in Sekunden abkühlt. Man sieht etwa, ob ein Reifen in langen Kurven überhitzt oder auf Geraden zu stark abkühlt.",
      "Die Oberflächentemperatur reagiert schnell, die Kerntemperatur träge. Beide zusammen ergeben erst das vollständige Bild."
    ],
    tipp: "Ist die Außenseite in den Daten deutlich heißer als die Innenseite, prüfe mehr negativen Sturz; ist die Mitte heißer als beide Schultern, ist der Druck eher zu hoch.",
    siehe: ["oberflaechentemperatur", "temperaturprofil", "sturz", "reifendruck"] },

  { id: "tpms", begriff: "Reifendruck-Kontrollsystem", englisch: "TPMS (Tire Pressure Monitoring System)",
    kurz: "Sensoren in den Rädern, die Druck und Temperatur der Reifen ständig überwachen.",
    text: [
      "Beim Reifendruck-Kontrollsystem sitzt in jedem Rad ein kleiner Sensor, der Luftdruck und Lufttemperatur misst und per Funk an das Fahrzeug sendet. Im Rennsport sind diese Systeme deutlich schneller und genauer als im Straßenauto.",
      "Sie warnen vor einem schleichenden Plattfuß, bevor der Reifen nachgibt, und zeigen dem Team, ob die Heißdrücke im Zielbereich liegen. Viele Serien schreiben solche Sensoren aus Sicherheitsgründen vor und legen Mindestdrücke fest, die damit überwacht werden.",
      "Weil der Druck mit der Temperatur steigt, ist der Kaltdruck vor dem Start nur ein Startwert. Entscheidend ist der Heißdruck nach einigen Runden."
    ],
    tipp: "Notiere dir nach jedem Stint die Heißdrücke aus der Simulation und passe die Kaltdrücke für den nächsten Stint an – so landest du schneller im richtigen Fenster.",
    siehe: ["reifendruck", "heissdruck", "kaltdruck", "ir-reifensensor"] },

  { id: "lambdasonde", begriff: "Lambdasonde und Luft-Kraftstoff-Verhältnis", englisch: "Lambda Sensor / Air-Fuel Ratio (AFR)",
    kurz: "Misst im Abgas, ob der Motor mit zu viel oder zu wenig Kraftstoff arbeitet.",
    text: [
      "Die Lambdasonde sitzt im Abgasstrang und misst den Restsauerstoff. Daraus berechnet die Motorsteuerung das Verhältnis von Luft zu Kraftstoff. Ein Lambda von 1 bedeutet genau so viel Luft, wie für die vollständige Verbrennung nötig ist; Werte darunter heißen fett, darüber mager.",
      "Für maximale Leistung laufen Rennmotoren unter Volllast etwas fett, weil der zusätzliche Kraftstoff kühlt und klopfende Verbrennung verhindert. Beim Kraftstoffsparen wird das Gemisch magerer, was Verbrauch und Leistung senkt und die Abgastemperatur erhöht.",
      "Die Messung ist die Grundlage, auf der Motorkennfelder abgestimmt werden. Weicht das Gemisch ab, kann das an Einspritzung, Kraftstoffdruck oder einem Leck im Ansaugtrakt liegen."
    ],
    tipp: "Ein spritsparendes Motorkennfeld bedeutet meist ein magereres Gemisch – vergleiche den Verbrauch je Runde vor und nach dem Wechsel, um den echten Gewinn zu sehen.",
    siehe: ["motorkennfeld", "spritsparen", "abgastemperatur", "ecu"] },

  { id: "abgastemperatur", begriff: "Abgastemperatur", englisch: "EGT (Exhaust Gas Temperature)",
    kurz: "Die Temperatur der Abgase – ein Frühwarnsignal für Motorprobleme und ein Maß für die Gemischabstimmung.",
    text: [
      "Abgastemperatursensoren sitzen kurz hinter den Auslassventilen, oft für jeden Zylinder einzeln. Unter Volllast erreichen Abgase bei Turbomotoren über 900 Grad Celsius.",
      "Steigt die Temperatur in einem Zylinder deutlich über die anderen, deutet das auf ein zu mageres Gemisch, eine defekte Einspritzdüse oder falsche Zündzeitpunkte hin. Zu hohe Temperaturen schaden Ventilen, Kolben und dem Turbolader.",
      "Für Ingenieure ist die Abgastemperatur außerdem ein wichtiger Wert beim Kraftstoffsparen: Ein mageres Gemisch spart Sprit, heizt aber die Abgase auf – es gibt eine Grenze, ab der das Sparen den Motor gefährdet."
    ],
    tipp: "Simulationen zeigen die Abgastemperatur selten an – achte stattdessen auf Wasser- und Öltemperatur, wenn du lange im Windschatten oder mit sparsamem Kennfeld fährst.",
    siehe: ["lambdasonde", "turbolader", "motorkennfeld"] },

  { id: "oeldruck-oeltemperatur", begriff: "Öldruck und Öltemperatur", englisch: "Oil Pressure & Oil Temperature",
    kurz: "Zwei Lebenszeichen des Motors: Fällt der Druck oder steigt die Temperatur zu stark, droht ein Schaden.",
    text: [
      "Das Motoröl schmiert Lager, Kolben und Nockenwellen und führt Wärme ab. Der Öldruck zeigt, ob genug Öl an alle Schmierstellen gelangt; die Öltemperatur zeigt, ob es dabei überhitzt.",
      "In schnellen Kurven und beim harten Bremsen schwappt das Öl zur Seite. Ohne Trockensumpfschmierung kann die Pumpe kurzzeitig Luft ansaugen und der Druck einbrechen – ein typischer Grund für Lagerschäden. Rennmotoren nutzen deshalb meist einen Trockensumpf mit separatem Öltank.",
      "Die Temperatur muss im richtigen Fenster liegen: Zu kaltes Öl ist zähflüssig und schützt schlecht, zu heißes verliert seine Schmierfähigkeit. Bei Hitze oder im Windschatten steigt sie rasch."
    ],
    tipp: "Steigt die Öltemperatur im Windschatten, fahre kurz versetzt neben das Auto vor dir, damit wieder frische Luft an die Kühler kommt.",
    siehe: ["kuehlwassertemperatur", "windschatten", "dirty-air", "drehzahl"] },

  { id: "kuehlwassertemperatur", begriff: "Kühlwassertemperatur", englisch: "Coolant Temperature",
    kurz: "Die Temperatur der Kühlflüssigkeit, die den Motor im optimalen Betriebsbereich hält.",
    text: [
      "Das Kühlwasser nimmt die Verbrennungswärme aus Zylinderkopf und Motorblock auf und gibt sie über den Kühler an die Luft ab. Rennmotoren arbeiten am besten in einem engen Temperaturfenster; darüber verlieren sie Leistung und riskieren Schäden an Dichtungen und Kopf.",
      "Wie gut gekühlt wird, hängt von der Luft ab, die durch die Kühler strömt. Größere Öffnungen kühlen besser, kosten aber Luftwiderstand und Abtrieb. Teams kleben Kühleröffnungen je nach Außentemperatur deshalb teilweise ab.",
      "Hinter einem anderen Fahrzeug strömt wärmere, verwirbelte Luft in die Kühler – im Windschatten steigen die Temperaturen daher oft deutlich."
    ],
    tipp: "Viele Simulationen erlauben, die Kühleröffnung im Setup zu verändern. Öffne sie bei hohen Außentemperaturen und langen Rennen etwas weiter, auch wenn das einige Zehntel kostet.",
    siehe: ["oeldruck-oeltemperatur", "lufteinlaesse", "lufttemperatur", "windschatten"] },

  { id: "benzindruck", begriff: "Kraftstoffdrucksensor", englisch: "Fuel Pressure Sensor",
    kurz: "Überwacht den Druck, mit dem der Kraftstoff zur Einspritzung gelangt.",
    text: [
      "Damit die Einspritzdüsen genau dosieren, muss der Kraftstoff mit einem gleichbleibenden Druck anliegen. Der Kraftstoffdrucksensor meldet diesen Druck an die Motorsteuerung, die Abweichungen ausgleichen oder eine Warnung ausgeben kann.",
      "Sinkt der Druck, ist häufig der Tank fast leer: In Kurven schwappt der Rest zur Seite und die Pumpe saugt Luft an. Rennfahrzeuge haben deshalb Sammelbehälter und Sicherheitstanks mit Schaumstoff, die das Schwappen dämpfen.",
      "Ein plötzlicher Druckabfall ist eine der ersten Warnungen, dass der Kraftstoff zur Neige geht oder eine Pumpe ausfällt."
    ],
    tipp: "Plane deine Tankmenge in der Simulation nie auf den letzten Liter – eine kleine Reserve schützt dich vor Aussetzern in der letzten Runde.",
    siehe: ["tankmenge", "verbrauch-pro-runde", "ecu"] },
]);
