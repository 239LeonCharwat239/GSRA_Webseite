let currentUser = null;
let isAdmin = false;

// VOLLSTÄNDIGE IRACING FAHRZEUGLISTE
const IRACING_CARS = [
    // Open Wheel / Formula
    "Dallara F3", "Dallara iR-01", "Dallara IR18 (Indycar)", "Dallara IR-05", "Formula Vee", "Ray FF1600",
    "Super Formula SF23 (Honda)", "Super Formula SF23 (Toyota)", "Formula Renault 2.0", "Formula Renault 3.5",
    "Lotus 49", "Lotus 79", "Grand Prix Legends (Williams FW31)", "McLaren MP4-30", "Skip Barber Formula 2000",
    
    // GTP / LMDh / Prototype
    "Acura ARX-06 GTP", "BMW M Hybrid V8", "Cadillac V-Series.R GTP", "Porsche 963 GTP",
    "Dallara P217 LMP2", "Ligier JS P320 LMP3", "Radical SR10", "Radical SR3 RS",
    
    // GT3
    "Audi R8 LMS EVO II GT3", "BMW M4 GT3", "Chevrolet Corvette Z06 GT3.R", "Ferrari 296 GT3",
    "Ford Mustang GT3", "Lamborghini Huracán GT3 EVO", "McLaren 720S GT3 EVO", "Mercedes-AMG GT3 2020",
    "Porsche 911 GT3 R (992)", "Porsche 911 GT3 R (991.2)", "Ford GT GT3",
    
    // GT4
    "Aston Martin Vantage GT4", "BMW M4 GT4", "McLaren 570S GT4", "Mercedes-AMG GT4", "Porsche 718 Cayman GT4 Clubsport",
    
    // Sports Cars & Challenge
    "Porsche 911 GT3 Cup (992)", "Ferrari 488 Challenge EVO", "Toyota GR86", "Global Mazda MX-5 Cup",
    "Pontiac Solstice", "Renault Clic Cup", "Ford Mustang FR500S", "Hyundai Elantra N TCR",
    "Honda Civic Type R TCR", "Audi RS 3 LMS TCR", "Subaru WRX STI TCR",
    
    // GTE / GTLM
    "BMW M8 GTE", "Chevrolet Corvette C8.R GTE", "Ferrari 488 GTE", "Porsche 911 RSR GTE", "Ford GT GTE",
    
    // NASCAR Cup Series
    "NASCAR Cup Series Chevrolet Camaro ZL1", "NASCAR Cup Series Ford Mustang Dark Horse", "NASCAR Cup Series Toyota Camry XSE",
    "NASCAR Xfinity Series Chevrolet Camaro", "NASCAR Xfinity Series Ford Mustang", "NASCAR Xfinity Series Toyota Supra",
    "NASCAR Craftsman Truck Chevrolet Silverado", "NASCAR Craftsman Truck Ford F-150", "NASCAR Craftsman Truck Toyota Tundra",
    "NASCAR Legends / Gen 4 Cup", "NASCAR 1987 Chevrolet Monte Carlo", "NASCAR 1987 Ford Thunderbird", "NASCAR 1987 Buick LeSabre",
    
    // Oval / Dirt / Rallycross
    "Super Late Model", "Late Model Stock", "ARCA Menards Series Impala", "Dirt Late Model",
    "Dirt Sprint Car", "Dirt Midget", "Subaru WRX STI RX", "Ford Fiesta RS WRC RX", "VW Beetle Lite RX"
];

