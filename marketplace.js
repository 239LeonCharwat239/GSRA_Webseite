/* =========================================
   GSRA - Marketplace Logik & Galerie
========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Firebase Konfiguration
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
const storage = getStorage(app);

let currentUser = null;
let allItems = [];

// DOM-Elemente
const marketplaceGrid = document.getElementById("marketplaceGrid");
const filterCategory = document.getElementById("filterCategory");
const searchMarketplace = document.getElementById("searchMarketplace");

// Detail Modal Elemente
const itemDetailModal = document.getElementById("itemDetailModal");
const closeDetailModalBtn = document.getElementById("closeDetailModalBtn");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalMainImage = document.getElementById("modalMainImage");
const modalGalleryStrip = document.getElementById("modalGalleryStrip");
const modalDescription = document.getElementById("modalDescription");
const modalPrice = document.getElementById("modalPrice");
const modalContactBtn = document.getElementById("modalContactBtn");
const modalDeleteBtn = document.getElementById("modalDeleteBtn");

// Erstellen Modal Elemente
const itemCreateModal = document.getElementById("itemCreateModal");
const openItemModalBtn = document.getElementById("openItemModalBtn");
const closeCreateModalBtn = document.getElementById("closeCreateModalBtn");
const createItemForm = document.getElementById("create-item-form");

// Auth-Status Prüfung
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const loginNavBtn = document.getElementById("loginNavBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (user) {
        if (loginNavBtn) loginNavBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-block";
    } else {
        if (loginNavBtn) loginNavBtn.style.display = "inline-block";
        if (logoutBtn) logoutBtn.style.display = "none";
    }
});

// Logout Listener
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => window.location.reload());
    });
}

// 1. Marktplatz Artikel aus Firestore laden
async function loadMarketplaceItems() {
    marketplaceGrid.innerHTML = "<p>Lade Marktplatz-Angebote...</p>";
    try {
        const q = query(collection(db, "marketplace"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        allItems = [];

        querySnapshot.forEach((docSnap) => {
            allItems.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderMarketplaceItems(allItems);
    } catch (error) {
        console.error("Fehler beim Laden der Artikel:", error);
        marketplaceGrid.innerHTML = "<p>Fehler beim Laden der Marktplatz-Daten.</p>";
    }
}

// 2. Artikel-Karten auf der Seite darstellen
function renderMarketplaceItems(items) {
    marketplaceGrid.innerHTML = "";

    if (items.length === 0) {
        marketplaceGrid.innerHTML = "<p>Keine passenden Angebote gefunden.</p>";
        return;
    }

    items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "card marketplace-card-clickable";

        // Haupt-Vorschaubild (Erstes aus dem Array)
        const coverImage = (item.imageUrls && item.imageUrls.length > 0) ? item.imageUrls[0] : 'placeholder.png';
        const formattedPrice = parseFloat(item.price).toFixed(2);

        card.innerHTML = `
            <img src="${coverImage}" alt="${item.title}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 6px; margin-bottom: 12px; border: 1px solid var(--border-subtle);">
            <h3>${item.title}</h3>
            <p style="font-size: 13px; color: var(--gsra-blue); font-weight: bold; margin-bottom: 5px;">${item.category}</p>
            <p style="font-size: 13px; margin-bottom: 15px;">Verkäufer: ${item.sellerName || "Anonym"}</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="text-yellow" style="font-size: 20px; font-weight: bold;">${formattedPrice} €</span>
                <span style="font-size: 12px; color: var(--text-muted);"><i class="fa-solid fa-images"></i> ${item.imageUrls ? item.imageUrls.length : 0} Bilder</span>
            </div>
        `;

        // Klick auf Karte öffnet die große Detail-Ansicht
        card.addEventListener("click", () => openDetailModal(item));
        marketplaceGrid.appendChild(card);
    });
}

// 3. Filter-Funktionalität
function filterItems() {
    const categoryValue = filterCategory.value;
    const searchValue = searchMarketplace.value.toLowerCase();

    const filtered = allItems.filter((item) => {
        const matchesCategory = categoryValue === "all" || item.category === categoryValue;
        const matchesSearch = item.title.toLowerCase().includes(searchValue) ||
                              item.description.toLowerCase().includes(searchValue);
        return matchesCategory && matchesSearch;
    });

    renderMarketplaceItems(filtered);
}

if (filterCategory) filterCategory.addEventListener("change", filterItems);
if (searchMarketplace) searchMarketplace.addEventListener("input", filterItems);

// 4. Modal 1: Große Detailansicht mit Galerie (bis zu 10 Bilder) & Messenger
function openDetailModal(item) {
    modalTitle.innerText = item.title;
    modalMeta.innerText = `Kategorie: ${item.category} | Verkäufer: ${item.sellerName || 'Anonym'}`;
    modalDescription.innerText = item.description;
    modalPrice.innerText = `${parseFloat(item.price).toFixed(2)} €`;

    const images = item.imageUrls || [];
    modalGalleryStrip.innerHTML = "";

    if (images.length > 0) {
        // Erstmals das erste Bild anzeigen
        modalMainImage.src = images[0];

        // Thumbnails für bis zu 10 Bilder generieren
        images.forEach((imgUrl, index) => {
            const thumb = document.createElement("img");
            thumb.src = imgUrl;
            thumb.className = `gallery-thumbnail ${index === 0 ? 'active' : ''}`;

            thumb.addEventListener("click", () => {
                modalMainImage.src = imgUrl;
                document.querySelectorAll(".gallery-thumbnail").forEach(t => t.classList.remove("active"));
                thumb.classList.add("active");
            });

            modalGalleryStrip.appendChild(thumb);
        });
    } else {
        modalMainImage.src = "placeholder.png";
    }

    // Messenger Button Aktion
    modalContactBtn.onclick = () => {
        if (!currentUser) {
            alert("Bitte logge dich ein, um dem Verkäufer eine Nachricht zu senden.");
            return;
        }
        alert(`Kontakt zu ${item.sellerName || 'Verkäufer'} wird über den Messenger hergestellt...`);
        // Hier folgt der Messenger-Aufruf (z.B. openChatWithUser(item.sellerId))
    };

    // Löschen Button (nur für den Besitzer sichtbar)
    if (currentUser && currentUser.uid === item.sellerId) {
        modalDeleteBtn.style.display = "inline-flex";
        modalDeleteBtn.onclick = async () => {
            if (confirm("Möchtest du dieses Angebot wirklich löschen?")) {
                try {
                    await deleteDoc(doc(db, "marketplace", item.id));
                    alert("Angebot gelöscht.");
                    itemDetailModal.style.display = "none";
                    loadMarketplaceItems();
                } catch (e) {
                    console.error("Fehler beim Löschen:", e);
                }
            }
        };
    } else {
        modalDeleteBtn.style.display = "none";
    }

    itemDetailModal.style.display = "flex";
}

if (closeDetailModalBtn) {
    closeDetailModalBtn.addEventListener("click", () => {
        itemDetailModal.style.display = "none";
    });
}

// 5. Modal 2: Angebot Erstellen
if (openItemModalBtn) {
    openItemModalBtn.addEventListener("click", () => {
        if (!currentUser) {
            alert("Bitte melde dich an, um ein Angebot zu erstellen.");
            return;
        }
        itemCreateModal.style.display = "flex";
    });
}

if (closeCreateModalBtn) {
    closeCreateModalBtn.addEventListener("click", () => {
        itemCreateModal.style.display = "none";
    });
}

// 6. Multi-Image Upload (Bis zu 10 Bilder) & Angebot in Firestore speichern
if (createItemForm) {
    createItemForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!currentUser) {
            alert("Du musst angemeldet sein.");
            return;
        }

        const title = document.getElementById("itemTitle").value;
        const category = document.getElementById("itemCategory").value;
        const price = parseFloat(document.getElementById("itemPrice").value);
        const description = document.getElementById("itemDescription").value;
        const fileInput = document.getElementById("itemImages");

        const files = Array.from(fileInput.files);

        if (files.length === 0) {
            alert("Bitte wähle mindestens ein Bild aus.");
            return;
        }

        if (files.length > 10) {
            alert("Du kannst maximal 10 Bilder auswählen.");
            return;
        }

        try {
            alert("Bilder werden hochgeladen... Bitte kurz warten.");

            const uploadPromises = files.map(async (file) => {
                const storageRef = ref(storage, `marketplace/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                return await getDownloadURL(snapshot.ref);
            });

            // Alle Bilder hochladen und URLs sammeln
            const imageUrls = await Promise.all(uploadPromises);

            // In Firestore speichern
            await addDoc(collection(db, "marketplace"), {
                title,
                category,
                price,
                description,
                imageUrls,
                sellerId: currentUser.uid,
                sellerName: currentUser.displayName || currentUser.email,
                createdAt: new Date().toISOString()
            });

            alert("Angebot erfolgreich erstellt!");
            createItemForm.reset();
            itemCreateModal.style.display = "none";
            loadMarketplaceItems();
        } catch (error) {
            console.error("Fehler beim Erstellen des Angebots:", error);
            alert("Fehler beim Erstellen des Angebots.");
        }
    });
}

// Initialer Aufruf
window.addEventListener("DOMContentLoaded", loadMarketplaceItems);