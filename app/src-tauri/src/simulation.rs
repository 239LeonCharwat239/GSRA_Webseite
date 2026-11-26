//! Welche Simulation läuft gerade? (Wunsch 26.11.) – nur die Namen der laufenden Programme, sonst nichts.
//! Die App zeigt damit „iRacing läuft“ oder z. B. „ACC erkannt – Live-Werte dafür kommen bald“.

/// (Programmdatei in Kleinbuchstaben, Anzeigename, Live-Telemetrie in der App?)
pub const SIMULATIONEN: &[(&str, &str, bool)] = &[
    ("iracingsim64dx11.exe", "iRacing", true),
    ("iracingsim64.exe", "iRacing", true),
    ("ac2-win64-shipping.exe", "Assetto Corsa Competizione", false),
    ("acs.exe", "Assetto Corsa", false),
    ("acs_x86.exe", "Assetto Corsa", false),
    ("assettocorsaevo.exe", "Assetto Corsa EVO", false),
    ("le mans ultimate.exe", "Le Mans Ultimate", false),
    ("rfactor2.exe", "rFactor 2", false),
    ("ams2avx.exe", "Automobilista 2", false),
    ("ams2.exe", "Automobilista 2", false),
    ("rrre64.exe", "RaceRoom", false),
    ("rrre.exe", "RaceRoom", false),
    ("f1_25.exe", "F1 25", false),
    ("f1_24.exe", "F1 24", false),
    ("wrc.exe", "EA SPORTS WRC", false),
    ("dirtrally2.exe", "DiRT Rally 2.0", false),
    ("pcars2avx.exe", "Project CARS 2", false),
    ("beamng.drive.x64.exe", "BeamNG.drive", false),
    ("iracingui.exe", "iRacing (Startprogramm)", true),
];

#[derive(Clone, serde::Serialize, PartialEq, Debug)]
pub struct Erkannt {
    pub name: &'static str,
    pub live: bool,
}

/// Aus einer Liste von Programmnamen die erste bekannte Simulation (die Simulation selbst vor ihrem Startprogramm)
pub fn aus_programmen<'a>(programme: impl Iterator<Item = &'a str>) -> Option<Erkannt> {
    let laufend: Vec<String> = programme.map(|p| p.to_ascii_lowercase()).collect();
    SIMULATIONEN
        .iter()
        .find(|(exe, _, _)| laufend.iter().any(|p| p == exe))
        .map(|(_, name, live)| Erkannt { name, live: *live })
}

#[cfg(windows)]
fn programme() -> Vec<String> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS};
    let mut liste = Vec::new();
    unsafe {
        let Ok(bild) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else { return liste };
        let mut eintrag = PROCESSENTRY32W { dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
        if Process32FirstW(bild, &mut eintrag).is_ok() {
            loop {
                let ende = eintrag.szExeFile.iter().position(|&z| z == 0).unwrap_or(eintrag.szExeFile.len());
                liste.push(String::from_utf16_lossy(&eintrag.szExeFile[..ende]));
                if Process32NextW(bild, &mut eintrag).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(bild);
    }
    liste
}

#[cfg(not(windows))]
fn programme() -> Vec<String> {
    Vec::new()
}

/// Welche Simulation läuft? (None = keine bekannte)
#[tauri::command]
pub fn simulation_erkennen() -> Option<Erkannt> {
    let p = programme();
    aus_programmen(p.iter().map(String::as_str))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simulation_vor_startprogramm() {
        let p = ["explorer.exe", "iRacingUI.exe", "iRacingSim64DX11.exe"];
        assert_eq!(aus_programmen(p.into_iter()), Some(Erkannt { name: "iRacing", live: true }));
        assert_eq!(aus_programmen(["AC2-Win64-Shipping.exe"].into_iter()), Some(Erkannt { name: "Assetto Corsa Competizione", live: false }));
        assert_eq!(aus_programmen(["Le Mans Ultimate.exe"].into_iter()).map(|e| e.name), Some("Le Mans Ultimate"));
        assert_eq!(aus_programmen(["chrome.exe", "discord.exe"].into_iter()), None);
    }
}
