/* =========================================
   GSRA - Marketplace Logik & Galerie (Supabase)
========================================= */

let currentUser = null;
let allItems = [];

// Hilfsfunktion zum Schutz vor XSS / kaputtem HTML
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Inline SVG-Platzhalter (verhindert 404 placeholder.png Fehler)
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='250' viewBox='0 0 400 250'><rect width='100%' height='100%' fill='%231a1a1a'/><text x='50%' y='50%' fill='%23666666' font-size='16' text-anchor='middle' dy='.3em'>Kein Bild vorhanden</text></svg>";

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

// Auth Session initialisieren & synchron halten
document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) {
        console.error("Supabase Client nicht gefunden!");
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;

    supabase.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
    });

    loadMarketplaceItems();
});

// 1. Marktplatz Artikel laden
async function loadMarketplaceItems() {
    const supabase = window.supabaseClient || window.supabase;
    if (!marketplaceGrid || !supabase) return;
    marketplaceGrid.innerHTML = "<p>Lade Marktplatz-Angebote...</p>";

    try {
        const { data, error } = await supabase
            .from("marketplace")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        allItems = data || [];
        renderMarketplaceItems(allItems);
    } catch (error) {
        console.error("Fehler beim Laden der Artikel:", error);
        marketplaceGrid.innerHTML = "<p>Keine Angebote vorhanden oder Verbindungsfehler.</p>";
    }
}

// 2. Artikel-Karten rendern
function renderMarketplaceItems(items) {
    if (!marketplaceGrid) return;
    marketplaceGrid.innerHTML = "";

    if (items.length === 0) {
        marketplaceGrid.innerHTML = "<p>Keine passenden Angebote gefunden.</p>";
        return;
    }

    items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "card marketplace-card-clickable";

        const images = item.image_urls || item.imageUrls || [];
        const coverImage = images.length > 0 ? images[0] : DEFAULT_PLACEHOLDER;
        const formattedPrice = parseFloat(item.price || 0).toFixed(2);
        const seller = item.seller_name || item.sellerName || "Anonym";

        card.innerHTML = `
            <img src="${escapeHtml(coverImage)}" alt="${escapeHtml(item.title)}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 6px; margin-bottom: 12px; border: 1px solid var(--border-subtle);" onerror="this.src='${DEFAULT_PLACEHOLDER}'">
            <h3>${escapeHtml(item.title)}</h3>
            <p style="font-size: 13px; color: var(--gsra-blue); font-weight: bold; margin-bottom: 5px;">${escapeHtml(item.category)}</p>
            <p style="font-size: 13px; margin-bottom: 15px;">Verkäufer: ${escapeHtml(seller)}</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="text-yellow" style="font-size: 20px; font-weight: bold;">${formattedPrice} €</span>
                <span style="font-size: 12px; color: var(--text-muted);"><i class="fa-solid fa-images"></i> ${images.length} Bilder</span>
            </div>
        `;

        card.addEventListener("click", () => openDetailModal(item));
        marketplaceGrid.appendChild(card);
    });
}

// 3. Filter-Funktion
function filterItems() {
    const categoryValue = filterCategory ? filterCategory.value : "all";
    const searchValue = searchMarketplace ? searchMarketplace.value.toLowerCase() : "";

    const filtered = allItems.filter((item) => {
        const matchesCategory = categoryValue === "all" || item.category === categoryValue;
        const matchesSearch = (item.title || "").toLowerCase().includes(searchValue) ||
                              (item.description || "").toLowerCase().includes(searchValue);
        return matchesCategory && matchesSearch;
    });

    renderMarketplaceItems(filtered);
}

if (filterCategory) filterCategory.addEventListener("change", filterItems);
if (searchMarketplace) searchMarketplace.addEventListener("input", filterItems);

