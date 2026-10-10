/* =========================================
   GSRA - Dashboard Steuerung (Supabase)
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
    const client = window.supabaseClient || window.supabase;

    if (!client) {
        console.error("Supabase Client nicht gefunden!");
        return;
    }

    const userContent = document.getElementById("userContent");
    const dashUsername = document.getElementById("dashUsername");
    const dashEmail = document.getElementById("dashEmail");
    const dashCreated = document.getElementById("dashCreated");

    try {
        // Aktuellen Benutzer abfragen
        const { data: { session }, error } = await client.auth.getSession();

        if (error) {
            console.error("Fehler beim Abrufen der Session:", error.message);
            window.location.href = "login.html";
            return;
        }

        // Falls nicht eingeloggt: Sofort zur Login-Seite leiten
        if (!session || !session.user) {
            window.location.href = "login.html";
            return;
        }

        const user = session.user;

        // 1. E-Mail-Adresse setzen
        if (dashEmail) {
            dashEmail.textContent = user.email || "K. A.";
        }

        // 2. Erstellungsdatum setzen
        if (dashCreated) {
            if (user.created_at) {
                const date = new Date(user.created_at);
                dashCreated.textContent = date.toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                });
            } else {
                dashCreated.textContent = "Unbekannt";
            }
        }

        // 3. Benutzernamen ermitteln
        if (dashUsername) {
            let username = user.user_metadata?.username || user.user_metadata?.full_name || user.user_metadata?.display_name;

            if (!username) {
                const { data: profile } = await client
                    .from("profiles")
                    .select("username")
                    .eq("id", user.id)
                    .maybeSingle();

                if (profile && profile.username) {
                    username = profile.username;
                }
            }

            if (!username && user.email) {
                username = user.email.split("@")[0];
            }

            dashUsername.textContent = username || "Fahrer";
        }

        // ERST JETZT DAS DASHBOARD EINSCHALTEN, WENN DER LOGIN BESTÄTIGT IST
        if (userContent) {
            userContent.style.display = "block";
        }

    } catch (err) {
        console.error("Unerwarteter Fehler beim Laden der Dashboard-Daten:", err);
        window.location.href = "login.html";
    }
});