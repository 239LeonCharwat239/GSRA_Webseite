// GSRA – Nachschlagewerk: Strecke, Asphalt & Wetterbedingungen (ergänzt 24.11.2026)
import { kategorie } from "./begriff";

export const STRECKE = kategorie("Strecke, Asphalt & Wetter", [
  { id: "marbles", begriff: "Marbles", englisch: "Marbles (Gummiabrieb neben der Ideallinie)",
    kurz: "Kleine Gummikrümel, die sich neben der Ideallinie sammeln und dort kaum Grip bieten.",
    text: [
      "Reifen verlieren beim Fahren winzige Gummiteilchen. Auf der Ideallinie werden sie in den Asphalt gedrückt, daneben bleiben sie als lose Krümel liegen – die sogenannten Marbles. Je weicher die Reifen und je länger das Rennen, desto mehr sammeln sich an.",
      "Fährt man über Marbles, rollt der Reifen wie auf kleinen Kugeln: Der Grip bricht ein, das Auto rutscht und die Lauffläche nimmt Krümel auf. Danach fühlt sich der Reifen für einige Kurven stumpf an, bis die Teilchen abgefahren sind.",
      "Deshalb sind Überholmanöver gegen Rennende auf der Außenbahn so riskant: Wer neben die Ideallinie ausweichen muss, findet dort deutlich weniger Grip."
    ],
    tipp: "Musstest du über Marbles fahren, rechne in den nächsten Kurven mit weniger Grip und bremse etwas früher, bis die Reifen wieder sauber sind.",
    siehe: ["gummiabrieb", "kampflinie", "streckenentwicklung", "ideallinie"] },

  { id: "gruene-strecke", begriff: "Grüne Strecke", englisch: "Green Track",
    kurz: "Eine Strecke ohne Gummiauflage – meist zu Beginn eines Wochenendes oder nach Regen.",
    text: [
      "Als grün bezeichnet man eine Strecke, auf der noch kaum Gummi liegt. Das ist zu Beginn eines Rennwochenendes der Fall, nach Regen, der den Gummi abgewaschen hat, oder wenn auf dem Asphalt Staub und Sand liegen.",
      "Eine grüne Strecke bietet deutlich weniger Grip; die Rundenzeiten sind langsamer und die Reifen rutschen mehr, was zu Graining führen kann. Mit jeder Runde, die das Feld fährt, wird die Strecke schneller.",
      "Simulationen bilden das zunehmend nach: Die Gummiauflage baut sich über eine Sitzung auf und kann zwischen Sitzungen übernommen oder zurückgesetzt werden."
    ],
    tipp: "Stimme dein Setup nicht auf einer grünen Strecke endgültig ab – im Rennen ist die Strecke schneller, und eine zu weiche Abstimmung wird dann schnell nervös.",
    siehe: ["streckenentwicklung", "gummiabrieb", "graining", "marbles"] },

  { id: "asphalt-rauheit", begriff: "Asphaltbeschaffenheit und Rauheit", englisch: "Micro- & Macro-Roughness",
    kurz: "Die Oberflächenstruktur des Asphalts, die Grip und Reifenverschleiß bestimmt.",
    text: [
      "Man unterscheidet zwei Größenordnungen: Die Mikrorauheit ist die feine Struktur der einzelnen Gesteinskörner, in die sich das Gummi verzahnt. Die Makrorauheit beschreibt die gröberen Abstände zwischen den Körnern; sie sorgt dafür, dass Wasser abfließen kann und der Reifen sich verformt.",
      "Ein rauer, aggressiver Belag bietet viel Grip, verschleißt die Reifen aber stark. Ein glatter, alter oder polierter Belag ist schonend, bietet jedoch wenig Haftung, besonders bei Nässe. Neuer Asphalt kann anfangs ölig und rutschig sein, bis die Bindemittel abgefahren sind.",
      "Deshalb fühlt sich jede Strecke anders an: Dieselbe Reifenmischung kann auf einer Strecke ewig halten und auf der nächsten nach wenigen Runden abbauen."
    ],
    tipp: "Auf rauen Strecken lohnt sich oft eine härtere Mischung oder ein schonender Fahrstil mit weniger Rutschen – miss den Verschleiß in langen Trainingsläufen.",
    siehe: ["grip", "reifenabbau", "verschleiss", "aquaplaning"] },

  { id: "streckentemperatur", begriff: "Streckentemperatur", englisch: "Track Temperature",
    kurz: "Die Temperatur der Asphaltoberfläche – oft viel höher als die Lufttemperatur.",
    text: [
      "Dunkler Asphalt heizt sich in der Sonne stark auf. Bei 25 Grad Lufttemperatur sind 40 bis 50 Grad auf dem Belag keine Seltenheit, unter Wolken oder nachts sinkt die Streckentemperatur dagegen schnell.",
      "Die Streckentemperatur beeinflusst die Reifen unmittelbar: Auf heißem Asphalt erwärmen sie sich schneller, können aber überhitzen und schneller abbauen; auf kaltem Asphalt kommen sie schwer ins Arbeitsfenster. Das wirkt sich auf Grip, Reifendruck und die Wahl der Mischung aus.",
      "Viele Simulationen berechnen die Streckentemperatur dynamisch aus Sonnenstand, Wolken und Tageszeit. Bei Langstreckenrennen ändert sie sich über Tag und Nacht deutlich."
    ],
    tipp: "Sinkt die Streckentemperatur am Abend, erhöhe den Kaltdruck etwas, damit die Reifen trotzdem den richtigen Heißdruck erreichen.",
    siehe: ["lufttemperatur", "reifentemperatur", "arbeitsfenster", "heissdruck"] },

  { id: "lufttemperatur", begriff: "Lufttemperatur", englisch: "Ambient Temperature",
    kurz: "Die Temperatur der Umgebungsluft – entscheidend für Motorleistung, Kühlung und Reifen.",
    text: [
      "Kalte Luft ist dichter als warme. Ein Motor bekommt bei niedrigen Temperaturen mehr Sauerstoff je Arbeitstakt und leistet daher mehr; gleichzeitig erzeugen Flügel mehr Abtrieb und mehr Luftwiderstand.",
      "Hohe Lufttemperaturen belasten Kühlung und Bremsen. Wasser- und Öltemperatur steigen, die Bremsen kühlen auf Geraden weniger ab, und die Fahrer im geschlossenen Cockpit leiden unter Hitze.",
      "Für die Rennstrategie ist die Lufttemperatur zusammen mit der Streckentemperatur eine der wichtigsten Ausgangsgrößen, etwa für Verbrauch, Reifenwahl und Kühlöffnungen."
    ],
    tipp: "Ändert sich die Lufttemperatur im Rennen stark, rechne mit veränderten Rundenzeiten und Verbräuchen und gleiche deine Stintplanung an.",
    siehe: ["luftdichte", "streckentemperatur", "kuehlwassertemperatur", "abtrieb"] },

  { id: "luftdichte", begriff: "Luftdichte", englisch: "Air Density",
    kurz: "Wie viel Luft in einem bestimmten Volumen steckt – sie bestimmt Motorleistung und Aerodynamik.",
    text: [
      "Die Luftdichte hängt von Temperatur, Luftdruck und Luftfeuchtigkeit ab. Kalte Luft bei hohem Druck ist dicht, warme Luft in großer Höhe ist dünn.",
      "Abtrieb und Luftwiderstand wachsen direkt mit der Dichte. Auf hochgelegenen Strecken verliert ein Auto daher spürbar Abtrieb, auch wenn die Flügel gleich eingestellt sind; Saugmotoren verlieren zudem Leistung, Turbomotoren gleichen einen Teil über höheren Ladedruck aus.",
      "Ingenieure rechnen Messwerte aus dem Windkanal und der Strecke deshalb auf eine einheitliche Dichte um, damit sie vergleichbar bleiben."
    ],
    tipp: "Auf Strecken in großer Höhe brauchst du oft steilere Flügel für den gleichen Grip – und dein Auto ist auf der Geraden trotzdem nicht langsamer als sonst.",
    siehe: ["lufttemperatur", "luftfeuchtigkeit", "abtrieb", "saugmotor"] },

  { id: "luftfeuchtigkeit", begriff: "Luftfeuchtigkeit", englisch: "Humidity",
    kurz: "Der Wasserdampfgehalt der Luft – er beeinflusst Motorleistung, Wetterentwicklung und Abtrocknen.",
    text: [
      "Wasserdampf ist leichter als trockene Luft. Feuchte Luft enthält daher etwas weniger Sauerstoff und ist etwas weniger dicht; der Motor verliert geringfügig Leistung.",
      "Wichtiger ist die Feuchtigkeit für das Wetter: Hohe Luftfeuchtigkeit begünstigt Nebel, Tau und Regen und sorgt dafür, dass eine nasse Strecke langsamer abtrocknet. Bei trockener Luft und Wind trocknet eine Strecke dagegen erstaunlich schnell.",
      "In Simulationen mit dynamischem Wetter ist die Luftfeuchtigkeit ein Hinweis darauf, wie lange eine nasse Phase dauern könnte."
    ],
    tipp: "Ist es feucht und windstill, bleibt die Strecke nach einem Schauer lange nass – warte mit dem Wechsel auf Slicks lieber eine Runde länger.",
    siehe: ["luftdichte", "abtrocknende-strecke", "crossover-point"] },

  { id: "wind", begriff: "Windrichtung und Windgeschwindigkeit", englisch: "Headwind / Tailwind / Crosswind",
    kurz: "Wind verändert Abtrieb, Höchstgeschwindigkeit und Bremspunkte je nach Streckenabschnitt.",
    text: [
      "Ein Auto reagiert auf die Luftgeschwindigkeit relativ zu sich selbst. Gegenwind erhöht sie: mehr Abtrieb, mehr Luftwiderstand, geringere Höchstgeschwindigkeit, aber kürzere Bremswege. Rückenwind senkt sie: höhere Endgeschwindigkeit, weniger Abtrieb und längere Bremswege.",
      "Seitenwind verschiebt die Anströmung und kann das Auto in schnellen Kurven unruhig machen; er beeinflusst zudem die Aero-Balance zwischen Vorder- und Hinterachse.",
      "Weil Strecken in alle Himmelsrichtungen führen, wirkt derselbe Wind in jeder Kurve anders. Fahrer passen ihre Bremspunkte deshalb an, wenn der Wind auffrischt."
    ],
    tipp: "Bremse bei Rückenwind am Ende einer Geraden etwas früher und erwarte in der folgenden Kurve weniger Grip; bei Gegenwind kannst du oft später bremsen.",
    siehe: ["boeen", "abtrieb", "luftwiderstand", "aero-balance"] },

  { id: "boeen", begriff: "Böen", englisch: "Gusts",
    kurz: "Kurze, plötzliche Windstöße, die ein Auto in schnellen Passagen aus dem Gleichgewicht bringen können.",
    text: [
      "Böen sind kurzzeitige Spitzen der Windgeschwindigkeit. Anders als gleichmäßiger Wind lassen sie sich kaum vorhersehen und treffen das Auto oft mitten in einer Kurve.",
      "Fahrzeuge mit viel Abtrieb reagieren besonders empfindlich: Eine Böe von hinten kann den Abtrieb schlagartig verringern, das Auto verliert Grip und rutscht. Auf Geraden kann Seitenwind das Fahrzeug versetzen.",
      "Bei starken Böen passen Teams die Abstimmung an, etwa mit etwas mehr Flügel für Stabilität, auch wenn das Höchstgeschwindigkeit kostet."
    ],
    tipp: "Fahre bei böigem Wind in schnellen Kurven mit etwas Reserve – ein Zehntel Vorsicht ist besser als ein Abflug.",
    siehe: ["wind", "abtrieb", "stroemungsabriss"] },

  { id: "regenlinie", begriff: "Regenlinie", englisch: "Wet Line",
    kurz: "Die Linie, die bei Nässe gefahren wird – oft abseits der trockenen Ideallinie.",
    text: [
      "Auf der trockenen Ideallinie liegt viel eingefahrenes Gummi. Bei Nässe wird genau diese Schicht glatt wie Seife, weil Gummi und Wasser einen rutschigen Film bilden. Abseits davon ist der Asphalt rauer und bietet mehr Haftung.",
      "Deshalb fahren Fahrer im Regen häufig bewusst breitere oder engere Linien, bremsen neben der gewohnten Spur und suchen Stellen mit griffigem Belag. Auch Fahrbahnmarkierungen, Randsteine und Flecken mit stehendem Wasser werden umfahren.",
      "Die beste Regenlinie ändert sich mit der Wassermenge: Bei leichtem Regen kann die normale Linie noch funktionieren, bei starkem Regen zählt vor allem, Pfützen zu meiden."
    ],
    tipp: "Probiere im Regentraining in jeder Kurve eine Linie etwa eine Wagenbreite neben der Ideallinie – du wirst überrascht sein, wie viel mehr Grip dort liegt.",
    siehe: ["ideallinie", "stehendes-wasser", "aquaplaning", "regenreifen"] },

  { id: "stehendes-wasser", begriff: "Stehendes Wasser", englisch: "Standing Water / Puddles",
    kurz: "Wasserflächen auf der Strecke, die nicht abfließen und schlagartig Aquaplaning auslösen können.",
    text: [
      "Wo die Strecke Senken hat oder das Wasser nicht seitlich abfließen kann, bilden sich Pfützen und Rinnsale. Sie entstehen oft an denselben Stellen und wachsen bei starkem Regen schnell.",
      "Fährt ein Reifen durch tiefes Wasser, kann er die Wassermenge nicht mehr verdrängen und schwimmt auf: Lenkung und Bremse wirken dann nicht mehr. Besonders gefährlich ist stehendes Wasser auf schnellen Geraden und in Bremszonen.",
      "Rennleitungen unterbrechen Rennen, wenn sich zu viel stehendes Wasser bildet, und schicken das Safety Car, bis der Regen nachlässt."
    ],
    tipp: "Merke dir in Regenrennen, wo sich Pfützen bilden, und lege deine Linie bewusst daran vorbei – auch wenn das ein paar Meter Weg kostet.",
    siehe: ["aquaplaning", "regenlinie", "gischt", "safety-car"] },

  { id: "aquaplaning", begriff: "Aquaplaning", englisch: "Aquaplaning / Hydroplaning",
    kurz: "Der Reifen schwimmt auf einem Wasserfilm auf und verliert jeden Kontakt zum Asphalt.",
    text: [
      "Ein Reifen muss das Wasser unter seiner Aufstandsfläche verdrängen. Regenreifen tun das mit tiefen Rillen, Slicks können es kaum. Ist die Wassermenge zu groß oder die Geschwindigkeit zu hoch, baut sich vor dem Reifen ein Keil aus Wasser auf, und der Reifen hebt ab.",
      "Beim Aquaplaning reagiert das Auto nicht mehr auf Lenkung und Bremse. Die Räder können sogar langsamer drehen, weil sie keinen Antrieb vom Asphalt erhalten. Sobald der Reifen wieder greift, kann das Auto ruckartig in die Richtung schießen, in die die Räder gerade zeigen.",
      "Wie leicht ein Auto aufschwimmt, hängt von Wassertiefe, Geschwindigkeit, Profiltiefe, Reifendruck und Aufstandsfläche ab."
    ],
    tipp: "Spürst du Aquaplaning, geh vom Gas, halte die Lenkung gerade und bremse nicht – sonst schlägt das Auto aus, sobald die Reifen wieder greifen.",
    siehe: ["stehendes-wasser", "regenreifen", "intermediates", "aufstandsflaeche"] },

  { id: "gischt", begriff: "Gischt", englisch: "Spray",
    kurz: "Der Sprühnebel, den Fahrzeuge bei Nässe aufwirbeln und der die Sicht stark einschränkt.",
    text: [
      "Bei Nässe schleudern Reifen und Unterboden große Wassermengen in die Luft. Besonders Fahrzeuge mit viel Abtrieb erzeugen hinter sich eine dichte Wolke, in der der nachfolgende Fahrer kaum etwas sieht.",
      "Gischt ist eine der größten Gefahren im Regen: Bremspunkte, Kurveneingänge und langsamere Fahrzeuge verschwinden im Nebel. Deshalb tragen Rennwagen hinten Regenleuchten, die bei Nässe blinken.",
      "Im Windschatten fährt man direkt in die Gischt; viele Fahrer halten im Regen deshalb mehr Abstand oder versetzen sich seitlich, um überhaupt etwas zu sehen."
    ],
    tipp: "Orientiere dich in der Gischt an festen Punkten am Streckenrand statt am Auto vor dir, und halte genug Abstand für den Fall, dass es plötzlich bremst.",
    siehe: ["stehendes-wasser", "windschatten", "regenlinie"] },

  { id: "abtrocknende-strecke", begriff: "Abtrocknende Strecke", englisch: "Drying Track",
    kurz: "Der Übergang von nass zu trocken, bei dem sich zuerst eine trockene Linie bildet.",
    text: [
      "Hört der Regen auf, trocknet die Strecke nicht gleichmäßig. Auf der Ideallinie verdrängen die Reifen das Wasser und erwärmen den Belag; dort entsteht zuerst eine trockene Spur, während der Rest der Fahrbahn noch nass ist.",
      "Für Fahrer ist das eine heikle Phase: Auf der trockenen Linie gibt es viel Grip, daneben kaum. Regenreifen überhitzen auf trockenem Asphalt schnell, Slicks finden auf den nassen Stellen noch keine Haftung.",
      "Die Entscheidung, wann man auf welche Reifen wechselt, gewinnt oder verliert in dieser Phase ganze Rennen."
    ],
    tipp: "Fahre mit Regenreifen auf abtrocknender Strecke bewusst durch nasse Stellen, um die Reifen zu kühlen – so halten sie bis zum richtigen Wechselzeitpunkt durch.",
    siehe: ["crossover-point", "regenreifen", "intermediates", "slicks"] },

  { id: "crossover-point", begriff: "Wechselpunkt der Reifen", englisch: "Crossover Point",
    kurz: "Der Moment, ab dem ein anderer Reifentyp schneller ist – etwa Slicks statt Intermediates.",
    text: [
      "Bei wechselndem Wetter gibt es einen Zeitpunkt, an dem der bisher gefahrene Reifentyp langsamer wird als der nächste. Trocknet die Strecke ab, werden Slicks irgendwann schneller als Intermediates; fängt es an zu regnen, kehrt sich das um.",
      "Den genauen Punkt zu erkennen, ist schwierig: Man vergleicht eigene Rundenzeiten mit denen anderer Fahrzeuge, die schon gewechselt haben, beobachtet Sektorzeiten und hört auf die Rückmeldung des Fahrers. Dazu kommt der Zeitverlust des Boxenstopps und die Aufwärmphase der neuen Reifen.",
      "Wer zu früh wechselt, verliert Zeit auf nicht geeigneten Reifen; wer zu spät wechselt, verliert in jeder Runde, die er zu lange fährt."
    ],
    tipp: "Sind Fahrer mit Slicks in einem Sektor schon schneller als du auf Intermediates, ist der Wechselpunkt meist erreicht – reagiere in derselben Runde.",
    siehe: ["abtrocknende-strecke", "intermediates", "slicks", "boxenstopp-verlust"] },

  { id: "mini-sektoren", begriff: "Streckensektoren und Mini-Sektoren", englisch: "Sectors / Micro-Sectors",
    kurz: "Die Aufteilung einer Runde in Abschnitte, um Zeitgewinne und -verluste genau zu verorten.",
    text: [
      "Jede Rennstrecke ist offiziell in drei Sektoren geteilt; an ihren Grenzen misst die Zeitnahme Zwischenzeiten. So sieht man, in welchem Teil der Runde ein Fahrer schneller oder langsamer ist.",
      "Mini-Sektoren teilen die Runde weiter auf, oft in Dutzende kurze Abschnitte. In der Datenanalyse lässt sich damit Kurve für Kurve vergleichen, wer wo Zeit gewinnt. Übertragungen nutzen sie, um farbig darzustellen, wer in welchem Abschnitt der Schnellste war.",
      "Aus den jeweils besten Abschnitten mehrerer Runden lässt sich eine theoretische Bestzeit zusammensetzen – sie zeigt, wie viel Potenzial noch in einer Runde steckt."
    ],
    tipp: "Vergleiche dich nicht nur mit der Rundenzeit eines schnelleren Fahrers, sondern Abschnitt für Abschnitt – meist liegen 80 Prozent des Rückstands in wenigen Kurven.",
    siehe: ["sektorzeiten", "theoretical-best", "delta", "transponder"] },

  { id: "curb-positionen", begriff: "Einlenk-, Scheitelpunkt- und Ausgangsrandsteine", englisch: "Entry Curb / Apex Curb / Exit Curb",
    kurz: "Die drei Randsteine einer Kurve, die je nach Lage ganz unterschiedlich genutzt werden.",
    text: [
      "Am Kurveneingang liegt außen oft ein Randstein, an den man beim Einlenken heranfährt. Am Scheitelpunkt liegt der Innenrandstein, über den viele Fahrer mit den inneren Rädern fahren, um die Kurve zu begradigen. Am Ausgang hilft der Außenrandstein, die volle Streckenbreite zu nutzen.",
      "Wie aggressiv man einen Randstein nutzen kann, hängt von seiner Form und vom Auto ab: Flache Randsteine lassen sich ohne Risiko überfahren, hohe oder gezackte bringen das Auto aus dem Gleichgewicht und können den Unterboden beschädigen. Fahrzeuge mit sehr wenig Bodenfreiheit meiden sie eher.",
      "Wer Randsteine gut nutzt, gewinnt Strecke und damit Zeit. Wer sie überreizt, verliert Grip oder überschreitet die Streckenbegrenzung."
    ],
    tipp: "Taste dich im Training Runde für Runde weiter auf die Randsteine vor und beobachte, wann das Auto unruhig wird – die Grenze liegt kurz davor.",
    siehe: ["curbs", "sausage-curbs", "stepped-curbs", "track-limits"] },

  { id: "tecpro-barriere", begriff: "Modulare Energieabsorptions-Barriere", englisch: "Tecpro Barrier",
    kurz: "Schutzwand aus verbundenen Kunststoffblöcken, die Aufprallenergie aufnehmen.",
    text: [
      "Diese Barrieren bestehen aus großen, miteinander verbundenen Blöcken aus Kunststoff, die mit Schaumstoff gefüllt sind. Prallt ein Auto dagegen, verformen sich die Blöcke und nehmen viel Energie auf; die Verzögerung für den Fahrer wird dadurch deutlich geringer als an einer starren Wand.",
      "Sie werden an Stellen mit hoher Aufprallgeschwindigkeit eingesetzt, etwa am Ende von Auslaufzonen. Anders als lose Reifenstapel bleiben sie als zusammenhängende Wand stehen und schleudern keine Teile auf die Strecke.",
      "Im Rennsport hat sich der Begriff nach einem bekannten Hersteller als Gattungsname eingebürgert."
    ],
    tipp: "Auch in der Simulation sind diese Barrieren nachgiebiger als Betonmauern – trotzdem endet der Einschlag fast immer mit Schäden. Plane Auslaufzonen nie als Bremsweg ein.",
    siehe: ["reifenstapel", "leitplanke", "auslaufzone"] },

  { id: "reifenstapel", begriff: "Reifenstapel", englisch: "Tyre Barrier",
    kurz: "Gestapelte, verschraubte Altreifen vor Mauern und Leitplanken, die Einschläge abfedern.",
    text: [
      "Reifenstapel sind die klassische Schutzbarriere im Motorsport. Mehrere Lagen Altreifen werden übereinandergestapelt, miteinander verbunden und häufig mit einem Förderband verkleidet, damit Autos daran entlanggleiten statt sich zu verhaken.",
      "Die Reifen nehmen beim Aufprall Energie auf, indem sie sich verformen. Wie gut das funktioniert, hängt davon ab, wie dicht sie gepackt und wie fest sie verbunden sind.",
      "Nachteil: Nach einem Einschlag müssen sie neu aufgebaut werden, was oft eine Unterbrechung der Sitzung erfordert."
    ],
    tipp: "Kommst du in der Simulation von der Strecke ab, bremse auf dem Gras oder im Kies so stark wie möglich und lenke parallel zur Barriere – ein streifender Einschlag ist viel harmloser als ein frontaler.",
    siehe: ["tecpro-barriere", "auslaufzone", "kiesbett"] },

  { id: "leitplanke", begriff: "Leitplanke", englisch: "Armco",
    kurz: "Stahlbarriere am Streckenrand, die Fahrzeuge abfängt und entlang der Strecke umlenkt.",
    text: [
      "Leitplanken bestehen aus profilierten Stahlbändern auf Pfosten. Sie sollen ein Auto nicht abrupt stoppen, sondern es in flachem Winkel zurück in Fahrtrichtung lenken und dabei Energie durch Verformung aufnehmen.",
      "An Stellen mit hohen Aufprallwinkeln reichen Leitplanken allein nicht aus; davor liegen dann Auslaufzonen, Reifenstapel oder energieabsorbierende Barrieren. Auf Stadt- und Straßenkursen bilden Leitplanken und Betonmauern oft den direkten Streckenrand.",
      "Weil Leitplanken sich verformen, müssen sie nach Einschlägen geprüft und repariert werden, bevor weitergefahren werden darf."
    ],
    tipp: "Auf Straßenkursen mit Leitplanken direkt am Rand ist jeder Zentimeter Abstand Risiko – baue dein Tempo dort langsamer auf als auf Strecken mit Auslaufzonen.",
    siehe: ["fangzaun", "reifenstapel", "tecpro-barriere"] },

  { id: "fangzaun", begriff: "Fangzaun", englisch: "Catch Fence",
    kurz: "Hoher Zaun hinter den Barrieren, der Fahrzeuge und Teile von den Zuschauern fernhält.",
    text: [
      "Fangzäune stehen hinter Leitplanken und Mauern und reichen mehrere Meter hoch. Sie bestehen aus stabilen Pfosten und Drahtgeflecht mit Stahlseilen und sollen verhindern, dass Fahrzeuge oder abgerissene Teile in die Zuschauerbereiche fliegen.",
      "Besonders wichtig sind sie auf Ovalen und schnellen Strecken, wo Autos bei Unfällen abheben können. Ihre Konstruktion ist ein Kompromiss: Sie müssen fest genug sein, um ein Fahrzeug aufzuhalten, aber so nachgeben, dass sie es nicht zerreißen.",
      "Moderne Zäune haben weniger herausstehende Pfosten auf der Streckenseite, um Fahrzeuge und Fahrer nicht zusätzlich zu gefährden."
    ],
    tipp: "Fangzäune sind ein reines Sicherheitsbauteil – in der Simulation stehen sie meist dort, wo bei Unfällen hohe Geschwindigkeiten im Spiel sind. Sei an diesen Stellen im dichten Feld besonders vorsichtig.",
    siehe: ["leitplanke", "safer-barrier", "steilkurve"] },

  { id: "safer-barrier", begriff: "Energieabsorbierende Ovalmauer", englisch: "SAFER Barrier",
    kurz: "Nachgiebige Stahl-Schaum-Wand vor den Betonmauern auf Ovalstrecken.",
    text: [
      "Auf Ovalen prallen Fahrzeuge mit sehr hoher Geschwindigkeit gegen die Außenmauer. Die energieabsorbierende Barriere besteht aus Stahlrohren, die vor der Betonmauer auf Schaumstoffblöcken montiert sind. Beim Aufprall gibt sie nach, verteilt die Kraft auf eine größere Fläche und senkt die Spitzenbelastung für den Fahrer erheblich.",
      "Die Abkürzung steht für „Steel and Foam Energy Reduction“. Die Barriere gilt als eine der wichtigsten Sicherheitsverbesserungen auf Ovalstrecken und wird inzwischen auch auf manchen Rundkursen eingesetzt.",
      "Da sie direkt vor der Mauer sitzt, verändert sie nicht den Streckenverlauf – sie macht nur den Einschlag weniger gefährlich."
    ],
    tipp: "Auch mit nachgiebiger Mauer gilt im Oval: Fängst du ein rutschendes Auto nicht mehr ab, bremse und lass es eher in die Innenseite rollen, statt quer über die Fahrbahn zu kreuzen.",
    siehe: ["steilkurve", "fangzaun", "leitplanke"] },
]);
