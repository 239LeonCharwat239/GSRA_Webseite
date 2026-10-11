/* =========================================
   GSRA - High-End Messenger Logik
========================================= */

let currentUser = null;
let activeChatId = null;
let messageSubscription = null;

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
const chatHeader = document.getElementById("chatHeader");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatForm = document.getElementById("chatForm");
const chatActions = document.getElementById("chatActions");
const editChatTitleBtn = document.getElementById("editChatTitleBtn");
const deleteChatBtn = document.getElementById("deleteChatBtn");
const blockUserBtn = document.getElementById("blockUserBtn");
const imageUploadInput = document.getElementById("imageUploadInput");
const emojiBar = document.getElementById("emojiBar");

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;

    if (!currentUser) {
        if (chatsList) chatsList.innerHTML = `<p style="padding: 15px; font-size: 13px; color: var(--text-muted);">Bitte logge dich ein.</p>`;
        return;
    }

    await checkUrlParameters();
    await loadUserChats();

    // Emoji Bar Klicks
    if (emojiBar) {
        emojiBar.querySelectorAll("span").forEach(span => {
            span.addEventListener("click", () => {
                if (messageInput && !messageInput.disabled) {
                    messageInput.value += span.innerText;
                    messageInput.focus();
                }
            });
        });
    }
});

// URL Parameter verarbeiten (Marketplace oder Direktchat mit Freund)
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
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
        .order("created_at", { ascending: false });

    if (error || !chats || chats.length === 0) {
        chatsList.innerHTML = `<p style="padding: 15px; font-size: 13px; color: var(--text-muted);">Keine aktiven Chats.</p>`;
        return;
    }

    chatsList.innerHTML = "";
    chats.forEach((chat) => {
        const otherUserId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
        const item = document.createElement("div");
        item.className = `chat-user-item ${chat.id === activeChatId ? 'active' : ''}`;
        
        const displayTitle = chat.title || `Chat mit Fahrer (${otherUserId.substring(0, 6)})`;
        const lastMsg = escapeHtml(chat.last_message || 'Keine Nachrichten');

        item.innerHTML = `
            <div style="color: #fff; font-weight: bold; font-size: 14px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(displayTitle)}</div>
            <div style="font-size: 12px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${lastMsg}</div>
        `;

        item.addEventListener("click", () => {
            activeChatId = chat.id;
            openChat(chat.id, `Fahrer (${otherUserId.substring(0, 6)})`, chat.title);
            loadUserChats();
        });

        chatsList.appendChild(item);
    });
}

// Chat öffnen
async function openChat(chatId, recipientName, chatTitle = null) {
    const supabase = window.supabaseClient || window.supabase;
    
    const displayName = chatTitle ? `${chatTitle} (${recipientName})` : `Chat mit ${recipientName}`;
    if (chatHeader) {
        chatHeader.querySelector("span").innerText = displayName;
    }
    if (chatActions) chatActions.style.display = "flex";
    if (emojiBar) emojiBar.style.display = "flex";
    if (messageInput) messageInput.disabled = false;
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

    let contentHtml = `<div>${escapeHtml(msg.text || "")}</div>`;
    if (msg.image_url) {
        contentHtml += `<img src="${escapeHtml(msg.image_url)}" alt="Bild" style="max-width: 220px; border-radius: 6px; margin-top: 6px; display: block;">`;
    }

    bubble.innerHTML = `${contentHtml}<span class="message-time">${timeStr}</span>`;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Chat-Titel umbenennen
if (editChatTitleBtn) {
    editChatTitleBtn.addEventListener("click", async () => {
        const supabase = window.supabaseClient || window.supabase;
        const newTitle = prompt("Gib einen neuen Namen für dieses Chat-Thema ein (der Benutzer bleibt unverändert):");
        if (newTitle !== null && activeChatId) {
            await supabase.from("chats").update({ title: newTitle }).eq("id", activeChatId);
            loadUserChats();
            alert("Chat-Thema aktualisiert!");
        }
    });
}

// Chat löschen
if (deleteChatBtn) {
    deleteChatBtn.addEventListener("click", async () => {
        const supabase = window.supabaseClient || window.supabase;
        if (confirm("Möchtest du diesen Chat wirklich unwiderruflich löschen?")) {
            await supabase.from("chats").delete().eq("id", activeChatId);
            activeChatId = null;
            if (chatHeader) chatHeader.querySelector("span").innerText = "Wähle einen Chat aus";
            if (chatActions) chatActions.style.display = "none";
            if (emojiBar) emojiBar.style.display = "none";
            if (chatMessages) chatMessages.innerHTML = "";
            loadUserChats();
        }
    });
}

// Nutzer blockieren
if (blockUserBtn) {
    blockUserBtn.addEventListener("click", async () => {
        alert("Nutzer wurde blockiert und aus deinen Chats entfernt.");
        if (activeChatId) {
            const supabase = window.supabaseClient || window.supabase;
            await supabase.from("chats").delete().eq("id", activeChatId);
            location.reload();
        }
    });
}

// Nachricht oder Bild senden
if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const supabase = window.supabaseClient || window.supabase;
        const text = messageInput ? messageInput.value.trim() : "";
        const file = imageUploadInput ? imageUploadInput.files[0] : null;

        if ((!text && !file) || !activeChatId || !currentUser || !supabase) return;

        if (messageInput) messageInput.value = "";
        if (imageUploadInput) imageUploadInput.value = "";

        let imageUrl = null;
        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `chat_${Date.now()}_${Math.random().toString(36).substring(2,7)}.${fileExt}`;
            
            // UPLOAD IN DEN NEUEN BUCKET: chat_attachments
            const { error: uploadErr } = await supabase.storage.from("chat_attachments").upload(fileName, file);
            if (!uploadErr) {
                const { data: pubData } = supabase.storage.from("chat_attachments").getPublicUrl(fileName);
                imageUrl = pubData.publicUrl;
            } else {
                console.error("Upload Fehler:", uploadErr.message);
            }
        }

        try {
            await supabase.from("messages").insert([{
                chat_id: activeChatId,
                sender_id: currentUser.id,
                text: text || (file ? "[Foto]" : ""),
                image_url: imageUrl
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