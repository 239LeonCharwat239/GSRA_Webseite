let currentUser = null;
let isAdmin = false;

const IRACING_TRACKS = [
    { track: "Acura Grand Prix of Long Beach", layout: "Grand Prix" },
    { track: "Atlanta Motor Speedway", layout: "Oval" },
    { track: "Atlanta Motor Speedway", layout: "Legends" },
    { track: "Atlanta Motor Speedway", layout: "Road Course" },
    { track: "Auto Club Speedway", layout: "Oval" },
    { track: "Auto Club Speedway", layout: "Competition" },
    { track: "Auto Club Speedway", layout: "Interior" },
    { track: "Autodromo Internazionale Enzo e Dino Ferrari (Imola)", layout: "Grand Prix" },
    { track: "Autódromo José Carlos Pace (Interlagos)", layout: "Grand Prix" },
    { track: "Autodromo Nazionale di Monza", layout: "Grand Prix" },
    { track: "Autodromo Nazionale di Monza", layout: "Junior" },
    { track: "Autodromo Nazionale di Monza", layout: "Combined" },
    { track: "Autodromo Nazionale di Monza", layout: "GP without Chicanes" },
    { track: "Barber Motorsports Park", layout: "Full Course" },
    { track: "Barber Motorsports Park", layout: "Short Course" },
    { track: "Bark River International Raceway", layout: "Full Course" },
    { track: "Brands Hatch Circuit", layout: "Grand Prix" },
    { track: "Brands Hatch Circuit", layout: "Indy" },
    { track: "Bristol Motor Speedway", layout: "Oval" },
    { track: "Bristol Motor Speedway", layout: "Dirt" },
    { track: "Canadian Tire Motorsport Park (Mosport)", layout: "Grand Prix" },
    { track: "Cedar Lake Speedway", layout: "Full Course" },
    { track: "Chicagoland Speedway", layout: "Oval" },
    { track: "Chicago Street Course", layout: "Grant Park" },
    { track: "Chili Bowl", layout: "Full Course" },
    { track: "Circuit de Barcelona-Catalunya", layout: "Grand Prix" },
    { track: "Circuit de Barcelona-Catalunya", layout: "National" },
    { track: "Circuit de Barcelona-Catalunya", layout: "Club" },
    { track: "Circuit de Barcelona-Catalunya", layout: "Historic" },
    { track: "Circuit de Barcelona-Catalunya", layout: "Rallycross" },
    { track: "Circuit de Lédenon", layout: "Full Course" },
    { track: "Circuit de Nevers Magny-Cours", layout: "Grand Prix" },
    { track: "Circuit de Spa-Francorchamps", layout: "Grand Prix" },
    { track: "Circuit de Spa-Francorchamps", layout: "Endurance" },
    { track: "Circuit de Spa-Francorchamps", layout: "Piquette" },
    { track: "Circuit des 24 Heures du Mans", layout: "24 Heures" },
    { track: "Circuit des 24 Heures du Mans", layout: "Historic" },
    { track: "Circuit Gilles Villeneuve", layout: "Grand Prix" },
    { track: "Circuit of the Americas", layout: "Grand Prix" },
    { track: "Circuit of the Americas", layout: "National" },
    { track: "Circuit of the Americas", layout: "Club" },
    { track: "Circuito de Jerez - Ángel Nieto", layout: "Grand Prix" },
    { track: "Circuito de Jerez - Ángel Nieto", layout: "Moto" },
    { track: "Circuito de Navarra", layout: "Speed Circuit" },
    { track: "Circuito de Navarra", layout: "Speed Circuit Medium" },
    { track: "Circuito de Navarra", layout: "Speed Circuit Short" },
    { track: "CM.com Circuit Zandvoort", layout: "Grand Prix" },
    { track: "CM.com Circuit Zandvoort", layout: "Chicane" },
    { track: "CM.com Circuit Zandvoort", layout: "Club" },
    { track: "CM.com Circuit Zandvoort", layout: "National" },
    { track: "Circuit Zolder", layout: "Grand Prix" },
    { track: "Circuit Zolder", layout: "Alternate" },
    { track: "Crandon International Off-Road Raceway", layout: "Full Course" },
    { track: "Crandon International Off-Road Raceway", layout: "Short Course" },
    { track: "Darlington Raceway", layout: "Oval" },
    { track: "Daytona International Speedway", layout: "Oval" },
    { track: "Daytona International Speedway", layout: "Road Course" },
    { track: "Daytona International Speedway", layout: "Moto" },
    { track: "Daytona International Speedway", layout: "NASCAR Road Course" },
    { track: "Daytona International Speedway", layout: "Rallycross" },
    { track: "Detroit Grand Prix at Belle Isle", layout: "Full Course" },
    { track: "Donington Park Racing Circuit", layout: "Grand Prix" },
    { track: "Donington Park Racing Circuit", layout: "National" },
    { track: "Eldora Speedway", layout: "Full Course" },
    { track: "Fairbury Speedway", layout: "Full Course" },
    { track: "Federated Auto Parts Raceway at I-55", layout: "Full Course" },
    { track: "Fuji International Speedway", layout: "Grand Prix" },
    { track: "Fuji International Speedway", layout: "No Chicane" },
    { track: "Hockenheimring Baden-Württemberg", layout: "Grand Prix" },
    { track: "Hockenheimring Baden-Württemberg", layout: "National" },
    { track: "Hockenheimring Baden-Württemberg", layout: "Short A" },
    { track: "Hockenheimring Baden-Württemberg", layout: "Short B" },
    { track: "Hockenheimring Baden-Württemberg", layout: "PEC" },
    { track: "Homestead-Miami Speedway", layout: "Oval" },
    { track: "Homestead-Miami Speedway", layout: "Road Course A" },
    { track: "Homestead-Miami Speedway", layout: "Road Course B" },
    { track: "Hungaroring", layout: "Grand Prix" },
    { track: "Huset's Speedway", layout: "Full Course" },
    { track: "Indianapolis Motor Speedway", layout: "Oval" },
    { track: "Indianapolis Motor Speedway", layout: "Open Wheel Road Course" },
    { track: "Indianapolis Motor Speedway", layout: "Road Course" },
    { track: "Iowa Speedway", layout: "Oval" },
    { track: "Iowa Speedway", layout: "Infield Legends" },
    { track: "Iowa Speedway", layout: "Infield Road Course" },
    { track: "iRacing Superspeedway", layout: "Oval" },
    { track: "Irwindale Speedway & Event Center", layout: "Outer" },
    { track: "Irwindale Speedway & Event Center", layout: "Inner" },
    { track: "Irwindale Speedway & Event Center", layout: "Combined" },
    { track: "Irwindale Speedway & Event Center", layout: "Figure Eight" },
    { track: "Kansas Speedway", layout: "Oval" },
    { track: "Kansas Speedway", layout: "Road Course" },
    { track: "Kentucky Speedway", layout: "Oval" },
    { track: "Kentucky Speedway", layout: "Legends" },
    { track: "Kevin Harvick's Kern Raceway", layout: "Oval" },
    { track: "Kevin Harvick's Kern Raceway", layout: "Dirt" },
    { track: "Knockhill Racing Circuit", layout: "International" },
    { track: "Knockhill Racing Circuit", layout: "Reverse" },
    { track: "Knockhill Racing Circuit", layout: "National" },
    { track: "Knockhill Racing Circuit", layout: "Rallycross" },
    { track: "Kokomo Speedway", layout: "Full Course" },
    { track: "Lånkebanen (Hell RX)", layout: "Rallycross" },
    { track: "Las Vegas Motor Speedway", layout: "Oval" },
    { track: "Las Vegas Motor Speedway", layout: "Infield Legends" },
    { track: "Las Vegas Motor Speedway", layout: "Bullring" },
    { track: "Lernerville Speedway", layout: "Full Course" },
    { track: "Limaland Motorsports Park", layout: "Full Course" },
    { track: "Lime Rock Park", layout: "Grand Prix" },
    { track: "Lime Rock Park", layout: "Chicanes" },
    { track: "Lime Rock Park", layout: "West Bend Chicane" },
    { track: "Lincoln Speedway", layout: "Full Course" },
    { track: "Lucas Oil Indianapolis Raceway Park", layout: "Oval" },
    { track: "Lucas Oil Indianapolis Raceway Park", layout: "Road Course" },
    { track: "Lucas Oil Speedway", layout: "Off-Road" },
    { track: "Martinsville Speedway", layout: "Oval" },
    { track: "Michelin Raceway Road Atlanta", layout: "Full Course" },
    { track: "Michelin Raceway Road Atlanta", layout: "Short" },
    { track: "Michelin Raceway Road Atlanta", layout: "Club" },
    { track: "Michigan International Speedway", layout: "Oval" },
    { track: "Mid-Ohio Sports Car Course", layout: "Full Course" },
    { track: "Mid-Ohio Sports Car Course", layout: "Chicane" },
    { track: "Mid-Ohio Sports Car Course", layout: "Short Course" },
    { track: "Millbridge Speedway", layout: "Full Course" },
    { track: "MotorLand Aragón", layout: "Grand Prix" },
    { track: "MotorLand Aragón", layout: "National" },
    { track: "MotorLand Aragón", layout: "West" },
    { track: "MotorLand Aragón", layout: "Outer" },
    { track: "Motorsport Arena Oschersleben", layout: "Grand Prix" },
    { track: "Motorsport Arena Oschersleben", layout: "Alternate" },
    { track: "Motorsport Arena Oschersleben", layout: "B-Course" },
    { track: "Motorsport Arena Oschersleben", layout: "C-Course" },
    { track: "Mount Panorama Motor Racing Circuit (Bathurst)", layout: "Full Course" },
    { track: "Mount Washington Auto Road", layout: "Climb to the Clouds" },
    { track: "Mount Washington Auto Road", layout: "Descent" },
    { track: "Myrtle Beach Speedway", layout: "Oval" },
    { track: "Nashville Fairgrounds Speedway", layout: "Oval" },
    { track: "Nashville Fairgrounds Speedway", layout: "1/4 Mile" },
    { track: "Nashville Superspeedway", layout: "Oval" },
    { track: "New Hampshire Motor Speedway", layout: "Oval" },
    { track: "New Hampshire Motor Speedway", layout: "Road Course" },
    { track: "New Jersey Motorsports Park", layout: "Thunderbolt" },
    { track: "North Wilkesboro Speedway", layout: "Oval" },
    { track: "Nürburgring", layout: "Grand-Prix-Strecke (GP, BES, Sprint)" },
    { track: "Nürburgring", layout: "Nordschleife (Industriefahrten, Touristenfahrt)" },
    { track: "Nürburgring", layout: "Combined (24h, Gesamtstrecke)" },
    { track: "Okayama International Circuit", layout: "Full Course" },
    { track: "Okayama International Circuit", layout: "Short" },
    { track: "Oran Park Raceway", layout: "Grand Prix" },
    { track: "Oran Park Raceway", layout: "South" },
    { track: "Oran Park Raceway", layout: "North" },
    { track: "Oswego Speedway", layout: "Oval" },
    { track: "Oulton Park Circuit", layout: "International" },
    { track: "Oulton Park Circuit", layout: "Fosters" },
    { track: "Oulton Park Circuit", layout: "Island" },
    { track: "Phillip Island Circuit", layout: "Full Course" },
    { track: "Phoenix Raceway", layout: "Oval" },
    { track: "Phoenix Raceway", layout: "Road Course" },
    { track: "Pocono Raceway", layout: "Oval" },
    { track: "Pocono Raceway", layout: "International" },
    { track: "Port Royal Speedway", layout: "Full Course" },
    { track: "Red Bull Ring", layout: "Grand Prix" },
    { track: "Red Bull Ring", layout: "National" },
    { track: "Red Bull Ring", layout: "North" },
    { track: "Richmond Raceway", layout: "Oval" },
    { track: "Road America", layout: "Full Course" },
    { track: "Road America", layout: "Bend" },
    { track: "Rockingham Speedway", layout: "Oval" },
    { track: "Rockingham Speedway", layout: "Infield Road Course" },
    { track: "Rudskogen Motorsenter", layout: "Full Course" },
    { track: "Sandown International Motor Raceway", layout: "Full Course" },
    { track: "Sebring International Raceway", layout: "International" },
    { track: "Sebring International Raceway", layout: "Club" },
    { track: "Sebring International Raceway", layout: "Modified" },
    { track: "Snetterton Circuit", layout: "300" },
    { track: "Snetterton Circuit", layout: "200" },
    { track: "Snetterton Circuit", layout: "100" },
    { track: "Sonoma Raceway", layout: "Cup" },
    { track: "Sonoma Raceway", layout: "IndyCar" },
    { track: "Sonoma Raceway", layout: "Historic" },
    { track: "Southern Ohio Speedway", layout: "Full Course" },
    { track: "Slinger Speedway", layout: "Oval" },
    { track: "Stafford Motor Speedway", layout: "Oval" },
    { track: "Subida al Pikes Peak", layout: "Full Course" },
    { track: "Talladega Superspeedway", layout: "Oval" },
    { track: "Texas Motor Speedway", layout: "Oval" },
    { track: "Texas Motor Speedway", layout: "Legends" },
    { track: "Texas Motor Speedway", layout: "Road Course" },
    { track: "The Bullring", layout: "Oval" },
    { track: "The Dirt Track at Charlotte", layout: "Full Course" },
    { track: "The Milwaukee Mile", layout: "Oval" },
    { track: "Thompson Speedway Motorsports Park", layout: "Oval" },
    { track: "Tsukuba Circuit", layout: "2000" },
    { track: "Tsukuba Circuit", layout: "1000" },
    { track: "Twin Ring Motegi", layout: "Grand Prix" },
    { track: "Twin Ring Motegi", layout: "East" },
    { track: "Twin Ring Motegi", layout: "West" },
    { track: "Twin Ring Motegi", layout: "Oval" },
    { track: "USA International Speedway", layout: "Oval" },
    { track: "Volusia Speedway Park", layout: "Full Course" },
    { track: "Watkins Glen International", layout: "Cup" },
    { track: "Watkins Glen International", layout: "Boot" },
    { track: "Watkins Glen International", layout: "Classic" },
    { track: "Weedsport Speedway", layout: "Full Course" },
    { track: "Wild Horse Pass Motorsports Park", layout: "Off-Road" },
    { track: "Wild West Motorsports Park", layout: "Off-Road" },
    { track: "Williams Grove Speedway", layout: "Full Course" },
    { track: "World Wide Technology Raceway at Gateway", layout: "Oval" },
    { track: "World Wide Technology Raceway at Gateway", layout: "Road Course" },
    { track: "Winton Motor Raceway", layout: "National" },
    { track: "Winton Motor Raceway", layout: "Club" }
];

const IRACING_CARS = [
    "Dallara F3", "GT3 EVO", "Formula Vee", "Super Formula", "Dallara iR-01",
    "Acura ARX-06 GTP", "Porsche 963 GTP", "BMW M Hybrid V8", "Dallara P217 LMP2",
    "Ferrari 296 GT3", "Porsche 911 GT3 R (992)", "BMW M4 GT3", "Audi R8 LMS EVO II GT3",
    "Mercedes-AMG GT3 EVO", "McLaren 720S GT3 EVO", "Porsche 911 GT3 Cup (992)",
    "Ray FF1600", "Global Mazda MX-5 Cup", "NASCAR Cup Series Chevrolet Camaro"
];

function setupComboBox(inputId, dropdownId, dataList, isTrack = false) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    function renderOptions(filterText = '') {
        dropdown.innerHTML = '';
        const search = filterText.toLowerCase();

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

        filtered.slice(0, 10).forEach(item => {
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
    setupComboBox('trackInput', 'trackDropdown', IRACING_TRACKS, true);
    setupComboBox('carInput', 'carDropdown', IRACING_CARS, false);

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

    // Sortierung nach Score (Likes minus Dislikes)
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