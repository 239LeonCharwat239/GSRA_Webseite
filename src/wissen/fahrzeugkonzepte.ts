// GSRA – Nachschlagewerk: Rennklassen, Fahrzeugkonzepte & Disziplinen (ergänzt 24.11.2026)
// Redaktionell ohne Marken- und Seriennamen: Klassen werden über ihre technischen Merkmale erklärt.
import { kategorie } from "./begriff";

export const FAHRZEUGKONZEPTE = kategorie("Rennklassen & Fahrzeugkonzepte", [
  { id: "monoposto", begriff: "Monoposto und Formelfahrzeug", englisch: "Single-Seater / Open-Wheeler",
    kurz: "Einsitziger Rennwagen mit frei stehenden Rädern – die Grundform des Formelsports.",
    text: [
      "Ein Monoposto hat einen zentralen Sitz für den Fahrer und Räder, die nicht von einer Karosserie verdeckt werden. Das Chassis ist schmal und leicht, der Motor sitzt hinter dem Fahrer, und Front- und Heckflügel erzeugen einen großen Teil des Grips über Abtrieb.",
      "Formelfahrzeuge reichen von Einsteigerklassen mit wenig Leistung und einfacher Aerodynamik bis zu den schnellsten Rundstreckenautos der Welt. Gemeinsam ist ihnen ein sehr direktes Fahrgefühl: wenig Gewicht, viel mechanischer Grip und eine hohe Empfindlichkeit für Setup-Änderungen.",
      "Frei stehende Räder machen Rad-an-Rad-Duelle heikel: Berühren sich Räder, kann ein Auto abheben. Formelfahrzeuge sind außerdem empfindlich für verwirbelte Luft, wenn sie dicht hinter einem anderen Auto fahren."
    ],
    tipp: "Formelfahrzeuge verzeihen wenig Rutschen. Fahre sauber, nutze den Abtrieb in schnellen Kurven und halte im Zweikampf genug seitlichen Abstand zu fremden Rädern.",
    siehe: ["abtrieb", "dirty-air", "halo-aeroscreen", "mittelmotor"] },

  { id: "prototyp", begriff: "Sportprototyp", englisch: "Prototype (LMDh, LMH, LMP2, LMP3)",
    kurz: "Geschlossene oder offene Rennsportwagen, die eigens für die Rennstrecke gebaut werden – die schnellste Klasse im Langstreckensport.",
    text: [
      "Prototypen haben mit Serienautos nichts gemein: Sie sind von Grund auf für den Rennsport konstruiert, mit Kohlefaser-Monocoque, Mittelmotor und einer Karosserie, die vor allem Abtrieb und geringen Luftwiderstand liefern soll. Sie bilden die Spitze vieler Langstreckenmeisterschaften.",
      "In der obersten Klasse treten heute Hybridfahrzeuge an, deren Leistung über eine Balance of Performance angeglichen wird. Darunter gibt es Klassen mit Einheitsmotoren und festgelegten Chassis-Herstellern, in denen vor allem Kundenteams und Amateure fahren. Die Abkürzungen stehen für die jeweiligen Reglements.",
      "Im Rennen teilen sich Prototypen die Strecke mit langsameren GT-Fahrzeugen. Das ständige Überrunden ist eine eigene Disziplin: Der schnellere Fahrer muss den Moment wählen, der langsamere berechenbar bleiben."
    ],
    tipp: "Überrundest du mit einem Prototyp GT-Fahrzeuge, plane das Manöver eine Kurve vorher und überhole möglichst auf der Geraden – nicht im Bremspunkt, in dem der GT-Fahrer dich nicht erwartet.",
    siehe: ["langstreckenrennen", "bop", "ers", "gt-klassen"] },

  { id: "gt-klassen", begriff: "GT-Fahrzeuge", englisch: "GT3 / GT4 / GT2 / GTE",
    kurz: "Rennversionen von Sportwagen, die äußerlich ihren Straßenmodellen ähneln.",
    text: [
      "GT steht für Gran Turismo. GT-Rennwagen basieren auf Sportwagen, die es auch für die Straße gibt, und werden für den Rennsport umgebaut: Sicherheitszelle, Rennfahrwerk, Aerodynamikteile, Rennbremsen und oft ein angepasster Motor.",
      "Die Klassen unterscheiden sich in Leistung und Freiheit beim Umbau. GT3-Fahrzeuge sind die verbreitetste Kundensportklasse mit viel Abtrieb, ABS und Traktionskontrolle; GT4-Fahrzeuge sind näher an der Serie, langsamer und günstiger. GT2 steht für leistungsstarke, eher seriennahe Fahrzeuge für Amateure, GTE war eine frühere Klasse für Werksteams im Langstreckensport.",
      "Damit sehr unterschiedliche Autos – mit Front- oder Mittelmotor, Saug- oder Turbomotor – gegeneinander fahren können, gleicht eine Balance of Performance Gewicht, Leistung und manchmal Aerodynamik an."
    ],
    tipp: "GT3-Fahrzeuge sind ideal zum Lernen: genug Leistung und Abtrieb, aber dank Fahrhilfen beherrschbar. Lerne zuerst ohne aggressive Randstein-Nutzung, dann taste dich heran.",
    siehe: ["bop", "abs", "traktionskontrolle", "cup-fahrzeuge"] },

  { id: "tourenwagen", begriff: "Tourenwagen", englisch: "Touring Cars (z. B. TCR)",
    kurz: "Renn-Limousinen und Kompaktwagen, die auf Serienfahrzeugen basieren und für enge Zweikämpfe bekannt sind.",
    text: [
      "Tourenwagen sind abgeleitet von Alltagsautos mit vier Türen oder Kompaktwagen. Je nach Reglement bleiben sie nah am Serienauto oder werden zu Silhouetten-Fahrzeugen, die nur noch die Form der Straßenversion zeigen.",
      "Weit verbreitet sind Klassen mit Frontantrieb und Turbomotoren, die nach einem gemeinsamen Reglement weltweit eingesetzt werden. Andere Meisterschaften setzen auf große Limousinen mit Heckantrieb und starken Saugmotoren.",
      "Weil Tourenwagen robust sind und sich die Leistung oft wenig unterscheidet, sind die Rennen eng; leichte Berührungen gehören dazu. Gefahren wird häufig im Sprintformat mit mehreren kurzen Läufen."
    ],
    tipp: "Mit frontgetriebenen Tourenwagen ist Geduld am Kurvenausgang gefragt: Zu frühes Vollgas lässt die Vorderräder durchdrehen und schiebt dich nach außen.",
    siehe: ["frontantrieb", "sprintrennen", "bop", "kampflinie"] },

  { id: "cup-fahrzeuge", begriff: "Markenpokal-Fahrzeuge", englisch: "Cup Cars / One-Make Series",
    kurz: "Identische Rennwagen eines Herstellers, mit denen alle Teilnehmer einer Serie gegeneinander fahren.",
    text: [
      "In einem Markenpokal fahren alle mit demselben Fahrzeug, oft sogar mit versiegeltem Motor und festgelegten Setup-Bereichen. Unterschiede in der Technik sollen so klein wie möglich sein, damit Fahrer und Team den Ausschlag geben.",
      "Cup-Fahrzeuge haben häufig weder ABS noch Traktionskontrolle und reagieren direkt auf Fahrfehler. Sie gelten deshalb als hervorragende Schule: Wer hier schnell ist, beherrscht Bremsen, Gewichtsverlagerung und Reifen.",
      "Viele Markenpokale dienen als Nachwuchsserie: Talente zeigen sich hier und steigen danach in GT- oder Prototypenklassen auf."
    ],
    tipp: "In einem Markenpokal entscheiden Kleinigkeiten. Vergleiche deine Telemetrie mit schnelleren Fahrern im selben Auto – jede Abweichung ist echter Fahrerunterschied.",
    siehe: ["gt-klassen", "fixed-setup", "threshold-braking", "telemetrie"] },

  { id: "stock-car", begriff: "Stock Car", englisch: "Stock Car",
    kurz: "Schwere Rennwagen mit großem Frontmotor und Heckantrieb, vor allem für Ovalrennen.",
    text: [
      "Stock Cars sehen von außen wie Serienautos aus, sind aber reine Rennfahrzeuge mit Rohrrahmen, großem V8-Frontmotor und Heckantrieb. Ursprünglich waren es tatsächlich Serienwagen von der Stange, daher der Name.",
      "Ihr Revier sind Ovale, auf denen sie in dichten Pulks fahren und den Windschatten intensiv nutzen. Das Setup ist oft asymmetrisch, weil immer in dieselbe Richtung gefahren wird: Reifendrücke, Sturz und Gewichtsverteilung unterscheiden sich zwischen linker und rechter Seite.",
      "Weil die Autos sehr schwer sind und viel Leistung haben, sind Reifenverschleiß und das richtige Einteilen des Grips über einen Stint entscheidend."
    ],
    tipp: "Im Oval entscheidet der Windschatten. Lerne, wann du dich aus dem Sog löst – zu früh gibt dem Gegner Zeit zum Reagieren, zu spät bringt dich nicht mehr vorbei.",
    siehe: ["steilkurve", "windschatten", "safer-barrier", "spotter"] },

  { id: "rallye", begriff: "Rallye", englisch: "Rally (Rally1, Rally2)",
    kurz: "Zeitfahren gegen die Uhr auf abgesperrten Straßen – auf Schotter, Asphalt, Schnee und Eis.",
    text: [
      "Bei einer Rallye starten die Fahrzeuge einzeln im Abstand und fahren Wertungsprüfungen auf gesperrten Landstraßen. Gewinner ist, wer die geringste Gesamtzeit über alle Prüfungen hat. Ein Beifahrer liest den Aufschrieb vor – eine Beschreibung jeder Kurve, die das Team bei der Besichtigung erstellt hat.",
      "Rallyefahrzeuge basieren auf Kleinwagen oder Kompaktautos, haben meist Allradantrieb, Turbomotor und lange Federwege. Die Klassen unterscheiden sich in Leistung und Technik; in der obersten kommen Hybridantriebe zum Einsatz.",
      "Die Untergründe wechseln ständig. Zwischen den Prüfungen darf nur in festgelegten Service-Zeiten repariert werden, sodass Fahrer Schäden oft mit ins Ziel bringen müssen."
    ],
    tipp: "Höre in der Simulation auf den Beifahrer und vertraue dem Aufschrieb. Wer auf Sicht fährt, ist auf unbekannten Prüfungen immer zu spät dran.",
    siehe: ["allradantrieb", "rallycross", "joker-lap", "turbolader"] },

  { id: "rallycross", begriff: "Rallycross", englisch: "Rallycross (RX)",
    kurz: "Kurze Rennen im Pulk auf gemischten Strecken aus Asphalt und Schotter – mit Sprüngen und Joker-Runde.",
    text: [
      "Rallycross verbindet Rallye und Rundstrecke: Mehrere Fahrzeuge starten gleichzeitig und fahren wenige Runden auf einem kurzen Kurs mit Asphalt- und Schotterabschnitten, oft mit Sprüngen. Die Rennen dauern nur wenige Minuten.",
      "Die Fahrzeuge sind extrem leistungsstark, haben Allradantrieb und beschleunigen schneller als viele Formelfahrzeuge. In jedem Lauf muss jeder Fahrer einmal die Joker-Runde nehmen, eine längere Variante der Strecke – wann, entscheidet er selbst.",
      "Die Wertung läuft über Vorläufe, Halbfinale und Finale. Starts und Zweikämpfe in der ersten Kurve entscheiden oft das ganze Rennen."
    ],
    tipp: "Nimm die Joker-Runde, wenn du in freier Luft fahren kannst oder ein Gegner sie gerade genommen hat – so kommst du im besten Fall vor ihm wieder heraus.",
    siehe: ["joker-lap", "rallye", "allradantrieb", "stehender-start"] },

  { id: "kart", begriff: "Kart und Schaltkart", englisch: "Kart / Shifter Kart",
    kurz: "Kleine, ungefederte Rennfahrzeuge – der klassische Einstieg in den Motorsport.",
    text: [
      "Ein Kart besteht aus einem Rohrrahmen ohne Federung und Differential, einem kleinen Motor und vier Reifen. Weil die Hinterachse starr ist, muss sich das Kart in Kurven leicht verwinden, damit das kurveninnere Hinterrad entlastet wird – der Rahmen ersetzt also die Federung.",
      "Es gibt Klassen mit Kupplungsautomatik und Klassen mit Schaltgetriebe, die sogenannten Schaltkarts. Letztere beschleunigen und verzögern enorm und gelten als körperlich anspruchsvoll.",
      "Fast alle Profis haben im Kart begonnen: Linienwahl, Bremspunkte, Zweikämpfe und das Gefühl für den Grip lernt man hier unmittelbar."
    ],
    tipp: "Im Kart zählt Schwung. Vermeide Rutschen, das kostet sofort Geschwindigkeit, und fahre eher runde, weite Linien.",
    siehe: ["spool", "mindestgeschwindigkeit", "ideallinie"] },

  { id: "mittelmotor", begriff: "Mittelmotor", englisch: "Mid-Engine",
    kurz: "Der Motor sitzt zwischen Fahrer und Hinterachse – für eine ausgeglichene Gewichtsverteilung.",
    text: [
      "Beim Mittelmotor liegt die Masse des Motors nahe am Schwerpunkt des Fahrzeugs. Das verringert das Trägheitsmoment um die Hochachse: Das Auto lenkt bereitwillig ein und dreht sich schnell in die Kurve.",
      "Zudem lastet viel Gewicht auf der Hinterachse, was beim Herausbeschleunigen Traktion bringt. Fast alle Formelfahrzeuge, Prototypen und viele GT-Fahrzeuge sind so gebaut.",
      "Die Kehrseite: Ein Mittelmotorfahrzeug kann im Grenzbereich plötzlich übersteuern. Hat sich das Heck einmal gedreht, ist es wegen der geringen Trägheit schwerer abzufangen."
    ],
    tipp: "Mittelmotorautos belohnen sanfte Lastwechsel. Geh in schnellen Kurven nicht abrupt vom Gas, sonst kommt das Heck schneller, als du korrigieren kannst.",
    siehe: ["traegheitsmoment", "achslastverteilung", "lastwechsel", "frontmotor"] },

  { id: "frontmotor", begriff: "Frontmotor", englisch: "Front-Engine",
    kurz: "Der Motor sitzt vor dem Fahrer – entweder vor oder hinter der Vorderachse.",
    text: [
      "Beim Frontmotor liegt der Motor im Vorderwagen. Sitzt er ganz hinter der Vorderachse, spricht man vom Front-Mittelmotor: Die Masse bleibt nah an der Fahrzeugmitte, das Auto bleibt agil. Liegt er vor der Achse, ist das Auto kopflastiger.",
      "Fahrzeuge mit Frontmotor neigen eher zum Untersteuern und sind beim Einlenken träger. Dafür sind sie im Grenzbereich oft gutmütiger, weil das Heck weniger plötzlich ausbricht.",
      "Viele GT-Fahrzeuge, Tourenwagen und Stock Cars haben einen Frontmotor; mit Transaxle-Bauweise wird das Gewicht trotzdem gleichmäßiger verteilt."
    ],
    tipp: "Mit einem Frontmotorauto lohnt sich Trail Braking besonders: Die Last auf der Vorderachse hilft beim Einlenken gegen das Untersteuern.",
    siehe: ["transaxle", "mittelmotor", "untersteuern", "trail-braking"] },

  { id: "heckmotor", begriff: "Heckmotor", englisch: "Rear-Engine",
    kurz: "Der Motor sitzt hinter der Hinterachse – mit großer Traktion, aber anspruchsvollem Fahrverhalten.",
    text: [
      "Beim Heckmotor hängt der Motor hinter der Hinterachse. Das drückt viel Gewicht auf die angetriebenen Hinterräder und sorgt für hervorragende Traktion und kurze Bremswege, weil beim Bremsen die Last gleichmäßiger verteilt bleibt.",
      "Die Masse weit hinten wirkt jedoch wie ein Pendel: Bricht das Heck aus, dreht sich das Auto schnell. Lastwechsel in Kurven verlangen deshalb viel Gefühl.",
      "Bekannte Sportwagen nutzen dieses Konzept seit Jahrzehnten und haben es mit Fahrwerkstechnik und Aerodynamik gezähmt. Im Rennsport ist es selten, weil Mittelmotoren besser ausbalanciert sind."
    ],
    tipp: "Bremse mit einem Heckmotorauto gerade an, löse die Bremse beim Einlenken gefühlvoll und gib früh wieder dosiert Gas – die Traktion am Ausgang ist deine Stärke.",
    siehe: ["mittelmotor", "lastwechsel", "traktion", "traegheitsmoment"] },

  { id: "frontantrieb", begriff: "Frontantrieb", englisch: "FWD (Front-Wheel Drive)",
    kurz: "Nur die Vorderräder treiben an – sie müssen lenken und beschleunigen zugleich.",
    text: [
      "Beim Frontantrieb übertragen die Vorderräder die Motorkraft. Weil sie gleichzeitig lenken, teilen sie sich ihren Grip zwischen Querführung und Vortrieb – das führt beim Herausbeschleunigen leicht zu Untersteuern.",
      "Frontgetriebene Rennwagen nutzen deshalb Sperrdifferentiale und eine Abstimmung, bei der das Heck bewusst mitlenkt: Ein leicht rutschendes Heck beim Gaswegnehmen hilft, das Auto in die Kurve zu drehen.",
      "Vorteile sind geringe Kosten, wenig Gewicht und Stabilität. In Tourenwagenklassen ist der Frontantrieb verbreitet."
    ],
    tipp: "Nutze beim Frontantrieb das Gaswegnehmen am Kurveneingang, um das Heck leicht zu drehen, und gib am Ausgang erst Vollgas, wenn die Räder fast gerade stehen.",
    siehe: ["tourenwagen", "untersteuern", "sperrdifferential", "lastwechsel"] },

  { id: "heckantrieb", begriff: "Heckantrieb", englisch: "RWD (Rear-Wheel Drive)",
    kurz: "Die Hinterräder treiben an, die Vorderräder lenken – die klassische Form im Rennsport.",
    text: [
      "Beim Heckantrieb sind Lenkung und Antrieb getrennt: Die Vorderräder können ihren ganzen Grip für die Kurvenführung nutzen, die Hinterräder übernehmen den Vortrieb. Beim Beschleunigen verlagert sich das Gewicht nach hinten und unterstützt die Traktion.",
      "Zu viel Gas in der Kurve lässt die Hinterräder durchdrehen und das Heck ausbrechen – das Leistungsübersteuern. Wie viel Gas möglich ist, hängt von Reifen, Differential und Traktionskontrolle ab.",
      "Fast alle Formelfahrzeuge, Prototypen, GT-Fahrzeuge und Stock Cars haben Heckantrieb."
    ],
    tipp: "Öffne beim Herausbeschleunigen die Lenkung, bevor du voll aufs Gas gehst. Je gerader die Räder stehen, desto mehr Leistung verträgt das Heck.",
    siehe: ["power-oversteer", "traktion", "sperrdifferential", "traktionskontrolle"] },

  { id: "allradantrieb", begriff: "Allradantrieb", englisch: "AWD / 4WD",
    kurz: "Alle vier Räder treiben an – maximale Traktion, besonders auf losem Untergrund.",
    text: [
      "Beim Allradantrieb verteilt sich die Motorkraft auf beide Achsen. Jedes Rad muss weniger Kraft übertragen, deshalb rutschen die Reifen seltener durch. Auf Schotter, Schnee und Nässe ist das ein großer Vorteil.",
      "Ein Mitteldifferential oder eine Kupplung regelt, wie die Kraft zwischen vorn und hinten aufgeteilt wird. Eine hecklastige Verteilung macht das Auto agiler, eine gleichmäßige stabiler.",
      "Auf trockenem Asphalt bringen Gewicht und innere Reibung Nachteile; manche Reglements verbieten Allradantrieb, andere gleichen ihn aus. In Rallye und Rallycross ist er Standard."
    ],
    tipp: "Mit Allradantrieb kannst du früher ans Gas – nutze das, um das Auto am Kurvenausgang mit Zug zu stabilisieren, statt im Schiebebetrieb zu rollen.",
    siehe: ["rallye", "rallycross", "differential", "traktion"] },

  { id: "transaxle", begriff: "Transaxle-Bauweise", englisch: "Transaxle",
    kurz: "Motor vorn, Getriebe an der Hinterachse – für eine gleichmäßige Gewichtsverteilung.",
    text: [
      "Bei der Transaxle-Bauweise sitzt der Motor vorn, das Getriebe aber hinten am Differential. Eine Welle im Mitteltunnel verbindet beide. So verteilt sich das Gewicht gleichmäßiger auf beide Achsen als bei einem Getriebe direkt am Motor.",
      "Das Ergebnis ist ein Frontmotorauto mit nahezu ausgeglichener Achslastverteilung, besserer Traktion und weniger Untersteuern. Viele GT-Fahrzeuge mit Frontmotor nutzen dieses Prinzip.",
      "Nachteil sind zusätzliches Gewicht und Bauraum für die Verbindungswelle."
    ],
    tipp: "Ein Transaxle-Auto fährt sich meist ausgewogener als ein klassischer Fronttriebler – erwarte weniger Untersteuern und nutze die Traktion am Ausgang.",
    siehe: ["frontmotor", "achslastverteilung", "achsantrieb"] },

  { id: "leistungsgewicht", begriff: "Leistungsgewicht", englisch: "Power-to-Weight Ratio",
    kurz: "Wie viel Masse jede Pferdestärke oder jedes Kilowatt bewegen muss – ein Maß für die Beschleunigung.",
    text: [
      "Das Leistungsgewicht ist das Verhältnis aus Fahrzeuggewicht und Motorleistung, etwa in Kilogramm je PS. Je kleiner der Wert, desto stärker beschleunigt das Auto. Ein GT3-Fahrzeug liegt grob bei 2 bis 2,5 kg/PS, ein Formelfahrzeug der Spitzenklasse deutlich unter 1 kg/PS.",
      "Für die Kurvengeschwindigkeit ist Gewicht zusätzlich wichtig: Ein leichteres Auto braucht weniger Grip für dieselbe Kurve, bremst kürzer und schont die Reifen.",
      "Die Balance of Performance und Erfolgsballast verändern genau dieses Verhältnis, um unterschiedliche Fahrzeuge anzugleichen."
    ],
    tipp: "Volltanken macht dein Auto schwerer: Mit 100 Litern Kraftstoff fährst du spürbar langsamer als mit 20. Berücksichtige das beim Vergleich von Rundenzeiten.",
    siehe: ["leistung", "bop", "erfolgsballast", "tankmenge"] },

  { id: "ungefederte-masse", begriff: "Ungefederte Masse", englisch: "Unsprung Mass",
    kurz: "Alle Teile, die nicht von den Federn getragen werden: Räder, Reifen, Bremsen, Radträger.",
    text: [
      "Zur ungefederten Masse gehören Reifen, Felgen, Bremsscheiben, Bremssättel, Radträger und Teile der Querlenker. Diese Masse muss jeder Bodenwelle direkt folgen, ohne dass die Federn sie abfangen.",
      "Je geringer sie ist, desto schneller folgt das Rad der Fahrbahn und desto gleichmäßiger bleibt der Reifenkontakt. Das verbessert Grip und Traktion auf unebenen Strecken und entlastet die Dämpfer.",
      "Deshalb nutzen Rennwagen leichte Felgen, Bremsen aus Kohlefaser oder leichten Legierungen und kompakte Radträger."
    ],
    tipp: "Auf welligen Strecken hilft eine weichere Abstimmung der schnellen Dämpferbewegungen, damit die ungefederte Masse den Bodenwellen folgen kann.",
    siehe: ["gefederte-masse", "daempfer", "high-speed-druckstufe", "radnabe"] },

  { id: "gefederte-masse", begriff: "Gefederte Masse", englisch: "Sprung Mass",
    kurz: "Alles, was von den Federn getragen wird: Chassis, Motor, Fahrer, Kraftstoff.",
    text: [
      "Die gefederte Masse umfasst Karosserie, Monocoque, Motor, Getriebe, Fahrer und Tankinhalt. Sie ruht auf den Federn und bewegt sich mit Wanken, Nicken und Heben.",
      "Federn, Dämpfer und Stabilisatoren werden auf diese Masse abgestimmt: Eine schwere gefederte Masse braucht härtere Federn, um die gleiche Bewegung zu erreichen. Verändert sich die Masse – etwa durch abnehmenden Kraftstoff –, verändern sich Fahrhöhe und Balance.",
      "Das Verhältnis zwischen gefederter und ungefederter Masse bestimmt, wie gut ein Fahrwerk Unebenheiten schluckt."
    ],
    tipp: "Mit leerer werdendem Tank hebt sich das Auto etwas an. Beachte das bei Fahrzeugen, die empfindlich auf die Fahrhöhe reagieren.",
    siehe: ["ungefederte-masse", "federrate", "fahrzeughoehe", "schwerpunkt"] },

  { id: "traegheitsmoment", begriff: "Trägheitsmoment", englisch: "Moment of Inertia / Yaw Inertia",
    kurz: "Wie stark sich ein Fahrzeug einer Drehbewegung widersetzt – entscheidend für Einlenken und Stabilität.",
    text: [
      "Das Trägheitsmoment hängt davon ab, wie weit die Massen vom Drehpunkt entfernt liegen. Für das Fahrverhalten ist vor allem die Drehung um die Hochachse wichtig, das sogenannte Gierträgheitsmoment.",
      "Liegen schwere Teile nah an der Fahrzeugmitte, ist das Trägheitsmoment klein: Das Auto dreht sich willig in Kurven, reagiert aber auch nervös. Liegen sie weit vorn und hinten, ist es groß: Das Auto ist stabil, braucht aber mehr Kraft zum Einlenken.",
      "Konstrukteure platzieren deshalb Motor, Tank, Batterie und Ballast möglichst zentral. In Simulationen bestimmt das Trägheitsmoment, wie schnell ein Dreher kommt und wie gut er sich abfangen lässt."
    ],
    tipp: "Wenn ein Auto beim Einlenken träge wirkt, aber stabil bleibt, hat es ein großes Trägheitsmoment – hier hilft frühes, entschlossenes Einlenken mehr als Setup-Änderungen.",
    siehe: ["mittelmotor", "schwerpunkt", "gierratensensor", "radstand"] },
]);
