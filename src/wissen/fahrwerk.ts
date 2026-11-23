// GSRA – Nachschlagewerk: Fahrwerk & Kinematik
import { kategorie } from "./begriff";

export const FAHRWERK = kategorie("Fahrwerk & Kinematik", [
  { id: "sturz", begriff: "Sturz", englisch: "Camber",
    kurz: "Neigung des Rades gegenüber der Senkrechten, von vorn betrachtet.",
    text: [
      "Steht ein Rad oben weiter innen als unten, spricht man von negativem Sturz; steht es oben weiter außen, von positivem. Rennfahrzeuge fahren fast immer mit negativem Sturz, an der Vorderachse meist stärker als hinten.",
      "Der Grund liegt in der Kurvenfahrt: Die Karosserie neigt sich nach außen, und der kurvenäußere Reifen – der die meiste Last trägt – würde sich ohne negativen Sturz auf seine Außenschulter stellen. Mit dem passenden Sturz steht er unter Seitenkraft möglichst flach auf der Straße und nutzt seine ganze Aufstandsfläche.",
      "Zu viel negativer Sturz hat jedoch einen Preis: Beim Bremsen und Beschleunigen in gerader Linie liegt der Reifen dann nur auf der Innenschulter auf. Die Folge sind längere Bremswege, schlechtere Traktion, eine überhitzte Innenkante und höherer Verschleiß."
    ],
    tipp: "Orientiere dich an den Reifentemperaturen nach einigen schnellen Runden: Die Innenseite darf einige Grad wärmer sein als die Außenseite. Ist sie deutlich heißer, reduziere den Sturz; ist die Außenseite wärmer, erhöhe ihn.",
    siehe: ["temperaturprofil", "spur", "rollzentrum", "aufstandsflaeche"] },

  { id: "spur", begriff: "Spur", englisch: "Toe",
    kurz: "Stellung der Räder einer Achse zueinander, von oben betrachtet.",
    text: [
      "Zeigen die Vorderkanten der Räder zueinander, spricht man von Vorspur; zeigen sie auseinander, von Nachspur. Angegeben wird die Spur in Grad, Minuten oder Millimetern – je Rad oder für die ganze Achse.",
      "Die Spur beeinflusst, wie das Auto auf Lenkbefehle reagiert und wie stabil es geradeaus läuft. Jede Abweichung von der Geradeausstellung bedeutet aber auch, dass die Reifen schon auf der Geraden leicht schräg laufen: Das kostet Höchstgeschwindigkeit, erzeugt Wärme und erhöht den Verschleiß.",
      "An der Vorderachse wird Nachspur häufig für ein direkteres Einlenken genutzt, an der Hinterachse fast immer Vorspur für Stabilität beim Beschleunigen und in schnellen Kurven."
    ],
    tipp: "Ändere die Spur in kleinen Schritten und achte auf Reifentemperaturen und Höchstgeschwindigkeit. Wenig Spur ist auf Strecken mit langen Geraden meist schneller, mehr Spur hilft auf engen, kurvigen Kursen.",
    siehe: ["vorspur", "nachspur", "ackermann", "bump-steer"] },

  { id: "vorspur", begriff: "Vorspur", englisch: "Toe-in",
    kurz: "Die Räder einer Achse zeigen vorn leicht zueinander.",
    text: [
      "Bei Vorspur ist der Abstand zwischen den Vorderkanten der Räder kleiner als zwischen den Hinterkanten. Beide Reifen erzeugen dadurch schon in Geradeausfahrt eine kleine Seitenkraft nach innen, die sich gegenseitig aufhebt – das Auto liegt ruhiger in der Spur.",
      "An der Hinterachse ist Vorspur der Standard: Sie hält das Heck beim Beschleunigen, bei Lastwechseln und in schnellen Kurven stabil, weil die Reifen bereits vorgespannt sind und schneller Seitenkraft aufbauen. An der Vorderachse macht Vorspur das Lenkverhalten träger.",
      "Mehr Vorspur bedeutet aber mehr Rollwiderstand, höhere Reifentemperaturen und etwas weniger Höchstgeschwindigkeit."
    ],
    tipp: "Ist das Heck beim Herausbeschleunigen nervös, kann etwas mehr Vorspur hinten helfen. Wirkt das Auto insgesamt träge und die Hinterreifen überhitzen, nimm Vorspur heraus.",
    siehe: ["spur", "nachspur", "power-oversteer"] },

  { id: "nachspur", begriff: "Nachspur", englisch: "Toe-out",
    kurz: "Die Räder einer Achse zeigen vorn leicht auseinander.",
    text: [
      "Bei Nachspur ist der Abstand zwischen den Vorderkanten der Räder größer als zwischen den Hinterkanten. An der Vorderachse sorgt das für ein spontaneres Einlenken: Das kurveninnere Rad ist bereits etwas stärker eingeschlagen und baut sofort Seitenkraft auf.",
      "Der Preis ist ein unruhigerer Geradeauslauf. Das Auto reagiert empfindlicher auf Bodenwellen und kleine Lenkbewegungen, besonders beim Anbremsen. An der Hinterachse ist Nachspur sehr ungewöhnlich, weil sie das Heck instabil macht.",
      "Wie Vorspur erzeugt auch Nachspur zusätzlichen Reifenverschleiß und Wärme, besonders an den Innenkanten der Vorderreifen."
    ],
    tipp: "Ein wenig Nachspur vorn ist eine bewährte Maßnahme gegen Untersteuern beim Einlenken. Wird das Auto auf der Bremse unruhig, war es zu viel.",
    siehe: ["spur", "vorspur", "untersteuern", "ackermann"] },

  { id: "nachlauf", begriff: "Nachlauf", englisch: "Caster",
    kurz: "Neigung der Lenkachse nach hinten, von der Seite betrachtet.",
    text: [
      "Die gedachte Achse, um die sich ein Vorderrad beim Lenken dreht, steht nicht senkrecht, sondern ist oben nach hinten geneigt. Dadurch liegt der Aufstandspunkt des Reifens hinter dem Punkt, an dem die Lenkachse die Fahrbahn trifft – ähnlich wie bei einem Einkaufswagenrad, das sich von selbst in Fahrtrichtung stellt.",
      "Mehr Nachlauf erhöht die Rückstellkräfte in der Lenkung: Das Auto läuft stabiler geradeaus, und das Lenkgefühl wird schwerer und aussagekräftiger. Zugleich erzeugt Nachlauf beim Einlenken zusätzlichen negativen Sturz am kurvenäußeren Rad, was in engen Kurven Grip bringt.",
      "Zu viel Nachlauf macht die Lenkung schwer und kann bei sehr engen Kehren das kurveninnere Rad stark entlasten."
    ],
    tipp: "Im Simracing spürst du Nachlauf direkt im Force Feedback. Fühlt sich die Lenkung leer an oder fehlt Rückmeldung vom Grip-Limit, kann mehr Nachlauf helfen – sofern das Setup es erlaubt.",
    siehe: ["spreizung", "sturz", "force-feedback"] },

  { id: "spreizung", begriff: "Spreizung", englisch: "Kingpin Inclination / SAI",
    kurz: "Neigung der Lenkachse nach innen, von vorn betrachtet.",
    text: [
      "Die Lenkachse eines Vorderrads ist nicht nur nach hinten (Nachlauf), sondern meist auch nach innen geneigt. Diese Spreizung bestimmt gemeinsam mit der Radposition den Lenkrollradius – den Abstand, um den der Reifen beim Lenken um die Lenkachse kreist.",
      "Durch die Spreizung hebt sich das Fahrzeug beim Einschlagen minimal an. Die Gewichtskraft drückt die Räder deshalb in die Geradeausstellung zurück; das sorgt besonders bei langsamer Fahrt für Rückstellkräfte. Außerdem verändert sie beim Lenken den Sturz – am kurvenäußeren Rad in Richtung positiv, also entgegen der Wirkung des Nachlaufs.",
      "In den meisten Simulationen ist die Spreizung fest vorgegeben, weil sie von der Konstruktion des Achsschenkels abhängt. Sie erklärt aber, warum sich Lenkung und Sturz bei großen Lenkwinkeln anders verhalten als geradeaus."
    ],
    tipp: "Verstellen lässt sich die Spreizung im Setup selten. Wichtig ist das Verständnis: In sehr engen Kehren verliert das Vorderrad durch Spreizung Sturz – dort hilft eher mehr Nachlauf.",
    siehe: ["nachlauf", "achsschenkel", "sturz"] },

  { id: "ackermann", begriff: "Ackermann-Geometrie", englisch: "Ackermann Steering",
    kurz: "Das kurveninnere Vorderrad schlägt stärker ein als das äußere.",
    text: [
      "Fährt ein Auto langsam durch eine Kurve, beschreibt das innere Vorderrad einen engeren Kreis als das äußere. Damit beide Räder ohne Radieren abrollen, muss das innere stärker eingeschlagen sein – das ist die klassische Ackermann-Geometrie, benannt nach dem Patentinhaber des Prinzips.",
      "Im Rennsport ist die Lage komplizierter: Bei hoher Querbeschleunigung laufen alle Reifen mit Schräglaufwinkel, und das kurvenäußere Rad trägt den größten Teil der Last. Viele Rennfahrzeuge nutzen deshalb weniger Ackermann (parallele Lenkung) oder sogar Anti-Ackermann, damit das äußere Rad in seinem optimalen Schräglaufwinkel arbeitet.",
      "Mehr Ackermann hilft in engen, langsamen Kurven beim Einlenken und schont die Reifen; weniger Ackermann kann in schnellen Kurven Grip bringen, das innere Rad aber zum Radieren bringen."
    ],
    tipp: "Wenn dein Setup einen Ackermann-Wert anbietet: Für enge Stadtkurse eher mehr, für schnelle Strecken eher weniger. Überhitzt der kurveninnere Vorderreifen, ist meist zu viel Ackermann im Spiel.",
    siehe: ["spur", "schlupfwinkel", "spurstange"] },

  { id: "federrate", begriff: "Federrate", englisch: "Spring Rate",
    kurz: "Die Kraft, die eine Feder je Millimeter Einfederung aufbaut.",
    text: [
      "Die Federrate wird meist in Newton pro Millimeter (N/mm) oder in Pfund pro Zoll (lbs/in) angegeben. Eine Feder mit 150 N/mm benötigt also 150 Newton zusätzliche Kraft für jeden weiteren Millimeter Weg. Harte Federn bewegen sich bei gleicher Last weniger als weiche.",
      "Entscheidend ist nicht allein die Feder, sondern die Radrate – die Steifigkeit am Rad. Sie hängt vom Übersetzungsverhältnis der Aufhängung ab: Ist die Feder über einen Hebel oder eine Umlenkung angebunden, wirkt sie am Rad weicher oder härter.",
      "Härtere Federn halten das Fahrzeug flacher, reduzieren Nicken und Wanken und stabilisieren die Aerodynamik. Weichere Federn verbessern die mechanische Haftung auf unebenem Belag, weil der Reifen besser am Boden bleibt."
    ],
    tipp: "Die Balance zwischen vorn und hinten ist oft wichtiger als die absolute Härte: Härtere Federn vorn fördern Untersteuern, härtere Federn hinten Übersteuern – ähnlich wie bei den Stabilisatoren.",
    siehe: ["federvorspannung", "stabilisator", "heave-feder", "mechanischer-grip"] },

  { id: "federvorspannung", begriff: "Federvorspannung", englisch: "Spring Preload",
    kurz: "Zusammendrücken der Feder schon im Stand, ohne die Federrate zu ändern.",
    text: [
      "Bei der Vorspannung wird der Federteller verschoben, sodass die Feder bereits eingebaut unter Spannung steht. Die Federrate ändert sich dadurch nicht – eine Feder mit 150 N/mm bleibt eine Feder mit 150 N/mm.",
      "Was sich ändert, ist der Punkt, ab dem die Feder nachgibt, und bei vielen Konstruktionen die Fahrzeughöhe. Bei Fahrwerken mit Gewinde wird über die Vorspannung oder die Federtellerposition auch die Radlastverteilung eingestellt.",
      "In Simulationen findest du die Vorspannung häufig als Einstellung für die Fahrzeughöhe oder bei Federn, die mit einem Spalt verbaut sind und erst nach einigen Millimetern greifen."
    ],
    tipp: "Ändere Vorspannung und Höhe nie ohne Blick auf die Radlasten: Schon wenige Millimeter an einer Ecke verschieben das Gewicht diagonal durch das ganze Auto.",
    siehe: ["federrate", "fahrzeughoehe", "radlasten", "cross-weight"] },

  { id: "daempfer", begriff: "Dämpfer", englisch: "Damper / Shock Absorber",
    kurz: "Bremst die Bewegung der Feder und bestimmt, wie schnell sich das Fahrwerk bewegt.",
    text: [
      "Eine Feder allein würde nach jeder Bodenwelle weiter schwingen. Der Dämpfer wandelt diese Bewegungsenergie in Wärme um, indem er Öl durch Ventile und Bohrungen presst. Er bestimmt nicht, wie weit, sondern wie schnell sich das Fahrwerk bewegt.",
      "Man unterscheidet die Druckstufe (Einfedern) und die Zugstufe (Ausfedern), bei hochwertigen Dämpfern jeweils getrennt nach niedriger und hoher Kolbengeschwindigkeit. Die langsamen Bewegungen stammen vor allem aus Bremsen, Beschleunigen und Einlenken, die schnellen aus Bodenwellen und Randsteinen.",
      "Dämpfer sind damit das wichtigste Werkzeug, um das Übergangsverhalten zu formen: wie das Auto beim Einlenken reagiert, wie schnell sich die Last verlagert und wie ruhig es über Unebenheiten fährt."
    ],
    tipp: "Stimme zuerst Federn und Stabilisatoren für das Verhalten in der Kurvenmitte ab, danach die Dämpfer für Einlenken und Herausbeschleunigen. Ändere immer nur eine Stufe auf einmal.",
    siehe: ["zugstufe", "druckstufe", "low-speed-druckstufe", "high-speed-druckstufe"] },

  { id: "zugstufe", begriff: "Zugstufe", englisch: "Rebound",
    kurz: "Dämpfung beim Ausfedern – wie schnell sich ein Rad wieder streckt.",
    text: [
      "Die Zugstufe bremst die Bewegung, wenn sich die Feder nach dem Einfedern wieder ausdehnt. Eine harte Zugstufe lässt ein entlastetes Rad nur langsam ausfedern; eine weiche lässt es schnell zurückkommen.",
      "Im Fahrverhalten wirkt die Zugstufe vor allem auf der entlasteten Seite: Beim Anbremsen federt das Heck aus, beim Beschleunigen die Front, in Kurven die Innenseite. Eine härtere Zugstufe hält diese Ecke länger unten und verzögert damit die Lastverlagerung.",
      "Zu viel Zugstufe kann dazu führen, dass ein Rad nach einer Bodenwelle nicht schnell genug zurückkommt und kurz den Kontakt verliert – im Fachjargon spricht man vom Herunterziehen (Jacking down) des Fahrzeugs über mehrere Bodenwellen."
    ],
    tipp: "Ist das Heck beim Anbremsen unruhig, kann mehr Zugstufe hinten helfen, weil das Heck langsamer hochkommt. Springt das Auto nach Randsteinen nach, ist die Zugstufe meist zu weich.",
    siehe: ["daempfer", "druckstufe", "low-speed-zugstufe", "high-speed-zugstufe"] },

  { id: "druckstufe", begriff: "Druckstufe", englisch: "Bump / Compression",
    kurz: "Dämpfung beim Einfedern – wie schnell ein Rad in den Radkasten geht.",
    text: [
      "Die Druckstufe bremst die Bewegung, wenn das Rad einfedert, etwa beim Überfahren einer Kuppe, beim Anbremsen an der Vorderachse oder am kurvenäußeren Rad.",
      "Eine harte Druckstufe macht das Fahrzeug reaktionsschneller, weil die Last schneller auf das belastete Rad kommt. Auf unebenem Belag überträgt sie aber Stöße direkter auf das Chassis, und der Reifen kann springen. Eine weiche Druckstufe schluckt Unebenheiten besser, lässt das Auto aber stärker eintauchen.",
      "Wie die Zugstufe wird sie bei Rennfahrwerken oft getrennt für langsame und schnelle Kolbengeschwindigkeiten eingestellt."
    ],
    tipp: "Untersteuert das Auto beim Einlenken, kann eine weichere Druckstufe vorn oder eine härtere hinten helfen. Für Strecken mit vielen Randsteinen zuerst die schnelle Druckstufe weicher stellen.",
    siehe: ["daempfer", "zugstufe", "low-speed-druckstufe", "high-speed-druckstufe"] },

  { id: "low-speed-zugstufe", begriff: "Low-Speed-Zugstufe", englisch: "Low-Speed Rebound",
    kurz: "Zugstufe für langsame Fahrwerksbewegungen wie Nicken und Wanken.",
    text: [
      "„Low Speed“ meint nicht die Fahrgeschwindigkeit, sondern die Geschwindigkeit des Dämpferkolbens – grob gesagt unter etwa 25 bis 50 Millimetern pro Sekunde. In diesem Bereich liegen die Karosseriebewegungen durch Bremsen, Beschleunigen und Einlenken.",
      "Die langsame Zugstufe bestimmt, wie schnell sich die entlastete Seite wieder anhebt. Härter eingestellt hält sie das Auto beim Lastwechsel länger in seiner Lage: Beim Anbremsen bleibt das Heck tiefer, beim Herausbeschleunigen die Front.",
      "Weil sie das Übergangsverhalten so direkt formt, ist sie eine der wirkungsvollsten Einstellungen für die Balance beim Ein- und Ausgang einer Kurve."
    ],
    tipp: "Mehr langsame Zugstufe vorn kann beim Herausbeschleunigen die Front unten und damit lenkfähig halten. Übertreibe es nicht – sonst wird das Auto über Bodenwellen hart und nervös.",
    siehe: ["zugstufe", "low-speed-druckstufe", "gewichtsverlagerung"] },

  { id: "high-speed-zugstufe", begriff: "High-Speed-Zugstufe", englisch: "High-Speed Rebound",
    kurz: "Zugstufe für schnelle Bewegungen nach Bodenwellen und Randsteinen.",
    text: [
      "Bei hohen Kolbengeschwindigkeiten – etwa wenn ein Rad nach einem Randstein oder einer Bodenwelle schlagartig ausfedert – greift die schnelle Zugstufe.",
      "Sie sorgt dafür, dass das Rad zügig, aber kontrolliert auf die Fahrbahn zurückkehrt. Ist sie zu weich, schwingt das Rad nach; ist sie zu hart, kommt es nicht schnell genug zurück und der Reifen verliert kurz den Kontakt.",
      "In vielen Simulationen ist sie nur bei Prototypen und Formelfahrzeugen getrennt einstellbar; bei GT-Fahrzeugen sind schnelle und langsame Stufen oft zusammengefasst."
    ],
    tipp: "Springt das Auto nach dem Überfahren von Randsteinen mehrfach nach, erhöhe die schnelle Zugstufe leicht. Verliert es danach kurz den Grip, war es zu viel.",
    siehe: ["zugstufe", "high-speed-druckstufe", "curbs"] },

  { id: "low-speed-druckstufe", begriff: "Low-Speed-Druckstufe", englisch: "Low-Speed Bump",
    kurz: "Druckstufe für langsame Bewegungen beim Bremsen, Beschleunigen und Einlenken.",
    text: [
      "Die langsame Druckstufe bestimmt, wie schnell die belastete Seite des Autos einfedert, wenn sich die Last verlagert: die Front beim Bremsen, das Heck beim Beschleunigen und die Außenseite beim Einlenken.",
      "Härter eingestellt kommt die Last schneller auf das belastete Rad – das Auto reagiert direkter. Weicher eingestellt geschieht die Lastverlagerung sanfter, das Auto wirkt gutmütiger, aber träger.",
      "Gemeinsam mit der langsamen Zugstufe der Gegenseite formt sie das Verhalten in Übergängen, etwa beim Wechsel von der Bremse in die Kurve."
    ],
    tipp: "Für ein spontaneres Einlenken die langsame Druckstufe vorn etwas weicher oder hinten etwas härter einstellen. Auf welligen Strecken eher vorsichtig nachhärten.",
    siehe: ["druckstufe", "low-speed-zugstufe", "untersteuern"] },

  { id: "high-speed-druckstufe", begriff: "High-Speed-Druckstufe", englisch: "High-Speed Bump",
    kurz: "Druckstufe für schnelle Stöße durch Bodenwellen und Randsteine.",
    text: [
      "Trifft ein Rad auf eine Kante, einen Randstein oder eine Bodenwelle, bewegt sich der Dämpferkolben sehr schnell. Die schnelle Druckstufe bestimmt, wie viel dieses Stoßes an das Chassis weitergegeben wird.",
      "Weich eingestellt schluckt das Fahrwerk Unebenheiten, der Reifen bleibt am Boden und das Auto bleibt ruhig. Hart eingestellt wird jeder Randstein zum Sprungbrett; bei Fahrzeugen mit viel Abtrieb kann eine härtere Einstellung dagegen helfen, die Bodenfreiheit stabil zu halten.",
      "Gerade auf Strecken mit aggressiven Randsteinen ist sie die erste Einstellung, die man anpasst."
    ],
    tipp: "Wird das Auto über Randsteine ausgehebelt oder springt, stelle die schnelle Druckstufe weicher. Setzt es dafür auf dem Unterboden auf, gleiche mit etwas mehr Fahrzeughöhe aus.",
    siehe: ["druckstufe", "high-speed-zugstufe", "curbs", "durchschlagen"] },

  { id: "stabilisator", begriff: "Stabilisator", englisch: "Anti-Roll Bar (ARB)",
    kurz: "Torsionsstab, der die Räder einer Achse verbindet und das Wanken begrenzt.",
    text: [
      "Der Stabilisator ist eine Feder, die nur wirkt, wenn sich die beiden Räder einer Achse unterschiedlich bewegen – also beim Wanken in der Kurve. Federn beide Räder gleichzeitig ein, etwa beim Bremsen, bleibt er wirkungslos.",
      "Ein härterer Stabilisator reduziert die Neigung der Karosserie, verlagert aber mehr Last auf das kurvenäußere Rad dieser Achse. Weil ein Reifen mit wachsender Last nicht proportional mehr Grip liefert, verliert diese Achse insgesamt an Haftung.",
      "Daraus ergibt sich die wichtigste Regel der Abstimmung: Ein härterer Stabilisator vorn fördert Untersteuern, ein härterer Stabilisator hinten fördert Übersteuern. Der Stabilisator ist deshalb das Standardwerkzeug, um die Balance in der Kurvenmitte einzustellen."
    ],
    tipp: "Untersteuert das Auto in der Kurvenmitte, mache den vorderen Stabilisator weicher oder den hinteren härter – immer nur eine Stufe, dann erneut testen.",
    siehe: ["schwert-stabilisator", "untersteuern", "uebersteuern", "gewichtsverlagerung"] },

  { id: "schwert-stabilisator", begriff: "Schwert-Stabilisator", englisch: "Blade Anti-Roll Bar",
    kurz: "Stabilisator mit flachen Hebeln, dessen Härte durch Drehen der Klinge verstellt wird.",
    text: [
      "Bei einem Schwert-Stabilisator sind die Hebelarme flache Klingen (englisch Blades). Stehen sie hochkant, sind sie in Belastungsrichtung sehr steif; liegen sie flach, biegen sie sich leicht durch. Dazwischen lässt sich die Härte stufenlos oder in Rastern verstellen.",
      "Der große Vorteil: Die Verstellung ist schnell und präzise – bei vielen Rennfahrzeugen sogar während der Fahrt über einen Hebel im Cockpit. So kann der Fahrer die Balance an nachlassende Reifen oder ein leichter werdendes Auto anpassen.",
      "In Simulationen erscheint die Einstellung oft als Position des Schwerts oder als Stufe des Stabilisators, teilweise getrennt für Stabilisator-Durchmesser und Schwertstellung."
    ],
    tipp: "Wenn dein Fahrzeug die Verstellung im Cockpit erlaubt, nutze sie im Langstreckenrennen: Mit leerem Tank und älteren Reifen ändert sich die Balance – ein Klick am Schwert gleicht das oft aus.",
    siehe: ["stabilisator", "reifenabbau", "stint"] },

  { id: "fahrzeughoehe", begriff: "Bodenfreiheit", englisch: "Ride Height",
    kurz: "Abstand zwischen Unterboden und Fahrbahn, meist vorn und hinten getrennt eingestellt.",
    text: [
      "Die Bodenfreiheit bestimmt, wie tief das Auto liegt. Je tiefer, desto niedriger der Schwerpunkt und desto weniger Gewichtsverlagerung – und bei Fahrzeugen mit Unterbodenaerodynamik desto mehr Abtrieb.",
      "Die Grenze setzt der Kontakt mit der Fahrbahn: Setzt der Unterboden auf, bricht der Abtrieb ein, das Auto wird unruhig und kann bei manchen Fahrzeugen Bauteile beschädigen. Gerade bei hoher Geschwindigkeit drückt der Abtrieb das Auto zusätzlich nach unten.",
      "Das Verhältnis von vorderer zu hinterer Höhe – die Keilform oder Rake – verschiebt außerdem die aerodynamische Balance."
    ],
    tipp: "Senke das Auto schrittweise ab, bis es in den schnellsten Kurven oder auf den holprigsten Abschnitten leicht aufsetzt, und gib dann einige Millimeter zurück. Telemetrie mit Fahrzeughöhe hilft enorm.",
    siehe: ["rake", "durchschlagen", "bodeneffekt", "schwerpunkt"] },

  { id: "rake", begriff: "Keilform", englisch: "Rake",
    kurz: "Höhenunterschied zwischen Front und Heck – das Heck steht meist höher.",
    text: [
      "Steht das Heck höher als die Front, spricht man von positivem Rake. Der Unterboden bildet dann zusammen mit dem Diffusor eine Art Trichter, der die Luft unter dem Auto beschleunigt und mehr Abtrieb erzeugt.",
      "Zugleich verschiebt sich der aerodynamische Druckpunkt nach vorn: Mehr Rake bedeutet mehr Frontgrip in schnellen Kurven, aber ein leichteres, nervöseres Heck. Weniger Rake beruhigt das Heck, kostet aber Abtrieb vorn.",
      "Weil das Auto beim Bremsen vorn eintaucht und beim Beschleunigen hinten einfedert, ändert sich der Rake ständig. Gute Setups halten diese Änderungen klein, damit die Balance berechenbar bleibt."
    ],
    tipp: "Mehr Heckhöhe ist ein schneller Hebel gegen Untersteuern in schnellen Kurven. Wird das Auto beim Anbremsen aus hoher Geschwindigkeit instabil, nimm Rake heraus.",
    siehe: ["fahrzeughoehe", "aero-balance", "diffusor", "druckpunkt"] },

  { id: "durchschlagen", begriff: "Durchschlagen", englisch: "Bottoming",
    kurz: "Das Fahrwerk ist am Ende seines Wegs oder der Unterboden berührt die Fahrbahn.",
    text: [
      "Durchschlagen bedeutet, dass das Fahrwerk keinen Federweg mehr hat: Entweder läuft der Dämpfer auf den Anschlag, oder das Chassis – meist der Unterboden oder die Bodenplatte – schlägt auf die Fahrbahn.",
      "In beiden Fällen steigt die Steifigkeit schlagartig an. Der Reifen bekommt plötzlich viel mehr Last und verliert dann Grip, das Auto springt oder versetzt. Setzt der Unterboden auf, reißt zudem der Abtrieb ab.",
      "Typische Stellen sind Senken am Ende von Geraden, schnelle Kompressionen und harte Randsteine."
    ],
    tipp: "Prüfe in der Telemetrie die minimale Fahrzeughöhe und den Federweg. Schlägt das Auto nur an einer Stelle durch, helfen oft eine härtere Feder, mehr Packer oder einige Millimeter mehr Höhe.",
    siehe: ["anschlagpuffer", "fahrzeughoehe", "senke", "high-speed-druckstufe"] },

  { id: "anschlagpuffer", begriff: "Packer und Anschlagpuffer", englisch: "Packers / Bump Stops",
    kurz: "Begrenzen den Federweg und wirken als zusätzliche, sehr harte Feder.",
    text: [
      "Packer sind Distanzscheiben auf der Kolbenstange des Dämpfers. Mit ihnen wird festgelegt, nach wie vielen Millimetern Einfederung der Anschlagpuffer – ein Gummi- oder Elastomerelement – berührt wird.",
      "Ab diesem Punkt wirkt die Puffer-Steifigkeit zusätzlich zur Feder, die Gesamtsteifigkeit steigt stark an. Fahrzeuge mit viel Abtrieb nutzen das gezielt: Bei hoher Geschwindigkeit liegt das Auto auf den Puffern und hält eine stabile, niedrige Höhe, während es bei langsamer Fahrt weich bleibt.",
      "Der Übergang muss aber gut abgestimmt sein, sonst springt die Balance, sobald die Puffer greifen."
    ],
    tipp: "Mehr Packer vorn begrenzt das Eintauchen beim Bremsen und hält die Aero-Plattform stabil. Wird das Auto in schnellen Kurven plötzlich untersteuernd, greifen die Puffer möglicherweise zu früh.",
    siehe: ["durchschlagen", "fahrzeughoehe", "heave-feder"] },

  { id: "rollzentrum", begriff: "Rollzentrum", englisch: "Roll Center",
    kurz: "Gedachter Punkt, um den sich die Karosserie einer Achse beim Wanken dreht.",
    text: [
      "Das Rollzentrum ergibt sich aus der Geometrie der Aufhängung, von vorn betrachtet. Über diesen Punkt werden die Seitenkräfte der Reifen auf die Karosserie übertragen.",
      "Entscheidend ist der Abstand zwischen Rollzentrum und Schwerpunkt: Je größer er ist, desto stärker neigt sich das Auto bei gleicher Querbeschleunigung. Ein hohes Rollzentrum reduziert das Wanken, überträgt aber mehr Last direkt über die Lenker und kann das Auto anheben (Jacking).",
      "Weil sich das Rollzentrum beim Ein- und Ausfedern verschiebt, verändert ein Absenken des Autos oft auch das Wankverhalten – ein Grund, warum Höhenänderungen mehr bewirken als nur aerodynamische Effekte."
    ],
    tipp: "Direkt einstellbar ist das Rollzentrum nur bei wenigen Fahrzeugen. Merke dir aber: Senkst du eine Achse stark ab, kann sich ihr Wankverhalten spürbar verändern.",
    siehe: ["wankachse", "anti-roll", "schwerpunkt", "querlenker"] },

  { id: "wankachse", begriff: "Wankachse", englisch: "Roll Axis",
    kurz: "Linie zwischen vorderem und hinterem Rollzentrum, um die sich das Auto neigt.",
    text: [
      "Verbindet man die Rollzentren beider Achsen, erhält man die Wankachse. Um sie dreht sich die Karosserie, wenn das Auto in der Kurve wankt.",
      "Ihre Neigung beeinflusst die Lastverteilung zwischen vorn und hinten: Liegt das vordere Rollzentrum tiefer als das hintere, wankt die Front stärker, und die Vorderachse übernimmt anteilig mehr Lastverschiebung über Federn und Stabilisatoren.",
      "Für das Verständnis von Setups ist die Wankachse wichtig, weil Federn, Stabilisatoren und Geometrie zusammenwirken: Dieselbe Stabilisatoränderung wirkt bei unterschiedlicher Wankachse unterschiedlich stark."
    ],
    tipp: "Du stellst die Wankachse nicht direkt ein, sondern über Fahrzeughöhen und Geometrie. Beobachte deshalb, ob sich die Balance nach Höhenänderungen verschiebt – das ist oft dieser Effekt.",
    siehe: ["rollzentrum", "nickachse", "stabilisator"] },

  { id: "nickachse", begriff: "Nickachse", englisch: "Pitch Axis",
    kurz: "Querachse, um die sich das Auto beim Bremsen und Beschleunigen neigt.",
    text: [
      "Beim Bremsen taucht die Front ein und das Heck hebt sich, beim Beschleunigen ist es umgekehrt. Diese Drehbewegung heißt Nicken; die gedachte Achse, um die sie stattfindet, ist die Nickachse.",
      "Wie stark ein Auto nickt, hängt von Federn, Dämpfern und der Fahrwerksgeometrie ab – insbesondere von Anti-Dive und Anti-Squat. Bei Fahrzeugen mit viel Unterbodenaerodynamik ist Nicken besonders kritisch, weil sich mit dem Rake auch der Abtrieb und die Balance verschieben.",
      "Ein Auto, das stark nickt, wirkt beim Anbremsen und Herausbeschleunigen weniger berechenbar."
    ],
    tipp: "Wird die Balance beim Anbremsen schlagartig anders, lohnt ein Blick auf die Fahrzeughöhen beim Bremsen in der Telemetrie – oft ist zu starkes Nicken die Ursache.",
    siehe: ["anti-dive", "anti-squat", "rake", "hubachse"] },

  { id: "hubachse", begriff: "Hubbewegung", englisch: "Heave",
    kurz: "Das ganze Auto bewegt sich gleichmäßig nach oben oder unten.",
    text: [
      "Neben Wanken (seitliche Neigung) und Nicken (Neigung nach vorn oder hinten) gibt es eine dritte Grundbewegung: das Heben und Senken des ganzen Fahrzeugs, englisch Heave. Sie entsteht vor allem durch Abtrieb bei hoher Geschwindigkeit, durch Kuppen und Senken.",
      "Für Fahrzeuge mit viel Unterbodenaerodynamik ist die Hubbewegung entscheidend: Bei 250 km/h drückt der Abtrieb das Auto um viele Millimeter nach unten. Ohne Gegenmaßnahme würde es aufsetzen.",
      "Deshalb besitzen Prototypen und Formelfahrzeuge oft eine eigene Feder nur für diese Bewegung – die Heave-Feder."
    ],
    tipp: "Setzt das Auto nur auf langen Geraden oder in sehr schnellen Kurven auf, ist meist die Hubsteifigkeit zu gering – nicht die Wanksteifigkeit.",
    siehe: ["heave-feder", "abtrieb", "fahrzeughoehe"] },

  { id: "heave-feder", begriff: "Heave-Feder", englisch: "Heave Spring / Third Spring",
    kurz: "Zusätzliche Feder, die nur beim gleichmäßigen Einfedern beider Räder einer Achse wirkt.",
    text: [
      "Die Heave- oder dritte Feder sitzt mittig zwischen den Rädern einer Achse. Sie wird nur zusammengedrückt, wenn beide Räder gleichzeitig einfedern – etwa unter Abtrieb oder beim Bremsen. Beim Wanken bleibt sie nahezu wirkungslos.",
      "So lassen sich zwei Ziele trennen, die sich sonst widersprechen: Die Eckfedern können relativ weich bleiben und dem Reifen mechanischen Grip geben, während die Heave-Feder die Bodenfreiheit bei hoher Geschwindigkeit stabil hält.",
      "Bei vielen Prototypen gibt es zusätzlich eigene Dämpfer und Packer für die Heave-Feder."
    ],
    tipp: "Setzt dein Prototyp auf den Geraden auf, versuche zuerst eine härtere Heave-Feder oder mehr Heave-Packer, bevor du die Eckfedern härter machst.",
    siehe: ["hubachse", "federrate", "anschlagpuffer", "bodeneffekt"] },

  { id: "querlenker", begriff: "Querlenker", englisch: "Wishbone / Control Arm",
    kurz: "Lenker, der das Rad quer zur Fahrtrichtung mit dem Chassis verbindet.",
    text: [
      "Querlenker führen das Rad und übertragen Seiten-, Brems- und Antriebskräfte auf das Chassis. Ihre typische Dreiecksform mit zwei Lagerpunkten am Chassis und einem am Radträger hat ihnen im Englischen den Namen Wishbone (Gabelknochen) eingebracht.",
      "Die Länge und die Winkel der Lenker bestimmen, wie sich Sturz, Spur und Rollzentrum beim Ein- und Ausfedern verändern – also die Kinematik des Fahrwerks.",
      "Im Rennsport werden die Anlenkpunkte oft verstellbar ausgeführt, um die Geometrie an Strecke und Reifen anzupassen."
    ],
    tipp: "In Simulationen ist die Geometrie meist fest. Sie erklärt aber, warum sich ein Auto beim Absenken anders verhält: Die Lenker stehen dann in anderen Winkeln.",
    siehe: ["doppelquerlenker", "rollzentrum", "sturz"] },

  { id: "doppelquerlenker", begriff: "Doppelquerlenker", englisch: "Double Wishbone",
    kurz: "Radaufhängung mit einem oberen und einem unteren Querlenker.",
    text: [
      "Bei der Doppelquerlenkerachse wird das Rad von zwei übereinanderliegenden Querlenkern geführt. Sind die Lenker unterschiedlich lang, gewinnt das Rad beim Einfedern negativen Sturz – genau dann, wenn es in der Kurve belastet wird.",
      "Diese Bauart erlaubt Ingenieuren große Freiheit bei der Gestaltung von Sturzverlauf, Rollzentrum und Anti-Effekten. Deshalb ist sie bei fast allen Formelfahrzeugen, Prototypen und vielen GT-Fahrzeugen Standard.",
      "Nachteile sind Bauraum, Gewicht und Kosten – im Serienauto findet man sie daher vor allem bei Sportwagen."
    ],
    tipp: "Fahrzeuge mit Doppelquerlenkern reagieren meist feiner auf Sturz- und Höhenänderungen. Nutze das: Kleine Schritte bringen hier oft spürbare Unterschiede.",
    siehe: ["querlenker", "mcpherson", "sturz", "pushrod"] },

  { id: "mcpherson", begriff: "Federbein (McPherson)", englisch: "MacPherson Strut",
    kurz: "Einfache Radaufhängung, bei der das Federbein selbst das Rad führt.",
    text: [
      "Beim McPherson-Federbein übernimmt die Einheit aus Feder und Dämpfer zugleich die Führung des Rades. Unten gibt es nur einen Querlenker; oben stützt sich das Federbein direkt an der Karosserie ab.",
      "Die Konstruktion ist leicht, günstig und platzsparend – deshalb findet man sie in vielen Serienfahrzeugen und damit auch in Tourenwagen und seriennahen Rennklassen.",
      "Ihr Nachteil liegt in der Kinematik: Beim Einfedern und Wanken verliert das Rad eher negativen Sturz. Rennversionen gleichen das mit mehr statischem Sturz und verstellbaren Domlagern aus."
    ],
    tipp: "Bei seriennahen Fahrzeugen mit Federbeinen ist ausreichend negativer Sturz vorn besonders wichtig, weil die Kinematik ihn in der Kurve kaum unterstützt.",
    siehe: ["doppelquerlenker", "sturz", "querlenker"] },

  { id: "pushrod", begriff: "Schubstange", englisch: "Pushrod",
    kurz: "Stange, die Radbewegungen unter Druck an eine innenliegende Umlenkung überträgt.",
    text: [
      "Bei Formelfahrzeugen und Prototypen sitzen Federn und Dämpfer meist nicht am Rad, sondern im Chassis. Eine Schubstange verläuft vom unteren Bereich des Radträgers schräg nach oben zu einer Umlenkhebel-Wippe (Rocker), an der Feder, Dämpfer und Stabilisator angreifen.",
      "Federt das Rad ein, wird die Stange auf Druck belastet und schiebt die Wippe. Diese Bauweise hält die Anbauteile aus dem Luftstrom und erlaubt über die Wippe ein gezieltes Übersetzungsverhältnis.",
      "Schubstangen sind konstruktiv einfacher zugänglich als Zugstangen, liegen aber höher und beeinflussen den Schwerpunkt etwas stärker."
    ],
    tipp: "Für dich als Fahrer ist die Bauart kaum spürbar – wichtig ist, dass Federraten im Setup sich je nach Übersetzung der Wippe am Rad anders auswirken.",
    siehe: ["pullrod", "federrate", "doppelquerlenker"] },

  { id: "pullrod", begriff: "Zugstange", englisch: "Pullrod",
    kurz: "Stange, die Radbewegungen unter Zug an eine tiefliegende Umlenkung überträgt.",
    text: [
      "Die Zugstange verläuft umgekehrt zur Schubstange: vom oberen Bereich des Radträgers schräg nach unten zur Umlenkung. Beim Einfedern wird sie auf Zug belastet.",
      "Weil Wippe, Feder und Dämpfer dadurch tief im Chassis sitzen, sinkt der Schwerpunkt, und die Aerodynamik im oberen Bereich wird sauberer. Dafür ist die Konstruktion aufwendiger und die Bauteile sind schwerer zugänglich.",
      "Welche Bauart ein Team wählt, hängt vor allem von aerodynamischen Zielen und vom Bauraum ab."
    ],
    tipp: "Wie bei der Schubstange gilt: Für das Setup zählt die Radrate, nicht die nackte Federrate. Vergleiche Federwerte deshalb nur innerhalb desselben Fahrzeugs.",
    siehe: ["pushrod", "schwerpunkt", "federrate"] },

  { id: "spurstange", begriff: "Spurstange", englisch: "Tie Rod",
    kurz: "Verbindet die Lenkung mit dem Radträger und legt die Spur fest.",
    text: [
      "Die Spurstange überträgt die Bewegung der Lenkzahnstange auf den Achsschenkel und dreht so das Rad. Über ihre Länge wird die Spur eingestellt.",
      "Ihre Lage im Raum bestimmt außerdem, ob sich die Spur beim Ein- und Ausfedern verändert: Liegt sie nicht genau auf der richtigen Linie zu den Querlenkern, lenkt das Rad beim Federn von selbst – der sogenannte Bump Steer.",
      "An der Hinterachse gibt es bei Einzelradaufhängungen ebenfalls Spurstangen beziehungsweise Spurlenker, die das Rad in Geradeausstellung halten."
    ],
    tipp: "Wenn das Auto auf Bodenwellen von selbst leicht einlenkt oder in Kompressionen unruhig wird, kann Bump Steer über die Spurstangengeometrie die Ursache sein.",
    siehe: ["spur", "bump-steer", "achsschenkel"] },

  { id: "achsschenkel", begriff: "Achsschenkel", englisch: "Knuckle / Upright",
    kurz: "Radträger, an dem Radlager, Bremse und Lenker befestigt sind.",
    text: [
      "Der Achsschenkel – im Rennsport oft Radträger oder Upright genannt – ist das Bauteil zwischen Rad und Aufhängung. An ihm sitzen das Radlager mit der Nabe, der Bremssattel sowie die Anlenkpunkte von Querlenkern und Spurstange.",
      "Seine Form legt wichtige Geometriedaten fest, zum Beispiel Spreizung, Nachlaufversatz und Lenkrollradius. Im Rennsport wird er aus leichten, sehr steifen Materialien gefertigt, weil jede Verformung unter Last die Geometrie verfälscht.",
      "An der Hinterachse heißt das entsprechende Bauteil meist einfach Radträger."
    ],
    tipp: "Nach einem harten Einschlag ist in vielen Simulationen die Geometrie verzogen – das Auto zieht zur Seite. Im Rennen hilft dann nur eine Reparatur in der Box.",
    siehe: ["radnabe", "spreizung", "spurstange", "bremssattel"] },

  { id: "radnabe", begriff: "Radlager und Nabe", englisch: "Wheel Bearing / Hub",
    kurz: "Lagert das Rad drehbar im Radträger und nimmt die Felge auf.",
    text: [
      "Die Nabe ist das Bauteil, an das die Felge geschraubt wird. Sie dreht sich im Radlager, das im Achsschenkel sitzt und alle Kräfte zwischen Rad und Fahrzeug überträgt.",
      "Im Rennsport werden Räder meist mit einer Zentralmutter befestigt, damit der Reifenwechsel nur Sekunden dauert. Die Nabe muss dafür sehr präzise und steif sein; jede Verformung würde den Sturz unter Last verändern.",
      "An angetriebenen Rädern überträgt die Nabe zusätzlich das Antriebsmoment von der Antriebswelle auf das Rad."
    ],
    tipp: "Ein schneller Reifenwechsel hängt im echten Motorsport an der Zentralverschlussnabe – im Simracing an deiner Boxenstopp-Strategie.",
    siehe: ["achsschenkel", "boxenstopp"] },

  { id: "bump-steer", begriff: "Bump Steer", englisch: "Bump Steer",
    kurz: "Ungewollte Spuränderung beim Ein- und Ausfedern.",
    text: [
      "Bewegen sich Spurstange und Querlenker beim Einfedern auf unterschiedlichen Bögen, wird das Rad automatisch ein wenig gelenkt. Fährt das Auto über eine Bodenwelle, lenkt es dadurch von selbst – ohne dass der Fahrer das Lenkrad bewegt.",
      "Bump Steer macht das Fahrzeug auf unebenen Strecken nervös und schwer vorhersehbar. Ein gezielter, kleiner Effekt kann aber auch genutzt werden, etwa um das kurvenäußere Hinterrad beim Einfedern in Richtung Vorspur zu bewegen und so Stabilität zu gewinnen.",
      "Eingestellt wird Bump Steer über die Höhe der Spurstangen-Anlenkpunkte."
    ],
    tipp: "Wird dein Auto auf welligen Abschnitten oder beim Überfahren von Randsteinen unruhig, obwohl Federn und Dämpfer passen, kann Bump Steer die Ursache sein – sofern dein Setup ihn verstellen lässt.",
    siehe: ["spurstange", "spur", "senke"] },

  { id: "anti-dive", begriff: "Anti-Dive", englisch: "Anti-Dive",
    kurz: "Fahrwerksgeometrie, die das Eintauchen der Front beim Bremsen verringert.",
    text: [
      "Beim Bremsen verlagert sich Last nach vorn, und die Front taucht ein. Sind die Querlenker der Vorderachse von der Seite betrachtet leicht geneigt, stützt die Geometrie einen Teil der Bremskraft direkt ab – die Feder muss weniger Last aufnehmen.",
      "Wichtig: Anti-Dive verändert nicht die Menge der verlagerten Last, sondern nur, wie viel davon über die Federn und wie viel über die Lenker läuft. Das Auto bleibt flacher, was die aerodynamische Plattform stabil hält.",
      "Zu viel Anti-Dive kann das Lenkgefühl beim Bremsen verschlechtern und die Federung unter Bremslast verhärten."
    ],
    tipp: "Fehlt dir beim Anbremsen Rückmeldung in der Lenkung oder rumpelt die Front über Bodenwellen, kann zu viel Anti-Dive beteiligt sein – meist ist es jedoch fest vorgegeben.",
    siehe: ["anti-squat", "nickachse", "gewichtsverlagerung"] },

  { id: "anti-squat", begriff: "Anti-Squat", englisch: "Anti-Squat",
    kurz: "Fahrwerksgeometrie, die das Einfedern des Hecks beim Beschleunigen verringert.",
    text: [
      "Beim Beschleunigen verlagert sich Last nach hinten, das Heck federt ein (englisch squat = hocken). Anti-Squat leitet einen Teil der Antriebskraft über die Geometrie der Hinterachse ab, sodass das Heck weniger tief geht.",
      "Das hält die Fahrzeughöhe und damit die Aerodynamik stabiler und kann die Traktion beim Herausbeschleunigen verbessern, weil sich die Last weniger schlagartig verschiebt.",
      "Zu viel Anti-Squat führt dagegen zu einem harten, springenden Heck auf unebenem Belag, weil die Federung unter Last kaum noch arbeitet."
    ],
    tipp: "Ist das Heck beim Beschleunigen über Bodenwellen nervös und die Traktion trotzdem schlecht, kann weniger Anti-Squat helfen – sofern einstellbar.",
    siehe: ["anti-dive", "traktion", "nickachse"] },

  { id: "anti-roll", begriff: "Geometrische Wankabstützung", englisch: "Anti-Roll (Geometry)",
    kurz: "Teil der Wankkräfte, der über die Lenker statt über Federn läuft.",
    text: [
      "Mit Anti-Roll ist hier nicht der Stabilisator gemeint, sondern ein geometrischer Effekt: Je höher das Rollzentrum liegt, desto mehr Seitenkraft wird direkt über die Querlenker auf die Karosserie übertragen – ohne Umweg über Federn und Stabilisatoren.",
      "Diese Abstützung reagiert sofort und ohne Verzögerung durch Dämpfer. Das Auto wankt weniger und reagiert direkter. Zu viel davon hebt das Fahrzeug in der Kurve jedoch an (Jacking), was den Schwerpunkt erhöht und den Grip schwanken lässt.",
      "Bei Fahrzeugen ohne Stabilisator spielt der Effekt eine besonders große Rolle."
    ],
    tipp: "Verwechsle die geometrische Wankabstützung nicht mit dem Stabilisator: Den Stabilisator stellst du im Setup ein, die Geometrie meist nicht.",
    siehe: ["rollzentrum", "stabilisator", "wankachse"] },

  { id: "radlasten", begriff: "Radlasten", englisch: "Corner Weights",
    kurz: "Das Gewicht, das jedes einzelne Rad im Stand trägt.",
    text: [
      "Stellt man ein Auto auf vier Waagen, erhält man die Radlasten: links vorn, rechts vorn, links hinten, rechts hinten. Ihre Summe ist das Gesamtgewicht, ihr Verhältnis bestimmt Achslast- und Diagonalverteilung.",
      "Rennteams stellen die Radlasten über die Federvorspannung beziehungsweise die Fahrzeughöhe an jeder Ecke ein – mit Fahrer, Kraftstoff und Ballast an Bord. Eine ungleiche Verteilung führt dazu, dass sich das Auto in Links- und Rechtskurven unterschiedlich verhält.",
      "Auf Ovalen werden Radlasten bewusst asymmetrisch eingestellt, weil nur in eine Richtung gelenkt wird."
    ],
    tipp: "Wenn dein Auto in Linkskurven anders reagiert als in Rechtskurven, prüfe zuerst die Höhen an allen vier Ecken – unterschiedliche Höhen verschieben die Radlasten.",
    siehe: ["cross-weight", "achslastverteilung", "federvorspannung"] },

  { id: "cross-weight", begriff: "Diagonale Radlastverteilung", englisch: "Cross Weight / Wedge",
    kurz: "Anteil der Last auf einer Diagonale – meist rechts vorn plus links hinten.",
    text: [
      "Die Diagonallast gibt an, welcher Anteil des Gesamtgewichts auf zwei diagonal gegenüberliegenden Rädern liegt. Bei Straßenkursen strebt man in der Regel 50 Prozent an: Dann verhält sich das Auto in beiden Kurvenrichtungen gleich.",
      "Weicht der Wert ab, ist ein Auto in Rechtskurven anders abgestimmt als in Linkskurven. Auf Ovalen nutzt man das gezielt und spricht von Wedge: Mehr Wedge macht das Auto in Linkskurven tendenziell stabiler und untersteuernder, weniger Wedge lockerer.",
      "Die Diagonallast wird über die Höhen beziehungsweise die Federteller an den einzelnen Ecken verstellt; ein Millimeter an einer Ecke wirkt auf beide Diagonalen."
    ],
    tipp: "Auf Straßenkursen: Halte die Diagonallast bei 50 Prozent und ändere die Balance lieber über Stabilisatoren. Auf Ovalen ist Wedge dagegen eines der wichtigsten Werkzeuge.",
    siehe: ["radlasten", "achslastverteilung", "untersteuern"] },

  { id: "achslastverteilung", begriff: "Achslastverteilung", englisch: "Weight Distribution",
    kurz: "Verteilung des Gewichts zwischen Vorder- und Hinterachse.",
    text: [
      "Die Achslastverteilung gibt an, welcher Anteil des Gewichts auf der Vorderachse liegt, etwa 45 zu 55 Prozent. Sie hängt vor allem von der Position des Motors ab: Frontmotorfahrzeuge sind meist vorderlastig, Mittel- und Heckmotorfahrzeuge hecklastig.",
      "Sie prägt den Grundcharakter eines Autos: Eine schwere Hinterachse bringt Traktion beim Beschleunigen, neigt aber zum Übersteuern am Limit; eine schwere Front untersteuert eher und bremst stabiler.",
      "Im Rennbetrieb ändert sich die Verteilung mit dem Kraftstoff: Liegt der Tank nicht genau im Schwerpunkt, verschiebt sich die Balance im Verlauf eines Stints."
    ],
    tipp: "Merke dir, wie sich dein Auto mit vollem und mit fast leerem Tank verhält. Gerade im Langstreckenrennen ist das der Grund, warum sich die Balance im Stint ändert.",
    siehe: ["radlasten", "schwerpunkt", "tankmenge"] },

  { id: "schwerpunkt", begriff: "Schwerpunkt", englisch: "Centre of Gravity (CoG)",
    kurz: "Gedachter Punkt, in dem sich die gesamte Masse des Autos vereinen lässt.",
    text: [
      "Alle Kräfte durch Beschleunigen, Bremsen und Kurvenfahrt greifen am Schwerpunkt an. Seine Höhe bestimmt, wie viel Last sich dabei verlagert: Je höher er liegt, desto stärker wankt und nickt das Auto, und desto ungleicher verteilt sich der Grip auf die Reifen.",
      "Seine Längsposition bestimmt die Achslastverteilung, seine Querposition die Unterschiede zwischen Links- und Rechtskurven. Rennfahrzeuge werden deshalb so flach wie möglich gebaut, und Ballast wird tief und möglichst zentral platziert.",
      "Auch Kraftstoff verschiebt den Schwerpunkt: Ein voller Tank macht das Auto schwerer und meist auch etwas hecklastiger oder frontlastiger, je nach Tanklage."
    ],
    tipp: "Wo dein Setup Ballast verschieben lässt, nutze ihn als Feinjustierung der Balance – Ballast weiter vorn hilft gegen Untersteuern, weiter hinten gegen Übersteuern.",
    siehe: ["achslastverteilung", "gewichtsverlagerung", "rollzentrum"] },

  { id: "radstand", begriff: "Radstand", englisch: "Wheelbase",
    kurz: "Abstand zwischen Vorder- und Hinterachse.",
    text: [
      "Ein langer Radstand macht ein Fahrzeug in schnellen Kurven und bei hohem Tempo stabiler und berechenbarer, weil es langsamer um die Hochachse dreht. Ein kurzer Radstand macht es wendiger in engen Kurven, aber auch nervöser.",
      "Der Radstand beeinflusst zudem die Lastverlagerung beim Bremsen und Beschleunigen: Bei gleichem Schwerpunkt verlagert sich bei kurzem Radstand mehr Last zwischen den Achsen.",
      "Zusammen mit der Spurweite – dem Abstand zwischen linkem und rechtem Rad – legt er die Grundproportionen fest, die sich durch kein Setup mehr verändern lassen."
    ],
    tipp: "Wechselst du zwischen Fahrzeugen, rechne mit unterschiedlichem Charakter: Kurze Autos verzeihen hektische Eingaben weniger, lange Autos brauchen mehr Geduld beim Einlenken.",
    siehe: ["schwerpunkt", "gewichtsverlagerung", "achslastverteilung"] },

  { id: "chassissteifigkeit", begriff: "Chassissteifigkeit", englisch: "Torsional Rigidity",
    kurz: "Widerstand des Fahrzeugrahmens gegen Verdrehung.",
    text: [
      "Wenn ein Auto in der Kurve wankt oder über einen Randstein fährt, versuchen die Kräfte, das Chassis um seine Längsachse zu verdrehen. Die Torsionssteifigkeit gibt an, wie stark es sich dagegen wehrt, meist in Newtonmetern pro Grad.",
      "Ein steifes Chassis ist die Voraussetzung dafür, dass Federn, Dämpfer und Stabilisatoren so arbeiten, wie sie eingestellt sind. Verdreht sich der Rahmen selbst, wirkt er wie eine zusätzliche, unkontrollierte Feder und verfälscht jede Abstimmung.",
      "Moderne Rennfahrzeuge mit Kohlefaser-Monocoque sind um ein Vielfaches steifer als Serienfahrzeuge."
    ],
    tipp: "In Simulationen ist die Steifigkeit fest. Sie erklärt aber, warum ältere oder seriennahe Fahrzeuge weniger präzise auf Setupänderungen reagieren als moderne Prototypen.",
    siehe: ["monocoque", "gitterrohrrahmen", "stabilisator"] },

  { id: "monocoque", begriff: "Monocoque", englisch: "Monocoque",
    kurz: "Selbsttragende Fahrzeugzelle aus einem Stück, meist aus Kohlefaser.",
    text: [
      "Monocoque bedeutet so viel wie „einschalig“: Die Außenhaut selbst trägt die Lasten, ein separater Rahmen entfällt. Im Rennsport besteht diese Zelle aus Kohlefaserverbundwerkstoff mit Waben- oder Schaumkern.",
      "Sie ist zugleich Sicherheitszelle für den Fahrer und tragendes Bauteil, an das Motor, Aufhängung und Aerodynamik angebaut werden. Das Ergebnis ist eine extrem hohe Steifigkeit bei geringem Gewicht.",
      "Formelfahrzeuge, Prototypen und viele moderne Sportwagen basieren auf einem Monocoque."
    ],
    tipp: "Die hohe Steifigkeit macht Monocoque-Fahrzeuge präzise und direkt – kleine Setupänderungen zeigen sofort Wirkung.",
    siehe: ["chassissteifigkeit", "gitterrohrrahmen"] },

  { id: "gitterrohrrahmen", begriff: "Gitterrohrrahmen", englisch: "Spaceframe",
    kurz: "Rahmen aus vielen verschweißten Rohren, die ein steifes Fachwerk bilden.",
    text: [
      "Beim Gitterrohrrahmen bilden dünnwandige Stahl- oder Aluminiumrohre ein räumliches Fachwerk aus Dreiecken. Die Rohre werden fast nur auf Zug und Druck belastet, was eine hohe Steifigkeit bei geringem Gewicht ermöglicht.",
      "Die Bauweise ist vergleichsweise günstig, gut zu reparieren und flexibel anzupassen. Sie findet sich in vielen Silhouetten-Fahrzeugen, älteren Sportwagen, Stock Cars und im Breitensport.",
      "Im Vergleich zu einem Kohlefaser-Monocoque ist ein Gitterrohrrahmen meist schwerer und etwas weniger steif."
    ],
    tipp: "Fahrzeuge mit Gitterrohrrahmen wirken oft etwas „lebendiger“. Gib ihnen beim Einlenken einen Moment, bis sich das Chassis gesetzt hat.",
    siehe: ["monocoque", "chassissteifigkeit"] },
]);
