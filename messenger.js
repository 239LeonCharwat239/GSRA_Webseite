/* =========================================
   GSRA - Messenger Logik (Vollständig & Korrigiert)
========================================= */

let currentUser = null;
let currentUsername = "";
let activeChatId = null;
let messageSubscription = null;
let globalListenerChannel = null;
let allChatsCache = [];
let currentFilter = 'all';
let userFavorites = new Set();
let isAdminUser = false;
let userNamesCache = {};
let officialForumChatId = null;
let isRendering = false;

let replyingToId = null;
let editingMessageId = null;
let isMultiSelectMode = false;
let selectedMessageIds = new Set();
let messagesCacheMap = new Map();

let viewerItems = [];
let viewerIndex = 0;

let selectedMediaFiles = [];
let mediaPickedAt = 0;
let chatMediaItems = [];
let viewerThumbObserver = null;

// Emoji-Auswahl auf Deutsch (Suche, Kategorien)
const EMOJI_DATA_SOURCE_DE = "https://cdn.jsdelivr.net/npm/emoji-picker-element-data@1/de/cldr/data.json";

// Persönliche Willkommensnachricht im offiziellen Forum: Sie wird nur im Browser des jeweiligen Mitglieds
// erzeugt (nicht in der Datenbank gespeichert) und ist deshalb ausschließlich für dieses Mitglied sichtbar.
const WELCOME_MESSAGE_ID = "gsra-welcome";
const WELCOME_PREVIEW_TEXT = "Willkommen in der Global Simracing Alliance (GSRA)!";
const WELCOME_MESSAGE_HTML = `
    <div class="wa-welcome-title">Willkommen in der Global Simracing Alliance (GSRA)!</div>
    <div class="wa-welcome-block">Hallo Simracer! Schön, dass du Teil der Global Simracing Alliance bist – der Plattform von Simracern für Simracer. Dieser offizielle Kanal dient als zentrale Anlaufstelle für wichtige Ankündigungen, Plattform-Updates, Reglement-Änderungen und Event-Benachrichtigungen rund um die GSRA.</div>
    <div class="wa-welcome-block"><strong>Was dich erwartet:</strong></div>
    <ul>
        <li><strong>Marktplatz:</strong> Hardware-Equipment sicher kaufen und verkaufen.</li>
        <li><strong>Setups &amp; Telemetrie:</strong> Fahrzeugeinstellungen für iRacing und Co. teilen und optimieren.</li>
        <li><strong>Rennkalender:</strong> Alle offiziellen Events und Community-Rennen auf einen Blick.</li>
        <li><strong>Messenger &amp; Foren:</strong> Direkter Austausch mit der Community.</li>
    </ul>
    <div class="wa-welcome-block"><strong>Hinweis:</strong> Dieser Kanal ist für offizielle Mitteilungen reserviert; für den normalen Austausch stehen dir deine privaten Chats und Foren zur Verfügung.</div>
    <div>Wir wünschen dir maximale Pace und viel Spaß!</div>
    <div>United by Speed. Driven Globally. Dein GSRA-Team.</div>
`;

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function sanitizeQuoteText(text) {
    if (!text) return "";
    return text.replace(/\s+/g, ' ').trim();
}

function formatCount(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace('.', ',') + " Mio.";
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace('.', ',') + " Tsd.";
    }
    return num.toString();
}

function isVideoUrl(url) {
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

function formatDuration(seconds) {
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Eigene Dialoge im GSRA-Design statt der Browser-Fenster (alert, confirm, prompt).
// Ergebnis: eingegebener Text bzw. true – beim Abbrechen null (mit Eingabefeld) bzw. false.
function showDialog({ icon = "fa-circle-info", title = "", message = "", input = null, confirmText = "OK", cancelText = "", danger = false }) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "gsra-dialog-overlay";
        overlay.innerHTML = `
            <div class="gsra-dialog${danger ? " danger" : ""}" role="dialog" aria-modal="true">
                <button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button>
                <div class="gsra-dialog-icon"><i class="fa-solid ${icon}"></i></div>
                <h3 class="gsra-dialog-title"></h3>
                <p class="gsra-dialog-message"></p>
                ${input ? '<input type="text" class="gsra-dialog-input" autocomplete="off">' : ""}
                <div class="gsra-dialog-actions">
                    ${cancelText ? '<button type="button" class="gsra-dialog-btn secondary"></button>' : ""}
                    <button type="button" class="gsra-dialog-btn primary"></button>
                </div>
            </div>`;
        overlay.querySelector(".gsra-dialog-title").textContent = title;
        const messageEl = overlay.querySelector(".gsra-dialog-message");
        if (message) messageEl.textContent = message;
        else messageEl.remove();

        const inputEl = overlay.querySelector(".gsra-dialog-input");
        if (inputEl) {
            inputEl.placeholder = input.placeholder || "";
            inputEl.value = input.value || "";
            inputEl.maxLength = input.maxLength || 60;
            inputEl.readOnly = Boolean(input.readOnly);
        }
        const confirmBtn = overlay.querySelector(".gsra-dialog-btn.primary");
        confirmBtn.textContent = confirmText;
        const cancelBtn = overlay.querySelector(".gsra-dialog-btn.secondary");
        if (cancelBtn) cancelBtn.textContent = cancelText;

        const cancelResult = (input && !input.readOnly) ? null : false;
        const close = (result) => {
            document.removeEventListener("keydown", onKey, true);
            overlay.remove();
            resolve(result);
        };
        const submit = () => {
            if (inputEl && !input.readOnly) {
                const value = inputEl.value.trim();
                if (!value) {
                    inputEl.classList.add("invalid");
                    inputEl.focus();
                    return;
                }
                close(value);
            } else {
                close(true);
            }
        };
        const onKey = (e) => {
            if (e.isComposing) return;
            if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                if (e.key === "Escape") close(cancelResult);
                else submit();
            }
        };

        confirmBtn.addEventListener("click", submit);
        if (cancelBtn) cancelBtn.addEventListener("click", () => close(cancelResult));
        overlay.querySelector(".gsra-dialog-close").addEventListener("click", () => close(cancelResult));
        overlay.addEventListener("mousedown", (e) => {
            if (e.target === overlay) close(cancelResult);
        });
        if (inputEl) inputEl.addEventListener("input", () => inputEl.classList.remove("invalid"));
        document.addEventListener("keydown", onKey, true);

        document.body.appendChild(overlay);
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
        } else {
            confirmBtn.focus();
        }
    });
}

