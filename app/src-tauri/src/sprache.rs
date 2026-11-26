//! Sprechtaste (Wunsch 26.11.: am Wochenende mit dem Renningenieur sprechen).
//!
//! Ablauf: Taste drücken → Mikrofon nimmt auf → Taste loslassen → Mikrofon aus → Spracherkennung AUF DEM PC
//! (Parakeet TDT 0.6B v3, int8, über sherpa-onnx) → der erkannte Text geht an die Oberfläche, die ihn wie eine
//! getippte Frage an den Renningenieur schickt.
//!
//! Datenschutz und Sicherheit:
//! * Das Mikrofon läuft NUR, solange die Taste gedrückt ist (höchstens 30 Sekunden). Der Ton bleibt im
//!   Arbeitsspeicher, wird nie gespeichert und nie gesendet; nach der Erkennung ist er weg.
//! * Das Sprachmodell wird nur nach ausdrücklichem Klick geladen, von einer festen Adresse mit fester Version
//!   (Commit), und jede Datei wird gegen Größe und SHA-256 geprüft, bevor sie benutzt wird.
//! * Ereignisse gehen nur an das Hauptfenster („main“), nie an eingebettete Webseiten.
//! * Als globale Sprechtaste sind nur Tasten aus einer festen Liste erlaubt (keine Buchstaben, kein Strg/Alt).

use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

/// Modell: NVIDIA Parakeet TDT 0.6B v3 (CC BY 4.0), für sherpa-onnx umgewandelt von k2-fsa (csukuangfj)
const MODELL_ORDNER: &str = "parakeet-tdt-0.6b-v3-int8";
const MODELL_BASIS: &str =
    "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/ed5d745623472f97cfc2e6c2916ee248798fc5a8";
const DATEIEN: &[(&str, u64, &str)] = &[
    ("encoder.int8.onnx", 652_282_294, "1afbe69c1ffdabee94755f42e4daf1d93549131a3da11356bda84fcef0f2c479"),
    ("decoder.int8.onnx", 11_845_274, "0222a86147299d4dee90edf95b6d13827edb42ad8b7c9cf0b2582f030937c0b5"),
    ("joiner.int8.onnx", 6_355_277, "cbd02f3696e9944970111fb439d9c3fd365a80374565f13f2b9c7007d253fc98"),
    ("tokens.txt", 93_939, "d58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d"),
];
const MAX_AUFNAHME: Duration = Duration::from_secs(30);
const MIN_AUFNAHME: Duration = Duration::from_millis(350);
/// Erlaubte globale Sprechtasten (Tasten, die Simulationen selten belegen; keine Buchstaben, keine Kombinationen)
pub const TASTEN: &[&str] = &[
    "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Pause", "ScrollLock", "Insert", "Home", "End", "PageUp",
    "PageDown", "Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8",
    "Numpad9", "NumpadAdd", "NumpadSubtract", "NumpadMultiply", "NumpadDivide",
];

struct Aufnahme {
    stopp: mpsc::Sender<()>,
    faden: JoinHandle<Result<(Vec<f32>, u32), String>>,
    start: Instant,
}

#[derive(Default)]
pub struct Sprache {
    aufnahme: Mutex<Option<Aufnahme>>,
    erkenner: Mutex<Option<Arc<sherpa_onnx::OfflineRecognizer>>>,
    laedt: AtomicBool,
    taste: Mutex<Option<String>>,
}

#[derive(Clone, serde::Serialize)]
struct Meldung {
    /// "hoert" | "erkennt" | "text" | "fehler" | "leer"
    zustand: &'static str,
    text: String,
}

#[derive(Clone, serde::Serialize)]
struct Fortschritt {
    prozent: u8,
    fertig: bool,
    fehler: Option<String>,
}

#[derive(serde::Serialize)]
pub struct Status {
    installiert: bool,
    laedt: bool,
    groesse_mb: u64,
    taste: Option<String>,
    tasten: Vec<&'static str>,
}

fn melden(app: &AppHandle, zustand: &'static str, text: impl Into<String>) {
    let _ = app.emit_to("main", "gsra://sprache", Meldung { zustand, text: text.into() });
}

