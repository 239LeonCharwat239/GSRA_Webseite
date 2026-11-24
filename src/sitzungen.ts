// GSRA – Aktive Anmeldungen im Dashboard (SQL 047, Entscheidung 24.11.2026).
// Vorbild große Messenger: Jede Anmeldung einzeln sehen (Gerät, grober Netzbereich, seit wann, zuletzt aktiv) und
// einzeln beenden – oder alle anderen auf einmal. Die Datenbank zeigt nur die eigenen Anmeldungen; das Netz wird
// nur grob angezeigt (z. B. „84.132.x.x“). Ein beendetes Gerät kann sich nicht mehr erneuern und ist spätestens nach
// einer Stunde abgemeldet (so lange gilt ein bereits ausgestellter Anmelde-Schlüssel).

import { dialog, supabaseClient, toast } from "./fenster";

type Sitzung = { id: string; geraet: string; netz: string | null; angemeldet_am: string; zuletzt_aktiv: string; aktuell: boolean };

type Client = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  auth: {
    getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }>;
    signOut: (o: { scope: "others" | "local" | "global" }) => Promise<{ error: { message: string } | null }>;
  };
};

const client = () => supabaseClient<Client>();


function wann(iso: string): string {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 2) return "gerade eben";
  if (min < 60) return `vor ${min} Minuten`;
  if (min < 60 * 24) return `vor ${Math.round(min / 60)} Stunden`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const symbol = (geraet: string) => (/Handy|Tablet/i.test(geraet) ? "fa-mobile-screen" : "fa-laptop");

async function laden(karte: HTMLElement, liste: HTMLElement) {
  const sb = client();
  if (!sb) return;
  const { data, error } = await sb.rpc("my_sessions");
  if (error) return; // SQL 047 noch nicht ausgeführt: Karte bleibt verborgen
  const sitzungen = (data as Sitzung[] | null) || [];
  karte.hidden = false;
  liste.replaceChildren();
  for (const s of sitzungen) {
    const li = document.createElement("li");
    const i = document.createElement("i");
    i.className = `fa-solid ${symbol(s.geraet)}`;
    i.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = s.geraet || "Unbekanntes Gerät";
    if (s.aktuell) {
      const dieses = document.createElement("em");
      dieses.className = "dash-session-this";
      dieses.textContent = "dieses Gerät";
      name.append(" ", dieses);
    }
    const info = document.createElement("small");
    info.textContent = `Angemeldet ${wann(s.angemeldet_am)} · zuletzt aktiv ${wann(s.zuletzt_aktiv)}${s.netz ? ` · Netz ${s.netz}` : ""}`;
    text.append(name, info);
    li.append(i, text);
    if (!s.aktuell) {
      const knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "dash-session-end";
      knopf.innerHTML = '<i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Abmelden';
      knopf.addEventListener("click", async () => {
        const ok = await dialog({
          icon: "fa-right-from-bracket", title: `${s.geraet} abmelden?`,
          message: "Dieses Gerät wird abgemeldet und muss sich neu anmelden. Spätestens nach einer Stunde ist es draußen.",
          confirmText: "Abmelden", cancelText: "Abbrechen", danger: true,
        });
        if (!ok) return;
        knopf.disabled = true;
        const { error: e } = await sb.rpc("end_session", { _id: s.id });
        if (e) { knopf.disabled = false; toast(e.message, "error"); return; }
        toast("Die Anmeldung wurde beendet.", "success");
        void laden(karte, liste);
      });
      li.appendChild(knopf);
    }
    liste.appendChild(li);
  }
  const andere = karte.querySelector<HTMLButtonElement>("#sessionsEndOthers");
  if (andere) andere.hidden = !sitzungen.some((s) => !s.aktuell);
}

function starten() {
  const karte = document.getElementById("sessionsCard");
  const liste = document.getElementById("sessionsList");
  if (!karte || !liste) return;
  void laden(karte, liste);
  karte.querySelector<HTMLButtonElement>("#sessionsEndOthers")?.addEventListener("click", async () => {
    const sb = client();
    if (!sb) return;
    const ok = await dialog({
      icon: "fa-user-shield", title: "Alle anderen Geräte abmelden?",
      message: "Nur dieses Gerät bleibt angemeldet. Alle anderen müssen sich neu anmelden.",
      confirmText: "Andere abmelden", cancelText: "Abbrechen", danger: true,
    });
    if (!ok) return;
    const { error } = await sb.auth.signOut({ scope: "others" });
    if (error) { toast(error.message, "error"); return; }
    toast("Alle anderen Geräte wurden abgemeldet.", "success");
    void laden(karte, liste);
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", starten);
else starten();
