/* =========================================
   GSRA - Zentrale Auth- & Navigationssteuerung (Präzise Live-Abfrage)
========================================= */

const initAuthNav = async () => {
    const client = window.supabaseClient || window.supabase;

    if (!client) {
        console.error("Supabase Client nicht gefunden!");
        return;
    }

    // Navigation aus der zentralen Liste (GSRA_NAV) aufbauen – muss vor allem anderen passieren,
    // weil die Knöpfe für Login und Abmelden dabei neu entstehen
    buildMainNav();

    const loginNavBtn = document.getElementById("loginNavBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const guestNotice = document.getElementById("guestNotice");
    const userContent = document.getElementById("userContent");

    const updateUI = (session) => {
        if (session) {
            if (loginNavBtn) loginNavBtn.style.setProperty("display", "none", "important");
            if (logoutBtn) logoutBtn.style.setProperty("display", "flex", "important");
        } else {
            if (loginNavBtn) loginNavBtn.style.setProperty("display", "inline-block", "important");
            if (logoutBtn) logoutBtn.style.setProperty("display", "none", "important");
        }
        // Profil-Menü und Messenger-Symbol nur für Angemeldete
        document.querySelectorAll(".gsra-account, .gsra-nav-tools .gsra-nav-icon[data-only-member]")
            .forEach(el => { el.hidden = !session; });

        if (guestNotice && userContent && session !== "vermutet") {
            if (session) {
                guestNotice.style.display = "none";
                userContent.style.display = "block";
            } else {
                guestNotice.style.display = "block";
                userContent.style.display = "none";
            }
        }
    };

    // Ruhiger Seitenaufbau: Liegt ein Anmelde-Token im Browser, gleich das Profil-Menü statt „Login“ zeigen.
    // Das ist nur die Anzeige – die echte Prüfung (getSession) folgt sofort und korrigiert, falls nötig.
    try {
        if (Object.keys(localStorage).some(k => /^sb-.+-auth-token$/.test(k))) updateUI("vermutet");
    } catch (e) { /* ohne Speicher: wie bisher */ }

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
        const link = document.querySelector('header a[href="admin.html"]');
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
        const { data } = await client.from("profiles").select("role, username, avatar_url").eq("id", userId).maybeSingle();
        fillAccountButton(data);
        // Admins und Moderatoren sehen den Moderationsbereich – im Profil-Menü
        const menu = document.querySelector(".gsra-account-menu") || document.querySelector("header nav");
        isAdmin = ["admin", "moderator"].includes(data?.role);
        if (!isAdmin || !menu) return;
        let adminLink = menu.querySelector('a[href="admin.html"]');
        if (!adminLink) {
            adminLink = document.createElement("a");
            adminLink.href = "admin.html";
            adminLink.setAttribute("role", "menuitem");
            menu.insertBefore(adminLink, logoutBtn && menu.contains(logoutBtn) ? logoutBtn : null);
        }
        adminLink.innerHTML = '<i class="fa-solid fa-shield-halved"></i> ';
        adminLink.append(data.role === "admin" ? "Admin" : "Moderation");
        checkAdminNews();
        // Neue Meldungen live (wie beim Messenger) – auf der Admin-Seite wird die Liste gleich aufgefrischt
        client
            .channel("gsra_admin_reports_channel")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, () => {
                checkAdminNews();
                document.dispatchEvent(new CustomEvent("gsra:new-report"));
            })
            .subscribe();
    };

    // Coaches: offene Reklamation → Hinweis oben auf jeder Seite, bis geantwortet ist (SQL 035/036).
    // Die E-Mail kann im Spam landen – dieser Hinweis nicht. Ohne SQL 035 passiert einfach nichts.
    const showCoachDisputeNotice = async (userId) => {
        try {
            const { data, error } = await client.from("coaching_disputes")
                .select("id, respond_until, coaching_bookings(offer_title)")
                .eq("coach_id", userId).eq("status", "offen")
                .order("respond_until", { ascending: true }).limit(10);
            const header = document.querySelector("header");
            if (error || !data?.length || !header || document.getElementById("gsraDisputeNotice")) return;
            const first = data[0];
            const until = new Date(first.respond_until);
            const hoursLeft = (until.getTime() - Date.now()) / 3600000;
            const bar = document.createElement("div");
            bar.id = "gsraDisputeNotice";
            bar.className = `gsra-dispute-notice${hoursLeft < 24 ? " urgent" : ""}`;
            bar.setAttribute("role", "alert");
            bar.innerHTML = '<i class="fa-solid fa-scale-balanced gsra-dispute-notice-icon" aria-hidden="true"></i>';
            const text = document.createElement("span");
            text.className = "gsra-dispute-notice-text";
            const strong = document.createElement("strong");
            strong.textContent = data.length > 1
                ? `${data.length} Reklamationen zu deinen Coachings`
                : `Reklamation zu deinem Coaching „${first.coaching_bookings?.offer_title || "Coaching"}“`;
            const when = until.toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
            text.append(strong, hoursLeft > 0
                ? ` – bitte antworte bis ${when} Uhr: erstatten oder widersprechen. Ohne Antwort entscheidet die Moderation, bei „nicht erschienen“ wird automatisch erstattet.`
                : " – deine Antwortfrist ist abgelaufen, die Moderation entscheidet jetzt. Erstatten kannst du weiterhin.");
            const link = document.createElement("a");
            link.href = "coaching.html?tab=coach#reklamation";
            link.className = "gsra-dispute-notice-btn";
            link.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Jetzt ansehen';
            bar.append(text, link);
            // Am Anfang des Inhalts (die Kopfzeile ist fest; .container hält schon Abstand zu ihr)
            const host = document.querySelector("header ~ .container");
            if (host) host.prepend(bar);
            else header.insertAdjacentElement("afterend", bar);
            document.querySelector('header nav a[href="coaching.html"]')?.classList.add("nav-unread-glow");
        } catch (e) {
            /* kein Hinweis – die E-Mail und der Bereich „Als Coach“ bleiben */
        }
    };

    // Nach einem Coaching: „Wie war dein Coaching?“ direkt auf der Seite (SQL 038) – statt gleich eine E-Mail zu schicken.
    // „Später“ blendet die Frage bis zum nächsten Browser-Start aus, „Nicht bewerten“ dauerhaft (dann auch keine E-Mail).
    const showReviewPrompt = async () => {
        try {
            if (/\/(login|passwort-neu)(\.html)?$/.test(window.location.pathname)) return;
            const { data, error } = await client.rpc("coaching_review_prompts");
            if (error || !Array.isArray(data)) return;
            let later = [];
            try { later = JSON.parse(sessionStorage.getItem("gsra_bewertung_spaeter") || "[]"); } catch (e) { later = []; }
            const p = data.find(x => !later.includes(x.id));
            if (!p || document.getElementById("gsraReviewPrompt")) return;
            let stack = document.getElementById("gsraNotifyStack");
            if (!stack) {
                stack = document.createElement("div");
                stack.id = "gsraNotifyStack";
                stack.className = "gsra-notify-stack";
                document.body.appendChild(stack);
            }
            const card = document.createElement("div");
            card.id = "gsraReviewPrompt";
            card.className = "gsra-notify-card gsra-review-card";
            card.setAttribute("role", "dialog");
            card.setAttribute("aria-label", "Coaching bewerten");
            card.innerHTML = `
                <div class="gsra-notify-avatar"><i class="fa-solid fa-star"></i></div>
                <div class="gsra-notify-body">
                    <div class="gsra-notify-title"><i class="fa-solid fa-flag-checkered"></i> Wie war dein Coaching?</div>
                    <div class="gsra-notify-text"></div>
                    <div class="gsra-review-actions">
                        <a class="gsra-notify-action" href="coaching.html?tab=anfragen#bewerten-${encodeURIComponent(p.id)}"><i class="fa-solid fa-star"></i> Jetzt bewerten</a>
                        <button type="button" class="gsra-review-later">Später</button>
                        <button type="button" class="gsra-review-never">Nicht bewerten</button>
                    </div>
                </div>
                <button type="button" class="gsra-notify-close" title="Später"><i class="fa-solid fa-xmark"></i></button>`;
            const text = card.querySelector(".gsra-notify-text");
            text.append("„");
            const strong = document.createElement("strong");
            strong.textContent = p.titel || "Coaching";
            text.append(strong, `“ mit ${p.coach_name || "deinem Coach"} – deine Bewertung hilft anderen Fahrern und dem Coach.`);
            const remove = () => {
                card.classList.add("leaving");
                setTimeout(() => card.remove(), 300);
            };
            const snooze = () => {
                try { sessionStorage.setItem("gsra_bewertung_spaeter", JSON.stringify([...later, p.id])); } catch (e) { /* egal */ }
                remove();
            };
            card.querySelector(".gsra-review-later").addEventListener("click", snooze);
            card.querySelector(".gsra-notify-close").addEventListener("click", snooze);
            card.querySelector(".gsra-review-never").addEventListener("click", async () => {
                await client.rpc("coaching_review_dismiss", { _booking_id: p.id }).then(() => {}, () => {});
                remove();
            });
            card.querySelector(".gsra-notify-action").addEventListener("click", remove);
            stack.appendChild(card);
        } catch (e) {
            /* ohne SQL 038 einfach keine Abfrage */
        }
    };

    // Angenommene Freundschaftsanfrage: Hinweis im GSRA-Design – beim Öffnen einer Seite und live
    const showFriendAccepted = async (friendId) => {
        const { data: friend } = await client.from("profiles").select("username, avatar_url").eq("id", friendId).maybeSingle();
        let stack = document.getElementById("gsraNotifyStack");
        if (!stack) {
            stack = document.createElement("div");
            stack.id = "gsraNotifyStack";
            stack.className = "gsra-notify-stack";
            document.body.appendChild(stack);
        }
        const card = document.createElement("div");
        card.className = "gsra-notify-card";
        card.setAttribute("role", "status");
        card.innerHTML = `
            <div class="gsra-notify-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="gsra-notify-body">
                <div class="gsra-notify-title"><i class="fa-solid fa-user-check"></i> Neue Freundschaft</div>
                <div class="gsra-notify-text"><strong></strong> hat deine Freundschaftsanfrage angenommen.</div>
                <a class="gsra-notify-action" href="messenger.html?friendId=${encodeURIComponent(friendId)}"><i class="fa-solid fa-comment"></i> Nachricht schreiben</a>
            </div>
            <button type="button" class="gsra-notify-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button>
            <div class="gsra-notify-progress"></div>`;
        card.querySelector("strong").textContent = friend?.username || "Ein Fahrer";
        if (friend?.avatar_url) {
            const img = document.createElement("img");
            img.src = friend.avatar_url;
            img.alt = "";
            card.querySelector(".gsra-notify-avatar").replaceChildren(img);
        }
        const remove = () => {
            card.classList.add("leaving");
            setTimeout(() => card.remove(), 300);
        };
        card.querySelector(".gsra-notify-close").addEventListener("click", remove);
        stack.appendChild(card);
        setTimeout(remove, 12000);
        // Im Messenger erscheint der neue Freund sofort in der Liste
        // (refreshSocialState/currentUser gibt es nur auf der Messenger-Seite, daher über window)
        if (typeof window.refreshSocialState === "function" && window.gsraMessengerUserId?.()) window.refreshSocialState();
    };
    const checkAcceptedRequests = async (userId) => {
        const { data, error } = await client.from("friendships").select("friend_id").eq("user_id", userId).eq("status", "accepted");
        if (error || !data) return;
        const key = `gsra_known_friends_${userId}`;
        const ids = data.map(f => f.friend_id);
        let known = null;
        try { known = JSON.parse(localStorage.getItem(key)); } catch (e) { known = null; }
        localStorage.setItem(key, JSON.stringify(ids));
        if (!Array.isArray(known)) return; // erster Besuch: nur merken – keine Hinweise für alte Freundschaften
        ids.filter(id => !known.includes(id)).slice(0, 3).forEach(showFriendAccepted);
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

    addNavToggle();
    addSiteFooter();
    kopfHoeheMerken();
    // Login-Knopf in der Kopfzeile führt nach der Anmeldung zurück zur aktuellen Unterseite
    if (loginNavBtn && !PUBLIC_PAGES.includes(currentPageName())) loginNavBtn.href = loginLinkHere();

    let { data: { session } } = await client.auth.getSession();

    // Zwei-Faktor-Anmeldung eingerichtet, aber der Code wurde nie bestätigt (z. B. Code-Fenster abgebrochen):
    // Diese Sitzung zählt nicht – sofort abmelden und zurück zum Login (dort wird der Code abgefragt)
    if (session?.user?.id && client.auth.mfa) {
        const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
            await client.auth.signOut();
            if (currentPageName() !== "login") {
                window.location.href = loginLinkHere("zweifaktor=1&");
                return;
            }
            session = null;
        }
    }
    updateUI(session);

    // Ohne Anmeldung: Hinweis über der ganzen Seite (außer Startseite und Login)
    if (!session?.user?.id) showLoginRequiredOverlay();

    if (session?.user?.id && await checkBan(session.user.id)) return;
    if (session?.user?.id) showAdminLink(session.user.id);
    if (session?.user?.id) showCoachDisputeNotice(session.user.id);
    if (session?.user?.id) setTimeout(showReviewPrompt, 1500); // nach dem Seitenaufbau, nicht sofort aufdringlich

    if (session?.user?.id) {
        startVisibilityHeader(client);
        checkLiveUnreadMessages(session.user.id, session.user.created_at);
        touchPresence();
        markDelivered();
        presenceTimer = setInterval(() => {
            // Lebenszeichen auch im Hintergrund (wer in der Simulation fährt, bleibt „online · spielt gerade …“);
            // nur die Admin-Hinweise ruhen im versteckten Tab und kommen beim Zurückkommen
            touchPresence();
            if (!document.hidden) checkAdminNews();
        }, 60000);
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) touchPresence();
        });

        // Live-Verbindungen der Navigation; im Hintergrund-Tab nach 3 Minuten getrennt (supabase-client.js)
        let navChannels = [];
        const startNavChannels = () => {
            navChannels = [
                client
                    .channel('global_nav_unread_channel')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                        if (payload.new && payload.new.sender_id !== session.user.id) {
                            checkLiveUnreadMessages(session.user.id, session.user.created_at);
                            markDelivered();
                        }
                    })
                    .subscribe(),
                client
                    .channel("gsra_friendships_channel")
                    .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `user_id=eq.${session.user.id}` }, (payload) => {
                        if (payload.new?.status === "accepted") checkAcceptedRequests(session.user.id);
                    })
                    .subscribe()
            ];
        };
        startNavChannels();
        checkAcceptedRequests(session.user.id);
        if (window.gsraHintergrund) window.gsraHintergrund(() => {
            navChannels.forEach(ch => client.removeChannel(ch));
            navChannels = [];
        }, () => {
            startNavChannels();
            checkLiveUnreadMessages(session.user.id, session.user.created_at);
            checkAcceptedRequests(session.user.id);
        });
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
            await clearDeviceMedia();
            window.location.href = "login.html";
        });
    }
};

