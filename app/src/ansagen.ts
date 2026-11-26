// Feste Ansagen in allen Sprachen des Renningenieurs (Wunsch 26.11.: „nicht nur Deutsch und Englisch – Bulgarisch
// und viele andere sprachen bisher Deutsch“). Ohne KI und kostenlos: Probefunk, Abstände, Sprit, letzte Runde,
// Bestzeit, Platz, Rundenmeldung und Hinweise. Dazu die Aufbereitung zum Vorlesen: Einheiten ausgeschrieben
// („4 Liter“ statt „4 L“), Kommazahlen je Sprache („1.2“ im Englischen), Rundenzeiten wie am Funk („1 27,1“).
// Die KI (mit Schlüssel) formuliert frei in der eingestellten Sprache; diese Sätze sind die Grundlage ohne KI.

export type Schluessel =
  | "probe" | "vor" | "hinter" | "niemand" | "sprit" | "letzte" | "beste" | "platz" | "nochNichts"
  | "anmelden" | "keineKi" | "stoerung" | "einrichtung" | "rundeUngueltig" | "neueBestzeit" | "hinterBest" | "runde" | "nachbesprechung";

type Sprache = {
  t: Record<Schluessel, string>;
  /** Stichwörter, an denen eine Frage erkannt wird (klein geschrieben, als regulärer Ausdruck) */
  w: { vor: string; hinter: string; sprit: string; letzte: string; beste: string; platz: string };
  /** Einheiten zum Vorlesen: Liter, Sekunden, km/h, Meter */
  e: [string, string, string, string];
  /** Dezimalpunkt statt Komma */
  punkt?: boolean;
};

