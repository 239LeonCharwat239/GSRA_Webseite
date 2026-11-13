/* =========================================
   GSRA - Rennkalender: nächstes Rennen mit Countdown, Filter nach Simulation, Events nach Monat,
   Server-Passwort kopieren. Eintragen und Löschen: Admins und Moderatoren (die Datenbank prüft das zusätzlich).
========================================= */
document.addEventListener('DOMContentLoaded', async () => {
    renderSimChips();
    await checkAdminPermissions();
    await loadEvents();

    document.getElementById('create-event-form')?.addEventListener('submit', handleCreateEvent);
    document.getElementById('kalCreateBtn')?.addEventListener('click', openCreateModal);
    document.getElementById('kalModalClose')?.addEventListener('click', closeCreateModal);
    document.getElementById('kalModalCancel')?.addEventListener('click', closeCreateModal);
    document.getElementById('kalModal')?.addEventListener('mousedown', (e) => { if (e.target.id === 'kalModal') closeCreateModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('kalModal')?.hidden) closeCreateModal();
    });
    // Countdown jede Minute auffrischen
    setInterval(() => { if (loadedEvents.length) renderEvents(); }, 60000);
});

let isAdmin = false;
let loadedEvents = [];
let simFilter = 'ALL';
const LIVE_HOURS = 6; // laufende Rennen bleiben bis 6 Stunden nach dem Start sichtbar

const SIMS = [
    ['ALL', 'Alle'],
    ['iRacing', 'iRacing'],
    ['ACC', 'ACC'],
    ['Assetto Corsa', 'Assetto Corsa'],
    ['Le Mans Ultimate', 'Le Mans Ultimate'],
    ['Automobilista 2', 'Automobilista 2']
];

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function checkAdminPermissions() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        // Events verwalten dürfen Admins und Moderatoren (die Datenbank prüft das zusätzlich, inkl. Zwei-Faktor-Code)
        if (profile && ['admin', 'moderator'].includes(profile.role)) {
            isAdmin = true;
            const createBtn = document.getElementById('kalCreateBtn');
            if (createBtn) createBtn.hidden = false;
        }
    } catch (err) {
        console.error('Fehler bei Admin-Prüfung:', err);
    }
}

// Schnellauswahl der Simulationen (wie im Setup Hub)
function renderSimChips() {
    const box = document.getElementById('kalSims');
    if (!box) return;
    box.innerHTML = SIMS.map(([key, label]) =>
        `<button type="button" class="sh-chip${simFilter === key ? ' active' : ''}" data-sim="${escapeHtml(key)}">${escapeHtml(label)}</button>`).join('');
    box.querySelectorAll('[data-sim]').forEach(chip => chip.addEventListener('click', () => {
        simFilter = chip.dataset.sim;
        renderSimChips();
        renderEvents();
    }));
}

async function loadEvents() {
    const list = document.getElementById('events-list');
    if (!list) return;

    // Vergangene Events ausblenden (laufende bleiben bis 6 Stunden nach dem Start sichtbar)
    const visibleFrom = new Date(Date.now() - LIVE_HOURS * 60 * 60 * 1000).toISOString();
    const { data: events, error } = await supabaseClient
        .from('events')
        .select('*')
        .gte('event_date', visibleFrom)
        .order('event_date', { ascending: true });

    if (error) {
        console.error('Fehler beim Laden der Events:', error);
        list.innerHTML = '<div class="kal-empty error"><i class="fa-solid fa-triangle-exclamation"></i> Die Events konnten gerade nicht geladen werden. Bitte lade die Seite neu.</div>';
        return;
    }
    loadedEvents = events || [];
    renderEvents();
}

// „in 3 Tagen“, „in 4 Std. 20 Min.“, „läuft gerade“
function countdown(date) {
    const diff = date.getTime() - Date.now();
    if (diff <= 0) return { live: true, text: 'Läuft gerade' };
    const min = Math.floor(diff / 60000);
    const hours = Math.floor(min / 60);
    const days = Math.floor(hours / 24);
    if (days >= 2) return { live: false, text: `in ${days} Tagen` };
    if (days === 1) return { live: false, text: `in 1 Tag ${hours - 24} Std.` };
    if (hours >= 1) return { live: false, text: `in ${hours} Std. ${min % 60} Min.` };
    return { live: false, text: `in ${Math.max(1, min)} Min.` };
}

