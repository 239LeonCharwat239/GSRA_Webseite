/* =========================================
   GSRA - Messenger Logik (Echtzeit Firebase)
========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, setDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let activeChatId = null;
let unsubscribeMessages = null;

// DOM Elemente
const chatsList = document.getElementById("chatsList");
const chatHeader = document.getElementById("chatHeader");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatForm = document.getElementById("chatForm");

// Auth Status prüfen
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (!user) {
        alert("Bitte melde dich an, um den Messenger zu nutzen.");
        window.location.href = "login.html";
        return;
    }

    loadUserChats();
    checkUrlParameters();
});

// 1. Parameter aus URL auslesen (Marktplatz-Anfrage)
async function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const sellerId = urlParams.get("sellerId");
    const sellerName = urlParams.get("sellerName") || "Verkäufer";
    const itemTitle = urlParams.get("itemTitle");

    if (sellerId && currentUser && sellerId !== currentUser.uid) {
        const chatId = [currentUser.uid, sellerId].sort().join("_");
        activeChatId = chatId;

        await setDoc(doc(db, "chats", chatId), {
            participants: [currentUser.uid, sellerId],
            updatedAt: serverTimestamp(),
            lastMessage: itemTitle ? `Anfrage zu: ${itemTitle}` : "Neuer Chat gestartet"
        }, { merge: true });

        openChat(chatId, sellerName, itemTitle);
    }
}

// 2. Liste aller Unterhaltungen des Nutzers laden
function loadUserChats() {
    if (!chatsList) return;

    const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUser.uid)
    );

    onSnapshot(q, (snapshot) => {
        chatsList.innerHTML = "";
        if (snapshot.empty) {
            chatsList.innerHTML = `<p style="padding: 15px; font-size: 13px; color: var(--text-muted);">Keine aktiven Chats.</p>`;
            return;
        }

        snapshot.forEach((chatDoc) => {
            const data = chatDoc.data();
            const otherUserId = data.participants.find(id => id !== currentUser.uid);

            const item = document.createElement("div");
            item.className = `chat-user-item ${chatDoc.id === activeChatId ? 'active' : ''}`;
            item.innerHTML = `
                <div style="color: #fff; font-weight: bold; font-size: 14px;">User (${otherUserId ? otherUserId.substring(0, 6) : 'Chat'})</div>
                <div style="font-size: 12px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                    ${data.lastMessage || 'Keine Nachrichten'}
                </div>
            `;

            item.addEventListener("click", () => {
                activeChatId = chatDoc.id;
                openChat(chatDoc.id, `User (${otherUserId ? otherUserId.substring(0, 6) : ''})`);
            });

            chatsList.appendChild(item);
        });
    });
}

// 3. Chatfenster öffnen und Nachrichten abonnieren
function openChat(chatId, recipientName, itemContext = null) {
    if (chatHeader) chatHeader.innerText = `Chat mit ${recipientName}`;
    if (messageInput) messageInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    if (unsubscribeMessages) unsubscribeMessages();

    const messagesQuery = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("timestamp", "asc")
    );

    unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        if (!chatMessages) return;
        chatMessages.innerHTML = "";

        if (snapshot.empty && itemContext) {
            chatMessages.innerHTML = `<p style="text-align: center; color: var(--gsra-yellow); font-size: 13px; margin: auto;">Starte die Konversation bezüglich "${itemContext}"</p>`;
        }

        snapshot.forEach((msgDoc) => {
            const msg = msgDoc.data();
            const bubble = document.createElement("div");
            const isOwn = msg.senderId === currentUser.uid;

            bubble.className = `message-bubble ${isOwn ? 'message-own' : 'message-other'}`;
            
            const timeStr = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

            bubble.innerHTML = `
                <div>${msg.text}</div>
                <span class="message-time">${timeStr}</span>
            `;

            chatMessages.appendChild(bubble);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// 4. Nachricht senden
if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();

        if (!text || !activeChatId || !currentUser) return;

        messageInput.value = "";

        try {
            await addDoc(collection(db, "chats", activeChatId, "messages"), {
                senderId: currentUser.uid,
                text: text,
                timestamp: serverTimestamp()
            });

            await setDoc(doc(db, "chats", activeChatId), {
                lastMessage: text,
                updatedAt: serverTimestamp()
            }, { merge: true });

        } catch (err) {
            console.error("Fehler beim Senden:", err);
        }
    });
}