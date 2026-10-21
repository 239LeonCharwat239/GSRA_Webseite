/* =========================================
   GSRA - WhatsApp Desktop Style Messenger Logik (Aktualisiert)
========================================= */

let currentUser = null;
let activeChatId = null;
let messageSubscription = null;
let allChatsCache = [];
let currentFilter = 'all';
let userFavorites = new Set();
let isAdminUser = false;

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
const imageUploadInput = document.getElementById("imageUploadInput");
const emojiToggleBtn = document.getElementById("emojiToggleBtn");
const emojiPickerWrapper = document.getElementById("emojiPickerWrapper");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const previewThumbsList = document.getElementById("previewThumbsList");
const imagePreviewName = document.getElementById("imagePreviewName");
const removeImageBtn = document.getElementById("removeImageBtn");
const imageModal = document.getElementById("imageModal");
const modalImageFull = document.getElementById("modalImageFull");
const closeImageModal = document.getElementById("closeImageModal");
const waWelcomeScreen = document.getElementById("waWelcomeScreen");
const waChatActivePane = document.getElementById("waChatActivePane");
const chatSearchInput = document.getElementById("chatSearchInput");
const tileInvite = document.getElementById("tileInvite");
const tileAddFriend = document.getElementById("tileAddFriend");
const tileForum = document.getElementById("tileForum");
const addFriendBtn = document.getElementById("addFriendBtn");
const newChatPlusBtn = document.getElementById("newChatPlusBtn");
const newForumModal = document.getElementById("newForumModal");
const closeForumModal = document.getElementById("closeForumModal");
const newForumForm = document.getElementById("newForumForm");
const forumNameInput = document.getElementById("forumNameInput");
const isForumCheckbox = document.getElementById("isForumCheckbox");
const messengerNavBtn = document.getElementById("messengerNavBtn");

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;

    if (!currentUser) {
        if (chatsList) chatsList.innerHTML = `<p style="padding: 15px; font-size: 13px; color: var(--text-muted);">Bitte logge dich ein.</p>`;
        return;
    }

    await checkUserAdminStatus();
    await loadFavorites();
    await checkUrlParameters();
    await loadUserChats();

    // Filter Pills Click Events
    document.querySelectorAll(".wa-pill").forEach(pill => {
        pill.addEventListener("click", (e) => {
            document.querySelectorAll(".wa-pill").forEach(p => p.classList.remove("active"));
            e.target.classList.add("active");
            currentFilter = e.target.getAttribute("data-filter");
            renderChatsList();
        });
    });

    // Suchleiste Event
    if (chatSearchInput) {
        chatSearchInput.addEventListener("input", () => {
            renderChatsList();
        });
    }

    // Modal für neues Forum öffnen/schließen
    if (newChatPlusBtn && newForumModal) {
        newChatPlusBtn.addEventListener("click", () => {
            newForumModal.style.display = "flex";
        });
    }

    if (closeForumModal && newForumModal) {
        closeForumModal.addEventListener("click", () => {
            newForumModal.style.display = "none";
        });
    }

    // Neues Forum erstellen Handler
    if (newForumForm) {
        newForumForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const forumName = forumNameInput.value.trim();
            const isForum = isForumCheckbox.checked;

            if (!forumName || !supabase) return;

            const { error } = await supabase.from("chats").insert([{
                user1_id: currentUser.id,
                user2_id: currentUser.id, // Selbst-Referenz bei Foren
                title: forumName,
                is_forum: true,
                is_admin_only: isForum,
                last_message: "Forum erstellt"
            }]);

            if (!error) {
                newForumModal.style.display = "none";
                forumNameInput.value = "";
                await loadUserChats();
            } else {
                alert("Fehler beim Erstellen des Forums: " + error.message);
            }
        });
    }

    // Schnellaktions-Kacheln Events
    if (tileInvite) {
        tileInvite.addEventListener("click", () => {
            const inviteLink = window.location.origin + "/messenger.html";
            prompt("Kopiere diesen Link, um einen Freund einzuladen:", inviteLink);
        });
    }

    if (tileAddFriend || addFriendBtn) {
        const handleAddFriend = () => {
            prompt("Gib den Benutzernamen deines Freundes ein:");
        };
        if (tileAddFriend) tileAddFriend.addEventListener("click", handleAddFriend);
        if (addFriendBtn) addFriendBtn.addEventListener("click", handleAddFriend);
    }

    if (tileForum) {
        tileForum.addEventListener("click", () => {
            activeChatId = 'gsra-official-forum';
            renderChatsList();
            openForumChat();
        });
    }

    // Emoji Picker Toggeln
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
                }
            });
        }
    }

    // Mehrfach-Bilder-Vorschau
    if (imageUploadInput) {
        imageUploadInput.addEventListener("change", () => {
            const files = Array.from(imageUploadInput.files);
            if (files.length > 0) {
                if (previewThumbsList) previewThumbsList.innerHTML = "";
                files.forEach(file => {
                    const img = document.createElement("img");
                    img.src = URL.createObjectURL(file);
                    img.style.cssText = "width: 40px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid var(--gsra-blue);";
                    if (previewThumbsList) previewThumbsList.appendChild(img);
                });
                if (imagePreviewName) imagePreviewName.textContent = `${files.length} Bild(er) ausgewählt`;
                if (imagePreviewContainer) imagePreviewContainer.style.display = "flex";
            }
        });
    }

    if (removeImageBtn) {
        removeImageBtn.addEventListener("click", () => {
            if (imageUploadInput) imageUploadInput.value = "";
            if (previewThumbsList) previewThumbsList.innerHTML = "";
            if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
        });
    }

    // Lightbox Modal Schließen
    if (closeImageModal && imageModal) {
        closeImageModal.addEventListener("click", () => {
            imageModal.style.display = "none";
        });
        imageModal.addEventListener("click", (e) => {
            if (e.target === imageModal) imageModal.style.display = "none";
        });
    }
});

