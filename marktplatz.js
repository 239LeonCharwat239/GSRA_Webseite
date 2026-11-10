/* =========================================
   GSRA - Marketplace Logik & Orts-Suche
========================================= */

let currentUser = null;
let isSiteAdmin = false;
let allItems = [];
let isEditMode = false;
let currentEditItemId = null;
let existingImagesUrls = [];
let totalItems = 0;
let legacyMarketplace = false; // Datenbank noch ohne die neuen Spalten (SQL nicht ausgeführt)
const PAGE_SIZE = 24;

// Kategorien mit Unterkategorien. „spec“ = technische Angabe, die bei den genannten Unterkategorien abgefragt wird.
// Die Schlüssel der alten Kategorien (Wheelbases, Pedale, Rigs, Monitore, Zubehoer) bleiben gleich.
const MARKET_SPECS = {
    torque: { column: "torque_nm", label: "Drehmoment (Nm)*", unit: "Nm", step: "0.5" },
    diameter: { column: "wheel_diameter_mm", label: "Durchmesser (mm)*", unit: "mm", step: "1" },
    screen: { column: "screen_size_inch", label: "Bildschirmgröße (Zoll)*", unit: "Zoll", step: "0.1" }
};
const MARKET_CATEGORIES = [
    { key: "Wheelbases", label: "Wheelbases", spec: "torque", specSubs: 3,
      subs: ["Direct Drive (DD)", "Riemenantrieb (Belt-Driven)", "Zahnradantrieb (Gear-Driven)", "Zubehör & Erhöhungen"] },
    { key: "Lenkraeder", label: "Lenkräder", spec: "diameter", specSubs: 3,
      subs: ["Formel- & GT-Lenkräder", "Rundlenkräder (Rallye / Drift)", "Oval- & D-Shape-Lenkräder", "Button Plates & Wheel Hubs", "Quick Releases & Adapter"] },
    { key: "Pedale", label: "Pedale",
      subs: ["Loadcell-Pedale", "Hydraulische Pedale", "Potentiometer- / Hall-Sensor-Pedale", "Inverted Pedals (Hängende Pedale)", "Einzelne Pedale", "Pedal-Haptik & Rumpelmotoren"] },
    { key: "Schalthebel", label: "Schalthebel & Handbremsen",
      subs: ["H-Schaltung", "Sequenzielle Schalter", "Kombi-Schalter (H & Sequenziell)", "Analoge Handbremsen", "Hydraulische Handbremsen"] },
    { key: "Rigs", label: "Rigs & Cockpits",
      subs: ["Alu-Profil-Rigs", "Rohrrahmen-Rigs", "Wheel Stands", "Motion-Plattformen & Bewegungs-Systeme", "DIY-Rigs & Holz-Cockpits"] },
    { key: "Sitze", label: "Sitze",
      subs: ["Vollschalensitze (Bucket Seats)", "Sportsitze (verstellbar)", "Formel-Sitzschalen", "Sitzschienen, Konsolen & Befestigungswinkel"] },
    { key: "Monitore", label: "Monitore & VR", spec: "screen", specSubs: 2,
      subs: ["Ultrawide- & Super-Ultrawide-Monitore", "Standard-Monitore", "VR-Headsets & Zubehör", "Single-Monitor-Halterungen", "Triple-Monitor-Halterungen"] },
    { key: "ButtonBoxen", label: "Button Boxes & Dashboards",
      subs: ["DDU (Digital Display Units)", "Button Boxes", "Stream Decks & Touchscreens", "LED-Rev-Lights"] },
    { key: "Zubehoer", label: "Zubehör & Peripherie",
      subs: ["Windsimulatoren & Belüftung", "Bass-Shaker & Haptisches Feedback", "Handschuhe, Schuhe & Bekleidung", "Kabelmanagement, Netzteile & USB-Hubs", "Sound & Headsets", "Befestigungen, Schrauben & Winkel"] },
    { key: "Bundles", label: "Komplettsets & Bundles",
      subs: ["Einsteiger-Bundles", "High-End-Komplettsysteme"] },
    { key: "Sonstiges", label: "Sonstiges", subs: ["Alles Weitere"] }
];
const MARKET_MANUFACTURERS = ["Fanatec", "Simucube", "Moza", "Simagic", "Thrustmaster", "Logitech", "Asetek SimSports", "Cammus", "Conspit",
    "Heusinkveld", "Cube Controls", "Ascher Racing", "Gomez Sim Industries", "VNM", "Precision Sim Engineering", "Sim-Lab", "Trak Racer",
    "Next Level Racing", "Playseat", "GT Omega", "Sparco", "Bucket Seat", "SimHub", "Buttkicker", "Meta", "Pimax", "HP", "Samsung", "LG", "Eigenbau"];

const CATEGORY_ICONS = {
    Wheelbases: "fa-gear", Lenkraeder: "fa-dharmachakra", Pedale: "fa-shoe-prints", Schalthebel: "fa-arrows-up-down",
    Rigs: "fa-cubes", Sitze: "fa-chair", Monitore: "fa-display", ButtonBoxen: "fa-sliders", Zubehoer: "fa-plug",
    Bundles: "fa-box-open", Sonstiges: "fa-ellipsis"
};