const S: Record<string, Sprache> = {
  de: {
    t: {
      probe: "Funkcheck. Hier ist {name}, ich höre dich laut und deutlich. Sprit reicht noch für sieben Runden, wir holen dich am Ende der 23. Runde rein.",
      vor: "Vor dir fährt {wer}, etwa {s} Sekunden.", hinter: "Hinter dir fährt {wer}, etwa {s} Sekunden.",
      niemand: "Da fährt gerade niemand – oder ich habe noch keine Daten vom Feld.",
      sprit: "Du hast {l} Liter im Tank und verbrauchst {v} Liter pro Runde – das reicht für etwa {r} Runden.",
      letzte: "Deine letzte Runde: {zeit}.", beste: "Deine Bestzeit: {zeit}, gefahren in der {nr}. Runde.", platz: "Du liegst auf Platz {p}.",
      nochNichts: "Dafür habe ich noch keine Daten – fahr erst eine saubere Runde.",
      anmelden: "Melde dich an – dann kann ich dir dazu ausführlich antworten. Sprit, Abstände und Rundenzeiten sage ich dir auch so.",
      keineKi: "Dafür brauche ich die KI – sie ist gerade nicht erreichbar. Sprit, Abstände und Rundenzeiten sage ich dir trotzdem.",
      stoerung: "Funkstörung – das hat gerade nicht geklappt. Frag mich gleich noch einmal.",
      einrichtung: "Der KI-Renningenieur wird gerade eingerichtet – Sprit, Abstände und Rundenzeiten sage ich dir aber schon.",
      rundeUngueltig: "Die {nr}. Runde zählt nicht.", neueBestzeit: "Neue Bestzeit: {zeit}. Stark!", hinterBest: "{zeit} – {d} Sekunden hinter deiner Bestzeit.",
      runde: "Runde {nr}: {zeit}.", nachbesprechung: "Die Sitzung ist vorbei – frag mich lieber, was du in den Zweikämpfen besser machen kannst.",
    },
    w: { vor: "vor mir|vordermann|vorne|vorn\\b|vorder", hinter: "hinter mir|hintermann|hinten", sprit: "sprit|tank|reicht|verbrauch", letzte: "letzte runde", beste: "bestzeit|beste runde|schnellste", platz: "platz|position" },
    e: ["Liter", "Sekunden", "Kilometer pro Stunde", "Meter"],
  },
  en: {
    t: {
      probe: "Radio check. This is {name}, loud and clear. Fuel is good for seven more laps, we'll box you at the end of lap 23.",
      vor: "{wer} is ahead of you, about {s} seconds.", hinter: "{wer} is behind you, about {s} seconds.",
      niemand: "Nobody there right now – or I don't have data from the field yet.",
      sprit: "You have {l} litres in the tank and use {v} litres per lap – that's good for about {r} laps.",
      letzte: "Your last lap: {zeit}.", beste: "Your best lap: {zeit}, set on lap {nr}.", platz: "You're in position {p}.",
      nochNichts: "I don't have the data for that yet – do a clean lap first.",
      anmelden: "Sign in and I can answer that in detail. Fuel, gaps and lap times I can tell you anyway.",
      keineKi: "I need the AI for that and it's not reachable right now. Fuel, gaps and lap times I can still tell you.",
      stoerung: "Radio problem – that didn't work. Ask me again in a moment.",
      einrichtung: "The AI race engineer is still being set up – but fuel, gaps and lap times I can already tell you.",
      rundeUngueltig: "Lap {nr} doesn't count.", neueBestzeit: "New best lap: {zeit}. Great job!", hinterBest: "{zeit} – {d} seconds off your best.",
      runde: "Lap {nr}: {zeit}.", nachbesprechung: "The session is over – ask me what you could do better in your battles instead.",
    },
    w: { vor: "ahead|in front", hinter: "behind", sprit: "fuel|tank|gas\\b", letzte: "last lap", beste: "best lap|fastest|personal best", platz: "position|what place|p\\d" },
    e: ["litres", "seconds", "kilometres per hour", "metres"], punkt: true,
  },
  es: {
    t: {
      probe: "Prueba de radio. Aquí {name}, te escucho alto y claro. El combustible alcanza para siete vueltas más, entramos a boxes al final de la vuelta 23.",
      vor: "Delante de ti va {wer}, a unos {s} segundos.", hinter: "Detrás de ti va {wer}, a unos {s} segundos.",
      niemand: "Ahora mismo no hay nadie, o aún no tengo datos del resto.",
      sprit: "Tienes {l} litros en el depósito y gastas {v} litros por vuelta: alcanza para unas {r} vueltas.",
      letzte: "Tu última vuelta: {zeit}.", beste: "Tu mejor vuelta: {zeit}, en la vuelta {nr}.", platz: "Vas en la posición {p}.",
      nochNichts: "Todavía no tengo datos para eso. Haz primero una vuelta limpia.",
      anmelden: "Inicia sesión y te lo explico con detalle. Combustible, distancias y tiempos te los digo igualmente.",
      keineKi: "Para eso necesito la IA y ahora no está disponible. Combustible, distancias y tiempos te los digo igualmente.",
      stoerung: "Problema de radio, no ha funcionado. Pregúntame otra vez en un momento.",
      einrichtung: "El ingeniero de IA aún se está configurando, pero combustible, distancias y tiempos ya te los digo.",
      rundeUngueltig: "La vuelta {nr} no cuenta.", neueBestzeit: "¡Nueva mejor vuelta: {zeit}!", hinterBest: "{zeit}, a {d} segundos de tu mejor vuelta.",
      runde: "Vuelta {nr}: {zeit}.", nachbesprechung: "La sesión ha terminado; mejor pregúntame qué puedes mejorar en tus duelos.",
    },
    w: { vor: "delante", hinter: "detr[aá]s", sprit: "combustible|gasolina|dep[oó]sito", letzte: "[uú]ltima vuelta", beste: "mejor vuelta|m[aá]s r[aá]pida", platz: "posici[oó]n|puesto" },
    e: ["litros", "segundos", "kilómetros por hora", "metros"],
  },
  fr: {
    t: {
      probe: "Essai radio. Ici {name}, je te reçois fort et clair. Il reste de l'essence pour sept tours, on rentre au stand à la fin du tour 23.",
      vor: "Devant toi, {wer}, à environ {s} secondes.", hinter: "Derrière toi, {wer}, à environ {s} secondes.",
      niemand: "Personne pour l'instant, ou je n'ai pas encore les données des autres.",
      sprit: "Tu as {l} litres dans le réservoir et tu consommes {v} litres par tour : ça suffit pour environ {r} tours.",
      letzte: "Ton dernier tour : {zeit}.", beste: "Ton meilleur tour : {zeit}, au tour {nr}.", platz: "Tu es en position {p}.",
      nochNichts: "Je n'ai pas encore les données pour ça. Fais d'abord un tour propre.",
      anmelden: "Connecte-toi et je t'explique en détail. L'essence, les écarts et les temps, je te les donne quand même.",
      keineKi: "Pour ça j'ai besoin de l'IA, qui n'est pas disponible pour le moment. L'essence, les écarts et les temps, je te les donne quand même.",
      stoerung: "Problème radio, ça n'a pas marché. Redemande-moi dans un instant.",
      einrichtung: "L'ingénieur IA est encore en configuration, mais l'essence, les écarts et les temps, je te les donne déjà.",
      rundeUngueltig: "Le tour {nr} ne compte pas.", neueBestzeit: "Nouveau meilleur tour : {zeit}. Bravo !", hinterBest: "{zeit}, à {d} secondes de ton meilleur tour.",
      runde: "Tour {nr} : {zeit}.", nachbesprechung: "La séance est terminée ; demande-moi plutôt ce que tu peux améliorer dans tes duels.",
    },
    w: { vor: "devant", hinter: "derri[eè]re", sprit: "essence|carburant|r[eé]servoir", letzte: "dernier tour", beste: "meilleur tour|plus rapide", platz: "position|quelle place" },
    e: ["litres", "secondes", "kilomètres à l'heure", "mètres"],
  },
  it: {
    t: {
      probe: "Prova radio. Qui {name}, ti sento forte e chiaro. La benzina basta per altri sette giri, rientriamo ai box alla fine del giro 23.",
      vor: "Davanti a te c'è {wer}, a circa {s} secondi.", hinter: "Dietro di te c'è {wer}, a circa {s} secondi.",
      niemand: "Al momento non c'è nessuno, oppure non ho ancora i dati degli altri.",
      sprit: "Hai {l} litri nel serbatoio e consumi {v} litri al giro: bastano per circa {r} giri.",
      letzte: "Il tuo ultimo giro: {zeit}.", beste: "Il tuo giro migliore: {zeit}, al giro {nr}.", platz: "Sei in posizione {p}.",
      nochNichts: "Non ho ancora i dati per questo. Fai prima un giro pulito.",
      anmelden: "Accedi e te lo spiego nei dettagli. Benzina, distacchi e tempi te li dico comunque.",
      keineKi: "Per questo mi serve l'IA, che ora non è raggiungibile. Benzina, distacchi e tempi te li dico comunque.",
      stoerung: "Problema radio, non ha funzionato. Chiedimelo di nuovo tra un attimo.",
      einrichtung: "L'ingegnere IA è ancora in configurazione, ma benzina, distacchi e tempi te li dico già.",
      rundeUngueltig: "Il giro {nr} non è valido.", neueBestzeit: "Nuovo giro migliore: {zeit}. Grande!", hinterBest: "{zeit}, a {d} secondi dal tuo giro migliore.",
      runde: "Giro {nr}: {zeit}.", nachbesprechung: "La sessione è finita: chiedimi piuttosto cosa puoi migliorare nei duelli.",
    },
    w: { vor: "davanti", hinter: "dietro", sprit: "benzina|carburante|serbatoio", letzte: "ultimo giro", beste: "giro migliore|miglior giro|pi[uù] veloce", platz: "posizione" },
    e: ["litri", "secondi", "chilometri orari", "metri"],
  },
  pt: {
    t: {
      probe: "Teste de rádio. Aqui é {name}, ouço-te alto e claro. O combustível dá para mais sete voltas, entramos nas boxes no fim da volta 23.",
      vor: "À tua frente vai {wer}, a cerca de {s} segundos.", hinter: "Atrás de ti vai {wer}, a cerca de {s} segundos.",
      niemand: "Agora não está ninguém, ou ainda não tenho dados dos outros.",
      sprit: "Tens {l} litros no depósito e gastas {v} litros por volta: dá para cerca de {r} voltas.",
      letzte: "A tua última volta: {zeit}.", beste: "A tua melhor volta: {zeit}, na volta {nr}.", platz: "Estás na posição {p}.",
      nochNichts: "Ainda não tenho dados para isso. Faz primeiro uma volta limpa.",
      anmelden: "Inicia sessão e explico-te em detalhe. Combustível, distâncias e tempos digo-te na mesma.",
      keineKi: "Para isso preciso da IA e agora não está disponível. Combustível, distâncias e tempos digo-te na mesma.",
      stoerung: "Problema de rádio, não funcionou. Pergunta-me outra vez daqui a pouco.",
      einrichtung: "O engenheiro de IA ainda está a ser configurado, mas combustível, distâncias e tempos já te digo.",
      rundeUngueltig: "A volta {nr} não conta.", neueBestzeit: "Nova melhor volta: {zeit}. Excelente!", hinterBest: "{zeit}, a {d} segundos da tua melhor volta.",
      runde: "Volta {nr}: {zeit}.", nachbesprechung: "A sessão terminou; pergunta-me antes o que podes melhorar nos duelos.",
    },
    w: { vor: "[àa] frente|na frente", hinter: "atr[aá]s", sprit: "combust[ií]vel|gasolina|tanque|dep[oó]sito", letzte: "[uú]ltima volta", beste: "melhor volta|mais r[aá]pida", platz: "posi[cç][aã]o|lugar" },
    e: ["litros", "segundos", "quilómetros por hora", "metros"],
  },
  nl: {
    t: {
      probe: "Radiocheck. Hier is {name}, ik hoor je luid en duidelijk. De brandstof is genoeg voor nog zeven ronden, we halen je binnen aan het einde van ronde 23.",
      vor: "Voor je rijdt {wer}, ongeveer {s} seconden.", hinter: "Achter je rijdt {wer}, ongeveer {s} seconden.",
      niemand: "Er rijdt nu niemand, of ik heb nog geen gegevens van de anderen.",
      sprit: "Je hebt {l} liter in de tank en verbruikt {v} liter per ronde: genoeg voor ongeveer {r} ronden.",
      letzte: "Je laatste ronde: {zeit}.", beste: "Je snelste ronde: {zeit}, in ronde {nr}.", platz: "Je ligt op positie {p}.",
      nochNichts: "Daarvoor heb ik nog geen gegevens. Rij eerst een schone ronde.",
      anmelden: "Log in, dan leg ik het je uitgebreid uit. Brandstof, gaten en rondetijden zeg ik je sowieso.",
      keineKi: "Daarvoor heb ik de AI nodig en die is nu niet bereikbaar. Brandstof, gaten en rondetijden zeg ik je toch.",
      stoerung: "Radiostoring, dat lukte niet. Vraag het me zo nog een keer.",
      einrichtung: "De AI-race-engineer wordt nog ingesteld, maar brandstof, gaten en rondetijden zeg ik je al.",
      rundeUngueltig: "Ronde {nr} telt niet.", neueBestzeit: "Nieuwe snelste ronde: {zeit}. Sterk!", hinterBest: "{zeit}, {d} seconden achter je snelste ronde.",
      runde: "Ronde {nr}: {zeit}.", nachbesprechung: "De sessie is voorbij; vraag me liever wat je in je gevechten beter kunt doen.",
    },
    w: { vor: "voor me|voor mij", hinter: "achter me|achter mij", sprit: "brandstof|benzine|tank", letzte: "laatste ronde", beste: "snelste ronde|beste ronde", platz: "positie|plaats" },
    e: ["liter", "seconden", "kilometer per uur", "meter"],
  },
  pl: {
    t: {
      probe: "Próba radia. Tu {name}, słyszę cię głośno i wyraźnie. Paliwa wystarczy jeszcze na siedem okrążeń, zjeżdżamy do boksu na końcu okrążenia 23.",
      vor: "Przed tobą jedzie {wer}, około {s} sekundy.", hinter: "Za tobą jedzie {wer}, około {s} sekundy.",
      niemand: "Teraz nikogo tam nie ma albo nie mam jeszcze danych o innych.",
      sprit: "Masz {l} litra w baku i zużywasz {v} litra na okrążenie – wystarczy na około {r} okrążeń.",
      letzte: "Twoje ostatnie okrążenie: {zeit}.", beste: "Twoje najlepsze okrążenie: {zeit}, na okrążeniu {nr}.", platz: "Jesteś na pozycji {p}.",
      nochNichts: "Nie mam jeszcze na to danych. Przejedź najpierw czyste okrążenie.",
      anmelden: "Zaloguj się, a odpowiem ci szczegółowo. Paliwo, odstępy i czasy okrążeń podam ci i tak.",
      keineKi: "Do tego potrzebuję AI, a teraz jest niedostępna. Paliwo, odstępy i czasy okrążeń podam ci i tak.",
      stoerung: "Zakłócenia radia, nie udało się. Zapytaj mnie za chwilę jeszcze raz.",
      einrichtung: "Inżynier AI jest jeszcze konfigurowany, ale paliwo, odstępy i czasy okrążeń podam ci już teraz.",
      rundeUngueltig: "Okrążenie {nr} się nie liczy.", neueBestzeit: "Nowe najlepsze okrążenie: {zeit}. Świetnie!", hinterBest: "{zeit}, {d} sekundy wolniej niż twoje najlepsze.",
      runde: "Okrążenie {nr}: {zeit}.", nachbesprechung: "Sesja się skończyła – zapytaj mnie raczej, co możesz poprawić w pojedynkach.",
    },
    w: { vor: "przede mn[aą]|przed mn[aą]|z przodu", hinter: "za mn[aą]|z ty[lł]u", sprit: "paliw|bak", letzte: "ostatnie okr[aą][zż]enie", beste: "najlepsze okr[aą][zż]enie|najszybsze", platz: "pozycj|miejsc" },
    e: ["litra", "sekundy", "kilometrów na godzinę", "metrów"],
  },
  ru: {
    t: {
      probe: "Проверка связи. Это {name}, слышу тебя громко и чётко. Топлива хватит ещё на семь кругов, заезжаем в боксы в конце 23-го круга.",
      vor: "Впереди {wer}, примерно {s} секунды.", hinter: "Сзади {wer}, примерно {s} секунды.",
      niemand: "Сейчас там никого нет, или у меня ещё нет данных о других.",
      sprit: "У тебя в баке {l} литра, расход {v} литра на круг – хватит примерно на {r} круга.",
      letzte: "Твой последний круг: {zeit}.", beste: "Твой лучший круг: {zeit}, на {nr}-м круге.", platz: "Ты на позиции {p}.",
      nochNichts: "Для этого у меня пока нет данных. Сначала проедь чистый круг.",
      anmelden: "Войди в аккаунт, и я отвечу подробно. Топливо, отрывы и время кругов скажу и так.",
      keineKi: "Для этого нужен ИИ, а он сейчас недоступен. Топливо, отрывы и время кругов скажу и так.",
      stoerung: "Помехи в связи, не получилось. Спроси меня ещё раз через минуту.",
      einrichtung: "ИИ-инженер ещё настраивается, но топливо, отрывы и время кругов я уже скажу.",
      rundeUngueltig: "Круг {nr} не засчитан.", neueBestzeit: "Новый лучший круг: {zeit}. Отлично!", hinterBest: "{zeit}, на {d} секунды медленнее лучшего.",
      runde: "Круг {nr}: {zeit}.", nachbesprechung: "Сессия закончилась – лучше спроси, что можно улучшить в борьбе.",
    },
    w: { vor: "впереди|передо мной", hinter: "сзади|позади", sprit: "топлив|бензин|бак", letzte: "последний круг", beste: "лучший круг|быстрейш", platz: "позици|мест" },
    e: ["литра", "секунды", "километров в час", "метров"],
  },
  uk: {
    t: {
      probe: "Перевірка зв'язку. Це {name}, чую тебе гучно і чітко. Пального вистачить ще на сім кіл, заїжджаємо в бокси в кінці 23-го кола.",
      vor: "Попереду {wer}, приблизно {s} секунди.", hinter: "Позаду {wer}, приблизно {s} секунди.",
      niemand: "Зараз там нікого немає, або в мене ще немає даних про інших.",
      sprit: "У тебе в баку {l} літра, витрата {v} літра на коло – вистачить приблизно на {r} кола.",
      letzte: "Твоє останнє коло: {zeit}.", beste: "Твоє найкраще коло: {zeit}, на {nr}-му колі.", platz: "Ти на позиції {p}.",
      nochNichts: "Для цього в мене ще немає даних. Спершу проїдь чисте коло.",
      anmelden: "Увійди в акаунт, і я відповім детально. Пальне, відриви й час кіл скажу й так.",
      keineKi: "Для цього потрібен ШІ, а він зараз недоступний. Пальне, відриви й час кіл скажу й так.",
      stoerung: "Перешкоди в зв'язку, не вийшло. Запитай мене ще раз за хвилину.",
      einrichtung: "ШІ-інженер ще налаштовується, але пальне, відриви й час кіл я вже скажу.",
      rundeUngueltig: "Коло {nr} не зараховано.", neueBestzeit: "Нове найкраще коло: {zeit}. Чудово!", hinterBest: "{zeit}, на {d} секунди повільніше за найкраще.",
      runde: "Коло {nr}: {zeit}.", nachbesprechung: "Сесія закінчилася – краще запитай, що можна покращити в боротьбі.",
    },
    w: { vor: "попереду|переді мною", hinter: "позаду|ззаду", sprit: "пальн|бензин|бак", letzte: "останнє коло", beste: "найкраще коло|найшвидш", platz: "позиці|місц" },
    e: ["літра", "секунди", "кілометрів на годину", "метрів"],
  },
  sv: {
    t: {
      probe: "Radiokoll. Det här är {name}, jag hör dig högt och tydligt. Bränslet räcker sju varv till, vi tar in dig i depån i slutet av varv 23.",
      vor: "Framför dig ligger {wer}, ungefär {s} sekunder.", hinter: "Bakom dig ligger {wer}, ungefär {s} sekunder.",
      niemand: "Det är ingen där just nu, eller så har jag inga data om de andra än.",
      sprit: "Du har {l} liter i tanken och gör av med {v} liter per varv – det räcker i ungefär {r} varv.",
      letzte: "Ditt senaste varv: {zeit}.", beste: "Ditt bästa varv: {zeit}, på varv {nr}.", platz: "Du ligger på plats {p}.",
      nochNichts: "Jag har inga data för det än. Kör ett rent varv först.",
      anmelden: "Logga in så svarar jag utförligt. Bränsle, avstånd och varvtider säger jag ändå.",
      keineKi: "Till det behöver jag AI:n, och den går inte att nå just nu. Bränsle, avstånd och varvtider säger jag ändå.",
      stoerung: "Radiostörning, det gick inte. Fråga mig igen om en stund.",
      einrichtung: "AI-raceingenjören ställs in just nu, men bränsle, avstånd och varvtider kan jag redan säga.",
      rundeUngueltig: "Varv {nr} räknas inte.", neueBestzeit: "Nytt bästa varv: {zeit}. Starkt!", hinterBest: "{zeit}, {d} sekunder efter ditt bästa varv.",
      runde: "Varv {nr}: {zeit}.", nachbesprechung: "Passet är över – fråga mig hellre vad du kan göra bättre i dina dueller.",
    },
    w: { vor: "framf[oö]r", hinter: "bakom", sprit: "br[aä]nsle|bensin|tank", letzte: "senaste varv|sista varv", beste: "b[aä]sta varv|snabbaste", platz: "position|placering" },
    e: ["liter", "sekunder", "kilometer i timmen", "meter"],
  },
  da: {
    t: {
      probe: "Radiotjek. Det er {name}, jeg hører dig højt og tydeligt. Brændstoffet rækker til syv omgange mere, vi tager dig ind i depotet i slutningen af omgang 23.",
      vor: "Foran dig kører {wer}, cirka {s} sekunder.", hinter: "Bag dig kører {wer}, cirka {s} sekunder.",
      niemand: "Der er ingen lige nu, eller jeg har endnu ingen data om de andre.",
      sprit: "Du har {l} liter i tanken og bruger {v} liter pr. omgang – det rækker til cirka {r} omgange.",
      letzte: "Din seneste omgang: {zeit}.", beste: "Din bedste omgang: {zeit}, på omgang {nr}.", platz: "Du ligger på plads {p}.",
      nochNichts: "Det har jeg ingen data til endnu. Kør først en ren omgang.",
      anmelden: "Log ind, så svarer jeg grundigt. Brændstof, afstande og omgangstider siger jeg alligevel.",
      keineKi: "Til det skal jeg bruge AI'en, og den kan ikke nås lige nu. Brændstof, afstande og omgangstider siger jeg alligevel.",
      stoerung: "Radiostøj, det virkede ikke. Spørg mig igen om lidt.",
      einrichtung: "AI-raceingeniøren er ved at blive sat op, men brændstof, afstande og omgangstider kan jeg allerede sige.",
      rundeUngueltig: "Omgang {nr} tæller ikke.", neueBestzeit: "Ny bedste omgang: {zeit}. Stærkt!", hinterBest: "{zeit}, {d} sekunder efter din bedste omgang.",
      runde: "Omgang {nr}: {zeit}.", nachbesprechung: "Sessionen er slut – spørg mig hellere, hvad du kan gøre bedre i dine dueller.",
    },
    w: { vor: "foran", hinter: "bag mig|bagved", sprit: "br[aæ]ndstof|benzin|tank", letzte: "sidste omgang", beste: "bedste omgang|hurtigste", platz: "position|placering|plads" },
    e: ["liter", "sekunder", "kilometer i timen", "meter"],
  },
  fi: {
    t: {
      probe: "Radiotesti. Täällä {name}, kuulen sinut hyvin. Polttoaine riittää vielä seitsemän kierrosta, tulet varikolle kierroksen 23 lopussa.",
      vor: "Edessäsi ajaa {wer}, noin {s} sekuntia.", hinter: "Takanasi ajaa {wer}, noin {s} sekuntia.",
      niemand: "Siellä ei ole nyt ketään, tai minulla ei ole vielä tietoja muista.",
      sprit: "Tankissa on {l} litraa ja kulutat {v} litraa kierroksella – se riittää noin {r} kierrokseen.",
      letzte: "Viimeisin kierroksesi: {zeit}.", beste: "Paras kierroksesi: {zeit}, kierroksella {nr}.", platz: "Olet sijalla {p}.",
      nochNichts: "Minulla ei ole vielä tietoja siihen. Aja ensin puhdas kierros.",
      anmelden: "Kirjaudu sisään, niin vastaan tarkemmin. Polttoaineen, erot ja kierrosajat kerron joka tapauksessa.",
      keineKi: "Siihen tarvitsen tekoälyä, eikä se ole nyt tavoitettavissa. Polttoaineen, erot ja kierrosajat kerron silti.",
      stoerung: "Radiohäiriö, se ei onnistunut. Kysy uudelleen hetken päästä.",
      einrichtung: "Tekoälyinsinööriä vielä asennetaan, mutta polttoaineen, erot ja kierrosajat kerron jo.",
      rundeUngueltig: "Kierros {nr} ei kelpaa.", neueBestzeit: "Uusi paras kierros: {zeit}. Hienoa!", hinterBest: "{zeit}, {d} sekuntia parhaasta kierroksestasi.",
      runde: "Kierros {nr}: {zeit}.", nachbesprechung: "Sessio on ohi – kysy mieluummin, mitä voit parantaa kaksinkamppailuissa.",
    },
    w: { vor: "edess[aä]", hinter: "takana", sprit: "polttoaine|bensa|tankki", letzte: "viimeinen kierros|edellinen kierros", beste: "paras kierros|nopein", platz: "sijoitus|sija" },
    e: ["litraa", "sekuntia", "kilometriä tunnissa", "metriä"],
  },
  cs: {
    t: {
      probe: "Zkouška spojení. Tady {name}, slyším tě nahlas a jasně. Paliva je ještě na sedm kol, do boxů jedeme na konci 23. kola.",
      vor: "Před tebou jede {wer}, asi {s} sekundy.", hinter: "Za tebou jede {wer}, asi {s} sekundy.",
      niemand: "Teď tam nikdo není, nebo ještě nemám data o ostatních.",
      sprit: "V nádrži máš {l} litru a spotřebuješ {v} litru na kolo – vystačí asi na {r} kola.",
      letzte: "Tvoje poslední kolo: {zeit}.", beste: "Tvoje nejlepší kolo: {zeit}, v {nr}. kole.", platz: "Jsi na {p}. místě.",
      nochNichts: "Na to ještě nemám data. Nejdřív zajeď čisté kolo.",
      anmelden: "Přihlas se a odpovím ti podrobně. Palivo, odstupy a časy kol ti řeknu i tak.",
      keineKi: "Na to potřebuji AI a ta teď není dostupná. Palivo, odstupy a časy kol ti řeknu i tak.",
      stoerung: "Rušení spojení, nepovedlo se. Zeptej se mě za chvíli znovu.",
      einrichtung: "AI inženýr se ještě nastavuje, ale palivo, odstupy a časy kol ti řeknu už teď.",
      rundeUngueltig: "Kolo {nr} se nepočítá.", neueBestzeit: "Nové nejlepší kolo: {zeit}. Skvělé!", hinterBest: "{zeit}, o {d} sekundy za tvým nejlepším kolem.",
      runde: "Kolo {nr}: {zeit}.", nachbesprechung: "Jízda skončila – zeptej se mě raději, co můžeš zlepšit v soubojích.",
    },
    w: { vor: "p[řr]ede mnou|vep[řr]edu", hinter: "za mnou|vzadu", sprit: "palivo|benz[ií]n|n[aá]dr[zž]", letzte: "posledn[ií] kolo", beste: "nejlep[sš][ií] kolo|nejrychlej", platz: "pozice|m[ií]st" },
    e: ["litru", "sekundy", "kilometrů za hodinu", "metrů"],
  },
  sk: {
    t: {
      probe: "Skúška spojenia. Tu {name}, počujem ťa nahlas a jasne. Paliva je ešte na sedem kôl, do boxov ideme na konci 23. kola.",
      vor: "Pred tebou ide {wer}, asi {s} sekundy.", hinter: "Za tebou ide {wer}, asi {s} sekundy.",
      niemand: "Teraz tam nikto nie je, alebo ešte nemám údaje o ostatných.",
      sprit: "V nádrži máš {l} litra a spotrebuješ {v} litra na kolo – vystačí asi na {r} kola.",
      letzte: "Tvoje posledné kolo: {zeit}.", beste: "Tvoje najlepšie kolo: {zeit}, v {nr}. kole.", platz: "Si na {p}. mieste.",
      nochNichts: "Na to ešte nemám údaje. Najprv odjazdi čisté kolo.",
      anmelden: "Prihlás sa a odpoviem ti podrobne. Palivo, odstupy a časy kôl ti poviem aj tak.",
      keineKi: "Na to potrebujem AI a tá teraz nie je dostupná. Palivo, odstupy a časy kôl ti poviem aj tak.",
      stoerung: "Rušenie spojenia, nepodarilo sa. Opýtaj sa ma o chvíľu znova.",
      einrichtung: "AI inžinier sa ešte nastavuje, ale palivo, odstupy a časy kôl ti poviem už teraz.",
      rundeUngueltig: "Kolo {nr} sa nepočíta.", neueBestzeit: "Nové najlepšie kolo: {zeit}. Skvelé!", hinterBest: "{zeit}, o {d} sekundy za tvojím najlepším kolom.",
      runde: "Kolo {nr}: {zeit}.", nachbesprechung: "Jazda sa skončila – opýtaj sa ma radšej, čo môžeš zlepšiť v súbojoch.",
    },
    w: { vor: "predo mnou|vpredu", hinter: "za mnou|vzadu", sprit: "palivo|benz[ií]n|n[aá]dr[zž]", letzte: "posledn[eé] kolo", beste: "najlep[sš]ie kolo|najr[yý]chlej", platz: "poz[ií]ci|miest" },
    e: ["litra", "sekundy", "kilometrov za hodinu", "metrov"],
  },
  sl: {
    t: {
      probe: "Preizkus zveze. Tukaj {name}, slišim te glasno in jasno. Goriva je še za sedem krogov, v bokse gremo na koncu 23. kroga.",
      vor: "Pred tabo vozi {wer}, približno {s} sekunde.", hinter: "Za tabo vozi {wer}, približno {s} sekunde.",
      niemand: "Trenutno ni nikogar ali pa še nimam podatkov o ostalih.",
      sprit: "V rezervoarju imaš {l} litra in porabiš {v} litra na krog – dovolj za približno {r} krogov.",
      letzte: "Tvoj zadnji krog: {zeit}.", beste: "Tvoj najboljši krog: {zeit}, v {nr}. krogu.", platz: "Si na {p}. mestu.",
      nochNichts: "Za to še nimam podatkov. Najprej odpelji čist krog.",
      anmelden: "Prijavi se in odgovoril bom podrobno. Gorivo, razmike in čase krogov ti povem tudi tako.",
      keineKi: "Za to potrebujem umetno inteligenco, ki trenutno ni dosegljiva. Gorivo, razmike in čase krogov ti povem tudi tako.",
      stoerung: "Motnje v zvezi, ni uspelo. Vprašaj me čez trenutek še enkrat.",
      einrichtung: "Inženir z umetno inteligenco se še nastavlja, gorivo, razmike in čase krogov pa ti povem že zdaj.",
      rundeUngueltig: "Krog {nr} ne šteje.", neueBestzeit: "Nov najboljši krog: {zeit}. Odlično!", hinterBest: "{zeit}, {d} sekunde za tvojim najboljšim krogom.",
      runde: "Krog {nr}: {zeit}.", nachbesprechung: "Seja je končana – raje me vprašaj, kaj lahko izboljšaš v dvobojih.",
    },
    w: { vor: "pred mano|spredaj", hinter: "za mano|zadaj", sprit: "gorivo|bencin|rezervoar", letzte: "zadnji krog", beste: "najbolj[sš]i krog|najhitrej", platz: "polo[zž]aj|mest" },
    e: ["litra", "sekunde", "kilometrov na uro", "metrov"],
  },
  hr: {
    t: {
      probe: "Provjera veze. Ovdje {name}, čujem te glasno i jasno. Goriva ima još za sedam krugova, u boks ulazimo na kraju 23. kruga.",
      vor: "Ispred tebe vozi {wer}, oko {s} sekunde.", hinter: "Iza tebe vozi {wer}, oko {s} sekunde.",
      niemand: "Trenutno nema nikoga ili još nemam podatke o ostalima.",
      sprit: "U spremniku imaš {l} litre i trošiš {v} litre po krugu – dovoljno za otprilike {r} krugova.",
      letzte: "Tvoj zadnji krug: {zeit}.", beste: "Tvoj najbolji krug: {zeit}, u {nr}. krugu.", platz: "Na {p}. si mjestu.",
      nochNichts: "Za to još nemam podatke. Prvo odvozi čist krug.",
      anmelden: "Prijavi se i odgovorit ću detaljno. Gorivo, razmake i vremena krugova reći ću ti i ovako.",
      keineKi: "Za to mi treba umjetna inteligencija, a trenutno nije dostupna. Gorivo, razmake i vremena krugova reći ću ti i ovako.",
      stoerung: "Smetnje na vezi, nije uspjelo. Pitaj me ponovno za trenutak.",
      einrichtung: "AI inženjer se još postavlja, ali gorivo, razmake i vremena krugova već ti mogu reći.",
      rundeUngueltig: "Krug {nr} se ne računa.", neueBestzeit: "Novi najbolji krug: {zeit}. Odlično!", hinterBest: "{zeit}, {d} sekunde iza tvog najboljeg kruga.",
      runde: "Krug {nr}: {zeit}.", nachbesprechung: "Sesija je gotova – radije me pitaj što možeš poboljšati u dvobojima.",
    },
    w: { vor: "ispred", hinter: "iza mene|\\biza\\b", sprit: "gorivo|benzin|spremnik", letzte: "zadnji krug", beste: "najbolji krug|najbr[zž]", platz: "pozicij|mjest" },
    e: ["litre", "sekunde", "kilometara na sat", "metara"],
  },
  hu: {
    t: {
      probe: "Rádiópróba. Itt {name}, hangosan és tisztán hallak. Az üzemanyag még hét körre elég, a 23. kör végén jössz a boxba.",
      vor: "Előtted {wer} halad, nagyjából {s} másodpercre.", hinter: "Mögötted {wer} halad, nagyjából {s} másodpercre.",
      niemand: "Most nincs ott senki, vagy még nincsenek adataim a többiekről.",
      sprit: "{l} liter van a tankban, és körönként {v} litert fogyasztasz – ez nagyjából {r} körre elég.",
      letzte: "Az utolsó köröd: {zeit}.", beste: "A legjobb köröd: {zeit}, a {nr}. körben.", platz: "A {p}. helyen állsz.",
      nochNichts: "Ehhez még nincsenek adataim. Előbb menj egy tiszta kört.",
      anmelden: "Jelentkezz be, és részletesen válaszolok. Az üzemanyagot, a különbségeket és a köridőket így is megmondom.",
      keineKi: "Ehhez mesterséges intelligencia kell, ami most nem érhető el. Az üzemanyagot, a különbségeket és a köridőket így is megmondom.",
      stoerung: "Rádiózavar, nem sikerült. Kérdezz újra egy pillanat múlva.",
      einrichtung: "Az MI versenymérnök beállítása még folyik, de az üzemanyagot, a különbségeket és a köridőket már megmondom.",
      rundeUngueltig: "A {nr}. kör nem számít.", neueBestzeit: "Új legjobb kör: {zeit}. Szuper!", hinterBest: "{zeit}, {d} másodperccel a legjobb köröd mögött.",
      runde: "{nr}. kör: {zeit}.", nachbesprechung: "Vége a menetnek – inkább kérdezd meg, mit csinálhatsz jobban a csatákban.",
    },
    w: { vor: "el[oő]ttem|el[oö]l", hinter: "m[oö]g[oö]ttem|m[oö]g[oö]tt", sprit: "[uü]zemanyag|benzin|tank", letzte: "utols[oó] k[oö]r", beste: "legjobb k[oö]r|leggyorsabb", platz: "poz[ií]ci[oó]|hely" },
    e: ["liter", "másodperc", "kilométer per óra", "méter"],
  },
  ro: {
    t: {
      probe: "Probă radio. Aici {name}, te aud tare și clar. Combustibilul ajunge pentru încă șapte tururi, intrăm la boxe la finalul turului 23.",
      vor: "În fața ta este {wer}, la aproximativ {s} secunde.", hinter: "În spatele tău este {wer}, la aproximativ {s} secunde.",
      niemand: "Acum nu e nimeni acolo sau încă nu am date despre ceilalți.",
      sprit: "Ai {l} litri în rezervor și consumi {v} litri pe tur – ajunge pentru aproximativ {r} tururi.",
      letzte: "Ultimul tău tur: {zeit}.", beste: "Cel mai bun tur al tău: {zeit}, în turul {nr}.", platz: "Ești pe locul {p}.",
      nochNichts: "Încă nu am date pentru asta. Fă mai întâi un tur curat.",
      anmelden: "Autentifică-te și îți răspund în detaliu. Combustibilul, diferențele și timpii pe tur ți-i spun oricum.",
      keineKi: "Pentru asta am nevoie de AI, iar acum nu este disponibil. Combustibilul, diferențele și timpii pe tur ți-i spun oricum.",
      stoerung: "Problemă radio, nu a mers. Întreabă-mă din nou peste câteva clipe.",
      einrichtung: "Inginerul AI se configurează încă, dar combustibilul, diferențele și timpii pe tur ți-i pot spune deja.",
      rundeUngueltig: "Turul {nr} nu contează.", neueBestzeit: "Cel mai bun tur nou: {zeit}. Excelent!", hinterBest: "{zeit}, la {d} secunde de cel mai bun tur al tău.",
      runde: "Turul {nr}: {zeit}.", nachbesprechung: "Sesiunea s-a terminat – mai bine întreabă-mă ce poți îmbunătăți în dueluri.",
    },
    w: { vor: "[iî]n fa[tț]a|[iî]n fa[tț][aă]", hinter: "[iî]n spatele|[iî]n spate", sprit: "combustibil|benzin|rezervor", letzte: "ultimul tur", beste: "cel mai bun tur|cel mai rapid", platz: "pozi[tț]i|loc" },
    e: ["litri", "secunde", "kilometri pe oră", "metri"],
  },
  bg: {
    t: {
      probe: "Проверка на връзката. Тук е {name}, чувам те силно и ясно. Горивото стига за още седем обиколки, влизаме в бокса в края на 23-та обиколка.",
      vor: "Пред теб е {wer}, на около {s} секунди.", hinter: "Зад теб е {wer}, на около {s} секунди.",
      niemand: "В момента няма никого, или още нямам данни за останалите.",
      sprit: "Имаш {l} литра в резервоара и харчиш {v} литра на обиколка – стига за около {r} обиколки.",
      letzte: "Последната ти обиколка: {zeit}.", beste: "Най-добрата ти обиколка: {zeit}, в обиколка {nr}.", platz: "Ти си на позиция {p}.",
      nochNichts: "Още нямам данни за това. Първо направи чиста обиколка.",
      anmelden: "Влез в профила си и ще ти отговоря подробно. Гориво, разлики и времена ще ти кажа и така.",
      keineKi: "За това ми трябва изкуственият интелект, а в момента не е достъпен. Гориво, разлики и времена ще ти кажа и така.",
      stoerung: "Смущения във връзката, не се получи. Попитай ме пак след малко.",
      einrichtung: "AI инженерът още се настройва, но гориво, разлики и времена вече мога да ти кажа.",
      rundeUngueltig: "Обиколка {nr} не се зачита.", neueBestzeit: "Нова най-добра обиколка: {zeit}. Браво!", hinterBest: "{zeit}, на {d} секунди от най-добрата ти обиколка.",
      runde: "Обиколка {nr}: {zeit}.", nachbesprechung: "Сесията приключи – по-добре ме попитай какво можеш да подобриш в дуелите.",
    },
    w: { vor: "пред мен|отпред", hinter: "зад мен|отзад", sprit: "гориво|бензин|резервоар", letzte: "последна обиколка", beste: "най-добра обиколка|най-бърза", platz: "позиция|място" },
    e: ["литра", "секунди", "километра в час", "метра"],
  },
  el: {
    t: {
      probe: "Έλεγχος ασυρμάτου. Εδώ {name}, σε ακούω δυνατά και καθαρά. Τα καύσιμα φτάνουν για άλλους επτά γύρους, μπαίνουμε στα πιτ στο τέλος του γύρου 23.",
      vor: "Μπροστά σου: {wer}, περίπου {s} δευτερόλεπτα.", hinter: "Πίσω σου: {wer}, περίπου {s} δευτερόλεπτα.",
      niemand: "Δεν υπάρχει κανείς αυτή τη στιγμή ή δεν έχω ακόμα δεδομένα για τους άλλους.",
      sprit: "Έχεις {l} λίτρα στο ρεζερβουάρ και καις {v} λίτρα ανά γύρο – φτάνουν για περίπου {r} γύρους.",
      letzte: "Ο τελευταίος σου γύρος: {zeit}.", beste: "Ο καλύτερος γύρος σου: {zeit}, στον γύρο {nr}.", platz: "Είσαι στη θέση {p}.",
      nochNichts: "Δεν έχω ακόμα δεδομένα γι' αυτό. Κάνε πρώτα έναν καθαρό γύρο.",
      anmelden: "Συνδέσου και θα σου απαντήσω αναλυτικά. Καύσιμα, διαφορές και χρόνους γύρου θα σου πω έτσι κι αλλιώς.",
      keineKi: "Γι' αυτό χρειάζομαι την τεχνητή νοημοσύνη, που τώρα δεν είναι διαθέσιμη. Καύσιμα, διαφορές και χρόνους θα σου πω έτσι κι αλλιώς.",
      stoerung: "Παράσιτα στον ασύρματο, δεν πέτυχε. Ρώτα με ξανά σε λίγο.",
      einrichtung: "Ο μηχανικός τεχνητής νοημοσύνης ρυθμίζεται ακόμα, αλλά καύσιμα, διαφορές και χρόνους μπορώ ήδη να σου πω.",
      rundeUngueltig: "Ο γύρος {nr} δεν μετράει.", neueBestzeit: "Νέος καλύτερος γύρος: {zeit}. Μπράβο!", hinterBest: "{zeit}, {d} δευτερόλεπτα πίσω από τον καλύτερό σου.",
      runde: "Γύρος {nr}: {zeit}.", nachbesprechung: "Η συνεδρία τελείωσε – καλύτερα ρώτα με τι μπορείς να βελτιώσεις στις μονομαχίες.",
    },
    w: { vor: "μπροστ[άα]", hinter: "π[ίι]σω", sprit: "καύσιμ|καυσιμ|βενζ[ίι]νη|ρεζερβου[άα]ρ", letzte: "τελευτα[ίι]ο γ[ύυ]ρο|τελευτα[ίι]ος γ[ύυ]ρος", beste: "καλ[ύυ]τερο γ[ύυ]ρο|ταχ[ύυ]τερο", platz: "θ[έε]ση" },
    e: ["λίτρα", "δευτερόλεπτα", "χιλιόμετρα την ώρα", "μέτρα"],
  },
  et: {
    t: {
      probe: "Raadiokontroll. Siin {name}, kuulen sind valjult ja selgelt. Kütust jätkub veel seitsmeks ringiks, boksi tuleme ringi 23 lõpus.",
      vor: "Sinu ees sõidab {wer}, umbes {s} sekundit.", hinter: "Sinu taga sõidab {wer}, umbes {s} sekundit.",
      niemand: "Praegu pole seal kedagi või mul pole veel teiste andmeid.",
      sprit: "Paagis on {l} liitrit ja kulutad {v} liitrit ringi kohta – sellest jätkub umbes {r} ringiks.",
      letzte: "Sinu viimane ring: {zeit}.", beste: "Sinu parim ring: {zeit}, ringil {nr}.", platz: "Oled {p}. kohal.",
      nochNichts: "Selleks pole mul veel andmeid. Sõida enne üks puhas ring.",
      anmelden: "Logi sisse ja vastan põhjalikult. Kütuse, vahed ja ringiajad ütlen sulle niikuinii.",
      keineKi: "Selleks vajan tehisintellekti, aga see pole praegu kättesaadav. Kütuse, vahed ja ringiajad ütlen siiski.",
      stoerung: "Raadiohäire, ei õnnestunud. Küsi hetke pärast uuesti.",
      einrichtung: "Tehisintellektiga insener on alles seadistamisel, aga kütuse, vahed ja ringiajad ütlen juba praegu.",
      rundeUngueltig: "Ring {nr} ei lähe arvesse.", neueBestzeit: "Uus parim ring: {zeit}. Tubli!", hinterBest: "{zeit}, {d} sekundit sinu parimast ringist taga.",
      runde: "Ring {nr}: {zeit}.", nachbesprechung: "Sessioon on läbi – küsi parem, mida saad duellides paremini teha.",
    },
    w: { vor: "minu ees|\\bees\\b", hinter: "minu taga|\\btaga\\b", sprit: "k[uü]tus|bensiin|paak", letzte: "viimane ring", beste: "parim ring|kiireim", platz: "positsioon|koht" },
    e: ["liitrit", "sekundit", "kilomeetrit tunnis", "meetrit"],
  },
  lv: {
    t: {
      probe: "Radio pārbaude. Šeit {name}, dzirdu tevi skaļi un skaidri. Degvielas pietiek vēl septiņiem apļiem, depo iebrauksim 23. apļa beigās.",
      vor: "Tev priekšā brauc {wer}, apmēram {s} sekundes.", hinter: "Aiz tevis brauc {wer}, apmēram {s} sekundes.",
      niemand: "Šobrīd tur neviena nav, vai arī man vēl nav datu par pārējiem.",
      sprit: "Tvertnē ir {l} litri, un tu patērē {v} litrus aplī – pietiks apmēram {r} apļiem.",
      letzte: "Tavs pēdējais aplis: {zeit}.", beste: "Tavs labākais aplis: {zeit}, {nr}. aplī.", platz: "Tu esi {p}. vietā.",
      nochNichts: "Tam man vēl nav datu. Vispirms nobrauc tīru apli.",
      anmelden: "Pieslēdzies, un es atbildēšu sīkāk. Degvielu, atstarpes un apļu laikus pateikšu tāpat.",
      keineKi: "Tam vajag mākslīgo intelektu, bet tas šobrīd nav pieejams. Degvielu, atstarpes un apļu laikus pateikšu tāpat.",
      stoerung: "Radio traucējumi, neizdevās. Pajautā vēlreiz pēc brīža.",
      einrichtung: "MI inženieris vēl tiek iestatīts, bet degvielu, atstarpes un apļu laikus varu pateikt jau tagad.",
      rundeUngueltig: "{nr}. aplis netiek ieskaitīts.", neueBestzeit: "Jauns labākais aplis: {zeit}. Lieliski!", hinterBest: "{zeit}, {d} sekundes aiz tava labākā apļa.",
      runde: "{nr}. aplis: {zeit}.", nachbesprechung: "Sesija ir beigusies – labāk pajautā, ko vari uzlabot cīņās.",
    },
    w: { vor: "priek[sš][aā]", hinter: "aiz manis|aizmugur", sprit: "degviel|benz[iī]n|tvertn", letzte: "p[eē]d[eē]jais aplis", beste: "lab[aā]kais aplis|[aā]tr[aā]kais", platz: "poz[iī]cij|viet" },
    e: ["litri", "sekundes", "kilometri stundā", "metri"],
  },
  lt: {
    t: {
      probe: "Ryšio patikrinimas. Čia {name}, girdžiu tave garsiai ir aiškiai. Kuro užteks dar septyniems ratams, į boksus važiuojame 23 rato pabaigoje.",
      vor: "Priekyje važiuoja {wer}, maždaug {s} sekundės.", hinter: "Už tavęs važiuoja {wer}, maždaug {s} sekundės.",
      niemand: "Šiuo metu ten nieko nėra arba dar neturiu duomenų apie kitus.",
      sprit: "Bake turi {l} litro ir sunaudoji {v} litro per ratą – užteks maždaug {r} ratams.",
      letzte: "Tavo paskutinis ratas: {zeit}.", beste: "Tavo geriausias ratas: {zeit}, {nr} rate.", platz: "Esi {p} vietoje.",
      nochNichts: "Tam dar neturiu duomenų. Pirma nuvažiuok švarų ratą.",
      anmelden: "Prisijunk ir atsakysiu išsamiai. Kurą, atotrūkius ir ratų laikus pasakysiu ir taip.",
      keineKi: "Tam reikia dirbtinio intelekto, o jis dabar nepasiekiamas. Kurą, atotrūkius ir ratų laikus pasakysiu ir taip.",
      stoerung: "Ryšio trikdžiai, nepavyko. Paklausk dar kartą po akimirkos.",
      einrichtung: "DI inžinierius dar nustatomas, bet kurą, atotrūkius ir ratų laikus jau galiu pasakyti.",
      rundeUngueltig: "Ratas {nr} neįskaitomas.", neueBestzeit: "Naujas geriausias ratas: {zeit}. Puiku!", hinterBest: "{zeit}, {d} sekundės nuo tavo geriausio rato.",
      runde: "Ratas {nr}: {zeit}.", nachbesprechung: "Sesija baigėsi – geriau paklausk, ką gali pagerinti kovose.",
    },
    w: { vor: "priekyje|prie[sš] mane", hinter: "u[zž] man[eę]s|gale", sprit: "kur[oa]s|kuro|benzin|bak", letzte: "paskutinis ratas", beste: "geriausias ratas|grei[cč]iausias", platz: "pozicij|viet" },
    e: ["litro", "sekundės", "kilometrų per valandą", "metrų"],
  },
  mt: {
    t: {
      probe: "Ittestjar tar-radju. Hawn {name}, nismgħek ċar u tajjeb. Il-fjuwil jasal għal seba' dawriet oħra, nidħlu fil-pits fl-aħħar tad-dawra 23.",
      vor: "Quddiemek hemm {wer}, madwar {s} sekondi.", hinter: "Warajk hemm {wer}, madwar {s} sekondi.",
      niemand: "Bħalissa m'hemm ħadd, jew għad m'għandix data dwar l-oħrajn.",
      sprit: "Għandek {l} litri fit-tank u tuża {v} litri kull dawra – jasal għal madwar {r} dawriet.",
      letzte: "L-aħħar dawra tiegħek: {zeit}.", beste: "L-aħjar dawra tiegħek: {zeit}, fid-dawra {nr}.", platz: "Inti fil-pożizzjoni {p}.",
      nochNichts: "Għal dan għad m'għandix data. L-ewwel agħmel dawra nadifa.",
      anmelden: "Idħol fil-kont u nwieġbek fid-dettall. Il-fjuwil, id-distanzi u l-ħinijiet ngħidlek xorta waħda.",
      keineKi: "Għal dan għandi bżonn l-IA, u bħalissa mhix disponibbli. Il-fjuwil, id-distanzi u l-ħinijiet ngħidlek xorta waħda.",
      stoerung: "Problema fir-radju, ma rnexxiex. Erġa' staqsini ftit wara.",
      einrichtung: "L-inġinier tal-IA għadu qed jiġi stabbilit, imma l-fjuwil, id-distanzi u l-ħinijiet nista' ngħidlek diġà.",
      rundeUngueltig: "Id-dawra {nr} ma tgħoddx.", neueBestzeit: "L-aħjar dawra ġdida: {zeit}. Prosit!", hinterBest: "{zeit}, {d} sekondi wara l-aħjar dawra tiegħek.",
      runde: "Dawra {nr}: {zeit}.", nachbesprechung: "Is-sessjoni spiċċat – aħjar staqsini x'tista' ttejjeb fil-ġlied.",
    },
    w: { vor: "quddiem", hinter: "warajja|wara", sprit: "fjuwil|petrol|tank", letzte: "a[ħh][ħh]ar dawra", beste: "a[ħh]jar dawra|mg[ħh]a[ġg][ġg]la", platz: "po[żz]izzjoni|post" },
    e: ["litri", "sekondi", "kilometri fis-siegħa", "metri"], punkt: true,
  },
  tr: {
    t: {
      probe: "Telsiz kontrolü. Ben {name}, seni yüksek ve net duyuyorum. Yakıt yedi tur daha yeter, 23. turun sonunda pite giriyoruz.",
      vor: "Önünde {wer} var, yaklaşık {s} saniye.", hinter: "Arkanda {wer} var, yaklaşık {s} saniye.",
      niemand: "Şu an kimse yok ya da henüz diğerlerinden veri almadım.",
      sprit: "Depoda {l} litre var ve tur başına {v} litre harcıyorsun – yaklaşık {r} tur yeter.",
      letzte: "Son turun: {zeit}.", beste: "En iyi turun: {zeit}, {nr}. turda.", platz: "{p}. sıradasın.",
      nochNichts: "Bunun için henüz verim yok. Önce temiz bir tur at.",
      anmelden: "Giriş yap, sana ayrıntılı cevap vereyim. Yakıtı, farkları ve tur sürelerini yine de söylerim.",
      keineKi: "Bunun için yapay zekâya ihtiyacım var ve şu an ulaşılamıyor. Yakıtı, farkları ve tur sürelerini yine de söylerim.",
      stoerung: "Telsizde parazit var, olmadı. Biraz sonra tekrar sor.",
      einrichtung: "Yapay zekâ mühendisi hâlâ kuruluyor ama yakıtı, farkları ve tur sürelerini şimdiden söyleyebilirim.",
      rundeUngueltig: "{nr}. tur sayılmıyor.", neueBestzeit: "Yeni en iyi tur: {zeit}. Harika!", hinterBest: "{zeit}, en iyi turundan {d} saniye geride.",
      runde: "{nr}. tur: {zeit}.", nachbesprechung: "Seans bitti – bana daha çok mücadelelerde neyi daha iyi yapabileceğini sor.",
    },
    w: { vor: "[oö]n[uü]mde|[oö]nde", hinter: "arkamda|arkada", sprit: "yak[ıi]t|benzin|depo", letzte: "son tur", beste: "en iyi tur|en h[ıi]zl[ıi]", platz: "pozisyon|s[ıi]ra|ka[cç][ıi]nc[ıi]" },
    e: ["litre", "saniye", "kilometre bölü saat", "metre"],
  },
  zh: {
    t: {
      probe: "无线电测试。我是{name}，听得非常清楚。燃油还够再跑七圈，第23圈结束时进站。",
      vor: "你前面是{wer}，大约{s}秒。", hinter: "你后面是{wer}，大约{s}秒。",
      niemand: "现在那里没有人，或者我还没有其他车的数据。",
      sprit: "油箱里还有{l}升，每圈消耗{v}升，大约还能跑{r}圈。",
      letzte: "你上一圈：{zeit}。", beste: "你的最快圈：{zeit}，在第{nr}圈。", platz: "你现在排第{p}位。",
      nochNichts: "这个我还没有数据。先跑一个干净的圈。",
      anmelden: "登录后我可以详细回答。燃油、差距和圈速我现在也能告诉你。",
      keineKi: "这个需要AI，但现在连接不上。燃油、差距和圈速我还是可以告诉你。",
      stoerung: "无线电干扰，没成功。稍后再问我一次。",
      einrichtung: "AI工程师还在设置中，不过燃油、差距和圈速我已经可以告诉你。",
      rundeUngueltig: "第{nr}圈不计成绩。", neueBestzeit: "新的最快圈：{zeit}。太棒了！", hinterBest: "{zeit}，比你的最快圈慢{d}秒。",
      runde: "第{nr}圈：{zeit}。", nachbesprechung: "这一节已经结束了，不如问我你在缠斗中可以做得更好的地方。",
    },
    w: { vor: "前面|前方", hinter: "后面|后方", sprit: "燃油|油量|油", letzte: "上一圈|最后一圈", beste: "最快圈|最佳圈|最好成绩", platz: "排名|名次|第几" },
    e: ["升", "秒", "公里每小时", "米"], punkt: true,
  },
  ja: {
    t: {
      probe: "無線チェック。こちら{name}、よく聞こえます。燃料はあと7周分あります。23周目の終わりにピットインします。",
      vor: "前は{wer}、約{s}秒です。", hinter: "後ろは{wer}、約{s}秒です。",
      niemand: "今は誰もいないか、まだ他の車のデータがありません。",
      sprit: "タンクに{l}リットル、1周あたり{v}リットル消費しています。あと約{r}周走れます。",
      letzte: "前の周は{zeit}です。", beste: "ベストラップは{zeit}、{nr}周目です。", platz: "現在{p}位です。",
      nochNichts: "まだそのデータがありません。まずクリーンな1周を走ってください。",
      anmelden: "ログインすれば詳しく答えられます。燃料、差、ラップタイムは今でも答えられます。",
      keineKi: "それにはAIが必要ですが、今は接続できません。燃料、差、ラップタイムは答えられます。",
      stoerung: "無線の不調で、うまくいきませんでした。少ししてからもう一度聞いてください。",
      einrichtung: "AIエンジニアはまだ準備中ですが、燃料、差、ラップタイムはもう答えられます。",
      rundeUngueltig: "{nr}周目は無効です。", neueBestzeit: "ベスト更新：{zeit}。素晴らしい！", hinterBest: "{zeit}、ベストから{d}秒遅れです。",
      runde: "{nr}周目：{zeit}。", nachbesprechung: "セッションは終わりました。バトルで何を改善できるか聞いてください。",
    },
    w: { vor: "前", hinter: "後ろ", sprit: "燃料|ガソリン", letzte: "前の周|最後の周", beste: "ベスト|最速", platz: "順位|何位" },
    e: ["リットル", "秒", "キロ毎時", "メートル"], punkt: true,
  },
};