// Kurze Hinweise unten rechts (gleiches Design wie im Marktplatz)
function showToast(message, type = "info") {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = '<i class="fa-solid fa-circle-info text-blue"></i>';
    if (type === "success") icon = '<i class="fa-solid fa-circle-check" style="color: #00ff88;"></i>';
    if (type === "error") icon = '<i class="fa-solid fa-circle-exclamation" style="color: #ff4d4d;"></i>';

    toast.innerHTML = `${icon} <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(110%)";
        toast.style.transition = "all 0.35s ease";
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

// Das offizielle Forum darf nie umbenannt oder gelöscht werden – auch nicht, falls es doppelt (mit anderer ID) existiert
function isOfficialForum(chatId) {
    const chat = allChatsCache.find(c => c.id === chatId);
    return chatId === officialForumChatId || Boolean(chat && chat.title === "GSRA Official / Community Forum");
}

const chatsList = document.getElementById("chatsList");
const chatTitleText = document.getElementById("chatTitleText");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatForm = document.getElementById("chatForm");
const chatActions = document.getElementById("chatActions");
const editChatTitleBtn = document.getElementById("editChatTitleBtn");
const deleteChatBtn = document.getElementById("deleteChatBtn");
const blockUserBtn = document.getElementById("blockUserBtn");
const addMemberBtn = document.getElementById("addMemberBtn");
const imageUploadInput = document.getElementById("imageUploadInput");
const emojiToggleBtn = document.getElementById("emojiToggleBtn");
const emojiPickerWrapper = document.getElementById("emojiPickerWrapper");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const previewThumbsList = document.getElementById("previewThumbsList");
const imagePreviewName = document.getElementById("imagePreviewName");
const removeImageBtn = document.getElementById("removeImageBtn");
const imageModal = document.getElementById("imageModal");
const modalImageFull = document.getElementById("modalImageFull");
const modalVideoFull = document.getElementById("modalVideoFull");
const closeImageModal = document.getElementById("closeImageModal");
const viewerStage = document.getElementById("viewerStage");
const viewerPrevBtn = document.getElementById("viewerPrevBtn");
const viewerNextBtn = document.getElementById("viewerNextBtn");
const viewerThumbs = document.getElementById("viewerThumbs");
const viewerCounter = document.getElementById("viewerCounter");
const viewerSenderName = document.getElementById("viewerSenderName");
const viewerSenderTime = document.getElementById("viewerSenderTime");
const viewerDownloadBtn = document.getElementById("viewerDownloadBtn");
const waWelcomeScreen = document.getElementById("waWelcomeScreen");
const waChatActivePane = document.getElementById("waChatActivePane");
const chatSearchInput = document.getElementById("chatSearchInput");
const tileInvite = document.getElementById("tileInvite");
const tileAddFriend = document.getElementById("tileAddFriend");
const tileForum = document.getElementById("tileForum");
const addFriendBtn = document.getElementById("addFriendBtn");
const newChatPlusBtn = document.getElementById("newChatPlusBtn");

const replyPreviewBanner = document.getElementById("replyPreviewBanner");
const replyBannerAuthor = document.getElementById("replyBannerAuthor");
const replyBannerText = document.getElementById("replyBannerText");
const cancelReplyBtn = document.getElementById("cancelReplyBtn");

let editPreviewBanner = document.getElementById("editPreviewBanner");
if (!editPreviewBanner && chatForm) {
    editPreviewBanner = document.createElement("div");
    editPreviewBanner.id = "editPreviewBanner";
    editPreviewBanner.style.cssText = "display: none; background: #202c33; border-left: 4px solid var(--gsra-blue); padding: 8px 14px; align-items: center; justify-content: space-between; font-size: 13px; color: #fff; margin-bottom: 8px; border-radius: 4px; width: 100%; box-sizing: border-box;";
    editPreviewBanner.innerHTML = `
        <div style="display: flex; flex-direction: column; overflow: hidden; max-width: calc(100% - 30px);">
            <span style="font-weight: bold; color: var(--gsra-blue); font-size: 11px; text-transform: uppercase;">Nachricht bearbeiten</span>
            <span id="editBannerText" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-muted); font-size: 12px;"></span>
        </div>
        <button type="button" id="cancelEditBtn" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; padding: 4px; flex-shrink: 0;" title="Bearbeiten abbrechen"><i class="fa-solid fa-xmark"></i></button>
    `;
    chatForm.parentNode.insertBefore(editPreviewBanner, chatForm);

    document.getElementById("cancelEditBtn").addEventListener("click", () => {
        editingMessageId = null;
        editPreviewBanner.style.display = "none";
        if (messageInput) {
            messageInput.value = "";
            messageInput.style.height = "42px";
            messageInput.placeholder = "Gib eine Nachricht ein...";
        }
    });
}

let multiDeleteBar = document.getElementById("multiDeleteBar");
if (!multiDeleteBar && chatForm) {
    multiDeleteBar = document.createElement("div");
    multiDeleteBar.id = "multiDeleteBar";
    multiDeleteBar.style.cssText = "display: none; background: #202c33; border-top: 1px solid var(--border-subtle); padding: 12px 20px; align-items: center; justify-content: space-between; font-size: 14px; color: #fff; flex-shrink: 0;";
    multiDeleteBar.innerHTML = `
        <span id="multiDeleteCount" style="font-weight: bold; color: var(--gsra-yellow);">0 ausgewählt</span>
        <div style="display: flex; gap: 12px; align-items: center;">
            <button type="button" id="executeMultiDeleteBtn" class="btn-delete" style="padding: 6px 14px;"><i class="fa-solid fa-trash"></i> Ausgewählte löschen</button>
            <button type="button" id="cancelMultiDeleteBtn" class="msg-action-btn" style="font-size: 18px;" title="Abbrechen"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `;
    chatForm.parentNode.insertBefore(multiDeleteBar, chatForm);

    document.getElementById("cancelMultiDeleteBtn").addEventListener("click", () => {
        exitMultiSelectMode();
    });

    document.getElementById("executeMultiDeleteBtn").addEventListener("click", async () => {
        if (selectedMessageIds.size === 0) return;
        const confirmed = await showDialog({
            icon: "fa-trash",
            title: "Nachrichten löschen?",
            message: `Möchtest du ${selectedMessageIds.size} ausgewählte Nachricht(en) wirklich löschen?`,
            confirmText: "Löschen",
            cancelText: "Abbrechen",
            danger: true
        });
        if (confirmed) {
            const supabase = window.supabaseClient || window.supabase;
            if (!supabase) return;

            for (const msgId of selectedMessageIds) {
                const deleteText = "Du hast diese Nachricht gelöscht";
                await supabase.from("messages").update({
                    text: deleteText,
                    image_url: null,
                    reply_to: null,
                    is_edited: false,
                    reactions: {}
                }).eq("id", msgId);
            }

            exitMultiSelectMode();
            await loadChatMessages(activeChatId);
            await loadUserChats();
        }
    });
}

function exitMultiSelectMode() {
    isMultiSelectMode = false;
    selectedMessageIds.clear();
    document.body.classList.remove("multi-select-active");
    if (multiDeleteBar) multiDeleteBar.style.display = "none";
    document.querySelectorAll(".message-bubble").forEach(b => {
        b.classList.remove("selection-mode", "selected-bubble");
        const cb = b.querySelector(".msg-selection-checkbox");
        if (cb) cb.innerHTML = "";
    });
}

function updateMultiDeleteCount() {
    const countSpan = document.getElementById("multiDeleteCount");
    if (countSpan) {
        countSpan.innerText = `${selectedMessageIds.size} ausgewählt`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;

    if (!currentUser || !currentUser.id) {
        if (chatsList) chatsList.innerHTML = `<p style="padding: 15px; font-size: 13px; color: var(--text-muted);">Bitte logge dich ein.</p>`;
        return;
    }

    currentUsername = await fetchUserName(currentUser.id);
    allChatsCache = [];
    activeChatId = null;

    await checkUserAdminStatus();
    await loadFavorites();
    await loadUserChats();
    await checkUrlParameters();

    document.querySelectorAll(".wa-pill").forEach(pill => {
        pill.addEventListener("click", (e) => {
            document.querySelectorAll(".wa-pill").forEach(p => p.classList.remove("active"));
            e.target.classList.add("active");
            currentFilter = e.target.getAttribute("data-filter");
            renderChatsList();
        });
    });

    if (chatSearchInput) {
        chatSearchInput.addEventListener("input", () => {
            renderChatsList();
        });
    }

    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener("click", () => {
            replyingToId = null;
            if (replyPreviewBanner) replyPreviewBanner.style.display = "none";
        });
    }

    if (messageInput) {
        messageInput.addEventListener("input", () => {
            messageInput.style.height = "auto";
            messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + "px";
        });

        messageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (chatForm) chatForm.requestSubmit();
            }
        });
    }

    if (newChatPlusBtn) {
        newChatPlusBtn.addEventListener("click", async () => {
            const forumName = await showDialog({
                icon: "fa-users",
                title: "Neues Forum / Gruppe erstellen",
                message: "Gib deiner Gruppe einen Namen. Mitglieder fügst du danach über das Personen-Symbol im Chat hinzu.",
                input: { placeholder: "z. B. GT3 Setup Talk", maxLength: 50 },
                confirmText: "Gruppe erstellen",
                cancelText: "Abbrechen"
            });
            if (!forumName || !supabase || !currentUser?.id) return;

            const sysMsg = `${currentUsername} hat das Forum erstellt.`;
            const { data: createdGroup, error } = await supabase.from("chats").insert([{
                user1_id: currentUser.id,
                user2_id: currentUser.id,
                title: forumName,
                last_message: sysMsg
            }]).select().single();

            if (!error && createdGroup) {
                await supabase.from("messages").insert([{
                    chat_id: createdGroup.id,
                    sender_id: currentUser.id,
                    text: sysMsg
                }]);

                await loadUserChats();
                showToast(`Die Gruppe „${forumName}“ wurde erstellt.`, "success");
            } else {
                showToast("Fehler beim Erstellen: " + (error?.message || "Unbekannter Fehler"), "error");
            }
        });
    }

    const handleAddFriend = async () => {
        if (!currentUser?.id) return;
        const friendName = await showDialog({
            icon: "fa-user-plus",
            title: "Kontakt hinzufügen",
            message: "Gib den Benutzernamen deines Freundes ein, um einen Chat zu starten.",
            input: { placeholder: "Benutzername" },
            confirmText: "Chat starten",
            cancelText: "Abbrechen"
        });
        if (!friendName) return;

        const { data: foundProfiles, error } = await supabase
            .from("profiles")
            .select("id, username")
            .ilike("username", friendName.trim())
            .maybeSingle();

        if (error || !foundProfiles) {
            showToast("Nutzer nicht gefunden.", "error");
            return;
        }

        if (foundProfiles.id === currentUser.id) {
            showToast("Du kannst dich nicht selbst hinzufügen.", "error");
            return;
        }

        const [u1, u2] = [currentUser.id, foundProfiles.id].sort();
        let existingChat = allChatsCache.find(c => c.user1_id !== c.user2_id && ((c.user1_id === u1 && c.user2_id === u2)));

        if (!existingChat) {
            const { data: fetched } = await supabase
                .from("chats")
                .select("*")
                .eq("user1_id", u1)
                .eq("user2_id", u2)
                .maybeSingle();

            if (fetched && fetched.user1_id !== fetched.user2_id) {
                existingChat = fetched;
            } else {
                const sysMsg = `${currentUsername} hat den Chat eröffnet.`;
                const { data: newChat, error: newErr } = await supabase
                    .from("chats")
                    .insert([{
                        user1_id: u1,
                        user2_id: u2,
                        title: null,
                        last_message: sysMsg
                    }])
                    .select()
                    .single();

                if (!newErr && newChat) {
                    await supabase.from("messages").insert([{
                        chat_id: newChat.id,
                        sender_id: currentUser.id,
                        text: sysMsg
                    }]);
                    existingChat = newChat;
                }
            }
        }

        if (existingChat) {
            activeChatId = existingChat.id;
            markChatAsRead(activeChatId);
            if (waWelcomeScreen) waWelcomeScreen.style.display = "none";
            if (waChatActivePane) waChatActivePane.style.display = "flex";
            openChat(existingChat.id, foundProfiles.username, existingChat.title);
            await loadUserChats();
        }
    };

    if (tileAddFriend) tileAddFriend.addEventListener("click", handleAddFriend);
    if (addFriendBtn) addFriendBtn.addEventListener("click", handleAddFriend);

    if (tileInvite) {
        tileInvite.addEventListener("click", async () => {
            const inviteLink = window.location.origin + "/messenger.html";
            const copyLink = await showDialog({
                icon: "fa-user-group",
                title: "Freund einladen",
                message: "Teile diesen Link, damit dein Freund dem GSRA Messenger beitreten kann:",
                input: { value: inviteLink, readOnly: true, maxLength: 300 },
                confirmText: "Link kopieren",
                cancelText: "Schließen"
            });
            if (copyLink) {
                navigator.clipboard.writeText(inviteLink).then(
                    () => showToast("Link in die Zwischenablage kopiert.", "success"),
                    () => showToast("Kopieren nicht möglich – bitte den Link markieren und kopieren.", "error")
                );
            }
        });
    }

    if (tileForum) {
        tileForum.addEventListener("click", () => {
            if (officialForumChatId) {
                activeChatId = officialForumChatId;
                markChatAsRead(activeChatId);
                if (waWelcomeScreen) waWelcomeScreen.style.display = "none";
                if (waChatActivePane) waChatActivePane.style.display = "flex";
                renderChatsList();
                openForumChat(allChatsCache.find(c => c.id === officialForumChatId));
            }
        });
    }

    if (addMemberBtn) {
        addMemberBtn.addEventListener("click", async () => {
            if (!currentUser?.id || !activeChatId) return;

            // Mitglieder dürfen nur zu einem Forum / einer Gruppe (title gesetzt) hinzugefügt werden
            const activeChatObj = allChatsCache.find(c => c.id === activeChatId);
            if (!activeChatObj || activeChatObj.title === null || activeChatObj.title === undefined || activeChatObj.user1_id !== activeChatObj.user2_id) {
                showToast("Mitglieder können nur zu einem Forum / einer Gruppe hinzugefügt werden.", "error");
                return;
            }

            const memberName = await showDialog({
                icon: "fa-user-plus",
                title: "Mitglied hinzufügen",
                message: `Gib den Benutzernamen des Mitglieds ein, das du zu „${activeChatObj.title}“ hinzufügen möchtest.`,
                input: { placeholder: "Benutzername" },
                confirmText: "Hinzufügen",
                cancelText: "Abbrechen"
            });
            if (!memberName) return;

            const { data: targetUser } = await supabase
                .from("profiles")
                .select("id, username")
                .ilike("username", memberName.trim())
                .maybeSingle();

            if (!targetUser) {
                showToast("Nutzer nicht gefunden.", "error");
                return;
            }

            if (targetUser.id === currentUser.id) {
                showToast("Du kannst dich nicht selbst hinzufügen.", "error");
                return;
            }

            const sysMsg = `${currentUsername} hat ${targetUser.username} zum Forum hinzugefügt.`;

            // WICHTIG: user2_id wird NICHT verändert, damit das Forum ein Forum bleibt (user1_id === user2_id)!
            // Es wird ausschließlich last_message geschrieben (niemals user1_id / user2_id) und nur bei Chats mit Titel (= Forum)
            await supabase.from("chats").update({
                last_message: sysMsg
            }).eq("id", activeChatId).not("title", "is", null);

            await supabase.from("messages").insert([{
                chat_id: activeChatId,
                sender_id: currentUser.id,
                text: sysMsg
            }]);

            await loadUserChats();
            showToast(`${targetUser.username} wurde zur Gruppe hinzugefügt.`, "success");
        });
    }

    if (emojiToggleBtn && emojiPickerWrapper) {
        emojiToggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isVisible = emojiPickerWrapper.style.display === "block";
            emojiPickerWrapper.style.display = isVisible ? "none" : "block";
        });

        document.addEventListener("click", (e) => {
            if (!emojiPickerWrapper.contains(e.target) && e.target !== emojiToggleBtn) {
                emojiPickerWrapper.style.display = "none";
            }
        });

        const picker = emojiPickerWrapper.querySelector("emoji-picker");
        if (picker) {
            picker.addEventListener("emoji-click", (event) => {
                if (messageInput) {
                    messageInput.value += event.detail.unicode;
                    messageInput.focus();
                    messageInput.dispatchEvent(new Event('input'));
                }
            });
        }
    }

    if (imageUploadInput) {
        imageUploadInput.addEventListener("change", () => addMediaFiles(Array.from(imageUploadInput.files)));
    }

    // Schutz vor versehentlichem Senden: Klicks mit gedrückter Strg-/Umschalt-Taste (z. B. Mehrfachauswahl, wenn sich der
    // Dateidialog vorzeitig schließt und der nächste Klick auf "Senden" landet) und Klicks direkt nach der Dateiauswahl senden nicht
    if (sendBtn) {
        sendBtn.addEventListener("click", (e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || Date.now() - mediaPickedAt < 1000) e.preventDefault();
        });
    }

    // Fotos & Videos per Drag & Drop in den geöffneten Chat ziehen
    const isFileDrag = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
    if (waChatActivePane) {
        let dragHideTimer = null;
        waChatActivePane.addEventListener("dragover", (e) => {
            if (!isFileDrag(e) || (messageInput && messageInput.disabled)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            waChatActivePane.classList.add("drag-active");
            clearTimeout(dragHideTimer);
            dragHideTimer = setTimeout(() => waChatActivePane.classList.remove("drag-active"), 250);
        });
        waChatActivePane.addEventListener("drop", (e) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
            clearTimeout(dragHideTimer);
            waChatActivePane.classList.remove("drag-active");
            if (!(messageInput && messageInput.disabled)) addMediaFiles(Array.from(e.dataTransfer.files));
        });
    }
    // Neben dem Chat abgelegte Dateien nicht im Browser öffnen
    window.addEventListener("dragover", (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        if (!waChatActivePane || !waChatActivePane.contains(e.target) || (messageInput && messageInput.disabled)) e.dataTransfer.dropEffect = "none";
    });
    window.addEventListener("drop", (e) => {
        if (isFileDrag(e)) e.preventDefault();
    });

    if (removeImageBtn) {
        removeImageBtn.addEventListener("click", () => {
            if (imageUploadInput) imageUploadInput.value = "";
            if (previewThumbsList) previewThumbsList.innerHTML = "";
            if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
        });
    }

    if (closeImageModal && imageModal) {
        closeImageModal.addEventListener("click", closeMediaViewer);
        imageModal.addEventListener("click", (e) => {
            if (e.target === imageModal || e.target === viewerStage) closeMediaViewer();
        });
        if (viewerPrevBtn) viewerPrevBtn.addEventListener("click", () => showViewerItem(viewerIndex - 1));
        if (viewerNextBtn) viewerNextBtn.addEventListener("click", () => showViewerItem(viewerIndex + 1));

        // Tastatur: ← / → blättern, Esc schließt (im fokussierten Video bleiben die Pfeiltasten zum Spulen)
        document.addEventListener("keydown", (e) => {
            if (imageModal.style.display !== "flex") return;
            if (e.key === "Escape") closeMediaViewer();
            else if (e.target === modalVideoFull) return;
            else if (e.key === "ArrowLeft") showViewerItem(viewerIndex - 1);
            else if (e.key === "ArrowRight") showViewerItem(viewerIndex + 1);
        });

        // Wischen auf Touch-Geräten
        let touchStartX = null;
        if (viewerStage) {
            viewerStage.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
            viewerStage.addEventListener("touchend", (e) => {
                if (touchStartX === null) return;
                const deltaX = e.changedTouches[0].clientX - touchStartX;
                touchStartX = null;
                if (Math.abs(deltaX) > 50) showViewerItem(viewerIndex + (deltaX < 0 ? 1 : -1));
            });
        }

        // Bild-im-Bild-Fenster geschlossen, während der Betrachter zu ist: Video stoppen (kein unsichtbarer Ton)
        if (modalVideoFull) {
            modalVideoFull.addEventListener("leavepictureinpicture", () => {
                if (imageModal.style.display !== "flex") stopViewerVideo();
            });
        }
    }
});

// Medien-Betrachter im WhatsApp-Stil: blättert durch alle Fotos & Videos des Chats.
// Die Medien der angeklickten Nachricht sind hervorgehoben, alle anderen ausgegraut.
function openMediaViewer(items, startIndex) {
    if (!imageModal) return;
    viewerItems = items;

    if (viewerThumbs) {
        viewerThumbs.innerHTML = "";
        viewerThumbs.style.display = items.length > 1 ? "flex" : "none";

        // Miniaturen erst laden, wenn sie in der Leiste sichtbar werden (ein Chat kann hunderte Medien enthalten)
        if (viewerThumbObserver) viewerThumbObserver.disconnect();
        viewerThumbObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const media = entry.target.firstElementChild;
                if (media && media.dataset.src) {
                    media.src = media.dataset.src;
                    delete media.dataset.src;
                }
                viewerThumbObserver.unobserve(entry.target);
            });
        }, { root: viewerThumbs, rootMargin: "0px 300px" });

        items.forEach((item, idx) => {
            const thumb = document.createElement("div");
            thumb.className = "wa-viewer-thumb";
            if (isVideoUrl(item.url)) {
                const vid = document.createElement("video");
                vid.dataset.src = `${item.url}#t=0.1`;
                vid.preload = "metadata";
                vid.muted = true;
                thumb.appendChild(vid);
                thumb.insertAdjacentHTML("beforeend", '<i class="fa-solid fa-play"></i>');
            } else {
                const img = document.createElement("img");
                img.dataset.src = item.url;
                img.alt = `Medium ${idx + 1}`;
                thumb.appendChild(img);
            }
            thumb.addEventListener("click", () => showViewerItem(idx));
            viewerThumbs.appendChild(thumb);
            viewerThumbObserver.observe(thumb);
        });
    }

    if (document.activeElement) document.activeElement.blur();
    document.body.style.overflow = "hidden";
    imageModal.style.display = "flex";
    showViewerItem(startIndex);
}

