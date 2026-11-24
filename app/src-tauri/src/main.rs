// GSRA-App: Fenster (Tauri) + Live-Daten aus der Simulation.
// Im fertigen Programm kein zusätzliches Konsolenfenster unter Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod live;

fn main() {
    tauri::Builder::default()
        .manage(live::Zustand::default())
        .invoke_handler(tauri::generate_handler![live::status])
        .setup(|app| {
            live::starten(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("GSRA-App konnte nicht starten");
}
