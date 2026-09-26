/* =========================================
   GSRA - Zentrale Auth- & Navigationssteuerung (Supabase)
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
    const client = window.supabaseClient || window.supabase;
    
    if (!client) {
        console.error("Supabase Client nicht gefunden!");
        return;
    }

    const loginNavBtn = document.getElementById("loginNavBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const authOnlyLinks = document.querySelectorAll(".auth-only");

    const protectedPages = ["dashboard.html", "messenger.html"];
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // Funktion zum exklusiven Umschalten der UI-Elemente
    const updateUI = (session) => {
        if (session) {
            // EINGELOGGT: Login verstecken, Logout & geschützte Seiten anzeigen
            if (loginNavBtn) loginNavBtn.style.setProperty("display", "none", "important");
            if (logoutBtn) logoutBtn.style.setProperty("display", "inline-block", "important");
            authOnlyLinks.forEach(link => link.style.setProperty("display", "inline-block", "important"));
        } else {
            // AUSGELOGGT: Logout & geschützte Seiten verstecken, Login anzeigen
            if (loginNavBtn) loginNavBtn.style.setProperty("display", "inline-block", "important");
            if (logoutBtn) logoutBtn.style.setProperty("display", "none", "important");
            authOnlyLinks.forEach(link => link.style.setProperty("display", "none", "important"));

            // Nicht eingeloggt auf geschützter Seite -> Weiterleitung
            if (protectedPages.includes(currentPage)) {
                window.location.href = "login.html";
            }
        }
    };

    // 1. Initialen Status beim Aufruf abfragen
    const { data: { session } } = await client.auth.getSession();
    updateUI(session);

    // 2. Auf Änderungen der Session im Hintergrund reagieren
    client.auth.onAuthStateChange((_event, session) => {
        updateUI(session);
    });

    // 3. Logout-Event verarbeiten
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await client.auth.signOut();
            window.location.href = "login.html";
        });
    }
});