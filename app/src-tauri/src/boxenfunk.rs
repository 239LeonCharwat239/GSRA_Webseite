// Boxenstopp per Zuruf (Wunsch 28./29.11.): „Box: 20 Liter, vier neue Reifen, kein Fast Repair“ stellt die App direkt
// in iRacing ein – über die offizielle Broadcast-Nachricht des iRacing-SDK („IRSDK_BROADCASTMSG“, Befehl PitCommand),
// genau wie die Box-Befehle im iRacing-Chat (#fuel, #-fr …). Die App schickt nur Befehle aus einer festen Liste;
// Mengen und Drücke werden begrenzt. Was der Fahrer sagt, übersetzt die Oberfläche (boxenfunk.ts) in diese Befehle.

use serde::Deserialize;

/// irsdk_BroadcastMsg: PitCommand
const PIT_COMMAND: u16 = 9;

/// irsdk_PitCommandMode – nur diese Befehle sind erlaubt
pub fn befehl_nummer(art: &str) -> Option<u16> {
    Some(match art {
        "alles_loeschen" => 0, // alle Box-Häkchen aus
        "scheibe" => 1,        // Abreißfolie
        "tanken" => 2,         // Wert = Liter (0 = bisherige Menge)
        "reifen_vl" => 3,      // Wert = Druck in kPa (0 = Druck behalten)
        "reifen_vr" => 4,
        "reifen_hl" => 5,
        "reifen_hr" => 6,
        "keine_reifen" => 7,
        "fast_repair" => 8,
        "keine_scheibe" => 9,
        "kein_fast_repair" => 10,
        "nicht_tanken" => 11,
        _ => return None,
    })
}

#[derive(Debug, Deserialize)]
pub struct BoxBefehl {
    pub art: String,
    #[serde(default)]
    pub wert: Option<f64>,
}

/// Prüft einen Befehl: bekannte Art, Wert nur wo er Sinn hat und in Grenzen (Sprit 0–300 Liter, Druck 0 oder 100–400 kPa)
pub fn pruefen(b: &BoxBefehl) -> Result<(u16, i32), String> {
    let nr = befehl_nummer(&b.art).ok_or_else(|| "Unbekannter Box-Befehl".to_string())?;
    let wert = match (nr, b.wert) {
        (2, Some(l)) if l.is_finite() && (0.0..=300.0).contains(&l) => l.round() as i32,
        (2, None) => 0,
        (2, _) => return Err("Spritmenge muss zwischen 0 und 300 Litern liegen".into()),
        (3..=6, Some(k)) if k.is_finite() && (k == 0.0 || (100.0..=400.0).contains(&k)) => k.round() as i32,
        (3..=6, None) => 0,
        (3..=6, _) => return Err("Reifendruck außerhalb der Grenzen".into()),
        (_, _) => 0,
    };
    Ok((nr, wert))
}

#[tauri::command]
pub fn box_befehle(befehle: Vec<BoxBefehl>) -> Result<usize, String> {
    if befehle.is_empty() || befehle.len() > 12 {
        return Err("1 bis 12 Box-Befehle".into());
    }
    // erst alles prüfen, dann senden (kein halber Boxenstopp)
    let geprueft = befehle.iter().map(pruefen).collect::<Result<Vec<_>, _>>()?;
    for (nr, wert) in &geprueft {
        senden(*nr, *wert)?;
    }
    Ok(geprueft.len())
}

#[cfg(windows)]
fn senden(befehl: u16, wert: i32) -> Result<(), String> {
    use windows::core::w;
    use windows::Win32::Foundation::{LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{RegisterWindowMessageW, SendNotifyMessageW, HWND_BROADCAST};
    // MAKELONG(PitCommand, Befehl) als wParam, Wert als lParam – wie irsdk_broadcastMsg im iRacing-SDK
    let nachricht = unsafe { RegisterWindowMessageW(w!("IRSDK_BROADCASTMSG")) };
    if nachricht == 0 {
        return Err("iRacing-Nachricht nicht verfügbar".into());
    }
    let wparam = WPARAM((PIT_COMMAND as usize) | ((befehl as usize) << 16));
    unsafe { SendNotifyMessageW(HWND_BROADCAST, nachricht, wparam, LPARAM(wert as isize)) }.map_err(|e| format!("Box-Befehl nicht gesendet: {}", e.message()))
}

#[cfg(not(windows))]
fn senden(_: u16, _: i32) -> Result<(), String> {
    Err("Nur unter Windows".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn b(art: &str, wert: Option<f64>) -> BoxBefehl {
        BoxBefehl { art: art.into(), wert }
    }

    #[test]
    fn nur_bekannte_befehle_mit_grenzen() {
        assert_eq!(pruefen(&b("tanken", Some(20.4))), Ok((2, 20)));
        assert_eq!(pruefen(&b("tanken", None)), Ok((2, 0)));
        assert!(pruefen(&b("tanken", Some(-5.0))).is_err());
        assert!(pruefen(&b("tanken", Some(9999.0))).is_err());
        assert!(pruefen(&b("tanken", Some(f64::NAN))).is_err());
        assert_eq!(pruefen(&b("reifen_vl", None)), Ok((3, 0)));
        assert_eq!(pruefen(&b("reifen_hr", Some(170.0))), Ok((6, 170)));
        assert!(pruefen(&b("reifen_hr", Some(50.0))).is_err());
        assert_eq!(pruefen(&b("kein_fast_repair", Some(5.0))), Ok((10, 0)), "Wert wird ignoriert");
        assert!(pruefen(&b("format c:", None)).is_err());
        assert!(pruefen(&b("", None)).is_err());
    }

    #[test]
    fn zu_viele_oder_keine_befehle() {
        assert!(box_befehle(vec![]).is_err());
        assert!(box_befehle((0..13).map(|_| b("scheibe", None)).collect()).is_err());
        // ein ungültiger Befehl: nichts wird gesendet
        assert!(box_befehle(vec![b("tanken", Some(10.0)), b("hack", None)]).is_err());
    }
}
