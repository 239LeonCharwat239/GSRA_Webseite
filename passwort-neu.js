// Neues Passwort festlegen (passwort-neu.html) – eigene Datei, damit die Sicherheitsregeln (CSP) eingebettete Skripte verbieten können
document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabaseClient || window.supabase;

    if (!client) {
        console.error("Supabase Client nicht bereit.");
        return;
    }

    const checking = document.getElementById('resetChecking');
    const invalid = document.getElementById('resetInvalid');
    const resetForm = document.getElementById('resetForm');
    const submitBtn = document.getElementById('resetSubmitBtn');

    // Abgelaufene oder ungültige Links meldet Supabase im Adress-Anker (#error_code=...),
    // gültige Links melden den Nutzer automatisch an
    const linkError = new URLSearchParams(window.location.hash.slice(1)).get('error_code');
    const { data: { session } } = await client.auth.getSession();

    checking.style.display = 'none';
    if (linkError || !session) {
        invalid.style.display = 'block';
        return;
    }
    resetForm.style.display = 'flex';

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('newPassword').value.trim();

        if (password !== document.getElementById('newPasswordRepeat').value.trim()) {
            showToast('Die beiden Passwörter stimmen nicht überein.', 'error');
            return;
        }

        submitBtn.disabled = true;
        const { error } = await client.auth.updateUser({ password });
        submitBtn.disabled = false;

        if (error) {
            const msg = error.message || '';
            const minLength = /password should be at least (\d+)/i.exec(msg);
            if (minLength) showToast(`Das Passwort muss mindestens ${minLength[1]} Zeichen lang sein.`, 'error');
            else if (/different from the old/i.test(msg)) showToast('Das neue Passwort muss sich vom bisherigen unterscheiden.', 'error');
            else if (/password should contain/i.test(msg)) showToast('Das Passwort braucht Groß- und Kleinbuchstaben, Ziffern und Sonderzeichen.', 'error');
            else showToast('Das Passwort konnte nicht geändert werden: ' + msg, 'error');
            return;
        }

        showToast('Dein Passwort wurde geändert.', 'success');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
    });
});
