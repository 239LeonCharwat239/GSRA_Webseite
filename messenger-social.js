/* =========================================
   GSRA - Messenger: Profile, Freundschaften, öffentliche Foren,
   Blockieren, Melden, Verwarnungen und „Für mich löschen“
   (ergänzt messenger.js – der gemeinsame Zustand steht dort)
========================================= */

const REPORT_REASONS = [
    { value: "Beleidigung oder Belästigung", icon: "fa-face-angry" },
    { value: "Spam oder Werbung", icon: "fa-rectangle-ad" },
    { value: "Betrug oder Abzocke", icon: "fa-mask" },
    { value: "Hassrede oder Diskriminierung", icon: "fa-hand" },
    { value: "Unangemessene Inhalte", icon: "fa-eye-slash" },
    { value: "Sonstiges", icon: "fa-ellipsis" }
];

function socialDb() {
    return window.supabaseClient || window.supabase;
}

// Fehlt eine Datenbank-Funktion noch (SQL nicht eingespielt)?
function isMissingFunction(error) {
    return /could not find the function|schema cache/i.test(error?.message || "");
}

function displayName(userId) {
    return userNamesCache[userId] || profileCache[userId]?.username || "Fahrer";
}

/* ---------- Zustand laden ---------- */

// Freundschaften, Blockierungen, „Für mich gelöscht“ und offene Verwarnungen
async function loadSocialState() {
    const supabase = socialDb();
    if (!supabase || !currentUser?.id) return;
    const me = currentUser.id;
    const [friends, blocks, hides, warnings] = await Promise.all([
        supabase.from("friendships").select("*").or(`user_id.eq.${me},friend_id.eq.${me}`),
        supabase.from("user_blocks").select("blocked_id").eq("blocker_id", me),
        supabase.from("message_hides").select("message_id").eq("user_id", me),
        supabase.from("user_warnings").select("*").eq("user_id", me).is("acknowledged_at", null).order("created_at", { ascending: true })
    ]);
    // Die neuen Tabellen gibt es erst nach der Datenbank-Erweiterung – vorher bleibt alles wie bisher
    socialReady = !blocks.error;
    friendshipRows = socialReady && !friends.error ? (friends.data || []) : [];
    blockedUserIds = new Set(socialReady ? (blocks.data || []).map(b => b.blocked_id) : []);
    hiddenMessageIds = new Set(hides.error ? [] : (hides.data || []).map(h => String(h.message_id)));
    openWarnings = warnings.error ? [] : (warnings.data || []);

    await fetchProfiles(friendshipRows.map(f => (f.user_id === me ? f.friend_id : f.user_id)));
    updateGlobalUnreadState();
}

async function fetchProfiles(ids) {
    const supabase = socialDb();
    const missing = [...new Set(ids)].filter(id => id && !profileCache[id]);
    if (!supabase || missing.length === 0) return;
    const { data } = await supabase.from("profiles").select("*").in("id", missing);
    (data || []).forEach(p => {
        profileCache[p.id] = p;
        userNamesCache[p.id] = p.username || p.full_name || "Fahrer";
    });
}

function friendshipWith(userId) {
    return friendshipRows.find(f => (f.user_id === userId && f.friend_id === currentUser.id) || (f.user_id === currentUser.id && f.friend_id === userId));
}

// "friends", "outgoing" (du hast angefragt), "incoming" (du wurdest angefragt) oder "none"
function friendStatus(userId) {
    const f = friendshipWith(userId);
    if (!f) return "none";
    if (f.status === "accepted") return "friends";
    return f.user_id === currentUser.id ? "outgoing" : "incoming";
}

function incomingRequests() {
    return friendshipRows.filter(f => f.status === "pending" && f.friend_id === currentUser?.id);
}

// Nach Änderungen an Freundschaften: Listen und offene Bereiche auffrischen
async function refreshSocialState({ reloadChats = false } = {}) {
    await loadSocialState();
    if (reloadChats) await loadUserChats();
    else renderChatsList();
    if (newChatPanel && newChatPanel.classList.contains("open")) renderNewChatPanel();
    if (document.getElementById("friendRequestsPanel")?.classList.contains("open")) renderFriendRequestsPanel();
}

// Beim Start: Knöpfe der Startseite, Verwarnungen und regelmäßiges Auffrischen
function initSocialFeatures() {
    document.getElementById("closeFriendRequestsPanel")?.addEventListener("click", () => {
        document.getElementById("friendRequestsPanel")?.classList.remove("open");
    });
    document.getElementById("tileNewChat")?.addEventListener("click", openNewChatPanel);
    document.getElementById("tileNewGroup")?.addEventListener("click", () => createNewGroup());
    document.getElementById("tileFindForums")?.addEventListener("click", openForumDirectory);

    // Zurück im Tab: neue Freundschaftsanfragen und Verwarnungen holen (höchstens alle 30 Sekunden)
    let lastRefresh = Date.now();
    window.addEventListener("focus", async () => {
        if (Date.now() - lastRefresh < 30000) return;
        lastRefresh = Date.now();
        await loadSocialState();
        renderChatsList();
        renderWarningBar();
    });

    renderWarningBar();
    renderWelcomeInfo();
}

/* ---------- Direktchats ---------- */

// Neuer Chat über die Datenbank-Funktion (nur mit Freunden; Ausnahme: Verkäufer im Marktplatz)
async function requestDirectChat(otherId, intro) {
    const { data, error } = await socialDb().rpc("start_direct_chat", { _other: otherId, _intro: intro });
    if (!error && data) return { chatId: data };
    if (isMissingFunction(error)) return { missing: true };
    return { error: error?.message || "Der Chat konnte nicht gestartet werden." };
}

/* ---------- Profil ---------- */

function closeProfileDialog() {
    document.getElementById("profileDialog")?.remove();
}