// Auf dem Gerät gespeicherte Chat-Fotos und Sprachnachrichten (chat-medien.js) beim Abmelden entfernen –
// wichtig auf geteilten Rechnern. Wird auch nach dem Löschen des Kontos und „Auf allen Geräten abmelden“ genutzt.
async function clearDeviceMedia() {
    try { if (window.caches) await caches.delete("gsra-chat-medien-v1"); } catch (e) { /* egal */ }
    try { localStorage.removeItem("gsra_chat_medien_index"); } catch (e) { /* egal */ }
}
window.gsraClearDeviceMedia = clearDeviceMedia;

// Visibility-Header: Namen der Mitglieder mit Pole oder Alliance schweben hinter der Navigation von links nach rechts.
// Fair: Alle Namen werden gemischt und nacheinander gezeigt, erst danach neu gemischt – jeder kommt gleich oft dran.
// Wer das nicht möchte, schaltet es im Dashboard ab. Bei „Bewegung reduzieren“ (Systemeinstellung) bleibt es aus.
async function startVisibilityHeader(client) {
    const header = document.querySelector("header");
    if (!header || header.querySelector(".gsra-visibility")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const { data, error } = await client.rpc("visibility_names");
    if (error || !Array.isArray(data) || !data.length) return;
    const layer = document.createElement("div");
    layer.className = "gsra-visibility";
    layer.setAttribute("aria-hidden", "true");
    header.prepend(layer);

    let queue = [];
    const nextName = () => {
        if (!queue.length) {
            queue = data.slice();
            for (let i = queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue[i], queue[j]] = [queue[j], queue[i]];
            }
        }
        return queue.pop();
    };
    // Feste Spuren übereinander: pro Spur schwebt immer nur ein Name, so überlappen sich keine Namen
    const lanes = () => (window.innerWidth < 700 ? [18, 58] : [6, 28, 50, 72]);
    const busy = new Set();
    const spawn = () => {
        if (document.hidden) return;
        const free = lanes().filter(top => !busy.has(top));
        if (!free.length) return;
        const entry = nextName();
        if (!entry?.username) return;
        const top = free[Math.floor(Math.random() * free.length)];
        busy.add(top);
        // „Rennstrecke“: außen fährt der Name von links nach rechts (gleichmäßig, mit Schwung oder als Überholer),
        // innen wippt er sanft, ein Lichtreflex läuft über die Schrift, Fahrtwind-Streifen ziehen hinterher
        const el = document.createElement("span");
        el.className = `gsra-vis-name ${entry.plan === "alliance" ? "alliance" : "pole"}`;
        const inner = document.createElement("span");
        inner.className = "gsra-vis-inner";
        inner.textContent = entry.username;
        el.appendChild(inner);
        el.style.top = `${top}%`;
        el.style.animationDuration = `${14 + Math.random() * 10}s`;
        el.style.animationTimingFunction = ["linear", "cubic-bezier(.55, .05, .45, .95)", "cubic-bezier(.25, .7, .35, 1)", "cubic-bezier(.7, 0, .85, .6)"][Math.floor(Math.random() * 4)];
        inner.style.setProperty("--bob", `${2.2 + Math.random() * 1.8}s`);
        inner.style.setProperty("--amp", `${2 + Math.random() * 3}px`);
        inner.style.animationDelay = `${(-Math.random() * 3).toFixed(2)}s, ${(-Math.random() * 3).toFixed(2)}s`;
        el.addEventListener("animationend", () => {
            busy.delete(top);
            el.remove();
        });
        layer.appendChild(el);
    };
    spawn();
    setInterval(spawn, 3800);
}

