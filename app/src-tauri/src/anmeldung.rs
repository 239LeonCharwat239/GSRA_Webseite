//! Anmeldung über die Webseite (SQL 051, Verfahren „Loopback + PKCE“ wie bei großen Desktop-Apps).
//!
//! 1. Die Oberfläche erzeugt ein Geheimnis und schickt nur dessen Prüfsumme („challenge“) und einen Zufallswert
//!    („zustand“) hierher.
//! 2. Wir warten auf 127.0.0.1 an einem freien Port (nur dieser PC) und öffnen die Seite app-verbinden.html im Browser.
//!    Die Adresse der Webseite steht fest im Programm – die Oberfläche kann keine beliebigen Seiten öffnen lassen.
//! 3. Nach der Bestätigung ruft der Browser http://127.0.0.1:<port>/gsra-anmeldung?a=<Code>&s=<zustand> auf.
//!    Nur wenn der Zufallswert stimmt, geht der Code an die Oberfläche (Ereignis „gsra://anmeldung“). So kann keine
//!    fremde Seite der App eine Anmeldung unterschieben.
//! 4. Die Oberfläche tauscht Code + Geheimnis bei der Server-Funktion „app-anmelden“ ein.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;

pub const WEBSEITE: &str = "https://gsra-webseite.vercel.app";
/// Bewusst allgemein (kein Rechnername – der kann den echten Namen enthalten)
const GERAET: &str = "GSRA-App%20(Windows)";
const WARTEZEIT: Duration = Duration::from_secs(10 * 60);

/// Nummer des laufenden Anmeldeversuchs – ein neuer Versuch beendet den alten
static LAUF: AtomicU64 = AtomicU64::new(0);

fn base64url(s: &str, min: usize, max: usize) -> bool {
    (min..=max).contains(&s.len()) && s.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
}

#[derive(Debug, PartialEq, Eq)]
pub enum Rueckruf {
    /// Gültiger Rückruf mit dem Einmal-Code
    Gueltig(String),
    /// Richtiger Pfad, aber falscher Zufallswert oder kaputter Code
    Fremd,
    /// Etwas anderes (z. B. /favicon.ico)
    Unbekannt,
}

/// Wertet die erste Zeile einer HTTP-Anfrage aus: „GET /gsra-anmeldung?a=<64 hex>&s=<zustand> HTTP/1.1“
pub fn rueckruf_lesen(anfrage: &str, zustand: &str) -> Rueckruf {
    let zeile = anfrage.lines().next().unwrap_or("");
    let mut teile = zeile.split(' ');
    let (Some("GET"), Some(ziel)) = (teile.next(), teile.next()) else { return Rueckruf::Unbekannt };
    let Some(werte) = ziel.strip_prefix("/gsra-anmeldung?") else { return Rueckruf::Unbekannt };
    let (mut a, mut s) = (None, None);
    for paar in werte.split('&') {
        match paar.split_once('=') {
            Some(("a", w)) if a.is_none() => a = Some(w),
            Some(("s", w)) if s.is_none() => s = Some(w),
            _ => {}
        }
    }
    match (a, s) {
        (Some(a), Some(s))
            if a.len() == 64
                && a.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
                && !zustand.is_empty()
                && s == zustand =>
        {
            Rueckruf::Gueltig(a.to_string())
        }
        _ => Rueckruf::Fremd,
    }
}

/// Kleine Antwortseite im Browser (ohne Skripte, darf nicht eingebettet werden)
fn antworten(mut strom: TcpStream, status: &str, titel: &str, text: &str) {
    let html = format!(
        "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>GSRA-App</title>\
         <style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b14;color:#e8edf7;font:16px/1.5 'Segoe UI',system-ui,sans-serif}}\
         main{{max-width:460px;padding:28px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:#0d1424;text-align:center}}\
         h1{{font-size:20px;margin:0 0 8px;color:#ffcc00}}</style></head><body><main><h1>{titel}</h1><p>{text}</p></main></body></html>"
    );
    let antwort = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\
         Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'\r\n\
         X-Frame-Options: DENY\r\nReferrer-Policy: no-referrer\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{html}",
        html.len()
    );
    let _ = strom.write_all(antwort.as_bytes());
    let _ = strom.flush();
}