const categoryOf = (key) => MARKET_CATEGORIES.find(c => c.key === key) || null;
const categoryLabel = (key) => categoryOf(key)?.label || key || "Allgemein";
// Welche technische Angabe gehört zu Kategorie + Unterkategorie? (null = keine)
function specFor(categoryKey, subcategory) {
    const cat = categoryOf(categoryKey);
    if (!cat || !cat.spec) return null;
    const index = cat.subs.indexOf(subcategory);
    return index >= 0 && index < cat.specSubs ? cat.spec : null;
}
function specText(item) {
    const parts = [];
    if (item.torque_nm != null) parts.push(`${Number(item.torque_nm).toLocaleString("de-DE")} Nm`);
    if (item.wheel_diameter_mm != null) parts.push(`${item.wheel_diameter_mm} mm`);
    if (item.screen_size_inch != null) parts.push(`${Number(item.screen_size_inch).toLocaleString("de-DE")} Zoll`);
    return parts.join(" · ");
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='250' viewBox='0 0 400 250'><rect width='100%' height='100%' fill='%231a1a1a'/><text x='50%' y='50%' fill='%23666666' font-size='16' text-anchor='middle' dy='.3em'>Kein Bild vorhanden</text></svg>";

// Gleiche Grenzen wie im Speicher: JPG, PNG oder WebP, höchstens 8 MB pro Bild
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

// DOM-Elemente
const marketplaceGrid = document.getElementById("marketplaceGrid");
const marketplaceMore = document.getElementById("marketplaceMore");
const filterCategory = document.getElementById("filterCategory");
const filterSubcategory = document.getElementById("filterSubcategory");
const filterCondition = document.getElementById("filterCondition");
const filterRadius = document.getElementById("filterRadius");
const filterRadiusCustom = document.getElementById("filterRadiusCustom");
const useMyLocationBtn = document.getElementById("useMyLocationBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const categoryChips = document.getElementById("categoryChips");
const radiusHint = document.getElementById("radiusHint");
const searchMarketplace = document.getElementById("searchMarketplace");
const searchLocation = document.getElementById("searchLocation");
const searchLocationDropdown = document.getElementById("searchLocationDropdown");
const minPriceInput = document.getElementById("minPrice");
const maxPriceInput = document.getElementById("maxPrice");
const sortOrderInput = document.getElementById("sortOrder");

// Detail Modal
const itemDetailModal = document.getElementById("itemDetailModal");
const closeDetailModalBtn = document.getElementById("closeDetailModalBtn");
const modalTitle = document.getElementById("modalTitle");
const modalMainImage = document.getElementById("modalMainImage");
const modalGalleryStrip = document.getElementById("modalGalleryStrip");
const modalDescription = document.getElementById("modalDescription");
const modalPrice = document.getElementById("modalPrice");
const modalContactBtn = document.getElementById("modalContactBtn");
const modalEditBtn = document.getElementById("modalEditBtn");
const modalDeleteBtn = document.getElementById("modalDeleteBtn");
const modalReportBtn = document.getElementById("modalReportBtn");
const modalStatus = document.getElementById("modalStatus");
const modalCategory = document.getElementById("modalCategory");
const modalBoosts = document.getElementById("modalBoosts");
const marketplaceTop = document.getElementById("marketplaceTop");
const marketplaceTopGrid = document.getElementById("marketplaceTopGrid");

// Boni (Preise legt der Server fest – hier nur zur Anzeige)
const BOOSTS = [
    { kind: "highlight", icon: "fa-highlighter", name: "Hervorheben", price: "2,99 €",
      text: "Dein Angebot fällt in der Liste mit gelbem Rahmen sofort ins Auge.", active: (i) => Boolean(i.highlighted) },
    { kind: "bump", icon: "fa-angles-up", name: "Hochschieben", price: "3,99 €",
      text: "Rutscht jetzt und danach automatisch alle 7 Tage wieder ganz nach oben.", active: (i) => Boolean(i.bump_since) },
    { kind: "top", icon: "fa-crown", name: "Top-Anzeige", price: "5,99 €",
      text: "Erscheint zusätzlich im Bereich „Top-Anzeigen“ über allen Angeboten.", active: (i) => Boolean(i.top_ad) }
];

// Bezahlung über Stripe starten (Server-Funktion create-checkout liefert die Bezahlseite)
async function startCheckout(body, button) {
    const supabase = window.supabaseClient || window.supabase;
    if (button) button.disabled = true;
    try {
        const { data, error } = await supabase.functions.invoke("create-checkout", { body });
        let message = data?.error;
        if (error) {
            try { message = (await error.context?.json())?.error || message; } catch (e) { /* keine Details */ }
            message = message || "Die Bezahlung ist noch nicht eingerichtet oder gerade nicht erreichbar.";
        }
        if (!data?.url) throw new Error(message || "Die Bezahlseite konnte nicht geöffnet werden.");
        window.location.href = data.url;
    } catch (err) {
        showToast(err.message, "error");
        if (button) button.disabled = false;
    }
}

function renderBoosts(item, isOwner) {
    if (!modalBoosts) return;
    // Nur wenn die Datenbank die Bonus-Spalten schon hat (SQL „Zahlungen“ ausgeführt)
    const show = isOwner && (item.status || "aktiv") !== "verkauft" && !legacyMarketplace && "highlighted" in item;
    modalBoosts.style.display = show ? "" : "none";
    if (!show) return;
    modalBoosts.innerHTML = `
        <div class="mk-boosts-head">
            <h4><i class="fa-solid fa-bolt"></i> Mehr Sichtbarkeit für dein Angebot</h4>
            <span>Einmal zahlen, gilt dauerhaft für dieses Inserat – in jedem Abo extra.</span>
        </div>
        <div class="mk-boost-list"></div>`;
    const list = modalBoosts.querySelector(".mk-boost-list");
    BOOSTS.forEach(boost => {
        const active = boost.active(item);
        const card = document.createElement("div");
        card.className = `mk-boost${active ? " active" : ""}`;
        card.innerHTML = `
            <i class="fa-solid ${boost.icon} mk-boost-icon"></i>
            <div class="mk-boost-text"><strong></strong><span></span></div>
            ${active ? '<span class="mk-boost-state"><i class="fa-solid fa-check"></i> Aktiv</span>'
                     : `<button type="button" class="mk-boost-buy">${boost.price}</button>`}`;
        card.querySelector("strong").textContent = boost.name;
        card.querySelector(".mk-boost-text span").textContent = boost.text;
        const buy = card.querySelector(".mk-boost-buy");
        if (buy) buy.addEventListener("click", () => startCheckout({ kind: boost.kind, listing_id: String(item.id) }, buy));
        list.appendChild(card);
    });
}

// Nach der Bezahlung: Inserat bis zu ~30 Sekunden lang nachladen, bis der gekaufte Bonus eingetragen ist
async function refreshBoostsAfterPayment(item) {
    const supabase = window.supabaseClient || window.supabase;
    const activeCount = (i) => BOOSTS.filter(b => b.active(i)).length;
    const before = activeCount(item);
    for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const { data } = await supabase.from("marketplace").select("*").eq("id", item.id).maybeSingle();
        if (data && activeCount(data) > before) {
            if (itemDetailModal && itemDetailModal.style.display !== "none") openDetailModal(data);
            showToast("Dein Bonus ist jetzt aktiv.", "success");
            loadMarketplaceItems();
            return;
        }
    }
}

// Top-Anzeigen über den Angeboten (passend zu den aktuellen Filtern, zufällige Auswahl)
let topRequest = 0;
async function loadTopAds(rpcArgs) {
    if (!marketplaceTop || !marketplaceTopGrid) return;
    const supabase = window.supabaseClient || window.supabase;
    const requestId = ++topRequest;
    const { data, error } = await supabase.rpc("search_marketplace", { ...rpcArgs, _top_only: true, _limit: 4, _offset: 0 });
    if (requestId !== topRequest) return;
    const rows = error ? [] : (data || []).map(row => ({ ...row.item, _distance: row.distance_km }));
    marketplaceTop.hidden = rows.length === 0;
    marketplaceTopGrid.innerHTML = "";
    rows.forEach(item => marketplaceTopGrid.appendChild(createListingCard(item, true)));
}
const modalFacts = document.getElementById("modalFacts");
const modalSeller = document.getElementById("modalSeller");
const modalSellerAvatar = document.getElementById("modalSellerAvatar");
const modalSellerPlan = document.getElementById("modalSellerPlan");
const modalStatusActions = document.getElementById("modalStatusActions");

// Erstellen / Bearbeiten Modal
const itemCreateModal = document.getElementById("itemCreateModal");
const openItemModalBtn = document.getElementById("openItemModalBtn");
const closeCreateModalBtn = document.getElementById("closeCreateModalBtn");
const createItemForm = document.getElementById("create-item-form");
const modalFormHeader = document.getElementById("modalFormHeader");
const modalFormSubheader = document.getElementById("modalFormSubheader");
const submitItemBtn = document.getElementById("submitItemBtn");
const existingImagesContainer = document.getElementById("existingImagesContainer");
const existingImagesList = document.getElementById("existingImagesList");
const uploadLabel = document.getElementById("uploadLabel");

// Orts-Suche Inputs
const itemLocationInput = document.getElementById("itemLocation");
const locationDropdown = document.getElementById("locationDropdown");

// Kategorie, Unterkategorie und technische Angaben im Formular
const itemCategorySelect = document.getElementById("itemCategory");
const itemSubcategorySelect = document.getElementById("itemSubcategory");
const itemSpecGroup = document.getElementById("itemSpecGroup");
const itemSpecLabel = document.getElementById("itemSpecLabel");
const itemSpecInput = document.getElementById("itemSpec");

const fillOptions = (select, options, firstOption = null) => {
    if (!select) return;
    select.innerHTML = "";
    if (firstOption) select.appendChild(new Option(firstOption[1], firstOption[0]));
    options.forEach(([value, label]) => select.appendChild(new Option(label, value)));
};

function updateFormSubcategories(selected = null) {
    const cat = categoryOf(itemCategorySelect?.value);
    fillOptions(itemSubcategorySelect, (cat?.subs || []).map(s => [s, s]));
    if (selected && cat?.subs.includes(selected)) itemSubcategorySelect.value = selected;
    updateFormSpec();
}

function updateFormSpec(value = null) {
    const spec = specFor(itemCategorySelect?.value, itemSubcategorySelect?.value);
    if (!itemSpecGroup || !itemSpecInput) return;
    itemSpecGroup.style.display = spec ? "" : "none";
    itemSpecInput.required = Boolean(spec);
    if (spec) {
        itemSpecLabel.textContent = MARKET_SPECS[spec].label;
        itemSpecInput.step = MARKET_SPECS[spec].step;
    }
    if (value !== null) itemSpecInput.value = value;
}

function updateFilterSubcategories() {
    const cat = categoryOf(filterCategory?.value);
    if (!filterSubcategory) return;
    fillOptions(filterSubcategory, (cat?.subs || []).map(s => [s, s]), ["all", "Alle Unterkategorien"]);
    filterSubcategory.style.display = cat ? "" : "none";
}

// Kategorien als Schnellauswahl über den Angeboten
function renderCategoryChips() {
    if (!categoryChips) return;
    const active = filterCategory?.value || "all";
    categoryChips.innerHTML = "";
    [{ key: "all", label: "Alle", icon: "fa-border-all" }, ...MARKET_CATEGORIES.map(c => ({ key: c.key, label: c.label, icon: CATEGORY_ICONS[c.key] }))]
        .forEach(({ key, label, icon }) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = `mk-chip${key === active ? " active" : ""}`;
            chip.innerHTML = `<i class="fa-solid ${icon}"></i><span></span>`;
            chip.querySelector("span").textContent = label;
            chip.addEventListener("click", () => {
                filterCategory.value = key;
                filterCategory.dispatchEvent(new Event("change"));
            });
            categoryChips.appendChild(chip);
        });
}

