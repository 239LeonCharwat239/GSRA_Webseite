// Startbild der App: Das GSRA-Logo baut sich einmal auf (Netz, dann Buchstaben, Glanz) und blendet dann aus.
// Ein Klick überspringt es. Die Animation selbst ist dieselbe wie auf der Webseite (../../src/ladeanimation.ts).
import { ladeLogo } from "../../src/ladeanimation.ts";

export function startbildZeigen(): void {
  const start = document.getElementById("start");
  if (!start) return;
  const logo = ladeLogo({ schleife: false });
  start.append(logo.element);
  let weg = false;
  const ausblenden = () => {
    if (weg) return;
    weg = true;
    start.classList.add("weg");
    window.setTimeout(() => { logo.stoppen(); start.remove(); }, 450);
  };
  start.addEventListener("click", ausblenden, { once: true });
  void logo.fertig.then(() => window.setTimeout(ausblenden, 350));
}
