let currentUser = null;
let isAdmin = false;

// iRacing Daten-Listen
const iracingData = {
    tracks: [
        "Acura Grand Prix of Long Beach", "Atlanta Motor Speedway", "Auto Club Speedway", 
        "Autodromo Internazionale Enzo e Dino Ferrari (Imola)", "Autódromo José Carlos Pace (Interlagos)", 
        "Autodromo Nazionale di Monza", "Barber Motorsports Park", "Bark River International Raceway", 
        "Brands Hatch Circuit", "Bristol Motor Speedway", "Canadian Tire Motorsport Park (Mosport)", 
        "Cedar Lake Speedway", "Chicagoland Speedway", "Chicago Street Course", "Chili Bowl", 
        "Circuit de Barcelona-Catalunya", "Circuit de Lédenon", "Circuit de Nevers Magny-Cours", 
        "Circuit de Spa-Francorchamps", "Circuit des 24 Heures du Mans", "Circuit Gilles Villeneuve", 
        "Circuit of the Americas", "Circuito de Jerez - Ángel Nieto", "Circuito de Navarra", 
        "CM.com Circuit Zandvoort", "Circuit Zolder", "Crandon International Off-Road Raceway", 
        "Darlington Raceway", "Daytona International Speedway", "Detroit Grand Prix at Belle Isle", 
        "Donington Park Racing Circuit", "Eldora Speedway", "Fairbury Speedway", 
        "Federated Auto Parts Raceway at I-55", "Fuji International Speedway", 
        "Hockenheimring Baden-Württemberg", "Homestead-Miami Speedway", "Hungaroring", 
        "Huset's Speedway", "Indianapolis Motor Speedway", "Iowa Speedway", "iRacing Superspeedway", 
        "Irwindale Speedway & Event Center", "Kansas Speedway", "Kentucky Speedway", 
        "Kevin Harvick's Kern Raceway", "Knockhill Racing Circuit", "Kokomo Speedway", 
        "Lånkebanen (Hell RX)", "Las Vegas Motor Speedway", "Lernerville Speedway", 
        "Limaland Motorsports Park", "Lime Rock Park", "Lincoln Speedway", 
        "Lucas Oil Indianapolis Raceway Park", "Lucas Oil Speedway", "Martinsville Speedway", 
        "Michelin Raceway Road Atlanta", "Michigan International Speedway", "Mid-Ohio Sports Car Course", 
        "Millbridge Speedway", "MotorLand Aragón", "Motorsport Arena Oschersleben", 
        "Mount Panorama Motor Racing Circuit (Bathurst)", "Mount Washington Auto Road", 
        "Myrtle Beach Speedway", "Nashville Fairgrounds Speedway", "Nashville Superspeedway", 
        "New Hampshire Motor Speedway", "New Jersey Motorsports Park", "North Wilkesboro Speedway", 
        "Nürburgring (Combined / Grand-Prix-Strecke / Nordschleife)", "Okayama International Circuit", 
        "Oran Park Raceway", "Oswego Speedway", "Oulton Park Circuit", "Phillip Island Circuit", 
        "Phoenix Raceway", "Pocono Raceway", "Port Royal Speedway", "Red Bull Ring", 
        "Richmond Raceway", "Road America", "Rockingham Speedway", "Rudskogen Motorsenter", 
        "Sandown International Motor Raceway", "Sebring International Raceway", "Snetterton Circuit", 
        "Sonoma Raceway", "Southern Ohio Speedway", "Slinger Speedway", "Stafford Motor Speedway", 
        "Subida al Pikes Peak", "Talladega Superspeedway", "Texas Motor Speedway", "The Bullring", 
        "The Dirt Track at Charlotte", "The Milwaukee Mile", "Thompson Speedway Motorsports Park", 
        "Tsukuba Circuit", "Twin Ring Motegi", "USA International Speedway", "Volusia Speedway Park", 
        "Watkins Glen International", "Weedsport Speedway", "Wild Horse Pass Motorsports Park", 
        "Wild West Motorsports Park", "Williams Grove Speedway", "World Wide Technology Raceway at Gateway", 
        "Winton Motor Raceway"
    ],
    cars: [
        "1987 NASCAR Buick LeSabre", "1987 NASCAR Chevrolet Monte Carlo", "1987 NASCAR Ford Thunderbird", 
        "Acura ARX-06 GTP", "Acura NSX GT3 EVO 22", "Aston Martin DBR9 GT1", 
        "Aston Martin Vantage GT3 / GT3 EVO", "Aston Martin Vantage GT4", "Audi 90 GTO", 
        "Audi R8 LMS EVO II GT3", "Audi R18 e-tron quattro", "Audi RS 3 LMS TCR / Gen2 TCR", 
        "BMW M Hybrid V8", "BMW M2 CS Racing / M2 Racing (G87)", "BMW M4 GT3 / GT3 EVO", 
        "BMW M4 GT4", "BMW M8 GTE", "BMW Z4 GT3", "Cadillac CTS-V Racecar", "Cadillac V-Series.R GTP", 
        "Chevrolet Corvette C6.R GT1", "Chevrolet Corvette C7 Daytona Prototype", "Chevrolet Corvette C8.R GTE", 
        "Chevrolet Corvette Z06 GT3.R", "Dallara F3", "Dallara iR-01", "Dallara iR-02 / Formula iR", 
        "Dallara IR18 (IndyCar)", "Dallara P217 LMP2", "Dirt 358 Small Block Modified", 
        "Dirt Big Block Modified", "Dirt Late Model (Pro / Super)", "Dirt Midget", 
        "Dirt Outlaw Micro Sprint (Winged / Non-Winged)", "Dirt Sprint Car (410 / 360 / 305)", 
        "Dirt Street Stock", "Dirt UMP Modified", "Ferrari 296 GT3", "Ferrari 488 GT3 Evo 2020", 
        "Ferrari 488 GTE", "FIA Cross Car", "Ford Fiesta RS WRC", "Ford GT GT2 / GT3", "Ford GT GTE", 
        "Ford Mustang FR500S", "Ford Mustang GT3", "Ford Mustang Supercar", "Formula Vee", 
        "Global Mazda MX-5 Cup", "Honda Civic Type R TCR", "Honda Performance Development ARX-01c", 
        "Hyundai Elantra N TCR", "Hyundai Veloster N TCR", "Indigo / Super Late Model", "HPD ARX-01c", 
        "Kia Optima", "Lamborghini Huracán GT3 EVO", "Legends Ford '34 Coupe", "Ligier JS P320", 
        "Lotus 49", "Lotus 79", "Lucas Oil Off Road Pro 2 / Pro 2 Lite / Pro 4", "Mazda MX-5 Roadster / Cup", 
        "McLaren 570S GT4", "McLaren 720S GT3 EVO", "McLaren MP4-12C GT3", "McLaren MP4-30", 
        "Mercedes-AMG GT3 / GT3 EVO", "Mercedes-AMG GT4", "Mercedes-AMG W12 E Performance", 
        "Mercedes-AMG W13 E Performance", "Mini Stock / Mini Stock Dirt", "NASCAR ARCA Menards Series Car", 
        "NASCAR Cup Series Chevrolet Camaro ZL1", "NASCAR Cup Series Ford Mustang Dark Horse", 
        "NASCAR Cup Series Toyota Camry XSE", "NASCAR Late Model Stock Car", 
        "NASCAR Modified / Whelen Tour Modified", 
        "NASCAR Truck Series Chevrolet Silverado / Ford F-150 / Toyota Tundra", 
        "NASCAR Xfinity Series Chevrolet Camaro / Ford Mustang / Toyota Supra", "Nissan GTP ZX-T", 
        "Nissan R92CP", "Pontiac Solstice Club Sport", "Porsche 718 Cayman GT4 Clubsport", 
        "Porsche 911 GT3 Cup (991.2 & 992)", "Porsche 911 GT3 R (992)", "Porsche 911 RSR", 
        "Porsche 919 Hybrid", "Porsche 963 GTP", "Porsche Mission R", "Radical SR8 V8 / SR10", 
        "Ray FF1600 (Formula Ford)", "Renault Clio Cup", "SRX (Superstar Racing Experience)", 
        "SCCA Spec Racer Ford", "Skip Barber Formula 2000", "Stock Car Pro Series Chevrolet Cruze / Toyota Corolla", 
        "Subaru WRX STI Rallycross", "Supercars Holden ZB Commodore / Ford Mustang", "Toyota GR86", 
        "Ultra / Street Stock", "Volkswagen Beetle / Beetle Lite", "Volkswagen Jetta TDI", "Williams FW31"
    ]
};

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

    function updateDropdownsForSim(simName) {
        if (!carSelect || !trackSelect) return;

        if (simName === 'iRacing') {
            carSelect.innerHTML = iracingData.cars.map(c => `<option value="${c}">${c}</option>`).join('') + '<option value="CUSTOM">-- Manuell eingeben --</option>';
            trackSelect.innerHTML = iracingData.tracks.map(t => `<option value="${t}">${t}</option>`).join('') + '<option value="CUSTOM">-- Manuell eingeben --</option>';
            
            carCustomInput.style.display = 'none';
            trackCustomInput.style.display = 'none';
        } else {
            carSelect.innerHTML = '<option value="CUSTOM">-- Freie Eingabe --</option>';
            trackSelect.innerHTML = '<option value="CUSTOM">-- Freie Eingabe --</option>';
            
            carCustomInput.style.display = 'block';
            trackCustomInput.style.display = 'block';
        }
    }

    if (simSelect) {
        updateDropdownsForSim(simSelect.value);
        simSelect.addEventListener('change', (e) => {
            updateDropdownsForSim(e.target.value);
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
                updateDropdownsForSim(simSelect.value);
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
                    ${canDelete ? `<button onclick="deleteSetup('${item.id}')" class="btn-delete"><i class="fa-solid fa-trash-can"></i></button>` : ''}
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

loadSetups();