// Profil einer Person: Bild, Name, GSRA-ID, Freundschaft, Nachricht, Melden, Blockieren
async function openUserProfile(userId, context = {}) {
    if (!userId || !currentUser?.id) return;
    await fetchUserName(userId);
    // Profil und Online-Status frisch laden (z. B. neue Social-Media-Links)
    const [{ data: freshProfile }] = await Promise.all([
        socialDb().from("profiles").select("*").eq("id", userId).maybeSingle(),
        typeof refreshPresenceFor === "function" ? refreshPresenceFor(userId) : null
    ]);
    if (freshProfile) {
        profileCache[userId] = freshProfile;
        userNamesCache[userId] = freshProfile.username || freshProfile.full_name || "Fahrer";
    }
    closeProfileDialog();

    const overlay = document.createElement("div");
    overlay.className = "gsra-dialog-overlay";
    overlay.id = "profileDialog";
    overlay.innerHTML = `
        <div class="gsra-dialog gsra-profile-dialog" role="dialog" aria-modal="true">
            <button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button>
            <div class="gsra-profile-avatar"></div>
            <h3 class="gsra-dialog-title"></h3>
            <div class="gsra-profile-meta"></div>
            <div class="gsra-profile-presence"></div>
            <p class="gsra-profile-bio"></p>
            <div class="gsra-profile-links"></div>
            <div class="gsra-profile-status"></div>
            <div class="gsra-profile-actions"></div>
            <div class="gsra-profile-forums"></div>
            <div class="gsra-profile-secondary"></div>
        </div>`;
    const close = () => {
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
    };
    const onKey = (e) => {
        if (e.key !== "Escape" || !document.body.contains(overlay)) return;
        e.preventDefault();
        e.stopPropagation();
        close();
    };
    overlay.querySelector(".gsra-dialog-close").addEventListener("click", close);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);
    renderProfileContent(overlay, userId, context);
    renderProfileForums(overlay, userId);
}

// Öffentliche Foren, in denen die Person Mitglied ist – mit Kennzeichnung, wo sie Admin ist
async function renderProfileForums(overlay, userId) {
    const box = overlay.querySelector(".gsra-profile-forums");
    if (!box || !socialReady) return;
    const { data, error } = await socialDb().rpc("user_public_forums", { _user: userId });
    if (error || !data || data.length === 0 || !document.body.contains(overlay)) return;
    box.replaceChildren(createSectionTitle(`Öffentliche Foren (${data.length})`));
    data.forEach(forum => {
        const count = Number(forum.member_count) || 0;
        const row = createPersonRow(forum.title, { icon: "fa-bullhorn icon-public", avatarUrl: forum.image_url, note: forum.is_member ? "Mitglied" : `${count} Mitgl.` });
        if (forum.role === "admin") {
            const label = document.createElement("span");
            label.className = "gsra-forum-admin-label";
            label.innerHTML = '<i class="fa-solid fa-user-shield"></i> Admin';
            row.querySelector(".wa-chat-name").after(label);
        }
        row.title = forum.is_member ? "Forum öffnen" : "Forum ansehen und beitreten";
        row.addEventListener("click", () => {
            closeProfileDialog();
            openPublicGroupPreview(forum);
        });
        box.appendChild(row);
    });
}

// Social-Media-Links als Streifen mit dem Logo der Plattform
function renderSocialLinks(container, links) {
    container.replaceChildren();
    const valid = (Array.isArray(links) ? links : []).map(normalizeSocialUrl).filter(Boolean);
    container.style.display = valid.length ? "" : "none";
    valid.forEach(link => {
        const platform = socialPlatformOf(link);
        const a = document.createElement("a");
        a.className = "gsra-social-link";
        a.href = link;
        a.target = "_blank";
        a.rel = "noopener noreferrer nofollow";
        a.style.setProperty("--platform-color", platform.color);
        a.innerHTML = `<span class="gsra-social-icon">${socialIconHtml(platform)}</span><span class="gsra-social-text"><strong></strong><small></small></span><i class="fa-solid fa-arrow-up-right-from-square"></i>`;
        a.querySelector("strong").textContent = platform.name;
        a.querySelector("small").textContent = socialLinkLabel(link);
        container.appendChild(a);
    });
}

