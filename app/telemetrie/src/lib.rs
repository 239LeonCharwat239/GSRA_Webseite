//! GSRA-Telemetrie: liest Live-Daten aus Simulationen.
//!
//! Zuerst iRacing: Die Simulation legt ihre Daten in einen gemeinsamen Speicherbereich
//! („Local\IRSDKMemMapFileName“). Wir öffnen ihn NUR LESEND, kopieren jeden Abschnitt in einen eigenen
//! Puffer und prüfen jede Position und Länge, bevor wir sie benutzen – kaputte oder bösartige Daten
//! führen zu einer Fehlermeldung, nie zu einem Absturz oder einem Lesen außerhalb des Bereichs.
//!
//! Aufbau:
//! * [`irsdk`]   – reine Auswertung (Kopf, Variablen, Datenzeile, Sitzungsinfo); überall testbar
//! * [`leser`]   – liest Schritt für Schritt aus einem [`leser::Speicher`] (echter Bereich oder Testdaten)
//! * `windows`   – öffnet den echten Speicherbereich (nur unter Windows)

pub mod irsdk;
pub mod leser;
#[cfg(windows)]
pub mod windows;

pub use irsdk::{Probe, Sitzung};
pub use leser::{Lesung, Leser, Speicher};
