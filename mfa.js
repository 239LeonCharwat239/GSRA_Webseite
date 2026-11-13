/* =========================================
   GSRA - Zwei-Faktor-Anmeldung (Code aus einer Authenticator-App, z. B. Google Authenticator,
   Microsoft Authenticator oder 1Password). Für Admins Pflicht: Die Datenbank gibt Admin-Rechte
   nur frei, wenn die Anmeldung mit dem zweiten Faktor bestätigt wurde.
========================================= */

window.gsraMfa = (() => {
    const cleanCode = (code) => String(code || "").replace(/\s+/g, "");
    const validCode = (code) => /^\d{6}$/.test(code);

    async function level(client) {
        const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        return error ? null : data;
    }

    async function factors(client) {
        const { data, error } = await client.auth.mfa.listFactors();
        if (error) return { verified: null, unverified: [] };
        const totp = (data?.all || data?.totp || []).filter(f => f.factor_type === "totp");
        return { verified: totp.find(f => f.status === "verified") || null, unverified: totp.filter(f => f.status !== "verified") };
    }

    async function verify(client, factorId, code) {
        const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
        return error;
    }

    // Nach dem Login: Wer die Zwei-Faktor-Anmeldung eingerichtet hat, gibt den Code ein.
    // „Später“ = normal angemeldet, aber ohne Admin-Rechte (der Admin-Bereich fragt dann erneut).
    async function promptAfterLogin(client) {
        const aal = await level(client);
        if (!aal || aal.nextLevel !== "aal2" || aal.currentLevel === "aal2") return true;
        const { verified } = await factors(client);
        if (!verified) return true;
        for (let attempt = 0; attempt < 3; attempt++) {
            const input = await showDialog({
                icon: "fa-shield-halved",
                title: "Bestätigungscode",
                message: "Gib den 6-stelligen Code aus deiner Authenticator-App ein.",
                input: { placeholder: "123456", maxLength: 7, inputMode: "numeric", autocomplete: "one-time-code" },
                confirmText: "Bestätigen",
                cancelText: "Später"
            });
            if (!input) return false;
            const code = cleanCode(input);
            if (validCode(code) && !(await verify(client, verified.id, code))) return true;
            showToast("Der Code stimmt nicht. Bitte versuche es erneut.", "error");
        }
        return false;
    }

    // Admin-Bereich: Einrichtung bzw. Bestätigung direkt auf der Seite. Erfüllt sich, sobald bestätigt.
    async function requireForAdmin(client, gate) {
        const aal = await level(client);
        if (aal?.currentLevel === "aal2") return true;
        const { verified, unverified } = await factors(client);
        return verified ? showVerify(client, gate, verified.id) : showEnroll(client, gate, unverified);
    }

    function codeForm(gate, { intro, button }) {
        gate.innerHTML = `
            <div class="mfa-box">
                <div class="mfa-head"><i class="fa-solid fa-shield-halved"></i> Zwei-Faktor-Anmeldung</div>
                <div class="mfa-intro"></div>
                <form class="mfa-form" autocomplete="off">
                    <input type="text" class="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456" required>
                    <button type="submit" class="mfa-submit"></button>
                </form>
                <div class="mfa-error" role="alert"></div>
            </div>`;
        gate.style.display = "";
        gate.querySelector(".mfa-intro").append(intro);
        gate.querySelector(".mfa-submit").textContent = button;
        return {
            form: gate.querySelector(".mfa-form"),
            input: gate.querySelector(".mfa-code"),
            error: gate.querySelector(".mfa-error"),
            submit: gate.querySelector(".mfa-submit")
        };
    }

    function waitForCode(client, ui, factorId) {
        ui.input.focus();
        return new Promise(resolve => {
            ui.form.addEventListener("submit", async (e) => {
                e.preventDefault();
                const code = cleanCode(ui.input.value);
                ui.error.textContent = "";
                if (!validCode(code)) {
                    ui.error.textContent = "Bitte gib die 6 Ziffern aus der App ein.";
                    return;
                }
                ui.submit.disabled = true;
                const error = await verify(client, factorId, code);
                ui.submit.disabled = false;
                if (error) {
                    ui.error.textContent = "Der Code stimmt nicht oder ist abgelaufen. Bitte nimm den aktuellen Code aus der App.";
                    ui.input.select();
                    return;
                }
                resolve(true);
            });
        });
    }

    function showVerify(client, gate, factorId) {
        const intro = document.createElement("p");
        intro.textContent = "Der Admin-Bereich ist zusätzlich geschützt. Gib den 6-stelligen Code aus deiner Authenticator-App ein.";
        return waitForCode(client, codeForm(gate, { intro, button: "Bestätigen" }), factorId);
    }

    async function showEnroll(client, gate, unverified) {
        // Abgebrochene frühere Einrichtungen entfernen (sonst lehnt Supabase eine neue ab)
        for (const f of unverified) await client.auth.mfa.unenroll({ factorId: f.id });
        const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "GSRA Admin", issuer: "GSRA" });
        if (error || !data?.totp) {
            gate.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Die Zwei-Faktor-Anmeldung konnte nicht vorbereitet werden. Bitte lade die Seite neu.';
            return false;
        }
        const intro = document.createElement("div");
        intro.innerHTML = `
            <p>Für den Admin-Bereich ist eine Zwei-Faktor-Anmeldung Pflicht. Einmalig einrichten:</p>
            <ol class="mfa-steps">
                <li>Authenticator-App öffnen (z. B. Google Authenticator, Microsoft Authenticator, 1Password).</li>
                <li>QR-Code scannen – oder den Schlüssel von Hand eingeben.</li>
                <li>Den 6-stelligen Code aus der App hier eingeben.</li>
            </ol>
            <div class="mfa-qr"><img alt="QR-Code für die Authenticator-App"></div>
            <div class="mfa-secret"><span>Schlüssel:</span> <code></code></div>`;
        intro.querySelector(".mfa-qr img").src = data.totp.qr_code;
        intro.querySelector(".mfa-secret code").textContent = data.totp.secret;
        return waitForCode(client, codeForm(gate, { intro, button: "Einrichten" }), data.id);
    }

    return { promptAfterLogin, requireForAdmin, level };
})();