function renderProfileContent(overlay, userId, context) {
    const profile = profileCache[userId] || {};
    const name = displayName(userId);
    const isMe = userId === currentUser.id;
    const status = friendStatus(userId);
    const isBlocked = blockedUserIds.has(userId);
    const existingChat = allChatsCache.find(c => c.user1_id !== c.user2_id && (c.user1_id === userId || c.user2_id === userId));

    overlay.querySelector(".gsra-profile-avatar").innerHTML = avatarInner(profile.avatar_url, "fa-user");
    overlay.querySelector(".gsra-dialog-title").textContent = isMe ? `${name} (Du)` : name;

    const meta = overlay.querySelector(".gsra-profile-meta");
    meta.replaceChildren();
    // GSRA-Admins (Projektteam) sind im Profil gekennzeichnet
    if (profile.role === "admin") {
        const badge = document.createElement("span");
        badge.className = "gsra-admin-badge";
        badge.innerHTML = '<i class="fa-solid fa-shield-halved"></i> GSRA-Admin';
        meta.appendChild(badge);
    }
    if (profile.gsra_id) {
        const idChip = document.createElement("button");
        idChip.type = "button";
        idChip.className = "gsra-id-chip";
        idChip.title = "GSRA-ID kopieren";
        idChip.innerHTML = `<i class="fa-solid fa-id-badge"></i> GSRA-ID #${profile.gsra_id} <i class="fa-regular fa-copy"></i>`;
        idChip.addEventListener("click", () => copyText(String(profile.gsra_id), "GSRA-ID kopiert."));
        meta.appendChild(idChip);
    }
    if (profile.created_at) {
        const since = document.createElement("span");
        since.textContent = `Mitglied seit ${new Date(profile.created_at).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}`;
        meta.appendChild(since);
    }

    // Online-Status und „Spielt gerade …“ (nur für Freunde und dich selbst sichtbar)
    const presence = overlay.querySelector(".gsra-profile-presence");
    const seen = typeof lastSeenText === "function" ? lastSeenText(userId) : "";
    const game = typeof currentGameOf === "function" ? currentGameOf(userId) : null;
    presence.replaceChildren();
    presence.style.display = seen ? "" : "none";
    if (seen) {
        const online = isUserOnline(userId);
        presence.className = `gsra-profile-presence${online ? " online" : ""}`;
        presence.innerHTML = `<span class="gsra-presence-dot"></span><span class="gsra-presence-text"></span>`;
        presence.querySelector(".gsra-presence-text").textContent = online ? "Online" : seen.charAt(0).toUpperCase() + seen.slice(1);
        if (game) {
            const gameEl = document.createElement("span");
            gameEl.className = "gsra-presence-game";
            gameEl.innerHTML = '<i class="fa-solid fa-gamepad"></i> <span></span>';
            gameEl.querySelector("span").textContent = `Spielt gerade ${game}`;
            presence.appendChild(gameEl);
        }
        if (isMe) {
            const change = document.createElement("button");
            change.type = "button";
            change.className = "gsra-presence-change";
            change.innerHTML = `<i class="fa-solid fa-pen"></i> ${game ? "Spielstatus ändern" : "Spielstatus setzen"}`;
            change.addEventListener("click", () => {
                closeProfileDialog();
                openGameStatusDialog();
            });
            presence.appendChild(change);
        }
    }

    const bio = overlay.querySelector(".gsra-profile-bio");
    bio.textContent = profile.bio || "";
    bio.style.display = profile.bio ? "" : "none";
    renderSocialLinks(overlay.querySelector(".gsra-profile-links"), profile.social_links);

    const statusEl = overlay.querySelector(".gsra-profile-status");
    const statusText = isMe ? "Das ist dein Profil."
        : isBlocked ? `Du hast ${name} blockiert.`
        : status === "friends" ? "Ihr seid befreundet."
        : status === "outgoing" ? "Freundschaftsanfrage gesendet."
        : status === "incoming" ? `${name} möchte mit dir befreundet sein.`
        : "";
    statusEl.textContent = statusText;
    statusEl.className = `gsra-profile-status${isBlocked ? " blocked" : (status === "friends" ? " friends" : "")}`;
    statusEl.style.display = statusText ? "" : "none";

    const actions = overlay.querySelector(".gsra-profile-actions");
    const secondary = overlay.querySelector(".gsra-profile-secondary");
    actions.replaceChildren();
    secondary.replaceChildren();
    const rerender = () => { if (document.body.contains(overlay)) renderProfileContent(overlay, userId, context); };
    const addButton = (container, cls, html, handler) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = cls;
        btn.innerHTML = html;
        btn.addEventListener("click", async () => {
            btn.disabled = true;
            await handler();
            btn.disabled = false;
            rerender();
        });
        container.appendChild(btn);
    };
    const messageAction = async () => {
        closeProfileDialog();
        hideNewChatPanel();
        await openDirectChatWith({ id: userId, username: name });
    };

    if (isMe) {
        const edit = document.createElement("a");
        edit.href = "dashboard.html";
        edit.className = "gsra-dialog-btn primary";
        edit.innerHTML = '<i class="fa-solid fa-user-pen"></i> Profil bearbeiten';
        actions.appendChild(edit);
        return;
    }

    if (!socialReady) {
        addButton(actions, "gsra-dialog-btn primary", '<i class="fa-solid fa-comment"></i> Nachricht senden', messageAction);
        return;
    }

    if (isBlocked) {
        addButton(actions, "gsra-dialog-btn primary", '<i class="fa-solid fa-unlock"></i> Blockierung aufheben', () => unblockUserById(userId));
    } else if (status === "friends") {
        addButton(actions, "gsra-dialog-btn primary", '<i class="fa-solid fa-comment"></i> Nachricht senden', messageAction);
        addButton(actions, "gsra-dialog-btn secondary", '<i class="fa-solid fa-user-minus"></i> Freund entfernen', () => removeFriendship(userId));
    } else if (status === "incoming") {
        addButton(actions, "gsra-dialog-btn primary", '<i class="fa-solid fa-check"></i> Anfrage annehmen', () => respondFriendRequest(userId, true));
        addButton(actions, "gsra-dialog-btn secondary", '<i class="fa-solid fa-xmark"></i> Ablehnen', () => respondFriendRequest(userId, false));
    } else if (status === "outgoing") {
        addButton(actions, "gsra-dialog-btn secondary", '<i class="fa-solid fa-rotate-left"></i> Anfrage zurückziehen', () => removeFriendship(userId, true));
    } else {
        addButton(actions, "gsra-dialog-btn primary", '<i class="fa-solid fa-user-plus"></i> Freundschaftsanfrage senden', () => sendFriendRequest(userId));
    }
    // Bestehende Chats bleiben erreichbar – auch ohne Freundschaft
    if (!isBlocked && status !== "friends" && existingChat) {
        addButton(actions, "gsra-dialog-btn secondary", '<i class="fa-solid fa-comment"></i> Zum Chat', messageAction);
    }

    addButton(secondary, "gsra-profile-link danger", '<i class="fa-solid fa-flag"></i> Melden', async () => {
        openReportDialog(userId, context);
    });
    if (!isBlocked) {
        addButton(secondary, "gsra-profile-link danger", '<i class="fa-solid fa-ban"></i> Blockieren', () => blockUserById(userId));
    }
}

function copyText(text, successMessage) {
    navigator.clipboard.writeText(text).then(
        () => showToast(successMessage, "success"),
        () => showToast("Kopieren nicht möglich – bitte markieren und kopieren.", "error")
    );
}

/* ---------- Freundschaften ---------- */

async function sendFriendRequest(userId) {
    const { data, error } = await socialDb().rpc("send_friend_request", { _target: userId });
    if (error) {
        showToast(error.message, "error");
        return;
    }
    const name = displayName(userId);
    showToast(data === "accepted" ? `Ihr seid jetzt befreundet – ${name} hatte dir schon eine Anfrage geschickt.` : `Freundschaftsanfrage an ${name} gesendet.`, "success");
    await refreshSocialState();
}

async function respondFriendRequest(userId, accept) {
    const { error } = await socialDb().rpc("respond_friend_request", { _from: userId, _accept: accept });
    if (error) {
        showToast(error.message, "error");
        await refreshSocialState();
        return;
    }
    showToast(accept ? `Du bist jetzt mit ${displayName(userId)} befreundet.` : "Anfrage abgelehnt.", accept ? "success" : "info");
    await refreshSocialState();
}

async function removeFriendship(userId, isOwnRequest = false) {
    const name = displayName(userId);
    if (!isOwnRequest) {
        const confirmed = await showDialog({
            icon: "fa-user-minus",
            title: "Freund entfernen?",
            message: `Möchtest du ${name} aus deinen Freunden entfernen? Euer bisheriger Chat bleibt erhalten.`,
            confirmText: "Entfernen",
            cancelText: "Abbrechen",
            danger: true
        });
        if (!confirmed) return;
    }
    const { error } = await socialDb().rpc("remove_friend", { _other: userId });
    if (error) {
        showToast(error.message, "error");
        return;
    }
    showToast(isOwnRequest ? "Anfrage zurückgezogen." : `${name} ist nicht mehr in deinen Freunden.`, "info");
    await refreshSocialState();
}

// Zeile oben in der Chatliste, solange Freundschaftsanfragen offen sind
function createFriendRequestsRow() {
    if (!socialReady) return null;
    const count = incomingRequests().length;
    if (count === 0) return null;
    const row = createPersonRow("Freundschaftsanfragen", { icon: "fa-user-clock", accent: true, note: String(count) });
    row.classList.add("wa-requests-row");
    const hint = document.createElement("div");
    hint.className = "wa-chat-msg";
    hint.textContent = count === 1 ? "1 neue Anfrage – jetzt ansehen" : `${count} neue Anfragen – jetzt ansehen`;
    row.querySelector(".wa-chat-info").appendChild(hint);
    row.addEventListener("click", openFriendRequestsPanel);
    return row;
}

