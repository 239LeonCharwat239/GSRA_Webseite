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

    // Nation und Sprachen (Profil, Dashboard, Coaching) – alle Länder (ISO 3166-1) und Sprachen (ISO 639-1).
    // Die deutschen Namen liefert der Browser (Intl.DisplayNames); die Datenbank speichert nur die Codes (029/031).
    const COUNTRY_CODES = ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
        "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF " +
        "GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW " +
        "KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL " +
        "NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST " +
        "SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW").split(" ");
    const LANGUAGE_CODES = ("aa ab af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo " +
        "es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km " +
        "kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa " +
        "pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk " +
        "ur uz ve vi vo wa wo xh yi yo za zh zu").split(" ");
    // Falls der Browser keine Namen liefern kann: wenigstens die häufigsten auf Deutsch
    const FALLBACK_NAMES = {
        DE: "Deutschland", AT: "Österreich", CH: "Schweiz", NL: "Niederlande", BE: "Belgien", FR: "Frankreich", IT: "Italien", ES: "Spanien",
        GB: "Vereinigtes Königreich", US: "Vereinigte Staaten", PL: "Polen", XK: "Kosovo",
        de: "Deutsch", en: "Englisch", fr: "Französisch", es: "Spanisch", it: "Italienisch", nl: "Niederländisch", pl: "Polnisch",
        pt: "Portugiesisch", tr: "Türkisch", ru: "Russisch",
        // Seltene Sprachen, die manche Browser nicht benennen können
        aa: "Afar", ab: "Abchasisch", av: "Awarisch", ba: "Baschkirisch", bi: "Bislama", bo: "Tibetisch", ce: "Tschetschenisch",
        ch: "Chamorro", cr: "Cree", cu: "Kirchenslawisch", cv: "Tschuwaschisch", dz: "Dzongkha", ff: "Ful", fj: "Fidschi",
        gv: "Manx", ho: "Hiri Motu", hz: "Herero", ie: "Interlingue", ii: "Yi", ik: "Inupiak", io: "Ido", iu: "Inuktitut",
        kg: "Kongolesisch", ki: "Kikuyu", kj: "Kwanyama", kl: "Grönländisch", kr: "Kanuri", ks: "Kaschmiri", kv: "Komi",
        kw: "Kornisch", li: "Limburgisch", lu: "Kiluba", mh: "Marshallesisch", na: "Nauruisch", nd: "Nord-Ndebele", ng: "Ndonga",
        nr: "Süd-Ndebele", nv: "Navajo", oj: "Ojibwe", os: "Ossetisch", pi: "Pali", rn: "Kirundi", sc: "Sardisch", se: "Nordsamisch",
        sg: "Sango", ss: "Swazi", ty: "Tahitisch", ve: "Venda", vo: "Volapük", za: "Zhuang"
    };
    const displayNames = (type, lang = "de") => {
        try { return new Intl.DisplayNames([lang], { type, fallback: "none" }); } catch (e) { return null; }
    };
    // Deutscher Name; seltene Sprachen kennt der Browser teils nur auf Englisch
    const regionNames = [displayNames("region"), displayNames("region", "en")];
    const languageNames = [displayNames("language"), displayNames("language", "en")];
    const nameFor = (namesList, code) => {
        for (const names of namesList) {
            let name = null;
            try { name = names?.of(code) || null; } catch (e) { name = null; }
            if (name && name !== code) return name;
        }
        return FALLBACK_NAMES[code] || null;
    };
    const byName = (a, b) => a[1].localeCompare(b[1], "de");
    const COUNTRIES = COUNTRY_CODES.map(c => [c, nameFor(regionNames, c)]).filter(([, n]) => n).sort(byName);
    const LANGUAGES = LANGUAGE_CODES.map(c => [c, nameFor(languageNames, c)]).filter(([, n]) => n).sort(byName);
    // Häufig gewählt: oben im Dashboard als Schnellauswahl
    window.GSRA_COMMON_LANGUAGES = ["de", "en", "fr", "es", "it", "nl", "pl", "pt", "tr", "ru"];
    window.GSRA_COUNTRIES = COUNTRIES;
    window.GSRA_LANGUAGES = LANGUAGES;
    // Auswahlliste mit Suche (Nation, Sprachen): eigene Liste im GSRA-Stil statt der Vorschläge des Browsers.
    // Immer direkt unter dem Feld, feste Höhe zum Scrollen, Treffer hervorgehoben, mit Pfeiltasten und Enter bedienbar.
    const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("de");
    let comboCount = 0;
    let openCombo = null; // immer nur eine Liste offen
    document.addEventListener("pointerdown", (e) => {
        if (openCombo && !openCombo.wrap.contains(e.target)) openCombo.close();
    });
    window.gsraCombobox = (input, entries, { onPick, pinned = [], pinnedLabel = "Häufig", allLabel = "Alle", showCode = false } = {}) => {
        if (!input || !Array.isArray(entries)) return null;
        const wrap = document.createElement("div");
        wrap.className = "gsra-combo";
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
        const list = document.createElement("ul");
        const listId = `gsra-combo-${++comboCount}`;
        list.id = listId;
        list.className = "gsra-combo-list";
        list.setAttribute("role", "listbox");
        list.hidden = true;
        wrap.appendChild(list);
        input.removeAttribute("list");
        input.setAttribute("role", "combobox");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-expanded", "false");
        input.setAttribute("aria-controls", listId);

        let shown = [];
        let active = -1;
        const options = () => [...list.querySelectorAll(".gsra-combo-option")];
        const setActive = (index) => {
            const all = options();
            all.forEach(o => o.classList.remove("active"));
            active = Math.max(-1, Math.min(index, all.length - 1));
            if (active < 0) { input.removeAttribute("aria-activedescendant"); return; }
            all[active].classList.add("active");
            input.setAttribute("aria-activedescendant", all[active].id);
            all[active].scrollIntoView({ block: "nearest" });
        };
        const close = () => {
            list.hidden = true;
            wrap.classList.remove("open");
            input.setAttribute("aria-expanded", "false");
            setActive(-1);
            if (openCombo?.wrap === wrap) openCombo = null;
        };
        const pick = (entry) => {
            if (!entry) return;
            close();
            if (typeof onPick === "function") onPick(entry[0], entry[1]);
        };
        const heading = (text) => {
            const li = document.createElement("li");
            li.className = "gsra-combo-head";
            li.setAttribute("role", "presentation");
            li.textContent = text;
            list.appendChild(li);
        };
        const render = () => {
            const raw = input.value.trim();
            const term = fold(raw);
            list.replaceChildren();
            let pinCount = 0;
            if (!term) {
                const pin = pinned.map(code => entries.find(([c]) => c === code)).filter(Boolean);
                pinCount = pin.length;
                shown = [...pin, ...entries.filter(([c]) => !pinned.includes(c))];
                if (pinCount) heading(pinnedLabel);
            } else {
                // Erst Namen, die mit dem Suchwort beginnen, dann solche mit einem Wort, das so beginnt
                // („staaten“ findet Vereinigte Staaten; „sch“ findet nicht jede Sprache auf „-isch“). Umlaute egal.
                const starts = [];
                const contains = [];
                entries.forEach(entry => {
                    const name = fold(entry[1]);
                    if (name.startsWith(term)) starts.push(entry);
                    else if (name.split(/[\s\-()/,.]+/).some(word => word.startsWith(term)) || fold(entry[0]) === term) contains.push(entry);
                });
                shown = [...starts, ...contains];
            }
            if (!shown.length) {
                const li = document.createElement("li");
                li.className = "gsra-combo-empty";
                li.setAttribute("role", "presentation");
                li.textContent = `Nichts gefunden für „${raw}“`;
                list.appendChild(li);
            }
            const lowerTerm = raw.toLocaleLowerCase("de");
            shown.forEach(([code, label], i) => {
                if (pinCount && i === pinCount) heading(allLabel);
                const li = document.createElement("li");
                li.id = `${listId}-${i}`;
                li.className = "gsra-combo-option";
                li.setAttribute("role", "option");
                const name = document.createElement("span");
                // Hervorheben: Treffer am Anfang bzw. am Wortanfang
                const lowerLabel = label.toLocaleLowerCase("de");
                const at = !lowerTerm ? -1 : lowerLabel.startsWith(lowerTerm) ? 0
                    : (() => { const m = new RegExp(`[\\s\\-()/,.]${lowerTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).exec(lowerLabel); return m ? m.index + 1 : -1; })();
                if (at >= 0) {
                    const mark = document.createElement("mark");
                    mark.textContent = label.slice(at, at + raw.length);
                    name.append(label.slice(0, at), mark, label.slice(at + raw.length));
                } else {
                    name.textContent = label;
                }
                li.appendChild(name);
                if (showCode) {
                    const badge = document.createElement("span");
                    badge.className = "gsra-combo-code";
                    badge.textContent = code;
                    li.appendChild(badge);
                }
                li.addEventListener("mousedown", (e) => e.preventDefault()); // Feld behält den Fokus
                li.addEventListener("click", () => pick([code, label]));
                list.appendChild(li);
            });
            if (openCombo && openCombo.wrap !== wrap) openCombo.close();
            openCombo = { wrap, close };
            list.hidden = false;
            wrap.classList.add("open");
            input.setAttribute("aria-expanded", "true");
            list.scrollTop = 0;
            setActive(term && shown.length ? 0 : -1);
        };

        input.addEventListener("focus", render);
        input.addEventListener("click", () => { if (list.hidden) render(); });
        input.addEventListener("input", render);
        input.addEventListener("blur", () => setTimeout(close, 120));
        input.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (list.hidden) render();
                setActive(active + 1);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive(active - 1);
            } else if (e.key === "Enter") {
                if (list.hidden || !shown.length || !input.value.trim()) return;
                e.preventDefault(); // Enter wählt aus, statt das Formular abzuschicken
                pick(shown[active >= 0 ? active : 0]);
            } else if (e.key === "Escape" && !list.hidden) {
                e.preventDefault();
                e.stopPropagation();
                close();
            }
        });
        return { close, refresh: render };
    };

    const countryName = (code) => (COUNTRIES.find(([k]) => k === code) || [null, nameFor(regionNames, code) || code])[1];
    const languageName = (code) => (LANGUAGES.find(([k]) => k === code) || [null, nameFor(languageNames, code) || code])[1];
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
        // Abzeichen nur bei gültiger Lizenz (Pro-Coaches haben sie automatisch; entzogen = kein Abzeichen)
        if (!c?.lizenz) return;
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
        if (c.lizenz) {
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
