/* =========================================
   GSRA - Messenger Logik (Supabase Realtime)
========================================= */

const supabase = window.supabase;

let currentUser = null;
let activeChatId = null;
let messageSubscription = null;

// DOM-Elemente
const chatsList = document.getElementById("chatsList");
const chatHeader = document.getElementById("chatHeader");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatForm = document.getElementById("chatForm");

document.addEventListener("DOMContentLoaded", async () => {
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;

    if (!currentUser) {
        if (chatsList) {
            chatsList.innerHTML = `<p style="padding: 15px; font-size: 13px; color: var(--text-muted);">Bitte logge dich ein, um deine Chats zu sehen.</p>`;
        }
        return;
    }

    loadUserChats();
    checkUrlParameters();
});

// 1. URL Parameter verarbeiten (Anfrage von Marktplatz)
async function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const sellerId = urlParams.get("sellerId");
    const sellerName = urlParams.get("sellerName") || "Verkäufer";
    const itemTitle = urlParams.get("itemTitle");

    if (sellerId && currentUser && sellerId !== currentUser.id) {
        let { data: existingChat } = await supabase
            .from("chats")
            .select("*")
            .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${sellerId}),and(user1_id.eq.${sellerId},user2_id.eq.${currentUser.id})`)
            .maybeSingle();

        if (!existingChat) {
            const { data: newChat, error } = await supabase
                .from("chats")
                .insert([{
                    user1_id: currentUser.id,
                    user2_id: sellerId,
                    last_message: itemTitle ? `Anfrage zu: ${itemTitle}` : "Neuer Chat"
                }])
                .select()
                .single();

            if (!error) existingChat = newChat;
        }

        if (existingChat) {
            activeChatId = existingChat.id;
            openChat(existingChat.id, sellerName, itemTitle);
        }
    }
}

// 2. Chat-Übersicht laden
async function loadUserChats() {
    if (!chatsList || !currentUser) return;

    const { data: chats, error } = await supabase
        .from("chats")
        .select("*")
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
        .order("updated_at", { ascending: false });

    if (error || !chats || chats.length === 0) {
        chatsList.innerHTML = `<p style="padding: 15px; font-size: 13px; color: var(--text-muted);">Keine aktiven Chats.</p>`;
        return;
    }

    chatsList.innerHTML = "";
    chats.forEach((chat) => {
        const otherUserId = chat.user1_id === currentUser.id ? chat.user2_id : chat.user1_id;
        const item = document.createElement("div");
        item.className = `chat-user-item ${chat.id === activeChatId ? 'active' : ''}`;
        
        item.innerHTML = `
            <div style="color: #fff; font-weight: bold; font-size: 14px;">Nutzer (${otherUserId ? otherUserId.substring(0, 6) : 'Chat'})</div>
            <div style="font-size: 12px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                ${chat.last_message || 'Keine Nachrichten'}
            </div>
        `;

        item.addEventListener("click", () => {
            activeChatId = chat.id;
            openChat(chat.id, `Nutzer (${otherUserId ? otherUserId.substring(0, 6) : ''})`);
        });

        chatsList.appendChild(item);
    });
}

// 3. Chat öffnen & Nachrichten abonnieren
async function openChat(chatId, recipientName, itemContext = null) {
    if (chatHeader) chatHeader.innerText = `Chat mit ${recipientName}`;
    if (messageInput) messageInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    if (messageSubscription) {
        supabase.removeChannel(messageSubscription);
    }

    const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

    renderMessages(messages || [], itemContext);

    // Echtzeit-Nachrichten-Abo über Supabase
    messageSubscription = supabase
        .channel(`chat_${chatId}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
            (payload) => {
                appendSingleMessage(payload.new);
            }
        )
        .subscribe();
}

function renderMessages(messages, itemContext) {
    if (!chatMessages) return;
    chatMessages.innerHTML = "";

    if (messages.length === 0 && itemContext) {
        chatMessages.innerHTML = `<p style="text-align: center; color: var(--gsra-yellow); font-size: 13px; margin: auto;">Starte die Konversation bezüglich "${itemContext}"</p>`;
        return;
    }

    messages.forEach(appendSingleMessage);
}

function appendSingleMessage(msg) {
    if (!chatMessages) return;

    const bubble = document.createElement("div");
    const isOwn = msg.sender_id === currentUser.id;

    bubble.className = `message-bubble ${isOwn ? 'message-own' : 'message-other'}`;

    const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    bubble.innerHTML = `
        <div>${msg.text}</div>
        <span class="message-time">${timeStr}</span>
    `;

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 4. Nachricht senden
if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();

        if (!text || !activeChatId || !currentUser) return;

        messageInput.value = "";

        try {
            const { error: msgError } = await supabase.from("messages").insert([{
                chat_id: activeChatId,
                sender_id: currentUser.id,
                text: text
            }]);

            if (msgError) throw msgError;

            await supabase.from("chats").update({
                last_message: text,
                updated_at: new Date().toISOString()
            }).eq("id", activeChatId);

        } catch (err) {
            console.error("Fehler beim Senden:", err);
        }
    });
}