function openFriendRequestsPanel() {
    const panel = document.getElementById("friendRequestsPanel");
    if (!panel) return;
    hideNewChatPanel();
    panel.classList.add("open");
    renderFriendRequestsPanel();
    loadSocialState().then(() => {
        renderFriendRequestsPanel();
        renderChatsList();
    });
}

async function renderFriendRequestsPanel() {
    const list = document.getElementById("friendRequestsList");
    if (!list || !currentUser?.id) return;
    const incoming = incomingRequests();
    const outgoing = friendshipRows.filter(f => f.status === "pending" && f.user_id === currentUser.id);
    await fetchProfiles([...incoming.map(f => f.user_id), ...outgoing.map(f => f.friend_id)]);
    list.replaceChildren();

    if (incoming.length) {
        list.appendChild(createSectionTitle(`Erhalten (${incoming.length})`));
        incoming.forEach(f => list.appendChild(createRequestRow(f.user_id, [
            { icon: "fa-check", title: "Annehmen", cls: "accept", onClick: () => respondFriendRequest(f.user_id, true) },
            { icon: "fa-xmark", title: "Ablehnen", cls: "decline", onClick: () => respondFriendRequest(f.user_id, false) }
        ])));
    }
    if (outgoing.length) {
        list.appendChild(createSectionTitle(`Gesendet (${outgoing.length})`));
        outgoing.forEach(f => list.appendChild(createRequestRow(f.friend_id, [
            { icon: "fa-rotate-left", title: "Anfrage zurückziehen", cls: "decline", onClick: () => removeFriendship(f.friend_id, true) }
        ])));
    }
    if (!incoming.length && !outgoing.length) {
        const note = document.createElement("p");
        note.className = "wa-empty-note";
        note.textContent = "Keine offenen Freundschaftsanfragen. Finde Freunde über die Suche – per Name oder GSRA-ID.";
        list.appendChild(note);
    }
    const findRow = createPersonRow("Freunde finden", { icon: "fa-magnifying-glass", accent: true });
    findRow.addEventListener("click", () => {
        document.getElementById("friendRequestsPanel")?.classList.remove("open");
        openNewChatPanel();
    });
    list.appendChild(findRow);
}

function createRequestRow(userId, actions) {
    const profile = profileCache[userId];
    const row = createPersonRow(displayName(userId), { avatarUrl: profile?.avatar_url });
    if (profile?.gsra_id) {
        const idLine = document.createElement("div");
        idLine.className = "wa-chat-msg";
        idLine.textContent = `GSRA-ID #${profile.gsra_id}`;
        row.querySelector(".wa-chat-info").appendChild(idLine);
    }
    const box = document.createElement("div");
    box.className = "wa-row-actions";
    actions.forEach(action => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `wa-mini-btn ${action.cls}`;
        btn.title = action.title;
        btn.innerHTML = `<i class="fa-solid ${action.icon}"></i>`;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            action.onClick();
        });
        box.appendChild(btn);
    });
    row.appendChild(box);
    row.addEventListener("click", () => openUserProfile(userId));
    return row;
}

/* ---------- Blockieren & Melden ---------- */

async function blockUserById(userId) {
    const name = displayName(userId);
    const confirmed = await showDialog({
        icon: "fa-ban",
        title: `${name} blockieren?`,
        message: `Du bekommst keine Nachrichten mehr von ${name}, euer Chat wird für dich ausgeblendet und eine Freundschaft endet. Im Profil kannst du das jederzeit aufheben.`,
        confirmText: "Blockieren",
        cancelText: "Abbrechen",
        danger: true
    });
    if (!confirmed) return;
    const { error } = await socialDb().rpc("block_user", { _other: userId });
    if (error) {
        showToast(error.message, "error");
        return;
    }
    showToast(`${name} ist jetzt blockiert.`, "success");
    await afterBlockChange(userId, true);
}

async function unblockUserById(userId) {
    const { error } = await socialDb().rpc("unblock_user", { _other: userId });
    if (error) {
        showToast(error.message, "error");
        return;
    }
    showToast(`Blockierung von ${displayName(userId)} aufgehoben.`, "success");
    await afterBlockChange(userId, false);
}

// Nach dem Blockieren: Direktchat ausblenden, Nachrichten in Gruppen verschwinden
async function afterBlockChange(userId, blocked) {
    await loadSocialState();
    const active = allChatsCache.find(c => c.id === activeChatId);
    const isDirectWithUser = active && active.user1_id !== active.user2_id && (active.user1_id === userId || active.user2_id === userId);
    if (blocked) closeProfileDialog();
    if (blocked && isDirectWithUser) {
        activeChatId = null;
        closeChatInfo();
        if (waWelcomeScreen) waWelcomeScreen.style.display = "flex";
        if (waChatActivePane) waChatActivePane.style.display = "none";
    }
    await loadUserChats();
    if (activeChatId) loadChatMessages(activeChatId);
}

