/* =========================================
   GSRA – Fehler-Monitoring (Sicherheitsbericht Nr. 12, SQL 034)
   Meldet JavaScript-Fehler der Webseite und technische Fehlermeldungen (siehe ui-dialogs.js) an das
   Fehlerprotokoll, das nur Admins auf der Moderationsseite sehen. Datensparsam: Seite ohne Parameter,
   Fehlertext, eigene Skriptdatei/Zeile, Browser-Kennung – keine Formularinhalte. Höchstens 5 Meldungen pro
   Seitenaufruf; Fehler fremder Skripte (Browser-Erweiterungen, Bibliotheken) werden nicht gemeldet.
========================================= */
(() => {
    const MAX_PER_PAGE = 5;
    const IGNORE = /ResizeObserver loop|^Script error\.?$|extension:\/\/|Non-Error promise rejection|AbortError|The user aborted/i;
    const seen = new Set();
    let sent = 0;

    // Nur Pfad, keine Parameter (dort könnten Tokens stehen)
    const pathOf = (value) => {
        const text = String(value || "");
        if (!/^https?:\/\//i.test(text)) return text.split(/[?#]/)[0].slice(0, 300) || null;
        try { return new URL(text).pathname; } catch (e) { return null; }
    };
    const ownScript = (file) => !file || file.startsWith(location.origin);

    function report({ message, source = "", line = null, col = null } = {}) {
        const text = String(message || "").replace(/\s+/g, " ").trim().slice(0, 500);
        if (!text || IGNORE.test(text) || sent >= MAX_PER_PAGE) return;
        const key = `${text}|${source}|${line}`;
        if (seen.has(key)) return;
        seen.add(key);
        const client = window.supabaseClient;
        if (!client || typeof client.rpc !== "function") return;
        sent++;
        try {
            client.rpc("log_client_error", {
                _page: location.pathname,
                _message: text,
                _source: pathOf(source),
                _line: Number.isFinite(line) ? line : null,
                _col: Number.isFinite(col) ? col : null,
                _user_agent: String(navigator.userAgent || "").slice(0, 300)
            }).then(() => {}, () => {}); // ohne SQL 034 oder offline: still ignorieren
        } catch (e) { /* Melden darf nie selbst stören */ }
    }
    window.gsraReportError = report;

    window.addEventListener("error", (event) => {
        if (event.filename && !ownScript(event.filename)) return;
        report({ message: event.message || String(event.error || ""), source: event.filename || "", line: event.lineno || null, col: event.colno || null });
    });
    window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        report({ message: reason?.message || String(reason || ""), source: "promise" });
    });
})();