// 4. Modal: Detailansicht
function openDetailModal(item) {
    const supabase = window.supabaseClient || window.supabase;
    if (!itemDetailModal) return;

    const sellerName = item.seller_name || item.sellerName || 'Verkäufer';
    const sellerId = item.seller_id || item.sellerId;
    const images = item.image_urls || item.imageUrls || [];

    modalTitle.innerText = item.title || "";
    modalMeta.innerText = `Kategorie: ${item.category || 'Allgemein'} | Verkäufer: ${sellerName}`;
    modalDescription.innerText = item.description || "";
    modalPrice.innerText = `${parseFloat(item.price || 0).toFixed(2)} €`;

    modalGalleryStrip.innerHTML = "";

    if (images.length > 0) {
        modalMainImage.src = images[0];
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
        modalMainImage.src = DEFAULT_PLACEHOLDER;
    }

    modalContactBtn.onclick = () => {
        if (!currentUser) {
            alert("Bitte logge dich ein, um dem Verkäufer eine Nachricht zu senden.");
            return;
        }
        if (currentUser.id === sellerId) {
            alert("Das ist dein eigenes Angebot.");
            return;
        }
        
        const url = `messenger.html?sellerId=${sellerId}&sellerName=${encodeURIComponent(sellerName)}&itemTitle=${encodeURIComponent(item.title)}`;
        window.location.href = url;
    };

    if (currentUser && currentUser.id === sellerId) {
        modalDeleteBtn.style.display = "inline-flex";
        modalDeleteBtn.onclick = async () => {
            if (confirm("Möchtest du dieses Angebot wirklich löschen?")) {
                try {
                    const { error } = await supabase.from("marketplace").delete().eq("id", item.id);
                    if (error) throw error;
                    alert("Angebot gelöscht.");
                    itemDetailModal.style.display = "none";
                    loadMarketplaceItems();
                } catch (e) {
                    console.error("Fehler beim Löschen:", e);
                    alert("Fehler beim Löschen des Angebots.");
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

// Schließen bei Klick außerhalb des Modals
window.addEventListener("click", (e) => {
    if (e.target === itemDetailModal) itemDetailModal.style.display = "none";
    if (e.target === itemCreateModal) itemCreateModal.style.display = "none";
});

// 5. Modal: Angebot Erstellen
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

// 6. Angebot Speichern & Bild-Upload
if (createItemForm) {
    createItemForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const supabase = window.supabaseClient || window.supabase;

        if (!currentUser) {
            alert("Du musst angemeldet sein.");
            return;
        }

        const title = document.getElementById("itemTitle").value;
        const category = document.getElementById("itemCategory").value;
        const price = parseFloat(document.getElementById("itemPrice").value);
        const description = document.getElementById("itemDescription").value;
        const fileInput = document.getElementById("itemImages");
        const submitBtn = createItemForm.querySelector("button[type='submit']");

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
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Bilder werden hochgeladen...";
            }

            const uploadPromises = files.map(async (file) => {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage.from("marketplace").upload(fileName, file);
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from("marketplace").getPublicUrl(fileName);
                return data.publicUrl;
            });

            const imageUrls = await Promise.all(uploadPromises);
            const sellerName = currentUser.user_metadata?.full_name || (currentUser.email ? currentUser.email.split('@')[0] : "Anonym");

            const { error: insertError } = await supabase.from("marketplace").insert([{
                title,
                category,
                price,
                description,
                image_urls: imageUrls,
                seller_id: currentUser.id,
                seller_name: sellerName
            }]);

            if (insertError) throw insertError;

            alert("Angebot erfolgreich erstellt!");
            createItemForm.reset();
            itemCreateModal.style.display = "none";
            loadMarketplaceItems();
        } catch (error) {
            console.error("Fehler beim Erstellen des Angebots:", error);
            alert("Fehler beim Erstellen des Angebots: " + (error.message || "Überprüfe deine Internetverbindung oder Supabase-Rechte."));
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Angebot veröffentlichen";
            }
        }
    });
}