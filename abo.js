/* =========================================
   GSRA - Abos (Paddock, Pole, Alliance) und Team-Verwaltung
   Läuft auf der Abo-Seite und im Dashboard. Bezahlt wird über Stripe (Server-Funktionen create-checkout und
   billing-portal); eingetragen wird ein Abo nur vom Webhook – diese Seite liest nur und verwaltet das Team.
========================================= */
(() => {
    const aboClient = window.supabaseClient || window.supabase;
    const onDashboard = /dashboard(\.html)?$/.test(window.location.pathname);
    let aboUser = null;
    let aboMembership = null;

    const PLAN_NAMES = { paddock: "Paddock", pole: "Pole", alliance: "Alliance" };
    const ACTIVE_STATES = ["active", "trialing", "past_due"];

    // Die drei Stufen (Preise legt der Server fest – hier nur zur Anzeige)
    const PLAN_CARDS = [
        { plan: "paddock", icon: "fa-flag-checkered", for: "Für alle Fahrer der Community", price: "0 €", per: "kostenlos",
          features: [["Messenger, Gruppen und Foren"], ["Marktplatz: kaufen und verkaufen"], ["Setups herunterladen und teilen"],
                     ["Nachschlagewerk und Rennkalender"], ["Pro Setups", "", true], ["Telemetry-Tool", "", true], ["Stint-Planer", "", true],
                     ["Weitere exklusive Features", "", true]] },
        { plan: "pole", icon: "fa-stopwatch", ribbon: "Für Ehrgeizige", for: "Für ambitionierte Fahrer", price: "8,49 €", per: "pro Monat",
          features: [["Alles aus Paddock"], ["Pro Setups"], ["Telemetry-Tool", "in Entwicklung"], ["Stint-Planer", "in Entwicklung"],
                     ["Alle weiteren exklusiven Features"], ["Pole-Abzeichen im Profil"]] },
        { plan: "alliance", icon: "fa-people-group", for: "Für Teams mit bis zu 10 Personen", price: "39,99 €", per: "pro Monat · ca. 4 € pro Person",
          features: [["Alle Pole-Vorteile für bis zu 10 Personen"], ["Jede Person nutzt ihr eigenes GSRA-Konto"],
                     ["Mitglieder per Freundesliste, GSRA-ID oder Einladungslink"], ["Alliance-Abzeichen im Profil"]] }
    ];

    const formatDay = (value) => value ? new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
    const missingFunction = (error) => /could not find the function|schema cache|does not exist/i.test(error?.message || "");
    const escapeText = (value) => { const span = document.createElement("span"); span.textContent = value ?? ""; return span.innerHTML; };

    // Abo-Karten in jeden Platzhalter [data-plan-cards] schreiben (Abo-Seite und Dashboard)
    function renderPlanCards() {
        document.querySelectorAll("[data-plan-cards]").forEach(box => {
            box.innerHTML = PLAN_CARDS.map(card => `
                <article class="abo-plan ${card.plan}" data-plan="${card.plan}">
                    ${card.ribbon ? `<span class="abo-plan-ribbon">${card.ribbon}</span>` : ""}
                    <div class="abo-plan-head">
                        <span class="abo-plan-icon"><i class="fa-solid ${card.icon}"></i></span>
                        <h2>${PLAN_NAMES[card.plan]}</h2>
                        <p class="abo-plan-for">${card.for}</p>
                    </div>
                    <div class="abo-plan-price"><strong>${card.price}</strong><span>${card.per}</span></div>
                    <ul class="abo-plan-features">
                        ${card.features.map(([text, note, off]) => `<li${off ? ' class="off"' : ""}><i class="fa-solid ${off ? "fa-xmark" : "fa-check"}"></i> <span>${text}${note ? ` <small>(${note})</small>` : ""}</span></li>`).join("")}
                    </ul>
                    <div class="abo-plan-action" data-action-for="${card.plan}"></div>
                </article>`).join("");
        });
    }

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
            window.location.href = await callFunction("create-checkout", { kind, return_page: onDashboard ? "dashboard" : "abo" });
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
        const end = formatDay(sub.current_period_end);
        if (sub.status === "past_due") return "Die letzte Zahlung ist fehlgeschlagen. Bitte aktualisiere deine Zahlungsart unter „Abo verwalten“, sonst endet das Abo.";
        if (sub.status === "incomplete") return "Die Zahlung wird noch geprüft.";
        if (!ACTIVE_STATES.includes(sub.status)) return "Dieses Abo ist beendet.";
        if (sub.cancel_at_period_end) return end ? `Gekündigt – läuft noch bis zum ${end}.` : "Gekündigt – läuft bis zum Ende des Monats.";
        return end ? `Aktiv – verlängert sich am ${end}.` : "Aktiv.";
    }

    // Mitglied eines fremden Teams (nicht Teamleitung)
    const isTeamMemberOnly = () => Boolean(aboMembership?.team && !aboMembership.team.is_owner && ACTIVE_STATES.includes(aboMembership.team.status));

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
                    if (isTeamMemberOnly()) button.innerHTML = '<i class="fa-solid fa-people-group"></i> Über dein Team';
                }
            } else if (plan !== "paddock") {
                // Wechsel zwischen Pole und Alliance: erst das laufende Abo kündigen bzw. das Team verlassen
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

    // Bereich „Dein Abo“ mit Status, Verwaltung und ggf. Team
    function renderMine() {
        const mine = document.getElementById("aboMine");
        if (!mine) return;
        const m = aboMembership;
        if (!aboUser || !m) {
            mine.hidden = true;
            return;
        }
        mine.hidden = false;
        const plan = m.plan || "paddock";
        const team = m.team;
        const teamActive = team && ACTIVE_STATES.includes(team.status);

        let text = "Du nutzt Paddock – kostenlos und ohne Laufzeit.";
        if (plan === "pole") text = subscriptionText(m.pole);
        if (plan === "alliance" && team?.is_owner) text = `Du bist Teamleitung. ${subscriptionText(team)}`;
        if (plan === "alliance" && !team?.is_owner) text = `Du bist Mitglied im Alliance-Team von ${team?.owner_name || "deiner Teamleitung"}. Bezahlt wird über die Teamleitung.`;
        if (plan === "paddock" && m.pole && !ACTIVE_STATES.includes(m.pole.status)) text = "Dein Pole-Abo ist beendet. Du nutzt jetzt wieder Paddock.";
        if (plan === "paddock" && team && !teamActive) text = "Das Alliance-Abo deines Teams ist beendet. Du nutzt jetzt wieder Paddock.";

        mine.innerHTML = `
            <div class="abo-mine-head">
                <div>
                    <small>Dein Abo</small>
                    <div class="abo-mine-plan"><span class="plan-badge ${plan}"><i class="fa-solid ${GSRA_PLANS[plan]?.icon || "fa-flag-checkered"}"></i> ${PLAN_NAMES[plan]}</span></div>
                    <p class="abo-mine-text"></p>
                </div>
                <div class="abo-mine-actions"></div>
            </div>
            <div class="abo-team" hidden></div>`;
        mine.querySelector(".abo-mine-text").textContent = text;
        mine.classList.toggle("warning", Boolean((m.pole?.status === "past_due" && plan === "pole") || (team?.is_owner && team.status === "past_due")));

        // Zahlungsart, Rechnungen, Kündigung: Stripe-Kundenportal (nicht für reine Teammitglieder)
        const actions = mine.querySelector(".abo-mine-actions");
        if (m.has_customer && !isTeamMemberOnly()) {
            const manage = document.createElement("button");
            manage.type = "button";
            manage.className = "abo-plan-btn ghost";
            manage.innerHTML = '<i class="fa-solid fa-gear"></i> Abo verwalten';
            manage.title = "Zahlungsart ändern, Rechnungen herunterladen oder kündigen";
            manage.addEventListener("click", () => openBillingPortal(manage));
            actions.appendChild(manage);
        }

        if (team) renderTeam(mine.querySelector(".abo-team"), team, teamActive);
    }

    function renderTeam(box, team, teamActive) {
        box.hidden = false;
        const members = team.members || [];
        const manage = team.is_owner && teamActive;
        const full = members.length >= 10;
        box.innerHTML = `
            <div class="abo-team-head">
                <h3><i class="fa-solid fa-people-group"></i> ${team.is_owner ? "Dein Team" : `Team von ${escapeText(team.owner_name || "deiner Teamleitung")}`} <span class="abo-team-count">${members.length} / 10</span></h3>
            </div>
            <ul class="abo-team-list"></ul>
            ${manage ? `
            <div class="abo-team-invite">
                <div class="abo-team-block abo-team-friends">
                    <h4><i class="fa-solid fa-user-group"></i> Freunde hinzufügen</h4>
                    <div class="abo-friend-list"><p class="abo-team-hint">Lade Freundesliste …</p></div>
                </div>
                <div class="abo-team-block">
                    <h4><i class="fa-solid fa-link"></i> Per Link einladen</h4>
                    <p class="abo-team-hint">Wer den Link öffnet, meldet sich an oder registriert sich und ist danach automatisch im Team. Der Link gilt 14 Tage.</p>
                    <div class="abo-invite-link"></div>
                </div>
                <div class="abo-team-block">
                    <h4><i class="fa-solid fa-id-badge"></i> Per GSRA-ID hinzufügen</h4>
                    <form class="abo-team-add">
                        <input type="text" inputmode="numeric" maxlength="14" placeholder="GSRA-ID, z. B. 100042" aria-label="GSRA-ID des neuen Mitglieds" required>
                        <button type="submit" class="abo-plan-btn"><i class="fa-solid fa-user-plus"></i> Hinzufügen</button>
                    </form>
                    <p class="abo-team-hint">Die GSRA-ID steht im Dashboard und im Profil unter dem Benutzernamen.</p>
                </div>
            </div>` : ""}
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

        const addById = async (gsraId, button) => {
            if (button) button.disabled = true;
            const { error } = await aboClient.rpc("team_add_member", { _gsra_id: Number(gsraId) });
            if (button) button.disabled = false;
            if (error) {
                showToast(error.message, "error");
                return false;
            }
            showToast("Mitglied hinzugefügt – es hat ab sofort alle Pole-Vorteile.", "success");
            loadMembership();
            return true;
        };

        const form = box.querySelector(".abo-team-add");
        if (form) form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const input = form.querySelector("input");
            const id = input.value.replace(/\D/g, "");
            if (!id) return showToast("Bitte gib eine GSRA-ID ein (nur Ziffern).", "error");
            if (await addById(id, form.querySelector("button"))) input.value = "";
        });

        if (manage) {
            renderFriendPicker(box.querySelector(".abo-friend-list"), members, full, addById);
            renderInviteLink(box.querySelector(".abo-invite-link"), team, full);
        }

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

    // Freunde aus GSRA mit einem Klick ins Team holen
    async function renderFriendPicker(box, members, full, addById) {
        if (!box) return;
        const { data: rows, error } = await aboClient.from("friendships").select("user_id, friend_id, status").eq("status", "accepted")
            .or(`user_id.eq.${aboUser.id},friend_id.eq.${aboUser.id}`);
        const inTeam = new Set(members.map(m => m.user_id));
        const ids = [...new Set((rows || []).map(f => (f.user_id === aboUser.id ? f.friend_id : f.user_id)))].filter(id => id && !inTeam.has(id));
        if (error || !rows?.length) {
            box.innerHTML = '<p class="abo-team-hint">Du hast noch keine Freunde in GSRA. Finde Fahrer im <a href="messenger.html">Messenger</a> oder lade sie per Link ein.</p>';
            return;
        }
        if (!ids.length) {
            box.innerHTML = '<p class="abo-team-hint">Alle deine Freunde sind schon im Team.</p>';
            return;
        }
        const { data: profiles } = await aboClient.from("profiles").select("id, username, gsra_id, avatar_url").in("id", ids);
        box.replaceChildren();
        (profiles || []).filter(p => p.gsra_id).sort((a, b) => (a.username || "").localeCompare(b.username || "", "de")).forEach(friend => {
            const row = document.createElement("div");
            row.className = "abo-friend";
            row.innerHTML = `
                <span class="abo-team-avatar"><i class="fa-solid fa-user"></i></span>
                <span class="abo-team-name"><strong></strong><small></small></span>
                <button type="button" class="abo-friend-add" title="Ins Team holen"${full ? " disabled" : ""}><i class="fa-solid fa-plus"></i></button>`;
            row.querySelector("strong").textContent = friend.username || "Fahrer";
            row.querySelector("small").textContent = `GSRA-ID #${friend.gsra_id}`;
            if (/^https:\/\//i.test(friend.avatar_url || "")) {
                const img = document.createElement("img");
                img.src = friend.avatar_url;
                img.alt = "";
                row.querySelector(".abo-team-avatar").replaceChildren(img);
            }
            const add = row.querySelector(".abo-friend-add");
            add.addEventListener("click", () => addById(friend.gsra_id, add));
            box.appendChild(row);
        });
        if (!box.children.length) box.innerHTML = '<p class="abo-team-hint">Alle deine Freunde sind schon im Team.</p>';
    }

    // Einladungslink anzeigen, kopieren, teilen oder erneuern
    function renderInviteLink(box, team, full) {
        if (!box) return;
        const urlFor = (token) => new URL(`abo.html?team=${encodeURIComponent(token)}`, window.location.href).href;
        const show = (token, expires) => {
            box.replaceChildren();
            if (full) {
                box.innerHTML = '<p class="abo-team-hint">Euer Team ist voll (10 von 10). Entferne ein Mitglied, um jemanden einzuladen.</p>';
                return;
            }
            if (!token) {
                const create = document.createElement("button");
                create.type = "button";
                create.className = "abo-plan-btn ghost";
                create.innerHTML = '<i class="fa-solid fa-link"></i> Einladungslink erstellen';
                create.addEventListener("click", () => fetchLink(false, create));
                box.appendChild(create);
                return;
            }
            const url = urlFor(token);
            box.innerHTML = `
                <div class="abo-invite-row">
                    <input type="text" readonly aria-label="Einladungslink">
                    <button type="button" class="abo-plan-btn abo-invite-copy"><i class="fa-regular fa-copy"></i> Kopieren</button>
                </div>
                <div class="abo-invite-meta">
                    <span>Gültig bis ${formatDay(expires)}</span>
                    ${navigator.share ? '<button type="button" class="abo-invite-share"><i class="fa-solid fa-share-nodes"></i> Teilen</button>' : ""}
                    <button type="button" class="abo-invite-renew"><i class="fa-solid fa-rotate"></i> Neuen Link erstellen</button>
                </div>`;
            const input = box.querySelector("input");
            input.value = url;
            input.addEventListener("focus", () => input.select());
            box.querySelector(".abo-invite-copy").addEventListener("click", () => {
                navigator.clipboard.writeText(url).then(() => showToast("Einladungslink kopiert.", "success"), () => {
                    input.select();
                    showToast("Bitte markierten Link kopieren (Strg+C).", "info");
                });
            });
            box.querySelector(".abo-invite-share")?.addEventListener("click", () => {
                navigator.share({ title: "GSRA Alliance", text: "Komm in mein GSRA-Alliance-Team:", url }).catch(() => {});
            });
            box.querySelector(".abo-invite-renew").addEventListener("click", async (e) => {
                const ok = await showDialog({
                    icon: "fa-rotate",
                    title: "Neuen Link erstellen?",
                    message: "Der bisherige Einladungslink funktioniert danach nicht mehr.",
                    confirmText: "Neuer Link",
                    cancelText: "Abbrechen"
                });
                if (ok) fetchLink(true, e.currentTarget);
            });
        };
        const fetchLink = async (renew, button) => {
            if (button) button.disabled = true;
            const { data, error } = await aboClient.rpc("team_invite_link", { _renew: renew });
            if (button) button.disabled = false;
            if (error) return showToast(missingFunction(error) ? "Einladungslinks sind noch nicht eingerichtet (SQL „Zahlungen 2“ fehlt)." : error.message, "error");
            show(data?.token, data?.expires_at);
            if (renew) showToast("Neuer Einladungslink erstellt – der alte gilt nicht mehr.", "success");
        };
        show(team.invite_token, team.invite_expires_at);
    }

    // Einladungslink geöffnet (abo.html?team=…): ohne Konto anmelden/registrieren, mit Konto direkt beitreten
    async function handleInvite() {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("team");
        const box = document.getElementById("aboInvite");
        if (!token || !box) return;
        const { data: info, error } = await aboClient.rpc("team_invite_info", { _token: token });
        box.hidden = false;
        const setBox = (icon, title, text, extra = "") => {
            box.innerHTML = `<i class="fa-solid ${icon} abo-invite-icon"></i><div><strong></strong><p></p>${extra}</div>`;
            box.querySelector("strong").textContent = title;
            box.querySelector("p").textContent = text;
        };
        const dropParam = () => {
            params.delete("team");
            history.replaceState(null, "", window.location.pathname + (params.toString() ? `?${params}` : ""));
        };
        if (error || !info?.valid) {
            box.className = "abo-invite warning";
            setBox("fa-link-slash", "Einladung ungültig", "Dieser Einladungslink ist ungültig oder abgelaufen. Bitte die Teamleitung um einen neuen Link.");
            if (aboUser) dropParam();
            return;
        }
        const owner = info.owner_name || "einer Teamleitung";
        if (!aboUser) {
            box.className = "abo-invite";
            setBox("fa-people-group", `Einladung ins Alliance-Team von ${owner}`,
                `Melde dich an oder registriere dich kostenlos – danach bist du automatisch im Team und hast alle Pole-Vorteile. Belegt: ${info.members} von 10 Plätzen.`,
                `<div class="abo-invite-actions">
                    <a class="abo-plan-btn" href="${loginLinkHere()}"><i class="fa-solid fa-right-to-bracket"></i> Anmelden</a>
                    <a class="abo-plan-btn ghost" href="${loginLinkHere("registrieren=1&")}"><i class="fa-solid fa-user-plus"></i> Registrieren</a>
                </div>`);
            return;
        }
        dropParam();
        if (info.is_member) {
            box.className = "abo-invite success";
            setBox("fa-circle-check", `Du bist im Team von ${owner}`, "Du nutzt bereits alle Alliance-Vorteile.");
            return;
        }
        const { error: joinError } = await aboClient.rpc("team_join", { _token: token });
        if (joinError) {
            box.className = "abo-invite warning";
            setBox("fa-triangle-exclamation", "Beitritt nicht möglich", joinError.message);
            return;
        }
        box.className = "abo-invite success";
        setBox("fa-circle-check", `Willkommen im Alliance-Team von ${owner}!`, "Du hast ab sofort alle Pole-Vorteile. Die Teamleitung übernimmt die Bezahlung.");
        showToast("Du bist jetzt im Alliance-Team.", "success");
        await loadMembership();
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

    async function init() {
        if (!aboClient || !document.querySelector("[data-plan-cards], #aboMine")) return;
        renderPlanCards();
        const { data: { session } } = await aboClient.auth.getSession();
        aboUser = session?.user || null;
        await loadMembership();
        await handleInvite();

        // Rückkehr von der Stripe-Bezahlseite
        const params = new URLSearchParams(window.location.search);
        const result = params.get("abo");
        if (!result) return;
        params.delete("abo");
        history.replaceState(null, "", window.location.pathname + (params.toString() ? `?${params}` : ""));
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
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
