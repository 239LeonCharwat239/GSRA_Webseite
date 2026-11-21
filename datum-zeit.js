/* =========================================
   GSRA – Datum und Uhrzeit im GSRA-Design
   Ersetzt die (weißen, je nach Browser verschiedenen) Auswahlfenster für
   <input type="date">, <input type="time"> und <input type="datetime-local">.
   Das echte Feld bleibt unsichtbar erhalten: Wert, Pflichtfeld, min/max, step und die
   Ereignisse „input“/„change“ funktionieren wie bisher. Neue Felder werden automatisch erkannt.
========================================= */
(function () {
    const TYPES = ["date", "time", "datetime-local"];
    const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
    const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const NATIVE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    const pad = (n) => String(n).padStart(2, "0");
    const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parseDay = (s) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
        return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    };
    const el = (tag, cls, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    const button = (cls, html, title) => {
        const b = el("button", cls);
        b.type = "button";
        b.innerHTML = html;
        if (title) { b.title = title; b.setAttribute("aria-label", title); }
        return b;
    };

    // Wert zerlegt in Tag (JJJJ-MM-TT) und Uhrzeit (HH:MM)
    function parts(input) {
        const v = NATIVE.get.call(input) || "";
        if (input.type === "date") return { day: v, time: "" };
        if (input.type === "time") return { day: "", time: v.slice(0, 5) };
        const [day = "", time = ""] = v.split("T");
        return { day, time: time.slice(0, 5) };
    }
    const minDay = (input) => (input.min || "").slice(0, 10);
    const maxDay = (input) => (input.max || "").slice(0, 10);
    const dayAllowed = (input, iso) => (!minDay(input) || iso >= minDay(input)) && (!maxDay(input) || iso <= maxDay(input));
    const stepMinutes = (input) => {
        const step = Number(input.getAttribute("step"));
        return step > 0 ? Math.max(1, Math.round(step / 60)) : 5;
    };

    function labelText(input) {
        const { day, time } = parts(input);
        const d = parseDay(day);
        const dayText = d ? d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) : "";
        if (input.type === "date") return dayText;
        if (input.type === "time") return time ? `${time} Uhr` : "";
        return d && time ? `${dayText}, ${time} Uhr` : "";
    }
    const placeholder = (input) => input.dataset.placeholder
        || { date: "Datum wählen", time: "Uhrzeit", "datetime-local": "Datum und Uhrzeit wählen" }[input.type];

    function refresh(input) {
        const btn = input._gsraDpTrigger;
        if (!btn) return;
        const text = labelText(input);
        btn.replaceChildren();
        btn.insertAdjacentHTML("afterbegin", `<i class="fa-regular ${input.type === "time" ? "fa-clock" : "fa-calendar"}" aria-hidden="true"></i>`);
        btn.appendChild(el("span", text ? "gsra-dp-value" : "gsra-dp-value empty", text || placeholder(input)));
        btn.disabled = input.disabled;
        if (text) input._gsraDpWrap.classList.remove("invalid");
        if (popInput === input && pop) render();
    }

    // Neuer Wert: echtes Feld setzen und die üblichen Ereignisse auslösen
    function commit(input, day, time) {
        const v = input.type === "date" ? day : input.type === "time" ? time : (day && time ? `${day}T${time}` : "");
        NATIVE.set.call(input, v);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        refresh(input);
    }

    function enhance(input) {
        if (input._gsraDpTrigger || !TYPES.includes(input.type) || input.dataset.gsraNative !== undefined) return;
        const wrap = el("span", `gsra-dp gsra-dp--${input.type === "datetime-local" ? "datetime" : input.type}`);
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
        input.classList.add("gsra-dp-native");
        input.tabIndex = -1;
        const trigger = el("button", "gsra-dp-trigger");
        trigger.type = "button";
        trigger.setAttribute("aria-haspopup", "dialog");
        const name = input.getAttribute("aria-label") || input.closest("label")?.textContent.trim() || placeholder(input);
        trigger.setAttribute("aria-label", name);
        wrap.appendChild(trigger);
        input._gsraDpTrigger = trigger;
        input._gsraDpWrap = wrap;
        // Auch Werte, die der Code setzt, sofort anzeigen
        Object.defineProperty(input, "value", {
            configurable: true,
            get() { return NATIVE.get.call(this); },
            set(v) { NATIVE.set.call(this, v); refresh(this); }
        });
        trigger.addEventListener("click", () => open(input));
        // Klick auf das zugehörige <label> öffnet die GSRA-Auswahl statt der des Browsers
        input.addEventListener("click", (e) => { e.preventDefault(); open(input); });
        input.addEventListener("invalid", () => wrap.classList.add("invalid"));
        new MutationObserver(() => refresh(input)).observe(input, { attributes: true, attributeFilter: ["disabled", "min", "max"] });
        refresh(input);
    }

    /* ---------- Auswahlfenster ---------- */
    let pop = null;
    let popInput = null;
    let view = null; // erster Tag des angezeigten Monats

    function open(input) {
        if (input.disabled || input.readOnly) return;
        if (pop && popInput === input) return close(true);
        close(false);
        popInput = input;
        const { day } = parts(input);
        const today = new Date();
        const start = parseDay(day) || (minDay(input) && isoDay(today) < minDay(input) ? parseDay(minDay(input)) : today);
        view = new Date(start.getFullYear(), start.getMonth(), 1);
        pop = el("div", "gsra-dp-pop");
        pop.setAttribute("role", "dialog");
        pop.setAttribute("aria-label", input._gsraDpTrigger.getAttribute("aria-label"));
        render();
        document.body.appendChild(pop);
        place();
        document.addEventListener("pointerdown", onOutside, true);
        window.addEventListener("keydown", onKey, true);
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        input._gsraDpWrap.classList.add("open");
        (pop.querySelector(".gsra-dp-day.selected, .gsra-dp-day.today:not([disabled]), .gsra-dp-opt.selected, .gsra-dp-day:not([disabled])") || pop.querySelector("button"))?.focus({ preventScroll: true });
    }

    function close(refocus) {
        if (!pop) return;
        const input = popInput;
        pop.remove();
        pop = null;
        popInput = null;
        document.removeEventListener("pointerdown", onOutside, true);
        window.removeEventListener("keydown", onKey, true);
        window.removeEventListener("resize", place);
        window.removeEventListener("scroll", place, true);
        input?._gsraDpWrap.classList.remove("open");
        if (refocus) input?._gsraDpTrigger.focus({ preventScroll: true });
    }

    function onOutside(e) {
        if (pop && !pop.contains(e.target) && !popInput?._gsraDpWrap.contains(e.target)) close(false);
    }
    function onKey(e) {
        if (!pop) return;
        if (e.key === "Escape") {
            // Nur das Auswahlfenster schließen, nicht einen Dialog dahinter
            e.preventDefault();
            e.stopPropagation();
            close(true);
        } else if (e.key === "Enter" && e.target?.classList?.contains("gsra-dp-day")) {
            e.stopPropagation();
        }
    }

    function place() {
        if (!pop || !popInput) return;
        if (window.innerWidth < 560) {
            pop.classList.add("sheet");
            pop.style.left = pop.style.top = "";
            return;
        }
        pop.classList.remove("sheet");
        const r = popInput._gsraDpTrigger.getBoundingClientRect();
        const w = pop.offsetWidth;
        const h = pop.offsetHeight;
        const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
        let top = r.bottom + 6;
        if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
        pop.style.left = `${left}px`;
        pop.style.top = `${Math.max(8, Math.min(top, window.innerHeight - h - 8))}px`;
    }

    function render() {
        const input = popInput;
        const { day, time } = parts(input);
        const focusedKey = document.activeElement?.dataset?.key;
        pop.replaceChildren();
        pop.dataset.type = input.type;
        const body = el("div", "gsra-dp-body");
        if (input.type !== "time") body.appendChild(renderCalendar(input, day, time));
        if (input.type !== "date") body.appendChild(renderTime(input, day, time));
        pop.appendChild(body);

        const foot = el("div", "gsra-dp-foot");
        const todayIso = isoDay(new Date());
        if (input.type !== "time" && dayAllowed(input, todayIso)) {
            const today = button("gsra-dp-link", "Heute");
            today.addEventListener("click", () => pickDay(input, todayIso));
            foot.appendChild(today);
        }
        if (!input.required && (day || time)) {
            const clear = button("gsra-dp-link", "Leeren");
            clear.addEventListener("click", () => { commit(input, "", ""); close(true); });
            foot.appendChild(clear);
        }
        const done = button("gsra-dp-done", '<i class="fa-solid fa-check"></i> Fertig');
        done.addEventListener("click", () => close(true));
        foot.appendChild(done);
        pop.appendChild(foot);
        // Fokus nach dem Neuzeichnen behalten (Tastatur)
        if (focusedKey) pop.querySelector(`[data-key="${focusedKey}"]`)?.focus({ preventScroll: true });
        requestAnimationFrame(() => {
            pop?.querySelectorAll(".gsra-dp-col").forEach(col => {
                const sel = col.querySelector(".selected");
                if (sel) col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.offsetHeight / 2;
            });
            place();
        });
    }

    function pickDay(input, iso) {
        if (input.type === "date") {
            commit(input, iso, "");
            close(true);
            return;
        }
        const { time } = parts(input);
        commit(input, iso, time || input.dataset.defaultTime || "18:00");
    }

    function renderCalendar(input, day, time) {
        const cal = el("div", "gsra-dp-cal");
        const head = el("div", "gsra-dp-head");
        const prev = button("gsra-dp-nav", '<i class="fa-solid fa-chevron-left"></i>', "Voriger Monat");
        const next = button("gsra-dp-nav", '<i class="fa-solid fa-chevron-right"></i>', "Nächster Monat");
        const lastOfPrev = new Date(view.getFullYear(), view.getMonth(), 0);
        const firstOfNext = new Date(view.getFullYear(), view.getMonth() + 1, 1);
        prev.disabled = Boolean(minDay(input)) && isoDay(lastOfPrev) < minDay(input);
        next.disabled = Boolean(maxDay(input)) && isoDay(firstOfNext) > maxDay(input);
        prev.dataset.key = "prev";
        next.dataset.key = "next";
        prev.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
        next.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });
        head.append(prev, el("strong", "gsra-dp-title", `${MONTHS[view.getMonth()]} ${view.getFullYear()}`), next);
        cal.appendChild(head);

        const grid = el("div", "gsra-dp-grid");
        grid.setAttribute("role", "grid");
        WEEKDAYS.forEach((w, i) => grid.appendChild(el("span", `gsra-dp-wd${i > 4 ? " weekend" : ""}`, w)));
        const offset = (view.getDay() + 6) % 7;
        for (let i = 0; i < offset; i++) grid.appendChild(el("span", "gsra-dp-blank"));
        const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
        const todayIso = isoDay(new Date());
        for (let d = 1; d <= days; d++) {
            const date = new Date(view.getFullYear(), view.getMonth(), d);
            const iso = isoDay(date);
            const b = button("gsra-dp-day", String(d));
            b.dataset.key = iso;
            if (iso === todayIso) b.classList.add("today");
            if (iso === day) { b.classList.add("selected"); b.setAttribute("aria-pressed", "true"); }
            if ((date.getDay() + 6) % 7 > 4) b.classList.add("weekend");
            b.setAttribute("aria-label", date.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
            if (!dayAllowed(input, iso)) b.disabled = true;
            b.addEventListener("click", () => pickDay(input, iso));
            b.addEventListener("keydown", (e) => {
                const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
                if (!move) return;
                e.preventDefault();
                const target = new Date(date.getFullYear(), date.getMonth(), date.getDate() + move);
                if (target.getMonth() !== view.getMonth()) view = new Date(target.getFullYear(), target.getMonth(), 1);
                render();
                pop?.querySelector(`[data-key="${isoDay(target)}"]`)?.focus({ preventScroll: true });
            });
            grid.appendChild(b);
        }
        cal.appendChild(grid);
        return cal;
    }

    function renderTime(input, day, time) {
        const box = el("div", "gsra-dp-time");
        box.appendChild(el("span", "gsra-dp-time-label", "Uhrzeit"));
        const [hh, mm] = time ? time.split(":") : ["", ""];
        const cols = el("div", "gsra-dp-cols");
        const step = stepMinutes(input);
        const setTime = (h, m) => {
            const fallbackDay = day || (dayAllowed(input, isoDay(new Date())) ? isoDay(new Date()) : minDay(input));
            commit(input, fallbackDay, `${h}:${m}`);
        };
        const hours = el("div", "gsra-dp-col");
        hours.setAttribute("aria-label", "Stunde");
        for (let h = 0; h < 24; h++) {
            const v = pad(h);
            const b = button(`gsra-dp-opt${v === hh ? " selected" : ""}`, v);
            b.dataset.key = `h${v}`;
            b.addEventListener("click", () => setTime(v, mm || "00"));
            hours.appendChild(b);
        }
        const minutes = el("div", "gsra-dp-col");
        minutes.setAttribute("aria-label", "Minute");
        const list = [];
        for (let m = 0; m < 60; m += step) list.push(pad(m));
        if (mm && !list.includes(mm)) list.push(mm), list.sort();
        list.forEach(v => {
            const b = button(`gsra-dp-opt${v === mm ? " selected" : ""}`, v);
            b.dataset.key = `m${v}`;
            b.addEventListener("click", () => setTime(hh || (input.dataset.defaultTime || "18:00").slice(0, 2), v));
            minutes.appendChild(b);
        });
        cols.append(hours, el("span", "gsra-dp-colon", ":"), minutes);
        box.appendChild(cols);
        return box;
    }

    /* ---------- Start: vorhandene und später hinzukommende Felder ---------- */
    const scan = (root) => {
        if (root.matches?.("input")) enhance(root);
        root.querySelectorAll?.("input[type=date], input[type=time], input[type=datetime-local]").forEach(enhance);
    };
    const start = () => {
        scan(document);
        new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(n => { if (n.nodeType === 1 && n !== pop && !pop?.contains(n)) scan(n); })))
            .observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();

    window.gsraDatePicker = { enhance, refresh };
})();
