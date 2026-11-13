/* =========================================
   GSRA - Bildausschnitt wählen (Profil- und Forenbilder)
   Verschieben per Maus/Finger, Zoomen per Regler, Mausrad oder zwei Fingern, Tastatur: Pfeile und +/-.
   Der runde Rahmen zeigt genau, was später im Profil und in der Schnellanzeige zu sehen ist.
   Ergebnis: quadratisches Bild (Standard 512 × 512 px) ohne Metadaten – oder null bei „Abbrechen“.
========================================= */
window.gsraCropImage = (file, { size = 512, title = "Bildausschnitt wählen" } = {}) => new Promise(async (resolve) => {
    let bitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (err) {
        resolve(file); // Browser kann das Bild nicht lesen: unverändert weiter wie bisher
        return;
    }

    // Bühne passt sich Breite und Höhe des Fensters an (Handy, niedrige Laptop-Bildschirme)
    const STAGE = Math.round(Math.max(200, Math.min(320, window.innerWidth - 72, window.innerHeight - 360)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const overlay = document.createElement("div");
    overlay.className = "gsra-dialog-overlay";
    overlay.innerHTML = `
        <div class="gsra-dialog gsra-crop" role="dialog" aria-modal="true">
            <button type="button" class="gsra-dialog-close" title="Abbrechen"><i class="fa-solid fa-xmark"></i></button>
            <div class="gsra-dialog-icon"><i class="fa-solid fa-crop-simple"></i></div>
            <h3 class="gsra-dialog-title"></h3>
            <p class="gsra-crop-hint">Ziehe das Bild an die richtige Stelle und zoome mit dem Regler. Der Kreis zeigt, was später zu sehen ist.</p>
            <div class="gsra-crop-stage" tabindex="0" aria-label="Bildausschnitt: mit den Pfeiltasten verschieben, mit Plus und Minus zoomen">
                <canvas></canvas>
                <div class="gsra-crop-mask"></div>
            </div>
            <div class="gsra-crop-zoom">
                <i class="fa-solid fa-magnifying-glass-minus"></i>
                <input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom">
                <i class="fa-solid fa-magnifying-glass-plus"></i>
            </div>
            <div class="gsra-crop-previews">
                <span>Vorschau</span>
                <canvas class="big"></canvas>
                <canvas class="small"></canvas>
            </div>
            <div class="gsra-dialog-actions">
                <button type="button" class="gsra-dialog-btn secondary">Abbrechen</button>
                <button type="button" class="gsra-dialog-btn primary">Übernehmen</button>
            </div>
        </div>`;
    overlay.querySelector(".gsra-dialog-title").textContent = title;
    const stage = overlay.querySelector(".gsra-crop-stage");
    const canvas = stage.querySelector("canvas");
    const zoomInput = overlay.querySelector('input[type="range"]');
    const [bigPreview, smallPreview] = overlay.querySelectorAll(".gsra-crop-previews canvas");
    stage.style.width = stage.style.height = `${STAGE}px`;
    canvas.width = canvas.height = Math.round(STAGE * dpr);
    const ctx = canvas.getContext("2d");
    const previews = [[bigPreview, 72], [smallPreview, 36]].map(([c, px]) => {
        c.width = c.height = Math.round(px * dpr);
        c.style.width = c.style.height = `${px}px`;
        return [c.getContext("2d"), c.width];
    });

    // Zustand: Zoom (1 = Bild füllt den Rahmen genau) und Verschiebung der Bildmitte in Bühnen-Pixeln
    const cover = Math.max(STAGE / bitmap.width, STAGE / bitmap.height);
    let zoom = 1, offsetX = 0, offsetY = 0;
    const scale = () => cover * zoom;
    const clamp = () => {
        const maxX = Math.max(0, (bitmap.width * scale() - STAGE) / 2);
        const maxY = Math.max(0, (bitmap.height * scale() - STAGE) / 2);
        offsetX = Math.min(maxX, Math.max(-maxX, offsetX));
        offsetY = Math.min(maxY, Math.max(-maxY, offsetY));
    };
    // Ausschnitt in Bild-Koordinaten (für Bühne, Vorschau und Ergebnis gleich)
    const sourceRect = () => {
        const k = scale();
        const x0 = STAGE / 2 - (bitmap.width * k) / 2 + offsetX;
        const y0 = STAGE / 2 - (bitmap.height * k) / 2 + offsetY;
        return [-x0 / k, -y0 / k, STAGE / k, STAGE / k];
    };
    const draw = () => {
        clamp();
        const [sx, sy, sw, sh] = sourceRect();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        previews.forEach(([pctx, px]) => {
            pctx.clearRect(0, 0, px, px);
            pctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, px, px);
        });
    };
    const setZoom = (value, anchorX = 0, anchorY = 0) => {
        const next = Math.min(4, Math.max(1, value));
        // Punkt unter dem Mauszeiger bzw. zwischen den Fingern bleibt an seiner Stelle
        offsetX = anchorX - (anchorX - offsetX) * (next / zoom);
        offsetY = anchorY - (anchorY - offsetY) * (next / zoom);
        zoom = next;
        zoomInput.value = String(zoom);
        draw();
    };

    // Verschieben und Zoomen mit Maus, Stift und Fingern
    const pointers = new Map();
    let pinch = null;
    const local = (e) => {
        const r = stage.getBoundingClientRect();
        return [e.clientX - r.left - STAGE / 2, e.clientY - r.top - STAGE / 2];
    };
    stage.addEventListener("pointerdown", (e) => {
        stage.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, [e.clientX, e.clientY]);
        stage.classList.add("dragging");
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom };
        }
    });
    stage.addEventListener("pointermove", (e) => {
        if (!pointers.has(e.pointerId)) return;
        const [px, py] = pointers.get(e.pointerId);
        pointers.set(e.pointerId, [e.clientX, e.clientY]);
        if (pointers.size === 2 && pinch) {
            const [a, b] = [...pointers.values()];
            const r = stage.getBoundingClientRect();
            const mid = [(a[0] + b[0]) / 2 - r.left - STAGE / 2, (a[1] + b[1]) / 2 - r.top - STAGE / 2];
            setZoom(pinch.zoom * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.dist, mid[0], mid[1]);
            return;
        }
        offsetX += e.clientX - px;
        offsetY += e.clientY - py;
        draw();
    });
    const release = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (!pointers.size) stage.classList.remove("dragging");
    };
    stage.addEventListener("pointerup", release);
    stage.addEventListener("pointercancel", release);
    stage.addEventListener("wheel", (e) => {
        e.preventDefault();
        const [ax, ay] = local(e);
        setZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), ax, ay);
    }, { passive: false });
    zoomInput.addEventListener("input", () => setZoom(Number(zoomInput.value)));

    const finish = async (accept) => {
        document.removeEventListener("keydown", onKey, true);
        let result = null;
        if (accept) {
            const out = document.createElement("canvas");
            out.width = out.height = size;
            const [sx, sy, sw, sh] = sourceRect();
            out.getContext("2d").drawImage(bitmap, sx, sy, sw, sh, 0, 0, size, size);
            // PNG und WebP behalten ihre Transparenz, Fotos werden JPEG
            const type = /^image\/(png|webp)$/.test(file.type) ? file.type : "image/jpeg";
            const blob = await new Promise(r => out.toBlob(r, type, 0.9));
            const ext = { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg" }[blob?.type] || "jpg";
            result = blob ? new File([blob], `${(file.name || "bild").replace(/\.[^.]+$/, "")}.${ext}`, { type: blob.type, lastModified: Date.now() }) : file;
        }
        bitmap.close?.();
        overlay.remove();
        resolve(result);
    };
    const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); return; }
        if (e.key === "Enter" && document.activeElement?.closest?.(".gsra-crop") && !document.activeElement.matches("button")) { e.preventDefault(); finish(true); return; }
        if (document.activeElement !== stage) return;
        const step = e.shiftKey ? 30 : 10;
        const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
        if (moves[e.key]) { e.preventDefault(); offsetX += moves[e.key][0]; offsetY += moves[e.key][1]; draw(); }
        else if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom(zoom * 1.1); }
        else if (e.key === "-") { e.preventDefault(); setZoom(zoom / 1.1); }
    };
    overlay.querySelector(".gsra-dialog-close").addEventListener("click", () => finish(false));
    overlay.querySelector(".gsra-dialog-btn.secondary").addEventListener("click", () => finish(false));
    overlay.querySelector(".gsra-dialog-btn.primary").addEventListener("click", () => finish(true));
    document.addEventListener("keydown", onKey, true);

    document.body.appendChild(overlay);
    draw();
    stage.focus();
});
