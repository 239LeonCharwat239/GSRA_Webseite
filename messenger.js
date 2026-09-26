/* =========================================
   GSRA - Messenger Logik (Echtzeit Firebase)
========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, setDoc, doc, getDoc 
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
let activeRecipientId = null;
let unsubscribeMessages = null;

// DOM Elemente
const chatsList = document.getElementById("chatsList");
const chatHeader = document.getElementById("chatHeader");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const chatForm = document.getElementById("chatForm");

// Auth Status
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

// 1. Parameter aus URL auslesen (falls Klick auf Marktplatz "Verkäufer kontaktieren")
async function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const sellerId = urlParams.get("sellerId");
    const sellerName = urlParams.get("sellerName") || "Verkäufer";
    const itemTitle = urlParams.get("itemTitle");

    if (sellerId && sellerId !== currentUser.uid) {
        // Chat-ID aus beiden User-UIDs zusammensetzen
        const chatId = [currentUser.uid, sellerId].sort().join("_");
        activeChatId = chatId;
        activeRecipientId = sellerId;

        // Chat-Dokument initialisieren
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
                activeRecipientId = otherUserId;
                openChat(chatDoc.id, `User (${otherUserId.substring(0, 6)})`);
            });

            chatsList.appendChild(item);
        });
    });
}

// 3. Chatfenster öffnen und Echtzeit-Nachrichten abonnieren
function openChat(chatId, recipientName, itemContext = null) {
    chatHeader.innerText = `Chat mit ${recipientName}`;
    messageInput.disabled = false;
    sendBtn.disabled = false;

    if (unsubscribeMessages) unsubscribeMessages();

    const messagesQuery = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("timestamp", "asc")
    );

    unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        chatMessages.innerHTML = "";

        if (snapshot.empty && itemContext) {
            chatMessages.innerHTML = `<p style="text-align: center; color: var(--gsra-yellow); font-size: 13px;">Starte die Konversation bezüglich "${itemContext}"</p>`;
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

        // Automatisch nach unten scrollen
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// 4. Nachricht senden
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();

    if (!text || !activeChatId) return;

    messageInput.value = "";

    try {
        // Nachricht in Sub-Collection speichern
        await addDoc(collection(db, "chats", activeChatId, "messages"), {
            senderId: currentUser.uid,
            text: text,
            timestamp: serverTimestamp()
        });

        // Chat-Header/Last Message aktualisieren
        await setDoc(doc(db, "chats", activeChatId), {
            lastMessage: text,
            updatedAt: serverTimestamp()
        }, { merge: true });

    } catch (err) {
        console.error("Fehler beim Senden:", err);
    }
});