// Nicht angemeldet: Hinweis über der ganzen Seite im Design des Messengers – auf jeder Unterseite außer der Startseite
const LOGIN_REQUIRED_TEXTS = {
    "app-verbinden": ["die GSRA-App", "Melde dich hier an – danach bestätigst du mit einem Klick, dass die GSRA-App auf deinem PC dein Konto nutzen darf."],
    messenger:["den Messenger", "Mit deinem GSRA-Konto chattest du mit Freunden, trittst Foren bei und bleibst im offiziellen GSRA-Forum auf dem Laufenden."],
    marktplatz: ["den Marktplatz", "Mit deinem GSRA-Konto kaufst und verkaufst du Sim-Racing-Hardware in der Community."],
    setups: ["die Setups", "Mit deinem GSRA-Konto lädst du Setups herunter und teilst deine eigenen mit der Community."],
    coaching: ["das Coaching", "Mit deinem GSRA-Konto buchst du Coachings bei erfahrenen Fahrern – oder wirst mit der GSRA-Coach-Lizenz selbst Coach."],
    nachschlagewerk: ["das Nachschlagewerk", "Mit deinem GSRA-Konto hast du Zugriff auf das komplette Sim-Racing-Wissen der GSRA."],
    stintplaner: ["den Stint-Planer", "Der Stint-Planer ist Teil von Pole und Alliance: Kraftstoff, Stints, Reifen- und Fahrerwechsel für Langstreckenrennen in Sekunden geplant."],
    kalender: ["den Rennkalender","Mit deinem GSRA-Konto siehst du alle Rennen und Events der GSRA-Community."],
    dashboard: ["dein Dashboard", "Im Dashboard verwaltest du dein Profil, dein Profilbild und deine GSRA-ID."],
    admin: ["den Admin-Bereich", "Der Admin-Bereich ist nur für Administratoren der GSRA."]
};