export const ANSAGE_SPRACHEN = Object.keys(S);
const sprache = (code: string) => S[code] ?? S.de;

/** „Wir schauen uns das an“ für schwierige Fragen (Deutsch hat eigene Sätze je Art, siehe chat.ts) */
const PRUEFEN: Record<string, string> = {
  en: "Copy, we're looking at it.", es: "Entendido, lo estamos mirando.", fr: "Bien reçu, on regarde ça.", it: "Ricevuto, ci stiamo guardando.",
  pt: "Entendido, estamos a ver isso.", nl: "Begrepen, we kijken ernaar.", pl: "Zrozumiałem, sprawdzamy to.", ru: "Понял, смотрим.",
  uk: "Зрозумів, дивимося.", sv: "Uppfattat, vi tittar på det.", da: "Modtaget, vi kigger på det.", fi: "Selvä, katsotaan.",
  cs: "Rozumím, díváme se na to.", sk: "Rozumiem, pozeráme sa na to.", sl: "Razumem, pogledamo.", hr: "Razumijem, gledamo.",
  hu: "Értettem, megnézzük.", ro: "Recepționat, ne uităm.", bg: "Разбрано, проверяваме.", el: "Ελήφθη, το κοιτάμε.",
  et: "Selge, vaatame üle.", lv: "Sapratu, skatāmies.", lt: "Supratau, žiūrime.", mt: "Fhimt, qed inħarsu lejha.",
  tr: "Anlaşıldı, bakıyoruz.", zh: "收到，我们看一下。", ja: "了解、確認します。",
};
export const pruefenIn = (code: string): string | null => PRUEFEN[code] ?? null;

