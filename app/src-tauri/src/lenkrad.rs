//! Knöpfe am Lenkrad, Button-Box oder Controller als Sprechtaste (Wunsch 26.11.).
//!
//! Windows liefert Lenkräder über die moderne Spiele-Schnittstelle nur, solange die App vorne ist – im Rennen ist
//! aber die Simulation vorne. Deshalb „Raw Input“ mit RIDEV_INPUTSINK: Windows schickt die Knopf-Daten von Joysticks,
//! Gamepads und Lenkrädern auch im Hintergrund an ein unsichtbares Nachrichtenfenster dieser App.
//!
//! Sicherheit und Datenschutz:
//! * Nur LESEN der Knöpfe (HID-Seite „Button“), keine Achsen, keine Tastatur, nichts wird gespeichert oder gesendet.
//! * Ereignisse gehen nur an das Hauptfenster. Belegt wird nur, was die Person selbst gedrückt hat („Lernen“).
//! * Gerätekennung = Hersteller-/Produktnummer (VID/PID), kein Seriennummer- oder Nutzerbezug.

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, State};

static APP: OnceLock<AppHandle> = OnceLock::new();

#[derive(Default)]
pub struct Lenkrad {
    gestartet: AtomicBool,
    lernen: AtomicBool,
    belegung: Mutex<Option<(String, u16)>>,
}

#[derive(Clone, serde::Serialize)]
struct Gelernt {
    belegung: String,
    bezeichnung: String,
}

/// „VID_0EB7&PID_0E04&MI_00#12“ → (Gerät, Knopf); nur Buchstaben, Ziffern, _ und &, Knopf 1–255
pub fn belegung_lesen(b: &str) -> Option<(String, u16)> {
    let (geraet, knopf) = b.rsplit_once('#')?;
    let knopf: u16 = knopf.parse().ok()?;
    let ok = !geraet.is_empty() && geraet.len() <= 60 && geraet.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '&');
    (ok && (1..=255).contains(&knopf)).then(|| (geraet.to_string(), knopf))
}

/// Aus dem Gerätepfad „\\?\HID#VID_0EB7&PID_0E04&MI_00#…“ die Kennung „VID_0EB7&PID_0E04&MI_00“
pub fn geraet_kennung(pfad: &str) -> String {
    let gross = pfad.to_ascii_uppercase();
    let teile: Vec<&str> = gross.split(['#', '\\']).collect();
    teile
        .iter()
        .find(|t| t.contains("VID_") && t.contains("PID_"))
        .map(|t| t.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '&').take(60).collect())
        .unwrap_or_else(|| "UNBEKANNT".to_string())
}

pub fn bezeichnung(kennung: &str, knopf: u16) -> String {
    let wert = |s: &str| kennung.split('&').find_map(|t| t.strip_prefix(s)).unwrap_or("?").to_string();
    format!("Lenkrad/Controller {}:{} – Knopf {knopf}", wert("VID_"), wert("PID_"))
}

/// Lenkrad-Knöpfe beobachten (einmal starten; läuft bis zum Ende der App)
pub fn starten(app: &AppHandle) {
    let s = app.state::<Lenkrad>();
    if s.gestartet.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = APP.set(app.clone());
    std::thread::spawn(|| {
        #[cfg(windows)]
        unsafe {
            if let Err(e) = windows_schleife() {
                eprintln!("Lenkrad: {e}");
            }
        }
    });
}

fn knopf_ereignis(geraet: &str, knopf: u16, gedrueckt: bool) {
    let Some(app) = APP.get() else { return };
    let s = app.state::<Lenkrad>();
    if gedrueckt && s.lernen.swap(false, Ordering::SeqCst) {
        let b = format!("{geraet}#{knopf}");
        let _ = app.emit_to("main", "gsra://lenkrad", Gelernt { bezeichnung: bezeichnung(geraet, knopf), belegung: b });
        return;
    }
    let passt = s.belegung.lock().map(|b| b.as_ref().is_some_and(|(g, k)| g == geraet && *k == knopf)).unwrap_or(false);
    if passt {
        crate::sprache::ausloesen(app, gedrueckt);
    }
}

