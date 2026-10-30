/* =========================================
   GSRA - Admin-Bereich: Meldungen prüfen, verwarnen, sperren
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
    const client = window.supabaseClient || window.supabase;
    const gate = document.getElementById("adminGate");
    const content = document.getElementById("adminContent");
    const list = document.getElementById("adminList");
    const countOpen = document.getElementById("countOpen");
    const countBans = document.getElementById("countBans");
    if (!client || !gate) return;

    let currentTab = "offen";
    const profiles = {};

    const escapeHtml = (str) => String(str ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    const formatDate = (iso, withTime = true) => {
        const d = new Date(iso);
        const date = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
        return withTime ? `${date}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : date;
    };
    const nameOf = (id) => profiles[id]?.username || "Unbekannt";

    // --- Zugang: angemeldet und Administrator ---
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) {
        gate.innerHTML = '<i class="fa-solid fa-lock"></i> Bitte melde dich an. <a href="login.html" class="text-yellow">Zum Login</a>';
        return;
    }
    const { data: me } = await client.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
    if (me?.role !== "admin") {
        gate.innerHTML = '<i class="fa-solid fa-lock"></i> Kein Zugriff – dieser Bereich ist nur für Administratoren.';
        return;
    }
    gate.style.display = "none";
    content.style.display = "";

    document.querySelectorAll(".admin-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".admin-tab").forEach(t => t.classList.toggle("active", t === tab));
            currentTab = tab.dataset.tab;
            render();
        });
    });

    async function loadProfiles(ids) {
        const missing = [...new Set(ids)].filter(id => id && !profiles[id]);
        if (missing.length === 0) return;
        const { data } = await client.from("profiles").select("*").in("id", missing);
        (data || []).forEach(p => { profiles[p.id] = p; });
    }

    function personHtml(userId, label) {
        const p = profiles[userId] || {};
        const avatar = p.avatar_url ? `<img src="${escapeHtml(p.avatar_url)}" alt="">` : '<i class="fa-solid fa-user"></i>';
        return `
            <div class="admin-person">
                <div class="admin-avatar">${avatar}</div>
                <div>
                    <div class="admin-person-label">${escapeHtml(label)}</div>
                    <div class="admin-person-name">${escapeHtml(nameOf(userId))}${p.gsra_id ? ` <span>#${p.gsra_id}</span>` : ""}</div>
                </div>
            </div>`;
    }

    // Vorgeschichte: Verwarnungen, Sperren und weitere Meldungen der gemeldeten Person
    function historyHtml(userId, history, currentReportId) {
        const warnings = history.warnings.filter(w => w.user_id === userId).length;
        const bans = history.bans.filter(b => b.user_id === userId);
        const tempBans = bans.filter(b => b.banned_until);
        const permBans = bans.filter(b => !b.banned_until);
        const otherReports = history.reports.filter(r => r.reported_id === userId && r.id !== currentReportId).length;
        const activeBan = bans.find(b => !b.lifted_at && (!b.banned_until || new Date(b.banned_until) > new Date()));

        const parts = [];
        if (warnings) parts.push(`${warnings}x verwarnt`);
        if (tempBans.length) {
            const days = tempBans.map(b => Math.round((new Date(b.banned_until) - new Date(b.created_at)) / 86400000));
            const same = days.every(d => d === days[0]);
            parts.push(same ? `${tempBans.length}x für ${days[0]} Tage gesperrt` : `${tempBans.length}x vorübergehend gesperrt`);
        }
        if (permBans.length) parts.push(`${permBans.length}x dauerhaft gesperrt`);

        let text = parts.length ? `Achtung: Nutzer wurde bereits ${parts.join(", ").replace(/, ([^,]*)$/, " und $1")}.` : "Keine früheren Verwarnungen oder Sperren.";
        if (otherReports) text += ` Weitere Meldungen gegen diese Person: ${otherReports}.`;
        if (activeBan) text += activeBan.banned_until ? ` Aktuell gesperrt bis ${formatDate(activeBan.banned_until, false)}.` : " Aktuell dauerhaft gesperrt.";
        const warn = parts.length || otherReports || activeBan;
        return `<div class="admin-history ${warn ? "warn" : "clean"}"><i class="fa-solid ${warn ? "fa-triangle-exclamation" : "fa-circle-check"}"></i> ${escapeHtml(text)}</div>`;
    }

    // Gesprächsverlauf: gemeldete Nachricht mit je 2 Nachrichten davor und danach
    function contextHtml(report) {
        const messages = Array.isArray(report.context) ? report.context : [];
        if (messages.length === 0) {
            return '<div class="admin-context empty"><i class="fa-solid fa-comment-slash"></i> Kein Gesprächsverlauf – die Person wurde aus dem Profil gemeldet.</div>';
        }
        return `
            <div class="admin-context">
                <div class="admin-context-title"><i class="fa-solid fa-comments"></i> Gesprächsverlauf</div>
                ${messages.map(m => `
                    <div class="admin-msg${m.reported ? " reported" : ""}${m.sender_id === report.reported_id ? " by-reported" : ""}">
                        <div class="admin-msg-head">
                            <span class="admin-msg-author">${escapeHtml(m.sender_name)}</span>
                            <span class="admin-msg-time">${m.created_at ? formatDate(m.created_at) : ""}</span>
                            ${m.reported ? '<span class="admin-msg-flag"><i class="fa-solid fa-flag"></i> gemeldet</span>' : ""}
                        </div>
                        <div class="admin-msg-text">${escapeHtml(m.text && m.text !== "[Medien]" ? m.text : "")}${m.image_url ? `${m.text && m.text !== "[Medien]" ? "<br>" : ""}<span class="admin-msg-media"><i class="fa-solid fa-photo-film"></i> Medien: ${m.image_url.split(",").map((url, i) => `<a href="${escapeHtml(url.trim())}" target="_blank" rel="noopener">Datei ${i + 1}</a>`).join(", ")}</span>` : ""}</div>
                    </div>`).join("")}
            </div>`;
    }

    const STATUS_LABELS = { offen: "Offen", verwarnt: "Verwarnt", gesperrt: "Gesperrt", verworfen: "Verworfen" };

    async function updateCounts() {
        const [{ count: open }, { data: bans }] = await Promise.all([
            client.from("reports").select("id", { count: "exact", head: true }).eq("status", "offen"),
            client.from("user_bans").select("banned_until").is("lifted_at", null)
        ]);
        if (countOpen) countOpen.textContent = open ?? 0;
        if (countBans) countBans.textContent = (bans || []).filter(b => !b.banned_until || new Date(b.banned_until) > new Date()).length;
    }

    async function render() {
        list.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-spinner fa-spin"></i> Lade …</div>';
        updateCounts();
        if (currentTab === "sperren") return renderBans();

        const statuses = currentTab === "offen" ? ["offen"] : ["verwarnt", "gesperrt", "verworfen"];
        const { data: reports, error } = await client.from("reports").select("*").in("status", statuses)
            .order("created_at", { ascending: currentTab === "offen" }).limit(100);
        if (error) {
            list.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-database"></i> Die Moderations-Tabellen fehlen noch – bitte die SQL in Supabase ausführen. (${escapeHtml(error.message)})</div>`;
            return;
        }
        if (!reports || reports.length === 0) {
            list.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-mug-hot"></i> ${currentTab === "offen" ? "Keine offenen Meldungen – alles ruhig." : "Noch keine erledigten Meldungen."}</div>`;
            return;
        }

        const reportedIds = [...new Set(reports.map(r => r.reported_id))];
        await loadProfiles(reports.flatMap(r => [r.reporter_id, r.reported_id, r.resolved_by]));
        const [{ data: warnings }, { data: bans }, { data: otherReports }, { data: chats }] = await Promise.all([
            client.from("user_warnings").select("user_id, created_at").in("user_id", reportedIds),
            client.from("user_bans").select("*").in("user_id", reportedIds),
            client.from("reports").select("id, reported_id").in("reported_id", reportedIds),
            client.from("chats").select("id, title, user1_id, user2_id").in("id", reports.map(r => r.chat_id).filter(Boolean))
        ]);
        const history = { warnings: warnings || [], bans: bans || [], reports: otherReports || [] };

        list.replaceChildren(...reports.map(report => {
            const chat = (chats || []).find(c => c.id === report.chat_id);
            const where = !report.chat_id ? "aus dem Profil"
                : (chat ? (chat.user1_id === chat.user2_id ? `in der Gruppe „${chat.title}“` : "im Direktchat") : "in einem Chat");
            const card = document.createElement("article");
            card.className = `admin-report status-${report.status}`;
            card.innerHTML = `
                <header class="admin-report-head">
                    ${personHtml(report.reported_id, "Gemeldete Person")}
                    <span class="admin-status ${report.status}">${STATUS_LABELS[report.status] || report.status}</span>
                </header>
                ${historyHtml(report.reported_id, history, report.id)}
                <div class="admin-meta">
                    <span><i class="fa-solid fa-flag"></i> <strong>${escapeHtml(report.reason)}</strong></span>
                    <span><i class="fa-solid fa-user"></i> gemeldet von ${escapeHtml(report.reporter_id ? nameOf(report.reporter_id) : "gelöschtem Konto")}</span>
                    <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(where)}</span>
                    <span><i class="fa-regular fa-clock"></i> ${formatDate(report.created_at)}</span>
                </div>
                ${report.details ? `<blockquote class="admin-details">${escapeHtml(report.details)}</blockquote>` : ""}
                ${contextHtml(report)}
                <footer class="admin-actions"></footer>`;

            const actions = card.querySelector(".admin-actions");
            if (report.status === "offen") {
                const addAction = (cls, html, handler) => {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = `admin-btn ${cls}`;
                    btn.innerHTML = html;
                    btn.addEventListener("click", () => handler(report));
                    actions.appendChild(btn);
                };
                addAction("warn", '<i class="fa-solid fa-triangle-exclamation"></i> Verwarnung senden', sendWarning);
                addAction("ban", '<i class="fa-solid fa-calendar-xmark"></i> 30 Tage sperren', (r) => banUser(r, 30));
                addAction("ban-perm", '<i class="fa-solid fa-ban"></i> Permanent sperren', (r) => banUser(r, null));
                addAction("dismiss", '<i class="fa-solid fa-xmark"></i> Meldung verwerfen', dismissReport);
            } else {
                actions.innerHTML = `<span class="admin-resolved"><i class="fa-solid fa-check"></i> ${STATUS_LABELS[report.status]}${report.resolved_by ? ` von ${escapeHtml(nameOf(report.resolved_by))}` : ""}${report.resolved_at ? ` am ${formatDate(report.resolved_at)}` : ""}</span>`;
            }
            return card;
        }));
    }

    async function renderBans() {
        const { data: bans, error } = await client.from("user_bans").select("*").is("lifted_at", null).order("created_at", { ascending: false });
        if (error) {
            list.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-database"></i> Die Moderations-Tabellen fehlen noch – bitte die SQL in Supabase ausführen.</div>`;
            return;
        }
        const active = (bans || []).filter(b => !b.banned_until || new Date(b.banned_until) > new Date());
        if (active.length === 0) {
            list.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-circle-check"></i> Zurzeit ist kein Konto gesperrt.</div>';
            return;
        }
        await loadProfiles(active.flatMap(b => [b.user_id, b.created_by]));
        list.replaceChildren(...active.map(ban => {
            const card = document.createElement("article");
            card.className = "admin-report status-gesperrt";
            card.innerHTML = `
                <header class="admin-report-head">
                    ${personHtml(ban.user_id, "Gesperrtes Konto")}
                    <span class="admin-status gesperrt">${ban.banned_until ? `bis ${formatDate(ban.banned_until, false)}` : "dauerhaft"}</span>
                </header>
                <div class="admin-meta">
                    ${ban.reason ? `<span><i class="fa-solid fa-flag"></i> <strong>${escapeHtml(ban.reason)}</strong></span>` : ""}
                    <span><i class="fa-solid fa-user-shield"></i> gesperrt von ${escapeHtml(ban.created_by ? nameOf(ban.created_by) : "–")}</span>
                    <span><i class="fa-regular fa-clock"></i> ${formatDate(ban.created_at)}</span>
                </div>
                <footer class="admin-actions"></footer>`;
            const lift = document.createElement("button");
            lift.type = "button";
            lift.className = "admin-btn dismiss";
            lift.innerHTML = '<i class="fa-solid fa-unlock"></i> Sperre aufheben';
            lift.addEventListener("click", () => liftBan(ban));
            card.querySelector(".admin-actions").appendChild(lift);
            return card;
        }));
    }

    // --- Aktionen ---
    async function runAction(promise, successMessage) {
        const { error } = await promise;
        if (error) {
            showToast(error.message, "error");
            return;
        }
        showToast(successMessage, "success");
        render();
    }

    async function sendWarning(report) {
        const name = nameOf(report.reported_id);
        const text = await showDialog({
            icon: "fa-triangle-exclamation",
            title: `${name} verwarnen`,
            message: "Die Verwarnung erscheint fest oben in den Chats der Person, bis sie bestätigt wurde. Du kannst den Text anpassen:",
            input: {
                multiline: true,
                maxLength: 2000,
                value: `Hallo ${name}, dein Verhalten im Messenger verstößt gegen die Regeln der GSRA (Grund: ${report.reason}). Bitte achte künftig auf einen respektvollen Umgang. Bei weiteren Verstößen kann dein Konto gesperrt werden. – Dein GSRA-Team`
            },
            confirmText: "Verwarnung senden",
            cancelText: "Abbrechen"
        });
        if (!text) return;
        runAction(client.rpc("admin_warn_user", { _report_id: report.id, _text: text }), `${name} wurde verwarnt.`);
    }

    async function banUser(report, days) {
        const name = nameOf(report.reported_id);
        const confirmed = await showDialog({
            icon: "fa-ban",
            title: days ? `${name} für ${days} Tage sperren?` : `${name} dauerhaft sperren?`,
            message: days
                ? `Das Konto wird sofort für ${days} Tage gesperrt: keine Anmeldung und keine Nutzung der Webseite.`
                : "Das Konto wird sofort und dauerhaft gesperrt: keine Anmeldung und keine Nutzung der Webseite. Aufheben kannst du das unter „Gesperrte Konten“.",
            confirmText: days ? `${days} Tage sperren` : "Dauerhaft sperren",
            cancelText: "Abbrechen",
            danger: true
        });
        if (!confirmed) return;
        runAction(client.rpc("admin_ban_user", { _report_id: report.id, _days: days }), days ? `${name} ist für ${days} Tage gesperrt.` : `${name} ist dauerhaft gesperrt.`);
    }

    async function dismissReport(report) {
        const confirmed = await showDialog({
            icon: "fa-xmark",
            title: "Meldung verwerfen?",
            message: "Die Meldung wird ohne Folgen für die gemeldete Person geschlossen.",
            confirmText: "Verwerfen",
            cancelText: "Abbrechen"
        });
        if (!confirmed) return;
        runAction(client.rpc("admin_dismiss_report", { _report_id: report.id }), "Die Meldung wurde verworfen.");
    }

    async function liftBan(ban) {
        const name = nameOf(ban.user_id);
        const confirmed = await showDialog({
            icon: "fa-unlock",
            title: `Sperre von ${name} aufheben?`,
            message: "Die Person kann sich danach sofort wieder anmelden und die Webseite nutzen.",
            confirmText: "Sperre aufheben",
            cancelText: "Abbrechen"
        });
        if (!confirmed) return;
        runAction(client.rpc("admin_lift_ban", { _user: ban.user_id }), `Die Sperre von ${name} wurde aufgehoben.`);
    }

    render();
});
