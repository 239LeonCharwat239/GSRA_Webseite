// auth-nav.js
window.addEventListener('load', async () => {
    // Falls Supabase geladen ist, Session prüfen
    if (typeof supabase !== 'undefined' && supabase.auth) {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Alle Links/Buttons in der Navigation suchen, die für den Login/Logout zuständig sind
        const nav = document.querySelector('header nav');
        if (!nav) return;

        let authBtn = nav.querySelector('.login-btn, #logoutBtn, a[href="login.html"]');

        if (session) {
            // Nutzer ist EINGELOGGT:
            // 1. Dashboard-Link hinzufügen, falls nicht vorhanden
            if (!nav.querySelector('a[href="dashboard.html"]')) {
                const dashLink = document.createElement('a');
                dashLink.href = 'dashboard.html';
                dashLink.textContent = 'Dashboard';
                nav.insertBefore(dashLink, nav.lastElementChild);
            }

            // 2. Button zu "Logout" umwandeln
            if (authBtn) {
                authBtn.outerHTML = `<button id="logoutBtn" class="login-btn" style="background-color: var(--gsra-yellow); color: #000; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">Logout</button>`;
            }

            // Logout Event Listener binden
            const newLogoutBtn = document.getElementById('logoutBtn');
            if (newLogoutBtn) {
                newLogoutBtn.addEventListener('click', async () => {
                    await supabase.auth.signOut();
                    window.location.href = 'index.html';
                });
            }
        } else {
            // Nutzer ist AUSGELOGGT:
            if (authBtn && authBtn.id === 'logoutBtn') {
                authBtn.outerHTML = `<a href="login.html" class="login-btn">Login</a>`;
            }
        }
    }
});