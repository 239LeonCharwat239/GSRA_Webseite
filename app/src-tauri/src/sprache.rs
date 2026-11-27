//! Sprechtaste (Wunsch 26.11.: mit dem Renningenieur sprechen) – drei Arten:
//!
//! * **Halten**: Taste gedrückt halten → sprechen → loslassen.
//! * **Antippen**: einmal drücken → er hört zu, bis du aufhörst zu sprechen (Silero VAD erkennt das Ende).
//! * **Signalwort**: „Hey Kim, reicht der Sprit?“ – das Mikrofon hört dauerhaft mit, aber nur auf dem PC; erst wenn ein
//!   Satz mit dem Signalwort beginnt, geht der Rest als Frage weiter.
//! Auslöser: Knopf in der App, globale Tastatur-Taste oder ein Knopf am Lenkrad (lenkrad.rs) – alle über `ausloesen`.
//!
//! Erkennung AUF DEM PC: Parakeet TDT 0.6B v3 (int8, 25 Sprachen) über sherpa-onnx; Sprechpausen: Silero VAD.
//!
//! Datenschutz und Sicherheit:
//! * Halten/Antippen: Mikrofon nur während der Frage (höchstens 30 s). Signalwort: Mikrofon dauerhaft an, solange
//!   die Art gewählt ist (die App zeigt das sichtbar an); Sätze ohne Signalwort werden sofort verworfen.
//! * Ton bleibt im Arbeitsspeicher, wird nie gespeichert und nie gesendet; weiter geht nur erkannter Text.
//! * Modelle nur nach ausdrücklichem Klick, feste Adressen mit fester Version, jede Datei gegen Größe und SHA-256
//!   geprüft (beim Laden und vor jeder Nutzung); abgebrochene Downloads werden fortgesetzt.
//! * Ereignisse gehen nur an das Hauptfenster („main“). Globale Tasten nur aus einer festen Liste.

use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

const MODELL_ORDNER: &str = "parakeet-tdt-0.6b-v3-int8";
/// Parakeet TDT 0.6B v3 (NVIDIA, CC BY 4.0), für sherpa-onnx umgewandelt von k2-fsa – feste Version (Commit)
const PARAKEET: &str =
    "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/ed5d745623472f97cfc2e6c2916ee248798fc5a8";
