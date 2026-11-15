/* =========================================
   GSRA - Coaching
   Mitglieder mit Pole oder Alliance bieten Coachings zu ihrem eigenen Preis an, jedes Mitglied kann anfragen.
   Der Coach erhält 100 % seines Preises. Mit Paddock kommen 10 % Servicegebühr dazu, mit Pole/Alliance keine.
   Preis und Gebühr legt die Datenbank fest (coaching_book) – die Seite zeigt sie nur an.
   Absprachen laufen über den Messenger; die Bezahlung über die GSRA folgt (Stripe Connect).
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
        erledigt: ["fa-flag-checkered", "Erledigt", "done"]
    };

    let me = null;            // angemeldete Person
    let myPlan = "paddock";
    let feePercent = 10;      // nur für die Anzeige; berechnet wird in der Datenbank
    let isModerator = false;
    let offers = [];
    let profiles = new Map(); // id → { username, avatar_url }
    let filter = { category: "all", search: "" };
    let editingId = null;
    let bookingOffer = null;

    const $ = (id) => document.getElementById(id);
    const canOffer = () => ["pole", "alliance"].includes(myPlan);
    const euro = (cents) => (Number(cents || 0) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    const feeOf = (cents) => Math.round(Number(cents || 0) * feePercent / 100);
    const duration = (min) => {
        const h = Math.floor(min / 60), m = min % 60;
        if (!h) return `${m} Min.`;
        const hours = h === 1 ? "1 Std." : `${h} Std.`;
        return m ? `${hours} ${m} Min.` : hours;
    };
    const dateText = (iso) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
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
    ["coOfferModal", "coBookModal"].forEach(id => {
        // Nur ein Klick direkt auf den dunklen Hintergrund schließt (nicht beim Markieren von Text im Formular)
        $(id).addEventListener("mousedown", (e) => { if (e.target === e.currentTarget) closeModal(id); });
    });
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const open = ["coBookModal", "coOfferModal"].find(id => !$(id).hidden);
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
            box.appendChild(el("small", "co-price-note", "Dein Angebot – du erhältst 100 %"));
        } else if (feePercent > 0) {
            box.appendChild(el("small", "co-price-note", `Für dich ${euro(offer.price_cents + feeOf(offer.price_cents))} inkl. ${euro(feeOf(offer.price_cents))} Servicegebühr`));
        } else {
            box.appendChild(iconText("small", "co-price-note free", "fa-crown", "Keine Servicegebühr für dich"));
        }
        return box;
    }

    function offerCard(offer) {
        const card = el("article", "co-card");
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

        const rep = el("div", "co-rep");
        card.appendChild(rep);
        if (typeof window.gsraRenderReputation === "function") window.gsraRenderReputation(rep, offer.coach_id, { compact: true });

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
            }
        }
        foot.appendChild(actions);
        card.appendChild(foot);
        return card;
    }

    function renderOffers() {
        const box = $("coOffers");
        const term = filter.search.trim().toLowerCase();
        const list = offers.filter(o => (filter.category === "all" || o.category === filter.category)
            && (!term || [o.title, o.description, o.simulation, o.category, nameOf(o.coach_id)].some(v => String(v || "").toLowerCase().includes(term))));
        box.replaceChildren();
        if (!list.length) {
            const empty = el("div", "co-empty");
            empty.innerHTML = '<i class="fa-solid fa-chalkboard-user"></i>';
            empty.append(offers.length ? " Keine Coachings passen zu deiner Suche." : " Noch keine Coachings – sei der Erste!");
            box.appendChild(empty);
            return;
        }
        list.forEach(o => box.appendChild(offerCard(o)));
    }

    let offersRequest = 0; // nur die neueste Abfrage zählt (eine ältere, langsamere überschreibt nichts)
    async function loadOffers() {
        const request = ++offersRequest;
        const { data, error } = await client.from("coaching_offers").select("*").eq("active", true)
            .order("created_at", { ascending: false }).limit(300);
        if (request !== offersRequest) return;
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
            showDialog({
                icon: "fa-crown", title: "Coachings mit Pole oder Alliance",
                message: "Eigene Coachings anbieten können Mitglieder mit dem Pole- oder Alliance-Abo. Du erhältst deinen Preis zu 100 %.",
                confirmText: "Abos ansehen", cancelText: "Schließen"
            }).then(ok => { if (ok) window.location.href = "abo.html"; });
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
        // Ohne Abo lassen sich eigene Angebote nur noch pausieren, nicht wieder einschalten
        $("coActive").disabled = !canOffer() && !offer?.active;
        openModal("coOfferModal");
    }
    $("coOfferBtn").addEventListener("click", () => openOfferForm());

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
        meta.appendChild(iconText("span", "", "fa-calendar", `angefragt am ${dateText(b.created_at)}`));
        if (b.preferred_time) meta.appendChild(iconText("span", "", "fa-calendar-day", `Wunsch: ${b.preferred_time}`));
        card.appendChild(meta);
        if (b.message) card.appendChild(el("p", "co-desc co-quote", b.message));

        const money = el("div", "co-money");
        if (role === "buyer") {
            money.append(`${euro(b.total_cents)} gesamt`);
            if (b.fee_cents > 0) money.appendChild(el("small", "", ` (${euro(b.price_cents)} + ${euro(b.fee_cents)} Servicegebühr)`));
        } else {
            money.append(`Du erhältst ${euro(b.price_cents)}`);
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
            add(button("primary", "fa-check", "Annehmen", (btn) => respond(b, true, btn)));
            add(button("danger", "fa-xmark", "Ablehnen", (btn) => respond(b, false, btn)));
        }
        if (role === "buyer" && b.status === "angenommen") {
            const pay = iconText("button", "co-btn primary", "fa-lock", "Bezahlen – folgt in Kürze");
            pay.type = "button";
            pay.disabled = true;
            pay.title = "Die Bezahlung über die GSRA wird gerade eingerichtet. Bis dahin stimmt ihr euch im Messenger ab.";
            add(pay);
        }
        // Käufer ziehen offene Anfragen zurück; Coaches lehnen neue ab (oben) und sagen angenommene ab
        if (role === "buyer" ? ["angefragt", "angenommen"].includes(b.status) : b.status === "angenommen") {
            add(button("ghost", "fa-ban", role === "buyer" ? "Zurückziehen" : "Absagen", (btn) => cancel(b, role, btn)));
        }
        if (actions.childElementCount) card.appendChild(actions);
        return card;
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
        const { data, error } = await client.from("coaching_bookings").select("*").eq(column, me)
            .order("created_at", { ascending: false }).limit(100);
        if (error) return null;
        await loadProfiles(data.map(b => (column === "buyer_id" ? b.coach_id : b.buyer_id)));
        return data;
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
            empty.append(canOffer() ? " Du hast noch kein Coaching angeboten." : " Mit Pole oder Alliance kannst du eigene Coachings anbieten.");
            const btn = iconText("button", "co-btn primary", canOffer() ? "fa-plus" : "fa-crown", canOffer() ? "Coaching anbieten" : "Abos ansehen");
            btn.type = "button";
            btn.addEventListener("click", () => (canOffer() ? openOfferForm() : (window.location.href = "abo.html")));
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
            if (toggle.disabled) toggle.title = "Zum Aktivieren brauchst du Pole oder Alliance.";
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
        await loadMyOffers();
    }

    async function respond(b, accept, btn) {
        if (!accept) {
            const ok = await showDialog({ icon: "fa-xmark", title: "Anfrage ablehnen?", message: `${nameOf(b.buyer_id)} erfährt, dass du „${b.offer_title}“ ablehnst.`, confirmText: "Ablehnen", cancelText: "Abbrechen", danger: true });
            if (!ok) return;
        }
        btn.disabled = true;
        const { error } = await client.rpc("coaching_respond", { _booking_id: b.id, _accept: accept });
        if (error) {
            btn.disabled = false;
            showToast(errorText(error, "Das hat nicht geklappt."), "error");
            return;
        }
        showToast(accept ? "Angenommen – schreib deinem Kunden im Messenger, um den Termin abzustimmen." : "Anfrage abgelehnt.", "success");
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
        const [plan, fee, profile] = await Promise.all([
            client.rpc("plan_of", { _user: me }),
            client.rpc("coaching_fee_percent"),
            client.from("profiles").select("role").eq("id", me).maybeSingle()
        ]);
        myPlan = plan.data || "paddock";
        feePercent = fee.error ? (canOffer() ? 0 : 10) : Number(fee.data);
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
        if (!canOffer()) {
            const btn = $("coOfferBtn");
            btn.innerHTML = '<i class="fa-solid fa-crown"></i> ';
            btn.append("Coach werden");
            btn.title = "Coachings anbieten können Mitglieder mit Pole oder Alliance.";
        }

        renderCategories();
        await loadOffers();
        // Zähler auf den Tabs gleich anzeigen
        loadBuyerBookings();
        fetchBookings("coach_id").then(list => list && setBadge("coBadgeCoach", list.filter(b => b.status === "angefragt").length));
        const tab = new URLSearchParams(window.location.search).get("tab");
        if (["anfragen", "coach"].includes(tab)) showTab(tab);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