function renderEvents() {
    const list = document.getElementById('events-list');
    const countEl = document.getElementById('kalCount');
    if (!list) return;
    const events = loadedEvents.filter(ev => simFilter === 'ALL' || ev.simulation === simFilter);
    if (countEl) countEl.textContent = `${events.length} ${events.length === 1 ? 'Event' : 'Events'}`;
    renderNext(events[0]);

    if (!events.length) {
        list.innerHTML = `<div class="kal-empty"><i class="fa-solid fa-flag-checkered"></i>
            <strong>Keine anstehenden Events</strong>
            <span>${simFilter === 'ALL' ? 'Sobald neue Rennen geplant sind, erscheinen sie hier.' : 'Für diese Simulation ist gerade nichts geplant – schau unter „Alle“.'}</span></div>`;
        return;
    }

    // Nach Monat gruppieren
    const groups = [];
    events.forEach(ev => {
        const date = new Date(ev.event_date);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        let group = groups.find(g => g.key === key);
        if (!group) groups.push(group = { key, label: date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }), events: [] });
        group.events.push(ev);
    });

    list.replaceChildren(...groups.map(group => {
        const section = document.createElement('section');
        section.className = 'kal-month';
        section.innerHTML = `<h2 class="kal-month-title">${escapeHtml(group.label)}</h2>`;
        group.events.forEach(ev => section.appendChild(eventCard(ev)));
        return section;
    }));
}

function eventCard(ev) {
    const date = new Date(ev.event_date);
    const cd = countdown(date);
    const card = document.createElement('article');
    card.className = `kal-event${cd.live ? ' live' : ''}`;
    card.innerHTML = `
        <div class="kal-date">
            <span class="kal-weekday">${escapeHtml(date.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', ''))}</span>
            <span class="kal-day">${date.getDate()}</span>
            <span class="kal-month-short">${escapeHtml(date.toLocaleDateString('de-DE', { month: 'short' }).replace('.', ''))}</span>
        </div>
        <div class="kal-body">
            <div class="kal-meta">
                <span class="kal-sim">${escapeHtml(ev.simulation || 'Simulation')}</span>
                <span class="kal-time"><i class="fa-regular fa-clock"></i> ${escapeHtml(date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))} Uhr</span>
                <span class="kal-countdown${cd.live ? ' live' : ''}">${cd.live ? '<span class="kal-live-dot"></span>' : ''}${escapeHtml(cd.text)}</span>
            </div>
            <h3 class="kal-title">${escapeHtml(ev.title || 'Event')}</h3>
            <div class="kal-track"><i class="fa-solid fa-flag-checkered"></i> ${escapeHtml(ev.track || 'Strecke folgt')}</div>
        </div>
        <div class="kal-side"></div>`;

    const side = card.querySelector('.kal-side');
    if (ev.password) {
        const pw = document.createElement('button');
        pw.type = 'button';
        pw.className = 'kal-password';
        pw.title = 'Server-Passwort kopieren';
        pw.innerHTML = '<i class="fa-solid fa-key"></i> <code></code> <i class="fa-regular fa-copy"></i>';
        pw.querySelector('code').textContent = ev.password;
        pw.addEventListener('click', () => {
            navigator.clipboard.writeText(ev.password).then(
                () => showToast('Server-Passwort kopiert.', 'success'),
                () => showToast('Kopieren nicht möglich – bitte markieren und kopieren.', 'error'));
        });
        side.appendChild(pw);
    } else {
        side.innerHTML = '<span class="kal-open"><i class="fa-solid fa-lock-open"></i> Ohne Passwort</span>';
    }
    if (isAdmin) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'kal-delete';
        del.title = 'Event löschen';
        del.innerHTML = '<i class="fa-solid fa-trash"></i><span> Löschen</span>';
        del.addEventListener('click', () => deleteEvent(ev.id));
        side.appendChild(del);
    }
    return card;
}