// Seiten ohne Anmelde-Pflicht (Startseite, Login, Abos/Preise und Rechtstexte)
// Seiten ohne Anmeldung (Wissen ist für alle lesbar, auch für Suchmaschinen)
const PUBLIC_PAGES = ["", "index", "login", "passwort-neu", "abo", "kuendigen", "impressum", "datenschutz", "nutzungsbedingungen", "hilfe", "nachschlagewerk", "unterstuetzen"];

// Abo-Stufen der GSRA: Paddock (kostenlos), Pole (Premium), Alliance (Team) – Abzeichen in Profilen und beim Verkäufer
const GSRA_PLANS = {
    paddock: { name: "Paddock", icon: "fa-flag-checkered" },
    pole: { name: "Pole", icon: "fa-stopwatch" },
    alliance: { name: "Alliance", icon: "fa-people-group" }
};
const planCache = new Map();
window.GSRA_PLANS = GSRA_PLANS;
// „Zuletzt online“ (auf allen GSRA-Seiten gemessen): Freunde sehen die Uhrzeit, alle anderen nur den Tag.
// Ergebnis: { online, text } oder null (nicht angemeldet, blockiert, SQL fehlt, noch nie online)
window.lastSeenInfo = async (userId) => {
    const client = window.supabaseClient || window.supabase;
    if (!client || !userId) return null;
    const { data, error } = await client.rpc("last_seen_of", { _user: userId });
    if (error || !data?.last_seen_at) return null;
    if (data.online) return { online: true, text: "Online" };
    const seen = new Date(data.last_seen_at);
    const day = seen.toDateString() === new Date().toDateString() ? "heute"
        : seen.toDateString() === new Date(Date.now() - 86400000).toDateString() ? "gestern" : null;
    const time = seen.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const minutes = Math.floor((Date.now() - seen.getTime()) / 60000);
    if (data.exact && minutes < 2) return { online: false, text: "Zuletzt online gerade eben" };
    if (data.exact && minutes < 60) return { online: false, text: `Zuletzt online vor ${minutes} Min.` };
    if (day) return { online: false, text: data.exact ? `Zuletzt online ${day} um ${time}` : `Zuletzt online ${day}` };
    return { online: false, text: `Zuletzt online am ${seen.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}` };
};

