//! Die GSRA-Webseite DIREKT in der App (Wunsch 26.11.: „nicht weiterleiten – alle Funktionen in der App“).
//!
//! Messenger, Kalender, Setups, Marktplatz … laufen als eingebettete Bereiche im Hauptfenster: Jede Seite bekommt
//! eine eigene eingebettete Ansicht („web-messenger“ …), die passgenau über der Inhaltsfläche der App liegt
//! (Lage und Größe meldet die Oberfläche). So bleibt z. B. der Messenger offen, während man zur Telemetrie wechselt.
//!
//! Sicherheit:
//! * Die eingebetteten Seiten haben KEINE App-Rechte: Die Berechtigungen (capabilities/default.json) gelten nur für
//!   den eigenen Inhalt der App; Tauri lehnt Befehle von fremden Adressen ab. Ereignisse der App (Messwerte,
//!   Fahrernamen, Anmelde-Code) gehen nur an das Hauptfenster („main“), nie an die Webseite.
//! * Geladen wird nur, was `ziel()` erlaubt: die GSRA-Webseite (https), zum Bezahlen die Seiten des
//!   Zahlungsdienstleisters (*.stripe.com, die Adresse zeigt die App oben an) und Dateien aus dem GSRA-Speicher.
//!   Alles andere (Videos, fremde Links, E-Mail) öffnet sich im normalen Browser; javascript:, file:, data: … nie.
//! * Neue Fenster entstehen nicht: Erlaubtes öffnet sich im selben Bereich, anderes im normalen Browser.
//! * Seiten nur aus einer festen Liste; der Stint-Planer bekommt Messwerte nur als geprüften Anker (base64url).

use crate::anmeldung::{stint_anker, WEBSEITE};
use std::sync::Mutex;
use tauri::webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Rect, State, Url, WebviewUrl};
use tauri_plugin_opener::OpenerExt;

const SUPABASE_HOST: &str = "mqqyvpmddaastacldbyy.supabase.co";
/// Höchstens so viele Bereiche bleiben gleichzeitig geöffnet (der Messenger zählt nicht mit und bleibt offen)
const OFFEN_MAX: usize = 4;

/// Seiten, die als Bereich in der App erscheinen (Dateinamen der Webseite)
pub const SEITEN: &[&str] = &[
    "index.html",
    "messenger.html",
    "kalender.html",
    "videos.html",
    "setups.html",
    "stintplaner.html",
    "liveries.html",
    "marktplatz.html",
    "coaching.html",
    "nachschlagewerk.html",
    "hilfe.html",
    "dashboard.html",
    "renningenieur.html",
    "abo.html",
];

#[derive(Debug, PartialEq, Eq)]
pub enum Ziel {
    /// Bleibt in der App
    Innen,
    /// Öffnet sich im normalen Browser
    Extern,
    /// Wird nie geöffnet
    Gesperrt,
}

fn gsra_host() -> &'static str {
    WEBSEITE.trim_start_matches("https://")
}

/// Wohin gehört diese Adresse?
pub fn ziel(url: &Url) -> Ziel {
    match url.scheme() {
        "https" => {
            let host = url.host_str().unwrap_or("");
            if url.port().is_some() {
                Ziel::Extern
            } else if host == gsra_host() {
                Ziel::Innen
            } else if host == "stripe.com" || host.ends_with(".stripe.com") {
                Ziel::Innen // Bezahlen, Rechnungen, Auszahlungen für Coaches – in der App, Adresse sichtbar
            } else if host == SUPABASE_HOST && url.path().starts_with("/storage/v1/object/") {
                Ziel::Innen // Dateien der GSRA (Anhänge, Setups) – herunterladen statt Browser
            } else {
                Ziel::Extern
            }
        }
        "http" | "mailto" => Ziel::Extern,
        // Downloads, die die Webseite selbst erzeugt (blob:https://gsra-webseite.vercel.app/…)
        "blob" if url.path().starts_with(&format!("{WEBSEITE}/")) => Ziel::Innen,
        "about" if url.as_str() == "about:blank" => Ziel::Innen,
        _ => Ziel::Gesperrt,
    }
}