fn modell_pfad(app: &AppHandle) -> Result<PathBuf, String> {
    let basis = app.path().app_local_data_dir().map_err(|_| "Kein Speicherort für das Sprachmodell.".to_string())?;
    Ok(basis.join("sprachmodelle").join(MODELL_ORDNER))
}

/// Vollständig = alle Dateien da und in der erwarteten Größe (die Prüfsumme wird beim Laden geprüft)
fn installiert(ordner: &Path) -> bool {
    DATEIEN.iter().all(|(name, groesse, _)| fs::metadata(ordner.join(name)).map(|m| m.len() == *groesse).unwrap_or(false))
}

pub fn taste_gueltig(taste: &str) -> bool {
    TASTEN.contains(&taste)
}

#[tauri::command]
pub fn sprache_status(app: AppHandle, s: State<'_, Sprache>) -> Result<Status, String> {
    let ordner = modell_pfad(&app)?;
    Ok(Status {
        installiert: installiert(&ordner),
        laedt: s.laedt.load(Ordering::SeqCst),
        groesse_mb: DATEIEN.iter().map(|d| d.1).sum::<u64>() / 1_000_000,
        taste: s.taste.lock().map(|t| t.clone()).unwrap_or(None),
        tasten: TASTEN.to_vec(),
    })
}

/// Lädt das Sprachmodell (nur nach Klick); Fortschritt über „gsra://sprache-laden“
#[tauri::command]
pub fn sprache_installieren(app: AppHandle, s: State<'_, Sprache>) -> Result<(), String> {
    let ordner = modell_pfad(&app)?;
    if installiert(&ordner) {
        let _ = app.emit_to("main", "gsra://sprache-laden", Fortschritt { prozent: 100, fertig: true, fehler: None });
        return Ok(());
    }
    if s.laedt.swap(true, Ordering::SeqCst) {
        return Err("Das Sprachmodell wird schon geladen.".into());
    }
    std::thread::spawn(move || {
        let ergebnis = laden(&app, &ordner);
        app.state::<Sprache>().laedt.store(false, Ordering::SeqCst);
        let f = match ergebnis {
            Ok(()) => Fortschritt { prozent: 100, fertig: true, fehler: None },
            Err(e) => Fortschritt { prozent: 0, fertig: false, fehler: Some(e) },
        };
        let _ = app.emit_to("main", "gsra://sprache-laden", f);
    });
    Ok(())
}

