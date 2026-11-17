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
        erstattet: ["fa-rotate-left", "Erstattet", "off"]
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
    let filter = { category: "all", search: "" };
    let editingId = null;
    let bookingOffer = null;
    let timeTarget = null;    // { booking, mode: "accept" | "move" }
    let myPayoutReady = false; // eigenes Stripe-Konto fertig eingerichtet?
    let proIds = new Set();    // Pro-Fahrer der GSRA (eigener Bereich oben)
    let reviewsByBooking = new Map(); // Coach-Bewertungen zu den eigenen Anfragen
    const coachReadyCache = new Map();

    const $ = (id) => document.getElementById(id);
    const canOffer = () => license?.aktiv === true;
    const euro = (cents) => (Number(cents || 0) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    const feeOf = (cents) => Math.round(Number(cents || 0) * feePercent / 100);
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
        return /[äöüß]|Bitte|Coaching|Anfrage|Angebot|Preis|Dauer|Titel|Konto|Coach/.test(msg) && msg.length < 200 ? msg : fallback;
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
        const { data } = await client.from("profiles").select("id, username, avatar_url").in("id", missing);
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
    function showTab(name) {
        document.querySelectorAll(".co-tab").forEach(t => {
            const active = t.dataset.tab === name;
            t.classList.toggle("active", active);
            t.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll(".co-panel").forEach(p => { p.hidden = p.dataset.panel !== name; });
        if (name === "anfragen") loadBuyerBookings();
        if (name === "coach") loadCoachArea();
    }
    document.querySelectorAll(".co-tab").forEach(t => t.addEventListener("click", () => showTab(t.dataset.tab)));

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
        box.appendChild(el("strong", "co-price-main", euro(offer.price_cents)));
        if (offer.coach_id === me) {
            box.appendChild(el("small", "co-price-note", "Dein Angebot – an dich, abzüglich Stripe-Gebühr"));
        } else if (feePercent > 0) {
            box.appendChild(el("small", "co-price-note", `Für dich ${euro(offer.price_cents + feeOf(offer.price_cents))} inkl. ${euro(feeOf(offer.price_cents))} Servicegebühr`));
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

        card.appendChild(el("h3", "co-card-title", offer.title));
        const meta = el("div", "co-meta");
        meta.appendChild(iconText("span", "", "fa-clock", duration(offer.duration_minutes)));
        if (offer.simulation) meta.appendChild(iconText("span", "", "fa-gamepad", offer.simulation));
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

    // Pro-Coaches (von der GSRA ausgewählte Pro-Fahrer) oben im eigenen Bereich, alle anderen darunter
    function renderOffers() {
        const box = $("coOffers");
        const proSection = $("coProSection");
        const proBox = $("coProOffers");
        const term = filter.search.trim().toLowerCase();
        const list = offers.filter(o => (filter.category === "all" || o.category === filter.category)
            && (!term || [o.title, o.description, o.simulation, o.category, nameOf(o.coach_id)].some(v => String(v || "").toLowerCase().includes(term))));
        const proList = list.filter(o => proIds.has(o.coach_id));
        const rest = list.filter(o => !proIds.has(o.coach_id));
        box.replaceChildren();
        proBox.replaceChildren();
        proSection.hidden = !proList.length;
        proList.forEach(o => proBox.appendChild(offerCard(o, { pro: true })));
        if (!rest.length) {
            if (proList.length) return;
            const empty = el("div", "co-empty");
            empty.innerHTML = '<i class="fa-solid fa-chalkboard-user"></i>';
            empty.append(offers.length ? " Keine Coachings passen zu deiner Suche." : " Noch keine Coachings – sei der Erste!");
            box.appendChild(empty);
            return;
        }
        rest.forEach(o => box.appendChild(offerCard(o)));
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
    async function loadOffers() {
        const request = ++offersRequest;
        const [{ data, error }, pros] = await Promise.all([
            client.from("coaching_offers").select("*").eq("active", true).order("created_at", { ascending: false }).limit(300),
            client.from("pro_creators").select("user_id")
        ]);
        if (request !== offersRequest) return;
        proIds = new Set((pros.data || []).map(p => p.user_id));
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
        renderOffers();
    }

    $("coSearch").addEventListener("input", (e) => {
        filter.search = e.target.value;
        renderOffers();
    });

    /* ---------- Angebot anlegen / bearbeiten ---------- */
    function openOfferForm(offer = null) {
        if (!offer && !canOffer()) {
            openLicenseDialog();
            return;
        }
        editingId = offer?.id || null;
        $("coOfferTitle").textContent = offer ? "Coaching bearbeiten" : "Coaching anbieten";
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
                body.appendChild(el("p", "co-license-intro", `Deine Lizenz ist aktiv${license.erteilt_am ? ` seit ${dateText(license.erteilt_am)}` : ""}. Du kannst eigene Coachings anbieten.`));
                const offerBtn = el("button", "gsra-dialog-btn primary", "Coaching anbieten");
                offerBtn.type = "button";
                offerBtn.addEventListener("click", () => { close(); openOfferForm(); });
                actions.append(closeBtn, offerBtn);
                return;
            }
            body.appendChild(el("p", "co-license-intro", "Coach wird man bei der GSRA über Leistung in der Community, nicht über ein Abo. Sind alle vier Punkte erfüllt, holst du dir die Lizenz hier."));
            const revoked = license.entzogen;
            if (revoked) {
                const note = el("div", "co-license-revoked");
                note.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ';
                note.append(revoked.automatisch
                    ? `Deine Lizenz wurde am ${dateText(revoked.am)} automatisch entzogen (${String(revoked.grund || "").replace(/^Automatisch:\s*/, "")}). Sobald alle Punkte wieder erfüllt sind, kannst du sie erneut holen.`
                    : `Das Moderationsteam hat deine Lizenz am ${dateText(revoked.am)} entzogen. Begründung: ${revoked.grund || "–"}`);
                body.appendChild(note);
            }
            body.appendChild(criteriaList(license));
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
            text.appendChild(el("strong", "", license.entzogen ? "Coach-Lizenz entzogen" : "Noch keine Coach-Lizenz"));
            text.appendChild(el("span", "", `${done} von 4 Voraussetzungen erfüllt. Coach wird man über Setups, gute Bewertungen und faires Verhalten.`));
        }
        head.appendChild(text);
        const actions = el("div", "co-actions");
        const btn = iconText("button", `co-btn ${license.aktiv ? "" : "primary"}`, "fa-list-check", license.aktiv ? "Details" : "Voraussetzungen ansehen");
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

    async function refreshLicenseUi() {
        await loadLicense();
        updateOfferButton();
        renderLicenseBox();
        if (!$("coMyOffers").closest(".co-panel").hidden) await Promise.all([loadMyOffers(), loadPayout()]);
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
        const submit = e.submitter || $("coOfferForm").querySelector("[type=submit]");
        submit.disabled = true;
        const { error } = await client.rpc("coaching_save_offer", {
            _id: editingId, _title: $("coTitle").value.trim(), _description: $("coDescription").value.trim(),
            _category: $("coCategory").value, _simulation: $("coSim").value.trim(),
            _duration: Number($("coDuration").value), _price_cents: price, _active: $("coActive").checked
        });
        submit.disabled = false;
        if (error) {
            showToast(errorText(error, "Das Angebot konnte nicht gespeichert werden."), "error");
            return;
        }
        closeModal("coOfferModal");
        showToast(editingId ? "Angebot gespeichert." : "Dein Coaching ist online.", "success");
        await Promise.all([loadOffers(), loadMyOffers()]);
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
        const fee = feeOf(offer.price_cents);
        row("Preis des Coaches", euro(offer.price_cents));
        row(feePercent ? "Servicegebühr (10 %, Paddock)" : "Servicegebühr (Pole/Alliance)", feePercent ? euro(fee) : "entfällt");
        row("Gesamt", euro(offer.price_cents + fee), "total");
        $("coBookTime").value = "";
        $("coBookMessage").value = "";
        openModal("coBookModal");
    }

    $("coBookForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!bookingOffer) return;
        const submit = e.submitter || $("coBookForm").querySelector("[type=submit]");
        submit.disabled = true;
        const { data, error } = await client.rpc("coaching_book", {
            _offer_id: bookingOffer.id, _message: $("coBookMessage").value.trim(), _preferred_time: $("coBookTime").value.trim()
        });
        submit.disabled = false;
        if (error) {
            showToast(errorText(error, "Die Anfrage konnte nicht gesendet werden."), "error");
            return;
        }
        closeModal("coBookModal");
        showToast(`Anfrage gesendet (${euro(data?.total_cents)}). Der Coach meldet sich bei dir.`, "success");
        showTab("anfragen");
    });

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
        if (b.scheduled_at) {
            meta.appendChild(iconText("span", "co-when", "fa-calendar-check", `Termin: ${dateTime(b.scheduled_at)} Uhr`));
        } else {
            meta.appendChild(iconText("span", "", "fa-calendar", `angefragt am ${dateText(b.created_at)}`));
            if (b.preferred_time) meta.appendChild(iconText("span", "", "fa-calendar-day", `Wunsch: ${b.preferred_time}`));
        }
        card.appendChild(meta);
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
            add(button("primary", "fa-check", "Annehmen", () => openTimeModal(b, "accept")));
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

    /* ---------- Auszahlungen (Stripe-Konto des Coaches) ---------- */
    async function loadPayout({ refresh = false } = {}) {
        const box = $("coPayout");
        if (refresh) {
            try { await invokeFn("coaching-connect", { action: "status" }); } catch (e) { /* Stand bleibt wie gespeichert */ }
        }
        const { data, error } = await client.from("coach_payout_accounts").select("charges_enabled, details_submitted, country").eq("user_id", me).maybeSingle();
        myPayoutReady = Boolean(data?.charges_enabled);
        // Ohne SQL 025 oder ohne Abo und ohne Konto: nichts anzeigen
        if (error || (!data && !canOffer())) {
            box.hidden = true;
            return;
        }
        box.hidden = false;
        box.className = `co-payout ${data?.charges_enabled ? "ready" : data ? "pending" : ""}`;
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
            text.appendChild(el("strong", "", data ? "Einrichtung bei Stripe noch nicht abgeschlossen" : "Auszahlungen einrichten"));
            text.appendChild(el("span", "", data
                ? "Sobald Stripe deine Angaben bestätigt hat, können deine Kunden bezahlen."
                : "Damit Kunden bezahlen können, verbindest du einmalig ein Stripe-Konto. Das Geld geht direkt an dich; die Stripe-Gebühren trägst du, die GSRA behält von deinem Preis nichts ein."));
            if (!data) {
                const country = document.createElement("select");
                country.id = "coPayoutCountry";
                country.className = "co-payout-country";
                country.setAttribute("aria-label", "Land deines Stripe-Kontos");
                PAYOUT_COUNTRIES.forEach(([code, name]) => country.add(new Option(name, code)));
                actions.appendChild(country);
            }
            const start = iconText("button", "co-btn primary", "fa-arrow-right", data ? "Weiter bei Stripe" : "Mit Stripe einrichten");
            start.type = "button";
            start.addEventListener("click", async () => {
                start.disabled = true;
                try {
                    const res = await invokeFn("coaching-connect", { action: "onboarding", country: $("coPayoutCountry")?.value || data?.country || "DE" });
                    if (!res?.url) throw new Error("Die Einrichtung bei Stripe konnte nicht geöffnet werden.");
                    window.location.href = res.url;
                } catch (err) {
                    start.disabled = false;
                    showToast(err.message, "error");
                }
            });
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
        const [{ data, error }, reviews] = await Promise.all([
            client.from("coaching_bookings").select("*").eq(column, me).order("created_at", { ascending: false }).limit(100),
            client.from("coaching_reviews").select("*").eq(column, me).limit(200)
        ]);
        if (error) return null;
        (reviews.data || []).forEach(r => reviewsByBooking.set(r.booking_id, r));
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
            text.appendChild(el("small", "", `${o.category} · ${duration(o.duration_minutes)} · ${euro(o.price_cents)}${o.active ? "" : " · pausiert"}`));
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
            setBadge("coBadgeCoach", list.filter(b => b.status === "angefragt").length);
        }
        renderLicenseBox();
        await Promise.all([loadMyOffers(), loadPayout()]);
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

        renderCategories();
        await loadOffers();
        // Zähler auf den Tabs gleich anzeigen
        loadBuyerBookings();
        fetchBookings("coach_id").then(list => list && setBadge("coBadgeCoach", list.filter(b => b.status === "angefragt").length));
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        if (["anfragen", "coach"].includes(tab)) showTab(tab);

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
