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
