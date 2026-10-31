/* =========================================
   GSRA - Messenger: Online-Status & „Spielt gerade …“, Häkchen (gesendet/zugestellt/gelesen)
   und „Als ungelesen markieren“
   (ergänzt messenger.js – der gemeinsame Zustand steht dort)
========================================= */

const GSRA_GAMES = [
    "iRacing", "Assetto Corsa Competizione", "Le Mans Ultimate", "Assetto Corsa", "Assetto Corsa EVO",
    "Automobilista 2", "F1 25", "rFactor 2", "RaceRoom", "Gran Turismo 7", "Forza Motorsport", "BeamNG.drive"
];
const ONLINE_WINDOW_MS = 3 * 60 * 1000;

let presenceByUser = new Map();
let presenceReady = false;
let chatReads = [];
let readsReady = false;
let readsChannel = null;
let readsChatId = null;
let markReadTimer = null;

function statusDb() {
    return window.supabaseClient || window.supabase;
}

/* ---------- Online-Status & Spielstatus (sichtbar für Freunde) ---------- */

async function loadPresence() {
    const supabase = statusDb();
    if (!supabase || !currentUser?.id) return;
    const { data, error } = await supabase.from("user_presence").select("*");
    presenceReady = !error;
    if (error) return;
    presenceByUser = new Map((data || []).map(p => [p.user_id, p]));
    refreshPresenceViews();
}

async function refreshPresenceFor(userId) {
    const supabase = statusDb();
    if (!supabase || !presenceReady || !userId) return;
    const { data } = await supabase.from("user_presence").select("*").eq("user_id", userId).maybeSingle();
    if (data) presenceByUser.set(userId, data);
}

function isUserOnline(userId) {
    const p = presenceByUser.get(userId);
    return Boolean(p && Date.now() - new Date(p.last_seen_at).getTime() < ONLINE_WINDOW_MS);
}

function currentGameOf(userId) {
    return isUserOnline(userId) ? (presenceByUser.get(userId)?.current_game || null) : null;
}

