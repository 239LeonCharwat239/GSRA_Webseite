// GSRA-App: Fenster (Tauri) + Live-Daten aus der Simulation + Anmeldung über die Webseite + Sprechtaste.
// Im fertigen Programm kein zusätzliches Konsolenfenster unter Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod anmeldung;
mod lenkrad;
mod live;
mod simulation;
mod sprache;
mod stimme;
mod webbereich;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Updates nur von GitHub-Releases und nur mit gültiger Signatur (öffentlicher Schlüssel in tauri.conf.json)
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Globale Sprechtaste: drücken = Mikrofon an, loslassen = erkennen (Tasten nur aus sprache::TASTEN)
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _taste, ereignis| {
                    use tauri_plugin_global_shortcut::ShortcutState;
                    sprache::ausloesen(app, ereignis.state() == ShortcutState::Pressed);
                })
                .build(),
        )
        .manage(live::Zustand::default())
        .manage(webbereich::Bereiche::default())
        .manage(sprache::Sprache::default())
        .manage(lenkrad::Lenkrad::default())
        .manage(stimme::Stimme::default())
        .invoke_handler(tauri::generate_handler![
            live::status,
            anmeldung::anmeldung_starten,
            anmeldung::anmeldung_abbrechen,
            webbereich::bereich_zeigen,
            webbereich::bereich_flaeche,
            webbereich::bereich_verbergen,
            webbereich::bereich_aktion,
            sprache::sprache_status,
            sprache::sprache_installieren,
            sprache::sprache_vorbereiten,
            sprache::sprechtaste,
            sprache::sprechtaste_belegen,
            sprache::hoermodus_setzen,
            sprache::sprache_mitschrift,
            lenkrad::lenkrad_lernen,
            lenkrad::lenkrad_belegen,
            simulation::simulation_erkennen,
            stimme::stimme_status,
            stimme::stimme_installieren,
            stimme::stimme_referenz_setzen,
            stimme::stimme_referenz_loeschen,
            stimme::stimme_sprechen,
            stimme::stimme_vorbereiten,
            stimme::stimme_abbrechen
        ])
        .setup(|app| {
            live::starten(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("GSRA-App konnte nicht starten");
}
