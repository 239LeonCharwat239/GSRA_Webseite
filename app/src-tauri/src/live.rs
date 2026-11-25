//! Live-Daten: eigener Hintergrund-Thread liest die Simulation (ca. 120× pro Sekunde nachsehen, iRacing liefert 60)
//! und schickt die Messpunkte gebündelt alle 50 ms an die Oberfläche.
//!
//! Ereignisse an die Oberfläche:
//! * `gsra://status`  – { simulation, verbunden, meldung }
//! * `gsra://sitzung` – Strecke, Streckenlänge, Fahrzeug, Sitzungsart
//! * `gsra://proben`  – Liste von Messpunkten (siehe gsra_telemetrie::Probe)
//! * `gsra://feld`    – Stand aller Autos (viermal pro Sekunde) für Rennbericht und Zweikämpfe

use gsra_telemetrie::{Probe, Sitzung};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub simulation: &'static str,
    pub verbunden: bool,
    pub meldung: Option<String>,
    pub sitzung: Option<Sitzung>,
}

/// Letzter Stand – die Oberfläche fragt ihn beim Start ab (Ereignisse davor hätte sie verpasst)
#[derive(Default)]
pub struct Zustand(pub Mutex<Status>);

#[tauri::command]
pub fn status(zustand: State<'_, Zustand>) -> Status {
    zustand.0.lock().map(|s| s.clone()).unwrap_or_default()
}

fn melden(app: &AppHandle, neu: Status) {
    let zustand = app.state::<Zustand>();
    let mut alt = match zustand.0.lock() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    if *alt != neu {
        *alt = neu.clone();
        let _ = app.emit("gsra://status", neu);
    }
}

pub fn starten(app: AppHandle) {
    std::thread::Builder::new()
        .name("gsra-live".into())
        .spawn(move || schleife(app))
        .expect("Live-Thread konnte nicht starten");
}

#[cfg(windows)]
fn schleife(app: AppHandle) {
    use gsra_telemetrie::windows::IracingSpeicher;
    use gsra_telemetrie::Leser;
    use std::time::{Duration, Instant};

    let mut speicher: Option<IracingSpeicher> = None;
    let mut leser = Leser::new();
    let mut stapel: Vec<Probe> = Vec::with_capacity(16);
    let mut versand = Instant::now();
    let mut feld_zeit = Instant::now();
    let mut naechster_versuch = Instant::now();
    let mut status = Status { simulation: "iracing", ..Default::default() };
    melden(&app, status.clone());

    loop {
        if speicher.is_none() && Instant::now() >= naechster_versuch {
            speicher = IracingSpeicher::oeffnen();
            naechster_versuch = Instant::now() + Duration::from_secs(2);
        }
        let mut verbunden = false;
        if let Some(s) = speicher.as_ref() {
            match leser.lesen(s) {
                Ok(l) => {
                    verbunden = l.verbunden;
                    status.meldung = None;
                    if let Some(si) = l.sitzung {
                        status.sitzung = Some(si.clone());
                        let _ = app.emit("gsra://sitzung", si);
                    }
                    if let Some(p) = l.probe {
                        stapel.push(p);
                    }
                    if let Some(f) = l.feld {
                        let _ = app.emit("gsra://feld", f);
                    }
                }
                Err(e) => {
                    // Unerwartete Daten: Verbindung schließen und in 2 s neu versuchen
                    status.meldung = Some(format!("Daten der Simulation nicht lesbar ({e})"));
                    speicher = None;
                    leser.zuruecksetzen();
                }
            }
        }
        if !verbunden {
            status.sitzung = None;
            stapel.clear();
        }
        status.verbunden = verbunden;
        melden(&app, status.clone());

        if verbunden && feld_zeit.elapsed() >= Duration::from_millis(250) {
            leser.feld_anfordern();
            feld_zeit = Instant::now();
        }
        if !stapel.is_empty() && versand.elapsed() >= Duration::from_millis(50) {
            let _ = app.emit("gsra://proben", &stapel);
            stapel.clear();
            versand = Instant::now();
        }
        std::thread::sleep(Duration::from_millis(if verbunden { 8 } else { 250 }));
    }
}

#[cfg(not(windows))]
fn schleife(app: AppHandle) {
    let _: Option<Probe> = None;
    melden(&app, Status { simulation: "iracing", verbunden: false, meldung: Some("iRacing gibt es nur unter Windows".into()), sitzung: None });
}
