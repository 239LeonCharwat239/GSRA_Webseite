document.addEventListener('DOMContentLoaded', async () => {
    await loadMarketplaceItems();

    const form = document.getElementById('create-item-form');
    if (form) {
        form.addEventListener('submit', handleCreateItem);
    }
});

async function loadMarketplaceItems() {
    const grid = document.getElementById('marketplace-grid');
    if (!grid) return;

    const { data: items, error } = await supabaseClient
        .from('marketplace')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Supabase Fehler beim Laden:', error);
        grid.innerHTML = `<p style="color: #ff4d4d;">Fehler beim Laden der Angebote (${error.message}).</p>`;
        return;
    }

    if (!items || items.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted);">Aktuell keine Angebote verfügbar.</p>';
        return;
    }

    grid.innerHTML = '';

    items.forEach(item => {
        let imageUrl = 'https://via.placeholder.com/300x200?text=Kein+Bild';
        
        let rawImages = item.images || item.image_urls || item.image;
        if (typeof rawImages === 'string') {
            try { rawImages = JSON.parse(rawImages); } catch(e) { rawImages = [rawImages]; }
        }

        if (Array.isArray(rawImages) && rawImages.length > 0 && rawImages[0]) {
            imageUrl = rawImages[0];
        }

        const card = document.createElement('div');
        card.className = 'card marketplace-card-clickable';
        card.onclick = () => openItemModal(item);

        card.innerHTML = `
            <div style="height: 180px; overflow: hidden; border-radius: 6px; margin-bottom: 12px; background: #000;">
                <img src="${imageUrl}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <span style="font-size: 11px; background: var(--gsra-blue); color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;">${item.category || 'Hardware'}</span>
            <h3 style="margin: 8px 0 4px 0; font-size: 18px; color: #fff;">${item.title}</h3>
            <p style="color: var(--gsra-yellow); font-size: 20px; font-weight: bold; margin-bottom: 8px;">${item.price ? item.price + ' €' : 'VB'}</p>
            <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Zustand: ${item.condition || 'Gebraucht'}</p>
        `;

        grid.appendChild(card);
    });
}

async function handleCreateItem(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (!submitBtn || submitBtn.disabled) return;

    submitBtn.disabled = true;
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = 'WIRD HOCHGELADEN...';

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            alert('Bitte melde dich an, um ein Angebot zu erstellen.');
            return;
        }

        const title = document.getElementById('item-title').value;
        const category = document.getElementById('item-category').value;
        const price = parseFloat(document.getElementById('item-price').value) || 0;
        const condition = document.getElementById('item-condition').value;
        const description = document.getElementById('item-description').value;
        const fileInput = document.getElementById('item-images');
        
        const uploadedUrls = [];

        if (fileInput && fileInput.files.length > 0) {
            const files = Array.from(fileInput.files).slice(0, 10);
            for (const file of files) {
                const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${cleanFileName}`;
                
                const { data, error } = await supabaseClient
                    .storage
                    .from('marketplace-images')
                    .upload(fileName, file);

                if (error) {
                    console.error('Fehler beim Bild-Upload:', error);
                } else if (data) {
                    const { data: publicUrlData } = supabaseClient
                        .storage
                        .from('marketplace-images')
                        .getPublicUrl(fileName);
                    
                    if (publicUrlData?.publicUrl) {
                        uploadedUrls.push(publicUrlData.publicUrl);
                    }
                }
            }
        }

        const insertPayload = {
            user_id: user.id,
            title: title,
            category: category,
            price: price,
            condition: condition,
            description: description,
            images: uploadedUrls,
            seller_name: user.email ? user.email.split('@')[0] : 'Community Mitglied'
        };

        const { error: dbError } = await supabaseClient
            .from('marketplace')
            .insert([insertPayload]);

        if (dbError) {
            console.error('DB Insert Fehler:', dbError);
            alert('Fehler beim Speichern: ' + dbError.message);
        } else {
            document.getElementById('create-item-form').reset();
            await loadMarketplaceItems();
        }

    } catch (err) {
        console.error('Allgemeiner Fehler:', err);
        alert('Unerwarteter Fehler beim Erstellen.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
    }
}

function openItemModal(item) {
    const modal = document.getElementById('item-modal');
    if (!modal) return;

    document.getElementById('modal-title').innerText = item.title;
    document.getElementById('modal-category').innerText = item.category || 'Hardware';
    document.getElementById('modal-condition').innerText = item.condition || 'Gebraucht';
    document.getElementById('modal-price').innerText = item.price ? `${item.price} €` : 'VB';
    document.getElementById('modal-description').innerText = item.description || '';
    document.getElementById('modal-seller').innerText = item.seller_name || 'Verkäufer';

    const gallery = document.getElementById('modal-gallery');
    if (gallery) {
        gallery.innerHTML = '';

        let rawImages = item.images || item.image_urls || item.image;
        if (typeof rawImages === 'string') {
            try { rawImages = JSON.parse(rawImages); } catch(e) { rawImages = [rawImages]; }
        }

        if (Array.isArray(rawImages) && rawImages.length > 0) {
            rawImages.forEach(url => {
                if (url) {
                    const img = document.createElement('img');
                    img.src = url;
                    img.className = 'gallery-image';
                    img.style.maxHeight = '300px';
                    img.style.objectFit = 'contain';
                    img.style.margin = '5px';
                    img.onclick = () => window.open(url, '_blank');
                    gallery.appendChild(img);
                }
            });
        } else {
            gallery.innerHTML = '<p style="color: var(--text-muted);">Keine Bilder verfügbar.</p>';
        }
    }

    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('item-modal');
    if (modal) modal.style.display = 'none';
}