function lastSeenText(userId) {
    const p = presenceByUser.get(userId);
    if (!p) return "";
    if (isUserOnline(userId)) return "online";
    const seen = new Date(p.last_seen_at);
    const minutes = Math.max(1, Math.round((Date.now() - seen.getTime()) / 60000));
    if (minutes < 60) return `zuletzt online vor ${minutes} Min.`;
    const time = seen.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    if (seen.toDateString() === new Date().toDateString()) return `zuletzt online heute um ${time}`;
    if (seen.toDateString() === new Date(Date.now() - 86400000).toDateString()) return `zuletzt online gestern um ${time}`;
    return `zuletzt online am ${seen.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
}

function onlineFriendIds() {
    return friendshipRows
        .filter(f => f.status === "accepted")
        .map(f => (f.user_id === currentUser.id ? f.friend_id : f.user_id))
        .filter(isUserOnline);
}

// Grüner Punkt am Profilbild, Controller-Symbol, wenn gerade gespielt wird
function decorateChatItem(item, chat) {
    if (!presenceReady || chat.user1_id === chat.user2_id) return;
    const otherId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
    if (!isUserOnline(otherId)) return;
    item.querySelector(".wa-avatar")?.classList.add("is-online");
    const game = currentGameOf(otherId);
    const name = item.querySelector(".wa-chat-name");
    if (game && name) {
        const tag = document.createElement("i");
        tag.className = "fa-solid fa-gamepad wa-game-tag";
        tag.title = `Spielt gerade ${game}`;
        name.after(tag);
    }
}

function decoratePersonRow(row, userId) {
    if (!presenceReady || !isUserOnline(userId)) return;
    row.querySelector(".wa-avatar")?.classList.add("is-online");
    const game = currentGameOf(userId);
    if (game && !row.querySelector(".wa-person-note")) {
        const note = document.createElement("span");
        note.className = "wa-person-note wa-game-note";
        note.innerHTML = '<i class="fa-solid fa-gamepad"></i> <span></span>';
        note.querySelector("span").textContent = game;
        row.appendChild(note);
    }
}

// Kopfzeile im Direktchat: „online · spielt gerade iRacing“ bzw. „zuletzt online …“
function updateChatHeaderPresence() {
    const chat = allChatsCache.find(c => c.id === activeChatId);
    if (!presenceReady || !chat || chat.user1_id === chat.user2_id || !chatSubtitleText) return;
    const otherId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
    const seen = lastSeenText(otherId);
    const game = currentGameOf(otherId);
    if (!seen) return;
    chatSubtitleText.textContent = game ? `online · spielt gerade ${game}` : seen;
    chatSubtitleText.classList.toggle("is-online", isUserOnline(otherId));
}

function refreshPresenceViews() {
    renderChatsList();
    updateChatHeaderPresence();
    if (newChatPanel && newChatPanel.classList.contains("open")) renderNewChatPanel();
}

/* ---------- Spielstatus selbst wählen ---------- */

function openGameStatusDialog() {
    if (!presenceReady) {
        showToast("Der Spielstatus ist in der Datenbank noch nicht eingerichtet.", "info");
        return;
    }
    const current = presenceByUser.get(currentUser.id)?.current_game || "";
    const overlay = document.createElement("div");
    overlay.className = "gsra-dialog-overlay";
    overlay.innerHTML = `
        <div class="gsra-dialog gsra-game-dialog" role="dialog" aria-modal="true">
            <button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button>
            <div class="gsra-dialog-icon"><i class="fa-solid fa-gamepad"></i></div>
            <h3 class="gsra-dialog-title">Was spielst du gerade?</h3>
            <p class="gsra-dialog-message">Deine Freunde sehen deinen Spielstatus, solange du online bist. Gehst du offline, verschwindet er automatisch.</p>
            <div class="gsra-game-grid"></div>
            <div class="gsra-game-custom">
                <input type="text" class="gsra-dialog-input" maxlength="40" placeholder="Anderes Spiel eingeben" autocomplete="off">
                <button type="button" class="gsra-dialog-btn primary">Übernehmen</button>
            </div>
            <div class="gsra-dialog-actions">
                ${current ? '<button type="button" class="gsra-dialog-btn secondary gsra-game-clear"><i class="fa-solid fa-xmark"></i> Spielstatus entfernen</button>' : ""}
            </div>
        </div>`;
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
    const pick = async (game) => {
        close();
        await setGameStatus(game);
    };
    const grid = overlay.querySelector(".gsra-game-grid");
    GSRA_GAMES.forEach(game => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `gsra-game-option${game === current ? " selected" : ""}`;
        btn.textContent = game;
        btn.addEventListener("click", () => pick(game));
        grid.appendChild(btn);
    });
    const input = overlay.querySelector(".gsra-game-custom input");
    if (current && !GSRA_GAMES.includes(current)) input.value = current;
    const applyCustom = () => {
        const value = input.value.trim();
        if (!value) {
            input.classList.add("invalid");
            input.focus();
            return;
        }
        pick(value);
    };
    overlay.querySelector(".gsra-game-custom button").addEventListener("click", applyCustom);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyCustom(); } });
    input.addEventListener("input", () => input.classList.remove("invalid"));
    overlay.querySelector(".gsra-game-clear")?.addEventListener("click", () => pick(null));
    overlay.querySelector(".gsra-dialog-close").addEventListener("click", close);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);
}

async function setGameStatus(game) {
    const { error } = await statusDb().rpc("touch_presence", { _game: game, _set_game: true });
    if (error) {
        showToast(error.message, "error");
        return;
    }
    await loadPresence();
    if (typeof renderWelcomeInfo === "function") renderWelcomeInfo();
    showToast(game ? `Dein Spielstatus: ${game}` : "Spielstatus entfernt.", "success");
}

/* ---------- Häkchen: gesendet (eins), zugestellt (zwei), gelesen (zwei gelbe) ---------- */

// Aufgerufen, sobald ein Chat geöffnet bzw. neu geladen wird
function onChatOpened(chatId) {
    if (typeof cancelVoiceRecordingFor === "function") cancelVoiceRecordingFor(chatId);
    if (readsChatId !== chatId) subscribeChatReads(chatId);
    scheduleMarkRead();
}

async function subscribeChatReads(chatId) {
    const supabase = statusDb();
    if (!supabase) return;
    if (readsChannel) {
        supabase.removeChannel(readsChannel);
        readsChannel = null;
    }
    readsChatId = chatId;
    chatReads = [];
    const { data, error } = await supabase.from("chat_reads").select("*").eq("chat_id", chatId);
    if (readsChatId !== chatId) return;
    readsReady = !error;
    if (error) return;
    chatReads = data || [];
    updateReadTicks();
    readsChannel = supabase
        .channel(`chat_reads_${chatId}_${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_reads", filter: `chat_id=eq.${chatId}` }, (payload) => {
            const row = payload.new;
            if (readsChatId !== chatId || !row?.user_id) return;
            chatReads = chatReads.filter(r => r.user_id !== row.user_id).concat(row);
            updateReadTicks();
        })
        .subscribe();
}