/** Fester Satz in der Sprache, Platzhalter {name} {wer} {s} … werden ersetzt */
export function ansage(code: string, schluessel: Schluessel, werte: Record<string, string | number> = {}): string {
  return sprache(code).t[schluessel].replace(/\{(\w+)\}/g, (_, k: string) => String(werte[k] ?? ""));
}

/** Schreibt die Sprache Kommazahlen mit Punkt (Englisch, Chinesisch …)? */
export const mitPunkt = (code: string) => Boolean(sprache(code).punkt);

/** Zahl mit Komma oder Punkt – je nach Sprache */
export function zahlIn(code: string, x: number, stellen = 1): string {
  const t = x.toFixed(stellen);
  return sprache(code).punkt ? t : t.replace(".", ",");
}

export type Absicht = "vor" | "hinter" | "sprit" | "letzte" | "beste" | "platz";
/** Worum geht es in der Frage? Sucht in der Sprache der Antwort, dazu Deutsch und Englisch (nicht in allen Sprachen:
 *  kurze Stichwörter wie kroatisch „iza“ stecken sonst in fremden Wörtern, z. B. spanisch „analizar“) */
export function absicht(frage: string, zuerst?: string): Absicht | null {
  const t = frage.toLowerCase();
  const reihe = [zuerst, "de", "en"].filter((c, i, a): c is string => Boolean(c) && a.indexOf(c) === i && Boolean(S[c!]));
  for (const code of reihe) {
    const w = S[code].w;
    // Reihenfolge wichtig: „letzte Runde“ vor „Runde“, Sprit nicht beim Sparen
    for (const a of ["letzte", "beste", "vor", "hinter", "sprit", "platz"] as Absicht[]) {
      if (new RegExp(w[a], "u").test(t) && !(a === "sprit" && /spar|save|ahorr|[eé]conom/.test(t))) return a;
    }
  }
  return null;
}