/// Nächsten gedrückten Knopf merken (die Oberfläche zeigt „Drück jetzt den Knopf …“)
#[tauri::command]
pub fn lenkrad_lernen(app: AppHandle, s: State<'_, Lenkrad>, an: bool) {
    starten(&app);
    s.lernen.store(an, Ordering::SeqCst);
}

/// Belegung setzen (None = aus)
#[tauri::command]
pub fn lenkrad_belegen(app: AppHandle, s: State<'_, Lenkrad>, belegung: Option<String>) -> Result<(), String> {
    let neu = match belegung {
        Some(b) => Some(belegung_lesen(&b).ok_or_else(|| "Ungültige Belegung.".to_string())?),
        None => None,
    };
    if neu.is_some() {
        starten(&app);
    }
    *s.belegung.lock().map_err(|_| "Interner Fehler.".to_string())? = neu;
    Ok(())
}

#[cfg(windows)]
unsafe fn windows_schleife() -> windows::core::Result<()> {
    use windows::core::w;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::Input::*;
    use windows::Win32::UI::WindowsAndMessaging::*;

    unsafe extern "system" fn fenster(hwnd: HWND, msg: u32, w: WPARAM, l: LPARAM) -> LRESULT {
        if msg == WM_INPUT {
            unsafe { eingabe(HRAWINPUT(l.0 as _)) };
        }
        unsafe { DefWindowProcW(hwnd, msg, w, l) }
    }

    let modul = GetModuleHandleW(None)?;
    let klasse = WNDCLASSW { lpfnWndProc: Some(fenster), hInstance: modul.into(), lpszClassName: w!("GSRA_Lenkrad"), ..Default::default() };
    RegisterClassW(&klasse);
    let hwnd = CreateWindowExW(Default::default(), w!("GSRA_Lenkrad"), w!(""), Default::default(), 0, 0, 0, 0, Some(HWND_MESSAGE), None, Some(modul.into()), None)?;
    // Joystick (4), Gamepad (5), Mehrachsen-Controller (8) – Lenkräder melden sich meist als Joystick
    let geraete: Vec<RAWINPUTDEVICE> = [4u16, 5, 8]
        .iter()
        .map(|&usage| RAWINPUTDEVICE { usUsagePage: 1, usUsage: usage, dwFlags: RIDEV_INPUTSINK, hwndTarget: hwnd })
        .collect();
    RegisterRawInputDevices(&geraete, std::mem::size_of::<RAWINPUTDEVICE>() as u32)?;
    let mut nachricht = MSG::default();
    while GetMessageW(&mut nachricht, None, 0, 0).as_bool() {
        let _ = TranslateMessage(&nachricht);
        DispatchMessageW(&nachricht);
    }
    Ok(())
}

#[cfg(windows)]
struct Geraet {
    _praeparat: Vec<u64>,
    praep: windows::Win32::Devices::HumanInterfaceDevice::PHIDP_PREPARSED_DATA,
    kennung: String,
    gedrueckt: HashSet<u16>,
}

#[cfg(windows)]
thread_local! {
    static GERAETE: std::cell::RefCell<HashMap<isize, Geraet>> = std::cell::RefCell::new(HashMap::new());
}

