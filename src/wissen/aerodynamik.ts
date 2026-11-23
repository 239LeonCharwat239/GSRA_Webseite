// GSRA – Nachschlagewerk: Aerodynamik
import { kategorie } from "./begriff";

export const AERODYNAMIK = kategorie("Aerodynamik", [
  { id: "abtrieb", begriff: "Abtrieb", englisch: "Downforce",
    kurz: "Aerodynamische Kraft, die das Fahrzeug auf die Fahrbahn drückt.",
    text: [
      "Flügel, Unterboden und Diffusor lenken die Luft so, dass über dem Auto ein höherer Druck entsteht als darunter. Die Differenz drückt das Fahrzeug nach unten – wie ein umgedrehter Flugzeugflügel.",
      "Mehr Andruck bedeutet mehr Last auf den Reifen und damit mehr Grip, ohne dass das Auto schwerer wird. Weil der Abtrieb mit dem Quadrat der Geschwindigkeit wächst, wirkt er vor allem in schnellen Kurven: Bei doppelter Geschwindigkeit ist er viermal so groß.",
      "Abtrieb hat immer einen Preis: Er erzeugt Luftwiderstand und kostet Höchstgeschwindigkeit. Die Kunst liegt darin, für jede Strecke das richtige Verhältnis zu finden."
    ],
    tipp: "Auf Strecken mit vielen schnellen Kurven lohnt mehr Abtrieb, auf Strecken mit langen Geraden weniger. Vergleiche in der Telemetrie Kurvengeschwindigkeit und Höchstgeschwindigkeit.",
    siehe: ["luftwiderstand", "aero-balance", "aerodynamischer-grip", "l-d-verhaeltnis"] },

  { id: "luftwiderstand", begriff: "Luftwiderstand", englisch: "Drag",
    kurz: "Kraft, die das Fahrzeug durch die umströmende Luft abbremst.",
    text: [
      "Der Luftwiderstand wächst – wie der Abtrieb – mit dem Quadrat der Geschwindigkeit. Die benötigte Motorleistung, um ihn zu überwinden, steigt sogar mit der dritten Potenz. Deshalb kostet jeder zusätzliche km/h Höchstgeschwindigkeit überproportional viel Leistung.",
      "Er entsteht durch die Stirnfläche, durch Verwirbelungen hinter dem Auto und als Nebenprodukt des Abtriebs (induzierter Widerstand). Auch offene Kühlöffnungen und Bremsbelüftungen tragen dazu bei.",
      "Im Rennen spielt der Widerstand nicht nur für die Rundenzeit eine Rolle: Er bestimmt auch, wie stark der Windschatten wirkt und wie viel Kraftstoff verbraucht wird."
    ],
    tipp: "Fehlt dir auf den Geraden Geschwindigkeit, prüfe Heckflügel, Rake und Kühleröffnungen. Schon kleine Änderungen am Flügel bringen oft mehrere km/h.",
    siehe: ["abtrieb", "windschatten", "l-d-verhaeltnis", "heckfluegel"] },

  { id: "auftrieb", begriff: "Auftrieb", englisch: "Lift",
    kurz: "Aerodynamische Kraft, die ein Fahrzeug von der Fahrbahn abhebt.",
    text: [
      "Viele Serienfahrzeuge erzeugen bei hoher Geschwindigkeit Auftrieb, weil die Luft über das gewölbte Dach schneller strömt als unter dem Auto. Die Räder werden entlastet, das Auto wird leichter zu lenken, aber auch instabiler.",
      "Im Rennsport ist Auftrieb unerwünscht. Er tritt aber auf, wenn die Strömung gestört wird – etwa wenn ein Auto quer steht oder rückwärts fährt. Dann kann es sogar abheben, wie man es von schweren Unfällen bei Langstreckenrennen kennt.",
      "Bei Fahrzeugen mit wenig Aerodynamik, etwa historischen Rennwagen, spürt man den Auftrieb als leichter werdende Lenkung bei Höchstgeschwindigkeit."
    ],
    tipp: "Wirkt die Lenkung bei sehr hoher Geschwindigkeit plötzlich leicht und ungenau, erzeugt die Front Auftrieb – mehr Frontflügel oder weniger Heckhöhe kann helfen.",
    siehe: ["abtrieb", "rake", "stroemungsabriss"] },

  { id: "l-d-verhaeltnis", begriff: "Aerodynamische Effizienz", englisch: "L/D Ratio",
    kurz: "Verhältnis von Abtrieb zu Luftwiderstand – wie viel Andruck je Einheit Widerstand.",
    text: [
      "Die Effizienz beschreibt, wie viel Abtrieb ein Fahrzeug oder ein Bauteil im Verhältnis zum erzeugten Widerstand liefert. Ein Wert von 3 bedeutet, dass dreimal so viel Abtrieb wie Widerstand entsteht.",
      "Unterboden und Diffusor gelten als sehr effizient, weil sie Abtrieb mit wenig Widerstand erzeugen. Große Heckflügel liefern viel Abtrieb, aber zu einem höheren Preis.",
      "Für die Abstimmung bedeutet das: Wer Abtrieb über den Unterboden gewinnt, etwa durch Rake oder eine tiefere Fahrzeughöhe, verliert weniger Höchstgeschwindigkeit als mit einem steileren Flügel."
    ],
    tipp: "Bevor du den Heckflügel steiler stellst, prüfe, ob du über Fahrzeughöhe und Rake effizienteren Abtrieb gewinnen kannst.",
    siehe: ["abtrieb", "luftwiderstand", "unterboden", "rake"] },

  { id: "aero-balance", begriff: "Aero-Balance", englisch: "Aero Balance",
    kurz: "Verteilung des Abtriebs zwischen Vorder- und Hinterachse.",
    text: [
      "Die Aero-Balance gibt meist an, welcher Prozentsatz des gesamten Abtriebs auf die Vorderachse wirkt. Sie bestimmt das Verhalten in schnellen Kurven, wo der aerodynamische Grip den mechanischen überwiegt.",
      "Mehr Abtrieb vorn macht das Auto in schnellen Kurven spitzer und neigt zum Übersteuern; mehr Abtrieb hinten macht es stabil, aber untersteuernd. Eingestellt wird die Balance über Front- und Heckflügel, über Rake und Fahrzeughöhen.",
      "Weil sich die Fahrzeughöhen beim Bremsen und Beschleunigen ändern, wandert auch die Aero-Balance – ein wichtiger Grund für unterschiedliches Verhalten am Ein- und Ausgang schneller Kurven."
    ],
    tipp: "Untersteuert das Auto nur in schnellen, nicht in langsamen Kurven, ist das ein Fall für die Aero-Balance: mehr Frontflügel oder weniger Heckflügel.",
    siehe: ["druckpunkt", "rake", "frontfluegel", "heckfluegel"] },

  { id: "druckpunkt", begriff: "Druckpunkt", englisch: "Centre of Pressure (CoP)",
    kurz: "Punkt, an dem die gesamte aerodynamische Kraft angreift.",
    text: [
      "So wie das Gewicht im Schwerpunkt angreift, lassen sich alle aerodynamischen Kräfte im Druckpunkt zusammenfassen. Seine Lage zwischen den Achsen entspricht der Aero-Balance.",
      "Entscheidend ist, wie stabil er bleibt: Wandert der Druckpunkt beim Anbremsen nach vorn, wird das Heck leicht und das Auto instabil. Ingenieure versuchen deshalb, die Aerodynamik so zu gestalten, dass sich der Druckpunkt über alle Fahrzeughöhen hinweg möglichst wenig verschiebt.",
      "Bei Fahrzeugen mit starkem Bodeneffekt reagiert der Druckpunkt besonders empfindlich auf Höhenänderungen."
    ],
    tipp: "Wird dein Auto beim Anbremsen aus hoher Geschwindigkeit heckunruhig, wandert vermutlich der Druckpunkt nach vorn – weniger Rake oder härtere Front können helfen.",
    siehe: ["aero-balance", "rake", "bodeneffekt"] },

  { id: "frontfluegel", begriff: "Frontflügel", englisch: "Front Wing",
    kurz: "Flügel an der Fahrzeugnase, der Abtrieb an der Vorderachse erzeugt.",
    text: [
      "Der Frontflügel arbeitet in ungestörter Luft und ist deshalb sehr wirksam. Bei Formelfahrzeugen erzeugt er einen großen Teil des Frontabtriebs und lenkt zugleich die Luft um die Vorderräder und zum Unterboden.",
      "Ein steiler gestellter Frontflügel verschiebt die Aero-Balance nach vorn: Das Auto lenkt in schnellen Kurven williger ein. Weil er die Strömung für das ganze Auto vorbereitet, wirken Änderungen aber auch auf Unterboden und Heck.",
      "Im Windschatten oder in verwirbelter Luft verliert der Frontflügel besonders viel Wirkung – das ist die Hauptursache für Untersteuern beim Hinterherfahren."
    ],
    tipp: "Eine Stufe mehr Frontflügel ist die klassische Reaktion auf Untersteuern in schnellen Kurven. Rechne damit, dass das Auto in langsamen Kurven kaum anders reagiert.",
    siehe: ["aero-balance", "dirty-air", "endplatten", "heckfluegel"] },

  { id: "heckfluegel", begriff: "Heckflügel", englisch: "Rear Wing",
    kurz: "Flügel am Fahrzeugheck, der Abtrieb an der Hinterachse erzeugt.",
    text: [
      "Der Heckflügel ist das sichtbarste Aerodynamikteil und bei GT-Fahrzeugen die wichtigste Stellschraube für die Balance. Er sitzt hoch im ungestörten Luftstrom und erzeugt Abtrieb direkt über der Hinterachse.",
      "Ein steilerer Flügel bringt Stabilität in schnellen Kurven und beim Anbremsen, kostet aber deutlich Höchstgeschwindigkeit, weil er viel Widerstand erzeugt. Ein flacherer Flügel macht das Auto auf der Geraden schneller, aber in schnellen Kurven nervöser.",
      "Viele Rennserien begrenzen Größe und Winkel des Heckflügels, um die Leistungsfähigkeit anzugleichen."
    ],
    tipp: "Wenn du ein neues Auto auf einer neuen Strecke einstellst, beginne mit dem Heckflügel: Er legt das Grundniveau aus Stabilität und Höchstgeschwindigkeit fest.",
    siehe: ["anstellwinkel", "aero-balance", "luftwiderstand", "gurney-flap"] },

  { id: "anstellwinkel", begriff: "Flügelanstellwinkel", englisch: "Wing Angle / Angle of Attack",
    kurz: "Winkel, unter dem ein Flügel zur anströmenden Luft steht.",
    text: [
      "Je steiler ein Flügel angestellt ist, desto stärker lenkt er die Luft um und desto mehr Abtrieb erzeugt er – bis zu einem Grenzwinkel. Mit dem Abtrieb steigt auch der Widerstand.",
      "Wird der Winkel zu groß, kann die Strömung auf der Unterseite des Flügels nicht mehr anliegen und reißt ab. Dann fällt der Abtrieb schlagartig, während der Widerstand hoch bleibt.",
      "In Simulationen wird der Anstellwinkel meist in Stufen oder Grad angegeben. Wichtig ist der Vergleich innerhalb eines Fahrzeugs, nicht der absolute Wert."
    ],
    tipp: "Ändere den Flügel in einzelnen Stufen und miss Höchstgeschwindigkeit und Kurvengeschwindigkeit. So siehst du, ob sich der Tausch lohnt.",
    siehe: ["heckfluegel", "stroemungsabriss", "fluegelklappen"] },

  { id: "fluegelklappen", begriff: "Flügelelemente und Klappen", englisch: "Flaps / Elements",
    kurz: "Mehrteilige Flügel aus Hauptblatt und verstellbaren Klappen.",
    text: [
      "Rennflügel bestehen meist aus mehreren hintereinander angeordneten Profilen: dem Hauptblatt und einer oder mehreren Klappen. Zwischen ihnen bleibt ein schmaler Spalt, durch den energiereiche Luft auf die Unterseite der Klappe strömt.",
      "Dadurch bleibt die Strömung auch bei großen Gesamtanstellwinkeln anliegen, und der Flügel erzeugt viel mehr Abtrieb als ein einzelnes Profil. Verstellt wird meist der Winkel der Klappe, nicht des Hauptblatts.",
      "Bei Formelfahrzeugen ist das Verstellen der Frontflügelklappe der übliche Weg, die Balance während eines Boxenstopps anzupassen."
    ],
    tipp: "Wenn dein Fahrzeug eine verstellbare Frontklappe hat, nutze sie für Feinarbeit an der Balance – sie wirkt gezielter als große Änderungen am Heck.",
    siehe: ["anstellwinkel", "frontfluegel", "drs"] },

  { id: "drs", begriff: "DRS", englisch: "Drag Reduction System",
    kurz: "Verstellbare Heckflügelklappe, die auf Geraden den Luftwiderstand senkt.",
    text: [
      "Beim DRS öffnet sich die obere Klappe des Heckflügels auf Knopfdruck. Der Flügel erzeugt dann viel weniger Widerstand und Abtrieb, das Auto wird auf der Geraden deutlich schneller.",
      "Eingeführt wurde es, um das Überholen zu erleichtern: Nur wer in festgelegten Zonen nah genug hinter einem Gegner liegt, darf die Klappe öffnen. Beim Bremsen oder spätestens beim erneuten Drücken schließt sie wieder.",
      "In der Formel 1 wurde DRS 2026 durch aktive Aerodynamik und einen Überholmodus abgelöst. In anderen Serien und in vielen Simulationen ist es weiterhin verbreitet."
    ],
    tipp: "Schließe die Klappe vor dem Bremsen bewusst selbst, wenn das Fahrzeug es erlaubt – so baut sich der Abtrieb früher auf und das Heck bleibt beim Anbremsen stabil.",
    siehe: ["heckfluegel", "fluegelklappen", "windschatten", "luftwiderstand"] },

  { id: "diffusor", begriff: "Diffusor", englisch: "Diffuser",
    kurz: "Ansteigender Bereich am Ende des Unterbodens, der die Luft verlangsamt und Abtrieb erzeugt.",
    text: [
      "Am Heck steigt der Unterboden nach hinten an. In diesem Diffusor wird die schnell unter dem Auto strömende Luft wieder verlangsamt und auf Umgebungsdruck zurückgeführt.",
      "Das wirkt wie eine Pumpe: Weil die Luft am Ende kontrolliert entweichen kann, strömt sie unter dem ganzen Auto schneller, und dort entsteht Unterdruck. Der Diffusor erzeugt so einen großen Teil des Abtriebs bei vergleichsweise geringem Widerstand.",
      "Seine Wirkung hängt stark von der Fahrzeughöhe und vom Rake ab und kann bei zu steilem Winkel oder Kontakt mit der Fahrbahn abreißen."
    ],
    tipp: "Mehr Heckhöhe öffnet den Diffusor und bringt Abtrieb – aber nur bis zu einem Punkt. Wird das Auto in schnellen Kurven plötzlich unberechenbar, kann die Strömung im Diffusor abreißen.",
    siehe: ["unterboden", "rake", "bodeneffekt", "beam-wing"] },

  { id: "unterboden", begriff: "Unterboden", englisch: "Underbody / Floor",
    kurz: "Die Fahrzeugunterseite – bei Rennfahrzeugen eine der wichtigsten Abtriebsquellen.",
    text: [
      "Bei modernen Rennfahrzeugen ist der Unterboden kein einfaches Blech, sondern ein sorgfältig geformtes Aerodynamikteil. Die Luft wird unter dem Auto beschleunigt, der Druck sinkt, und das Auto wird angesaugt.",
      "Der Unterboden arbeitet sehr effizient, reagiert aber empfindlich auf Fahrzeughöhe, Rake und seitlich einströmende Luft. Deshalb sind seine Kanten oft mit Leitblechen und Wirbelgeneratoren versehen.",
      "Beschädigungen am Unterboden, etwa durch Randsteine oder Kontakt mit anderen Fahrzeugen, kosten viel Abtrieb und sind in vielen Simulationen als Schaden modelliert."
    ],
    tipp: "Nach einem Ausflug über hohe Randsteine oder durchs Kiesbett: Achte auf veränderte Balance in schnellen Kurven – der Unterboden kann beschädigt sein.",
    siehe: ["diffusor", "bodeneffekt", "venturi-kanaele", "fahrzeughoehe"] },

  { id: "venturi-kanaele", begriff: "Venturi-Kanäle", englisch: "Venturi Tunnels",
    kurz: "Geformte Kanäle im Unterboden, die die Luft beschleunigen und Unterdruck erzeugen.",
    text: [
      "Ein Venturi-Kanal verengt sich und weitet sich dann wieder. An der engsten Stelle strömt die Luft am schnellsten, der Druck ist am niedrigsten. Unter einem Rennwagen erzeugen solche Kanäle großflächigen Unterdruck und damit viel Abtrieb.",
      "Bekannt wurden sie mit den Flügelautos der späten 1970er-Jahre, und mit dem Reglement von 2022 kehrten sie in die Formel 1 zurück. Auch viele moderne Prototypen nutzen sie.",
      "Venturi-Kanäle sind extrem effizient, aber sehr empfindlich gegenüber der Fahrzeughöhe – zu tief, und die Strömung kollabiert; zu hoch, und der Effekt schwindet."
    ],
    tipp: "Bei Fahrzeugen mit starkem Bodeneffekt bringt eine stabile, niedrige Fahrzeughöhe mehr als jede Flügelstufe – ein steifes Fahrwerk ist hier oft schneller.",
    siehe: ["bodeneffekt", "unterboden", "porpoising"] },

  { id: "bodeneffekt", begriff: "Bodeneffekt", englisch: "Ground Effect",
    kurz: "Abtrieb, der durch die Nähe des Unterbodens zur Fahrbahn entsteht.",
    text: [
      "Je näher ein geformter Unterboden der Fahrbahn kommt, desto schneller strömt die Luft darunter und desto stärker wird der Unterdruck. Dieser Bodeneffekt liefert Abtrieb mit sehr wenig Luftwiderstand.",
      "Der Effekt ist aber nicht linear: Unterhalb einer bestimmten Höhe bricht die Strömung zusammen, und der Abtrieb fällt plötzlich ab. Das führt bei manchen Fahrzeugen zum Porpoising – einem Hüpfen auf den Geraden.",
      "Fahrzeuge mit starkem Bodeneffekt brauchen deshalb ein sehr steifes Fahrwerk und eine sorgfältig abgestimmte Fahrzeughöhe."
    ],
    tipp: "Suche die tiefste Höhe, bei der das Auto noch nicht hüpft oder aufsetzt. Dort liegt bei Bodeneffektfahrzeugen meist die beste Rundenzeit.",
    siehe: ["venturi-kanaele", "porpoising", "fahrzeughoehe", "heave-feder"] },

  { id: "endplatten", begriff: "Endplatten", englisch: "Endplates",
    kurz: "Seitliche Platten an den Enden eines Flügels.",
    text: [
      "An den Flügelenden würde Luft von der Seite mit hohem Druck zur Seite mit niedrigem Druck strömen. Das verringert den Abtrieb und erzeugt Randwirbel, die zusätzlichen Widerstand verursachen.",
      "Endplatten unterbinden diesen Druckausgleich teilweise und machen den Flügel wirksamer. Am Frontflügel werden sie zudem genutzt, um die Luft gezielt an den Vorderrädern vorbeizuführen.",
      "Ihre Form ist oft komplex, mit Schlitzen und Kanten, die gezielt Wirbel erzeugen und lenken."
    ],
    tipp: "Endplatten verstellst du nicht im Setup – ein Schaden daran kann aber die Balance spürbar verändern, besonders am Frontflügel.",
    siehe: ["frontfluegel", "heckfluegel", "wirbelgeneratoren"] },

  { id: "gurney-flap", begriff: "Gurney Flap", englisch: "Gurney Flap / Wickerbill",
    kurz: "Kleine, rechtwinklige Leiste an der Flügelhinterkante, die Abtrieb erhöht.",
    text: [
      "Eine Gurney Flap ist eine nur wenige Millimeter hohe Abrisskante, die senkrecht auf der Hinterkante eines Flügels sitzt. Sie erzeugt dahinter kleine Wirbel, die die Strömung auf der Saugseite länger anliegen lassen.",
      "Der Effekt ist erstaunlich groß: Schon eine kleine Leiste erhöht den Abtrieb deutlich – bei moderat mehr Widerstand. In vielen Rennserien ist sie ein beliebtes Mittel zur Feinabstimmung.",
      "Benannt ist sie nach dem Rennfahrer, der sie in den 1970er-Jahren bekannt machte; im englischen Sprachraum heißt sie auch Wickerbill."
    ],
    tipp: "Wenn dein Fahrzeug eine Gurney-Option bietet, nutze sie als feine Stufe zwischen zwei Flügeleinstellungen.",
    siehe: ["heckfluegel", "anstellwinkel", "abtrieb"] },

  { id: "bargeboards", begriff: "Bargeboards", englisch: "Bargeboards",
    kurz: "Leitbleche zwischen Vorderrädern und Seitenkästen, die die Luft ordnen.",
    text: [
      "Hinter den Vorderrädern ist die Luft stark verwirbelt. Bargeboards sind senkrechte, oft vielfach geschlitzte Leitbleche, die diese Strömung beruhigen und gezielt zu Unterboden, Seitenkästen und Diffusor leiten.",
      "Sie erzeugen selbst kaum Abtrieb, verbessern aber die Arbeit anderer Bauteile erheblich. In der Formel 1 waren sie über Jahre ein Feld für komplexe Konstruktionen, bis das Reglement 2022 sie stark vereinfachte.",
      "Viele Prototypen und GT-Fahrzeuge nutzen vergleichbare, einfachere Leitbleche."
    ],
    tipp: "Für das Setup spielen Bargeboards keine Rolle – Schäden daran kosten aber Abtrieb und können die Balance verschieben.",
    siehe: ["turning-vanes", "seitenkaesten", "unterboden"] },

  { id: "turning-vanes", begriff: "Turning Vanes", englisch: "Turning Vanes",
    kurz: "Leitflügel unter der Fahrzeugnase, die die Strömung umlenken.",
    text: [
      "Turning Vanes sind kleine, senkrecht stehende Leitflügel, meist unter der Nase eines Formelfahrzeugs. Sie lenken die Luft nach außen und erzeugen Wirbel, die die Strömung an den Seiten des Unterbodens abdichten.",
      "So helfen sie, den Unterdruck unter dem Auto zu halten, und verbessern die Effizienz des gesamten Pakets.",
      "Wie Bargeboards sind sie Teil eines Gesamtkonzepts; einzeln betrachtet ist ihr Beitrag klein, im Zusammenspiel aber spürbar."
    ],
    tipp: "Turning Vanes sind nicht verstellbar. Sie zeigen aber, wie stark moderne Aerodynamik auf das Zusammenspiel vieler kleiner Bauteile setzt.",
    siehe: ["bargeboards", "wirbelgeneratoren", "unterboden"] },

  { id: "seitenkaesten", begriff: "Seitenkästen", englisch: "Sidepods",
    kurz: "Seitliche Verkleidungen, in denen meist die Kühler sitzen.",
    text: [
      "Seitenkästen nehmen bei Formelfahrzeugen und Prototypen die Kühler für Wasser, Öl und Ladeluft auf. Ihre Öffnungen führen Kühlluft hinein; ihre Außenform lenkt den Luftstrom zum Heck, zum Diffusor und zum Beam Wing.",
      "Größere Öffnungen kühlen besser, erzeugen aber mehr Widerstand. Teams wählen deshalb je nach Strecke und Außentemperatur unterschiedliche Kühlkonfigurationen.",
      "In vielen Simulationen spiegelt sich das als einstellbare Kühleröffnung wider."
    ],
    tipp: "Stelle die Kühlung nur so weit offen, wie es die Temperaturen erfordern. Jeder geschlossene Schlitz bringt etwas Höchstgeschwindigkeit.",
    siehe: ["lufteinlaesse", "luftwiderstand", "bargeboards"] },

  { id: "lufteinlaesse", begriff: "Lufteinlässe", englisch: "Intakes",
    kurz: "Öffnungen, durch die Luft für Motor, Kühlung und Bremsen ins Fahrzeug strömt.",
    text: [
      "Rennfahrzeuge benötigen Luft an vielen Stellen: für die Verbrennung im Motor, für Wasser- und Ölkühler, für Ladeluftkühler und für die Bremsen. Jede dieser Öffnungen ist ein Kompromiss zwischen ausreichender Kühlung und möglichst geringem Widerstand.",
      "Der Motoreinlass sitzt oft über dem Fahrer (Airbox), wo die Luft ungestört und mit leichtem Staudruck ankommt. Kühlöffnungen werden dort platziert, wo der Druck hoch ist, Auslässe dort, wo er niedrig ist.",
      "Verschmutzte Einlässe – etwa durch Gummi oder Gras – lassen Temperaturen steigen, was viele Simulationen nachbilden."
    ],
    tipp: "Steigen Wasser- oder Öltemperatur ungewöhnlich schnell, fahre im Windschatten nicht zu lange direkt hinter dem Vordermann – dort fehlt kühle, ungestörte Luft.",
    siehe: ["seitenkaesten", "bremsbelueftung", "dirty-air"] },

  { id: "bremsbelueftung", begriff: "Bremsbelüftung", englisch: "Brake Ducts",
    kurz: "Kühlkanäle, die Luft zu den Bremsen leiten.",
    text: [
      "Bremsen wandeln Bewegungsenergie in Wärme um und erreichen dabei mehrere hundert Grad. Über eigene Luftkanäle wird kühlende Luft direkt an Scheiben und Sättel geleitet.",
      "Die Größe der Öffnung ist ein Kompromiss: Mehr Kühlung hält die Bremse im Arbeitsbereich, kostet aber Luftwiderstand und kühlt im Regen oder bei Kälte die Bremse zu stark. Die Bremsbelüftung beeinflusst zudem die Felgentemperatur und damit die Reifentemperatur und den Reifendruck.",
      "In vielen Simulationen lässt sich die Bremskühlung in Stufen einstellen."
    ],
    tipp: "Halte die Bremsen im Arbeitsfenster der Beläge. Werden die Reifendrücke zu hoch, kann weniger Bremskühlung über die Felge sogar den Druck beeinflussen – und umgekehrt.",
    siehe: ["bremsscheibe", "bremsfading", "reifendruck", "lufteinlaesse"] },

  { id: "louvers", begriff: "Louvers (Kiemen)", englisch: "Louvers",
    kurz: "Schlitze in der Karosserie, durch die warme Luft entweicht.",
    text: [
      "Louvers sind schräg angeordnete Lüftungsschlitze, oft in Kotflügeln oder Motorhaube. Sie lassen heiße Luft aus Radkästen oder Kühlern ab.",
      "Über den Vorderrädern haben sie eine zusätzliche Aufgabe: Unter dem Kotflügel staut sich bei hoher Geschwindigkeit Luft, die die Front anhebt. Durch die Kiemen kann sie entweichen – das erhöht den Abtrieb an der Vorderachse.",
      "Bei GT-Fahrzeugen sind sie deshalb ein typisches Merkmal der Rennversionen."
    ],
    tipp: "Louvers sind fester Teil der Karosserie. Sie zeigen, wie viel Abtrieb schon durch das Ablassen von Stauluft entsteht.",
    siehe: ["abtrieb", "lufteinlaesse"] },

  { id: "wirbelgeneratoren", begriff: "Wirbelgeneratoren", englisch: "Vortex Generators",
    kurz: "Kleine Bauteile, die gezielt Wirbel erzeugen, um die Strömung zu lenken.",
    text: [
      "Ein Wirbel ist eine drehende Luftströmung mit niedrigem Druck im Kern. Wirbelgeneratoren – kleine Finnen oder Kanten – erzeugen solche Wirbel gezielt.",
      "Sie werden eingesetzt, um Strömungen anliegen zu lassen, die sonst abreißen würden, oder um den Unterboden seitlich gegen einströmende Luft abzudichten. Ein gut platzierter Wirbel wirkt wie eine unsichtbare Schürze.",
      "Ihre Wirkung hängt stark von der Anströmung ab und kann bei Schräglauf oder in verwirbelter Luft nachlassen."
    ],
    tipp: "Wirbelgeneratoren sind nicht verstellbar – verstehe sie als Grund, warum Bodeneffektfahrzeuge in Verkehr und Schräglage an Abtrieb verlieren.",
    siehe: ["grenzschicht", "unterboden", "turning-vanes", "strakes"] },

  { id: "strakes", begriff: "Strakes (Leitbleche)", englisch: "Strakes",
    kurz: "Längsbleche am Unterboden oder Diffusor, die die Strömung führen.",
    text: [
      "Strakes sind senkrechte Leitbleche, die in Längsrichtung unter dem Auto oder im Diffusor verlaufen. Sie teilen die Strömung in Kanäle und verhindern, dass sie seitlich ausweicht.",
      "Im Diffusor sorgen sie dafür, dass die Luft gleichmäßig verlangsamt wird und nicht an einer Seite abreißt. An den Kanten des Unterbodens erzeugen sie Wirbel, die den Unterdruck abdichten.",
      "Sie sind ein wichtiges Detail, das die Leistung des Diffusors stabil hält."
    ],
    tipp: "Wie andere feste Aerodynamikteile sind Strakes nicht einstellbar – Schäden daran machen sich als Abtriebsverlust bemerkbar.",
    siehe: ["diffusor", "wirbelgeneratoren", "unterboden"] },

  { id: "splitter", begriff: "Frontsplitter", englisch: "Splitter",
    kurz: "Waagerechte Platte unter der Fahrzeugfront, die Abtrieb erzeugt.",
    text: [
      "Der Splitter teilt die anströmende Luft: Oberhalb staut sie sich und erzeugt Druck, unterhalb wird sie beschleunigt und erzeugt Unterdruck. Beides drückt die Front nach unten.",
      "Bei GT- und Tourenwagen ist der Splitter die wichtigste Quelle für Frontabtrieb. Seine Wirkung hängt stark von der Fahrzeughöhe vorn ab: Je tiefer, desto stärker – bis er aufsetzt.",
      "Weil er so tief liegt, wird er bei Ausflügen über Randsteine und ins Kiesbett leicht beschädigt."
    ],
    tipp: "Eine tiefere Front erhöht den Splitter-Abtrieb und hilft gegen Untersteuern in schnellen Kurven. Setzt der Splitter beim Anbremsen auf, nimm wieder etwas Höhe dazu.",
    siehe: ["fahrzeughoehe", "rake", "abtrieb", "canards"] },

  { id: "canards", begriff: "Canards (Dive Planes)", englisch: "Canards / Dive Planes",
    kurz: "Kleine Flügel an den vorderen Ecken der Karosserie.",
    text: [
      "Canards sitzen seitlich an der Fahrzeugfront, meist an GT- und Tourenwagen. Sie erzeugen etwas Abtrieb an der Vorderachse und vor allem Wirbel, die entlang der Fahrzeugseite laufen und den Unterboden abdichten.",
      "Damit sind sie ein wirksames Mittel, die Aero-Balance nach vorn zu verschieben, ohne den Splitter zu verändern.",
      "Ihre Wirkung ist stark von der Fahrzeughöhe und der Anströmung abhängig."
    ],
    tipp: "Wenn dein Fahrzeug Canards als Option anbietet, sind sie ein guter Schritt gegen Untersteuern in schnellen Kurven – bei geringem Widerstandsplus.",
    siehe: ["splitter", "aero-balance", "wirbelgeneratoren"] },

  { id: "beam-wing", begriff: "Beam Wing und Monkey Seat", englisch: "Beam Wing / Monkey Seat",
    kurz: "Zusätzliche kleine Flügel am Heck, die mit Heckflügel und Diffusor zusammenarbeiten.",
    text: [
      "Der Beam Wing ist ein tief liegendes Flügelelement zwischen Diffusor und Heckflügel. Er erzeugt selbst etwas Abtrieb, vor allem aber zieht er die Luft aus dem Diffusor nach oben und verstärkt so dessen Wirkung.",
      "Der Monkey Seat ist ein kleiner Zusatzflügel oberhalb des Auspuffs, wie er in der Formel 1 auf Strecken mit viel Abtrieb eingesetzt wurde. Er nutzte die Abgasströmung und den Unterdruck hinter dem Auto.",
      "Beide Bauteile zeigen, wie eng die Heckaerodynamik zusammenarbeitet: Änderungen an einem Teil verändern die Wirkung aller anderen."
    ],
    tipp: "Wo einstellbar, ist der Beam Wing ein effizienter Weg zu mehr Heckabtrieb, weil er den Diffusor unterstützt.",
    siehe: ["diffusor", "heckfluegel", "l-d-verhaeltnis"] },

  { id: "windschatten", begriff: "Windschatten", englisch: "Slipstream / Draft / Tow",
    kurz: "Bereich hinter einem Fahrzeug mit geringerem Luftwiderstand.",
    text: [
      "Ein vorausfahrendes Auto verdrängt die Luft und hinterlässt einen Bereich mit niedrigerem Druck und verwirbelter Strömung. Wer darin fährt, braucht weniger Leistung für dieselbe Geschwindigkeit und erreicht mehr Endgeschwindigkeit.",
      "Im Rennen ermöglicht das Überholmanöver am Ende von Geraden. Im Qualifying nutzen Fahrer den Windschatten von Teamkollegen gezielt – im Englischen spricht man dann von einem Tow.",
      "Die Kehrseite: In der verwirbelten Luft verliert das hinterherfahrende Auto in Kurven Abtrieb, und die Kühlung wird schlechter."
    ],
    tipp: "Gehe aus dem Windschatten erst kurz vor dem Bremspunkt heraus, um maximalen Schwung mitzunehmen – und achte in Kurven auf Abstand, um nicht in der Dirty Air den Grip zu verlieren.",
    siehe: ["dirty-air", "luftwiderstand", "drs"] },

  { id: "dirty-air", begriff: "Verwirbelte Luft", englisch: "Dirty Air",
    kurz: "Gestörte Luftströmung hinter einem Fahrzeug, die Abtrieb kostet.",
    text: [
      "Hinter einem Rennwagen ist die Luft unruhig, voller Wirbel und hat weniger Energie. Flügel und Unterboden des folgenden Autos arbeiten darin deutlich schlechter.",
      "Besonders der Frontflügel leidet, weil er direkt in diese Strömung taucht. Die Folge: Das folgende Auto untersteuert in schnellen Kurven, die Vorderreifen rutschen und überhitzen. Auch Kühler und Bremsen erhalten weniger kühle Luft.",
      "Moderne Reglements versuchen, diesen Effekt durch mehr Bodeneffekt und weniger anfällige Flügel zu verringern."
    ],
    tipp: "Halte in schnellen Kurven etwas Abstand und rücke auf den Geraden im Windschatten wieder auf. Achte im Verkehr auf deine Reifen- und Wassertemperaturen.",
    siehe: ["windschatten", "frontfluegel", "untersteuern"] },

  { id: "grenzschicht", begriff: "Grenzschicht", englisch: "Boundary Layer",
    kurz: "Dünne Luftschicht direkt an einer Oberfläche, die durch Reibung abgebremst wird.",
    text: [
      "Direkt an der Fahrzeugoberfläche haftet die Luft und hat die Geschwindigkeit null. Mit wachsendem Abstand nimmt ihre Geschwindigkeit zu, bis sie die freie Strömung erreicht. Diese Übergangszone heißt Grenzschicht.",
      "Sie ist entscheidend für den Strömungsabriss: Verliert die Grenzschicht zu viel Energie, etwa an einem steilen Flügel oder einem stark ansteigenden Diffusor, löst sie sich ab – der Abtrieb bricht ein.",
      "Viele Aerodynamikdetails, von Flügelspalten bis zu Wirbelgeneratoren, dienen dazu, die Grenzschicht mit Energie zu versorgen."
    ],
    tipp: "Die Grenzschicht erklärt, warum ein Flügel nicht beliebig steil gestellt werden kann – und warum mehr Winkel ab einem Punkt sogar weniger Abtrieb bringt.",
    siehe: ["stroemungsabriss", "fluegelklappen", "wirbelgeneratoren"] },

  { id: "stroemungsabriss", begriff: "Strömungsabriss", englisch: "Stall",
    kurz: "Die Luft löst sich von einer Fläche, der Abtrieb fällt schlagartig ab.",
    text: [
      "Ein Flügel oder Diffusor erzeugt nur Abtrieb, solange die Strömung an seiner Oberfläche anliegt. Wird der Winkel zu steil oder die Strömung zu langsam, reißt sie ab und verwirbelt.",
      "Für den Fahrer äußert sich das als plötzlicher Gripverlust – etwa wenn das Heck in einer schnellen Kurve unvermittelt leicht wird. Beim Diffusor kann ein Abriss durch zu tiefe Fahrzeughöhe oder Bodenkontakt ausgelöst werden.",
      "Manche Konstruktionen nutzen den Effekt gezielt, um auf Geraden Widerstand zu sparen."
    ],
    tipp: "Wird dein Auto in schnellen Kurven ohne erkennbaren Grund plötzlich instabil, prüfe Fahrzeughöhe und Rake – ein Strömungsabriss am Diffusor ist eine häufige Ursache.",
    siehe: ["grenzschicht", "anstellwinkel", "diffusor", "porpoising"] },

  { id: "porpoising", begriff: "Porpoising", englisch: "Porpoising",
    kurz: "Aerodynamisch ausgelöstes Hüpfen eines Bodeneffektfahrzeugs auf der Geraden.",
    text: [
      "Bei hoher Geschwindigkeit saugt der Bodeneffekt das Auto immer tiefer, bis die Strömung unter dem Unterboden zusammenbricht. Der Abtrieb fällt, das Auto federt nach oben, die Strömung legt sich wieder an – und das Spiel beginnt von vorn.",
      "Das Ergebnis ist ein schnelles, rhythmisches Auf und Ab, benannt nach den springenden Bewegungen eines Schweinswals. Es kostet Abtrieb, belastet den Fahrer stark und kann Bremspunkte unberechenbar machen.",
      "Gegenmaßnahmen sind eine höhere Fahrzeughöhe, ein steiferes Fahrwerk oder konstruktive Änderungen am Unterboden."
    ],
    tipp: "Hüpft dein Auto auf den Geraden, erhöhe die Fahrzeughöhe in kleinen Schritten oder versteife die Heave-Feder, bis es ruhig wird.",
    siehe: ["bodeneffekt", "bouncing", "heave-feder", "fahrzeughoehe"] },

  { id: "bouncing", begriff: "Bouncing", englisch: "Bouncing",
    kurz: "Mechanisch ausgelöstes Springen durch zu steifes Fahrwerk oder Bodenkontakt.",
    text: [
      "Im Unterschied zum Porpoising entsteht Bouncing nicht durch die Aerodynamik, sondern durch das Fahrwerk: Ein sehr steifes Auto, das auf Bodenwellen trifft oder mit dem Unterboden aufsetzt, beginnt zu springen.",
      "Die Folgen sind ähnlich: Die Reifenlast schwankt, der Grip wird unregelmäßig, und Bremspunkte werden schwer zu treffen. Häufig tritt es auf, wenn ein Auto sehr tief und hart abgestimmt ist, um Bodeneffekt zu nutzen.",
      "Beide Effekte überlagern sich oft, weshalb die Ursache genau analysiert werden muss."
    ],
    tipp: "Springt das Auto vor allem auf welligen Abschnitten, liegt eher Bouncing vor – weichere schnelle Druckstufe oder mehr Höhe helfen. Hüpft es gleichmäßig auf glatten Geraden, eher Porpoising.",
    siehe: ["porpoising", "durchschlagen", "high-speed-druckstufe"] },
]);