window.showPlanBadge = async (target, userId, { link = true } = {}) => {
    const client = window.supabaseClient || window.supabase;
    if (!target || !userId || !client) return;
    target.dataset.planUser = userId;
    if (!planCache.has(userId)) {
        planCache.set(userId, client.rpc("plan_of", { _user: userId }).then(({ data, error }) => (error ? null : data), () => null));
    }
    const plan = await planCache.get(userId);
    // Ohne die Zahlungs-Tabellen (SQL noch nicht ausgeführt) oder bei einem anderen Profil inzwischen: kein Abzeichen
    if (!GSRA_PLANS[plan] || target.dataset.planUser !== userId) return;
    const badge = document.createElement(link ? "a" : "span");
    if (link) badge.href = "abo.html";
    badge.className = `plan-badge ${plan}`;
    badge.title = `Abo: ${GSRA_PLANS[plan].name}`;
    badge.innerHTML = `<i class="fa-solid ${GSRA_PLANS[plan].icon}"></i>`;
    badge.append(` ${GSRA_PLANS[plan].name}`);
    target.replaceChildren(badge);
    // Unterstützer-Abzeichen (SQL 043): nur, wer es selbst eingeschaltet hat – nie mit Betrag
    if (await isPublicSupporter(client, userId) && target.dataset.planUser === userId && !target.querySelector(".plan-badge.supporter")) {
        const heart = document.createElement(link ? "a" : "span");
        if (link) heart.href = "unterstuetzen.html";
        heart.className = "plan-badge supporter";
        heart.title = "Unterstützt die GSRA";
        heart.innerHTML = '<i class="fa-solid fa-heart"></i>';
        heart.append(" Unterstützer");
        target.append(heart);
    }
};
const supporterCache = new Map();
function isPublicSupporter(client, userId) {
    if (!supporterCache.has(userId)) {
        supporterCache.set(userId, client.rpc("supporter_badges", { _users: [userId] })
            .then(({ data, error }) => !error && Array.isArray(data) && data.length > 0, () => false));
    }
    return supporterCache.get(userId);
}
const currentPageName = () => (window.location.pathname.split("/").pop() || "").replace(/\.html$/, "").toLowerCase();

