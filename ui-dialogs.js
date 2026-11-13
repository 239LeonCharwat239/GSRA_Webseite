/* =========================================
   GSRA - Eigene Dialoge & Hinweise (statt der Browser-Fenster alert/confirm/prompt)
========================================= */

// Dialog im GSRA-Design. Ergebnis: eingegebener Text bzw. true – beim Abbrechen null (mit Eingabefeld) bzw. false.
// input.multiline: mehrzeiliges Feld (Strg+Enter bestätigt). choices: mehrere Knöpfe [{ value, text, danger }],
// Ergebnis ist dann der value des gewählten Knopfs (Abbrechen: null).
function showDialog({ icon = "fa-circle-info", title = "", message = "", input = null, confirmText = "OK", cancelText = "", danger = false, choices = null }) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "gsra-dialog-overlay";
        const field = !input ? "" : (input.multiline
            ? '<textarea class="gsra-dialog-input" rows="4"></textarea>'
            : '<input type="text" class="gsra-dialog-input" autocomplete="off">');
        overlay.innerHTML = `
            <div class="gsra-dialog${danger ? " danger" : ""}" role="dialog" aria-modal="true">
                <button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button>
                <div class="gsra-dialog-icon"><i class="fa-solid ${icon}"></i></div>
                <h3 class="gsra-dialog-title"></h3>
                <p class="gsra-dialog-message"></p>
                ${field}
                <div class="gsra-dialog-actions${choices ? " stacked" : ""}">
                    ${choices ? "" : (cancelText ? '<button type="button" class="gsra-dialog-btn secondary"></button>' : "")}
                    ${choices ? "" : '<button type="button" class="gsra-dialog-btn primary"></button>'}
                </div>
            </div>`;
        overlay.querySelector(".gsra-dialog-title").textContent = title;
        const messageEl = overlay.querySelector(".gsra-dialog-message");
        if (message) messageEl.textContent = message;
        else messageEl.remove();

        const inputEl = overlay.querySelector(".gsra-dialog-input");
        if (inputEl) {
            inputEl.placeholder = input.placeholder || "";
            inputEl.value = input.value || "";
            inputEl.maxLength = input.maxLength || 60;
            inputEl.readOnly = Boolean(input.readOnly);
            if (input.inputMode) inputEl.inputMode = input.inputMode;
            if (input.autocomplete) inputEl.autocomplete = input.autocomplete;
        }
        // Mehrere Auswahlknöpfe untereinander (z. B. „Für alle löschen“ / „Für mich löschen“), darunter Abbrechen
        if (choices) {
            const actions = overlay.querySelector(".gsra-dialog-actions");
            choices.forEach(choice => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = `gsra-dialog-btn ${choice.danger ? "primary danger-choice" : "primary"}`;
                btn.textContent = choice.text;
                btn.addEventListener("click", () => close(choice.value));
                actions.appendChild(btn);
            });
            if (cancelText) {
                const cancel = document.createElement("button");
                cancel.type = "button";
                cancel.className = "gsra-dialog-btn secondary";
                actions.appendChild(cancel);
            }
        }

        const confirmBtn = overlay.querySelector(".gsra-dialog-btn.primary");
        if (!choices) confirmBtn.textContent = confirmText;
        const cancelBtn = overlay.querySelector(".gsra-dialog-btn.secondary");
        if (cancelBtn) cancelBtn.textContent = cancelText;

        const cancelResult = (choices || (input && !input.readOnly)) ? null : false;
        const close = (result) => {
            document.removeEventListener("keydown", onKey, true);
            overlay.remove();
            resolve(result);
        };
        const submit = () => {
            if (inputEl && !input.readOnly) {
                const value = inputEl.value.trim();
                if (!value) {
                    inputEl.classList.add("invalid");
                    inputEl.focus();
                    return;
                }
                close(value);
            } else {
                close(true);
            }
        };
        const onKey = (e) => {
            if (e.isComposing) return;
            // Im mehrzeiligen Feld macht Enter eine neue Zeile (Strg+Enter bestätigt); mit Auswahlknöpfen bestätigt Enter nichts
            const enterSubmits = e.key === "Enter" && !choices && (!input?.multiline || e.ctrlKey || e.metaKey);
            if (e.key === "Escape" || enterSubmits) {
                e.preventDefault();
                e.stopPropagation();
                if (e.key === "Escape") close(cancelResult);
                else submit();
            }
        };

        if (!choices) confirmBtn.addEventListener("click", submit);
        if (cancelBtn) cancelBtn.addEventListener("click", () => close(cancelResult));
        overlay.querySelector(".gsra-dialog-close").addEventListener("click", () => close(cancelResult));
        overlay.addEventListener("mousedown", (e) => {
            if (e.target === overlay) close(cancelResult);
        });
        if (inputEl) inputEl.addEventListener("input", () => inputEl.classList.remove("invalid"));
        document.addEventListener("keydown", onKey, true);

        document.body.appendChild(overlay);
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
        } else if (choices) {
            // Bei Auswahlknöpfen liegt der Fokus auf „Abbrechen“, damit Enter nie versehentlich löscht
            if (cancelBtn) cancelBtn.focus();
        } else {
            confirmBtn.focus();
        }
    });
}