fillOptions(filterCategory, MARKET_CATEGORIES.map(c => [c.key, c.label]), ["all", "Alle Kategorien"]);
renderCategoryChips();
fillOptions(itemCategorySelect, MARKET_CATEGORIES.map(c => [c.key, c.label]));
updateFormSubcategories();
const manufacturerList = document.getElementById("manufacturerList");
if (manufacturerList) MARKET_MANUFACTURERS.forEach(name => manufacturerList.appendChild(new Option(name)));
if (itemCategorySelect) itemCategorySelect.addEventListener("change", () => updateFormSubcategories());
if (itemSubcategorySelect) itemSubcategorySelect.addEventListener("change", () => updateFormSpec());

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) {
        console.error("Supabase Client nicht gefunden!");
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;

    supabase.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
    });

    // Website-Admins dürfen Inserate zur Moderation löschen
    if (currentUser) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", currentUser.id).maybeSingle();
        isSiteAdmin = profile?.role === "admin";
    }

    // Beide Orts-Suchfelder mit der erweiterten Combobox verknüpfen
    setupLocationAutocomplete(itemLocationInput, locationDropdown, null);
    setupLocationAutocomplete(searchLocation, searchLocationDropdown, () => loadMarketplaceItems());

    await loadMarketplaceItems();

    // Links aus Dashboard oder Chat: ein bestimmtes Inserat öffnen (auch verkaufte) oder direkt ein neues anlegen
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("zahlung");
    if (payment) {
        // Rückkehr von der Bezahlseite: Hinweis zeigen und den Parameter aus der Adresse nehmen (kein erneuter Hinweis beim Neuladen)
        params.delete("zahlung");
        history.replaceState(null, "", window.location.pathname + (params.toString() ? `?${params}` : ""));
        if (payment === "erfolg") showToast("Danke für deinen Kauf! Der Bonus wird in wenigen Sekunden freigeschaltet.", "success");
        else showToast("Die Bezahlung wurde abgebrochen – es wurde nichts berechnet.", "info");
    }
    if (params.get("inserat")) {
        let linkedItem = allItems.find(item => String(item.id) === params.get("inserat"));
        if (!linkedItem || payment === "erfolg") {
            const { data } = await supabase.from("marketplace").select("*").eq("id", params.get("inserat")).maybeSingle();
            linkedItem = data || linkedItem;
        }
        if (linkedItem) openDetailModal(linkedItem);
        else showToast("Dieses Inserat gibt es nicht mehr.", "info");
        // Stripe meldet die Zahlung kurz nach der Rückkehr: Boni noch einige Male nachladen, bis sie aktiv sind
        if (linkedItem && payment === "erfolg") refreshBoostsAfterPayment(linkedItem);
    } else if (params.has("neu") && currentUser) {
        openCreateOrEditModal(null);
    }
});