fn laden(app: &AppHandle, ordner: &Path) -> Result<(), String> {
    fs::create_dir_all(ordner).map_err(|_| "Ordner für das Sprachmodell lässt sich nicht anlegen.".to_string())?;
    let gesamt: u64 = DATEIEN.iter().map(|d| d.1).sum();
    let mut erledigt: u64 = 0;
    let mut zuletzt: u8 = 255;
    for (name, groesse, sha) in DATEIEN {
        let ziel = ordner.join(name);
        if fs::metadata(&ziel).map(|m| m.len() == *groesse).unwrap_or(false) && pruefsumme(&ziel)? == *sha {
            erledigt += groesse;
            continue;
        }
        // Abgebrochenen Download fortsetzen: Vorhandenes erst nachrechnen, dann nur den Rest anfragen (HTTP Range)
        let teil = ordner.join(format!("{name}.teil"));
        let mut vorhanden = fs::metadata(&teil).map(|m| m.len()).unwrap_or(0);
        if vorhanden > *groesse {
            let _ = fs::remove_file(&teil);
            vorhanden = 0;
        }
        let mut hash = Sha256::new();
        if vorhanden > 0 {
            let mut alt = fs::File::open(&teil).map_err(|_| "Angefangene Datei nicht lesbar.".to_string())?;
            let mut puffer = vec![0u8; 1 << 16];
            loop {
                let n = alt.read(&mut puffer).map_err(|_| "Angefangene Datei nicht lesbar.".to_string())?;
                if n == 0 {
                    break;
                }
                hash.update(&puffer[..n]);
            }
        }
        let mut anfrage = ureq::get(&format!("{MODELL_BASIS}/{name}"))
            .set("User-Agent", "GSRA-App")
            .timeout(Duration::from_secs(60 * 30));
        if vorhanden > 0 && vorhanden < *groesse {
            anfrage = anfrage.set("Range", &format!("bytes={vorhanden}-"));
        }
        let antwort = if vorhanden == *groesse {
            None // schon komplett, nur noch prüfen
        } else {
            Some(anfrage.call().map_err(|_| "Download nicht möglich – bitte Internetverbindung prüfen.".to_string())?)
        };
        let fortsetzen = vorhanden == *groesse || antwort.as_ref().is_some_and(|a| a.status() == 206);
        if !fortsetzen {
            vorhanden = 0;
            hash = Sha256::new();
        }
        let mut datei = if fortsetzen {
            fs::OpenOptions::new().append(true).open(&teil)
        } else {
            fs::File::create(&teil)
        }
        .map_err(|_| "Datei lässt sich nicht speichern.".to_string())?;
        let mut leser: Box<dyn Read> = match antwort {
            Some(a) => Box::new(a.into_reader().take(groesse - vorhanden + 1)),
            None => Box::new(std::io::empty()),
        };
        let mut puffer = vec![0u8; 1 << 16];
        let mut gelesen: u64 = vorhanden;
        loop {
            let n = leser.read(&mut puffer).map_err(|_| "Download abgebrochen.".to_string())?;
            if n == 0 {
                break;
            }
            gelesen += n as u64;
            if gelesen > *groesse {
                let _ = fs::remove_file(&teil);
                return Err("Die Datei ist größer als erwartet – abgebrochen.".into());
            }
            hash.update(&puffer[..n]);
            datei.write_all(&puffer[..n]).map_err(|_| "Datei lässt sich nicht speichern (Speicher voll?).".to_string())?;
            let prozent = (((erledigt + gelesen) * 100) / gesamt).min(99) as u8;
            if prozent != zuletzt {
                zuletzt = prozent;
                let _ = app.emit_to("main", "gsra://sprache-laden", Fortschritt { prozent, fertig: false, fehler: None });
            }
        }
        drop(datei);
        let ist: String = hash.finalize().iter().map(|b| format!("{b:02x}")).collect();
        if gelesen != *groesse || ist != *sha {
            let _ = fs::remove_file(&teil);
            return Err("Die geladene Datei ist nicht die erwartete (Prüfsumme falsch) – sie wurde gelöscht.".into());
        }
        fs::rename(&teil, &ziel).map_err(|_| "Datei lässt sich nicht speichern.".to_string())?;
        erledigt += groesse;
    }
    Ok(())
}