fn warten(app: AppHandle, horcher: TcpListener, zustand: String, lauf: u64) {
    let ende = Instant::now() + WARTEZEIT;
    while Instant::now() < ende && LAUF.load(Ordering::SeqCst) == lauf {
        match horcher.accept() {
            Ok((mut strom, adresse)) => {
                if !adresse.ip().is_loopback() {
                    continue;
                }
                let _ = strom.set_nonblocking(false);
                let _ = strom.set_read_timeout(Some(Duration::from_secs(2)));
                let mut puffer = [0u8; 4096];
                let n = strom.read(&mut puffer).unwrap_or(0);
                let anfrage = String::from_utf8_lossy(&puffer[..n]).to_string();
                match rueckruf_lesen(&anfrage, &zustand) {
                    Rueckruf::Gueltig(code) => {
                        antworten(strom, "200 OK", "Fast geschafft", "Die GSRA-App meldet dich jetzt an. Du kannst diesen Tab schließen.");
                        let _ = app.emit("gsra://anmeldung", code);
                        return;
                    }
                    Rueckruf::Fremd => antworten(
                        strom,
                        "400 Bad Request",
                        "Das passt nicht",
                        "Diese Bestätigung gehört nicht zur laufenden Anmeldung der GSRA-App. Bitte starte die Anmeldung in der App neu.",
                    ),
                    Rueckruf::Unbekannt => antworten(strom, "404 Not Found", "Nicht gefunden", "Diese Adresse gibt es hier nicht."),
                }
            }
            Err(_) => std::thread::sleep(Duration::from_millis(100)),
        }
    }
    if LAUF.load(Ordering::SeqCst) == lauf {
        let _ = app.emit("gsra://anmeldung-ende", "abgelaufen");
    }
}

/// Startet die Anmeldung: wartet auf 127.0.0.1 und öffnet die Bestätigungsseite im Standard-Browser
#[tauri::command]
pub fn anmeldung_starten(app: AppHandle, challenge: String, zustand: String) -> Result<(), String> {
    if !base64url(&challenge, 43, 43) || !base64url(&zustand, 22, 64) {
        return Err("Ungültige Anfrage.".into());
    }
    let horcher = TcpListener::bind("127.0.0.1:0").map_err(|_| "Die Anmeldung konnte nicht vorbereitet werden.".to_string())?;
    let port = horcher.local_addr().map_err(|_| "Die Anmeldung konnte nicht vorbereitet werden.".to_string())?.port();
    horcher.set_nonblocking(true).map_err(|_| "Die Anmeldung konnte nicht vorbereitet werden.".to_string())?;
    let lauf = LAUF.fetch_add(1, Ordering::SeqCst) + 1;
    let adresse = format!("{WEBSEITE}/app-verbinden.html#c={challenge}&p={port}&s={zustand}&g={GERAET}");
    app.opener()
        .open_url(adresse, None::<&str>)
        .map_err(|_| "Der Browser konnte nicht geöffnet werden.".to_string())?;
    std::thread::Builder::new()
        .name("gsra-anmeldung".into())
        .spawn(move || warten(app, horcher, zustand, lauf))
        .map_err(|_| "Die Anmeldung konnte nicht vorbereitet werden.".to_string())?;
    Ok(())
}

/// Bricht eine laufende Anmeldung ab (der Port wird wieder frei)
#[tauri::command]
pub fn anmeldung_abbrechen() {
    LAUF.fetch_add(1, Ordering::SeqCst);
}

/// Adresse des Stint-Planers mit den gemessenen Werten – nur diese eine Seite der GSRA-Webseite und nur
/// base64url-Daten im Anker (kein Pfad, keine Parameter, keine fremde Adresse aus der Oberfläche)
pub fn stint_adresse(messwerte: &str) -> Option<String> {
    base64url(messwerte, 8, 2000).then(|| format!("{WEBSEITE}/stintplaner.html#messwerte={messwerte}"))
}