// Melden mit Grund, Bezug (ausgewählte Nachrichten oder ganzer Chat) und optionalem Text –
// danach ist die Person sofort für dich blockiert
function openReportDialog(userId, context = {}) {
    const name = displayName(userId);
    const overlay = document.createElement("div");
    overlay.className = "gsra-dialog-overlay";
    overlay.innerHTML = `
        <div class="gsra-dialog danger gsra-report-dialog" role="dialog" aria-modal="true">
            <button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button>
            <div class="gsra-dialog-icon"><i class="fa-solid fa-flag"></i></div>
            <h3 class="gsra-dialog-title"></h3>
            <p class="gsra-dialog-message">Deine Meldung geht vertraulich an das GSRA-Team. Warum meldest du diese Person?</p>
            <div class="gsra-report-reasons"></div>
            <div class="gsra-report-scope" hidden>
                <div class="gsra-report-label"><i class="fa-solid fa-link"></i> Worauf bezieht sich deine Meldung?</div>
                <select class="gsra-report-chat" aria-label="Chat auswählen"></select>
                <div class="gsra-report-modes">
                    <button type="button" class="gsra-report-mode selected" data-mode="messages"><i class="fa-solid fa-list-check"></i> Nachrichten auswählen</button>
                    <button type="button" class="gsra-report-mode" data-mode="chat"><i class="fa-solid fa-comments"></i> Ganzen Chat melden</button>
                </div>
                <div class="gsra-report-messages"></div>
                <p class="gsra-report-scope-hint"></p>
            </div>
            <textarea class="gsra-dialog-input" rows="3" maxlength="1000" placeholder="Was ist passiert? (optional)"></textarea>
            <p class="gsra-report-tip"><i class="fa-solid fa-lightbulb"></i> Tipp: Beschreibe kurz, was passiert ist. Das hilft den Admins bei der Prüfung enorm und erhöht die Chance, dass ein Verstoß geahndet wird.</p>
            <p class="gsra-report-hint"><i class="fa-solid fa-shield-halved"></i> <span></span></p>
            <div class="gsra-dialog-actions">
                <button type="button" class="gsra-dialog-btn secondary">Abbrechen</button>
                <button type="button" class="gsra-dialog-btn primary">Melden &amp; blockieren</button>
            </div>
        </div>`;
    overlay.querySelector(".gsra-dialog-title").textContent = `${name} melden`;
    overlay.querySelector(".gsra-report-hint span").textContent = `Nach dem Absenden ist ${name} für dich blockiert: Du bekommst keine Nachrichten mehr, euer Chat wird ausgeblendet.`;

    let reason = null;
    const reasonsBox = overlay.querySelector(".gsra-report-reasons");
    REPORT_REASONS.forEach(r => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "gsra-report-reason";
        btn.innerHTML = `<i class="fa-solid ${r.icon}"></i><span></span>`;
        btn.querySelector("span").textContent = r.value;
        btn.addEventListener("click", () => {
            reason = r.value;
            reasonsBox.querySelectorAll(".gsra-report-reason").forEach(b => b.classList.toggle("selected", b === btn));
            reasonsBox.classList.remove("invalid");
        });
        reasonsBox.appendChild(btn);
    });

    const close = () => {
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
    };
    const onKey = (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        close();
    };
    // Bezug: gemeinsamer Chat, darin einzelne Nachrichten der Person oder der ganze Chat
    const scope = overlay.querySelector(".gsra-report-scope");
    const chatSelect = overlay.querySelector(".gsra-report-chat");
    const messagesBox = overlay.querySelector(".gsra-report-messages");
    const scopeHint = overlay.querySelector(".gsra-report-scope-hint");
    const selectedIds = new Set(context.messageId ? [String(context.messageId)] : []);
    let mode = "messages";
    let scopeReady = false;

    const syncScope = () => {
        const hasChat = Boolean(chatSelect.value);
        overlay.querySelector(".gsra-report-modes").hidden = !hasChat;
        messagesBox.hidden = !hasChat || mode !== "messages";
        overlay.querySelectorAll(".gsra-report-mode").forEach(b => b.classList.toggle("selected", b.dataset.mode === mode));
        scopeHint.textContent = !hasChat
            ? "Ohne Chatbezug sieht das GSRA-Team nur deine Beschreibung – beschreibe die Situation dann bitte möglichst genau."
            : (mode === "chat"
                ? "Das GSRA-Team sieht die letzten 150 Nachrichten dieses Chats – auch Nachrichten, die gelöscht wurden."
                : "Das GSRA-Team sieht die markierten Nachrichten mit dem Verlauf davor und danach – auch Nachrichten, die gelöscht wurden.");
    };

    const loadMessages = async () => {
        const chatId = chatSelect.value;
        messagesBox.classList.remove("invalid");
        syncScope();
        if (!chatId) return;
        messagesBox.innerHTML = '<p class="wa-empty-note"><i class="fa-solid fa-spinner fa-spin"></i> Lade Nachrichten …</p>';
        const { data: rows, error } = await socialDb().rpc("reportable_messages", { _chat_id: chatId, _user: userId });
        if (chatSelect.value !== chatId) return;
        // Systemnachrichten (z. B. „… hat den Chat eröffnet“) lassen sich nicht melden
        const data = (rows || []).filter(m => !(typeof SYSTEM_TEXT_PATTERN !== "undefined" && SYSTEM_TEXT_PATTERN.test(m.text || "") && !m.image_url && !m.audio_url));
        messagesBox.replaceChildren();
        if (error || data.length === 0) {
            const note = document.createElement("p");
            note.className = "wa-empty-note";
            note.textContent = `In diesem Chat gibt es keine Nachrichten von ${name} – du kannst den ganzen Chat melden.`;
            messagesBox.appendChild(note);
            return;
        }
        data.forEach(m => {
            const row = document.createElement("label");
            row.className = `gsra-report-msg${m.deleted ? " deleted" : ""}`;
            row.innerHTML = '<input type="checkbox"><span class="gsra-report-msg-time"></span><span class="gsra-report-msg-text"></span>';
            const checkbox = row.querySelector("input");
            checkbox.checked = selectedIds.has(String(m.id));
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) selectedIds.add(String(m.id));
                else selectedIds.delete(String(m.id));
                messagesBox.classList.remove("invalid");
            });
            row.querySelector(".gsra-report-msg-time").textContent = new Date(m.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
            row.querySelector(".gsra-report-msg-text").textContent = m.deleted ? "Gelöschte Nachricht (das Original sieht das GSRA-Team)"
                : m.audio_url ? `🎤 Sprachnachricht${m.transcript ? `: „${m.transcript}“` : ""}`
                : (m.image_url && (!m.text || m.text === "[Medien]")) ? "📷 Foto/Video"
                : m.text;
            messagesBox.appendChild(row);
        });
    };

    const loadReportScope = async () => {
        const { data: chats, error } = await socialDb().rpc("shared_chats_with", { _other: userId });
        if (error || !document.body.contains(overlay)) return; // ohne Datenbank-Erweiterung: wie bisher
        scopeReady = true;
        const options = (chats || []).map(c => ({
            value: c.id,
            text: c.kind === "direkt" ? `Direktchat mit ${name}` : `${c.kind === "forum" ? "Forum" : "Gruppe"} „${c.title}“`
        }));
        options.push({ value: "", text: "Kein bestimmter Chat (z. B. Profil oder Verhalten)" });
        chatSelect.replaceChildren(...options.map(o => {
            const option = document.createElement("option");
            option.value = o.value;
            option.textContent = o.text;
            return option;
        }));
        chatSelect.value = context.chatId && (chats || []).some(c => c.id === context.chatId) ? context.chatId : ((chats || [])[0]?.id || "");
        scope.hidden = false;
        loadMessages();
    };
    chatSelect.addEventListener("change", () => {
        selectedIds.clear();
        loadMessages();
    });
    overlay.querySelectorAll(".gsra-report-mode").forEach(btn => btn.addEventListener("click", () => {
        mode = btn.dataset.mode;
        messagesBox.classList.remove("invalid");
        syncScope();
    }));

    const submitBtn = overlay.querySelector(".gsra-dialog-btn.primary");
    submitBtn.addEventListener("click", async () => {
        if (!reason) {
            reasonsBox.classList.add("invalid");
            return;
        }
        const chatId = scopeReady ? (chatSelect.value || null) : (context.chatId || null);
        const messageIds = scopeReady && chatId && mode === "messages" ? [...selectedIds] : [];
        const hasChoices = Boolean(messagesBox.querySelector("input"));
        if (scopeReady && chatId && mode === "messages" && hasChoices && messageIds.length === 0) {
            messagesBox.classList.add("invalid");
            showToast("Bitte markiere mindestens eine Nachricht – oder melde den ganzen Chat.", "info");
            return;
        }
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Wird gesendet …';
        const details = overlay.querySelector("textarea").value.trim() || null;
        let error = null;
        if (scopeReady) {
            ({ error } = await socialDb().rpc("submit_report", {
                _reported: userId,
                _reason: reason,
                _details: details,
                _chat_id: chatId,
                _message_ids: messageIds.length ? messageIds : null,
                _whole_chat: Boolean(chatId && (mode === "chat" || messageIds.length === 0))
            }));
        }
        if (!scopeReady || isMissingFunction(error)) {
            ({ error } = await socialDb().rpc("report_user", {
                _reported: userId,
                _reason: reason,
                _details: details,
                _chat_id: chatId,
                _message_id: messageIds[0] || (context.messageId ? String(context.messageId) : null)
            }));
        }
        if (error) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Melden & blockieren";
            showToast(error.message, "error");
            return;
        }
        close();
        showToast(`Danke! Deine Meldung ist beim GSRA-Team. ${name} ist jetzt für dich blockiert.`, "success");
        await afterBlockChange(userId, true);
    });
    overlay.querySelector(".gsra-dialog-btn.secondary").addEventListener("click", close);
    overlay.querySelector(".gsra-dialog-close").addEventListener("click", close);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);
    if (socialReady) loadReportScope();
}

