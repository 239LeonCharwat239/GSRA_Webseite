/* =========================================
   GSRA - Zentrale Auth- & Navigationssteuerung (Supabase)
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
    // Supabase-Client abrufen (wird in den HTML-Dateien geladen)
    const client = window.supabase;
    
    if (!client) {
        console.error("Supabase Client nicht gefunden!");
        return;
    }

    const loginNavBtn = document.getElementById("loginNavBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const authOnlyLinks = document.querySelectorAll(".auth-only");

    const protectedPages = ["dashboard.html", "messenger.html"];
    const currentPage = window.location.pathname.split("/").pop();

    // Funktion zum Anpassen der Navigation basierend auf dem Login-Status
    const updateUI = (session) => {
        if (session) {
            // EINGELOGGT: Login-Button weg, Logout & geschützte Seiten anzeigen
            if (loginNavBtn) loginNavBtn.style.display = "none";
            if (logoutBtn) logoutBtn.style.display = "inline-block";
            authOnlyLinks.forEach(link => link.style.display = "inline-block");
        } else {
            // AUSGELOGGT: Login anzeigen, Rest verstecken
            if (loginNavBtn) loginNavBtn.style.display = "inline-block";
            if (logoutBtn) logoutBtn.style.display = "none";
            authOnlyLinks.forEach(link => link.style.display = "none");

            // Wenn ausgeloggt auf dem Dashboard/Messenger -> zurück zum Login
            if (protectedPages.includes(currentPage)) {
                window.location.href = "login.html";
            }
        }
    };

    // 1. Initialen Status beim Laden abfragen
    const { data: { session } } = await client.auth.getSession();
    updateUI(session);

    // 2. Auf Änderungen (Login/Logout im Hintergrund) reagieren
    client.auth.onAuthStateChange((event, session) => {
        updateUI(session);
    });

    // 3. Logout-Button Funktionalität
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await client.auth.signOut();
            window.location.href = "login.html";
        });
    }
});