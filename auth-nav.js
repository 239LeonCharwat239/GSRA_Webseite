// auth-nav.js
window.addEventListener('load', async () => {
    if (typeof supabase !== 'undefined' && supabase.auth) {
        const { data: { session } } = await supabase.auth.getSession();
        
        const nav = document.querySelector('header nav');
        if (!nav) return;

        // Login / Logout Tausch
        let authBtn = nav.querySelector('.login-btn, #logoutBtn, a[href="login.html"]');

        if (session) {
            // Wenn eingeloggt: Dashboard anzeigen (falls noch nicht drin)
            if (!nav.querySelector('a[href="dashboard.html"]')) {
                const dashLink = document.createElement('a');
                dashLink.href = 'dashboard.html';
                dashLink.textContent = 'Dashboard';
                
                // Vor dem Login/Logout Button einfügen
                if (authBtn) {
                    nav.insertBefore(dashLink, authBtn);
                } else {
                    nav.appendChild(dashLink);
                }
            }

            // Login-Button durch Logout ersetzen
            if (authBtn && authBtn.id !== 'logoutBtn') {
                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'logoutBtn';
                logoutBtn.className = 'login-btn';
                logoutBtn.textContent = 'Logout';
                logoutBtn.addEventListener('click', async () => {
                    await supabase.auth.signOut();
                    window.location.href = 'index.html';
                });
                authBtn.replaceWith(logoutBtn);
            }
        }
    }
});