// Vorschau-Seite der Ladeanimation (nur Entwicklung, gehört nicht zum fertigen Programm)
import { ladeAnzeige, ladeLogo } from "../../src/ladeanimation.ts";

const holen = (id: string) => document.getElementById(id) as HTMLElement;

holen("dunkel").append(ladeLogo().element);
holen("hell").append(ladeLogo().element);
holen("liste").append(ladeAnzeige("Chats werden geladen …"));

let einmal = ladeLogo({ schleife: false });
holen("einmal").append(einmal.element);
holen("nochmal").addEventListener("click", () => {
  einmal.stoppen();
  einmal = ladeLogo({ schleife: false });
  holen("einmal").replaceChildren(einmal.element);
});

// Vergleich: fertiges Logo (ohne Bewegung) halb durchsichtig über dem Original
const vergleich = ladeLogo({ schleife: false });
vergleich.stoppen();
vergleich.element.setAttribute("viewBox", "0 0 555 388"); // gleicher Ausschnitt wie das Bild
holen("vergleich").append(vergleich.element);
