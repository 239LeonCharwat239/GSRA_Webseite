/* =========================================
   GSRA - Abos (Paddock, Pole, Alliance) und Team-Verwaltung
   Bezahlt wird über Stripe (Server-Funktionen create-checkout und billing-portal);
   eingetragen wird ein Abo nur vom Webhook – diese Seite liest nur und verwaltet das Team.
========================================= */

const aboClient = window.supabaseClient || window.supabase;
const aboMine = document.getElementById("aboMine");
let aboUser = null;
let aboMembership = null;

const PLAN_NAMES = { paddock: "Paddock", pole: "Pole", alliance: "Alliance" };
const ACTIVE_STATES = ["active", "trialing", "past_due"];

const formatDate = (value) => value ? new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
const missingFunction = (error) => /could not find the function|schema cache|does not exist/i.test(error?.message || "");

// Server-Funktion aufrufen und die Fehlermeldung des Servers lesbar machen
async function callFunction(name, body = {}) {
    const { data, error } = await aboClient.functions.invoke(name, { body });
    let message = data?.error;
    if (error) {
        try { message = (await error.context?.json())?.error || message; } catch (e) { /* keine Details */ }
        message = message || "Die Bezahlung ist noch nicht eingerichtet oder gerade nicht erreichbar.";
    }
    if (!data?.url) throw new Error(message || "Die Seite konnte nicht geöffnet werden.");
    return data.url;
}

async function goToCheckout(kind, button) {
    button.disabled = true;
    try {
        window.location.href = await callFunction("create-checkout", { kind });
    } catch (err) {
        showToast(err.message, "error");
        button.disabled = false;
    }
}

async function openBillingPortal(button) {
    button.disabled = true;
    try {
        window.location.href = await callFunction("billing-portal");
    } catch (err) {
        showToast(err.message, "error");
        button.disabled = false;
    }
}

// Status eines Abos in Worten
function subscriptionText(sub) {
    if (!sub) return "";
    const end = formatDate(sub.current_period_end);
    if (sub.status === "past_due") return "Die letzte Zahlung ist fehlgeschlagen. Bitte aktualisiere deine Zahlungsart unter „Abo verwalten“, sonst endet das Abo.";
    if (sub.status === "incomplete") return "Die Zahlung wird noch geprüft.";
    if (!ACTIVE_STATES.includes(sub.status)) return "Dieses Abo ist beendet.";
    if (sub.cancel_at_period_end) return end ? `Gekündigt – läuft noch bis zum ${end}.` : "Gekündigt – läuft bis zum Ende des Monats.";
    return end ? `Aktiv – verlängert sich am ${end}.` : "Aktiv.";
}

