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

    // Links zu Chat-Anhängen (privater Speicher, SQL 032): kurzlebige Adresse holen, sobald sie angezeigt werden;
    // beim Klick auf einen abgelaufenen Link wird sie neu geholt
    if (list && window.gsraChatMedia) {
        const media = window.gsraChatMedia;
        const signLinks = async () => {
            const links = [...list.querySelectorAll("a[data-chat-media]:not([data-signed])")];
            if (!links.length) return;
            links.forEach(a => { a.dataset.signed = String(Date.now()); });
            await media.sign(links.map(a => a.dataset.chatMedia));
            links.forEach(a => { a.href = media.url(a.dataset.chatMedia); });
        };
        new MutationObserver(signLinks).observe(list, { childList: true, subtree: true });
        list.addEventListener("click", async (e) => {
            const a = e.target.closest("a[data-chat-media]");
            if (!a || !media.pathOf(a.dataset.chatMedia)) return;
            if (Date.now() - Number(a.dataset.signed || 0) < 90 * 60 * 1000 && a.href !== a.dataset.chatMedia) return;
            e.preventDefault();
            a.href = await media.signOne(a.dataset.chatMedia);
            a.dataset.signed = String(Date.now());
            window.open(a.href, "_blank", "noopener");
        });
    }

    // --- Zugang: angemeldet und Administrator ---
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) {
        gate.innerHTML = '<i class="fa-solid fa-lock"></i> Bitte melde dich an. <a href="login.html" class="text-yellow">Zum Login</a>';
        return;
    }
    const { data: me } = await client.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
    if (!["admin", "moderator"].includes(me?.role)) {
        gate.innerHTML = '<i class="fa-solid fa-lock"></i> Kein Zugriff – dieser Bereich ist nur für das Moderationsteam.';
        return;
    }
    // Admins: alles; Moderatoren: Meldungen, Verwarnungen, Sperren bis 30 Tage (die Datenbank prüft das zusätzlich)
    const isAdmin = me.role === "admin";
    if (isAdmin) document.querySelectorAll('.admin-tab[data-tab="team"], .admin-tab[data-tab="protokoll"], .admin-tab[data-tab="fehler"]').forEach(t => { t.hidden = false; });
    // Zweiter Faktor ist Pflicht: Einrichten bzw. Code bestätigen, erst dann gibt die Datenbank Admin-Rechte frei
    if (!window.gsraMfa || !(await window.gsraMfa.requireForAdmin(client, gate))) return;
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

    // Gesprächsverlauf: gemeldete Nachrichten hervorgehoben, dazu der Verlauf im Zeitfenster –
    // gelöschte und bearbeitete Nachrichten mit ihrem Originalinhalt (Beweissicherung)
    const DELETED_TEXTS = ["Du hast diese Nachricht gelöscht", "Diese Nachricht wurde gelöscht", "Diese Nachricht wurde von einem Gruppenadmin gelöscht"];

    // Gemeldetes Inserat: Kopie zum Zeitpunkt der Meldung (auch wenn es danach geändert oder gelöscht wurde)
    function listingHtml(listing) {
        const images = Array.isArray(listing.images) ? listing.images : [];
        return `
            <div class="admin-context">
                <div class="admin-context-title"><i class="fa-solid fa-tags"></i> Gemeldetes Inserat
                    <span class="admin-context-range">Kopie vom Zeitpunkt der Meldung</span>
                </div>
                <div class="admin-msg">
                    <strong>${escapeHtml(listing.title || "Ohne Titel")}</strong> · ${escapeHtml(String(listing.price ?? ""))} €
                    · ${escapeHtml([listing.category, listing.subcategory].filter(Boolean).join(" › "))}${listing.location ? ` · ${escapeHtml(listing.location)}` : ""}
                    <div class="admin-msg-text">${escapeHtml(listing.description || "")}</div>
                    ${images.length ? `<span class="admin-msg-media"><i class="fa-solid fa-image"></i> Bilder: ${images.map((url, i) => `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener">Bild ${i + 1}</a>`).join(", ")}</span>` : ""}
                    <span class="admin-msg-media"><i class="fa-solid fa-arrow-up-right-from-square"></i> <a href="marktplatz.html?inserat=${encodeURIComponent(listing.listing_id || "")}" target="_blank" rel="noopener">Inserat im Marktplatz öffnen (dort als Admin löschbar)</a></span>
                </div>
            </div>`;
    }

    function contextHtml(report) {
        if (report.scope === "zeitraum") return windowHtml(report);
        if (report.scope === "inserat" && report.context && !Array.isArray(report.context)) return listingHtml(report.context);
        const messages = Array.isArray(report.context) ? report.context : [];
        if (messages.length === 0) {
            return `<div class="admin-context empty"><i class="fa-solid fa-comment-slash"></i> Kein Gesprächsverlauf – die Person wurde ${report.chat_id ? "ohne Nachrichten im Chat" : "ohne Chatbezug (z. B. aus dem Profil)"} gemeldet.</div>`;
        }
        const deletedCount = messages.filter(m => m.deleted).length;
        const range = report.whole_chat ? "Ganzer Chat (letzte 150 Nachrichten)"
            : (report.window_from ? `Zeitfenster ${formatDate(report.window_from)} – ${formatDate(report.window_to)}` : "Gemeldete Nachricht mit Verlauf");
        return `
            <div class="admin-context">
                <div class="admin-context-title"><i class="fa-solid fa-comments"></i> Gesprächsverlauf
                    <span class="admin-context-range">${escapeHtml(range)} · ${messages.length} Nachrichten${deletedCount ? ` · ${deletedCount} gelöscht` : ""}</span>
                </div>
                ${messages.map(m => messageHtml(m, report)).join("")}
            </div>`;
    }

    // Nur echte Webadressen verlinken (kein „javascript:“ o. Ä. aus manipulierten Nachrichten)
    const safeUrl = (url) => (/^https?:\/\//i.test(String(url || "").trim()) ? String(url).trim() : "#");

    // Anhänge liegen privat (SQL 032): die Links bekommen ihre kurzlebige Adresse beim Anzeigen (signMediaLinks)
    const mediaLink = (url, label) => `<a href="${escapeHtml(safeUrl(url))}" data-chat-media="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener">${label}</a>`;
    function mediaHtml(imageUrl, audioUrl, transcript) {
        let html = "";
        if (imageUrl) html += `<span class="admin-msg-media"><i class="fa-solid fa-photo-film"></i> Medien: ${imageUrl.split(",").map((url, i) => mediaLink(url.trim(), `Datei ${i + 1}`)).join(", ")}</span>`;
        if (audioUrl) html += `<span class="admin-msg-media"><i class="fa-solid fa-microphone"></i> ${mediaLink(audioUrl, "Sprachnachricht anhören")}</span>`;
        if (transcript) html += `<span class="admin-msg-transcript"><i class="fa-solid fa-closed-captioning"></i> „${escapeHtml(transcript)}“</span>`;
        return html;
    }

    function messageHtml(m, report) {
        const history = Array.isArray(m.history) ? m.history : [];
        const textOf = (text) => (text && text !== "[Medien]" && !/^🎤 Sprachnachricht/.test(text) ? escapeHtml(text) : "");
        let body;
        if (m.deleted) {
            // Original: letzter gesicherter Stand vor dem Löschen
            const original = !DELETED_TEXTS.includes(m.text) ? m : [...history].reverse().find(h => !DELETED_TEXTS.includes(h.text));
            const label = m.hard_deleted ? "endgültig gelöscht" : (m.text === DELETED_TEXTS[2] ? "von einem Gruppenadmin gelöscht" : "vom Absender gelöscht");
            body = `<div class="admin-msg-deleted"><i class="fa-solid fa-trash"></i> ${label}</div>`
                + (original
                    ? `<div class="admin-msg-original"><span>Original:</span> ${textOf(original.text)}${mediaHtml(original.image_url, original.audio_url, original.transcript)}</div>`
                    : '<div class="admin-msg-original missing">Original nicht gesichert (vor Einführung der Beweissicherung gelöscht).</div>');
        } else {
            body = `${textOf(m.text)}${mediaHtml(m.image_url, m.audio_url, m.transcript)}`
                + history.filter(h => h.change_type === "bearbeitet")
                    .map(h => `<div class="admin-msg-original"><span>Vor der Bearbeitung:</span> ${textOf(h.text)}</div>`).join("");
        }
        return `
            <div class="admin-msg${m.reported ? " reported" : ""}${m.sender_id === report.reported_id ? " by-reported" : ""}${m.deleted ? " deleted" : ""}">
                <div class="admin-msg-head">
                    <span class="admin-msg-author">${escapeHtml(m.sender_name)}</span>
                    <span class="admin-msg-time">${m.created_at ? formatDate(m.created_at) : ""}</span>
                    ${m.reported ? '<span class="admin-msg-flag"><i class="fa-solid fa-flag"></i> gemeldet</span>' : ""}
                </div>
                <div class="admin-msg-text">${body}</div>
            </div>`;
    }

    // Gemeldeter Zeitraum (z. B. in großen Foren): Die Nachrichten werden nicht kopiert, sondern bei der Prüfung
    // direkt geladen – seitenweise, inklusive gelöschter Nachrichten mit Originalinhalt
    function windowHtml(report) {
        return `
            <div class="admin-context admin-window">
                <div class="admin-context-title"><i class="fa-solid fa-calendar-days"></i> Gemeldeter Zeitraum
                    <span class="admin-context-range">${escapeHtml(`${formatDate(report.window_from)} – ${formatDate(report.window_to)}`)}</span>
                </div>
                <div class="admin-window-tools">
                    <label><input type="checkbox" class="admin-window-only"> Nur Nachrichten der gemeldeten Person</label>
                    <span class="admin-window-count"></span>
                </div>
                <div class="admin-window-list"></div>
                <button type="button" class="admin-btn dismiss admin-window-more"><i class="fa-solid fa-comments"></i> Nachrichten im Zeitraum anzeigen</button>
            </div>`;
    }

    function setupWindowView(card, report) {
        const box = card.querySelector(".admin-window");
        if (!box) return;
        const messageList = box.querySelector(".admin-window-list");
        const more = box.querySelector(".admin-window-more");
        const only = box.querySelector(".admin-window-only");
        const count = box.querySelector(".admin-window-count");
        const PAGE = 100;
        let after = null;
        let total = 0;
        let loading = false;
        const load = async (reset) => {
            if (loading) return;
            loading = true;
            if (reset) {
                after = null;
                total = 0;
                messageList.replaceChildren();
            }
            more.hidden = false;
            more.disabled = true;
            more.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Lade …';
            const { data, error } = await client.rpc("admin_report_window", { _report_id: report.id, _after: after, _limit: PAGE, _only_reported: only.checked });
            loading = false;
            more.disabled = false;
            if (error) {
                more.innerHTML = '<i class="fa-solid fa-rotate"></i> Erneut versuchen';
                showToast(error.message, "error");
                return;
            }
            const rows = data || [];
            messageList.insertAdjacentHTML("beforeend", rows.map(m => messageHtml(m, report)).join(""));
            total += rows.length;
            if (rows.length) after = rows[rows.length - 1].created_at;
            count.textContent = `${total} ${total === 1 ? "Nachricht" : "Nachrichten"} geladen`;
            more.innerHTML = `<i class="fa-solid fa-angles-down"></i> Weitere ${PAGE} Nachrichten laden`;
            more.hidden = rows.length < PAGE;
            if (total === 0) messageList.innerHTML = '<div class="admin-context empty"><i class="fa-solid fa-comment-slash"></i> In diesem Zeitraum gibt es keine Nachrichten.</div>';
        };
        more.addEventListener("click", () => load(false));
        only.addEventListener("change", () => load(true));
    }

    const STATUS_LABELS = { offen: "Offen", verwarnt: "Verwarnt", gesperrt: "Gesperrt", verworfen: "Verworfen" };

    async function updateCounts() {
        const [{ count: open }, { data: bans }] = await Promise.all([
            client.from("reports").select("id", { count: "exact", head: true }).eq("status", "offen"),
            client.from("user_bans").select("banned_until").is("lifted_at", null)
        ]);
        if (countOpen) countOpen.textContent = open ?? 0;
        if (countBans) countBans.textContent = (bans || []).filter(b => !b.banned_until || new Date(b.banned_until) > new Date()).length;
        // Coaching-Fälle, die eine Entscheidung brauchen (Widerspruch oder 48 Stunden vorbei) – ohne SQL 035 einfach keine
        const countDisputes = document.getElementById("countDisputes");
        if (countDisputes) {
            const { data: open35 } = await client.from("coaching_disputes").select("status, respond_until").in("status", ["offen", "widerspruch"]);
            const due = (open35 || []).filter(d => d.status === "widerspruch" || new Date(d.respond_until) < new Date()).length;
            countDisputes.hidden = !due;
            countDisputes.textContent = due;
        }
    }

    async function render() {
        list.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-spinner fa-spin"></i> Lade …</div>';
        updateCounts();
        if (currentTab === "sperren") return renderBans();
        if (currentTab === "coaching") return renderDisputes();
        if (currentTab === "team" && isAdmin) return renderTeam();
        if (currentTab === "protokoll" && isAdmin) return renderLog();
        if (currentTab === "fehler" && isAdmin) return renderErrors();
        // Team, Protokoll und Fehler sind Admin-Bereiche – nie stattdessen die Meldungen zeigen
        if (currentTab === "team" || currentTab === "protokoll" || currentTab === "fehler") {
            list.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-lock"></i> Dieser Bereich ist nur für Administratoren.</div>';
            return;
        }

        const statuses = currentTab === "offen" ? ["offen"] : ["verwarnt", "gesperrt", "verworfen"];
        let query = client.from("reports").select("*").in("status", statuses);
        // Erledigte Meldungen verschwinden nach zwei Wochen aus der Liste (in der Datenbank bleiben sie als Nachweis)
        if (currentTab !== "offen") query = query.gte("resolved_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
        const { data: reports, error } = await query.order("created_at", { ascending: currentTab === "offen" }).limit(100);
        if (error) {
            list.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-database"></i> Die Moderations-Tabellen fehlen noch – bitte die SQL in Supabase ausführen. (${escapeHtml(error.message)})</div>`;
            return;
        }
        if (!reports || reports.length === 0) {
            list.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-mug-hot"></i> ${currentTab === "offen" ? "Keine offenen Meldungen – alles ruhig." : "Keine erledigten Meldungen in den letzten 14 Tagen."}</div>`;
            return;
        }

        const reportedIds = [...new Set(reports.map(r => r.reported_id))];
        await loadProfiles(reports.flatMap(r => [r.reporter_id, r.reported_id, r.resolved_by]));
        const [{ data: warnings }, { data: bans }, { data: otherReports }, { data: chats }] = await Promise.all([
            client.from("user_warnings").select("user_id, created_at").in("user_id", reportedIds),
            client.from("user_bans").select("*").in("user_id", reportedIds),
            client.from("reports").select("id, reported_id").in("reported_id", reportedIds),
            client.from("chats").select("id, title, user1_id, user2_id").in("id", reports.map(r => r.chat_id || r.window_chat_id).filter(Boolean))
        ]);
        const history = { warnings: warnings || [], bans: bans || [], reports: otherReports || [] };

        list.replaceChildren(...reports.map(report => {
            const chatRef = report.chat_id || report.window_chat_id;
            const chat = (chats || []).find(c => c.id === chatRef);
            const where = report.scope === "inserat" ? "im Marktplatz (Inserat)"
                : !chatRef ? "aus dem Profil"
                : (chat ? (chat.user1_id === chat.user2_id ? `in der Gruppe „${chat.title}“` : "im Direktchat") : "in einem inzwischen gelöschten Chat");
            const card = document.createElement("article");
            card.className = `admin-report status-${report.status}`;
            card.innerHTML = `
                <div class="admin-report-head">
                    ${personHtml(report.reported_id, "Gemeldete Person")}
                    <span class="admin-status ${report.status}">${STATUS_LABELS[report.status] || report.status}</span>
                </div>
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

            if (report.scope === "zeitraum") setupWindowView(card, report);
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
                if (isAdmin) addAction("ban-perm", '<i class="fa-solid fa-ban"></i> Permanent sperren', (r) => banUser(r, null));
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
                <div class="admin-report-head">
                    ${personHtml(ban.user_id, "Gesperrtes Konto")}
                    <span class="admin-status gesperrt">${ban.banned_until ? `bis ${formatDate(ban.banned_until, false)}` : "dauerhaft"}</span>
                </div>
                <div class="admin-meta">
                    ${ban.reason ? `<span><i class="fa-solid fa-flag"></i> <strong>${escapeHtml(ban.reason)}</strong></span>` : ""}
                    <span><i class="fa-solid fa-user-shield"></i> gesperrt von ${escapeHtml(ban.created_by ? nameOf(ban.created_by) : "–")}</span>
                    <span><i class="fa-regular fa-clock"></i> ${formatDate(ban.created_at)}</span>
                </div>
                <footer class="admin-actions"></footer>`;
            // Dauerhafte Sperren hebt nur ein Admin auf
            if (isAdmin || ban.banned_until) {
                const lift = document.createElement("button");
                lift.type = "button";
                lift.className = "admin-btn dismiss";
                lift.innerHTML = '<i class="fa-solid fa-unlock"></i> Sperre aufheben';
                lift.addEventListener("click", () => liftBan(ban));
                card.querySelector(".admin-actions").appendChild(lift);
            } else {
                card.querySelector(".admin-actions").innerHTML = '<span class="admin-resolved"><i class="fa-solid fa-lock"></i> Dauerhafte Sperre – aufheben kann nur ein Admin</span>';
            }
            return card;
        }));
    }

    // --- Team (nur Admins): Moderatoren ernennen und entfernen ---
    const ROLE_LABELS = { admin: "Admin", moderator: "Moderator", user: "Mitglied" };
    async function renderTeam() {
        const { data: team, error } = await client.from("profiles").select("id, username, gsra_id, role, avatar_url")
            .in("role", ["admin", "moderator"]).order("role").order("username");
        if (error) {
            list.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-database"></i> Das Team konnte nicht geladen werden. (${escapeHtml(error.message)})</div>`;
            return;
        }
        (team || []).forEach(p => { profiles[p.id] = p; });
        const intro = document.createElement("article");
        intro.className = "admin-report admin-team-intro";
        intro.innerHTML = `
            <p><strong>Moderatoren</strong> bearbeiten Meldungen, verwarnen und sperren bis zu 30 Tage. Dauerhafte Sperren, Rollen, Events
            und das Löschen fremder Inhalte bleiben Admins vorbehalten. Beim ersten Besuch richten Moderatoren die Zwei-Faktor-Anmeldung ein.</p>
            <form class="admin-team-form" autocomplete="off">
                <input type="text" inputmode="numeric" placeholder="GSRA-ID, z. B. 100123" maxlength="12" required>
                <button type="submit" class="admin-btn warn"><i class="fa-solid fa-user-plus"></i> Zum Moderator ernennen</button>
            </form>
            <p class="admin-team-note">Neue Admins lassen sich aus Sicherheitsgründen nur im Supabase SQL Editor ernennen.</p>
            <p><strong>Coach-Lizenz</strong> entziehen (mit Begründung, Angebote werden pausiert) oder wiederherstellen.
            Verwarnungen und Sperren entziehen die Lizenz automatisch. <strong>Dauerhaft sperren</strong> (nur Admins): Die Person kann nie wieder
            Coach werden, offene Anfragen enden, bezahlte künftige Termine werden voll erstattet, der Coach bekommt die Begründung per E-Mail.
            Aufheben lässt sich das nur hier über „Wiederherstellen“.</p>
            <form class="admin-team-form admin-license-form" autocomplete="off">
                <input type="text" inputmode="numeric" placeholder="GSRA-ID" maxlength="12" required>
                <input type="text" placeholder="Begründung (nicht beim Wiederherstellen)" maxlength="300">
                <button type="submit" class="admin-btn warn" data-license="revoke"><i class="fa-solid fa-ban"></i> Lizenz entziehen</button>
                <button type="submit" class="admin-btn ban" data-license="ban"><i class="fa-solid fa-user-lock"></i> Dauerhaft sperren</button>
                <button type="submit" class="admin-btn dismiss" data-license="restore"><i class="fa-solid fa-rotate-left"></i> Wiederherstellen</button>
            </form>
            <p><strong>Pro-Fahrer</strong> veröffentlichen Pro Setups und erscheinen im Coaching oben als Pro-Coaches (ohne Lizenz).</p>
            <form class="admin-team-form admin-pro-form" autocomplete="off">
                <input type="text" inputmode="numeric" placeholder="GSRA-ID" maxlength="12" required>
                <button type="submit" class="admin-btn warn"><i class="fa-solid fa-crown"></i> Zum Pro-Fahrer machen</button>
            </form>
            <div class="admin-pro-list"></div>`;
        // Pro-Fahrer: Liste mit Entfernen, Hinzufügen per GSRA-ID (Änderungen stehen im Protokoll)
        const proList = intro.querySelector(".admin-pro-list");
        const renderPros = async () => {
            const { data: pros, error: proError } = await client.from("pro_creators").select("user_id, added_at").order("added_at");
            if (proError) { proList.textContent = "Die Pro-Fahrer konnten nicht geladen werden."; return; }
            await loadProfiles((pros || []).map(p => p.user_id));
            proList.replaceChildren();
            if (!pros?.length) { proList.innerHTML = '<p class="admin-team-note">Noch keine Pro-Fahrer.</p>'; return; }
            pros.forEach(p => {
                const row = document.createElement("div");
                row.className = "admin-pro-row";
                row.innerHTML = `${personHtml(p.user_id, "Pro-Fahrer")}<button type="button" class="admin-btn dismiss"><i class="fa-solid fa-user-minus"></i> Entfernen</button>`;
                row.querySelector("button").addEventListener("click", async () => {
                    const ok = await showDialog({ icon: "fa-user-minus", title: `${nameOf(p.user_id)} als Pro-Fahrer entfernen?`,
                        message: "Pro Setups und der Pro-Bereich im Coaching entfallen. Mit eigener Coach-Lizenz bleiben normale Coachings möglich.", confirmText: "Entfernen", cancelText: "Abbrechen" });
                    if (!ok) return;
                    const { error: delError } = await client.from("pro_creators").delete().eq("user_id", p.user_id);
                    if (delError) return showToast(delError.message, "error");
                    showToast(`${nameOf(p.user_id)} ist kein Pro-Fahrer mehr.`, "success");
                    renderPros();
                });
                proList.appendChild(row);
            });
        };
        intro.querySelector(".admin-pro-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const gsraId = Number(String(e.target.querySelector("input").value).replace(/[^\d]/g, ""));
            if (!gsraId) return showToast("Bitte gib eine GSRA-ID ein.", "error");
            const { data: target } = await client.from("profiles").select("id, username").eq("gsra_id", gsraId).maybeSingle();
            if (!target) return showToast("Zu dieser GSRA-ID gibt es kein Konto.", "error");
            const { error: addError } = await client.from("pro_creators").insert({ user_id: target.id });
            if (addError) return showToast(/duplicate|unique/i.test(addError.message) ? `${target.username} ist bereits Pro-Fahrer.` : addError.message, "error");
            showToast(`${target.username} ist jetzt Pro-Fahrer.`, "success");
            e.target.reset();
            renderPros();
        });
        renderPros();
        // Coach-Lizenz per GSRA-ID entziehen oder wiederherstellen
        intro.querySelector(".admin-license-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const [idInput, reasonInput] = e.target.querySelectorAll("input");
            const gsraId = Number(String(idInput.value).replace(/[^\d]/g, ""));
            if (!gsraId) return showToast("Bitte gib eine GSRA-ID ein.", "error");
            const { data: target } = await client.from("profiles").select("id, username").eq("gsra_id", gsraId).maybeSingle();
            if (!target) return showToast("Zu dieser GSRA-ID gibt es kein Konto.", "error");
            const restore = e.submitter?.dataset.license === "restore";
            if (e.submitter?.dataset.license === "ban") {
                if (await banCoachPermanently(target.id, target.username, reasonInput.value.trim())) e.target.reset();
                return;
            }
            const { error } = restore
                ? await client.rpc("coach_license_restore", { _user: target.id })
                : await client.rpc("coach_license_revoke", { _user: target.id, _reason: reasonInput.value.trim() });
            if (error) return showToast(error.message, "error");
            showToast(restore ? `Coach-Lizenz von ${target.username} wiederhergestellt.` : `Coach-Lizenz von ${target.username} entzogen.`, "success");
            e.target.reset();
        });
        intro.querySelector("form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = Number(String(e.target.querySelector("input").value).replace(/[^\d]/g, ""));
            if (!id) return showToast("Bitte gib eine GSRA-ID ein.", "error");
            const { data: name, error } = await client.rpc("admin_set_role", { _gsra_id: id, _role: "moderator" });
            if (error) return showToast(error.message, "error");
            showToast(`${name || "Das Konto"} ist jetzt Moderator.`, "success");
            render();
        });
        const cards = (team || []).map(p => {
            const card = document.createElement("article");
            card.className = "admin-report";
            card.innerHTML = `
                <div class="admin-report-head">
                    ${personHtml(p.id, ROLE_LABELS[p.role] || p.role)}
                    <span class="admin-status ${p.role === "admin" ? "gesperrt" : "verwarnt"}">${ROLE_LABELS[p.role] || p.role}</span>
                </div>
                <footer class="admin-actions"></footer>`;
            if (p.role === "moderator" && p.id !== session.user.id) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "admin-btn dismiss";
                btn.innerHTML = '<i class="fa-solid fa-user-minus"></i> Moderator-Rolle entziehen';
                btn.addEventListener("click", async () => {
                    const ok = await showDialog({ icon: "fa-user-minus", title: `${p.username} die Moderator-Rolle entziehen?`,
                        message: "Die Person ist danach wieder ein normales Mitglied ohne Zugang zur Moderation.", confirmText: "Rolle entziehen", cancelText: "Abbrechen" });
                    if (!ok) return;
                    runAction(client.rpc("admin_set_role", { _gsra_id: p.gsra_id, _role: "user" }), `${p.username} ist kein Moderator mehr.`);
                });
                card.querySelector(".admin-actions").appendChild(btn);
            }
            return card;
        });
        list.replaceChildren(intro, ...cards);
    }

    // --- Protokoll (nur Admins): wer hat wann was getan ---
    // Coaching-Fälle (SQL 035/036): Reklamationen mit Widerspruch oder nach Ablauf der 5 Tage entscheiden
    const euroText = (cents) => (Number(cents || 0) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    const DISPUTE_REASON_TEXT = { nicht_erschienen: "Coach ist nicht erschienen", mangelhaft: "Coaching war mangelhaft", sonstiges: "Etwas anderes",
        coach_gesperrt: "Coach dauerhaft gesperrt – Termin entfällt" };

    // Dauerhafte Coach-Sperre (SQL 036, nur Admins mit Zwei-Faktor): Lizenz nie wieder, Anfragen enden, Bezahltes wird erstattet
    async function banCoachPermanently(userId, name, presetReason = "") {
        const reason = await showDialog({
            icon: "fa-user-lock", danger: true, title: `${name} dauerhaft als Coach sperren?`,
            message: "Die Person kann mit diesem Konto nie wieder Coach werden – egal wie lange sie wartet oder wie gut sie bewertet wird. "
                + "Angebote werden pausiert, offene Anfragen abgelehnt, angenommene storniert und bezahlte künftige Termine voll erstattet. "
                + "Das Konto selbst bleibt nutzbar. Die Begründung bekommt der Coach per E-Mail.",
            input: { placeholder: "Begründung (mindestens 10 Zeichen), z. B. Beleidigungen im Coaching", maxLength: 300, multiline: true, value: presetReason },
            confirmText: "Dauerhaft sperren", cancelText: "Abbrechen"
        });
        if (!reason) return false;
        const { data, error } = await client.rpc("coach_ban_permanent", { _user: userId, _reason: reason });
        if (error) {
            showToast(error.message, "error");
            return false;
        }
        // Erstattungen gleich bei Stripe ausführen (sonst übernimmt es der Zeitplan in spätestens 15 Minuten)
        if (data?.erstattungen) await client.functions.invoke("coaching-refund", { body: { action: "reklamationen" } }).catch(() => null);
        showToast(`${name} ist dauerhaft als Coach gesperrt. ${data?.abgelehnt || 0} Anfragen abgelehnt, ${data?.storniert || 0} storniert, ${data?.erstattungen || 0} Termine werden erstattet.`, "success");
        return true;
    }
    const DISPUTE_STATUS_TEXT = { offen: "Coach hat noch Zeit", widerspruch: "Widerspruch", erstattung: "Erstattung läuft", erstattet: "Erstattet", teilweise_erstattet: "Teilweise erstattet", abgelehnt: "Abgelehnt" };

    async function renderDisputes() {
        const { data: disputes, error } = await client.from("coaching_disputes").select("*").order("created_at", { ascending: false }).limit(100);
        if (error) {
            list.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-database"></i> Die Reklamationen fehlen noch – bitte 035_coaching_reklamation.sql in Supabase ausführen.</div>';
            return;
        }
        if (!disputes?.length) {
            list.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-scale-balanced"></i> Keine Coaching-Reklamationen.</div>';
            return;
        }
        const { data: bookings } = await client.from("coaching_bookings").select("*").in("id", disputes.map(d => d.booking_id));
        const bookingOf = new Map((bookings || []).map(b => [b.id, b]));
        await loadProfiles(disputes.flatMap(d => [d.buyer_id, d.coach_id]));
        const now = Date.now();
        const needsDecision = (d) => d.status === "widerspruch" || (d.status === "offen" && new Date(d.respond_until).getTime() < now);
        const groups = [
            ["fa-gavel", "Zu entscheiden", disputes.filter(needsDecision)],
            ["fa-hourglass-half", "Coach hat noch Zeit (5 Tage)", disputes.filter(d => d.status === "offen" && !needsDecision(d))],
            ["fa-check-double", "Abgeschlossen", disputes.filter(d => !["offen", "widerspruch"].includes(d.status))]
        ];
        const box = document.createElement("div");
        box.className = "admin-disputes";
        const intro = document.createElement("p");
        intro.className = "admin-errors-head";
        intro.innerHTML = '<span><i class="fa-solid fa-circle-info"></i> Regeln: Kunden melden bis 7 Tage nach dem Termin. Der Coach hat 5 Tage zum Erstatten oder Widersprechen (E-Mail, Hinweis auf jeder Seite, Erinnerung 24 Std. vor Fristende); „nicht erschienen“ ohne Antwort wird automatisch erstattet. Entscheidet fair und begründet – beide Seiten bekommen die Begründung per E-Mail. Bei schweren Fällen (Beleidigungen, Drohungen) können Admins den Coach dauerhaft sperren.</span>';
        box.appendChild(intro);
        groups.forEach(([icon, title, items]) => {
            if (!items.length) return;
            const h = document.createElement("h3");
            h.className = "admin-dispute-group";
            h.innerHTML = `<i class="fa-solid ${icon}"></i> `;
            h.append(`${title} (${items.length})`);
            box.appendChild(h);
            items.forEach(d => box.appendChild(disputeCard(d, bookingOf.get(d.booking_id), needsDecision(d))));
        });
        list.replaceChildren(box);
    }

    function disputeCard(d, b, decide) {
        const card = document.createElement("div");
        card.className = `admin-dispute ${d.status}`;
        const total = b?.total_cents || 0;
        const row = (icon, label, value) => `<span><i class="fa-solid ${icon}"></i> ${escapeHtml(label)}: ${escapeHtml(value)}</span>`;
        card.innerHTML = `
            <div class="admin-dispute-head">
                <strong></strong>
                <span class="admin-dispute-status">${escapeHtml(DISPUTE_STATUS_TEXT[d.status] || d.status)}</span>
            </div>
            <div class="admin-error-meta">
                ${row("fa-user", "Kunde", nameOf(d.buyer_id))}
                ${row("fa-chalkboard-user", "Coach", nameOf(d.coach_id))}
                ${row("fa-euro-sign", "Bezahlt", euroText(total))}
                ${row("fa-calendar-check", "Termin", b?.scheduled_at ? formatDate(b.scheduled_at) : "–")}
                ${row("fa-flag-checkered", "Als erledigt gemeldet", b?.completed_at ? formatDate(b.completed_at) : "nein")}
                ${row("fa-flag", "Gemeldet", formatDate(d.created_at))}
                ${d.status === "offen" ? row("fa-hourglass-half", "Frist des Coaches", formatDate(d.respond_until)) : ""}
            </div>
            <div class="admin-dispute-reason"></div>
            <div class="admin-msg-original admin-dispute-buyer"><span>Kunde:</span> </div>
            ${d.coach_statement ? '<div class="admin-msg-original admin-dispute-coach"><span>Coach:</span> </div>' : '<div class="admin-msg-original missing">Der Coach hat nicht geantwortet.</div>'}
            ${d.decision && !["offen", "widerspruch"].includes(d.status) ? `<div class="admin-dispute-decision"><i class="fa-solid fa-gavel"></i> ${escapeHtml(d.decision)}${d.refund_cents ? ` (${escapeHtml(euroText(d.refund_cents))})` : ""}</div>` : ""}`;
        card.querySelector(".admin-dispute-head strong").textContent = b?.offer_title || "Coaching";
        card.querySelector(".admin-dispute-reason").textContent = DISPUTE_REASON_TEXT[d.reason] || d.reason;
        card.querySelector(".admin-dispute-buyer").append(`„${d.description}“`);
        if (d.coach_statement) card.querySelector(".admin-dispute-coach").append(`„${d.coach_statement}“`);
        if (decide && b) {
            const actions = document.createElement("div");
            actions.className = "admin-actions";
            const add = (cls, html, handler) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = `admin-btn ${cls}`;
                btn.innerHTML = html;
                btn.addEventListener("click", () => handler(btn));
                actions.appendChild(btn);
            };
            add("warn", `<i class="fa-solid fa-rotate-left"></i> Voll erstatten (${escapeHtml(euroText(total))})`, (btn) => decideDispute(d, total, btn));
            add("dismiss", '<i class="fa-solid fa-circle-half-stroke"></i> Teilweise erstatten', async (btn) => {
                const raw = await showDialog({
                    icon: "fa-circle-half-stroke", title: "Wie viel erstatten?",
                    message: `Betrag in Euro, höchstens ${euroText(total)}.`,
                    input: { placeholder: "z. B. 15,00", maxLength: 10, inputMode: "decimal" },
                    confirmText: "Weiter", cancelText: "Abbrechen"
                });
                if (!raw) return;
                const cents = Math.round(Number(String(raw).replace(/\s|€/g, "").replace(",", ".")) * 100);
                if (!Number.isFinite(cents) || cents <= 0 || cents > total) return showToast(`Bitte einen Betrag zwischen 0,01 € und ${euroText(total)} eingeben.`, "error");
                decideDispute(d, cents, btn);
            });
            add("ban", '<i class="fa-solid fa-xmark"></i> Ablehnen', (btn) => decideDispute(d, 0, btn));
            card.appendChild(actions);
        }
        // Schwere Fälle: Coach dauerhaft sperren (nur Admins; die Datenbank prüft es zusätzlich)
        if (isAdmin && d.reason !== "coach_gesperrt" && d.coach_id !== session.user.id) {
            const ban = document.createElement("button");
            ban.type = "button";
            ban.className = "admin-btn ban admin-dispute-coachban";
            ban.innerHTML = '<i class="fa-solid fa-user-lock"></i> Coach dauerhaft sperren';
            ban.addEventListener("click", async () => {
                ban.disabled = true;
                if (await banCoachPermanently(d.coach_id, nameOf(d.coach_id))) render();
                else ban.disabled = false;
            });
            const wrap = card.querySelector(".admin-actions") || card.appendChild(Object.assign(document.createElement("div"), { className: "admin-actions" }));
            wrap.appendChild(ban);
        }
        return card;
    }

    async function decideDispute(d, cents, btn) {
        const reason = await showDialog({
            icon: "fa-gavel", title: cents > 0 ? `${euroText(cents)} erstatten` : "Reklamation ablehnen",
            message: "Kurze Begründung – Kunde und Coach bekommen sie per E-Mail, sie steht auch im Moderationsprotokoll.",
            input: { placeholder: "z. B. Coach war laut Chat nicht erreichbar", maxLength: 1000, multiline: true },
            confirmText: cents > 0 ? "Erstatten" : "Ablehnen", cancelText: "Abbrechen", danger: cents === 0
        });
        if (!reason) return;
        btn.disabled = true;
        const { error } = await client.rpc("coaching_dispute_decide", { _dispute_id: d.id, _refund_cents: cents, _decision: reason });
        if (error) {
            btn.disabled = false;
            showToast(error.message, "error");
            return;
        }
        // Erstattung gleich bei Stripe ausführen (sonst übernimmt es der Zeitplan in spätestens 15 Minuten)
        if (cents > 0) await client.functions.invoke("coaching-refund", { body: { action: "reklamationen" } }).catch(() => null);
        showToast(cents > 0 ? `Entschieden: ${euroText(cents)} werden erstattet.` : "Reklamation abgelehnt.", "success");
        render();
    }

    // Fehlerprotokoll der Webseite (SQL 034): was bei Nutzern schiefgeht, gruppiert und gezählt – nur Admins
    async function renderErrors() {
        const { data: rows, error } = await client.from("client_errors").select("*").order("last_seen", { ascending: false }).limit(200);
        if (error) {
            list.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-database"></i> Das Fehlerprotokoll fehlt noch – bitte 034_fehlerprotokoll.sql in Supabase ausführen.</div>';
            return;
        }
        const countBadge = document.getElementById("countErrors");
        if (countBadge) {
            const recent = (rows || []).filter(r => Date.now() - new Date(r.last_seen).getTime() < 24 * 3600 * 1000).length;
            countBadge.hidden = !recent;
            countBadge.textContent = recent;
        }
        if (!rows?.length) {
            list.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-circle-check"></i> Keine Fehler gemeldet – alles läuft.</div>';
            return;
        }
        await loadProfiles(rows.map(r => r.user_id));
        const browser = (ua) => {
            const s = String(ua || "");
            const name = /Edg\//.test(s) ? "Edge" : /OPR\//.test(s) ? "Opera" : /Firefox\//.test(s) ? "Firefox" : /Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : "Browser";
            const os = /Android/.test(s) ? "Android" : /iPhone|iPad/.test(s) ? "iOS" : /Windows/.test(s) ? "Windows" : /Mac OS/.test(s) ? "macOS" : /Linux/.test(s) ? "Linux" : "";
            return [name, os].filter(Boolean).join(" · ");
        };
        const box = document.createElement("div");
        box.className = "admin-errors";
        const head = document.createElement("div");
        head.className = "admin-errors-head";
        head.innerHTML = '<span><i class="fa-solid fa-circle-info"></i> Fehler, die bei Nutzern aufgetreten sind (gleiche Fehler werden gezählt, nach 30 Tagen automatisch gelöscht).</span>';
        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "admin-btn dismiss";
        clear.innerHTML = '<i class="fa-solid fa-broom"></i> Liste leeren';
        clear.addEventListener("click", async () => {
            const ok = await showDialog({ icon: "fa-broom", title: "Fehlerliste leeren?", message: "Alle gemeldeten Fehler werden gelöscht. Neue Fehler erscheinen wieder hier.", confirmText: "Leeren", cancelText: "Abbrechen", danger: true });
            if (!ok) return;
            const { error: delError } = await client.from("client_errors").delete().gte("id", 0);
            if (delError) return showToast("Die Liste konnte nicht geleert werden.", "error");
            showToast("Fehlerliste geleert.", "success");
            renderErrors();
        });
        head.appendChild(clear);
        box.appendChild(head);
        rows.forEach(r => {
            const item = document.createElement("div");
            item.className = "admin-error";
            const where = [r.page, r.source && r.source !== r.page ? `${r.source}${r.line ? `:${r.line}` : ""}` : ""].filter(Boolean).join(" · ");
            item.innerHTML = `
                <div class="admin-error-head">
                    <span class="admin-error-count" title="So oft aufgetreten">${Number(r.count) || 1}×</span>
                    <strong class="admin-error-msg"></strong>
                </div>
                <div class="admin-error-meta">
                    <span><i class="fa-solid fa-file-code"></i> ${escapeHtml(where || "unbekannte Stelle")}</span>
                    <span><i class="fa-solid fa-clock"></i> zuletzt ${escapeHtml(formatDate(r.last_seen))}</span>
                    <span><i class="fa-solid fa-user"></i> ${escapeHtml(r.user_id ? nameOf(r.user_id) : "nicht angemeldet")}</span>
                    <span><i class="fa-solid fa-display"></i> ${escapeHtml(browser(r.user_agent))}</span>
                </div>`;
            item.querySelector(".admin-error-msg").textContent = r.message;
            box.appendChild(item);
        });
        list.replaceChildren(box);
    }

    async function renderLog() {
        const { data: log, error } = await client.from("moderation_log").select("*").order("id", { ascending: false }).limit(200);
        if (error) {
            list.innerHTML = `<div class="admin-empty"><i class="fa-solid fa-database"></i> Das Protokoll fehlt noch – bitte 021_moderation.sql in Supabase ausführen. (${escapeHtml(error.message)})</div>`;
            return;
        }
        if (!log?.length) {
            list.innerHTML = '<div class="admin-empty"><i class="fa-solid fa-clipboard-check"></i> Noch keine Einträge im Protokoll.</div>';
            return;
        }
        await loadProfiles(log.flatMap(e => [e.actor_id, e.target_user]));
        const d = (e) => e.details || {};
        const describe = (e) => ({
            verwarnung: ["fa-triangle-exclamation", "hat verwarnt"],
            sperre: ["fa-ban", d(e).bis ? `hat gesperrt bis ${formatDate(d(e).bis, false)}` : "hat dauerhaft gesperrt"],
            sperre_aufgehoben: ["fa-unlock", "hat eine Sperre aufgehoben"],
            meldung_verworfen: ["fa-xmark", "hat eine Meldung verworfen"],
            rolle: ["fa-user-shield", `hat die Rolle geändert (${ROLE_LABELS[d(e).von] || d(e).von || "Mitglied"} → ${ROLE_LABELS[d(e).nach] || d(e).nach || "Mitglied"})`],
            inserat_geloescht: ["fa-tags", `hat das Inserat „${d(e).titel || ""}“ gelöscht`],
            setup_geloescht: ["fa-car", `hat das Setup „${[d(e).fahrzeug, d(e).strecke].filter(Boolean).join(" · ")}“ gelöscht`],
            event_angelegt: ["fa-calendar-plus", `hat das Event „${d(e).titel || ""}“ angelegt`],
            event_geaendert: ["fa-calendar-check", `hat das Event „${d(e).titel || ""}“ geändert`],
            event_geloescht: ["fa-calendar-xmark", `hat das Event „${d(e).titel || ""}“ gelöscht`],
            bewertung_geloescht: ["fa-star-half-stroke", `hat eine Verkäufer-Bewertung entfernt${d(e).inserat ? ` (Inserat „${d(e).inserat}“)` : ""}`],
            kommentar_geloescht: ["fa-comment-slash", "hat einen Setup-Kommentar entfernt"],
            coaching_geloescht: ["fa-chalkboard-user", `hat das Coaching „${d(e).titel || ""}“ entfernt`],
            coach_lizenz_erteilt: ["fa-award", "hat die Coach-Lizenz erhalten (alle Voraussetzungen erfüllt)"],
            coach_lizenz_entzogen: ["fa-ban", `hat die Coach-Lizenz entzogen${d(e).grund ? ` – Begründung: ${d(e).grund}` : ""}`],
            coach_lizenz_automatisch: ["fa-robot", `Coach-Lizenz automatisch entzogen (${String(d(e).grund || "").replace(/^Automatisch:\s*/, "")})`],
            coach_lizenz_wiederhergestellt: ["fa-rotate-left", "hat die Coach-Lizenz wiederhergestellt"],
            coach_dauerhaft_gesperrt: ["fa-user-lock", `hat einen Coach dauerhaft gesperrt – Begründung: ${d(e).grund || "–"} (${d(e).abgelehnt ?? 0} Anfragen abgelehnt, ${d(e).storniert ?? 0} storniert, ${d(e).erstattungen ?? 0} Erstattungen)`],
            coach_sperre_aufgehoben: ["fa-unlock", "hat eine dauerhafte Coach-Sperre aufgehoben"],
            coaching_reklamation_entschieden: ["fa-gavel", `hat eine Coaching-Reklamation entschieden (${euroText(d(e).erstattung_cent)} erstattet)${d(e).grund ? ` – ${d(e).grund}` : ""}`],
            coaching_bewertung_geloescht: ["fa-comment-slash", "hat eine Coach-Bewertung entfernt"],
            pro_fahrer_hinzugefuegt: ["fa-crown", "hat einen Pro-Fahrer hinzugefügt (Setups und Coaching)"],
            pro_fahrer_entfernt: ["fa-user-minus", "hat einen Pro-Fahrer entfernt"]
        }[e.action] || ["fa-circle-info", e.action]);
        const table = document.createElement("div");
        table.className = "admin-log";
        table.innerHTML = log.map(e => {
            const [icon, text] = describe(e);
            const actor = e.actor_id ? nameOf(e.actor_id) : "SQL Editor / System";
            const target = e.target_user ? ` <span class="admin-log-target">→ ${escapeHtml(nameOf(e.target_user))}</span>` : "";
            const extra = e.action === "verwarnung" && d(e).text ? `<div class="admin-log-extra">„${escapeHtml(d(e).text)}“</div>` : "";
            return `<div class="admin-log-row">
                <span class="admin-log-time">${formatDate(e.created_at)}</span>
                <span class="admin-log-text"><i class="fa-solid ${icon}"></i> <strong>${escapeHtml(actor)}</strong> ${escapeHtml(text)}${target}${extra}</span>
            </div>`;
        }).join("");
        list.replaceChildren(table);
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

    // Neue Meldung live eingegangen (siehe auth-nav.js): Liste bzw. Zähler auffrischen
    document.addEventListener("gsra:new-report", () => {
        showToast("Eine neue Meldung ist eingegangen.", "info");
        if (currentTab === "offen") render();
        else updateCounts();
    });

    render();
});
