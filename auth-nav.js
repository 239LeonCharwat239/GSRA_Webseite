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

            const map = new Map();
            [...(userChats || []), ...(groupChats || []).filter(c => c.user1_id === c.user2_id)].forEach(c => map.set(c.id, c));
            const allIds = Array.from(map.keys());

            if (allIds.length === 0) return;

            let hasUnread = false;
            for (const cId of allIds) {
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
            const officialForum = (groupChats || []).find(c => c.title === 'GSRA Official / Community Forum' || (c.title && c.title.includes('Official')));
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

    const { data: { session } } = await client.auth.getSession();
    updateUI(session);

    if (session?.user?.id) {
        checkLiveUnreadMessages(session.user.id, session.user.created_at);

        client
            .channel('global_nav_unread_channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                if (payload.new && payload.new.sender_id !== session.user.id) {
                    checkLiveUnreadMessages(session.user.id, session.user.created_at);
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