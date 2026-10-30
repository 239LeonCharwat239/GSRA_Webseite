/* =========================================
   GSRA - Dashboard Steuerung & Profil
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
    const client = window.supabaseClient || window.supabase;
    if (!client) return;

    const userContent = document.getElementById("userContent");
    const dashUsername = document.getElementById("dashUsername");
    const dashEmail = document.getElementById("dashEmail");
    const dashCreated = document.getElementById("dashCreated");
    const dashAvatar = document.getElementById("dashAvatar");
    const dashGsraId = document.getElementById("dashGsraId");
    const editAvatarFile = document.getElementById("editAvatarFile");
    const editAvatarName = document.getElementById("editAvatarName");
    const editUsername = document.getElementById("editUsername");
    const editBio = document.getElementById("editBio");
    const profileForm = document.getElementById("profileForm");
    const friendRequestForm = document.getElementById("friendRequestForm");
    const friendUsernameInput = document.getElementById("friendUsernameInput");
    const friendsListContainer = document.getElementById("friendsListContainer");

    let currentUser = null;

    try {
        const { data: { session }, error } = await client.auth.getSession();
        if (error || !session || !session.user) {
            window.location.href = "login.html";
            return;
        }

        currentUser = session.user;
        dashEmail.textContent = currentUser.email || "";
        dashCreated.textContent = new Date(currentUser.created_at).toLocaleDateString("de-DE");

        // Profil aus Tabelle laden
        let { data: profile } = await client
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        let username = profile?.username || currentUser.user_metadata?.username || currentUser.email.split("@")[0];
        dashUsername.textContent = username;
        if (editUsername) editUsername.value = username;
        if (editBio && profile?.bio) editBio.value = profile.bio;
        const showAvatar = (url) => {
            if (!dashAvatar || !url) return;
            const img = document.createElement("img");
            img.src = url;
            img.alt = "Profilbild";
            dashAvatar.replaceChildren(img);
        };
        showAvatar(profile?.avatar_url);

        // GSRA-ID: kurze, eindeutige Nummer – per Klick kopieren
        if (dashGsraId && profile?.gsra_id) {
            dashGsraId.innerHTML = `<i class="fa-solid fa-id-badge"></i> GSRA-ID #${profile.gsra_id} <i class="fa-regular fa-copy"></i>`;
            dashGsraId.style.display = "";
            dashGsraId.addEventListener("click", () => {
                navigator.clipboard.writeText(String(profile.gsra_id)).then(
                    () => showToast("GSRA-ID kopiert.", "success"),
                    () => showToast("Kopieren nicht möglich.", "error")
                );
            });
        }

        // Ausgewähltes Profilbild sofort als Vorschau zeigen
        if (editAvatarFile) {
            editAvatarFile.addEventListener("change", () => {
                const file = editAvatarFile.files[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                    showToast("Das Bild darf höchstens 5 MB groß sein.", "error");
                    editAvatarFile.value = "";
                    return;
                }
                if (editAvatarName) editAvatarName.textContent = file.name;
                showAvatar(URL.createObjectURL(file));
            });
        }

        if (userContent) userContent.style.display = "block";

        // Profil speichern
        if (profileForm) {
            profileForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const newUsername = editUsername.value.trim();
                const newBio = editBio.value.trim();
                const avatarFile = document.getElementById("editAvatarFile").files[0];

                let avatarUrl = profile?.avatar_url || null;

                if (avatarFile) {
                    const fileExt = avatarFile.name.split('.').pop();
                    // Eigener Ordner je Nutzer (avatars/<Nutzer-ID>/…) – nur dort darf man selbst hochladen
                    const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;

                    // UPLOAD IN DEN NEUEN BUCKET: avatars
                    const { error: uploadErr } = await client.storage.from("avatars").upload(fileName, avatarFile, { contentType: avatarFile.type });
                    if (!uploadErr) {
                        const { data: pubData } = client.storage.from("avatars").getPublicUrl(fileName);
                        avatarUrl = pubData.publicUrl;
                    } else {
                        console.error("Upload Fehler:", uploadErr.message);
                        showToast("Das Profilbild konnte nicht hochgeladen werden: " + uploadErr.message, "error");
                        return;
                    }
                }

                // Profil aktualisieren (Rolle und GSRA-ID schützt die Datenbank); fehlt es noch, wird es angelegt
                const changes = { username: newUsername, bio: newBio, avatar_url: avatarUrl };
                let { data: updatedRows, error: upsertErr } = await client.from("profiles").update(changes).eq("id", currentUser.id).select("id");
                if (!upsertErr && (!updatedRows || updatedRows.length === 0)) {
                    ({ error: upsertErr } = await client.from("profiles").upsert({ id: currentUser.id, ...changes }));
                }

                if (upsertErr) {
                    showToast("Fehler beim Speichern des Profils.", "error");
                } else {
                    showToast("Profil erfolgreich aktualisiert!", "success");
                    setTimeout(() => location.reload(), 1200);
                }
            });
        }

        // Freundschaftsanfrage senden
        if (friendRequestForm) {
            friendRequestForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const targetId = friendUsernameInput.value.trim();
                if (targetId === currentUser.id) {
                    showToast("Du kannst dir nicht selbst eine Anfrage senden.", "error");
                    return;
                }

                const { error } = await client.from("friendships").insert([{
                    user_id: currentUser.id,
                    friend_id: targetId,
                    status: "pending"
                }]);

                if (error) {
                    showToast("Fehler beim Senden der Anfrage (Existiert sie bereits?).", "error");
                } else {
                    showToast("Freundschaftsanfrage gesendet!", "success");
                    friendUsernameInput.value = "";
                    loadFriends();
                }
            });
        }

        loadFriends();

    } catch (err) {
        console.error("Dashboard Fehler:", err);
    }

    async function loadFriends() {
        if (!friendsListContainer || !currentUser) return;
        const { data: friendships, error } = await client
            .from("friendships")
            .select("*")
            .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);

        if (error || !friendships || friendships.length === 0) {
            friendsListContainer.innerHTML = `<p style="font-size: 12px; color: var(--text-muted);">Keine Freunde oder Anfragen.</p>`;
            return;
        }

        friendsListContainer.innerHTML = "";
        friendships.forEach(f => {
            const isSender = f.user_id === currentUser.id;
            const otherId = isSender ? f.friend_id : f.user_id;
            const shortId = otherId.substring(0, 8);

            const div = document.createElement("div");
            div.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 12px;";
            
            let statusText = f.status === 'accepted' ? '<span style="color: #00ff88;">Freund</span>' : (isSender ? '<span style="color: var(--gsra-yellow);">Ausgehend</span>' : '<span style="color: var(--gsra-blue);">Erhalten</span>');

            div.innerHTML = `
                <span>ID: ${shortId}... (${statusText})</span>
                <div style="display: flex; gap: 5px;">
                    ${f.status === 'pending' && !isSender ? `<button class="accept-btn" style="background:#00ff88; color:#000; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;">Annehmen</button>` : ''}
                    <button class="chat-friend-btn" style="background:var(--gsra-blue); color:#fff; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;"><i class="fa-solid fa-comments"></i></button>
                </div>
            `;

            if (f.status === 'pending' && !isSender) {
                div.querySelector(".accept-btn").onclick = async () => {
                    await client.from("friendships").update({ status: 'accepted' }).eq("id", f.id);
                    loadFriends();
                };
            }

            div.querySelector(".chat-friend-btn").onclick = () => {
                window.location.href = `messenger.html?friendId=${otherId}`;
            };

            friendsListContainer.appendChild(div);
        });
    }
});