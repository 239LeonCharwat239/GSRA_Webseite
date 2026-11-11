/* =========================================
   GSRA - Öffentliches Profil als Karte (z. B. Verkäufer im Marktplatz)
   Gleiches Aussehen wie das Profil im Messenger. Freundschaft, Melden und Blockieren gibt es im
   vollständigen Profil im Messenger (Knopf „Vollständiges Profil“).
========================================= */

async function openProfileCard(userId, { sellerName = "", itemTitle = "" } = {}) {
    const client = window.supabaseClient || window.supabase;
    if (!client || !userId) return;
    document.getElementById("profileCardDialog")?.remove();

    const { data: { session } } = await client.auth.getSession();
    const me = session?.user?.id || null;
    const isMe = me === userId;

    const overlay = document.createElement("div");
    overlay.className = "gsra-dialog-overlay";
    overlay.id = "profileCardDialog";
    overlay.innerHTML = `
        <div class="gsra-dialog gsra-profile-dialog" role="dialog" aria-modal="true">
            <button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button>
            <div class="gsra-profile-avatar"><i class="fa-solid fa-user"></i></div>
            <h3 class="gsra-dialog-title">Lade …</h3>
            <div class="gsra-profile-meta"></div>
            <div class="gsra-profile-presence" style="display: none;"></div>
            <p class="gsra-profile-bio" style="display: none;"></p>
            <div class="gsra-profile-links" style="display: none;"></div>
            <div class="gsra-profile-status profile-card-listings" style="display: none;"></div>
            <div class="gsra-profile-actions"></div>
        </div>`;
    const close = () => {
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
    };
    const onKey = (e) => {
        if (e.key !== "Escape" || !document.body.contains(overlay)) return;
        e.preventDefault();
        e.stopPropagation();
        close();
    };
    overlay.querySelector(".gsra-dialog-close").addEventListener("click", close);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);

    const [{ data: profile }, { count: listings }, seen] = await Promise.all([
        client.from("profiles").select("*").eq("id", userId).maybeSingle(),
        client.from("marketplace").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("status", "verkauft"),
        typeof window.lastSeenInfo === "function" ? window.lastSeenInfo(userId) : null
    ]);
    if (!document.body.contains(overlay)) return;
    const name = profile?.username || sellerName || "GSRA-Mitglied";

    if (/^https:\/\//i.test(profile?.avatar_url || "")) {
        const img = document.createElement("img");
        img.src = profile.avatar_url;
        img.alt = "";
        overlay.querySelector(".gsra-profile-avatar").replaceChildren(img);
    }
    overlay.querySelector(".gsra-dialog-title").textContent = isMe ? `${name} (Du)` : name;

    // Admin-Kennzeichnung, Abo-Stufe, GSRA-ID, Mitglied seit
    const meta = overlay.querySelector(".gsra-profile-meta");
    if (profile?.role === "admin") {
        const badge = document.createElement("span");
        badge.className = "gsra-admin-badge";
        badge.innerHTML = '<i class="fa-solid fa-shield-halved"></i> GSRA-Admin';
        meta.appendChild(badge);
    }
    if (typeof window.showPlanBadge === "function") {
        const slot = document.createElement("span");
        slot.className = "plan-badge-slot inline";
        meta.appendChild(slot);
        window.showPlanBadge(slot, userId);
    }
    if (profile?.gsra_id) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "gsra-id-chip";
        chip.title = "GSRA-ID kopieren";
        chip.innerHTML = `<i class="fa-solid fa-id-badge"></i> GSRA-ID #${Number(profile.gsra_id)} <i class="fa-regular fa-copy"></i>`;
        chip.addEventListener("click", () => navigator.clipboard.writeText(String(profile.gsra_id)).then(
            () => showToast("GSRA-ID kopiert.", "success"), () => showToast("Kopieren nicht möglich.", "error")));
        meta.appendChild(chip);
    }
    if (profile?.created_at) {
        const since = document.createElement("span");
        since.textContent = `Mitglied seit ${new Date(profile.created_at).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}`;
        meta.appendChild(since);
    }

    // Zuletzt online (auf allen GSRA-Seiten gemessen)
    const presence = overlay.querySelector(".gsra-profile-presence");
    if (seen) {
        presence.className = `gsra-profile-presence${seen.online ? " online" : ""}`;
        presence.innerHTML = '<span class="gsra-presence-dot"></span><span class="gsra-presence-text"></span>';
        presence.querySelector(".gsra-presence-text").textContent = seen.text;
        presence.style.display = "";
    }

    const bio = overlay.querySelector(".gsra-profile-bio");
    bio.textContent = profile?.bio || "";
    bio.style.display = profile?.bio ? "" : "none";
    if (typeof renderSocialLinks === "function") renderSocialLinks(overlay.querySelector(".gsra-profile-links"), profile?.social_links);

    const listingsEl = overlay.querySelector(".profile-card-listings");
    if (typeof listings === "number") {
        listingsEl.innerHTML = '<i class="fa-solid fa-tags"></i> <span></span>';
        listingsEl.querySelector("span").textContent = listings === 1 ? "1 aktives Angebot im Marktplatz" : `${listings} aktive Angebote im Marktplatz`;
        listingsEl.style.display = "";
    }

    // Aktionen: Nachricht, vollständiges Profil (Freundschaft, Melden, Blockieren) bzw. eigenes Profil bearbeiten
    const actions = overlay.querySelector(".gsra-profile-actions");
    const link = (href, cls, html) => {
        const a = document.createElement("a");
        a.href = href;
        a.className = `gsra-dialog-btn ${cls}`;
        a.innerHTML = html;
        actions.appendChild(a);
    };
    if (isMe) {
        link("dashboard.html", "primary", '<i class="fa-solid fa-user-pen"></i> Profil bearbeiten');
        return;
    }
    if (!me) {
        link(typeof loginLinkHere === "function" ? loginLinkHere() : "login.html", "primary", '<i class="fa-solid fa-right-to-bracket"></i> Anmelden, um zu schreiben');
        return;
    }
    const chatUrl = `messenger.html?sellerId=${encodeURIComponent(userId)}&sellerName=${encodeURIComponent(name)}${itemTitle ? `&itemTitle=${encodeURIComponent(itemTitle)}` : ""}`;
    link(chatUrl, "primary", '<i class="fa-solid fa-comment"></i> Nachricht schreiben');
    link(`messenger.html?profil=${encodeURIComponent(userId)}`, "secondary", '<i class="fa-solid fa-id-card"></i> Vollständiges Profil');
}
