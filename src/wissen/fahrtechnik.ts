// GSRA – Nachschlagewerk: Fahrtechnik & Fahrdynamik
import { kategorie } from "./begriff";

export const FAHRTECHNIK = kategorie("Fahrtechnik & Fahrdynamik", [
  { id: "ideallinie", begriff: "Ideallinie", englisch: "Racing Line",
    kurz: "Die schnellste Linie durch eine Kurve oder eine Kurvenkombination.",
    text: [
      "Die Ideallinie nutzt die volle Streckenbreite, um den Kurvenradius so groß wie möglich zu machen: außen anbremsen, innen den Scheitelpunkt treffen, außen herausbeschleunigen. Ein größerer Radius erlaubt bei gleichem Grip eine höhere Geschwindigkeit.",
      "Entscheidend ist nicht die schnellste Kurve, sondern die schnellste Runde. Vor einer langen Geraden lohnt es sich, etwas Kurvengeschwindigkeit zu opfern, um früher und kräftiger zu beschleunigen. In Kurvenkombinationen wird die erste Kurve oft so angefahren, dass die zweite optimal gelingt.",
      "Die Ideallinie ist deshalb kein fester Strich, sondern hängt von Fahrzeug, Reifen, Wetter und Rennsituation ab."
    ],
    tipp: "Lerne eine neue Strecke von hinten nach vorn: Bestimme zuerst die wichtigsten Kurvenausgänge vor langen Geraden und plane die Linie davor so, dass diese Ausgänge perfekt gelingen.",
    siehe: ["scheitelpunkt", "late-apex", "kampflinie", "kurvenausgang"] },

  { id: "kampflinie", begriff: "Kampflinie", englisch: "Defensive Line",
    kurz: "Eine Linie, mit der ein Fahrer seine Position verteidigt statt die schnellste Runde zu fahren.",
    text: [
      "Wird ein Fahrer angegriffen, verlässt er die Ideallinie und fährt innen an die Kurve heran. So verschließt er die Tür für ein Überholmanöver auf der Bremse.",
      "Der Preis: Der Kurvenradius wird enger, der Ausgang langsamer. Der Angreifer kann dann auf der Ideallinie mit mehr Schwung herausbeschleunigen und auf der folgenden Geraden kontern – das klassische Konter-Manöver.",
      "Die meisten Rennregeln erlauben nur einen Richtungswechsel zur Verteidigung und verbieten das Abdrängen. Gute Verteidigung bedeutet, den Angreifer zur schwierigeren Linie zu zwingen, ohne selbst zu viel Zeit zu verlieren."
    ],
    tipp: "Verteidige nur dort innen, wo ein Überholmanöver realistisch ist. In allen anderen Kurven ist die Ideallinie die beste Verteidigung, weil sie den schnellsten Ausgang liefert.",
    siehe: ["ideallinie", "gummiabrieb", "blaue-flagge"] },

  { id: "scheitelpunkt", begriff: "Scheitelpunkt", englisch: "Apex",
    kurz: "Der Punkt, an dem das Fahrzeug der Kurveninnenseite am nächsten kommt.",
    text: [
      "Der Scheitelpunkt teilt eine Kurve in Eingang und Ausgang. Bis hierhin wird gebremst und eingelenkt, danach öffnet sich das Lenkrad und das Gas wird aufgebaut.",
      "Wo der Scheitelpunkt liegt, entscheidet über die Linie: Ein früher Scheitelpunkt bringt Geschwindigkeit in den Eingang, zwingt am Ausgang aber oft zum Gaswegnehmen. Ein später Scheitelpunkt opfert etwas Eingangsgeschwindigkeit, erlaubt aber früheres und kräftigeres Beschleunigen.",
      "Bei langen Kurven gibt es manchmal mehrere Scheitelpunkte, die nacheinander angefahren werden."
    ],
    tipp: "Trägt es dich am Kurvenausgang über den Randstein hinaus oder musst du dort Gas wegnehmen, liegt dein Scheitelpunkt in der Regel zu früh.",
    siehe: ["early-apex", "mid-apex", "late-apex", "einlenkpunkt"] },

  { id: "early-apex", begriff: "Früher Scheitelpunkt", englisch: "Early Apex",
    kurz: "Die Kurveninnenseite wird schon vor der geometrischen Mitte erreicht.",
    text: [
      "Wer früh einlenkt und die Innenseite vor der Kurvenmitte erreicht, fährt einen frühen Scheitelpunkt. Das fühlt sich schnell an, weil man mit hoher Geschwindigkeit in die Kurve kommt.",
      "Am Ausgang rächt es sich: Die Linie zielt nach außen, bevor die Kurve zu Ende ist. Man muss nachlenken, Gas wegnehmen oder landet neben der Strecke.",
      "Gezielt eingesetzt wird ein früher Scheitelpunkt selten – etwa, wenn die folgende Kurve eine andere Linie verlangt oder wenn man sich gegen einen Angriff verteidigt."
    ],
    tipp: "Ein früher Scheitelpunkt ist der häufigste Fehler auf neuen Strecken. Warte beim Einlenken einen Moment länger, als es sich richtig anfühlt.",
    siehe: ["scheitelpunkt", "late-apex", "track-out"] },

  { id: "mid-apex", begriff: "Geometrischer Scheitelpunkt", englisch: "Mid Apex / Geometric Apex",
    kurz: "Scheitelpunkt genau in der Mitte der Kurve – die Linie mit dem größten Radius.",
    text: [
      "Der geometrische Scheitelpunkt liegt dort, wo eine Kurve ihren Mittelpunkt hat. Die Linie, die ihn trifft, beschreibt den größtmöglichen gleichmäßigen Radius und erlaubt die höchste konstante Kurvengeschwindigkeit.",
      "Sie ist ideal, wenn Eingang und Ausgang gleich wichtig sind, etwa in schnellen Kurven, in denen ohnehin kaum gebremst oder stark beschleunigt wird.",
      "Vor langen Geraden ist sie meist nicht die schnellste Wahl, weil sie das Beschleunigen etwas verzögert."
    ],
    tipp: "In sehr schnellen Kurven, in denen du fast voll durchfährst, ist der geometrische Scheitelpunkt oft der schnellste Weg.",
    siehe: ["scheitelpunkt", "early-apex", "late-apex", "mindestgeschwindigkeit"] },

  { id: "late-apex", begriff: "Später Scheitelpunkt", englisch: "Late Apex",
    kurz: "Die Kurveninnenseite wird erst nach der geometrischen Mitte erreicht.",
    text: [
      "Beim späten Scheitelpunkt lenkt der Fahrer später und schärfer ein und erreicht die Innenseite erst nach der Kurvenmitte. Der zweite Teil der Kurve wird dadurch gerader.",
      "So kann früher und mit voller Kraft beschleunigt werden. Der Geschwindigkeitsvorteil am Ausgang zieht sich über die ganze folgende Gerade – deshalb ist der späte Scheitelpunkt vor Geraden fast immer schneller.",
      "Auch im Regen und in Zweikämpfen ist er beliebt: Er lässt mehr Reserve am Kurvenausgang und erschwert dem Gegner den Konter."
    ],
    tipp: "Vor jeder langen Geraden lohnt der späte Scheitelpunkt. Vergleiche in der Telemetrie die Geschwindigkeit 100 Meter nach dem Kurvenausgang – nicht die Kurvengeschwindigkeit.",
    siehe: ["scheitelpunkt", "kurvenausgang", "ideallinie"] },

  { id: "einlenkpunkt", begriff: "Einlenkpunkt", englisch: "Turn-in Point",
    kurz: "Der Punkt, an dem der Fahrer beginnt, in die Kurve einzulenken.",
    text: [
      "Der Einlenkpunkt legt fest, welche Linie ein Auto durch die Kurve nimmt. Lenkt man zu früh ein, trifft man einen frühen Scheitelpunkt; zu spät, und man verliert Zeit im Eingang oder verfehlt die Innenseite.",
      "Er hängt eng mit dem Bremspunkt zusammen: Beim Trail Braking geht das Bremsen fließend in das Einlenken über. Ein sauberer, gleichmäßiger Lenkeinsatz ist dabei wichtiger als ein schneller.",
      "Fahrer nutzen Orientierungspunkte wie Markierungen, Randsteinbeginn oder Schatten, um den Einlenkpunkt jede Runde gleich zu treffen."
    ],
    tipp: "Suche dir für jede Kurve einen festen Orientierungspunkt fürs Einlenken. Konsistenz ist die Grundlage, um danach gezielt schneller zu werden.",
    siehe: ["bremspunkt", "scheitelpunkt", "trail-braking"] },

  { id: "bremspunkt", begriff: "Bremspunkt", englisch: "Brake Point",
    kurz: "Die Stelle, an der der Bremsvorgang beginnt.",
    text: [
      "Der Bremspunkt bestimmt, wie lange du auf der Geraden beschleunigen kannst. Wer später bremst, gewinnt auf der Geraden Zeit – aber nur, wenn er die Kurve danach noch sauber trifft.",
      "Bremspunkte verändern sich: mit dem Kraftstoffgewicht, mit dem Reifenzustand, mit dem Windschatten und im Regen. Erfahrene Fahrer orientieren sich an Markierungen wie Bremsschildern, passen den Punkt aber laufend an.",
      "Ein zu später Bremspunkt kostet oft mehr Zeit als er bringt, weil der Kurvenausgang leidet."
    ],
    tipp: "Taste dich in kleinen Schritten an den späteren Bremspunkt heran. Wird der Kurvenausgang schlechter, warst du zu spät – auch wenn sich die Bremszone gut anfühlte.",
    siehe: ["einlenkpunkt", "threshold-braking", "trail-braking"] },

  { id: "kurvenausgang", begriff: "Kurvenausgang", englisch: "Exit",
    kurz: "Der Teil der Kurve nach dem Scheitelpunkt, in dem beschleunigt wird.",
    text: [
      "Am Kurvenausgang öffnet sich die Lenkung, und das Gas wird aufgebaut. Hier entscheidet sich, mit welcher Geschwindigkeit man auf die nächste Gerade kommt.",
      "Weil ein Geschwindigkeitsvorteil am Ausgang über die ganze Gerade erhalten bleibt, ist er für die Rundenzeit oft wichtiger als der Eingang. Ein guter Ausgang beginnt allerdings schon mit der richtigen Linie und dem passenden Scheitelpunkt.",
      "Typische Fehler sind zu frühes Gasgeben mit Untersteuern oder Übersteuern sowie ein zu früher Scheitelpunkt, der zum Gaswegnehmen zwingt."
    ],
    tipp: "Öffne das Lenkrad und das Gas gemeinsam: Je weiter du das Lenkrad zurückdrehst, desto mehr Gas verträgt das Auto.",
    siehe: ["track-out", "late-apex", "traktion", "power-oversteer"] },

  { id: "track-out", begriff: "Track-out", englisch: "Track-out",
    kurz: "Der Punkt am Kurvenausgang, an dem das Auto wieder den Streckenrand erreicht.",
    text: [
      "Nach dem Scheitelpunkt lässt der Fahrer das Auto bis an den äußeren Streckenrand tragen. Dieser Punkt heißt Track-out. Erst wenn er erreicht ist, nutzt die Linie die volle Breite.",
      "Kommt man früher am Rand an, war die Linie zu weit; erreicht man ihn gar nicht, hätte man früher und mehr Gas geben können.",
      "Dabei sind die Streckenbegrenzungen zu beachten: Wer mit allen vier Rädern über die weiße Linie fährt, riskiert eine Strafe."
    ],
    tipp: "Nutze die Strecke am Ausgang komplett aus. Bleibt am Track-out noch Platz, hättest du mehr Gas geben können.",
    siehe: ["kurvenausgang", "track-limits", "curbs"] },

  { id: "mindestgeschwindigkeit", begriff: "Kurvenmindestgeschwindigkeit", englisch: "Minimum Corner Speed",
    kurz: "Die geringste Geschwindigkeit innerhalb einer Kurve.",
    text: [
      "Die Mindestgeschwindigkeit ist der tiefste Punkt der Geschwindigkeitskurve in einer Kurve, meist kurz vor dem Scheitelpunkt. Schon wenige km/h mehr wirken sich auf Kurvenausgang und folgende Gerade aus.",
      "Je nach Fahrzeug und Kurve unterscheidet man zwei Stile: den V-Stil mit kurzer, spitzer Richtungsänderung und frühem Beschleunigen sowie den U-Stil mit rundem Bogen und hoher Mindestgeschwindigkeit. Fahrzeuge mit viel Abtrieb und wenig Leistung bevorzugen eher den U-Stil, leistungsstarke Fahrzeuge eher den V-Stil.",
      "In der Telemetrie ist sie eine der aussagekräftigsten Vergleichsgrößen."
    ],
    tipp: "Vergleiche den tiefsten Punkt deiner Geschwindigkeitskurve mit einer schnelleren Referenzrunde. Liegst du dort zurück, bremst du vermutlich zu stark oder lenkst zu spät ein.",
    siehe: ["scheitelpunkt", "telemetrie", "delta"] },

  { id: "untersteuern", begriff: "Untersteuern", englisch: "Understeer",
    kurz: "Das Fahrzeug schiebt über die Vorderräder nach außen, obwohl gelenkt wird.",
    text: [
      "Beim Untersteuern erreichen die Vorderreifen ihre Haftgrenze vor den Hinterreifen. Das Auto folgt dem Lenkeinschlag nicht mehr und schiebt zum Kurvenrand. Im englischen Ovalsport spricht man von einem „tight“ abgestimmten Auto.",
      "Typische Ursachen sind ein zu schneller Kurveneingang, zu frühes Gasgeben am Ausgang, verwirbelte Luft hinter einem Gegner oder eine Abstimmung mit zu wenig Grip an der Vorderachse – etwa zu harter vorderer Stabilisator, zu wenig Frontabtrieb oder zu viel Differentialsperre.",
      "Mehr Lenkeinschlag macht es meist schlimmer: Die Vorderreifen rutschen noch stärker, überhitzen und verschleißen."
    ],
    tipp: "Fahrerisch: Eingangsgeschwindigkeit reduzieren und Trail Braking nutzen. Im Setup: vorderen Stabilisator weicher oder hinteren härter, mehr Frontabtrieb oder weniger Differentialsperre auf Schub.",
    siehe: ["uebersteuern", "stabilisator", "trail-braking", "dirty-air"] },

  { id: "uebersteuern", begriff: "Übersteuern", englisch: "Oversteer",
    kurz: "Das Heck verliert Haftung, das Fahrzeug dreht stärker ein als beabsichtigt.",
    text: [
      "Beim Übersteuern erreichen die Hinterreifen ihre Haftgrenze vor den Vorderreifen. Das Heck drängt nach außen, das Auto dreht sich in die Kurve hinein. Im Ovalsport heißt ein solches Auto „loose“.",
      "Man unterscheidet nach Auslöser: Power Oversteer durch zu viel Gas, Lift-off-Übersteuern durch abruptes Gaswegnehmen und Snap Oversteer, bei dem das Heck plötzlich und heftig ausbricht.",
      "Leichtes Übersteuern kann helfen, das Auto in der Kurve zu drehen. Zu viel davon kostet Zeit, Reifen und im schlimmsten Fall das Rennen."
    ],
    tipp: "Fahrerisch: Gas progressiver dosieren und Lastwechsel vermeiden. Im Setup: hinteren Stabilisator weicher, mehr Heckflügel oder weniger Sperre auf Zug.",
    siehe: ["untersteuern", "power-oversteer", "lastwechsel", "snap-oversteer"] },

  { id: "power-oversteer", begriff: "Leistungsübersteuern", englisch: "Power Oversteer",
    kurz: "Das Heck bricht aus, weil zu viel Antriebskraft die Hinterreifen überfordert.",
    text: [
      "Am Kurvenausgang müssen die Hinterreifen gleichzeitig Seitenkraft und Antriebskraft übertragen. Gibt der Fahrer zu früh oder zu viel Gas, überschreiten sie ihre Haftungsgrenze, und das Heck rutscht nach außen.",
      "Besonders anfällig sind leistungsstarke, hinterradgetriebene Fahrzeuge, Turbomotoren mit plötzlich einsetzendem Ladedruck und abgefahrene Reifen. Nasse Fahrbahn verstärkt den Effekt.",
      "Leichtes, kontrolliertes Leistungsübersteuern kann sogar schnell sein, weil es das Auto am Ausgang in die Richtung der Geraden dreht – zu viel davon kostet aber Vortrieb und Reifen."
    ],
    tipp: "Gib erst Gas, wenn sich das Lenkrad öffnet, und erhöhe es gleichmäßig. Bei Problemen helfen ein Gang höher, mehr Traktionskontrolle oder eine passende Differentialeinstellung auf Zug.",
    siehe: ["traktion", "traktionskontrolle", "diff-zug", "gegenlenken"] },

  { id: "lastwechsel", begriff: "Lift-off-Übersteuern", englisch: "Lift-off Oversteer",
    kurz: "Plötzliches Gaswegnehmen in der Kurve entlastet das Heck, das Auto dreht ein.",
    text: [
      "Nimmt der Fahrer in einer Kurve abrupt das Gas weg, verlagert sich Last nach vorn. Die Hinterreifen werden entlastet und verlieren Seitenkraft, während die Vorderreifen mehr Grip bekommen. Das Auto dreht stärker ein – im Deutschen spricht man von einer Lastwechselreaktion.",
      "Besonders ausgeprägt ist der Effekt bei Fahrzeugen mit Heck- oder Mittelmotor und bei hoher Motorbremse. Er kann gefährlich werden, weil er oft genau dann auftritt, wenn der Fahrer erschrickt und vom Gas geht.",
      "Gezielt und dosiert eingesetzt, hilft ein kurzer Lastwechsel dagegen, ein untersteuerndes Auto beim Einlenken zum Drehen zu bringen."
    ],
    tipp: "Führe Pedalbewegungen in schnellen Kurven gleichmäßig aus. Wenn du merkst, dass du zu schnell bist, halte das Gas eher konstant und öffne die Lenkung, statt abrupt zu lupfen.",
    siehe: ["gewichtsverlagerung", "uebersteuern", "motorbremse", "diff-schub"] },

  { id: "snap-oversteer", begriff: "Plötzliches Übersteuern", englisch: "Snap Oversteer",
    kurz: "Das Heck bricht ohne Vorwarnung schlagartig aus.",
    text: [
      "Beim Snap Oversteer kippt das Auto in Sekundenbruchteilen vom Haften ins Rutschen. Oft geschieht das, wenn ein zuvor untersteuerndes Auto plötzlich hinten Grip verliert, oder wenn der Fahrer nach einer Korrektur zu schnell wieder Grip aufbaut und das Heck in die andere Richtung schleudert.",
      "Typische Auslöser sind Reifen mit spitzem Gripmaximum, kalte Reifen, Bodenwellen, ein abreißender Diffusor oder abruptes Gegenlenken. Mittelmotorfahrzeuge sind besonders anfällig.",
      "Weil kaum Zeit zur Reaktion bleibt, ist es eine der häufigsten Ursachen für Dreher."
    ],
    tipp: "Halte Korrekturen klein und schnell wieder zurück. Wer zu lange gegenlenkt, provoziert den Rückschlag in die andere Richtung.",
    siehe: ["uebersteuern", "gegenlenken", "stroemungsabriss", "peak-slip-angle"] },

  { id: "gewichtsverlagerung", begriff: "Lastwechsel und Gewichtsverlagerung", englisch: "Weight Transfer / Load Transfer",
    kurz: "Verschiebung der Radlasten beim Bremsen, Beschleunigen und in Kurven.",
    text: [
      "Beim Bremsen wandert Last nach vorn, beim Beschleunigen nach hinten, in Kurven nach außen. Wie viel Last sich verschiebt, hängt von der Schwerpunkthöhe, dem Radstand, der Spurweite und der Beschleunigung ab.",
      "Da ein Reifen mit wachsender Last nicht proportional mehr Grip liefert, verliert das Auto insgesamt Haftung, je ungleicher die Lasten verteilt sind. Federn, Stabilisatoren und Dämpfer bestimmen, wie schnell und auf welche Räder sich die Last verlagert.",
      "Fahrer nutzen die Gewichtsverlagerung gezielt: Last auf der Vorderachse hilft beim Einlenken, Last auf der Hinterachse beim Beschleunigen."
    ],
    tipp: "Ruhige, fließende Eingaben halten die Lastverteilung stabil – genau das macht schnelle Fahrer konstant. Abrupte Pedal- und Lenkbewegungen bringen das Auto aus dem Gleichgewicht.",
    siehe: ["lastwechsel", "trail-braking", "schwerpunkt", "stabilisator"] },

  { id: "lift-coast", begriff: "Lift and Coast", englisch: "Lifting & Coasting (LiCo)",
    kurz: "Vor dem Bremspunkt früher vom Gas gehen und rollen lassen, um Kraftstoff zu sparen.",
    text: [
      "Beim Lift and Coast nimmt der Fahrer am Ende einer Geraden früher als nötig das Gas weg und lässt das Auto einige Meter rollen, bevor er bremst. Danach wird kürzer gebremst als sonst.",
      "Der Zeitverlust ist gering, weil das Auto am Ende einer Geraden ohnehin langsamer beschleunigt. Die Kraftstoffersparnis dagegen ist deutlich – oft die effizienteste Art, Sprit zu sparen. Zusätzlich werden Bremsen und Reifen geschont.",
      "In Langstreckenrennen wird Lift and Coast genutzt, um einen Stint um eine Runde zu verlängern oder einen Stopp zu sparen."
    ],
    tipp: "Übe es auf den Geraden mit den höchsten Geschwindigkeiten: Dort spart jeder Meter am meisten. Ein fester Orientierungspunkt fürs Gaswegnehmen hilft, es Runde für Runde gleich zu machen.",
    siehe: ["spritsparen", "stint", "tankmenge", "harvest"] },

  { id: "short-shifting", begriff: "Frühes Hochschalten", englisch: "Short-Shifting",
    kurz: "Bewusst vor dem Drehzahloptimum hochschalten.",
    text: [
      "Beim Short-Shifting schaltet der Fahrer früher hoch, als es für maximale Beschleunigung ideal wäre. Das Drehmoment an den Rädern sinkt, die Räder drehen weniger leicht durch.",
      "Das hilft bei Nässe, auf abgefahrenen Reifen und am Ausgang langsamer Kurven. Zugleich sinkt der Kraftstoffverbrauch, und der Motor wird geschont.",
      "In Langstreckenrennen ist frühes Schalten oft Teil der Sparstrategie."
    ],
    tipp: "Im Regen am Kurvenausgang einen Gang früher hochschalten. Im Trockenen nur dort, wo die Traktion wirklich begrenzt.",
    siehe: ["traktion", "spritsparen", "regenreifen", "drehmoment"] },

  { id: "flat-shifting", begriff: "Hochschalten ohne Gaswegnehmen", englisch: "Flat-Shifting",
    kurz: "Hochschalten bei voll durchgetretenem Gaspedal.",
    text: [
      "Bei modernen sequenziellen Getrieben unterbricht die Motorsteuerung beim Hochschalten automatisch für Millisekunden die Zündung. Der Fahrer kann deshalb mit vollem Gas schalten, ohne das Pedal zu lupfen.",
      "Das spart Zeit und hält das Auto stabil, weil keine Lastwechsel entstehen. Bei H-Schaltgetrieben und älteren Fahrzeugen ist es dagegen schädlich: Dort muss für jeden Gangwechsel kurz vom Gas gegangen und gekuppelt werden.",
      "Ob ein Fahrzeug Flat-Shifting erlaubt, hängt von Getriebe und Steuerung ab."
    ],
    tipp: "Prüfe für jedes neue Fahrzeug, ob es Flat-Shifting unterstützt. Wenn ja, bleib beim Hochschalten voll auf dem Gas.",
    siehe: ["sequenzielles-getriebe", "schaltwippen", "h-schaltung"] },

  { id: "zwischengas", begriff: "Zwischengas", englisch: "Rev Matching / Blipping",
    kurz: "Kurzer Gasstoß beim Herunterschalten, um die Motordrehzahl anzugleichen.",
    text: [
      "Beim Herunterschalten muss der Motor schneller drehen als zuvor. Ohne Angleichen bremst er die Antriebsräder beim Einkuppeln abrupt ab – das Heck kann ausbrechen, und Getriebe sowie Kupplung werden belastet.",
      "Ein kurzer Gasstoß während des Schaltvorgangs bringt die Drehzahl auf das passende Niveau. Der Gangwechsel wird sanft, das Auto bleibt stabil.",
      "Viele moderne Rennfahrzeuge erledigen das automatisch. Bei historischen Fahrzeugen und H-Schaltgetrieben ist es Handarbeit – meist mit der Heel-and-Toe-Technik."
    ],
    tipp: "Wird das Heck beim Herunterschalten unruhig, schalte etwas später herunter oder reduziere die Motorbremse – in Fahrzeugen ohne Automatik übe Zwischengas.",
    siehe: ["heel-and-toe", "double-clutching", "motorbremse", "h-schaltung"] },

  { id: "heel-and-toe", begriff: "Spitze-Hacke-Technik", englisch: "Heel-and-Toe",
    kurz: "Gleichzeitig bremsen und Zwischengas geben mit einem Fuß.",
    text: [
      "Weil der linke Fuß beim H-Schaltgetriebe die Kupplung bedient, muss der rechte Fuß bremsen und gleichzeitig Zwischengas geben. Dazu bremst der Fußballen, während die Ferse oder die Fußseite kurz auf das Gaspedal tippt.",
      "So kann der Fahrer bis zum Kurveneingang voll bremsen und dabei sauber herunterschalten. Die Technik ist anspruchsvoll und erfordert eine Pedalerie, deren Pedale passend zueinander stehen.",
      "In Fahrzeugen mit sequenziellem Getriebe und automatischem Zwischengas ist sie überflüssig."
    ],
    tipp: "Stelle in deinem Simulator Brems- und Gaspedal auf ähnliche Höhe, wenn du Heel-and-Toe üben willst. Beginne mit langsamen Bremsungen und steigere das Tempo.",
    siehe: ["zwischengas", "double-clutching", "h-schaltung"] },

  { id: "double-clutching", begriff: "Zwischenkuppeln", englisch: "Double-Clutching",
    kurz: "Beim Schalten zweimal kuppeln, um Getriebewellen ohne Synchronisierung anzugleichen.",
    text: [
      "Beim Zwischenkuppeln tritt der Fahrer die Kupplung, nimmt den Gang heraus, lässt die Kupplung im Leerlauf kurz kommen, gibt Zwischengas, kuppelt erneut und legt dann den neuen Gang ein.",
      "Diese Technik stammt aus der Zeit unsynchronisierter Getriebe: Erst durch das Angleichen der Getriebewellen ließ sich ein Gang ohne Krachen einlegen. Heute ist sie fast nur noch bei historischen Fahrzeugen und Lastwagen nötig.",
      "Manche Simulationen bilden unsynchronisierte Getriebe nach – dort ist Zwischenkuppeln Pflicht."
    ],
    tipp: "In historischen Fahrzeugen: Lass dir beim Herunterschalten Zeit. Ein verpasster Gang kostet mehr als ein ruhiger, sauberer Wechsel.",
    siehe: ["zwischengas", "heel-and-toe", "h-schaltung"] },

  { id: "gegenlenken", begriff: "Gegenlenken", englisch: "Counter-Steering",
    kurz: "Lenken in Richtung des ausbrechenden Hecks, um das Auto abzufangen.",
    text: [
      "Bricht das Heck aus, dreht der Fahrer die Lenkung in die Richtung, in die das Heck rutscht. Die Vorderräder zeigen so wieder in die Fahrtrichtung, und das Auto kann sich stabilisieren.",
      "Entscheidend ist das Timing: Zu spätes Gegenlenken reicht nicht, um den Dreher zu verhindern; zu langes Gegenlenken führt dazu, dass das Heck nach dem Wiedererlangen des Grips in die andere Richtung schlägt.",
      "Im Simracing ist ein gut eingestelltes Force Feedback entscheidend, um das Ausbrechen früh zu spüren."
    ],
    tipp: "Lenke schnell gegen, aber nimm die Korrektur genauso schnell zurück, sobald das Heck greift. Ein gleichmäßiges Gas hilft, das Auto ruhig zu halten.",
    siehe: ["uebersteuern", "snap-oversteer", "force-feedback", "drift"] },

  { id: "drift", begriff: "Drift", englisch: "Drift",
    kurz: "Kontrolliertes Fahren mit großem Schräglaufwinkel an der Hinterachse.",
    text: [
      "Beim Driften rutscht das Auto bewusst mit dem Heck voraus durch die Kurve, gehalten durch Gegenlenken und Gas. Der Schräglaufwinkel ist dabei weit größer als bei einer schnellen Runde.",
      "Im Rundstreckenrennsport kostet Driften Zeit und Reifen, weil die Reifen weit jenseits ihres Gripmaximums arbeiten. Als eigene Disziplin wird es dagegen nach Winkel, Linie und Stil bewertet.",
      "Drift-Fahrzeuge haben oft eine starre Hinterachse, viel Lenkeinschlag und eine Handbremse zum Einleiten."
    ],
    tipp: "Driftübungen trainieren dein Gefühl für das Heck. Für schnelle Runden gilt aber: Je weniger das Auto rutscht, desto schneller ist es meist.",
    siehe: ["rutschen", "gegenlenken", "spool", "schlupfwinkel"] },

  { id: "rutschen", begriff: "Rutschen", englisch: "Slide",
    kurz: "Ein Reifen oder das ganze Auto bewegt sich jenseits der Haftgrenze.",
    text: [
      "Rutschen beginnt, wenn ein Reifen mehr Kraft übertragen soll, als er kann. Ein leichtes Rutschen im Bereich des optimalen Schräglaufwinkels gehört zum schnellen Fahren; ein starkes Rutschen kostet Zeit.",
      "Man unterscheidet, welche Achse rutscht: vorn (Untersteuern), hinten (Übersteuern) oder beide gleichmäßig (Vier-Rad-Drift). Jedes Rutschen erzeugt Wärme und Verschleiß.",
      "Schnelle Fahrer halten das Auto genau an der Grenze, ohne dass es merklich rutscht – das sieht oft unspektakulär aus."
    ],
    tipp: "Fühlt sich deine schnellste Runde spektakulär an, war sie oft nicht die schnellste. Ruhige Runden mit wenig Rutschen sind meist schneller.",
    siehe: ["schlupf", "drift", "untersteuern", "uebersteuern"] },

  { id: "double-stint", begriff: "Doppelstint", englisch: "Double-Stint",
    kurz: "Zwei Tankfüllungen hintereinander mit demselben Fahrer oder denselben Reifen.",
    text: [
      "Im Langstreckenrennen bezeichnet ein Doppelstint, dass ein Fahrer zwei Stints hintereinander fährt, ohne gewechselt zu werden. Bei Reifen meint er, dass ein Satz über zwei Tankfüllungen genutzt wird.",
      "Ein Fahrer-Doppelstint spart einen Fahrerwechsel und damit Zeit an der Box. Ein Reifen-Doppelstint spart den Reifenwechsel – aber nur, wenn der Reifen nicht zu stark abbaut.",
      "Die Entscheidung hängt vom Reglement (Mindest- und Höchstfahrzeiten), von der Ermüdung des Fahrers und vom Reifenabbau ab."
    ],
    tipp: "Plane Doppelstints so, dass der stärkste Fahrer in den wichtigsten Phasen fährt – etwa in der Nacht oder am Ende des Rennens.",
    siehe: ["triple-stint", "stint", "fahrerwechsel", "reifenabbau"] },

  { id: "triple-stint", begriff: "Dreifachstint", englisch: "Triple-Stint",
    kurz: "Drei Tankfüllungen hintereinander mit demselben Fahrer oder denselben Reifen.",
    text: [
      "Ein Dreifachstint verlängert das Prinzip des Doppelstints: Ein Fahrer bleibt für drei Tankfüllungen im Auto, oder ein Reifensatz wird über drei Stints gefahren.",
      "Bei Fahrern ist das eine große körperliche und mentale Belastung, die im echten Motorsport durch Höchstfahrzeiten begrenzt ist. Bei Reifen gelingt es nur mit sehr haltbaren Mischungen, kühlen Bedingungen oder geringer Belastung – etwa in der Nacht.",
      "Gelingt es, spart es viel Standzeit an der Box."
    ],
    tipp: "Ein Reifen-Dreifachstint lohnt sich nur, wenn der Zeitverlust durch Abbau kleiner ist als die gesparte Zeit für den Reifenwechsel. Rechne das mit deinen Stintdaten nach.",
    siehe: ["double-stint", "stint", "reifenabbau", "langstreckenrennen"] },

  { id: "curbs", begriff: "Randsteine", englisch: "Curbs / Kerbs",
    kurz: "Erhöhte, meist rot-weiß bemalte Begrenzungen am Kurvenrand.",
    text: [
      "Randsteine markieren den Rand der Strecke an Kurveneingang, Scheitelpunkt und Ausgang. Sie verbreitern die nutzbare Fahrbahn und sind oft so gestaltet, dass sie zum Überfahren einladen – oder davon abschrecken.",
      "Flache Randsteine können gezielt genutzt werden, um eine Kurve zu begradigen. Hohe, gewellte oder gestufte Randsteine bringen das Auto aus dem Gleichgewicht und können den Unterboden beschädigen.",
      "Wie viel Randstein ein Auto verträgt, hängt stark von der Abstimmung ab – insbesondere von der Fahrzeughöhe und der schnellen Dämpfung."
    ],
    tipp: "Taste dich an Randsteine heran: Erst mit zwei Rädern, dann weiter. Springt das Auto, stelle die schnelle Druckstufe weicher oder meide diesen Randstein.",
    siehe: ["sausage-curbs", "stepped-curbs", "high-speed-druckstufe", "track-limits"] },

  { id: "sausage-curbs", begriff: "Wurstrandsteine", englisch: "Sausage Curbs",
    kurz: "Hohe, abgerundete Randsteine, die das Abkürzen verhindern sollen.",
    text: [
      "Sausage Curbs sind wulstförmige Erhebungen, die meist hinter dem eigentlichen Randstein oder an Schikanen liegen. Sie sollen verhindern, dass Fahrer Kurven abkürzen.",
      "Wer sie überfährt, wird stark ausgehebelt: Das Auto kann abheben, den Unterboden beschädigen oder unkontrolliert einschlagen. Sie sind deshalb eine wirksame, wenn auch umstrittene Maßnahme gegen Track-Limit-Verstöße.",
      "In Simulationen sind sie genauso tückisch wie in der Realität."
    ],
    tipp: "Meide Sausage Curbs konsequent. Der mögliche Zeitgewinn steht in keinem Verhältnis zum Risiko eines Schadens.",
    siehe: ["curbs", "track-limits", "schikane"] },

  { id: "stepped-curbs", begriff: "Stufenrandsteine", englisch: "Stepped Curbs",
    kurz: "Randsteine mit mehreren Stufen, die das Überfahren zunehmend unbequem machen.",
    text: [
      "Stufenrandsteine bestehen aus mehreren nebeneinanderliegenden Abschnitten, die nach außen höher werden. Der innere Teil lässt sich gut nutzen, der äußere bestraft zu weites Fahren.",
      "So sollen Fahrer innerhalb der Strecke gehalten werden, ohne das Überfahren ganz zu verbieten. Je weiter man hinausgeht, desto mehr wird das Auto ausgehebelt.",
      "Sie finden sich vor allem an Kurvenausgängen moderner Rennstrecken."
    ],
    tipp: "Nutze die innere, flache Stufe, aber vermeide die äußeren. Teste im Training, wie weit dein Auto gehen kann.",
    siehe: ["curbs", "track-limits", "track-out"] },

  { id: "auslaufzone", begriff: "Auslaufzone", englisch: "Run-off Area",
    kurz: "Freie Fläche neben der Strecke, die ein abkommendes Fahrzeug auffangen soll.",
    text: [
      "Auslaufzonen geben einem Fahrzeug, das von der Strecke abkommt, Raum zum Abbremsen. Sie bestehen aus Asphalt, Kies oder Gras.",
      "Asphaltierte Auslaufzonen sind sicherer, weil Autos dort kontrolliert abbremsen können. Sie verleiten aber dazu, die Streckenbegrenzungen zu überschreiten, weil ein Fehler kaum bestraft wird. Deshalb werden sie oft mit Track-Limit-Regeln und Randsteinen kombiniert.",
      "Kies und Gras bremsen stärker, können aber zum Überschlag oder zum Steckenbleiben führen."
    ],
    tipp: "Kommst du von der Strecke ab, fahre kontrolliert zurück, ohne andere zu gefährden – und erwarte bei Abkürzungen eine Strafe.",
    siehe: ["kiesbett", "track-limits", "off-track"] },

  { id: "kiesbett", begriff: "Kiesbett", englisch: "Gravel Trap",
    kurz: "Mit Kies gefüllte Auslaufzone, die Fahrzeuge schnell abbremst.",
    text: [
      "Im Kiesbett sinken die Räder ein und das Auto wird stark abgebremst. So werden Fahrzeuge, die von der Strecke abkommen, verlangsamt, bevor sie eine Mauer erreichen.",
      "Der Nachteil: Wer ins Kiesbett gerät, bleibt oft stecken oder verliert viel Zeit. Steine landen zudem auf der Strecke und können Reifen beschädigen.",
      "Kiesbetten sind ein natürlicher Schutz gegen das Ausnutzen der Streckenbegrenzung."
    ],
    tipp: "Gerätst du ins Kiesbett, halte die Räder möglichst gerade und gib nur wenig Gas. Starkes Lenken oder Bremsen lässt das Auto eingraben.",
    siehe: ["auslaufzone", "track-limits", "unterboden"] },

  { id: "schikane", begriff: "Schikane", englisch: "Chicane",
    kurz: "Kurze Kurvenfolge, die ein Fahrzeug auf einer Geraden einbremst.",
    text: [
      "Eine Schikane ist eine schnelle Abfolge von Links- und Rechtskurve, oft auf einer ansonsten langen Geraden. Sie senkt die Geschwindigkeit, etwa vor gefährlichen Abschnitten.",
      "Fahrerisch ist sie anspruchsvoll: Hartes Anbremsen, ein schneller Richtungswechsel und viel Randstein. Die Linie durch die erste Kurve bestimmt, wie gut man aus der zweiten herauskommt.",
      "Schikanen sind beliebte Überholstellen, weil man hart hineinbremsen muss."
    ],
    tipp: "Opfere in der ersten Kurve der Schikane etwas Geschwindigkeit, um die zweite gerade und früh am Gas zu verlassen.",
    siehe: ["curbs", "sausage-curbs", "bremspunkt"] },

  { id: "haarnadel", begriff: "Haarnadelkurve", englisch: "Hairpin",
    kurz: "Sehr enge Kurve, in der die Fahrtrichtung um etwa 180 Grad wechselt.",
    text: [
      "Haarnadelkurven sind die langsamsten Kurven einer Strecke. Sie folgen oft auf lange Geraden und sind deshalb klassische Überholstellen.",
      "Die Herausforderung liegt im harten Anbremsen aus hoher Geschwindigkeit und im Herausbeschleunigen mit wenig Traktion. Ein später Scheitelpunkt ist fast immer schneller, weil der Ausgang die folgende Gerade bestimmt.",
      "Hier zeigen sich Unterschiede in Bremsstabilität, Traktion und Differentialeinstellung besonders deutlich."
    ],
    tipp: "Bremse gerade und hart, drehe das Auto am Scheitelpunkt und konzentriere dich auf einen sauberen, frühen Ausgang.",
    siehe: ["late-apex", "traktion", "bremspunkt"] },

  { id: "s-kurve", begriff: "S-Kurven", englisch: "Esses",
    kurz: "Schnelle, aufeinanderfolgende Wechselkurven.",
    text: [
      "S-Kurven sind Folgen von Links- und Rechtskurven, die oft mit hoher Geschwindigkeit durchfahren werden. Die Linie durch eine Kurve legt die Ausgangsposition für die nächste fest.",
      "Gefragt sind ein agiles Auto, das schnell die Richtung wechselt, und ein Fahrer, der die Kombination als Ganzes plant. Fehler in der ersten Kurve setzen sich bis zum Ende fort.",
      "Bekannte Beispiele bieten viele traditionsreiche Strecken mit schnellen, fließenden Passagen."
    ],
    tipp: "Denke in S-Kurven zwei Kurven voraus. Eine leicht langsamere erste Kurve führt oft zu einer deutlich schnelleren Gesamtpassage.",
    siehe: ["ideallinie", "gewichtsverlagerung", "schikane"] },

  { id: "steilkurve", begriff: "Steilkurve", englisch: "Banking",
    kurz: "Kurve mit geneigter Fahrbahn, die höhere Geschwindigkeiten erlaubt.",
    text: [
      "In einer Steilkurve ist die Fahrbahn zur Innenseite geneigt. Ein Teil der Fliehkraft wird so in Andruck umgewandelt – das Auto wird auf die Fahrbahn gedrückt und kann schneller fahren.",
      "Steilkurven prägen Ovalrennen, kommen aber auch auf einigen Rundstrecken vor. Sie verändern die Belastung von Federn und Reifen deutlich.",
      "Auch umgekehrt geneigte Kurven gibt es: Dort fällt die Fahrbahn nach außen ab, was den Grip verringert."
    ],
    tipp: "In Steilkurven nimmt der Grip mit der Neigung zu. Nutze die steilere Spur, wenn die Strecke mehrere Neigungen bietet.",
    siehe: ["kuppe", "senke", "radlasten"] },

  { id: "kuppe", begriff: "Kuppe", englisch: "Crest",
    kurz: "Höchster Punkt einer Steigung, an dem das Auto leichter wird.",
    text: [
      "Fährt ein Auto über eine Kuppe, federt es aus, und die Reifen werden entlastet. Grip und Abtrieb nehmen kurzzeitig ab, im Extremfall hebt das Auto ab.",
      "Bremsen oder Einlenken auf der Kuppe ist deshalb gefährlich: Die Räder blockieren leichter, und das Auto lenkt schlechter ein. Hinter einer Kuppe ist zudem die Sicht oft eingeschränkt.",
      "Bekannte Strecken mit vielen Kuppen verlangen ein Fahrwerk, das ausreichend Federweg hat."
    ],
    tipp: "Bremse vor oder nach einer Kuppe, nicht darauf. Halte das Lenkrad ruhig, während das Auto leicht wird.",
    siehe: ["senke", "zugstufe", "blockieren"] },

  { id: "senke", begriff: "Senke", englisch: "Compression / Dip",
    kurz: "Tiefster Punkt zwischen Gefälle und Steigung, in dem das Auto einfedert.",
    text: [
      "In einer Senke wird das Auto in die Federn gedrückt. Die Reifen werden stärker belastet und haben kurzzeitig mehr Grip, aber das Fahrwerk kann an seine Grenzen kommen.",
      "Gerade bei tiefen Fahrzeugen mit viel Abtrieb ist die Senke kritisch: Der Unterboden kann aufsetzen, das Auto schlägt durch und verliert Grip.",
      "Senken am Ende von Geraden – etwa vor einem Bremspunkt – sind besonders anspruchsvoll."
    ],
    tipp: "Prüfe in der Telemetrie die Fahrzeughöhe in Senken. Schlägt das Auto dort durch, helfen mehr Höhe, härtere Federn oder Packer.",
    siehe: ["kuppe", "durchschlagen", "anschlagpuffer"] },
]);
