/* =========================================
   GSRA - Messenger Logik (Perfekter Fix für Gruppen-Sichtbarkeit & Ungelesen-Status)
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

    if (newForumForm) {
        newForumForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const forumName = forumNameInput.value.trim();
            if (!forumName || !supabase || !currentUser?.id) return;

            const { data: createdGroup, error } = await supabase.from("chats").insert([{
                user1_id: currentUser.id,
                user2_id: currentUser.id,
                title: forumName,
                last_message: `${currentUsername} hat die Gruppe erstellt.`
            }]).select().single();

            if (!error && createdGroup) {
                newForumModal.style.display = "none";
                forumNameInput.value = "";
                await loadUserChats();
            } else {
                alert("Fehler beim Erstellen: " + (error?.message || "Unbekannter Fehler"));
            }
        });
    }

    const handleAddFriend = async () => {
        if (!currentUser?.id) return;
        const friendName = prompt("Gib den Benutzernamen (Username) deines Freundes ein:");
        if (!friendName) return;

        const { data: foundProfiles, error } = await supabase
            .from("profiles")
            .select("id, username")
            .ilike("username", friendName.trim())
            .maybeSingle();

        if (error || !foundProfiles) {
            alert("Nutzer nicht gefunden.");
            return;
        }

        if (foundProfiles.id === currentUser.id) {
            alert("Du kannst dich nicht selbst hinzufügen.");
            return;
        }

        const [u1, u2] = [currentUser.id, foundProfiles.id].sort();
        let existingChat = allChatsCache.find(c => c.title === null && c.user1_id === u1 && c.user2_id === u2);

        if (!existingChat) {
            const { data: fetched } = await supabase
                .from("chats")
                .select("*")
                .eq("user1_id", u1)
                .eq("user2_id", u2)
                .is("title", null)
                .maybeSingle();

            if (fetched) {
                existingChat = fetched;
            } else {
                const { data: newChat, err: newErr } = await supabase
                    .from("chats")
                    .insert([{
                        user1_id: u1,
                        user2_id: u2,
                        title: null,
                        last_message: "Chat gestartet"
                    }])
                    .select()
                    .single();

                if (!newErr) existingChat = newChat;
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
        tileInvite.addEventListener("click", () => {
            const inviteLink = window.location.origin + "/messenger.html";
            prompt("Kopiere diesen Link, um einen Freund einzuladen:", inviteLink);
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
            const memberName = prompt("Gib den Benutzernamen des hinzuzufügenden Mitglieds ein:");
            if (!memberName) return;

            const { data: targetUser } = await supabase
                .from("profiles")
                .select("id, username")
                .ilike("username", memberName.trim())
                .maybeSingle();

            if (!targetUser) {
                alert("Nutzer nicht gefunden.");
                return;
            }

            const sysMsg = `${currentUsername} hat ${targetUser.username} zur Gruppe hinzugefügt.`;

            await supabase.from("chats").update({
                last_message: sysMsg,
                updated_at: new Date().toISOString()
            }).eq("id", activeChatId);

            await supabase.from("messages").insert([{
                chat_id: activeChatId,
                sender_id: currentUser.id,
                text: sysMsg
            }]);

            await loadUserChats();
            alert(`Mitglied ${targetUser.username} wurde erfolgreich hinzugefügt!`);
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
                }
            });
        }
    }

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

    if (closeImageModal && imageModal) {
        closeImageModal.addEventListener("click", () => {
            imageModal.style.display = "none";
        });
        imageModal.addEventListener("click", (e) => {
            if (e.target === imageModal) imageModal.style.display = "none";
        });
    }
});

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

        const name = data?.username || data?.full_name || `Fahrer (${userId.substring(0, 6)})`;
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
            .is("title", null)
            .maybeSingle();

        if (fetched) {
            existingChat = fetched;
        } else {
            const { data: newChat, error } = await supabase
                .from("chats")
                .insert([{
                    user1_id: u1,
                    user2_id: u2,
                    title: itemTitle ? `Anfrage: ${itemTitle}` : null,
                    last_message: "Chat gestartet"
                }])
                .select()
                .single();

            if (!error) existingChat = newChat;
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
    }

    globalListenerChannel = supabase
        .channel('global_messages_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const newMsg = payload.new;
            if (newMsg.sender_id !== currentUser.id) {
                const targetChat = allChatsCache.find(c => c.id === newMsg.chat_id);
                if (targetChat) {
                    targetChat.last_msg_time = newMsg.created_at || new Date().toISOString();
                    targetChat.last_message = newMsg.text || "[Foto]";
                    if (targetChat.id !== activeChatId || document.hidden) {
                        targetChat.unread = true;
                    }
                    updateGlobalUnreadState();
                    renderChatsList();
                } else {
                    loadUserChats();
                }
            }
        })
        .subscribe();
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
        const { data: chatsAsUser1 } = await supabase
            .from("chats")
            .select("*")
            .eq("user1_id", currentUser.id);

        const { data: chatsAsUser2 } = await supabase
            .from("chats")
            .select("*")
            .eq("user2_id", currentUser.id);

        const { data: groupChats } = await supabase
            .from("chats")
            .select("*")
            .not("title", "is", null);

        const combined = [...(chatsAsUser1 || []), ...(chatsAsUser2 || []), ...(groupChats || [])];
        
        const map = new Map();
        combined.forEach(c => map.set(c.id, c));
        rawChats = Array.from(map.values());
    } catch (err) {
        console.error("Fehler beim Laden der Chats:", err);
    }

    let forumChat = rawChats.find(c => c.title === 'GSRA Official / Community Forum' || (c.title && c.title.includes('Official')));
    
    if (!forumChat) {
        const { data: createdForum, err: forumErr } = await supabase
            .from("chats")
            .insert([{
                user1_id: currentUser.id,
                user2_id: currentUser.id,
                title: 'GSRA Official / Community Forum',
                last_message: 'Willkommen im offiziellen Community-Forum!'
            }])
            .select()
            .single();

        if (!forumErr && createdForum) {
            forumChat = createdForum;
            rawChats.unshift(createdForum);
        }
    }

    if (forumChat) {
        officialForumChatId = forumChat.id;
    }

    // Robuste Filterung: Direktchats + offizielle Foren + Gruppen, bei denen der User beteiligt oder erwähnt wurde
    let accessibleChats = [];
    for (const chat of rawChats) {
        const isOfficial = (chat.id === officialForumChatId || (chat.title && chat.title.includes('Official')));
        const isDirect = (chat.title === null);
        
        if (isOfficial || isDirect) {
            accessibleChats.push(chat);
        } else if (chat.title) {
            if (chat.user1_id === currentUser.id || chat.user2_id === currentUser.id) {
                accessibleChats.push(chat);
            } else {
                const { data: msgCheck } = await supabase
                    .from("messages")
                    .select("text")
                    .eq("chat_id", chat.id)
                    .ilike("text", `%${currentUsername}%`)
                    .limit(1);

                if (msgCheck && msgCheck.length > 0) {
                    accessibleChats.push(chat);
                }
            }
        }
    }

    let uniqueMap = new Map();
    for (const chat of accessibleChats) {
        if (!uniqueMap.has(chat.id)) {
            uniqueMap.set(chat.id, chat);
        }
    }

    allChatsCache = Array.from(uniqueMap.values());

    for (const chat of allChatsCache) {
        if (!chat.title) {
            const otherUserId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
            await fetchUserName(otherUserId);
        }

        const { data: latestMsg } = await supabase
            .from("messages")
            .select("created_at, sender_id, text")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        const lastRead = getLastReadTime(chat.id);
        
        if (latestMsg) {
            chat.last_msg_time = latestMsg.created_at;
            chat.last_message = latestMsg.text || "[Foto]";
            const msgTime = new Date(latestMsg.created_at).getTime();

            if (latestMsg.sender_id !== currentUser.id && msgTime > lastRead && chat.id !== activeChatId) {
                chat.unread = true;
            } else {
                chat.unread = false;
            }
        } else {
            chat.last_msg_time = chat.created_at;
            chat.unread = false;
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
            return chat.title !== null;
        }
        return true;
    });

    if (filtered.length === 0) {
        chatsList.innerHTML = `<p style="padding: 15px; font-size: 13px; color: var(--text-muted);">Keine Chats gefunden.</p>`;
        isRendering = false;
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const chat of filtered) {
        const isForum = (chat.title !== null);
        let otherUserName = "Forum";
        if (!isForum) {
            const otherUserId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
            otherUserName = userNamesCache[otherUserId] || "Fahrer";
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
        `;

        const favBtn = item.querySelector(".wa-favorite-btn");
        favBtn.addEventListener("click", (e) => toggleFavorite(chat.id, e));

        item.addEventListener("click", () => {
            activeChatId = chat.id;
            markChatAsRead(chat.id);
            
            if (waWelcomeScreen) waWelcomeScreen.style.display = "none";
            if (waChatActivePane) waChatActivePane.style.display = "flex";

            if (isForum) {
                openForumChat(chat);
            } else {
                openChat(chat.id, otherUserName, chat.title);
            }
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
    if (addMemberBtn) addMemberBtn.style.display = "block";
    if (blockUserBtn) blockUserBtn.style.display = "none";

    const isOfficialAnnouncement = (chatId === officialForumChatId);

    if (isOfficialAnnouncement && !isAdminUser) {
        if (messageInput) {
            messageInput.disabled = true;
            messageInput.placeholder = "Nur Administratoren können im offiziellen Forum schreiben.";
        }
        if (sendBtn) sendBtn.disabled = true;
    } else {
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = "Schreibe eine Nachricht...";
        }
        if (sendBtn) sendBtn.disabled = false;
    }

    if (chatMessages) {
        chatMessages.innerHTML = "";
    }
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
    if (addMemberBtn) addMemberBtn.style.display = "block";
    if (blockUserBtn) blockUserBtn.style.display = "block";
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

    renderMessages(messages || []);

    messageSubscription = supabase
        .channel(`chat_${chatId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
            appendSingleMessage(payload.new);
            if (activeChatId === chatId && !document.hidden) {
                markChatAsRead(chatId);
            }
        })
        .subscribe();
}

function renderMessages(messages) {
    if (!chatMessages) return;
    if (messages.length === 0) {
        chatMessages.innerHTML = `<p class="chat-placeholder" style="text-align: center; color: var(--text-muted); margin: auto;">Schreibe die erste Nachricht...</p>`;
        return;
    }
    chatMessages.innerHTML = "";
    messages.forEach(appendSingleMessage);
}

async function appendSingleMessage(msg) {
    if (!chatMessages) return;
    const placeholder = chatMessages.querySelector(".chat-placeholder");
    if (placeholder) placeholder.remove();

    const bubble = document.createElement("div");
    
    const isOwn = String(msg.sender_id) === String(currentUser?.id);
    bubble.className = `message-bubble ${isOwn ? 'message-own' : 'message-other'}`;

    const senderName = isOwn ? "Du" : await fetchUserName(msg.sender_id);
    const dateObj = msg.created_at ? new Date(msg.created_at) : new Date();
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = dateObj.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });

    const authorDiv = document.createElement("div");
    authorDiv.className = "msg-author";
    authorDiv.innerText = senderName;
    bubble.appendChild(authorDiv);

    if (msg.image_url) {
        const urls = msg.image_url.split(",").map(u => u.trim()).filter(Boolean);
        const gridContainer = document.createElement("div");
        gridContainer.className = "wa-media-grid";

        const displayCount = Math.min(urls.length, 4);
        for (let i = 0; i < displayCount; i++) {
            const cleanUrl = urls[i];
            const imgWrap = document.createElement("div");
            imgWrap.className = "wa-media-item";

            const img = document.createElement("img");
            img.src = cleanUrl;
            img.alt = "Bild";
            img.addEventListener("click", () => {
                if (modalImageFull && imageModal) {
                    modalImageFull.src = cleanUrl;
                    imageModal.style.display = "flex";
                }
            });
            imgWrap.appendChild(img);

            if (i === 3 && urls.length > 4) {
                const overlay = document.createElement("div");
                overlay.className = "wa-media-overlay";
                overlay.innerText = `+${urls.length - 4}`;
                imgWrap.appendChild(overlay);
            }

            gridContainer.appendChild(imgWrap);
        }
        bubble.appendChild(gridContainer);
    }

    if (msg.text && msg.text !== "[Foto]") {
        const textDiv = document.createElement("div");
        textDiv.innerText = msg.text;
        bubble.appendChild(textDiv);
    }

    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.innerText = `${dateStr}, ${timeStr}`;
    bubble.appendChild(timeSpan);

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (editChatTitleBtn) {
    editChatTitleBtn.addEventListener("click", async () => {
        const supabase = window.supabaseClient || window.supabase;
        if (!activeChatId || activeChatId === officialForumChatId) {
            alert("Das offizielle Forum kann nicht umbenannt werden.");
            return;
        }

        const newTitle = prompt("Gib einen neuen Namen ein:");
        if (newTitle !== null && newTitle.trim() !== "") {
            const trimmedTitle = newTitle.trim();
            await supabase.from("chats").update({ title: trimmedTitle }).eq("id", activeChatId);
            loadUserChats();
            alert("Aktualisiert!");
        }
    });
}

if (deleteChatBtn) {
    deleteChatBtn.addEventListener("click", async () => {
        const supabase = window.supabaseClient || window.supabase;
        if (!activeChatId || activeChatId === officialForumChatId) {
            alert("Das offizielle Forum kann nicht gelöscht werden.");
            return;
        }

        if (confirm("Möchtest du dieses Forum / diesen Chat wirklich löschen?")) {
            await supabase.from("messages").delete().eq("chat_id", activeChatId);
            try { await supabase.from("chat_favorites").delete().eq("chat_id", activeChatId); } catch(e){}
            await supabase.from("chats").delete().eq("id", activeChatId);
            
            activeChatId = null;
            if (waWelcomeScreen) waWelcomeScreen.style.display = "flex";
            if (waChatActivePane) waChatActivePane.style.display = "none";

            await loadUserChats();
            alert("Gelöscht.");
        }
    });
}

if (blockUserBtn) {
    blockUserBtn.addEventListener("click", async () => {
        const supabase = window.supabaseClient || window.supabase;
        if (!activeChatId || activeChatId === officialForumChatId) return;

        if (confirm("Möchtest du diesen Nutzer blockieren und den Chat entfernen?")) {
            await supabase.from("messages").delete().eq("chat_id", activeChatId);
            try { await supabase.from("chat_favorites").delete().eq("chat_id", activeChatId); } catch(e){}
            await supabase.from("chats").delete().eq("id", activeChatId);
            
            activeChatId = null;
            if (waWelcomeScreen) waWelcomeScreen.style.display = "flex";
            if (waChatActivePane) waChatActivePane.style.display = "none";

            await loadUserChats();
            alert("Nutzer blockiert.");
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

        const isOfficialAnnouncement = (activeChatId === officialForumChatId);
        if (isOfficialAnnouncement && !isAdminUser) {
            alert("Nur Administratoren können im offiziellen Forum schreiben.");
            return;
        }

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
            }
        }

        const finalImageUrl = imageUrls.length > 0 ? imageUrls.join(",") : null;

        try {
            const nowIso = new Date().toISOString();
            await supabase.from("messages").insert([{
                chat_id: activeChatId,
                sender_id: currentUser.id,
                text: text || (finalImageUrl ? "[Foto]" : ""),
                image_url: finalImageUrl
            }]);

            await supabase.from("chats").update({
                last_message: text || "[Foto]",
                updated_at: nowIso
            }).eq("id", activeChatId);

            markChatAsRead(activeChatId);
            loadUserChats();
        } catch (err) {
            console.error("Fehler beim Senden:", err);
        }
    });
}