// Kurze Hinweise unten rechts
function showToast(message, type = "info") {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = '<i class="fa-solid fa-circle-info text-blue"></i>';
    if (type === "success") icon = '<i class="fa-solid fa-circle-check" style="color: #00ff88;"></i>';
    if (type === "error") icon = '<i class="fa-solid fa-circle-exclamation" style="color: #ff4d4d;"></i>';

    toast.innerHTML = `${icon} <span></span>`;
    toast.querySelector("span").textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(110%)";
        toast.style.transition = "all 0.35s ease";
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

// Kleines Auswahlmenü an einem Element (z. B. Profil- oder Forenbild): items = [{ icon, text, danger, onClick }]
function showActionMenu(anchor, items) {
    document.querySelectorAll(".gsra-action-menu").forEach(m => m.remove());
    const menu = document.createElement("div");
    menu.className = "gsra-action-menu";
    items.forEach(item => {
        const btn = document.createElement("button");
        btn.type = "button";
        if (item.danger) btn.className = "danger";
        btn.innerHTML = `<i class="fa-solid ${item.icon}"></i><span></span>`;
        btn.querySelector("span").textContent = item.text;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            close();
            item.onClick();
        });
        menu.appendChild(btn);
    });
    const close = () => {
        document.removeEventListener("mousedown", onOutside, true);
        document.removeEventListener("keydown", onKey, true);
        menu.remove();
    };
    const onOutside = (e) => { if (!menu.contains(e.target)) close(); };
    const onKey = (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        close();
    };
    document.body.appendChild(menu);

    // Unter dem Element, passt es dort nicht mehr hin, darüber
    const rect = anchor.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    const below = rect.bottom + 8 + height <= window.innerHeight;
    menu.style.left = `${left}px`;
    menu.style.top = `${below ? rect.bottom + 8 : Math.max(8, rect.top - height - 8)}px`;

    setTimeout(() => {
        document.addEventListener("mousedown", onOutside, true);
        document.addEventListener("keydown", onKey, true);
    }, 0);
    menu.querySelector("button")?.focus();
}