/* ---------- Verwarnungen ---------- */

// Offene Verwarnung oben im Chat (fest angeheftet) und auf der Startseite – bis sie bestätigt wurde
function renderWarningBar() {
    const warning = openWarnings[0];
    ["pinnedWarningBar", "welcomeWarning"].forEach(id => {
        const slot = document.getElementById(id);
        if (!slot) return;
        slot.replaceChildren();
        slot.style.display = warning ? "" : "none";
        if (!warning) return;
        const card = document.createElement("div");
        card.className = "wa-warning-card";
        card.innerHTML = `
            <div class="wa-warning-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div class="wa-warning-body">
                <div class="wa-warning-title"><i class="fa-solid fa-thumbtack"></i> Offizielle Verwarnung vom GSRA-Team</div>
                <div class="wa-warning-text"></div>
                <div class="wa-warning-meta"></div>
            </div>
            <button type="button" class="wa-warning-ack"><i class="fa-solid fa-check"></i> Gelesen und verstanden</button>`;
        card.querySelector(".wa-warning-text").textContent = warning.text;
        const date = new Date(warning.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
        card.querySelector(".wa-warning-meta").textContent = `Vom ${date}${openWarnings.length > 1 ? ` · ${openWarnings.length - 1} weitere offen` : ""} · Bitte bestätige, dass du sie gelesen hast.`;
        card.querySelector(".wa-warning-ack").addEventListener("click", () => acknowledgeWarning(warning.id));
        slot.appendChild(card);
    });
}

async function acknowledgeWarning(warningId) {
    const { error } = await socialDb().rpc("acknowledge_warning", { _warning_id: warningId });
    if (error) {
        showToast(error.message, "error");
        return;
    }
    openWarnings = openWarnings.filter(w => w.id !== warningId);
    renderWarningBar();
    updateGlobalUnreadState();
    showToast("Danke, die Verwarnung ist als gelesen bestätigt.", "success");
}

/* ---------- Startseite & Anmelde-Hinweis ---------- */

function renderWelcomeInfo() {
    if (!currentUser?.id) return;
    const greeting = document.getElementById("welcomeGreeting");
    if (greeting && currentUsername) greeting.textContent = `Schön, dass du da bist, ${currentUsername}!`;

    const stats = document.getElementById("welcomeStats");
    if (stats) {
        const unread = allChatsCache.filter(c => c.unread).length;
        const requests = incomingRequests().length;
        const friends = friendshipRows.filter(f => f.status === "accepted").length;
        const items = [{ action: "unread", icon: "fa-envelope", value: unread, label: unread === 1 ? "ungelesener Chat" : "ungelesene Chats", highlight: unread > 0 }];
        if (socialReady) {
            items.push({ action: "requests", icon: "fa-user-clock", value: requests, label: requests === 1 ? "Freundschaftsanfrage" : "Freundschaftsanfragen", highlight: requests > 0 });
            items.push({ action: "friends", icon: "fa-user-group", value: friends, label: friends === 1 ? "Freund" : "Freunde", highlight: false });
        }
        // Wie viele Freunde gerade online sind
        if (socialReady && typeof presenceReady !== "undefined" && presenceReady) {
            const online = onlineFriendIds().length;
            items.push({ action: "friends", icon: "fa-circle", value: online, label: online === 1 ? "Freund online" : "Freunde online", highlight: false, cls: "online" });
        }
        const chips = items.map(item => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = `wa-stat-chip${item.highlight ? " highlight" : ""}${item.cls ? ` ${item.cls}` : ""}`;
            chip.innerHTML = `<i class="fa-solid ${item.icon}"></i><strong>${item.value}</strong><span>${item.label}</span>`;
            chip.addEventListener("click", () => {
                if (item.action === "requests") openFriendRequestsPanel();
                else if (item.action === "friends") openNewChatPanel();
                else document.querySelector('.wa-pill[data-filter="unread"]')?.click();
            });
            return chip;
        });
        // Eigener Spielstatus („Spielt gerade …“) – per Klick ändern
        if (typeof presenceReady !== "undefined" && presenceReady) {
            const myGame = presenceByUser.get(currentUser.id)?.current_game;
            const gameChip = document.createElement("button");
            gameChip.type = "button";
            gameChip.className = `wa-stat-chip game${myGame ? " active" : ""}`;
            gameChip.title = "Spielstatus für deine Freunde festlegen";
            gameChip.innerHTML = '<i class="fa-solid fa-gamepad"></i><span></span>';
            gameChip.querySelector("span").textContent = myGame ? `Spielt gerade ${myGame}` : "Spielstatus setzen";
            gameChip.addEventListener("click", openGameStatusDialog);
            chips.push(gameChip);
        }
        stats.replaceChildren(...chips);
    }

    const idBox = document.getElementById("welcomeGsraId");
    const gsraId = profileCache[currentUser.id]?.gsra_id;
    if (idBox) {
        idBox.style.display = gsraId ? "" : "none";
        if (gsraId) {
            idBox.innerHTML = `<i class="fa-solid fa-id-badge"></i> Deine GSRA-ID: <strong>#${gsraId}</strong> <button type="button" class="wa-copy-btn" title="Kopieren"><i class="fa-regular fa-copy"></i></button>`;
            idBox.querySelector(".wa-copy-btn").addEventListener("click", () => copyText(String(gsraId), "GSRA-ID kopiert."));
        }
    }
}

