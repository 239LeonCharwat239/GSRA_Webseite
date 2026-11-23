// GSRA – Supabase Edge Function „geraete-hinweise“ (SQL 042)
// Schickt eine E-Mail, wenn sich jemand mit einem neuen Gerät bei einem GSRA-Konto angemeldet hat.
// Welche Anmeldungen neu sind, entscheidet die Datenbank selbst (device_alert_run liest auth.sessions); jeder Hinweis
// wird genau einmal vermerkt und verschickt, höchstens ein Lauf pro Minute, höchstens 3 E-Mails pro Konto und Stunde.
// Aufruf alle 5 Minuten durch den Zeitplan in der Datenbank (pg_cron + pg_net) mit dem öffentlichen Schlüssel der
// Webseite. „Verify JWT“ bleibt an. Die Funktion gibt keine Daten zurück – egal, wer sie wie oft aufruft.
// Benötigte Secrets (wie bei coaching-reminders): SMTP_USER und SMTP_PASS, optional SMTP_HOST, SMTP_PORT, SITE_URL.
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Hinweis = { id: number; user_id: string; geraet: string; netz: string | null; zeit: string; name: string };

// „Mo., 23.11.2026 um 14:05 Uhr“ (deutsche Zeit)
const wann = (iso: string) => {
  const d = new Date(iso);
  const tag = d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  const zeit = d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  return `${tag} um ${zeit} Uhr`;
};

function mail(h: Hinweis, site: string) {
  const zeilen = [
    `Hallo ${h.name},`,
    "",
    "bei deinem GSRA-Konto hat sich gerade jemand mit einem Gerät angemeldet, das wir bisher nicht von dir kennen:",
    "",
    `Gerät: ${h.geraet}`,
    `Zeitpunkt: ${wann(h.zeit)} (deutsche Zeit)`,
    h.netz ? `Netzwerk: ${h.netz}` : "",
    "",
    "Warst du das? Dann ist alles in Ordnung und du musst nichts weiter tun.",
    "",
    "Warst du das nicht? Dann handle bitte sofort:",
    `1. Lege ein neues Passwort fest: ${site}/login.html (dort „Passwort vergessen“ wählen).`,
    `2. Melde dich im Dashboard mit „Überall abmelden“ auf allen Geräten ab: ${site}/dashboard.html`,
    "3. Schalte im Dashboard die Zwei-Faktor-Anmeldung ein, falls sie noch nicht aktiv ist.",
    "",
    "Hinweis: Als neues Gerät gilt auch ein anderer Browser oder ein anderes Betriebssystem auf demselben Rechner.",
    "Diese E-Mail ist ein Sicherheitshinweis und lässt sich deshalb nicht abbestellen.",
    "",
    "Dein GSRA-Team",
    "Global Simracing Alliance",
  ].filter((zeile, i, alle) => zeile !== "" || alle[i - 1] !== "");
  return { subject: "Neue Anmeldung bei deinem GSRA-Konto", text: zeilen.join("\n") };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt." }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.rpc("device_alert_run");
    if (error) {
      console.error("Geräte-Hinweise:", error.message);
      return json({ ok: false }, 500);
    }
    const hinweise: Hinweis[] = data?.hinweise || [];
    if (!data?.lauf || !hinweise.length) return json({ ok: true, gesendet: 0 });

    const user = Deno.env.get("SMTP_USER");
    const pass = Deno.env.get("SMTP_PASS");
    if (!user || !pass) {
      console.error("Geräte-Hinweise: SMTP_USER/SMTP_PASS fehlen – nichts verschickt.");
      return json({ ok: false, gesendet: 0 }, 500);
    }
    const port = Number(Deno.env.get("SMTP_PORT") || 465);
    const transporter = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST") || "smtp.gmail.com", port, secure: port === 465, auth: { user, pass },
    });
    const site = (Deno.env.get("SITE_URL") || "https://gsra-webseite.vercel.app").replace(/\/+$/, "");

    let gesendet = 0;
    for (const h of hinweise) {
      try {
        const to = (await admin.auth.admin.getUserById(h.user_id)).data?.user?.email;
        if (!to) continue;
        const { subject, text } = mail(h, site);
        await transporter.sendMail({ from: `"GSRA Sicherheit" <${user}>`, to, subject, text });
        gesendet++;
      } catch (err) {
        // Vermerkt ist der Hinweis schon: lieber einer verpasst als doppelt verschickt
        console.error(`Geräte-Hinweis ${h.id} nicht verschickt:`, err);
      }
    }
    return json({ ok: true, gesendet });
  } catch (err) {
    console.error(err);
    return json({ ok: false }, 500);
  }
});