// Login-Link, der nach der Anmeldung zur aktuellen Seite zurückführt
const loginLinkHere = (extra = "") => {
    const here = (window.location.pathname.split("/").pop() || "index.html") + window.location.search;
    return `login.html?${extra}weiter=${encodeURIComponent(here)}`;
};

// Höhe der festen Kopfzeile als CSS-Variable (--gsra-kopf-hoehe): Die App-Ansicht (Messenger) füllt genau den
// Platz darunter, auch wenn die Kopfzeile auf schmalen Bildschirmen höher oder niedriger ist
function kopfHoeheMerken() {
    const kopf = document.querySelector("body > header");
    if (!kopf) return;
    const setzen = () => document.documentElement.style.setProperty("--gsra-kopf-hoehe", `${Math.ceil(kopf.getBoundingClientRect().height)}px`);
    setzen();
    new ResizeObserver(setzen).observe(kopf); // z. B. wenn das Menü auf dem Handy die Kopfzeile verändert
    window.addEventListener("resize", setzen);
}

// Fußzeile auf jeder Seite: schlanke Leiste mit Abos, Kündigen, Impressum, Datenschutz, Nutzungsbedingungen.
// „Folge GSRA“ steht nur noch auf der Startseite (eigener Bereich, Wunsch 25.11.).
function addSiteFooter() {
    if (document.getElementById("gsraSiteFooter")) return;
    const footer = document.createElement("footer");
    footer.id = "gsraSiteFooter";
    footer.className = "gsra-site-footer";
    footer.innerHTML = `
        <span>© ${new Date().getFullYear()} Global Simracing Alliance</span>
        <div class="gsra-site-footer-links">
            <a href="abo.html">Abos</a>
            <a href="unterstuetzen.html">Unterstützen</a>
            <a href="kuendigen.html" class="gsra-footer-cancel">Verträge hier kündigen</a>
            <a href="impressum.html">Impressum</a>
            <a href="datenschutz.html">Datenschutz</a>
            <a href="nutzungsbedingungen.html">Nutzungsbedingungen</a>
        </div>`;
    document.body.appendChild(footer);
}