// Nicht angemeldet: Hinweis über dem ganzen Bildschirm
function showLoginRequired() {
    if (document.getElementById("loginRequired")) return;
    const overlay = document.createElement("div");
    overlay.id = "loginRequired";
    overlay.className = "gsra-login-required";
    overlay.innerHTML = `
        <div class="gsra-login-card">
            <img src="GSRA_Logo_ohne Hintergrund.png" alt="GSRA" class="gsra-login-logo">
            <h2>Melde dich an, um den Messenger zu nutzen</h2>
            <p>Mit deinem GSRA-Konto chattest du mit Freunden, trittst Foren bei und bleibst im offiziellen GSRA-Forum auf dem Laufenden.</p>
            <div class="gsra-login-actions">
                <a href="login.html" class="gsra-dialog-btn primary"><i class="fa-solid fa-right-to-bracket"></i> Anmelden</a>
                <a href="login.html?registrieren=1" class="gsra-dialog-btn secondary"><i class="fa-solid fa-user-plus"></i> Konto erstellen</a>
            </div>
            <a href="index.html" class="gsra-login-back"><i class="fa-solid fa-arrow-left"></i> Zur Startseite</a>
        </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
}

/* ---------- Öffentliche Foren ---------- */

async function searchPublicGroups(term) {
    const { data, error } = await socialDb().rpc("search_public_groups", { _term: term || "" });
    return error ? [] : (data || []);
}

function openGroupById(chatId) {
    const chat = allChatsCache.find(c => c.id === chatId);
    if (!chat) return;
    activeChatId = chat.id;
    if (waWelcomeScreen) waWelcomeScreen.style.display = "none";
    if (waChatActivePane) waChatActivePane.style.display = "flex";
    openForumChat(chat);
}

async function openPublicGroupPreview(group) {
    if (group.is_member) {
        openGroupById(group.id);
        return;
    }
    const count = Number(group.member_count) || 0;
    const join = await showDialog({
        icon: "fa-bullhorn",
        title: group.title,
        message: `${group.description || "Öffentliches Forum der GSRA-Community."}\n\n${count} ${count === 1 ? "Mitglied" : "Mitglieder"}`,
        confirmText: "Beitreten",
        cancelText: "Abbrechen"
    });
    if (!join) return;
    const { error } = await socialDb().rpc("join_public_group", { _chat_id: group.id });
    if (error) {
        showToast(error.message, "error");
        return;
    }
    showToast(`Willkommen im Forum „${group.title}“!`, "success");
    if (chatSearchInput) chatSearchInput.value = "";
    publicGroupResults = [];
    peopleSearchResults = [];
    await loadUserChats();
    openGroupById(group.id);
}

// Verzeichnis aller öffentlichen Foren mit Suche
function openForumDirectory() {
    if (!socialReady) {
        showToast("Öffentliche Foren sind in der Datenbank noch nicht eingerichtet.", "info");
        return;
    }
    hideNewChatPanel();
    const overlay = document.createElement("div");
    overlay.className = "gsra-dialog-overlay";
    overlay.innerHTML = `
        <div class="gsra-dialog gsra-people-dialog" role="dialog" aria-modal="true">
            <button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button>
            <div class="gsra-dialog-icon"><i class="fa-solid fa-compass"></i></div>
            <h3 class="gsra-dialog-title">Öffentliche Foren</h3>
            <p class="gsra-dialog-message">Finde Foren der GSRA-Community und tritt mit einem Klick bei.</p>
            <input type="text" class="gsra-dialog-input" placeholder="Foren suchen" autocomplete="off" maxlength="60">
            <div class="gsra-people-list"></div>
        </div>`;
    const input = overlay.querySelector(".gsra-dialog-input");
    const list = overlay.querySelector(".gsra-people-list");
    const close = () => {
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
    };
    const onKey = (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        close();
    };
    let token = 0;
    const refresh = async () => {
        const current = ++token;
        const groups = await searchPublicGroups(input.value.trim());
        if (current !== token) return;
        list.replaceChildren();
        groups.forEach(group => {
            const count = Number(group.member_count) || 0;
            const row = createPersonRow(group.title, { icon: "fa-bullhorn icon-public", avatarUrl: group.image_url, note: group.is_member ? "Mitglied" : `${count} Mitgl.` });
            if (group.description) {
                const desc = document.createElement("div");
                desc.className = "wa-chat-msg";
                desc.textContent = group.description;
                row.querySelector(".wa-chat-info").appendChild(desc);
            }
            row.addEventListener("click", () => {
                close();
                openPublicGroupPreview(group);
            });
            list.appendChild(row);
        });
        if (!groups.length) {
            const note = document.createElement("p");
            note.className = "wa-empty-note";
            note.textContent = input.value.trim() ? "Kein öffentliches Forum gefunden." : "Noch keine öffentlichen Foren. Gruppenadmins können ihre Gruppe in der Gruppeninfo öffentlich machen.";
            list.appendChild(note);
        }
    };
    let timer = null;
    input.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(refresh, 200);
    });
    overlay.querySelector(".gsra-dialog-close").addEventListener("click", close);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);
    refresh();
    input.focus();
}

/* ---------- Forenbild, Beschreibung, öffentlich/privat (Gruppenadmins) ---------- */

async function saveGroupFields(chat, fields, successMessage) {
    const { data, error } = await socialDb().from("chats").update(fields).eq("id", chat.id).select("id");
    if (error || !data || data.length === 0) {
        showToast(error ? `Speichern nicht möglich: ${error.message}` : "Nur Gruppenadmins können das ändern.", "error");
        return false;
    }
    Object.assign(chat, fields);
    const cached = allChatsCache.find(c => c.id === chat.id);
    if (cached && cached !== chat) Object.assign(cached, fields);
    if (activeChatId === chat.id && ("image_url" in fields || "is_public" in fields)) {
        chatHeaderAvatar.innerHTML = avatarInner(chat.image_url, chatIconClass(chat));
    }
    renderChatInfo();
    renderChatsList();
    showToast(successMessage, "success");
    return true;
}

async function editGroupDescription(chat) {
    const text = await showDialog({
        icon: "fa-align-left",
        title: "Beschreibung bearbeiten",
        message: "Worum geht es hier? Die Beschreibung sehen alle Mitglieder – bei öffentlichen Foren auch alle in der Suche.",
        input: { value: chat.description || "", placeholder: "Beschreibung", maxLength: 500, multiline: true },
        confirmText: "Speichern",
        cancelText: "Abbrechen"
    });
    if (text === null) return;
    await saveGroupFields(chat, { description: text }, "Die Beschreibung wurde gespeichert.");
}

function changeGroupImage(chat) {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/png,image/jpeg,image/webp,image/gif";
    picker.addEventListener("change", () => {
        if (picker.files[0]) uploadGroupImage(chat, picker.files[0]);
    });
    picker.click();
}

async function uploadGroupImage(chat, file) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
        showToast("Bitte wähle ein Bild (PNG, JPG, WebP oder GIF).", "error");
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast("Das Bild darf höchstens 5 MB groß sein.", "error");
        return;
    }
    const supabase = socialDb();
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `foren/${chat.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (uploadError) {
        showToast(`Das Bild konnte nicht hochgeladen werden: ${uploadError.message}`, "error");
        return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await saveGroupFields(chat, { image_url: data.publicUrl }, "Das Forenbild wurde aktualisiert.");
}

async function removeGroupImage(chat) {
    const confirmed = await showDialog({
        icon: "fa-trash",
        title: "Bild löschen?",
        message: "Statt des Bildes erscheint wieder das Symbol der Gruppe.",
        confirmText: "Löschen",
        cancelText: "Abbrechen",
        danger: true
    });
    if (confirmed) await saveGroupFields(chat, { image_url: null }, "Das Bild wurde entfernt.");
}

// Bild in der Gruppen-/Kontaktinfo: Klick öffnet Vergrößern – Admins können es auch auswählen, ändern oder löschen
// (auch per Drag & Drop eines Bildes auf das Symbol)
function setupInfoAvatar(avatarEl, chat, { avatarUrl, canEdit }) {
    if (!avatarEl || (!avatarUrl && !canEdit)) return;
    avatarEl.classList.add("clickable");
    avatarEl.title = canEdit ? "Bild anzeigen oder ändern" : "Bild vergrößern";
    avatarEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!canEdit) {
            showImageLightbox(avatarUrl);
            return;
        }
        const items = [];
        if (avatarUrl) items.push({ icon: "fa-expand", text: "Vergrößern", onClick: () => showImageLightbox(avatarUrl) });
        items.push({ icon: "fa-image", text: avatarUrl ? "Bild ändern" : "Bild auswählen", onClick: () => changeGroupImage(chat) });
        if (avatarUrl) items.push({ icon: "fa-trash", text: "Bild löschen", danger: true, onClick: () => removeGroupImage(chat) });
        showActionMenu(avatarEl, items);
    });
    if (!canEdit) return;
    avatarEl.addEventListener("dragover", (e) => {
        if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        avatarEl.classList.add("drop-target");
    });
    avatarEl.addEventListener("dragleave", () => avatarEl.classList.remove("drop-target"));
    avatarEl.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        avatarEl.classList.remove("drop-target");
        const file = e.dataTransfer?.files?.[0];
        if (file) uploadGroupImage(chat, file);
    });
}

