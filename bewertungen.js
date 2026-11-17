/* =========================================
   GSRA - Bewertungen: Zufriedenheit im Profil (Marktplatz, Setups, später Coaching)
   und „Verkäufer bewerten“ (TOP / OK / Na ja, Merkmale, Kommentar).
   Die Regeln (nur nach echtem Kontakt, eine Bewertung pro Inserat) prüft die Datenbank.
========================================= */
(() => {
    const db = () => window.supabaseClient || window.supabase;
    const cache = new Map();

    const SELLER_TAGS = {
        freundlich: ["fa-face-smile", "Freundlich"],
        zuverlaessig: ["fa-handshake", "Zuverlässig"],
        schnelle_antwort: ["fa-bolt", "Antwortet schnell"],
        wie_beschrieben: ["fa-circle-check", "Wie beschrieben"]
    };
    // Merkmale für Coaches (nach dem Coaching)
    const COACH_TAGS = {
        kompetent: ["fa-graduation-cap", "Kompetent"],
        erklaert_gut: ["fa-chalkboard", "Erklärt verständlich"],
        puenktlich: ["fa-clock", "Pünktlich"],
        hat_geholfen: ["fa-arrow-trend-up", "Hat mich schneller gemacht"]
    };
    window.GSRA_COACH_TAGS = COACH_TAGS;
    // Einheitliche Skala für Marktplatz, Setups und Coaching: Ideal, In Ordnung, Mangelhaft, Schlecht
    const LEVELS = {
        ideal: ["fa-star", "Ideal"],
        in_ordnung: ["fa-thumbs-up", "In Ordnung"],
        mangelhaft: ["fa-triangle-exclamation", "Mangelhaft"],
        schlecht: ["fa-thumbs-down", "Schlecht"]
    };
    window.GSRA_RATING_LEVELS = LEVELS;

    // Durchschnitt (Ideal 3, In Ordnung 2, Mangelhaft 1, Schlecht 0): ab 2,5 Ideal, ab 1,75 In Ordnung, ab 1 Mangelhaft
    const level = (counts) => {
        const n = counts?.anzahl || 0;
        if (!n) return null;
        const avg = (3 * (counts.ideal || 0) + 2 * (counts.in_ordnung || 0) + (counts.mangelhaft || 0)) / n;
        return avg >= 2.5 ? "ideal" : avg >= 1.75 ? "in_ordnung" : avg >= 1 ? "mangelhaft" : "schlecht";
    };

    // Nation und Sprachen (Profil, Dashboard, Coaching) – Codes wie in der Datenbank (029)
    const COUNTRIES = [["DE", "Deutschland"], ["AT", "Österreich"], ["CH", "Schweiz"], ["NL", "Niederlande"], ["BE", "Belgien"],
        ["LU", "Luxemburg"], ["FR", "Frankreich"], ["IT", "Italien"], ["ES", "Spanien"], ["PT", "Portugal"], ["GB", "Vereinigtes Königreich"],
        ["IE", "Irland"], ["PL", "Polen"], ["CZ", "Tschechien"], ["SK", "Slowakei"], ["HU", "Ungarn"], ["SI", "Slowenien"], ["HR", "Kroatien"],
        ["RO", "Rumänien"], ["BG", "Bulgarien"], ["GR", "Griechenland"], ["DK", "Dänemark"], ["SE", "Schweden"], ["NO", "Norwegen"],
        ["FI", "Finnland"], ["EE", "Estland"], ["LV", "Lettland"], ["LT", "Litauen"], ["TR", "Türkei"], ["UA", "Ukraine"], ["US", "USA"],
        ["CA", "Kanada"], ["BR", "Brasilien"], ["MX", "Mexiko"], ["AR", "Argentinien"], ["AU", "Australien"], ["NZ", "Neuseeland"],
        ["JP", "Japan"], ["KR", "Südkorea"], ["CN", "China"], ["IN", "Indien"], ["ZA", "Südafrika"], ["AE", "Vereinigte Arabische Emirate"]];
    const LANGUAGES = [["de", "Deutsch"], ["en", "Englisch"], ["fr", "Französisch"], ["es", "Spanisch"], ["it", "Italienisch"],
        ["nl", "Niederländisch"], ["pl", "Polnisch"], ["pt", "Portugiesisch"], ["tr", "Türkisch"], ["cs", "Tschechisch"], ["sk", "Slowakisch"],
        ["da", "Dänisch"], ["sv", "Schwedisch"], ["no", "Norwegisch"], ["fi", "Finnisch"], ["hu", "Ungarisch"], ["ro", "Rumänisch"],
        ["bg", "Bulgarisch"], ["hr", "Kroatisch"], ["sl", "Slowenisch"], ["el", "Griechisch"], ["uk", "Ukrainisch"], ["ru", "Russisch"],
        ["ar", "Arabisch"], ["ja", "Japanisch"], ["zh", "Chinesisch"], ["ko", "Koreanisch"]];
    window.GSRA_COUNTRIES = COUNTRIES;
    window.GSRA_LANGUAGES = LANGUAGES;
    const countryName = (code) => (COUNTRIES.find(([k]) => k === code) || [null, code])[1];
    const languageName = (code) => (LANGUAGES.find(([k]) => k === code) || [null, code])[1];
    window.gsraCountryName = countryName;
    window.gsraLanguageName = languageName;

    // „Deutschland · spricht Deutsch, Englisch“ (leer, wenn nichts angegeben)
    window.gsraOriginLine = (profile) => {
        const langs = Array.isArray(profile?.languages) ? profile.languages : [];
        if (!profile?.country && !langs.length) return null;
        const line = document.createElement("div");
        line.className = "gsra-origin";
        if (profile.country) {
            const c = document.createElement("span");
            c.innerHTML = '<i class="fa-solid fa-location-dot"></i> ';
            c.append(countryName(profile.country));
            line.appendChild(c);
        }
        if (langs.length) {
            const l = document.createElement("span");
            l.innerHTML = '<i class="fa-solid fa-language"></i> ';
            l.append(`spricht ${langs.map(languageName).join(", ")}`);
            line.appendChild(l);
        }
        return line;
    };

    // Abzeichen im Profil: Rolle (Admin, Moderator) und Coach (Pro-Coach bzw. GSRA-Coach)
    window.gsraProfileBadges = async (meta, userId, profile) => {
        if (!meta || !userId) return;
        meta.querySelectorAll(".gsra-role-badge, .gsra-coach-badge").forEach(b => b.remove());
        const first = meta.firstChild;
        if (profile?.role === "admin" || profile?.role === "moderator") {
            const badge = document.createElement("span");
            badge.className = `gsra-role-badge ${profile.role === "admin" ? "gsra-admin-badge" : "gsra-mod-badge"}`;
            badge.innerHTML = profile.role === "admin" ? '<i class="fa-solid fa-shield-halved"></i> GSRA-Admin' : '<i class="fa-solid fa-user-shield"></i> GSRA-Moderator';
            meta.insertBefore(badge, first);
        }
        const rep = await window.gsraReputation(userId);
        const c = rep?.coaching;
        if (!c?.pro && !c?.lizenz) return;
        const coach = document.createElement("span");
        coach.className = `gsra-coach-badge${c.pro ? " pro" : ""}`;
        coach.innerHTML = c.pro ? '<i class="fa-solid fa-crown"></i> Pro-Coach' : '<i class="fa-solid fa-award"></i> GSRA-Coach';
        const after = meta.querySelector(".gsra-role-badge");
        meta.insertBefore(coach, after ? after.nextSibling : meta.firstChild);
    };

    // Coach-Bereich im Profil: neueste Bewertungen mit Kommentar und Link zu den Coachings
    window.gsraRenderCoachReviews = async (target, userId, name = "") => {
        if (!target || !userId) return;
        const rep = await window.gsraReputation(userId);
        const c = rep?.coaching;
        if (!c || (!c.angebote && !c.anzahl && !c.pro && !c.lizenz)) {
            target.replaceChildren();
            return;
        }
        const box = document.createElement("div");
        box.className = "rep-box gsra-coach-box";
        box.innerHTML = '<div class="rep-title"><i class="fa-solid fa-chalkboard-user"></i> Coaching</div>';
        const coachLvl = level(c);
        const head = document.createElement("div");
        head.className = "gsra-coach-head";
        head.appendChild(coachLvl ? chip(coachLvl, `Ø ${LEVELS[coachLvl][1]}`) : chip(null, "Noch keine Coach-Bewertungen"));
        const facts = [c.anzahl ? plural(Number(c.anzahl), "Bewertung", "Bewertungen") : "", plural(Number(c.angebote || 0), "Angebot", "Angebote"),
            c.erledigt ? plural(Number(c.erledigt), "Coaching", "Coachings") + " gegeben" : ""].filter(Boolean);
        head.append(` ${facts.join(" · ")}`);
        box.appendChild(head);
        if (c.anzahl) {
            const { data } = await db().from("coaching_reviews").select("buyer_id, rating, tags, comment, created_at")
                .eq("coach_id", userId).order("created_at", { ascending: false }).limit(3);
            const ids = [...new Set((data || []).map(r => r.buyer_id))];
            const { data: people } = ids.length ? await db().from("profiles").select("id, username").in("id", ids) : { data: [] };
            const nameOf = (id) => (people || []).find(p => p.id === id)?.username || "GSRA-Mitglied";
            const LEVEL_OF = { 1: "ideal", 0: "in_ordnung", "-1": "mangelhaft", "-2": "schlecht" };
            (data || []).forEach(r => {
                const item = document.createElement("div");
                item.className = "gsra-coach-review";
                const lvl = LEVEL_OF[r.rating];
                item.appendChild(chip(lvl, LEVELS[lvl]?.[1] || ""));
                const who = document.createElement("strong");
                who.textContent = ` ${nameOf(r.buyer_id)}`;
                item.appendChild(who);
                const tagText = (r.tags || []).filter(t => COACH_TAGS[t]).map(t => COACH_TAGS[t][1]).join(" · ");
                if (tagText) item.appendChild(Object.assign(document.createElement("small"), { textContent: tagText }));
                if (r.comment) item.appendChild(Object.assign(document.createElement("p"), { textContent: `„${r.comment}“` }));
                box.appendChild(item);
            });
        }
        if (c.angebote) {
            const link = document.createElement("a");
            link.className = "gsra-dialog-btn secondary gsra-coach-link";
            link.href = `coaching.html?coach=${encodeURIComponent(userId)}`;
            link.innerHTML = '<i class="fa-solid fa-chalkboard-user"></i> ';
            link.append(name ? `Coachings von ${name} ansehen` : "Coachings ansehen");
            box.appendChild(link);
        }
        target.replaceChildren(box);
    };

    window.gsraReputation = async (userId, { fresh = false } = {}) => {
        if (!userId) return null;
        if (fresh) cache.delete(userId);
        if (!cache.has(userId)) {
            cache.set(userId, db().rpc("profile_reputation", { _user: userId }).then(({ data, error }) => (error ? null : data), () => null));
        }
        return cache.get(userId);
    };

    const chip = (lvl, text) => {
        const span = document.createElement("span");
        span.className = `rep-chip ${lvl || "none"}`;
        span.innerHTML = `<i class="fa-solid ${lvl ? LEVELS[lvl][0] : "fa-circle-info"}"></i> <span></span>`;
        span.querySelector("span").textContent = text;
        return span;
    };
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

    // Kompakt (z. B. beim Verkäufer im Inserat): „TOP Zufriedenheit · 5 Bewertungen“
    // Ausführlich (Profil): je Bereich eine Zeile, beim Marktplatz zusätzlich häufige Merkmale
    window.gsraRenderReputation = async (target, userId, { compact = false, fresh = false, area = "marktplatz" } = {}) => {
        if (!target || !userId) return;
        const rep = await window.gsraReputation(userId, { fresh });
        if (!rep) {
            target.replaceChildren();
            return;
        }
        const m = rep.marktplatz || {};
        const s = rep.setups || {};
        const v = rep.setup_stimmen || {};
        const c = rep.coaching || {};
        const marketLevel = level(m);
        const setupLevel = level(s);
        const coachLevel = level(c);

        // Kompakt auf der Coach-Karte: „Ø Ideal · 8 Bewertungen · 12 Coachings“
        if (compact && area === "coaching") {
            const line = document.createElement("span");
            line.className = "rep-compact";
            line.appendChild(coachLevel ? chip(coachLevel, `Ø ${LEVELS[coachLevel][1]}`) : chip(null, "Noch keine Coach-Bewertungen"));
            const extra = [c.anzahl ? plural(Number(c.anzahl), "Bewertung", "Bewertungen") : "", c.erledigt ? plural(Number(c.erledigt), "Coaching", "Coachings") : ""].filter(Boolean);
            if (extra.length) line.append(` ${extra.join(" · ")}`);
            target.replaceChildren(line);
            return;
        }

        if (compact) {
            const line = document.createElement("span");
            line.className = "rep-compact";
            line.appendChild(marketLevel ? chip(marketLevel, `Ø ${LEVELS[marketLevel][1]}`) : chip(null, "Noch keine Bewertungen"));
            if (m.anzahl) line.append(` ${plural(m.anzahl, "Bewertung", "Bewertungen")}`);
            target.replaceChildren(line);
            return;
        }

        const box = document.createElement("div");
        box.className = "rep-box";
        box.innerHTML = '<div class="rep-title"><i class="fa-solid fa-star"></i> Zufriedenheit</div>';
        const row = (icon, label, content) => {
            const r = document.createElement("div");
            r.className = "rep-row";
            r.innerHTML = `<span class="rep-area"><i class="fa-solid ${icon}"></i> ${label}</span><span class="rep-value"></span>`;
            r.querySelector(".rep-value").append(...content);
            box.appendChild(r);
            return r;
        };

        // Marktplatz: Stufe, Anzahl, häufige Merkmale (von mindestens der Hälfte genannt)
        const marketContent = marketLevel
            ? [chip(marketLevel, `Ø ${LEVELS[marketLevel][1]}`), document.createTextNode(` ${plural(m.anzahl, "Bewertung", "Bewertungen")}`)]
            : [document.createTextNode("Noch keine Bewertungen")];
        const marketRow = row("fa-tags", "Marktplatz", marketContent);
        const tags = Object.entries(SELLER_TAGS).filter(([key]) => m.anzahl && (m[key] || 0) >= Math.max(1, Math.ceil(m.anzahl / 2)));
        if (tags.length) {
            const list = document.createElement("div");
            list.className = "rep-tags";
            tags.forEach(([, [icon, text]]) => {
                const t = document.createElement("span");
                t.className = "rep-tag";
                t.innerHTML = `<i class="fa-solid ${icon}"></i> ${text}`;
                list.appendChild(t);
            });
            marketRow.appendChild(list);
        }

        // Setups: Stufe aus den Kommentaren, dazu Daumen
        const setupContent = setupLevel
            ? [chip(setupLevel, `Ø ${LEVELS[setupLevel][1]}`), document.createTextNode(` ${plural(s.anzahl, "Bewertung", "Bewertungen")}`)]
            : [document.createTextNode(v.setups ? "Noch keine Bewertungen" : "Noch keine Setups")];
        if (v.setups && (v.likes || v.dislikes)) {
            const thumbs = document.createElement("span");
            thumbs.className = "rep-thumbs";
            thumbs.innerHTML = `<i class="fa-solid fa-thumbs-up"></i> ${Number(v.likes) || 0} <i class="fa-solid fa-thumbs-down"></i> ${Number(v.dislikes) || 0}`;
            setupContent.push(thumbs);
        }
        row("fa-sliders", "Setups", setupContent);
        // Coaching: Pro-Coach bzw. GSRA-Coach, Zufriedenheit, Angebote, gegebene Coachings, häufige Merkmale
        const coachContent = [];
        if (c.pro || c.lizenz) {
            const badge = document.createElement("span");
            badge.className = `rep-coach${c.pro ? " pro" : ""}`;
            badge.innerHTML = c.pro ? '<i class="fa-solid fa-crown"></i> Pro-Coach' : '<i class="fa-solid fa-award"></i> GSRA-Coach';
            coachContent.push(badge);
        }
        if (coachLevel) coachContent.push(chip(coachLevel, `Ø ${LEVELS[coachLevel][1]}`), document.createTextNode(` ${plural(Number(c.anzahl), "Bewertung", "Bewertungen")} · `));
        coachContent.push(Object.assign(document.createElement("span"), c.angebote
            ? { textContent: plural(Number(c.angebote), "Angebot", "Angebote") + (c.erledigt ? ` · ${plural(Number(c.erledigt), "Coaching", "Coachings")} gegeben` : "") }
            : { className: "rep-soon", textContent: "Noch keine Angebote" }));
        const coachRow = row("fa-chalkboard-user", "Coaching", coachContent);
        const coachTags = Object.entries(COACH_TAGS).filter(([key]) => c.anzahl && (c[key] || 0) >= Math.max(1, Math.ceil(c.anzahl / 2)));
        if (coachTags.length) {
            const list = document.createElement("div");
            list.className = "rep-tags";
            coachTags.forEach(([, [icon, text]]) => {
                const t = document.createElement("span");
                t.className = "rep-tag";
                t.innerHTML = `<i class="fa-solid ${icon}"></i> ${text}`;
                list.appendChild(t);
            });
            coachRow.appendChild(list);
        }
        target.replaceChildren(box);
    };

    // Dialog „Coach bewerten“: gleicher Aufbau, eigene Merkmale
    window.gsraRateCoachDialog = ({ coachName = "", title = "", existing = null } = {}) =>
        window.gsraRateSellerDialog({ sellerName: coachName, listingTitle: title, existing, kind: "coach" });

    // Dialog „Verkäufer bewerten“ – Ergebnis: { rating, tags, comment } | { remove: true } | null
    window.gsraRateSellerDialog = ({ sellerName = "", listingTitle = "", existing = null, kind = "seller" } = {}) => new Promise((resolve) => {
        const coach = kind === "coach";
        const TAGS = coach ? COACH_TAGS : SELLER_TAGS;
        const overlay = document.createElement("div");
        overlay.className = "gsra-dialog-overlay";
        overlay.innerHTML = `
            <div class="gsra-dialog rate-dialog" role="dialog" aria-modal="true" aria-labelledby="rateTitle">
                <button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button>
                <div class="gsra-dialog-icon"><i class="fa-solid fa-star"></i></div>
                <h3 class="gsra-dialog-title" id="rateTitle">Verkäufer bewerten</h3>
                <p class="rate-sub"></p>
                <div class="rate-levels" role="radiogroup" aria-label="Zufriedenheit">
                    <button type="button" class="rate-level ideal" data-rating="1" role="radio"><i class="fa-solid fa-star"></i><strong>Ideal</strong><small>Alles bestens</small></button>
                    <button type="button" class="rate-level in_ordnung" data-rating="0" role="radio"><i class="fa-solid fa-thumbs-up"></i><strong>In Ordnung</strong><small>Hat gepasst</small></button>
                    <button type="button" class="rate-level mangelhaft" data-rating="-1" role="radio"><i class="fa-solid fa-triangle-exclamation"></i><strong>Mangelhaft</strong><small>Mit Problemen</small></button>
                    <button type="button" class="rate-level schlecht" data-rating="-2" role="radio"><i class="fa-solid fa-thumbs-down"></i><strong>Schlecht</strong><small>Lief nicht gut</small></button>
                </div>
                <div class="rate-label">Was trifft zu? <small>(optional)</small></div>
                <div class="rate-tags"></div>
                <label class="rate-label" for="rateComment">Kommentar <small>(optional, sichtbar im Profil)</small></label>
                <textarea id="rateComment" class="gsra-dialog-input rate-comment" rows="3" maxlength="500" placeholder="z. B. Schnelle Übergabe, alles wie beschrieben."></textarea>
                <div class="gsra-dialog-actions">
                    <button type="button" class="gsra-dialog-btn secondary">Abbrechen</button>
                    <button type="button" class="gsra-dialog-btn primary" disabled>Bewertung abgeben</button>
                </div>
            </div>`;
        overlay.querySelector(".rate-sub").textContent = [sellerName, listingTitle].filter(Boolean).join(" · ");
        if (coach) {
            overlay.querySelector(".gsra-dialog-title").textContent = "Coach bewerten";
            overlay.querySelector(".rate-comment").placeholder = "z. B. Super erklärt, ich bin in Spa eine Sekunde schneller.";
            overlay.querySelector(".rate-comment").maxLength = 1000;
        }
        const tagBox = overlay.querySelector(".rate-tags");
        const chosen = new Set(existing?.tags || []);
        Object.entries(TAGS).forEach(([key, [icon, text]]) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = `rate-tag-btn${chosen.has(key) ? " active" : ""}`;
            b.setAttribute("aria-pressed", String(chosen.has(key)));
            b.innerHTML = `<i class="fa-solid ${icon}"></i> ${text}`;
            b.addEventListener("click", () => {
                if (chosen.has(key)) chosen.delete(key); else chosen.add(key);
                b.classList.toggle("active", chosen.has(key));
                b.setAttribute("aria-pressed", String(chosen.has(key)));
            });
            tagBox.appendChild(b);
        });
        const comment = overlay.querySelector(".rate-comment");
        comment.value = existing?.comment || "";
        const submit = overlay.querySelector(".gsra-dialog-btn.primary");
        let rating = existing ? Number(existing.rating) : null;
        const levels = [...overlay.querySelectorAll(".rate-level")];
        const syncLevels = () => {
            levels.forEach(b => {
                const on = Number(b.dataset.rating) === rating;
                b.classList.toggle("active", on);
                b.setAttribute("aria-checked", String(on));
            });
            submit.disabled = rating === null;
        };
        levels.forEach(b => b.addEventListener("click", () => { rating = Number(b.dataset.rating); syncLevels(); }));
        if (existing) {
            submit.textContent = "Bewertung ändern";
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "rate-remove";
            remove.innerHTML = '<i class="fa-solid fa-trash"></i> Meine Bewertung löschen';
            remove.addEventListener("click", () => close({ remove: true }));
            overlay.querySelector(".gsra-dialog-actions").after(remove);
        }
        syncLevels();

        const close = (result) => {
            document.removeEventListener("keydown", onKey, true);
            overlay.remove();
            resolve(result);
        };
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close(null);
            }
        };
        overlay.querySelector(".gsra-dialog-close").addEventListener("click", () => close(null));
        overlay.querySelector(".gsra-dialog-btn.secondary").addEventListener("click", () => close(null));
        submit.addEventListener("click", () => {
            if (rating === null) return;
            close({ rating, tags: [...chosen], comment: comment.value.trim() });
        });
        document.addEventListener("keydown", onKey, true);
        document.body.appendChild(overlay);
        (levels.find(b => b.classList.contains("active")) || levels[0]).focus();
    });
})();