// Knöpfe auf den drei Abo-Karten je nach Anmeldung und aktuellem Abo
function renderPlanActions(plan) {
    document.querySelectorAll(".abo-plan").forEach(card => card.classList.toggle("current", card.dataset.plan === plan));
    document.querySelectorAll(".abo-plan-action").forEach(box => {
        const target = box.dataset.actionFor;
        box.replaceChildren();
        const button = document.createElement(aboUser ? "button" : "a");
        button.className = "abo-plan-btn";
        if (!aboUser) {
            button.href = loginLinkHere(target === "paddock" ? "registrieren=1&" : "");
            button.innerHTML = target === "paddock" ? '<i class="fa-solid fa-user-plus"></i> Kostenlos registrieren'
                : `<i class="fa-solid fa-right-to-bracket"></i> Anmelden und ${PLAN_NAMES[target]} buchen`;
        } else if (target === plan) {
            button.type = "button";
            button.disabled = true;
            button.classList.add("current");
            button.innerHTML = '<i class="fa-solid fa-circle-check"></i> Dein aktuelles Abo';
        } else if (target === "paddock") {
            // Zurück zu Paddock = Abo kündigen (im Stripe-Kundenportal)
            button.type = "button";
            button.classList.add("ghost");
            button.innerHTML = '<i class="fa-solid fa-gear"></i> Abo kündigen';
            if (aboMembership?.has_customer && !isTeamMemberOnly()) button.addEventListener("click", () => openBillingPortal(button));
            else {
                button.disabled = true;
                button.innerHTML = isTeamMemberOnly() ? '<i class="fa-solid fa-people-group"></i> Über dein Team' : '<i class="fa-solid fa-gear"></i> Abo kündigen';
            }
        } else if (plan !== "paddock") {
            // Wechsel zwischen Pole und Alliance: erst das laufende Abo kündigen
            button.type = "button";
            button.disabled = true;
            button.classList.add("ghost");
            if (isTeamMemberOnly()) {
                button.innerHTML = '<i class="fa-solid fa-arrow-right-arrow-left"></i> Erst Team verlassen';
                button.title = "Du nutzt Alliance über dein Team. Verlässt du das Team, kannst du ein eigenes Abo buchen.";
            } else {
                button.innerHTML = '<i class="fa-solid fa-arrow-right-arrow-left"></i> Zum Wechseln erst kündigen';
                button.title = "Kündige dein aktuelles Abo unter „Abo verwalten“. Danach kannst du das andere Abo buchen.";
            }
        } else {
            button.type = "button";
            button.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> ${PLAN_NAMES[target]} buchen`;
            button.addEventListener("click", () => goToCheckout(target, button));
        }
        box.appendChild(button);
    });
}

// Mitglied eines fremden Teams (nicht Teamleitung)
const isTeamMemberOnly = () => Boolean(aboMembership?.team && !aboMembership.team.is_owner && ACTIVE_STATES.includes(aboMembership.team.status));

// Bereich „Dein Abo“ mit Status, Verwaltung und ggf. Team
function renderMine() {
    if (!aboMine) return;
    const m = aboMembership;
    if (!aboUser || !m) {
        aboMine.hidden = true;
        return;
    }
    aboMine.hidden = false;
    const plan = m.plan || "paddock";
    const team = m.team;
    const teamActive = team && ACTIVE_STATES.includes(team.status);

    let text = "Du nutzt Paddock – kostenlos und ohne Laufzeit.";
    if (plan === "pole") text = subscriptionText(m.pole);
    if (plan === "alliance" && team?.is_owner) text = `Du bist Teamleitung. ${subscriptionText(team)}`;
    if (plan === "alliance" && !team?.is_owner) text = `Du bist Mitglied im Alliance-Team von ${team?.owner_name || "deiner Teamleitung"}. Bezahlt wird über die Teamleitung.`;
    if (plan === "paddock" && m.pole && !ACTIVE_STATES.includes(m.pole.status)) text = "Dein Pole-Abo ist beendet. Du nutzt jetzt wieder Paddock.";
    if (plan === "paddock" && team && !teamActive) text = "Das Alliance-Abo deines Teams ist beendet. Du nutzt jetzt wieder Paddock.";

    aboMine.innerHTML = `
        <div class="abo-mine-head">
            <div>
                <small>Dein Abo</small>
                <div class="abo-mine-plan"><span class="plan-badge ${plan}"><i class="fa-solid ${GSRA_PLANS[plan]?.icon || "fa-flag-checkered"}"></i> ${PLAN_NAMES[plan]}</span></div>
                <p class="abo-mine-text"></p>
            </div>
            <div class="abo-mine-actions"></div>
        </div>
        <div class="abo-team" hidden></div>`;
    aboMine.querySelector(".abo-mine-text").textContent = text;
    aboMine.classList.toggle("warning", Boolean((m.pole?.status === "past_due" && plan === "pole") || (team?.is_owner && team.status === "past_due")));

    // Zahlungsart, Rechnungen, Kündigung: Stripe-Kundenportal (nicht für reine Teammitglieder)
    const actions = aboMine.querySelector(".abo-mine-actions");
    if (m.has_customer && !isTeamMemberOnly()) {
        const manage = document.createElement("button");
        manage.type = "button";
        manage.className = "abo-plan-btn ghost";
        manage.innerHTML = '<i class="fa-solid fa-gear"></i> Abo verwalten';
        manage.title = "Zahlungsart ändern, Rechnungen herunterladen oder kündigen";
        manage.addEventListener("click", () => openBillingPortal(manage));
        actions.appendChild(manage);
    }

    if (team) renderTeam(aboMine.querySelector(".abo-team"), team, teamActive);
}

function renderTeam(box, team, teamActive) {
    box.hidden = false;
    const members = team.members || [];
    box.innerHTML = `
        <div class="abo-team-head">
            <h3><i class="fa-solid fa-people-group"></i> Dein Team <span class="abo-team-count">${members.length} / 10</span></h3>
        </div>
        ${team.is_owner && teamActive ? `
        <form class="abo-team-add">
            <input type="text" inputmode="numeric" maxlength="14" placeholder="GSRA-ID, z. B. 100042" aria-label="GSRA-ID des neuen Mitglieds" required>
            <button type="submit" class="abo-plan-btn"><i class="fa-solid fa-user-plus"></i> Hinzufügen</button>
        </form>
        <p class="abo-team-hint"><i class="fa-solid fa-circle-info"></i> Jedes Mitglied braucht ein eigenes GSRA-Konto. Die GSRA-ID steht im Dashboard unter dem Benutzernamen.</p>` : ""}
        <ul class="abo-team-list"></ul>
        ${!team.is_owner ? '<button type="button" class="abo-team-leave"><i class="fa-solid fa-right-from-bracket"></i> Team verlassen</button>' : ""}`;

    const list = box.querySelector(".abo-team-list");
    members.forEach(member => {
        const li = document.createElement("li");
        li.innerHTML = `
            <span class="abo-team-avatar"><i class="fa-solid fa-user"></i></span>
            <span class="abo-team-name"><strong></strong><small></small></span>
            ${member.is_owner ? '<span class="abo-team-role">Teamleitung</span>' : ""}
            ${team.is_owner && !member.is_owner ? '<button type="button" class="abo-team-remove" title="Aus dem Team entfernen"><i class="fa-solid fa-user-minus"></i></button>' : ""}`;
        li.querySelector("strong").textContent = member.username || "Unbekannt";
        li.querySelector("small").textContent = member.gsra_id ? `GSRA-ID #${member.gsra_id}` : "";
        if (/^https:\/\//i.test(member.avatar_url || "")) {
            const img = document.createElement("img");
            img.src = member.avatar_url;
            img.alt = "";
            li.querySelector(".abo-team-avatar").replaceChildren(img);
        }
        const remove = li.querySelector(".abo-team-remove");
        if (remove) remove.addEventListener("click", async () => {
            const ok = await showDialog({
                icon: "fa-user-minus",
                title: "Mitglied entfernen?",
                message: `${member.username || "Diese Person"} verliert die Alliance-Vorteile und nutzt wieder Paddock. Der Platz im Team wird frei.`,
                confirmText: "Entfernen",
                cancelText: "Abbrechen",
                danger: true
            });
            if (!ok) return;
            const { error } = await aboClient.rpc("team_remove_member", { _user: member.user_id });
            if (error) return showToast(error.message, "error");
            showToast("Mitglied entfernt.", "success");
            loadMembership();
        });
        list.appendChild(li);
    });

    const form = box.querySelector(".abo-team-add");
    if (form) form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = form.querySelector("input");
        const id = input.value.replace(/\D/g, "");
        if (!id) return showToast("Bitte gib eine GSRA-ID ein (nur Ziffern).", "error");
        const button = form.querySelector("button");
        button.disabled = true;
        const { error } = await aboClient.rpc("team_add_member", { _gsra_id: Number(id) });
        button.disabled = false;
        if (error) return showToast(error.message, "error");
        input.value = "";
        showToast("Mitglied hinzugefügt – es hat ab sofort alle Pole-Vorteile.", "success");
        loadMembership();
    });

    const leave = box.querySelector(".abo-team-leave");
    if (leave) leave.addEventListener("click", async () => {
        const ok = await showDialog({
            icon: "fa-right-from-bracket",
            title: "Team verlassen?",
            message: teamActive ? "Du verlierst die Alliance-Vorteile und nutzt wieder Paddock. Die Teamleitung kann dich später erneut hinzufügen." : "Du wirst aus dem beendeten Team entfernt.",
            confirmText: "Verlassen",
            cancelText: "Abbrechen",
            danger: true
        });
        if (!ok) return;
        const { error } = await aboClient.rpc("team_remove_member", { _user: aboUser.id });
        if (error) return showToast(error.message, "error");
        showToast("Du hast das Team verlassen.", "success");
        loadMembership();
    });
}

