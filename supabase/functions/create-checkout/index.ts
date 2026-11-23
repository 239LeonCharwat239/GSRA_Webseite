// GSRA – Supabase Edge Function „create-checkout“
// Startet eine Stripe-Bezahlseite für Marktplatz-Boni, Abos und Unterstützungen. Die Preise stehen nur hier auf dem
// Server: Der Browser schickt nur, WAS gekauft werden soll (kind, ggf. listing_id), nie einen Betrag. Einzige Ausnahme
// ist die Unterstützung (SQL 043): Dort wählt die Person den Betrag in ganzen Euro, die Grenzen prüft der Server.
// Benötigte Secrets in Supabase: STRIPE_SECRET_KEY (sk_test_… bzw. später sk_live_…), optional SITE_URL.
import { createClient } from "jsr:@supabase/supabase-js@2";

type Product = { name: string; amount: number; mode: "payment" | "subscription" };

const PRODUCTS: Record<string, Product> = {
  highlight: { name: "Hervorheben", amount: 299, mode: "payment" },
  bump: { name: "Hochschieben (automatisch alle 7 Tage)", amount: 399, mode: "payment" },
  top: { name: "Top-Anzeige", amount: 599, mode: "payment" },
  pole: { name: "GSRA Pole", amount: 849, mode: "subscription" },
  alliance: { name: "GSRA Alliance (Team, bis zu 10 Personen)", amount: 3999, mode: "subscription" },
};

const BOOST_COLUMN: Record<string, string> = { highlight: "highlighted", top: "top_ad", bump: "bump_since" };