const IRACING_TRACKS = [
    { track: "Acura Grand Prix of Long Beach", layout: "Grand Prix" },
    { track: "Autodromo Internazionale Enzo e Dino Ferrari (Imola)", layout: "Grand Prix" },
    { track: "Autódromo José Carlos Pace (Interlagos)", layout: "Grand Prix" },
    { track: "Autodromo Nazionale di Monza", layout: "Grand Prix" },
    { track: "Autodromo Nazionale di Monza", layout: "Junior" },
    { track: "Autodromo Nazionale di Monza", layout: "Combined" },
    { track: "Autodromo Nazionale di Monza", layout: "GP without Chicanes" },
    { track: "Brands Hatch Circuit", layout: "Grand Prix" },
    { track: "Brands Hatch Circuit", layout: "Indy" },
    { track: "Circuit de Barcelona-Catalunya", layout: "Grand Prix" },
    { track: "Circuit de Barcelona-Catalunya", layout: "National" },
    { track: "Circuit de Spa-Francorchamps", layout: "Grand Prix" },
    { track: "Circuit de Spa-Francorchamps", layout: "Endurance" },
    { track: "Circuit des 24 Heures du Mans", layout: "24 Heures" },
    { track: "Circuit Gilles Villeneuve", layout: "Grand Prix" },
    { track: "Circuit of the Americas", layout: "Grand Prix" },
    { track: "Circuit of the Americas", layout: "National" },
    { track: "Circuito de Jerez - Ángel Nieto", layout: "Grand Prix" },
    { track: "CM.com Circuit Zandvoort", layout: "Grand Prix" },
    { track: "Daytona International Speedway", layout: "Road Course" },
    { track: "Daytona International Speedway", layout: "Oval" },
    { track: "Donington Park Racing Circuit", layout: "Grand Prix" },
    { track: "Fuji International Speedway", layout: "Grand Prix" },
    { track: "Hockenheimring Baden-Württemberg", layout: "Grand Prix" },
    { track: "Hockenheimring Baden-Württemberg", layout: "National" },
    { track: "Hungaroring", layout: "Grand Prix" },
    { track: "Indianapolis Motor Speedway", layout: "Oval" },
    { track: "Indianapolis Motor Speedway", layout: "Road Course" },
    { track: "Lime Rock Park", layout: "Grand Prix" },
    { track: "Michelin Raceway Road Atlanta", layout: "Full Course" },
    { track: "Mount Panorama Motor Racing Circuit (Bathurst)", layout: "Full Course" },
    { track: "Nürburgring", layout: "Grand-Prix-Strecke (GP, BES, Sprint)" },
    { track: "Nürburgring", layout: "Nordschleife (Industriefahrten, Touristenfahrt)" },
    { track: "Nürburgring", layout: "Combined (24h, Gesamtstrecke)" },
    { track: "Okayama International Circuit", layout: "Full Course" },
    { track: "Oulton Park Circuit", layout: "International" },
    { track: "Red Bull Ring", layout: "Grand Prix" },
    { track: "Road America", layout: "Full Course" },
    { track: "Sebring International Raceway", layout: "International" },
    { track: "Silverstone Circuit", layout: "Grand Prix" },
    { track: "Suzuka International Racing Course", layout: "Grand Prix" },
    { track: "Virginia International Raceway", layout: "Full Course" },
    { track: "Watkins Glen International", layout: "Boot" },
    { track: "Watkins Glen International", layout: "Cup" }
];

// DATEN FÜR ANDERE SIMULATIONEN (Erweiterbar)
const OTHER_SIMS_DATA = {
    "ACC": {
        cars: ["BMW M4 GT3", "Ferrari 296 GT3", "Porsche 911 GT3 R (992)", "Lamborghini Huracán GT3 EVO2", "McLaren 720S GT3 EVO", "Audi R8 LMS GT3 EVO II", "Mercedes-AMG GT3 EVO", "Aston Martin V8 Vantage GT3"],
        tracks: [{ track: "Spa-Francorchamps", layout: "GP" }, { track: "Monza", layout: "GP" }, { track: "Nürburgring", layout: "GP" }, { track: "Kyalami", layout: "GP" }, { track: "Mount Panorama", layout: "GP" }, { track: "Suzuka", layout: "GP" }, { track: "Misano", layout: "GP" }]
    },
    "Assetto Corsa": {
        cars: ["Formula Hybrid 2023", "RSS GT GT1", "Porsche 911 GT3 R", "BMW M3 E30 Drift", "Mazda MX-5 Cup"],
        tracks: [{ track: "Nürburgring Nordschleife", layout: "Tourist" }, { track: "Spa-Francorchamps", layout: "GP" }, { track: "Monza", layout: "1966" }, { track: "Imola", layout: "GP" }]
    },
    "Le Mans Ultimate": {
        cars: ["Ferrari 499P", "Toyota GR010 Hybrid", "Porsche 963", "Peugeot 9X8", "Cadillac V-Series.R", "Porsche 911 RSR GTE", "Ferrari 488 GTE EVO", "Aston Martin Vantage GTE"],
        tracks: [{ track: "Circuit des 24 Heures du Mans", layout: "24h" }, { track: "Spa-Francorchamps", layout: "WEC" }, { track: "Sebring", layout: "WEC" }, { track: "Fuji", layout: "WEC" }, { track: "Portimão", layout: "WEC" }, { track: "Monza", layout: "WEC" }]
    },
    "Automobilista 2": {
        cars: ["Formula Ultimate Gen 2", "Formula USA 2023", "GT3 Gen 2", "LMDh / GTP", "Stock Car Pro Series"],
        tracks: [{ track: "Interlagos", layout: "GP" }, { track: "Cascavel", layout: "Full" }, { track: "Bathurst", layout: "GP" }, { track: "Nürburgring", layout: "24h" }]
    }
};

let currentTrackList = IRACING_TRACKS;
let currentCarList = IRACING_CARS;

