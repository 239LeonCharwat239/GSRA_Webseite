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
    const socialLinksEditor = document.getElementById("socialLinksEditor");
    const addSocialLinkBtn = document.getElementById("addSocialLinkBtn");
    const editUsername = document.getElementById("editUsername");
    const editBio = document.getElementById("editBio");
    const profileForm = document.getElementById("profileForm");
    const friendRequestForm = document.getElementById("friendRequestForm");
    const friendUsernameInput = document.getElementById("friendUsernameInput");
    const friendsListContainer = document.getElementById("friendsListContainer");

    let currentUser = null;

    try {
        const { data: { session }, error } = await client.auth.getSession();
        // Nicht angemeldet: Den Anmelde-Hinweis über der Seite zeigt auth-nav.js
        if (error || !session || !session.user) return;

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

        // Benutzername: einmal im Monat änderbar (die Datenbank prüft das zusätzlich)
        const usernameHint = document.querySelector("#usernameHint span");
        const nextNameChange = profile?.username_changed_at ? new Date(new Date(profile.username_changed_at).getTime() + 30 * 86400000) : null;
        if (nextNameChange && nextNameChange > new Date() && profile?.role !== "admin") {
            if (editUsername) editUsername.readOnly = true;
            if (usernameHint) usernameHint.textContent = `Du hast deinen Namen kürzlich geändert – die nächste Änderung ist ab dem ${nextNameChange.toLocaleDateString("de-DE")} möglich.`;
        }
        const showAvatar = (url) => {
            if (!dashAvatar) return;
            if (!url) {
                dashAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';
                return;
            }
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

        // Profil aktualisieren (Rolle und GSRA-ID schützt die Datenbank); fehlt es noch, wird es angelegt
        const saveProfile = async (changes) => {
            let { data: updatedRows, error: saveErr } = await client.from("profiles").update(changes).eq("id", currentUser.id).select("id");
            if (!saveErr && (!updatedRows || updatedRows.length === 0)) {
                ({ error: saveErr } = await client.from("profiles").upsert({ id: currentUser.id, username, ...changes }));
            }
            return saveErr;
        };

        // Profilbild: Klick öffnet Hochladen / Ändern / Löschen / Vergrößern – Drag & Drop eines Bildes ändert es direkt
        const uploadAvatar = async (file) => {
            if (!file) return;
            if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
                showToast("Bitte wähle ein Bild (PNG, JPG, WebP oder GIF).", "error");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showToast("Das Bild darf höchstens 5 MB groß sein.", "error");
                return;
            }
            const fileExt = (file.name.split(".").pop() || "png").toLowerCase();
            // Eigener Ordner je Nutzer (avatars/<Nutzer-ID>/…) – nur dort darf man selbst hochladen
            const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
            dashAvatar.classList.add("loading");
            const { error: uploadErr } = await client.storage.from("avatars").upload(fileName, file, { contentType: file.type });
            if (uploadErr) {
                dashAvatar.classList.remove("loading");
                showToast("Das Profilbild konnte nicht hochgeladen werden: " + uploadErr.message, "error");
                return;
            }
            const { data: pubData } = client.storage.from("avatars").getPublicUrl(fileName);
            const saveErr = await saveProfile({ avatar_url: pubData.publicUrl });
            dashAvatar.classList.remove("loading");
            if (saveErr) {
                showToast("Das Profilbild konnte nicht gespeichert werden.", "error");
                return;
            }
            profile = { ...(profile || {}), avatar_url: pubData.publicUrl };
            showAvatar(pubData.publicUrl);
            showToast("Dein Profilbild wurde aktualisiert.", "success");
        };

        const deleteAvatar = async () => {
            const confirmed = await showDialog({
                icon: "fa-trash",
                title: "Profilbild löschen?",
                message: "Statt deines Bildes erscheint dann wieder das Standard-Symbol.",
                confirmText: "Löschen",
                cancelText: "Abbrechen",
                danger: true
            });
            if (!confirmed) return;
            const oldUrl = profile?.avatar_url;
            const saveErr = await saveProfile({ avatar_url: null });
            if (saveErr) {
                showToast("Das Profilbild konnte nicht gelöscht werden.", "error");
                return;
            }
            // Datei im eigenen Ordner ebenfalls entfernen
            const path = oldUrl && oldUrl.split("/avatars/")[1];
            if (path && path.startsWith(`${currentUser.id}/`)) client.storage.from("avatars").remove([decodeURIComponent(path)]).catch(() => {});
            profile = { ...(profile || {}), avatar_url: null };
            showAvatar(null);
            showToast("Dein Profilbild wurde gelöscht.", "success");
        };

        if (dashAvatar && editAvatarFile) {
            editAvatarFile.addEventListener("change", () => {
                uploadAvatar(editAvatarFile.files[0]);
                editAvatarFile.value = "";
            });
            dashAvatar.addEventListener("click", () => {
                const hasAvatar = Boolean(profile?.avatar_url);
                const items = [];
                if (hasAvatar) items.push({ icon: "fa-expand", text: "Vergrößern", onClick: () => showImageLightbox(profile.avatar_url) });
                items.push({ icon: "fa-upload", text: hasAvatar ? "Bild ändern" : "Bild hochladen", onClick: () => editAvatarFile.click() });
                if (hasAvatar) items.push({ icon: "fa-trash", text: "Bild löschen", danger: true, onClick: deleteAvatar });
                showActionMenu(dashAvatar, items);
            });
            const wrap = dashAvatar.parentElement;
            wrap.addEventListener("dragover", (e) => {
                if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
                e.preventDefault();
                wrap.classList.add("drop-target");
            });
            wrap.addEventListener("dragleave", () => wrap.classList.remove("drop-target"));
            wrap.addEventListener("drop", (e) => {
                e.preventDefault();
                wrap.classList.remove("drop-target");
                uploadAvatar(e.dataTransfer?.files?.[0]);
            });
        }

        // Social-Media-Links: je Link ein eigenes Feld, das Logo der Plattform erscheint automatisch
        const addSocialRow = (value = "") => {
            if (!socialLinksEditor || socialLinksEditor.children.length >= 8) return;
            const row = document.createElement("div");
            row.className = "dash-social-row";
            row.innerHTML = `
                <span class="dash-social-icon"></span>
                <input type="text" inputmode="url" maxlength="300" placeholder="z. B. youtube.com/@deinkanal">
                <button type="button" class="dash-social-remove" title="Link entfernen"><i class="fa-solid fa-xmark"></i></button>`;
            const input = row.querySelector("input");
            const icon = row.querySelector(".dash-social-icon");
            const syncIcon = () => {
                const link = normalizeSocialUrl(input.value);
                const platform = link ? socialPlatformOf(link) : { icon: "fa-solid fa-link", color: "#a0a5b1" };
                icon.innerHTML = socialIconHtml(platform);
                icon.style.color = platform.color;
                icon.title = link ? platform.name : "";
                input.classList.remove("invalid");
            };
            input.value = value;
            input.addEventListener("input", syncIcon);
            row.querySelector(".dash-social-remove").addEventListener("click", () => {
                row.remove();
                if (addSocialLinkBtn) addSocialLinkBtn.style.display = "";
                if (socialLinksEditor.children.length === 0) addSocialRow();
            });
            syncIcon();
            socialLinksEditor.appendChild(row);
            if (addSocialLinkBtn) addSocialLinkBtn.style.display = socialLinksEditor.children.length >= 8 ? "none" : "";
            return input;
        };
        const savedLinks = Array.isArray(profile?.social_links) ? profile.social_links : [];
        savedLinks.forEach(link => addSocialRow(link));
        if (savedLinks.length === 0) addSocialRow();
        if (addSocialLinkBtn) addSocialLinkBtn.addEventListener("click", () => addSocialRow()?.focus());

        if (userContent) userContent.style.display = "block";

        // Profil speichern
        if (profileForm) {
            profileForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const newUsername = editUsername.value.trim();
                const newBio = editBio.value.trim();

                // Links prüfen: nur echte Webadressen (ohne „https://“ wird es ergänzt)
                const socialLinks = [];
                let invalidInput = null;
                (socialLinksEditor ? [...socialLinksEditor.querySelectorAll("input")] : []).forEach(input => {
                    if (!input.value.trim()) return;
                    const link = normalizeSocialUrl(input.value);
                    if (link) socialLinks.push(link);
                    else if (!invalidInput) invalidInput = input;
                });
                if (invalidInput) {
                    invalidInput.classList.add("invalid");
                    invalidInput.focus();
                    showToast("Bitte gib einen gültigen Link ein, z. B. youtube.com/@deinkanal.", "error");
                    return;
                }

                // Neuer Benutzername: vorher bestätigen, weil die nächste Änderung erst in 30 Tagen möglich ist
                if (newUsername !== username) {
                    const confirmed = await showDialog({
                        icon: "fa-signature",
                        title: "Benutzernamen ändern?",
                        message: `Dein neuer Name: „${newUsername}“\n\nDanach kannst du ihn erst in 30 Tagen wieder ändern.`,
                        confirmText: "Namen ändern",
                        cancelText: "Abbrechen"
                    });
                    if (!confirmed) return;
                }

                const changes = { username: newUsername, bio: newBio };
                let upsertErr = await saveProfile({ ...changes, social_links: socialLinks });
                // Social-Media-Links noch nicht in der Datenbank eingerichtet: Rest trotzdem speichern
                if (upsertErr && /social_links/i.test(upsertErr.message || "")) {
                    upsertErr = await saveProfile(changes);
                    if (!upsertErr) showToast("Hinweis: Social-Media-Links sind in der Datenbank noch nicht eingerichtet.", "info");
                }

                if (upsertErr) {
                    // Verständliche Hinweise der Datenbank (z. B. Name nur einmal im Monat) direkt anzeigen
                    showToast(/Benutzername/.test(upsertErr.message || "") ? upsertErr.message : "Fehler beim Speichern des Profils.", "error");
                } else {
                    showToast("Profil erfolgreich aktualisiert!", "success");
                    setTimeout(() => location.reload(), 1200);
                }
            });
        }

        // Konto löschen: Passwort bestätigen, dann endgültig löschen (die Datenbank prüft, dass das Passwort gerade eben bestätigt wurde)
        const deleteAccountBtn = document.getElementById("deleteAccountBtn");
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener("click", () => {
                const overlay = document.createElement("div");
                overlay.className = "gsra-dialog-overlay";
                overlay.innerHTML = `
                    <div class="gsra-dialog danger" role="dialog" aria-modal="true">
                        <button type="button" class="gsra-dialog-close" title="Schließen"><i class="fa-solid fa-xmark"></i></button>
                        <div class="gsra-dialog-icon"><i class="fa-solid fa-user-xmark"></i></div>
                        <h3 class="gsra-dialog-title">Konto endgültig löschen?</h3>
                        <p class="gsra-dialog-message">Gelöscht werden dein Profil, deine Chats und Nachrichten, Freundschaften, Inserate und Setups. Gruppen, die du gegründet hast, gehen an ein anderes Mitglied über. Das lässt sich nicht rückgängig machen.\n\nBitte bestätige mit deinem Passwort:</p>
                        <input type="password" class="gsra-dialog-input" autocomplete="current-password" placeholder="Dein Passwort">
                        <p class="dash-dialog-error" hidden></p>
                        <div class="gsra-dialog-actions">
                            <button type="button" class="gsra-dialog-btn secondary">Abbrechen</button>
                            <button type="button" class="gsra-dialog-btn primary">Endgültig löschen</button>
                        </div>
                    </div>`;
                const input = overlay.querySelector("input");
                const errorText = overlay.querySelector(".dash-dialog-error");
                const confirmBtn = overlay.querySelector(".gsra-dialog-btn.primary");
                const close = () => {
                    document.removeEventListener("keydown", onKey, true);
                    overlay.remove();
                };
                const onKey = (e) => {
                    if (e.key === "Escape" && !confirmBtn.disabled) {
                        e.preventDefault();
                        close();
                    } else if (e.key === "Enter" && e.target === input) {
                        e.preventDefault();
                        confirmBtn.click();
                    }
                };
                const fail = (message) => {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = "Endgültig löschen";
                    errorText.textContent = message;
                    errorText.hidden = false;
                };
                confirmBtn.addEventListener("click", async () => {
                    if (!input.value) {
                        input.classList.add("invalid");
                        input.focus();
                        return;
                    }
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Wird gelöscht …';
                    errorText.hidden = true;
                    const { error: authError } = await client.auth.signInWithPassword({ email: currentUser.email, password: input.value });
                    if (authError) {
                        input.classList.add("invalid");
                        fail("Das Passwort ist nicht korrekt.");
                        return;
                    }
                    const { error } = await client.rpc("delete_own_account");
                    if (error) {
                        fail(/could not find the function|schema cache/i.test(error.message || "")
                            ? "Das Löschen von Konten ist in der Datenbank noch nicht eingerichtet."
                            : `Das Konto konnte nicht gelöscht werden: ${error.message}`);
                        return;
                    }
                    // Profilbild im eigenen Ordner entfernen (das Konto ist bereits gelöscht)
                    const avatarPath = profile?.avatar_url && profile.avatar_url.split("/avatars/")[1];
                    if (avatarPath && avatarPath.startsWith(`${currentUser.id}/`)) {
                        await client.storage.from("avatars").remove([decodeURIComponent(avatarPath)]).catch(() => {});
                    }
                    close();
                    await client.auth.signOut().catch(() => {});
                    Object.keys(localStorage).filter(key => key.startsWith("gsra_")).forEach(key => localStorage.removeItem(key));
                    await showDialog({
                        icon: "fa-circle-check",
                        title: "Dein Konto wurde gelöscht",
                        message: "Schade, dass du gehst – du bist jederzeit wieder willkommen in der GSRA.",
                        confirmText: "Zur Startseite"
                    });
                    window.location.href = "index.html";
                });
                input.addEventListener("input", () => input.classList.remove("invalid"));
                overlay.querySelector(".gsra-dialog-btn.secondary").addEventListener("click", close);
                overlay.querySelector(".gsra-dialog-close").addEventListener("click", close);
                document.addEventListener("keydown", onKey, true);
                document.body.appendChild(overlay);
                input.focus();
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