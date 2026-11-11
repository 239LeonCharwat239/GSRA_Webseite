// GSRA – Supabase Edge Function „stripe-webhook“
// Stripe meldet hier abgeschlossene Zahlungen und Änderungen an Abos. Jede Meldung wird mit dem
// Webhook-Signaturschlüssel geprüft; erst dann werden Boni bzw. Abos in der Datenbank eingetragen.
// Benötigte Secrets in Supabase: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (whsec_…).
// Wichtig: Bei dieser Funktion „Verify JWT“ ausschalten – Stripe schickt keinen Supabase-Schlüssel mit.
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

// Ende der aktuellen Abrechnungsperiode (neuere Stripe-Versionen führen sie pro Abo-Position)
function periodEnd(sub: Record<string, any>): string | null {
  const seconds = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Nur POST erlaubt.", { status: 405 });

  const payload = await req.text();
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  const valid = secret && await verifyStripeSignature(payload, req.headers.get("Stripe-Signature") || "", secret);
  if (!valid) return new Response("Ungültige Signatur.", { status: 400 });

  const event = JSON.parse(payload);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

  const syncSubscription = async (sub: Record<string, any>) => {
    const kind = sub.metadata?.kind;
    const user = sub.metadata?.user_id;
    if (!["pole", "alliance"].includes(kind) || !user) return;
    const { error } = await db.rpc("stripe_sync_subscription", {
      _subscription_id: sub.id,
      _kind: kind,
      _user: user,
      _customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
      _status: sub.status,
      _period_end: periodEnd(sub),
      _cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    });
    if (error) throw new Error(error.message);
  };

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        const kind = session.metadata?.kind;
        const user = session.metadata?.user_id;
        if (!kind || !user) break;
        if (session.mode === "payment" && session.payment_status !== "paid") break; // z. B. Lastschrift noch offen
        // Mehrere Boni in einer Zahlung: jeder Bonus wird einzeln verbucht (Beträge hat create-checkout mitgegeben)
        const kinds = String(session.metadata?.kinds || kind).split(",").filter(Boolean);
        const amounts = String(session.metadata?.amounts || "").split(",").map((a) => Number(a) || null);
        for (const [i, k] of kinds.entries()) {
          const { error } = await db.rpc("stripe_apply_payment", {
            _session_id: session.id,
            _kind: k,
            _user: user,
            _listing_id: session.metadata?.listing_id ?? null,
            _amount_cents: kinds.length === 1 ? (session.amount_total ?? null) : amounts[i],
            _currency: session.currency ?? null,
            _customer_id: session.customer ?? null,
          });
          if (error) throw new Error(error.message);
        }
        // Abo: aktuellen Stand direkt von Stripe holen und eintragen
        if (session.mode === "subscription" && session.subscription && stripeKey) {
          const res = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
          if (res.ok) await syncSubscription(await res.json());
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Webhook-Fehler:", err);
    // 500 → Stripe versucht es später erneut (doppelte Meldungen verbucht die Datenbank nur einmal)
    return new Response("Fehler bei der Verarbeitung.", { status: 500 });
  }
});