/// Adresse eines Bereichs (None = nicht in der Liste oder ungültiger Anker)
pub fn adresse(seite: &str, anker: Option<&str>) -> Option<String> {
    if !SEITEN.contains(&seite) {
        return None;
    }
    match anker {
        None => Some(format!("{WEBSEITE}/{seite}")),
        Some(a) if seite == "stintplaner.html" => stint_anker(a).map(|a| format!("{WEBSEITE}/{seite}#{a}")),
        Some(_) => None,
    }
}

fn kennung(seite: &str) -> String {
    format!("web-{}", seite.trim_end_matches(".html"))
}

fn grenzen(x: f64, y: f64, breite: f64, hoehe: f64) -> Result<Rect, String> {
    let ok = |v: f64| v.is_finite() && (0.0..=20_000.0).contains(&v);
    if !(ok(x) && ok(y) && ok(breite) && ok(hoehe)) || breite < 50.0 || hoehe < 50.0 {
        return Err("Ungültige Fläche.".into());
    }
    Ok(Rect { position: LogicalPosition::new(x, y).into(), size: LogicalSize::new(breite, hoehe).into() })
}

/// Zuletzt benutzte Bereiche (vorn = zuletzt)
#[derive(Default)]
pub struct Bereiche {
    zuletzt: Mutex<Vec<String>>,
    /// Bereich, der gerade sichtbar sein soll (None = Telemetrie oder Dialog)
    aktiv: Mutex<Option<String>>,
    /// Bereiche, deren erste Seite fertig geladen ist – vorher bleiben sie versteckt (kein weißer Bildschirm)
    geladen: Mutex<std::collections::HashSet<String>>,
}

