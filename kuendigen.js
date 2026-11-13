/* =========================================
   GSRA - „Verträge hier kündigen“ (§ 312k BGB)
   Kündigen geht ohne Anmeldung. Angemeldet werden laufende Verträge angezeigt und die Felder vorausgefüllt.
   Die Server-Funktion „cancel-contract“ merkt die Kündigung bei Stripe vor und schickt die Eingangsbestätigung.
========================================= */
(() => {
    const client = window.supabaseClient || window.supabase;
    const form = document.getElementById("kdForm");
    const done = document.getElementById("kdDone");
    const mine = document.getElementById("kdMine");
    const submit = document.getElementById("kdSubmit");
    if (!client || !form) return;

    const value = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value || "";
    const day = (iso) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const dateTime = (iso) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

    // Zusatzfelder nur bei Bedarf
    const toggleFields = () => {
        document.getElementById("kdReasonField").hidden = value("kind") !== "ausserordentlich";
        document.getElementById("kdDateField").hidden = value("when") !== "date";
        form.querySelectorAll(".kd-choice").forEach(label => label.classList.toggle("checked", label.querySelector("input").checked));
    };
    form.addEventListener("change", toggleFields);
    // Aus dem Dashboard bzw. von der Abo-Seite: Vertrag schon ausgewählt (kuendigen.html?vertrag=pole)
    const preset = new URLSearchParams(window.location.search).get("vertrag");
    const presetRadio = preset && form.querySelector(`input[name="contract"][value="${preset === "alliance" ? "alliance" : "pole"}"]`);
    if (presetRadio) presetRadio.checked = true;
    const dateInput = document.getElementById("kdDate");
    dateInput.min = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    toggleFields();

    // Angemeldet: Felder vorausfüllen und laufende Verträge zeigen
    (async () => {
        const { data: { session } } = await client.auth.getSession();
        const user = session?.user;
        if (!user) return;
        document.getElementById("kdEmail").value = user.email || "";
        const { data: profile } = await client.from("profiles").select("username, gsra_id").eq("id", user.id).maybeSingle();
        if (profile) document.getElementById("kdAccount").value = profile.gsra_id ? `${profile.username || ""} (GSRA-ID #${profile.gsra_id})`.trim() : (profile.username || "");
        const { data: m, error } = await client.rpc("my_membership");
        if (error || !m) return;
        // Nur gebuchte Verträge sind wählbar (der Server prüft das zusätzlich)
        const owned = new Set();
        if (m.plan === "pole" && m.pole) owned.add("pole");
        if (m.plan === "alliance" && m.team?.is_owner) owned.add("alliance");
        form.querySelectorAll('input[name="contract"]').forEach(radio => {
            const label = radio.closest(".kd-choice");
            const isOwned = owned.has(radio.value);
            radio.disabled = !isOwned;
            if (!isOwned) radio.checked = false;
            label.classList.toggle("disabled", !isOwned);
            label.querySelector(".kd-not-booked")?.remove();
            if (!isOwned) {
                const note = document.createElement("em");
                note.className = "kd-not-booked";
                note.textContent = "nicht gebucht";
                label.querySelector("span strong").after(note);
            }
        });
        if (!owned.size) {
            submit.disabled = true;
            submit.title = "Zu deinem Konto läuft kein kündbarer Vertrag.";
        }
        const rows = [];
        if (m.plan === "pole" && m.pole) {
            rows.push(["pole", `GSRA Pole · ${m.pole.cancel_at_period_end ? `bereits gekündigt zum ${day(m.pole.current_period_end)}` : `läuft bis ${day(m.pole.current_period_end)} und verlängert sich monatlich`}`]);
        }
        if (m.plan === "alliance" && m.team?.is_owner) {
            rows.push(["alliance", `GSRA Alliance (Teamleitung) · ${m.team.cancel_at_period_end ? `bereits gekündigt zum ${day(m.team.current_period_end)}` : `läuft bis ${day(m.team.current_period_end)} und verlängert sich monatlich`}`]);
        }
        if (m.plan === "alliance" && m.team && !m.team.is_owner) {
            rows.push(["", `Du bist Mitglied im Alliance-Team von ${m.team.owner_name || "deiner Teamleitung"}. Kündigen kann nur die Teamleitung – du kannst das Team aber jederzeit auf der Abo-Seite verlassen.`]);
        }
        if (!rows.length) {
            mine.innerHTML = '<i class="fa-solid fa-circle-info"></i> <span>Zu deinem Konto läuft derzeit kein kostenpflichtiges Abo. Du nutzt Paddock (kostenlos) – es gibt nichts zu kündigen.</span>';
        } else {
            mine.innerHTML = '<strong><i class="fa-solid fa-file-contract"></i> Deine Verträge</strong><ul></ul>';
            rows.forEach(([contract, text]) => {
                const li = document.createElement("li");
                li.textContent = text;
                mine.querySelector("ul").appendChild(li);
                const radio = contract && form.querySelector(`input[name="contract"][value="${contract}"]`);
                if (radio && !value("contract")) radio.checked = true;
            });
            toggleFields();
        }
        mine.hidden = false;
    })();

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = {
            contract: value("contract"),
            kind: value("kind"),
            reason: document.getElementById("kdReason").value.trim(),
            date: value("when") === "date" ? dateInput.value : "",
            name: document.getElementById("kdName").value.trim(),
            email: document.getElementById("kdEmail").value.trim(),
            account_hint: document.getElementById("kdAccount").value.trim()
        };
        if (!body.contract) return showToast("Bitte wähle den Vertrag aus, den du kündigen möchtest.", "error");
        if (body.kind === "ausserordentlich" && !body.reason) return showToast("Bitte nenne den Grund für die außerordentliche Kündigung.", "error");
        if (value("when") === "date" && !body.date) return showToast("Bitte wähle das gewünschte Datum.", "error");
        if (!body.name) return showToast("Bitte gib deinen Namen an.", "error");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return showToast("Bitte gib eine gültige E-Mail-Adresse an.", "error");

        submit.disabled = true;
        submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Wird gesendet …';
        let result = null;
        try {
            const { data, error } = await client.functions.invoke("cancel-contract", { body });
            let message = data?.error;
            if (error) {
                try { message = (await error.context?.json())?.error || message; } catch (err) { /* keine Details */ }
                message = message || "Die Kündigung konnte gerade nicht gesendet werden. Bitte versuche es erneut.";
            }
            if (!data?.reference) throw new Error(message || "Die Kündigung konnte nicht gesendet werden.");
            result = data;
        } catch (err) {
            showToast(err.message, "error");
            submit.disabled = false;
            submit.innerHTML = '<i class="fa-solid fa-file-signature"></i> Jetzt kündigen';
            return;
        }
        showConfirmation(result);
    });

    // Bestätigung zum Speichern oder Ausdrucken
    function showConfirmation(r) {
        form.hidden = true;
        mine.hidden = true;
        const effective = r.effective_at
            ? `Dein Vertrag endet zum <strong>${day(r.effective_at)}</strong>. Bis dahin kannst du alle Vorteile weiter nutzen.`
            : r.member_only
                ? "Du bist Mitglied eines Alliance-Teams – gekündigt wird von der Teamleitung. Du kannst das Team jederzeit auf der Abo-Seite verlassen."
                : "Zu deinen Angaben haben wir keinen laufenden Vertrag gefunden. Das GSRA-Team prüft deine Kündigung und meldet sich bei dir.";
        done.innerHTML = `
            <div class="kd-done-head"><i class="fa-solid fa-circle-check"></i><div><h2>Deine Kündigung ist eingegangen</h2><p></p></div></div>
            <dl class="kd-summary"></dl>
            <p class="kd-effective">${effective}</p>
            ${r.status === "pruefung" ? '<p class="kd-effective">Deine außerordentliche Kündigung prüfen wir zusätzlich und melden uns dazu bei dir.</p>' : ""}
            <div class="kd-done-actions">
                <button type="button" class="abo-plan-btn ghost" id="kdPrint"><i class="fa-solid fa-print"></i> Bestätigung drucken / speichern</button>
                <a href="index.html" class="abo-plan-btn ghost"><i class="fa-solid fa-house"></i> Zur Startseite</a>
            </div>`;
        done.querySelector(".kd-done-head p").textContent = r.email_sent
            ? `Eine Eingangsbestätigung haben wir an ${r.email} geschickt.`
            : "Bitte speichere diese Bestätigung. Die Bestätigungs-E-Mail konnte gerade nicht verschickt werden – wir senden sie nach.";
        const rows = [
            ["Eingegangen am", `${dateTime(r.received_at)} Uhr`],
            ["Referenznummer", r.reference],
            ["Vertrag", r.contract],
            ["Art", r.kind],
            ["Gewünschter Zeitpunkt", r.requested_date ? `zum ${day(r.requested_date)}` : "zum nächstmöglichen Zeitpunkt"]
        ];
        const list = done.querySelector(".kd-summary");
        rows.forEach(([label, text]) => {
            const dt = document.createElement("dt");
            dt.textContent = label;
            const dd = document.createElement("dd");
            dd.textContent = text;
            list.append(dt, dd);
        });
        document.body.classList.add("kd-print");
        done.querySelector("#kdPrint").addEventListener("click", () => window.print());
        done.hidden = false;
        done.scrollIntoView({ behavior: "smooth", block: "start" });
    }
})();