// Hervorgehobene Karte für das nächste Rennen
function renderNext(ev) {
    const box = document.getElementById('kalNext');
    if (!box) return;
    if (!ev) {
        box.hidden = true;
        return;
    }
    const date = new Date(ev.event_date);
    const cd = countdown(date);
    box.hidden = false;
    box.className = `kal-next${cd.live ? ' live' : ''}`;
    box.innerHTML = `
        <div class="kal-next-head">
            <div class="kal-next-label">${cd.live ? '<span class="kal-live-dot"></span> Jetzt live' : '<i class="fa-solid fa-flag-checkered"></i> Nächstes Rennen'}</div>
            <div class="kal-next-countdown">${escapeHtml(cd.text)}</div>
        </div>
        <h2 class="kal-next-title">${escapeHtml(ev.title || 'Event')}</h2>
        <div class="kal-next-info">
            <span><i class="fa-regular fa-calendar"></i> ${escapeHtml(date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }))}, ${escapeHtml(date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))} Uhr</span>
            <span><i class="fa-solid fa-gamepad"></i> ${escapeHtml(ev.simulation || '')}</span>
            <span><i class="fa-solid fa-road"></i> ${escapeHtml(ev.track || '')}</span>
        </div>`;
}

function openCreateModal() {
    const modal = document.getElementById('kalModal');
    if (!modal) return;
    // Vorschlag: morgen 20:00 Uhr
    const dateInput = document.getElementById('ev-date');
    if (dateInput && !dateInput.value) {
        const d = new Date(Date.now() + 86400000);
        d.setHours(20, 0, 0, 0);
        dateInput.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    modal.hidden = false;
    document.getElementById('ev-title')?.focus();
}

function closeCreateModal() {
    const modal = document.getElementById('kalModal');
    if (modal) modal.hidden = true;
}

// Verständliche Meldung, wenn die Datenbank ablehnt (z. B. Zwei-Faktor-Code nicht bestätigt)
function eventErrorText(error) {
    const msg = error?.message || '';
    if (/row-level security|permission denied/i.test(msg)) return 'Keine Berechtigung – Events verwalten Admins und Moderatoren mit bestätigtem Zwei-Faktor-Code.';
    return msg || 'Unbekannter Fehler.';
}

async function handleCreateEvent(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const title = document.getElementById('ev-title').value.trim();
        const simulation = document.getElementById('ev-sim').value;
        const track = document.getElementById('ev-track').value.trim();
        const dateValue = document.getElementById('ev-date').value;
        const password = document.getElementById('ev-password').value.trim() || null;
        // Eingabe ist Ortszeit – als genauer Zeitpunkt speichern
        const event_date = dateValue ? new Date(dateValue).toISOString() : null;
        if (!event_date) {
            showToast('Bitte wähle Datum und Uhrzeit.', 'error');
            return;
        }

        const { error } = await supabaseClient
            .from('events')
            .insert([{ title, simulation, track, event_date, password }]);

        if (error) {
            showToast('Fehler beim Erstellen: ' + eventErrorText(error), 'error');
        } else {
            document.getElementById('create-event-form').reset();
            closeCreateModal();
            showToast('Das Event ist veröffentlicht.', 'success');
            await loadEvents();
        }
    } catch (err) {
        console.error('Unerwarteter Fehler:', err);
        showToast('Das Event konnte nicht gespeichert werden.', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function deleteEvent(id) {
    const confirmed = await showDialog({
        icon: 'fa-trash',
        title: 'Event löschen?',
        message: 'Möchtest du dieses Event wirklich löschen?',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
    });
    if (!confirmed) return;

    const { data, error } = await supabaseClient
        .from('events')
        .delete()
        .eq('id', id)
        .select('id');

    if (error || !data?.length) {
        showToast('Fehler beim Löschen: ' + (error ? eventErrorText(error) : 'Keine Berechtigung.'), 'error');
    } else {
        showToast('Das Event wurde gelöscht.', 'success');
        await loadEvents();
    }
}