/// Silero VAD (MIT) aus den Modell-Veröffentlichungen von sherpa-onnx
const SILERO: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models";
/// Modelldatei: Name, Größe in Bytes, SHA-256, Adresse des Ordners (feste Version)
pub type Datei = (&'static str, u64, &'static str, &'static str);
const DATEIEN: &[Datei] = &[
    ("encoder.int8.onnx", 652_282_294, "1afbe69c1ffdabee94755f42e4daf1d93549131a3da11356bda84fcef0f2c479", PARAKEET),
    ("decoder.int8.onnx", 11_845_274, "0222a86147299d4dee90edf95b6d13827edb42ad8b7c9cf0b2582f030937c0b5", PARAKEET),
    ("joiner.int8.onnx", 6_355_277, "cbd02f3696e9944970111fb439d9c3fd365a80374565f13f2b9c7007d253fc98", PARAKEET),
    ("tokens.txt", 93_939, "d58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d", PARAKEET),
    ("silero_vad.onnx", 643_854, "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6", SILERO),
];
const MAX_AUFNAHME: Duration = Duration::from_secs(30);
const MIN_AUFNAHME: Duration = Duration::from_millis(350);
/// Antippen: so lange auf den Anfang warten, danach „nichts gehört“
const WARTEN_AUF_SPRACHE: Duration = Duration::from_secs(7);
/// Signalwort ohne Frage dahinter: so lange auf die Frage warten
const WARTEN_AUF_FRAGE: Duration = Duration::from_secs(8);
const VAD_FENSTER: usize = 512;
/// Erlaubte globale Sprechtasten (Tasten, die Simulationen selten belegen; keine Buchstaben, keine Kombinationen)
pub const TASTEN: &[&str] = &[
    "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Pause", "ScrollLock", "Insert", "Home", "End", "PageUp",
    "PageDown", "Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8",
    "Numpad9", "NumpadAdd", "NumpadSubtract", "NumpadMultiply", "NumpadDivide",
];
/// Wörter vor dem Signalwort, die übersprungen werden („Hey Kim“, „Hallo Renningenieur“ …)
const GRUSS: &[&str] = &[
    "hey", "hei", "he", "ey", "hay", "herr", "hallo", "halo", "hi", "hello", "ok", "okay", "oke", "hola", "salut", "ciao", "hej", "ahoj", "oi", "zdravei",
];

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Modus {
    #[default]
    Halten,
    Antippen,
    Signalwort,
}

struct Aufnahme {
    nr: u64,
    stopp: mpsc::Sender<()>,
    faden: JoinHandle<Result<(Vec<f32>, u32), String>>,
    start: Instant,
}

#[derive(Default)]
pub struct Sprache {
    aufnahme: Mutex<Option<Aufnahme>>,
    nummer: AtomicU64,
    erkenner: Mutex<Option<Arc<sherpa_onnx::OfflineRecognizer>>>,
    laedt: AtomicBool,
    taste: Mutex<Option<String>>,
    modus: Mutex<Modus>,
    signalwoerter: Mutex<Vec<String>>,
    zuhoeren: Mutex<Option<mpsc::Sender<()>>>,
}

#[derive(Clone, serde::Serialize)]
struct Meldung {
    /// "hoert" | "erkennt" | "text" | "fehler" | "leer" | "signal" | "dauerhaft" | "dauerhaft-aus"
    zustand: &'static str,
    text: String,
}

#[derive(Clone, serde::Serialize)]
pub struct Fortschritt {
    pub prozent: u8,
    pub fertig: bool,
    pub fehler: Option<String>,
}

#[derive(serde::Serialize)]
pub struct Status {
    installiert: bool,
    laedt: bool,
    groesse_mb: u64,
    fehlt_mb: u64,
    taste: Option<String>,
    tasten: Vec<&'static str>,
}

pub fn melden(app: &AppHandle, zustand: &'static str, text: impl Into<String>) {
    let _ = app.emit_to("main", "gsra://sprache", Meldung { zustand, text: text.into() });
}

fn modell_pfad(app: &AppHandle) -> Result<PathBuf, String> {
    let basis = app.path().app_local_data_dir().map_err(|_| "Kein Speicherort für das Sprachmodell.".to_string())?;
    Ok(basis.join("sprachmodelle").join(MODELL_ORDNER))
}

pub fn vollstaendig(ordner: &Path, name: &str, groesse: u64) -> bool {
    fs::metadata(ordner.join(name)).map(|m| m.len() == groesse).unwrap_or(false)
}

/// Vollständig = alle Dateien da und in der erwarteten Größe (die Prüfsumme wird beim Laden geprüft)
fn installiert(ordner: &Path) -> bool {
    DATEIEN.iter().all(|(name, groesse, _, _)| vollstaendig(ordner, name, *groesse))
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
        fehlt_mb: DATEIEN.iter().filter(|d| !vollstaendig(&ordner, d.0, d.1)).map(|d| d.1).sum::<u64>().div_ceil(1_000_000),
        taste: s.taste.lock().map(|t| t.clone()).unwrap_or(None),
        tasten: TASTEN.to_vec(),
    })
}

/// Lädt die Sprachmodelle (nur nach Klick); Fortschritt über „gsra://sprache-laden“
#[tauri::command]
pub fn sprache_installieren(app: AppHandle, s: State<'_, Sprache>) -> Result<(), String> {
    let ordner = modell_pfad(&app)?;
    if installiert(&ordner) {
        let _ = app.emit_to("main", "gsra://sprache-laden", Fortschritt { prozent: 100, fertig: true, fehler: None });
        return Ok(());
    }
    if s.laedt.swap(true, Ordering::SeqCst) {
        return Err("Die Spracherkennung wird schon geladen.".into());
    }
    std::thread::spawn(move || {
        let ergebnis = laden(&app, &ordner, DATEIEN, "gsra://sprache-laden");
        app.state::<Sprache>().laedt.store(false, Ordering::SeqCst);
        let f = match ergebnis {
            Ok(()) => Fortschritt { prozent: 100, fertig: true, fehler: None },
            Err(e) => Fortschritt { prozent: 0, fertig: false, fehler: Some(e) },
        };
        let _ = app.emit_to("main", "gsra://sprache-laden", f);
    });
    Ok(())
}