async function toggleGroupPublic(chat) {
    const makePublic = !chat.is_public;
    const confirmed = await showDialog({
        icon: makePublic ? "fa-globe" : "fa-lock",
        title: makePublic ? "Forum öffentlich machen?" : "Forum wieder privat machen?",
        message: makePublic
            ? "Alle GSRA-Mitglieder finden das Forum dann über die Suche und können selbst beitreten. Neue Mitglieder sehen auch die bisherigen Nachrichten."
            : "Das Forum verschwindet aus der Suche. Neue Mitglieder können dann nur noch Gruppenadmins hinzufügen.",
        confirmText: makePublic ? "Öffentlich machen" : "Privat machen",
        cancelText: "Abbrechen"
    });
    if (!confirmed) return;
    const saved = await saveGroupFields(chat, { is_public: makePublic }, makePublic ? "Das Forum ist jetzt öffentlich." : "Das Forum ist jetzt privat.");
    if (!saved) return;
    // Systemnachricht im Chat, damit alle Mitglieder Bescheid wissen
    const sysMsg = makePublic
        ? `${currentUsername} hat das Forum öffentlich gemacht. Jedes GSRA-Mitglied kann es jetzt finden, beitreten und alle bisherigen Nachrichten lesen.`
        : `${currentUsername} hat das Forum wieder privat gemacht. Neue Mitglieder können nur noch Gruppenadmins hinzufügen.`;
    await socialDb().from("messages").insert([{ chat_id: chat.id, sender_id: currentUser.id, text: sysMsg }]);
    await socialDb().from("chats").update({ last_message: sysMsg }).eq("id", chat.id);
    loadUserChats();
}

/* ---------- Löschen: für mich / für alle (Gruppenadmins) ---------- */

async function hideMessagesForMe(ids) {
    const rows = ids.map(id => ({ user_id: currentUser.id, message_id: id }));
    const { error } = await socialDb().from("message_hides").insert(rows);
    if (error && !/duplicate/i.test(error.message)) {
        showToast("Die Nachricht konnte nicht gelöscht werden.", "error");
        return;
    }
    ids.forEach(id => hiddenMessageIds.add(String(id)));
    await loadChatMessages(activeChatId);
    showToast(ids.length === 1 ? "Die Nachricht wurde für dich gelöscht." : `${ids.length} Nachrichten wurden für dich gelöscht.`, "success");
}

async function confirmHideMessage(msg) {
    const confirmed = await showDialog({
        icon: "fa-eye-slash",
        title: "Für mich löschen?",
        message: "Die Nachricht verschwindet nur bei dir – alle anderen sehen sie weiterhin.",
        confirmText: "Für mich löschen",
        cancelText: "Abbrechen"
    });
    if (confirmed) await hideMessagesForMe([msg.id]);
}

async function deleteMessageForAllAsAdmin(msg) {
    const confirmed = await showDialog({
        icon: "fa-trash",
        title: "Für alle löschen?",
        message: "Als Gruppenadmin löschst du diese Nachricht für alle Mitglieder. An ihrer Stelle steht dann „Von einem Gruppenadmin gelöscht“.",
        confirmText: "Für alle löschen",
        cancelText: "Abbrechen",
        danger: true
    });
    if (!confirmed) return;
    const changes = { text: ADMIN_DELETED_TEXT, image_url: null, reply_to: null, is_edited: false, reactions: {} };
    if (msg.audio_url) Object.assign(changes, { audio_url: null, transcript: null, voice_duration: null, voice_waveform: null });
    const { data, error } = await socialDb().from("messages")
        .update(changes)
        .eq("id", msg.id)
        .select("id");
    if (error || !data || data.length === 0) {
        showToast(error ? error.message : "Die Nachricht konnte nicht gelöscht werden.", "error");
        return;
    }
    await loadChatMessages(activeChatId);
    showToast("Die Nachricht wurde für alle gelöscht.", "success");
}
