// GSRA – Nachschlagewerk: Simracing & Telemetrie
import { kategorie } from "./begriff";

export const SIMRACING = kategorie("Simracing & Telemetrie", [
  { id: "force-feedback", begriff: "Force Feedback", englisch: "Force Feedback (FFB)",
    kurz: "Kräfte, die die Simulation über das Lenkrad an deine Hände zurückgibt.",
    text: [
      "Force Feedback ist die wichtigste Informationsquelle im Simracing. Der Motor in der Lenkradbasis erzeugt Kräfte, die die Simulation aus den Rückstellkräften der Vorderräder berechnet. So spürst du Grip, Rutschen, Bodenwellen und Randsteine.",
      "Wird die Lenkung leichter, obwohl du weiter einlenkst, haben die Vorderreifen ihren besten Schräglaufwinkel überschritten. Ein plötzliches Nachlassen der Rückstellkraft beim Herausbeschleunigen kündigt ein ausbrechendes Heck an.",
      "Wie gut sich das anfühlt, hängt von der Hardware, den Einstellungen in der Simulation und im Treiber ab."
    ],
    tipp: "Stelle die Stärke so ein, dass die stärksten Kräfte nicht dauerhaft abgeschnitten werden (Clipping), und reduziere künstliche Effekte, die keine Information über das Auto liefern.",
    siehe: ["direct-drive", "ffb-clipping", "ffb-filter", "peak-slip-angle"] },

  { id: "direct-drive", begriff: "Direktantrieb", englisch: "Direct Drive (DD)",
    kurz: "Lenkradbasis, bei der das Lenkrad direkt auf der Motorwelle sitzt.",
    text: [
      "Bei einer Direct-Drive-Basis ist das Lenkrad ohne Riemen oder Zahnräder direkt mit einem großen Elektromotor verbunden. Kräfte werden ohne Verluste, Spiel oder Reibung übertragen.",
      "Das Ergebnis sind sehr detailreiche, schnelle und kräftige Rückmeldungen. Kleine Reifenbewegungen, Bodenwellen und das Gripniveau werden besonders fein spürbar.",
      "Direct-Drive-Basen gibt es mit sehr unterschiedlicher Leistung. Mehr Kraft ist nicht automatisch besser – entscheidend sind Detailtreue und eine passende Einstellung."
    ],
    tipp: "Mehr Kraft heißt nicht schneller. Viele schnelle Fahrer nutzen nur einen Teil der möglichen Kraft, um feine Details nicht zu überdecken und die Hände zu schonen.",
    siehe: ["force-feedback", "riemenantrieb", "zahnradantrieb", "ffb-clipping"] },

  { id: "riemenantrieb", begriff: "Riemenantrieb", englisch: "Belt Drive",
    kurz: "Lenkradbasis, bei der ein Riemen die Kraft vom Motor auf die Lenkachse überträgt.",
    text: [
      "Beim Riemenantrieb überträgt ein Zahnriemen die Kraft eines kleineren Motors auf die Lenkachse. Die Übersetzung verstärkt die Kraft und glättet sie.",
      "Riemenbasen bieten ein gleichmäßigeres, weicheres Gefühl als Zahnradbasen und sind günstiger als Direct-Drive-Systeme. Durch den Riemen gehen aber feine Details und etwas Reaktionsgeschwindigkeit verloren.",
      "Sie waren lange der Standard für ambitionierte Einsteiger."
    ],
    tipp: "Bei Riemenbasen hilft ein leicht erhöhter Dämpfungsfilter oft gegen das typische Nachschwingen, kostet aber Detail.",
    siehe: ["direct-drive", "zahnradantrieb", "ffb-filter"] },

  { id: "zahnradantrieb", begriff: "Zahnradantrieb", englisch: "Gear Drive",
    kurz: "Lenkradbasis, bei der Zahnräder die Motorkraft übertragen.",
    text: [
      "Zahnradbasen übertragen die Kraft über ein Getriebe aus Zahnrädern. Sie sind kompakt und günstig und daher typisch für Einsteigerlenkräder.",
      "Nachteile sind Spiel zwischen den Zahnrädern, spürbares Rattern und ein weniger feines Kraftbild. Besonders Mittellage und kleine Kräfte werden ungenau wiedergegeben.",
      "Für den Einstieg reichen sie völlig aus, um Fahrtechnik und Strecken zu lernen."
    ],
    tipp: "Bei Zahnradbasen hilft es, die Stärke nicht zu hoch zu stellen – das reduziert Rattern und Clipping.",
    siehe: ["riemenantrieb", "direct-drive", "force-feedback"] },

  { id: "load-cell", begriff: "Druckmessung im Bremspedal", englisch: "Load Cell",
    kurz: "Sensor, der die Kraft auf das Bremspedal misst statt den Pedalweg.",
    text: [
      "Einfache Pedale messen, wie weit das Pedal getreten wird. Pedale mit Load Cell messen dagegen die Kraft, mit der getreten wird – so wie im echten Auto, wo die Bremswirkung vom Druck abhängt.",
      "Das Muskelgedächtnis arbeitet mit Kraft viel genauer als mit Weg. Bremspunkte und Bremsdruck lassen sich dadurch präziser und reproduzierbarer treffen. Viele Fahrer halten das für das wirkungsvollste Hardware-Upgrade.",
      "Die maximale Kraft lässt sich meist einstellen, damit sie zur eigenen Sitzposition und Beinkraft passt."
    ],
    tipp: "Stelle die Maximalkraft so ein, dass du 100 Prozent mit kräftigem, aber nicht übermäßigem Druck erreichst. Zu hoch eingestellt, erreichst du den vollen Bremsdruck nie.",
    siehe: ["hydraulikpedale", "threshold-braking", "bremsdruck"] },

  { id: "hydraulikpedale", begriff: "Hydraulische Pedale", englisch: "Hydraulic Pedals",
    kurz: "Pedale mit echtem Hydrauliksystem für ein besonders realistisches Gefühl.",
    text: [
      "Hydraulische Pedale arbeiten wie im Rennwagen mit Zylindern und Flüssigkeit. Der Druck wird von einem Sensor gemessen und an die Simulation weitergegeben.",
      "Das Pedalgefühl ist sehr realistisch: weich am Anfang, dann zunehmend fest. Sie sind allerdings teuer, benötigen Pflege und sind aufwendiger einzustellen als Pedale mit Load Cell.",
      "Für die meisten Simracer bietet eine gute Load Cell bereits den größten Teil des Vorteils."
    ],
    tipp: "Ob hydraulisch oder Load Cell: Entscheidend ist, dass du dein Pedal immer gleich fühlst. Verändere die Einstellungen selten.",
    siehe: ["load-cell", "stahlflexleitungen", "bremsdruck"] },

  { id: "dual-clutch-paddles", begriff: "Doppelte Kupplungswippen", englisch: "Dual-Clutch Paddles",
    kurz: "Zwei Kupplungswippen am Lenkrad für präzise, reproduzierbare Starts.",
    text: [
      "Viele Lenkräder haben zwei Kupplungswippen. Im Dual-Clutch-Modus wird eine Wippe auf einen festen Wert eingestellt – den Schleifpunkt –, die andere auf vollen Hub.",
      "Beim Start werden beide gezogen. Dann lässt man die erste los, die Kupplung springt auf den Schleifpunkt, und man fährt los. Danach wird die zweite gleichmäßig gelöst.",
      "So werden Starts sehr reproduzierbar – unabhängig davon, wie ruhig die Hand in der Startphase ist."
    ],
    tipp: "Ermittle den idealen Schleifpunkt im Training und speichere ihn je Fahrzeug. Der Wert unterscheidet sich zwischen Autos deutlich.",
    siehe: ["schleifpunkt", "kupplung", "stehender-start"] },

  { id: "bass-shaker", begriff: "Bass-Shaker", englisch: "Tactile Transducer / Bass Shaker",
    kurz: "Körperschallwandler, der Vibrationen über Sitz und Pedale überträgt.",
    text: [
      "Ein Bass-Shaker funktioniert wie ein Lautsprecher ohne Membran: Er wird an Sitz, Rahmen oder Pedalen befestigt und überträgt Vibrationen statt Ton. Gesteuert wird er über das Audiosignal oder spezielle Software, die Telemetriedaten nutzt.",
      "So spürst du Motorvibrationen, Gangwechsel, Randsteine, blockierende oder durchdrehende Räder. Das liefert zusätzliche Informationen, die das Force Feedback allein nicht vermittelt – etwa ein Blockieren der Hinterräder.",
      "Gut eingestellt wirkt das sehr immersiv; zu stark wird es schnell ermüdend."
    ],
    tipp: "Nutze Shaker vor allem für Informationen, etwa blockierende Räder an der Bremse. Reine Effekte für die Atmosphäre lieber dezent einstellen.",
    siehe: ["force-feedback", "motion-rig", "blockieren"] },

  { id: "motion-rig", begriff: "Bewegungssimulator", englisch: "Motion Rig",
    kurz: "Simulator, der den Sitz oder das ganze Cockpit bewegt.",
    text: [
      "Ein Motion Rig bewegt den Fahrer, um Beschleunigungen nachzubilden: Neigung beim Bremsen, seitliches Kippen in Kurven, Stöße auf Bodenwellen. Je nach System gibt es zwei bis sechs Bewegungsachsen.",
      "Weil echte Dauerbeschleunigungen nicht nachgebildet werden können, arbeitet ein Motion Rig mit kurzen Impulsen und Neigung. Der Effekt ist eindrucksvoll, besonders bei schnellen Lastwechseln und Bodenwellen.",
      "Für die Rundenzeit ist er weniger wichtig als für Immersion und frühes Erkennen eines ausbrechenden Hecks."
    ],
    tipp: "Stelle Bewegungen zunächst dezent ein. Zu starke Bewegungen können das Fahrgefühl eher verfälschen als verbessern.",
    siehe: ["bass-shaker", "force-feedback"] },

  { id: "fov", begriff: "Sichtfeld", englisch: "Field of View (FOV)",
    kurz: "Der Blickwinkel, den die Simulation auf dem Bildschirm darstellt.",
    text: [
      "Das Sichtfeld bestimmt, wie viel von der Umgebung auf dem Bildschirm zu sehen ist. Ein korrektes Sichtfeld wird aus Bildschirmgröße und Abstand zwischen Augen und Bildschirm berechnet.",
      "Ist es korrekt eingestellt, erscheinen Abstände und Geschwindigkeiten realistisch. Ein zu großes Sichtfeld lässt alles weiter weg und langsamer wirken, sodass Bremspunkte schwerer einzuschätzen sind.",
      "Viele Simracer nutzen Online-Rechner, um den korrekten Wert für ihr Setup zu ermitteln."
    ],
    tipp: "Stelle das Sichtfeld mathematisch korrekt ein, auch wenn es zuerst eng wirkt. Nach wenigen Runden schätzt du Bremspunkte und Kurvengeschwindigkeiten genauer ein.",
    siehe: ["triple-screen", "vr"] },

  { id: "triple-screen", begriff: "Drei-Bildschirm-Aufbau", englisch: "Triple Screen",
    kurz: "Drei nebeneinander angeordnete Bildschirme für ein breiteres Sichtfeld.",
    text: [
      "Bei einem Triple-Screen-Aufbau ergänzen zwei seitliche Bildschirme den mittleren. So siehst du Scheitelpunkte früher, erkennst Gegner neben dir und schätzt Kurven besser ein.",
      "Für ein korrektes Bild müssen Winkel der Seitenbildschirme und Sichtfeld in der Simulation exakt eingestellt werden. Die Grafikkarte muss mehr Pixel berechnen.",
      "Viele Simracer halten Triple Screens für den besten Kompromiss aus Übersicht, Komfort und Bildqualität."
    ],
    tipp: "Stelle die Seitenbildschirme so, dass sie mit dem mittleren eine durchgehende Ansicht ergeben, und trage den Winkel in der Simulation ein.",
    siehe: ["fov", "vr", "fps"] },

  { id: "vr", begriff: "Virtuelle Realität", englisch: "VR (Virtual Reality)",
    kurz: "Datenbrille, die dich räumlich ins Cockpit versetzt.",
    text: [
      "Mit einer VR-Brille siehst du die Simulation dreidimensional und kannst dich im Cockpit umsehen. Tiefe und Abstände wirken sehr natürlich, was das Einschätzen von Bremspunkten und Abständen erleichtert.",
      "Nachteile sind die hohe Rechenleistung, mögliches Unwohlsein bei niedriger Bildrate, die Hitze unter der Brille und die geringere Bildschärfe im Vergleich zu Monitoren.",
      "Für flüssiges Fahren ist eine stabile, hohe Bildrate in VR noch wichtiger als auf Bildschirmen."
    ],
    tipp: "Achte in VR vor allem auf eine stabile Bildrate. Lieber Details reduzieren, als Ruckler und Unwohlsein zu riskieren.",
    siehe: ["fov", "fps", "frame-time"] },

  { id: "irating", begriff: "iRating", englisch: "iRating",
    kurz: "Leistungsbewertung in iRacing, die über Rennergebnisse steigt oder fällt.",
    text: [
      "Das iRating ist eine Zahl, die die fahrerische Stärke eines Fahrers in iRacing abbildet. Es funktioniert ähnlich wie die Elo-Zahl im Schach: Wer vor stärkeren Fahrern landet, gewinnt viele Punkte; wer hinter schwächeren landet, verliert viele.",
      "Das iRating bestimmt, gegen wen man in Rennen antritt: Fahrer mit ähnlichen Werten werden in dieselben Läufe sortiert. Es ist je Kategorie getrennt, etwa für Straßen- und Ovalrennen.",
      "Es misst die Leistung, nicht die Sauberkeit – dafür gibt es das Safety Rating."
    ],
    tipp: "Konzentriere dich auf saubere, konstante Rennen. Ein Dreher in der ersten Runde kostet mehr iRating als eine Position weniger durch vorsichtiges Fahren.",
    siehe: ["safety-rating", "sof", "lizenzklasse"] },

  { id: "safety-rating", begriff: "Safety Rating", englisch: "Safety Rating (SR)",
    kurz: "Bewertung in iRacing, wie sauber ein Fahrer fährt.",
    text: [
      "Das Safety Rating wird aus den Incident-Punkten im Verhältnis zu den gefahrenen Kurven berechnet. Wer wenige Zwischenfälle hat, steigt; wer viele hat, fällt.",
      "Es reicht innerhalb jeder Lizenzklasse von 0 bis knapp 5. Ein ausreichend hohes Safety Rating ist Voraussetzung für den Aufstieg in die nächste Lizenzklasse; ein sehr niedriges kann zum Abstieg führen.",
      "Weil Incidents unabhängig von der Schuld vergeben werden, gehört auch vorausschauendes Fahren dazu, um Kontakte zu vermeiden."
    ],
    tipp: "Fahre in den ersten Runden eines Rennens mit Reserve – dort entstehen die meisten Incidents. Ein paar Zehntel Verlust schützen dein Safety Rating.",
    siehe: ["incident-points", "lizenzklasse", "irating"] },

  { id: "lizenzklasse", begriff: "Lizenzklasse", englisch: "License Class",
    kurz: "Stufe in iRacing, die bestimmt, in welchen Serien du fahren darfst.",
    text: [
      "In iRacing beginnen alle Fahrer mit der Rookie-Lizenz und steigen über die Klassen D, C, B und A auf. Höhere Klassen schalten schnellere Fahrzeuge und anspruchsvollere Serien frei.",
      "Der Aufstieg hängt vom Safety Rating und einer Mindestzahl an Rennen oder Sitzungen ab. Es geht also um saubere Kilometer, nicht um Siege.",
      "Die Lizenzklassen werden für verschiedene Kategorien getrennt geführt."
    ],
    tipp: "Für den Aufstieg zählen saubere Runden. Fahre zu Beginn lieber in Serien, die dir liegen, und sammle konstant gute Safety-Rating-Werte.",
    siehe: ["safety-rating", "irating", "incident-points"] },

  { id: "sof", begriff: "Stärke des Feldes", englisch: "Strength of Field (SoF)",
    kurz: "Kennzahl in iRacing für die durchschnittliche Stärke eines Rennens.",
    text: [
      "Die Strength of Field wird aus den iRatings aller Teilnehmer eines Rennens berechnet – vereinfacht gesagt eine Art Mittelwert. Sie zeigt, wie stark ein Lauf besetzt ist.",
      "Ein hoher Wert bedeutet starke Gegner und mehr Meisterschaftspunkte für gute Ergebnisse. In Serien mit mehreren gleichzeitigen Läufen landen die stärksten Fahrer meist im ersten Lauf.",
      "Für das eigene iRating ist weniger die Feldstärke entscheidend als die Platzierung im Verhältnis zu den einzelnen Gegnern."
    ],
    tipp: "Vergleiche deine Ergebnisse immer mit der Feldstärke: Ein fünfter Platz in einem starken Lauf ist oft mehr wert als ein Sieg in einem schwachen.",
    siehe: ["irating", "safety-rating"] },

  { id: "telemetrie", begriff: "Telemetrie", englisch: "Telemetry",
    kurz: "Aufgezeichnete Fahrzeugdaten wie Geschwindigkeit, Pedale, Lenkung und Temperaturen.",
    text: [
      "Telemetrie zeichnet während der Fahrt Daten auf: Geschwindigkeit, Gas, Bremse, Lenkwinkel, Gang, Drehzahl, Reifentemperaturen und vieles mehr. Simulationen stellen diese Daten über eine Schnittstelle bereit.",
      "Mit Telemetrie lassen sich eigene Runden mit schnelleren vergleichen: Wo wird früher gebremst, wo früher Gas gegeben, wo ist die Kurvenmindestgeschwindigkeit höher? Ingenieure nutzen sie zudem für die Abstimmung.",
      "Das GSRA-Telemetrie-Tool soll diese Analyse künftig direkt auf der Plattform ermöglichen."
    ],
    tipp: "Vergleiche gezielt eine Kurve nach der anderen und ändere pro Session nur eine Sache. Große Unterschiede liegen fast immer beim Bremsen und am Kurvenausgang.",
    siehe: ["delta", "sektorzeiten", "mindestgeschwindigkeit", "ghost-car"] },

  { id: "delta", begriff: "Delta", englisch: "Delta / Delta Bar",
    kurz: "Laufender Zeitunterschied zu einer Referenzrunde.",
    text: [
      "Das Delta zeigt in Echtzeit, ob du gerade schneller oder langsamer bist als eine Referenzrunde – meist deine bisher beste Runde. Es wird oft als Zahl und als farbiger Balken (Delta Bar) dargestellt.",
      "Bist du nach einer Kurve grün, warst du dort schneller; rot bedeutet langsamer. So erkennst du ohne Telemetrie sofort, ob eine neue Linie oder ein neuer Bremspunkt funktioniert.",
      "Im Rennen ist das Delta zum Vordermann wichtig, unter virtuellem Safety Car das Delta zur vorgegebenen Zeit."
    ],
    tipp: "Achte auf das Delta direkt nach einer Kurve, nicht am Ende der Runde. So weißt du sofort, welcher Versuch funktioniert hat.",
    siehe: ["telemetrie", "optimal-lap", "virtual-safety-car"] },

  { id: "sektorzeiten", begriff: "Sektorzeiten", englisch: "Sector Times",
    kurz: "Zwischenzeiten für festgelegte Abschnitte einer Runde.",
    text: [
      "Eine Runde wird meist in drei oder mehr Sektoren geteilt. Für jeden Sektor wird eine Zwischenzeit gemessen.",
      "So siehst du, in welchem Teil der Strecke du Zeit gewinnst oder verlierst. Persönliche Bestzeiten werden oft farbig markiert – im Fernsehen etwa lila für die absolute Bestzeit, grün für die persönliche.",
      "Aus den besten Sektoren mehrerer Runden lässt sich die optimale Runde berechnen."
    ],
    tipp: "Konzentriere dich im Training auf den Sektor mit dem größten Abstand zu deiner Bestzeit – dort liegt das meiste Potenzial.",
    siehe: ["optimal-lap", "theoretical-best", "delta"] },

  { id: "optimal-lap", begriff: "Optimale Runde", englisch: "Optimal Lap",
    kurz: "Summe deiner besten Sektorzeiten aus verschiedenen Runden.",
    text: [
      "Die optimale Runde addiert für jeden Sektor deine schnellste gefahrene Zeit, auch wenn sie aus verschiedenen Runden stammen. Sie zeigt, welche Rundenzeit möglich wäre, wenn alle besten Abschnitte zusammenkämen.",
      "Der Abstand zwischen optimaler und tatsächlicher Bestzeit zeigt, wie konstant du fährst. Ein großer Abstand bedeutet, dass du in einzelnen Sektoren schon schneller warst, es aber nicht in einer Runde zusammengebracht hast.",
      "Viele Simulationen zeigen die optimale Runde direkt an."
    ],
    tipp: "Ist deine optimale Runde mehrere Zehntel schneller als deine Bestzeit, arbeite an Konstanz statt an neuen Linien.",
    siehe: ["theoretical-best", "sektorzeiten", "delta"] },

  { id: "theoretical-best", begriff: "Theoretische Bestzeit", englisch: "Theoretical Best",
    kurz: "Bestzeit aus vielen kleinen Streckenabschnitten – oft noch schneller als die optimale Runde.",
    text: [
      "Die theoretische Bestzeit wird ähnlich wie die optimale Runde berechnet, aber mit viel feineren Abschnitten, sogenannten Mini-Sektoren. Für jeden kleinen Abschnitt zählt die schnellste Zeit.",
      "Weil die Abschnitte kürzer sind, liegt die theoretische Bestzeit meist unter der optimalen Runde. Sie zeigt das Potenzial, das in deinen bisherigen Runden steckt – allerdings ist sie praktisch kaum vollständig erreichbar, weil Kurven voneinander abhängen.",
      "Die Begriffe werden je nach Software unterschiedlich verwendet; prüfe, wie dein Werkzeug rechnet."
    ],
    tipp: "Nutze die theoretische Bestzeit als Wegweiser zu den Kurven, in denen du schon einmal schneller warst, nicht als Ziel.",
    siehe: ["optimal-lap", "sektorzeiten", "telemetrie"] },

  { id: "ghost-car", begriff: "Geisterauto", englisch: "Ghost Car",
    kurz: "Durchsichtiges Fahrzeug, das eine Referenzrunde zum Hinterherfahren zeigt.",
    text: [
      "Ein Geisterauto zeigt eine aufgezeichnete Runde als durchsichtiges Fahrzeug auf der Strecke – deine eigene Bestzeit oder die eines anderen Fahrers. Es kollidiert nicht mit dir.",
      "So siehst du direkt, wo die Referenz bremst, einlenkt und beschleunigt, und kannst versuchen, ihr zu folgen. Das ist eine der anschaulichsten Methoden, eine neue Strecke zu lernen.",
      "Nicht jede Simulation bietet Geisterautos an; manche ermöglichen den Import fremder Runden."
    ],
    tipp: "Folge dem Geisterauto zuerst in einigem Abstand und achte auf Bremspunkte und Linie. Versuche erst danach, die Zeit zu schlagen.",
    siehe: ["telemetrie", "replay", "delta"] },

  { id: "replay", begriff: "Wiederholung", englisch: "Replay",
    kurz: "Aufzeichnung einer Sitzung zum erneuten Ansehen.",
    text: [
      "Simulationen zeichnen Sitzungen auf. In der Wiederholung kannst du aus verschiedenen Kameraperspektiven ansehen, was passiert ist: Linie, Fehler, Kollisionen und Überholmanöver.",
      "Für die Weiterentwicklung ist das Replay sehr wertvoll, besonders in Kombination mit Telemetrie. In Ligen dient es zur Klärung von Zwischenfällen.",
      "Replays lassen sich oft speichern und teilen."
    ],
    tipp: "Sieh dir nach einem Rennen deine schlechteste Kurve im Replay an – von außen erkennt man Linienfehler oft sofort.",
    siehe: ["telemetrie", "ghost-car"] },

  { id: "setup", begriff: "Setup", englisch: "Setup",
    kurz: "Die Gesamtheit aller Fahrzeugeinstellungen.",
    text: [
      "Ein Setup umfasst alle Einstellungen eines Fahrzeugs: Reifendrücke, Sturz, Spur, Federn, Dämpfer, Stabilisatoren, Höhen, Aerodynamik, Bremsbalance, Differential, Übersetzung und Elektronik.",
      "Ziel ist ein Auto, das schnell, berechenbar und zum eigenen Fahrstil passend ist. Ein gutes Setup kann mehrere Zehntel bringen, ersetzt aber keine saubere Fahrtechnik.",
      "Im GSRA-Setup-Hub kannst du Setups finden, teilen und bewerten."
    ],
    tipp: "Beginne mit einem bewährten Basis-Setup und ändere immer nur eine Sache auf einmal. Notiere, was die Änderung bewirkt hat.",
    siehe: ["baseline", "fixed-setup", "open-setup"] },

  { id: "baseline", begriff: "Basis-Setup", englisch: "Baseline",
    kurz: "Ein ausgewogenes Grund-Setup als Ausgangspunkt für eigene Änderungen.",
    text: [
      "Eine Baseline ist ein Setup, das auf einer Strecke zuverlässig funktioniert, ohne extrem zu sein. Sie dient als Ausgangspunkt, von dem aus man gezielt ändert.",
      "Viele Simulationen liefern Basis-Setups mit, die meist eher stabil und gutmütig sind. Erfahrene Fahrer haben eigene Baselines, die sie für jede Strecke anpassen.",
      "Ohne feste Baseline verliert man schnell den Überblick, welche Änderung was bewirkt hat."
    ],
    tipp: "Speichere dir für jedes Auto eine Baseline, mit der du dich wohlfühlst, und kehre zu ihr zurück, wenn du dich verrannt hast.",
    siehe: ["setup", "fixed-setup"] },

  { id: "fixed-setup", begriff: "Festes Setup", englisch: "Fixed Setup",
    kurz: "Rennformat, in dem alle mit demselben vorgegebenen Setup fahren.",
    text: [
      "In Serien mit festem Setup dürfen die Teilnehmer keine Fahrzeugeinstellungen verändern – meist nur Dinge wie Bremsbalance, Tankmenge oder Elektronik während der Fahrt.",
      "So entscheidet allein das fahrerische Können. Die Serien sind beliebt bei Einsteigern und bei allen, die sich nicht mit der Abstimmung beschäftigen wollen.",
      "Im Gegenzug lernt man dort weniger über das Zusammenspiel von Setup und Fahrverhalten."
    ],
    tipp: "Festes-Setup-Serien sind ideal, um deine Fahrtechnik zu verbessern, weil Unterschiede nur vom Fahrer kommen.",
    siehe: ["open-setup", "setup", "baseline"] },

  { id: "open-setup", begriff: "Offenes Setup", englisch: "Open Setup",
    kurz: "Rennformat, in dem jeder sein Fahrzeug frei abstimmen darf.",
    text: [
      "In Serien mit offenem Setup darf jeder die Einstellungen im Rahmen des Reglements frei verändern. Damit wird die Abstimmung zum Teil des Wettbewerbs.",
      "Wer sein Auto gut versteht, kann sich einen Vorteil verschaffen. Gleichzeitig sind die Unterschiede zwischen Fahrern oft größer, weil auch die Setups variieren.",
      "Viele Fahrer nutzen geteilte Setups aus der Community als Grundlage."
    ],
    tipp: "Ein geliehenes schnelles Setup passt nicht automatisch zu deinem Fahrstil. Passe es schrittweise an, statt es blind zu übernehmen.",
    siehe: ["fixed-setup", "setup", "baseline"] },

  { id: "netcode", begriff: "Netzwerkcode", englisch: "Netcode",
    kurz: "Die Technik, mit der eine Simulation die Positionen aller Fahrzeuge online abgleicht.",
    text: [
      "Im Online-Rennen müssen die Positionen aller Fahrzeuge ständig über das Internet ausgetauscht werden. Der Netzwerkcode berechnet, wo sich die anderen Autos gerade befinden, und gleicht Verzögerungen aus.",
      "Weil Daten Zeit brauchen, wird die Position anderer Fahrzeuge oft vorhergesagt. Bei schlechter Verbindung kommt es zu Sprüngen, verzögerten Kontakten oder Autos, die scheinbar ineinander stecken.",
      "Ein guter Netzwerkcode macht enge Zweikämpfe online fair und berechenbar."
    ],
    tipp: "Halte in Zweikämpfen etwas mehr Abstand, wenn ein Gegner springt oder ruckelt – seine angezeigte Position kann von der tatsächlichen abweichen.",
    siehe: ["ping", "packet-loss"] },

  { id: "ping", begriff: "Ping und Latenz", englisch: "Ping / Latency",
    kurz: "Zeit, die Daten von deinem Rechner zum Server und zurück brauchen.",
    text: [
      "Der Ping misst in Millisekunden, wie lange ein Datenpaket zum Server und zurück braucht. Je niedriger, desto aktueller sind die Positionen der anderen Fahrzeuge auf deinem Bildschirm.",
      "Ein hoher Ping führt zu Verzögerungen und ungenauen Positionen. Besonders bei Fahrern auf anderen Kontinenten kann das Zweikämpfe erschweren.",
      "Kabelverbindungen sind in der Regel stabiler und schneller als WLAN."
    ],
    tipp: "Verbinde deinen Simracing-Rechner nach Möglichkeit per Kabel mit dem Router. Das senkt den Ping und verringert Aussetzer.",
    siehe: ["packet-loss", "netcode", "input-lag"] },

  { id: "packet-loss", begriff: "Paketverlust", englisch: "Packet Loss",
    kurz: "Datenpakete gehen auf dem Weg zum Server verloren.",
    text: [
      "Bei Paketverlust kommen einzelne Datenpakete nicht an. Die Simulation muss Positionen dann schätzen, und andere Fahrzeuge springen oder verhalten sich seltsam.",
      "Schon wenige Prozent Paketverlust können zu spürbaren Problemen führen – bis hin zu Kollisionen, die du gar nicht verursacht hast.",
      "Häufige Ursachen sind WLAN, überlastete Netzwerke oder Probleme beim Internetanbieter."
    ],
    tipp: "Prüfe bei Problemen die Verbindungsanzeige deiner Simulation und schließe Programme, die im Hintergrund viele Daten übertragen.",
    siehe: ["ping", "netcode"] },

  { id: "fps", begriff: "Bilder pro Sekunde", englisch: "FPS (Frames per Second)",
    kurz: "Wie viele Bilder die Grafikkarte pro Sekunde berechnet.",
    text: [
      "Je mehr Bilder pro Sekunde, desto flüssiger und reaktionsschneller wirkt die Darstellung. Für Simracing gelten stabile Werte als wichtiger als möglichst hohe Spitzen.",
      "Schwankende Bildraten fühlen sich ruckelig an und erschweren präzises Fahren. Viele Simracer begrenzen die Bildrate bewusst auf einen Wert, den der Rechner immer halten kann.",
      "In VR sind besonders hohe und stabile Bildraten nötig, um Unwohlsein zu vermeiden."
    ],
    tipp: "Reduziere zuerst Schatten, Spiegel und die Zahl sichtbarer Fahrzeuge – das bringt oft viel Leistung ohne großen optischen Verlust.",
    siehe: ["frame-time", "bildwiederholrate", "vr"] },

  { id: "frame-time", begriff: "Bildzeit", englisch: "Frame Time",
    kurz: "Zeit, die für die Berechnung eines einzelnen Bildes benötigt wird.",
    text: [
      "Die Frame Time ist der Kehrwert der Bildrate: Bei 100 Bildern pro Sekunde dauert jedes Bild 10 Millisekunden. Sie zeigt genauer als die Bildrate, ob die Darstellung gleichmäßig ist.",
      "Einzelne lange Bildzeiten, sogenannte Spitzen, nimmt man als Ruckler wahr – selbst wenn die durchschnittliche Bildrate hoch ist.",
      "Viele Leistungsanzeigen stellen die Frame Time als Kurve dar."
    ],
    tipp: "Achte auf eine flache Frame-Time-Kurve. Eine gleichmäßige Bildzeit fühlt sich flüssiger an als eine höhere, aber schwankende Bildrate.",
    siehe: ["fps", "input-lag", "vsync"] },

  { id: "input-lag", begriff: "Eingabeverzögerung", englisch: "Input Lag",
    kurz: "Zeit zwischen deiner Eingabe und der sichtbaren Reaktion.",
    text: [
      "Input Lag ist die Verzögerung zwischen dem Bewegen von Lenkrad oder Pedal und der Reaktion auf dem Bildschirm. Sie entsteht durch Hardware, Software, Bildberechnung und den Bildschirm selbst.",
      "Schon einige Millisekunden mehr können das Abfangen eines ausbrechenden Hecks erschweren. Vertikale Synchronisierung, zusätzliche Bildpuffer und langsame Bildschirme erhöhen die Verzögerung.",
      "Spielmodi von Bildschirmen und eine hohe, stabile Bildrate verringern sie."
    ],
    tipp: "Aktiviere am Bildschirm den Spielmodus und vermeide unnötige Bildpuffer in den Grafikeinstellungen.",
    siehe: ["vsync", "fps", "bildwiederholrate"] },

  { id: "bildwiederholrate", begriff: "Bildwiederholrate", englisch: "Refresh Rate / Hz",
    kurz: "Wie oft der Bildschirm pro Sekunde ein neues Bild anzeigt.",
    text: [
      "Die Bildwiederholrate wird in Hertz angegeben. Ein 144-Hz-Bildschirm kann bis zu 144 Bilder pro Sekunde darstellen.",
      "Eine höhere Rate macht Bewegungen flüssiger und verringert die Verzögerung – vorausgesetzt, die Grafikkarte liefert genug Bilder. Liegen Bildrate und Bildwiederholrate weit auseinander, entstehen Ruckler oder Bildrisse.",
      "Viele Simracer nutzen Bildschirme mit 120 Hz oder mehr."
    ],
    tipp: "Stelle sicher, dass dein Bildschirm in den Systemeinstellungen wirklich mit seiner maximalen Rate läuft – oft ist ab Werk ein niedrigerer Wert eingestellt.",
    siehe: ["fps", "vsync", "input-lag"] },

  { id: "vsync", begriff: "V-Sync, G-Sync und FreeSync", englisch: "V-Sync / G-Sync / FreeSync",
    kurz: "Verfahren, die Bildrate der Grafikkarte und Bildschirm synchronisieren.",
    text: [
      "Ohne Synchronisierung kann der Bildschirm Teile zweier Bilder gleichzeitig zeigen – es entstehen Bildrisse (Tearing). Die klassische vertikale Synchronisierung (V-Sync) verhindert das, indem die Grafikkarte auf den Bildschirm wartet. Das kann aber die Eingabeverzögerung erhöhen.",
      "Adaptive Verfahren wie G-Sync und FreeSync lassen stattdessen den Bildschirm seine Wiederholrate an die Grafikkarte anpassen. So gibt es keine Bildrisse und kaum zusätzliche Verzögerung, solange die Bildrate im unterstützten Bereich liegt.",
      "Welches Verfahren nutzbar ist, hängt von Grafikkarte und Bildschirm ab."
    ],
    tipp: "Wenn dein Bildschirm adaptive Synchronisierung unterstützt, nutze sie und begrenze die Bildrate knapp unter die maximale Wiederholrate.",
    siehe: ["bildwiederholrate", "input-lag", "frame-time"] },

  { id: "lenkwinkel", begriff: "Lenkwinkel", englisch: "Steer Lock",
    kurz: "Wie weit das Lenkrad von Anschlag zu Anschlag gedreht werden kann.",
    text: [
      "Der Lenkwinkel gibt an, wie viele Grad das Lenkrad insgesamt drehen kann, etwa 540 oder 900 Grad. Jedes reale Fahrzeug hat einen eigenen Wert.",
      "Stimmen der Lenkwinkel deiner Basis und der des Autos in der Simulation überein, dreht sich das virtuelle Lenkrad genau wie deines. Ist er falsch eingestellt, wird die Lenkung zu direkt oder zu indirekt.",
      "Viele Simulationen stellen den passenden Winkel automatisch ein, wenn die Basis es unterstützt."
    ],
    tipp: "Stelle deine Basis auf einen hohen Winkel und lass die Simulation den Wert je Auto anpassen. Prüfe, ob sich virtuelles und echtes Lenkrad gleich drehen.",
    siehe: ["force-feedback", "deadzone"] },

  { id: "pedalkurve", begriff: "Pedalkurve", englisch: "Linearity / Pedal Curve",
    kurz: "Zusammenhang zwischen Pedalstellung oder Pedalkraft und der Eingabe in der Simulation.",
    text: [
      "Eine lineare Kurve bedeutet: Halber Pedalweg entspricht halber Eingabe. Mit einer angepassten Kurve kann man zum Beispiel den Anfangsbereich feiner und den Endbereich gröber machen.",
      "Beim Bremspedal hilft eine passende Kurve, den Bereich kurz vor dem Blockieren präziser zu treffen. Beim Gaspedal kann sie die Dosierung am Kurvenausgang erleichtern.",
      "Zu starke Kurven verfälschen allerdings das Gefühl und erschweren den Wechsel zwischen Fahrzeugen."
    ],
    tipp: "Beginne linear und ändere die Kurve nur, wenn du ein konkretes Problem lösen willst. Gute Pedale brauchen meist wenig Korrektur.",
    siehe: ["deadzone", "load-cell", "motorkennfeld"] },

  { id: "deadzone", begriff: "Totzone", englisch: "Deadzone",
    kurz: "Bereich am Anfang oder Ende eines Pedals oder Lenkrads ohne Wirkung.",
    text: [
      "Eine Totzone legt fest, dass ein Teil des Pedalwegs oder Lenkwinkels ignoriert wird. Am Pedalanfang verhindert sie, dass eine leicht aufliegende Fußspitze schon bremst oder Gas gibt.",
      "Am Ende sorgt eine kleine Totzone dafür, dass 100 Prozent sicher erreicht werden – wichtig, damit das Gas wirklich voll offen ist.",
      "Zu große Totzonen kosten Präzision, weil ein Teil des Wegs verloren geht."
    ],
    tipp: "Stelle am Gaspedal eine kleine Totzone am Ende ein, damit Vollgas zuverlässig ankommt. Prüfe in der Telemetrie, ob du wirklich 100 Prozent erreichst.",
    siehe: ["pedalkurve", "lenkwinkel"] },

  { id: "ffb-filter", begriff: "Force-Feedback-Filter", englisch: "Damper / Friction / Inertia",
    kurz: "Zusätzliche Effekte, die das Lenkgefühl dämpfen, bremsen oder schwerer machen.",
    text: [
      "Viele Lenkradtreiber bieten Filter: Dämpfung (Damper) bremst schnelle Lenkbewegungen, Reibung (Friction) erzeugt einen gleichmäßigen Widerstand, Trägheit (Inertia) lässt das Lenkrad schwerer wirken.",
      "Sie können ein unruhiges Lenkrad beruhigen, Schwingungen verhindern und ein realistischeres Gewicht erzeugen. Zu viel davon überdeckt aber die Informationen aus dem Force Feedback.",
      "Ob und wie viel nötig ist, hängt von der Basis und dem persönlichen Geschmack ab."
    ],
    tipp: "Nutze Filter sparsam. Ein wenig Dämpfung gegen Nachschwingen auf der Geraden kann helfen – das Gripgefühl in der Kurve sollte erhalten bleiben.",
    siehe: ["force-feedback", "ffb-clipping", "direct-drive"] },

  { id: "ffb-clipping", begriff: "Force-Feedback-Clipping", englisch: "FFB Clipping",
    kurz: "Die Kraft übersteigt das Maximum der Basis und wird abgeschnitten.",
    text: [
      "Jede Lenkradbasis kann nur eine bestimmte Maximalkraft erzeugen. Verlangt die Simulation mehr, wird die Kraft abgeschnitten – Clipping. In diesen Momenten gehen alle feinen Informationen verloren.",
      "Typisch ist Clipping in schnellen Kurven mit hoher Seitenkraft oder bei Fahrzeugen mit schwerer Lenkung. Genau dort, wo man die Grenze spüren will, fühlt sich das Lenkrad dann gleichmäßig schwer an.",
      "Viele Simulationen zeigen Clipping an oder bieten eine automatische Anpassung der Stärke."
    ],
    tipp: "Reduziere die Force-Feedback-Stärke in der Simulation, bis die Clipping-Anzeige in den schnellsten Kurven nur noch selten ausschlägt.",
    siehe: ["force-feedback", "ffb-filter", "direct-drive"] },
]);
