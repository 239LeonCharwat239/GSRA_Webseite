// GSRA – Supabase Edge Function „coaching-connect“
// Coaches mit GSRA-Coach-Lizenz richten hier ihr Stripe-Konto für Auszahlungen ein.
// Kontoart wie „Standard“: eigenes Stripe-Dashboard, die Stripe-Gebühren trägt der Coach selbst (Entscheidung 16.11.).
// Seit 17.11. über Stripes Accounts v2 (für neue Plattformen vorgeschrieben); Status, Bezahlen und Erstatten
// nutzen weiter die v1-Schnittstellen, die laut Stripe mit v2-Konten funktionieren.
// Aktionen: "onboarding" (Konto anlegen bzw. Einrichtung fortsetzen → Link zu Stripe), "status" (Stand von Stripe holen).
// Seit 19.11.: Coaches wählen „Privatperson“ (Standard) oder „mit Gewerbe/Firma“; als Privatperson füllt die GSRA
// die Kontoart und eine Leistungsbeschreibung vor, damit Stripe keine Fragen zu einem Unternehmen stellt.
// Benötigte Secrets in Supabase: STRIPE_SECRET_KEY, optional SITE_URL. Stripe Connect muss im Stripe-Dashboard aktiviert sein.
import { createClient } from "jsr:@supabase/supabase-js@2";

// Länder, in denen Coaches ein Stripe-Konto eröffnen können (Auswahl auf der Coaching-Seite)
const COUNTRIES = ["DE", "AT", "CH", "NL", "BE", "LU", "FR", "IT", "ES", "PT", "IE", "PL", "CZ", "DK", "SE", "FI", "NO"];
// Sprache der Stripe-Einrichtung und der E-Mails von Stripe je Land
const LOCALES: Record<string, string> = {
  DE: "de", AT: "de", CH: "de", LU: "de", NL: "nl", BE: "nl", FR: "fr", IT: "it", ES: "es", PT: "pt", IE: "en",
  PL: "pl", CZ: "cs", DK: "da", SE: "sv", FI: "fi", NO: "nb",
};
// Vorausgefüllt, damit Stripe weniger fragt (die Angabe nutzt Stripe nur intern zur Risikoprüfung)
const PRODUCT_DESCRIPTION = "Sim-Racing-Coaching: Online-Fahrtraining, Setup-Beratung und Rennstrategie für einzelne Kunden, " +
  "gebucht über die Community-Plattform GSRA (Global Simracing Alliance). Feste Termine, Bezahlung vor dem Coaching.";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
// Grund von Stripe an die Meldung hängen (enthält keine Schlüssel), damit Fehler sofort erkennbar sind
const stripeReason = (result: any) => {
  const msg = String(result?.error?.message || "").replace(/\s+/g, " ").trim().slice(0, 240);
  return msg ? ` Stripe meldet: ${msg}` : "";
};

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
    // Stripe-API v2 (JSON, feste Version laut Stripe-Referenz); Konten und Einrichtungsseiten laufen hierüber
    const stripeV2 = (path: string, body: unknown, idempotencyKey?: string) => fetch(`https://api.stripe.com/v2/core/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/json", "Stripe-Version": "2026-10-28.endive",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
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

    // Einrichten: nur mit aktiver GSRA-Coach-Lizenz (wie das Anbieten von Coachings, siehe SQL 026)
    const { data: licensed } = await admin.rpc("coach_license_active", { _user: user.id });
    if (licensed !== true) return json({ error: "Auszahlungen einrichten können Mitglieder mit GSRA-Coach-Lizenz." }, 403);

    // Privatperson (Standard): Stripe überspringt alle Fragen zu Firma und Gewerbe.
    // Mit Gewerbe oder Firma fragt Stripe die Unternehmensart selbst ab.
    const privat = String(body.kind || "privat") !== "gewerblich";

    let accountId = existing?.stripe_account_id as string | undefined;
    if (accountId && privat && !existing?.details_submitted) {
      // Einrichtung angefangen, aber noch nicht abgeschickt: als Privatperson vorausfüllen (wenn Stripe es noch zulässt)
      const res = await stripeV2(`accounts/${accountId}`, {
        identity: { entity_type: "individual" },
        defaults: { profile: { product_description: PRODUCT_DESCRIPTION } },
      });
      if (!res.ok) console.error("Stripe (Vorausfüllen übersprungen):", (await res.json().catch(() => ({})))?.error?.message);
    }
    if (!accountId) {
      const country = String(body.country || "DE").toUpperCase();
      if (!COUNTRIES.includes(country)) return json({ error: "Für dieses Land ist die Auszahlung noch nicht möglich." }, 400);
      // Accounts v2 (Stripe legt neue Plattformen darauf fest; v1 ist für neue Konten gesperrt).
      // fees_collector "stripe": Stripe zieht die Zahlungsgebühr direkt beim Coach ab (Entscheidung 16.11.),
      // losses_collector "stripe": Stripe haftet für negative Salden, dashboard "full": eigenes Stripe-Dashboard.
      // Name, Geburtsdatum, Adresse, Bankverbindung und Ausweis fragt Stripe selbst ab (gesetzlich vorgeschrieben).
      const { data: profile } = await admin.from("profiles").select("username").eq("id", user.id).maybeSingle();
      const res = await stripeV2("accounts", {
        ...(user.email ? { contact_email: user.email } : {}),
        display_name: String(profile?.username || "GSRA-Coach").slice(0, 100),
        identity: { country: country.toLowerCase(), ...(privat ? { entity_type: "individual" } : {}) },
        configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
        defaults: {
          responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
          profile: { product_description: PRODUCT_DESCRIPTION },
          ...(LOCALES[country] ? { locales: [LOCALES[country]] } : {}),
        },
        dashboard: "full",
        metadata: { gsra_user_id: user.id },
      }, `gsra-coach-v2b-${user.id}-${country}-${privat ? "privat" : "gewerblich"}`);
      const account = await res.json();
      if (!res.ok) {
        console.error("Stripe-Fehler:", account?.error?.message);
        return json({ error: `Das Stripe-Konto konnte nicht angelegt werden.${stripeReason(account)}` }, 502);
      }
      // Bei zwei gleichzeitigen Klicks gilt das zuerst gespeicherte Konto
      await admin.from("coach_payout_accounts").upsert({ user_id: user.id, stripe_account_id: account.id, country }, { onConflict: "user_id", ignoreDuplicates: true });
      const { data: saved } = await admin.from("coach_payout_accounts").select("stripe_account_id").eq("user_id", user.id).maybeSingle();
      accountId = saved?.stripe_account_id || account.id;
    }

    // Einrichtungsseite von Stripe (Accounts v2)
    const res = await stripeV2("account_links", {
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          refresh_url: `${site}/coaching.html?tab=coach&stripe=neu`,
          return_url: `${site}/coaching.html?tab=coach&stripe=zurueck`,
        },
      },
    });
    const accountLink = await res.json();
    if (!res.ok) {
      console.error("Stripe-Fehler:", accountLink?.error?.message);
      return json({ error: `Die Einrichtung bei Stripe konnte nicht geöffnet werden.${stripeReason(accountLink)}` }, 502);
    }
    return json({ url: accountLink.url });
  } catch (err) {
    console.error(err);
    return json({ error: "Unerwarteter Fehler bei der Einrichtung." }, 500);
  }
});