fn pruefsumme(pfad: &Path) -> Result<String, String> {
    let mut datei = fs::File::open(pfad).map_err(|_| "Datei des Sprachmodells fehlt.".to_string())?;
    let mut hash = Sha256::new();
    let mut puffer = vec![0u8; 1 << 16];
    loop {
        let n = datei.read(&mut puffer).map_err(|_| "Datei des Sprachmodells nicht lesbar.".to_string())?;
        if n == 0 {
            break;
        }
        hash.update(&puffer[..n]);
    }
    Ok(hash.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Erkenner einmal laden (dauert einige Sekunden) – vorher jede Datei gegen ihre Prüfsumme prüfen
fn erkenner(app: &AppHandle) -> Result<Arc<sherpa_onnx::OfflineRecognizer>, String> {
    let s = app.state::<Sprache>();
    let mut platz = s.erkenner.lock().map_err(|_| "Interner Fehler.".to_string())?;
    if let Some(e) = platz.as_ref() {
        return Ok(e.clone());
    }
    let ordner = modell_pfad(app)?;
    if !installiert(&ordner) {
        return Err("Die Spracherkennung ist noch nicht installiert.".into());
    }
    for (name, _, sha) in DATEIEN {
        if pruefsumme(&ordner.join(name))? != *sha {
            return Err(format!("{name} ist beschädigt – bitte die Spracherkennung neu installieren."));
        }
    }
    let pfad = |n: &str| Some(ordner.join(n).to_string_lossy().into_owned());
    let mut c = sherpa_onnx::OfflineRecognizerConfig::default();
    c.model_config.transducer = sherpa_onnx::OfflineTransducerModelConfig {
        encoder: pfad("encoder.int8.onnx"),
        decoder: pfad("decoder.int8.onnx"),
        joiner: pfad("joiner.int8.onnx"),
    };
    c.model_config.tokens = pfad("tokens.txt");
    c.model_config.model_type = Some("nemo_transducer".into());
    c.model_config.num_threads = 2; // die Simulation braucht den Rest des Prozessors
    c.model_config.provider = Some("cpu".into());
    let e = Arc::new(sherpa_onnx::OfflineRecognizer::create(&c).ok_or_else(|| "Die Spracherkennung ließ sich nicht starten.".to_string())?);
    *platz = Some(e.clone());
    Ok(e)
}

/// Erkenner im Hintergrund vorbereiten (z. B. beim Start, wenn eine Sprechtaste belegt ist)
#[tauri::command]
pub fn sprache_vorbereiten(app: AppHandle) {
    std::thread::spawn(move || {
        let _ = erkenner(&app);
    });
}

/// Mikrofon an – nur bis zum Loslassen (höchstens 30 s)
pub fn druecken(app: &AppHandle) -> Result<(), String> {
    let s = app.state::<Sprache>();
    let mut platz = s.aufnahme.lock().map_err(|_| "Interner Fehler.".to_string())?;
    if platz.is_some() {
        return Ok(());
    }
    if !installiert(&modell_pfad(app)?) {
        melden(app, "fehler", "Installiere zuerst die Spracherkennung (Renningenieur → Sprechtaste).");
        return Err("nicht installiert".into());
    }
    let (stopp, warten) = mpsc::channel::<()>();
    let (bereit_tx, bereit_rx) = mpsc::channel::<Result<(), String>>();
    let faden = std::thread::spawn(move || aufnehmen(warten, bereit_tx));
    match bereit_rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(())) => {
            *platz = Some(Aufnahme { stopp, faden, start: Instant::now() });
            melden(app, "hoert", "");
            // Sicherheitsnetz: nach 30 s von selbst stoppen
            let a = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(MAX_AUFNAHME);
                let _ = loslassen(&a);
            });
            // Erkenner schon jetzt laden, falls noch nicht geschehen
            let a = app.clone();
            std::thread::spawn(move || {
                let _ = erkenner(&a);
            });
            Ok(())
        }
        Ok(Err(e)) => {
            melden(app, "fehler", e.clone());
            Err(e)
        }
        Err(_) => {
            let _ = stopp.send(());
            melden(app, "fehler", "Das Mikrofon reagiert nicht.");
            Err("Mikrofon reagiert nicht".into())
        }
    }
}

/// Mikrofon aus, Text erkennen (im Hintergrund), Ergebnis an die Oberfläche
pub fn loslassen(app: &AppHandle) -> Result<(), String> {
    let s = app.state::<Sprache>();
    let aufnahme = s.aufnahme.lock().map_err(|_| "Interner Fehler.".to_string())?.take();
    let Some(a) = aufnahme else { return Ok(()) };
    let dauer = a.start.elapsed();
    let _ = a.stopp.send(());
    let app = app.clone();
    std::thread::spawn(move || {
        let ton = match a.faden.join() {
            Ok(Ok(t)) => t,
            Ok(Err(e)) => return melden(&app, "fehler", e),
            Err(_) => return melden(&app, "fehler", "Die Aufnahme ist abgestürzt."),
        };
        if dauer < MIN_AUFNAHME {
            return melden(&app, "leer", "Zu kurz – halte die Taste, solange du sprichst.");
        }
        if zu_leise(&ton.0) {
            return melden(&app, "leer", "Ich habe nichts gehört – ist das richtige Mikrofon in Windows eingestellt?");
        }
        melden(&app, "erkennt", "");
        match erkennen(&app, &ton.0, ton.1) {
            Ok(text) if text.chars().filter(|c| c.is_alphanumeric()).count() >= 2 => melden(&app, "text", text),
            Ok(_) => melden(&app, "leer", "Ich habe nichts verstanden."),
            Err(e) => melden(&app, "fehler", e),
        }
    });
    Ok(())
}

