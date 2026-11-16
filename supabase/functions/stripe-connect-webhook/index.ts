// GSRA – Supabase Edge Function „stripe-connect-webhook“
// Stripe meldet hier Ereignisse auf den Stripe-Konten der Coaches (Connect): bezahlte Coachings, Erstattungen
// und den Stand der Konto-Einrichtung. Jede Meldung wird mit dem eigenen Signaturschlüssel geprüft.
// Benötigte Secrets: STRIPE_SECRET_KEY, STRIPE_CONNECT_WEBHOOK_SECRET (whsec_… des Connect-Webhooks).
// Wichtig: Bei dieser Funktion „Verify JWT“ ausschalten – Stripe schickt keinen Supabase-Schlüssel mit.
// Im Stripe-Dashboard als Webhook für „Ereignisse auf verbundenen Konten“ anlegen mit:
//   checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded,
//   account.updated, account.application.deauthorized
import { createClient } from "jsr:@supabase/supabase-js@2";

const encoder = new TextEncoder();

// Stripe-Signatur prüfen (Kopfzeile „t=…,v1=…“, HMAC-SHA256 über „t.Nachricht“, höchstens 5 Minuten alt)
async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2)).filter((p) => p.length === 2));
  const timestamp = Number(parts.t);
  const signatures = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((sig) => sig.length === expected.length &&
    [...sig].reduce((diff, ch, i) => diff | (ch.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Nur POST erlaubt.", { status: 405 });

  const payload = await req.text();
  const secret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET") || "";
  const valid = secret && await verifyStripeSignature(payload, req.headers.get("Stripe-Signature") || "", secret);
  if (!valid) return new Response("Ungültige Signatur.", { status: 400 });

  const event = JSON.parse(payload);
  const account: string = event.account || "";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const onAccount = { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Account": account };

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.metadata?.kind !== "coaching" || !account) break;
        if (!/^[0-9a-f-]{36}$/i.test(String(session.metadata.booking_id || ""))) break;
        if (session.payment_status !== "paid") break; // z. B. Lastschrift noch offen → kommt als async_payment_succeeded
        const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
        if (!paymentIntent) break;
        const { data: result, error } = await db.rpc("coaching_mark_paid", {
          _booking_id: session.metadata.booking_id, _session_id: session.id, _payment_intent: paymentIntent,
          _amount_total: session.amount_total, _account: account,
        });
        if (error) throw new Error(error.message);
        // Anfrage inzwischen storniert, Betrag oder Konto passt nicht: sofort alles zurückzahlen
        if (result === "erstatten" && stripeKey) {
          const pi = await (await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntent}`, { headers: onAccount })).json();
          const params = new URLSearchParams();
          params.set("payment_intent", paymentIntent);
          if (Number(pi?.application_fee_amount) > 0) params.set("refund_application_fee", "true");
          params.set("metadata[grund]", "Anfrage nicht mehr offen oder Angaben passen nicht");
          const res = await fetch("https://api.stripe.com/v1/refunds", {
            method: "POST", body: params,
            headers: { ...onAccount, "Idempotency-Key": `gsra-coaching-autorefund-${paymentIntent}` },
          });
          const refund = await res.json();
          if (!res.ok && refund?.error?.code !== "charge_already_refunded") throw new Error(refund?.error?.message || "Erstattung fehlgeschlagen");
        }
        break;
      }
      case "charge.refunded": {
        // Auch Erstattungen, die der Coach selbst im Stripe-Dashboard auslöst (nur vollständige)
        const charge = event.data.object;
        const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (charge.refunded && paymentIntent) {
          const { error } = await db.rpc("coaching_mark_refunded", { _payment_intent: paymentIntent, _by: null });
          if (error) throw new Error(error.message);
        }
        break;
      }
      case "account.updated": {
        const acct = event.data.object;
        const { error } = await db.from("coach_payout_accounts")
          .update({ charges_enabled: Boolean(acct.charges_enabled), details_submitted: Boolean(acct.details_submitted), updated_at: new Date().toISOString() })
          .eq("stripe_account_id", acct.id);
        if (error) throw new Error(error.message);
        break;
      }
      case "account.application.deauthorized": {
        // Coach hat die Verbindung zur GSRA in Stripe getrennt: keine neuen Zahlungen mehr
        if (account) {
          const { error } = await db.from("coach_payout_accounts").update({ charges_enabled: false, updated_at: new Date().toISOString() }).eq("stripe_account_id", account);
          if (error) throw new Error(error.message);
        }
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Webhook-Fehler:", err);
    // 500 → Stripe versucht es später erneut (doppelte Meldungen verbucht die Datenbank nur einmal)
    return new Response("Fehler bei der Verarbeitung.", { status: 500 });
  }
});
