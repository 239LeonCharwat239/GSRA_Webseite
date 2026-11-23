// GSRA – Nachschlagewerk: Reifen & Grip
import { kategorie } from "./begriff";

export const REIFEN = kategorie("Reifen & Grip", [
  { id: "grip", begriff: "Grip", englisch: "Grip",
    kurz: "Die Haftung zwischen Reifen und Fahrbahn – die Grundlage jeder Fahrzeugbewegung.",
    text: [
      "Jede Kraft, die ein Auto beschleunigt, bremst oder in die Kurve lenkt, muss über vier handtellergroße Aufstandsflächen übertragen werden. Grip beschreibt, wie viel Kraft diese Flächen aufnehmen können, bevor der Reifen rutscht.",
      "Er entsteht vor allem auf zwei Wegen: durch molekulare Haftung zwischen Gummi und Asphalt und durch Verzahnung, bei der sich das Gummi in die Rauheit der Fahrbahn verformt. Beides hängt stark von Temperatur, Druck, Mischung und Fahrbahnzustand ab.",
      "Mehr Last auf dem Reifen bedeutet mehr Grip – aber nicht proportional. Deshalb kostet jede ungleiche Lastverteilung insgesamt Haftung, und deshalb ist Abtrieb so wertvoll."
    ],
    tipp: "Grip ist keine feste Größe: Er ändert sich mit Reifentemperatur, Streckenzustand und Verschleiß. Lerne, ihn über Lenkung und Force Feedback zu spüren, statt dich auf feste Bremspunkte zu verlassen.",
    siehe: ["mechanischer-grip", "aerodynamischer-grip", "grip-kreis", "schlupf"] },

  { id: "mechanischer-grip", begriff: "Mechanischer Grip", englisch: "Mechanical Grip",
    kurz: "Haftung, die aus Reifen, Fahrwerk und Gewicht entsteht – unabhängig von der Geschwindigkeit.",
    text: [
      "Mechanischer Grip ist die Haftung, die ein Auto auch ohne Aerodynamik hat. Er hängt von den Reifen, der Fahrwerksabstimmung, dem Gewicht und seiner Verteilung ab.",
      "In langsamen Kurven ist er fast allein entscheidend, weil der Abtrieb bei geringer Geschwindigkeit kaum wirkt. Ein Fahrwerk, das die Reifen gleichmäßig belastet und flach auf der Straße hält, liefert den meisten mechanischen Grip.",
      "Weiche Federn, passende Stabilisatoren, richtiger Sturz und gut abgestimmte Dämpfer sind die wichtigsten Werkzeuge dafür."
    ],
    tipp: "Untersteuert dein Auto nur in langsamen Kurven, arbeite am mechanischen Grip (Stabilisatoren, Federn, Differential) – nicht an den Flügeln.",
    siehe: ["aerodynamischer-grip", "stabilisator", "federrate", "grip"] },

  { id: "aerodynamischer-grip", begriff: "Aerodynamischer Grip", englisch: "Aerodynamic Grip",
    kurz: "Zusätzliche Haftung durch Abtrieb, die mit der Geschwindigkeit wächst.",
    text: [
      "Abtrieb drückt die Reifen stärker auf die Fahrbahn und erhöht so ihren Grip. Weil er mit dem Quadrat der Geschwindigkeit wächst, dominiert er in schnellen Kurven.",
      "Bei modernen Prototypen und Formelfahrzeugen übersteigt der Abtrieb bei Höchstgeschwindigkeit sogar das Fahrzeuggewicht. In schnellen Kurven ist dann mehr Grip vorhanden als in langsamen – ein Grund, warum diese Fahrzeuge in Hochgeschwindigkeitskurven so beeindruckend schnell sind.",
      "Der aerodynamische Grip ist abhängig von sauberer Anströmung: Im Windschatten oder in verwirbelter Luft schrumpft er."
    ],
    tipp: "Verhält sich dein Auto in langsamen und schnellen Kurven unterschiedlich, liegt das meist an der Balance zwischen mechanischem und aerodynamischem Grip.",
    siehe: ["abtrieb", "mechanischer-grip", "dirty-air", "aero-balance"] },

  { id: "schlupf", begriff: "Schlupf", englisch: "Slip",
    kurz: "Unterschied zwischen der Bewegung des Reifens und der des Fahrzeugs.",
    text: [
      "Ein Reifen überträgt Kräfte nur, wenn er sich ein wenig verformt und leicht rutscht. Dieser Schlupf ist kein Fehler, sondern die Voraussetzung für Grip: Ohne Schlupf gäbe es keine Brems-, Antriebs- oder Seitenkraft.",
      "Mit zunehmendem Schlupf steigt die übertragbare Kraft zunächst an, erreicht ein Maximum und fällt danach wieder ab. Der schnellste Fahrer bewegt den Reifen genau im Bereich dieses Maximums.",
      "Man unterscheidet Längsschlupf beim Bremsen und Beschleunigen und Querschlupf beziehungsweise Schräglaufwinkel in der Kurve."
    ],
    tipp: "Ein Reifen, der leicht arbeitet und hörbar „singt“, ist meist schneller als einer, der gar nicht rutscht – und deutlich schneller als einer, der stark rutscht.",
    siehe: ["laengsschlupf", "querschlupf", "schlupfwinkel", "peak-slip-angle"] },

  { id: "laengsschlupf", begriff: "Längsschlupf", englisch: "Longitudinal Slip / Slip Ratio",
    kurz: "Das Rad dreht schneller oder langsamer, als es dem Fahrzeugtempo entspricht.",
    text: [
      "Beim Beschleunigen dreht sich ein angetriebenes Rad etwas schneller, als das Auto fährt; beim Bremsen etwas langsamer. Dieser Unterschied, in Prozent angegeben, ist der Längsschlupf.",
      "Die größte Brems- oder Antriebskraft liegt bei wenigen Prozent Schlupf – je nach Reifen grob zwischen fünf und fünfzehn. Steigt der Schlupf weiter, dreht das Rad durch oder blockiert, und die Kraft fällt ab.",
      "ABS und Traktionskontrolle regeln genau diesen Wert."
    ],
    tipp: "In der Telemetrie kannst du den Schlupf über den Vergleich von Rad- und Fahrzeuggeschwindigkeit sehen – ideal, um Bremsdruck und Gaspedal am Limit zu üben.",
    siehe: ["schlupf", "blockieren", "traktionskontrolle", "abs"] },

  { id: "querschlupf", begriff: "Querschlupf", englisch: "Lateral Slip",
    kurz: "Seitliches Rutschen des Reifens in der Kurve.",
    text: [
      "In der Kurve läuft der Reifen nicht genau in die Richtung, in die er zeigt, sondern leicht schräg dazu. Die Lauffläche verformt sich, und daraus entsteht die Seitenkraft, die das Auto in die Kurve zwingt.",
      "Gemessen wird der Querschlupf meist als Schräglaufwinkel in Grad. Er steigt mit der Querbeschleunigung, bis der Reifen sein Maximum erreicht.",
      "Längs- und Querschlupf teilen sich dieselbe Haftungsreserve: Wer in der Kurve stark bremst oder beschleunigt, hat weniger Seitenkraft zur Verfügung."
    ],
    tipp: "Rutscht das Auto über alle vier Räder gleichmäßig, bist du nah am Limit. Rutscht nur eine Achse deutlich mehr, ist die Balance verschoben.",
    siehe: ["schlupfwinkel", "grip-kreis", "laengsschlupf"] },

  { id: "schlupfwinkel", begriff: "Schräglaufwinkel", englisch: "Slip Angle",
    kurz: "Winkel zwischen der Richtung, in die das Rad zeigt, und der, in die es tatsächlich rollt.",
    text: [
      "Ein Reifen erzeugt Seitenkraft, indem er mit einem kleinen Winkel zur tatsächlichen Bewegungsrichtung läuft. Bei Rennreifen liegt dieser Winkel im Grenzbereich meist bei wenigen Grad.",
      "Die Seitenkraft steigt mit dem Schräglaufwinkel zunächst steil an, flacht dann ab und erreicht bei einem bestimmten Winkel ihr Maximum. Danach rutscht der Reifen, und die Kraft fällt wieder.",
      "Untersteuern und Übersteuern lassen sich darüber erklären: Haben die Vorderreifen größere Schräglaufwinkel als die hinteren, untersteuert das Auto; ist es umgekehrt, übersteuert es."
    ],
    tipp: "Mehr Lenkeinschlag hilft nur, solange die Vorderreifen ihren besten Schräglaufwinkel noch nicht überschritten haben. Danach kostet jeder zusätzliche Grad nur Reifen.",
    siehe: ["peak-slip-angle", "querschlupf", "untersteuern", "uebersteuern"] },

  { id: "peak-slip-angle", begriff: "Optimaler Schräglaufwinkel", englisch: "Peak Slip Angle",
    kurz: "Der Schräglaufwinkel, bei dem ein Reifen die größte Seitenkraft liefert.",
    text: [
      "Jeder Reifen hat einen Winkel, bei dem er am meisten Seitenkraft erzeugt. Rennslicks erreichen ihn meist früher und schärfer als Straßenreifen, die sanfter ins Rutschen übergehen.",
      "Fährt man genau dort, ist die Kurvengeschwindigkeit maximal. Darüber steigen Rutschen, Wärme und Verschleiß, während die Seitenkraft sinkt. Ein Reifen mit spitzem Maximum ist schnell, aber schwer zu fahren; einer mit breitem Plateau verzeiht mehr.",
      "Viele Telemetrieprogramme zeigen den Schräglaufwinkel oder leiten ihn aus Lenkwinkel und Gierrate ab."
    ],
    tipp: "Übe, das Limit über das Lenkgefühl zu spüren: Wird die Lenkung leichter, obwohl du weiter einlenkst, hast du den optimalen Winkel überschritten.",
    siehe: ["schlupfwinkel", "force-feedback", "grip"] },

  { id: "grip-kreis", begriff: "Kammscher Kreis", englisch: "Friction Circle",
    kurz: "Modell dafür, wie sich ein Reifen seine Haftung zwischen Längs- und Querkräften teilt.",
    text: [
      "Der Kammsche Kreis stellt alle Kräfte dar, die ein Reifen übertragen kann – nach vorn, nach hinten und zur Seite. Solange die resultierende Kraft innerhalb des Kreises bleibt, haftet der Reifen.",
      "Daraus folgt: Wer voll bremst, hat keine Reserve für Seitenkräfte; wer am Limit durch die Kurve fährt, kann nicht zusätzlich stark beschleunigen. Schnelle Fahrer nutzen den Rand des Kreises möglichst vollständig, indem sie Bremsen und Lenken fließend überlagern.",
      "In der Realität ist die Fläche eher eine Ellipse, weil Reifen in Längsrichtung oft etwas mehr Kraft übertragen als quer."
    ],
    tipp: "Trage in der Telemetrie Längs- gegen Querbeschleunigung auf. Ein voller, runder Verlauf zeigt, dass du die Reifen gut nutzt; Ecken und Lücken zeigen ungenutztes Potenzial.",
    siehe: ["trail-braking", "grip", "schlupf"] },

  { id: "traktion", begriff: "Traktion", englisch: "Traction",
    kurz: "Fähigkeit, Antriebskraft auf die Fahrbahn zu bringen, ohne dass die Räder durchdrehen.",
    text: [
      "Traktion beschreibt, wie gut ein Auto die Leistung seines Motors in Vortrieb umsetzt. Sie hängt vom Grip der Antriebsräder, von deren Last, vom Differential und von der Dosierung des Gaspedals ab.",
      "Beim Beschleunigen verlagert sich Last auf die Hinterachse – ein Vorteil für hinterradgetriebene Autos. Am Kurvenausgang konkurriert die Antriebskraft jedoch mit der Seitenkraft: Zu viel Gas lässt das Heck ausbrechen.",
      "Traktion ist besonders auf nasser Fahrbahn, mit kalten oder abgefahrenen Reifen und bei hoher Motorleistung die begrenzende Größe."
    ],
    tipp: "Öffne das Gas am Kurvenausgang progressiv und erst, wenn das Lenkrad sich zu öffnen beginnt. Bei schlechter Traktion helfen ein früherer Gangwechsel, ein offeneres Differential auf Zug oder mehr Traktionskontrolle.",
    siehe: ["traktionskontrolle", "diff-zug", "short-shifting", "power-oversteer"] },

  { id: "reifenmischung", begriff: "Reifenmischung", englisch: "Compound",
    kurz: "Die Gummirezeptur eines Reifens, die Grip, Verschleiß und Temperaturfenster bestimmt.",
    text: [
      "Die Mischung legt fest, wie weich und haftfähig das Gummi ist und bei welchen Temperaturen es am besten arbeitet. Weiche Mischungen bieten mehr Grip, erwärmen sich schneller und verschleißen stärker; harte Mischungen halten länger, brauchen aber mehr Temperatur.",
      "Hersteller und Rennserien bieten oft mehrere Mischungen an, aus denen Teams je nach Strecke, Temperatur und Renndistanz wählen. Die Wahl ist ein zentraler Teil der Strategie.",
      "In vielen Simulationen werden die Mischungen mit Farben oder Bezeichnungen wie Soft, Medium und Hard gekennzeichnet."
    ],
    tipp: "Für lange Stints die Mischung so wählen, dass der Reifen das ganze Stint über im Temperaturfenster bleibt – ein überhitzter weicher Reifen ist oft langsamer als ein harter.",
    siehe: ["soft-medium-hard", "arbeitsfenster", "reifenabbau"] },

  { id: "soft-medium-hard", begriff: "Soft, Medium und Hard", englisch: "Soft / Medium / Hard",
    kurz: "Übliche Abstufung von Trockenreifen nach Härte der Mischung.",
    text: [
      "Soft ist die weichste Mischung: sehr viel Grip, kurze Aufwärmzeit, aber hoher Verschleiß. Sie eignet sich für Qualifying und kurze Stints. Medium ist der Kompromiss aus Grip und Haltbarkeit. Hard hält am längsten, braucht aber mehr Temperatur und bietet weniger Spitzengrip.",
      "Welche Mischung schneller ist, hängt von der Stintlänge ab: Über wenige Runden gewinnt meist der weiche Reifen, über viele Runden kann der härtere vorn liegen, weil er weniger nachlässt.",
      "In Rennserien mit Pflichtmischungen entstehen daraus unterschiedliche Strategien, die das Rennen spannend machen."
    ],
    tipp: "Teste im Training mehrere Runden am Stück mit jeder Mischung und vergleiche nicht nur die schnellste, sondern die durchschnittliche Rundenzeit.",
    siehe: ["reifenmischung", "reifenabbau", "undercut"] },

  { id: "slicks", begriff: "Slicks", englisch: "Slicks",
    kurz: "Profillose Trockenreifen mit maximaler Auflagefläche.",
    text: [
      "Slicks haben keine Profilrillen. Die gesamte Lauffläche liegt auf der Fahrbahn auf und bietet auf trockenem Asphalt den größtmöglichen Grip.",
      "Ohne Profil können sie aber kein Wasser verdrängen. Schon bei feuchter Fahrbahn droht Aquaplaning, und der Reifen kühlt so stark ab, dass er kaum noch haftet.",
      "Der Wechsel zwischen Slicks und Regenreifen zum richtigen Zeitpunkt ist eine der spannendsten Entscheidungen im Rennsport."
    ],
    tipp: "Trocknet eine Strecke ab, bilden sich erste trockene Spuren auf der Ideallinie. Sobald du dort mit Regenreifen deutlich schneller wirst als die Reifen es mögen, ist es Zeit für Slicks.",
    siehe: ["intermediates", "regenreifen", "reifenmischung"] },

  { id: "intermediates", begriff: "Intermediates", englisch: "Intermediates",
    kurz: "Reifen für feuchte oder leicht nasse Fahrbahn zwischen Slick und Regenreifen.",
    text: [
      "Intermediates haben ein flaches Profil, das geringe Wassermengen verdrängen kann, und eine Mischung, die bei niedrigeren Temperaturen arbeitet als Slicks.",
      "Sie sind ideal für abtrocknende Strecken oder leichten Regen. Auf trockener Fahrbahn überhitzen sie schnell und verschleißen stark; bei viel Wasser schwimmen sie auf.",
      "Nicht jede Rennserie und jede Simulation bietet Intermediates an; in vielen GT-Serien gibt es nur Slicks und Regenreifen."
    ],
    tipp: "Kühle Intermediates auf abtrocknender Strecke, indem du auf den Geraden durch nasse Stellen neben der Ideallinie fährst.",
    siehe: ["slicks", "regenreifen", "arbeitsfenster"] },

  { id: "regenreifen", begriff: "Regenreifen", englisch: "Wets / Rain Tyres",
    kurz: "Reifen mit tiefem Profil für nasse Fahrbahn.",
    text: [
      "Regenreifen haben tiefe Rillen, die große Wassermengen verdrängen und Aquaplaning verhindern. Ihre weiche Mischung arbeitet bei niedrigen Temperaturen, wie sie auf nasser Strecke herrschen.",
      "Auf trockener oder abtrocknender Fahrbahn überhitzen sie sehr schnell: Die Profilblöcke bewegen sich stark, das Gummi wird weich und zerfällt.",
      "Im Regen ändert sich zudem die Ideallinie: Abseits der gummierten Linie bietet der Asphalt oft mehr Grip."
    ],
    tipp: "Fahre im Regen nicht stur die trockene Ideallinie. Suche beim Anbremsen und am Kurvenausgang Bereiche, auf denen sich kein Gummi abgelagert hat.",
    siehe: ["slicks", "intermediates", "ideallinie", "short-shifting"] },

  { id: "reifendruck", begriff: "Reifendruck", englisch: "Tyre Pressure",
    kurz: "Luftdruck im Reifen – beeinflusst Auflagefläche, Grip, Temperatur und Verschleiß.",
    text: [
      "Der Reifendruck bestimmt, wie sich der Reifen unter Last verformt. Zu niedriger Druck lässt die Mitte einsinken, die Flanke arbeitet stark, der Reifen wird schwammig und überhitzt. Zu hoher Druck wölbt die Lauffläche, die Auflagefläche schrumpft, das Auto rutscht.",
      "Entscheidend ist der Druck im warmen Zustand, denn mit der Temperatur steigt der Druck deutlich an. Deshalb stellt man den Kaltdruck so ein, dass der Reifen nach einigen Runden den gewünschten Heißdruck erreicht.",
      "Regen, Außentemperatur, Fahrstil und die Position im Feld – etwa im Windschatten – verändern, wie stark sich der Druck aufbaut."
    ],
    tipp: "Stelle den Druck nach einigen schnellen Runden ein: Liegt der Heißdruck über dem Zielwert, senke den Kaltdruck; liegt er darunter, erhöhe ihn. Prüfe nach jeder Wetteränderung erneut.",
    siehe: ["heissdruck", "kaltdruck", "reifentemperatur", "aufstandsflaeche"] },

  { id: "heissdruck", begriff: "Heißdruck", englisch: "Hot Pressure",
    kurz: "Reifendruck im Betriebszustand nach dem Aufwärmen.",
    text: [
      "Während der Fahrt erwärmt sich die Luft im Reifen, und der Druck steigt – je nach Reifen und Strecke um ein deutliches Stück gegenüber dem Kaltdruck. Dieser Betriebsdruck ist der Wert, der über Grip und Verhalten entscheidet.",
      "Reifenhersteller und Simulationen geben oft einen Zielbereich für den Heißdruck vor. Liegt man darin, arbeitet die Lauffläche gleichmäßig und der Grip ist optimal.",
      "Weil der Heißdruck von der Fahrweise abhängt, kann er sich im Rennen verändern, etwa bei Verkehr, im Windschatten oder bei nachlassender Pace."
    ],
    tipp: "Miss den Heißdruck nach einer vollständigen schnellen Runde, nicht direkt nach der Out-Lap. Im Rennen mit viel Verkehr baut er sich oft höher auf als im Training.",
    siehe: ["reifendruck", "kaltdruck", "arbeitsfenster"] },

  { id: "kaltdruck", begriff: "Kaltdruck", englisch: "Cold Pressure",
    kurz: "Reifendruck vor der Fahrt, mit dem das Team den Heißdruck steuert.",
    text: [
      "Der Kaltdruck ist der Wert, den man in der Box oder im Setup einstellt. Er ist nur Mittel zum Zweck: Er wird so gewählt, dass der Reifen im Betrieb den gewünschten Heißdruck erreicht.",
      "Wie stark der Druck steigt, hängt von Außentemperatur, Streckentemperatur, Fahrzeug und Fahrweise ab. Deshalb ändern Teams den Kaltdruck je nach Session und Wetter.",
      "Reifen, die vorgeheizt in Heizdecken stecken, starten mit höherem Ausgangsdruck – ihre Einstellung folgt eigenen Regeln."
    ],
    tipp: "Notiere dir für jede Strecke, wie viel der Druck von kalt auf heiß steigt. So triffst du beim nächsten Mal schneller den richtigen Startwert.",
    siehe: ["reifendruck", "heissdruck", "reifenheizdecken"] },

  { id: "reifentemperatur", begriff: "Reifentemperatur", englisch: "Tyre Temperature",
    kurz: "Temperatur der Reifenoberfläche und des Reifeninneren – entscheidend für den Grip.",
    text: [
      "Rennreifen arbeiten nur in einem bestimmten Temperaturbereich optimal. Zu kalt ist das Gummi hart und haftet kaum, zu heiß wird es schmierig, verliert Grip und verschleißt schnell.",
      "Man unterscheidet die schnell schwankende Oberflächentemperatur und die träge Kerntemperatur. Für die Abstimmung wichtig ist außerdem die Verteilung über die Breite – innen, Mitte und außen.",
      "Reifentemperaturen sind eines der wichtigsten Diagnosewerkzeuge: Sie zeigen, ob Sturz, Druck und Balance passen und ob der Fahrstil die Reifen überfordert."
    ],
    tipp: "Lies die Temperaturen direkt nach einer schnellen Runde ab. Ein Reifen, der deutlich heißer ist als die anderen, arbeitet am meisten – oft der Hinweis, wo die Balance kippt.",
    siehe: ["kerntemperatur", "oberflaechentemperatur", "temperaturprofil", "arbeitsfenster"] },

  { id: "kerntemperatur", begriff: "Kerntemperatur", englisch: "Core Temperature",
    kurz: "Temperatur im Inneren des Reifens, die sich nur langsam ändert.",
    text: [
      "Die Kerntemperatur beschreibt die Wärme in der Tiefe des Reifens, also in der Karkasse und unter der Lauffläche. Sie baut sich über mehrere Runden auf und fällt nur langsam ab.",
      "Sie bestimmt, wie steif der Reifen insgesamt ist und wie sich der Druck entwickelt. Ist der Kern zu kalt, fehlt dem Reifen trotz warmer Oberfläche die Stabilität; ist er zu heiß, wird er weich und überhitzt dauerhaft.",
      "Viele moderne Simulationen berechnen Kern- und Oberflächentemperatur getrennt."
    ],
    tipp: "Ist die Kerntemperatur einmal zu hoch, helfen nur einige ruhigere Runden. Fahre deshalb in den ersten Runden eines Stints kontrolliert, statt die Reifen zu überfordern.",
    siehe: ["oberflaechentemperatur", "karkassentemperatur", "reifentemperatur"] },

  { id: "oberflaechentemperatur", begriff: "Oberflächentemperatur", englisch: "Surface Temperature",
    kurz: "Temperatur der Lauffläche, die sich in Sekunden ändert.",
    text: [
      "Die Oberfläche eines Reifens erwärmt sich in jeder Kurve und beim Bremsen schlagartig und kühlt auf der Geraden wieder ab. Sie bestimmt den Grip im Moment.",
      "Zu hohe Oberflächentemperaturen entstehen durch starkes Rutschen, etwa bei Untersteuern oder durchdrehenden Rädern. Sie führen zu Gripverlust und auf Dauer zu Graining oder Blasenbildung.",
      "Eine sehr kalte Oberfläche – etwa nach einer langen Safety-Car-Phase – ist ein häufiger Grund für Ausrutscher beim Neustart."
    ],
    tipp: "Fahre nach Neustarts und auf der Out-Lap aktiv Wärme in die Reifen, mit kräftigem, aber geradem Bremsen und Beschleunigen statt wildem Schlängeln.",
    siehe: ["kerntemperatur", "reifen-warmup", "graining"] },

  { id: "karkassentemperatur", begriff: "Karkassentemperatur", englisch: "Carcass Temperature",
    kurz: "Temperatur des Reifenunterbaus, der dem Reifen seine Form gibt.",
    text: [
      "Die Karkasse ist das Gerüst aus Gewebe- und Stahlcorden unter der Lauffläche. Ihre Temperatur beeinflusst die Steifigkeit des gesamten Reifens und damit, wie er Kräfte aufbaut.",
      "Eine zu heiße Karkasse macht den Reifen weich und schwammig; das Auto reagiert verzögert. Eine zu kalte macht ihn steif und spitz.",
      "In Simulationen wird sie teils als eigener Wert angezeigt, teils in der Kerntemperatur zusammengefasst."
    ],
    tipp: "Wird das Auto im Verlauf eines Stints träge und ungenau, obwohl die Oberfläche passt, kann die Karkasse überhitzt sein – etwas weniger Druck oder sanftere Lenkbewegungen helfen.",
    siehe: ["karkasse", "kerntemperatur", "reifendruck"] },

  { id: "temperaturprofil", begriff: "Temperaturverteilung innen, Mitte, außen", englisch: "Inner / Middle / Outer Temperature",
    kurz: "Temperaturen an drei Stellen der Lauffläche – Grundlage für Sturz- und Druckabstimmung.",
    text: [
      "Misst man die Temperatur an Innenkante, Mitte und Außenkante eines Reifens, lässt sich ablesen, wie er auf der Straße steht. Die Verteilung ist eines der wichtigsten Werkzeuge der Abstimmung.",
      "Ist die Mitte heißer als beide Kanten, ist der Druck zu hoch; sind die Kanten heißer als die Mitte, zu niedrig. Ist die Innenseite deutlich heißer als die Außenseite, ist der negative Sturz zu groß – ist die Außenseite heißer, zu klein.",
      "Als Richtwert gilt bei vielen Rennreifen: innen einige Grad wärmer als außen, die Mitte etwa im Durchschnitt beider Kanten."
    ],
    tipp: "Lies die Werte unmittelbar nach einer schnellen Runde und ändere dann gezielt: Druck für die Mitte, Sturz für die Kanten.",
    siehe: ["sturz", "reifendruck", "reifentemperatur"] },

  { id: "arbeitsfenster", begriff: "Arbeitsfenster", englisch: "Operating Window",
    kurz: "Temperatur- und Druckbereich, in dem ein Reifen seinen besten Grip liefert.",
    text: [
      "Jede Mischung hat ein Fenster, in dem sie optimal arbeitet. Darunter ist sie zu hart, darüber zu weich. Bei manchen Reifen ist dieses Fenster breit und gutmütig, bei anderen sehr schmal.",
      "Das Arbeitsfenster erklärt viele Phänomene: warum ein Auto nach dem Boxenstopp erst einige Kurven braucht, warum es im Verkehr plötzlich rutscht und warum dieselbe Abstimmung an einem kühleren Tag nicht mehr funktioniert.",
      "Ziel jeder Abstimmung und jeder Fahrweise ist es, alle vier Reifen möglichst lange in diesem Fenster zu halten."
    ],
    tipp: "Wenn das Auto zu Beginn eines Stints gut und am Ende schlecht ist, überhitzen die Reifen vermutlich. Ist es umgekehrt, kommen sie zu langsam auf Temperatur.",
    siehe: ["reifentemperatur", "reifenmischung", "reifen-warmup"] },

  { id: "aufstandsflaeche", begriff: "Aufstandsfläche", englisch: "Contact Patch",
    kurz: "Der Teil des Reifens, der tatsächlich die Fahrbahn berührt.",
    text: [
      "Selbst bei breiten Rennreifen ist die Aufstandsfläche nur etwa so groß wie eine Postkarte. Über sie laufen alle Kräfte des Fahrzeugs.",
      "Ihre Größe und Form hängen von Reifendruck, Sturz, Last und Karkasse ab. Ein zu hoher Druck macht sie kleiner und runder, ein zu großer Sturz verlagert sie auf eine Kante.",
      "Unter Seitenkraft verformt sich die Aufstandsfläche zusätzlich – sie ist nie statisch, sondern verändert sich mit jeder Bewegung."
    ],
    tipp: "Alles, was du am Fahrwerk einstellst, dient letztlich einem Ziel: die Aufstandsfläche aller vier Reifen so groß und gleichmäßig wie möglich zu halten.",
    siehe: ["reifendruck", "sturz", "grip"] },

  { id: "karkasse", begriff: "Karkasse", englisch: "Carcass",
    kurz: "Tragendes Gewebe eines Reifens unter der Lauffläche.",
    text: [
      "Die Karkasse besteht aus Lagen von Textil- oder Stahlcorden, die in Gummi eingebettet sind. Sie gibt dem Reifen seine Form und Festigkeit und überträgt die Kräfte zwischen Felge und Lauffläche.",
      "Ihre Steifigkeit bestimmt, wie direkt der Reifen auf Lenkbefehle reagiert und wie stark er sich unter Last verformt. Radialreifen, bei denen die Corde quer zur Laufrichtung verlaufen, sind heute Standard.",
      "Die Karkasse ist auch der Grund, warum der Reifendruck so wichtig ist: Die Luft spannt sie vor und macht sie tragfähig."
    ],
    tipp: "Ein Reifen mit weicher Karkasse reagiert träger – gib dem Auto beim Einlenken einen Moment, bevor du nachlenkst.",
    siehe: ["karkassentemperatur", "seitenwand", "laufflaeche"] },

  { id: "laufflaeche", begriff: "Lauffläche", englisch: "Tread",
    kurz: "Die äußere Gummischicht, die mit der Fahrbahn in Kontakt kommt.",
    text: [
      "Die Lauffläche besteht aus der eigentlichen Reifenmischung. Bei Slicks ist sie glatt, bei Regenreifen mit tiefen Rillen versehen.",
      "Ihre Dicke beeinflusst Grip und Temperaturverhalten: Ein neuer Reifen mit dicker Lauffläche bewegt sich stärker, erwärmt sich im Inneren mehr und kann anfangs schwammig wirken. Abgefahrene Reifen werden direkter, haben aber weniger Haftung.",
      "Über den Stint nimmt die Laufflächendicke durch Verschleiß ab."
    ],
    tipp: "Ein neuer Reifensatz braucht oft eine Runde, bis er sich gesetzt hat. Erwarte die beste Runde nicht in der ersten, sondern in der zweiten oder dritten.",
    siehe: ["verschleiss", "reifenmischung", "karkasse"] },

  { id: "schulter", begriff: "Reifenschulter", englisch: "Shoulder",
    kurz: "Der Übergang zwischen Lauffläche und Seitenwand.",
    text: [
      "Die Schulter ist der Rand der Lauffläche, an dem der Reifen in die Seitenwand übergeht. In Kurven wird die äußere Schulter des kurvenäußeren Reifens besonders stark belastet.",
      "Abnutzungsspuren an den Schultern verraten viel: Stark abgefahrene Außenschultern deuten auf zu wenig negativen Sturz oder zu niedrigen Druck hin; abgefahrene Innenschultern auf zu viel Sturz oder Spur.",
      "Die Schulter ist zudem anfällig für Überhitzung, wenn der Reifen stark rutscht."
    ],
    tipp: "Schau dir bei Gelegenheit das Verschleißbild an: Gleichmäßiger Abrieb über die Breite ist das Ziel.",
    siehe: ["seitenwand", "sturz", "temperaturprofil"] },

  { id: "seitenwand", begriff: "Seitenwand", englisch: "Sidewall",
    kurz: "Flanke des Reifens zwischen Felge und Lauffläche.",
    text: [
      "Die Seitenwand verbindet die Lauffläche mit der Felge. Sie verformt sich unter Seitenkraft und wirkt dabei wie eine zusätzliche Feder im Fahrwerk.",
      "Hohe, weiche Seitenwände machen ein Auto komfortabler, aber träger in der Reaktion. Niedrige, steife Seitenwände – wie bei modernen Rennreifen auf großen Felgen – sorgen für direkte Reaktionen.",
      "Ein Teil des Gripverhaltens beim Einlenken und bei Lastwechseln stammt aus dieser Verformung der Flanke."
    ],
    tipp: "Fahrzeuge mit hohen Reifenflanken reagieren mit Verzögerung. Lenke sie ruhiger und gib ihnen einen Moment Zeit.",
    siehe: ["karkasse", "schulter", "reifendruck"] },

  { id: "reifenabbau", begriff: "Reifenabbau", englisch: "Tyre Degradation (Deg)",
    kurz: "Nachlassender Grip eines Reifens über die Laufzeit eines Stints.",
    text: [
      "Mit jeder Runde verliert ein Reifen etwas Leistung. Gründe sind Verschleiß der Lauffläche, thermische Überlastung und chemische Veränderungen im Gummi. In der Rundenzeit zeigt sich das als schleichendes Langsamerwerden.",
      "Man unterscheidet thermischen Abbau, bei dem der Reifen durch Überhitzung Grip verliert und sich teils wieder erholt, und mechanischen Abbau durch Materialverlust, der dauerhaft ist.",
      "Der Reifenabbau bestimmt die Länge der Stints, die Zahl der Stopps und die Frage, ob sich ein Undercut lohnt."
    ],
    tipp: "Notiere im Training die Rundenzeiten über einen langen Stint. Die Steigung dieser Kurve – Sekunden pro Runde Verlust – ist die wichtigste Zahl für deine Rennstrategie.",
    siehe: ["verschleiss", "undercut", "stint", "arbeitsfenster"] },

  { id: "verschleiss", begriff: "Reifenverschleiß", englisch: "Tyre Wear",
    kurz: "Materialabtrag an der Lauffläche durch Reibung.",
    text: [
      "Bei jeder Kurve, jedem Bremsen und jedem Beschleunigen wird ein wenig Gummi abgetragen. Der Verschleiß hängt von Mischung, Asphalt, Temperatur, Abstimmung und Fahrstil ab.",
      "Starkes Rutschen, blockierende Räder, durchdrehende Reifen und zu viel Spur oder Sturz beschleunigen den Verschleiß erheblich. Ein abgefahrener Reifen hat weniger Grip und ist anfälliger für Beschädigungen.",
      "In vielen Simulationen wird der Verschleiß in Prozent je Reifen angezeigt."
    ],
    tipp: "Ruhige Eingaben schonen die Reifen am stärksten. Wer Untersteuern mit mehr Lenkeinschlag beantwortet, verbraucht vor allem die Vorderreifen.",
    siehe: ["reifenabbau", "graining", "bremsplatte", "spur"] },

  { id: "graining", begriff: "Graining", englisch: "Graining",
    kurz: "Kleine abgerissene Gummikrümel, die sich auf der Lauffläche festsetzen.",
    text: [
      "Rutscht ein Reifen, der noch nicht warm genug ist, reißen kleine Gummiteile ab und kleben wieder auf der Lauffläche fest. Es bildet sich eine raue, körnige Schicht, die den Kontakt zum Asphalt verschlechtert.",
      "Graining tritt vor allem bei kühlen Bedingungen, auf frischem Asphalt und bei starkem Rutschen auf. Der Grip lässt dann über einige Runden deutlich nach.",
      "Oft fahren sich die Krümel nach einiger Zeit wieder ab, und der Reifen erholt sich – wenn man ihn in dieser Phase schont."
    ],
    tipp: "Bemerkst du Graining, fahre einige Runden ruhiger und vermeide Rutschen, bis sich die Lauffläche gereinigt hat.",
    siehe: ["blistering", "oberflaechentemperatur", "reifenabbau"] },

  { id: "blistering", begriff: "Blasenbildung", englisch: "Blistering",
    kurz: "Blasen im Reifen durch Überhitzung des Gummis unter der Oberfläche.",
    text: [
      "Wird ein Reifen im Inneren zu heiß, können sich Gase im Gummi bilden, die Blasen werfen. Diese platzen auf und reißen Stücke aus der Lauffläche.",
      "Blistering entsteht durch zu hohe Kerntemperaturen – etwa durch zu niedrigen Druck, zu viel Sturz, zu weiche Mischung oder sehr heißes Wetter. Der Reifen verliert dauerhaft Grip.",
      "Anders als Graining erholt sich ein Reifen mit Blasen nicht wieder."
    ],
    tipp: "Treten Blasen auf, hilft im Rennen nur, die Reifen zu schonen. Für das nächste Mal: Druck erhöhen, Sturz reduzieren oder eine härtere Mischung wählen.",
    siehe: ["graining", "kerntemperatur", "reifendruck"] },

  { id: "bremsplatte", begriff: "Bremsplatte", englisch: "Flat Spot",
    kurz: "Abgeflachte Stelle im Reifen nach einem blockierten Rad.",
    text: [
      "Blockiert ein Rad beim Bremsen, rutscht der Reifen an einer Stelle über den Asphalt und reibt dort Material ab. Es entsteht eine flache Stelle.",
      "Bei jeder Umdrehung schlägt diese Stelle auf die Fahrbahn. Das erzeugt Vibrationen, verschlechtert den Grip und kann bei hohen Geschwindigkeiten sogar die Aufhängung belasten.",
      "Schwere Bremsplatten zwingen oft zu einem zusätzlichen Boxenstopp."
    ],
    tipp: "Löse den Bremsdruck sofort ein wenig, wenn ein Rad blockiert. In der Telemetrie siehst du blockierende Räder als plötzlichen Einbruch der Radgeschwindigkeit.",
    siehe: ["blockieren", "abs", "bremsbalance"] },

  { id: "verglasung-reifen", begriff: "Verglasung des Reifens", englisch: "Glazing",
    kurz: "Die Lauffläche wird hart und glatt und verliert Grip.",
    text: [
      "Wird ein Reifen über längere Zeit überhitzt oder läuft er nach einem Hitzezyklus kalt, kann seine Oberfläche verhärten und glänzend werden. Sie bietet dann deutlich weniger Grip.",
      "Verglasung tritt bei Straßen- und seriennahen Reifen häufiger auf als bei reinen Rennslicks. Ein ähnliches Phänomen gibt es bei Bremsbelägen.",
      "Ein verglaster Reifen erholt sich kaum, nur Abrieb legt wieder frisches Gummi frei."
    ],
    tipp: "Vermeide lange Phasen mit starkem Rutschen, gefolgt von abruptem Abkühlen – etwa ausgiebiges Driften vor einer langsamen Runde.",
    siehe: ["arbeitsfenster", "graining", "verglasung-bremsbelaege"] },

  { id: "reifen-warmup", begriff: "Aufwärmen der Reifen", englisch: "Warm-up",
    kurz: "Wie schnell ein Reifen sein Arbeitsfenster erreicht.",
    text: [
      "Kalte Reifen haben wenig Grip. Wie viele Kurven oder Runden ein Reifen braucht, bis er arbeitet, hängt von Mischung, Außentemperatur, Fahrzeug und Fahrweise ab.",
      "Weiche Mischungen erwärmen sich schneller, harte langsamer. Nach Boxenstopps, auf Out-Laps und nach Safety-Car-Phasen ist das Aufwärmen oft entscheidend für Positionen.",
      "Mit Heizdecken vorgewärmte Reifen sind sofort deutlich besser, aber auch sie brauchen einige Kurven bis zum Optimum."
    ],
    tipp: "Erwärme Reifen vor allem durch kräftiges Bremsen und Beschleunigen in gerader Linie. Wildes Schlängeln bringt vor allem Oberflächenwärme, die schnell wieder verfliegt.",
    siehe: ["reifenheizdecken", "outlap", "oberflaechentemperatur"] },

  { id: "reifenheizdecken", begriff: "Reifenheizdecken", englisch: "Tyre Blankets",
    kurz: "Elektrische Decken, die Reifen vor dem Einsatz vorwärmen.",
    text: [
      "Heizdecken bringen Reifen schon in der Box auf eine Temperatur nahe dem Arbeitsfenster. So hat ein Fahrzeug nach dem Boxenstopp sofort mehr Grip.",
      "Ob sie erlaubt sind, regelt jede Serie selbst. Manche verbieten sie aus Kosten- oder Nachhaltigkeitsgründen, andere begrenzen die Temperatur.",
      "In Simulationen wird das Vorwärmen meist automatisch berücksichtigt oder als Starttemperatur des Reifens abgebildet."
    ],
    tipp: "Auch vorgewärmte Reifen kühlen auf dem Weg aus der Box ab. Fahre die ersten Kurven nach dem Stopp mit etwas Reserve.",
    siehe: ["reifen-warmup", "kaltdruck", "boxenstopp"] },

  { id: "gummiabrieb", begriff: "Gummiabrieb", englisch: "Marbles",
    kurz: "Kleine Gummikügelchen neben der Ideallinie, die wie Murmeln wirken.",
    text: [
      "Im Laufe eines Rennens lagern sich abgeriebene Gummiteilchen neben der Ideallinie ab. Sie rollen unter den Reifen wie kleine Kugeln und bieten kaum Grip.",
      "Wer bei einem Überholmanöver oder Ausweichen auf diesen Bereich gerät, rutscht leicht weg. Außerdem bleiben die Kügelchen am Reifen kleben und kosten noch einige Kurven Haftung.",
      "Gegen Rennende ist der Effekt am stärksten, besonders in langsamen Kurven mit viel Rutschen."
    ],
    tipp: "Plane Überholmanöver so, dass du nicht weit außerhalb der Linie bremsen musst – oder bremse dort etwas früher, um den geringeren Grip auszugleichen.",
    siehe: ["streckenentwicklung", "ideallinie", "kampflinie"] },

  { id: "streckenentwicklung", begriff: "Streckenentwicklung", englisch: "Track Evolution",
    kurz: "Zunahme des Grips, während sich Gummi auf der Ideallinie ablagert.",
    text: [
      "Eine frische, saubere Strecke bietet wenig Grip. Mit jeder Runde legen Reifen eine dünne Gummischicht auf der Ideallinie ab, und die Haftung steigt. Die Rundenzeiten werden im Laufe eines Wochenendes schneller.",
      "Regen wäscht dieses Gummi wieder ab, starke Hitze kann die Schicht schmierig machen. Auch die Temperatur der Strecke verändert den Grip deutlich.",
      "Viele Simulationen bilden diese Entwicklung nach, teils mit dynamischer Gummierung und Streckentemperatur."
    ],
    tipp: "Ein Setup, das im ersten Training gut war, kann bei gummierter Strecke zu viel Grip an einer Achse haben. Prüfe die Balance kurz vor dem Rennen erneut.",
    siehe: ["gummiabrieb", "grip", "ideallinie"] },
]);