/// Lädt Modelldateien (auch für die eigene Stimme, stimme.rs); Fortschritt als Ereignis an das Hauptfenster
pub fn laden(app: &AppHandle, ordner: &Path, dateien: &[Datei], ereignis: &str) -> Result<(), String> {
    fs::create_dir_all(ordner).map_err(|_| "Ordner für das Modell lässt sich nicht anlegen.".to_string())?;
    let gesamt: u64 = dateien.iter().map(|d| d.1).sum();
    let mut erledigt: u64 = 0;
    let mut zuletzt: u8 = 255;
    for (name, groesse, sha, basis) in dateien {
        let ziel = ordner.join(name);
        if vollstaendig(ordner, name, *groesse) && pruefsumme(&ziel)? == *sha {
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
        let mut anfrage = ureq::get(&format!("{basis}/{name}")).set("User-Agent", "GSRA-App").timeout(Duration::from_secs(60 * 30));
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
        let mut datei = if fortsetzen { fs::OpenOptions::new().append(true).open(&teil) } else { fs::File::create(&teil) }
            .map_err(|_| "Datei lässt sich nicht speichern.".to_string())?;
        let mut leser: Box<dyn Read> = match antwort {
            Some(a) => Box::new(a.into_reader().take(groesse - vorhanden + 1)),
            None => Box::new(std::io::empty()),
        };
        let mut puffer = vec![0u8; 1 << 16];
        let mut gelesen: u64 = vorhanden;
        loop {
            let n = leser.read(&mut puffer).map_err(|_| "Download abgebrochen – beim nächsten Klick geht es dort weiter.".to_string())?;
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
                let _ = app.emit_to("main", ereignis, Fortschritt { prozent, fertig: false, fehler: None });
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

/// Modelldateien prüfen – mit SHA-256 nur beim ersten Mal nach dem Laden (Fund 26.11.: allein der große
/// Erkennungs-Teil brauchte bei jedem App-Start 1,5 s). Danach genügt ein Vermerk mit Größe und Änderungszeit jeder
/// Datei; ändert sich eine Datei, wird wieder vollständig geprüft. (Wer Dateien im Benutzerordner unbemerkt austauschen
/// kann, könnte auch die App selbst austauschen – der volle Hash bei jedem Start bringt dagegen nichts.)
pub fn modell_pruefen(ordner: &Path, dateien: &[Datei], meldung: &str) -> Result<(), String> {
    let stand = |name: &str| -> Option<String> {
        let m = fs::metadata(ordner.join(name)).ok()?;
        let zeit = m.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_nanos();
        Some(format!("{name} {} {zeit}", m.len()))
    };
    let soll: Option<Vec<String>> = dateien.iter().map(|d| stand(d.0).map(|s| format!("{s} {}", d.2))).collect();
    let merker = ordner.join("geprueft.txt");
    if let Some(soll) = &soll {
        if fs::read_to_string(&merker).is_ok_and(|ist| ist == soll.join("\n")) {
            return Ok(());
        }
    }
    for (name, groesse, sha, _) in dateien {
        if !vollstaendig(ordner, name, *groesse) || pruefsumme(&ordner.join(name))? != *sha {
            let _ = fs::remove_file(&merker);
            return Err(format!("{name} ist beschädigt – {meldung}"));
        }
    }
    if let Some(soll) = soll {
        let _ = fs::write(&merker, soll.join("\n"));
    }
    Ok(())
}

pub fn pruefsumme(pfad: &Path) -> Result<String, String> {
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

fn geprueft(app: &AppHandle) -> Result<PathBuf, String> {
    let ordner = modell_pfad(app)?;
    if !installiert(&ordner) {
        return Err("Die Spracherkennung ist noch nicht (vollständig) installiert.".into());
    }
    Ok(ordner)
}

/// Erkenner einmal laden (dauert einige Sekunden) – vorher jede Datei gegen ihre Prüfsumme prüfen
fn erkenner(app: &AppHandle) -> Result<Arc<sherpa_onnx::OfflineRecognizer>, String> {
    let s = app.state::<Sprache>();
    let mut platz = s.erkenner.lock().map_err(|_| "Interner Fehler.".to_string())?;
    if let Some(e) = platz.as_ref() {
        return Ok(e.clone());
    }
    let ordner = geprueft(app)?;
    modell_pruefen(&ordner, DATEIEN, "bitte die Spracherkennung neu installieren.")?;
    let e = Arc::new(sherpa_onnx::OfflineRecognizer::create(&erkenner_config(&ordner)).ok_or_else(|| "Die Spracherkennung ließ sich nicht starten.".to_string())?);
    *platz = Some(e.clone());
    Ok(e)
}

fn erkenner_config(ordner: &Path) -> sherpa_onnx::OfflineRecognizerConfig {
    let pfad = |n: &str| Some(ordner.join(n).to_string_lossy().into_owned());
    let mut c = sherpa_onnx::OfflineRecognizerConfig::default();
    c.model_config.transducer = sherpa_onnx::OfflineTransducerModelConfig {
        encoder: pfad("encoder.int8.onnx"),
        decoder: pfad("decoder.int8.onnx"),
        joiner: pfad("joiner.int8.onnx"),
    };
    c.model_config.tokens = pfad("tokens.txt");
    c.model_config.model_type = Some("nemo_transducer".into());
    c.model_config.num_threads = threads_fuer_sprache(); // die Simulation braucht den Rest des Prozessors
    c.model_config.provider = Some("cpu".into());
    c
}

/// Rechen-Threads für Spracherkennung und eigene Stimme: die Hälfte der Kerne, mindestens 2, höchstens 4 –
/// so bleibt der Rest für die Simulation (iRacing braucht vor allem einen schnellen Kern)
pub fn threads_fuer_sprache() -> i32 {
    std::thread::available_parallelism().map(|n| (n.get() / 2).clamp(2, 4)).unwrap_or(2) as i32
}

fn vad_config(ordner: &Path, pause: f32) -> sherpa_onnx::VadModelConfig {
    let mut c = sherpa_onnx::VadModelConfig::default();
    c.silero_vad = sherpa_onnx::SileroVadModelConfig {
        model: Some(ordner.join("silero_vad.onnx").to_string_lossy().into_owned()),
        threshold: 0.5,
        min_silence_duration: pause,
        min_speech_duration: 0.25,
        window_size: VAD_FENSTER as i32,
        max_speech_duration: 25.0,
    };
    c.sample_rate = 16_000;
    c.num_threads = 1;
    c.provider = Some("cpu".into());
    c
}

/// Silero VAD: erkennt, wann gesprochen wird und wann eine Pause das Ende eines Satzes ist
fn vad(app: &AppHandle, pause: f32) -> Result<sherpa_onnx::VoiceActivityDetector, String> {
    let ordner = geprueft(app)?;
    sherpa_onnx::VoiceActivityDetector::create(&vad_config(&ordner, pause), 40.0).ok_or_else(|| "Die Pausenerkennung ließ sich nicht starten.".to_string())
}

/// Erkenner im Hintergrund vorbereiten (z. B. beim Start, wenn eine Sprechtaste belegt ist)
#[tauri::command]
pub fn sprache_vorbereiten(app: AppHandle) {
    std::thread::spawn(move || {
        let _ = erkenner(&app);
    });
}

/// Ein Auslöser (App-Knopf, Tastatur, Lenkrad) wurde gedrückt oder losgelassen – je nach Art
pub fn ausloesen(app: &AppHandle, gedrueckt: bool) {
    let modus = app.state::<Sprache>().modus.lock().map(|m| *m).unwrap_or_default();
    let laeuft = app.state::<Sprache>().aufnahme.lock().map(|a| a.is_some()).unwrap_or(false);
    let _ = match (modus, gedrueckt) {
        (Modus::Halten, true) => druecken(app, false),
        (Modus::Halten, false) => loslassen(app),
        // Antippen und Signalwort: Drücken startet eine Frage, nochmal Drücken beendet sie vorzeitig
        (_, true) if laeuft => loslassen(app),
        (_, true) => druecken(app, true),
        (_, false) => Ok(()),
    };
}

/// Mikrofon an. mit_vad: Ende der Frage selbst erkennen (Antippen)
pub fn druecken(app: &AppHandle, mit_vad: bool) -> Result<(), String> {
    let s = app.state::<Sprache>();
    let mut platz = s.aufnahme.lock().map_err(|_| "Interner Fehler.".to_string())?;
    if platz.is_some() {
        return Ok(());
    }
    if let Err(e) = geprueft(app) {
        melden(app, "fehler", "Installiere zuerst die Spracherkennung (Renningenieur → Sprechtaste einrichten).");
        return Err(e);
    }
    let ton = Arc::new(Mutex::new(Vec::<f32>::new()));
    let (stopp, warten) = mpsc::channel::<()>();
    let (bereit_tx, bereit_rx) = mpsc::channel::<Result<u32, String>>();
    let t = ton.clone();
    let faden = std::thread::spawn(move || aufnehmen(warten, bereit_tx, t, true));
    let rate = match bereit_rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(rate)) => rate,
        Ok(Err(e)) => {
            melden(app, "fehler", e.clone());
            return Err(e);
        }
        Err(_) => {
            let _ = stopp.send(());
            melden(app, "fehler", "Das Mikrofon reagiert nicht.");
            return Err("Mikrofon reagiert nicht".into());
        }
    };
    let nr = s.nummer.fetch_add(1, Ordering::SeqCst) + 1;
    *platz = Some(Aufnahme { nr, stopp, faden, start: Instant::now() });
    drop(platz);
    melden(app, "hoert", "");
    // Sicherheitsnetz: nach 30 s von selbst stoppen
    let a = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(MAX_AUFNAHME);
        if a.state::<Sprache>().aufnahme.lock().map(|x| x.as_ref().is_some_and(|x| x.nr == nr)).unwrap_or(false) {
            let _ = loslassen(&a);
        }
    });
    // Erkenner schon jetzt laden, falls noch nicht geschehen
    let a = app.clone();
    std::thread::spawn(move || {
        let _ = erkenner(&a);
    });
    if mit_vad {
        let a = app.clone();
        std::thread::spawn(move || ende_erkennen(&a, nr, ton, rate));
    }
    Ok(())
}

/// Antippen: beobachtet die laufende Aufnahme und beendet sie nach der ersten Sprechpause
fn ende_erkennen(app: &AppHandle, nr: u64, ton: Arc<Mutex<Vec<f32>>>, rate: u32) {
    // 0,8 s Pause = Ende der Frage (vorher 0,9 s – jede Zehntelsekunde zählt bis zur Antwort)
    let Ok(v) = vad(app, 0.8) else { return };
    let umrechner = (rate != 16_000).then(|| sherpa_onnx::LinearResampler::create(rate as i32, 16_000)).flatten();
    let start = Instant::now();
    let mut gelesen = 0usize;
    let mut rest: Vec<f32> = Vec::new();
    let mut sprach = false;
    loop {
        std::thread::sleep(Duration::from_millis(60));
        let noch_aktiv = app.state::<Sprache>().aufnahme.lock().map(|a| a.as_ref().is_some_and(|a| a.nr == nr)).unwrap_or(false);
        if !noch_aktiv {
            return;
        }
        let neu: Vec<f32> = match ton.lock() {
            Ok(t) if t.len() > gelesen => {
                let n = t[gelesen..].to_vec();
                gelesen = t.len();
                n
            }
            _ => continue,
        };
        rest.extend(match &umrechner {
            Some(u) => u.resample(&neu, false),
            None => neu,
        });
        let ganze = rest.len() / VAD_FENSTER * VAD_FENSTER;
        for fenster in rest[..ganze].chunks(VAD_FENSTER) {
            v.accept_waveform(fenster);
        }
        rest.drain(..ganze);
        if v.detected() {
            sprach = true;
        }
        if (sprach && !v.is_empty()) || (!sprach && start.elapsed() > WARTEN_AUF_SPRACHE) {
            let _ = loslassen(app);
            return;
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

/// Mitschrift einer Sprachnachricht im Messenger (wie auf der Webseite, aber auf dem PC erkannt): Ton als 16-Bit-Werte,
/// höchstens 125 s; nur wenn die Spracherkennung installiert ist. Der Ton wird nicht gespeichert.
#[tauri::command]
pub async fn sprache_mitschrift(app: AppHandle, ton: Vec<i16>, rate: u32) -> Result<String, String> {
    if !(8_000..=48_000).contains(&rate) || ton.len() > rate as usize * 125 {
        return Err("Die Aufnahme passt nicht.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let ton: Vec<f32> = ton.iter().map(|x| f32::from(*x) / 32_768.0).collect();
        if zu_leise(&ton) {
            return Ok(String::new());
        }
        erkennen(&app, &ton, rate)
    })
    .await
    .map_err(|_| "Interner Fehler.".to_string())?
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

fn normal(wort: &str) -> String {
    wort.chars().filter(|c| c.is_alphanumeric()).flat_map(char::to_lowercase).collect()
}

/// Levenshtein-Abstand (für leicht verschliffene Signalwörter)
fn abstand(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let mut zeile: Vec<usize> = (0..=b.len()).collect();
    for i in 1..=a.len() {
        let mut vorher = zeile[0];
        zeile[0] = i;
        for j in 1..=b.len() {
            let alt = zeile[j];
            zeile[j] = (zeile[j] + 1).min(zeile[j - 1] + 1).min(vorher + usize::from(a[i - 1] != b[j - 1]));
            vorher = alt;
        }
    }
    zeile[b.len()]
}

/// Beginnt der Satz mit einem Signalwort? Dann Some(Rest des Satzes, evtl. leer).
/// Echte Erkennung ist unscharf („Hey Kim“ → „Herr Ikim“), deshalb: Das Signalwort muss in den ersten Wörtern
/// stehen, darf mit einem kurzen Wort davor verschmolzen sein (Gruß wie „Hey“, „Hallo“ – höchstens 6 Buchstaben
/// davor) und bei längeren Wörtern einen Buchstaben abweichen. „Ich glaube, Kim hat recht“ löst NICHT aus.
pub fn signalwort_pruefen(text: &str, signalwoerter: &[String]) -> Option<String> {
    let woerter: Vec<&str> = text.split_whitespace().collect();
    // normalisierte Wörter mit Index ins Original
    let teile: Vec<(usize, String)> = woerter.iter().enumerate().map(|(i, w)| (i, normal(w))).filter(|(_, n)| !n.is_empty()).collect();
    let rest = |k: usize| -> String {
        let ab = teile.get(k).map(|t| t.0).unwrap_or(woerter.len());
        woerter[ab..].join(" ").trim_start_matches([',', '.', '!', '?', ':', ';', ' ']).to_string()
    };
    for sw in signalwoerter {
        let ziel: String = sw.split_whitespace().map(normal).collect();
        if ziel.chars().count() < 2 {
            continue;
        }
        let mut zusammen = String::new();
        for k in 1..=teile.len().min(sw.split_whitespace().count() + 2) {
            zusammen.push_str(&teile[k - 1].1);
            let davor = zusammen.chars().count().saturating_sub(ziel.chars().count());
            let genau = zusammen.ends_with(&ziel);
            let fast = ziel.chars().count() >= 5 && {
                let ende: String = zusammen.chars().skip(davor).collect();
                abstand(&ende, &ziel) <= toleranz(&ziel)
            };
            if (genau || fast) && davor <= 6 {
                return Some(rest(k));
            }
        }
        // Gruß + leicht verschliffenes Signalwort als eigenes Wort („Hallo Renningenieurin“, „Hey Lass“ für „Lars“).
        // Nach einem Gruß sind auch kurze Namen etwas unscharf erlaubt; ohne Gruß nur längere Wörter.
        let gruss = teile.first().is_some_and(|t| GRUSS.contains(&t.1.as_str()));
        let i = usize::from(gruss);
        let erlaubt = if gruss { toleranz(&ziel).max(usize::from(ziel.chars().count() >= 4)) } else { toleranz(&ziel) };
        if erlaubt > 0 && teile.get(i).is_some_and(|t| abstand(&klang(&t.1), &klang(&ziel)) <= erlaubt) {
            return Some(rest(i + 1));
        }
    }
    None
}

/// Grobe Lautform: Umlaute, stummes h und Doppelbuchstaben angleichen („Lars“ ≈ „Lahrs“, „Kimm“ ≈ „Kim“)
fn klang(wort: &str) -> String {
    let w = wort.replace("ä", "e").replace("ö", "o").replace("ü", "u").replace("ß", "s").replace("ck", "k").replace("ph", "f");
    let mut aus = String::new();
    for c in w.chars() {
        if c == 'h' && !aus.is_empty() {
            continue;
        }
        if aus.ends_with(c) {
            continue;
        }
        aus.push(if c == 'c' { 'k' } else { c });
    }
    aus
}

/// Erlaubte Abweichung: kurze Wörter genau, ab 5 Buchstaben einer, ab 10 Buchstaben zwei
fn toleranz(wort: &str) -> usize {
    match wort.chars().count() {
        0..=4 => 0,
        5..=9 => 1,
        _ => 2,
    }
}

/// Signalwort-Art: Mikrofon dauerhaft an (nur auf dem PC), jeder gesprochene Satz wird geprüft
fn zuhoeren(app: AppHandle, stopp: mpsc::Receiver<()>) {
    let ton = Arc::new(Mutex::new(Vec::<f32>::new()));
    let (mikro_stopp, mikro_warten) = mpsc::channel::<()>();
    let (bereit_tx, bereit_rx) = mpsc::channel::<Result<u32, String>>();
    let t = ton.clone();
    let faden = std::thread::spawn(move || aufnehmen(mikro_warten, bereit_tx, t, false));
    let rate = match bereit_rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(r)) => r,
        Ok(Err(e)) => return melden(&app, "fehler", e),
        Err(_) => return melden(&app, "fehler", "Das Mikrofon reagiert nicht."),
    };
    let ende = |app: &AppHandle| {
        let _ = mikro_stopp.send(());
        melden(app, "dauerhaft-aus", "");
    };
    // Anzeige „Mikro an“ sofort, sobald das Mikrofon läuft – auch während die Erkennung noch lädt
    melden(&app, "dauerhaft", "");
    let (Ok(v), Ok(e)) = (vad(&app, 0.7), erkenner(&app)) else {
        ende(&app);
        return melden(&app, "fehler", "Die Spracherkennung ist nicht bereit.");
    };
    let umrechner = (rate != 16_000).then(|| sherpa_onnx::LinearResampler::create(rate as i32, 16_000)).flatten();
    let mut rest: Vec<f32> = Vec::new();
    let mut frage_bis: Option<Instant> = None;
    loop {
        if stopp.recv_timeout(Duration::from_millis(80)).is_ok() || matches!(stopp.try_recv(), Err(mpsc::TryRecvError::Disconnected)) {
            break;
        }
        // Während einer Frage per Taste (Halten/Antippen) nicht doppelt hören
        let taste_aktiv = app.state::<Sprache>().aufnahme.lock().map(|a| a.is_some()).unwrap_or(false);
        let neu = std::mem::take(&mut *ton.lock().unwrap_or_else(|p| p.into_inner()));
        if taste_aktiv {
            v.reset();
            rest.clear();
            continue;
        }
        rest.extend(match &umrechner {
            Some(u) => u.resample(&neu, false),
            None => neu,
        });
        let ganze = rest.len() / VAD_FENSTER * VAD_FENSTER;
        for fenster in rest[..ganze].chunks(VAD_FENSTER) {
            v.accept_waveform(fenster);
        }
        rest.drain(..ganze);
        while let Some(satz) = v.front() {
            let proben = satz.samples().to_vec();
            v.pop();
            let stream = e.create_stream();
            stream.accept_waveform(16_000, &proben);
            e.decode(&stream);
            let text = text_bereinigen(&stream.get_result().map(|r| r.text).unwrap_or_default());
            let woerter = app.state::<Sprache>().signalwoerter.lock().map(|w| w.clone()).unwrap_or_default();
            let wartet = frage_bis.is_some_and(|b| Instant::now() < b);
            match signalwort_pruefen(&text, &woerter) {
                Some(frage) if frage.chars().filter(|c| c.is_alphanumeric()).count() >= 2 => {
                    frage_bis = None;
                    melden(&app, "signal", "");
                    melden(&app, "text", frage);
                }
                Some(_) => {
                    frage_bis = Some(Instant::now() + WARTEN_AUF_FRAGE);
                    melden(&app, "signal", "");
                    melden(&app, "hoert", "");
                }
                None if wartet && text.chars().filter(|c| c.is_alphanumeric()).count() >= 2 => {
                    frage_bis = None;
                    melden(&app, "text", text);
                }
                // kein Signalwort: Satz wird verworfen – die App zeigt nur kurz an, was sie gehört hat (bleibt auf dem PC)
                None if text.chars().filter(|c| c.is_alphanumeric()).count() >= 2 => melden(&app, "gehoert", text),
                None => {}
            }
        }
        if frage_bis.is_some_and(|b| Instant::now() >= b) {
            frage_bis = None;
            melden(&app, "leer", "");
        }
    }
    ende(&app);
    let _ = faden.join();
}

/// Art der Sprechtaste setzen; bei „signalwort“ hört das Mikrofon dauerhaft mit (bis zur nächsten Änderung)
#[tauri::command]
pub fn hoermodus_setzen(app: AppHandle, s: State<'_, Sprache>, modus: String, signalwoerter: Vec<String>) -> Result<(), String> {
    let m = match modus.as_str() {
        "halten" => Modus::Halten,
        "antippen" => Modus::Antippen,
        "signalwort" => Modus::Signalwort,
        _ => return Err("Unbekannte Art.".into()),
    };
    let woerter: Vec<String> = signalwoerter
        .iter()
        .map(|w| text_bereinigen(w))
        .filter(|w| (2..=30).contains(&w.chars().count()) && w.chars().all(|c| c.is_alphabetic() || c == ' ' || c == '-'))
        .take(6)
        .collect();
    if m == Modus::Signalwort && woerter.is_empty() {
        return Err("Bitte gib mindestens ein Signalwort an.".into());
    }
    *s.signalwoerter.lock().map_err(|_| "Interner Fehler.".to_string())? = woerter;
    *s.modus.lock().map_err(|_| "Interner Fehler.".to_string())? = m;
    // Dauerhaftes Zuhören nur in der Signalwort-Art
    let mut platz = s.zuhoeren.lock().map_err(|_| "Interner Fehler.".to_string())?;
    if let Some(alt) = platz.take() {
        let _ = alt.send(());
    }
    if m == Modus::Signalwort {
        geprueft(&app)?;
        let (tx, rx) = mpsc::channel();
        *platz = Some(tx);
        let a = app.clone();
        std::thread::spawn(move || zuhoeren(a, rx));
    }
    Ok(())
}

/// Nimmt auf, bis „stopp“ kommt; schreibt Mono-Ton in `ton`, meldet die Abtastrate über `bereit`.
/// begrenzt: höchstens 31 s sammeln (Halten/Antippen); sonst leert der Abnehmer den Speicher laufend.
fn aufnehmen(stopp: mpsc::Receiver<()>, bereit: mpsc::Sender<Result<u32, String>>, ton: Arc<Mutex<Vec<f32>>>, begrenzt: bool) -> Result<(Vec<f32>, u32), String> {
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
    // Obergrenze: 31 s (Halten/Antippen) bzw. 60 s Puffer, falls der Abnehmer hängt (Signalwort)
    let grenze = rate as usize * if begrenzt { MAX_AUFNAHME.as_secs() as usize + 1 } else { 60 };
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
    let _ = bereit.send(Ok(rate));
    if begrenzt {
        let _ = stopp.recv_timeout(MAX_AUFNAHME + Duration::from_secs(2));
    } else {
        let _ = stopp.recv();
    }
    drop(strom); // Mikrofon aus
    let daten = std::mem::take(&mut *ton.lock().map_err(|_| "Interner Fehler.".to_string())?);
    Ok((daten, rate))
}

/// Taste in der App (Knopf)
#[tauri::command]
pub fn sprechtaste(app: AppHandle, gedrueckt: bool) {
    ausloesen(&app, gedrueckt);
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
    fn signalwort_am_satzanfang() {
        let w = vec!["Kim".to_string(), "Renningenieur".to_string(), "Race Engineer".to_string()];
        assert_eq!(signalwort_pruefen("Hey Kim, reicht der Sprit?", &w).as_deref(), Some("reicht der Sprit?"));
        assert_eq!(signalwort_pruefen("kim wer fährt vor mir", &w).as_deref(), Some("wer fährt vor mir"));
        assert_eq!(signalwort_pruefen("Hallo Renningenieur.", &w).as_deref(), Some(""));
        assert_eq!(signalwort_pruefen("Okay race engineer, box this lap", &w).as_deref(), Some("box this lap"));
        assert_eq!(signalwort_pruefen("Ich glaube Kim hat recht", &w), None, "nur am Satzanfang");
        assert_eq!(signalwort_pruefen("Kimmich spielt gut", &w), None, "nur ganze Wörter");
        assert_eq!(signalwort_pruefen("", &w), None);
        // so verschleift die echte Erkennung kurze Namen
        assert_eq!(signalwort_pruefen("Herr Ikim, reicht der Sprit bis ins Ziel.", &w).as_deref(), Some("reicht der Sprit bis ins Ziel."));
        assert_eq!(signalwort_pruefen("Hallo Renningenieurin, wie weit ist es?", &w).as_deref(), Some("wie weit ist es?"));
        assert_eq!(signalwort_pruefen("Ich fahre heute ins Bar.", &w), None);
        assert_eq!(signalwort_pruefen("Das war eine gute Runde.", &w), None);
        assert_eq!(signalwort_pruefen("Wir nehmen im Rennen alles mit", &w), None);
        // kurzer Name „Lars“ (Test 26.11.): nach einem Gruß auch leicht verschliffen
        let l = vec!["Lars".to_string(), "Renningenieur".to_string()];
        assert_eq!(signalwort_pruefen("Hey Lars, reicht der Sprit?", &l).as_deref(), Some("reicht der Sprit?"));
        assert_eq!(signalwort_pruefen("Hey, Lass, reicht der Sprit?", &l).as_deref(), Some("reicht der Sprit?"));
        assert_eq!(signalwort_pruefen("He Lahrs reicht der Sprit", &l).as_deref(), Some("reicht der Sprit"));
        assert_eq!(signalwort_pruefen("Lars, wer ist vor mir?", &l).as_deref(), Some("wer ist vor mir?"));
        assert_eq!(signalwort_pruefen("Lass uns mal schauen", &l), None, "ohne Gruß nur genau");
        assert_eq!(signalwort_pruefen("Hey Leute, alles gut", &l), None);
    }

    /// Echter Ablauf der Signalwort-Art mit einer Aufnahme (nicht in CI: braucht die Modelle)
    /// GSRA_MODELL=<Ordner> GSRA_TON=<16-kHz-WAV mit Pausen> cargo test signalwort_echt -- --ignored --nocapture
    #[test]
    #[ignore]
    fn signalwort_echt() {
        let ordner = PathBuf::from(std::env::var("GSRA_MODELL").expect("GSRA_MODELL"));
        let ton = sherpa_onnx::Wave::read(&std::env::var("GSRA_TON").expect("GSRA_TON")).expect("WAV");
        assert_eq!(ton.sample_rate(), 16_000);
        let v = sherpa_onnx::VoiceActivityDetector::create(&vad_config(&ordner, 0.7), 40.0).expect("VAD");
        let e = sherpa_onnx::OfflineRecognizer::create(&erkenner_config(&ordner)).expect("Erkenner");
        let mut saetze = Vec::new();
        for fenster in ton.samples().chunks(VAD_FENSTER) {
            if fenster.len() == VAD_FENSTER {
                v.accept_waveform(fenster);
            }
            while let Some(s) = v.front() {
                let st = e.create_stream();
                st.accept_waveform(16_000, s.samples());
                e.decode(&st);
                saetze.push(text_bereinigen(&st.get_result().map(|r| r.text).unwrap_or_default()));
                v.pop();
            }
        }
        println!("Sätze: {saetze:?}");
        let w = vec!["Kim".to_string()];
        let treffer: Vec<String> = saetze.iter().filter_map(|s| signalwort_pruefen(s, &w)).collect();
        println!("Fragen nach dem Signalwort: {treffer:?}");
        assert_eq!(treffer.len(), 1, "genau ein Satz mit Signalwort");
        assert!(treffer[0].to_lowercase().contains("sprit"));
    }

    #[test]
    fn modelle_sind_fest_angegeben() {
        for (_, groesse, sha, basis) in DATEIEN {
            assert!(*groesse > 0);
            assert_eq!(sha.len(), 64);
            assert!(sha.chars().all(|c| c.is_ascii_hexdigit()));
            assert!(basis.starts_with("https://huggingface.co/csukuangfj/") || basis.starts_with("https://github.com/k2-fsa/sherpa-onnx/releases/download/"));
        }
        assert!(PARAKEET.contains("/resolve/ed5d745623472f97cfc2e6c2916ee248798fc5a8"), "feste Version");
    }
}