// ---------------------------------------------------------------- Zahlen in Worten (Deutsch, für die eigene Stimme)
// Die geklonte Stimme (Pocket TTS) liest Text, keine Ziffern: „23.“ → „dreiundzwanzigsten“, „1,2“ → „eins Komma zwei“.
const EINER = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf",
  "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const ZEHNER = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
const vorn = (n: number) => (n === 1 ? "ein" : EINER[n]);

/** Ganze Zahl 0–999.999 in Worten („dreiundzwanzig“); größere bleiben Ziffern */
export function zahlWort(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1_000_000) return String(n);
  if (n < 20) return EINER[n];
  if (n < 100) return n % 10 ? `${vorn(n % 10)}und${ZEHNER[Math.floor(n / 10)]}` : ZEHNER[n / 10];
  if (n < 1000) return `${vorn(Math.floor(n / 100))}hundert${n % 100 ? zahlWort(n % 100) : ""}`;
  return `${Math.floor(n / 1000) === 1 ? "ein" : zahlWort(Math.floor(n / 1000))}tausend${n % 1000 ? zahlWort(n % 1000) : ""}`;
}
/** Ordnungszahl in der Form nach „der“: 1 → „ersten“, 3 → „dritten“, 23 → „dreiundzwanzigsten“ */
export function ordnungWort(n: number): string {
  const sonder: Record<number, string> = { 1: "ersten", 3: "dritten", 7: "siebten", 8: "achten" };
  if (sonder[n]) return sonder[n];
  const w = zahlWort(n);
  return n < 20 ? `${w}ten` : `${w}sten`;
}

