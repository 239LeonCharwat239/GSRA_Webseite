/* =========================================
   GSRA – Dateiauswahl im GSRA-Design
   Ersetzt das weiße Browser-Feld bei sichtbaren <input type="file"> durch ein Ablagefeld:
   anklicken oder Dateien hineinziehen, gewählte Dateien mit Vorschau (Bilder) und Größe.
   Das echte Feld bleibt erhalten (files, accept, multiple, required, „change“ wie bisher).
   Versteckte Dateifelder (z. B. Profilbild, Messenger) bleiben unberührt.
========================================= */
(function () {
    const NATIVE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    const el = (tag, cls, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    const sizeText = (bytes) => (bytes < 1024 * 1024
        ? `${Math.max(1, Math.round(bytes / 1024))} KB`
        : `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB`);

    // Passt die Datei zu accept? (Endungen wie .sto, Typen wie image/png, Gruppen wie image/*)
    const accepts = (input, file) => {
        const list = (input.accept || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
        if (!list.length) return true;
        const name = file.name.toLowerCase();
        const type = (file.type || "").toLowerCase();
        return list.some(a => (a.startsWith(".") ? name.endsWith(a) : a.endsWith("/*") ? type.startsWith(a.slice(0, -1)) : type === a));
    };
    // Lesbare Liste der erlaubten Typen, z. B. „JPG, PNG, WebP“
    const acceptText = (input) => {
        const names = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WebP", "image/gif": "GIF", "image/*": "Bilder", "video/*": "Videos", "audio/*": "Audio" };
        const list = (input.accept || "").split(",").map(s => s.trim()).filter(Boolean).map(a => names[a.toLowerCase()] || a);
        return list.length ? [...new Set(list)].join(", ") : "";
    };

    function render(input) {
        const st = input._gsraFile;
        if (!st) return;
        st.list.querySelectorAll("img").forEach(img => URL.revokeObjectURL(img.src));
        st.list.replaceChildren();
        const files = [...(input.files || [])];
        st.zone.classList.toggle("has-files", files.length > 0);
        st.zone.classList.toggle("disabled", input.disabled);
        if (files.length) st.zone.classList.remove("invalid");
        const many = input.multiple;
        st.title.textContent = files.length
            ? (many ? `${files.length} ${files.length === 1 ? "Datei" : "Dateien"} ausgewählt – ändern` : "Andere Datei wählen")
            : (many ? "Dateien auswählen" : "Datei auswählen");
        const types = acceptText(input);
        st.hint.textContent = `oder hierher ziehen${types ? ` · ${types}` : ""}`;
        files.forEach(file => {
            const item = el("li", "gsra-file-item");
            if (/^image\//.test(file.type)) {
                const img = document.createElement("img");
                img.alt = "";
                img.src = URL.createObjectURL(file);
                item.appendChild(img);
            } else {
                item.insertAdjacentHTML("beforeend", '<i class="fa-solid fa-file-lines" aria-hidden="true"></i>');
            }
            const text = el("span", "gsra-file-name", file.name);
            item.append(text, el("small", "gsra-file-size", sizeText(file.size)));
            st.list.appendChild(item);
        });
    }

    function enhance(input) {
        if (input._gsraFile || input.type !== "file" || input.hidden || input.dataset.gsraNative !== undefined) return;
        if (getComputedStyle(input).display === "none") return; // unsichtbare Auswahl (per Knopf geöffnet)
        const zone = el("label", "gsra-file");
        input.parentNode.insertBefore(zone, input);
        zone.appendChild(input);
        input.classList.add("gsra-file-native");
        input.style.cssText = "";
        const body = el("span", "gsra-file-body");
        body.insertAdjacentHTML("beforeend", '<i class="fa-solid fa-cloud-arrow-up gsra-file-icon" aria-hidden="true"></i>');
        const text = el("span", "gsra-file-text");
        const title = el("strong", "gsra-file-title");
        const hint = el("small", "gsra-file-hint");
        text.append(title, hint);
        body.appendChild(text);
        const list = el("ul", "gsra-file-list");
        zone.append(body, list);
        input._gsraFile = { zone, title, hint, list };

        // Setzt der Code das Feld zurück (value = ""), die Anzeige gleich mit leeren
        Object.defineProperty(input, "value", {
            configurable: true,
            get() { return NATIVE.get.call(this); },
            set(v) { NATIVE.set.call(this, v); render(this); }
        });
        input.addEventListener("change", () => render(input));
        input.addEventListener("invalid", () => zone.classList.add("invalid"));

        // Dateien hineinziehen
        ["dragenter", "dragover"].forEach(type => zone.addEventListener(type, (e) => {
            e.preventDefault();
            if (!input.disabled) zone.classList.add("drag");
        }));
        ["dragleave", "dragend"].forEach(type => zone.addEventListener(type, () => zone.classList.remove("drag")));
        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.classList.remove("drag");
            if (input.disabled) return;
            const dropped = [...(e.dataTransfer?.files || [])];
            const ok = dropped.filter(f => accepts(input, f));
            if (!ok.length) {
                zone.classList.add("invalid");
                if (typeof window.showToast === "function" && dropped.length) {
                    window.showToast(`Dieser Dateityp passt hier nicht${acceptText(input) ? ` (erlaubt: ${acceptText(input)})` : ""}.`, "error");
                }
                return;
            }
            const transfer = new DataTransfer();
            (input.multiple ? ok : ok.slice(0, 1)).forEach(f => transfer.items.add(f));
            input.files = transfer.files;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        new MutationObserver(() => render(input)).observe(input, { attributes: true, attributeFilter: ["accept", "multiple", "disabled"] });
        render(input);
    }

    const scan = (root) => {
        if (root.matches?.("input[type=file]")) enhance(root);
        root.querySelectorAll?.("input[type=file]").forEach(enhance);
    };
    const start = () => {
        scan(document);
        new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(n => { if (n.nodeType === 1) scan(n); })))
            .observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();

    window.gsraFilePicker = { enhance, refresh: render };
})();
