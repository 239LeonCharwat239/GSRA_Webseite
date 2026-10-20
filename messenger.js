/* =========================================
   GSRA - High-End Messenger Logik (Vollständig)
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
                if (messageInput && !messageInput.disabled) {
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

// Hilfsfunktion: Benutzername aus Profilen laden
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

// URL Parameter verarbeiten & danach URL bereinigen
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

// Chats in Sidebar laden
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
    for (const chat of chats) {
        const otherUserId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
        const otherUserName = await fetchUserName(otherUserId);
        
        const item = document.createElement("div");
        item.className = `chat-user-item ${chat.id === activeChatId ? 'active' : ''}`;
        
        const displayTitle = chat.title || `Chat mit ${otherUserName}`;
        const lastMsg = escapeHtml(chat.last_message || 'Keine Nachrichten');

        item.innerHTML = `
            <div style="color: #fff; font-weight: bold; font-size: 14px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(displayTitle)}</div>
            <div style="font-size: 12px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${lastMsg}</div>
        `;

        item.addEventListener("click", () => {
            activeChatId = chat.id;
            openChat(chat.id, otherUserName, chat.title);
            loadUserChats();
        });

        chatsList.appendChild(item);
    }
}

// Chat öffnen
async function openChat(chatId, recipientName, chatTitle = null) {
    const supabase = window.supabaseClient || window.supabase;
    
    // Header-Titel korrekt aufbauen, ohne den Namen zu verlieren
    const displayName = chatTitle ? `${chatTitle} (${recipientName})` : `Chat mit ${recipientName}`;
    if (chatTitleText) chatTitleText.innerText = displayName;
    
    if (chatActions) chatActions.style.display = "flex";
    if (messageInput) messageInput.disabled = false;
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

    // BILD(ER) OBEN
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

    // TEXT DARUNTER ALS ECHTE BILDUNTERSCHRIFT
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
            if (chatTitleText) chatTitleText.innerText = "Wähle einen Chat aus";
            if (chatActions) chatActions.style.display = "none";
            if (messageInput) { messageInput.value = ""; messageInput.disabled = true; }
            if (imageUploadInput) { imageUploadInput.value = ""; imageUploadInput.disabled = true; }
            if (emojiToggleBtn) emojiToggleBtn.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
            if (emojiPickerWrapper) emojiPickerWrapper.style.display = "none";
            if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
            if (chatMessages) chatMessages.innerHTML = `<p class="chat-placeholder" style="text-align: center; color: var(--text-muted); margin: auto;">Kein Chat ausgewählt.</p>`;

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
            if (chatTitleText) chatTitleText.innerText = "Wähle einen Chat aus";
            if (chatActions) chatActions.style.display = "none";
            if (messageInput) { messageInput.value = ""; messageInput.disabled = true; }
            if (imageUploadInput) { imageUploadInput.value = ""; imageUploadInput.disabled = true; }
            if (emojiToggleBtn) emojiToggleBtn.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
            if (emojiPickerWrapper) emojiPickerWrapper.style.display = "none";
            if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
            if (chatMessages) chatMessages.innerHTML = `<p class="chat-placeholder" style="text-align: center; color: var(--text-muted); margin: auto;">Kein Chat ausgewählt.</p>`;

            await loadUserChats();
            alert("Nutzer wurde blockiert und der Chat entfernt.");
        }
    });
}

// Nachricht & Mehrfach-Bilder senden
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