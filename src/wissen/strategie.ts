// GSRA – Nachschlagewerk: Renntaktik, Strategie & Regeln
import { kategorie } from "./begriff";

export const STRATEGIE = kategorie("Renntaktik, Strategie & Regeln", [
  { id: "stint", begriff: "Stint", englisch: "Stint",
    kurz: "Abschnitt eines Rennens zwischen zwei Boxenstopps.",
    text: [
      "Ein Stint beginnt mit dem Verlassen der Box und endet mit dem nächsten Stopp. Seine Länge hängt von Tankgröße, Kraftstoffverbrauch, Reifenabbau und Reglement ab.",
      "In Langstreckenrennen wird mit dem Begriff auch die Fahrzeit eines Fahrers bezeichnet: Ein Fahrer kann einen oder mehrere Stints am Stück fahren, bevor er übergibt. Viele Reglements legen Mindest- und Höchstfahrzeiten fest.",
      "Die Planung der Stints ist das Herzstück jeder Rennstrategie: Wie viele Stopps, wann, mit welchen Reifen und welchem Fahrer?"
    ],
    tipp: "Grundlage jeder Stintplanung ist der genaue Verbrauch pro Runde und der Reifenabbau. Miss beides im Training über mehrere Runden – der GSRA-Stint-Planer rechnet damit.",
    siehe: ["boxenstopp", "double-stint", "tankmenge", "reifenabbau"] },

  { id: "boxenstopp", begriff: "Boxenstopp", englisch: "Pit Stop",
    kurz: "Halt in der Box zum Tanken, Reifenwechsel, Fahrerwechsel oder für Reparaturen.",
    text: [
      "Beim Boxenstopp fährt das Auto in die Boxengasse, hält an seinem Platz und wird versorgt. Je nach Serie werden Reifen gewechselt, Kraftstoff nachgefüllt, Fahrer getauscht, Schäden repariert oder Einstellungen verändert.",
      "Die Zeit, die ein Stopp insgesamt kostet, setzt sich aus der Fahrt durch die Boxengasse und der Standzeit zusammen. Ob Tanken, Reifenwechsel und Fahrerwechsel gleichzeitig oder nacheinander erfolgen, regelt das Reglement – das verändert die Standzeit erheblich.",
      "In Simulationen legt man die Arbeiten meist vor der Einfahrt im Boxenmenü fest."
    ],
    tipp: "Stelle das Boxenmenü schon auf der Geraden vor der Einfahrt ein, nicht erst in der Boxengasse. Prüfe die Kraftstoffmenge besonders genau – zu viel kostet Zeit, zu wenig das Rennen.",
    siehe: ["boxengasse", "boxenstopp-verlust", "fahrerwechsel", "tankmenge"] },

  { id: "boxengasse", begriff: "Boxengasse", englisch: "Pit Lane",
    kurz: "Bereich neben der Strecke mit den Boxen der Teams und Tempolimit.",
    text: [
      "Die Boxengasse verläuft parallel zur Start-Ziel-Geraden. Hier stehen die Boxen der Teams, und hier finden alle Boxenstopps statt. Es gilt ein Tempolimit, das mit dem Boxengassenbegrenzer eingehalten wird.",
      "Linien markieren Einfahrt und Ausfahrt. Wer sie überfährt, wo es verboten ist, wer zu schnell fährt oder andere gefährdet, erhält eine Strafe. Bei manchen Serien ist die Boxengasse in bestimmten Phasen geschlossen.",
      "Die Länge der Boxengasse und das Tempolimit bestimmen, wie viel Zeit ein Stopp kostet."
    ],
    tipp: "Lerne für jede Strecke, wo die Linien der Ein- und Ausfahrt liegen und wann du den Begrenzer aktivieren musst.",
    siehe: ["pit-limiter", "boxeneinfahrt", "boxenstopp-verlust"] },

  { id: "boxeneinfahrt", begriff: "Boxeneinfahrt und Boxenausfahrt", englisch: "Pit Entry / Pit Exit",
    kurz: "Die Zu- und Abfahrt der Boxengasse, meist mit Linien und Regeln markiert.",
    text: [
      "Die Boxeneinfahrt zweigt meist vor der letzten Kurve oder auf der Start-Ziel-Geraden von der Strecke ab. Eine durchgezogene Linie markiert, wo sie beginnt und wo das Tempolimit einsetzt.",
      "An der Ausfahrt trennt eine Linie das herauskommende Auto vom Verkehr auf der Strecke. Sie darf nicht überfahren werden, bis das Ende markiert ist. Wer zu früh einschert, riskiert eine Strafe und eine Kollision.",
      "Ein guter Ein- und Ausfahrtsablauf spart Zehntelsekunden bei jedem Stopp."
    ],
    tipp: "Kündige deine Einfahrt an, indem du rechtzeitig die Linie wählst und niemanden schneidest. Achte beim Herausfahren auf den Verkehr hinter dir.",
    siehe: ["boxengasse", "pit-limiter", "outlap"] },

  { id: "boxenstopp-verlust", begriff: "Boxenstopp-Verlust", englisch: "Pit Loss",
    kurz: "Gesamtzeit, die ein Stopp im Vergleich zum Durchfahren kostet.",
    text: [
      "Der Boxenstopp-Verlust umfasst die langsamere Fahrt durch die Boxengasse und die Standzeit. Er wird ermittelt, indem man die Zeit vom Beginn der Einfahrt bis zum Ende der Ausfahrt mit der Zeit vergleicht, die man für dieselbe Strecke auf der Fahrbahn benötigt hätte.",
      "Diese Zahl ist entscheidend für die Strategie: Sie zeigt, ob ein zusätzlicher Stopp für frische Reifen lohnt und wo man nach einem Stopp wieder auf die Strecke kommt.",
      "Unter Safety Car oder Full Course Yellow ist der Verlust deutlich kleiner, weil das Feld langsam fährt – deshalb wird dann oft gestoppt."
    ],
    tipp: "Miss den Boxenstopp-Verlust im Training mit einer Durchfahrt ohne Halt. Mit dieser Zahl kannst du jede Strategie durchrechnen.",
    siehe: ["boxenstopp", "undercut", "safety-car", "full-course-yellow"] },

  { id: "undercut", begriff: "Undercut", englisch: "Undercut",
    kurz: "Früher als der Gegner stoppen und mit frischen Reifen an ihm vorbeiziehen.",
    text: [
      "Beim Undercut stoppt ein Fahrer eine oder mehrere Runden vor seinem direkten Gegner. Mit frischen Reifen fährt er auf der Out-Lap und den folgenden Runden deutlich schneller als der Gegner auf alten Reifen.",
      "Kommt der Gegner danach aus der Box, liegt er im besten Fall hinter dem Angreifer. Wie gut der Undercut funktioniert, hängt davon ab, wie schnell neue Reifen ihr Arbeitsfenster erreichen und wie stark die alten abbauen.",
      "Er kann scheitern, wenn der Angreifer nach dem Stopp in Verkehr gerät oder seine Reifen nicht schnell auf Temperatur bringt."
    ],
    tipp: "Ein Undercut lohnt sich vor allem, wenn der Reifenabbau hoch ist und neue Reifen schnell arbeiten. Fahre die Out-Lap mit voller Konzentration – sie entscheidet.",
    siehe: ["overcut", "boxenfenster", "outlap", "reifenabbau"] },

  { id: "overcut", begriff: "Overcut", englisch: "Overcut",
    kurz: "Länger draußen bleiben als der Gegner und durch schnelle Runden vorbeikommen.",
    text: [
      "Beim Overcut bleibt ein Fahrer länger auf der Strecke, während der Gegner stoppt. Er nutzt die freie Strecke und den leichter werdenden Tank für schnelle Runden.",
      "Das funktioniert, wenn neue Reifen lange brauchen, um zu arbeiten, wenn der Gegner nach seinem Stopp in Verkehr gerät oder wenn die alten Reifen kaum abbauen. Auch bei abtrocknender Strecke kann länger draußen bleiben die richtige Wahl sein.",
      "Overcut und Undercut sind die zwei Seiten derselben strategischen Entscheidung."
    ],
    tipp: "Bleibst du länger draußen, fahre jede Runde wie im Qualifying – der Overcut funktioniert nur mit schnellen Runden in der freien Luft.",
    siehe: ["undercut", "boxenfenster", "reifenabbau"] },

  { id: "boxenfenster", begriff: "Boxenfenster", englisch: "Pit Window",
    kurz: "Zeitraum, in dem ein Boxenstopp strategisch sinnvoll oder erlaubt ist.",
    text: [
      "Das Boxenfenster öffnet sich, sobald ein Stopp möglich wird, ohne dass der Kraftstoff bis ins Ziel reichen muss, und schließt sich, wenn der Tank leer oder die Reifen am Ende sind.",
      "Manche Serien legen zusätzlich vorgeschriebene Fenster fest, etwa einen Pflichtstopp zwischen bestimmten Runden oder Minuten.",
      "Innerhalb des Fensters wird der genaue Zeitpunkt nach Verkehr, Gelbphasen, Reifenzustand und den Stopps der Gegner gewählt."
    ],
    tipp: "Kenne dein Fenster genau: Wie früh kannst du stoppen, ohne einen zusätzlichen Stopp zu riskieren? Eine Gelbphase in diesem Fenster ist oft die beste Gelegenheit.",
    siehe: ["stint", "undercut", "safety-car", "tankmenge"] },

  { id: "outlap", begriff: "Out-Lap und In-Lap", englisch: "Out-Lap / In-Lap",
    kurz: "Die Runde nach dem Verlassen der Box und die Runde vor der Einfahrt.",
    text: [
      "Die Out-Lap beginnt mit dem Verlassen der Boxengasse. Reifen und Bremsen sind oft noch kühl, der Tank ist gegebenenfalls voll. Wer die Reifen hier schnell auf Temperatur bringt, gewinnt viel Zeit.",
      "Die In-Lap ist die letzte Runde vor dem Boxenstopp. Hier zählt jede Zehntelsekunde: Mit leichtem Tank wird möglichst schnell gefahren, um dem Gegner bei Undercut oder Overcut keinen Vorteil zu lassen.",
      "Im Qualifying beschreibt die Out-Lap die Aufwärmrunde vor dem schnellen Versuch."
    ],
    tipp: "Pushe auf der In-Lap und baue auf der Out-Lap kontrolliert Temperatur auf – die erste Kurve nach dem Stopp ist eine der häufigsten Unfallstellen.",
    siehe: ["undercut", "reifen-warmup", "boxenstopp"] },

  { id: "safety-car", begriff: "Safety Car", englisch: "Safety Car (SC)",
    kurz: "Führungsfahrzeug, das das Feld bei Gefahr auf niedrigem Tempo sammelt.",
    text: [
      "Bei einem schweren Unfall oder Hindernissen auf der Strecke wird das Safety Car auf die Strecke geschickt. Das Feld reiht sich dahinter ein, Überholen ist verboten. So können Streckenposten sicher arbeiten.",
      "Das Safety Car fasst das Feld zusammen und löscht Abstände aus. Für Führende ist das ärgerlich, für Verfolger eine Chance. Weil das Feld langsam fährt, kostet ein Boxenstopp in dieser Phase weniger Zeit.",
      "Vor dem Neustart schaltet das Safety Car seine Lichter aus und fährt in die Box; der Führende bestimmt dann das Tempo bis zur Freigabe."
    ],
    tipp: "Halte die Reifen hinter dem Safety Car warm und bereite dich auf den Neustart vor. Prüfe, ob ein Stopp in dieser Phase in dein Boxenfenster passt.",
    siehe: ["virtual-safety-car", "full-course-yellow", "boxenstopp-verlust", "brake-warming"] },

  { id: "virtual-safety-car", begriff: "Virtuelles Safety Car", englisch: "Virtual Safety Car (VSC)",
    kurz: "Neutralisation ohne Führungsfahrzeug: Alle fahren mit vorgegebener Mindestzeit.",
    text: [
      "Beim virtuellen Safety Car fährt kein Fahrzeug vor dem Feld. Stattdessen muss jeder Fahrer seine Geschwindigkeit so reduzieren, dass er eine vorgegebene Mindestzeit pro Abschnitt einhält. Das Display zeigt ein Delta an, das nicht unterschritten werden darf.",
      "Die Abstände zwischen den Fahrzeugen bleiben dadurch weitgehend erhalten. Überholen ist verboten.",
      "Weil das ganze Feld langsamer fährt, kostet ein Boxenstopp unter VSC deutlich weniger Zeit – ein häufiger strategischer Moment."
    ],
    tipp: "Fahre unter VSC so nah wie möglich am vorgegebenen Delta, ohne es zu unterschreiten. Wer zu langsam fährt, verschenkt Zeit; wer zu schnell ist, riskiert eine Strafe.",
    siehe: ["safety-car", "full-course-yellow", "delta"] },

  { id: "full-course-yellow", begriff: "Full Course Yellow", englisch: "Full Course Yellow (FCY)",
    kurz: "Gelbphase auf der ganzen Strecke mit festem Tempolimit.",
    text: [
      "Bei einer Full Course Yellow gilt auf der gesamten Strecke Gelb. Alle Fahrzeuge reduzieren auf ein festgelegtes Tempo, meist mit dem Boxengassenbegrenzer oder einem eigenen Limiter. Überholen ist verboten.",
      "Sie wird in Langstreckenserien eingesetzt, um kurze Bergungen ohne Safety Car zu ermöglichen. Oft folgt auf eine längere FCY ein Safety Car.",
      "Wie die Boxengasse während der FCY behandelt wird, regelt jede Serie unterschiedlich – das macht sie strategisch heikel."
    ],
    tipp: "Aktiviere den Limiter sofort, wenn die FCY ausgerufen wird, und prüfe, ob ein Stopp erlaubt und sinnvoll ist.",
    siehe: ["safety-car", "virtual-safety-car", "code-60", "pit-limiter"] },

  { id: "code-60", begriff: "Code 60", englisch: "Code 60",
    kurz: "Abschnittsweise Tempobegrenzung auf 60 km/h, bekannt von Langstreckenrennen auf der Nordschleife.",
    text: [
      "Bei Code 60 gilt in einem markierten Abschnitt oder auf der ganzen Strecke ein Tempolimit von 60 km/h. Der Beginn wird mit einer speziellen Flagge oder Tafel angezeigt, das Ende mit einer grünen Flagge. Überholen ist verboten.",
      "Das Verfahren stammt aus Langstreckenrennen auf langen Strecken, auf denen ein Safety Car zu lange bräuchte, um das Feld einzusammeln. Es ermöglicht sichere Bergungen nur dort, wo sie nötig sind.",
      "Wer in einer Code-60-Zone zu schnell fährt, erhält harte Strafen."
    ],
    tipp: "Bremse vor der Code-60-Zone rechtzeitig auf 60 km/h ab und beschleunige erst nach der grünen Flagge wieder.",
    siehe: ["full-course-yellow", "gelbe-flagge", "gruene-flagge"] },

  { id: "fliegender-start", begriff: "Fliegender Start", englisch: "Rolling Start",
    kurz: "Start aus der Fahrt, meist hinter einem Führungsfahrzeug.",
    text: [
      "Beim fliegenden Start rollt das Feld in Formation hinter einem Führungsfahrzeug oder dem Führenden auf die Start-Ziel-Linie zu. Gestartet wird mit der grünen Flagge oder dem Erlöschen der Lichter.",
      "Wichtig ist die Startzone: Vorher darf nicht beschleunigt und nicht überholt werden. Der Führende bestimmt oft das Tempo und versucht, die Verfolger mit einem überraschenden Beschleunigen zu überrumpeln.",
      "Fliegende Starts sind bei Langstrecken-, GT- und Ovalrennen üblich."
    ],
    tipp: "Halte in der Formation Abstand und Reihe. Beschleunige erst, wenn das Signal kommt, aber sei vorbereitet – die ersten Meter entscheiden.",
    siehe: ["stehender-start", "formationsrunde", "gruene-flagge"] },

  { id: "stehender-start", begriff: "Stehender Start", englisch: "Standing Start",
    kurz: "Start aus dem Stand von der Startaufstellung.",
    text: [
      "Beim stehenden Start stehen die Fahrzeuge in der Startaufstellung. Eine Ampel zählt herunter; erlöschen die Lichter, wird gestartet.",
      "Entscheidend sind Reaktionszeit, Kupplung und Traktion: Zu viel Drehzahl lässt die Räder durchdrehen, zu wenig würgt den Motor ab. Wer zu früh losfährt, erhält eine Strafe.",
      "Stehende Starts sind typisch für Formel- und Sprintrennen."
    ],
    tipp: "Übe Starts im Training und finde den idealen Schleifpunkt und die beste Drehzahl. Achte nach dem Start auf das Gedränge in der ersten Kurve.",
    siehe: ["fliegender-start", "schleifpunkt", "launch-control"] },

  { id: "formationsrunde", begriff: "Formationsrunde", englisch: "Formation Lap",
    kurz: "Aufwärmrunde vor dem Start, in der das Feld seine Reihenfolge hält.",
    text: [
      "In der Formationsrunde fahren alle Fahrzeuge in Startreihenfolge eine Runde, um Reifen und Bremsen aufzuwärmen und sich für den Start zu sammeln. Überholen ist nicht erlaubt.",
      "Beim stehenden Start reihen sich die Fahrzeuge danach in der Startaufstellung ein. Beim fliegenden Start geht die Formationsrunde direkt in den Start über.",
      "Wer in der Formationsrunde zurückfällt, darf seine Position meist nur unter bestimmten Bedingungen wieder einnehmen."
    ],
    tipp: "Nutze die Formationsrunde, um Reifen und Bremsen auf Temperatur zu bringen – aber ohne Risiko und mit Rücksicht auf die anderen.",
    siehe: ["fliegender-start", "stehender-start", "reifen-warmup"] },

  { id: "gruene-flagge", begriff: "Grüne Flagge", englisch: "Green Flag",
    kurz: "Die Strecke ist frei – Rennen läuft oder beginnt.",
    text: [
      "Die grüne Flagge zeigt an, dass eine Gefahrenstelle passiert ist und wieder normal gefahren werden darf. Nach einer Gelbphase markiert sie das Ende des Abschnitts.",
      "Beim fliegenden Start und bei Neustarts gibt die grüne Flagge das Rennen frei. Zu Beginn einer Sitzung zeigt sie, dass die Strecke geöffnet ist.",
      "Überholen ist ab der grünen Flagge wieder erlaubt."
    ],
    tipp: "Nach einer Gelbphase gilt die Freigabe erst ab der grünen Flagge – nicht schon davor beschleunigen oder überholen.",
    siehe: ["gelbe-flagge", "code-60", "fliegender-start"] },

  { id: "gelbe-flagge", begriff: "Gelbe Flagge", englisch: "Yellow Flag",
    kurz: "Gefahr im Streckenabschnitt: Tempo reduzieren, nicht überholen.",
    text: [
      "Die gelbe Flagge warnt vor einer Gefahr, etwa einem liegengebliebenen Fahrzeug oder Streckenposten neben der Fahrbahn. Bis zur nächsten grünen Flagge ist Überholen verboten, und das Tempo muss angepasst werden.",
      "In vielen Serien gibt es zusätzlich die doppelt geschwenkte gelbe Flagge für größere Gefahren.",
      "In Simulationen werden lokale Gelbphasen oft im Display oder durch Signale angezeigt – Überholen unter Gelb führt meist zu einer Strafe."
    ],
    tipp: "Nimm bei Gelb deutlich Tempo heraus und rechne mit stehenden Fahrzeugen hinter der nächsten Kurve.",
    siehe: ["doppelt-gelb", "gruene-flagge", "full-course-yellow"] },

  { id: "doppelt-gelb", begriff: "Doppelt geschwenkte gelbe Flagge", englisch: "Double Yellow",
    kurz: "Große Gefahr: stark verlangsamen und auf Anhalten vorbereitet sein.",
    text: [
      "Werden zwei gelbe Flaggen geschwenkt, ist die Strecke teilweise oder ganz blockiert, oder Streckenposten arbeiten auf der Fahrbahn. Fahrer müssen stark verlangsamen und jederzeit anhalten können.",
      "Im Qualifying führt doppelt Gelb oft dazu, dass Rundenzeiten aus diesem Abschnitt nicht gewertet werden.",
      "Wer unter doppelt Gelb nicht ausreichend verlangsamt, muss mit harten Strafen rechnen."
    ],
    tipp: "Bei doppelt Gelb ist die Runde für eine Bestzeit gelaufen. Konzentriere dich auf Sicherheit und bereite die nächste Runde vor.",
    siehe: ["gelbe-flagge", "rote-flagge", "qualifying"] },

  { id: "blaue-flagge", begriff: "Blaue Flagge", englisch: "Blue Flag",
    kurz: "Ein schnelleres, überrundendes Fahrzeug nähert sich – Platz machen.",
    text: [
      "Im Rennen zeigt die blaue Flagge einem Fahrer, dass er überrundet wird. Er muss dem schnelleren Fahrzeug bei nächster Gelegenheit Platz machen. Wer mehrere blaue Flaggen ignoriert, erhält eine Strafe.",
      "Im Training und Qualifying weist sie nur darauf hin, dass sich ein schnelleres Auto nähert.",
      "In Mehrklassenrennen gehört der Umgang mit blauen Flaggen zum Alltag: Langsamere Klassen bleiben auf ihrer Linie, damit die schnelleren berechenbar vorbeikommen."
    ],
    tipp: "Mach berechenbar Platz: Bleib auf deiner Linie und lupfe nicht plötzlich auf der Ideallinie. Der Überholende sucht sich den Weg.",
    siehe: ["kampflinie", "langstreckenrennen", "weisse-flagge"] },

  { id: "weisse-flagge", begriff: "Weiße Flagge", englisch: "White Flag",
    kurz: "Langsames Fahrzeug auf der Strecke – oder, in manchen Serien, letzte Runde.",
    text: [
      "Im europäischen Rennsport nach internationalem Reglement warnt die weiße Flagge vor einem deutlich langsameren Fahrzeug im folgenden Abschnitt, etwa einem Rettungs- oder Abschleppfahrzeug.",
      "In vielen amerikanischen Serien hat sie dagegen eine andere Bedeutung: Sie zeigt an, dass die letzte Runde begonnen hat.",
      "In Simulationen hängt die Bedeutung von der jeweiligen Rennserie ab, die nachgebildet wird."
    ],
    tipp: "Prüfe vor einem Rennen, nach welchem Reglement gefahren wird – damit du die weiße Flagge richtig deutest.",
    siehe: ["gelbe-flagge", "blaue-flagge", "zielflagge"] },

  { id: "rote-flagge", begriff: "Rote Flagge", englisch: "Red Flag",
    kurz: "Unterbrechung der Sitzung – langsam in die Boxengasse oder an die vorgegebene Stelle fahren.",
    text: [
      "Bei der roten Flagge wird die Sitzung unterbrochen, etwa nach einem schweren Unfall, bei starkem Regen oder Schäden an der Strecke. Alle Fahrzeuge fahren langsam und ohne zu überholen in die Boxengasse oder an eine markierte Stelle.",
      "Ob und wie das Rennen fortgesetzt wird, entscheidet die Rennleitung. In manchen Serien dürfen während der Unterbrechung Reifen gewechselt oder Reparaturen vorgenommen werden.",
      "Im Qualifying stoppt die rote Flagge alle laufenden Runden."
    ],
    tipp: "Bei Rot sofort vom Gas, Abstand halten und den Anweisungen folgen. Nutze die Unterbrechung, um deine Strategie für den Neustart zu überdenken.",
    siehe: ["doppelt-gelb", "safety-car", "qualifying"] },

  { id: "schwarze-flagge", begriff: "Schwarze Flagge", englisch: "Black Flag",
    kurz: "Ein Fahrer muss die Strecke verlassen und an die Box kommen – meist als Strafe.",
    text: [
      "Die schwarze Flagge wird zusammen mit der Startnummer gezeigt und fordert den Fahrer auf, innerhalb einer Runde an die Box zu fahren. Häufig bedeutet sie Disqualifikation oder Ausschluss aus der Sitzung.",
      "Verwandt sind die schwarz-weiß geteilte Flagge, die als Verwarnung für unsportliches Verhalten dient, und die schwarze Flagge mit orangefarbener Scheibe für technische Probleme.",
      "In Simulationen werden Strafen oft als schwarze Flagge angezeigt, die durch eine Durchfahrt oder einen Halt abgegolten werden muss."
    ],
    tipp: "Ignoriere eine schwarze Flagge nie – in den meisten Rennen folgt sonst die Disqualifikation.",
    siehe: ["meatball", "disqualifikation", "drive-through"] },

  { id: "meatball", begriff: "Schwarze Flagge mit orangefarbener Scheibe", englisch: "Meatball Flag",
    kurz: "Technisches Problem am Fahrzeug – sofort zur Reparatur an die Box.",
    text: [
      "Diese Flagge zeigt einem Fahrer, dass sein Fahrzeug einen technischen Defekt hat, der andere gefährden kann – etwa lose Teile, Flüssigkeitsverlust oder ein Feuer. Er muss an die Box kommen und den Schaden beheben lassen.",
      "Im Englischen heißt sie wegen ihres Aussehens Meatball Flag. Sie ist keine Strafe im eigentlichen Sinn, kann aber das Rennen kosten.",
      "In Simulationen wird sie bei schweren Schäden gezeigt, die vor der Weiterfahrt repariert werden müssen."
    ],
    tipp: "Nach einem schweren Schaden: Fahre direkt zur Box und plane die Reparaturzeit in deine Strategie ein.",
    siehe: ["schwarze-flagge", "boxenstopp"] },

  { id: "zielflagge", begriff: "Zielflagge", englisch: "Checkered Flag",
    kurz: "Schwarz-weiß karierte Flagge, die das Ende des Rennens oder der Sitzung anzeigt.",
    text: [
      "Mit der Zielflagge endet ein Rennen, sobald der Führende die Ziellinie überquert. Alle anderen beenden ihre laufende Runde und werden ebenfalls abgewunken.",
      "Bei zeitbasierten Rennen fällt die Zielflagge, wenn der Führende nach Ablauf der Zeit die Linie überquert. Dadurch kann ein Rennen etwas länger dauern als die angegebene Zeit – wichtig für die Kraftstoffplanung.",
      "Nach der Zielflagge folgt eine Auslaufrunde mit reduziertem Tempo."
    ],
    tipp: "Plane bei Zeitrennen immer Kraftstoff für eine zusätzliche Runde ein – die Zielflagge fällt erst, wenn der Führende nach Ablauf der Zeit ins Ziel kommt.",
    siehe: ["tankmenge", "langstreckenrennen", "sprintrennen"] },

  { id: "track-limits", begriff: "Streckenbegrenzung", englisch: "Track Limits",
    kurz: "Regeln dazu, wie weit ein Fahrzeug die weißen Linien überschreiten darf.",
    text: [
      "Die Strecke wird durch weiße Linien begrenzt. In den meisten Reglements gilt: Mindestens ein Rad muss die Strecke berühren – liegen alle vier Räder außerhalb der Linie, ist das ein Verstoß. Randsteine gelten meist als Teil der Strecke.",
      "Verstöße werden gezählt. Nach einigen Warnungen folgen Strafen; im Qualifying wird die Rundenzeit gestrichen.",
      "In Simulationen erkennt die Software Verstöße automatisch und vergibt Warnungen, Strafen oder Incident-Punkte."
    ],
    tipp: "Prüfe im Training, welche Randsteine und Auslaufzonen als Strecke zählen. Eine gestrichene Qualifying-Runde kostet mehr als ein halber Meter Linie.",
    siehe: ["off-track", "incident-points", "curbs", "zeitstrafe"] },

  { id: "off-track", begriff: "Off-Track", englisch: "Off-Track",
    kurz: "Das Fahrzeug verlässt mit allen Rädern die Strecke.",
    text: [
      "Ein Off-Track liegt vor, wenn ein Fahrzeug die Streckenbegrenzung komplett verlässt – etwa durch einen Fahrfehler oder um einer Kollision auszuweichen.",
      "In Simulationen wird es automatisch erkannt. Je nach Simulation folgt eine Warnung, eine Zeitstrafe, eine gestrichene Runde oder ein Incident-Punkt. Wer sich durch das Abkürzen einen Vorteil verschafft, muss oft Zeit oder Positionen zurückgeben.",
      "Beim Zurückkehren auf die Strecke gilt höchste Vorsicht, um niemanden zu gefährden."
    ],
    tipp: "Kehre nach einem Ausflug parallel zur Strecke und mit Blick in den Spiegel zurück – nie quer vor herannahende Autos.",
    siehe: ["track-limits", "incident-points", "auslaufzone"] },

  { id: "incident-points", begriff: "Incident-Punkte", englisch: "Incident Points (Inc)",
    kurz: "Strafpunkte in iRacing für Abflüge, Dreher und Kontakte.",
    text: [
      "In iRacing erhält jeder Fahrer Punkte für Zwischenfälle: zum Beispiel einen Punkt (1x) für das Verlassen der Strecke, zwei Punkte (2x) für einen Kontrollverlust und bis zu vier Punkte (4x) für einen schweren Kontakt mit einem anderen Fahrzeug. Leichte Berührungen bleiben teils ohne Punkte.",
      "Wer in einem Rennen zu viele Punkte sammelt, erhält Strafen bis hin zur Disqualifikation. Zudem fließen sie in das Safety Rating ein, das über den Lizenzaufstieg entscheidet.",
      "Die Punkte werden automatisch vergeben – unabhängig davon, wer schuld war."
    ],
    tipp: "Saubere Rennen zahlen sich doppelt aus: Weniger Punkte schonen dein Safety Rating, und sie halten dich aus Strafen heraus.",
    siehe: ["safety-rating", "lizenzklasse", "off-track"] },

  { id: "zeitstrafe", begriff: "Zeitstrafe", englisch: "Time Penalty",
    kurz: "Strafe, bei der Sekunden zur Rennzeit addiert oder beim Stopp abgesessen werden.",
    text: [
      "Bei einer Zeitstrafe werden einem Fahrer Sekunden auferlegt. Je nach Serie werden sie am Ende zur Rennzeit addiert oder beim nächsten Boxenstopp abgesessen, bevor Arbeiten am Auto beginnen dürfen.",
      "Typische Anlässe sind Track-Limit-Verstöße, verursachte Kollisionen, zu schnelles Fahren in der Boxengasse oder ein Fehlstart.",
      "Strategisch kann es entscheidend sein, wann eine Strafe abgesessen wird – etwa unter einer Gelbphase."
    ],
    tipp: "Wird dir eine Strafe auferlegt, prüfe, ob du sie mit einem geplanten Stopp verbinden darfst – das spart oft Zeit.",
    siehe: ["drive-through", "stop-and-go", "track-limits"] },

  { id: "drive-through", begriff: "Durchfahrtsstrafe", englisch: "Drive-Through Penalty",
    kurz: "Strafe, bei der man ohne Halt durch die Boxengasse fahren muss.",
    text: [
      "Bei einer Durchfahrtsstrafe muss der Fahrer innerhalb einer vorgegebenen Anzahl von Runden durch die Boxengasse fahren, mit Tempolimit, aber ohne anzuhalten.",
      "Der Zeitverlust entspricht der Fahrt durch die Boxengasse im Vergleich zur Strecke. Während der Durchfahrt darf nicht getankt oder gearbeitet werden.",
      "Wer sie nicht rechtzeitig antritt, riskiert eine härtere Strafe."
    ],
    tipp: "Tritt eine Durchfahrtsstrafe möglichst in einer Runde an, in der du ohnehin Zeit verlierst – zum Beispiel im Verkehr.",
    siehe: ["stop-and-go", "zeitstrafe", "boxengasse"] },

  { id: "stop-and-go", begriff: "Stop-and-Go-Strafe", englisch: "Stop-and-Go Penalty",
    kurz: "Strafe mit Pflichthalt in der Box, während der nicht gearbeitet werden darf.",
    text: [
      "Bei einer Stop-and-Go-Strafe fährt der Fahrer in die Box, hält an seinem Platz für eine festgelegte Zeit an und fährt dann ohne Arbeiten am Auto weiter.",
      "Sie kostet mehr Zeit als eine Durchfahrtsstrafe und wird für schwerere Vergehen verhängt.",
      "Während des Haltes ist Tanken und Reifenwechseln verboten – sie kann also nicht mit einem regulären Stopp kombiniert werden."
    ],
    tipp: "Plane nach einer Stop-and-Go-Strafe deine Strategie neu: Der zusätzliche Zeitverlust verschiebt oft dein Boxenfenster.",
    siehe: ["drive-through", "zeitstrafe", "boxenfenster"] },

  { id: "disqualifikation", begriff: "Disqualifikation", englisch: "Disqualification (DSQ)",
    kurz: "Ausschluss aus dem Rennergebnis.",
    text: [
      "Bei einer Disqualifikation wird ein Fahrer aus der Wertung genommen. Gründe können schwere Regelverstöße, technische Unregelmäßigkeiten, gefährliches Fahren oder das Ignorieren von Flaggen sein.",
      "In Simulationen führt oft das Überschreiten eines Limits an Incident-Punkten oder das Nichtantreten einer Strafe zur Disqualifikation.",
      "Eine Disqualifikation kann zusätzlich Folgen für die Wertung einer Meisterschaft haben."
    ],
    tipp: "Kenne vor dem Rennen die Strafregeln deiner Liga oder Serie – viele Disqualifikationen entstehen aus Unkenntnis.",
    siehe: ["schwarze-flagge", "incident-points", "zeitstrafe"] },

  { id: "bop", begriff: "Balance of Performance", englisch: "Balance of Performance (BoP)",
    kurz: "Angleichung unterschiedlicher Fahrzeuge über Gewicht, Leistung oder Aerodynamik.",
    text: [
      "In Klassen mit Fahrzeugen verschiedener Hersteller sorgt die Balance of Performance für Chancengleichheit. Schnellere Autos erhalten Zusatzgewicht, weniger Leistung oder kleinere Tanks, langsamere entsprechende Erleichterungen.",
      "Die Einstufung wird regelmäßig angepasst, oft je Strecke. In Simulationen wird sie mit Updates nachgezogen.",
      "Die Balance of Performance erklärt, warum ein Auto auf einer Strecke stark und auf der nächsten schwächer sein kann."
    ],
    tipp: "Prüfe vor einer Saison, wie die aktuelle Einstufung aussieht – die beste Fahrzeugwahl kann sich mit jedem Update ändern.",
    siehe: ["ladedruck", "tankmenge", "langstreckenrennen"] },

  { id: "qualifying", begriff: "Qualifying", englisch: "Qualifying",
    kurz: "Sitzung, in der die Startaufstellung ermittelt wird.",
    text: [
      "Im Qualifying fahren die Teilnehmer auf Zeit. Die schnellste Runde bestimmt in der Regel den Startplatz. Je nach Format gibt es freie Sitzungen, mehrere Abschnitte mit Ausscheiden oder Einzelrunden.",
      "Fahrzeuge werden für das Qualifying oft mit wenig Kraftstoff und frischen Reifen bewegt. Verkehr, Gelbphasen und das Timing der Runde sind entscheidend.",
      "Ein guter Startplatz ist in Sprintrennen oft wichtiger als in Langstreckenrennen."
    ],
    tipp: "Plane deine Qualifying-Runde: Out-Lap zum Aufwärmen, freie Strecke suchen, dann eine saubere Runde ohne Risiko an den Track Limits.",
    siehe: ["superpole", "outlap", "track-limits"] },

  { id: "superpole", begriff: "Superpole", englisch: "Superpole",
    kurz: "Qualifying-Format, in dem die schnellsten Fahrer einzeln um die Pole Position fahren.",
    text: [
      "Bei der Superpole qualifizieren sich die schnellsten Fahrer eines vorherigen Qualifyings für eine Entscheidung. Oft fährt jeder einzeln eine einzige schnelle Runde auf freier Strecke.",
      "Das Format bringt maximale Spannung und einen fairen Vergleich ohne Verkehr. Fehler sind aber kaum zu korrigieren.",
      "Es wird in mehreren Langstrecken- und GT-Serien genutzt."
    ],
    tipp: "Bei einer einzigen Runde zählt Konstanz mehr als das letzte Risiko. Fahre 98 Prozent sauber statt 101 Prozent mit Fehler.",
    siehe: ["qualifying", "outlap"] },

  { id: "sprintrennen", begriff: "Sprintrennen", englisch: "Sprint Race",
    kurz: "Kurzes Rennen, meist ohne oder mit nur einem Pflichtstopp.",
    text: [
      "Sprintrennen dauern meist zwischen 20 und 60 Minuten. Strategie spielt eine geringere Rolle; es geht um Startplatz, Start, Zweikämpfe und konstante schnelle Runden.",
      "Reifen und Kraftstoff reichen oft für die ganze Distanz, sodass voll gefahren werden kann. In manchen Serien gibt es einen Pflichtstopp, der dennoch taktische Möglichkeiten eröffnet.",
      "Im Simracing sind Sprintrennen das häufigste Format."
    ],
    tipp: "Im Sprint zählen die ersten Runden: Gewinne Positionen am Start und vermeide Kontakt in der ersten Kurve.",
    siehe: ["langstreckenrennen", "qualifying", "stehender-start"] },

  { id: "langstreckenrennen", begriff: "Langstreckenrennen", englisch: "Endurance Race",
    kurz: "Rennen über viele Stunden mit Boxenstopps und mehreren Fahrern.",
    text: [
      "Langstreckenrennen dauern von wenigen Stunden bis zu 24 Stunden und länger. Mehrere Fahrer teilen sich ein Auto, Boxenstopps, Fahrerwechsel und Strategie sind fester Bestandteil.",
      "Gewonnen wird nicht durch die schnellste Runde, sondern durch konstantes, fehlerfreies Fahren, schnelle Stopps und kluge Strategie. Oft fahren mehrere Klassen gleichzeitig, was ständiges Überrunden mit sich bringt.",
      "Nachtfahrten, Wetterwechsel und Müdigkeit machen sie zu einer besonderen Herausforderung."
    ],
    tipp: "Im Langstreckenrennen gilt: Ankommen schlägt Risiko. Plane mit dem Team Stints, Pausen und Schlaf und nutze den GSRA-Stint-Planer.",
    siehe: ["stint", "fahrerwechsel", "double-stint", "blaue-flagge"] },

  { id: "fahrerwechsel", begriff: "Fahrerwechsel", englisch: "Driver Swap",
    kurz: "Übergabe des Fahrzeugs von einem Fahrer an den nächsten während eines Boxenstopps.",
    text: [
      "Beim Fahrerwechsel steigt ein Fahrer aus und der nächste ein. Im echten Motorsport muss dabei der Sicherheitsgurt angelegt und oft eine Mindestdauer eingehalten werden.",
      "Viele Reglements schreiben Mindest- und Höchstfahrzeiten pro Fahrer vor. Die Reihenfolge der Fahrer und die Verteilung der Fahrzeit sind zentrale Teile der Strategie.",
      "In Simulationen werden Fahrerwechsel im Teamrennen über die Software geregelt; der neue Fahrer übernimmt das Fahrzeug während des Stopps."
    ],
    tipp: "Stimmt euch vor dem Rennen ab, wer wann fährt, und haltet die Wechsel kurz. Der nächste Fahrer sollte rechtzeitig bereit sitzen.",
    siehe: ["stint", "double-stint", "boxenstopp", "langstreckenrennen"] },

  { id: "tankmenge", begriff: "Tankmenge", englisch: "Fuel Load",
    kurz: "Menge an Kraftstoff, mit der ein Fahrzeug startet oder nachgetankt wird.",
    text: [
      "Kraftstoff ist Gewicht: Jeder Liter macht das Auto schwerer und damit langsamer. Deshalb wird nur so viel getankt, wie für den Stint nötig ist, plus eine Reserve.",
      "Die richtige Menge ergibt sich aus Verbrauch pro Runde, Anzahl der Runden, Reserve und gegebenenfalls einer zusätzlichen Runde bei Zeitrennen. Zu wenig Kraftstoff kostet das Rennen, zu viel kostet Zeit – auch beim Tanken.",
      "Ein schwerer Tank verändert zudem die Balance, Bremspunkte und Reifenbelastung."
    ],
    tipp: "Rechne die Tankmenge immer mit dem Durchschnittsverbrauch unter Rennbedingungen, nicht mit einer einzelnen sparsamen Runde – der GSRA-Stint-Planer hilft dabei.",
    siehe: ["spritsparen", "stint", "achslastverteilung", "zielflagge"] },

  { id: "spritsparen", begriff: "Kraftstoff sparen", englisch: "Fuel Saving",
    kurz: "Bewusst weniger Kraftstoff verbrauchen, um einen Stint zu verlängern oder einen Stopp zu sparen.",
    text: [
      "Kraftstoff lässt sich auf mehreren Wegen sparen: früher vom Gas gehen und rollen lassen (Lift and Coast), früher hochschalten, ein sparsameres Motorkennfeld wählen oder im Windschatten fahren.",
      "Der Zeitverlust pro Runde ist meist gering, die Wirkung auf die Strategie dagegen groß: Eine zusätzliche Runde pro Stint kann am Ende einen ganzen Boxenstopp sparen.",
      "Gute Teams rechnen genau aus, wie viel pro Runde gespart werden muss, und geben ein Ziel vor."
    ],
    tipp: "Nutze den Vergleich „Vollgas gegen Sprit sparen“ im GSRA-Stint-Planer. Er zeigt, ob sich das Sparen lohnt und wie viel du pro Runde einsparen musst.",
    siehe: ["lift-coast", "short-shifting", "motorkennfeld", "virtuelle-energie"] },

  { id: "virtuelle-energie", begriff: "Virtueller Energietank", englisch: "Virtual Energy / Energy Tank",
    kurz: "Begrenzung der Energie pro Stint statt der Kraftstoffmenge, z. B. in Le Mans Ultimate.",
    text: [
      "Einige Langstreckenreglements begrenzen nicht mehr den Kraftstoff in Litern, sondern die gesamte Energie, die ein Fahrzeug pro Stint einsetzen darf. Gemessen wird sie über Sensoren in der Kraftstoffzufuhr und gegebenenfalls im Hybridsystem.",
      "In Le Mans Ultimate wird das als virtueller Energietank in Prozent angezeigt. Ist er leer, muss das Auto an die Box – unabhängig vom tatsächlichen Kraftstoffstand.",
      "Für die Strategie bedeutet das: Gespart und geplant wird in Energieprozent pro Runde statt in Litern."
    ],
    tipp: "Notiere dir den Energieverbrauch pro Runde in Prozent und plane damit wie mit Kraftstoff – der Stint-Planer kann das wie einen Tank mit 100 Einheiten behandeln.",
    siehe: ["spritsparen", "tankmenge", "ers", "bop"] },
]);