// Prüfen ob der Nutzer Admin ist
async function checkUserAdminStatus() {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !currentUser) return;
    const { data } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("id", currentUser.id)
        .maybeSingle();

    isAdminUser = data?.role === 'admin' || data?.is_admin === true;
}

// Favoriten laden
async function loadFavorites() {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !currentUser) return;
    const { data } = await supabase
        .from("chat_favorites")
        .select("chat_id")
        .eq("user_id", currentUser.id);

    if (data) {
        userFavorites = new Set(data.map(f => f.chat_id));
    }
}

// Favorit umschalten
async function toggleFavorite(chatId, event) {
    if (event) event.stopPropagation();
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !currentUser) return;

    if (userFavorites.has(chatId)) {
        await supabase.from("chat_favorites").delete().match({ user_id: currentUser.id, chat_id: chatId });
        userFavorites.delete(chatId);
    } else {
        await supabase.from("chat_favorites").insert([{ user_id: currentUser.id, chat_id: chatId }]);
        userFavorites.add(chatId);
    }
    renderChatsList();
}

// Hilfsfunktion: Benutzername laden
async function fetchUserName(userId) {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !userId) return `Fahrer (${userId ? userId.substring(0, 6) : 'Unbekannt'})`;
    
    const { data } = await supabase
        .from("profiles")
        .select("username, full_name")
        .eq("id", userId)
        .maybeSingle();

    return data?.username || data?.full_name || `Fahrer (${userId.substring(0, 6)})`;
}