function showViewerItem(index) {
    if (index < 0 || index >= viewerItems.length) return;
    viewerIndex = index;
    const item = viewerItems[index];
    const url = item.url;
    const isVideo = isVideoUrl(url);

    // Absender und Zeitpunkt der Nachricht, zu der das aktuelle Medium gehört
    if (viewerSenderName) viewerSenderName.innerText = item.sender;
    if (viewerSenderTime) {
        const dateStr = item.date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
        const timeStr = item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        viewerSenderTime.innerText = `${dateStr} um ${timeStr}`;
    }
    const inPictureInPicture = modalVideoFull && document.pictureInPictureElement === modalVideoFull;

    if (modalVideoFull) {
        if (inPictureInPicture && (!isVideo || modalVideoFull.src === url)) {
            // Bild-im-Bild läuft weiter: Fotos werden normal angezeigt, dasselbe Video kehrt in den Betrachter zurück
            if (isVideo) document.exitPictureInPicture().catch(() => {});
            modalVideoFull.style.display = isVideo ? "block" : "none";
        } else {
            if (inPictureInPicture) document.exitPictureInPicture().catch(() => {});
            modalVideoFull.pause();
            if (isVideo) {
                modalVideoFull.src = url;
                modalVideoFull.style.display = "block";
                modalVideoFull.play().catch(() => {});
            } else {
                modalVideoFull.removeAttribute("src");
                modalVideoFull.load();
                modalVideoFull.style.display = "none";
            }
        }
    }
    if (modalImageFull) {
        if (isVideo) {
            modalImageFull.style.display = "none";
        } else {
            modalImageFull.src = url;
            modalImageFull.style.display = "block";
        }
    }

    if (viewerCounter) viewerCounter.innerText = item.albumSize > 1 ? `${item.albumIndex + 1} von ${item.albumSize}` : "";
    if (viewerPrevBtn) viewerPrevBtn.style.visibility = index > 0 ? "visible" : "hidden";
    if (viewerNextBtn) viewerNextBtn.style.visibility = index < viewerItems.length - 1 ? "visible" : "hidden";

    if (viewerDownloadBtn) {
        const isWebUrl = /^https?:\/\//i.test(url);
        viewerDownloadBtn.style.display = isWebUrl ? "flex" : "none";
        viewerDownloadBtn.href = isWebUrl ? `${url}${url.includes("?") ? "&" : "?"}download=` : "#";
    }

    if (viewerThumbs) {
        Array.from(viewerThumbs.children).forEach((thumb, i) => {
            thumb.classList.toggle("active", i === index);
            thumb.classList.toggle("other-album", viewerItems[i].msgId !== item.msgId);
        });
        const activeThumb = viewerThumbs.children[index];
        if (activeThumb) {
            viewerThumbs.scrollLeft = activeThumb.offsetLeft - (viewerThumbs.clientWidth - activeThumb.offsetWidth) / 2;
        }
    }
}

function closeMediaViewer() {
    if (!imageModal) return;
    imageModal.style.display = "none";
    document.body.style.overflow = "";
    // Läuft das Video im Bild-im-Bild-Fenster, spielt es nach dem Schließen weiter (man kann nebenbei chatten)
    if (modalVideoFull && document.pictureInPictureElement !== modalVideoFull) stopViewerVideo();
    if (modalImageFull) modalImageFull.style.display = "none";
}

