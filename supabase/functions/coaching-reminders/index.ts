// GSRA – Supabase Edge Function „coaching-reminders“ (SQL 033)
// Verschickt Erinnerungen an Kunde und Coach: 24 Stunden und 1 Stunde vor einem Coaching-Termin.
// Aufruf alle 15 Minuten durch den Zeitplan in der Datenbank (pg_cron + pg_net). „Verify JWT“ bleibt an; der
// Zeitplan ruft mit dem öffentlichen Schlüssel der Webseite auf. Das ist unbedenklich: Welche Erinnerungen fällig
// sind, entscheidet die Datenbank (coaching_reminder_run); jede wird genau einmal vermerkt und verschickt, und es
// gibt höchstens alle 4 Minuten einen Lauf – egal, wer die Funktion wie oft aufruft. Sie gibt keine Daten zurück.
// Benötigte Secrets (wie bei cancel-contract): SMTP_USER und SMTP_PASS, optional SMTP_HOST, SMTP_PORT, SITE_URL.
// Seit 19.11. (SQL 035) auch E-Mails zu Reklamationen: neue Meldung → Coach (mit Frist) und Eingangsbestätigung an
// den Kunden; Ergebnis (erstattet, teilweise erstattet, abgelehnt) → beide.
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Zeiten in deutscher Zeit (Europa/Berlin), z. B. „Sa., 22.11.2026 um 18:00 Uhr“
const when = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  return `${day} um ${time} Uhr`;
};
const duration = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} Std. ${m} Min.` : `${h} Std.`) : `${m} Min.`;
};

type Due = {
  id: string; art: "24h" | "1h"; status: string; titel: string; termin: string; dauer: number;
  coach_id: string; kunde_id: string; coach_name: string; kunde_name: string;
};

// Texte für Kunde bzw. Coach (nur Klartext, keine Links zu fremden Seiten)
function mails(r: Due, site: string) {
  const zeit = when(r.termin);
  const bezahlt = r.status === "bezahlt";
  const kundeLink = `${site}/coaching.html?tab=anfragen`;
  const coachLink = `${site}/coaching.html?tab=coach`;
  const gruss = "\n\nDein GSRA-Team\nGlobal Simracing Alliance";
  if (r.art === "1h") {
    return {
      kunde: {
        subject: `In einer Stunde: dein Coaching „${r.titel}“`,
        text: `Hallo ${r.kunde_name},\n\nin etwa einer Stunde geht es los: Dein Coaching „${r.titel}“ mit ${r.coach_name} beginnt am ${zeit} (deutsche Zeit) und dauert ${duration(r.dauer)}.\n\nAbsprachen laufen über den GSRA-Messenger. Viel Spaß und schnelle Runden!\n\nDeine Coachings: ${kundeLink}${gruss}`,
      },
      coach: {
        subject: `In einer Stunde: Coaching mit ${r.kunde_name}`,
        text: `Hallo ${r.coach_name},\n\nin etwa einer Stunde coachst du ${r.kunde_name}: „${r.titel}“ am ${zeit} (deutsche Zeit), Dauer ${duration(r.dauer)}.\n\nNach dem Termin kannst du das Coaching als erledigt markieren.\n\nDeine Coachings: ${coachLink}${gruss}`,
      },
    };
  }
  return {
    kunde: {
      subject: bezahlt ? `Erinnerung: dein Coaching „${r.titel}“ morgen` : `Bitte bezahlen: dein Coaching „${r.titel}“`,
      text: bezahlt
        ? `Hallo ${r.kunde_name},\n\nkurze Erinnerung: Dein Coaching „${r.titel}“ mit ${r.coach_name} beginnt am ${zeit} (deutsche Zeit) und dauert ${duration(r.dauer)}.\n\nAbsprachen laufen über den GSRA-Messenger.\n\nDeine Coachings: ${kundeLink}${gruss}`
        : `Hallo ${r.kunde_name},\n\n${r.coach_name} hat dein Coaching „${r.titel}“ für ${zeit} (deutsche Zeit) bestätigt – es ist aber noch nicht bezahlt. Bitte bezahle es rechtzeitig auf der Coaching-Seite, sonst findet es nicht statt.\n\nJetzt bezahlen: ${kundeLink}${gruss}`,
    },
    coach: {
      subject: `Erinnerung: Coaching mit ${r.kunde_name} morgen`,
      text: `Hallo ${r.coach_name},\n\nkurze Erinnerung: Du coachst ${r.kunde_name} – „${r.titel}“ am ${zeit} (deutsche Zeit), Dauer ${duration(r.dauer)}.\n${bezahlt ? "Das Coaching ist bezahlt." : "Das Coaching ist noch nicht bezahlt; dein Kunde wurde daran erinnert."}\n\nDeine Coachings: ${coachLink}${gruss}`,
    },
  };
}

type Case = {
  id: string; art: "neu" | "ergebnis"; status: string; grund: string; titel: string; termin: string; frist: string;
  betrag: number; entscheidung: string | null; coach_id: string; kunde_id: string; coach_name: string; kunde_name: string;
};
const GRUND: Record<string, string> = {
  nicht_erschienen: "Coach ist nicht erschienen", mangelhaft: "Coaching war mangelhaft", sonstiges: "Etwas anderes",
};
const euro = (cents: number) => (Number(cents || 0) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

// Texte zu Reklamationen für Kunde bzw. Coach
function caseMails(c: Case, site: string) {
  const kundeLink = `${site}/coaching.html?tab=anfragen`;
  const coachLink = `${site}/coaching.html?tab=coach`;
  const gruss = "\n\nDein GSRA-Team\nGlobal Simracing Alliance";
  const fall = `„${c.titel}“ am ${when(c.termin)}`;
  if (c.art === "neu") {
    return {
      kunde: {
        subject: `Deine Meldung zum Coaching „${c.titel}“ ist eingegangen`,
        text: `Hallo ${c.kunde_name},\n\nwir haben deine Meldung zu ${fall} erhalten (${GRUND[c.grund] || c.grund}).\n\n${c.coach_name} kann bis ${when(c.frist)} erstatten oder widersprechen. ${c.grund === "nicht_erschienen" ? "Antwortet der Coach nicht, bekommst du dein Geld automatisch zurück." : "Kommt keine Einigung zustande, entscheidet die GSRA-Moderation."}\n\nDeine Coachings: ${kundeLink}${gruss}`,
      },
      coach: {
        subject: `Reklamation zu deinem Coaching „${c.titel}“ – bitte bis ${when(c.frist)} reagieren`,
        text: `Hallo ${c.coach_name},\n\n${c.kunde_name} hat ein Problem mit ${fall} gemeldet: ${GRUND[c.grund] || c.grund}.\n\nBitte reagiere bis ${when(c.frist)} (deutsche Zeit) auf der Coaching-Seite unter „Als Coach“: Erstatte das Coaching oder widersprich mit einer kurzen Begründung. ${c.grund === "nicht_erschienen" ? "Ohne Antwort wird das Coaching automatisch voll erstattet." : "Ohne Einigung entscheidet die GSRA-Moderation."}\n\nZur Reklamation: ${coachLink}${gruss}`,
      },
    };
  }
  const ergebnis = c.status === "erstattet" ? `Das Coaching wurde voll erstattet (${euro(c.betrag)}).`
    : c.status === "teilweise_erstattet" ? `Es wurden ${euro(c.betrag)} erstattet.`
    : "Die Reklamation wurde abgelehnt, es gibt keine Erstattung.";
  const begruendung = c.entscheidung ? `\nBegründung: ${c.entscheidung}` : "";
  return {
    kunde: {
      subject: `Ergebnis deiner Meldung zum Coaching „${c.titel}“`,
      text: `Hallo ${c.kunde_name},\n\nzu deiner Meldung zu ${fall}: ${ergebnis}${begruendung}\n\n${c.status === "abgelehnt" ? "" : "Die Gutschrift erscheint je nach Bank in wenigen Tagen auf deinem Konto.\n\n"}Deine Coachings: ${kundeLink}${gruss}`,
    },
    coach: {
      subject: `Ergebnis der Reklamation zu „${c.titel}“`,
      text: `Hallo ${c.coach_name},\n\nzur Reklamation von ${c.kunde_name} zu ${fall}: ${ergebnis}${begruendung}\n\nDeine Coachings: ${coachLink}${gruss}`,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt." }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.rpc("coaching_reminder_run");
    if (error) {
      console.error("Erinnerungen:", error.message);
      return json({ ok: false }, 500);
    }
    const due: Due[] = data?.erinnerungen || [];
    const cases: Case[] = data?.reklamationen || [];
    if (!data?.lauf || (!due.length && !cases.length)) return json({ ok: true, gesendet: 0 });

    const user = Deno.env.get("SMTP_USER");
    const pass = Deno.env.get("SMTP_PASS");
    if (!user || !pass) {
      console.error("Erinnerungen: SMTP_USER/SMTP_PASS fehlen – nichts verschickt.");
      return json({ ok: false, gesendet: 0 }, 500);
    }
    const port = Number(Deno.env.get("SMTP_PORT") || 465);
    const transporter = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST") || "smtp.gmail.com", port, secure: port === 465, auth: { user, pass },
    });
    const site = (Deno.env.get("SITE_URL") || "https://gsra-webseite.vercel.app").replace(/\/+$/, "");
    const emailOf = async (id: string) => (await admin.auth.admin.getUserById(id)).data?.user?.email || null;

    let sent = 0;
    const send = async (label: string, texts: Record<"kunde" | "coach", { subject: string; text: string }>, kundeId: string, coachId: string) => {
      for (const [who, id] of [["kunde", kundeId], ["coach", coachId]] as const) {
        try {
          const to = await emailOf(id);
          if (!to) continue;
          await transporter.sendMail({ from: `"GSRA Coaching" <${user}>`, to, subject: texts[who].subject, text: texts[who].text });
          sent++;
        } catch (err) {
          // Vermerkt ist die E-Mail schon: lieber eine verpasste als doppelte E-Mails
          console.error(`${label} (${who}) nicht verschickt:`, err);
        }
      }
    };
    for (const r of due) await send(`Erinnerung ${r.id}`, mails(r, site), r.kunde_id, r.coach_id);
    for (const c of cases) await send(`Reklamation ${c.id}`, caseMails(c, site), c.kunde_id, c.coach_id);
    return json({ ok: true, gesendet: sent });
  } catch (err) {
    console.error(err);
    return json({ ok: false }, 500);
  }
});
