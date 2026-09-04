// dashboard-setup.js
document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('setupUploadForm');
    const statusText = document.getElementById('uploadStatus');

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const car = document.getElementById('carModel').value;
            const track = document.getElementById('trackName').value;
            const fileInput = document.getElementById('setupFile');
            const file = fileInput.files[0];

            if (!file) return;

            statusText.style.color = '#ffcc00';
            statusText.textContent = 'Upload läuft...';

            // Eindeutigen Dateinamen generieren
            const filePath = `${car.replaceAll(' ', '_')}_${track.replaceAll(' ', '_')}_${Date.now()}.sto`;

            // 1. Datei in Supabase Storage hochladen
            const { data: storageData, error: storageError } = await supabase.storage
                .from('setups')
                .upload(filePath, file);

            if (storageError) {
                statusText.style.color = '#ff4d4d';
                statusText.textContent = 'Fehler beim Upload: ' + storageError.message;
                return;
            }

            // Public URL abrufen
            const { data: urlData } = supabase.storage.from('setups').getPublicUrl(filePath);

            // 2. Metadaten in der Datenbank-Tabelle "setups" speichern
            const { error: dbError } = await supabase
                .from('setups')
                .insert([
                    { car_model: car, track_name: track, file_url: urlData.publicUrl, file_name: file.name }
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

    loadSetups();
});

// Setups aus der Datenbank laden und anzeigen
async function loadSetups() {
    const list = document.getElementById('setupList');
    if (!list) return;

    const { data, error } = await supabase
        .from('setups')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !data) {
        list.innerHTML = '<li style="color: #ff4d4d;">Setups konnten nicht geladen werden.</li>';
        return;
    }

    if (data.length === 0) {
        list.innerHTML = '<li style="color: var(--text-muted);">Noch keine Setups hochgeladen.</li>';
        return;
    }

    list.innerHTML = data.map(item => `
        <li style="padding: 12px; background: #0b0c10; margin-bottom: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-subtle);">
            <div>
                <strong style="color: var(--gsra-yellow);">${item.car_model}</strong> – <span style="color: #fff;">${item.track_name}</span>
                <br><small style="color: var(--text-muted);">${item.file_name}</small>
            </div>
            <a href="${item.file_url}" download class="login-btn" style="padding: 5px 12px; font-size: 12px;">Download .sto</a>
        </li>
    `).join('');
}