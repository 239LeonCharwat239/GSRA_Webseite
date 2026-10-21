/* =========================================
   GSRA - Zentrale Auth- & Navigationssteuerung (Option B: Transparente Navigation)
========================================= */

const initAuthNav = async () => {
    const client = window.supabaseClient || window.supabase;
    
    if (!client) {
        console.error("Supabase Client nicht gefunden!");
        return;
    }

    const loginNavBtn = document.getElementById("loginNavBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const guestNotice = document.getElementById("guestNotice");
    const userContent = document.getElementById("userContent");

    const updateUI = (session) => {
        // 1. Navigation: Login/Logout-Button je nach Status umschalten
        if (session) {
            if (loginNavBtn) loginNavBtn.style.setProperty("display", "none", "important");
            if (logoutBtn) logoutBtn.style.setProperty("display", "inline-block", "important");
        } else {
            if (loginNavBtn) loginNavBtn.style.setProperty("display", "inline-block", "important");
            if (logoutBtn) logoutBtn.style.setProperty("display", "none", "important");
        }

        // 2. Seiteninhalt: Gast-Hinweis vs. Mitglieder-Inhalt automatisch umschalten
        if (guestNotice && userContent) {
            if (session) {
                guestNotice.style.display = "none";
                userContent.style.display = "block";
            } else {
                guestNotice.style.display = "block";
                userContent.style.display = "none";
            }
        }
    };

    // 3. Globaler Unread-Glow für den Messenger auf allen Unterseiten prüfen
    const checkGlobalUnreadNav = () => {
        const hasUnread = localStorage.getItem('gsra_has_unread') === 'true';
        const messengerNavBtn = document.getElementById("messengerNavBtn") || document.querySelector('a[href="messenger.html"]');
        if (messengerNavBtn) {
            if (hasUnread) {
                messengerNavBtn.classList.add("nav-unread-glow");
            } else {
                messengerNavBtn.classList.remove("nav-unread-glow");
            }
        }
    };
    checkGlobalUnreadNav();

    const { data: { session } } = await client.auth.getSession();
    updateUI(session);

    client.auth.onAuthStateChange((_event, session) => {
        updateUI(session);
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await client.auth.signOut();
            window.location.href = "login.html";
        });
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthNav);
} else {
    initAuthNav();
}