function setupComboBox(inputId, dropdownId, getListFn, isTrack = false) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    function renderOptions(filterText = '') {
        dropdown.innerHTML = '';
        const search = filterText.toLowerCase();
        const dataList = getListFn();

        const filtered = dataList.filter(item => {
            if (isTrack) {
                return item.track.toLowerCase().includes(search) || item.layout.toLowerCase().includes(search);
            }
            return item.toLowerCase().includes(search);
        });

        if (filtered.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        filtered.slice(0, 12).forEach(item => {
            const opt = document.createElement('div');
            opt.className = 'combo-option';

            if (isTrack) {
                opt.innerHTML = `<span>${item.track}</span><span class="layout-tag">${item.layout}</span>`;
                opt.addEventListener('click', () => {
                    input.value = `${item.track} - ${item.layout}`;
                    dropdown.style.display = 'none';
                });
            } else {
                opt.textContent = item;
                opt.addEventListener('click', () => {
                    input.value = item;
                    dropdown.style.display = 'none';
                });
            }
            dropdown.appendChild(opt);
        });

        dropdown.style.display = 'block';
    }

    input.addEventListener('focus', () => renderOptions(input.value));
    input.addEventListener('input', () => renderOptions(input.value));

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const simSelect = document.getElementById('simSelect');
    
    function updateListsForSim(sim) {
        if (sim === 'iRacing') {
            currentTrackList = IRACING_TRACKS;
            currentCarList = IRACING_CARS;
        } else if (OTHER_SIMS_DATA[sim]) {
            currentTrackList = OTHER_SIMS_DATA[sim].tracks;
            currentCarList = OTHER_SIMS_DATA[sim].cars;
        } else {
            currentTrackList = [];
            currentCarList = [];
        }
        document.getElementById('carInput').value = '';
        document.getElementById('trackInput').value = '';
    }

    if (simSelect) {
        simSelect.addEventListener('change', (e) => {
            updateListsForSim(e.target.value);
        });
    }

    setupComboBox('trackInput', 'trackDropdown', () => currentTrackList, true);
    setupComboBox('carInput', 'carDropdown', () => currentCarList, false);

    const uploadForm = document.getElementById('setupUploadForm');
    const statusText = document.getElementById('uploadStatus');
    const searchInput = document.getElementById('searchSetup');

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

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!currentUser) {
                alert('Bitte melde dich an, um Setups hochzuladen.');
                return;
            }

            const sim = document.getElementById('simSelect').value;
            const car = document.getElementById('carInput').value.trim();
            const track = document.getElementById('trackInput').value.trim();
            const fileInput = document.getElementById('setupFile');
            const file = fileInput.files[0];

            if (!car || !track || !file) {
                alert('Bitte alle Felder ausfüllen!');
                return;
            }

            statusText.style.color = '#ffcc00';
            statusText.textContent = 'Upload läuft...';

            const filePath = `${sim.replaceAll(' ', '_')}_${car.replaceAll(' ', '_')}_${track.replaceAll(' ', '_')}_${Date.now()}.sto`;

            const { error: storageError } = await supabase.storage
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
        .select('*');

    if (error || !data) {
        list.innerHTML = '<li style="color: #ff4d4d; text-align: center; padding: 15px;">Setups konnten nicht geladen werden.</li>';
        return;
    }

    if (data.length === 0) {
        list.innerHTML = '<li style="color: var(--text-muted); text-align: center; padding: 15px;">Noch keine Setups hochgeladen.</li>';
        return;
    }

    data.sort((a, b) => ((b.likes || 0) - (b.dislikes || 0)) - ((a.likes || 0) - (a.dislikes || 0)));

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
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <button onclick="voteSetup('${item.id}', 'like', ${likes})" class="vote-btn like-btn"><i class="fa-solid fa-thumbs-up"></i> ${likes}</button>
                        <button onclick="voteSetup('${item.id}', 'dislike', ${dislikes})" class="vote-btn dislike-btn"><i class="fa-solid fa-thumbs-down"></i> ${dislikes}</button>
                    </div>
                    <a href="${item.file_url}" download class="login-btn" style="padding: 6px 12px; font-size: 12px; text-decoration: none;">Download</a>
                    ${canDelete ? `<button onclick="deleteSetup('${item.id}')" class="btn-delete"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                </div>
            </li>
        `;
    }).join('');
}

async function voteSetup(setupId, type, currentVal) {
    if (!currentUser) {
        alert("Bitte melde dich an, um abzustimmen.");
        return;
    }

    const updateField = type === 'like' ? { likes: currentVal + 1 } : { dislikes: currentVal + 1 };

    const { error } = await supabase
        .from('setups')
        .update(updateField)
        .eq('id', setupId);

    if (error) {
        alert("Fehler beim Abstimmen: " + error.message);
    } else {
        loadSetups();
    }
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