#[cfg(windows)]
unsafe fn eingabe(roh: windows::Win32::UI::Input::HRAWINPUT) {
    use windows::Win32::Devices::HumanInterfaceDevice::*;
    use windows::Win32::UI::Input::*;

    let kopf = std::mem::size_of::<RAWINPUTHEADER>() as u32;
    let mut groesse = 0u32;
    GetRawInputData(roh, RID_INPUT, None, &mut groesse, kopf);
    if groesse == 0 || groesse > 64 * 1024 {
        return;
    }
    let mut puffer = vec![0u64; (groesse as usize).div_ceil(8)];
    if GetRawInputData(roh, RID_INPUT, Some(puffer.as_mut_ptr() as _), &mut groesse, kopf) != groesse {
        return;
    }
    let eintrag = &*(puffer.as_ptr() as *const RAWINPUT);
    if eintrag.header.dwType != RIM_TYPEHID.0 {
        return;
    }
    let griff = eintrag.header.hDevice;
    let hid = &eintrag.data.hid;
    let laenge = hid.dwSizeHid as usize;
    let ende = std::mem::offset_of!(RAWINPUT, data) + std::mem::offset_of!(RAWHID, bRawData) + laenge;
    if laenge == 0 || hid.dwCount == 0 || ende > groesse as usize {
        return;
    }
    // nur der letzte Bericht zählt (aktueller Zustand)
    let start = (&hid.bRawData as *const u8).add(laenge * (hid.dwCount as usize - 1));
    if start.add(laenge) > (puffer.as_ptr() as *const u8).add(groesse as usize) {
        return;
    }
    let mut bericht = std::slice::from_raw_parts(start, laenge).to_vec();

    GERAETE.with(|g| {
        let mut geraete = g.borrow_mut();
        let schluessel = griff.0 as isize;
        if !geraete.contains_key(&schluessel) {
            let mut n = 0u32;
            GetRawInputDeviceInfoW(Some(griff), RIDI_PREPARSEDDATA, None, &mut n);
            if n == 0 || n > 256 * 1024 {
                return;
            }
            let mut praeparat = vec![0u64; (n as usize).div_ceil(8)];
            if GetRawInputDeviceInfoW(Some(griff), RIDI_PREPARSEDDATA, Some(praeparat.as_mut_ptr() as _), &mut n) == u32::MAX {
                return;
            }
            let mut zeichen = 0u32;
            GetRawInputDeviceInfoW(Some(griff), RIDI_DEVICENAME, None, &mut zeichen);
            let mut name = vec![0u16; zeichen.min(1024) as usize];
            if zeichen > 0 {
                GetRawInputDeviceInfoW(Some(griff), RIDI_DEVICENAME, Some(name.as_mut_ptr() as _), &mut zeichen);
            }
            let pfad = String::from_utf16_lossy(&name);
            let praep = PHIDP_PREPARSED_DATA(praeparat.as_ptr() as isize);
            geraete.insert(schluessel, Geraet { _praeparat: praeparat, praep, kennung: geraet_kennung(&pfad), gedrueckt: HashSet::new() });
        }
        let Some(geraet) = geraete.get_mut(&schluessel) else { return };
        let mut liste = [0u16; 256];
        let mut anzahl = liste.len() as u32;
        let status = HidP_GetUsages(HidP_Input, HID_USAGE_PAGE_BUTTON, None, liste.as_mut_ptr(), &mut anzahl, geraet.praep, &mut bericht);
        if status != HIDP_STATUS_SUCCESS {
            return;
        }
        let jetzt: HashSet<u16> = liste[..(anzahl as usize).min(liste.len())].iter().copied().filter(|&k| k > 0).collect();
        let neu: Vec<u16> = jetzt.difference(&geraet.gedrueckt).copied().collect();
        let los: Vec<u16> = geraet.gedrueckt.difference(&jetzt).copied().collect();
        geraet.gedrueckt = jetzt;
        let kennung = geraet.kennung.clone();
        drop(geraete);
        for k in neu {
            knopf_ereignis(&kennung, k, true);
        }
        for k in los {
            knopf_ereignis(&kennung, k, false);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kennung_aus_dem_geraetepfad() {
        let pfad = r"\\?\HID#VID_0eb7&PID_0E04&MI_00#7&2b3c&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}";
        assert_eq!(geraet_kennung(pfad), "VID_0EB7&PID_0E04&MI_00");
        assert_eq!(geraet_kennung("irgendwas"), "UNBEKANNT");
    }

    #[test]
    fn belegung_wird_streng_gelesen() {
        assert_eq!(belegung_lesen("VID_0EB7&PID_0E04&MI_00#12"), Some(("VID_0EB7&PID_0E04&MI_00".into(), 12)));
        assert_eq!(belegung_lesen("VID_0EB7&PID_0E04#0"), None);
        assert_eq!(belegung_lesen("VID_0EB7&PID_0E04#300"), None);
        assert_eq!(belegung_lesen("../../x#1"), None);
        assert_eq!(belegung_lesen("VID_1<script>#1"), None);
        assert_eq!(belegung_lesen("ohne-raute"), None);
    }

    #[test]
    fn lesbare_bezeichnung() {
        assert_eq!(bezeichnung("VID_0EB7&PID_0E04&MI_00", 12), "Lenkrad/Controller 0EB7:0E04 – Knopf 12");
    }
}
