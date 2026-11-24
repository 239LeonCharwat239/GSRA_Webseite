// GSRA – Nachschlagewerk: Rennbetrieb, Sicherheit & Teamstrukturen (ergänzt 24.11.2026)
import { kategorie } from "./begriff";

export const RENNBETRIEB = kategorie("Rennbetrieb, Sicherheit & Team", [
  { id: "renningenieur", begriff: "Renningenieur", englisch: "Race Engineer",
    kurz: "Die direkte Ansprechperson des Fahrers, die Abstimmung, Strategie und Funk zusammenführt.",
    text: [
      "Der Renningenieur ist das Bindeglied zwischen Fahrer und Team. Er übersetzt die Rückmeldungen des Fahrers in Setup-Änderungen, bespricht Ablauf und Ziele jeder Sitzung und spricht im Rennen über Funk mit ihm.",
      "Im Rennen gibt er Abstände, Rundenzeiten der Gegner, Reifen- und Kraftstoffzustand, Strafen und Strategieentscheidungen durch. Er entscheidet mit dem Strategen über Boxenstopps und hält den Fahrer ruhig, wenn es hektisch wird.",
      "Ein guter Renningenieur kennt seinen Fahrer genau: wann er Informationen braucht, wann er Ruhe braucht und wie er Kritik aufnimmt. Die GSRA plant einen KI-Renningenieur, der diese Rolle im Simracing übernimmt."
    ],
    tipp: "Auch ohne Team kannst du dir einen Renningenieur schaffen: Ein Freund im Sprachkanal mit Blick auf die Abstände und den Stintplan nimmt dir im Langstreckenrennen viel Arbeit ab.",
    siehe: ["boxenfunk", "strategie-ingenieur", "performance-engineer", "daten-ingenieur"] },

  { id: "performance-engineer", begriff: "Performance-Ingenieur", englisch: "Performance Engineer",
    kurz: "Analysiert, wie Fahrer und Auto schneller werden – vor allem anhand der Daten.",
    text: [
      "Der Performance-Ingenieur konzentriert sich auf das Tempo: Er vergleicht die Runden des eigenen Fahrers mit denen von Teamkollegen und Gegnern, findet Kurven mit Potenzial und schlägt Änderungen an Fahrstil und Setup vor.",
      "Zwischen den Sitzungen bereitet er Datenvergleiche vor, zeigt dem Fahrer Bremspunkte, Linien und Gaspedalverläufe und hilft dem Renningenieur bei der Abstimmung. Im Rennen beobachtet er Reifen, Energie und Temperaturen.",
      "In kleineren Teams übernimmt der Renningenieur diese Aufgabe oft mit."
    ],
    tipp: "Sieh dir nach jeder Sitzung drei Kurven an, in denen du am meisten verlierst – genau so arbeitet ein Performance-Ingenieur.",
    siehe: ["renningenieur", "daten-ingenieur", "telemetrie", "delta"] },

  { id: "daten-ingenieur", begriff: "Daten-Ingenieur", englisch: "Data Engineer",
    kurz: "Sorgt dafür, dass alle Messdaten zuverlässig aufgezeichnet, übertragen und auswertbar sind.",
    text: [
      "Der Daten-Ingenieur ist für Sensoren, Datenlogger, Live-Übertragung und Auswertungssoftware zuständig. Er prüft vor jeder Sitzung, ob alle Kanäle sauber messen, kalibriert Sensoren und richtet Berechnungen und Warnschwellen ein.",
      "Während der Fahrt überwacht er die Live-Daten auf Auffälligkeiten – sinkenden Öldruck, steigende Temperaturen, ungewöhnliche Reifendrücke – und warnt das Team, bevor ein Schaden entsteht.",
      "Je mehr Daten ein Team sammelt, desto wichtiger wird diese Rolle; ohne saubere Daten ist jede Analyse wertlos."
    ],
    tipp: "Prüfe vor einem wichtigen Rennen, ob deine Telemetrie-Programme die Simulation erkennen und aufzeichnen – im Rennen ist es dafür zu spät.",
    siehe: ["datenlogger", "telemetrie-kanal", "performance-engineer"] },

  { id: "strategie-ingenieur", begriff: "Stratege", englisch: "Strategist",
    kurz: "Plant Boxenstopps, Reifen und Kraftstoff und reagiert auf Safety Cars und Wetter.",
    text: [
      "Der Stratege berechnet vor dem Rennen mögliche Abläufe: Wann wird gestoppt, welche Reifen, wie viel Kraftstoff, wer fährt wann. Dazu nutzt er Daten zu Reifenabbau, Verbrauch, Boxenstopp-Verlust und Überholmöglichkeiten.",
      "Im Rennen passt er den Plan laufend an: an Safety-Car-Phasen, Wetterwechsel, Strafen und die Strategien der Gegner. Ein Undercut oder Overcut entscheidet oft über Positionen, die auf der Strecke nicht zu gewinnen wären.",
      "Der Stratege arbeitet eng mit dem Renningenieur zusammen, der seine Entscheidungen an den Fahrer weitergibt."
    ],
    tipp: "Plane vor jedem Langstreckenrennen einen Plan B – etwa für ein frühes Safety Car. Mit dem Stint-Planer der GSRA lassen sich beide Varianten in Sekunden durchrechnen.",
    siehe: ["boxenfenster", "undercut", "overcut", "safety-car"] },

  { id: "rennleiter", begriff: "Rennleiter", englisch: "Race Director",
    kurz: "Die verantwortliche Person für den sicheren und regelgerechten Ablauf einer Veranstaltung.",
    text: [
      "Der Rennleiter steuert das Geschehen auf der Strecke: Er gibt Sitzungen frei, lässt Flaggen zeigen, schickt Safety Car und Bergungsfahrzeuge, unterbricht Rennen bei Gefahr und meldet Vorfälle an die Rennkommissare.",
      "Er sitzt in der Rennleitung mit Bildern aller Streckenkameras und steht in Funkkontakt mit den Streckenposten. Seine Entscheidungen müssen schnell fallen – oft in Sekunden.",
      "In Online-Rennen übernehmen Admins der Liga oder die Simulation selbst diese Aufgabe."
    ],
    tipp: "Lies vor jedem Liga-Rennen die Ausschreibung: Wie werden Gelbphasen gehandhabt, welche Strafen gibt es? So vermeidest du Überraschungen.",
    siehe: ["rennkommissare", "streckenposten", "safety-car", "rote-flagge"] },

  { id: "rennkommissare", begriff: "Rennkommissare", englisch: "Stewards",
    kurz: "Unabhängige Sportrichter, die Vorfälle untersuchen und Strafen verhängen.",
    text: [
      "Die Rennkommissare entscheiden über Regelverstöße: Kollisionen, Überschreitungen der Streckenbegrenzung, zu schnelles Fahren in der Boxengasse, unerlaubte Technik. Sie sehen sich Videos und Daten an, hören Beteiligte an und verhängen Strafen von der Verwarnung bis zur Disqualifikation.",
      "Sie arbeiten unabhängig von der Rennleitung, die den Ablauf steuert. Ihre Entscheidungen können mit einem Protest oder einer Berufung angefochten werden.",
      "In Simracing-Ligen übernehmen oft Freiwillige diese Rolle und prüfen Vorfälle anhand der Wiederholungen."
    ],
    tipp: "Melde Vorfälle sachlich mit Runde und Kurve und füge die Stelle aus der Wiederholung hinzu – so können Kommissare schnell und fair entscheiden.",
    siehe: ["rennleiter", "protest-berufung", "zeitstrafe", "verwarnung"] },

  { id: "streckenposten", begriff: "Streckenposten", englisch: "Marshals",
    kurz: "Die Helferinnen und Helfer an der Strecke, die Flaggen zeigen, bergen und bei Unfällen helfen.",
    text: [
      "Streckenposten stehen an festen Posten entlang der Strecke. Sie zeigen Flaggen, melden Vorfälle an die Rennleitung, löschen Brände, räumen Trümmer und bergen liegengebliebene Fahrzeuge.",
      "Bei Unfällen sind sie oft als Erste beim Fahrzeug, schalten die Elektrik ab und helfen dem Fahrer. Ohne sie wäre kein Rennen möglich – sie arbeiten meist ehrenamtlich.",
      "Gelbe Flaggen bedeuten, dass Posten oder Fahrzeuge in Gefahr sein können. Wer dort nicht verlangsamt, gefährdet Menschenleben und wird hart bestraft."
    ],
    tipp: "Nimm gelbe Flaggen auch in der Simulation ernst – Liga-Kommissare werten Überholen unter Gelb streng.",
    siehe: ["gelbe-flagge", "doppelt-gelb", "kill-switch", "rennleiter"] },

  { id: "technische-abnahme", begriff: "Technische Abnahme", englisch: "Scrutineering",
    kurz: "Die Kontrolle, ob ein Fahrzeug dem technischen Reglement und den Sicherheitsvorschriften entspricht.",
    text: [
      "Vor einer Veranstaltung prüfen technische Kommissare jedes Fahrzeug: Sicherheitszelle, Gurte, Sitz, Feuerlöscher, Hauptschalter, Gewicht, Maße und vorgeschriebene Bauteile. Erst nach bestandener Abnahme darf das Auto fahren.",
      "Nach dem Rennen werden Fahrzeuge erneut kontrolliert, häufig im Parc fermé: Mindestgewicht, Bodenfreiheit, Flügel, Kraftstoffproben, versiegelte Teile. Verstöße führen bis zur Disqualifikation.",
      "Auch die Fahrerausrüstung – Helm, Overall, Kopf- und Nackenschutz – wird geprüft."
    ],
    tipp: "In Simulationen mit festem Setup übernimmt das Programm die Abnahme. In offenen Ligen lohnt ein Blick ins Reglement, welche Setup-Bereiche erlaubt sind.",
    siehe: ["parc-ferme", "homologation", "disqualifikation", "fixed-setup"] },

  { id: "parc-ferme", begriff: "Parc fermé", englisch: "Parc Fermé",
    kurz: "Ein abgesperrter Bereich, in dem Fahrzeuge nach der Sitzung nicht verändert werden dürfen.",
    text: [
      "Parc fermé heißt „geschlossener Park“. Nach Qualifying oder Rennen werden die Fahrzeuge dort abgestellt; Teams dürfen sie nur unter Aufsicht und nur für erlaubte Arbeiten berühren. So stellen die Kommissare sicher, dass niemand nach dem Messen noch etwas verändert.",
      "In manchen Serien gelten Parc-fermé-Regeln schon vom Qualifying bis zum Rennen: Das Setup darf dann nicht mehr geändert werden. Wer es doch tut, muss oft aus der Boxengasse starten.",
      "Nach dem Rennen dient der Parc fermé der technischen Nachkontrolle, etwa beim Wiegen."
    ],
    tipp: "Gilt in deiner Liga ein Parc fermé zwischen Qualifying und Rennen, stimme dein Qualifying-Setup schon auf den Rennstint ab.",
    siehe: ["technische-abnahme", "qualifying", "setup"] },

  { id: "fahrerbesprechung", begriff: "Fahrerbesprechung", englisch: "Briefing / Drivers' Briefing",
    kurz: "Die Besprechung vor dem Rennen, in der Rennleitung und Fahrer Abläufe und Regeln klären.",
    text: [
      "In der Fahrerbesprechung erläutert die Rennleitung den Ablauf: Startverfahren, Streckenbegrenzungen, besondere Stellen der Strecke, Safety-Car-Regeln, Boxengassenvorschriften und aktuelle Hinweise. Die Teilnahme ist meist Pflicht.",
      "Fahrer können Fragen stellen und Unklarheiten ansprechen, bevor sie zu Strafen führen. Änderungen am Reglement oder an der Strecke werden hier verbindlich bekannt gegeben.",
      "In Simracing-Ligen findet die Besprechung oft im Sprachkanal kurz vor dem Rennen statt."
    ],
    tipp: "Notiere dir aus der Besprechung die drei wichtigsten Punkte – etwa Streckenbegrenzungen an bestimmten Kurven. Im Rennen erinnerst du dich sonst nicht mehr daran.",
    siehe: ["rennleiter", "track-limits", "formationsrunde"] },

  { id: "hans", begriff: "Kopf- und Nackenschutz", englisch: "HANS (Head and Neck Support)",
    kurz: "Eine Stütze auf den Schultern, die bei einem Aufprall Kopf und Hals vor gefährlichen Belastungen schützt.",
    text: [
      "Das System besteht aus einem Kragen, der auf den Schultern liegt und unter den Gurten fixiert wird, und Haltebändern, die ihn mit dem Helm verbinden. Bei einem Frontalaufprall verhindert es, dass der Kopf weit nach vorn schleudert, während der Körper von den Gurten gehalten wird.",
      "So sinken die Kräfte auf die Halswirbelsäule drastisch; Schädelbasisbrüche, früher eine häufige Todesursache im Motorsport, sind seltener geworden. In fast allen Rennserien ist ein solcher Schutz heute vorgeschrieben.",
      "Sitz, Gurte und Helm müssen dazu passen – nur das Zusammenspiel schützt wirksam."
    ],
    tipp: "Fährst du echte Trackdays oder Rennen, lass Sitzposition, Gurte und Kopf- und Nackenschutz gemeinsam einstellen – einzeln richtig ist nicht automatisch zusammen richtig.",
    siehe: ["sicherheitsgurt", "schalensitz", "halo-aeroscreen"] },

  { id: "halo-aeroscreen", begriff: "Cockpitschutz (Halo und Aeroscreen)", englisch: "Halo / Aeroscreen",
    kurz: "Bügel oder Scheibe über dem offenen Cockpit, die den Kopf des Fahrers vor Teilen und Fahrzeugen schützen.",
    text: [
      "Der Halo ist ein bügelförmiger Rahmen aus Titan, der sich über dem Cockpit eines Formelfahrzeugs wölbt. Er hält enormen Lasten stand und schützt den Kopf vor umherfliegenden Teilen, Reifen und anderen Fahrzeugen.",
      "Der Aeroscreen ergänzt einen solchen Rahmen um eine Scheibe aus schlagfestem Kunststoff, die auch kleinere Teile abhält. Er wird vor allem bei Fahrzeugen eingesetzt, die auf Ovalen sehr hohe Geschwindigkeiten erreichen.",
      "Anfangs wegen der Optik umstritten, gelten beide Systeme heute als Lebensretter."
    ],
    tipp: "Der Halo verdeckt in der Simulation einen Teil der Sicht. Stelle dein Sichtfeld so ein, dass die Mittelstrebe zwischen deinen Augen verschwindet – dann stört sie kaum.",
    siehe: ["monoposto", "fov", "hans"] },

  { id: "ueberrollkaefig", begriff: "Überrollkäfig", englisch: "Roll Cage",
    kurz: "Ein Rohrgerüst im Fahrzeug, das bei Überschlägen und Aufprallen den Innenraum schützt.",
    text: [
      "In Rennfahrzeugen, die auf Serienautos basieren, wird ein Käfig aus Stahlrohren in die Karosserie geschweißt. Er bildet eine Sicherheitszelle um den Fahrer, die sich bei Überschlägen und seitlichen Einschlägen kaum verformt.",
      "Zusätzlich versteift der Käfig die Karosserie, was Fahrwerk und Fahrverhalten präziser macht. Reglements schreiben Rohrdurchmesser, Materialien und Verlauf genau vor.",
      "Formelfahrzeuge und Prototypen mit Kohlefaser-Monocoque haben stattdessen Überrollbügel und eine Sicherheitszelle aus Verbundwerkstoff."
    ],
    tipp: "Im Fahrzeug mit Überrollkäfig sind Polster an den Rohren in Kopfnähe Pflicht – achte bei Cockpit-Ansichten in der Simulation auf diese Details, sie zeigen, wie nah der Kopf am Käfig ist.",
    siehe: ["chassissteifigkeit", "monocoque", "schalensitz"] },

  { id: "schalensitz", begriff: "Schalensitz", englisch: "Bucket Seat",
    kurz: "Ein fest montierter Rennsitz, der den Fahrer seitlich stützt und bei Aufprallen hält.",
    text: [
      "Der Schalensitz umschließt Becken, Rippen und Schultern und hält den Körper bei hohen Querkräften an seinem Platz. So kann der Fahrer Lenkrad und Pedale präzise bedienen, statt sich festhalten zu müssen.",
      "Im Rennsport wird der Sitz oft individuell an den Fahrer angepasst, etwa mit einer Schaumfüllung. Kopfstützen seitlich am Sitz schützen bei seitlichen Einschlägen.",
      "Auch das Gefühl für das Auto kommt zum großen Teil über den Sitz: Bewegungen des Hecks spürt der Fahrer zuerst im Rücken."
    ],
    tipp: "Ein fester Sitz im Simracing-Cockpit macht dich präziser: Wenn du nicht rutschst, dosierst du Bremse und Lenkung gleichmäßiger.",
    siehe: ["sicherheitsgurt", "hans", "motion-rig"] },

  { id: "sicherheitsgurt", begriff: "Rennsportgurt", englisch: "Racing Harness (6-Point)",
    kurz: "Ein Gurtsystem mit mehreren Befestigungspunkten, das den Fahrer fest im Sitz hält.",
    text: [
      "Rennsportgurte haben meist sechs Befestigungspunkte: zwei Schultergurte, zwei Beckengurte und zwei Schrittgurte. Sie laufen in einem zentralen Schloss zusammen, das sich mit einem Handgriff öffnen lässt.",
      "Der Gurt hält den Körper bei einem Aufprall im Sitz und arbeitet mit dem Kopf- und Nackenschutz zusammen. Die Schrittgurte verhindern, dass der Fahrer unter dem Beckengurt durchrutscht.",
      "Gurte altern: Sie sind homologiert und haben ein Ablaufdatum, nach dem sie ersetzt werden müssen."
    ],
    tipp: "Für den Schutz entscheidend ist der Winkel der Schultergurte – zu steil nach unten geführt, drücken sie bei einem Aufprall auf die Wirbelsäule.",
    siehe: ["hans", "schalensitz", "homologation"] },

  { id: "feuerloeschanlage", begriff: "Feuerlöschanlage", englisch: "Fire Suppression System",
    kurz: "Ein fest eingebautes Löschsystem, das im Notfall Cockpit und Motorraum flutet.",
    text: [
      "Die Anlage besteht aus einem Löschmittelbehälter und Düsen, die auf Cockpit und Motorraum gerichtet sind. Ausgelöst wird sie vom Fahrer über einen Knopf oder Zug und von außen durch Streckenposten.",
      "Sie verschafft dem Fahrer wertvolle Sekunden, um das Fahrzeug zu verlassen, und dämmt einen Brand ein, bis Helfer eintreffen. Zusammen mit feuerfester Kleidung und Sicherheitstanks hat sie Brandunfälle im Motorsport deutlich seltener und weniger gefährlich gemacht.",
      "Die Auslöser sind wie der Hauptschalter außen am Fahrzeug gekennzeichnet."
    ],
    tipp: "Kennst du in deinem echten Fahrzeug den Auslöser blind? Übe die Handgriffe für Gurtschloss, Lenkrad und Löschanlage, bevor du sie im Ernstfall brauchst.",
    siehe: ["kill-switch", "streckenposten", "schnellverschluss-lenkrad"] },

  { id: "schnellverschluss-lenkrad", begriff: "Schnellverschluss am Lenkrad", englisch: "Quick Release",
    kurz: "Eine Kupplung, mit der sich das Lenkrad mit einem Handgriff abnehmen lässt.",
    text: [
      "In engen Rennwagen kommt der Fahrer nur ohne Lenkrad ins Cockpit und wieder heraus. Der Schnellverschluss verbindet Lenkrad und Lenksäule und lässt sich durch Ziehen eines Rings lösen.",
      "Bei Unfällen ist das lebenswichtig: Der Fahrer muss das Fahrzeug in wenigen Sekunden verlassen können. Viele Reglements verlangen, dass er das Auto mit abgenommenem Lenkrad in einer festgelegten Zeit verlassen kann.",
      "Moderne Lenkräder übertragen über den Verschluss zugleich Strom und Daten für Display und Tasten."
    ],
    tipp: "Auch im Simracing-Cockpit lohnt ein Schnellverschluss: Du wechselst zwischen Formel- und GT-Lenkrad in Sekunden, ohne Schrauben zu lösen.",
    siehe: ["lenkraddisplay", "feuerloeschanlage", "direct-drive"] },

  { id: "homologation", begriff: "Homologation", englisch: "Homologation",
    kurz: "Die offizielle Zulassung eines Fahrzeugs oder Bauteils für den Einsatz in einer Rennklasse.",
    text: [
      "Bevor ein Fahrzeug in einer Klasse antreten darf, muss der Hersteller es homologieren lassen. Dabei werden Maße, Gewicht, Motor, Aerodynamik und Bauteile in einem Dokument festgehalten; Abweichungen sind danach nur noch in engen Grenzen erlaubt.",
      "Auch Sicherheitsausrüstung wie Helme, Overalls, Sitze und Gurte ist homologiert – mit Prüfnorm und oft mit Ablaufdatum.",
      "Für die Balance of Performance ist die Homologation die Ausgangsbasis: Auf ihr bauen die Einstufungen von Gewicht und Leistung auf."
    ],
    tipp: "Neue Fahrzeugversionen in Simulationen entsprechen oft einer neuen Homologation – prüfe nach Updates, ob dein bewährtes Setup noch passt.",
    siehe: ["bop", "technische-abnahme", "gt-klassen"] },

  { id: "joker-lap", begriff: "Joker-Runde", englisch: "Joker Lap",
    kurz: "Eine längere Streckenvariante, die jeder Fahrer im Rennen genau einmal fahren muss.",
    text: [
      "Die Joker-Runde stammt aus dem Rallycross. Ein zusätzlicher Streckenabschnitt verlängert die Runde um einige Sekunden; jeder Fahrer muss ihn pro Lauf genau einmal nehmen, darf den Zeitpunkt aber selbst wählen.",
      "Dadurch entsteht Taktik: Wer früh jokert, fährt danach in freier Luft; wer spät jokert, kann einen Gegner unter Druck setzen und hoffen, vor ihm wieder herauszukommen. Wer die Joker-Runde vergisst oder doppelt nimmt, wird bestraft.",
      "Das Prinzip erinnert an einen Pflichtboxenstopp und erzeugt Überholmanöver ohne direkten Zweikampf."
    ],
    tipp: "Jokere, wenn du hinter einem langsameren Auto festhängst – mit freier Bahn holst du die Zeit oft wieder auf.",
    siehe: ["rallycross", "undercut", "boxenfenster"] },

  { id: "erfolgsballast", begriff: "Erfolgsballast", englisch: "Success Ballast",
    kurz: "Zusätzliches Gewicht für erfolgreiche Fahrer oder Teams, um die Meisterschaft spannend zu halten.",
    text: [
      "In manchen Meisterschaften erhalten Fahrzeuge nach guten Ergebnissen zusätzliches Gewicht, das im Auto verbaut wird. Wer gewinnt, fährt beim nächsten Rennen schwerer; schwache Ergebnisse bauen den Ballast wieder ab.",
      "Mehr Gewicht kostet Beschleunigung, verlängert Bremswege, belastet die Reifen und erhöht den Verbrauch. Schon zehn Kilogramm machen sich in der Rundenzeit bemerkbar.",
      "Ziel ist eine ausgeglichene Meisterschaft. Kritiker bemängeln, dass Erfolg bestraft wird – Befürworter verweisen auf engere Rennen."
    ],
    tipp: "Fährst du mit Erfolgsballast, schone die Reifen bewusst: Das zusätzliche Gewicht beschleunigt den Abbau, besonders an der Achse, über der der Ballast sitzt.",
    siehe: ["bop", "leistungsgewicht", "reifenabbau"] },

  { id: "protest-berufung", begriff: "Protest und Berufung", englisch: "Protest / Appeal",
    kurz: "Die Wege, Entscheidungen oder das Verhalten anderer offiziell überprüfen zu lassen.",
    text: [
      "Mit einem Protest beantragt ein Team bei den Rennkommissaren, einen Vorfall oder ein Fahrzeug zu überprüfen – etwa wegen einer Kollision oder des Verdachts auf unerlaubte Technik. Ein Protest ist an Fristen und meist an eine Gebühr gebunden.",
      "Gegen Entscheidungen der Kommissare kann ein Team Berufung einlegen. Dann prüft ein übergeordnetes Gericht des Verbandes den Fall erneut. Bis zur Entscheidung kann ein Ergebnis vorläufig sein.",
      "In Simracing-Ligen gibt es ähnliche Verfahren mit Meldeformularen und Fristen."
    ],
    tipp: "Halte dich bei Meldungen an die Fristen deiner Liga und bleibe sachlich – gut begründete Proteste mit Video und Zeitangabe haben die besten Chancen.",
    siehe: ["rennkommissare", "verwarnung", "disqualifikation"] },

  { id: "verwarnung", begriff: "Verwarnung", englisch: "Reprimand",
    kurz: "Eine formelle Rüge der Kommissare ohne Zeitstrafe – mehrere davon können aber eine Strafe auslösen.",
    text: [
      "Eine Verwarnung wird für leichtere Verstöße ausgesprochen, etwa unsportliches Verhalten, kleinere Regelverstöße in der Boxengasse oder das Missachten von Anweisungen. Sie hat zunächst keine Folgen für das Ergebnis.",
      "In vielen Serien werden Verwarnungen jedoch über die Saison gesammelt: Ab einer bestimmten Anzahl folgt eine Rückversetzung in der Startaufstellung oder eine Sperre. Ähnlich wirken Strafpunkte auf der Lizenz.",
      "Für Fahrer ist die Verwarnung damit ein deutliches Signal, das eigene Verhalten zu ändern."
    ],
    tipp: "Sammelt sich bei dir eine zweite Verwarnung an, fahre in den nächsten Rennen besonders defensiv – die nächste kann schon eine echte Strafe bedeuten.",
    siehe: ["schwarz-weisse-flagge", "rennkommissare", "zeitstrafe", "incident-points"] },

  { id: "schwarz-weisse-flagge", begriff: "Schwarz-weiße Flagge", englisch: "Black-and-White Flag",
    kurz: "Diagonal geteilte Flagge, mit der ein Fahrer wegen unsportlichen Verhaltens verwarnt wird.",
    text: [
      "Die schwarz-weiß diagonal geteilte Flagge wird zusammen mit der Startnummer gezeigt. Sie bedeutet: Dieses Verhalten wurde bemerkt – bei einer Wiederholung folgt eine Strafe. Typische Anlässe sind wiederholte Verstöße gegen die Streckenbegrenzung, mehrfaches Richtungswechseln in der Verteidigung oder gefährliches Fahren.",
      "Die Flagge selbst ist noch keine Strafe, sondern eine letzte Warnung. Viele Simulationen zeigen sie, wenn Fahrer häufig die Strecke verlassen oder Kollisionen verursachen.",
      "Wer sie ignoriert, bekommt meist eine Durchfahrtsstrafe oder sogar die schwarze Flagge."
    ],
    tipp: "Siehst du diese Flagge, ändere dein Verhalten sofort – etwa durch etwas mehr Abstand zu den Randsteinen, an denen du die Strecke verlassen hast.",
    siehe: ["schwarze-flagge", "track-limits", "verwarnung", "drive-through"] },
]);
