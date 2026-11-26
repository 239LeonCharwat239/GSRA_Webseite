// GSRA-App: Fenster (Tauri) + Live-Daten aus der Simulation + Anmeldung über die Webseite.
// Im fertigen Programm kein zusätzliches Konsolenfenster unter Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod anmeldung;
mod live;
mod webbereich;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(live::Zustand::default())
        .manage(webbereich::Bereiche::default())
        .invoke_handler(tauri::generate_handler![live::status, anmeldung::anmeldung_starten, anmeldung::anmeldung_abbrechen, webbereich::bereich_zeigen, webbereich::bereich_flaeche, webbereich::bereich_verbergen, webbereich::bereich_aktion])
        .setup(|app| {
            live::starten(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("GSRA-App konnte nicht starten");
}