async function loadMembership() {
    if (!aboUser) {
        renderPlanActions(null);
        renderMine();
        return null;
    }
    const { data, error } = await aboClient.rpc("my_membership");
    if (error) {
        // Zahlungs-Tabellen fehlen noch (SQL nicht ausgeführt): alle gelten als Paddock
        if (!missingFunction(error)) console.error("Abo konnte nicht geladen werden:", error);
        aboMembership = { plan: "paddock" };
    } else {
        aboMembership = data || { plan: "paddock" };
    }
    renderPlanActions(aboMembership.plan || "paddock");
    renderMine();
    return aboMembership;
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!aboClient) return;
    const { data: { session } } = await aboClient.auth.getSession();
    aboUser = session?.user || null;
    await loadMembership();

    // Rückkehr von der Stripe-Bezahlseite
    const params = new URLSearchParams(window.location.search);
    const result = params.get("abo");
    if (!result) return;
    history.replaceState(null, "", window.location.pathname);
    if (result === "abbruch") {
        showToast("Die Bezahlung wurde abgebrochen – es wurde nichts berechnet.", "info");
        return;
    }
    showToast("Danke! Dein Abo wird in wenigen Sekunden freigeschaltet.", "success");
    // Stripe meldet den Abschluss kurz nach der Rückkehr: bis zu ~30 Sekunden nachsehen
    for (let attempt = 0; attempt < 10 && aboUser; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const m = await loadMembership();
        if (m && m.plan && m.plan !== "paddock") {
            showToast(`${PLAN_NAMES[m.plan]} ist jetzt aktiv. Viel Spaß!`, "success");
            return;
        }
    }
});
