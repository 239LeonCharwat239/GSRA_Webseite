// GSRA – Supabase Edge Function „cancel-contract“ („Verträge hier kündigen“, § 312k BGB)
// Nimmt Kündigungen auch ohne Anmeldung an, merkt sie bei Stripe zum Ende der Laufzeit vor, hält sie mit
// Eingangszeitpunkt in der Tabelle „cancellations“ fest und schickt eine Eingangsbestätigung per E-Mail.
// Benötigte Secrets: STRIPE_SECRET_KEY, SMTP_USER und SMTP_PASS (z. B. Gmail-Adresse und App-Passwort),
// optional SMTP_HOST (Standard smtp.gmail.com) und SMTP_PORT (Standard 465 – Port 587 ist bei Supabase gesperrt).
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const CONTRACTS: Record<string, string> = {
  pole: "GSRA Pole (8,49 € pro Monat)",
  alliance: "GSRA Alliance (39,99 € pro Monat)",
};
const KINDS: Record<string, string> = {
  ordentlich: "Ordentliche Kündigung",
  ausserordentlich: "Außerordentliche Kündigung",
};
const ACTIVE = ["active", "trialing", "past_due"];

const berlin = (date: Date, withTime = true) =>
  date.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

async function sendMail(to: string[], subject: string, text: string): Promise<boolean> {
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass || to.length === 0) return false;
  try {
    const port = Number(Deno.env.get("SMTP_PORT") || 465);
    const transporter = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST") || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({ from: `"GSRA" <${user}>`, to: to.join(", "), subject, text });
    return true;
  } catch (err) {
    console.error("E-Mail-Versand fehlgeschlagen:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim().slice(0, 120);
    const email = String(body.email || "").trim().slice(0, 200);
    const accountHint = String(body.account_hint || "").trim().slice(0, 120) || null;
    const contract = String(body.contract || "");
    const kind = String(body.kind || "ordentlich");
    const reason = String(body.reason || "").trim().slice(0, 2000) || null;
    const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? String(body.date) : null;

    if (!name) return json({ error: "Bitte gib deinen Namen an." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Bitte gib eine gültige E-Mail-Adresse an." }, 400);
    if (!CONTRACTS[contract]) return json({ error: "Bitte wähle den Vertrag aus, den du kündigen möchtest." }, 400);
    if (!KINDS[kind]) return json({ error: "Bitte wähle die Art der Kündigung." }, 400);
    if (kind === "ausserordentlich" && !reason) return json({ error: "Bitte nenne den Grund für die außerordentliche Kündigung." }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Schutz vor Massenanfragen: höchstens 5 Kündigungen pro E-Mail-Adresse und Stunde
    const { count } = await db.from("cancellations").select("id", { count: "exact", head: true })
      .ilike("email", email).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count || 0) >= 5) return json({ error: "Zu dieser E-Mail-Adresse sind gerade mehrere Kündigungen eingegangen. Bitte versuche es später erneut." }, 429);

    // Konto bestimmen: angemeldet → aus dem Zugangsschlüssel, sonst über die E-Mail-Adresse des Kontos
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await db.auth.getUser(token).catch(() => ({ data: { user: null } }));
    let userId: string | null = auth?.user?.id ?? null;
    let accountEmail: string | null = auth?.user?.email ?? null;
    if (!userId) {
      const { data: found } = await db.rpc("cancellation_user_by_email", { _email: email });
      userId = found || null;
      accountEmail = found ? email : null;
    }

    // Laufenden Vertrag suchen
    let subscriptionId: string | null = null;
    let periodEnd: string | null = null;
    let memberOnly = false;
    if (userId && contract === "pole") {
      const { data } = await db.from("user_plans").select("stripe_subscription_id, status, current_period_end").eq("user_id", userId).maybeSingle();
      if (data && ACTIVE.includes(data.status)) ({ stripe_subscription_id: subscriptionId, current_period_end: periodEnd } = data);
    } else if (userId && contract === "alliance") {
      const { data } = await db.from("teams").select("stripe_subscription_id, status, current_period_end").eq("owner_id", userId)
        .in("status", ACTIVE).maybeSingle();
      if (data) ({ stripe_subscription_id: subscriptionId, current_period_end: periodEnd } = data);
      else {
        const { data: membership } = await db.from("team_members").select("team_id").eq("user_id", userId).maybeSingle();
        memberOnly = Boolean(membership);
      }
    }

    // Bei Stripe zum Ende der Laufzeit (bzw. zum Wunschtermin, wenn er später liegt) vormerken
    let status = subscriptionId ? "vorgemerkt" : "kein_vertrag";
    let effectiveAt: string | null = null;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (subscriptionId && stripeKey) {
      const params = new URLSearchParams();
      const wish = requestedDate ? new Date(`${requestedDate}T23:59:59+01:00`) : null;
      if (wish && periodEnd && wish.getTime() > new Date(periodEnd).getTime()) params.set("cancel_at", String(Math.floor(wish.getTime() / 1000)));
      else params.set("cancel_at_period_end", "true");
      params.set("cancellation_details[comment]", `Kündigung über „Verträge hier kündigen“ (${KINDS[kind]})`);
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      const sub = await res.json();
      if (res.ok) {
        const seconds = sub.cancel_at ?? sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
        effectiveAt = seconds ? new Date(seconds * 1000).toISOString() : periodEnd;
        if (kind === "ausserordentlich") status = "pruefung";
      } else {
        console.error("Stripe-Fehler:", sub?.error?.message);
        status = "fehler";
      }
    } else if (subscriptionId) {
      status = "fehler";
    }

    // Festhalten (Eingangszeitpunkt und Referenznummer)
    const receivedAt = new Date();
    const reference = `K-${receivedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const { error: insertError } = await db.from("cancellations").insert({
      reference, created_at: receivedAt.toISOString(), user_id: userId, name, email, account_hint: accountHint,
      contract, kind, reason, requested_date: requestedDate, status, effective_at: effectiveAt, stripe_subscription_id: subscriptionId,
    });
    if (insertError) {
      console.error(insertError);
      return json({ error: "Die Kündigung konnte nicht gespeichert werden. Bitte versuche es erneut oder schreib uns." }, 500);
    }

    // Eingangsbestätigung per E-Mail (an die angegebene Adresse und – falls anders – an die Adresse des Kontos)
    const effectiveText = effectiveAt
      ? `Dein Vertrag endet zum ${berlin(new Date(effectiveAt), false)}. Bis dahin kannst du alle Vorteile weiter nutzen.`
      : memberOnly
        ? "Du bist Mitglied eines Alliance-Teams – gekündigt wird von der Teamleitung. Du kannst das Team jederzeit auf der Abo-Seite verlassen."
        : "Zu deinen Angaben haben wir keinen laufenden Vertrag gefunden. Das GSRA-Team prüft deine Kündigung und meldet sich bei dir.";
    const lines = [
      `Hallo ${name},`,
      "",
      `wir haben deine Kündigung am ${berlin(receivedAt)} Uhr erhalten.`,
      "",
      `Vertrag: ${CONTRACTS[contract]}`,
      `Art: ${KINDS[kind]}${reason ? ` (Grund: ${reason})` : ""}`,
      `Gewünschter Zeitpunkt: ${requestedDate ? `zum ${berlin(new Date(`${requestedDate}T12:00:00Z`), false)}` : "zum nächstmöglichen Zeitpunkt"}`,
      `Referenznummer: ${reference}`,
      "",
      effectiveText,
      kind === "ausserordentlich" ? "Deine außerordentliche Kündigung prüfen wir zusätzlich und melden uns dazu bei dir." : "",
      "",
      "Falls du diese Kündigung nicht selbst abgeschickt hast, antworte bitte auf diese E-Mail.",
      "",
      "Viele Grüße",
      "Global Simracing Alliance",
    ].filter((line, i, all) => line !== "" || all[i - 1] !== "");
    const recipients = [...new Set([email, accountEmail].filter(Boolean).map((a) => String(a).toLowerCase()))];
    const emailSent = await sendMail(recipients, `Eingangsbestätigung deiner Kündigung (${reference})`, lines.join("\n"));
    if (emailSent) await db.from("cancellations").update({ email_sent: true }).eq("reference", reference);

    return json({
      reference,
      received_at: receivedAt.toISOString(),
      contract: CONTRACTS[contract],
      kind: KINDS[kind],
      requested_date: requestedDate,
      effective_at: effectiveAt,
      status,
      member_only: memberOnly,
      email_sent: emailSent,
      email,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Unerwarteter Fehler. Bitte versuche es erneut." }, 500);
  }
});
