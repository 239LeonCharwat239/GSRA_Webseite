// GSRA – Supabase Edge Function „coaching-connect“
// Coaches (Pole oder Alliance) richten hier ihr Stripe-Konto für Auszahlungen ein.
// Kontoart wie „Standard“: eigenes Stripe-Dashboard, die Stripe-Gebühren trägt der Coach selbst (Entscheidung 16.11.).
// Aktionen: "onboarding" (Konto anlegen bzw. Einrichtung fortsetzen → Link zu Stripe), "status" (Stand von Stripe holen).
// Benötigte Secrets in Supabase: STRIPE_SECRET_KEY, optional SITE_URL. Stripe Connect muss im Stripe-Dashboard aktiviert sein.
import { createClient } from "jsr:@supabase/supabase-js@2";

// Länder, in denen Coaches ein Stripe-Konto eröffnen können (Auswahl auf der Coaching-Seite)
const COUNTRIES = ["DE", "AT", "CH", "NL", "BE", "LU", "FR", "IT", "ES", "PT", "IE", "PL", "CZ", "DK", "SE", "FI", "NO"];

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
    const stripe = (path: string, init: RequestInit = {}) => fetch(`https://api.stripe.com/v1/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded", ...(init.headers || {}) },
    });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    if (!["onboarding", "status"].includes(action)) return json({ error: "Unbekannte Aktion." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Bitte melde dich an." }, 401);
    const { data: banned } = await admin.rpc("coaching_user_banned", { _user: user.id });
    if (banned) return json({ error: "Dein Konto ist gesperrt." }, 403);

    const { data: existing } = await admin.from("coach_payout_accounts").select("*").eq("user_id", user.id).maybeSingle();

    if (action === "status") {
      if (!existing) return json({ connected: false });
      const res = await stripe(`accounts/${existing.stripe_account_id}`);
      const account = await res.json();
      if (!res.ok) {
        console.error("Stripe-Fehler:", account?.error?.message);
        return json({ connected: true, charges_enabled: existing.charges_enabled, details_submitted: existing.details_submitted });
      }
      const state = { charges_enabled: Boolean(account.charges_enabled), details_submitted: Boolean(account.details_submitted) };
      await admin.from("coach_payout_accounts").update({ ...state, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      return json({ connected: true, ...state });
    }

    // Einrichten: nur mit Pole oder Alliance (wie das Anbieten von Coachings)
    const { data: plan } = await admin.rpc("plan_of", { _user: user.id });
    if (!["pole", "alliance"].includes(plan)) return json({ error: "Coachings anbieten können Mitglieder mit Pole oder Alliance." }, 403);

    let accountId = existing?.stripe_account_id as string | undefined;
    if (!accountId) {
      const country = String(body.country || "DE").toUpperCase();
      if (!COUNTRIES.includes(country)) return json({ error: "Für dieses Land ist die Auszahlung noch nicht möglich." }, 400);
      const params = new URLSearchParams();
      params.set("country", country);
      if (user.email) params.set("email", user.email);
      params.set("controller[fees][payer]", "account");                 // Stripe-Gebühren zahlt der Coach
      params.set("controller[losses][payments]", "stripe");
      params.set("controller[requirement_collection]", "stripe");       // Stripe fragt alle Angaben selbst ab
      params.set("controller[stripe_dashboard][type]", "full");         // eigenes Stripe-Dashboard für den Coach
      params.set("business_profile[product_description]", "Sim-Racing-Coaching über die Global Simracing Alliance (GSRA)");
      params.set("metadata[gsra_user_id]", user.id);
      const res = await stripe("accounts", { method: "POST", body: params, headers: { "Idempotency-Key": `gsra-coach-${user.id}-${country}` } });
      const account = await res.json();
      if (!res.ok) {
        console.error("Stripe-Fehler:", account?.error?.message);
        return json({ error: "Das Stripe-Konto konnte nicht angelegt werden. Bitte versuche es später erneut." }, 502);
      }
      // Bei zwei gleichzeitigen Klicks gilt das zuerst gespeicherte Konto
      await admin.from("coach_payout_accounts").upsert({ user_id: user.id, stripe_account_id: account.id, country }, { onConflict: "user_id", ignoreDuplicates: true });
      const { data: saved } = await admin.from("coach_payout_accounts").select("stripe_account_id").eq("user_id", user.id).maybeSingle();
      accountId = saved?.stripe_account_id || account.id;
    }

    const link = new URLSearchParams();
    link.set("account", accountId!);
    link.set("type", "account_onboarding");
    link.set("refresh_url", `${site}/coaching.html?tab=coach&stripe=neu`);
    link.set("return_url", `${site}/coaching.html?tab=coach&stripe=zurueck`);
    const res = await stripe("account_links", { method: "POST", body: link });
    const accountLink = await res.json();
    if (!res.ok) {
      console.error("Stripe-Fehler:", accountLink?.error?.message);
      return json({ error: "Die Einrichtung bei Stripe konnte nicht geöffnet werden. Bitte versuche es später erneut." }, 502);
    }
    return json({ url: accountLink.url });
  } catch (err) {
    console.error(err);
    return json({ error: "Unerwarteter Fehler bei der Einrichtung." }, 500);
  }
});
