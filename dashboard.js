/* =========================================
   GSRA - Dashboard Steuerung (Supabase)
========================================= */

document.addEventListener("DOMContentLoaded", async () => {
    // Supabase-Client abrufen
    const client = window.supabase;

    if (!client) {
        console.error("Supabase Client nicht gefunden!");
        return;
    }

    // HTML-Elemente zur Anzeige der Profilinformationen
    const dashUsername = document.getElementById("dashUsername");
    const dashEmail = document.getElementById("dashEmail");
    const dashCreated = document.getElementById("dashCreated");

    try {
        // Aktuellen Benutzer abfragen
        const { data: { session }, error } = await client.auth.getSession();

        if (error) {
            console.error("Fehler beim Abrufen der Session:", error.message);
            return;
        }

        // Falls keine aktive Session existiert, Weiterleitung zum Login
        if (!session || !session.user) {
            window.location.href = "login.html";
            return;
        }

        const user = session.user;

        // 1. E-Mail-Adresse setzen
        if (dashEmail) {
            dashEmail.textContent = user.email || "K. A.";
        }

        // 2. Erstellungsdatum ("Mitglied seit") formatieren & setzen
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

        // 3. Benutzernamen ermitteln (Metadata -> Supabase Profiles Tabelle -> E-Mail Kürzel)
        if (dashUsername) {
            let username = user.user_metadata?.username || user.user_metadata?.full_name || user.user_metadata?.display_name;

            // Falls in den Metadaten kein Name liegt, optional aus einer Supabase 'profiles' Tabelle laden
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

            // Fallback: Name vor dem @-Zeichen der E-Mail verwenden
            if (!username && user.email) {
                username = user.email.split("@")[0];
            }

            dashUsername.textContent = username || "Fahrer";
        }

    } catch (err) {
        console.error("Unerwarteter Fehler beim Laden der Dashboard-Daten:", err);
    }
});