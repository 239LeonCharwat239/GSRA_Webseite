// GSRA – Nachschlagewerk: Weiterführende Telemetrie- und Datenanalyse-Begriffe (ergänzt 24.11.2026)
// Grundlage für das kommende GSRA-Telemetrie-Tool: Jeder Begriff beschreibt, was man in den Daten sieht.
import { kategorie } from "./begriff";

export const DATENANALYSE = kategorie("Telemetrie & Datenanalyse", [
  { id: "telemetrie-kanal", begriff: "Messkanal und Kurve", englisch: "Trace / Telemetry Channel",
    kurz: "Eine einzelne aufgezeichnete Messgröße, die als Kurve über Zeit oder Streckenposition dargestellt wird.",
    text: [
      "Jede Messgröße – Geschwindigkeit, Gaspedal, Bremsdruck, Lenkwinkel, Gang, Drehzahl, Federwege, Temperaturen – wird als eigener Kanal aufgezeichnet. In der Auswertung erscheint jeder Kanal als Kurve, im Fachjargon Trace genannt.",
      "Entscheidend ist die Achse: Über der Zeit aufgetragen, verschieben sich zwei Runden gegeneinander, sobald eine schneller ist. Über der Streckenposition (Distanz) liegen beide Runden Punkt für Punkt übereinander, und man sieht genau, wo ein Fahrer früher bremst oder später Gas gibt.",
      "Aus aufgezeichneten Kanälen lassen sich weitere berechnen, etwa das Delta zwischen zwei Runden, die Dämpfergeschwindigkeit aus dem Federweg oder der Schlupf aus Rad- und Fahrzeuggeschwindigkeit."
    ],
    tipp: "Vergleiche Runden immer über der Streckenposition, nicht über der Zeit – nur so liegen Bremspunkte und Kurven direkt übereinander.",
    siehe: ["telemetrie", "abtastrate", "geschwindigkeitsprofil", "delta"] },

  { id: "abtastrate", begriff: "Abtastrate", englisch: "Sampling Rate (Hz)",
    kurz: "Wie oft pro Sekunde ein Messwert aufgezeichnet wird – angegeben in Hertz.",
    text: [
      "Eine Abtastrate von 60 Hz bedeutet 60 Messwerte pro Sekunde. Bei 250 km/h legt ein Auto in einer Sechzigstelsekunde rund 1,2 Meter zurück – so genau lässt sich also ein Bremspunkt bestimmen.",
      "Langsame Größen wie Temperaturen oder Kraftstoffstand brauchen nur wenige Messungen pro Sekunde. Schnelle Vorgänge wie Dämpferbewegungen, Radschlupf oder Bremsdruckspitzen brauchen dagegen hohe Raten, sonst gehen kurze Ausschläge verloren oder werden verfälscht.",
      "Simulationen stellen Telemetrie mit unterschiedlichen Raten bereit. Für Fahrstil-Vergleiche reichen meist 60 Hz, für die Fahrwerksanalyse sind höhere Raten deutlich aussagekräftiger."
    ],
    tipp: "Wirkt eine Kurve in deiner Telemetrie eckig oder springt sie, ist die Abtastrate zu niedrig für diese Messgröße – ziehe dann keine Schlüsse aus Einzelwerten.",
    siehe: ["telemetrie-kanal", "daempfer-histogramm", "telemetrie-dateiformate"] },

  { id: "datenlogger", begriff: "Datenlogger und Auswertungssoftware", englisch: "Data Logger / Analysis Software",
    kurz: "Das Gerät, das im Fahrzeug Messwerte aufzeichnet, und die Programme, mit denen Ingenieure sie auswerten.",
    text: [
      "Im echten Rennwagen sammelt ein Datenlogger die Signale aller Sensoren und speichert sie, oft zusammen mit Display und Steuergerät in einem System. Nach der Fahrt werden die Daten an der Box ausgelesen; viele Teams übertragen ausgewählte Kanäle zusätzlich live per Funk.",
      "Professionelle Auswertungsprogramme zeigen die Kanäle als Kurven, berechnen Rundenvergleiche, Histogramme und G-G-Diagramme und erlauben eigene Formeln für berechnete Kanäle. Einige Simulationen können ihre Telemetrie im Format verbreiteter Profi-Programme exportieren.",
      "Für Simracer gibt es zusätzlich Werkzeuge, die direkt auf die Live-Daten der Simulation zugreifen und Runden automatisch vergleichen. Das GSRA-Telemetrie-Tool wird diesen Weg gehen."
    ],
    tipp: "Lerne zuerst die fünf wichtigsten Kanäle zu lesen – Geschwindigkeit, Gas, Bremse, Lenkwinkel und Gang. Damit findest du die meisten Zeitverluste.",
    siehe: ["telemetrie", "telemetrie-kanal", "telemetrie-dateiformate", "ecu"] },

  { id: "telemetrie-dateiformate", begriff: "Telemetrie-Dateiformate", englisch: "CSV / IBT / Logger Formats",
    kurz: "Die Dateien, in denen Simulationen und Datenlogger aufgezeichnete Runden speichern.",
    text: [
      "Jede Simulation speichert Telemetrie in einem eigenen Format. iRacing nutzt zum Beispiel IBT-Dateien, die alle Kanäle einer Sitzung enthalten. Andere Simulationen stellen die Daten nur live über eine Schnittstelle bereit oder exportieren sie in Formate professioneller Auswertungsprogramme.",
      "CSV-Dateien sind einfache Tabellen mit einer Zeile pro Messpunkt und einer Spalte pro Kanal. Sie lassen sich in jedem Tabellenprogramm öffnen, werden bei langen Sitzungen aber sehr groß.",
      "Für den Austausch mit Teamkollegen oder Coaches ist wichtig, dass beide dasselbe Format lesen können – und dass die Datei zur gleichen Strecke und Fahrzeugversion passt."
    ],
    tipp: "Benenne Telemetrie-Dateien nach Strecke, Fahrzeug, Datum und Rundenzeit. So findest du nach Wochen noch die passende Referenzrunde.",
    siehe: ["datenlogger", "telemetrie", "abtastrate"] },

  { id: "eigenlenkgradient", begriff: "Eigenlenkgradient", englisch: "Understeer / Oversteer Gradient",
    kurz: "Wie stark der nötige Lenkwinkel mit der Querbeschleunigung wächst – das Maß für Unter- und Übersteuern.",
    text: [
      "Fährt ein Auto auf einem festen Radius immer schneller, braucht ein untersteuerndes Fahrzeug zunehmend mehr Lenkwinkel, ein übersteuerndes zunehmend weniger. Der Eigenlenkgradient beschreibt genau diese Veränderung, meist in Grad Lenkwinkel je g Querbeschleunigung.",
      "In der Telemetrie vergleicht man den tatsächlichen Lenkwinkel mit dem, den die Fahrzeuggeometrie für die gefahrene Kurve rechnerisch braucht. Liegt der gemessene Wert darüber, untersteuert das Auto; liegt er darunter, übersteuert es.",
      "Getrennt nach Kurveneingang, Scheitelpunkt und Ausgang zeigt die Auswertung, wo die Balance kippt – und damit, welche Setup-Stellschraube die richtige ist."
    ],
    tipp: "Untersteuert das Auto nur am Kurveneingang, hilft eher Bremsbalance oder Trail Braking; untersteuert es am Ausgang, eher Differential oder Stabilisatoren.",
    siehe: ["untersteuern", "uebersteuern", "lenkwinkelsensor", "gierratensensor"] },

  { id: "lenkwinkel-histogramm", begriff: "Lenkwinkel-Histogramm", englisch: "Steering Histogram",
    kurz: "Eine Häufigkeitsverteilung, die zeigt, wie viel Zeit ein Fahrer mit welchen Lenkwinkeln verbringt.",
    text: [
      "Ein Histogramm zählt, wie oft bestimmte Werte vorkommen. Beim Lenkwinkel zeigt es, wie viel einer Runde bei geradem Lenkrad, bei kleinen Korrekturen und bei großen Einschlägen gefahren wird.",
      "Spannend ist die Lenkgeschwindigkeit: Viele schnelle Korrekturen deuten auf ein unruhiges Heck oder einen nervösen Fahrstil hin. Ein ruhiger Fahrer mit gut abgestimmtem Auto zeigt eine schmale, gleichmäßige Verteilung.",
      "Im Vergleich zweier Fahrer im selben Auto offenbart das Histogramm Unterschiede, die man in einzelnen Kurven leicht übersieht."
    ],
    tipp: "Siehst du viele hektische Lenkkorrekturen, arbeite zuerst an einem stabileren Auto – ein ruhiges Fahrzeug ist fast immer auch ein schnelleres.",
    siehe: ["lenkwinkelsensor", "konstanz", "gegenlenken"] },

  { id: "daempfer-histogramm", begriff: "Dämpfergeschwindigkeits-Histogramm", englisch: "Damper Histogram",
    kurz: "Zeigt, wie oft die Dämpfer mit welcher Geschwindigkeit ein- und ausfedern – Grundlage der Dämpferabstimmung.",
    text: [
      "Aus dem Federweg wird die Geschwindigkeit berechnet, mit der sich der Dämpfer bewegt. Das Histogramm teilt diese Geschwindigkeiten in Druckstufe (Einfedern) und Zugstufe (Ausfedern) sowie in langsame und schnelle Bewegungen.",
      "Langsame Bewegungen entstehen durch Wanken und Nicken beim Bremsen, Einlenken und Beschleunigen; schnelle Bewegungen durch Bodenwellen und Randsteine. Ein ausgewogenes Histogramm ist annähernd symmetrisch: Das Rad federt ähnlich schnell ein wie aus.",
      "Ist die Verteilung schief, arbeitet eine Stufe zu hart oder zu weich. Die Abstimmung der Low- und High-Speed-Bereiche lässt sich damit gezielt prüfen."
    ],
    tipp: "Vergleiche die Histogramme der linken und rechten Fahrzeugseite – große Unterschiede deuten oft auf eine Strecke mit vielen Kurven in eine Richtung oder ein ungleiches Setup hin.",
    siehe: ["daempfer", "low-speed-druckstufe", "high-speed-druckstufe", "federwegsensor"] },

  { id: "bodenfreiheit-verlauf", begriff: "Bodenfreiheitsverlauf", englisch: "Ride Height Trace",
    kurz: "Wie sich die Höhe des Fahrzeugs über dem Boden entlang der Runde verändert.",
    text: [
      "Aus den Federwegen und dem statischen Setup berechnet man die dynamische Bodenfreiheit an Vorder- und Hinterachse. Ihr Verlauf zeigt, wie tief das Auto bei hoher Geschwindigkeit durch den Abtrieb gedrückt wird, wie es beim Bremsen eintaucht und beim Beschleunigen hinten einsinkt.",
      "Für Fahrzeuge mit Unterbodenaerodynamik ist das entscheidend: Der Abtrieb hängt stark vom Abstand zum Boden ab. Zu tief, und der Unterboden setzt auf oder die Strömung reißt ab; zu hoch, und es geht Abtrieb verloren.",
      "Der Verlauf verrät auch, an welchen Stellen das Auto aufsetzt – oft an Bodenwellen in schnellen Passagen oder beim Überfahren von Randsteinen."
    ],
    tipp: "Setzt dein Auto in der Telemetrie auf schnellen Geraden auf, erhöhe die Fahrhöhe oder die Federrate, bevor du am Flügel drehst.",
    siehe: ["fahrzeughoehe", "dynamischer-rake", "bodeneffekt", "porpoising"] },

  { id: "dynamischer-rake", begriff: "Dynamischer Rake", englisch: "Dynamic Rake",
    kurz: "Die Neigung des Fahrzeugs von vorn nach hinten während der Fahrt – nicht nur im Stand.",
    text: [
      "Rake bezeichnet den Höhenunterschied zwischen Vorder- und Hinterachse. Im Setup stellt man einen statischen Wert ein; während der Fahrt verändert er sich jedoch ständig: Beim Bremsen taucht die Front ab und der Rake wächst, beim Beschleunigen sinkt das Heck und der Rake schrumpft, bei hohem Tempo drückt der Abtrieb beide Achsen unterschiedlich stark nach unten.",
      "Weil Diffusor und Unterboden stark auf diese Neigung reagieren, verschiebt sich mit dem Rake auch die Aero-Balance. Ein Auto kann deshalb in langsamen Kurven untersteuern und in schnellen übersteuern – oder umgekehrt.",
      "In der Telemetrie wird der dynamische Rake aus den Fahrhöhen beider Achsen berechnet und über die Runde verfolgt."
    ],
    tipp: "Wechselt die Balance deines Autos zwischen langsamen und schnellen Kurven stark, betrachte den Rake-Verlauf – oft liegt die Lösung in Federn oder Fahrhöhe statt im Flügel.",
    siehe: ["rake", "aero-balance", "bodenfreiheit-verlauf", "diffusor"] },

  { id: "bremsdruckkurve", begriff: "Bremsdruckkurve", englisch: "Brake Trace / Brake Modulation",
    kurz: "Der Verlauf des Bremsdrucks in einer Bremszone – das wichtigste Bild für die Bremstechnik.",
    text: [
      "Die ideale Bremsung hat eine typische Form: ein schneller, kräftiger Anstieg auf den Höchstdruck, eine kurze Phase nahe dem Maximum und dann ein gleichmäßiges, allmähliches Lösen bis in den Kurveneingang. Die Fläche unter der Kurve zeigt, wie viel Verzögerung insgesamt erzeugt wurde.",
      "Häufige Fehler sind ein zu zögerlicher Beginn (der Höchstdruck kommt zu spät), ein Plateau unter dem möglichen Maximum oder ein abruptes Loslassen, das die Vorderachse entlastet und Untersteuern auslöst.",
      "Mit abnehmender Geschwindigkeit sinkt der Abtrieb – bei Fahrzeugen mit viel Aerodynamik muss der Druck deshalb im Verlauf der Bremsung zurückgenommen werden, sonst blockieren die Räder."
    ],
    tipp: "Lege deine Bremsdruckkurve über die eines schnelleren Fahrers. Liegt sein Anstieg steiler und sein Lösen länger, bremst du zu zaghaft an und gibst die Bremse zu früh frei.",
    siehe: ["threshold-braking", "trail-braking", "bremsdruck", "load-cell"] },

  { id: "gaspedalkurve", begriff: "Gaspedalkurve", englisch: "Throttle Trace",
    kurz: "Der Verlauf der Gaspedalstellung – sie zeigt, wann und wie entschlossen ein Fahrer beschleunigt.",
    text: [
      "Die Gaspedalkurve zeigt in Prozent, wie weit das Pedal gedrückt ist. Auf der Geraden steht sie auf 100 Prozent; in Kurven verraten Zeitpunkt und Form des Wiederbeschleunigens viel über Fahrstil und Balance.",
      "Ideal ist ein frühes, aber gleichmäßig ansteigendes Gas am Kurvenausgang. Ein Sägezahnmuster – Gas, weg, Gas – deutet auf ein Heck hin, das nicht genug Traktion hat, oder auf einen Fahrer, der zu früh zu viel will. Eine lange Phase ohne Gas zwischen Bremse und Beschleunigen ist verschenkte Zeit.",
      "In der Mitte schneller Kurven zeigt die Kurve, ob der Fahrer Vollgas halten kann oder kurz lupfen muss."
    ],
    tipp: "Suche in deiner Telemetrie die Stelle, an der du nach dem Scheitelpunkt zum ersten Mal Gas gibst. Liegt sie später als bei Schnelleren, liegt dort meist die meiste Zeit.",
    siehe: ["traktion", "kurvenausgang", "bremsdruckkurve", "power-oversteer"] },

  { id: "g-g-diagramm", begriff: "G-G-Diagramm", englisch: "G-G Diagram / Friction Circle",
    kurz: "Ein Punktdiagramm aus Längs- und Querbeschleunigung, das zeigt, wie gut der Grip ausgenutzt wird.",
    text: [
      "Im G-G-Diagramm wird für jeden Messpunkt die Längsbeschleunigung gegen die Querbeschleunigung aufgetragen. Bremsen liegt oben oder unten, Kurvenfahrt links oder rechts, kombinierte Manöver in den Diagonalen.",
      "Ein Reifen kann nur eine begrenzte Gesamtkraft übertragen – das beschreibt der Kammsche Kreis. Ein guter Fahrer füllt das Diagramm bis an diesen Rand aus, auch in den Diagonalen beim Übergang von der Bremse in die Kurve und von der Kurve ins Gas. Fehlen diese Ecken, fährt er die Übergänge zu vorsichtig.",
      "Mit viel Abtrieb wächst der Kreis bei hohem Tempo; die Form wird dadurch eher eine Birne oder ein Ei als ein Kreis."
    ],
    tipp: "Wirkt dein Diagramm wie ein Plus-Zeichen statt wie ein gefüllter Kreis, bremst und lenkst du getrennt – übe, die Bremse bis in die Kurve hinein zu lösen.",
    siehe: ["grip-kreis", "beschleunigungssensor", "trail-braking", "grip"] },

  { id: "geschwindigkeitsprofil", begriff: "Geschwindigkeitsprofil", englisch: "Speed Trace",
    kurz: "Der Verlauf der Geschwindigkeit über eine Runde – das erste Bild jeder Datenanalyse.",
    text: [
      "Das Geschwindigkeitsprofil zeigt Geraden als ansteigende Linien, Bremszonen als steile Abfälle und Kurven als Täler. Der tiefste Punkt jedes Tals ist die Kurvenmindestgeschwindigkeit.",
      "Im Vergleich zweier Runden erkennt man sofort, wo Zeit verloren geht: früheres Bremsen (der Abfall beginnt eher), ein tieferes Tal (zu langsam in der Kurve) oder ein flacherer Anstieg (späteres oder vorsichtigeres Beschleunigen). Ein höheres Tempo am Kurvenausgang wirkt dabei auf die ganze folgende Gerade.",
      "Zusammen mit dem Delta-Kanal zeigt das Profil nicht nur, wo, sondern auch warum Zeit verloren wird."
    ],
    tipp: "Schau zuerst auf die Kurvenausgänge vor langen Geraden: Zwei km/h mehr am Ausgang bringen dort oft mehr als ein späterer Bremspunkt.",
    siehe: ["mindestgeschwindigkeit", "delta", "telemetrie-kanal", "kurvenausgang"] },

  { id: "verbrauch-pro-runde", begriff: "Verbrauch pro Runde", englisch: "Fuel per Lap",
    kurz: "Die Kraftstoffmenge, die ein Auto in einer Runde verbraucht – Grundlage jeder Stintplanung.",
    text: [
      "Der Verbrauch pro Runde hängt von Strecke, Fahrzeug, Motorkennfeld, Fahrstil und Verkehr ab. Im Windschatten sinkt er, mit Vollgas in freier Luft und vielen Beschleunigungsphasen steigt er.",
      "Man ermittelt ihn am besten aus mehreren Runden: Tankinhalt zu Beginn minus Tankinhalt am Ende, geteilt durch die gefahrenen Runden. Einzelne Runden schwanken, etwa durch Gelbphasen oder Überholmanöver.",
      "Aus dem Verbrauch ergeben sich Stintlänge, Tankmenge, Anzahl der Stopps und die Frage, ob sich Kraftstoffsparen lohnt."
    ],
    tipp: "Miss deinen Verbrauch im Training über mindestens fünf Runden im Rennrhythmus – der Stint-Planer der GSRA rechnet ihn dir mit „Verbrauch messen“ aus.",
    siehe: ["tankmenge", "fuel-delta", "spritsparen", "stint"] },

  { id: "fuel-delta", begriff: "Kraftstoff-Delta", englisch: "Fuel Delta",
    kurz: "Der Unterschied zwischen dem Kraftstoff, den man hat, und dem, den man bis zum Ziel oder Stopp braucht.",
    text: [
      "Das Kraftstoff-Delta zeigt, ob der Tankinhalt reicht. Ein positives Delta bedeutet einen Überschuss, ein negatives, dass bis zum geplanten Stopp oder bis ins Ziel Kraftstoff fehlt.",
      "Viele Displays und Telemetrie-Programme zeigen dazu den Zielverbrauch je Runde: wie viel man pro Runde höchstens verbrauchen darf, um anzukommen. Liegt der aktuelle Verbrauch darüber, muss gespart werden.",
      "Gerade bei Safety-Car-Phasen, in denen kaum Kraftstoff verbraucht wird, verändert sich das Delta schnell – und damit die Strategie."
    ],
    tipp: "Behalte das Kraftstoff-Delta ab der Hälfte eines Stints im Blick. Früh ein wenig sparen kostet weniger Zeit als später stark lupfen zu müssen.",
    siehe: ["verbrauch-pro-runde", "spritsparen", "lift-coast", "safety-car"] },

  { id: "verschleissrate", begriff: "Reifen-Verschleißrate", englisch: "Tire Wear Rate",
    kurz: "Wie viel Profil oder Leistung ein Reifen pro Runde verliert.",
    text: [
      "Die Verschleißrate beschreibt, wie schnell ein Reifen abgenutzt wird – gemessen am Materialabtrag oder an der Rundenzeit, die er pro Runde verliert. Sie hängt von Mischung, Asphalt, Temperatur, Setup und Fahrstil ab.",
      "Viel Rutschen, starkes Bremsen mit blockierenden Rädern und hohe Temperaturen erhöhen den Verschleiß. Ein zu hoher oder zu niedriger Druck sowie extreme Sturzwerte nutzen den Reifen zudem ungleichmäßig ab.",
      "Für die Strategie ist entscheidend, ob ein Reifen einen doppelten Stint übersteht und wann sich ein Wechsel lohnt."
    ],
    tipp: "Notiere nach jedem Stint den Reifenzustand an allen vier Ecken. Nutzt sich eine Ecke viel schneller ab, liegt dort die Grenze deines Stints – und dein nächster Setup-Ansatz.",
    siehe: ["verschleiss", "reifenabbau", "stint-analyse", "double-stint"] },

  { id: "stint-analyse", begriff: "Stint-Analyse und Leistungsabfall", englisch: "Stint Analysis / Pace Drop-off",
    kurz: "Die Auswertung aller Runden eines Stints, um zu sehen, wie schnell das Tempo nachlässt.",
    text: [
      "In einer Stint-Analyse werden die Rundenzeiten eines Stints nacheinander aufgetragen. Normalerweise werden sie anfangs schneller, weil der Tank leerer wird, und später langsamer, weil die Reifen abbauen.",
      "Die Steigung dieser Kurve ist der Leistungsabfall pro Runde. Er entscheidet über die Strategie: Bei starkem Abfall lohnt sich ein früher Reifenwechsel oder ein Undercut, bei geringem Abfall ein langer Stint.",
      "Ausreißer durch Verkehr, Gelbphasen oder Fehler werden herausgerechnet, damit der Trend sichtbar bleibt."
    ],
    tipp: "Fahre im Training einen kompletten Stint am Stück. Erst dann weißt du, wie dein Tempo in Runde 20 aussieht – und nicht nur in Runde 3.",
    siehe: ["reifenabbau", "verschleissrate", "undercut", "konstanz"] },

  { id: "konstanz", begriff: "Konstanz", englisch: "Consistency (Standard Deviation of Lap Times)",
    kurz: "Wie gleichmäßig ein Fahrer seine Runden fährt – gemessen an der Streuung der Rundenzeiten.",
    text: [
      "Konstanz lässt sich als Standardabweichung der Rundenzeiten ausdrücken: Je kleiner sie ist, desto näher liegen die Runden beieinander. Spitzenfahrer liegen über einen Stint oft innerhalb weniger Zehntelsekunden.",
      "Im Rennen ist Konstanz oft wichtiger als eine einzelne schnelle Runde. Wer jede Runde ähnlich schnell fährt, schont Reifen, macht weniger Fehler und lässt sich besser planen.",
      "Die Auswertung nach Sektoren zeigt, wo die Streuung entsteht – oft in wenigen schwierigen Kurven."
    ],
    tipp: "Fahre im Training zehn Runden bei 99 Prozent und vergleiche die Streuung mit zehn Runden am Limit. Häufig ist die gleichmäßige Variante im Schnitt schneller.",
    siehe: ["stint-analyse", "sektorzeiten", "lenkwinkel-histogramm"] },
]);