// Geöffneten Chat als gelesen melden (kurz verzögert, nur wenn der Tab sichtbar ist)
function scheduleMarkRead() {
    clearTimeout(markReadTimer);
    markReadTimer = setTimeout(() => {
        if (!activeChatId || document.hidden) return;
        statusDb()?.rpc("mark_chat_read", { _chat_id: activeChatId }).then(() => {}, () => {});
    }, 600);
}

function readStateFor(createdAt, chatId) {
    const chat = allChatsCache.find(c => c.id === chatId);
    if (!readsReady || !chat || isOfficialForum(chat.id)) return null;
    const recipients = chat.user1_id !== chat.user2_id
        ? [chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id]
        : activeGroupMembers.map(m => m.user_id).filter(id => id !== currentUser.id);
    if (recipients.length === 0) return "sent";
    const sentAt = new Date(createdAt).getTime();
    const byUser = new Map(chatReads.map(r => [r.user_id, r]));
    const reachedAll = (fields) => recipients.every(id => {
        const row = byUser.get(id);
        return fields.some(field => row?.[field] && new Date(row[field]).getTime() >= sentAt);
    });
    if (reachedAll(["last_read_at"])) return "read";
    if (reachedAll(["last_delivered_at", "last_read_at"])) return "delivered";
    return "sent";
}

function applyTickState(span, state) {
    span.className = `msg-ticks ${state}`;
    span.innerHTML = state === "sent" ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-check-double"></i>';
    span.title = state === "read" ? "Gelesen" : (state === "delivered" ? "Zugestellt" : "Gesendet");
}

function createReadTicks(msg) {
    const state = readStateFor(msg.created_at, msg.chat_id);
    if (!state) return null;
    const span = document.createElement("span");
    span.dataset.created = msg.created_at;
    span.dataset.chat = msg.chat_id;
    applyTickState(span, state);
    return span;
}

function updateReadTicks() {
    document.querySelectorAll("#chatMessages .msg-ticks").forEach(span => {
        const state = readStateFor(span.dataset.created, span.dataset.chat);
        if (state) applyTickState(span, state);
    });
}

/* ---------- Als ungelesen markieren (neueste Nachricht der anderen) ---------- */

const SYSTEM_TEXT_PATTERN = /hat den Chat|hat das Forum|zum Forum hinzugefügt|umbenannt|aus der Gruppe entfernt|hat die Gruppe verlassen|ist dem Forum beigetreten/;

function isNewestForeignMessage(msg) {
    if (!msg || String(msg.sender_id) === String(currentUser?.id)) return false;
    let newest = null;
    messagesCacheMap.forEach(m => {
        if (!m.sender_id || String(m.sender_id) === String(currentUser.id) || hiddenMessageIds.has(String(m.id))) return;
        if (DELETED_TEXTS.includes(m.text) || (SYSTEM_TEXT_PATTERN.test(m.text || "") && !m.image_url && !m.audio_url)) return;
        if (!newest || new Date(m.created_at) >= new Date(newest.created_at)) newest = m;
    });
    return Boolean(newest && String(newest.id) === String(msg.id));
}

function markMessageUnread(msg) {
    if (!currentUser?.id || !msg?.chat_id) return;
    localStorage.setItem(`gsra_last_read_${currentUser.id}_${msg.chat_id}`, new Date(new Date(msg.created_at).getTime() - 1).toISOString());
    const chat = allChatsCache.find(c => c.id === msg.chat_id);
    if (chat) chat.unread = true;
    // Chat schließen – sonst wäre er sofort wieder gelesen
    activeChatId = null;
    readsChatId = null;
    closeChatInfo();
    if (waWelcomeScreen) waWelcomeScreen.style.display = "flex";
    if (waChatActivePane) waChatActivePane.style.display = "none";
    updateGlobalUnreadState();
    renderChatsList();
    showToast("Der Chat ist wieder als ungelesen markiert.", "success");
}

/* ---------- Start ---------- */

document.addEventListener("DOMContentLoaded", () => {
    // Zurück im Tab: geöffneten Chat als gelesen werten (wie bei WhatsApp)
    document.addEventListener("visibilitychange", () => {
        if (document.hidden || !activeChatId || !currentUser?.id) return;
        markChatAsRead(activeChatId);
        renderChatsList();
        scheduleMarkRead();
        loadPresence();
    });
});

// Wird von messenger.js nach dem Laden der Chats aufgerufen
function initStatusFeatures() {
    loadPresence();
    setInterval(loadPresence, 60000);
}