/// Öffnet den Stint-Planer im GSRA-Fenster der App; der Planer fragt vor dem Übernehmen nach
#[tauri::command]
pub fn stintplaner_oeffnen(app: AppHandle, messwerte: String) -> Result<(), String> {
    let adresse = stint_adresse(&messwerte).ok_or_else(|| "Ungültige Messwerte.".to_string())?;
    crate::webseite::zeigen(&app, &adresse)
}

#[cfg(test)]
mod tests {
    use super::*;

    const Z: &str = "AbCdEfGhIjKlMnOpQrStUv";
    fn code() -> String {
        "0123456789abcdef".repeat(4)
    }

    #[test]
    fn gueltiger_rueckruf() {
        let a = format!("GET /gsra-anmeldung?a={}&s={Z} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n", code());
        assert_eq!(rueckruf_lesen(&a, Z), Rueckruf::Gueltig(code()));
    }

    #[test]
    fn falscher_zustand_oder_code_wird_abgelehnt() {
        let falsch = format!("GET /gsra-anmeldung?a={}&s=Fremd1234567890123456789 HTTP/1.1\r\n", code());
        assert_eq!(rueckruf_lesen(&falsch, Z), Rueckruf::Fremd);
        let gross = format!("GET /gsra-anmeldung?a={}&s={Z} HTTP/1.1\r\n", code().to_uppercase());
        assert_eq!(rueckruf_lesen(&gross, Z), Rueckruf::Fremd);
        let kurz = format!("GET /gsra-anmeldung?a=abc&s={Z} HTTP/1.1\r\n");
        assert_eq!(rueckruf_lesen(&kurz, Z), Rueckruf::Fremd);
        let ohne = "GET /gsra-anmeldung?s=x HTTP/1.1\r\n";
        assert_eq!(rueckruf_lesen(ohne, Z), Rueckruf::Fremd);
        // doppelte Werte: der erste zählt (kein Überschreiben durch angehängte Parameter)
        let doppelt = format!("GET /gsra-anmeldung?a={}&s=falsch&s={Z} HTTP/1.1\r\n", code());
        assert_eq!(rueckruf_lesen(&doppelt, Z), Rueckruf::Fremd);
        // leerer erwarteter Zustand passt nie
        let leer = format!("GET /gsra-anmeldung?a={}&s= HTTP/1.1\r\n", code());
        assert_eq!(rueckruf_lesen(&leer, ""), Rueckruf::Fremd);
    }

    #[test]
    fn andere_anfragen() {
        assert_eq!(rueckruf_lesen("GET /favicon.ico HTTP/1.1\r\n", Z), Rueckruf::Unbekannt);
        assert_eq!(rueckruf_lesen(&format!("POST /gsra-anmeldung?a={}&s={Z} HTTP/1.1\r\n", code()), Z), Rueckruf::Unbekannt);
        assert_eq!(rueckruf_lesen("", Z), Rueckruf::Unbekannt);
        assert_eq!(rueckruf_lesen("\u{0}\u{1}Müll", Z), Rueckruf::Unbekannt);
    }

    #[test]
    fn formate_der_app() {
        assert!(base64url(&"a".repeat(43), 43, 43));
        assert!(!base64url(&"a".repeat(42), 43, 43));
        assert!(!base64url("abc/def+ghi=jklmnopqrstuvwxyz0123456789abcd", 43, 43));
        assert!(base64url(Z, 22, 64));
    }

    #[test]
    fn stintplaner_nur_mit_sauberen_messwerten() {
        let gut = "eyJ2IjoxLCJyeiI6ODcuNH0";
        assert_eq!(stint_adresse(gut).as_deref(), Some("https://gsra-webseite.vercel.app/stintplaner.html#messwerte=eyJ2IjoxLCJyeiI6ODcuNH0"));
        assert_eq!(stint_adresse("abc"), None); // zu kurz
        assert_eq!(stint_adresse(&"a".repeat(2001)), None); // zu lang
        assert_eq!(stint_adresse("eyJ2IjoxfQ&x=https://boese.example"), None);
        assert_eq!(stint_adresse("eyJ2IjoxfQ#<script>"), None);
        assert_eq!(stint_adresse("../../anderes"), None);
    }
}