// URL Parameter verarbeiten
async function checkUrlParameters() {
    const supabase = window.supabaseClient || window.supabase;
    const urlParams = new URLSearchParams(window.location.search);
    const sellerId = urlParams.get("sellerId");
    const sellerName = urlParams.get("sellerName") || "Verkäufer";
    const itemTitle = urlParams.get("itemTitle");
    const friendId = urlParams.get("friendId");

    const targetId = sellerId || friendId;
    if (targetId && currentUser && targetId !== currentUser.id) {
        let { data: existingChat } = await supabase
            .from("chats")
            .select("*")
            .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${targetId}),and(user1_id.eq.${targetId},user2_id.eq.${currentUser.id})`)
            .maybeSingle();

        if (!existingChat) {
            const { data: newChat, error } = await supabase
                .from("chats")
                .insert([{
                    user1_id: currentUser.id,
                    user2_id: targetId,
                    title: itemTitle ? `Anfrage: ${itemTitle}` : null,
                    last_message: "Chat gestartet"
                }])
                .select()
                .single();

            if (!error) existingChat = newChat;
        }

        if (existingChat) {
            activeChatId = existingChat.id;
            openChat(existingChat.id, sellerName, existingChat.title);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

// Globaler Realtime-Listener für neue Nachrichten (Ungelesen-Erkennung)
function setupGlobalMessageListener() {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase || !currentUser) return;

    supabase
        .channel('global_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const newMsg = payload.new;
            if (newMsg.sender_id !== currentUser.id) {
                const targetChat = allChatsCache.find(c => c.id === newMsg.chat_id);
                if (targetChat && targetChat.id !== activeChatId) {
                    targetChat.unread = true;
                    updateGlobalUnreadState();
                    renderChatsList();
                }
            }
        })
        .subscribe();
}

// Globalen Rot-Status für Navbar prüfen
function updateGlobalUnreadState() {
    const hasUnread = allChatsCache.some(c => c.unread === true);
    if (messengerNavBtn) {
        if (hasUnread) {
            messengerNavBtn.classList.add("nav-unread-glow");
        } else {
            messengerNavBtn.classList.remove("nav-unread-glow");
        }
    }
}

// Chats laden
async function loadUserChats() {
    const supabase = window.supabaseClient || window.supabase;
    if (!chatsList || !currentUser || !supabase) return;

    const { data: chats, error } = await supabase
        .from("chats")
        .select("*")
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id},is_forum.eq.true`)
        .order("created_at", { ascending: false });

    if (error) {
        chatsList.innerHTML = `<p style="padding: 15px; font-size: 13px; color: var(--text-muted);">Fehler beim Laden.</p>`;
        return;
    }

    allChatsCache = chats || [];
    
    // Prüfen, ob das Pflicht-GSRA-Forum existiert
    const forumExists = allChatsCache.some(c => c.id === 'gsra-official-forum' || c.title === "GSRA Official / Community Forum");
    if (!forumExists) {
        allChatsCache.unshift({
            id: 'gsra-official-forum',
            title: 'GSRA Official / Community Forum',
            last_message: 'Willkommen im offiziellen Community-Forum!',
            is_forum: true,
            is_admin_only: true,
            created_at: new Date().toISOString()
        });
    }

    updateGlobalUnreadState();
    renderChatsList();
    setupGlobalMessageListener();
}

// Chats in Sidebar rendern
async function renderChatsList() {
    if (!chatsList) return;
    chatsList.innerHTML = "";

    const searchTerm = chatSearchInput ? chatSearchInput.value.toLowerCase() : "";

    let filtered = allChatsCache.filter(chat => {
        const title = (chat.title || "Chat").toLowerCase();
        const matchesSearch = title.includes(searchTerm);
        if (!matchesSearch) return false;

        if (currentFilter === 'unread') {
            return chat.unread === true;
        }
        if (currentFilter === 'favorites') {
            return userFavorites.has(chat.id);
        }
        if (currentFilter === 'forums') {
            return chat.is_forum === true || chat.title?.includes("Forum");
        }
        return true;
    });

    if (filtered.length === 0) {
        chatsList.innerHTML = `<p style="padding: 15px; font-size: 13px; color: var(--text-muted);">Keine Chats gefunden.</p>`;
        return;
    }

    for (const chat of filtered) {
        const isForum = chat.is_forum || chat.id === 'gsra-official-forum';
        let otherUserName = "Forum";
        if (!isForum) {
            const otherUserId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
            otherUserName = await fetchUserName(otherUserId);
        }

        const item = document.createElement("div");
        const isSelected = chat.id === activeChatId;
        const isUnread = chat.unread === true;
        const isFav = userFavorites.has(chat.id);

        item.className = `wa-chat-item ${isSelected ? 'active' : ''} ${isUnread ? 'unread' : ''}`;
        
        const displayTitle = chat.title || `Chat mit ${otherUserName}`;
        const lastMsg = escapeHtml(chat.last_message || 'Keine Nachrichten');

        item.innerHTML = `
            <div class="wa-avatar"><i class="fa-solid ${isForum ? 'fa-bullhorn text-yellow' : 'fa-user'}"></i></div>
            <div class="wa-chat-info">
                <div class="wa-chat-row">
                    <span class="wa-chat-name">${escapeHtml(displayTitle)}</span>
                    <button class="wa-favorite-btn ${isFav ? 'favorited' : ''}" title="Als Favorit markieren"><i class="fa-solid fa-star"></i></button>
                </div>
                <div class="wa-chat-msg">${lastMsg}</div>
            </div>
            ${isUnread ? '<div class="wa-unread-dot"></div>' : ''}
        `;

        // Favoriten-Stern Klick
        const favBtn = item.querySelector(".wa-favorite-btn");
        favBtn.addEventListener("click", (e) => toggleFavorite(chat.id, e));

        item.addEventListener("click", () => {
            activeChatId = chat.id;
            chat.unread = false; // Gelesen markieren
            updateGlobalUnreadState();
            
            if (waWelcomeScreen) waWelcomeScreen.style.display = "none";
            if (waChatActivePane) waChatActivePane.style.display = "flex";

            if (isForum || chat.id === 'gsra-official-forum') {
                openForumChat(chat);
            } else {
                openChat(chat.id, otherUserName, chat.title);
            }
            renderChatsList();
        });

        chatsList.appendChild(item);
    }
}

