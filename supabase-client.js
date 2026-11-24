/* =========================================
   GSRA - Supabase Client Initialisierung
========================================= */

const SUPABASE_URL = 'https://mqqyvpmddaastacldbyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xcXl2cG1kZGFhc3RhY2xkYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzAzNzUsImV4cCI6MjEwMzAwNjM3NX0.OWY2FUS7n9Jw-6FP0Hp1B9aY6AUAkEpZ6Xd7MpS0GLI';

if (window.supabase && typeof window.supabase.createClient === 'function') {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = client;
    window.supabase = client;
} else if (!window.supabaseClient && !window.supabase) {
    console.error("Supabase SDK nicht geladen! Bitte stelle sicher, dass das CDN-Skript eingebunden ist.");
}

// Weniger Datenvolumen (24.11.): kleine Fassungen von Bildern (erzeugt beim Hochladen, src/bilder.ts).
// Nur Dateien mit Kennzeichen haben eine kleine Fassung – alles andere lädt wie bisher das Original.
//  * Profilbild „…/avatars/<id>/<zeit>_k.png“ → „…_k.klein.jpg“ (128 px statt 512 px)
//  * Marktplatz-Bild „…/marketplace/<id>/<name>_v.jpg“ → „…_v.vorschau.jpg“ (640 px)
window.gsraAvatarKlein = (url) => {
    const s = String(url || "");
    return /\/avatars\/[0-9a-f-]{36}\/[\w-]+_k\.(png|jpe?g|webp)$/i.test(s) ? s.replace(/_k\.(png|jpe?g|webp)$/i, "_k.klein.jpg") : s;
};
window.gsraVorschau = (url) => {
    const s = String(url || "");
    return /\/marketplace\/[0-9a-f-]{36}\/[\w-]+_v\.(png|jpe?g|webp)$/i.test(s) ? s.replace(/_v\.(png|jpe?g|webp)$/i, "_v.vorschau.jpg") : s;
};

// Echtzeit im Hintergrund pausieren (24.11.): Ist der Tab länger als 3 Minuten nicht sichtbar, trennen die Seiten
// ihre Live-Verbindungen; beim Zurückkommen verbinden sie sich neu und laden den aktuellen Stand. Spart
// gleichzeitige Verbindungen und Datenvolumen – niemand liest einen Chat in einem versteckten Tab.
(() => {
    const PAUSE_NACH_MS = 3 * 60 * 1000;
    const eintraege = [];
    let timer = null;
    let pausiert = false;
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (!document.hidden || pausiert) return;
                pausiert = true;
                eintraege.forEach(e => { try { e.pause(); } catch (err) { console.warn("Echtzeit-Pause:", err); } });
            }, PAUSE_NACH_MS);
        } else {
            clearTimeout(timer);
            if (!pausiert) return;
            pausiert = false;
            eintraege.forEach(e => { try { e.weiter(); } catch (err) { console.warn("Echtzeit fortsetzen:", err); } });
        }
    });
    window.gsraHintergrund = (pause, weiter) => { eintraege.push({ pause, weiter }); };
})();