/** Deutsche Ziffern in Worte: Ordnungszahlen, Kommazahlen (Nachkommastellen einzeln), Startnummern „#27“ */
export function zahlenAusschreiben(text: string): string {
  return text
    .replace(/#(\d{1,4})\b/g, (_, z: string) => `Nummer ${zahlWort(Number(z))}`)
    // nur vor typischen Wörtern – „Platz 3. Stark!“ ist ein Satzende, keine Ordnungszahl
    .replace(/\b(\d{1,5})\.(?=\s+(?:Runde|Runden|Kurve|Kurven|Platz|Position|Stint|Sitzung|Rennen|Mal|Sektor)\b)/g, (_, z: string) => ordnungWort(Number(z)))
    .replace(/\b(\d{1,6}),(\d{1,4})\b/g, (_, g: string, k: string) => `${zahlWort(Number(g))} Komma ${[...k].map((d) => EINER[Number(d)]).join(" ")}`)
    .replace(/\b\d{1,6}\b/g, (z) => zahlWort(Number(z)));
}

/** Text zum Vorlesen aufbereiten: Rundenzeiten wie am Funk, Kommazahlen je Sprache, Einheiten ausgeschrieben */
export function zumSprechen(text: string, code: string): string {
  const s = sprache(code);
  const [liter, sekunden, kmh, meter] = s.e;
  let t = text
    // Rundenzeit 1:27,120 → „1 27,1“ (so sagt man es am Funk)
    .replace(/\b(\d{1,2}):(\d{2})[,.](\d)\d{0,2}\b/g, (_, m: string, ss: string, z: string) => `${m} ${ss}${s.punkt ? "." : ","}${z}`)
    .replace(/(\d)\s?km\/h\b/g, `$1 ${kmh}`)
    .replace(/(\d)\s?l\b(?!\w)/gi, `$1 ${liter}`)
    .replace(/(\d)\s?s\b(?![\w'])/g, `$1 ${sekunden}`)
    .replace(/(\d)\s?m\b(?![\w'/])/g, `$1 ${meter}`);
  if (s.punkt) t = t.replace(/(\d),(\d)/g, "$1.$2");
  return t;
}
