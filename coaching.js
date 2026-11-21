/* =========================================
   GSRA - Coaching
   Mitglieder mit GSRA-Coach-Lizenz (über Leistung, nicht über ein Abo – siehe SQL 026) bieten Coachings zu ihrem
   eigenen Preis an, jedes Mitglied kann anfragen.
   Der Preis geht an den Coach (die GSRA behält nichts ein; die Zahlungsgebühr von Stripe trägt der Coach).
   Mit Paddock kommen 10 % Servicegebühr dazu, mit Pole/Alliance keine.
   Preis und Gebühr legt die Datenbank fest (coaching_book) – die Seite zeigt sie nur an.
   Ablauf: anfragen → Coach nimmt mit festem Termin an → Käufer bezahlt über Stripe (direkt an den Coach,
   Server-Funktion coaching-checkout) → Coach meldet „erledigt“. Stornieren mit voller Erstattung: Käufer bis
   24 Stunden vor dem Termin, Coach jederzeit (coaching-refund). Absprachen laufen über den Messenger.
========================================= */
(() => {
    const client = window.supabaseClient || window.supabase;
    const CATEGORIES = ["Fahrtechnik", "Setup", "Rennstrategie", "Einsteiger", "Datenanalyse", "Sonstiges"];
    const CATEGORY_ICONS = {
        Fahrtechnik: "fa-road", Setup: "fa-sliders", Rennstrategie: "fa-chess", Einsteiger: "fa-seedling",
        Datenanalyse: "fa-chart-line", Sonstiges: "fa-ellipsis"
    };
    const STATUS = {
        angefragt: ["fa-hourglass-half", "Wartet auf Antwort", "wait"],
        angenommen: ["fa-circle-check", "Angenommen", "ok"],
        abgelehnt: ["fa-circle-xmark", "Abgelehnt", "bad"],
        storniert: ["fa-ban", "Storniert", "off"],
        bezahlt: ["fa-credit-card", "Bezahlt", "ok"],
        erledigt: ["fa-flag-checkered", "Erledigt", "done"],
        erstattet: ["fa-rotate-left", "Erstattet", "off"],
        abgelaufen: ["fa-hourglass-end", "Abgelaufen", "off"]   // SQL 033: unbeantwortet oder nie bezahlt
    };
    // Länder für das Stripe-Konto der Coaches (wie in der Server-Funktion coaching-connect)
    const PAYOUT_COUNTRIES = [["DE", "Deutschland"], ["AT", "Österreich"], ["CH", "Schweiz"], ["NL", "Niederlande"], ["BE", "Belgien"],
        ["LU", "Luxemburg"], ["FR", "Frankreich"], ["IT", "Italien"], ["ES", "Spanien"], ["PT", "Portugal"], ["IE", "Irland"],
        ["PL", "Polen"], ["CZ", "Tschechien"], ["DK", "Dänemark"], ["SE", "Schweden"], ["FI", "Finnland"], ["NO", "Norwegen"]];

    let me = null;            // angemeldete Person
    let license = null;       // eigener Stand der Coach-Lizenz (coach_license_status)
    let feePercent = 10;      // nur für die Anzeige; berechnet wird in der Datenbank
    let isModerator = false;
    let offers = [];
    let profiles = new Map(); // id → { username, avatar_url }
    // coach: nur Angebote eines Coaches (Link „Coachings von … ansehen“ im Profil)
    const coachParam = new URLSearchParams(window.location.search).get("coach");
    // Filter wie im Marktplatz: Simulation, Sprache und Nation des Coaches, Preis von–bis, Sortierung
    const FILTER_DEFAULTS = { category: "all", search: "", sim: "", lang: "", country: "", min: "", max: "", sort: "empfohlen" };
    let filter = { ...FILTER_DEFAULTS, coach: /^[\w-]{1,64}$/.test(coachParam || "") ? coachParam : null };
    let currentTab = "angebote";
    const coachScores = new Map(); // coach_id → { score, count } für „Beste Bewertung“
    // Gleiche Simulation, verschiedene Schreibweisen (z. B. „ACC“) → ein Eintrag im Filter
    const SIM_ALIASES = {
        acc: "assetto corsa competizione", "assetto corsa comp": "assetto corsa competizione", ac: "assetto corsa",
        ace: "assetto corsa evo", "ac evo": "assetto corsa evo", lmu: "le mans ultimate", ams2: "automobilista 2",
        rf2: "rfactor 2", rfactor2: "rfactor 2", r3e: "raceroom", "raceroom racing experience": "raceroom",
        gt7: "gran turismo 7", "i racing": "iracing", "f1 2025": "f1 25", beamng: "beamng.drive"
    };
    const simKey = (value) => {
        const key = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
        return SIM_ALIASES[key] || key;
    };
    let editingId = null;
    let bookingOffer = null;
    let timeTarget = null;    // { booking, mode: "accept" | "move" }
    let myPayoutReady = false; // eigenes Stripe-Konto fertig eingerichtet?
    let proIds = new Set();    // Pro-Fahrer der GSRA (eigener Bereich oben)
    let calendarCoaches = new Set(); // Coaches mit freien Zeiten im Kalender (Termin direkt wählen)
    let slotState = null;      // Terminauswahl beim Anfragen: { offer, slots: [Date], day, daysLoaded }
    let selectedSlot = null;
    let reviewsByBooking = new Map(); // Coach-Bewertungen zu den eigenen Anfragen
    let disputesByBooking = new Map(); // Reklamationen („Problem melden“, SQL 035)
    let awayCoaches = new Map();  // Coaches gerade im Urlaub: coach_id → bis (SQL 037)
    let myAway = null;            // eigener Urlaub: { urlaub, geplant, von, bis }
    let editingOffer = null;
    const coachReadyCache = new Map();

    const $ = (id) => document.getElementById(id);
    const canOffer = () => license?.aktiv === true;
    const euro = (cents) => (Number(cents || 0) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    const feeOf = (cents) => Math.round(Number(cents || 0) * feePercent / 100);
    // Rabatt des Coaches (SQL 037): gilt bis einschließlich discount_until (deutsche Zeit); gerechnet wird in der Datenbank
    const berlinToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    const discountActive = (o) => Boolean(o?.discount_percent) && (!o.discount_until || o.discount_until >= berlinToday());
    const priceOf = (o) => (discountActive(o) ? Math.round(o.price_cents * (100 - o.discount_percent) / 100) : o.price_cents);
    const dayText = (isoDate) => new Date(`${isoDate}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const duration = (min) => {
        const h = Math.floor(min / 60), m = min % 60;
        if (!h) return `${m} Min.`;
        const hours = h === 1 ? "1 Std." : `${h} Std.`;
        return m ? `${hours} ${m} Min.` : hours;
    };
    const dateText = (iso) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const dateTime = (iso) => new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const hoursUntil = (iso) => (new Date(iso).getTime() - Date.now()) / 3600000;
    // Wert für <input type="datetime-local"> in Ortszeit
    const localInput = (date) => {
        const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return d.toISOString().slice(0, 16);
    };
    // Server-Funktionen (Stripe) aufrufen; Fehlermeldung des Servers weitergeben
    async function invokeFn(name, body) {
        const { data, error } = await client.functions.invoke(name, { body });
        let message = data?.error;
        if (error) {
            try { message = (await error.context?.json())?.error || message; } catch (e) { /* keine Details */ }
            message = message || "Die Bezahlung ist noch nicht eingerichtet oder gerade nicht erreichbar.";
        }
        if (error || data?.error) throw new Error(message);
        return data;
    }
    // Kann der Coach schon Zahlungen annehmen? (Stripe-Konto eingerichtet)
    const coachReady = (coachId) => {
        if (!coachReadyCache.has(coachId)) {
            coachReadyCache.set(coachId, client.rpc("coach_payment_ready", { _user: coachId }).then(({ data, error }) => !error && data === true, () => false));
        }
        return coachReadyCache.get(coachId);
    };
    const errorText = (error, fallback) => {
        const msg = String(error?.message || "");
        // Eigene Meldungen der Datenbank (deutsch) weitergeben, technische nicht
        return /[äöüß]|Bitte|Coaching|Anfrage|Angebot|Preis|Dauer|Titel|Konto|Coach|Zeit|Termin|Kalender|Reklamation|Problem|Erstatt|Urlaub|Rabatt/.test(msg) && msg.length < 200 ? msg : fallback;
    };
    const nameOf = (id) => profiles.get(id)?.username || "GSRA-Mitglied";
    const chatLink = (userId, title) => `messenger.html?sellerId=${encodeURIComponent(userId)}&sellerName=${encodeURIComponent(nameOf(userId))}&itemTitle=${encodeURIComponent(`Coaching: ${title}`)}`;

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function iconText(tag, className, icon, text) {
        const node = el(tag, className);
        node.innerHTML = `<i class="fa-solid ${icon}"></i> `;
        node.append(text);
        return node;
    }
    function avatar(userId) {
        const box = el("span", "co-avatar");
        const url = profiles.get(userId)?.avatar_url || "";
        if (/^https:\/\//i.test(url)) {
            const img = document.createElement("img");
            img.src = url;
            img.alt = "";
            img.loading = "lazy";
            box.appendChild(img);
        } else {
            box.innerHTML = '<i class="fa-solid fa-user"></i>';
        }
        return box;
    }

    async function loadProfiles(ids) {
        const missing = [...new Set(ids)].filter(id => id && !profiles.has(id));
        if (!missing.length) return;
        const { data } = await client.from("profiles").select("*").in("id", missing);
        (data || []).forEach(p => profiles.set(p.id, p));
    }

    /* ---------- Modale Fenster ---------- */
    function openModal(id) {
        const overlay = $(id);
        overlay.hidden = false;
        document.body.style.overflow = "hidden";
        overlay.querySelector("input:not([type=checkbox]), textarea")?.focus();
    }
    function closeModal(id) {
        $(id).hidden = true;
        if (!document.querySelector(".gsra-dialog-overlay:not([hidden])")) document.body.style.overflow = "";
    }
    document.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-close]");
        if (btn) closeModal(btn.dataset.close);
    });
    ["coOfferModal", "coBookModal", "coTimeModal"].forEach(id => {
        // Nur ein Klick direkt auf den dunklen Hintergrund schließt (nicht beim Markieren von Text im Formular)
        $(id).addEventListener("mousedown", (e) => { if (e.target === e.currentTarget) closeModal(id); });
    });
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const open = ["coTimeModal", "coBookModal", "coOfferModal"].find(id => !$(id).hidden);
        if (open) closeModal(open);
    });

    /* ---------- Tabs ---------- */
    // Jeder Reiter hat eine eigene Adresse (z. B. coaching.html?tab=pro), damit man ihn verlinken kann
    function tabUrl(name) {
        const params = new URLSearchParams();
        if (name !== "angebote") params.set("tab", name);
        if (filter.coach && (name === "angebote" || name === "pro")) params.set("coach", filter.coach);
        const query = params.toString();
        return `coaching.html${query ? `?${query}` : ""}`;
    }
    function showTab(name, { updateUrl = true } = {}) {
        currentTab = name;
        document.querySelectorAll(".co-tab").forEach(t => {
            const active = t.dataset.tab === name;
            t.classList.toggle("active", active);
            t.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll(".co-panel").forEach(p => { p.hidden = p.dataset.panel !== name; });
        $("coFilterArea").hidden = !(name === "angebote" || name === "pro");
        if (updateUrl) history.replaceState(null, "", tabUrl(name));
        if (name === "anfragen") loadBuyerBookings();
        if (name === "coach") loadCoachArea();
    }
    document.querySelectorAll(".co-tab").forEach(t => t.addEventListener("click", () => showTab(t.dataset.tab)));

    // Hinweis oben („Jetzt ansehen“) auf der Coaching-Seite selbst: nur der Anker ändert sich, ohne neu zu laden
    window.addEventListener("hashchange", () => {
        if (window.location.hash === "#reklamation") showTab("coach", { updateUrl: false });
        if (window.location.hash === "#bewerten") showTab("anfragen", { updateUrl: false });
    });

    // Regeln zu Reklamationen im Bereich „Als Coach“: einmal zugeklappt, bleibt es zu (nur in diesem Browser)
    const rulesBox = $("coRules");
    if (rulesBox) {
        try { if (localStorage.getItem("gsra_co_regeln_zu") === "1") rulesBox.open = false; } catch (e) { /* ohne Speicher einfach offen */ }
        rulesBox.addEventListener("toggle", () => {
            try { localStorage.setItem("gsra_co_regeln_zu", rulesBox.open ? "0" : "1"); } catch (e) { /* egal */ }
        });
    }

    /* ---------- Angebote ---------- */
    function renderCategories() {
        const box = $("coCategories");
        box.replaceChildren();
        [["all", "Alle", "fa-layer-group"], ...CATEGORIES.map(c => [c, c, CATEGORY_ICONS[c]])].forEach(([key, label, icon]) => {
            const chip = iconText("button", `co-chip${filter.category === key ? " active" : ""}`, icon, label);
            chip.type = "button";
            chip.addEventListener("click", () => {
                filter.category = key;
                renderCategories();
                renderOffers();
            });
            box.appendChild(chip);
        });
    }

    function priceBlock(offer) {
        const box = el("div", "co-price");
        const price = priceOf(offer);
        if (discountActive(offer)) {
            // Rabatt des Coaches: „−10 %“, alter Preis durchgestrichen, neuer Preis groß
            const line = el("div", "co-price-line");
            line.appendChild(el("span", "co-discount-badge", `−${offer.discount_percent} %`));
            line.appendChild(el("s", "co-price-old", euro(offer.price_cents)));
            line.appendChild(el("strong", "co-price-main", euro(price)));
            box.appendChild(line);
            if (offer.discount_until) box.appendChild(iconText("small", "co-price-note discount", "fa-tag", `Rabatt gilt bis ${dayText(offer.discount_until)}`));
        } else {
            box.appendChild(el("strong", "co-price-main", euro(price)));
        }
        if (offer.coach_id === me) {
            box.appendChild(el("small", "co-price-note", "Dein Angebot – an dich, abzüglich Stripe-Gebühr"));
        } else if (feePercent > 0) {
            box.appendChild(el("small", "co-price-note", `Für dich ${euro(price + feeOf(price))} inkl. ${euro(feeOf(price))} Servicegebühr`));
        } else {
            box.appendChild(iconText("small", "co-price-note free", "fa-crown", "Keine Servicegebühr für dich"));
        }
        return box;
    }

    function offerCard(offer, { pro = false } = {}) {
        const card = el("article", `co-card${pro ? " pro" : ""}`);
        if (pro) card.appendChild(iconText("span", "co-pro-ribbon", "fa-crown", "Pro-Coach"));
        const head = el("div", "co-card-head");
        const coach = el("button", "co-coach");
        coach.type = "button";
        coach.title = "Profil ansehen";
        coach.appendChild(avatar(offer.coach_id));
        const who = el("span", "co-coach-text");
        who.appendChild(el("strong", "", nameOf(offer.coach_id)));
        const badge = el("span", "plan-badge-slot inline");
        who.appendChild(badge);
        coach.appendChild(who);
        coach.addEventListener("click", () => typeof openProfileCard === "function"
            && openProfileCard(offer.coach_id, { sellerName: nameOf(offer.coach_id), itemTitle: `Coaching: ${offer.title}` }));
        if (typeof window.showPlanBadge === "function") window.showPlanBadge(badge, offer.coach_id, { link: false });
        head.appendChild(coach);
        head.appendChild(iconText("span", "co-cat", CATEGORY_ICONS[offer.category] || "fa-tag", offer.category));
        card.appendChild(head);
        // Nation und Sprachen des Coaches („Deutschland · spricht Deutsch, Englisch“)
        const origin = typeof window.gsraOriginLine === "function" ? window.gsraOriginLine(profiles.get(offer.coach_id)) : null;
        if (origin) card.appendChild(origin);

        card.appendChild(el("h3", "co-card-title", offer.title));
        const meta = el("div", "co-meta");
        meta.appendChild(iconText("span", "", "fa-clock", duration(offer.duration_minutes)));
        if (offer.simulation) meta.appendChild(iconText("span", "", "fa-gamepad", offer.simulation));
        if (calendarCoaches.has(offer.coach_id)) meta.appendChild(iconText("span", "co-cal-badge", "fa-calendar-check", "Termin direkt wählen"));
        const away = awayCoaches.has(offer.coach_id);
        if (away) {
            const until = awayCoaches.get(offer.coach_id);
            meta.appendChild(iconText("span", "co-away-badge", "fa-umbrella-beach", until ? `Im Urlaub bis ${dayText(until)}` : "Gerade im Urlaub"));
        }
        card.appendChild(meta);
        if (offer.description) card.appendChild(el("p", "co-desc", offer.description));

        // Zufriedenheit mit dem Coach (Bewertungen nach Coachings), dazu „Bewertungen lesen“
        const rep = el("div", "co-rep");
        card.appendChild(rep);
        if (typeof window.gsraRenderReputation === "function") window.gsraRenderReputation(rep, offer.coach_id, { compact: true, area: "coaching" });
        if (typeof window.gsraReputation === "function") {
            window.gsraReputation(offer.coach_id).then(r => {
                if (!r?.coaching?.anzahl) return;
                const read = iconText("button", "co-link", "fa-comments", "Bewertungen lesen");
                read.type = "button";
                read.addEventListener("click", () => openReviews(offer.coach_id));
                rep.after(read);
            });
        }

        const foot = el("div", "co-card-foot");
        foot.appendChild(priceBlock(offer));
        const actions = el("div", "co-actions");
        if (offer.coach_id === me) {
            const edit = iconText("button", "co-btn", "fa-pen", "Bearbeiten");
            edit.type = "button";
            edit.addEventListener("click", () => openOfferForm(offer));
            actions.appendChild(edit);
        } else {
            const msg = iconText("a", "co-btn", "fa-comment", "Nachricht");
            msg.href = chatLink(offer.coach_id, offer.title);
            actions.appendChild(msg);
            const book = iconText("button", "co-btn primary", "fa-calendar-check", "Anfragen");
            book.type = "button";
            book.addEventListener("click", () => openBooking(offer));
            // Im Urlaub ohne Kalender: keine Anfragen (mit Kalender gibt es Termine nach dem Urlaub)
            if (away && !calendarCoaches.has(offer.coach_id)) {
                book.disabled = true;
                book.title = "Der Coach ist gerade im Urlaub – danach kannst du wieder anfragen.";
            }
            actions.appendChild(book);
            if (isModerator) {
                const del = iconText("button", "co-btn danger", "fa-trash", "Entfernen");
                del.type = "button";
                del.title = "Angebot als Moderation entfernen";
                del.addEventListener("click", () => deleteOffer(offer, true));
                actions.appendChild(del);
                const revoke = iconText("button", "co-btn danger", "fa-ban", "Lizenz entziehen");
                revoke.type = "button";
                revoke.title = "Coach-Lizenz mit Begründung entziehen";
                revoke.addEventListener("click", () => revokeLicense(offer));
                actions.appendChild(revoke);
            }
        }
        foot.appendChild(actions);
        card.appendChild(foot);
        return card;
    }

    // Passt ein Angebot zu Suche und Filtern?
    function matchesFilter(o) {
        const term = filter.search.trim().toLowerCase();
        const coach = profiles.get(o.coach_id) || {};
        const min = filter.min === "" ? null : Number(filter.min) * 100;
        const max = filter.max === "" ? null : Number(filter.max) * 100;
        return (!filter.coach || o.coach_id === filter.coach)
            && (filter.category === "all" || o.category === filter.category)
            && (!filter.sim || simKey(o.simulation) === filter.sim)
            && (!filter.lang || (Array.isArray(coach.languages) && coach.languages.includes(filter.lang)))
            && (!filter.country || coach.country === filter.country)
            && (min === null || !Number.isFinite(min) || priceOf(o) >= min)
            && (max === null || !Number.isFinite(max) || priceOf(o) <= max)
            && (!term || [o.title, o.description, o.simulation, o.category, nameOf(o.coach_id)].some(v => String(v || "").toLowerCase().includes(term)));
    }

    // Sortierung; „Empfohlen“ = neue Angebote zuerst, sonst zufällig je Besuch (gleiche Chance für alle Coaches)
    function sortOffers(list) {
        const sorted = [...list];
        if (filter.sort === "preis-auf") sorted.sort((a, b) => priceOf(a) - priceOf(b));
        else if (filter.sort === "preis-ab") sorted.sort((a, b) => priceOf(b) - priceOf(a));
        else if (filter.sort === "neu") sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        else if (filter.sort === "bewertung") {
            const score = (o) => coachScores.get(o.coach_id) || { score: -1, count: 0 };
            sorted.sort((a, b) => (score(b).score - score(a).score) || (score(b).count - score(a).count));
        }
        return sorted;
    }

    // Zufriedenheit aller Coaches laden (nur für „Beste Bewertung“), danach neu sortieren
    async function loadCoachScores() {
        if (typeof window.gsraReputation !== "function") return;
        const missing = [...new Set(offers.map(o => o.coach_id))].filter(id => !coachScores.has(id));
        if (!missing.length) return;
        await Promise.all(missing.map(async (id) => {
            const c = (await window.gsraReputation(id))?.coaching || {};
            const n = Number(c.anzahl || 0);
            // Schnitt wie in der Anzeige: Ideal 3, In Ordnung 2, Mangelhaft 1, Schlecht 0
            const avg = n ? (3 * (c.ideal || 0) + 2 * (c.in_ordnung || 0) + (c.mangelhaft || 0)) / n : -1;
            coachScores.set(id, { score: avg, count: n });
        }));
    }

    const countText = (n) => n === 1 ? "1 Coaching" : `${n} Coachings`;
    function emptyBox(text) {
        const empty = el("div", "co-empty");
        empty.innerHTML = '<i class="fa-solid fa-chalkboard-user"></i> ';
        empty.append(text);
        return empty;
    }

    // Zwei Bereiche: „Coaches“ (GSRA-Coach-Lizenz) und „Pro-Coaches“ (von der GSRA ausgewählte Pro-Fahrer)
    function renderOffers() {
        const box = $("coOffers");
        const proBox = $("coProOffers");
        renderCoachFilter();
        updateResetButton();
        const list = sortOffers(offers.filter(matchesFilter));
        const proList = list.filter(o => proIds.has(o.coach_id));
        const rest = list.filter(o => !proIds.has(o.coach_id));
        const proTotal = offers.filter(o => proIds.has(o.coach_id)).length;
        const filtered = filterActive();

        box.replaceChildren();
        if (rest.length) rest.forEach(o => box.appendChild(offerCard(o)));
        else box.appendChild(emptyBox(offers.some(o => !proIds.has(o.coach_id))
            ? "Keine Coachings passen zu deiner Suche." : "Noch keine Coachings – sei der Erste!"));
        $("coResultInfo").textContent = filtered ? `${countText(rest.length)} gefunden` : "";

        proBox.replaceChildren();
        if (proList.length) proList.forEach(o => proBox.appendChild(offerCard(o, { pro: true })));
        else proBox.appendChild(emptyBox(proTotal ? "Keine Pro-Coachings passen zu deiner Suche."
            : "Zurzeit bieten keine Pro-Coaches Coachings an. Schau bald wieder vorbei!"));
        $("coProResultInfo").textContent = filtered ? `${countText(proList.length)} gefunden` : "";

        // Hinweis im Bereich „Coaches“: Pro-Coaches gibt es auf einer eigenen Seite
        const teaser = $("coProTeaser");
        teaser.hidden = !proTotal;
        if (proTotal) {
            teaser.innerHTML = '<i class="fa-solid fa-crown"></i> ';
            const text = el("span", "");
            text.appendChild(el("strong", "", "Pro-Coaches"));
            text.append(` – von der GSRA ausgewählte Pro-Fahrer: ${filtered ? `${proList.length} von ${proTotal}` : proTotal} ${proTotal === 1 ? "Coaching" : "Coachings"}`);
            teaser.appendChild(text);
            teaser.appendChild(iconText("span", "co-pro-teaser-go", "fa-arrow-right", "Ansehen"));
        }
    }

    const filterActive = () => Object.keys(FILTER_DEFAULTS).some(k => k !== "sort" && filter[k] !== FILTER_DEFAULTS[k]);
    function updateResetButton() {
        $("coResetFilters").hidden = !filterActive() && filter.sort === FILTER_DEFAULTS.sort;
    }

    // Auswahllisten aus den vorhandenen Angeboten füllen (nur, was es wirklich gibt)
    function fillFilterOptions() {
        const fill = (select, entries, allLabel) => {
            const keep = select.value;
            select.replaceChildren(new Option(allLabel, ""));
            entries.forEach(([value, label]) => select.add(new Option(label, value)));
            select.value = entries.some(([v]) => v === keep) ? keep : "";
        };
        // Simulationen: häufigste Schreibweise je Simulation anzeigen
        const sims = new Map();
        offers.forEach(o => {
            const key = simKey(o.simulation);
            if (!key) return;
            const entry = sims.get(key) || new Map();
            const label = String(o.simulation).trim();
            entry.set(label, (entry.get(label) || 0) + 1);
            sims.set(key, entry);
        });
        // Bekannte Simulationen mit vollem Namen (Vorschlagsliste im Formular), sonst die häufigste Schreibweise
        const known = new Map([...document.querySelectorAll("#coSimList option")].map(o => [simKey(o.value), o.value]));
        const simEntries = [...sims].map(([key, labels]) => [key, known.get(key) || [...labels].sort((a, b) => b[1] - a[1])[0][0]])
            .sort((a, b) => a[1].localeCompare(b[1], "de"));
        fill($("coFilterSim"), simEntries, "Alle Simulationen");

        const coaches = [...new Set(offers.map(o => o.coach_id))].map(id => profiles.get(id) || {});
        const langs = new Set(coaches.flatMap(p => Array.isArray(p.languages) ? p.languages : []));
        fill($("coFilterLang"), (window.GSRA_LANGUAGES || []).filter(([code]) => langs.has(code)), "Alle Sprachen");
        const countries = new Set(coaches.map(p => p.country).filter(Boolean));
        fill($("coFilterCountry"), (window.GSRA_COUNTRIES || []).filter(([code]) => countries.has(code))
            .sort((a, b) => a[1].localeCompare(b[1], "de")), "Alle Nationen");
        // Ohne Angaben (z. B. vor SQL 029) die leeren Listen ausblenden
        $("coFilterSim").hidden = !simEntries.length;
        $("coFilterLang").hidden = !langs.size;
        $("coFilterCountry").hidden = !countries.size;
        filter.sim = $("coFilterSim").value;
        filter.lang = $("coFilterLang").value;
        filter.country = $("coFilterCountry").value;
    }

    // „Coachings von …“ (Sprung aus dem Profil): Hinweis mit Knopf zum Aufheben
    function renderCoachFilter() {
        document.querySelectorAll(".co-coach-filter").forEach(b => b.remove());
        if (!filter.coach) return;
        [$("coOffers"), $("coProOffers")].forEach(target => {
            const bar = el("div", "co-coach-filter");
            bar.appendChild(iconText("span", "", "fa-user", `Coachings von ${nameOf(filter.coach)}`));
            const clear = iconText("button", "co-btn ghost", "fa-xmark", "Alle Coaches zeigen");
            clear.type = "button";
            clear.addEventListener("click", () => {
                filter.coach = null;
                history.replaceState(null, "", tabUrl(currentTab));
                renderOffers();
            });
            bar.appendChild(clear);
            target.before(bar);
        });
    }

    // Bewertungen eines Coaches lesen (neueste zuerst); das Moderationsteam kann unpassende entfernen
    async function openReviews(coachId) {
        document.getElementById("coReviewsDialog")?.remove();
        const overlay = el("div", "gsra-dialog-overlay");
        overlay.id = "coReviewsDialog";
        const dialog = el("div", "gsra-dialog co-dialog co-reviews-dialog");
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.innerHTML = '<button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button><div class="gsra-dialog-icon"><i class="fa-solid fa-comments"></i></div>';
        dialog.appendChild(el("h3", "gsra-dialog-title", `Bewertungen für ${nameOf(coachId)}`));
        const summary = el("div", "co-reviews-summary");
        const listBox = el("div", "co-reviews-list");
        listBox.appendChild(el("p", "co-empty-inline", "Lade …"));
        dialog.append(summary, listBox);
        overlay.appendChild(dialog);
        const close = () => {
            document.removeEventListener("keydown", onKey, true);
            overlay.remove();
            if (!document.querySelector(".gsra-dialog-overlay:not([hidden])")) document.body.style.overflow = "";
        };
        const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
        dialog.querySelector(".gsra-dialog-close").addEventListener("click", close);
        overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
        document.addEventListener("keydown", onKey, true);
        document.body.appendChild(overlay);
        document.body.style.overflow = "hidden";
        if (typeof window.gsraRenderReputation === "function") window.gsraRenderReputation(summary, coachId, { compact: true, area: "coaching" });

        const { data, error } = await client.from("coaching_reviews").select("*").eq("coach_id", coachId)
            .order("created_at", { ascending: false }).limit(30);
        listBox.replaceChildren();
        if (error || !data?.length) {
            listBox.appendChild(el("p", "co-empty-inline", error ? "Bewertungen konnten nicht geladen werden." : "Noch keine Bewertungen."));
            return;
        }
        await loadProfiles(data.map(r => r.buyer_id));
        const LEVEL_OF = { 1: "ideal", 0: "in_ordnung", "-1": "mangelhaft", "-2": "schlecht" };
        const levels = window.GSRA_RATING_LEVELS || {};
        const tagsInfo = window.GSRA_COACH_TAGS || {};
        data.forEach(r => {
            const item = el("article", "co-review");
            const head = el("div", "co-review-head");
            const lvl = LEVEL_OF[r.rating];
            head.appendChild(iconText("span", `rep-chip ${lvl}`, levels[lvl]?.[0] || "fa-star", levels[lvl]?.[1] || ""));
            head.appendChild(el("strong", "", nameOf(r.buyer_id)));
            head.appendChild(el("small", "", dateText(r.updated_at || r.created_at)));
            item.appendChild(head);
            if (r.tags?.length) {
                const tags = el("div", "rep-tags");
                r.tags.filter(t => tagsInfo[t]).forEach(t => tags.appendChild(iconText("span", "rep-tag", tagsInfo[t][0], tagsInfo[t][1])));
                item.appendChild(tags);
            }
            if (r.comment) item.appendChild(el("p", "co-review-text", r.comment));
            if (isModerator && r.buyer_id !== me) {
                const del = iconText("button", "co-btn danger", "fa-trash", "Entfernen");
                del.type = "button";
                del.addEventListener("click", async () => {
                    const ok = await showDialog({ icon: "fa-trash", danger: true, title: "Bewertung entfernen?", message: "Das steht im Moderationsprotokoll.", confirmText: "Entfernen", cancelText: "Abbrechen" });
                    if (!ok) return;
                    const { error: delError } = await client.from("coaching_reviews").delete().eq("id", r.id);
                    if (delError) return showToast("Die Bewertung konnte nicht entfernt werden.", "error");
                    item.remove();
                    window.gsraReputation?.(coachId, { fresh: true });
                    showToast("Bewertung entfernt.", "success");
                });
                item.appendChild(del);
            }
            listBox.appendChild(item);
        });
    }

    let offersRequest = 0; // nur die neueste Abfrage zählt (eine ältere, langsamere überschreibt nichts)
    // Live-Zahlen unter der Überschrift: Coaches, Angebote, Pro-Coaches, Online-Kalender, Rabatte
    function renderStats() {
        const box = $("coStats");
        if (!box) return;
        const coaches = new Set(offers.map(o => o.coach_id));
        const pros = [...coaches].filter(id => proIds.has(id)).length;
        const withCalendar = [...coaches].filter(id => calendarCoaches.has(id)).length;
        const discounts = offers.filter(discountActive).length;
        const items = [
            ["fa-user-tie", coaches.size, coaches.size === 1 ? "Coach" : "Coaches"],
            ["fa-chalkboard-user", offers.length, offers.length === 1 ? "Angebot" : "Angebote"],
            pros ? ["fa-crown", pros, pros === 1 ? "Pro-Coach" : "Pro-Coaches"] : null,
            withCalendar ? ["fa-calendar-check", withCalendar, "mit Online-Kalender"] : null,
            discounts ? ["fa-tag", discounts, discounts === 1 ? "Angebot mit Rabatt" : "Angebote mit Rabatt"] : null
        ].filter(Boolean);
        box.replaceChildren(...items.map(([icon, n, label]) => {
            const item = el("span", "co-stat");
            item.innerHTML = `<i class="fa-solid ${icon}"></i>`;
            item.append(el("strong", "", String(n)), el("span", "", label));
            return item;
        }));
        box.hidden = !offers.length;
    }

    async function loadOffers() {
        const request = ++offersRequest;
        const [{ data, error }, pros, cal, away] = await Promise.all([
            client.from("coaching_offers").select("*").eq("active", true).order("created_at", { ascending: false }).limit(300),
            client.from("pro_creators").select("user_id"),
            client.rpc("coaching_calendar_coaches"),
            client.rpc("coaching_away_coaches")
        ]);
        if (request !== offersRequest) return;
        proIds = new Set((pros.data || []).map(p => p.user_id));
        // Ohne SQL 037 gibt es den Urlaubsmodus noch nicht: dann einfach ohne Hinweis
        awayCoaches = new Map(away.error ? [] : (away.data || []).map(a => [a.coach_id, a.bis || null]));
        // Ohne SQL 030 gibt es die Funktion noch nicht: dann einfach ohne Kalender-Hinweis
        calendarCoaches = new Set(cal.error ? [] : (cal.data || []).map(r => (typeof r === "string" ? r : r?.coaching_calendar_coaches)).filter(Boolean));
        if (error) {
            $("coOffers").replaceChildren(el("div", "co-empty", "Coachings konnten nicht geladen werden. Bitte lade die Seite neu."));
            return;
        }
        // Gleiche Chance für alle Coaches: neue Angebote zuerst, sonst zufällige Reihenfolge je Besuch
        const fresh = (data || []).filter(o => Date.now() - new Date(o.created_at).getTime() < 3 * 86400000);
        const rest = (data || []).filter(o => !fresh.includes(o));
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        await loadProfiles((data || []).map(o => o.coach_id));
        if (request !== offersRequest) return;
        offers = [...fresh, ...rest];
        renderStats();
        fillFilterOptions();
        if (filter.sort === "bewertung") await loadCoachScores();
        if (request !== offersRequest) return;
        renderOffers();
    }

    $("coSearch").addEventListener("input", (e) => {
        filter.search = e.target.value;
        renderOffers();
    });
    [["coFilterSim", "sim"], ["coFilterLang", "lang"], ["coFilterCountry", "country"]].forEach(([id, key]) => {
        $(id).addEventListener("change", (e) => {
            filter[key] = e.target.value;
            renderOffers();
        });
    });
    [["coMinPrice", "min"], ["coMaxPrice", "max"]].forEach(([id, key]) => {
        $(id).addEventListener("input", (e) => {
            const value = e.target.value.trim();
            filter[key] = value !== "" && Number(value) >= 0 ? value : "";
            renderOffers();
        });
    });
    $("coSort").addEventListener("change", async (e) => {
        filter.sort = e.target.value;
        if (filter.sort === "bewertung") {
            $("coResultInfo").textContent = "Lade Bewertungen …";
            await loadCoachScores();
        }
        renderOffers();
    });
    $("coResetFilters").addEventListener("click", () => {
        Object.assign(filter, FILTER_DEFAULTS);
        ["coSearch", "coMinPrice", "coMaxPrice", "coFilterSim", "coFilterLang", "coFilterCountry"].forEach(id => { $(id).value = ""; });
        $("coSort").value = FILTER_DEFAULTS.sort;
        renderCategories();
        renderOffers();
    });
    $("coProTeaser").addEventListener("click", () => {
        showTab("pro");
        // Reiter knapp unter der festen Kopfzeile zeigen
        const header = document.querySelector("header");
        const top = document.querySelector(".co-tabs").getBoundingClientRect().top + window.scrollY - (header?.offsetHeight || 0) - 12;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });

    /* ---------- Angebot anlegen / bearbeiten ---------- */
    function openOfferForm(offer = null) {
        if (!offer && !canOffer()) {
            openLicenseDialog();
            return;
        }
        editingId = offer?.id || null;
        editingOffer = offer;
        $("coOfferTitle").textContent = offer ? "Coaching bearbeiten" : "Coaching anbieten";
        // Rabatt (SQL 037): leer = kein Rabatt; abgelaufene Rabatte erscheinen nicht mehr
        $("coDiscount").value = discountActive(offer) ? String(offer.discount_percent) : "";
        $("coDiscountUntil").min = berlinToday();
        $("coDiscountUntil").value = discountActive(offer) && offer.discount_until ? offer.discount_until : "";
        $("coTitle").value = offer?.title || "";
        $("coCategory").value = offer?.category || "Fahrtechnik";
        $("coSim").value = offer?.simulation || "";
        const dur = $("coDuration");
        const minutes = String(offer?.duration_minutes || 60);
        if (![...dur.options].some(o => o.value === minutes)) dur.add(new Option(duration(Number(minutes)), minutes));
        dur.value = minutes;
        $("coPrice").value = offer ? (offer.price_cents / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 }) : "";
        $("coDescription").value = offer?.description || "";
        $("coActive").checked = offer ? offer.active : true;
        // Ohne Lizenz lassen sich eigene Angebote nur noch pausieren, nicht wieder einschalten
        $("coActive").disabled = !canOffer() && !offer?.active;
        // Hinweis im Formular, solange Kunden noch nicht bezahlen können
        $("coOfferForm").querySelector(".co-stripe-note")?.remove();
        if (canOffer() && !myPayoutReady) {
            const note = iconText("p", "co-form-note co-wide co-stripe-note", "fa-credit-card",
                "Noch nicht mit Stripe verbunden: Dein Angebot ist sichtbar, bezahlen können Kunden aber erst, wenn du Stripe eingerichtet hast.");
            $("coOfferForm").querySelector(".gsra-dialog-actions").before(note);
        }
        openModal("coOfferModal");
    }
    $("coOfferBtn").addEventListener("click", () => openOfferForm());

    /* ---------- GSRA-Coach-Lizenz ---------- */
    const LEVEL_NAMES = [[2.5, "Ideal"], [1.75, "In Ordnung"], [1, "Mangelhaft"], [0, "Schlecht"]];
    const levelName = (avg) => (LEVEL_NAMES.find(([min]) => Number(avg) >= min) || LEVEL_NAMES[3])[1];

    async function loadLicense() {
        const { data, error } = await client.rpc("coach_license_status", { _user: me });
        license = error ? null : data;
        return license;
    }

    // Die vier Voraussetzungen mit Fortschritt (Regeln kommen aus der Datenbank)
    function criteriaList(status) {
        const r = status?.regeln || {};
        const p = status?.fortschritt || {};
        const ok = p.erfuellt || {};
        const list = el("ul", "co-criteria");
        const item = (done, title, detail) => {
            const li = el("li", done ? "done" : "");
            li.innerHTML = `<i class="fa-solid ${done ? "fa-circle-check" : "fa-circle"}"></i>`;
            const text = el("span", "");
            text.appendChild(el("strong", "", title));
            text.appendChild(el("small", "", detail));
            li.appendChild(text);
            list.appendChild(li);
        };
        item(ok.dauer, `Mindestens ${Math.round((r.mitglied_tage || 90) / 30)} Monate Mitglied`,
            `${Math.min(p.mitglied_tage || 0, r.mitglied_tage || 90)} von ${r.mitglied_tage || 90} Tagen`);
        item(ok.setups, `${r.setup_punkte || 25} Setup-Punkte`, `${p.setup_punkte || 0} von ${r.setup_punkte || 25} Punkten (Likes minus Dislikes deiner Setups)`);
        item(ok.bewertungen, `${r.bewertungen || 5} Bewertungen mit Ø „Ideal“`,
            p.bewertungen ? `${p.bewertungen} Bewertung${p.bewertungen === 1 ? "" : "en"}, Ø „${levelName(p.schnitt)}“ (Marktplatz und Setups)` : "Noch keine Bewertungen (Marktplatz und Setups)");
        item(ok.verhalten, "Faires Verhalten", `Keine Sperre und keine Verwarnung in den letzten ${r.ruhe_tage || 90} Tagen`);
        return list;
    }

    function openLicenseDialog() {
        document.getElementById("coLicenseDialog")?.remove();
        const overlay = el("div", "gsra-dialog-overlay");
        overlay.id = "coLicenseDialog";
        const dialog = el("div", "gsra-dialog co-dialog co-license-dialog");
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.innerHTML = '<button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button><div class="gsra-dialog-icon"><i class="fa-solid fa-award"></i></div>';
        dialog.appendChild(el("h3", "gsra-dialog-title", "GSRA-Coach-Lizenz"));
        const body = el("div", "co-license-body");
        dialog.appendChild(body);
        const actions = el("div", "gsra-dialog-actions");
        dialog.appendChild(actions);
        overlay.appendChild(dialog);
        const close = () => {
            document.removeEventListener("keydown", onKey, true);
            overlay.remove();
            if (!document.querySelector(".gsra-dialog-overlay:not([hidden])")) document.body.style.overflow = "";
        };
        const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
        dialog.querySelector(".gsra-dialog-close").addEventListener("click", close);
        overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
        document.addEventListener("keydown", onKey, true);
        document.body.appendChild(overlay);
        document.body.style.overflow = "hidden";

        const render = () => {
            body.replaceChildren();
            actions.replaceChildren();
            const closeBtn = el("button", "gsra-dialog-btn secondary", "Schließen");
            closeBtn.type = "button";
            closeBtn.addEventListener("click", close);
            if (!license) {
                body.appendChild(el("p", "co-license-intro", "Die Coach-Lizenz ist gerade nicht verfügbar. Bitte versuche es später erneut."));
                actions.appendChild(closeBtn);
                return;
            }
            if (license.aktiv) {
                body.appendChild(el("p", "co-license-intro", license.pro && !license.erteilt_am
                    ? "Die GSRA hat dich als Pro-Coach ausgewählt. Du kannst eigene Coachings anbieten."
                    : `Deine Lizenz ist aktiv${license.erteilt_am ? ` seit ${dateText(license.erteilt_am)}` : ""}. Du kannst eigene Coachings anbieten.`));
                // Nächster Schritt direkt hier: ohne Stripe-Konto können Kunden nicht bezahlen
                if (!myPayoutReady) {
                    body.appendChild(iconText("p", "co-license-revoked co-license-next", "fa-credit-card",
                        "Nächster Schritt: Verbinde dich mit Stripe, damit Kunden bezahlen können. Das dauert nur ein paar Minuten."));
                    const stripeBtn = el("button", "gsra-dialog-btn primary", "Jetzt mit Stripe verbinden");
                    stripeBtn.type = "button";
                    stripeBtn.addEventListener("click", () => {
                        close();
                        const prompt = $("coStripePrompt");
                        const btn = prompt.querySelector(".co-btn.primary");
                        if (payoutData && btn) return startStripeOnboarding(btn);
                        prompt.scrollIntoView({ behavior: "smooth", block: "center" });
                        prompt.querySelector("select, .co-btn.primary")?.focus();
                    });
                    actions.append(closeBtn, stripeBtn);
                    return;
                }
                const offerBtn = el("button", "gsra-dialog-btn primary", "Coaching anbieten");
                offerBtn.type = "button";
                offerBtn.addEventListener("click", () => { close(); openOfferForm(); });
                actions.append(closeBtn, offerBtn);
                return;
            }
            const revoked = license.entzogen;
            // Dauerhaft entzogen (SQL 036): keine Voraussetzungen mehr, nur die Begründung
            if (revoked?.dauerhaft) {
                body.appendChild(iconText("div", "co-license-revoked", "fa-user-lock",
                    `Die GSRA hat dir die Coach-Lizenz am ${dateText(revoked.am)} dauerhaft entzogen. Begründung: ${revoked.grund || "–"}`));
                body.appendChild(el("p", "co-license-intro", "Mit diesem Konto kannst du keine Coachings mehr anbieten – auch später nicht. Alles andere auf GSRA kannst du weiter nutzen. Hältst du die Entscheidung für einen Irrtum, schreib uns (Kontakt im Impressum)."));
                actions.appendChild(closeBtn);
                return;
            }
            body.appendChild(el("p", "co-license-intro", "Coach wird man bei der GSRA über Leistung in der Community, nicht über ein Abo. Sind alle vier Punkte erfüllt, holst du dir die Lizenz hier."));
            if (revoked) {
                const note = el("div", "co-license-revoked");
                note.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ';
                note.append(revoked.automatisch
                    ? `Deine Lizenz wurde am ${dateText(revoked.am)} automatisch entzogen (${String(revoked.grund || "").replace(/^Automatisch:\s*/, "")}). Sobald alle Punkte wieder erfüllt sind, kannst du sie erneut holen.`
                    : `Das Moderationsteam hat deine Lizenz am ${dateText(revoked.am)} entzogen. Begründung: ${revoked.grund || "–"}`);
                body.appendChild(note);
            }
            body.appendChild(criteriaList(license));
            body.appendChild(iconText("p", "co-form-note", "fa-scale-balanced",
                "Gut zu wissen: Kunden können ab Terminbeginn bis 7 Tage danach ein Problem melden. Du bekommst dann eine E-Mail und einen Hinweis auf jeder GSRA-Seite und hast 5 Tage Zeit zu antworten."));
            const blocked = revoked && !revoked.automatisch;
            const ready = license.fortschritt?.alle === true && !blocked;
            const claim = el("button", "gsra-dialog-btn primary", ready ? "Lizenz holen" : "Noch nicht alles erfüllt");
            claim.type = "button";
            claim.disabled = !ready;
            claim.addEventListener("click", async () => {
                claim.disabled = true;
                const { error } = await client.rpc("coach_claim_license");
                if (error) {
                    claim.disabled = false;
                    showToast(errorText(error, "Die Lizenz konnte nicht vergeben werden."), "error");
                    return;
                }
                showToast("Glückwunsch – du bist jetzt GSRA-Coach!", "success");
                await refreshLicenseUi();
                render();
            });
            actions.append(closeBtn, claim);
        };
        render();
        loadLicense().then(render);
    }

    // Lizenz-Box im Bereich „Als Coach“ und Knopf oben
    function renderLicenseBox() {
        const box = $("coLicense");
        if (!box) return;
        box.hidden = !license;
        if (!license) return;
        box.className = `co-license ${license.aktiv ? "active" : ""}`;
        box.replaceChildren();
        const head = el("div", "co-payout-head");
        head.innerHTML = '<i class="fa-solid fa-award"></i>';
        const text = el("div", "co-payout-text");
        if (license.aktiv && license.pro && !license.erteilt_am) {
            text.appendChild(el("strong", "", "Pro-Coach der GSRA"));
            text.appendChild(el("span", "", "Die GSRA hat dich als Pro-Fahrer ausgewählt: Du coachst ohne Lizenz und erscheinst oben im Pro-Bereich. Verwarnungen oder Sperren stoppen das Coaching automatisch."));
        } else if (license.aktiv) {
            text.appendChild(el("strong", "", license.pro ? "Pro-Coach der GSRA" : "GSRA-Coach-Lizenz aktiv"));
            text.appendChild(el("span", "", `Seit ${license.erteilt_am ? dateText(license.erteilt_am) : "–"}. Bleib fair und zuverlässig: Verwarnungen oder Sperren entziehen die Lizenz automatisch.`));
        } else {
            const done = Object.values(license.fortschritt?.erfuellt || {}).filter(Boolean).length;
            if (license.entzogen?.dauerhaft) {
                box.classList.add("banned");
                head.innerHTML = '<i class="fa-solid fa-user-lock"></i>';
                text.appendChild(el("strong", "", "Coach-Lizenz dauerhaft entzogen"));
                text.appendChild(el("span", "", `Begründung: ${String(license.entzogen.grund || "–").replace(/[.!]\s*$/, "")}. Mit diesem Konto kannst du keine Coachings mehr anbieten.`));
            } else {
                text.appendChild(el("strong", "", license.entzogen ? "Coach-Lizenz entzogen" : "Noch keine Coach-Lizenz"));
                text.appendChild(el("span", "", `${done} von 4 Voraussetzungen erfüllt. Coach wird man über Setups, gute Bewertungen und faires Verhalten.`));
            }
        }
        head.appendChild(text);
        const actions = el("div", "co-actions");
        const btn = iconText("button", `co-btn ${license.aktiv || license.entzogen?.dauerhaft ? "" : "primary"}`, "fa-list-check",
            license.aktiv || license.entzogen?.dauerhaft ? "Details" : "Voraussetzungen ansehen");
        btn.type = "button";
        btn.addEventListener("click", openLicenseDialog);
        actions.appendChild(btn);
        box.append(head, actions);
    }

    function updateOfferButton() {
        const btn = $("coOfferBtn");
        btn.replaceChildren();
        btn.insertAdjacentHTML("afterbegin", `<i class="fa-solid ${canOffer() ? "fa-plus" : "fa-award"}"></i> `);
        btn.append(canOffer() ? "Coaching anbieten" : "Coach werden");
        btn.title = canOffer() ? "" : "Coach wird man mit der GSRA-Coach-Lizenz – über Setups, Bewertungen und faires Verhalten.";
    }

    /* ---------- Urlaubsmodus (SQL 037) ---------- */
    async function loadAway() {
        if (!canOffer()) {
            myAway = null;
            renderAway();
            return;
        }
        const { data, error } = await client.rpc("coach_away_info", { _user: me });
        myAway = error ? undefined : data; // undefined = ohne SQL 037: Bereich ausblenden
        renderAway();
    }

    const awayRange = (a) => a.bis ? `bis ${dayText(a.bis)}` : "ohne Enddatum – bis du ihn beendest";

    function renderAway() {
        const box = $("coAway");
        const banner = $("coAwayBanner");
        if (!box || !banner) return;
        box.hidden = !canOffer() || myAway === undefined;
        banner.hidden = !(myAway?.urlaub);
        if (box.hidden) return;
        const a = myAway || { urlaub: false };
        box.className = `co-away${a.urlaub ? " active" : a.geplant ? " planned" : ""}`;
        box.replaceChildren();
        const head = el("div", "co-payout-head");
        head.innerHTML = '<i class="fa-solid fa-umbrella-beach"></i>';
        const text = el("div", "co-payout-text");
        if (a.urlaub) {
            text.appendChild(el("strong", "", "Du bist im Urlaub"));
            text.appendChild(el("span", "", `Seit ${dayText(a.von)}, ${awayRange(a)}. In dieser Zeit gibt es keine freien Termine; andere sehen „Im Urlaub“.`));
        } else if (a.geplant) {
            text.appendChild(el("strong", "", "Urlaub geplant"));
            text.appendChild(el("span", "", `Ab ${dayText(a.von)}, ${awayRange(a)}. Er startet und endet von selbst.`));
        } else {
            text.appendChild(el("strong", "", "Urlaubsmodus"));
            text.appendChild(el("span", "", "Weg, im Urlaub oder Prüfungsstress? Mit einem Klick bist du nicht buchbar – oder plane einen Zeitraum, der von selbst endet."));
        }
        head.appendChild(text);
        const actions = el("div", "co-actions");
        const btn = (cls, icon, label, onClick) => {
            const b = iconText("button", `co-btn ${cls}`, icon, label);
            b.type = "button";
            b.addEventListener("click", () => onClick(b));
            actions.appendChild(b);
        };
        if (a.urlaub || a.geplant) {
            btn("primary", a.urlaub ? "fa-plane-arrival" : "fa-xmark", a.urlaub ? "Urlaub beenden" : "Planung löschen", (b) => endAway(b));
            btn("", "fa-calendar-days", "Zeitraum ändern", () => openAwayDialog());
        } else {
            btn("primary", "fa-umbrella-beach", "Ab jetzt im Urlaub", (b) => setAway(null, null, b));
            btn("", "fa-calendar-days", "Zeitraum planen", () => openAwayDialog());
        }
        box.append(head, actions);

        // Hinweis oben auf der Coaching-Seite, damit man das Beenden nicht vergisst
        banner.replaceChildren();
        if (a.urlaub) {
            banner.appendChild(iconText("span", "co-away-banner-text", "fa-umbrella-beach", `Du bist im Urlaubsmodus (${awayRange(a)}). Kunden können dich in dieser Zeit nicht buchen.`));
            const end = iconText("button", "co-btn primary", "fa-plane-arrival", "Urlaub beenden");
            end.type = "button";
            end.addEventListener("click", () => endAway(end));
            banner.appendChild(end);
        }
    }

    async function setAway(from, until, btn) {
        if (btn) btn.disabled = true;
        const { data, error } = await client.rpc("coach_set_away", { _from: from, _until: until });
        if (btn) btn.disabled = false;
        if (error) return showToast(errorText(error, "Der Urlaub konnte nicht gespeichert werden."), "error"), false;
        showToast(data?.bis ? `Urlaub eingetragen: ${dayText(data.von)} bis ${dayText(data.bis)}.` : "Urlaubsmodus an – bis du ihn beendest.", "success");
        if (data?.betroffen > 0) {
            showDialog({
                icon: "fa-triangle-exclamation", title: "Termine in deinem Urlaub",
                message: `${data.betroffen === 1 ? "1 bestehender Termin fällt" : `${data.betroffen} bestehende Termine fallen`} in diesen Zeitraum. Neue Buchungen sind gesperrt, bestehende bleiben. Halte sie ein oder sag sie unter „Anfragen an dich“ ab (Bezahltes wird dann voll erstattet).`,
                confirmText: "Verstanden"
            });
        }
        await loadAway();
        loadOffers();
        return true;
    }

    async function endAway(btn) {
        btn.disabled = true;
        const { error } = await client.rpc("coach_end_away");
        btn.disabled = false;
        if (error) return showToast(errorText(error, "Das hat nicht geklappt."), "error");
        showToast("Willkommen zurück! Du bist wieder buchbar.", "success");
        await loadAway();
        loadOffers();
    }

    // Zeitraum planen: von (ab heute) und bis (optional); die Datumsfelder zeigt datum-zeit.js im GSRA-Design
    function openAwayDialog() {
        document.getElementById("coAwayDialog")?.remove();
        const overlay = el("div", "gsra-dialog-overlay");
        overlay.id = "coAwayDialog";
        const dialog = el("div", "gsra-dialog co-dialog co-away-dialog");
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.innerHTML = '<button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button><div class="gsra-dialog-icon"><i class="fa-solid fa-umbrella-beach"></i></div>';
        dialog.appendChild(el("h3", "gsra-dialog-title", "Urlaub planen"));
        const form = el("form", "co-form");
        const field = (label, input) => {
            const wrap = el("label", "co-field");
            wrap.appendChild(el("span", "", label));
            wrap.appendChild(input);
            return wrap;
        };
        const today = berlinToday();
        const maxDay = new Date(Date.now() + 365 * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
        const from = document.createElement("input");
        from.type = "date";
        from.required = true;
        from.min = today;
        from.max = maxDay;
        from.value = myAway?.von && myAway.von >= today ? myAway.von : today;
        const until = document.createElement("input");
        until.type = "date";
        until.min = today;
        until.dataset.placeholder = "ohne Enddatum";
        until.value = myAway?.bis || "";
        from.addEventListener("change", () => { until.min = from.value || today; });
        form.append(field("Von", from), field("Bis (optional)", until));
        form.appendChild(iconText("p", "co-form-note co-wide", "fa-circle-info",
            "In dieser Zeit gibt es keine freien Termine und keine neuen Anfragen; andere sehen „Im Urlaub bis …“. Ohne Enddatum bleibt der Urlaub an, bis du ihn beendest. Bestehende Termine bleiben bestehen."));
        const actions = el("div", "gsra-dialog-actions co-wide");
        const cancel = el("button", "gsra-dialog-btn secondary", "Abbrechen");
        cancel.type = "button";
        const save = el("button", "gsra-dialog-btn primary", "Speichern");
        save.type = "submit";
        actions.append(cancel, save);
        form.appendChild(actions);
        dialog.appendChild(form);
        overlay.appendChild(dialog);
        const close = () => {
            document.removeEventListener("keydown", onKey, true);
            overlay.remove();
            if (!document.querySelector(".gsra-dialog-overlay:not([hidden])")) document.body.style.overflow = "";
        };
        const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
        dialog.querySelector(".gsra-dialog-close").addEventListener("click", close);
        cancel.addEventListener("click", close);
        overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
        document.addEventListener("keydown", onKey, true);
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!from.value) return showToast("Bitte wähle, ab wann du im Urlaub bist.", "error");
            if (until.value && until.value < from.value) return showToast("Das Ende liegt vor dem Beginn.", "error");
            save.disabled = true;
            const ok = await setAway(from.value, until.value || null);
            save.disabled = false;
            if (ok) close();
        });
        document.body.appendChild(overlay);
        document.body.style.overflow = "hidden";
    }

    async function refreshLicenseUi() {
        await loadLicense();
        updateOfferButton();
        renderLicenseBox();
        loadAway();
        await loadPayout();
        if (!$("coMyOffers").closest(".co-panel").hidden) await Promise.all([loadMyOffers(), loadCalendar()]);
    }

    // Moderation: Lizenz eines Coaches mit Begründung entziehen (Angebote werden pausiert, steht im Protokoll)
    async function revokeLicense(offer) {
        const reason = await showDialog({
            icon: "fa-ban", danger: true, title: `${nameOf(offer.coach_id)} die Coach-Lizenz entziehen?`,
            message: "Alle Angebote werden pausiert, bezahlte Coachings bleiben erstattbar. Die Begründung sieht der Coach und das Protokoll.",
            input: { placeholder: "Begründung (mindestens 5 Zeichen)", maxLength: 300, multiline: true },
            confirmText: "Lizenz entziehen", cancelText: "Abbrechen"
        });
        if (!reason) return;
        const { error } = await client.rpc("coach_license_revoke", { _user: offer.coach_id, _reason: reason });
        if (error) {
            showToast(errorText(error, "Die Lizenz konnte nicht entzogen werden."), "error");
            return;
        }
        showToast("Lizenz entzogen, Angebote pausiert.", "success");
        loadOffers();
    }

    $("coOfferForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const raw = $("coPrice").value.trim().replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
        const price = Math.round(Number(raw) * 100);
        if (!Number.isFinite(price) || price < 500 || price > 100000) {
            showToast("Der Preis muss zwischen 5 € und 1.000 € liegen.", "error");
            $("coPrice").focus();
            return;
        }
        if ($("coTitle").value.trim().length < 3) {
            showToast("Bitte gib einen Titel mit mindestens 3 Zeichen an.", "error");
            $("coTitle").focus();
            return;
        }
        const discountRaw = $("coDiscount").value.trim();
        const discount = discountRaw === "" ? 0 : Number(discountRaw.replace(",", "."));
        if (discount !== 0 && (!Number.isInteger(discount) || discount < 5 || discount > 70)) {
            showToast("Der Rabatt muss eine ganze Zahl zwischen 5 und 70 Prozent sein – oder leer bleiben.", "error");
            $("coDiscount").focus();
            return;
        }
        const discountUntil = discount ? ($("coDiscountUntil").value || null) : null;
        const submit = e.submitter || $("coOfferForm").querySelector("[type=submit]");
        submit.disabled = true;
        const { data: savedId, error } = await client.rpc("coaching_save_offer", {
            _id: editingId, _title: $("coTitle").value.trim(), _description: $("coDescription").value.trim(),
            _category: $("coCategory").value, _simulation: $("coSim").value.trim(),
            _duration: Number($("coDuration").value), _price_cents: price, _active: $("coActive").checked
        });
        if (error) {
            submit.disabled = false;
            showToast(errorText(error, "Das Angebot konnte nicht gespeichert werden."), "error");
            return;
        }
        // Rabatt nur speichern, wenn er sich geändert hat
        const oldDiscount = discountActive(editingOffer) ? editingOffer.discount_percent : 0;
        const oldUntil = discountActive(editingOffer) ? (editingOffer.discount_until || null) : null;
        const offerId = editingId || (typeof savedId === "string" ? savedId : savedId?.id);
        if (offerId && (discount !== oldDiscount || discountUntil !== oldUntil)) {
            const { error: discountError } = await client.rpc("coaching_set_discount", { _offer_id: offerId, _percent: discount, _until: discountUntil });
            if (discountError) showToast(errorText(discountError, "Der Rabatt konnte nicht gespeichert werden."), "error");
        }
        submit.disabled = false;
        closeModal("coOfferModal");
        const isNew = !editingId;
        showToast(isNew ? "Dein Coaching ist online." : "Angebot gespeichert.", "success");
        await Promise.all([loadOffers(), loadMyOffers()]);
        // Neues Angebot ohne Stripe-Konto: gleich auf die Verbindung hinweisen; danach auf den Kalender
        if (isNew) {
            await promptStripeConnect("Dein Coaching ist online.");
            if (calendarState && !calendarState.saved) showToast("Tipp: Trag unter „Als Coach“ deine freien Zeiten ein – dann wählen Kunden direkt einen Termin.", "info");
        }
    });

    async function deleteOffer(offer, asModerator = false) {
        const ok = await showDialog({
            icon: "fa-trash", danger: true, title: asModerator ? "Angebot entfernen?" : "Angebot löschen?",
            message: asModerator
                ? `„${offer.title}“ von ${nameOf(offer.coach_id)} wird entfernt. Das steht im Moderationsprotokoll.`
                : `„${offer.title}“ wird gelöscht. Bestehende Anfragen bleiben erhalten.`,
            confirmText: asModerator ? "Entfernen" : "Löschen", cancelText: "Abbrechen"
        });
        if (!ok) return;
        const { data, error } = await client.from("coaching_offers").delete().eq("id", offer.id).select("id");
        if (error || !data?.length) {
            showToast("Das Angebot konnte nicht gelöscht werden.", "error");
            return;
        }
        showToast(asModerator ? "Angebot entfernt." : "Angebot gelöscht.", "success");
        await Promise.all([loadOffers(), loadMyOffers()]);
    }

    /* ---------- Anfragen ---------- */
    function openBooking(offer) {
        bookingOffer = offer;
        $("coBookSub").textContent = `${offer.title} · ${duration(offer.duration_minutes)} mit ${nameOf(offer.coach_id)}`;
        const table = $("coBookPrice");
        table.replaceChildren();
        const row = (label, value, cls = "") => {
            const dt = el("dt", cls, label);
            const dd = el("dd", cls, value);
            table.append(dt, dd);
        };
        const price = priceOf(offer);
        const fee = feeOf(price);
        row("Preis des Coaches", discountActive(offer) ? `${euro(price)} (statt ${euro(offer.price_cents)}, −${offer.discount_percent} %)` : euro(price));
        row(feePercent ? "Servicegebühr (10 %, Paddock)" : "Servicegebühr (Pole/Alliance)", feePercent ? euro(fee) : "entfällt");
        row("Gesamt", euro(price + fee), "total");
        $("coBookTime").value = "";
        $("coBookMessage").value = "";
        // Hat der Coach einen Kalender, wählt man einen freien Termin; sonst Wunschtermin als Text
        slotState = null;
        selectedSlot = null;
        const picker = $("coSlotPicker");
        const withCalendar = calendarCoaches.has(offer.coach_id);
        picker.hidden = !withCalendar;
        picker.replaceChildren(iconText("p", "co-slots-loading", "fa-spinner fa-spin", "Lade freie Termine …"));
        $("coBookTimeField").hidden = withCalendar;
        setBookNote(withCalendar);
        openModal("coBookModal");
        if (withCalendar) loadSlots(offer);
    }

    function setBookNote(withCalendar) {
        const note = $("coBookNote");
        note.innerHTML = '<i class="fa-solid fa-circle-info"></i> ';
        note.append(withCalendar
            ? "Du wählst einen freien Termin aus dem Kalender des Coaches, er bestätigt ihn mit einem Klick. Danach bezahlst du sicher über Stripe. Kostenlos stornieren kannst du bis 24 Stunden vor dem Termin."
            : "Der Coach bestätigt deine Anfrage mit einem festen Termin. Danach bezahlst du sicher über Stripe. Kostenlos stornieren kannst du bis 24 Stunden vor dem Termin.");
    }

    // Freie Termine laden (zuerst 4 Wochen, auf Wunsch weitere); ohne Kalender zurück zum Wunschtermin
    async function loadSlots(offer, more = false) {
        const from = more && slotState ? isoDay(new Date(Date.now() + slotState.daysLoaded * 86400000)) : null;
        const { data, error } = await client.rpc("coaching_free_slots", { _offer_id: offer.id, _from: from, _days: 28 });
        if (bookingOffer !== offer) return; // Fenster inzwischen für ein anderes Angebot geöffnet
        if (error || !data?.kalender) {
            if (more) return showToast(errorText(error, "Weitere Termine konnten nicht geladen werden."), "error");
            slotState = null;
            $("coSlotPicker").hidden = true;
            $("coBookTimeField").hidden = false;
            setBookNote(false);
            return;
        }
        const fresh = (data.slots || []).map(s => new Date(s)).filter(d => !Number.isNaN(d.getTime()));
        if (more && slotState) {
            const known = new Set(slotState.slots.map(d => d.getTime()));
            slotState.slots = [...slotState.slots, ...fresh.filter(d => !known.has(d.getTime()))].sort((a, b) => a - b);
            slotState.daysLoaded += 28;
        } else {
            slotState = { offer, slots: fresh, day: null, daysLoaded: 28 };
        }
        renderSlots();
    }

    function renderSlots() {
        const picker = $("coSlotPicker");
        const st = slotState;
        if (!st) return;
        const scroll = picker.querySelector(".co-slot-days")?.scrollLeft || 0;
        picker.replaceChildren();
        const head = el("div", "co-slots-head");
        head.appendChild(iconText("strong", "", "fa-calendar-days", "Freien Termin wählen"));
        head.appendChild(el("small", "", `Uhrzeiten in deiner Zeitzone (${myTimeZone})`));
        picker.appendChild(head);
        const moreBtn = () => {
            if (st.daysLoaded >= 56) return null;
            const more = iconText("button", "co-link co-slots-more", "fa-angles-right", "Spätere Termine anzeigen");
            more.type = "button";
            more.addEventListener("click", () => {
                more.disabled = true;
                loadSlots(st.offer, true);
            });
            return more;
        };
        if (!st.slots.length) {
            const empty = el("div", "co-slots-empty");
            empty.appendChild(iconText("p", "", "fa-calendar-xmark", "In den nächsten Wochen ist kein Termin frei."));
            const msg = iconText("a", "co-btn", "fa-comment", "Coach schreiben");
            msg.href = chatLink(st.offer.coach_id, st.offer.title);
            empty.appendChild(msg);
            const more = moreBtn();
            if (more) empty.appendChild(more);
            picker.appendChild(empty);
            return;
        }
        // Nach Tagen gruppieren (in der Zeitzone des Kunden)
        const byDay = new Map();
        st.slots.forEach(d => {
            const key = isoDay(d);
            if (!byDay.has(key)) byDay.set(key, []);
            byDay.get(key).push(d);
        });
        if (!st.day || !byDay.has(st.day)) st.day = byDay.keys().next().value;
        const days = el("div", "co-slot-days");
        days.setAttribute("role", "group");
        days.setAttribute("aria-label", "Tag wählen");
        byDay.forEach((list, key) => {
            const d = list[0];
            const btn = el("button", `co-slot-day${key === st.day ? " active" : ""}`);
            btn.type = "button";
            btn.setAttribute("aria-pressed", String(key === st.day));
            btn.appendChild(el("span", "", d.toLocaleDateString("de-DE", { weekday: "short" })));
            btn.appendChild(el("strong", "", d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })));
            btn.appendChild(el("small", "", `${list.length} frei`));
            btn.addEventListener("click", () => {
                st.day = key;
                renderSlots();
            });
            days.appendChild(btn);
        });
        picker.appendChild(days);
        days.scrollLeft = scroll;
        const times = el("div", "co-slot-times");
        times.setAttribute("role", "group");
        times.setAttribute("aria-label", "Uhrzeit wählen");
        byDay.get(st.day).forEach(d => {
            const active = selectedSlot?.getTime() === d.getTime();
            const btn = el("button", `co-slot-time${active ? " active" : ""}`, d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
            btn.type = "button";
            btn.setAttribute("aria-pressed", String(active));
            btn.addEventListener("click", () => {
                selectedSlot = d;
                renderSlots();
            });
            times.appendChild(btn);
        });
        picker.appendChild(times);
        const more = moreBtn();
        if (more) picker.appendChild(more);
        const chosen = el("p", `co-slot-chosen${selectedSlot ? " ok" : ""}`);
        if (selectedSlot) {
            const end = new Date(selectedSlot.getTime() + st.offer.duration_minutes * 60000);
            chosen.appendChild(iconText("span", "", "fa-circle-check", `Dein Termin: ${dateTime(selectedSlot.toISOString())} – ${end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`));
        } else {
            chosen.appendChild(iconText("span", "", "fa-hand-pointer", "Wähle einen Tag und eine Uhrzeit."));
        }
        picker.appendChild(chosen);
    }

    $("coBookForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!bookingOffer) return;
        if (slotState && !selectedSlot) {
            showToast("Bitte wähle zuerst einen freien Termin.", "error");
            return;
        }
        const submit = e.submitter || $("coBookForm").querySelector("[type=submit]");
        submit.disabled = true;
        const message = $("coBookMessage").value.trim();
        const { data, error } = slotState
            ? await client.rpc("coaching_book_at", { _offer_id: bookingOffer.id, _scheduled_at: selectedSlot.toISOString(), _message: message })
            : await client.rpc("coaching_book", { _offer_id: bookingOffer.id, _message: message, _preferred_time: $("coBookTime").value.trim() });
        submit.disabled = false;
        if (error) {
            showToast(errorText(error, "Die Anfrage konnte nicht gesendet werden."), "error");
            // Termin inzwischen vergeben: Liste neu laden
            if (slotState && /nicht mehr frei/.test(error.message || "")) {
                selectedSlot = null;
                loadSlots(bookingOffer);
            }
            // Coach hat gerade erst einen Kalender eingerichtet: Terminauswahl zeigen
            if (!slotState && /aus dem Kalender/.test(error.message || "")) {
                calendarCoaches.add(bookingOffer.coach_id);
                $("coSlotPicker").hidden = false;
                $("coBookTimeField").hidden = true;
                setBookNote(true);
                loadSlots(bookingOffer);
            }
            return;
        }
        closeModal("coBookModal");
        showToast(slotState
            ? `Anfrage für ${dateTime(selectedSlot.toISOString())} Uhr gesendet (${euro(data?.total_cents)}). Der Coach bestätigt sie mit einem Klick.`
            : `Anfrage gesendet (${euro(data?.total_cents)}). Der Coach meldet sich bei dir.`, "success");
        showTab("anfragen");
    });

    /* ---------- Reklamation: „Problem melden“ (SQL 035) ---------- */
    const DISPUTE_REASONS = {
        nicht_erschienen: ["fa-user-slash", "Coach ist nicht erschienen", "Der Termin fand nicht statt, weil der Coach nicht da war."],
        mangelhaft: ["fa-thumbs-down", "Coaching war mangelhaft", "Es fand statt, hat dir aber deutlich weniger gebracht als beschrieben."],
        sonstiges: ["fa-circle-question", "Etwas anderes", "Zum Beispiel technische Probleme oder ein deutlich verkürzter Termin."]
    };
    const DISPUTE_STATUS = {
        offen: ["fa-hourglass-half", "Offen", "wait"],
        widerspruch: ["fa-scale-balanced", "Moderation prüft", "wait"],
        erstattung: ["fa-rotate", "Erstattung läuft", "ok"],
        erstattet: ["fa-circle-check", "Erstattet", "ok"],
        teilweise_erstattet: ["fa-circle-half-stroke", "Teilweise erstattet", "ok"],
        abgelehnt: ["fa-circle-xmark", "Abgelehnt", "bad"]
    };
    // Nur zur Anzeige (nicht im Melde-Fenster): Erstattung, weil der Coach dauerhaft gesperrt wurde (SQL 036)
    const DISPUTE_LABELS = { ...DISPUTE_REASONS, coach_gesperrt: ["fa-user-lock", "Coach darf nicht mehr coachen", ""] };
    const canReportProblem = (b) => ["bezahlt", "erledigt"].includes(b.status) && b.stripe_payment_intent && b.scheduled_at
        && new Date(b.scheduled_at).getTime() <= Date.now() && Date.now() - new Date(b.scheduled_at).getTime() < 7 * 86400000;

    function disputeBox(d, b, role) {
        const box = el("div", `co-dispute ${d.status}`);
        const head = el("div", "co-dispute-head");
        const [rIcon, rLabel] = DISPUTE_LABELS[d.reason] || ["fa-flag", d.reason];
        head.appendChild(iconText("strong", "", rIcon, d.reason === "coach_gesperrt" ? `Coaching entfällt: ${rLabel}` : `Problem gemeldet: ${rLabel}`));
        const [sIcon, sLabel, tone] = DISPUTE_STATUS[d.status] || ["fa-circle", d.status, "off"];
        head.appendChild(iconText("span", `co-status ${tone}`, sIcon, sLabel));
        box.appendChild(head);
        box.appendChild(el("p", "co-dispute-text", `„${d.description}“`));
        if (d.coach_statement) {
            const st = el("p", "co-dispute-text coach");
            st.appendChild(el("strong", "", role === "coach" ? "Deine Antwort: " : "Antwort des Coaches: "));
            st.append(`„${d.coach_statement}“`);
            box.appendChild(st);
        }
        const until = new Date(d.respond_until);
        const overdue = until.getTime() < Date.now();
        let info = "";
        if (d.status === "offen" && !overdue) {
            info = role === "coach"
                ? `Bitte antworte bis ${dateTime(d.respond_until)} Uhr: erstatte das Coaching oder widersprich mit einer kurzen Begründung. ${d.reason === "nicht_erschienen" ? "Ohne Antwort wird automatisch voll erstattet." : "Ohne Einigung entscheidet die GSRA-Moderation."} 24 Stunden vor Fristende erinnern wir dich noch einmal per E-Mail.`
                : `${nameOf(b.coach_id)} kann bis ${dateTime(d.respond_until)} Uhr erstatten oder widersprechen. ${d.reason === "nicht_erschienen" ? "Ohne Antwort bekommst du dein Geld automatisch zurück." : "Ohne Einigung entscheidet die GSRA-Moderation."}`;
        } else if (d.status === "offen" || d.status === "widerspruch") {
            info = "Die GSRA-Moderation prüft den Fall und entscheidet – beide bekommen das Ergebnis per E-Mail.";
        } else if (d.status === "erstattung") {
            info = `Die Erstattung von ${euro(d.refund_cents)} wird gerade bei Stripe ausgeführt.`;
        } else if (d.status === "erstattet" || d.status === "teilweise_erstattet") {
            info = `${euro(d.refund_cents)} wurden erstattet. Die Gutschrift erscheint je nach Bank in wenigen Tagen.`;
        } else if (d.status === "abgelehnt") {
            info = "Die Reklamation wurde abgelehnt, es gibt keine Erstattung.";
        }
        if (info) box.appendChild(iconText("p", "co-dispute-info", "fa-circle-info", info));
        if (d.decision && !["offen", "widerspruch"].includes(d.status)) {
            const dec = el("p", "co-dispute-text decision");
            dec.appendChild(el("strong", "", "Entscheidung: "));
            dec.append(d.decision);
            box.appendChild(dec);
        }
        // Coach: erstatten (auch nach einem Widerspruch noch möglich) oder widersprechen
        if (role === "coach" && ["offen", "widerspruch"].includes(d.status)) {
            const actions = el("div", "co-actions");
            const refundBtn = iconText("button", "co-btn primary", "fa-rotate-left", d.status === "widerspruch" ? "Doch erstatten" : "Erstatten");
            refundBtn.type = "button";
            refundBtn.addEventListener("click", () => answerDispute(d, b, true, refundBtn));
            actions.appendChild(refundBtn);
            if (d.status === "offen" && !overdue) {
                const objectBtn = iconText("button", "co-btn", "fa-comment-dots", "Widersprechen");
                objectBtn.type = "button";
                objectBtn.addEventListener("click", () => answerDispute(d, b, false, objectBtn));
                actions.appendChild(objectBtn);
            }
            box.appendChild(actions);
        }
        return box;
    }

    // Erstattungen sofort ausführen (macht sonst der Zeitplan spätestens nach 15 Minuten)
    const runDisputeRefunds = () => invokeFn("coaching-refund", { action: "reklamationen" }).catch(() => null);

    async function answerDispute(d, b, refund, btn) {
        let statement = null;
        if (refund) {
            const ok = await showDialog({
                icon: "fa-rotate-left", title: "Coaching erstatten?",
                message: `${nameOf(b.buyer_id)} bekommt ${euro(b.total_cents)} zurück (inklusive Servicegebühr). Das Geld wird von deinem Stripe-Konto zurückgebucht.`,
                confirmText: "Erstatten", cancelText: "Abbrechen"
            });
            if (!ok) return;
        } else {
            statement = await showDialog({
                icon: "fa-comment-dots", title: "Widersprechen",
                message: "Was ist aus deiner Sicht passiert? Die GSRA-Moderation sieht deine Antwort und entscheidet.",
                input: { placeholder: "z. B. Ich war pünktlich im Discord, der Kunde kam nicht (mindestens 10 Zeichen)", maxLength: 2000, multiline: true },
                confirmText: "Widerspruch senden", cancelText: "Abbrechen"
            });
            if (!statement) return;
        }
        btn.disabled = true;
        const { error } = await client.rpc("coaching_dispute_answer", { _dispute_id: d.id, _refund: refund, _statement: statement });
        if (error) {
            btn.disabled = false;
            showToast(errorText(error, "Das hat nicht geklappt."), "error");
            return;
        }
        if (refund) {
            showToast("Erstattung zugesagt – sie wird jetzt bei Stripe ausgeführt.", "success");
            await runDisputeRefunds();
        } else {
            showToast("Widerspruch gesendet. Die GSRA-Moderation entscheidet.", "success");
        }
        loadCoachArea();
    }

    // Fenster „Problem melden“: Grund wählen und kurz beschreiben
    function openProblemDialog(b) {
        document.getElementById("coProblemDialog")?.remove();
        const overlay = el("div", "gsra-dialog-overlay");
        overlay.id = "coProblemDialog";
        const dialog = el("div", "gsra-dialog co-dialog co-problem-dialog");
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.innerHTML = '<button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button><div class="gsra-dialog-icon"><i class="fa-solid fa-flag"></i></div>';
        dialog.appendChild(el("h3", "gsra-dialog-title", "Problem melden"));
        dialog.appendChild(el("p", "co-book-sub", `${b.offer_title} · ${dateTime(b.scheduled_at)} Uhr mit ${nameOf(b.coach_id)}`));
        const form = el("form", "co-form");
        const reasons = el("div", "co-problem-reasons co-wide");
        reasons.setAttribute("role", "radiogroup");
        reasons.setAttribute("aria-label", "Was ist passiert?");
        Object.entries(DISPUTE_REASONS).forEach(([key, [icon, label, hint]], i) => {
            const option = el("label", "co-problem-reason");
            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "coProblemReason";
            radio.value = key;
            if (i === 0) radio.checked = true;
            option.appendChild(radio);
            const text = el("span", "");
            text.appendChild(iconText("strong", "", icon, label));
            text.appendChild(el("small", "", hint));
            option.appendChild(text);
            reasons.appendChild(option);
        });
        form.appendChild(reasons);
        const field = el("label", "co-field co-wide");
        field.appendChild(el("span", "", "Was ist passiert?"));
        const textarea = document.createElement("textarea");
        textarea.rows = 4;
        textarea.maxLength = 2000;
        textarea.required = true;
        textarea.placeholder = "Beschreibe kurz und sachlich, was passiert ist (mindestens 10 Zeichen).";
        field.appendChild(textarea);
        form.appendChild(field);
        form.appendChild(iconText("p", "co-form-note co-wide", "fa-circle-info",
            "So geht es weiter: Der Coach kann innerhalb von 5 Tagen erstatten oder widersprechen. Ist der Coach nicht erschienen und antwortet nicht, bekommst du dein Geld automatisch zurück. Sonst entscheidet die GSRA-Moderation. Bitte melde nur echte Probleme – Missbrauch kann zu einer Verwarnung führen."));
        const actions = el("div", "gsra-dialog-actions co-wide");
        const cancelBtn = el("button", "gsra-dialog-btn secondary", "Abbrechen");
        cancelBtn.type = "button";
        const sendBtn = el("button", "gsra-dialog-btn primary", "Problem melden");
        sendBtn.type = "submit";
        actions.append(cancelBtn, sendBtn);
        form.appendChild(actions);
        dialog.appendChild(form);
        overlay.appendChild(dialog);
        const close = () => {
            document.removeEventListener("keydown", onKey, true);
            overlay.remove();
            if (!document.querySelector(".gsra-dialog-overlay:not([hidden])")) document.body.style.overflow = "";
        };
        const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
        dialog.querySelector(".gsra-dialog-close").addEventListener("click", close);
        cancelBtn.addEventListener("click", close);
        overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
        document.addEventListener("keydown", onKey, true);
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const reason = form.querySelector("input[name=coProblemReason]:checked")?.value;
            const text = textarea.value.trim();
            if (text.length < 10) {
                textarea.classList.add("invalid");
                textarea.focus();
                showToast("Bitte beschreibe kurz, was passiert ist (mindestens 10 Zeichen).", "error");
                return;
            }
            sendBtn.disabled = true;
            const { error } = await client.rpc("coaching_report_problem", { _booking_id: b.id, _reason: reason, _description: text });
            sendBtn.disabled = false;
            if (error) {
                showToast(errorText(error, "Die Meldung konnte nicht gesendet werden."), "error");
                return;
            }
            close();
            showToast(`Danke, deine Meldung ist eingegangen. ${nameOf(b.coach_id)} hat jetzt 5 Tage Zeit zu reagieren.`, "success");
            loadBuyerBookings();
        });
        document.body.appendChild(overlay);
        document.body.style.overflow = "hidden";
        textarea.focus();
    }

    // Nachweis für den Coach (z. B. für eine Rückbuchung über Bank oder Kreditkarte bei Stripe)
    function downloadEvidence(b) {
        const fmt = (iso) => (iso ? `${dateTime(iso)} Uhr` : "–");
        const d = disputesByBooking.get(b.id);
        const lines = [
            "GSRA – Nachweis zu einem Coaching",
            "==================================",
            `Erstellt am: ${fmt(new Date().toISOString())}`,
            "",
            `Coaching: ${b.offer_title}`,
            `Buchungsnummer: ${b.id}`,
            `Coach: ${nameOf(b.coach_id)}`,
            `Kunde: ${nameOf(b.buyer_id)}`,
            `Dauer: ${duration(b.duration_minutes)}`,
            "",
            `Angefragt am: ${fmt(b.created_at)}`,
            `Termin (vom Coach bestätigt): ${fmt(b.scheduled_at)}`,
            `Bezahlt am: ${fmt(b.paid_at)}`,
            `Bezahlter Betrag: ${euro(b.total_cents)} (davon Servicegebühr ${euro(b.fee_cents)})`,
            `Stripe-Zahlung: ${b.stripe_payment_intent || "–"}`,
            `Als erledigt gemeldet am: ${fmt(b.completed_at)}`,
            `Status: ${(STATUS[b.status] || [null, b.status])[1]}`,
            "",
            "Bedingungen bei der Buchung: kostenlose Stornierung bis 24 Stunden vor dem Termin, danach keine Erstattung",
            "durch den Kunden; Absprachen über den GSRA-Messenger.",
            ...(d ? ["", `Reklamation: ${(DISPUTE_LABELS[d.reason] || [null, d.reason])[1]} (gemeldet am ${fmt(d.created_at)})`,
                `Stand: ${(DISPUTE_STATUS[d.status] || [null, d.status])[1]}${d.decision ? ` – ${d.decision}` : ""}`] : []),
            "",
            "Hinweis: Den Chatverlauf mit dem Kunden findest du im GSRA-Messenger (z. B. als Bildschirmfoto beifügen)."
        ];
        const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `gsra-coaching-nachweis-${String(b.id).slice(0, 8)}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    /* ---------- Termin in den eigenen Kalender (Datei für Outlook, Apple, Thunderbird … oder Google Kalender) ---------- */
    const icsStamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const icsText = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    // Lange Zeilen nach RFC 5545 umbrechen (Folgezeilen beginnen mit einem Leerzeichen)
    const icsFold = (line) => line.length <= 73 ? line : line.match(/.{1,73}/g).join("\r\n ");
    function calendarEvent(b, role) {
        const start = new Date(b.scheduled_at);
        const end = new Date(start.getTime() + b.duration_minutes * 60000);
        const other = nameOf(role === "buyer" ? b.coach_id : b.buyer_id);
        const url = `${location.origin}/coaching.html?tab=${role === "buyer" ? "anfragen" : "coach"}`;
        return {
            start, end, url,
            title: role === "buyer" ? `GSRA-Coaching: ${b.offer_title}` : `GSRA-Coaching mit ${other}: ${b.offer_title}`,
            details: role === "buyer" ? `Coaching mit ${other}. Absprachen über den GSRA-Messenger.` : `Du coachst ${other}. Absprachen über den GSRA-Messenger.`
        };
    }
    function downloadIcs(b, role) {
        const e = calendarEvent(b, role);
        const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GSRA//Coaching//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
            "BEGIN:VEVENT", `UID:${b.id}@gsra-coaching`, `DTSTAMP:${icsStamp(new Date())}`, `DTSTART:${icsStamp(e.start)}`, `DTEND:${icsStamp(e.end)}`,
            `SUMMARY:${icsText(e.title)}`, `DESCRIPTION:${icsText(`${e.details}\n${e.url}`)}`, `URL:${e.url}`,
            "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(e.title)}`, "TRIGGER:-PT1H", "END:VALARM",
            "END:VEVENT", "END:VCALENDAR"].map(icsFold);
        const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/calendar;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `gsra-coaching-${e.start.toISOString().slice(0, 10)}.ics`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    function googleCalendarUrl(b, role) {
        const e = calendarEvent(b, role);
        const params = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${icsStamp(e.start)}/${icsStamp(e.end)}`, details: `${e.details}\n${e.url}` });
        return `https://calendar.google.com/calendar/render?${params}`;
    }
    // Kleine Leiste „In meinen Kalender: Datei · Google“
    function calendarLinks(b, role) {
        const row = el("div", "co-cal-export");
        row.appendChild(iconText("span", "", "fa-calendar-plus", "In meinen Kalender:"));
        const file = iconText("button", "co-link", "fa-file-arrow-down", "Kalenderdatei");
        file.type = "button";
        file.title = "Für Outlook, Apple Kalender, Thunderbird u. a. – mit Erinnerung 1 Stunde vorher";
        file.addEventListener("click", () => downloadIcs(b, role));
        const google = iconText("a", "co-link", "fa-brands fa-google", "Google Kalender");
        google.querySelector("i").className = "fa-brands fa-google";
        google.href = googleCalendarUrl(b, role);
        google.target = "_blank";
        google.rel = "noopener noreferrer";
        row.append(file, google);
        return row;
    }

    // Oben auf der Seite: das nächste bestätigte Coaching (als Kunde oder Coach) mit Countdown
    const bookingCache = { buyer: [], coach: [] };
    function renderNextUp() {
        const box = $("coNextUp");
        if (!box) return;
        const now = Date.now();
        const upcoming = [...bookingCache.buyer.map(b => [b, "buyer"]), ...bookingCache.coach.map(b => [b, "coach"])]
            .filter(([b]) => ["angenommen", "bezahlt"].includes(b.status) && b.scheduled_at
                && new Date(b.scheduled_at).getTime() + b.duration_minutes * 60000 > now)
            .sort((x, y) => new Date(x[0].scheduled_at) - new Date(y[0].scheduled_at));
        box.hidden = !upcoming.length;
        if (!upcoming.length) return;
        const [b, role] = upcoming[0];
        const start = new Date(b.scheduled_at).getTime();
        const mins = Math.round((start - now) / 60000);
        const countdown = mins <= 0 ? "läuft gerade" : mins < 60 ? `in ${mins} Min.` : mins < 48 * 60 ? `in ${Math.round(mins / 60)} Std.` : `in ${Math.round(mins / 1440)} Tagen`;
        const other = nameOf(role === "buyer" ? b.coach_id : b.buyer_id);
        box.className = `co-next${mins < 24 * 60 ? " soon" : ""}`;
        box.replaceChildren();
        const head = el("div", "co-next-head");
        head.appendChild(iconText("span", "co-next-label", "fa-stopwatch", role === "buyer" ? "Dein nächstes Coaching" : "Du coachst als Nächstes"));
        head.appendChild(el("span", "co-next-countdown", countdown));
        box.appendChild(head);
        box.appendChild(el("strong", "co-next-title", b.offer_title));
        const info = el("div", "co-meta");
        info.appendChild(iconText("span", "", "fa-calendar-check", `${dateTime(b.scheduled_at)} Uhr`));
        info.appendChild(iconText("span", "", "fa-user", role === "buyer" ? `mit ${other}` : `für ${other}`));
        info.appendChild(iconText("span", b.status === "bezahlt" ? "co-next-paid" : "co-next-open", b.status === "bezahlt" ? "fa-circle-check" : "fa-hourglass-half",
            b.status === "bezahlt" ? "bezahlt" : role === "buyer" ? "noch nicht bezahlt" : "Kunde hat noch nicht bezahlt"));
        box.appendChild(info);
        const foot = el("div", "co-next-foot");
        foot.appendChild(calendarLinks(b, role));
        const go = iconText("button", "co-link", "fa-arrow-right", role === "buyer" ? "Zu meinen Anfragen" : "Zum Bereich „Als Coach“");
        go.type = "button";
        go.addEventListener("click", () => showTab(role === "buyer" ? "anfragen" : "coach"));
        foot.appendChild(go);
        box.appendChild(foot);
        box.appendChild(iconText("p", "co-next-hint", "fa-envelope", "Wir erinnern euch beide per E-Mail – 24 Stunden und 1 Stunde vorher."));
    }

    function bookingCard(b, role) {
        const other = role === "buyer" ? b.coach_id : b.buyer_id;
        const card = el("article", `co-booking ${b.status}`);
        const head = el("div", "co-booking-head");
        const person = el("button", "co-coach");
        person.type = "button";
        person.appendChild(avatar(other));
        const who = el("span", "co-coach-text");
        who.appendChild(el("strong", "", nameOf(other)));
        who.appendChild(el("small", "", role === "buyer" ? "Coach" : "möchte gecoacht werden"));
        person.appendChild(who);
        person.addEventListener("click", () => typeof openProfileCard === "function" && openProfileCard(other, { sellerName: nameOf(other) }));
        head.appendChild(person);
        const [icon, label, tone] = STATUS[b.status] || ["fa-circle", b.status, "off"];
        const statusText = role === "coach" && b.status === "angefragt" ? "Neue Anfrage" : label;
        head.appendChild(iconText("span", `co-status ${tone}`, icon, statusText));
        card.appendChild(head);

        card.appendChild(el("h3", "co-card-title", b.offer_title));
        const meta = el("div", "co-meta");
        meta.appendChild(iconText("span", "", "fa-clock", duration(b.duration_minutes)));
        if (b.scheduled_at && b.status === "angefragt") {
            // Termin aus dem Kalender, vom Coach noch nicht bestätigt
            meta.appendChild(iconText("span", "co-when pending", "fa-calendar-day",
                `${role === "coach" ? "Gewählter Termin" : "Dein Termin (wartet auf Bestätigung)"}: ${dateTime(b.scheduled_at)} Uhr`));
        } else if (b.scheduled_at) {
            meta.appendChild(iconText("span", "co-when", "fa-calendar-check", `Termin: ${dateTime(b.scheduled_at)} Uhr`));
        } else {
            meta.appendChild(iconText("span", "", "fa-calendar", `angefragt am ${dateText(b.created_at)}`));
            if (b.preferred_time) meta.appendChild(iconText("span", "", "fa-calendar-day", `Wunsch: ${b.preferred_time}`));
        }
        card.appendChild(meta);
        // Bestätigter Termin: in den eigenen Kalender übernehmen
        if (["angenommen", "bezahlt"].includes(b.status) && b.scheduled_at && new Date(b.scheduled_at).getTime() + b.duration_minutes * 60000 > Date.now()) {
            card.appendChild(calendarLinks(b, role));
        }
        if (b.message) card.appendChild(el("p", "co-desc co-quote", b.message));

        const money = el("div", "co-money");
        const paid = ["bezahlt", "erledigt"].includes(b.status);
        if (b.status === "erstattet") {
            money.append(`${euro(b.total_cents)} erstattet`);
        } else if (role === "buyer") {
            money.append(paid ? `Bezahlt: ${euro(b.total_cents)}` : `${euro(b.total_cents)} gesamt`);
            if (b.fee_cents > 0) money.appendChild(el("small", "", ` (${euro(b.price_cents)} + ${euro(b.fee_cents)} Servicegebühr)`));
        } else {
            money.append(`${paid ? "Bezahlt – du erhältst" : "Du erhältst"} ${euro(b.price_cents)}`);
            money.appendChild(el("small", "", " abzüglich Stripe-Gebühr"));
        }
        if (b.discount_percent && b.status !== "erstattet") money.appendChild(el("span", "co-discount-badge small", `−${b.discount_percent} % Rabatt`));
        card.appendChild(money);

        const actions = el("div", "co-actions");
        const add = (node) => actions.appendChild(node);
        const button = (cls, icon, text, onClick) => {
            const btn = iconText("button", `co-btn ${cls}`, icon, text);
            btn.type = "button";
            btn.addEventListener("click", () => onClick(btn));
            return btn;
        };
        if (["angefragt", "angenommen", "bezahlt"].includes(b.status)) {
            const msg = iconText("a", "co-btn", "fa-comment", role === "buyer" ? "Coach schreiben" : "Nachricht");
            msg.href = chatLink(other, b.offer_title);
            add(msg);
        }
        if (role === "coach" && b.status === "angefragt") {
            if (b.scheduled_at && hoursUntil(b.scheduled_at) > 1) {
                // Termin kommt aus deinem Kalender: mit einem Klick bestätigen, oder eine andere Zeit vorschlagen
                add(button("primary", "fa-check", "Termin bestätigen", (btn) => confirmSlot(b, btn)));
                add(button("", "fa-calendar-days", "Andere Zeit", () => openTimeModal(b, "accept")));
            } else {
                add(button("primary", "fa-check", "Annehmen", () => openTimeModal(b, "accept")));
            }
            add(button("danger", "fa-xmark", "Ablehnen", (btn) => respond(b, false, btn)));
        }
        if (role === "coach" && b.status === "angenommen") {
            add(button("", "fa-calendar-days", b.scheduled_at ? "Termin ändern" : "Termin festlegen", () => openTimeModal(b, "move")));
        }
        if (role === "coach" && b.status === "bezahlt" && b.scheduled_at && hoursUntil(b.scheduled_at) <= 0) {
            add(button("primary", "fa-flag-checkered", "Als erledigt markieren", (btn) => markDone(b, btn)));
        }
        if (role === "buyer" && b.status === "angenommen") {
            // Bezahlen erst, wenn ein Termin feststeht und der Coach sein Stripe-Konto eingerichtet hat
            const pay = iconText("button", "co-btn primary", "fa-lock", `Bezahlen · ${euro(b.total_cents)}`);
            pay.type = "button";
            pay.disabled = true;
            if (!b.scheduled_at || hoursUntil(b.scheduled_at) <= 0) {
                pay.title = "Der Coach legt noch einen Termin fest.";
            } else {
                pay.title = "Prüfe, ob der Coach Zahlungen annehmen kann …";
                coachReady(b.coach_id).then(ready => {
                    pay.disabled = !ready;
                    pay.title = ready ? "Sicher bezahlen über Stripe" : "Der Coach richtet die Bezahlung gerade noch ein.";
                    // Auf dem Handy gibt es keinen Hover-Hinweis: Grund sichtbar unter die Knöpfe schreiben
                    if (!ready) actions.after(iconText("p", "co-pay-note", "fa-hourglass-half", "Bezahlen ist möglich, sobald der Coach sein Stripe-Konto eingerichtet hat."));
                });
            }
            pay.addEventListener("click", () => startPayment(b, pay));
            add(pay);
        }
        // Unbezahlt: Käufer ziehen zurück, Coaches sagen angenommene ab (neue lehnen sie oben ab)
        if (role === "buyer" ? ["angefragt", "angenommen"].includes(b.status) : b.status === "angenommen") {
            add(button("ghost", "fa-ban", role === "buyer" ? "Zurückziehen" : "Absagen", (btn) => cancel(b, role, btn)));
        }
        // Bezahlt: Käufer bis 24 Stunden vor dem Termin, Coach jederzeit – mit voller Erstattung
        if (b.status === "bezahlt") {
            const buyerLate = role === "buyer" && b.scheduled_at && hoursUntil(b.scheduled_at) < 24;
            const refundBtn = button("ghost", "fa-rotate-left", role === "buyer" ? "Stornieren & erstatten" : "Absagen & erstatten", (btn) => refund(b, role, btn));
            if (buyerLate) {
                refundBtn.disabled = true;
                refundBtn.title = "Kostenlos stornieren ging bis 24 Stunden vor dem Termin. Schreib dem Coach im Messenger.";
            }
            add(refundBtn);
        }
        // Nach dem Coaching: Käufer bewertet den Coach; der Coach sieht die erhaltene Bewertung
        const review = reviewsByBooking.get(b.id);
        if (role === "buyer" && canReview(b)) {
            add(button(review ? "" : "primary", "fa-star", review ? "Bewertung ändern" : "Coach bewerten", () => rateCoach(b)));
        }
        // Reklamation: gemeldetes Problem mit Stand; Kunde kann ab Terminbeginn bis 7 Tage danach melden
        const dispute = disputesByBooking.get(b.id);
        if (dispute) card.appendChild(disputeBox(dispute, b, role));
        if (role === "buyer" && !dispute && canReportProblem(b)) {
            add(button("ghost", "fa-flag", "Problem melden", () => openProblemDialog(b)));
        }
        // Coach: Nachweis zum Coaching (z. B. bei einer Rückbuchung über Bank oder Kreditkarte)
        if (role === "coach" && b.paid_at && ["bezahlt", "erledigt", "erstattet"].includes(b.status)) {
            add(button("ghost", "fa-file-lines", "Nachweis", () => downloadEvidence(b)));
        }
        if (review && (role === "coach" || b.status !== "erstattet")) {
            const lvl = { 1: "ideal", 0: "in_ordnung", "-1": "mangelhaft", "-2": "schlecht" }[review.rating];
            const levels = window.GSRA_RATING_LEVELS || {};
            const line = el("div", "co-review-line");
            line.appendChild(iconText("span", `rep-chip ${lvl}`, levels[lvl]?.[0] || "fa-star", levels[lvl]?.[1] || ""));
            line.append(role === "coach" ? " Bewertung deines Kunden" : " Deine Bewertung");
            if (review.comment) line.appendChild(el("small", "", `„${review.comment}“`));
            card.appendChild(line);
        }
        if (actions.childElementCount) card.appendChild(actions);
        // Stornofrist für Käufer gut sichtbar
        if (role === "buyer" && ["angenommen", "bezahlt"].includes(b.status) && b.scheduled_at) {
            const until = new Date(new Date(b.scheduled_at).getTime() - 24 * 3600000);
            card.appendChild(iconText("p", "co-refund-note", "fa-shield-halved",
                until > new Date() ? `Kostenlos stornieren bis ${dateTime(until.toISOString())} Uhr – du bekommst alles zurück.`
                    : "Die kostenlose Stornierung ist vorbei (bis 24 Stunden vor dem Termin)."));
        }
        return card;
    }

    /* ---------- Termin, Bezahlen, Erstatten ---------- */
    function openTimeModal(b, mode) {
        timeTarget = { booking: b, mode };
        $("coTimeTitle").textContent = mode === "accept" ? "Anfrage annehmen" : "Termin ändern";
        $("coTimeSub").textContent = `${b.offer_title} · ${duration(b.duration_minutes)} mit ${nameOf(b.buyer_id)}`;
        $("coTimeSubmit").textContent = mode === "accept" ? "Annehmen" : "Termin speichern";
        const input = $("coTimeInput");
        const min = new Date(Date.now() + 65 * 60000);
        input.min = localInput(min);
        input.max = localInput(new Date(Date.now() + 179 * 86400000));
        // Vorschlag: bisheriger Termin, sonst morgen 18 Uhr
        const suggestion = b.scheduled_at ? new Date(b.scheduled_at) : (() => { const d = new Date(Date.now() + 86400000); d.setHours(18, 0, 0, 0); return d; })();
        input.value = localInput(suggestion < min ? min : suggestion);
        openModal("coTimeModal");
    }

    $("coTimeForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!timeTarget) return;
        const when = new Date($("coTimeInput").value);
        if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60 * 60000) {
            showToast("Bitte wähle einen Termin, der mindestens 1 Stunde in der Zukunft liegt.", "error");
            return;
        }
        const submit = $("coTimeSubmit");
        submit.disabled = true;
        const { booking, mode } = timeTarget;
        const { error } = mode === "accept"
            ? await client.rpc("coaching_respond", { _booking_id: booking.id, _accept: true, _scheduled_at: when.toISOString() })
            : await client.rpc("coaching_set_time", { _booking_id: booking.id, _scheduled_at: when.toISOString() });
        submit.disabled = false;
        if (error) {
            showToast(errorText(error, "Der Termin konnte nicht gespeichert werden."), "error");
            return;
        }
        closeModal("coTimeModal");
        showToast(mode === "accept"
            ? `Angenommen für ${dateTime(when.toISOString())} Uhr. ${myPayoutReady ? "Dein Kunde kann jetzt bezahlen." : "Sobald dein Stripe-Konto eingerichtet ist, kann dein Kunde bezahlen."}`
            : "Termin geändert.", "success");
        loadCoachArea();
    });

    async function startPayment(b, btn) {
        btn.disabled = true;
        try {
            const data = await invokeFn("coaching-checkout", { booking_id: b.id });
            if (!data?.url) throw new Error("Die Bezahlseite konnte nicht geöffnet werden.");
            window.location.href = data.url;
        } catch (err) {
            btn.disabled = false;
            showToast(err.message, "error");
        }
    }

    async function refund(b, role, btn) {
        const ok = await showDialog({
            icon: "fa-rotate-left", danger: true,
            title: role === "buyer" ? "Coaching stornieren?" : "Coaching absagen?",
            message: role === "buyer"
                ? `Du bekommst ${euro(b.total_cents)} vollständig zurück (auch die Servicegebühr). Je nach Bank dauert es ein paar Tage, bis das Geld wieder da ist.`
                : `${nameOf(b.buyer_id)} bekommt ${euro(b.total_cents)} vollständig zurück. Die Absage lässt sich nicht rückgängig machen.`,
            confirmText: role === "buyer" ? "Stornieren" : "Absagen", cancelText: "Abbrechen"
        });
        if (!ok) return;
        btn.disabled = true;
        try {
            await invokeFn("coaching-refund", { booking_id: b.id });
            showToast("Storniert – das Geld wird vollständig erstattet.", "success");
        } catch (err) {
            btn.disabled = false;
            showToast(err.message, "error");
            return;
        }
        if (role === "buyer") loadBuyerBookings();
        else loadCoachArea();
    }

    async function markDone(b, btn) {
        btn.disabled = true;
        const { error } = await client.rpc("coaching_mark_done", { _booking_id: b.id });
        if (error) {
            btn.disabled = false;
            showToast(errorText(error, "Das hat nicht geklappt."), "error");
            return;
        }
        showToast("Als erledigt markiert – danke fürs Coachen!", "success");
        loadCoachArea();
    }

    /* ---------- Verfügbarkeitskalender (SQL 030): Coach trägt freie Zeiten ein, Kunden buchen nur dort ---------- */
    const WEEKDAYS = [[1, "Montag"], [2, "Dienstag"], [3, "Mittwoch"], [4, "Donnerstag"], [5, "Freitag"], [6, "Samstag"], [7, "Sonntag"]];
    const CAL_PRESETS = [
        ["fa-briefcase", "Werktags abends", "Mo–Fr 18–22 Uhr", [1, 2, 3, 4, 5], 1080, 1320],
        ["fa-sun", "Wochenende", "Sa + So 10–18 Uhr", [6, 7], 600, 1080],
        ["fa-moon", "Jeden Abend", "Mo–So 19–23 Uhr", [1, 2, 3, 4, 5, 6, 7], 1140, 1380]
    ];
    const myTimeZone = (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin"; } catch (e) { return "Europe/Berlin"; }
    })();
    let calendarState = null;   // eigener Kalender: { timezone, windows: [{ tag, von, bis }], blocked: ["JJJJ-MM-TT"], dirty }
    const pad2 = (n) => String(n).padStart(2, "0");
    const minutesToTime = (m) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
    const timeToMinutes = (value, isEnd) => {
        const match = /^(\d{2}):(\d{2})/.exec(value || "");
        if (!match) return null;
        const m = Number(match[1]) * 60 + Number(match[2]);
        return isEnd && m === 0 ? 1440 : m; // Ende „00:00“ = Mitternacht
    };
    const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const dayLabel = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });

    async function loadCalendar() {
        const box = $("coCalendar");
        if (!box) return;
        if (!canOffer()) {
            box.hidden = true;
            return;
        }
        const [cal, win, blocked] = await Promise.all([
            client.from("coach_calendars").select("timezone").eq("coach_id", me).maybeSingle(),
            client.from("coach_availability").select("weekday, start_min, end_min").eq("coach_id", me),
            client.from("coach_blocked_days").select("day").eq("coach_id", me)
        ]);
        // SQL 030 noch nicht ausgeführt: Bereich nicht zeigen
        if (cal.error || win.error || blocked.error) {
            box.hidden = true;
            return;
        }
        const today = isoDay(new Date());
        calendarState = {
            timezone: cal.data?.timezone || myTimeZone,
            windows: (win.data || []).map(w => ({ tag: w.weekday, von: w.start_min, bis: w.end_min })),
            blocked: (blocked.data || []).map(b => b.day).filter(d => d >= today).sort(),
            saved: (win.data || []).length,
            dirty: false
        };
        renderCalendar();
    }

    function markCalendarDirty() {
        if (!calendarState) return;
        calendarState.dirty = true;
        const status = document.querySelector("#coCalendar .co-cal-status");
        if (status) {
            status.className = "co-cal-status dirty";
            status.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Noch nicht gespeichert';
        }
    }

    function renderCalendar() {
        const box = $("coCalendar");
        const st = calendarState;
        if (!box || !st) return;
        box.hidden = false;
        box.className = `co-calendar${st.saved ? " active" : " empty"}`;
        box.replaceChildren();

        const head = el("div", "co-payout-head");
        head.innerHTML = '<i class="fa-solid fa-calendar-days"></i>';
        const text = el("div", "co-payout-text");
        text.appendChild(el("strong", "", st.saved ? "Deine freien Zeiten" : "Neu: Trag deine freien Zeiten ein"));
        text.appendChild(el("span", "", st.saved
            ? "Kunden wählen direkt einen freien Termin daraus – frühestens 24 Stunden vorher und nie doppelt belegt. Du bestätigst jede Anfrage mit einem Klick."
            : "Dann wählen Kunden selbst einen passenden Termin und du bestätigst nur noch mit einem Klick. Solange keine Zeiten eingetragen sind, schreiben sie dir einen Wunschtermin."));
        head.appendChild(text);
        box.appendChild(head);

        // Schnell ausfüllen: setzt die Zeiten der betroffenen Tage
        const presets = el("div", "co-cal-presets");
        presets.appendChild(el("span", "co-cal-label", "Schnell ausfüllen:"));
        CAL_PRESETS.forEach(([icon, label, hint, days, von, bis]) => {
            const btn = iconText("button", "co-chip", icon, label);
            btn.type = "button";
            btn.title = hint;
            btn.appendChild(el("small", "", ` ${hint}`));
            btn.addEventListener("click", () => {
                st.windows = st.windows.filter(w => !days.includes(w.tag)).concat(days.map(tag => ({ tag, von, bis })));
                st.dirty = true;
                renderCalendar();
            });
            presets.appendChild(btn);
        });
        if (st.windows.length) {
            const clear = iconText("button", "co-chip", "fa-eraser", "Alle Zeiten entfernen");
            clear.type = "button";
            clear.addEventListener("click", () => {
                st.windows = [];
                st.dirty = true;
                renderCalendar();
            });
            presets.appendChild(clear);
        }
        box.appendChild(presets);

        // Wochentage mit ihren Zeitfenstern
        const week = el("div", "co-cal-week");
        WEEKDAYS.forEach(([tag, name]) => {
            const row = el("div", `co-cal-day${st.windows.some(w => w.tag === tag) ? "" : " off"}`);
            row.appendChild(el("strong", "co-cal-dayname", name));
            const list = el("div", "co-cal-windows");
            const mine = st.windows.filter(w => w.tag === tag).sort((a, b) => a.von - b.von);
            if (!mine.length) list.appendChild(el("span", "co-cal-none", "keine Zeiten"));
            mine.forEach(w => {
                const item = el("span", "co-cal-window");
                const timeInput = (minutes, isEnd, label) => {
                    const input = document.createElement("input");
                    input.type = "time";
                    input.step = 900;
                    input.required = true; // Zeitfenster haben immer eine Uhrzeit (kein „Leeren“)
                    input.value = minutesToTime(minutes);
                    input.setAttribute("aria-label", `${name} ${label}`);
                    input.addEventListener("change", () => {
                        const v = timeToMinutes(input.value, isEnd);
                        if (v === null) return;
                        if (isEnd) w.bis = v; else w.von = v;
                        markCalendarDirty();
                    });
                    return input;
                };
                item.append(timeInput(w.von, false, "von"), el("span", "co-cal-dash", "–"), timeInput(w.bis, true, "bis"));
                const rm = el("button", "co-cal-remove");
                rm.type = "button";
                rm.title = "Zeitfenster entfernen";
                rm.setAttribute("aria-label", `${name}: Zeitfenster entfernen`);
                rm.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                rm.addEventListener("click", () => {
                    st.windows = st.windows.filter(x => x !== w);
                    st.dirty = true;
                    renderCalendar();
                });
                item.appendChild(rm);
                list.appendChild(item);
            });
            row.appendChild(list);
            const add = iconText("button", "co-cal-add", "fa-plus", "Zeit");
            add.type = "button";
            add.title = `${name}: Zeitfenster hinzufügen`;
            add.addEventListener("click", () => {
                if (mine.length >= 6) return showToast("Höchstens 6 Zeitfenster pro Tag.", "error");
                // Nach dem letzten Fenster weitermachen, sonst 18–22 Uhr
                const last = mine[mine.length - 1];
                const von = last ? Math.min(last.bis + 60, 1380) : 1080;
                st.windows.push({ tag, von, bis: Math.min(von + 120, 1440) });
                st.dirty = true;
                renderCalendar();
            });
            row.appendChild(add);
            week.appendChild(row);
        });
        box.appendChild(week);

        // Einzelne Tage sperren (Urlaub, Rennwochenende …)
        const blocked = el("div", "co-cal-blocked");
        blocked.appendChild(el("span", "co-cal-label", "Tage sperren (z. B. Urlaub):"));
        const dateInput = document.createElement("input");
        dateInput.type = "date";
        dateInput.min = isoDay(new Date());
        dateInput.max = isoDay(new Date(Date.now() + 365 * 86400000));
        dateInput.setAttribute("aria-label", "Tag sperren");
        const block = iconText("button", "co-chip", "fa-ban", "Sperren");
        block.type = "button";
        block.addEventListener("click", () => {
            const day = dateInput.value;
            if (!day || day < dateInput.min || day > dateInput.max) return showToast("Bitte wähle einen Tag zwischen heute und in einem Jahr.", "error");
            if (st.blocked.includes(day)) return;
            if (st.blocked.length >= 100) return showToast("Höchstens 100 gesperrte Tage.", "error");
            st.blocked = [...st.blocked, day].sort();
            st.dirty = true;
            renderCalendar();
        });
        blocked.append(dateInput, block);
        const chips = el("div", "co-cal-chips");
        st.blocked.forEach(day => {
            const chip = el("span", "co-cal-chip", dayLabel(day));
            const rm = el("button", "co-cal-remove");
            rm.type = "button";
            rm.title = "Sperre aufheben";
            rm.setAttribute("aria-label", `Sperre für ${dayLabel(day)} aufheben`);
            rm.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            rm.addEventListener("click", () => {
                st.blocked = st.blocked.filter(d => d !== day);
                st.dirty = true;
                renderCalendar();
            });
            chip.appendChild(rm);
            chips.appendChild(chip);
        });
        blocked.appendChild(chips);
        box.appendChild(blocked);

        // Speichern
        const foot = el("div", "co-cal-foot");
        const zone = iconText("small", "co-cal-zone", "fa-globe", `Zeiten in deiner Zeitzone: ${myTimeZone}`);
        if (st.saved && st.timezone !== myTimeZone) zone.append(` (bisher ${st.timezone} – wird beim Speichern übernommen)`);
        foot.appendChild(zone);
        const status = el("span", `co-cal-status${st.dirty ? " dirty" : ""}`);
        status.innerHTML = st.dirty ? '<i class="fa-solid fa-circle-exclamation"></i> Noch nicht gespeichert'
            : st.saved ? '<i class="fa-solid fa-circle-check"></i> Gespeichert – Kunden buchen direkt' : "";
        foot.appendChild(status);
        const save = iconText("button", "co-btn primary", "fa-floppy-disk", "Zeiten speichern");
        save.type = "button";
        save.addEventListener("click", () => saveCalendar(save));
        foot.appendChild(save);
        box.appendChild(foot);
    }

    async function saveCalendar(btn) {
        const st = calendarState;
        if (!st) return;
        // Gleiche Regeln wie die Datenbank, mit verständlichem Hinweis vor dem Speichern
        const name = (tag) => WEEKDAYS.find(([t]) => t === tag)[1];
        for (const w of st.windows) {
            if (w.von % 15 || w.bis % 15) return showToast(`${name(w.tag)}: Bitte Uhrzeiten in Viertelstunden wählen (z. B. 18:00 oder 18:15).`, "error");
            if (w.bis - w.von < 30) return showToast(`${name(w.tag)}: Ein Zeitfenster braucht mindestens 30 Minuten (Ende nach dem Beginn).`, "error");
        }
        const clash = st.windows.find((a, i) => st.windows.some((b, j) => i < j && a.tag === b.tag && a.von < b.bis && b.von < a.bis));
        if (clash) return showToast(`${name(clash.tag)}: Zwei Zeitfenster überschneiden sich.`, "error");
        btn.disabled = true;
        const { data, error } = await client.rpc("coach_save_calendar", {
            _timezone: myTimeZone, _windows: st.windows.map(w => ({ tag: w.tag, von: w.von, bis: w.bis })), _blocked: st.blocked
        });
        btn.disabled = false;
        if (error) {
            showToast(errorText(error, "Die Zeiten konnten nicht gespeichert werden."), "error");
            return;
        }
        showToast(data?.fenster
            ? "Gespeichert! Kunden wählen jetzt direkt einen freien Termin bei dir."
            : "Kalender ausgeschaltet – Kunden schreiben dir wieder einen Wunschtermin.", "success");
        await loadCalendar();
        loadOffers();
    }

    /* ---------- Auszahlungen (Stripe-Konto des Coaches) ---------- */
    let payoutData = null;     // eigenes Stripe-Konto (null = noch keins)
    async function loadPayout({ refresh = false } = {}) {
        if (refresh) {
            try { await invokeFn("coaching-connect", { action: "status" }); } catch (e) { /* Stand bleibt wie gespeichert */ }
        }
        const { data, error } = await client.from("coach_payout_accounts").select("charges_enabled, details_submitted, country").eq("user_id", me).maybeSingle();
        payoutData = error ? null : data;
        myPayoutReady = Boolean(data?.charges_enabled);
        // Box im Bereich „Als Coach“ (ohne SQL 025 oder ohne Lizenz und ohne Konto: nichts)
        fillStripeBox($("coPayout"), data, !error && (data || canOffer()), false);
        // Deutlicher Hinweis oben auf der Seite, solange ein Coach noch nicht mit Stripe verbunden ist
        fillStripeBox($("coStripePrompt"), data, !error && canOffer() && !data?.charges_enabled, true);
    }

    // Stripe jetzt einrichten bzw. fortsetzen (Land nur beim ersten Mal)
    async function startStripeOnboarding(btn, country, kind) {
        btn.disabled = true;
        try {
            const res = await invokeFn("coaching-connect", {
                action: "onboarding", country: country || payoutData?.country || "DE",
                kind: kind || btn.closest(".co-payout")?.querySelector(".co-payout-kind")?.value || "privat"
            });
            if (!res?.url) throw new Error("Die Einrichtung bei Stripe konnte nicht geöffnet werden.");
            window.location.href = res.url;
        } catch (err) {
            btn.disabled = false;
            showToast(err.message, "error");
        }
    }

    // Nach Lizenz oder erstem Angebot: direkt auf die Stripe-Verbindung hinweisen
    async function promptStripeConnect(reason) {
        if (myPayoutReady || !canOffer()) return;
        const ok = await showDialog({
            icon: "fa-credit-card", title: "Jetzt mit Stripe verbinden",
            message: `${reason} Damit Kunden bezahlen können, verbindest du einmalig ein Stripe-Konto – das dauert nur ein paar Minuten. Das Geld geht direkt an dich.`,
            confirmText: "Jetzt verbinden", cancelText: "Später"
        });
        if (!ok) return;
        const prompt = $("coStripePrompt");
        if (payoutData) {
            const btn = prompt.querySelector(".co-btn.primary");
            if (btn) return startStripeOnboarding(btn);
        }
        prompt.scrollIntoView({ behavior: "smooth", block: "center" });
        prompt.querySelector("select, .co-btn.primary")?.focus();
    }

    function fillStripeBox(box, data, visible, prominent) {
        if (!box) return;
        box.hidden = !visible;
        if (!visible) return;
        box.className = `co-payout ${data?.charges_enabled ? "ready" : data ? "pending" : ""}${prominent ? " prompt" : ""}`;
        box.replaceChildren();
        const head = el("div", "co-payout-head");
        head.innerHTML = `<i class="fa-brands fa-stripe"></i>`;
        const text = el("div", "co-payout-text");
        const actions = el("div", "co-actions");
        if (data?.charges_enabled) {
            text.appendChild(el("strong", "", "Auszahlungen aktiv"));
            text.appendChild(el("span", "", "Deine Kunden bezahlen direkt auf dein Stripe-Konto. Die Stripe-Gebühren trägst du, die GSRA behält von deinem Preis nichts ein."));
            const dash = iconText("a", "co-btn", "fa-arrow-up-right-from-square", "Stripe-Dashboard");
            dash.href = "https://dashboard.stripe.com/";
            dash.target = "_blank";
            dash.rel = "noopener noreferrer";
            actions.appendChild(dash);
        } else {
            text.appendChild(el("strong", "", prominent
                ? (data ? "Fast geschafft: Stripe-Einrichtung abschließen" : "Wichtig: Verbinde dich mit Stripe")
                : (data ? "Einrichtung bei Stripe noch nicht abgeschlossen" : "Auszahlungen einrichten")));
            text.appendChild(el("span", "", data
                ? "Sobald Stripe deine Angaben bestätigt hat, können deine Kunden bezahlen."
                : prominent
                    ? "Ohne Stripe-Konto können Kunden deine Coachings nicht bezahlen. Einmal verbinden, ein paar Minuten – das Geld geht direkt an dich."
                    : "Damit Kunden bezahlen können, verbindest du einmalig ein Stripe-Konto. Das Geld geht direkt an dich; die Stripe-Gebühren trägst du, die GSRA behält von deinem Preis nichts ein."));
            // Was Stripe wissen will – ehrlich und kurz, damit niemand von einer „Firma“ abgeschreckt wird
            const steps = el("ul", "co-payout-steps");
            [["fa-user", "Als Privatperson brauchst du kein Gewerbe und keine Firma."],
                ["fa-id-card", "Stripe fragt einmalig Name, Geburtsdatum, Adresse, Bankverbindung (IBAN) und meist ein Ausweisfoto – gesetzlich vorgeschrieben."],
                ["fa-key", "Du legst dabei ein eigenes Stripe-Login an; so siehst du jederzeit deine Einnahmen."],
                ["fa-stopwatch", "Dauert etwa 5 Minuten. Die Beschreibung deiner Tätigkeit füllt die GSRA für dich aus."]]
                .forEach(([icon, line]) => steps.appendChild(iconText("li", "", icon, line)));
            text.appendChild(steps);
            let country = null;
            if (!data) {
                country = document.createElement("select");
                country.className = "co-payout-country";
                country.setAttribute("aria-label", "Land deines Stripe-Kontos");
                PAYOUT_COUNTRIES.forEach(([code, name]) => country.add(new Option(name, code)));
                actions.appendChild(country);
            }
            // Privatperson (Standard) oder mit Gewerbe/Firma – nur solange bei Stripe noch nichts abgeschickt ist
            let kind = null;
            if (!data?.details_submitted) {
                kind = document.createElement("select");
                kind.className = "co-payout-country co-payout-kind";
                kind.setAttribute("aria-label", "Du coachst als");
                kind.add(new Option("Als Privatperson", "privat"));
                kind.add(new Option("Mit Gewerbe oder Firma", "gewerblich"));
                actions.appendChild(kind);
            }
            const start = iconText("button", "co-btn primary", "fa-arrow-right", data ? "Weiter bei Stripe" : prominent ? "Jetzt mit Stripe verbinden" : "Mit Stripe einrichten");
            start.type = "button";
            start.addEventListener("click", () => startStripeOnboarding(start, country?.value, kind?.value));
            actions.appendChild(start);
            if (data) {
                const check = iconText("button", "co-btn ghost", "fa-rotate", "Stand prüfen");
                check.type = "button";
                check.addEventListener("click", async () => {
                    check.disabled = true;
                    await loadPayout({ refresh: true });
                });
                actions.appendChild(check);
            }
        }
        head.appendChild(text);
        box.append(head, actions);
    }

    function renderBookings(box, list, role) {
        box.replaceChildren();
        if (!list.length) {
            const empty = el("div", "co-empty");
            empty.innerHTML = `<i class="fa-solid ${role === "buyer" ? "fa-paper-plane" : "fa-inbox"}"></i>`;
            empty.append(role === "buyer" ? " Du hast noch keine Coachings angefragt." : " Noch keine Anfragen an dich.");
            box.appendChild(empty);
            return;
        }
        list.forEach(b => box.appendChild(bookingCard(b, role)));
    }

    function setBadge(id, count) {
        const badge = $(id);
        badge.hidden = !count;
        badge.textContent = count > 9 ? "9+" : String(count || "");
    }

    async function fetchBookings(column) {
        const [{ data, error }, reviews, disputes] = await Promise.all([
            client.from("coaching_bookings").select("*").eq(column, me).order("created_at", { ascending: false }).limit(100),
            client.from("coaching_reviews").select("*").eq(column, me).limit(200),
            client.from("coaching_disputes").select("*").eq(column, me).limit(200) // ohne SQL 035: Fehler, einfach keine
        ]);
        if (error) return null;
        (reviews.data || []).forEach(r => reviewsByBooking.set(r.booking_id, r));
        (disputes.data || []).forEach(d => disputesByBooking.set(d.booking_id, d));
        await loadProfiles(data.map(b => (column === "buyer_id" ? b.coach_id : b.buyer_id)));
        return data;
    }

    // Bewerten nach dem Coaching: bezahlt und Termin vorbei oder vom Coach als erledigt gemeldet
    const canReview = (b) => b.status === "erledigt"
        || (b.status === "bezahlt" && b.scheduled_at && new Date(b.scheduled_at).getTime() + b.duration_minutes * 60000 < Date.now());

    async function rateCoach(b) {
        const existing = reviewsByBooking.get(b.id) || null;
        const result = await window.gsraRateCoachDialog({ coachName: nameOf(b.coach_id), title: b.offer_title, existing });
        if (!result) return;
        if (result.remove) {
            const { error } = await client.from("coaching_reviews").delete().eq("booking_id", b.id);
            if (error) return showToast("Die Bewertung konnte nicht gelöscht werden.", "error");
            reviewsByBooking.delete(b.id);
            showToast("Bewertung gelöscht.", "success");
        } else {
            const { error } = await client.rpc("review_coaching", { _booking_id: b.id, _rating: result.rating, _tags: result.tags, _comment: result.comment });
            if (error) return showToast(errorText(error, "Die Bewertung konnte nicht gespeichert werden."), "error");
            showToast(existing ? "Bewertung geändert." : "Danke für deine Bewertung!", "success");
        }
        window.gsraReputation?.(b.coach_id, { fresh: true });
        loadBuyerBookings();
    }

    async function loadBuyerBookings() {
        const list = await fetchBookings("buyer_id");
        if (!list) {
            $("coBuyerList").replaceChildren(el("div", "co-empty", "Deine Anfragen konnten nicht geladen werden."));
            return;
        }
        renderBookings($("coBuyerList"), list, "buyer");
        setBadge("coBadgeBuyer", list.filter(b => b.status === "angenommen").length);
        bookingCache.buyer = list;
        renderNextUp();
        // Aus der E-Mail „Wie war dein Coaching?“ (coaching.html?tab=anfragen#bewerten): zum Bewerten springen
        if (window.location.hash === "#bewerten") {
            history.replaceState(null, "", tabUrl("anfragen"));
            const btn = [...$("coBuyerList").querySelectorAll(".co-btn.primary")].find(b => /Coach bewerten/.test(b.textContent));
            if (btn) {
                btn.scrollIntoView({ behavior: "smooth", block: "center" });
                btn.classList.add("co-flash-btn");
                setTimeout(() => btn.classList.remove("co-flash-btn"), 2800);
            }
        }
    }

    async function loadMyOffers() {
        const box = $("coMyOffers");
        const { data, error } = await client.from("coaching_offers").select("*").eq("coach_id", me).order("created_at", { ascending: false });
        box.replaceChildren();
        if (error) {
            box.appendChild(el("div", "co-empty", "Deine Angebote konnten nicht geladen werden."));
            return;
        }
        if (!data.length) {
            const empty = el("div", "co-empty");
            empty.innerHTML = '<i class="fa-solid fa-chalkboard-user"></i>';
            empty.append(canOffer() ? " Du hast noch kein Coaching angeboten." : " Mit der GSRA-Coach-Lizenz kannst du eigene Coachings anbieten.");
            const btn = iconText("button", "co-btn primary", canOffer() ? "fa-plus" : "fa-award", canOffer() ? "Coaching anbieten" : "Voraussetzungen ansehen");
            btn.type = "button";
            btn.addEventListener("click", () => (canOffer() ? openOfferForm() : openLicenseDialog()));
            empty.appendChild(btn);
            box.appendChild(empty);
            return;
        }
        data.forEach(o => {
            const row = el("article", `co-own${o.active ? "" : " paused"}`);
            const text = el("div", "co-own-text");
            text.appendChild(el("strong", "", o.title));
            text.appendChild(el("small", "", `${o.category} · ${duration(o.duration_minutes)} · ${euro(o.price_cents)}`
                + `${discountActive(o) ? ` · −${o.discount_percent} % Rabatt (${euro(priceOf(o))}${o.discount_until ? ` bis ${dayText(o.discount_until)}` : ""})` : ""}${o.active ? "" : " · pausiert"}`));
            row.appendChild(text);
            const actions = el("div", "co-actions");
            const toggle = iconText("button", "co-btn", o.active ? "fa-pause" : "fa-play", o.active ? "Pausieren" : "Aktivieren");
            toggle.type = "button";
            toggle.disabled = !o.active && !canOffer();
            if (toggle.disabled) toggle.title = "Zum Aktivieren brauchst du die GSRA-Coach-Lizenz.";
            toggle.addEventListener("click", async () => {
                toggle.disabled = true;
                const { error: err } = await client.rpc("coaching_save_offer", {
                    _id: o.id, _title: o.title, _description: o.description || "", _category: o.category,
                    _simulation: o.simulation || "", _duration: o.duration_minutes, _price_cents: o.price_cents, _active: !o.active
                });
                if (err) {
                    toggle.disabled = false;
                    showToast(errorText(err, "Das hat nicht geklappt."), "error");
                    return;
                }
                showToast(o.active ? "Angebot pausiert." : "Angebot wieder sichtbar.", "success");
                await Promise.all([loadOffers(), loadMyOffers()]);
            });
            actions.appendChild(toggle);
            const edit = iconText("button", "co-btn", "fa-pen", "Bearbeiten");
            edit.type = "button";
            edit.addEventListener("click", () => openOfferForm(o));
            actions.appendChild(edit);
            const del = iconText("button", "co-btn danger", "fa-trash", "Löschen");
            del.type = "button";
            del.addEventListener("click", () => deleteOffer(o));
            actions.appendChild(del);
            row.appendChild(actions);
            box.appendChild(row);
        });
    }

    async function loadCoachArea() {
        const list = await fetchBookings("coach_id");
        if (!list) $("coCoachRequests").replaceChildren(el("div", "co-empty", "Anfragen konnten nicht geladen werden."));
        else {
            renderBookings($("coCoachRequests"), list, "coach");
            setBadge("coBadgeCoach", list.filter(b => b.status === "angefragt" || disputesByBooking.get(b.id)?.status === "offen").length);
            bookingCache.coach = list;
            renderNextUp();
            // Vom Hinweis oben auf jeder Seite (coaching.html?tab=coach#reklamation): offene Reklamation zeigen
            if (window.location.hash === "#reklamation") {
                history.replaceState(null, "", tabUrl("coach"));
                const box = $("coCoachRequests").querySelector(".co-dispute.offen") || $("coCoachRequests").querySelector(".co-dispute.widerspruch");
                if (box) {
                    box.scrollIntoView({ behavior: "smooth", block: "center" });
                    box.classList.add("co-flash");
                    setTimeout(() => box.classList.remove("co-flash"), 2600);
                }
            }
        }
        renderLicenseBox();
        // Ungespeicherte Änderungen am Kalender nicht beim Neuladen der Anfragen verwerfen
        await Promise.all([loadMyOffers(), loadPayout(), calendarState?.dirty ? null : loadCalendar()]);
    }

    // Termin aus dem Kalender bestätigen (ein Klick, die Datenbank prüft erneut auf Überschneidungen)
    async function confirmSlot(b, btn) {
        const ok = await showDialog({
            icon: "fa-calendar-check", title: "Termin bestätigen?",
            message: `${nameOf(b.buyer_id)} hat „${b.offer_title}“ für ${dateTime(b.scheduled_at)} Uhr gewählt.`,
            confirmText: "Bestätigen", cancelText: "Abbrechen"
        });
        if (!ok) return;
        btn.disabled = true;
        const { error } = await client.rpc("coaching_respond", { _booking_id: b.id, _accept: true, _scheduled_at: null });
        if (error) {
            btn.disabled = false;
            showToast(errorText(error, "Das hat nicht geklappt."), "error");
            return;
        }
        showToast(`Bestätigt für ${dateTime(b.scheduled_at)} Uhr. ${myPayoutReady ? "Dein Kunde kann jetzt bezahlen." : "Sobald dein Stripe-Konto eingerichtet ist, kann dein Kunde bezahlen."}`, "success");
        loadCoachArea();
    }

    // Ablehnen (Annehmen läuft über das Termin-Fenster)
    async function respond(b, accept, btn) {
        const ok = await showDialog({ icon: "fa-xmark", title: "Anfrage ablehnen?", message: `${nameOf(b.buyer_id)} erfährt, dass du „${b.offer_title}“ ablehnst.`, confirmText: "Ablehnen", cancelText: "Abbrechen", danger: true });
        if (!ok) return;
        btn.disabled = true;
        const { error } = await client.rpc("coaching_respond", { _booking_id: b.id, _accept: false, _scheduled_at: null });
        if (error) {
            btn.disabled = false;
            showToast(errorText(error, "Das hat nicht geklappt."), "error");
            return;
        }
        showToast("Anfrage abgelehnt.", "success");
        loadCoachArea();
    }

    async function cancel(b, role, btn) {
        const ok = await showDialog({
            icon: "fa-ban", danger: true,
            title: role === "buyer" ? "Anfrage zurückziehen?" : "Coaching absagen?",
            message: role === "buyer" ? `Deine Anfrage für „${b.offer_title}“ wird storniert.` : `Das Coaching „${b.offer_title}“ mit ${nameOf(b.buyer_id)} wird abgesagt.`,
            confirmText: role === "buyer" ? "Zurückziehen" : "Absagen", cancelText: "Abbrechen"
        });
        if (!ok) return;
        btn.disabled = true;
        const { error } = await client.rpc("coaching_cancel", { _booking_id: b.id });
        if (error) {
            btn.disabled = false;
            showToast(errorText(error, "Das hat nicht geklappt."), "error");
            return;
        }
        showToast("Storniert.", "success");
        if (role === "buyer") loadBuyerBookings();
        else loadCoachArea();
    }

    /* ---------- Start ---------- */
    async function init() {
        if (!client) return;
        const { data: { session } } = await client.auth.getSession();
        me = session?.user?.id || null;
        if (!me) return; // Gäste sehen den Anmelde-Hinweis (auth-nav.js)
        const [fee, profile] = await Promise.all([
            client.rpc("coaching_fee_percent"),
            client.from("profiles").select("role").eq("id", me).maybeSingle(),
            loadLicense()
        ]);
        feePercent = fee.error ? 10 : Number(fee.data);
        isModerator = ["admin", "moderator"].includes(profile.data?.role);

        const hint = $("coFeeHint");
        hint.hidden = false;
        hint.innerHTML = feePercent
            ? '<i class="fa-solid fa-circle-info"></i> '
            : '<i class="fa-solid fa-crown"></i> ';
        hint.append(feePercent
            ? "Mit Paddock zahlst du 10 % Servicegebühr auf den Preis des Coaches. Mit Pole oder Alliance entfällt sie."
            : "Mit deinem Abo zahlst du keine Servicegebühr – du zahlst genau den Preis des Coaches.");
        hint.classList.toggle("free", !feePercent);
        updateOfferButton();
        renderLicenseBox();
        if (canOffer()) {
            loadPayout();   // Stripe-Hinweis oben, falls noch nicht verbunden
            loadCalendar(); // eigene freie Zeiten (Bereich „Als Coach“)
            loadAway();     // Urlaubsmodus (Hinweis oben, solange er an ist)
        }

        renderCategories();
        // Alte Anfragen und nie bezahlte Coachings beenden (SQL 033; ohne 033 passiert einfach nichts)
        await client.rpc("coaching_expire_stale").then(() => {}, () => {});
        await loadOffers();
        // Zähler auf den Tabs und „Dein nächstes Coaching“ gleich anzeigen
        loadBuyerBookings();
        fetchBookings("coach_id").then(list => {
            if (!list) return;
            setBadge("coBadgeCoach", list.filter(b => b.status === "angefragt" || disputesByBooking.get(b.id)?.status === "offen").length);
            bookingCache.coach = list;
            renderNextUp();
        });
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        if (["pro", "anfragen", "coach"].includes(tab)) showTab(tab, { updateUrl: false });
        // „Coachings von …“ eines Pro-Coaches: gleich im Bereich Pro-Coaches öffnen
        else if (filter.coach && proIds.has(filter.coach)) showTab("pro");

        // Rückkehr von Stripe: Bezahlung bzw. Einrichtung des Stripe-Kontos
        const payment = params.get("zahlung");
        const stripeReturn = params.get("stripe");
        if (payment || stripeReturn) history.replaceState(null, "", `coaching.html${tab ? `?tab=${tab}` : ""}`);
        if (payment === "erfolg") {
            showToast("Danke! Deine Zahlung wird gerade bestätigt.", "success");
            // Die Bestätigung von Stripe kommt meist nach wenigen Sekunden
            [2500, 6000, 12000].forEach(ms => setTimeout(loadBuyerBookings, ms));
        } else if (payment === "abbruch") {
            showToast("Bezahlung abgebrochen – du kannst es jederzeit erneut versuchen.", "info");
        }
        if (stripeReturn === "zurueck" || stripeReturn === "neu") {
            await loadPayout({ refresh: true });
            const { data } = await client.from("coach_payout_accounts").select("charges_enabled").eq("user_id", me).maybeSingle();
            showToast(data?.charges_enabled ? "Stripe ist eingerichtet – deine Kunden können jetzt bezahlen."
                : "Die Einrichtung bei Stripe ist noch nicht abgeschlossen. Du kannst sie jederzeit fortsetzen.", data?.charges_enabled ? "success" : "info");
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
