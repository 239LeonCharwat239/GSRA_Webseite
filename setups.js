document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('setupUploadForm');
    const statusText = document.getElementById('uploadStatus');
    const searchInput = document.getElementById('searchSetup');

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('Bitte melde dich an, um Setups hochzuladen.');
                return;
            }

            const car = document.getElementById('carModel').value;
            const track = document.getElementById('trackName').value;
            const fileInput = document.getElementById('setupFile');
            const file = fileInput.files[0];

            if (!file) return;

            statusText.style.color = '#ffcc00';
            statusText.textContent = 'Upload läuft...';

            const filePath = `${car.replaceAll(' ', '_')}_${track.replaceAll(' ', '_')}_${Date.now()}.sto`;

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
                    { car_model: car, track_name: track, file_url: urlData.publicUrl, file_name: file.name, uploader_id: user.id }
                ]);

            if (dbError) {
                statusText.style.color = '#ff4d4d';
                statusText.textContent = 'Fehler beim Speichern der Daten: ' + dbError.message;
            } else {
                statusText.style.color = '#00ff88';
                statusText.textContent = 'Setup erfolgreich hochgeladen!';
                uploadForm.reset();
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

    list.innerHTML = data.map(item => `
        <li data-search="${item.car_model} ${item.track_name} ${item.file_name}" style="padding: 12px 16px; background: rgba(0,0,0,0.3); margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-subtle);">
            <div>
                <strong style="color: var(--gsra-yellow); font-size: 15px;">${item.car_model}</strong> – <span style="color: #fff; font-size: 15px;">${item.track_name}</span>
                <br><small style="color: var(--text-muted); font-size: 12px;">${item.file_name}</small>
            </div>
            <a href="${item.file_url}" download class="login-btn" style="padding: 6px 12px; font-size: 12px; text-decoration: none;">Download .sto</a>
        </li>
    `).join('');
}