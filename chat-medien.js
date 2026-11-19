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

    // Links für mehrere Anhänge auf einmal holen (nur fehlende oder bald ablaufende)
    async function sign(addresses) {
        const paths = [...new Set((addresses || []).map(pathOf).filter(Boolean))].filter(p => !fresh(cache.get(p)));
        if (!paths.length) return;
        const storage = client()?.storage?.from(BUCKET);
        if (!storage?.createSignedUrls) return;
        for (let i = 0; i < paths.length; i += 100) {
            try {
                const { data } = await storage.createSignedUrls(paths.slice(i, i + 100), LIFETIME);
                (data || []).forEach(item => {
                    const url = item?.signedUrl || item?.signedURL;
                    if (url && item.path && !item.error) cache.set(item.path, { url, expires: Date.now() + LIFETIME * 1000 });
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
})();