// Bild in Großansicht (Profil- und Forenbilder)
function showImageLightbox(url) {
    if (!url) return;
    const overlay = document.createElement("div");
    overlay.className = "gsra-lightbox";
    overlay.innerHTML = '<button type="button" class="gsra-lightbox-close" title="Schließen (Esc)"><i class="fa-solid fa-xmark"></i></button><img alt="Großansicht">';
    overlay.querySelector("img").src = url;
    const close = () => {
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
    };
    const onKey = (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        close();
    };
    overlay.addEventListener("click", (e) => { if (e.target !== overlay.querySelector("img")) close(); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);
}

// Social-Media-Links: Plattform am Link erkennen und mit ihrem Logo anzeigen
const SOCIAL_PLATFORMS = [
    { hosts: ["youtube.com", "youtu.be"], name: "YouTube", icon: "fa-brands fa-youtube", color: "#ff0033" },
    { hosts: ["twitch.tv"], name: "Twitch", icon: "fa-brands fa-twitch", color: "#9146ff" },
    { hosts: ["instagram.com"], name: "Instagram", icon: "fa-brands fa-instagram", color: "#e1306c" },
    { hosts: ["tiktok.com"], name: "TikTok", icon: "fa-brands fa-tiktok", color: "#25f4ee" },
    { hosts: ["x.com", "twitter.com"], name: "X", glyph: "𝕏", color: "#ffffff" },
    { hosts: ["facebook.com", "fb.com"], name: "Facebook", icon: "fa-brands fa-facebook", color: "#1877f2" },
    { hosts: ["discord.gg", "discord.com"], name: "Discord", icon: "fa-brands fa-discord", color: "#5865f2" },
    { hosts: ["reddit.com"], name: "Reddit", icon: "fa-brands fa-reddit", color: "#ff4500" },
    { hosts: ["steamcommunity.com", "steampowered.com"], name: "Steam", icon: "fa-brands fa-steam", color: "#c7d5e0" },
    { hosts: ["kick.com"], name: "Kick", glyph: "K", color: "#53fc18" },
    { hosts: ["linkedin.com"], name: "LinkedIn", icon: "fa-brands fa-linkedin", color: "#0a66c2" },
    { hosts: ["github.com"], name: "GitHub", icon: "fa-brands fa-github", color: "#ffffff" },
    { hosts: ["patreon.com"], name: "Patreon", icon: "fa-brands fa-patreon", color: "#ff424d" },
    { hosts: ["spotify.com"], name: "Spotify", icon: "fa-brands fa-spotify", color: "#1db954" },
    { hosts: ["wa.me", "whatsapp.com"], name: "WhatsApp", icon: "fa-brands fa-whatsapp", color: "#25d366" },
    { hosts: ["t.me", "telegram.me"], name: "Telegram", icon: "fa-brands fa-telegram", color: "#2aabee" },
    { hosts: ["iracing.com"], name: "iRacing", icon: "fa-solid fa-flag-checkered", color: "#0055ff" }
];

// Eingabe zu einem sicheren Link (nur http/https) machen – ohne „https://“ wird es ergänzt. Ungültig: null
function normalizeSocialUrl(input) {
    const value = String(input || "").trim();
    if (!value) return null;
    try {
        const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
        if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || url.href.length > 300) return null;
        return url.href;
    } catch (e) {
        return null;
    }
}

function socialPlatformOf(link) {
    let host = "";
    try { host = new URL(link).hostname.toLowerCase().replace(/^www\.|^m\./, ""); } catch (e) { /* kein gültiger Link */ }
    const platform = SOCIAL_PLATFORMS.find(p => p.hosts.some(h => host === h || host.endsWith(`.${h}`)));
    return platform || { name: "Webseite", icon: "fa-solid fa-globe", color: "#a0a5b1" };
}

// Logo der Plattform (Font Awesome bzw. Schriftzeichen, z. B. 𝕏)
function socialIconHtml(platform) {
    return platform.glyph
        ? `<span class="gsra-social-glyph">${platform.glyph}</span>`
        : `<i class="${platform.icon}"></i>`;
}

// Lesbare Kurzform eines Links, z. B. youtube.com/@kanal
function socialLinkLabel(link) {
    try {
        const url = new URL(link);
        const path = decodeURIComponent(url.pathname).replace(/\/+$/, "");
        return `${url.hostname.replace(/^www\./, "")}${path}`.slice(0, 60);
    } catch (e) {
        return String(link).slice(0, 60);
    }
}

