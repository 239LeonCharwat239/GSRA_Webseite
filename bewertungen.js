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
    const LEVELS = {
        top: ["fa-thumbs-up", "TOP Zufriedenheit"],
        ok: ["fa-hand", "OK Zufriedenheit"],
        naja: ["fa-thumbs-down", "Na ja Zufriedenheit"]
    };

    // Anteil zufriedener Bewertungen (neutral zählt halb): ab 90 % TOP, ab 70 % OK, sonst „Na ja“
    const level = (good, neutral, count) => {
        if (!count) return null;
        const share = (good + neutral * 0.5) / count;
        return share >= 0.9 ? "top" : share >= 0.7 ? "ok" : "naja";
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
    window.gsraRenderReputation = async (target, userId, { compact = false, fresh = false } = {}) => {
        if (!target || !userId) return;
        const rep = await window.gsraReputation(userId, { fresh });
        if (!rep) {
            target.replaceChildren();
            return;
        }
        const m = rep.marktplatz || {};
        const s = rep.setups || {};
        const v = rep.setup_stimmen || {};
        const marketLevel = level(m.top || 0, m.ok || 0, m.anzahl || 0);
        const setupLevel = level(s.hilfreich || 0, s.okay || 0, s.anzahl || 0);

        if (compact) {
            const line = document.createElement("span");
            line.className = "rep-compact";
            line.appendChild(marketLevel ? chip(marketLevel, LEVELS[marketLevel][1]) : chip(null, "Noch keine Bewertungen"));
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
            ? [chip(marketLevel, LEVELS[marketLevel][1]), document.createTextNode(` ${plural(m.anzahl, "Bewertung", "Bewertungen")}`)]
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
            ? [chip(setupLevel, LEVELS[setupLevel][1]), document.createTextNode(` ${plural(s.anzahl, "Bewertung", "Bewertungen")}`)]
            : [document.createTextNode(v.setups ? "Noch keine Bewertungen" : "Noch keine Setups")];
        if (v.setups && (v.likes || v.dislikes)) {
            const thumbs = document.createElement("span");
            thumbs.className = "rep-thumbs";
            thumbs.innerHTML = `<i class="fa-solid fa-thumbs-up"></i> ${Number(v.likes) || 0} <i class="fa-solid fa-thumbs-down"></i> ${Number(v.dislikes) || 0}`;
            setupContent.push(thumbs);
        }
        row("fa-sliders", "Setups", setupContent);
        row("fa-chalkboard-user", "Coaching", [Object.assign(document.createElement("span"), { className: "rep-soon", textContent: "Folgt bald" })]);
        target.replaceChildren(box);
    };

    // Dialog „Verkäufer bewerten“ – Ergebnis: { rating, tags, comment } | { remove: true } | null
    window.gsraRateSellerDialog = ({ sellerName = "", listingTitle = "", existing = null } = {}) => new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "gsra-dialog-overlay";
        overlay.innerHTML = `
            <div class="gsra-dialog rate-dialog" role="dialog" aria-modal="true" aria-labelledby="rateTitle">
                <button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button>
                <div class="gsra-dialog-icon"><i class="fa-solid fa-star"></i></div>
                <h3 class="gsra-dialog-title" id="rateTitle">Verkäufer bewerten</h3>
                <p class="rate-sub"></p>
                <div class="rate-levels" role="radiogroup" aria-label="Zufriedenheit">
                    <button type="button" class="rate-level top" data-rating="1" role="radio"><i class="fa-solid fa-thumbs-up"></i><strong>TOP</strong><small>Alles bestens</small></button>
                    <button type="button" class="rate-level ok" data-rating="0" role="radio"><i class="fa-solid fa-hand"></i><strong>OK</strong><small>In Ordnung</small></button>
                    <button type="button" class="rate-level naja" data-rating="-1" role="radio"><i class="fa-solid fa-thumbs-down"></i><strong>Na ja</strong><small>Lief nicht gut</small></button>
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
        const tagBox = overlay.querySelector(".rate-tags");
        const chosen = new Set(existing?.tags || []);
        Object.entries(SELLER_TAGS).forEach(([key, [icon, text]]) => {
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