// =========================================
// Hauptnavigation – EINE Liste für alle Seiten (Entscheidung 22.11.: Themen-Menüs)
// Neue Unterseite = eine Zeile hier. „bald: true“ zeigt sie schon im Menü, aber noch nicht anklickbar.
// =========================================
const GSRA_NAV = [
    { label: "Home", href: "index.html" },
    // Messenger als eigener Hauptpunkt (Wunsch 22.11.); neue Nachrichten zeigt ein dezenter Punkt am Wort
    { label: "Messenger", href: "messenger.html", id: "messengerNavBtn" },
    { label: "Community", items: [
        { label: "Rennkalender", href: "kalender.html", icon: "fa-flag-checkered", text: "Events, Countdown, Server-Passwörter" },
        { label: "Videos", href: "videos.html", icon: "fa-film", text: "Neue Videos unserer Pro-Fahrer" }
    ] },
    { label: "Garage", items: [
        { label: "Setups", href: "setups.html", icon: "fa-sliders", text: "Setup Hub für alle Simulationen" },
        { label: "Stint-Planer", href: "stintplaner.html", icon: "fa-gas-pump", text: "Sprit, Stints und Boxenstopps planen", vorschau: true },
        { label: "Telemetrie", icon: "fa-chart-line", text: "Runden vergleichen und schneller werden", bald: true },
        { label: "Renningenieur", href: "renningenieur.html", icon: "fa-headset", text: "Dein KI-Renningenieur", vorschau: true },
        { label: "Liveries", href: "liveries.html", icon: "fa-palette", text: "Painter für dein Design finden" }
    ] },
    { label: "Marktplatz", href: "marktplatz.html" },
    { label: "Coaching", href: "coaching.html" },
    { label: "Wissen", items: [
        { label: "Nachschlagewerk", href: "nachschlagewerk.html", icon: "fa-book", text: "Motorsport- und Physik-Begriffe" },
        { label: "Hilfe-Center", href: "hilfe.html", icon: "fa-circle-question", text: "So funktioniert die GSRA" }
    ] }
];
// Profil-Menü (nur angemeldet); Moderation/Admin kommt bei Bedarf dazu
const GSRA_ACCOUNT_MENU = [
    { label: "Dashboard", href: "dashboard.html", icon: "fa-gauge-high" },
    { label: "Abo", href: "abo.html", icon: "fa-crown" },
    // Entschieden 22.11.: einmalig + monatlich, freiwillig mit Namen auf der Unterstützerwand und Abzeichen (SQL 043)
    { label: "Unterstützen", href: "unterstuetzen.html", icon: "fa-heart" }
];

const navEscape = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);