function stopViewerVideo() {
    modalVideoFull.pause();
    modalVideoFull.removeAttribute("src");
    modalVideoFull.load();
    modalVideoFull.style.display = "none";
}

// Fügt Fotos/Videos der aktuellen Auswahl hinzu (Dateiauswahl oder Drag & Drop) – bereits gewählte Dateien bleiben erhalten
function addMediaFiles(newFiles) {
    if (!imageUploadInput) return;
    const MAX_FILE_SIZE = 200 * 1024 * 1024;
    // Die bisherige Auswahl zählt nur, solange ihre Vorschau sichtbar ist (Senden und Entfernen blenden sie aus)
    if (!imagePreviewContainer || imagePreviewContainer.style.display !== "flex") selectedMediaFiles = [];
    const media = newFiles.filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));

    if (newFiles.length > 0 && media.length === 0) {
        showToast("Es können nur Fotos und Videos gesendet werden.", "error");
    } else if (media.some(f => f.size > MAX_FILE_SIZE)) {
        showToast("Dein Medium konnte nicht hochgeladen werden, da die Datei das Dateigrößenlimit überschreitet.", "error");
    } else if (media.length > 0) {
        const fileKey = (f) => `${f.name}_${f.size}_${f.lastModified}`;
        const known = new Set(selectedMediaFiles.map(fileKey));
        selectedMediaFiles = [...selectedMediaFiles, ...media.filter(f => !known.has(fileKey(f)))];
        mediaPickedAt = Date.now();
    }

    // Das Eingabefeld enthält immer die gesamte Auswahl (wird beim Senden ausgelesen)
    const transfer = new DataTransfer();
    selectedMediaFiles.forEach(f => transfer.items.add(f));
    imageUploadInput.files = transfer.files;

    if (selectedMediaFiles.length === 0) {
        if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
        return;
    }
    if (previewThumbsList) {
        previewThumbsList.innerHTML = "";
        selectedMediaFiles.forEach(file => {
            const elem = file.type.startsWith("video/") ? document.createElement("video") : document.createElement("img");
            elem.src = URL.createObjectURL(file);
            elem.style.cssText = "width: 40px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid var(--gsra-blue);";
            previewThumbsList.appendChild(elem);
        });
    }
    if (imagePreviewName) imagePreviewName.textContent = `${selectedMediaFiles.length} Datei(en) ausgewählt`;
    if (imagePreviewContainer) imagePreviewContainer.style.display = "flex";
}

// Große Emoji-Auswahl für Reaktionen – dieselbe Komponente wie beim Schreiben (deutsch, alle Emojis, Kategorien, Suche)
function createReactionEmojiPicker(msg, popup) {
    const picker = document.createElement("emoji-picker");
    picker.className = "dark gsra-reaction-picker";
    picker.setAttribute("locale", "de");
    picker.setAttribute("data-source", EMOJI_DATA_SOURCE_DE);
    if (window.gsraEmojiI18n) picker.i18n = window.gsraEmojiI18n;
    picker.addEventListener("emoji-click", async (event) => {
        popup.style.display = "none";
        popup.replaceChildren();
        await toggleReaction(msg, event.detail.unicode);
    });
    return picker;
}

// Öffnet ein Nachrichten-Popup (Reaktionen, Emoji-Auswahl, Menü) dort, wo im sichtbaren Chatbereich Platz ist.
// Passt es nirgends ganz hin, wird es niedriger – so wird nichts abgeschnitten und der Chat verschiebt sich nicht.
function placeMessagePopup(popup, anchor, baseClass, dirPrefix, preferBelow = false, resizable = null) {
    const area = chatMessages.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const spaceAbove = anchorRect.top - area.top - 6;
    const spaceBelow = area.bottom - anchorRect.bottom - 6;

    if (resizable) resizable.style.height = "";
    popup.className = `${baseClass} ${dirPrefix}-below`;
    popup.style.visibility = "hidden";
    popup.style.display = "flex";
    const height = popup.offsetHeight;

    let below;
    if ((preferBelow ? spaceBelow : spaceAbove) >= height) below = preferBelow;
    else if ((preferBelow ? spaceAbove : spaceBelow) >= height) below = !preferBelow;
    else below = spaceBelow > spaceAbove;

    popup.className = `${baseClass} ${dirPrefix}-${below ? "below" : "above"}`;
    const space = below ? spaceBelow : spaceAbove;
    if (resizable && height > space) {
        resizable.style.height = `${Math.max(200, resizable.offsetHeight - (height - space))}px`;
    }
    popup.style.visibility = "";
}

async function checkUserAdminStatus() {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !currentUser?.id) return;
    try {
        const { data } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .maybeSingle();
        isAdminUser = data?.role === 'admin';
    } catch (e) {
        isAdminUser = false;
    }
}

async function loadFavorites() {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !currentUser?.id) return;
    try {
        const { data } = await supabase
            .from("chat_favorites")
            .select("chat_id")
            .eq("user_id", currentUser.id);

        if (data) {
            userFavorites = new Set(data.map(f => f.chat_id));
        }
    } catch (e) {
        userFavorites = new Set();
    }
}

async function toggleFavorite(chatId, event) {
    if (event) event.stopPropagation();
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !currentUser?.id) return;

    try {
        if (userFavorites.has(chatId)) {
            await supabase.from("chat_favorites").delete().match({ user_id: currentUser.id, chat_id: chatId });
            userFavorites.delete(chatId);
        } else {
            await supabase.from("chat_favorites").insert([{ user_id: currentUser.id, chat_id: chatId }]);
            userFavorites.add(chatId);
        }
        renderChatsList();
    } catch (e) {
        console.error("Favoriten-Fehler:", e);
    }
}

async function fetchUserName(userId) {
    if (userNamesCache[userId]) return userNamesCache[userId];
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !userId) return `Fahrer`;
    
    try {
        const { data } = await supabase
            .from("profiles")
            .select("username, full_name")
            .eq("id", userId)
            .maybeSingle();

        const name = data?.username || data?.full_name || `Fahrer`;
        userNamesCache[userId] = name;
        return name;
    } catch (e) {
        return `Fahrer`;
    }
}

