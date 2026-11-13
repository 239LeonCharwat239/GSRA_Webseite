/* =========================================
   GSRA - Setup Hub (Setups teilen, bewerten, Pro Setups für Abonnenten)
========================================= */
let currentUser = null;
let isAdmin = false;
let loadedSetups = [];
let myVotes = {};

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Download nur über echte https-Links
function safeDownloadUrl(url) {
    try {
        const parsed = new URL(String(url || ""));
        return parsed.protocol === "https:" ? parsed.href : null;
    } catch (e) {
        return null;
    }
}

// Dateinamen im Speicher nur aus einfachen Zeichen (Umlaute und Sonderzeichen werden ersetzt)
function storageName(text) {
    return String(text || "")
        .normalize("NFKD").replace(/\p{M}/gu, "")
        .replace(/[^A-Za-z0-9.-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60) || "setup";
}

// VOLLSTÄNDIGE IRACING FAHRZEUGLISTE (ALPHABETISCH)
const IRACING_CARS = [
    "1987 NASCAR Buick LeSabre", "1987 NASCAR Chevrolet Monte Carlo", "1987 NASCAR Ford Thunderbird", 
    "Acura ARX-06 GTP", "Acura NSX GT3 EVO 22", "Aston Martin DBR9 GT1", "Aston Martin Vantage GT3 / GT3 EVO", 
    "Aston Martin Vantage GT4", "Audi 90 GTO", "Audi R8 LMS EVO II GT3", "Audi R18 e-tron quattro", 
    "Audi RS 3 LMS TCR / Gen2 TCR", "BMW M Hybrid V8", "BMW M2 CS Racing / M2 Racing (G87)", 
    "BMW M4 GT3 / GT3 EVO", "BMW M4 GT4", "BMW M8 GTE", "BMW Z4 GT3", "Cadillac CTS-V Racecar", 
    "Cadillac V-Series.R GTP", "Chevrolet Corvette C6.R GT1", "Chevrolet Corvette C7 Daytona Prototype", 
    "Chevrolet Corvette C8.R GTE", "Chevrolet Corvette Z06 GT3.R", "Dallara F3", "Dallara iR-01", 
    "Dallara iR-02 / Formula iR", "Dallara IR18 (IndyCar)", "Dallara P217 LMP2", "Dirt 358 Small Block Modified", 
    "Dirt Big Block Modified", "Dirt Late Model (Pro / Super)", "Dirt Midget", 
    "Dirt Outlaw Micro Sprint (Winged / Non-Winged)", "Dirt Sprint Car (410 / 360 / 305)", "Dirt Street Stock", 
    "Dirt UMP Modified", "Ferrari 296 GT3", "Ferrari 488 GT3 Evo 2020", "Ferrari 488 GTE", "FIA Cross Car", 
    "Ford Fiesta RS WRC", "Ford GT GT2 / GT3", "Ford GT GTE", "Ford Mustang FR500S", "Ford Mustang GT3", 
    "Ford Mustang Supercar", "Formula Vee", "Global Mazda MX-5 Cup", "Honda Civic Type R TCR", 
    "Honda Performance Development ARX-01c", "Hyundai Elantra N TCR", "Hyundai Veloster N TCR", 
    "Indigo / Super Late Model", "HPD ARX-01c", "Kia Optima", "Lamborghini Huracán GT3 EVO", 
    "Legends Ford '34 Coupe", "Ligier JS P320", "Lotus 49", "Lotus 79", 
    "Lucas Oil Off Road Pro 2 / Pro 2 Lite / Pro 4", "Mazda MX-5 Roadster / Cup", "McLaren 570S GT4", 
    "McLaren 720S GT3 EVO", "McLaren MP4-12C GT3", "McLaren MP4-30", "Mercedes-AMG GT3 / GT3 EVO", 
    "Mercedes-AMG GT4", "Mercedes-AMG W12 E Performance", "Mercedes-AMG W13 E Performance", 
    "Mini Stock / Mini Stock Dirt", "NASCAR ARCA Menards Series Car", "NASCAR Cup Series Chevrolet Camaro ZL1", 
    "NASCAR Cup Series Ford Mustang Dark Horse", "NASCAR Cup Series Toyota Camry XSE", 
    "NASCAR Late Model Stock Car", "NASCAR Modified / Whelen Tour Modified", 
    "NASCAR Truck Series Chevrolet Silverado / Ford F-150 / Toyota Tundra", 
    "NASCAR Xfinity Series Chevrolet Camaro / Ford Mustang / Toyota Supra", "Nissan GTP ZX-T", "Nissan R92CP", 
    "Pontiac Solstice Club Sport", "Porsche 718 Cayman GT4 Clubsport", "Porsche 911 GT3 Cup (991.2 & 992)", 
    "Porsche 911 GT3 R (992)", "Porsche 911 RSR", "Porsche 919 Hybrid", "Porsche 963 GTP", "Porsche Mission R", 
    "Radical SR8 V8 / SR10", "Ray FF1600 (Formula Ford)", "Renault Clio Cup", 
    "SRX (Superstar Racing Experience)", "SCCA Spec Racer Ford", "Skip Barber Formula 2000", 
    "Stock Car Pro Series Chevrolet Cruze / Toyota Corolla", "Subaru WRX STI Rallycross", 
    "Supercars Holden ZB Commodore / Ford Mustang", "Toyota GR86", "Ultra / Street Stock", 
    "Volkswagen Beetle / Beetle Lite", "Volkswagen Jetta TDI", "Williams FW31"
];

// VOLLSTÄNDIGE IRACING STRECKENLISTE MIT OFFIZIELLEN LAYOUTS
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

// DATEN FÜR ANDERE SIMULATIONEN
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
            opt.className = 'combo-option select-option-item';

            if (isTrack) {
                opt.innerHTML = `<span>${item.track}</span><span class="select-option-layout">${item.layout}</span>`;
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

// ==========================================================================
// SETUP HUB: Simulationen, Formate, Pro Setups
// ==========================================================================

// Simulationen mit erlaubter Dateiendung ('' = keine Datei: Werte eintragen oder Screenshots hochladen).
// Die Schlüssel stimmen mit der Datenbank (setup_allowed_ext) überein – dort wird ebenfalls geprüft.
const SIMS = [
    { key: "iRacing", label: "iRacing", ext: "sto" },
    { key: "ACC", label: "Assetto Corsa Competizione", ext: "json" },
    { key: "Assetto Corsa", label: "Assetto Corsa", ext: "ini" },
    { key: "Assetto Corsa EVO", label: "Assetto Corsa EVO", ext: "ini" },
    { key: "Le Mans Ultimate", label: "Le Mans Ultimate", ext: "svm" },
    { key: "rFactor 2", label: "rFactor 2", ext: "svm" },
    { key: "Automobilista 2", label: "Automobilista 2", ext: "svm" },
    { key: "RaceRoom", label: "RaceRoom Racing Experience", ext: "usr" },
    { key: "Rennsport", label: "Rennsport", ext: "json" },
    { key: "BeamNG.drive", label: "BeamNG.drive", ext: "pc" },
    { key: "Richard Burns Rally", label: "Richard Burns Rally (RSF)", ext: "ini" },
    { key: "F1 26", label: "F1 26", ext: "" },
    { key: "F1 25", label: "F1 25", ext: "" },
    { key: "F1 24", label: "F1 24", ext: "" },
    { key: "F1 23", label: "F1 23", ext: "" },
    { key: "EA SPORTS WRC", label: "EA SPORTS WRC", ext: "" },
    { key: "DiRT Rally 2.0", label: "DiRT Rally 2.0", ext: "" }
];
const simOf = (key) => SIMS.find(s => s.key === key) || null;
const simLabel = (key) => simOf(key)?.label || key || "iRacing";
const SETUP_TYPES = ["Allround", "Qualifying", "Rennen", "Nass"];
const IMAGE_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_SCREENSHOTS = 5;

let hubFilter = { sim: "all", kind: "all", sort: "best", search: "" };
let canSeePro = false;
let isProCreator = false;
let hubReady = true;            // false, solange das SQL „Setup Hub“ fehlt (dann wie bisher, ohne Pro und ohne Werte)
let uploaderNames = {};

document.addEventListener('DOMContentLoaded', async () => {
    const simSelect = document.getElementById('simSelect');
    simSelect.innerHTML = SIMS.map(s => `<option value="${escapeHtml(s.key)}">${escapeHtml(s.label)}</option>`).join('');
    document.getElementById('setupTypeSelect').innerHTML = SETUP_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');

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
        updateFormatFields(sim);
    }
    simSelect.addEventListener('change', (e) => updateListsForSim(e.target.value));
    setupComboBox('trackInput', 'trackDropdown', () => currentTrackList, true);
    setupComboBox('carInput', 'carDropdown', () => currentCarList, false);
    updateFormatFields(simSelect.value);

    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    if (user) {
        const [{ data: profile }, plan, creator] = await Promise.all([
            supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
            supabase.rpc('plan_of', { _user: user.id }),
            supabase.rpc('is_pro_creator', { _user: user.id })
        ]);
        isAdmin = profile?.role === 'admin';
        isProCreator = !creator.error && creator.data === true;
        hubReady = !creator.error;
        canSeePro = isAdmin || isProCreator || ['pole', 'alliance'].includes(plan.data);
    }
    // Pro Setups veröffentlichen nur eingetragene Pro-Fahrer (Streamer, E-Sportler …) – auch Admins nicht
    document.getElementById('proOption').hidden = !(hubReady && isProCreator);
    document.getElementById('proTeaser').hidden = canSeePro || !hubReady;

    renderSimChips();
    bindHubControls();
    bindUpload();
    loadSetups();
});

// Format-Hinweis und Felder je Simulation: Datei mit passender Endung oder Werte + Screenshots
function updateFormatFields(simKey) {
    const sim = simOf(simKey);
    const hasFile = Boolean(sim?.ext);
    const fileInput = document.getElementById('setupFile');
    document.getElementById('fileField').hidden = !hasFile;
    document.getElementById('manualField').hidden = hasFile;
    fileInput.accept = hasFile ? `.${sim.ext}` : '';
    fileInput.value = '';
    document.getElementById('formatHint').innerHTML = hasFile
        ? `<i class="fa-solid fa-file-circle-check"></i> Für ${escapeHtml(sim.label)} ist nur das Format <strong>.${sim.ext}</strong> erlaubt.`
        : `<i class="fa-solid fa-pen-to-square"></i> ${escapeHtml(sim?.label || simKey)} hat keinen Setup-Export: Trage die Werte ein und/oder lade Screenshots der Einstellungen hoch.`;
}

// Schnellauswahl der Simulationen
function renderSimChips() {
    const box = document.getElementById('simChips');
    const chips = [{ key: 'all', label: 'Alle' }, ...SIMS.map(s => ({ key: s.key, label: s.key }))];
    box.innerHTML = chips.map(c => `<button type="button" class="sh-chip${hubFilter.sim === c.key ? ' active' : ''}" data-sim="${escapeHtml(c.key)}">${escapeHtml(c.label)}</button>`).join('');
}

function bindHubControls() {
    document.getElementById('simChips').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-sim]');
        if (!chip) return;
        hubFilter.sim = chip.dataset.sim;
        renderSimChips();
        renderSetups();
    });
    document.querySelectorAll('[data-kind]').forEach(btn => btn.addEventListener('click', () => {
        hubFilter.kind = btn.dataset.kind;
        document.querySelectorAll('[data-kind]').forEach(b => b.classList.toggle('active', b === btn));
        renderSetups();
    }));
    document.getElementById('sortSetups').addEventListener('change', (e) => { hubFilter.sort = e.target.value; renderSetups(); });
    let timer = null;
    document.getElementById('searchSetup').addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => { hubFilter.search = e.target.value.trim().toLowerCase(); renderSetups(); }, 200);
    });
    document.getElementById('openUploadBtn').addEventListener('click', () => {
        if (!currentUser) return showToast('Bitte melde dich an, um Setups hochzuladen.', 'error');
        document.getElementById('uploadModal').style.display = 'flex';
    });
    document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.closeModal).style.display = 'none';
    }));
    window.addEventListener('click', (e) => {
        if (e.target.classList?.contains('modal-overlay')) e.target.style.display = 'none';
    });

    // Aktionen in der Liste: abstimmen, herunterladen, Werte ansehen, löschen
    document.getElementById('setupList').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const setup = loadedSetups.find(s => String(s.id) === btn.dataset.id);
        if (!setup) return;
        if (btn.dataset.action === 'like' || btn.dataset.action === 'dislike') { if (!btn.disabled) voteSetup(setup.id, btn.dataset.action); }
        else if (btn.dataset.action === 'pro-download') downloadProFile(setup, btn);
        else if (btn.dataset.action === 'details') openSetupDetails(setup);
        else if (btn.dataset.action === 'delete') deleteSetup(setup);
    });
}

