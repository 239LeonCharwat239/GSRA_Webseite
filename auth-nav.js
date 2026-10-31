/* =========================================
   GSRA - Zentrale Auth- & Navigationssteuerung (Präzise Live-Abfrage)
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
        if (session) {
            if (loginNavBtn) loginNavBtn.style.setProperty("display", "none", "important");
            if (logoutBtn) logoutBtn.style.setProperty("display", "inline-block", "important");
        } else {
            if (loginNavBtn) loginNavBtn.style.setProperty("display", "inline-block", "important");
            if (logoutBtn) logoutBtn.style.setProperty("display", "none", "important");
        }

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

    const checkLiveUnreadMessages = async (userId, registeredAt) => {
        if (!userId) return;

        try {
            const { data: userChats } = await client
                .from("chats")
                .select("id")
                .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

            const { data: groupChats } = await client
                .from("chats")
                .select("id, user1_id, user2_id, title")
                .not("title", "is", null);

            // Offizielles Forum suchen – fehlt es (z. B. nach dem Leeren der Tabelle), legt die Datenbank-Funktion es neu an,
            // damit die Willkommensnachricht auf jeder Seite sofort als ungelesen leuchtet
            let officialForum = (groupChats || []).find(c => c.title === 'GSRA Official / Community Forum' || (c.title && c.title.includes('Official')));
            if (!officialForum && registeredAt) {
                const { data: forumId, error: rpcError } = await client.rpc("ensure_official_forum");
                if (!rpcError && forumId) officialForum = { id: forumId };
            }

            const map = new Map();
            [...(userChats || []), ...(groupChats || []).filter(c => c.user1_id === c.user2_id)].forEach(c => map.set(c.id, c));
            const allIds = Array.from(map.keys());

            if (allIds.length === 0 && !officialForum) return;

            // Offene Freundschaftsanfragen und unbestätigte Verwarnungen lassen den Messenger ebenfalls leuchten
            const [{ data: openRequests }, { data: openWarnings }] = await Promise.all([
                client.from("friendships").select("user_id").eq("friend_id", userId).eq("status", "pending").limit(1),
                client.from("user_warnings").select("id").eq("user_id", userId).is("acknowledged_at", null).limit(1)
            ]);
            let hasUnread = Boolean(openRequests?.length || openWarnings?.length);
            for (const cId of hasUnread ? [] : allIds) {
                const lastRead = localStorage.getItem(`gsra_last_read_${userId}_${cId}`);
                const lastReadTime = lastRead ? new Date(lastRead).toISOString() : new Date(0).toISOString();

                const { data: unreadMsgs } = await client
                    .from("messages")
                    .select("id")
                    .eq("chat_id", cId)
                    .neq("sender_id", userId)
                    .gt("created_at", lastReadTime)
                    .limit(1);

                if (unreadMsgs && unreadMsgs.length > 0) {
                    hasUnread = true;
                    break;
                }
            }

            // Persönliche Willkommensnachricht im offiziellen Forum gilt als ungelesen, bis das Forum nach der Registrierung geöffnet wurde
            if (!hasUnread && officialForum && registeredAt) {
                const forumLastRead = localStorage.getItem(`gsra_last_read_${userId}_${officialForum.id}`);
                if (!forumLastRead || new Date(forumLastRead) < new Date(registeredAt)) hasUnread = true;
            }

            localStorage.setItem('gsra_has_unread', hasUnread ? 'true' : 'false');
            
            const messengerNavBtn = document.getElementById("messengerNavBtn") || document.querySelector('a[href="messenger.html"]');
            if (messengerNavBtn) {
                if (hasUnread) {
                    messengerNavBtn.classList.add("nav-unread-glow");
                } else {
                    messengerNavBtn.classList.remove("nav-unread-glow");
                }
            }
        } catch (e) {
            console.error("Fehler beim Prüfen ungelesener Nachrichten:", e);
        }
    };

    // Gesperrte Konten: sofort abmelden und auf der Login-Seite den Hinweis mit der Dauer zeigen
    const checkBan = async (userId) => {
        const { data, error } = await client.from("user_bans").select("banned_until, lifted_at").eq("user_id", userId).is("lifted_at", null);
        if (error || !data) return false;
        const activeBan = data.find(b => !b.banned_until || new Date(b.banned_until) > new Date());
        if (!activeBan) return false;
        await client.auth.signOut();
        // Auf der Login-Seite nicht erneut umleiten (sonst Endlosschleife, falls das Abmelden einmal scheitert)
        if (!window.location.pathname.endsWith("login.html")) {
            window.location.href = `login.html?gesperrt=${encodeURIComponent(activeBan.banned_until || "dauerhaft")}`;
        }
        return true;
    };

    // Admins sehen in der Navigation zusätzlich den Admin-Bereich – er leuchtet rot, sobald neue Meldungen eingehen
    let isAdmin = false;
    const isAdminPage = /admin(\.html)?$/.test(window.location.pathname);
    const checkAdminNews = async () => {
        const link = document.querySelector('header nav a[href="admin.html"]');
        if (!isAdmin || !link) return;
        if (isAdminPage) {
            localStorage.setItem("gsra_admin_seen_at", new Date().toISOString());
            link.classList.remove("nav-unread-glow");
            return;
        }
        const { data } = await client.from("reports").select("created_at").eq("status", "offen").order("created_at", { ascending: false }).limit(1);
        const seenAt = localStorage.getItem("gsra_admin_seen_at");
        const hasNews = Boolean(data?.[0] && (!seenAt || new Date(data[0].created_at) > new Date(seenAt)));
        link.classList.toggle("nav-unread-glow", hasNews);
    };
    const showAdminLink = async (userId) => {
        const { data } = await client.from("profiles").select("role").eq("id", userId).maybeSingle();
        const nav = document.querySelector("header nav");
        isAdmin = data?.role === "admin";
        if (!isAdmin || !nav) return;
        if (!nav.querySelector('a[href="admin.html"]')) {
            const link = document.createElement("a");
            link.href = "admin.html";
            link.textContent = "Admin";
            nav.insertBefore(link, loginNavBtn || logoutBtn || null);
        }
        checkAdminNews();
    };

    // Online-Status: Lebenszeichen jede Minute, solange eine GSRA-Seite offen ist (auch im Hintergrund, z. B. beim Zocken)
    let presenceTimer = null;
    const touchPresence = () => client.rpc("touch_presence").then(({ error }) => {
        if (error && /could not find the function|schema cache/i.test(error.message || "")) clearInterval(presenceTimer);
    }, () => {});
    // Häkchen: neue Nachrichten gelten als zugestellt, sobald eine GSRA-Seite offen ist
    let deliveredTimer = null;
    const markDelivered = () => {
        clearTimeout(deliveredTimer);
        deliveredTimer = setTimeout(() => client.rpc("mark_chats_delivered").then(() => {}, () => {}), 1500);
    };

    const { data: { session } } = await client.auth.getSession();
    updateUI(session);

    // Ohne Anmeldung: Hinweis über der ganzen Seite (außer Startseite und Login)
    if (!session?.user?.id) showLoginRequiredOverlay();

    if (session?.user?.id && await checkBan(session.user.id)) return;
    if (session?.user?.id) showAdminLink(session.user.id);

    if (session?.user?.id) {
        checkLiveUnreadMessages(session.user.id, session.user.created_at);
        touchPresence();
        markDelivered();
        presenceTimer = setInterval(() => {
            touchPresence();
            checkAdminNews();
        }, 60000);
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) touchPresence();
        });

        client
            .channel('global_nav_unread_channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                if (payload.new && payload.new.sender_id !== session.user.id) {
                    checkLiveUnreadMessages(session.user.id, session.user.created_at);
                    markDelivered();
                }
            })
            .subscribe();
    }

    client.auth.onAuthStateChange((_event, session) => {
        updateUI(session);
        if (session?.user?.id) {
            checkLiveUnreadMessages(session.user.id, session.user.created_at);
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            // Beim Abmelden sofort offline – der Spielstatus verschwindet
            await Promise.race([client.rpc("touch_presence", { _offline: true }), new Promise(resolve => setTimeout(resolve, 1500))]).catch(() => {});
            await client.auth.signOut();
            window.location.href = "login.html";
        });
    }
};

// Nicht angemeldet: Hinweis über der ganzen Seite im Design des Messengers – auf jeder Unterseite außer der Startseite
const LOGIN_REQUIRED_TEXTS = {
    messenger: ["den Messenger", "Mit deinem GSRA-Konto chattest du mit Freunden, trittst Foren bei und bleibst im offiziellen GSRA-Forum auf dem Laufenden."],
    marktplatz: ["den Marktplatz", "Mit deinem GSRA-Konto kaufst und verkaufst du Sim-Racing-Hardware in der Community."],
    setups: ["die Setups", "Mit deinem GSRA-Konto lädst du Setups herunter und teilst deine eigenen mit der Community."],
    nachschlagewerk: ["das Nachschlagewerk", "Mit deinem GSRA-Konto hast du Zugriff auf das komplette Sim-Racing-Wissen der GSRA."],
    kalender: ["den Rennkalender", "Mit deinem GSRA-Konto siehst du alle Rennen und Events der GSRA-Community."],
    dashboard: ["dein Dashboard", "Im Dashboard verwaltest du dein Profil, dein Profilbild und deine GSRA-ID."],
    admin: ["den Admin-Bereich", "Der Admin-Bereich ist nur für Administratoren der GSRA."]
};

function showLoginRequiredOverlay() {
    const page = (window.location.pathname.split("/").pop() || "").replace(/\.html$/, "").toLowerCase();
    if (["", "index", "login"].includes(page) || document.getElementById("loginRequired")) return;
    const [area, text] = LOGIN_REQUIRED_TEXTS[page] || ["diese Seite", "Mit deinem GSRA-Konto hast du Zugriff auf alle Bereiche der Global Simracing Alliance."];
    const overlay = document.createElement("div");
    overlay.id = "loginRequired";
    overlay.className = "gsra-login-required";
    overlay.innerHTML = `
        <div class="gsra-login-card">
            <img src="GSRA_Logo_ohne Hintergrund.png" alt="GSRA" class="gsra-login-logo">
            <h2>Melde dich an, um ${area} zu nutzen</h2>
            <p>${text}</p>
            <div class="gsra-login-actions">
                <a href="login.html" class="gsra-dialog-btn primary"><i class="fa-solid fa-right-to-bracket"></i> Anmelden</a>
                <a href="login.html?registrieren=1" class="gsra-dialog-btn secondary"><i class="fa-solid fa-user-plus"></i> Konto erstellen</a>
            </div>
            <a href="index.html" class="gsra-login-back"><i class="fa-solid fa-arrow-left"></i> Zur Startseite</a>
        </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthNav);
} else {
    initAuthNav();
}