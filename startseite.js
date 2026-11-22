/* =========================================
   GSRA - Startseite: die nächsten Rennen aus dem Rennkalender.
   Events sehen nur Angemeldete (wegen der Server-Passwörter, siehe SQL 006). Die Startseite fragt deshalb
   nur Titel, Simulation, Strecke und Zeit ab – nie das Passwort – und zeigt Gästen einen Hinweis zum Anmelden.
========================================= */
(() => {
    const box = document.getElementById('homeEvents');
    const list = box?.querySelector('.home-events-list');
    if (!box || !list) return;

    const LIVE_HOURS = 6; // wie im Rennkalender: laufende Rennen bleiben bis 6 Stunden nach dem Start sichtbar
    const SHOWN = 3;
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

    // „läuft gerade“, „in 40 Min.“, „in 4 Std.“, „morgen“, „übermorgen“, „in 5 Tagen“ – nach Kalendertagen
    function countdown(date) {
        const now = new Date();
        const diff = date.getTime() - now.getTime();
        if (diff <= 0) return { live: true, text: 'Läuft gerade' };
        const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const days = Math.round((dayStart(date) - dayStart(now)) / 86400000);
        if (days >= 3) return { live: false, text: `in ${days} Tagen` };
        if (days === 2) return { live: false, text: 'übermorgen' };
        if (days === 1) return { live: false, text: 'morgen' };
        const min = Math.floor(diff / 60000);
        if (min >= 60) return { live: false, text: `heute, in ${Math.floor(min / 60)} Std.` };
        return { live: false, text: `in ${Math.max(1, min)} Min.` };
    }

    function showGuest() {
        list.innerHTML = `
            <div class="home-events-guest">
                <i class="fa-solid fa-lock"></i>
                <div>
                    <strong>Rennen und Server-Passwörter für Mitglieder</strong>
                    <span>Melde dich an, um die nächsten GSRA-Events zu sehen und direkt mitzufahren.</span>
                </div>
                <a href="login.html" class="home-events-btn">Anmelden</a>
            </div>`;
    }

    function showEvents(events) {
        if (!events.length) {
            list.innerHTML = `<div class="home-events-guest"><i class="fa-solid fa-flag-checkered"></i>
                <div><strong>Gerade keine Rennen geplant</strong><span>Sobald neue Events im Rennkalender stehen, erscheinen sie hier.</span></div></div>`;
            return;
        }
        list.innerHTML = events.map((ev) => {
            const date = new Date(ev.event_date);
            const cd = countdown(date);
            const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            return `
                <a class="home-event${cd.live ? ' live' : ''}" href="kalender.html">
                    <span class="home-event-date">
                        <span class="home-event-day">${date.getDate()}</span>
                        <span class="home-event-month">${esc(date.toLocaleDateString('de-DE', { month: 'short' }).replace('.', ''))}</span>
                    </span>
                    <span class="home-event-body">
                        <span class="home-event-meta">${esc(ev.simulation || 'Simulation')} · ${esc(time)} Uhr</span>
                        <strong class="home-event-title">${esc(ev.title || 'Event')}</strong>
                        <span class="home-event-track"><i class="fa-solid fa-road"></i> ${esc(ev.track || 'Strecke folgt')}</span>
                    </span>
                    <span class="home-event-countdown${cd.live ? ' live' : ''}">${cd.live ? '<span class="kal-live-dot"></span> ' : ''}${esc(cd.text)}</span>
                </a>`;
        }).join('');
    }

    async function load() {
        const client = window.supabaseClient;
        if (!client) return;
        try {
            const { data: { session } } = await client.auth.getSession();
            if (!session) return showGuest();
            const from = new Date(Date.now() - LIVE_HOURS * 3600000).toISOString();
            const { data, error } = await client.from('events')
                .select('id, title, simulation, track, event_date')
                .gte('event_date', from)
                .order('event_date', { ascending: true })
                .limit(SHOWN);
            if (error) throw error;
            showEvents(data || []);
        } catch (e) {
            // Startseite bleibt nutzbar; der Bereich verschwindet einfach
            box.hidden = true;
        }
    }

    load();
})();
