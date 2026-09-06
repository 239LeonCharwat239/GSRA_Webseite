document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminPermissions();
    await loadEvents();

    const form = document.getElementById('create-event-form');
    if (form) {
        form.addEventListener('submit', handleCreateEvent);
    }

    const filterSelect = document.getElementById('filter-sim');
    if (filterSelect) {
        filterSelect.addEventListener('change', loadEvents);
    }
});

let isAdmin = false;

async function checkAdminPermissions() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile && profile.role === 'admin') {
            isAdmin = true;
            const adminSection = document.getElementById('admin-event-section');
            const adminHeader = document.getElementById('admin-header-action');
            if (adminSection) adminSection.style.display = 'block';
            if (adminHeader) adminHeader.style.display = 'table-cell';
        }
    } catch (err) {
        console.error('Fehler bei Admin-Prüfung:', err);
    }
}

async function loadEvents() {
    const tbody = document.getElementById('events-list');
    if (!tbody) return;

    const filterSim = document.getElementById('filter-sim')?.value || 'ALL';

    let query = supabaseClient
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

    if (filterSim !== 'ALL') {
        query = query.eq('simulation', filterSim);
    }

    const { data: events, error } = await query;

    if (error) {
        console.error('Fehler beim Laden der Events:', error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ff4d4d;">Fehler beim Laden (${error.message}).</td></tr>`;
        return;
    }

    if (!events || events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Keine anstehenden Events gefunden.</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    events.forEach(ev => {
        const tr = document.createElement('tr');
        
        const dateObj = new Date(ev.event_date);
        const formattedDate = dateObj.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const actionCell = isAdmin 
            ? `<td style="text-align: right;"><button class="btn-delete" onclick="deleteEvent('${ev.id}')"><i class="fa-solid fa-trash"></i> Löschen</button></td>`
            : '';

        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--gsra-yellow);">${formattedDate} Uhr</td>
            <td style="font-weight: 700;">${ev.title}</td>
            <td><span style="background: rgba(0, 85, 255, 0.2); color: var(--gsra-blue); padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; border: 1px solid rgba(0, 85, 255, 0.4);">${ev.simulation}</span></td>
            <td>${ev.track}</td>
            <td style="font-family: monospace;">${ev.password || '<span style="color: var(--text-muted);">-</span>'}</td>
            ${actionCell}
        `;

        tbody.appendChild(tr);
    });
}

async function handleCreateEvent(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const title = document.getElementById('ev-title').value;
        const simulation = document.getElementById('ev-sim').value;
        const track = document.getElementById('ev-track').value;
        const event_date = document.getElementById('ev-date').value;
        const password = document.getElementById('ev-password').value || null;

        const { error } = await supabaseClient
            .from('events')
            .insert([{ title, simulation, track, event_date, password }]);

        if (error) {
            alert('Fehler beim Erstellen: ' + error.message);
        } else {
            document.getElementById('create-event-form').reset();
            await loadEvents();
        }
    } catch (err) {
        console.error('Unerwarteter Fehler:', err);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function deleteEvent(id) {
    if (!confirm('Möchtest du dieses Event wirklich löschen?')) return;

    const { error } = await supabaseClient
        .from('events')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Fehler beim Löschen: ' + error.message);
    } else {
        await loadEvents();
    }
}