/* =========================================
   GSRA – Chat-Anhänge aus dem privaten Speicher (SQL 032, Sicherheitsbericht Nr. 9)
   In der Nachricht steht weiterhin die Adresse der Datei (…/object/public/chat_attachments/<Pfad>).
   Seit 032 ist der Speicher privat: Zum Anzeigen holt die Seite kurzlebige Links (2 Stunden). Supabase stellt sie
   nur aus, wenn die Datenbank es erlaubt – also für Mitglieder des Chats und die Moderation.
   Vor SQL 032 gibt es keine Links (keine Berechtigung); dann bleibt die bisherige, noch öffentliche Adresse.
========================================= */
(() => {
    const BUCKET = "chat_attachments";
    const MARK = `/storage/v1/object/public/${BUCKET}/`;
    const LIFETIME = 2 * 3600;             // Sekunden
    const RENEW_BEFORE = 15 * 60 * 1000;   // 15 Minuten vor Ablauf neu holen
    const cache = new Map();               // Pfad → { url, expires }
    const client = () => window.supabaseClient || window.supabase;

    // Pfad im Speicher aus der gespeicherten Adresse (andere Adressen: null)
    function pathOf(address) {
        const text = String(address || "");
        const at = text.indexOf(MARK);
        if (at < 0) return null;
        try { return decodeURIComponent(text.slice(at + MARK.length).split(/[?#]/)[0]) || null; } catch (e) { return null; }
    }
    const fresh = (entry) => Boolean(entry) && entry.expires - Date.now() > RENEW_BEFORE;

    // ---------- Gerätespeicher (wie bei WhatsApp): Fotos und Sprachnachrichten nur einmal pro Gerät laden ----------
    // Anhänge ändern sich nie (jeder hat einen eigenen Namen) – einmal geladen, kommen sie danach aus dem Browser-Speicher.
    // Das spart Ladezeit und vor allem Datenvolumen bei Supabase. Videos laufen weiter als Stream (zu groß).
    // Beim Abmelden wird der Speicher geleert (auth-nav.js → window.gsraChatMediaClear).
    const DEVICE_CACHE = "gsra-chat-medien-v1";
    const INDEX_KEY = "gsra_chat_medien_index";
    const MAX_ENTRIES = 400;
    const MAX_BYTES = 8 * 1024 * 1024;
    const cachable = (path) => /\.(jpe?g|png|webp|gif|heic|heif|webm|ogg|m4a|mp3|wav)$/i.test(path) && !/\.(mp4|mov|3gp)$/i.test(path);
    const hasDeviceCache = () => typeof caches !== "undefined" && window.isSecureContext;
    const cacheKey = (path) => `/__gsra_medien__/${encodeURIComponent(path)}`;
    const readIndex = () => { try { return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]"); } catch (e) { return []; } };
    const writeIndex = (list) => { try { localStorage.setItem(INDEX_KEY, JSON.stringify(list.slice(-MAX_ENTRIES))); } catch (e) { /* egal */ } };

    async function fromDevice(paths) {
        if (!hasDeviceCache()) return;
        try {
            const store = await caches.open(DEVICE_CACHE);
            await Promise.all(paths.filter(cachable).map(async (path) => {
                const hit = await store.match(cacheKey(path));
                if (hit) cache.set(path, { url: URL.createObjectURL(await hit.blob()), expires: Infinity, local: true });
            }));
        } catch (e) { /* ohne Gerätespeicher wie bisher */ }
    }

    // Nach dem Anzeigen im Hintergrund ablegen (der Browser hat die Datei dann meist schon – kein zweiter Download)
    async function keepOnDevice(path, signedUrl) {
        if (!hasDeviceCache() || !cachable(path)) return;
        try {
            const response = await fetch(signedUrl, { cache: "force-cache" });
            if (!response.ok) return;
            const blob = await response.blob();
            if (blob.size > MAX_BYTES) return;
            const store = await caches.open(DEVICE_CACHE);
            await store.put(cacheKey(path), new Response(blob, { headers: { "Content-Type": blob.type || "application/octet-stream" } }));
            const index = readIndex().filter(p => p !== path);
            index.push(path);
            // Älteste Einträge entfernen, damit der Speicher nicht unbegrenzt wächst
            while (index.length > MAX_ENTRIES) await store.delete(cacheKey(index.shift()));
            writeIndex(index);
        } catch (e) { /* nicht wichtig genug für eine Meldung */ }
    }

    async function clearDevice() {
        try { if (typeof caches !== "undefined") await caches.delete(DEVICE_CACHE); } catch (e) { /* egal */ }
        try { localStorage.removeItem(INDEX_KEY); } catch (e) { /* egal */ }
        cache.clear();
    }

    // Links für mehrere Anhänge auf einmal holen (nur fehlende oder bald ablaufende); zuerst im Gerätespeicher nachsehen
    async function sign(addresses) {
        let paths = [...new Set((addresses || []).map(pathOf).filter(Boolean))].filter(p => !fresh(cache.get(p)));
        if (!paths.length) return;
        await fromDevice(paths);
        paths = paths.filter(p => !fresh(cache.get(p)));
        if (!paths.length) return;
        const storage = client()?.storage?.from(BUCKET);
        if (!storage?.createSignedUrls) return;
        for (let i = 0; i < paths.length; i += 100) {
            try {
                const { data } = await storage.createSignedUrls(paths.slice(i, i + 100), LIFETIME);
                (data || []).forEach(item => {
                    const url = item?.signedUrl || item?.signedURL;
                    if (url && item.path && !item.error) {
                        cache.set(item.path, { url, expires: Date.now() + LIFETIME * 1000 });
                        setTimeout(() => keepOnDevice(item.path, url), 1500);
                    }
                });
            } catch (e) { /* ohne Link bleibt die gespeicherte Adresse */ }
        }
    }

    // Anzuzeigende Adresse: kurzlebiger Link, falls vorhanden – sonst die gespeicherte Adresse
    function url(address) {
        const path = pathOf(address);
        const entry = path && cache.get(path);
        return entry ? entry.url : address;
    }
    async function signOne(address) {
        const path = pathOf(address);
        if (path) cache.delete(path); // z. B. abgelaufen: sicher neu holen
        await sign([address]);
        return url(address);
    }
    // Speicherort neuer Anhänge: <Chat-ID>/<eigene Nutzer-ID>/<Datei>
    const uploadPath = (chatId, userId, fileName) => `${chatId}/${userId}/${fileName}`;

    window.gsraChatMedia = { sign, url, signOne, uploadPath, pathOf };
    window.gsraChatMediaClear = clearDevice;
})();