/// Erst zeigen, wenn die Seite fertig ist UND der Bereich noch gewünscht ist
fn zeigen_wenn_bereit(app: &AppHandle, label: &str) {
    let b = app.state::<Bereiche>();
    let bereit = b.geladen.lock().map(|g| g.contains(label)).unwrap_or(false);
    let gewuenscht = b.aktiv.lock().map(|a| a.as_deref() == Some(label)).unwrap_or(false);
    if let Some(w) = app.get_webview(label) {
        if bereit && gewuenscht {
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

#[derive(Clone, serde::Serialize)]
struct Ort {
    seite: String,
    host: String,
    gsra: bool,
    laedt: bool,
}

fn web_ansichten(app: &AppHandle) -> Vec<tauri::Webview> {
    app.webviews().into_values().filter(|w| w.label().starts_with("web-")).collect()
}

/// Zeigt einen Bereich an der gemeldeten Stelle (legt ihn beim ersten Mal an)
#[tauri::command]
pub async fn bereich_zeigen(
    app: AppHandle,
    bereiche: State<'_, Bereiche>,
    seite: String,
    anker: Option<String>,
    x: f64,
    y: f64,
    breite: f64,
    hoehe: f64,
) -> Result<(), String> {
    let adresse = adresse(&seite, anker.as_deref()).ok_or_else(|| "Diese Seite gibt es in der App nicht.".to_string())?;
    let url: Url = adresse.parse().map_err(|_| "Ungültige Adresse.".to_string())?;
    let flaeche = grenzen(x, y, breite, hoehe)?;
    let label = kennung(&seite);

    for w in web_ansichten(&app) {
        if w.label() != label {
            let _ = w.hide();
        }
    }
    *bereiche.aktiv.lock().map_err(|_| "Interner Fehler.".to_string())? = Some(label.clone());
    if let Some(w) = app.get_webview(&label) {
        w.set_bounds(flaeche).map_err(|_| "Die Seite konnte nicht angezeigt werden.".to_string())?;
        if anker.is_some() {
            w.navigate(url).map_err(|_| "Die Seite konnte nicht geöffnet werden.".to_string())?;
        }
        zeigen_wenn_bereit(&app, &label);
    } else {
        let fenster = app.get_window("main").ok_or_else(|| "Hauptfenster fehlt.".to_string())?;
        let a_nav = app.clone();
        let a_neu = app.clone();
        let a_laden = app.clone();
        let l_neu = label.clone();
        let s_laden = seite.clone();
        let bauplan = WebviewBuilder::new(&label, WebviewUrl::External(url))
            .on_navigation(move |ziel_url| match ziel(ziel_url) {
                Ziel::Innen => true,
                Ziel::Extern => {
                    let _ = a_nav.opener().open_url(ziel_url.as_str(), None::<&str>);
                    false
                }
                Ziel::Gesperrt => false,
            })
            .on_new_window(move |ziel_url, _merkmale| {
                match ziel(&ziel_url) {
                    Ziel::Innen => {
                        if let Some(w) = a_neu.get_webview(&l_neu) {
                            let _ = w.navigate(ziel_url);
                        }
                    }
                    Ziel::Extern => {
                        let _ = a_neu.opener().open_url(ziel_url.as_str(), None::<&str>);
                    }
                    Ziel::Gesperrt => {}
                }
                NewWindowResponse::Deny
            })
            .on_page_load(move |w, daten| {
                let u = daten.url();
                let fertig = matches!(daten.event(), PageLoadEvent::Finished);
                let ort = Ort {
                    seite: s_laden.clone(),
                    host: u.host_str().unwrap_or("").to_string(),
                    gsra: u.scheme() == "https" && u.host_str() == Some(gsra_host()),
                    laedt: !fertig,
                };
                // nur an die App selbst, nie an eingebettete Seiten
                let _ = a_laden.emit_to("main", "gsra://web", ort);
                if fertig {
                    if let Ok(mut g) = a_laden.state::<Bereiche>().geladen.lock() {
                        g.insert(w.label().to_string());
                    }
                    zeigen_wenn_bereit(&a_laden, w.label());
                }
            })
            // Grund in GSRA-Schwarz statt Weiß, solange noch nichts gezeichnet ist
            .background_color(tauri::window::Color(11, 12, 16, 255));
        let neu = fenster
            .add_child(bauplan, flaeche.position, flaeche.size)
            .map_err(|_| "Die Seite konnte nicht geöffnet werden.".to_string())?;
        // Versteckt, bis die erste Seite fertig ist – darunter zeigt die App ihre Ladeanimation
        let _ = neu.hide();
        zeigen_wenn_bereit(&app, &label);
    }

    // Zuletzt benutzt nach vorn; zu viele offene Bereiche schließen (Messenger bleibt)
    let zu_schliessen: Vec<String> = {
        let mut liste = bereiche.zuletzt.lock().map_err(|_| "Interner Fehler.".to_string())?;
        liste.retain(|l| l != &label);
        liste.insert(0, label.clone());
        let mut weg = Vec::new();
        while liste.iter().filter(|l| l.as_str() != "web-messenger").count() > OFFEN_MAX {
            if let Some(pos) = liste.iter().rposition(|l| l.as_str() != "web-messenger" && l != &label) {
                weg.push(liste.remove(pos));
            } else {
                break;
            }
        }
        weg
    };
    for l in zu_schliessen {
        if let Ok(mut g) = bereiche.geladen.lock() {
            g.remove(&l);
        }
        if let Some(w) = app.get_webview(&l) {
            let _ = w.close();
        }
    }
    Ok(())
}

/// Neue Lage/Größe der Inhaltsfläche (Fenster verändert)
#[tauri::command]
pub async fn bereich_flaeche(app: AppHandle, x: f64, y: f64, breite: f64, hoehe: f64) -> Result<(), String> {
    let flaeche = grenzen(x, y, breite, hoehe)?;
    for w in web_ansichten(&app) {
        let _ = w.set_bounds(flaeche);
    }
    Ok(())
}

/// Alle Bereiche ausblenden (Telemetrie, Dialoge der App)
#[tauri::command]
pub async fn bereich_verbergen(app: AppHandle, bereiche: State<'_, Bereiche>) -> Result<(), String> {
    if let Ok(mut a) = bereiche.aktiv.lock() {
        *a = None;
    }
    for w in web_ansichten(&app) {
        let _ = w.hide();
    }
    Ok(())
}

/// Zurück, vor, neu laden, zur Startseite des Bereichs
#[tauri::command]
pub async fn bereich_aktion(app: AppHandle, seite: String, aktion: String) -> Result<(), String> {
    let start = adresse(&seite, None).ok_or_else(|| "Diese Seite gibt es in der App nicht.".to_string())?;
    let w = app.get_webview(&kennung(&seite)).ok_or_else(|| "Die Seite ist nicht geöffnet.".to_string())?;
    let ergebnis = match aktion.as_str() {
        "zurueck" => w.eval("history.back()"),
        "vor" => w.eval("history.forward()"),
        "neu" => w.reload(),
        "anfang" => w.navigate(start.parse().map_err(|_| "Ungültige Adresse.".to_string())?),
        _ => return Err("Unbekannte Aktion.".into()),
    };
    ergebnis.map_err(|_| "Das hat nicht geklappt.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u(s: &str) -> Url {
        s.parse().unwrap()
    }

    #[test]
    fn nur_seiten_aus_der_liste() {
        assert_eq!(adresse("messenger.html", None).as_deref(), Some("https://gsra-webseite.vercel.app/messenger.html"));
        assert_eq!(adresse("admin.html", None), None, "Admin-Bereich nicht über die App");
        assert_eq!(adresse("../etc/passwd", None), None);
        assert_eq!(adresse("https://boese.example", None), None);
        assert_eq!(adresse("messenger.html?x=1", None), None);
    }

    #[test]
    fn anker_nur_fuer_den_stint_planer_und_nur_geprueft() {
        let gut = "messwerte=AbCdEfGh_-12";
        assert_eq!(
            adresse("stintplaner.html", Some(gut)).as_deref(),
            Some("https://gsra-webseite.vercel.app/stintplaner.html#messwerte=AbCdEfGh_-12")
        );
        assert_eq!(adresse("messenger.html", Some(gut)), None);
        assert_eq!(adresse("stintplaner.html", Some("messwerte=<script>")), None);
        assert_eq!(adresse("stintplaner.html", Some("x=AbCdEfGh")), None);
    }

    #[test]
    fn was_in_der_app_bleibt() {
        assert_eq!(ziel(&u("https://gsra-webseite.vercel.app/messenger.html")), Ziel::Innen);
        assert_eq!(ziel(&u("https://checkout.stripe.com/c/pay/cs_test_123")), Ziel::Innen);
        assert_eq!(ziel(&u("https://billing.stripe.com/p/session/x")), Ziel::Innen);
        assert_eq!(ziel(&u("https://mqqyvpmddaastacldbyy.supabase.co/storage/v1/object/public/setups/a.sto")), Ziel::Innen);
        assert_eq!(ziel(&u("blob:https://gsra-webseite.vercel.app/1234-5678")), Ziel::Innen);
    }

    #[test]
    fn was_in_den_browser_geht() {
        assert_eq!(ziel(&u("https://www.youtube.com/watch?v=x")), Ziel::Extern);
        assert_eq!(ziel(&u("http://gsra-webseite.vercel.app/")), Ziel::Extern, "nur https bleibt");
        assert_eq!(ziel(&u("https://gsra-webseite.vercel.app.boese.example/")), Ziel::Extern, "keine ähnlichen Namen");
        assert_eq!(ziel(&u("https://boese-stripe.com/")), Ziel::Extern, "kein ähnlicher Zahlungsname");
        assert_eq!(ziel(&u("https://stripe.com.boese.example/")), Ziel::Extern);
        assert_eq!(ziel(&u("https://gsra-webseite.vercel.app:8443/")), Ziel::Extern, "kein fremder Port");
        assert_eq!(ziel(&u("https://mqqyvpmddaastacldbyy.supabase.co/auth/v1/verify?token=x")), Ziel::Extern);
        assert_eq!(ziel(&u("https://andere.supabase.co/storage/v1/object/public/x")), Ziel::Extern);
        assert_eq!(ziel(&u("mailto:info@example.com")), Ziel::Extern);
    }

    #[test]
    fn was_nie_geoeffnet_wird() {
        assert_eq!(ziel(&u("javascript:alert(1)")), Ziel::Gesperrt);
        assert_eq!(ziel(&u("file:///C:/Windows/")), Ziel::Gesperrt);
        assert_eq!(ziel(&u("data:text/html,<script>alert(1)</script>")), Ziel::Gesperrt);
        assert_eq!(ziel(&u("blob:https://boese.example/1234")), Ziel::Gesperrt);
        assert_eq!(ziel(&u("ms-settings:privacy")), Ziel::Gesperrt);
    }

    #[test]
    fn flaeche_wird_geprueft() {
        assert!(grenzen(240.0, 64.0, 1000.0, 700.0).is_ok());
        assert!(grenzen(f64::NAN, 0.0, 100.0, 100.0).is_err());
        assert!(grenzen(-5.0, 0.0, 100.0, 100.0).is_err());
        assert!(grenzen(0.0, 0.0, 10.0, 100.0).is_err());
        assert!(grenzen(0.0, 0.0, 1e9, 100.0).is_err());
    }
}
