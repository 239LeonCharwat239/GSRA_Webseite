/**
 * GSRA Gallery & Modal Handler
 * Behebt das Problem mit "Keine Bilder vorhanden"
 */

function openListingModal(listing) {
    const modal = document.getElementById('marketplace-modal');
    const galleryContainer = document.getElementById('modal-gallery');
    
    if (!modal) return;

    // Titel & Beschreibungen füllen
    document.getElementById('modal-title').innerText = listing.title || 'Kein Titel';
    document.getElementById('modal-price').innerText = listing.price ? `${listing.price} €` : 'VB';
    document.getElementById('modal-description').innerText = listing.description || 'Keine Beschreibung angegeben.';
    document.getElementById('modal-seller').innerText = listing.seller_name || 'Anonymer Verkäufer';
    document.getElementById('modal-contact').innerText = listing.contact_info || 'Keine Kontaktangabe';

    // Galerie verarbeiten
    if (galleryContainer) {
        galleryContainer.innerHTML = ''; // Vorherige Bilder leeren

        // Überprüfe ob image_urls oder images als Array/String existieren
        let images = listing.image_urls || listing.images || listing.image_url;

        if (typeof images === 'string') {
            try {
                images = JSON.parse(images);
            } catch (e) {
                images = [images];
            }
        }

        if (Array.isArray(images) && images.length > 0) {
            images.forEach(url => {
                if (url && url.trim() !== '') {
                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = listing.title;
                    img.className = 'gallery-image';
                    img.onclick = () => window.open(url, '_blank');
                    galleryContainer.appendChild(img);
                }
            });
        } else {
            galleryContainer.innerHTML = '<p style="color: var(--text-muted); font-style: italic; width: 100%; text-align: center;">Keine Bilder vorhanden.</p>';
        }
    }

    modal.style.display = 'flex';
}

function closeListingModal() {
    const modal = document.getElementById('marketplace-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Event-Listener zum Schließen per Klick außerhalb des Modals
window.addEventListener('click', (e) => {
    const modal = document.getElementById('marketplace-modal');
    if (e.target === modal) {
        closeListingModal();
    }
});