async function checkUrlParameters() {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !currentUser?.id) return;
    const urlParams = new URLSearchParams(window.location.search);
    const sellerId = urlParams.get("sellerId");
    const sellerName = urlParams.get("sellerName") || "Verkäufer";
    const itemTitle = urlParams.get("itemTitle");
    const friendId = urlParams.get("friendId");

    const targetId = sellerId || friendId;
    if (targetId && targetId !== currentUser.id) {
        const [u1, u2] = [currentUser.id, targetId].sort();
        let existingChat = null;

        const { data: fetched } = await supabase
            .from("chats")
            .select("*")
            .eq("user1_id", u1)
            .eq("user2_id", u2)
            .maybeSingle();

        if (fetched && fetched.user1_id !== fetched.user2_id) {
            existingChat = fetched;
        } else {
            const sysMsg = itemTitle ? `Anfrage zu: ${itemTitle}` : `${currentUsername} hat den Chat eröffnet.`;
            const { data: newChat, error } = await supabase
                .from("chats")
                .insert([{
                    user1_id: u1,
                    user2_id: u2,
                    title: null,
                    last_message: sysMsg
                }])
                .select()
                .single();

            if (!error && newChat) {
                await supabase.from("messages").insert([{
                    chat_id: newChat.id,
                    sender_id: currentUser.id,
                    text: sysMsg
                }]);
                existingChat = newChat;
            }
        }

        if (existingChat) {
            activeChatId = existingChat.id;
            markChatAsRead(activeChatId);
            if (waWelcomeScreen) waWelcomeScreen.style.display = "none";
            if (waChatActivePane) waChatActivePane.style.display = "flex";
            openChat(existingChat.id, sellerName, existingChat.title);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

function setupGlobalMessageListener() {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !currentUser?.id) return;

    if (globalListenerChannel) {
        supabase.removeChannel(globalListenerChannel);
        globalListenerChannel = null;
    }

    globalListenerChannel = supabase
        .channel(`global_messages_channel_${Math.random()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async (payload) => {
            const eventType = payload.eventType; 
            const msg = payload.new || payload.old;
            if (!msg || !msg.chat_id) return;

            const targetChat = allChatsCache.find(c => c.id === msg.chat_id);
            if (targetChat) {
                await updateChatLastMessageInfo(targetChat, supabase);

                if (eventType === 'INSERT' && msg.sender_id !== currentUser.id) {
                    if (targetChat.id !== activeChatId || document.hidden) {
                        targetChat.unread = true;
                    }
                }

                if (eventType === 'INSERT') {
                    allChatsCache.sort((a, b) => new Date(b.last_msg_time || b.created_at || 0) - new Date(a.last_msg_time || a.created_at || 0));
                }

                updateGlobalUnreadState();
                renderChatsList();
            } else {
                loadUserChats();
            }
        })
        .subscribe();
}

async function updateChatLastMessageInfo(chat, supabase) {
    const { data: recentMsgs } = await supabase
        .from("messages")
        .select("created_at, sender_id, text")
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: false })
        .limit(1);

    // Persönliche Willkommensnachricht im offiziellen Forum (Zeitpunkt der Registrierung)
    const welcomeTime = (chat.id === officialForumChatId && currentUser?.created_at) ? new Date(currentUser.created_at).getTime() : 0;

    if (!recentMsgs || recentMsgs.length === 0) {
        chat.last_msg_time = welcomeTime ? currentUser.created_at : chat.created_at;
        chat.last_message = welcomeTime ? WELCOME_PREVIEW_TEXT : "Keine Nachrichten";
        return;
    }

    const latestMsg = recentMsgs[0];
    chat.last_msg_time = latestMsg.created_at;
    chat.last_message = latestMsg.text || "[Medien]";

    // Neueste Reaktion im Chat ermitteln (auch auf ältere Nachrichten) - unabhängig von der Position der Nachricht
    const { data: reactedMsgs } = await supabase
        .from("messages")
        .select("reactions, last_reaction_user, last_reaction_emoji, last_reaction_at")
        .eq("chat_id", chat.id)
        .not("last_reaction_at", "is", null)
        .order("last_reaction_at", { ascending: false })
        .limit(5);

    // Nur gültige Reaktionen berücksichtigen (Reaktion existiert noch, Nachricht nicht gelöscht)
    const latestReaction = (reactedMsgs || []).find(r =>
        r.last_reaction_user &&
        r.last_reaction_emoji &&
        r.reactions &&
        String(r.reactions[r.last_reaction_user]) === String(r.last_reaction_emoji)
    );

    // Neueste Bearbeitung einer Nachricht (nur Vorschau in der Sidebar, nicht im Chat)
    const { data: editedMsgs } = await supabase
        .from("messages")
        .select("sender_id, text, is_edited, edited_at, edit_count")
        .eq("chat_id", chat.id)
        .not("edited_at", "is", null)
        .order("edited_at", { ascending: false })
        .limit(5);

    const latestEdit = (editedMsgs || []).find(m =>
        m.is_edited === true &&
        m.text !== "Du hast diese Nachricht gelöscht" &&
        m.text !== "Diese Nachricht wurde gelöscht"
    );

    const msgTime = new Date(latestMsg.created_at).getTime();
    const reactionTime = latestReaction ? new Date(latestReaction.last_reaction_at).getTime() : 0;
    const editTime = latestEdit ? new Date(latestEdit.edited_at).getTime() : 0;

    // Das jüngste Ereignis (Nachricht, Reaktion oder Bearbeitung) bestimmt die Vorschau
    if (editTime > msgTime && editTime >= reactionTime) {
        const isSelf = String(latestEdit.sender_id) === String(currentUser.id);
        const editorName = isSelf ? "Du" : await fetchUserName(latestEdit.sender_id);
        const verb = isSelf ? "hast" : "hat";
        chat.last_message = (Number(latestEdit.edit_count) > 1)
            ? `${editorName} ${verb} die Nachricht erneut bearbeitet`
            : `${editorName} ${verb} eine Nachricht bearbeitet`;
    } else if (reactionTime > msgTime) {
        const isSelf = String(latestReaction.last_reaction_user) === String(currentUser.id);
        const reactorName = isSelf ? "Du" : await fetchUserName(latestReaction.last_reaction_user);
        const verb = isSelf ? "hast" : "hat";
        chat.last_message = `${reactorName} ${verb} mit ${latestReaction.last_reaction_emoji} reagiert`;
    }

    if (welcomeTime > Math.max(msgTime, reactionTime, editTime)) {
        chat.last_msg_time = currentUser.created_at;
        chat.last_message = WELCOME_PREVIEW_TEXT;
    }
}

function updateGlobalUnreadState() {
    const hasUnread = allChatsCache.some(c => c.unread === true);
    localStorage.setItem('gsra_has_unread', hasUnread ? 'true' : 'false');

    const navBtn = document.getElementById("messengerNavBtn") || document.querySelector('a[href="messenger.html"]');
    if (navBtn) {
        if (hasUnread) {
            navBtn.classList.add("nav-unread-glow");
        } else {
            navBtn.classList.remove("nav-unread-glow");
        }
    }
}

function getLastReadTime(chatId) {
    if (!currentUser?.id) return 0;
    const val = localStorage.getItem(`gsra_last_read_${currentUser.id}_${chatId}`);
    return val ? new Date(val).getTime() : 0;
}

function markChatAsRead(chatId) {
    if (!currentUser?.id || !chatId) return;
    localStorage.setItem(`gsra_last_read_${currentUser.id}_${chatId}`, new Date().toISOString());
    const chatObj = allChatsCache.find(c => c.id === chatId);
    if (chatObj) {
        chatObj.unread = false;
    }
    updateGlobalUnreadState();
}

async function loadUserChats() {
    const supabase = window.supabaseClient || window.supabase;
    if (!chatsList || !currentUser?.id || !supabase) return;

    let rawChats = [];
    try {
        const { data: chatsAsUser1 } = await supabase.from("chats").select("*").eq("user1_id", currentUser.id);
        const { data: chatsAsUser2 } = await supabase.from("chats").select("*").eq("user2_id", currentUser.id);
        const { data: groupChats } = await supabase.from("chats").select("*").not("title", "is", null);

        const combined = [...(chatsAsUser1 || []), ...(chatsAsUser2 || []), ...(groupChats || []).filter(c => c.user1_id === c.user2_id)];
        const map = new Map();
        combined.forEach(c => map.set(c.id, c));
        rawChats = Array.from(map.values());
    } catch (err) {
        console.error("Fehler beim Laden der Chats:", err);
    }

    // Offizielles Forum eindeutig bestimmen: Gibt es (versehentlich) mehrere, gilt immer das älteste – für alle Mitglieder gleich
    const officialCandidates = rawChats
        .filter(c => c.title === 'GSRA Official / Community Forum')
        .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    let forumChat = officialCandidates[0] || rawChats.find(c => c.title && c.title.includes('Official'));

    if (!forumChat) {
        const { data: globalForums, error: forumLookupError } = await supabase
            .from("chats")
            .select("*")
            .eq("title", 'GSRA Official / Community Forum')
            .order("created_at", { ascending: true })
            .limit(1);
        if (globalForums && globalForums.length > 0) {
            forumChat = globalForums[0];
            rawChats.unshift(forumChat);
        } else if (isAdminUser && !forumLookupError) {
            // Nur anlegen, wenn sicher keins existiert – nicht bei einem Ladefehler (sonst entstehen doppelte Foren)
            const { data: createdForum, err: forumErr } = await supabase.from("chats").insert([{
                user1_id: currentUser.id,
                user2_id: currentUser.id,
                title: 'GSRA Official / Community Forum',
                last_message: 'Willkommen im offiziellen Community-Forum!'
            }]).select().single();

            if (!forumErr && createdForum) {
                forumChat = createdForum;
                rawChats.unshift(createdForum);
            }
        }
    }

    if (forumChat) officialForumChatId = forumChat.id;

    let accessibleChats = [];
    for (const chat of rawChats) {
        // Doppelte offizielle Foren ausblenden – angezeigt wird nur das eine offizielle Forum
        if (chat.title === 'GSRA Official / Community Forum' && officialForumChatId && chat.id !== officialForumChatId) continue;
        const isOfficial = (chat.id === officialForumChatId || (chat.title && chat.title.includes('Official')));
        const isDirect = (chat.user1_id !== chat.user2_id);
        const isGroup = (chat.title !== null && chat.user1_id === chat.user2_id); // Forum/Gruppe = Titel gesetzt UND user1_id === user2_id; umbenannte Direktchats bleiben Chats
        if (isOfficial || isDirect || isGroup) accessibleChats.push(chat);
    }

    let uniqueMap = new Map();
    for (const chat of accessibleChats) {
        if (!uniqueMap.has(chat.id)) uniqueMap.set(chat.id, chat);
    }

    allChatsCache = Array.from(uniqueMap.values());

    for (const chat of allChatsCache) {
        if (chat.user1_id !== chat.user2_id) {
            const otherUserId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
            await fetchUserName(otherUserId);
        }

        await updateChatLastMessageInfo(chat, supabase);

        if (chat.id === activeChatId) {
            chat.unread = false;
        } else {
            const lastRead = getLastReadTime(chat.id);
            const lastReadIso = lastRead === 0 ? '1970-01-01T00:00:00.000Z' : new Date(lastRead).toISOString();
            const { data: unreadMsgs } = await supabase
                .from("messages")
                .select("id")
                .eq("chat_id", chat.id)
                .neq("sender_id", currentUser.id)
                .gt("created_at", lastReadIso)
                .limit(1);

            chat.unread = Boolean(unreadMsgs && unreadMsgs.length > 0);

            // Willkommensnachricht gilt als ungelesen, bis das offizielle Forum nach der Registrierung geöffnet wurde
            if (chat.id === officialForumChatId && currentUser.created_at && lastRead < new Date(currentUser.created_at).getTime()) {
                chat.unread = true;
            }
        }
    }

    allChatsCache.sort((a, b) => new Date(b.last_msg_time || b.created_at || 0) - new Date(a.last_msg_time || a.created_at || 0));

    updateGlobalUnreadState();
    renderChatsList();
    setupGlobalMessageListener();
}

async function renderChatsList() {
    if (!chatsList || isRendering) return;
    isRendering = true;

    chatsList.innerHTML = "";
    const searchTerm = chatSearchInput ? chatSearchInput.value.toLowerCase() : "";

    let filtered = allChatsCache.filter(chat => {
        const isOfficial = (chat.id === officialForumChatId || (chat.title && chat.title.includes('Official')));
        const isGroup = (chat.title !== null && chat.user1_id === chat.user2_id && !isOfficial);
        const otherUserId = (chat.user1_id !== chat.user2_id) ? (chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id) : null;
        const otherUserName = otherUserId ? (userNamesCache[otherUserId] || "Fahrer") : "";
        
        const searchTarget = (chat.title ? chat.title + " " + otherUserName : otherUserName).toLowerCase();
        const matchesSearch = searchTarget.includes(searchTerm);
        if (!matchesSearch) return false;

        if (currentFilter === 'unread') return chat.unread === true;
        if (currentFilter === 'favorites') return userFavorites.has(chat.id);
        if (currentFilter === 'forums') return isGroup || isOfficial;
        return true;
    });

    if (filtered.length === 0) {
        chatsList.innerHTML = `<p style="padding: 15px; font-size: 13px; color: var(--text-muted);">Keine Chats gefunden.</p>`;
        isRendering = false;
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const chat of filtered) {
        const isOfficial = (chat.id === officialForumChatId || (chat.title && chat.title.includes('Official')));
        const isGroup = (chat.title !== null && chat.user1_id === chat.user2_id && !isOfficial);
        const isForumOrGroup = isOfficial || isGroup;

        let otherUserName = "Fahrer";
        if (!isForumOrGroup && chat.user1_id !== chat.user2_id) {
            const otherUserId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
            otherUserName = userNamesCache[otherUserId] || "Fahrer";
        }

        const item = document.createElement("div");
        const isSelected = chat.id === activeChatId;
        const isUnread = chat.unread === true;
        const isFav = userFavorites.has(chat.id);

        item.className = `wa-chat-item ${isSelected ? 'active' : ''} ${isUnread ? 'unread' : ''}`;
        
        let displayTitle = isOfficial ? "GSRA Official / Community Forum" : (isGroup ? chat.title : (chat.title ? `${chat.title} (${otherUserName})` : `Chat mit ${otherUserName}`));
        const lastMsg = escapeHtml(chat.last_message || 'Keine Nachrichten');

        item.innerHTML = `
            <div class="wa-avatar"><i class="fa-solid ${isForumOrGroup ? 'fa-bullhorn text-yellow' : 'fa-user'}"></i></div>
            <div class="wa-chat-info">
                <div class="wa-chat-row">
                    <span class="wa-chat-name">${escapeHtml(displayTitle)}</span>
                    <button class="wa-favorite-btn ${isFav ? 'favorited' : ''}" title="Als Favorit markieren"><i class="fa-solid fa-star"></i></button>
                </div>
                <div class="wa-chat-msg">${lastMsg}</div>
            </div>
        `;

        item.querySelector(".wa-favorite-btn").addEventListener("click", (e) => toggleFavorite(chat.id, e));

        item.addEventListener("click", () => {
            activeChatId = chat.id;
            markChatAsRead(chat.id);
            if (waWelcomeScreen) waWelcomeScreen.style.display = "none";
            if (waChatActivePane) waChatActivePane.style.display = "flex";

            if (isForumOrGroup) openForumChat(chat);
            else openChat(chat.id, otherUserName, chat.title);
            renderChatsList();
        });

        fragment.appendChild(item);
    }

    chatsList.appendChild(fragment);
    isRendering = false;
}

function openForumChat(forumChat = null) {
    const chatId = forumChat?.id || officialForumChatId;
    if (!chatId) return;
    activeChatId = chatId;
    markChatAsRead(chatId);

    if (chatTitleText) chatTitleText.innerText = forumChat?.title || "GSRA Official / Community Forum";
    if (chatActions) chatActions.style.display = "flex";
    if (addMemberBtn) addMemberBtn.style.display = (chatId === officialForumChatId) ? "none" : "block";
    if (blockUserBtn) blockUserBtn.style.display = "none";

    const isOfficialAnnouncement = (chatId === officialForumChatId);
    // Das offizielle Forum kann weder umbenannt noch gelöscht werden – die Knöpfe erscheinen dort gar nicht erst
    if (editChatTitleBtn) editChatTitleBtn.style.display = isOfficialAnnouncement ? "none" : "";
    if (deleteChatBtn) deleteChatBtn.style.display = isOfficialAnnouncement ? "none" : "";
    if (isOfficialAnnouncement && !isAdminUser) {
        if (messageInput) { messageInput.disabled = true; messageInput.placeholder = "Nur Administratoren können im offiziellen Forum schreiben."; }
        if (sendBtn) sendBtn.disabled = true;
    } else {
        if (messageInput) { messageInput.disabled = false; messageInput.placeholder = "Schreibe eine Nachricht..."; }
        if (sendBtn) sendBtn.disabled = false;
    }

    if (chatMessages) chatMessages.innerHTML = "";
    loadChatMessages(chatId);
    renderChatsList();
}

async function openChat(chatId, recipientName, chatTitle = null) {
    if (!chatId) return;
    activeChatId = chatId;
    markChatAsRead(chatId);

    const displayName = chatTitle ? `${chatTitle} (${recipientName})` : `Chat mit ${recipientName}`;
    if (chatTitleText) chatTitleText.innerText = displayName;
    
    if (chatActions) chatActions.style.display = "flex";
    if (addMemberBtn) addMemberBtn.style.display = "none";
    if (blockUserBtn) blockUserBtn.style.display = "block";
    if (editChatTitleBtn) editChatTitleBtn.style.display = "";
    if (deleteChatBtn) deleteChatBtn.style.display = "";

    if (messageInput) { messageInput.disabled = false; messageInput.placeholder = "Gib eine Nachricht ein..."; }
    if (imageUploadInput) imageUploadInput.disabled = false;
    if (emojiToggleBtn) emojiToggleBtn.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    loadChatMessages(chatId);
    renderChatsList();
}

async function loadChatMessages(chatId) {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !chatId) return;

    if (messageSubscription) {
        supabase.removeChannel(messageSubscription);
        messageSubscription = null;
    }

    const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

    messagesCacheMap.clear();
    if (messages) messages.forEach(m => messagesCacheMap.set(m.id, m));

    await renderMessages(messages || [], chatId);

    const channelName = `chat_${chatId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    messageSubscription = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, async () => {
            const { data: updatedMessages } = await supabase
                .from("messages")
                .select("*")
                .eq("chat_id", chatId)
                .order("created_at", { ascending: true });
            
            messagesCacheMap.clear();
            if (updatedMessages) updatedMessages.forEach(m => messagesCacheMap.set(m.id, m));
            await renderMessages(updatedMessages || [], chatId);
        })
        .subscribe();
}

// Stellt die persönliche Willkommensnachricht (Zeitpunkt = Registrierung) immer als oberste Nachricht ins offizielle Forum
function withWelcomeMessage(messages, chatId) {
    if (!chatId || chatId !== officialForumChatId || !currentUser?.created_at) return messages;
    const welcomeMsg = {
        id: WELCOME_MESSAGE_ID,
        chat_id: chatId,
        sender_id: null,
        created_at: currentUser.created_at,
        text: WELCOME_PREVIEW_TEXT,
        is_welcome: true
    };
    return [welcomeMsg, ...messages];
}

function appendWelcomeMessage(msg) {
    const placeholder = chatMessages.querySelector(".chat-placeholder");
    if (placeholder) placeholder.remove();

    const wrapperDiv = document.createElement("div");
    wrapperDiv.style.cssText = "display: flex; flex-direction: column; width: 100%; position: relative; align-items: flex-start;";

    const dateObj = new Date(msg.created_at);
    const dateStr = dateObj.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const bubble = document.createElement("div");
    bubble.id = `msg-${msg.id}`;
    bubble.className = "message-bubble message-other wa-welcome-bubble";
    bubble.innerHTML = `
        <div class="msg-author">GSRA-Team <i class="fa-solid fa-circle-check text-blue" title="Offizielle Nachricht"></i></div>
        ${WELCOME_MESSAGE_HTML}
        <div class="message-footer"><span class="message-time">${dateStr}, ${timeStr}</span></div>
    `;

    wrapperDiv.appendChild(bubble);
    chatMessages.appendChild(wrapperDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function renderMessages(messages, chatId = activeChatId) {
    if (!chatMessages) return;
    chatMediaItems = [];
    messages = withWelcomeMessage(messages, chatId);
    if (messages.length === 0) {
        chatMessages.innerHTML = `<p class="chat-placeholder" style="text-align: center; color: var(--text-muted); margin: auto;">Schreibe die erste Nachricht...</p>`;
        return;
    }
    chatMessages.innerHTML = "";
    const seenSystemTexts = new Set();
    for (const msg of messages) {
        const isSystem = msg.text && (msg.text.includes("hat den Chat") || msg.text.includes("hat das Forum") || msg.text.includes("zum Forum hinzugefügt") || msg.text.includes("umbenannt"));
        if (isSystem && !msg.image_url && !msg.reply_to) {
            const formatted = await formatSystemMessage(msg.text, msg.sender_id);
            if (seenSystemTexts.has(formatted)) continue;
            seenSystemTexts.add(formatted);
        }
        await appendSingleMessage(msg, isSystem);
    }

    // Erstes Öffnen des offiziellen Forums: zur Willkommensnachricht ganz oben springen statt ans Ende
    if (chatId === officialForumChatId && currentUser?.id) {
        const welcomeSeenKey = `gsra_welcome_seen_${currentUser.id}`;
        if (!localStorage.getItem(welcomeSeenKey)) {
            chatMessages.scrollTop = 0;
            localStorage.setItem(welcomeSeenKey, "true");
        }
    }
}

async function formatSystemMessage(text, senderId) {
    if (!text) return "";
    const isOwnAction = String(senderId) === String(currentUser?.id);
    const actorName = await fetchUserName(senderId);

    if (text.includes("zum Forum hinzugefügt")) {
        const match = text.match(/^(.+?)\s+hat\s+(.+?)\s+zum Forum hinzugefügt/i);
        const target = match && match[2] ? match[2] : "jemanden";
        return isOwnAction ? `Du hast ${target} zum Forum hinzugefügt.` : `Du wurdest von ${actorName} zum Forum hinzugefügt.`;
    }
    if (text.includes("hat den Chat eröffnet")) {
        return isOwnAction ? "Du hast den Chat eröffnet." : `${actorName} hat den Chat mit dir eröffnet.`;
    }
    if (text.includes("hat das Forum erstellt")) {
        return isOwnAction ? "Du hast das Forum erstellt." : `${actorName} hat das Forum erstellt.`;
    }
    if (text.includes("umbenannt")) {
        return isOwnAction ? text.replace(new RegExp(`^${actorName}\\s+hat`, 'i'), 'Du hast') : text;
    }
    return text;
}

async function toggleReaction(msg, emoji) {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !currentUser?.id || !msg?.id) return;

    // Aktuellen Stand frisch laden, damit Reaktionen anderer Nutzer nicht überschrieben werden
    const { data: fresh } = await supabase.from("messages").select("*").eq("id", msg.id).maybeSingle();
    const currentReactions = { ...((fresh && fresh.reactions) || msg.reactions || {}) };

    let removed = false;
    if (currentReactions[currentUser.id] === emoji) {
        delete currentReactions[currentUser.id];
        removed = true;
    } else {
        currentReactions[currentUser.id] = emoji;
    }

    const payload = { reactions: currentReactions };
    if (!removed) {
        payload.last_reaction_user = currentUser.id;
        payload.last_reaction_emoji = emoji;
        payload.last_reaction_at = new Date().toISOString();
    } else if (fresh && String(fresh.last_reaction_user) === String(currentUser.id)) {
        payload.last_reaction_user = null;
        payload.last_reaction_emoji = null;
        payload.last_reaction_at = null;
    }

    let { data: updated, error } = await supabase.from("messages").update(payload).eq("id", msg.id).select("id");
    if (error) {
        // Fallback, falls die Zusatzspalten (reactions_setup.sql) noch nicht existieren
        ({ data: updated, error } = await supabase.from("messages").update({ reactions: currentReactions }).eq("id", msg.id).select("id"));
    }

    if (error || !updated || updated.length === 0) {
        console.error("Reaktion konnte nicht gespeichert werden:", error);
        showToast("Die Reaktion konnte nicht gespeichert werden (fehlende Berechtigung). Bitte die Policies aus reactions_setup.sql in Supabase ausführen.", "error");
        return;
    }

    await loadChatMessages(activeChatId);
    await loadUserChats();
}

async function appendSingleMessage(msg, isSystem = false) {
    if (!chatMessages) return;
    if (msg.is_welcome) {
        appendWelcomeMessage(msg);
        return;
    }
    const placeholder = chatMessages.querySelector(".chat-placeholder");
    if (placeholder) placeholder.remove();

    const wrapperDiv = document.createElement("div");
    wrapperDiv.style.cssText = "display: flex; flex-direction: column; width: 100%; position: relative;";
    const isOwn = String(msg.sender_id) === String(currentUser?.id);
    wrapperDiv.style.alignItems = isOwn ? "flex-end" : "flex-start";

    const bubble = document.createElement("div");
    bubble.id = `msg-${msg.id}`;
    bubble.className = `message-bubble ${isOwn ? 'message-own' : 'message-other'}`;

    const senderName = isOwn ? "Du" : await fetchUserName(msg.sender_id);
    const dateObj = msg.created_at ? new Date(msg.created_at) : new Date();
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isDeleted = msg.text === "Du hast diese Nachricht gelöscht" || msg.text === "Diese Nachricht wurde gelöscht";
    const isSystemOrDeletedMsg = isSystem || isDeleted;

    const selectionCb = document.createElement("div");
    selectionCb.className = "msg-selection-checkbox";
    if (isOwn && !isSystemOrDeletedMsg) {
        bubble.appendChild(selectionCb);
    }

    bubble.addEventListener("click", (e) => {
        if (isMultiSelectMode && isOwn && !isSystemOrDeletedMsg) {
            e.stopPropagation();
            if (selectedMessageIds.has(msg.id)) {
                selectedMessageIds.delete(msg.id);
                bubble.classList.remove("selected-bubble");
                selectionCb.innerHTML = "";
            } else {
                selectedMessageIds.add(msg.id);
                bubble.classList.add("selected-bubble");
                selectionCb.innerHTML = '<i class="fa-solid fa-check"></i>';
            }
            updateMultiDeleteCount();
        }
    });

    if (!isSystem && !isDeleted) {
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "message-actions";

        const emojiBtn = document.createElement("button");
        emojiBtn.className = "msg-action-btn";
        emojiBtn.title = "Mit Emoji reagieren";
        emojiBtn.innerHTML = '<i class="fa-regular fa-face-smile"></i>';

        const quickBar = document.createElement("div");
        quickBar.className = "wa-quick-reaction-bar";
        quickBar.addEventListener("click", (e) => e.stopPropagation());

        const topEmojis = ["👍", "❤️", "😂", "😮"];
        topEmojis.forEach(em => {
            const span = document.createElement("span");
            span.innerText = em;
            span.addEventListener("click", async (e) => {
                e.stopPropagation();
                quickBar.style.display = "none";
                await toggleReaction(msg, em);
            });
            quickBar.appendChild(span);
        });

        const plusSpan = document.createElement("span");
        plusSpan.innerHTML = '<i class="fa-solid fa-plus" style="font-size: 12px;"></i>';
        plusSpan.title = "Weitere Emojis";

        const pickerPopup = document.createElement("div");
        pickerPopup.className = "message-react-picker-popup";
        pickerPopup.addEventListener("click", (e) => e.stopPropagation());

        plusSpan.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = pickerPopup.style.display === "flex";
            document.querySelectorAll(".message-react-picker-popup").forEach(p => {
                p.style.display = "none";
                p.replaceChildren();
            });

            if (!isOpen) {
                // Große Emoji-Auswahl (alle Emojis, Kategorien, deutsche Suche); möglichst auf der Seite der Schnellleiste
                const picker = createReactionEmojiPicker(msg, pickerPopup);
                pickerPopup.appendChild(picker);
                placeMessagePopup(pickerPopup, actionsDiv, "message-react-picker-popup", "popup", quickBar.classList.contains("bar-below"), picker);
                setTimeout(() => picker.shadowRoot?.querySelector("input")?.focus(), 50);
            } else {
                pickerPopup.style.display = "none";
            }
        });

        quickBar.appendChild(plusSpan);

        emojiBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = quickBar.style.display === "flex";
            document.querySelectorAll(".wa-quick-reaction-bar").forEach(b => b.style.display = "none");
            document.querySelectorAll(".wa-msg-dropdown").forEach(d => d.style.display = "none");
            document.querySelectorAll(".message-react-picker-popup").forEach(p => p.style.display = "none");
            
            if (!isOpen) {
                placeMessagePopup(quickBar, actionsDiv, "wa-quick-reaction-bar", "bar");
            } else {
                quickBar.style.display = "none";
            }
        });

        actionsDiv.appendChild(emojiBtn);
        actionsDiv.appendChild(quickBar);
        actionsDiv.appendChild(pickerPopup);

        const arrowBtn = document.createElement("button");
        arrowBtn.className = "msg-action-btn";
        arrowBtn.title = "Mehr Optionen";
        arrowBtn.innerHTML = '<i class="fa-solid fa-chevron-down" style="font-size: 11px;"></i>';

        const dropdownMenu = document.createElement("div");
        dropdownMenu.className = "wa-msg-dropdown";
        dropdownMenu.addEventListener("click", (e) => e.stopPropagation());

        const replyOption = document.createElement("button");
        replyOption.innerHTML = '<i class="fa-solid fa-reply"></i> Antworten';
        replyOption.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = "none";
            replyingToId = msg.id;
            if (replyPreviewBanner && replyBannerAuthor && replyBannerText) {
                replyBannerAuthor.innerText = `Antwort an ${senderName}`;
                replyBannerText.innerText = sanitizeQuoteText(msg.text || "[Medien]");
                replyPreviewBanner.style.display = "flex";
            }
            if (messageInput) messageInput.focus();
        });
        dropdownMenu.appendChild(replyOption);

        const copyOption = document.createElement("button");
        copyOption.innerHTML = '<i class="fa-solid fa-copy"></i> Kopieren';
        copyOption.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = "none";
            navigator.clipboard.writeText(msg.text || "").then(() => showToast("Nachricht in die Zwischenablage kopiert.", "success"));
        });
        dropdownMenu.appendChild(copyOption);

        if (isOwn) {
            if (msg.text && !msg.text.includes("hat den Chat") && !msg.text.includes("hat das Forum")) {
                const editOption = document.createElement("button");
                editOption.innerHTML = '<i class="fa-solid fa-pen"></i> Bearbeiten';
                editOption.addEventListener("click", (e) => {
                    e.stopPropagation();
                    dropdownMenu.style.display = "none";
                    editingMessageId = msg.id;
                    if (messageInput) {
                        messageInput.value = msg.text;
                        messageInput.focus();
                        messageInput.style.height = "auto";
                        messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + "px";
                    }
                    if (editPreviewBanner) {
                        document.getElementById("editBannerText").innerText = sanitizeQuoteText(msg.text);
                        editPreviewBanner.style.display = "flex";
                    }
                });
                dropdownMenu.appendChild(editOption);
            }

            const deleteOption = document.createElement("button");
            deleteOption.style.color = "#ff4d4d";
            deleteOption.innerHTML = '<i class="fa-solid fa-trash"></i> Löschen';
            deleteOption.addEventListener("click", (e) => {
                e.stopPropagation();
                dropdownMenu.style.display = "none";
                isMultiSelectMode = true;
                document.body.classList.add("multi-select-active");
                selectedMessageIds.clear();
                selectedMessageIds.add(msg.id);

                if (multiDeleteBar) multiDeleteBar.style.display = "flex";
                updateMultiDeleteCount();

                document.querySelectorAll(".message-bubble.message-own").forEach(b => b.classList.add("selection-mode"));
                bubble.classList.add("selected-bubble");
                selectionCb.innerHTML = '<i class="fa-solid fa-check"></i>';
            });
            dropdownMenu.appendChild(deleteOption);
        }

        arrowBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = dropdownMenu.style.display === "flex";
            document.querySelectorAll(".wa-msg-dropdown").forEach(d => d.style.display = "none");
            document.querySelectorAll(".wa-quick-reaction-bar").forEach(b => b.style.display = "none");
            document.querySelectorAll(".message-react-picker-popup").forEach(p => p.style.display = "none");

            if (!isOpen) {
                placeMessagePopup(dropdownMenu, actionsDiv, "wa-msg-dropdown", "dropdown");
            } else {
                dropdownMenu.style.display = "none";
            }
        });

        document.addEventListener("click", () => {
            dropdownMenu.style.display = "none";
            quickBar.style.display = "none";
            pickerPopup.style.display = "none";
            pickerPopup.replaceChildren();
        });

        actionsDiv.appendChild(arrowBtn);
        actionsDiv.appendChild(dropdownMenu);
        bubble.appendChild(actionsDiv);
    }

    const authorDiv = document.createElement("div");
    authorDiv.className = "msg-author";
    authorDiv.innerText = senderName;
    bubble.appendChild(authorDiv);

    if (!isDeleted && msg.reply_to && messagesCacheMap.has(msg.reply_to)) {
        const quotedMsg = messagesCacheMap.get(msg.reply_to);
        const quotedAuthor = String(quotedMsg.sender_id) === String(currentUser?.id) ? "Du" : await fetchUserName(quotedMsg.sender_id);
        const sanitizedQuote = sanitizeQuoteText(quotedMsg.text || "[Medien]");
        
        const quoteDiv = document.createElement("div");
        quoteDiv.className = "message-quoted";
        quoteDiv.innerHTML = `
            <div class="message-quoted-author">${escapeHtml(quotedAuthor)}</div>
            <div style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.9;">${escapeHtml(sanitizedQuote)}</div>
        `;
        
        quoteDiv.addEventListener("click", (e) => {
            e.stopPropagation();
            const targetElement = document.getElementById(`msg-${msg.reply_to}`);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetElement.classList.add('message-highlight');
                setTimeout(() => targetElement.classList.remove('message-highlight'), 1500);
            }
        });
        bubble.appendChild(quoteDiv);
    }

    if (!isDeleted && msg.image_url) {
        const urls = msg.image_url.split(",").map(u => u.trim()).filter(Boolean);
        const displayCount = Math.min(urls.length, 4);
        const gridContainer = document.createElement("div");
        gridContainer.className = `wa-media-grid count-${displayCount}`;

        // WhatsApp-Rahmen: Medien füllen die Blase bis auf einen dünnen Rand
        bubble.classList.add("has-media");
        if (!msg.text || msg.text === "[Medien]") bubble.classList.add("media-only");

        // Alle Medien des Chats chronologisch sammeln – der Betrachter blättert durch den ganzen Chat
        const mediaList = chatMediaItems;
        const albumStart = mediaList.length;
        urls.forEach((url, albumIndex) => mediaList.push({ url, msgId: msg.id, sender: senderName, date: dateObj, albumIndex, albumSize: urls.length }));

        for (let i = 0; i < displayCount; i++) {
            const cleanUrl = urls[i];
            const isVideo = isVideoUrl(cleanUrl);
            const hasMoreOverlay = (i === 3 && urls.length > 4);

            // Fotos und Videos nutzen dieselbe einheitliche Kachel
            const tile = document.createElement("div");
            tile.className = `wa-media-item${isVideo ? " is-video" : ""}${hasMoreOverlay ? " has-more" : ""}`;

            if (isVideo) {
                const videoElem = document.createElement("video");
                videoElem.src = `${cleanUrl}#t=0.1`;
                videoElem.preload = "metadata";
                videoElem.muted = true;
                videoElem.playsInline = true;
                tile.appendChild(videoElem);

                if (!hasMoreOverlay) {
                    const playIcon = document.createElement("div");
                    playIcon.className = "wa-media-play";
                    playIcon.innerHTML = '<i class="fa-solid fa-play"></i>';
                    tile.appendChild(playIcon);

                    const durationTag = document.createElement("div");
                    durationTag.className = "wa-media-duration";
                    durationTag.innerHTML = '<i class="fa-solid fa-video"></i>';
                    videoElem.addEventListener("loadedmetadata", () => {
                        if (isFinite(videoElem.duration)) {
                            durationTag.innerHTML = `<i class="fa-solid fa-video"></i> ${formatDuration(videoElem.duration)}`;
                        }
                    });
                    tile.appendChild(durationTag);
                }
            } else {
                const img = document.createElement("img");
                img.src = cleanUrl;
                img.alt = "Bild";
                tile.appendChild(img);
            }

            // Ab 5 Medien: 4. Kachel geblurrt mit +Anzahl der weiteren Medien (inkl. des geblurrten)
            if (hasMoreOverlay) {
                const overlay = document.createElement("div");
                overlay.className = "wa-media-overlay";
                overlay.innerText = `+${urls.length - 3}`;
                tile.appendChild(overlay);
            }

            tile.addEventListener("click", (e) => {
                if (isMultiSelectMode) return;
                e.stopPropagation();
                openMediaViewer(mediaList, albumStart + i);
            });
            gridContainer.appendChild(tile);
        }
        bubble.appendChild(gridContainer);
    }

    if (msg.text && msg.text !== "[Medien]") {
        const textDiv = document.createElement("div");
        textDiv.className = "message-text";
        if (isSystem) {
            textDiv.innerText = await formatSystemMessage(msg.text, msg.sender_id);
            textDiv.style.fontStyle = "italic";
            textDiv.style.opacity = "0.85";
        } else if (isDeleted) {
            textDiv.innerText = msg.text;
            textDiv.style.fontStyle = "italic";
            textDiv.style.opacity = "0.7";
        } else {
            textDiv.innerText = msg.text;
        }
        bubble.appendChild(textDiv);
    }

    const footerDiv = document.createElement("div");
    footerDiv.className = "message-footer";

    if (!isDeleted && msg.is_edited) {
        const editedSpan = document.createElement("span");
        editedSpan.style.cssText = "font-size: 10px; opacity: 0.6; font-style: italic; line-height: 1;";
        editedSpan.innerText = (Number(msg.edit_count) > 1) ? "erneut bearbeitet" : "bearbeitet";
        footerDiv.appendChild(editedSpan);
    }

    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.innerText = timeStr;
    footerDiv.appendChild(timeSpan);

    bubble.appendChild(footerDiv);
    wrapperDiv.appendChild(bubble);

    if (!isDeleted && msg.reactions && typeof msg.reactions === 'object' && Object.keys(msg.reactions).length > 0) {
        const reactionsContainer = document.createElement("div");
        reactionsContainer.className = `message-reactions-container ${isOwn ? 'align-right' : 'align-left'}`;

        const counts = {};
        Object.entries(msg.reactions).forEach(([userId, emoji]) => {
            counts[emoji] = (counts[emoji] || 0) + 1;
        });

        const sortedEmojis = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);

        const pill = document.createElement("div");
        const hasUserReacted = Object.keys(msg.reactions).some(u => String(u) === String(currentUser?.id));
        pill.className = `whatsapp-reaction-pill ${hasUserReacted ? 'user-reacted' : ''}`;

        let emojisHtml = "";
        sortedEmojis.forEach(([emoji]) => {
            emojisHtml += `<span class="wa-pill-emoji">${emoji}</span>`;
        });
        pill.innerHTML = emojisHtml;

        const totalReactionsCount = Object.keys(msg.reactions).length;
        if (totalReactionsCount > 1) {
            const countSpan = document.createElement("span");
            countSpan.className = "wa-pill-count";
            countSpan.innerText = formatCount(totalReactionsCount);
            pill.appendChild(countSpan);
        }

        pill.addEventListener("click", async (e) => {
            e.stopPropagation();
            const myCurrentEmoji = (msg.reactions || {})[currentUser.id];
            const targetEmoji = myCurrentEmoji || sortedEmojis[0][0];
            await toggleReaction(msg, targetEmoji);
        });

        reactionsContainer.appendChild(pill);
        wrapperDiv.appendChild(reactionsContainer);
    }

    chatMessages.appendChild(wrapperDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (editChatTitleBtn) {
    editChatTitleBtn.addEventListener("click", async () => {
        const supabase = window.supabaseClient || window.supabase;
        if (!activeChatId || isOfficialForum(activeChatId)) {
            showToast("Das offizielle Forum kann nicht umbenannt werden.", "error");
            return;
        }

        const chatObj = allChatsCache.find(c => c.id === activeChatId);
        const isForum = (chatObj && chatObj.title !== null && chatObj.user1_id === chatObj.user2_id);
        const newTitle = await showDialog({
            icon: "fa-pen",
            title: isForum ? "Gruppe umbenennen" : "Chat umbenennen",
            message: "Gib einen neuen Namen ein:",
            input: { placeholder: "Neuer Name", value: (chatObj && chatObj.title) || "", maxLength: 50 },
            confirmText: "Speichern",
            cancelText: "Abbrechen"
        });
        if (newTitle) {
            const trimmedTitle = newTitle.trim();
            const articleText = isForum ? "das Forum" : "den Chat";

            await supabase.from("chats").update({ title: trimmedTitle }).eq("id", activeChatId);

            const sysMsg = `${currentUsername} hat ${articleText} in "${trimmedTitle}" umbenannt.`;
            await supabase.from("messages").insert([{ chat_id: activeChatId, sender_id: currentUser.id, text: sysMsg }]);
            await supabase.from("chats").update({ last_message: sysMsg }).eq("id", activeChatId);

            loadUserChats();
            showToast("Der Name wurde aktualisiert.", "success");
        }
    });
}

if (deleteChatBtn) {
    deleteChatBtn.addEventListener("click", async () => {
        const supabase = window.supabaseClient || window.supabase;
        if (!activeChatId || isOfficialForum(activeChatId)) {
            showToast("Das offizielle Forum kann nicht gelöscht werden.", "error");
            return;
        }

        const confirmed = await showDialog({
            icon: "fa-trash",
            title: "Chat löschen?",
            message: "Möchtest du dieses Forum / diesen Chat wirklich löschen? Alle Nachrichten gehen dabei verloren.",
            confirmText: "Löschen",
            cancelText: "Abbrechen",
            danger: true
        });
        if (confirmed) {
            await supabase.from("messages").delete().eq("chat_id", activeChatId);
            try { await supabase.from("chat_favorites").delete().eq("chat_id", activeChatId); } catch(e){}
            await supabase.from("chats").delete().eq("id", activeChatId);
            
            activeChatId = null;
            if (waWelcomeScreen) waWelcomeScreen.style.display = "flex";
            if (waChatActivePane) waChatActivePane.style.display = "none";

            await loadUserChats();
            showToast("Der Chat wurde gelöscht.", "success");
        }
    });
}

if (blockUserBtn) {
    blockUserBtn.addEventListener("click", async () => {
        const supabase = window.supabaseClient || window.supabase;
        if (!activeChatId || isOfficialForum(activeChatId)) return;

        const confirmed = await showDialog({
            icon: "fa-ban",
            title: "Nutzer blockieren?",
            message: "Möchtest du diesen Nutzer blockieren und den Chat entfernen?",
            confirmText: "Blockieren",
            cancelText: "Abbrechen",
            danger: true
        });
        if (confirmed) {
            await supabase.from("messages").delete().eq("chat_id", activeChatId);
            try { await supabase.from("chat_favorites").delete().eq("chat_id", activeChatId); } catch(e){}
            await supabase.from("chats").delete().eq("id", activeChatId);
            
            activeChatId = null;
            if (waWelcomeScreen) waWelcomeScreen.style.display = "flex";
            if (waChatActivePane) waChatActivePane.style.display = "none";

            await loadUserChats();
            showToast("Der Nutzer wurde blockiert.", "success");
        }
    });
}

if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const supabase = window.supabaseClient || window.supabase;
        const text = messageInput ? messageInput.value.trim() : "";
        const files = imageUploadInput ? Array.from(imageUploadInput.files) : [];

        if ((!text && files.length === 0) || !activeChatId || !currentUser?.id || !supabase) return;

        const MAX_FILE_SIZE = 200 * 1024 * 1024;
        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                showToast("Dein Medium konnte nicht hochgeladen werden, da die Datei das Dateigrößenlimit überschreitet.", "error");
                return;
            }
        }

        const isOfficialAnnouncement = (activeChatId === officialForumChatId);
        if (isOfficialAnnouncement && !isAdminUser) {
            showToast("Nur Administratoren können im offiziellen Forum schreiben.", "error");
            return;
        }

        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sende...`;
        }

        try {
            if (editingMessageId) {
                const targetIdToEdit = editingMessageId;
                editingMessageId = null;
                if (editPreviewBanner) editPreviewBanner.style.display = "none";

                await supabase.from("messages").update({ text: text, is_edited: true }).eq("id", targetIdToEdit);

                if (messageInput) { messageInput.value = ""; messageInput.style.height = "42px"; }
                if (imageUploadInput) imageUploadInput.value = "";
                if (imagePreviewContainer) imagePreviewContainer.style.display = "none";

                await loadChatMessages(activeChatId);
                await loadUserChats();
                return;
            }

            let mediaUrls = [];
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `chat_${Date.now()}_${Math.random().toString(36).substring(2,7)}.${fileExt}`;
                const { error: uploadErr } = await supabase.storage.from("chat_attachments").upload(fileName, file);
                if (uploadErr) throw uploadErr;
                const { data: pubData } = supabase.storage.from("chat_attachments").getPublicUrl(fileName);
                mediaUrls.push(pubData.publicUrl);
            }

            const finalMediaUrl = mediaUrls.length > 0 ? mediaUrls.join(",") : null;

            await supabase.from("messages").insert([{
                chat_id: activeChatId,
                sender_id: currentUser.id,
                text: text || (finalMediaUrl ? "[Medien]" : ""),
                image_url: finalMediaUrl,
                reply_to: replyingToId || null
            }]);

            await supabase.from("chats").update({
                last_message: text || "[Medien]"
            }).eq("id", activeChatId);

            if (messageInput) { messageInput.value = ""; messageInput.style.height = "42px"; }
            if (imageUploadInput) imageUploadInput.value = "";
            if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
            if (emojiPickerWrapper) emojiPickerWrapper.style.display = "none";
            
            replyingToId = null;
            if (replyPreviewBanner) replyPreviewBanner.style.display = "none";

            markChatAsRead(activeChatId);
            loadUserChats();
        } catch (err) {
            console.error("Fehler beim Senden:", err);
            showToast("Fehler beim Verarbeiten der Nachricht. Bitte versuche es erneut.", "error");
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Senden`;
            }
        }
    });
}