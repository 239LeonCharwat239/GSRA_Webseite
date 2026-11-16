// GSRA – Supabase Edge Function „coaching-checkout“
// Startet die Stripe-Bezahlseite für ein angenommenes Coaching. Bezahlt wird direkt an das Stripe-Konto des
// Coaches (Direct Charge); die GSRA erhält nur die Servicegebühr von Paddock-Käufern (application_fee).
// Betrag, Gebühr und Konto kommen aus der Datenbank (coaching_checkout_info) – der Browser schickt nur die Anfrage-ID.
// Benötigte Secrets in Supabase: STRIPE_SECRET_KEY, optional SITE_URL.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Meldungen der Datenbank (deutsch, für Menschen) weitergeben, technische nicht
const readable = (msg = "") => (/[äöüß]|Bitte|Coach|Termin|Anfrage|Konto/.test(msg) && msg.length < 200 ? msg : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt." }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Die Bezahlung ist noch nicht eingerichtet (STRIPE_SECRET_KEY fehlt)." }, 500);
    const site = (Deno.env.get("SITE_URL") || "https://gsra-webseite.vercel.app").replace(/\/+$/, "");

    const body = await req.json().catch(() => ({}));
    const bookingId = String(body.booking_id || "");
    if (!UUID.test(bookingId)) return json({ error: "Keine gültige Anfrage angegeben." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Bitte melde dich an." }, 401);

    // Prüft Käufer, Status, Termin, Sperre und ob der Coach Zahlungen annehmen kann
    const { data: info, error: infoError } = await admin.rpc("coaching_checkout_info", { _booking_id: bookingId, _user: user.id });
    if (infoError || !info) return json({ error: readable(infoError?.message) || "Diese Anfrage kann gerade nicht bezahlt werden." }, 400);
    const account = String(info.stripe_account_id);
    const onAccount = { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Account": account };

    // Eine noch offene Bezahlseite (z. B. nach versehentlichem Schließen) wiederverwenden statt neu anlegen
    // Ältere, nicht mehr genutzte Bezahlseite schließen: Als bezahlt zählt nur die zuletzt angelegte
    if (info.stripe_session_id) {
      const fresh = info.checkout_started_at && Date.now() - new Date(info.checkout_started_at).getTime() < 25 * 60 * 1000;
      const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${info.stripe_session_id}`, { headers: onAccount });
      const open = await res.json();
      if (res.ok && open.status === "open") {
        if (fresh && open.url) return json({ url: open.url });
        await fetch(`https://api.stripe.com/v1/checkout/sessions/${info.stripe_session_id}/expire`, { method: "POST", headers: onAccount });
      }
    }

    const when = new Date(info.scheduled_at).toLocaleString("de-DE", {
      timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const minutes = Number(info.duration_minutes) || 0;
    const duration = minutes % 60 ? `${minutes} Minuten` : `${minutes / 60} ${minutes === 60 ? "Stunde" : "Stunden"}`;
    const description = `${duration} mit ${info.coach_name || "deinem Coach"} am ${when} Uhr` +
      (Number(info.fee_cents) > 0 ? " · inkl. 10 % GSRA-Servicegebühr" : "");

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("locale", "de");
    params.set("success_url", `${site}/coaching.html?tab=anfragen&zahlung=erfolg`);
    params.set("cancel_url", `${site}/coaching.html?tab=anfragen&zahlung=abbruch`);
    params.set("client_reference_id", user.id);
    params.set("expires_at", String(Math.floor(Date.now() / 1000) + 31 * 60));   // Stripe: mindestens 30 Minuten
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "eur");
    params.set("line_items[0][price_data][unit_amount]", String(info.total_cents));
    params.set("line_items[0][price_data][product_data][name]", `Coaching: ${String(info.title).slice(0, 200)}`);
    params.set("line_items[0][price_data][product_data][description]", description.slice(0, 500));
    if (Number(info.fee_cents) > 0) params.set("payment_intent_data[application_fee_amount]", String(info.fee_cents));
    params.set("payment_intent_data[description]", `GSRA-Coaching ${bookingId}`);
    params.set("payment_intent_data[metadata][booking_id]", bookingId);
    params.set("metadata[kind]", "coaching");
    params.set("metadata[booking_id]", bookingId);
    params.set("metadata[user_id]", user.id);
    if (user.email) params.set("customer_email", user.email);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: onAccount, body: params });
    const session = await res.json();
    if (!res.ok) {
      console.error("Stripe-Fehler:", session?.error?.message);
      return json({ error: "Die Bezahlseite konnte nicht geöffnet werden. Bitte versuche es später erneut." }, 502);
    }
    await admin.rpc("coaching_checkout_started", { _booking_id: bookingId, _session_id: session.id });
    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: "Unerwarteter Fehler bei der Bezahlung." }, 500);
  }
});
