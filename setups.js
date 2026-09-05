let currentUser = null;
let isAdmin = false;

document.addEventListener('DOMContentLoaded', async () => {
    const uploadForm = document.getElementById('setupUploadForm');
    const statusText = document.getElementById('uploadStatus');
    const searchInput = document.getElementById('searchSetup');

    const simSelect = document.getElementById('simSelect');
    const carSelect = document.getElementById('carSelect');
    const carCustomInput = document.getElementById('carCustomInput');
    const trackSelect = document.getElementById('trackSelect');
    const trackCustomInput = document.getElementById('trackCustomInput');

    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;

    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (profile && profile.role === 'admin') {
            isAdmin = true;
        }
    }

    if (simSelect) {
        simSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Assetto Corsa') {
                carSelect.value = 'CUSTOM';
                carCustomInput.style.display = 'block';
                trackSelect.value = 'CUSTOM';
                trackCustomInput.style.display = 'block';
            } else {
                carCustomInput.style.display = carSelect.value === 'CUSTOM' ? 'block' : 'none';
                trackCustomInput.style.display = trackSelect.value === 'CUSTOM' ? 'block' : 'none';
            }
        });
    }

    if (carSelect) {
        carSelect.addEventListener('change', (e) => {
            carCustomInput.style.display = e.target.value === 'CUSTOM' ? 'block' : 'none';
        });
    }

    if (trackSelect) {
        trackSelect.addEventListener('change', (e) => {
            trackCustomInput.style.display = e.target.value === 'CUSTOM' ? 'block' : 'none';
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!currentUser) {
                alert('Bitte melde dich an, um Setups hochzuladen.');
                return;
            }

            const sim = simSelect.value;
            const car = carSelect.value === 'CUSTOM' ? carCustomInput.value.trim() : carSelect.value;
            const track = trackSelect.value === 'CUSTOM' ? trackCustomInput.value.trim() : trackSelect.value;
            const fileInput = document.getElementById('setupFile');
            const file = fileInput.files[0];

            if (!car || !track || !file) {
                alert('Bitte alle Felder ausfüllen!');
                return;
            }

            statusText.style.color = '#ffcc00';
            statusText.textContent = 'Upload läuft...';

            const filePath = `${sim.replaceAll(' ', '_')}_${car.replaceAll(' ', '_')}_${track.replaceAll(' ', '_')}_${Date.now()}.sto`;

            const { data: storageData, error: storageError } = await supabase.storage
                .from('setups')
                .upload(filePath, file);

            if (storageError) {
                statusText.style.color = '#ff4d4d';
                statusText.textContent = 'Fehler beim Upload: ' + storageError.message;
                return;
            }

            const { data: urlData } = supabase.storage.from('setups').getPublicUrl(filePath);

            const { error: dbError } = await supabase
                .from('setups')
                .insert([
                    { 
                        simulation: sim,
                        car_model: car, 
                        track_name: track, 
                        file_url: urlData.publicUrl, 
                        file_name: file.name, 
                        uploader_id: currentUser.id,
                        likes: 0,
                        dislikes: 0
                    }
                ]);

            if (dbError) {
                statusText.style.color = '#ff4d4d';
                statusText.textContent = 'Fehler beim Speichern der Daten: ' + dbError.message;
            } else {
                statusText.style.color = '#00ff88';
                statusText.textContent = 'Setup erfolgreich hochgeladen!';
                uploadForm.reset();
                carCustomInput.style.display = 'none';
                trackCustomInput.style.display = 'none';
                loadSetups();
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const items = document.querySelectorAll('#setupList li[data-search]');
            items.forEach(item => {
                const match = item.getAttribute('data-search').toLowerCase().includes(query);
                item.style.display = match ? 'flex' : 'none';
            });
        });
    }

    loadSetups();
});

async function loadSetups() {
    const list = document.getElementById('setupList');
    if (!list) return;

    const { data, error } = await supabase
        .from('setups')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !data) {
        list.innerHTML = '<li style="color: #ff4d4d; text-align: center; padding: 15px;">Setups konnten nicht geladen werden.</li>';
        return;
    }

    if (data.length === 0) {
        list.innerHTML = '<li style="color: var(--text-muted); text-align: center; padding: 15px;">Noch keine Setups hochgeladen.</li>';
        return;
    }

    list.innerHTML = data.map(item => {
        const isOwner = currentUser && currentUser.id === item.uploader_id;
        const canDelete = isOwner || isAdmin;
        const simName = item.simulation || 'iRacing';
        const likes = item.likes || 0;
        const dislikes = item.dislikes || 0;

        return `
            <li data-search="${simName} ${item.car_model} ${item.track_name} ${item.file_name}" style="padding: 12px 16px; background: rgba(0,0,0,0.3); margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-subtle);">
                <div>
                    <span style="font-size: 11px; background: var(--gsra-blue); color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;">${simName}</span>
                    <strong style="color: var(--gsra-yellow); font-size: 15px; margin-left: 6px;">${item.car_model}</strong> – <span style="color: #fff; font-size: 15px;">${item.track_name}</span>
                    <br><small style="color: var(--text-muted); font-size: 12px;">${item.file_name}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button onclick="voteSetup('${item.id}', 'like')" style="background: none; border: none; color: #00ff88; cursor: pointer;"><i class="fa-solid fa-thumbs-up"></i> ${likes}</button>
                        <button onclick="voteSetup('${item.id}', 'dislike')" style="background: none; border: none; color: #ff4d4d; cursor: pointer;"><i class="fa-solid fa-thumbs-down"></i> ${dislikes}</button>
                    </div>
                    <a href="${item.file_url}" download class="login-btn" style="padding: 6px 12px; font-size: 12px; text-decoration: none;">Download .sto</a>
                    ${canDelete ? `<button onclick="deleteSetup('${item.id}')" style="background: none; border: none; color: #ff4d4d; cursor: pointer; margin-left: 5px;"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            </li>
        `;
    }).join('');
}

async function voteSetup(setupId, type) {
    if (!currentUser) {
        alert('Bitte melde dich an, um abzustimmen.');
        return;
    }

    const { data, error } = await supabase
        .from('setups')
        .select('likes, dislikes')
        .eq('id', setupId)
        .single();

    if (error || !data) return;

    const updates = type === 'like' 
        ? { likes: (data.likes || 0) + 1 } 
        : { dislikes: (data.dislikes || 0) + 1 };

    await supabase.from('setups').update(updates).eq('id', setupId);
    loadSetups();
}

async function deleteSetup(setupId) {
    if (confirm("Möchtest du dieses Setup wirklich löschen?")) {
        const { error } = await supabase.from('setups').delete().eq('id', setupId);
        if (error) {
            alert("Fehler beim Löschen: " + error.message);
        } else {
            loadSetups();
        }
    }
}