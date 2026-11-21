/* =========================================
   GSRA – Bot-Schutz (Sicherheit Nr. 8): Cloudflare Turnstile bei Anmeldung, Registrierung,
   Passwort-Mail, erneuter Bestätigungs-Mail und beim Löschen des Kontos (Passwort bestätigen).

   Solange SITE_KEY leer ist, ist der Schutz aus: kein Widget, kein Token – alles läuft wie bisher.
   Einschalten in genau dieser Reihenfolge (sonst kann sich niemand mehr anmelden):
     1) Öffentlichen Site-Key aus Cloudflare (beginnt mit „0x“) unten eintragen und veröffentlichen.
     2) Erst danach in Supabase: Authentication → Attack Protection → CAPTCHA einschalten,
        Anbieter Turnstile, dort den GEHEIMEN Schlüssel eintragen.
   Der geheime Schlüssel gehört nur in Supabase – nie in diese Datei, nie in den Chat.
   Hinweis zu Nr. 6 (feste Versionen mit Prüfsumme): Cloudflare erlaubt für Turnstile nur die Original-
   Adresse ohne feste Version. Das Skript wird deshalb nur auf diesen Seiten und erst bei Bedarf geladen.
========================================= */
(function () {
    const SITE_KEY = "0x4AAAAAAGMS_9O4Qo8L3tU3"; // öffentlicher Site-Key aus Cloudflare Turnstile (Widget „GSRA“, 22.11.)

    // Nur auf dem eigenen Rechner (localhost): Test-Schlüssel von Cloudflare zum Ausprobieren,
    // z. B. localStorage.gsra_captcha_test = "1x00000000000000000000AA" (besteht immer)
    let key = SITE_KEY;
    if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        try { key = localStorage.getItem("gsra_captcha_test") || key; } catch (e) { /* ohne Speicher: echter Schlüssel */ }
    }

    const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    let loading = null;
    const load = () => loading || (loading = new Promise((resolve, reject) => {
        if (window.turnstile) return resolve(window.turnstile);
        const script = document.createElement("script");
        script.src = SCRIPT_URL;
        script.async = true;
        script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile fehlt")));
        script.onerror = () => {
            loading = null; // beim nächsten Versuch neu laden
            reject(new Error("Der Bot-Schutz konnte nicht geladen werden."));
        };
        document.head.appendChild(script);
    }));

    // Widget in einen Container setzen. Rückgabe: { token(), reset(), remove() } oder null (Schutz aus)
    async function mount(container) {
        if (!key || !container) return null;
        const ts = await load();
        let current = null;
        let failed = false;
        let waiting = [];
        const settle = (value) => {
            current = value;
            if (value) failed = false;
            waiting.splice(0).forEach(fn => fn(value));
        };
        container.classList.add("gsra-captcha");
        const id = ts.render(container, {
            sitekey: key,
            theme: "dark",
            language: "de",
            appearance: "interaction-only", // sichtbar nur, wenn Cloudflare wirklich nachfragen muss
            callback: (token) => settle(token),
            "expired-callback": () => { current = null; },
            "timeout-callback": () => { current = null; },
            // Prüfung gescheitert (z. B. strenger Tracking-Schutz): Wartende sofort informieren, Cloudflare versucht es erneut
            "error-callback": () => { failed = true; settle(null); }
        });
        return {
            // Wartet auf ein gültiges Token (null, wenn nach der Wartezeit keins da ist)
            // true, wenn Cloudflare den Browser gerade nicht prüfen konnte
            failed: () => failed,
            token(timeoutMs = 45000) {
                if (current) return Promise.resolve(current);
                if (failed) return Promise.resolve(null);
                return new Promise(resolve => {
                    const timer = setTimeout(() => {
                        waiting = waiting.filter(fn => fn !== done);
                        resolve(null);
                    }, timeoutMs);
                    const done = (value) => { clearTimeout(timer); resolve(value); };
                    waiting.push(done);
                });
            },
            // Jedes Token gilt nur für eine Anfrage – danach neu prüfen lassen
            reset() {
                current = null;
                try { ts.reset(id); } catch (e) { /* Widget schon entfernt */ }
            },
            remove() {
                try { ts.remove(id); } catch (e) { /* schon entfernt */ }
            }
        };
    }

    window.gsraCaptcha = { enabled: Boolean(key), mount };
})();