// Social-Media-Links als Streifen mit dem Logo der Plattform (Profil im Messenger und im Marktplatz)
function renderSocialLinks(container, links) {
    container.replaceChildren();
    const valid = (Array.isArray(links) ? links : []).map(normalizeSocialUrl).filter(Boolean);
    container.style.display = valid.length ? "" : "none";
    valid.forEach(link => {
        const platform = socialPlatformOf(link);
        const a = document.createElement("a");
        a.className = "gsra-social-link";
        a.href = link;
        a.target = "_blank";
        a.rel = "noopener noreferrer nofollow";
        a.style.setProperty("--platform-color", platform.color);
        a.innerHTML = `<span class="gsra-social-icon">${socialIconHtml(platform)}</span><span class="gsra-social-text"><strong></strong><small></small></span><i class="fa-solid fa-arrow-up-right-from-square"></i>`;
        a.querySelector("strong").textContent = platform.name;
        a.querySelector("small").textContent = socialLinkLabel(link);
        container.appendChild(a);
    });
}

/* =========================================
   Auswahllisten im GSRA-Design
   Das <select> bleibt das echte Bedienelement (Formulare, Tastatur und Skripte funktionieren unverändert);
   ersetzt wird nur die aufklappende Liste des Browsers. Auf Touch-Geräten bleibt die Auswahl des Geräts,
   weil sie dort am besten bedienbar ist.
========================================= */
(() => {
    const desktop = window.matchMedia("(hover: hover) and (pointer: fine)");
    let state = null; // { select, list, items: [{ el, option }], active }

    const usable = (select) => select && desktop.matches && !select.multiple && !(select.size > 1) && !select.disabled;

    function close(focus = false) {
        if (!state) return;
        const { select, list } = state;
        state = null;
        list.remove();
        select.classList.remove("gsra-select-open");
        if (focus) select.focus({ preventScroll: true });
    }

    function setActive(index, scroll = true) {
        if (!state || !state.items.length) return;
        const next = Math.max(0, Math.min(state.items.length - 1, index));
        state.items.forEach((item, i) => item.el.classList.toggle("active", i === next));
        state.active = next;
        if (scroll) state.items[next].el.scrollIntoView({ block: "nearest" });
    }

    // Nächste wählbare Zeile in eine Richtung (deaktivierte werden übersprungen)
    function step(direction) {
        if (!state) return;
        let i = state.active;
        do { i += direction; } while (state.items[i] && state.items[i].option.disabled);
        if (state.items[i]) setActive(i);
    }

    function choose(index) {
        if (!state) return;
        const item = state.items[index];
        if (!item || item.option.disabled) return;
        const select = state.select;
        const changed = select.value !== item.option.value || select.selectedIndex !== item.option.index;
        close(true);
        if (!changed) return;
        select.selectedIndex = item.option.index;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function place(select, list) {
        const rect = select.getBoundingClientRect();
        const gap = 6;
        const below = window.innerHeight - rect.bottom - gap - 8;
        const above = rect.top - gap - 8;
        const wanted = Math.min(340, list.scrollHeight + 2);
        const openUp = below < Math.min(wanted, 180) && above > below;
        const height = Math.max(120, Math.min(wanted, openUp ? above : below));
        list.style.maxHeight = `${height}px`;
        list.style.minWidth = `${Math.max(rect.width, 180)}px`;
        list.style.maxWidth = `${Math.min(440, document.documentElement.clientWidth - 16)}px`;
        const width = list.offsetWidth;
        list.style.left = `${Math.max(8, Math.min(rect.left, document.documentElement.clientWidth - width - 8))}px`;
        list.style.top = openUp ? `${rect.top - gap - Math.min(height, list.offsetHeight)}px` : `${rect.bottom + gap}px`;
        list.classList.toggle("up", openUp);
    }

    function open(select) {
        close();
        const list = document.createElement("div");
        list.className = "gsra-select-list";
        list.setAttribute("role", "listbox");
        const items = [];
        const addOption = (option) => {
            if (option.hidden || option.style.display === "none") return;
            const el = document.createElement("div");
            el.className = "gsra-select-option";
            el.setAttribute("role", "option");
            el.setAttribute("aria-selected", String(option.selected));
            if (option.disabled) el.classList.add("disabled");
            if (option.selected) el.classList.add("selected");
            const label = document.createElement("span");
            label.textContent = option.label || option.textContent;
            el.appendChild(label);
            if (option.selected) el.insertAdjacentHTML("beforeend", '<i class="fa-solid fa-check"></i>');
            const index = items.length;
            el.addEventListener("mousemove", () => { if (state && state.active !== index && !option.disabled) setActive(index, false); });
            el.addEventListener("click", () => choose(index));
            list.appendChild(el);
            items.push({ el, option });
        };
        [...select.children].forEach(child => {
            if (child.tagName === "OPTGROUP") {
                const group = document.createElement("div");
                group.className = "gsra-select-group";
                group.textContent = child.label;
                list.appendChild(group);
                [...child.children].forEach(addOption);
            } else if (child.tagName === "OPTION") addOption(child);
        });
        if (!items.length) return;
        // Klicks in der Liste lassen den Fokus auf dem Auswahlfeld
        list.addEventListener("mousedown", (e) => e.preventDefault());
        document.body.appendChild(list);
        state = { select, list, items, active: -1 };
        select.classList.add("gsra-select-open");
        place(select, list);
        const selected = items.findIndex(item => item.option.selected);
        setActive(selected >= 0 ? selected : 0);
    }

    // Maus: die Liste des Browsers unterdrücken und die eigene zeigen
    document.addEventListener("mousedown", (e) => {
        const select = e.target instanceof Element ? e.target.closest("select") : null;
        if (state && !state.list.contains(e.target) && select !== state.select) close();
        if (!select || e.button !== 0 || !usable(select)) return;
        e.preventDefault();
        select.focus({ preventScroll: true });
        if (state && state.select === select) close();
        else open(select);
    }, true);

    // Tastatur: Leertaste, Alt+Pfeil und F4 öffnen; in der Liste Pfeile, Pos1/Ende, Enter, Escape und Tippen
    let typed = "";
    let typedTimer = null;
    document.addEventListener("keydown", (e) => {
        const select = document.activeElement;
        if (!(select instanceof HTMLSelectElement) || !usable(select)) return;
        const isOpen = state && state.select === select;
        if (!isOpen) {
            if (e.key === " " || e.key === "F4" || (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp"))) {
                e.preventDefault();
                open(select);
            }
            return;
        }
        if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(true); }
        else if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
        else if (e.key === "Home") { e.preventDefault(); state.active = -1; step(1); }
        else if (e.key === "End") { e.preventDefault(); state.active = state.items.length; step(-1); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(state.active); }
        else if (e.key === "Tab") choose(state.active);
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            // Tippen springt zum ersten passenden Eintrag
            e.preventDefault();
            clearTimeout(typedTimer);
            typed += e.key.toLowerCase();
            typedTimer = setTimeout(() => { typed = ""; }, 700);
            const hit = state.items.findIndex(item => !item.option.disabled && item.el.textContent.trim().toLowerCase().startsWith(typed));
            if (hit >= 0) setActive(hit);
        }
    }, true);

    // Schließen, sobald sich darunter etwas bewegt oder das Feld den Fokus verliert
    window.addEventListener("scroll", (e) => { if (state && !(e.target instanceof Node && state.list.contains(e.target))) close(); }, true);
    window.addEventListener("resize", () => close());
    document.addEventListener("focusout", (e) => { if (state && e.target === state.select) setTimeout(() => { if (state && document.activeElement !== state.select) close(); }, 0); });
})();