// Alle Setups in Blöcken zu je 1000 laden (Supabase liefert höchstens 1000 Zeilen pro Abfrage)
async function fetchAllSetups() {
    const all = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('setups').select('*').order('created_at', { ascending: false }).range(from, from + 999);
        if (error) return { data: null, error };
        all.push(...(data || []));
        if (!data || data.length < 1000) return { data: all, error: null };
    }
}

// Seitenweise anzeigen: erst 24 Karten, dann jeweils 24 weitere
const SETUP_PAGE = 24;
let shownSetups = SETUP_PAGE;

async function loadSetups() {
    const list = document.getElementById('setupList');
    if (!list) return;
    const [{ data, error }] = await Promise.all([fetchAllSetups(), loadMyVotes()]);
    if (error || !data) {
        list.innerHTML = '<p class="sh-empty">Setups konnten nicht geladen werden.</p>';
        return;
    }
    loadedSetups = data;
    const ids = [...new Set(data.map(s => s.uploader_id).filter(Boolean))];
    if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', ids);
        uploaderNames = Object.fromEntries((profiles || []).map(p => [p.id, p.username]));
    }
    renderSetups(false);
}

// resetPaging: bei neuem Filter, neuer Suche oder Sortierung wieder oben mit 24 Karten beginnen
function renderSetups(resetPaging = true) {
    if (resetPaging) shownSetups = SETUP_PAGE;
    const list = document.getElementById('setupList');
    const score = (s) => (Number(s.likes) || 0) - (Number(s.dislikes) || 0);
    let items = loadedSetups.filter(s => {
        if (hubFilter.sim !== 'all' && (s.simulation || 'iRacing') !== hubFilter.sim) return false;
        if (hubFilter.kind === 'pro' && !s.is_pro) return false;
        if (hubFilter.kind === 'community' && s.is_pro) return false;
        if (!hubFilter.search) return true;
        return `${simLabel(s.simulation)} ${s.car_model} ${s.track_name} ${s.file_name} ${s.setup_type} ${s.description} ${uploaderNames[s.uploader_id] || ''}`.toLowerCase().includes(hubFilter.search);
    });
    items.sort(hubFilter.sort === 'new'
        ? (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        : (a, b) => (Number(b.is_pro) - Number(a.is_pro)) || score(b) - score(a));
    document.getElementById('setupCount').textContent = `${items.length} ${items.length === 1 ? 'Setup' : 'Setups'}`;
    if (!items.length) {
        list.innerHTML = `<div class="sh-empty"><i class="fa-solid fa-sliders"></i><strong>Keine passenden Setups</strong><span>${loadedSetups.length ? 'Probiere eine andere Simulation oder Suche.' : 'Sei der Erste und teile dein Setup mit der Community.'}</span></div>`;
        return;
    }
    const rest = items.length - shownSetups;
    list.innerHTML = items.slice(0, shownSetups).map(renderSetupCard).join('')
        + (rest > 0 ? `<div class="sh-more-wrap"><button type="button" class="sh-btn sh-more" id="setupMore"><i class="fa-solid fa-angles-down"></i> Weitere Setups anzeigen (${rest})</button></div>` : '');
    document.getElementById('setupMore')?.addEventListener('click', () => {
        shownSetups += SETUP_PAGE;
        renderSetups(false);
    });
}

function renderSetupCard(item) {
    const isOwner = currentUser && currentUser.id === item.uploader_id;
    const locked = item.is_pro && !canSeePro && !isOwner;
    const sim = simOf(item.simulation);
    const manual = sim ? !sim.ext : !item.file_url && !item.is_pro;
    const likes = Number(item.likes) || 0;
    const dislikes = Number(item.dislikes) || 0;
    const id = escapeHtml(item.id);
    const myVote = myVotes[item.id] || 0;
    const voteAttrs = (vote) => isOwner ? ' disabled title="Eigene Setups kannst du nicht bewerten."'
        : locked ? ' disabled title="Pro Setups bewerten nur Abonnenten."'
        : myVote === vote ? ' title="Deine Stimme – nochmal klicken zum Zurücknehmen"' : '';
    const downloadUrl = safeDownloadUrl(item.file_url);
    const date = item.created_at ? new Date(item.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const uploader = uploaderNames[item.uploader_id] || 'GSRA-Mitglied';

    let action;
    if (locked) action = `<a href="abo.html" class="sh-btn locked"><i class="fa-solid fa-lock"></i> Mit Pole freischalten</a>`;
    else if (manual) action = `<button type="button" class="sh-btn" data-action="details" data-id="${id}"><i class="fa-solid fa-list-check"></i> Werte ansehen</button>`;
    else if (item.is_pro) action = `<button type="button" class="sh-btn" data-action="pro-download" data-id="${id}"><i class="fa-solid fa-download"></i> Download</button>`;
    else if (downloadUrl) action = `<a href="${escapeHtml(downloadUrl)}" download class="sh-btn"><i class="fa-solid fa-download"></i> Download</a>`;
    else action = `<span class="sh-btn disabled" title="Kein sicherer Download-Link">Download</span>`;

    return `
        <article class="sh-card${item.is_pro ? ' pro' : ''}${locked ? ' locked' : ''}">
            <div class="sh-card-tags">
                <span class="sh-sim">${escapeHtml(simLabel(item.simulation))}</span>
                ${item.setup_type ? `<span class="sh-type">${escapeHtml(item.setup_type)}</span>` : ''}
                ${item.is_pro ? '<span class="sh-pro"><i class="fa-solid fa-crown"></i> Pro</span>' : ''}
                ${manual ? '<span class="sh-type"><i class="fa-solid fa-pen"></i> Werte</span>' : ''}
            </div>
            <h3 class="sh-car">${escapeHtml(item.car_model)}</h3>
            <div class="sh-track"><i class="fa-solid fa-route"></i> ${escapeHtml(item.track_name)}</div>
            ${item.description ? `<p class="sh-desc">${escapeHtml(item.description)}</p>` : ''}
            <div class="sh-meta"><i class="fa-solid fa-user"></i> ${escapeHtml(uploader)}${date ? ` · ${date}` : ''}${!manual && item.file_name && !locked ? ` · <span title="${escapeHtml(item.file_name)}">${escapeHtml(item.file_name)}</span>` : ''}</div>
            <div class="sh-actions">
                <div class="sh-votes">
                    <button data-action="like" data-id="${id}" class="vote-btn like-btn${myVote === 1 ? ' voted' : ''}"${voteAttrs(1)}><i class="fa-solid fa-thumbs-up"></i> ${likes}</button>
                    <button data-action="dislike" data-id="${id}" class="vote-btn dislike-btn${myVote === -1 ? ' voted' : ''}"${voteAttrs(-1)}><i class="fa-solid fa-thumbs-down"></i> ${dislikes}</button>
                </div>
                ${action}
                ${isOwner || isAdmin ? `<button type="button" data-action="delete" data-id="${id}" class="btn-delete" title="Setup löschen"><i class="fa-solid fa-trash-can"></i></button>` : ''}
            </div>
        </article>`;
}

// Inhalte (Werte, Screenshots, Pfad der Pro-Datei) – bei Pro Setups gibt die Datenbank sie nur Berechtigten heraus
async function loadContents(setup) {
    const { data, error } = await supabase.from('setup_contents').select('*').eq('setup_id', setup.id).maybeSingle();
    if (error) return null;
    return data;
}

async function fileUrl(setup, path) {
    if (setup.is_pro) {
        const { data } = await supabase.storage.from('setups-pro').createSignedUrl(path, 300);
        return data?.signedUrl || null;
    }
    return supabase.storage.from('setups').getPublicUrl(path).data.publicUrl;
}

async function downloadProFile(setup, btn) {
    btn.disabled = true;
    const contents = await loadContents(setup);
    let url = null;
    if (contents?.pro_file_path) {
        const { data } = await supabase.storage.from('setups-pro').createSignedUrl(contents.pro_file_path, 60, { download: setup.file_name || true });
        url = data?.signedUrl || null;
    }
    btn.disabled = false;
    if (!url) return showToast('Die Datei ist gerade nicht verfügbar.', 'error');
    window.location.href = url;
}

async function openSetupDetails(setup) {
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailBody');
    document.getElementById('detailTitle').textContent = `${setup.car_model} – ${setup.track_name}`;
    document.getElementById('detailSub').textContent = [simLabel(setup.simulation), setup.setup_type, uploaderNames[setup.uploader_id]].filter(Boolean).join(' · ');
    body.innerHTML = '<p class="sh-empty">Lade …</p>';
    modal.style.display = 'flex';
    const contents = await loadContents(setup);
    if (!contents || (!contents.manual_values && !(contents.screenshots || []).length)) {
        body.innerHTML = '<p class="sh-empty">Zu diesem Setup gibt es keine Werte.</p>';
        return;
    }
    body.innerHTML = `
        ${setup.description ? `<p class="sh-detail-desc"></p>` : ''}
        ${contents.manual_values ? '<h4><i class="fa-solid fa-list-check"></i> Werte</h4><pre class="sh-values"></pre>' : ''}
        ${(contents.screenshots || []).length ? '<h4><i class="fa-solid fa-image"></i> Screenshots</h4><div class="sh-shots"></div>' : ''}`;
    if (setup.description) body.querySelector('.sh-detail-desc').textContent = setup.description;
    if (contents.manual_values) body.querySelector('.sh-values').textContent = contents.manual_values;
    const shots = body.querySelector('.sh-shots');
    for (const path of contents.screenshots || []) {
        const url = await fileUrl(setup, path);
        if (!url || !/^https?:|^#/.test(url)) continue;
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.innerHTML = '<img alt="Screenshot der Einstellungen" loading="lazy">';
        a.querySelector('img').src = url;
        shots.appendChild(a);
    }
}

// Hochladen: Datei mit passender Endung oder Werte/Screenshots; Pro Setups im privaten Speicher
function bindUpload() {
    const form = document.getElementById('setupUploadForm');
    const statusText = document.getElementById('uploadStatus');
    const submit = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return showToast('Bitte melde dich an, um Setups hochzuladen.', 'error');
        const simKey = document.getElementById('simSelect').value;
        const sim = simOf(simKey);
        const car = document.getElementById('carInput').value.trim();
        const track = document.getElementById('trackInput').value.trim();
        const setupType = document.getElementById('setupTypeSelect').value;
        const description = document.getElementById('setupDescription').value.trim();
        const isPro = !document.getElementById('proOption').hidden && document.getElementById('proCheck').checked;
        const file = document.getElementById('setupFile').files[0];
        const values = document.getElementById('manualValues').value.trim();
        const shots = Array.from(document.getElementById('screenshotFiles').files || []);

        if (!car || !track) return showToast('Bitte Fahrzeug und Strecke angeben.', 'error');
        if (sim.ext) {
            if (!file) return showToast(`Bitte wähle die .${sim.ext}-Datei aus.`, 'error');
            if (!file.name.toLowerCase().endsWith(`.${sim.ext}`)) return showToast(`Für ${sim.label} sind nur .${sim.ext}-Dateien erlaubt.`, 'error');
            if (file.size > 5 * 1024 * 1024) return showToast('Die Setup-Datei ist zu groß (höchstens 5 MB).', 'error');
        } else {
            if (!values && !shots.length) return showToast('Bitte trage die Werte ein oder lade mindestens einen Screenshot hoch.', 'error');
            if (shots.length > MAX_SCREENSHOTS) return showToast(`Höchstens ${MAX_SCREENSHOTS} Screenshots.`, 'error');
            const bad = shots.find(f => !IMAGE_EXT[f.type] || f.size > 5 * 1024 * 1024);
            if (bad) return showToast(`„${bad.name}“ passt nicht: erlaubt sind JPG, PNG oder WebP bis 5 MB.`, 'error');
        }

        submit.disabled = true;
        statusText.style.color = '#ffcc00';
        statusText.textContent = 'Upload läuft …';
        const bucket = isPro ? 'setups-pro' : 'setups';
        const base = `${currentUser.id}/${storageName(simKey)}_${storageName(car)}_${storageName(track)}_${Date.now()}`;
        const fail = (message) => {
            statusText.style.color = '#ff4d4d';
            statusText.textContent = message;
            submit.disabled = false;
        };
        try {
            const row = { simulation: simKey, car_model: car, track_name: track, uploader_id: currentUser.id, likes: 0, dislikes: 0 };
            if (hubReady) Object.assign(row, { setup_type: setupType, description: description || null, is_pro: isPro });
            let filePath = null;
            if (sim.ext) {
                filePath = `${base}.${sim.ext}`;
                const { error: storageError } = await supabase.storage.from(bucket).upload(filePath, file);
                if (storageError) return fail('Fehler beim Upload: ' + storageError.message);
                row.file_name = file.name;
                if (!isPro) row.file_url = supabase.storage.from('setups').getPublicUrl(filePath).data.publicUrl;
            }
            const { data: inserted, error: dbError } = await supabase.from('setups').insert([row]).select('id');
            if (dbError) {
                if (filePath) supabase.storage.from(bucket).remove([filePath]);
                return fail('Fehler beim Speichern: ' + dbError.message);
            }
            const setupId = inserted?.[0]?.id;
            // Werte, Screenshots bzw. Pfad der Pro-Datei
            if (hubReady && setupId && (values || shots.length || (isPro && filePath))) {
                const paths = [];
                for (const [i, shot] of shots.entries()) {
                    const path = `${base}_bild${i + 1}.${IMAGE_EXT[shot.type]}`;
                    const { error } = await supabase.storage.from(bucket).upload(path, shot);
                    if (!error) paths.push(path);
                }
                const { error: contentError } = await supabase.from('setup_contents').insert([{
                    setup_id: setupId, manual_values: values || null, screenshots: paths, pro_file_path: isPro ? filePath : null
                }]);
                if (contentError) return fail('Setup gespeichert, aber die Inhalte fehlen: ' + contentError.message);
            }
            statusText.style.color = '#00ff88';
            statusText.textContent = isPro ? 'Pro Setup veröffentlicht!' : 'Setup erfolgreich hochgeladen!';
            showToast(isPro ? 'Pro Setup veröffentlicht.' : 'Setup veröffentlicht – danke fürs Teilen!', 'success');
            form.reset();
            updateFormatFields(document.getElementById('simSelect').value);
            submit.disabled = false;
            setTimeout(() => { document.getElementById('uploadModal').style.display = 'none'; statusText.textContent = ''; }, 900);
            loadSetups();
        } catch (err) {
            fail('Unerwarteter Fehler: ' + err.message);
        }
    });
    // Formular zurücksetzen setzt auch die Simulation zurück
    form.addEventListener('reset', () => setTimeout(() => updateFormatFields(document.getElementById('simSelect').value), 0));
}

// Eigene Stimmen laden (jede Person sieht nur ihre eigenen)
async function loadMyVotes() {
    myVotes = {};
    if (!currentUser) return;
    const { data, error } = await supabase.from('setup_votes').select('setup_id, vote').eq('user_id', currentUser.id);
    if (error || !data) return;
    data.forEach(v => { myVotes[v.setup_id] = v.vote; });
}

async function voteSetup(setupId, type) {
    if (!currentUser) return showToast("Bitte melde dich an, um abstimmen zu können.", "error");
    // Eine Stimme pro Person: dieselbe Stimme nochmal nimmt sie zurück, die andere wechselt sie
    const wanted = type === 'like' ? 1 : -1;
    const nextVote = myVotes[setupId] === wanted ? 0 : wanted;
    const { error } = await supabase.rpc('vote_setup', { _setup_id: String(setupId), _vote: nextVote });
    if (error) showToast("Fehler beim Abstimmen: " + error.message, "error");
    else loadSetups();
}

async function deleteSetup(setup) {
    const confirmed = await showDialog({
        icon: "fa-trash",
        title: "Setup löschen?",
        message: "Möchtest du dieses Setup wirklich löschen? Datei und Screenshots werden ebenfalls entfernt.",
        confirmText: "Löschen",
        cancelText: "Abbrechen",
        danger: true
    });
    if (!confirmed) return;
    const contents = hubReady ? await loadContents(setup) : null;
    const { error } = await supabase.from('setups').delete().eq('id', setup.id);
    if (error) return showToast("Fehler beim Löschen: " + error.message, "error");
    // Dateien aufräumen (nur eigene; Fehler hier sind nicht schlimm)
    const publicPath = String(setup.file_url || '').split('/object/public/setups/')[1];
    const bucket = setup.is_pro ? 'setups-pro' : 'setups';
    const paths = [...(contents?.screenshots || []), contents?.pro_file_path, setup.is_pro ? null : publicPath].filter(Boolean).map(decodeURIComponent);
    if (paths.length) supabase.storage.from(bucket).remove(paths).then(() => {}, () => {});
    showToast("Setup gelöscht.", "success");
    loadSetups();
}
