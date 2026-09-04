document.addEventListener('DOMContentLoaded', () => {
  fetchSetups();

  const form = document.getElementById('setup-form');
  if (form) {
    form.addEventListener('submit', handleUpload);
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => filterSetups(e.target.value));
  }
});

let allSetups = [];

// 1. Setups aus Supabase laden
async function fetchSetups() {
  const { data, error } = await supabase
    .from('setups')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fehler beim Laden der Setups:', error);
    return;
  }

  allSetups = data;
  renderSetups(allSetups);
}

// 2. Setups im Frontend rendern
function renderSetups(setups) {
  const list = document.getElementById('setups-list');
  list.innerHTML = '';

  if (setups.length === 0) {
    list.innerHTML = '<p>Keine Setups vorhanden.</p>';
    return;
  }

  setups.forEach(setup => {
    const card = document.createElement('div');
    card.className = 'card setup-card';
    card.innerHTML = `
      <h3>${escapeHtml(setup.title)}</h3>
      <p><strong>Auto:</strong> ${escapeHtml(setup.car)}</p>
      <p><strong>Strecke:</strong> ${escapeHtml(setup.track)}</p>
      <a href="${setup.file_url}" download class="btn-secondary">.sto Datei herunterladen</a>
    `;
    list.appendChild(card);
  });
}

// 3. Setup Upload verarbeiten
async function handleUpload(e) {
  e.preventDefault();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Bitte melde dich an, um Setups hochzuladen.');
    return;
  }

  const title = document.getElementById('setup-title').value;
  const car = document.getElementById('setup-car').value;
  const track = document.getElementById('setup-track').value;
  const fileInput = document.getElementById('setup-file');
  const file = fileInput.files[0];

  if (!file) return;

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `user_uploads/${fileName}`;

  // File in Supabase Storage hochladen
  const { error: uploadError } = await supabase.storage
    .from('setups')
    .upload(filePath, file);

  if (uploadError) {
    alert('Upload fehlgeschlagen: ' + uploadError.message);
    return;
  }

  // Öffentliche URL generieren
  const { data: urlData } = supabase.storage
    .from('setups')
    .getPublicUrl(filePath);

  // Eintrag in DB erstellen
  const { error: dbError } = await supabase
    .from('setups')
    .insert([{
      title,
      car,
      track,
      file_url: urlData.publicUrl,
      uploader_id: user.id
    }]);

  if (dbError) {
    alert('Datenbankfehler: ' + dbError.message);
  } else {
    alert('Setup erfolgreich hochgeladen!');
    document.getElementById('setup-form').reset();
    fetchSetups();
  }
}

// Hilfsfunktion gegen XSS
function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Filter-Funktion
function filterSetups(query) {
  const q = query.toLowerCase();
  const filtered = allSetups.filter(s => 
    s.car.toLowerCase().includes(q) || s.track.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)
  );
  renderSetups(filtered);
}