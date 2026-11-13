// Anmelden und Registrieren (login.html) – eigene Datei, damit die Sicherheitsregeln (CSP) eingebettete Skripte verbieten können
document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabaseClient || window.supabase;
    let isSignUpMode = false;

    if (!client) {
        console.error("Supabase Client nicht bereit.");
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const usernameGroup = document.getElementById('usernameGroup');
    const usernameInput = document.getElementById('username');
    const submitBtn = document.getElementById('submitBtn');
    const toggleModeBtn = document.getElementById('toggleModeBtn');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const passwordInput = document.getElementById('password');
    const passwordRepeatGroup = document.getElementById('passwordRepeatGroup');
    const passwordRepeatInput = document.getElementById('passwordRepeat');
    const passwordStrength = document.getElementById('passwordStrength');
    const termsGroup = document.getElementById('termsGroup');
    const acceptTerms = document.getElementById('acceptTerms');

    // Links in den E-Mails führen zurück auf diese Webseite
    const pageUrl = (page) => new URL(page, window.location.href).href;

    // Nach der Anmeldung zurück zur ursprünglich aufgerufenen Unterseite (nur eigene Seiten, sonst Dashboard)
    const params = new URLSearchParams(window.location.search);
    const requestedPage = params.get('weiter') || '';
    const nextPage = /^[\w-]+\.html(\?[^#]*)?$/.test(requestedPage) && !/^(login|passwort-neu)\.html/.test(requestedPage)
        ? requestedPage
        : 'dashboard.html';

    // Passwort-Stärke beim Registrieren (nur als Hinweis, die Mindestlänge prüft Supabase)
    const updatePasswordStrength = () => {
        const pw = passwordInput.value;
        const bar = passwordStrength.querySelector('.pw-strength-bar span');
        const text = passwordStrength.querySelector('.pw-strength-text');
        let score = 0;
        if (pw.length >= 8) score++;
        if (pw.length >= 12) score++;
        if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
        if (/\d/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        const level = !pw ? ['', '0%', 'transparent']
            : pw.length < 8 ? ['Zu kurz – mindestens 8 Zeichen empfohlen', '15%', '#ff4d4d']
            : score <= 2 ? ['Schwach', '35%', '#ff4d4d']
            : score === 3 ? ['Mittel', '65%', '#ffcc00']
            : ['Stark', '100%', '#00ff88'];
        text.textContent = level[0] ? `Passwort-Stärke: ${level[0]}` : '';
        text.style.color = level[2];
        bar.style.width = level[1];
        bar.style.backgroundColor = level[2];
    };
    passwordInput.addEventListener('input', () => { if (isSignUpMode) updatePasswordStrength(); });

    // Häufige Fehlermeldungen von Supabase auf Deutsch
    const authErrorText = (error) => {
        const msg = error?.message || '';
        const minLength = /password should be at least (\d+)/i.exec(msg);
        if (minLength) return `Das Passwort muss mindestens ${minLength[1]} Zeichen lang sein.`;
        if (/password should contain/i.test(msg)) return 'Das Passwort braucht Groß- und Kleinbuchstaben, Ziffern und Sonderzeichen.';
        if (/invalid login credentials/i.test(msg)) return 'E-Mail-Adresse oder Passwort ist falsch.';
        if (/email not confirmed/i.test(msg)) return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
        if (/already (been )?registered/i.test(msg)) return 'Für diese E-Mail-Adresse gibt es bereits ein Konto.';
        if (/rate limit|only request this after|too many/i.test(msg)) return 'Zu viele Versuche in kurzer Zeit. Bitte warte einen Moment und versuche es dann erneut.';
        if (/invalid.*email|unable to validate email/i.test(msg)) return 'Bitte gib eine gültige E-Mail-Adresse ein.';
        if (/database error saving new user/i.test(msg)) return 'Das Konto konnte nicht angelegt werden. Ist der Benutzername vielleicht schon vergeben?';
        return msg;
    };

    // Umschalten zwischen Anmelden und Registrieren
    toggleModeBtn.addEventListener('click', () => {
        isSignUpMode = !isSignUpMode;
        if (isSignUpMode) {
            usernameGroup.style.display = 'block';
            usernameInput.setAttribute('required', 'true');
            submitBtn.textContent = 'Konto erstellen';
            toggleModeBtn.textContent = 'Bereits registriert? Zum Login';
            forgotPasswordBtn.style.display = 'none';
        } else {
            usernameGroup.style.display = 'none';
            usernameInput.removeAttribute('required');
            submitBtn.textContent = 'Anmelden';
            toggleModeBtn.textContent = 'Kein Konto? Jetzt registrieren';
            forgotPasswordBtn.style.display = '';
        }
        // Nur beim Registrieren: Passwort wiederholen, Stärke-Anzeige und Pflicht-Haken
        passwordRepeatGroup.style.display = isSignUpMode ? 'block' : 'none';
        passwordStrength.style.display = isSignUpMode ? 'block' : 'none';
        termsGroup.style.display = isSignUpMode ? 'flex' : 'none';
        passwordRepeatInput.required = isSignUpMode;
        passwordInput.autocomplete = isSignUpMode ? 'new-password' : 'current-password';
        if (isSignUpMode) updatePasswordStrength();
    });

    // Passwort vergessen: Link zum Zurücksetzen per E-Mail
    forgotPasswordBtn.addEventListener('click', async () => {
        const email = await showDialog({
            icon: 'fa-key',
            title: 'Passwort vergessen?',
            message: 'Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues Passwort festlegen kannst.',
            input: { placeholder: 'name@beispiel.de', value: document.getElementById('email').value.trim(), maxLength: 120 },
            confirmText: 'Link senden',
            cancelText: 'Abbrechen'
        });
        if (!email) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast('Bitte gib eine gültige E-Mail-Adresse ein.', 'error');
            return;
        }

        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: pageUrl('passwort-neu.html') });
        if (error) {
            showToast(authErrorText(error), 'error');
            return;
        }
        showDialog({
            icon: 'fa-envelope',
            title: 'E-Mail ist unterwegs',
            message: `Falls es ein GSRA-Konto mit ${email} gibt, bekommst du gleich einen Link zum Zurücksetzen deines Passworts. Schau auch im Spam-Ordner nach.`,
            confirmText: 'OK'
        });
    });

    // Anmeldung ohne bestätigte E-Mail: Bestätigungs-Mail erneut senden
    const offerResend = async (email) => {
        const resend = await showDialog({
            icon: 'fa-envelope',
            title: 'E-Mail noch nicht bestätigt',
            message: 'Bitte klicke auf den Link in der Bestätigungs-Mail. Keine Mail bekommen? Schau im Spam-Ordner nach oder lass sie dir erneut schicken.',
            confirmText: 'Erneut senden',
            cancelText: 'Schließen'
        });
        if (!resend) return;
        const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: pageUrl(nextPage) } });
        if (error) showToast(authErrorText(error), 'error');
        else showToast('Die Bestätigungs-Mail wurde erneut gesendet.', 'success');
    };

    // Gesperrtes Konto: Hinweis mit Dauer (dauerhaft oder bis zu einem Datum)
    const showBanNotice = (until) => {
        const date = until && until !== 'dauerhaft' ? new Date(until) : null;
        showDialog({
            icon: 'fa-ban',
            title: 'Dein Konto ist gesperrt',
            message: date && !isNaN(date)
                ? `Dein Konto ist bis zum ${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} gesperrt. Danach kannst du dich wieder anmelden.`
                : (until === 'dauerhaft'
                    ? 'Dein Konto wurde dauerhaft gesperrt. Bei Fragen wende dich an das GSRA-Team.'
                    : 'Dein Konto ist derzeit gesperrt. Bei Fragen wende dich an das GSRA-Team.'),
            confirmText: 'OK',
            danger: true
        });
    };
    if (params.has('registrieren')) toggleModeBtn.click();
    if (params.has('gesperrt')) showBanNotice(params.get('gesperrt'));

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        const username = usernameInput.value.trim();

        if (isSignUpMode) {
            // Gleiche Namensregeln wie beim Ändern im Dashboard
            if (username.length < 3 || username.length > 40) {
                showToast('Der Benutzername muss 3 bis 40 Zeichen lang sein.', 'error');
                return;
            }
            if (/\b(admin|administrator|moderator|gsra|support|system)\b/i.test(username)) {
                showToast('Dieser Benutzername ist für das GSRA-Team reserviert.', 'error');
                return;
            }
            if (password !== passwordRepeatInput.value.trim()) {
                showToast('Die beiden Passwörter stimmen nicht überein.', 'error');
                passwordRepeatInput.focus();
                return;
            }
            if (!acceptTerms.checked) {
                showToast('Bitte akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung.', 'error');
                return;
            }
            // Jeder Benutzername nur einmal (fehlt die Datenbank-Funktion noch, geht es ohne Vorab-Prüfung weiter)
            const { data: nameFree, error: nameError } = await client.rpc('username_available', { _name: username });
            if (!nameError && nameFree === false) {
                showToast('Dieser Benutzername ist bereits vergeben.', 'error');
                usernameInput.focus();
                return;
            }

            // Registrierung mit Benutzernamen und Zeitpunkt der Zustimmung in user_metadata;
            // der Bestätigungs-Link führt direkt zur gewünschten Seite (sonst ins Dashboard)
            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username,
                        terms_accepted_at: new Date().toISOString()
                    },
                    emailRedirectTo: pageUrl(nextPage)
                }
            });

            if (error) {
                showToast('Registrierung fehlgeschlagen: ' + authErrorText(error), 'error');
            } else if (data.session) {
                showToast('Konto erfolgreich erstellt!', 'success');
                setTimeout(() => { window.location.href = nextPage; }, 1200);
            } else {
                showDialog({
                    icon: 'fa-envelope',
                    title: 'Fast geschafft!',
                    message: `Wir haben dir eine E-Mail an ${email} geschickt. Klicke auf den Link darin, um dein Konto zu bestätigen – danach bist du direkt angemeldet. Schau auch im Spam-Ordner nach.`,
                    confirmText: 'OK'
                });
            }
        } else {
            // Login
            const { data, error } = await client.auth.signInWithPassword({ email, password });

            if (error) {
                if (/banned/i.test(error.message)) showBanNotice(null);
                else if (/email not confirmed/i.test(error.message)) offerResend(email);
                else showToast('Login fehlgeschlagen: ' + authErrorText(error), 'error');
            } else {
                // Gesperrte Konten werden sofort wieder abgemeldet
                const { data: bans } = await client.from('user_bans').select('banned_until').eq('user_id', data.user.id).is('lifted_at', null);
                const activeBan = (bans || []).find(b => !b.banned_until || new Date(b.banned_until) > new Date());
                if (activeBan) {
                    await client.auth.signOut();
                    showBanNotice(activeBan.banned_until || 'dauerhaft');
                    return;
                }
                // Mit eingerichteter Zwei-Faktor-Anmeldung: Code aus der App bestätigen
                if (window.gsraMfa) await window.gsraMfa.promptAfterLogin(client);
                window.location.href = nextPage;
            }
        }
    });
});
