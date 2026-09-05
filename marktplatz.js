let currentUser = null;
let isAdmin = false;

async function initMarketplace() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;

    if (user) {
        document.getElementById('create-item-section').style.display = 'block';
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        
        if (profile && profile.role === 'admin') {
            isAdmin = true;
        }
    } else {
        document.getElementById('login-warning').style.display = 'block';
    }

    fetchItems();
}

async function fetchItems() {
    const { data, error } = await supabase
        .from('marketplace_items')
        .select('*, profiles(email)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Fehler beim Laden:", error);
        return;
    }

    renderItems(data);
}

function renderItems(items) {
    const grid = document.getElementById('marketplace-grid');
    grid.innerHTML = '';

    if (items.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">Derzeit sind keine Angebote vorhanden.</p>`;
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card marketplace-card-clickable';
        card.style.textAlign = 'left';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';

        const isOwner = currentUser && currentUser.id === item.seller_id;
        const canDelete = isOwner || isAdmin;
        const category = item.category || 'Hardware';
        const condition = item.condition || 'Keine Angabe';
        const imageUrls = item.images || [];

        // Bild-Vorschau für Karte
        const coverImage = imageUrls.length > 0 
            ? `<img src="${imageUrls[0]}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 6px; margin-bottom: 12px; border: 1px solid var(--border-subtle);">`
            : `<div style="width: 100%; height: 120px; background: rgba(255,255,255,0.03); display: flex; justify-content: center; align-items: center; border-radius: 6px; margin-bottom: 12px; color: var(--text-muted);"><i class="fa-solid fa-image fa-2x"></i></div>`;

        card.innerHTML = `
            <div onclick="openModal('${item.id}')">
                ${coverImage}
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <span style="font-size: 11px; background: var(--gsra-blue); color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;">${category}</span>
                        <span style="font-size: 11px; background: rgba(255,255,255,0.1); color: var(--gsra-yellow); padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;">${condition}</span>
                        <h3 style="margin: 5px 0 0 0; color: #fff;">${item.title}</h3>
                    </div>
                    <span class="text-yellow" style="font-size: 1.2rem; font-weight: bold;">${Number(item.price).toFixed(2)} €</span>
                </div>
            </div>
            <div style="margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: var(--text-muted);">Erstellt: ${new Date(item.created_at).toLocaleDateString('de-DE')}</span>
                ${canDelete ? `<button onclick="deleteItem(event, '${item.id}')" class="btn-delete"><i class="fa-solid fa-trash-can"></i> Löschen</button>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

document.getElementById('create-item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('item-title').value;
    const category = document.getElementById('item-category').value;
    const condition = document.getElementById('item-condition').value;
    const price = parseFloat(document.getElementById('item-price').value);
    const description = document.getElementById('item-description').value;
    const imageFiles = document.getElementById('item-images').files;

    let imageUrls = [];

    // Mehrere Bilder hochladen (falls ausgewählt)
    if (imageFiles.length > 0) {
        for (let i = 0; i < Math.min(imageFiles.length, 10); i++) {
            const file = imageFiles[i];
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentUser.id}_${Date.now()}_${i}.${fileExt}`;
            
            const { data, error } = await supabase.storage.from('marketplace-images').upload(fileName, file);
            if (!error) {
                const { data: urlData } = supabase.storage.from('marketplace-images').getPublicUrl(fileName);
                imageUrls.push(urlData.publicUrl);
            }
        }
    }

    const { error } = await supabase.from('marketplace_items').insert([{
        title,
        category,
        condition,
        price,
        description,
        images: imageUrls,
        seller_id: currentUser.id
    }]);

    if (error) {
        alert("Fehler beim Erstellen: " + error.message);
    } else {
        alert("Angebot erfolgreich eingestellt!");
        document.getElementById('create-item-form').reset();
        fetchItems();
    }
});

async function openModal(itemId) {
    const { data: item, error } = await supabase
        .from('marketplace_items')
        .select('*, profiles(email)')
        .eq('id', itemId)
        .single();

    if (error || !item) return;

    document.getElementById('modal-title').textContent = item.title;
    document.getElementById('modal-category').textContent = item.category || 'Hardware';
    document.getElementById('modal-condition').textContent = item.condition || 'Keine Angabe';
    document.getElementById('modal-price').textContent = `${Number(item.price).toFixed(2)} €`;
    document.getElementById('modal-description').textContent = item.description;
    
    const sellerEmail = item.profiles ? item.profiles.email : 'Unbekannt';
    document.getElementById('modal-seller').innerHTML = `Verkäufer-E-Mail: <strong>${sellerEmail}</strong>`;

    const gallery = document.getElementById('modal-gallery');
    gallery.innerHTML = '';
    
    if (item.images && item.images.length > 0) {
        item.images.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.className = 'gallery-image';
            gallery.appendChild(img);
        });
    } else {
        gallery.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">Keine Bilder vorhanden.</p>`;
    }

    document.getElementById('item-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('item-modal').style.display = 'none';
}

async function deleteItem(e, itemId) {
    e.stopPropagation(); // Verhindert das Öffnen des Modals
    if (confirm("Möchtest du dieses Angebot wirklich löschen?")) {
        const { error } = await supabase.from('marketplace_items').delete().eq('id', itemId);
        if (error) {
            alert("Fehler beim Löschen: " + error.message);
        } else {
            fetchItems();
        }
    }
}

initMarketplace();