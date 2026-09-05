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
        .select('*')
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
        card.className = 'card';
        card.style.textAlign = 'left';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';

        const isOwner = currentUser && currentUser.id === item.seller_id;
        const canDelete = isOwner || isAdmin;
        const category = item.category || 'Hardware';
        const condition = item.condition || 'Keine Angabe';

        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <span style="font-size: 11px; background: var(--gsra-blue); color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;">${category}</span>
                        <span style="font-size: 11px; background: rgba(255,255,255,0.1); color: var(--gsra-yellow); padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;">${condition}</span>
                        <h3 style="margin: 5px 0 0 0; color: #fff;">${item.title}</h3>
                    </div>
                    <span class="text-yellow" style="font-size: 1.2rem; font-weight: bold;">${Number(item.price).toFixed(2)} €</span>
                </div>
                <p style="color: var(--text-muted); font-size: 14px; margin-top: 15px; white-space: pre-line;">${item.description}</p>
            </div>
            <div style="margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: var(--text-muted);">Erstellt: ${new Date(item.created_at).toLocaleDateString('de-DE')}</span>
                ${canDelete ? `<button onclick="deleteItem('${item.id}')" class="btn-delete"><i class="fa-solid fa-trash-can"></i> Löschen</button>` : ''}
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

    const { error } = await supabase.from('marketplace_items').insert([{
        title,
        category,
        condition,
        price,
        description,
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

async function deleteItem(itemId) {
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