fn erkennen(app: &AppHandle, ton: &[f32], rate: u32) -> Result<String, String> {
    let e = erkenner(app)?;
    let stream = e.create_stream();
    if rate == 16_000 {
        stream.accept_waveform(16_000, ton);
    } else {
        let r = sherpa_onnx::LinearResampler::create(rate as i32, 16_000).ok_or_else(|| "Umrechnung des Tons fehlgeschlagen.".to_string())?;
        stream.accept_waveform(16_000, &r.resample(ton, true));
    }
    e.decode(&stream);
    let text = stream.get_result().map(|r| r.text).unwrap_or_default();
    Ok(text_bereinigen(&text))
}

/// Stille oder stummgeschaltetes Mikrofon: lautester Abschnitt (50 ms) unter etwa −50 dBFS → nichts erkennen
pub fn zu_leise(ton: &[f32]) -> bool {
    ton.chunks(800)
        .map(|s| (s.iter().map(|w| w * w).sum::<f32>() / s.len().max(1) as f32).sqrt())
        .fold(0.0f32, f32::max)
        < 0.003
}

/// Nur druckbarer Text, ein Leerzeichen zwischen Wörtern, höchstens 1.000 Zeichen
pub fn text_bereinigen(text: &str) -> String {
    let ohne: String = text.chars().map(|c| if c.is_control() { ' ' } else { c }).collect();
    ohne.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(1000).collect()
}

/// Nimmt auf, bis „stopp“ kommt; gibt Mono-Ton und Abtastrate zurück
fn aufnehmen(stopp: mpsc::Receiver<()>, bereit: mpsc::Sender<Result<(), String>>) -> Result<(Vec<f32>, u32), String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    let fehler = |t: &str| {
        let _ = bereit.send(Err(t.to_string()));
        Err(t.to_string())
    };
    let host = cpal::default_host();
    let Some(geraet) = host.default_input_device() else {
        return fehler("Kein Mikrofon gefunden. Prüfe in Windows: Einstellungen → Datenschutz → Mikrofon.");
    };
    let Ok(einstellung) = geraet.default_input_config() else {
        return fehler("Das Mikrofon lässt sich nicht öffnen. Erlaube Desktop-Apps den Zugriff (Windows-Datenschutz → Mikrofon).");
    };
    let kanaele = einstellung.channels().max(1) as usize;
    let rate = einstellung.sample_rate().0;
    let format = einstellung.sample_format();
    let config: cpal::StreamConfig = einstellung.into();
    let ton = Arc::new(Mutex::new(Vec::<f32>::with_capacity(rate as usize * 10)));
    let grenze = rate as usize * MAX_AUFNAHME.as_secs() as usize + rate as usize;
    let fehlerfall = |_e: cpal::StreamError| {};

    fn mono<T: Copy>(daten: &[T], kanaele: usize, ziel: &Arc<Mutex<Vec<f32>>>, grenze: usize, wandeln: impl Fn(T) -> f32) {
        if let Ok(mut t) = ziel.lock() {
            for rahmen in daten.chunks(kanaele) {
                if t.len() >= grenze {
                    return;
                }
                t.push(rahmen.iter().map(|&w| wandeln(w)).sum::<f32>() / kanaele as f32);
            }
        }
    }

    let t = ton.clone();
    let strom = match format {
        cpal::SampleFormat::F32 => geraet.build_input_stream(&config, move |d: &[f32], _: &_| mono(d, kanaele, &t, grenze, |w| w), fehlerfall, None),
        cpal::SampleFormat::I16 => geraet.build_input_stream(&config, move |d: &[i16], _: &_| mono(d, kanaele, &t, grenze, |w| w as f32 / 32_768.0), fehlerfall, None),
        cpal::SampleFormat::U16 => geraet.build_input_stream(&config, move |d: &[u16], _: &_| mono(d, kanaele, &t, grenze, |w| (w as f32 - 32_768.0) / 32_768.0), fehlerfall, None),
        cpal::SampleFormat::I32 => geraet.build_input_stream(&config, move |d: &[i32], _: &_| mono(d, kanaele, &t, grenze, |w| w as f32 / 2_147_483_648.0), fehlerfall, None),
        _ => return fehler("Dieses Mikrofon-Format wird nicht unterstützt."),
    };
    let Ok(strom) = strom else {
        return fehler("Das Mikrofon lässt sich nicht öffnen. Erlaube Desktop-Apps den Zugriff (Windows-Datenschutz → Mikrofon).");
    };
    if strom.play().is_err() {
        return fehler("Das Mikrofon lässt sich nicht starten.");
    }
    let _ = bereit.send(Ok(()));
    let _ = stopp.recv_timeout(MAX_AUFNAHME + Duration::from_secs(2));
    drop(strom); // Mikrofon aus
    let daten = std::mem::take(&mut *ton.lock().map_err(|_| "Interner Fehler.".to_string())?);
    Ok((daten, rate))
}