// ORTS-SUCHE BEIM TIPPEN (Photon, für Suche beim Tippen gedacht; Daten von OpenStreetMap)
// Der gewählte Ort merkt sich seine Koordinaten am Eingabefeld (Grundlage für die Umkreissuche)
function setupLocationAutocomplete(inputElement, dropdownElement, onSelectCallback) {
    if (!inputElement || !dropdownElement) return;

    let debounceTimer;
    let pendingRequest = null;
    inputElement.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);
        // Eigener Text statt Auswahl: keine Koordinaten
        delete inputElement.dataset.lat;
        delete inputElement.dataset.lon;
        delete inputElement.dataset.place;
        delete inputElement.dataset.cc;

        if (query.length < 2 || (query.length < 3 && !/^\d+$/.test(query))) {
            dropdownElement.style.display = "none";
            return;
        }

        debounceTimer = setTimeout(async () => {
            if (pendingRequest) pendingRequest.abort();
            pendingRequest = new AbortController();
            try {
                // Alle Ortsarten (Städte, Dörfer, Weiler, Ortsteile, Postleitzahlen), Mitteleuropa zuerst
                const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&osm_tag=place&lang=de&limit=10&lat=50.5&lon=10.5&location_bias_scale=0.3`, { signal: pendingRequest.signal });
                if (!res.ok) throw new Error(`Ortssuche nicht erreichbar (${res.status})`);
                const data = await res.json();
                const seen = new Set();

                dropdownElement.innerHTML = "";
                (data.features || []).forEach(feature => {
                    const props = feature.properties || {};
                    const [lon, lat] = feature.geometry?.coordinates || [];
                    if (!props.name || typeof lat !== "number" || typeof lon !== "number") return;

                    // Eindeutig unterscheidbar: Ortsname (bei Ortsteilen mit Gemeinde, bei PLZ mit Stadt) + Bundesland/Region + Land
                    const isPostcode = props.osm_value === "postcode" || /^[\dA-Z -]{3,10}$/.test(props.name) && /\d/.test(props.name);
                    let name = props.name;
                    if (isPostcode && props.city) name = `${props.name} ${props.city}`;
                    else if (props.city && props.city !== props.name && ["district", "locality"].includes(props.type)) name = `${props.name} (${props.city})`;
                    const parts = [name];
                    if (props.state && props.state !== props.name && props.state !== props.city) parts.push(props.state);
                    if (props.country && props.country !== props.state && props.country !== props.name) parts.push(props.country);
                    const displayName = parts.join(", ");
                    if (seen.has(displayName)) return;
                    seen.add(displayName);

                    const item = document.createElement("div");
                    item.className = "autocomplete-item";
                    item.innerText = displayName;
                    item.addEventListener("click", () => {
                        inputElement.value = displayName;
                        inputElement.dataset.lat = String(lat);
                        inputElement.dataset.lon = String(lon);
                        inputElement.dataset.place = displayName;
                        if (props.countrycode) inputElement.dataset.cc = String(props.countrycode).toUpperCase();
                        dropdownElement.style.display = "none";
                        if (onSelectCallback) onSelectCallback();
                    });
                    dropdownElement.appendChild(item);
                });

                if (!dropdownElement.children.length) {
                    dropdownElement.style.display = "none";
                    return;
                }
                const credit = document.createElement("div");
                credit.className = "autocomplete-credit";
                credit.textContent = "Orte: © OpenStreetMap-Mitwirkende";
                dropdownElement.appendChild(credit);
                dropdownElement.style.display = "block";
            } catch (err) {
                if (err.name === "AbortError") return;
                console.error("Fehler bei der Orts-Suche:", err);
                // Ortssuche gerade nicht erreichbar: eingetippter Ort funktioniert trotzdem (ohne Umkreis)
                dropdownElement.innerHTML = '<div class="autocomplete-credit" style="text-align: left;">Die Ortssuche ist gerade nicht erreichbar. Du kannst den Ort trotzdem eintippen.</div>';
                dropdownElement.style.display = "block";
            }
        }, 300);
    });

    document.addEventListener("click", (e) => {
        if (e.target !== inputElement && e.target !== dropdownElement) {
            dropdownElement.style.display = "none";
        }
    });
}

// Marktplatz Artikel laden: gefiltert, sortiert und seitenweise direkt aus der Datenbank
// (append = weitere Seite anhängen). Ohne die neuen Spalten (SQL noch nicht ausgeführt) wie bisher im Browser filtern.
let loadRequest = 0;
async function loadMarketplaceItems(append = false) {
    const supabase = window.supabaseClient || window.supabase;
    if (!marketplaceGrid || !supabase) return;
    const requestId = ++loadRequest;
    if (!append) marketplaceGrid.innerHTML = "<p>Lade Marktplatz-Angebote...</p>";

    const category = filterCategory ? filterCategory.value : "all";
    const subcategory = filterSubcategory ? filterSubcategory.value : "all";
    const condition = filterCondition ? filterCondition.value : "all";
    const search = (searchMarketplace ? searchMarketplace.value : "").replace(/[,()%*\\]/g, " ").trim();
    const minPrice = minPriceInput && minPriceInput.value !== "" ? parseFloat(minPriceInput.value) : null;
    const maxPrice = maxPriceInput && maxPriceInput.value !== "" ? parseFloat(maxPriceInput.value) : null;

    // Ort: aus der Liste gewählt (oder „Mein Standort“) = Koordinaten für den Umkreis, sonst Textsuche im Ort
    const origin = searchLocation && searchLocation.dataset.lat && searchLocation.dataset.place === searchLocation.value
        ? { lat: Number(searchLocation.dataset.lat), lon: Number(searchLocation.dataset.lon) } : null;
    const place = origin ? "" : (searchLocation ? searchLocation.value : "").replace(/[,()%*\\]/g, " ").trim();
    const radiusChoice = filterRadius ? filterRadius.value : "world";
    const radiusKm = radiusChoice === "custom" ? (Number(filterRadiusCustom?.value) || null)
        : /^\d+$/.test(radiusChoice) ? Number(radiusChoice) : null;
    if (radiusHint) {
        radiusHint.hidden = !(radiusKm && !origin);
        radiusHint.textContent = "Für den Umkreis wähle einen Ort aus der Vorschlagsliste oder nutze deinen Standort (Fadenkreuz).";
    }
    const sortValue = sortOrderInput ? (sortOrderInput.value === "distance" && !origin ? "newest" : sortOrderInput.value) : "newest";

    // Neue Suche in der Datenbank (mit Umkreis); fehlt sie noch (SQL nicht ausgeführt), die bisherige Abfrage
    if (!legacyMarketplace && !window.__marketSearchMissing) {
        const filterArgs = {
            _category: category !== "all" ? category : null,
            _subcategory: subcategory !== "all" ? subcategory : null,
            _search: search || null,
            _condition: condition !== "all" ? condition : null,
            _place: place || null,
            _min_price: minPrice,
            _max_price: maxPrice,
            _lat: origin ? origin.lat : null,
            _lon: origin ? origin.lon : null,
            _radius_km: origin ? radiusKm : null,
            _europe: radiusChoice === "europe",
            _sort: sortValue
        };
        if (!append) loadTopAds(filterArgs);
        const { data, error } = await supabase.rpc("search_marketplace", { ...filterArgs, _limit: PAGE_SIZE, _offset: append ? allItems.length : 0 });
        if (!error) {
            if (requestId !== loadRequest) return;
            const rows = (data || []).map(row => ({ ...row.item, _distance: row.distance_km }));
            allItems = append ? [...allItems, ...rows] : rows;
            totalItems = data && data.length ? Number(data[0].total_count) : (append ? allItems.length : 0);
            renderMarketplaceItems(allItems);
            return;
        }
        if (!/could not find the function|schema cache/i.test(error.message || "")) {
            console.error("Fehler bei der Marktplatz-Suche:", error);
            marketplaceGrid.innerHTML = '<p class="mk-empty">Die Angebote konnten nicht geladen werden.</p>';
            return;
        }
        window.__marketSearchMissing = true;
    }
    if (marketplaceTop) marketplaceTop.hidden = true;

    const buildQuery = (legacy) => {
        let query = supabase.from("marketplace").select("*", { count: "exact" });
        if (legacy) return query.order("created_at", { ascending: false });
        query = query.neq("status", "verkauft");
        if (category !== "all") query = query.eq("category", category);
        if (subcategory !== "all") query = query.eq("subcategory", subcategory);
        if (condition !== "all") query = query.eq("condition", condition);
        if (search) query = query.or(["title", "description", "manufacturer", "model"].map(c => `${c}.ilike.%${search}%`).join(","));
        if (place) query = query.ilike("location", `%${place}%`);
        if (minPrice !== null) query = query.gte("price", minPrice);
        if (maxPrice !== null) query = query.lte("price", maxPrice);
        query = sortValue === "price-asc" ? query.order("price", { ascending: true })
            : sortValue === "price-desc" ? query.order("price", { ascending: false })
            : query.order("created_at", { ascending: false });
        const from = append ? allItems.length : 0;
        return query.range(from, from + PAGE_SIZE - 1);
    };

    try {
        let { data, error, count } = await buildQuery(legacyMarketplace);
        if (error && !legacyMarketplace && /status|subcategory|manufacturer|model|column/i.test(error.message || "")) {
            legacyMarketplace = true;
            ({ data, error, count } = await buildQuery(true));
        }
        if (error) throw error;
        if (requestId !== loadRequest) return; // inzwischen neu gefiltert

        if (legacyMarketplace) {
            allItems = data || [];
            filterItems();
            return;
        }
        allItems = append ? [...allItems, ...(data || [])] : (data || []);
        totalItems = typeof count === "number" ? count : allItems.length;
        renderMarketplaceItems(allItems);
    } catch (error) {
        console.error("Fehler beim Laden der Artikel:", error);
        marketplaceGrid.innerHTML = "<p>Keine Angebote vorhanden oder Verbindungsfehler.</p>";
    }
}

// „Weitere Angebote laden“
function renderLoadMore(shown, total) {
    if (!marketplaceMore) return;
    marketplaceMore.innerHTML = "";
    if (shown >= total) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mk-more-btn";
    btn.textContent = "Weitere Angebote laden";
    btn.addEventListener("click", () => {
        btn.disabled = true;
        loadMarketplaceItems(true);
    });
    marketplaceMore.appendChild(btn);
}

// Artikel-Karten rendern
function renderMarketplaceItems(items) {
    if (!marketplaceGrid) return;
    marketplaceGrid.innerHTML = "";
    renderLoadMore(items.length, legacyMarketplace ? items.length : totalItems);

    if (items.length === 0) {
        marketplaceGrid.innerHTML = `
            <div class="mk-empty">
                <i class="fa-solid fa-magnifying-glass"></i>
                <strong>Keine passenden Angebote gefunden</strong>
                <span>Probiere einen größeren Umkreis, eine andere Kategorie oder setze die Filter zurück.</span>
            </div>`;
        return;
    }

    items.forEach((item) => marketplaceGrid.appendChild(createListingCard(item)));
}

// Angebotskarte (Top-Anzeigen mit eigenem Abzeichen, hervorgehobene mit gelbem Rahmen)
function createListingCard(item, isTop = false) {
        const card = document.createElement("article");
        card.className = `mk-card${item.highlighted ? " highlighted" : ""}${isTop ? " top" : ""}`;
        card.tabIndex = 0;

        const images = item.images || item.image_urls || item.imageUrls || [];
        const coverImage = images.length > 0 ? images[0] : DEFAULT_PLACEHOLDER;
        const condition = item.condition || "Gebraucht";
        const productLine = [item.manufacturer, item.model].filter(Boolean).join(" ");
        const specs = specText(item);
        const city = String(item.location || "").split(",")[0].trim();
        const distance = typeof item._distance === "number" ? ` · ${item._distance < 1 ? "< 1" : Math.round(item._distance).toLocaleString("de-DE")} km` : "";

        card.innerHTML = `
            <div class="mk-card-media">
                <img src="${escapeHtml(coverImage)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='${DEFAULT_PLACEHOLDER}'">
                ${item.status === "reserviert" ? '<span class="market-badge reserved">Reserviert</span>'
                    : isTop ? '<span class="market-badge top"><i class="fa-solid fa-crown"></i> Top</span>' : ""}
                ${images.length > 1 ? `<span class="mk-card-photos"><i class="fa-solid fa-camera"></i> ${images.length}</span>` : ""}
            </div>
            <div class="mk-card-body">
                <div class="mk-card-cat">${escapeHtml(categoryLabel(item.category))}${item.subcategory ? ` › ${escapeHtml(item.subcategory)}` : ""}</div>
                <h3 class="mk-card-title">${escapeHtml(item.title)}</h3>
                ${productLine || specs ? `<div class="mk-card-product">${escapeHtml(productLine)}${productLine && specs ? " · " : ""}${specs ? `<strong>${escapeHtml(specs)}</strong>` : ""}</div>` : ""}
                <div class="mk-card-price">${formatPrice(item.price)}</div>
                <div class="mk-card-foot">
                    <span class="mk-card-cond">${escapeHtml(condition)}</span>
                    <span class="mk-card-where">${city ? `<i class="fa-solid fa-location-dot"></i> ${escapeHtml(city)}${distance}` : ""}</span>
                    <span class="mk-card-age">${escapeHtml(timeAgo(item.created_at))}</span>
                </div>
            </div>
        `;

        card.addEventListener("click", () => openDetailModal(item));
        card.addEventListener("keydown", (e) => { if (e.key === "Enter") openDetailModal(item); });
        return card;
}

// Preis ohne unnötige Nachkommastellen („899 €“, „19,90 €“)
function formatPrice(value) {
    const price = parseFloat(value || 0);
    return price.toLocaleString("de-DE", { minimumFractionDigits: Number.isInteger(price) ? 0 : 2, maximumFractionDigits: 2 }) + " €";
}

// „vor 3 Std.“, „vor 2 Tagen“, danach das Datum
function timeAgo(value) {
    if (!value) return "";
    const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 60) return minutes <= 1 ? "gerade eben" : `vor ${minutes} Min.`;
    if (minutes < 24 * 60) return `vor ${Math.round(minutes / 60)} Std.`;
    const days = Math.round(minutes / 1440);
    if (days < 7) return days === 1 ? "gestern" : `vor ${days} Tagen`;
    return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// Filter & Sortierung im Browser (nur solange die Datenbank die neuen Spalten noch nicht hat)
function filterItems() {
    const categoryValue = filterCategory ? filterCategory.value : "all";
    const searchValue = searchMarketplace ? searchMarketplace.value.toLowerCase() : "";
    const locationSearchValue = searchLocation ? searchLocation.value.toLowerCase() : "";
    const minPrice = minPriceInput && minPriceInput.value !== "" ? parseFloat(minPriceInput.value) : 0;
    const maxPrice = maxPriceInput && maxPriceInput.value !== "" ? parseFloat(maxPriceInput.value) : Infinity;
    const sortValue = sortOrderInput ? sortOrderInput.value : "newest";

    let filtered = allItems.filter((item) => {
        const itemPrice = parseFloat(item.price || 0);
        const matchesCategory = categoryValue === "all" || item.category === categoryValue;
        const matchesSearch = (item.title || "").toLowerCase().includes(searchValue) ||
                              (item.description || "").toLowerCase().includes(searchValue);
        const matchesLocation = (item.location || "").toLowerCase().includes(locationSearchValue);
        const matchesPrice = itemPrice >= minPrice && itemPrice <= maxPrice;

        return matchesCategory && matchesSearch && matchesLocation && matchesPrice;
    });

    if (sortValue === "price-asc") {
        filtered.sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
    } else if (sortValue === "price-desc") {
        filtered.sort((a, b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
    } else {
        filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    renderMarketplaceItems(filtered);
}

// Filter: Auswahlfelder sofort, Texteingaben kurz verzögert (nicht bei jedem Tastendruck eine Abfrage)
let filterTimer = null;
const reloadSoon = () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => loadMarketplaceItems(), 350);
};
if (filterCategory) filterCategory.addEventListener("change", () => { updateFilterSubcategories(); renderCategoryChips(); loadMarketplaceItems(); });
if (filterCondition) filterCondition.addEventListener("change", () => loadMarketplaceItems());
if (filterRadius) filterRadius.addEventListener("change", () => {
    if (filterRadiusCustom) filterRadiusCustom.style.display = filterRadius.value === "custom" ? "" : "none";
    if (filterRadius.value === "custom" && filterRadiusCustom) filterRadiusCustom.focus();
    // Mit Umkreis ergibt „Entfernung“ als Sortierung meist am meisten Sinn
    if (/^\d+$|custom/.test(filterRadius.value) && sortOrderInput && sortOrderInput.value === "newest") sortOrderInput.value = "distance";
    loadMarketplaceItems();
});
if (filterRadiusCustom) filterRadiusCustom.addEventListener("input", reloadSoon);

// Mein Standort: Koordinaten nur für diese Suche (werden nirgends gespeichert)
if (useMyLocationBtn) useMyLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
        showToast("Dein Browser kann den Standort nicht bestimmen.", "error");
        return;
    }
    useMyLocationBtn.classList.add("busy");
    navigator.geolocation.getCurrentPosition((pos) => {
        useMyLocationBtn.classList.remove("busy");
        searchLocation.value = "Mein Standort";
        searchLocation.dataset.place = "Mein Standort";
        searchLocation.dataset.lat = String(pos.coords.latitude);
        searchLocation.dataset.lon = String(pos.coords.longitude);
        if (filterRadius && !/^\d+$|custom/.test(filterRadius.value)) filterRadius.value = "50";
        if (sortOrderInput && sortOrderInput.value === "newest") sortOrderInput.value = "distance";
        loadMarketplaceItems();
    }, () => {
        useMyLocationBtn.classList.remove("busy");
        showToast("Der Standort konnte nicht ermittelt werden. Bitte erlaube den Zugriff oder gib einen Ort ein.", "error");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
});

// Alle Filter zurücksetzen
if (resetFiltersBtn) resetFiltersBtn.addEventListener("click", () => {
    [searchMarketplace, searchLocation, minPriceInput, maxPriceInput, filterRadiusCustom].forEach(el => { if (el) el.value = ""; });
    if (searchLocation) ["lat", "lon", "place", "cc"].forEach(k => delete searchLocation.dataset[k]);
    if (filterCategory) filterCategory.value = "all";
    if (filterCondition) filterCondition.value = "all";
    if (filterRadius) filterRadius.value = "world";
    if (filterRadiusCustom) filterRadiusCustom.style.display = "none";
    if (sortOrderInput) sortOrderInput.value = "newest";
    updateFilterSubcategories();
    renderCategoryChips();
    loadMarketplaceItems();
});
if (filterSubcategory) filterSubcategory.addEventListener("change", () => loadMarketplaceItems());
if (searchMarketplace) searchMarketplace.addEventListener("input", reloadSoon);
if (searchLocation) searchLocation.addEventListener("input", reloadSoon);
if (minPriceInput) minPriceInput.addEventListener("input", reloadSoon);
if (maxPriceInput) maxPriceInput.addEventListener("input", reloadSoon);
if (sortOrderInput) sortOrderInput.addEventListener("change", () => loadMarketplaceItems());

// Modal: Detailansicht
function openDetailModal(item) {
    const supabase = window.supabaseClient || window.supabase;
    if (!itemDetailModal) return;

    const sellerName = item.seller_name || item.sellerName || 'Verkäufer';
    const sellerId = item.user_id || item.seller_id || item.sellerId;
    const images = item.images || item.image_urls || item.imageUrls || [];
    const condition = item.condition || 'Gebraucht';

    const isOwner = Boolean(currentUser && currentUser.id === sellerId);
    const status = item.status || "aktiv";

    if (modalTitle) modalTitle.innerText = item.title || "";
    if (modalCategory) {
        modalCategory.innerHTML = `<i class="fa-solid ${CATEGORY_ICONS[item.category] || "fa-tag"}"></i> <span></span>`;
        modalCategory.querySelector("span").textContent = categoryLabel(item.category) + (item.subcategory ? ` › ${item.subcategory}` : "");
    }
    // Alle Eckdaten einheitlich als Liste: Symbol, Bezeichnung, Wert
    if (modalFacts) {
        const created = item.created_at ? new Date(item.created_at) : null;
        const facts = [
            ["fa-star-half-stroke", "Zustand", condition],
            item.manufacturer ? ["fa-industry", "Hersteller", item.manufacturer] : null,
            item.model ? ["fa-tag", "Modell", item.model] : null,
            item.torque_nm != null ? ["fa-gauge-high", "Drehmoment", `${Number(item.torque_nm).toLocaleString("de-DE")} Nm`] : null,
            item.wheel_diameter_mm != null ? ["fa-circle-notch", "Durchmesser", `${item.wheel_diameter_mm} mm`] : null,
            item.screen_size_inch != null ? ["fa-display", "Bildschirmgröße", `${Number(item.screen_size_inch).toLocaleString("de-DE")} Zoll`] : null,
            item.location ? ["fa-location-dot", "Standort", item.location + (typeof item._distance === "number" ? ` (ca. ${Math.max(1, Math.round(item._distance)).toLocaleString("de-DE")} km)` : "")] : null,
            created ? ["fa-clock", "Eingestellt", `${created.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })} · ${timeAgo(item.created_at)}`] : null
        ].filter(Boolean);
        modalFacts.innerHTML = "";
        facts.forEach(([icon, label, value]) => {
            const row = document.createElement("div");
            row.className = "mk-fact";
            row.innerHTML = `<dt><i class="fa-solid ${icon}"></i> <span></span></dt><dd></dd>`;
            row.querySelector("dt span").textContent = label;
            row.querySelector("dd").textContent = value;
            modalFacts.appendChild(row);
        });
    }
    // Verkäufer: Benutzername und Profilbild aus dem Profil (ältere Inserate speichern dort teils den E-Mail-Namen)
    if (modalSeller) modalSeller.textContent = sellerName;
    if (modalSellerAvatar) modalSellerAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';
    if (modalSellerPlan) modalSellerPlan.replaceChildren();
    if (sellerId && typeof window.showPlanBadge === "function") window.showPlanBadge(modalSellerPlan, sellerId);
    if (sellerId && supabase) {
        supabase.from("profiles").select("username, avatar_url").eq("id", sellerId).maybeSingle().then(({ data }) => {
            if (!data) return;
            if (data.username && modalSeller) modalSeller.textContent = data.username;
            if (/^https:\/\//i.test(data.avatar_url || "") && modalSellerAvatar) {
                const img = document.createElement("img");
                img.src = data.avatar_url;
                img.alt = "";
                modalSellerAvatar.replaceChildren(img);
            }
        }, () => {});
    }
    // Status: verkauft (nur noch per Link erreichbar) oder reserviert
    if (modalStatus) {
        modalStatus.className = `market-status-banner ${status}`;
        modalStatus.innerHTML = status === "verkauft" ? '<i class="fa-solid fa-circle-check"></i> Verkauft – dieses Angebot ist nicht mehr verfügbar.'
            : status === "reserviert" ? '<i class="fa-solid fa-clock"></i> Reserviert – der Verkäufer ist bereits mit jemandem im Gespräch.' : "";
        modalStatus.style.display = status === "aktiv" ? "none" : "";
    }
    if (modalContactBtn) modalContactBtn.style.display = status === "verkauft" || isOwner ? "none" : "";
    if (modalReportBtn) {
        modalReportBtn.style.display = currentUser && !isOwner ? "" : "none";
        modalReportBtn.onclick = () => reportListing(item);
    }
    if (modalStatusActions) {
        modalStatusActions.innerHTML = "";
        modalStatusActions.style.display = isOwner && !legacyMarketplace ? "" : "none";
        if (isOwner && !legacyMarketplace) {
            const actions = status === "verkauft" ? [["aktiv", "fa-rotate-left", "Wieder anbieten"]]
                : [[status === "reserviert" ? "aktiv" : "reserviert", status === "reserviert" ? "fa-lock-open" : "fa-clock",
                    status === "reserviert" ? "Reservierung aufheben" : "Als reserviert markieren"], ["verkauft", "fa-circle-check", "Als verkauft markieren"]];
            modalStatusActions.innerHTML = `<span>Status: <strong>${status === "aktiv" ? "Verfügbar" : status === "reserviert" ? "Reserviert" : "Verkauft"}</strong></span>`;
            actions.forEach(([next, icon, text]) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = `market-status-btn ${next}`;
                btn.innerHTML = `<i class="fa-solid ${icon}"></i> ${text}`;
                btn.addEventListener("click", () => setListingStatus(item, next));
                modalStatusActions.appendChild(btn);
            });
        }
    }
    renderBoosts(item, isOwner);
    if (modalDescription) modalDescription.innerText = item.description || "Keine Beschreibung angegeben.";
    if (modalPrice) modalPrice.innerText = formatPrice(item.price);

    if (modalGalleryStrip) modalGalleryStrip.innerHTML = "";

    if (images.length > 0) {
        if (modalMainImage) modalMainImage.src = images[0];
        images.forEach((imgUrl, index) => {
            const thumb = document.createElement("img");
            thumb.src = imgUrl;
            thumb.className = `gallery-thumbnail ${index === 0 ? 'active' : ''}`;

            thumb.addEventListener("click", () => {
                if (modalMainImage) modalMainImage.src = imgUrl;
                document.querySelectorAll(".gallery-thumbnail").forEach(t => t.classList.remove("active"));
                thumb.classList.add("active");
            });

            if (modalGalleryStrip) modalGalleryStrip.appendChild(thumb);
        });
    } else {
        if (modalMainImage) modalMainImage.src = DEFAULT_PLACEHOLDER;
    }

    if (modalContactBtn) {
        modalContactBtn.onclick = () => {
            if (!currentUser) {
                showToast("Bitte logge dich ein, um dem Verkäufer eine Nachricht zu senden.", "error");
                return;
            }
            if (currentUser.id === sellerId) {
                showToast("Das ist dein eigenes Angebot.", "info");
                return;
            }
            
            const url = `messenger.html?sellerId=${encodeURIComponent(sellerId)}&sellerName=${encodeURIComponent(sellerName)}&itemTitle=${encodeURIComponent(item.title)}`;
            window.location.href = url;
        };
    }

    // Bearbeiten nur Eigentümer, Löschen Eigentümer und Website-Admins (Moderation)
    if (isOwner || (currentUser && isSiteAdmin)) {
        if (modalEditBtn) {
            modalEditBtn.style.display = isOwner ? "inline-flex" : "none";
            modalEditBtn.onclick = () => {
                itemDetailModal.style.display = "none";
                openCreateOrEditModal(item);
            };
        }
        if (modalDeleteBtn) {
            modalDeleteBtn.style.display = "inline-flex";
            modalDeleteBtn.onclick = async () => {
                const confirmed = await showDialog({
                    icon: "fa-trash",
                    title: "Angebot löschen?",
                    message: "Möchtest du dieses Angebot wirklich löschen?",
                    confirmText: "Löschen",
                    cancelText: "Abbrechen",
                    danger: true
                });
                if (confirmed) {
                    try {
                        const { error } = await supabase.from("marketplace").delete().eq("id", item.id);
                        if (error) throw error;
                        showToast("Angebot erfolgreich gelöscht.", "success");
                        itemDetailModal.style.display = "none";
                        loadMarketplaceItems();
                    } catch (e) {
                        console.error("Fehler beim Löschen:", e);
                        showToast("Fehler beim Löschen des Angebots.", "error");
                    }
                }
            };
        }
    } else {
        if (modalEditBtn) modalEditBtn.style.display = "none";
        if (modalDeleteBtn) modalDeleteBtn.style.display = "none";
    }

    itemDetailModal.style.display = "flex";
}

if (closeDetailModalBtn) {
    closeDetailModalBtn.addEventListener("click", () => {
        itemDetailModal.style.display = "none";
    });
}

// Status ändern: verfügbar, reserviert oder verkauft (verkaufte verschwinden sofort aus der Übersicht)
async function setListingStatus(item, nextStatus) {
    const supabase = window.supabaseClient || window.supabase;
    if (nextStatus === "verkauft") {
        const confirmed = await showDialog({
            icon: "fa-circle-check",
            title: "Als verkauft markieren?",
            message: "Das Angebot verschwindet sofort aus der Übersicht und der Suche. Wer es aus einem Chat oder deinem Dashboard öffnet, sieht „Verkauft“. Du kannst es jederzeit wieder anbieten.",
            confirmText: "Verkauft",
            cancelText: "Abbrechen"
        });
        if (!confirmed) return;
    }
    const { data, error } = await supabase.from("marketplace").update({ status: nextStatus }).eq("id", item.id).select("*");
    if (error || !data || data.length === 0) {
        showToast(error && /höchstens/.test(error.message || "") ? error.message : "Der Status konnte nicht geändert werden.", "error");
        return;
    }
    showToast(nextStatus === "verkauft" ? "Glückwunsch zum Verkauf! Das Angebot ist jetzt als verkauft markiert."
        : nextStatus === "reserviert" ? "Das Angebot ist jetzt reserviert." : "Das Angebot ist wieder verfügbar.", "success");
    openDetailModal(data[0]);
    loadMarketplaceItems();
}

// Inserat melden: Grund wählen (bei „Sonstiges“ kurz beschreiben), landet im Admin-Bereich
async function reportListing(item) {
    const supabase = window.supabaseClient || window.supabase;
    const reason = await showDialog({
        icon: "fa-flag",
        title: "Inserat melden",
        message: "Was stimmt mit diesem Angebot nicht? Das GSRA-Team prüft deine Meldung vertraulich.",
        choices: [
            { value: "Betrug oder Fake-Angebot", text: "Betrug oder Fake-Angebot" },
            { value: "Verbotener oder gefährlicher Artikel", text: "Verbotener oder gefährlicher Artikel" },
            { value: "Spam oder falsche Kategorie", text: "Spam oder falsche Kategorie" },
            { value: "Beleidigende oder unangemessene Inhalte", text: "Beleidigende oder unangemessene Inhalte" },
            { value: "Sonstiges", text: "Sonstiges" }
        ],
        cancelText: "Abbrechen"
    });
    if (!reason) return;
    let details = null;
    if (reason === "Sonstiges") {
        details = await showDialog({
            icon: "fa-flag",
            title: "Was ist dir aufgefallen?",
            message: "Beschreibe kurz, was mit dem Angebot nicht stimmt.",
            input: { placeholder: "z. B. Bilder stammen von einer anderen Seite", maxLength: 500, multiline: true },
            confirmText: "Melden",
            cancelText: "Abbrechen"
        });
        if (!details) return;
    }
    const { error } = await supabase.rpc("report_listing", { _listing_id: String(item.id), _reason: reason, _details: details });
    if (error) {
        showToast(/could not find the function|schema cache/i.test(error.message || "")
            ? "Melden ist in der Datenbank noch nicht eingerichtet." : error.message, "error");
        return;
    }
    showToast("Danke! Das GSRA-Team prüft das Angebot.", "success");
}

// Modal öffnen (Erstellen oder Bearbeiten)
function openCreateOrEditModal(itemToEdit = null) {
    if (!currentUser) {
        showToast("Bitte melde dich an, um ein Angebot zu erstellen.", "error");
        return;
    }

    createItemForm.reset();
    updateFormSubcategories();
    existingImagesUrls = [];
    if (itemLocationInput) {
        delete itemLocationInput.dataset.lat;
        delete itemLocationInput.dataset.lon;
        delete itemLocationInput.dataset.place;
        delete itemLocationInput.dataset.cc;
    }

    if (itemToEdit) {
        isEditMode = true;
        currentEditItemId = itemToEdit.id;
        if (modalFormHeader) modalFormHeader.innerHTML = 'Artikel <span class="text-blue">Bearbeiten</span>';
        if (modalFormSubheader) modalFormSubheader.innerText = "Passe deine Angaben und Bilder an.";
        if (submitItemBtn) submitItemBtn.innerText = "Änderungen Speichern";

        document.getElementById("itemTitle").value = itemToEdit.title || "";
        document.getElementById("itemCategory").value = categoryOf(itemToEdit.category) ? itemToEdit.category : "Sonstiges";
        updateFormSubcategories(itemToEdit.subcategory);
        const editSpec = specFor(itemCategorySelect.value, itemSubcategorySelect.value);
        updateFormSpec(editSpec ? (itemToEdit[MARKET_SPECS[editSpec].column] ?? "") : "");
        document.getElementById("itemManufacturer").value = itemToEdit.manufacturer || "";
        document.getElementById("itemModel").value = itemToEdit.model || "";
        document.getElementById("itemCondition").value = itemToEdit.condition || "Gebraucht";
        document.getElementById("itemPrice").value = itemToEdit.price || 0;
        document.getElementById("itemLocation").value = itemToEdit.location || "";
        // Gespeicherte Koordinaten bleiben, solange der Ort nicht geändert wird
        if (itemLocationInput && itemToEdit.latitude != null && itemToEdit.longitude != null) {
            itemLocationInput.dataset.lat = String(itemToEdit.latitude);
            itemLocationInput.dataset.lon = String(itemToEdit.longitude);
            itemLocationInput.dataset.place = itemToEdit.location || "";
            if (itemToEdit.country_code) itemLocationInput.dataset.cc = itemToEdit.country_code;
        }
        document.getElementById("itemDescription").value = itemToEdit.description || "";

        existingImagesUrls = itemToEdit.images || itemToEdit.image_urls || [];
        renderExistingImages();

        document.getElementById("itemImages").required = false;
        if (uploadLabel) uploadLabel.innerText = "Weitere Bilder hinzufügen (Optional):";
    } else {
        isEditMode = false;
        currentEditItemId = null;
        if (modalFormHeader) modalFormHeader.innerHTML = 'Artikel <span class="text-blue">Inserieren</span>';
        if (modalFormSubheader) modalFormSubheader.innerText = "Verkaufe dein Equipment in der GSRA-Community.";
        if (submitItemBtn) submitItemBtn.innerText = "Angebot Veröffentlichen";

        if (existingImagesContainer) existingImagesContainer.style.display = "none";
        document.getElementById("itemImages").required = true;
        if (uploadLabel) uploadLabel.innerText = "Produktbilder (maximal 10 Bilder, JPG/PNG/WebP bis 8 MB)*";
    }

    itemCreateModal.style.display = "flex";
}

function renderExistingImages() {
    if (!existingImagesList || !existingImagesContainer) return;
    existingImagesList.innerHTML = "";

    if (existingImagesUrls.length === 0) {
        existingImagesContainer.style.display = "none";
        return;
    }

    existingImagesContainer.style.display = "flex";
    existingImagesUrls.forEach((url, idx) => {
        const wrap = document.createElement("div");
        wrap.className = "existing-img-wrapper";
        wrap.innerHTML = `
            <img src="${escapeHtml(url)}" alt="Vorschau">
            <button type="button" class="existing-img-remove" title="Bild entfernen">&times;</button>
        `;
        wrap.querySelector("button").addEventListener("click", () => {
            existingImagesUrls.splice(idx, 1);
            renderExistingImages();
        });
        existingImagesList.appendChild(wrap);
    });
}

if (openItemModalBtn) openItemModalBtn.addEventListener("click", () => openCreateOrEditModal(null));
if (closeCreateModalBtn) closeCreateModalBtn.addEventListener("click", () => itemCreateModal.style.display = "none");

window.addEventListener("click", (e) => {
    if (e.target === itemDetailModal) itemDetailModal.style.display = "none";
    if (e.target === itemCreateModal) itemCreateModal.style.display = "none";
});

// Angebot Speichern / Aktualisieren in Supabase
if (createItemForm) {
    createItemForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const supabase = window.supabaseClient || window.supabase;

        if (!currentUser) {
            showToast("Du musst angemeldet sein.", "error");
            return;
        }

        const titleInput = document.getElementById("itemTitle");
        const categoryInput = document.getElementById("itemCategory");
        const conditionInput = document.getElementById("itemCondition");
        const priceInput = document.getElementById("itemPrice");
        const locationInput = document.getElementById("itemLocation");
        const descriptionInput = document.getElementById("itemDescription");
        const fileInput = document.getElementById("itemImages");

        const title = titleInput ? titleInput.value : "";
        const category = categoryInput ? categoryInput.value : "";
        const condition = conditionInput ? conditionInput.value : "";
        const price = priceInput ? parseFloat(priceInput.value) : 0;
        const location = locationInput ? locationInput.value : "";
        const description = descriptionInput ? descriptionInput.value : "";

        const files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];

        if (!isEditMode && files.length === 0) {
            showToast("Bitte wähle mindestens ein Bild aus.", "error");
            return;
        }

        if (existingImagesUrls.length + files.length > 10) {
            showToast("Insgesamt dürfen maximal 10 Bilder hochgeladen sein.", "error");
            return;
        }

        const invalidFile = files.find(file => !IMAGE_TYPES[file.type] || file.size > MAX_IMAGE_SIZE);
        if (invalidFile) {
            showToast(`„${invalidFile.name}“ passt nicht: erlaubt sind JPG, PNG oder WebP bis 8 MB.`, "error");
            return;
        }

        try {
            if (submitItemBtn) {
                submitItemBtn.disabled = true;
                submitItemBtn.innerText = "Speichere Angebot...";
            }

            let newlyUploadedUrls = [];

            if (files.length > 0) {
                const uploadPromises = files.map(async (file) => {
                    // Eigener Ordner pro Person (Pflicht im Speicher)
                    const fileExt = IMAGE_TYPES[file.type];
                    const fileName = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
                    
                    const { error: uploadError } = await supabase.storage.from("marketplace").upload(fileName, file);
                    if (uploadError) throw uploadError;

                    const { data } = supabase.storage.from("marketplace").getPublicUrl(fileName);
                    return data.publicUrl;
                });

                newlyUploadedUrls = await Promise.all(uploadPromises);
            }

            const finalImageArray = [...existingImagesUrls, ...newlyUploadedUrls];

            if (finalImageArray.length === 0) {
                showToast("Das Angebot muss mindestens 1 Bild enthalten.", "error");
                if (submitItemBtn) {
                    submitItemBtn.disabled = false;
                    submitItemBtn.innerText = isEditMode ? "Änderungen Speichern" : "Angebot Veröffentlichen";
                }
                return;
            }

            // Verkäufername = Benutzername (nicht der Anfang der E-Mail-Adresse)
            const { data: ownProfile } = await supabase.from("profiles").select("username").eq("id", currentUser.id).maybeSingle();
            const sellerName = ownProfile?.username || currentUser.user_metadata?.username || "GSRA-Mitglied";

            // Koordinaten nur, wenn der Ort aus der Vorschlagsliste gewählt wurde
            const picked = locationInput && locationInput.dataset.place === location;
            // Neue Angaben: Unterkategorie, Hersteller, Modell und die passende technische Angabe
            const spec = specFor(category, itemSubcategorySelect?.value);
            const specValue = spec && itemSpecInput.value !== "" ? Number(itemSpecInput.value) : null;
            const extras = {
                latitude: picked ? Number(locationInput.dataset.lat) : null,
                longitude: picked ? Number(locationInput.dataset.lon) : null,
                country_code: picked && /^[A-Z]{2}$/.test(locationInput.dataset.cc || "") ? locationInput.dataset.cc : null,
                subcategory: itemSubcategorySelect?.value || null,
                manufacturer: document.getElementById("itemManufacturer").value.trim() || null,
                model: document.getElementById("itemModel").value.trim() || null,
                torque_nm: spec === "torque" ? specValue : null,
                wheel_diameter_mm: spec === "diameter" && specValue !== null ? Math.round(specValue) : null,
                screen_size_inch: spec === "screen" ? specValue : null
            };
            // Fehlen die neuen Spalten noch (SQL nicht ausgeführt), wird ohne sie gespeichert
            const withCoords = async (run, fields) => {
                let { error } = await run({ ...fields, ...extras });
                if (error && /country_code/i.test(error.message || "")) {
                    const { country_code, ...withoutCountry } = extras;
                    ({ error } = await run({ ...fields, ...withoutCountry }));
                }
                if (!error || !/latitude|longitude|subcategory|manufacturer|model|torque_nm|wheel_diameter_mm|screen_size_inch|schema cache/i.test(error.message || "")) return error;
                return (await run(fields)).error;
            };

            if (isEditMode) {
                const updateError = await withCoords((fields) => supabase.from("marketplace").update(fields).eq("id", currentEditItemId), {
                    title: title,
                    category: category,
                    condition: condition,
                    price: price,
                    location: location,
                    description: description,
                    images: finalImageArray
                });

                if (updateError) throw updateError;
                showToast("Angebot erfolgreich aktualisiert!", "success");
            } else {
                const insertError = await withCoords((fields) => supabase.from("marketplace").insert([fields]), {
                    title: title,
                    category: category,
                    condition: condition,
                    price: price,
                    location: location,
                    description: description,
                    images: finalImageArray,
                    user_id: currentUser.id,
                    seller_name: sellerName
                });

                if (insertError) throw insertError;
                showToast("Angebot erfolgreich erstellt!", "success");
            }

            createItemForm.reset();
            itemCreateModal.style.display = "none";
            loadMarketplaceItems();
        } catch (error) {
            console.error("Fehler beim Speichern des Angebots:", error);
            showToast(/höchstens 100/.test(error?.message || "") ? error.message : "Fehler beim Speichern des Angebots.", "error");
        } finally {
            if (submitItemBtn) {
                submitItemBtn.disabled = false;
                submitItemBtn.innerText = isEditMode ? "Änderungen Speichern" : "Angebot Veröffentlichen";
            }
        }
    });
}