// Forum Chat öffnen (mit Admin-Prüfung)
function openForumChat(forumChat = null) {
    if (chatTitleText) chatTitleText.innerText = forumChat?.title || "GSRA Official / Community Forum";
    if (chatActions) chatActions.style.display = "none";

    const isRestricted = forumChat?.is_admin_only !== false; // Standardmäßig nur Admins

    if (isRestricted && !isAdminUser) {
        if (messageInput) {
            messageInput.disabled = true;
            messageInput.placeholder = "Nur Administratoren können in diesem Forum Nachrichten schreiben.";
        }
        if (sendBtn) sendBtn.disabled = true;
    } else {
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = "Schreibe eine Nachricht als Administrator...";
        }
        if (sendBtn) sendBtn.disabled = false;
    }

    if (chatMessages) {
        chatMessages.innerHTML = `
            <div class="message-bubble message-other">
                <div><b>[GSRA Official Admin]:</b> Willkommen im offiziellen Community-Forum. Hier erfährst du als Erste(r) alle Neuigkeiten rund um GSRA!</div>
                <span class="message-time">10:24</span>
            </div>
        `;
    }
}

// Chat öffnen
async function openChat(chatId, recipientName, chatTitle = null) {
    const supabase = window.supabaseClient || window.supabase;
    
    const displayName = chatTitle ? `${chatTitle} (${recipientName})` : `Chat mit ${recipientName}`;
    if (chatTitleText) chatTitleText.innerText = displayName;
    
    if (chatActions) chatActions.style.display = "flex";
    if (messageInput) { messageInput.disabled = false; messageInput.placeholder = "Gib eine Nachricht ein..."; }
    if (imageUploadInput) imageUploadInput.disabled = false;
    if (emojiToggleBtn) emojiToggleBtn.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    if (messageSubscription) {
        supabase.removeChannel(messageSubscription);
        messageSubscription = null;
    }

    const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

    renderMessages(messages || []);

    messageSubscription = supabase
        .channel(`chat_${chatId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
            appendSingleMessage(payload.new);
        })
        .subscribe();
}

function renderMessages(messages) {
    if (!chatMessages) return;
    chatMessages.innerHTML = "";
    if (messages.length === 0) {
        chatMessages.innerHTML = `<p class="chat-placeholder" style="text-align: center; color: var(--text-muted); margin: auto;">Schreibe die erste Nachricht...</p>`;
        return;
    }
    messages.forEach(appendSingleMessage);
}

function appendSingleMessage(msg) {
    if (!chatMessages) return;
    const placeholder = chatMessages.querySelector(".chat-placeholder");
    if (placeholder) placeholder.remove();

    const bubble = document.createElement("div");
    const isOwn = msg.sender_id === currentUser?.id;
    bubble.className = `message-bubble ${isOwn ? 'message-own' : 'message-other'}`;

    const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    if (msg.image_url) {
        const urls = msg.image_url.split(",");
        const imgContainer = document.createElement("div");
        imgContainer.style.cssText = "display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px;";

        urls.forEach(url => {
            const cleanUrl = url.trim();
            const img = document.createElement("img");
            img.src = cleanUrl;
            img.alt = "Chat Bild";
            img.className = "chat-msg-thumb";
            img.addEventListener("click", () => {
                if (modalImageFull && imageModal) {
                    modalImageFull.src = cleanUrl;
                    imageModal.style.display = "flex";
                }
            });
            imgContainer.appendChild(img);
        });
        bubble.appendChild(imgContainer);
    }

    if (msg.text && msg.text !== "[Foto]") {
        const textDiv = document.createElement("div");
        textDiv.innerText = msg.text;
        bubble.appendChild(textDiv);
    }

    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.innerText = timeStr;
    bubble.appendChild(timeSpan);

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Chat-Titel umbenennen
if (editChatTitleBtn) {
    editChatTitleBtn.addEventListener("click", async () => {
        const supabase = window.supabaseClient || window.supabase;
        if (!activeChatId) return;

        const newTitle = prompt("Gib einen neuen Namen für dieses Chat-Thema ein:");
        if (newTitle !== null && newTitle.trim() !== "") {
            const trimmedTitle = newTitle.trim();
            await supabase.from("chats").update({ title: trimmedTitle }).eq("id", activeChatId);
            loadUserChats();
            alert("Chat-Thema aktualisiert!");
        }
    });
}

// Chat löschen
if (deleteChatBtn) {
    deleteChatBtn.addEventListener("click", async () => {
        const supabase = window.supabaseClient || window.supabase;
        if (!activeChatId) return;

        if (confirm("Möchtest du diesen Chat wirklich unwiderruflich löschen?")) {
            await supabase.from("messages").delete().eq("chat_id", activeChatId);
            await supabase.from("chats").delete().eq("id", activeChatId);
            
            activeChatId = null;
            if (waWelcomeScreen) waWelcomeScreen.style.display = "flex";
            if (waChatActivePane) waChatActivePane.style.display = "none";

            await loadUserChats();
        }
    });
}

// Nutzer blockieren
if (blockUserBtn) {
    blockUserBtn.addEventListener("click", async () => {
        const supabase = window.supabaseClient || window.supabase;
        if (!activeChatId) return;

        if (confirm("Möchtest du diesen Nutzer blockieren und den Chat löschen?")) {
            await supabase.from("messages").delete().eq("chat_id", activeChatId);
            await supabase.from("chats").delete().eq("id", activeChatId);
            
            activeChatId = null;
            if (waWelcomeScreen) waWelcomeScreen.style.display = "flex";
            if (waChatActivePane) waChatActivePane.style.display = "none";

            await loadUserChats();
            alert("Nutzer wurde blockiert und der Chat entfernt.");
        }
    });
}

// Nachricht & Bilder senden
if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const supabase = window.supabaseClient || window.supabase;
        const text = messageInput ? messageInput.value.trim() : "";
        const files = imageUploadInput ? Array.from(imageUploadInput.files) : [];

        if ((!text && files.length === 0) || !activeChatId || !currentUser || !supabase) return;

        if (messageInput) messageInput.value = "";
        if (imageUploadInput) imageUploadInput.value = "";
        if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
        if (emojiPickerWrapper) emojiPickerWrapper.style.display = "none";

        let imageUrls = [];

        for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `chat_${Date.now()}_${Math.random().toString(36).substring(2,7)}.${fileExt}`;
            
            const { error: uploadErr } = await supabase.storage.from("chat_attachments").upload(fileName, file);
            if (!uploadErr) {
                const { data: pubData } = supabase.storage.from("chat_attachments").getPublicUrl(fileName);
                imageUrls.push(pubData.publicUrl);
            } else {
                console.error("Upload Fehler:", uploadErr.message);
            }
        }

        const finalImageUrl = imageUrls.length > 0 ? imageUrls.join(",") : null;

        try {
            await supabase.from("messages").insert([{
                chat_id: activeChatId,
                sender_id: currentUser.id,
                text: text || (finalImageUrl ? "[Foto]" : ""),
                image_url: finalImageUrl
            }]);

            await supabase.from("chats").update({
                last_message: text || "[Foto]"
            }).eq("id", activeChatId);

            loadUserChats();
        } catch (err) {
            console.error("Fehler beim Senden:", err);
        }
    });
}