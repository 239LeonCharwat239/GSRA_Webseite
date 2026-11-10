// GSRA – Supabase Edge Function „billing-portal“
// Öffnet das Stripe-Kundenportal: Abo kündigen, Zahlungsart ändern, Rechnungen herunterladen.
// Benötigte Secrets in Supabase: STRIPE_SECRET_KEY, optional SITE_URL.
// Voraussetzung in Stripe: Einstellungen → Billing → Kundenportal einmal speichern (auch im Testmodus).
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt." }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Die Bezahlung ist noch nicht eingerichtet (STRIPE_SECRET_KEY fehlt)." }, 500);
    const site = (Deno.env.get("SITE_URL") || "https://gsra-webseite.vercel.app").replace(/\/+$/, "");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Bitte melde dich an." }, 401);

    const { data: customer } = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (!customer?.stripe_customer_id) return json({ error: "Zu deinem Konto gibt es noch keine Zahlungen." }, 404);

    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ customer: customer.stripe_customer_id, return_url: `${site}/abo.html`, locale: "de" }),
    });
    const portal = await res.json();
    if (!res.ok) {
      console.error("Stripe-Fehler:", portal?.error?.message);
      return json({ error: "Die Abo-Verwaltung konnte nicht geöffnet werden. Ist das Kundenportal in Stripe gespeichert?" }, 502);
    }
    return json({ url: portal.url });
  } catch (err) {
    console.error(err);
    return json({ error: "Unerwarteter Fehler." }, 500);
  }
});