// Unterstützung (SQL 043): Den Betrag wählt die Person in ganzen Euro, die Grenzen legt nur der Server fest
type Support = { name: string; min: number; max: number; mode: "payment" | "subscription"; kind: "einmalig" | "monatlich" };
const SUPPORT: Record<string, Support> = {
  support_once: { name: "Unterstützung der GSRA", min: 3, max: 500, mode: "payment", kind: "einmalig" },
  support_monthly: { name: "Monatliche Unterstützung der GSRA", min: 2, max: 100, mode: "subscription", kind: "monatlich" },
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Bezahlseite für eine Unterstützung (einmalig oder monatlich). Beträge erscheinen nirgends öffentlich.
async function supportCheckout(req: Request, body: Record<string, unknown>, support: Support, stripeKey: string, site: string) {
  const euro = Number(body.amount_eur);
  if (!Number.isInteger(euro) || euro < support.min || euro > support.max) {
    return json({ error: `Bitte wähle einen ganzen Betrag zwischen ${support.min} € und ${support.max} €.` }, 400);
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "Bitte melde dich an." }, 401);
  const { data: banned } = await admin.from("user_bans").select("id, banned_until, lifted_at").eq("user_id", user.id).is("lifted_at", null);
  if ((banned || []).some((b) => !b.banned_until || new Date(b.banned_until) > new Date())) {
    return json({ error: "Dein Konto ist gesperrt." }, 403);
  }
  // Höchstens eine laufende monatliche Unterstützung pro Person (ändern oder beenden über „Abo verwalten“)
  if (support.mode === "subscription") {
    const { data: current } = await admin.from("supporters").select("monthly_status").eq("user_id", user.id).maybeSingle();
    if (["active", "trialing", "past_due"].includes(current?.monthly_status || "")) {
      return json({ error: "Du unterstützt die GSRA bereits monatlich. Ändern oder beenden kannst du das unter „Abo verwalten“." }, 400);
    }
  }
  const { data: customer } = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();

  const params = new URLSearchParams();
  params.set("mode", support.mode);
  params.set("locale", "de");
  params.set("success_url", `${site}/unterstuetzen.html?unterstuetzung=danke`);
  params.set("cancel_url", `${site}/unterstuetzen.html?unterstuetzung=abbruch`);
  params.set("client_reference_id", user.id);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "eur");
  params.set("line_items[0][price_data][unit_amount]", String(euro * 100));
  params.set("line_items[0][price_data][product_data][name]", support.name);
  params.set("metadata[kind]", "support");
  params.set("metadata[support_kind]", support.kind);
  params.set("metadata[user_id]", user.id);
  if (support.mode === "subscription") {
    params.set("line_items[0][price_data][recurring][interval]", "month");
    params.set("subscription_data[metadata][kind]", "support");
    params.set("subscription_data[metadata][user_id]", user.id);
  } else if (!customer) {
    params.set("customer_creation", "always");
  }
  if (customer?.stripe_customer_id) params.set("customer", customer.stripe_customer_id);
  else if (user.email) params.set("customer_email", user.email);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const session = await res.json();
  if (!res.ok) {
    console.error("Stripe-Fehler:", session?.error?.message);
    return json({ error: "Die Bezahlseite konnte nicht geöffnet werden. Bitte versuche es später erneut." }, 502);
  }
  return json({ url: session.url });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt." }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Die Bezahlung ist noch nicht eingerichtet (STRIPE_SECRET_KEY fehlt)." }, 500);
    const site = (Deno.env.get("SITE_URL") || "https://gsra-webseite.vercel.app").replace(/\/+$/, "");

    // Boni: ein oder mehrere (kinds: ["highlight", "top"]), Abos: genau eines (kind: "pole" | "alliance")
    const body = await req.json().catch(() => ({}));
    const support = SUPPORT[String(body.kind || "")];
    if (support) return await supportCheckout(req, body, support, stripeKey, site);
    const { listing_id } = body;
    const kinds: string[] = Array.isArray(body.kinds) ? [...new Set(body.kinds.map(String))] : [String(body.kind || "")];
    const kind = kinds[0];
    const product = PRODUCTS[kind];
    if (!product || kinds.length === 0 || kinds.length > 3 || kinds.some((k) => !PRODUCTS[k] || PRODUCTS[k].mode !== product.mode)
        || (product.mode === "subscription" && kinds.length !== 1)) {
      return json({ error: "Unbekanntes Produkt." }, 400);
    }
    // Nach dem Abo-Kauf zurück auf die Seite, von der aus gebucht wurde
    const returnPage = body.return_page === "dashboard" ? "dashboard.html" : "abo.html";

    // Angemeldete Person aus dem mitgeschickten Zugangsschlüssel
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Bitte melde dich an." }, 401);

    const { data: banned } = await admin.from("user_bans").select("id, banned_until, lifted_at").eq("user_id", user.id).is("lifted_at", null);
    if ((banned || []).some((b) => !b.banned_until || new Date(b.banned_until) > new Date())) {
      return json({ error: "Dein Konto ist gesperrt." }, 403);
    }

    let successUrl = `${site}/${returnPage}?abo=erfolg`;
    let cancelUrl = `${site}/${returnPage}?abo=abbruch`;
    let title = "";

    if (product.mode === "payment") {
      // Boni nur für eigene, nicht verkaufte Inserate – und jeder Bonus nur einmal (er gilt dauerhaft)
      if (!listing_id) return json({ error: "Kein Inserat angegeben." }, 400);
      const { data: listing } = await admin.from("marketplace").select("*").eq("id", listing_id).maybeSingle();
      if (!listing || String(listing.user_id) !== user.id) return json({ error: "Dieses Inserat gehört nicht dir." }, 403);
      if (listing.status === "verkauft") return json({ error: "Für verkaufte Inserate gibt es keine Boni." }, 400);
      const active = kinds.filter((k) => listing[BOOST_COLUMN[k]]);
      if (active.length) {
        const names = active.map((k) => PRODUCTS[k].name.split(" (")[0]).join(" und ");
        return json({ error: `${names} ${active.length > 1 ? "sind" : "ist"} für das Inserat bereits aktiv.` }, 400);
      }
      title = String(listing.title || "").slice(0, 60);
      successUrl = `${site}/marktplatz.html?inserat=${encodeURIComponent(listing_id)}&zahlung=erfolg`;
      cancelUrl = `${site}/marktplatz.html?inserat=${encodeURIComponent(listing_id)}&zahlung=abbruch`;
    } else {
      // Ein Abo pro Person: wer schon Pole oder Alliance hat, verwaltet es über „Abo verwalten“
      const { data: plan } = await admin.rpc("plan_of", { _user: user.id });
      if (plan && plan !== "paddock") return json({ error: "Du hast bereits ein Abo. Ändern oder kündigen kannst du es unter „Abo verwalten“." }, 400);
    }

    const { data: customer } = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();

    const params = new URLSearchParams();
    params.set("mode", product.mode);
    params.set("locale", "de");
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("client_reference_id", user.id);
    kinds.forEach((k, i) => {
      params.set(`line_items[${i}][quantity]`, "1");
      params.set(`line_items[${i}][price_data][currency]`, "eur");
      params.set(`line_items[${i}][price_data][unit_amount]`, String(PRODUCTS[k].amount));
      params.set(`line_items[${i}][price_data][product_data][name]`, title ? `${PRODUCTS[k].name}: ${title}` : PRODUCTS[k].name);
      if (product.mode === "subscription") params.set(`line_items[${i}][price_data][recurring][interval]`, "month");
    });
    params.set("metadata[kind]", kind);
    params.set("metadata[kinds]", kinds.join(","));
    params.set("metadata[amounts]", kinds.map((k) => PRODUCTS[k].amount).join(","));
    params.set("metadata[user_id]", user.id);
    if (listing_id) params.set("metadata[listing_id]", String(listing_id));
    if (product.mode === "subscription") {
      params.set("subscription_data[metadata][kind]", kind);
      params.set("subscription_data[metadata][user_id]", user.id);
    } else if (!customer) {
      params.set("customer_creation", "always");
    }
    if (customer?.stripe_customer_id) params.set("customer", customer.stripe_customer_id);
    else if (user.email) params.set("customer_email", user.email);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const session = await res.json();
    if (!res.ok) {
      console.error("Stripe-Fehler:", session?.error?.message);
      return json({ error: "Die Bezahlseite konnte nicht geöffnet werden. Bitte versuche es später erneut." }, 502);
    }
    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: "Unerwarteter Fehler bei der Bezahlung." }, 500);
  }
});
