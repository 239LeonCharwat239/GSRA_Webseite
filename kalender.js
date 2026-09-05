let allEvents = [];
let isAdmin = false;

async function initCalendar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        
        if (profile && profile.role === 'admin') {
            isAdmin = true;
            document.getElementById('admin-event-section').style.display = 'block';
            document.getElementById('admin-header-action').style.display = 'table-cell';
        }
    }

    fetchEvents();
}

async function fetchEvents() {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

    if (error) {
        console.error("Fehler beim Laden:", error);
        return;
    }

    allEvents = data;
    renderEvents(allEvents);
}

function renderEvents(events) {
    const list = document.getElementById('events-list');
    list.innerHTML = '';

    if (events.length === 0) {
        list.innerHTML = `<tr><td colspan="${isAdmin ? 6 : 5}" style="text-align: center;">Keine anstehenden Events gefunden.</td></tr>`;
        return;
    }

    events.forEach(ev => {
        const dateFormatted = new Date(ev.event_date).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: bold; color: var(--gsra-yellow);">${dateFormatted} Uhr</td>
            <td style="font-weight: 600;">${ev.title}</td>
            <td><span class="text-blue" style="font-weight: bold;">${ev.simulation}</span></td>
            <td>${ev.track}</td>
            <td>${ev.server_password ? `<code>${ev.server_password}</code>` : '<span style="opacity: 0.5;">Kein PW</span>'}</td>
            ${isAdmin ? `<td style="text-align: right;"><button onclick="deleteEvent('${ev.id}')" style="background: none; border: none; color: #ff4d4d; cursor: pointer;"><i class="fa-solid fa-trash"></i></button></td>` : ''}
        `;
        list.appendChild(row);
    });
}

async function deleteEvent(eventId) {
    if (confirm("Möchtest du dieses Event wirklich löschen?")) {
        const { error } = await supabase.from('events').delete().eq('id', eventId);
        if (error) {
            alert("Fehler beim Löschen: " + error.message);
        } else {
            fetchEvents();
        }
    }
}

document.getElementById('filter-sim').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'ALL') {
        renderEvents(allEvents);
    } else {
        renderEvents(allEvents.filter(ev => ev.simulation === val));
    }
});

document.getElementById('create-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('ev-title').value;
    const simulation = document.getElementById('ev-sim').value;
    const track = document.getElementById('ev-track').value;
    const event_date = document.getElementById('ev-date').value;
    const server_password = document.getElementById('ev-password').value;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('events').insert([{
        title,
        simulation,
        track,
        event_date,
        server_password: server_password || null,
        created_by: user.id
    }]);

    if (error) {
        alert("Fehler beim Erstellen: " + error.message);
    } else {
        alert("Event erfolgreich hinzugefügt!");
        document.getElementById('create-event-form').reset();
        fetchEvents();
    }
});

initCalendar();