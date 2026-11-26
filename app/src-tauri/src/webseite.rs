//! Die GSRA-Webseite in der App (Wunsch 26.11.): Messenger, Kalender, Coaching, Setups, Stint-Planer … öffnen sich
//! in einem eigenen App-Fenster „GSRA“.
//!
//! Sicherheit:
//! * Das Fenster hat KEINE App-Rechte: Die Berechtigungen (capabilities/default.json) gelten nur für das Hauptfenster
//!   „main“, und Fremd-Inhalte bekommen ohnehin keinen Zugang zu den App-Befehlen.
//! * Es lädt nur Seiten der GSRA-Webseite (https, feste Adresse). Alles andere – YouTube, Discord, Bezahlseiten,
//!   fremde Links – öffnet sich im normalen Browser des PCs, nicht in der App.
//! * Neue Fenster (window.open, target=_blank) entstehen nicht: GSRA-Seiten öffnen sich im selben Fenster,
//!   alles andere im Browser.
//! * Die App öffnet nur Seiten aus einer festen Liste – die Oberfläche kann keine beliebige Adresse übergeben.

use crate::anmeldung::WEBSEITE;
use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const FENSTER: &str = "webseite";

/// Seiten, die die App öffnen darf (Dateinamen der Webseite)
const SEITEN: &[&str] = &[
    "index.html",
    "messenger.html",
    "kalender.html",
    "coaching.html",
    "setups.html",
    "marktplatz.html",
    "liveries.html",
    "videos.html",
    "nachschlagewerk.html",
    "renningenieur.html",
    "stintplaner.html",
    "dashboard.html",
    "abo.html",
    "hilfe.html",
    "datenschutz.html",
    "impressum.html",
];

/// Adresse einer erlaubten Seite (None = nicht in der Liste)
pub fn adresse(seite: &str) -> Option<String> {
    SEITEN.contains(&seite).then(|| format!("{WEBSEITE}/{seite}"))
}

/// Darf das GSRA-Fenster diese Adresse laden? Nur https und nur die GSRA-Webseite selbst.
pub fn erlaubt(url: &Url) -> bool {
    let basis = WEBSEITE.trim_start_matches("https://");
    url.scheme() == "https" && url.host_str() == Some(basis) && url.port().is_none()
}

/// Öffnet (oder holt nach vorn) das GSRA-Fenster mit der gewünschten Seite
#[tauri::command]
pub fn webseite_oeffnen(app: AppHandle, seite: String) -> Result<(), String> {
    let adresse = adresse(&seite).ok_or_else(|| "Diese Seite gibt es in der App nicht.".to_string())?;
    zeigen(&app, &adresse)
}

/// Zeigt eine (bereits geprüfte) GSRA-Adresse im GSRA-Fenster
pub fn zeigen(app: &AppHandle, adresse: &str) -> Result<(), String> {
    let url: Url = adresse.parse().map_err(|_| "Ungültige Adresse.".to_string())?;
    if !erlaubt(&url) {
        return Err("Ungültige Adresse.".to_string());
    }
    if let Some(fenster) = app.get_webview_window(FENSTER) {
        fenster.navigate(url).map_err(|_| "Die Seite konnte nicht geöffnet werden.".to_string())?;
        let _ = fenster.unminimize();
        let _ = fenster.set_focus();
        return Ok(());
    }
    let extern_nav = app.clone();
    let extern_neu = app.clone();
    let selbst = app.clone();
    WebviewWindowBuilder::new(app, FENSTER, WebviewUrl::External(url))
        .title("GSRA")
        .inner_size(1280.0, 860.0)
        .min_inner_size(420.0, 520.0)
        .on_navigation(move |ziel| {
            if erlaubt(ziel) {
                return true;
            }
            // fremde Seite: im normalen Browser öffnen, in der App nicht
            if ziel.scheme() == "https" || ziel.scheme() == "http" || ziel.scheme() == "mailto" {
                let _ = extern_nav.opener().open_url(ziel.as_str(), None::<&str>);
            }
            false
        })
        .on_new_window(move |ziel, _merkmale| {
            if erlaubt(&ziel) {
                // GSRA-Seite: im selben Fenster statt in einem neuen
                if let Some(f) = selbst.get_webview_window(FENSTER) {
                    let _ = f.navigate(ziel);
                }
            } else if ziel.scheme() == "https" || ziel.scheme() == "http" {
                let _ = extern_neu.opener().open_url(ziel.as_str(), None::<&str>);
            }
            NewWindowResponse::Deny
        })
        .build()
        .map(|_| ())
        .map_err(|_| "Das GSRA-Fenster konnte nicht geöffnet werden.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nur_seiten_aus_der_liste() {
        assert_eq!(adresse("messenger.html").as_deref(), Some("https://gsra-webseite.vercel.app/messenger.html"));
        assert_eq!(adresse("admin.html"), None, "Admin-Bereich nicht über die App");
        assert_eq!(adresse("../etc/passwd"), None);
        assert_eq!(adresse("https://boese.example"), None);
        assert_eq!(adresse("messenger.html?x=1"), None);
    }

    #[test]
    fn fenster_laedt_nur_die_gsra_webseite() {
        let u = |s: &str| s.parse::<Url>().unwrap();
        assert!(erlaubt(&u("https://gsra-webseite.vercel.app/messenger.html")));
        assert!(erlaubt(&u("https://gsra-webseite.vercel.app/stintplaner.html#messwerte=abc")));
        assert!(!erlaubt(&u("http://gsra-webseite.vercel.app/")), "nur https");
        assert!(!erlaubt(&u("https://gsra-webseite.vercel.app.boese.example/")), "keine ähnlichen Namen");
        assert!(!erlaubt(&u("https://boese.example/?gsra-webseite.vercel.app")));
        assert!(!erlaubt(&u("https://gsra-webseite.vercel.app:8443/")), "kein fremder Port");
        assert!(!erlaubt(&u("https://checkout.stripe.com/pay")), "Bezahlen im normalen Browser");
        assert!(!erlaubt(&u("javascript:alert(1)")));
        assert!(!erlaubt(&u("file:///C:/Windows/")));
    }
}