function buildMainNav() {
    const header = document.querySelector("header");
    const nav = header?.querySelector("nav");
    if (!header || !nav || nav.dataset.built) return;
    nav.dataset.built = "1";
    nav.classList.add("gsra-nav");
    nav.setAttribute("aria-label", "Hauptnavigation");
    const page = currentPageName() || "index";
    const isHere = (href) => href && href.replace(/\.html$/, "") === page;

    const entry = (it) => it.bald
        ? `<span class="gsra-nav-item soon" aria-disabled="true"><span class="gsra-nav-item-icon"><i class="fa-solid ${it.icon}"></i></span>
             <span class="gsra-nav-item-text"><strong>${navEscape(it.label)} <em>Bald</em></strong><small>${navEscape(it.text)}</small></span></span>`
        : `<a class="gsra-nav-item${isHere(it.href) ? " active" : ""}" role="menuitem" href="${it.href}"${isHere(it.href) ? ' aria-current="page"' : ""}>
             <span class="gsra-nav-item-icon"><i class="fa-solid ${it.icon}"></i></span>
             <span class="gsra-nav-item-text"><strong>${navEscape(it.label)}${it.vorschau ? " <em class=\"vorschau\">Vorschau</em>" : ""}</strong><small>${navEscape(it.text)}</small></span></a>`;

    nav.innerHTML = GSRA_NAV.map((g, i) => {
        if (!g.items) return `<a href="${g.href}"${g.id ? ` id="${g.id}"` : ""} class="gsra-nav-link${isHere(g.href) ? " active" : ""}"${isHere(g.href) ? ' aria-current="page"' : ""}>${navEscape(g.label)}${g.id === "messengerNavBtn" ? '<span class="gsra-nav-badge" aria-hidden="true"></span><span class="sr-only gsra-nav-badge-text"> – neue Nachrichten</span>' : ""}</a>`;
        const active = g.items.some(it => isHere(it.href));
        return `<div class="gsra-nav-group">
            <button type="button" class="gsra-nav-trigger${active ? " active" : ""}" aria-expanded="false" aria-controls="gsraNavMenu${i}">${navEscape(g.label)} <i class="fa-solid fa-chevron-down"></i></button>
            <div class="gsra-nav-menu" id="gsraNavMenu${i}" role="menu">${g.items.map(entry).join("")}</div>
        </div>`;
    }).join("");

    // Rechts: Suche (src/suche.ts), Hilfe, Messenger, Login bzw. Profil-Menü
    const tools = document.createElement("div");
    tools.className = "gsra-nav-tools";
    tools.innerHTML = `
        <a href="hilfe.html" class="gsra-nav-icon gsra-help-btn${isHere("hilfe.html") ? " active" : ""}" title="Hilfe-Center" aria-label="Hilfe-Center"><i class="fa-solid fa-question"></i></a>
        <a href="login.html" class="login-btn" id="loginNavBtn">Login</a>
        <div class="gsra-nav-group gsra-account" hidden>
            <button type="button" class="gsra-account-btn" aria-expanded="false" aria-controls="gsraAccountMenu" aria-label="Profil-Menü">
                <span class="gsra-account-avatar"><i class="fa-solid fa-user"></i></span><i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="gsra-nav-menu gsra-account-menu" id="gsraAccountMenu" role="menu">
                <div class="gsra-account-name"></div>
                ${GSRA_ACCOUNT_MENU.map(it => `<a role="menuitem" href="${it.href}"${isHere(it.href) ? ' class="active"' : ""}><i class="fa-solid ${it.icon}"></i> ${navEscape(it.label)}</a>`).join("")}
                <button type="button" id="logoutBtn" role="menuitem"><i class="fa-solid fa-right-from-bracket"></i> Abmelden</button>
            </div>
        </div>`;
    nav.insertAdjacentElement("afterend", tools);
    // Die Suche kann schon vor der Navigation entstanden sein – dann nach rechts zu den Werkzeugen holen
    const search = header.querySelector(".gsra-search-btn");
    if (search) tools.prepend(search);

    // Aufklappen: Maus (Desktop) über CSS, Klick und Tastatur für alle Geräte
    const groups = () => [...header.querySelectorAll(".gsra-nav-group")];
    const close = (except) => groups().forEach(g => {
        if (g === except) return;
        g.classList.remove("open");
        g.querySelector("button[aria-expanded]")?.setAttribute("aria-expanded", "false");
    });
    // Am PC mit Maus öffnen die Menüs beim Darüberfahren (style.css) – ein Klick soll nichts zusätzlich umklappen
    const hoverDesktop = () => window.matchMedia("(hover: hover) and (min-width: 901px)").matches;
    header.addEventListener("click", (e) => {
        const btn = /** @type {Element} */ (e.target).closest(".gsra-nav-trigger, .gsra-account-btn");
        if (!btn) return;
        if (hoverDesktop()) { e.preventDefault(); return; }
        const group = btn.closest(".gsra-nav-group");
        const open = !group.classList.contains("open");
        close(group);
        group.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (e) => { if (!/** @type {Element} */ (e.target).closest?.(".gsra-nav-group")) close(null); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(null); });
}

// Profilbild und Name im Profil-Menü
function fillAccountButton(profile) {
    const avatar = document.querySelector(".gsra-account-avatar");
    const name = document.querySelector(".gsra-account-name");
    if (name) name.textContent = profile?.username || "Dein Konto";
    if (!avatar) return;
    const url = String(profile?.avatar_url || "");
    if (/^https:\/\//i.test(url)) {
        const img = document.createElement("img");
        img.src = window.gsraAvatarKlein ? window.gsraAvatarKlein(url) : url; // kleine Fassung (128 px) genügt fürs Menü
        img.alt = "";
        img.referrerPolicy = "no-referrer";
        avatar.replaceChildren(img);
    } else if (profile?.username) {
        avatar.textContent = profile.username.trim().charAt(0).toUpperCase();
    }
}

// Handy: Menü-Knopf blendet die Navigation ein und aus (siehe style.css, bis 900 px Breite)
function addNavToggle() {
    const header = document.querySelector("header");
    const nav = header?.querySelector("nav");
    if (!header || !nav || header.querySelector(".nav-toggle")) return;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-toggle";
    toggle.innerHTML = "<span></span><span></span><span></span>";
    header.insertBefore(toggle, nav);

    const setOpen = (open) => {
        header.classList.toggle("nav-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
    };
    setOpen(false);
    toggle.addEventListener("click", () => setOpen(!header.classList.contains("nav-open")));
    // Links schließen das Menü; die Themen-Knöpfe klappen nur ihre Gruppe auf
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("click", (e) => { if (!header.contains(/** @type {Node} */ (e.target))) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
}

function showLoginRequiredOverlay() {
    const page = currentPageName();
    if (PUBLIC_PAGES.includes(page) || document.getElementById("loginRequired")) return;
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
                <a href="${loginLinkHere()}" class="gsra-dialog-btn primary"><i class="fa-solid fa-right-to-bracket"></i> Anmelden</a>
                <a href="${loginLinkHere("registrieren=1&")}" class="gsra-dialog-btn secondary"><i class="fa-solid fa-user-plus"></i> Konto erstellen</a>
            </div>
            <a href="index.html" class="gsra-login-back"><i class="fa-solid fa-arrow-left"></i> Zur Startseite</a>
            <div class="gsra-login-legal">
                <a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a> · <a href="nutzungsbedingungen.html">Nutzungsbedingungen</a>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthNav);
} else {
    initAuthNav();
}