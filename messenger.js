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

// States für WhatsApp-Funktionen
let replyingToId = null;
let editingMessageId = null;
let messagesCacheMap = new Map();

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Komprimiert mehrfache Zeilenumbrüche/Leerzeichen zu einer sauberen, einzeiligen Vorschau (für Zitate & Bearbeiten)
function sanitizeQuoteText(text) {
    if (!text) return "";
    return text.replace(/\s+/g, ' ').trim();
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

// DOM-Elemente für Antworten
const replyPreviewBanner = document.getElementById("replyPreviewBanner");
const replyBannerAuthor = document.getElementById("replyBannerAuthor");
const replyBannerText = document.getElementById("replyBannerText");
const cancelReplyBtn = document.getElementById("cancelReplyBtn");

// Kompakter Bearbeitungs-Banner mit Sanitize-Funktion gegen das Aufblähen durch Leerzeilen
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

            if (targetUser.id === currentUser.id) {
                alert("Du kannst dich nicht selbst hinzufügen.");
                return;
            }

            const sysMsg = `${currentUsername} hat ${targetUser.username} zum Forum hinzugefügt.`;

            await supabase.from("chats").update({
                last_message: sysMsg
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
                    messageInput.dispatchEvent(new Event('input'));
                }
            });
        }
    }

    if (imageUploadInput) {
        imageUploadInput.addEventListener("change", () => {
            const files = Array.from(imageUploadInput.files);
            if (files.length > 0) {
                const MAX_FILE_SIZE = 200 * 1024 * 1024;
                for (const file of files) {
                    if (file.size > MAX_FILE_SIZE) {
                        alert("Dein Medium konnte nicht hochgeladen werden, da die Datei das Dateigrößenlimit überschreitet.");
                        imageUploadInput.value = "";
                        if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
                        return;
                    }
                }
                if (previewThumbsList) previewThumbsList.innerHTML = "";
                files.forEach(file => {
                    const isVid = file.type.startsWith('video/');
                    const elem = isVid ? document.createElement("video") : document.createElement("img");
                    elem.src = URL.createObjectURL(file);
                    elem.style.cssText = "width: 40px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid var(--gsra-blue);";
                    if (previewThumbsList) previewThumbsList.appendChild(elem);
                });
                if (imagePreviewName) imagePreviewName.textContent = `${files.length} Datei(en) ausgewählt`;
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
            if (modalVideoFull) { modalVideoFull.style.display = "none"; }
            if (modalImageFull) modalImageFull.style.display = "none";
        });
        imageModal.addEventListener("click", (e) => {
            if (e.target === imageModal) {
                imageModal.style.display = "none";
                if (modalVideoFull) { modalVideoFull.style.display = "none"; }
                if (modalImageFull) modalImageFull.style.display = "none";
            }
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
    }

    globalListenerChannel = supabase
        .channel('global_messages_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const newMsg = payload.new;
            const targetChat = allChatsCache.find(c => c.id === newMsg.chat_id);
            if (targetChat) {
                targetChat.last_msg_time = newMsg.created_at || new Date().toISOString();
                targetChat.last_message = newMsg.text || "[Medien]";
                if (newMsg.sender_id !== currentUser.id) {
                    if (targetChat.id !== activeChatId || document.hidden) {
                        targetChat.unread = true;
                    }
                }
                allChatsCache.sort((a, b) => new Date(b.last_msg_time || b.created_at || 0) - new Date(a.last_msg_time || a.created_at || 0));
                updateGlobalUnreadState();
                renderChatsList();
            } else {
                loadUserChats();
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
        const { data: globalForum } = await supabase
            .from("chats")
            .select("*")
            .eq("title", 'GSRA Official / Community Forum')
            .maybeSingle();

        if (globalForum) {
            forumChat = globalForum;
            rawChats.unshift(globalForum);
        } else if (isAdminUser) {
            const { data: createdForum, err: forumErr } = await supabase
                .from("chats")
                .insert([{
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

    if (forumChat) {
        officialForumChatId = forumChat.id;
    }

    let accessibleChats = [];
    for (const chat of rawChats) {
        const isOfficial = (chat.id === officialForumChatId || (chat.title && chat.title.includes('Official')));
        const isDirect = (chat.user1_id !== chat.user2_id);
        const isGroup = (chat.user1_id === chat.user2_id);
        
        if (isOfficial || isDirect || isGroup) {
            accessibleChats.push(chat);
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
        if (chat.user1_id !== chat.user2_id) {
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

        if (latestMsg) {
            chat.last_msg_time = latestMsg.created_at;
            chat.last_message = latestMsg.text || "[Medien]";
        } else {
            chat.last_msg_time = chat.created_at;
            chat.last_message = "Keine Nachrichten";
        }

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

        if (currentFilter === 'unread') {
            return chat.unread === true;
        }
        if (currentFilter === 'favorites') {
            return userFavorites.has(chat.id);
        }
        if (currentFilter === 'forums') {
            return isGroup || isOfficial;
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
        
        let displayTitle = "";
        if (isOfficial) {
            displayTitle = "GSRA Official / Community Forum";
        } else if (isGroup) {
            displayTitle = chat.title;
        } else if (chat.title) {
            displayTitle = `${chat.title} (${otherUserName})`;
        } else {
            displayTitle = `Chat mit ${otherUserName}`;
        }

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

        const favBtn = item.querySelector(".wa-favorite-btn");
        favBtn.addEventListener("click", (e) => toggleFavorite(chat.id, e));

        item.addEventListener("click", () => {
            activeChatId = chat.id;
            markChatAsRead(chat.id);
            
            if (waWelcomeScreen) waWelcomeScreen.style.display = "none";
            if (waChatActivePane) waChatActivePane.style.display = "flex";

            if (isForumOrGroup) {
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
    
    if (addMemberBtn) {
        addMemberBtn.style.display = (chatId === officialForumChatId) ? "none" : "block";
    }
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
    if (addMemberBtn) addMemberBtn.style.display = "none";
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

    messagesCacheMap.clear();
    if (messages) {
        messages.forEach(m => messagesCacheMap.set(m.id, m));
    }

    await renderMessages(messages || []);

    messageSubscription = supabase
        .channel(`chat_${chatId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, async () => {
            const { data: updatedMessages } = await supabase
                .from("messages")
                .select("*")
                .eq("chat_id", chatId)
                .order("created_at", { ascending: true });
            
            messagesCacheMap.clear();
            if (updatedMessages) {
                updatedMessages.forEach(m => messagesCacheMap.set(m.id, m));
            }
            await renderMessages(updatedMessages || []);
        })
        .subscribe();
}

async function renderMessages(messages) {
    if (!chatMessages) return;
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
            if (seenSystemTexts.has(formatted)) {
                continue;
            }
            seenSystemTexts.add(formatted);
        }
        await appendSingleMessage(msg, isSystem);
    }
}

async function formatSystemMessage(text, senderId) {
    if (!text) return "";
    const isOwnAction = String(senderId) === String(currentUser?.id);
    const actorName = await fetchUserName(senderId);

    if (text.includes("zum Forum hinzugefügt")) {
        const match = text.match(/^(.+?)\s+hat\s+(.+?)\s+zum Forum hinzugefügt/i);
        const target = match && match[2] ? match[2] : "jemanden";
        if (isOwnAction) {
            return `Du hast ${target} zum Forum hinzugefügt.`;
        } else {
            return `Du wurdest von ${actorName} zum Forum hinzugefügt.`;
        }
    }

    if (text.includes("hat den Chat eröffnet")) {
        if (isOwnAction) {
            return "Du hast den Chat eröffnet.";
        } else {
            return `${actorName} hat den Chat mit dir eröffnet.`;
        }
    }

    if (text.includes("hat das Forum erstellt")) {
        if (isOwnAction) {
            return "Du hast das Forum erstellt.";
        } else {
            return `${actorName} hat das Forum erstellt.`;
        }
    }

    if (text.includes("umbenannt")) {
        if (isOwnAction) {
            return text.replace(new RegExp(`^${actorName}\\s+hat`, 'i'), 'Du hast');
        } else {
            return text;
        }
    }

    return text;
}

async function appendSingleMessage(msg, isSystem = false) {
    if (!chatMessages) return;
    const placeholder = chatMessages.querySelector(".chat-placeholder");
    if (placeholder) placeholder.remove();

    const bubble = document.createElement("div");
    bubble.id = `msg-${msg.id}`;
    
    const isOwn = String(msg.sender_id) === String(currentUser?.id);
    bubble.className = `message-bubble ${isOwn ? 'message-own' : 'message-other'}`;

    const senderName = isOwn ? "Du" : await fetchUserName(msg.sender_id);
    const dateObj = msg.created_at ? new Date(msg.created_at) : new Date();
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isDeleted = msg.text === "Du hast diese Nachricht gelöscht" || msg.text === "Diese Nachricht wurde gelöscht";

    // Aktionsbalken
    if (!isSystem && !isDeleted) {
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "message-actions";

        // Antworten
        const replyBtn = document.createElement("button");
        replyBtn.className = "msg-action-btn";
        replyBtn.title = "Antworten";
        replyBtn.innerHTML = '<i class="fa-solid fa-reply"></i>';
        replyBtn.addEventListener("click", () => {
            replyingToId = msg.id;
            if (replyPreviewBanner && replyBannerAuthor && replyBannerText) {
                replyBannerAuthor.innerText = `Antwort an ${senderName}`;
                replyBannerText.innerText = sanitizeQuoteText(msg.text || "[Medien]");
                replyPreviewBanner.style.display = "flex";
            }
            if (messageInput) messageInput.focus();
        });
        actionsDiv.appendChild(replyBtn);

        // Nachricht kopieren
        const copyBtn = document.createElement("button");
        copyBtn.className = "msg-action-btn";
        copyBtn.title = "Text kopieren";
        copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';
        copyBtn.addEventListener("click", () => {
            const textToCopy = msg.text || "";
            navigator.clipboard.writeText(textToCopy).then(() => {
                alert("Nachricht in die Zwischenablage kopiert!");
            }).catch(err => {
                console.error("Fehler beim Kopieren:", err);
            });
        });
        actionsDiv.appendChild(copyBtn);

        // Bearbeiten & Löschen
        if (isOwn) {
            if (msg.text && !msg.text.includes("hat den Chat") && !msg.text.includes("hat das Forum")) {
                const editBtn = document.createElement("button");
                editBtn.className = "msg-action-btn";
                editBtn.title = "Bearbeiten";
                editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
                editBtn.addEventListener("click", () => {
                    editingMessageId = msg.id;
                    if (messageInput) {
                        messageInput.value = msg.text;
                        messageInput.focus();
                        messageInput.style.height = "auto";
                        messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + "px";
                    }
                    if (editPreviewBanner) {
                        // Hier wird der Text im Bearbeitungs-Banner ebenfalls über sanitizeQuoteText geleert/komprimiert!
                        document.getElementById("editBannerText").innerText = sanitizeQuoteText(msg.text);
                        editPreviewBanner.style.display = "flex";
                    }
                });
                actionsDiv.appendChild(editBtn);
            }

            const deleteMsgBtn = document.createElement("button");
            deleteMsgBtn.className = "msg-action-btn delete-btn";
            deleteMsgBtn.title = "Löschen";
            deleteMsgBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteMsgBtn.addEventListener("click", async () => {
                if (confirm("Möchtest du diese Nachricht löschen?")) {
                    const supabase = window.supabaseClient || window.supabase;
                    if (!supabase) return;

                    const deleteText = "Du hast diese Nachricht gelöscht";
                    await supabase.from("messages").update({
                        text: deleteText,
                        image_url: null,
                        reply_to: null,
                        is_edited: false
                    }).eq("id", msg.id);

                    await loadChatMessages(activeChatId);
                    await loadUserChats();
                }
            });
            actionsDiv.appendChild(deleteMsgBtn);
        }

        bubble.appendChild(actionsDiv);
    }

    const authorDiv = document.createElement("div");
    authorDiv.className = "msg-author";
    authorDiv.innerText = senderName;
    bubble.appendChild(authorDiv);

    // Zitat anzeigen
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
        
        quoteDiv.addEventListener("click", () => {
            const targetElement = document.getElementById(`msg-${msg.reply_to}`);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetElement.classList.add('message-highlight');
                setTimeout(() => {
                    targetElement.classList.remove('message-highlight');
                }, 1500);
            }
        });

        bubble.appendChild(quoteDiv);
    }

    if (!isDeleted && msg.image_url) {
        const urls = msg.image_url.split(",").map(u => u.trim()).filter(Boolean);
        const gridContainer = document.createElement("div");
        gridContainer.className = "wa-media-grid";

        const displayCount = Math.min(urls.length, 4);
        for (let i = 0; i < displayCount; i++) {
            const cleanUrl = urls[i];
            const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(cleanUrl);

            if (isVideo) {
                const videoWrap = document.createElement("div");
                videoWrap.className = "wa-video-preview-wrapper";
                
                const videoElem = document.createElement("video");
                videoElem.src = cleanUrl;
                videoElem.preload = "metadata";

                const overlayDiv = document.createElement("div");
                overlayDiv.className = "wa-video-play-overlay";
                overlayDiv.innerHTML = '<i class="fa-solid fa-play"></i>';

                videoWrap.appendChild(videoElem);
                videoWrap.appendChild(overlayDiv);

                videoWrap.addEventListener("click", () => {
                    if (modalVideoFull && imageModal) {
                        if (modalImageFull) modalImageFull.style.display = "none";
                        modalVideoFull.src = cleanUrl;
                        modalVideoFull.style.display = "block";
                        imageModal.style.display = "flex";
                        modalVideoFull.play();
                    }
                });

                gridContainer.appendChild(videoWrap);
            } else {
                const imgWrap = document.createElement("div");
                imgWrap.className = "wa-media-item";

                const img = document.createElement("img");
                img.src = cleanUrl;
                img.alt = "Bild";
                img.addEventListener("click", () => {
                    if (modalImageFull && imageModal) {
                        if (modalVideoFull) modalVideoFull.style.display = "none";
                        modalImageFull.src = cleanUrl;
                        modalImageFull.style.display = "block";
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
        }
        bubble.appendChild(gridContainer);
    }

    if (msg.text && msg.text !== "[Medien]") {
        const textDiv = document.createElement("div");
        
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

    // Fußzeile
    const footerDiv = document.createElement("div");
    footerDiv.style.cssText = "display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 4px;";

    if (!isDeleted && msg.is_edited) {
        const editedSpan = document.createElement("span");
        editedSpan.style.cssText = "font-size: 10px; opacity: 0.6; font-style: italic; line-height: 1;";
        editedSpan.innerText = "bearbeitet";
        footerDiv.appendChild(editedSpan);
    }

    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.innerText = timeStr;
    footerDiv.appendChild(timeSpan);

    bubble.appendChild(footerDiv);
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
            const chatObj = allChatsCache.find(c => c.id === activeChatId);
            const isForum = (chatObj && chatObj.user1_id === chatObj.user2_id);
            
            const articleText = isForum ? "das Forum" : "den Chat";

            await supabase.from("chats").update({ title: trimmedTitle }).eq("id", activeChatId);

            const sysMsg = `${currentUsername} hat ${articleText} in "${trimmedTitle}" umbenannt.`;
            await supabase.from("messages").insert([{
                chat_id: activeChatId,
                sender_id: currentUser.id,
                text: sysMsg
            }]);

            await supabase.from("chats").update({ last_message: sysMsg }).eq("id", activeChatId);

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
            const { error: msgErr } = await supabase.from("messages").delete().eq("chat_id", activeChatId);
            if (msgErr) {
                alert("Fehler beim Löschen der Nachrichten: " + msgErr.message);
                return;
            }
            try { await supabase.from("chat_favorites").delete().eq("chat_id", activeChatId); } catch(e){}
            const { error: chatErr } = await supabase.from("chats").delete().eq("id", activeChatId);
            if (chatErr) {
                alert("Fehler beim Löschen: " + chatErr.message);
                return;
            }
            
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
            const { error: msgErr } = await supabase.from("messages").delete().eq("chat_id", activeChatId);
            if (msgErr) {
                alert("Fehler: " + msgErr.message);
                return;
            }
            try { await supabase.from("chat_favorites").delete().eq("chat_id", activeChatId); } catch(e){}
            const { error: chatErr } = await supabase.from("chats").delete().eq("id", activeChatId);
            if (chatErr) {
                alert("Fehler: " + chatErr.message);
                return;
            }
            
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

        const MAX_FILE_SIZE = 200 * 1024 * 1024;
        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                alert("Dein Medium konnte nicht hochgeladen werden, da die Datei das Dateigrößenlimit überschreitet.");
                return;
            }
        }

        const isOfficialAnnouncement = (activeChatId === officialForumChatId);
        if (isOfficialAnnouncement && !isAdminUser) {
            alert("Nur Administratoren können im offiziellen Forum schreiben.");
            return;
        }

        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sende...`;
        }

        try {
            // BEARBEITEN-MODUS
            if (editingMessageId) {
                const targetIdToEdit = editingMessageId;
                editingMessageId = null;
                if (editPreviewBanner) editPreviewBanner.style.display = "none";

                const { error: editErr } = await supabase.from("messages").update({
                    text: text,
                    is_edited: true
                }).eq("id", targetIdToEdit);

                if (editErr) {
                    alert("Fehler beim Bearbeiten: " + editErr.message);
                    throw editErr;
                }

                if (messageInput) {
                    messageInput.value = "";
                    messageInput.style.height = "42px";
                }
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
                if (uploadErr) {
                    throw uploadErr;
                }
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

            if (messageInput) {
                messageInput.value = "";
                messageInput.style.height = "42px";
            }
            if (imageUploadInput) imageUploadInput.value = "";
            if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
            if (emojiPickerWrapper) emojiPickerWrapper.style.display = "none";
            
            replyingToId = null;
            if (replyPreviewBanner) replyPreviewBanner.style.display = "none";

            markChatAsRead(activeChatId);
            loadUserChats();
        } catch (err) {
            console.error("Fehler beim Senden:", err);
            alert("Fehler beim Verarbeiten der Nachricht. Bitte versuche es erneut.");
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Senden`;
            }
        }
    });
}