// GSRA – Supabase Edge Function „coaching-refund“
// Storniert ein bezahltes Coaching und erstattet den vollen Betrag (inkl. Servicegebühr).
// Regeln (Entscheidung 16.11., geprüft in der Datenbank: coaching_refund_info):
//   Käufer bis 24 Stunden vor dem Termin, der Coach jederzeit vor „erledigt“.
// Die Erstattung läuft auf dem Stripe-Konto des Coaches (Direct Charge). Ein fester Idempotency-Key
// verhindert doppelte Erstattungen, auch bei Doppelklick. Benötigte Secrets: STRIPE_SECRET_KEY.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const readable = (msg = "") => (/[äöüß]|Bitte|Coach|Termin|Anfrage|Konto|Erstatt/.test(msg) && msg.length < 200 ? msg : null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt." }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Die Bezahlung ist noch nicht eingerichtet (STRIPE_SECRET_KEY fehlt)." }, 500);

    const body = await req.json().catch(() => ({}));
    const bookingId = String(body.booking_id || "");
    if (!UUID.test(bookingId)) return json({ error: "Keine gültige Anfrage angegeben." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Bitte melde dich an." }, 401);

    const { data: info, error: infoError } = await admin.rpc("coaching_refund_info", { _booking_id: bookingId, _user: user.id });
    if (infoError || !info) return json({ error: readable(infoError?.message) || "Dieses Coaching lässt sich nicht erstatten." }, 400);
    if (!info.stripe_account_id) return json({ error: "Das Stripe-Konto des Coaches wurde nicht gefunden. Bitte wende dich an die GSRA." }, 409);

    const params = new URLSearchParams();
    params.set("payment_intent", String(info.payment_intent));
    params.set("reason", "requested_by_customer");
    if (Number(info.fee_cents) > 0) params.set("refund_application_fee", "true");   // Servicegebühr geht mit zurück
    params.set("metadata[booking_id]", bookingId);
    params.set("metadata[storniert_von]", String(info.by));
    const res = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Account": String(info.stripe_account_id), "Idempotency-Key": `gsra-coaching-refund-${bookingId}`,
      },
      body: params,
    });
    const refund = await res.json();
    const alreadyRefunded = refund?.error?.code === "charge_already_refunded";
    if (!res.ok && !alreadyRefunded) {
      console.error("Stripe-Fehler:", refund?.error?.message);
      return json({ error: "Die Erstattung hat bei Stripe nicht geklappt. Bitte versuche es später erneut." }, 502);
    }
    const { error } = await admin.rpc("coaching_mark_refunded", { _payment_intent: info.payment_intent, _by: user.id });
    if (error) console.error("Verbuchen fehlgeschlagen (der Webhook holt es nach):", error.message);
    return json({ ok: true, status: refund?.status || "succeeded" });
  } catch (err) {
    console.error(err);
    return json({ error: "Unerwarteter Fehler bei der Erstattung." }, 500);
  }
});