/// Taste in der App (Knopf gedrückt halten)
#[tauri::command]
pub fn sprechtaste(app: AppHandle, gedrueckt: bool) -> Result<(), String> {
    if gedrueckt {
        druecken(&app)
    } else {
        loslassen(&app)
    }
}

/// Globale Sprechtaste (funktioniert auch, wenn die Simulation im Vordergrund ist); None = aus
#[tauri::command]
pub fn sprechtaste_belegen(app: AppHandle, s: State<'_, Sprache>, taste: Option<String>) -> Result<(), String> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    if let Some(t) = &taste {
        if !taste_gueltig(t) {
            return Err("Diese Taste ist als Sprechtaste nicht erlaubt.".into());
        }
    }
    let kurz = app.global_shortcut();
    let _ = kurz.unregister_all();
    if let Some(t) = &taste {
        let k: tauri_plugin_global_shortcut::Shortcut = t.parse().map_err(|_| "Unbekannte Taste.".to_string())?;
        kurz.register(k).map_err(|_| "Diese Taste ist schon von einem anderen Programm belegt.".to_string())?;
    }
    *s.taste.lock().map_err(|_| "Interner Fehler.".to_string())? = taste;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nur_erlaubte_tasten() {
        assert!(taste_gueltig("F9"));
        assert!(taste_gueltig("Numpad0"));
        assert!(!taste_gueltig("A"));
        assert!(!taste_gueltig("Alt+F4"));
        assert!(!taste_gueltig("ctrl+c"));
        assert!(!taste_gueltig(""));
    }

    #[test]
    fn alle_erlaubten_tasten_sind_lesbar() {
        for t in TASTEN {
            assert!(t.parse::<tauri_plugin_global_shortcut::Shortcut>().is_ok(), "{t} nicht lesbar");
        }
    }

    #[test]
    fn text_wird_bereinigt() {
        assert_eq!(text_bereinigen("  Wer  fährt\nvor mir?\u{0007} "), "Wer fährt vor mir?");
        assert_eq!(text_bereinigen(&"a".repeat(5000)).chars().count(), 1000);
    }

    #[test]
    fn stille_wird_erkannt() {
        assert!(zu_leise(&[]));
        assert!(zu_leise(&vec![0.0005; 16_000]));
        let mut sprache = vec![0.0005; 16_000];
        for (i, w) in sprache.iter_mut().enumerate().skip(4_000).take(2_000) {
            *w = (i as f32 * 0.05).sin() * 0.1;
        }
        assert!(!zu_leise(&sprache));
    }

    #[test]
    fn modell_ist_fest_angegeben() {
        assert!(MODELL_BASIS.starts_with("https://huggingface.co/"));
        assert!(MODELL_BASIS.contains("/resolve/ed5d745623472f97cfc2e6c2916ee248798fc5a8"), "feste Version");
        for (_, groesse, sha) in DATEIEN {
            assert!(*groesse > 0);
            assert_eq!(sha.len(), 64);
            assert!(sha.chars().all(|c| c.is_ascii_hexdigit()));
        }
    }
}
