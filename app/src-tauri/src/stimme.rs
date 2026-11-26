//! Eigene Stimme für den Renningenieur (Wunsch 26.11.: „Stimme von jemandem, der eingewilligt hat, klonen“).
//!
//! Pocket TTS (Kyutai, CC BY 4.0) über sherpa-onnx: Aus einer kurzen Aufnahme (5–20 s) spricht der Renningenieur mit
//! dieser Stimme – komplett auf dem PC, ohne Kosten je Satz. Echter Test am 26.11.: Der geklonte deutsche Satz wurde
//! von der Spracherkennung Wort für Wort richtig mitgeschrieben (tests/stimme.rs).
//!
//! Sicherheit und Datenschutz:
//! * Nur mit Zustimmung: Die Aufnahme wird nur angenommen, wenn bestätigt ist, dass die Person zugestimmt hat
//!   (oder es die eigene Stimme ist). Die App zeigt das vor der Auswahl deutlich an.
//! * Die Aufnahme bleibt im Datenordner der App auf diesem PC, wird nie hochgeladen und lässt sich jederzeit löschen.
//! * Modell nur nach Klick, feste Adresse mit fester Version, Größe und SHA-256 geprüft (beim Laden und vor der Nutzung).
//! * Grenzen: Aufnahme 3–20 s, Text höchstens 600 Zeichen; Nullzeichen werden entfernt (sonst Absturz in der C-Schnittstelle).

use crate::sprache::{laden, pruefsumme, vollstaendig, zu_leise, Datei, Fortschritt};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

/// Deutsche Fassung von Pocket TTS im sherpa-Format (haex-space, CC BY 4.0) – feste Version (Commit)
const POCKET_DE: &str =
    "https://huggingface.co/haex-space/pocket-tts-sherpa-onnx/resolve/d8f5915ed8bd94e1aa3dbd5a219360b3bb966190/de";
const DATEIEN: &[Datei] = &[
    ("decoder.int8.onnx", 22_684_077, "3fe868810d66fa0c26bb3ae0d5ee65cae83028c0fe83398bcf3d96478f68083b", POCKET_DE),
    ("encoder.onnx", 20_783_791, "c5a02b66a1720396da7edeb252aa3080603e4b079b87c5e2ffcb74c95aba2912", POCKET_DE),
    ("lm_flow.int8.onnx", 9_962_530, "2b0eb8381c49672ac1050c50221db02033b5dc6c346ab45c67bd05344257f06c", POCKET_DE),
    ("lm_main.int8.onnx", 76_341_079, "3d5e9cd303ecd26fc75b91e2766bce6de3d274d397d3ee9a392f6299366681ef", POCKET_DE),
    ("text_conditioner.onnx", 16_388_384, "de27b06fcd3901d50fdd95d669ba7a59e8311e4dba4120635eca3f3a898871b7", POCKET_DE),
    ("token_scores.json", 124_036, "cd446b01d12e68f951757bdc703fc96c31ecefa0b186b4adf569a74c571161a6", POCKET_DE),
    ("vocab.json", 69_903, "c78ab36f541fdf5971472ca589a4619a3173522680b2fd58d34c5dd443f214fc", POCKET_DE),
];
const ORDNER: &str = "pocket-tts-de";
const EREIGNIS: &str = "gsra://stimme-laden";
pub const MIN_REFERENZ_S: f32 = 3.0;
pub const MAX_REFERENZ_S: f32 = 20.0;
pub const MAX_TEXT: usize = 600;

#[derive(Default)]
pub struct Stimme {
    tts: Mutex<Option<Arc<sherpa_onnx::OfflineTts>>>,
    referenz: Mutex<Option<Arc<(Vec<f32>, i32)>>>,
    laedt: AtomicBool,
}

#[derive(serde::Serialize)]
pub struct StimmeStatus {
    installiert: bool,
    laedt: bool,
    groesse_mb: u64,
    fehlt_mb: u64,
    /// Länge der gespeicherten Aufnahme in Sekunden (null = keine)
    referenz_s: Option<f32>,
}

fn ordner(app: &AppHandle) -> Result<PathBuf, String> {
    let basis = app.path().app_local_data_dir().map_err(|_| "Kein Speicherort für die Stimme.".to_string())?;
    Ok(basis.join("sprachmodelle").join(ORDNER))
}
fn referenz_datei(app: &AppHandle) -> Result<PathBuf, String> {
    let basis = app.path().app_local_data_dir().map_err(|_| "Kein Speicherort für die Stimme.".to_string())?;
    Ok(basis.join("eigene-stimme").join("referenz.f32"))
}
fn installiert(o: &std::path::Path) -> bool {
    DATEIEN.iter().all(|(n, g, _, _)| vollstaendig(o, n, *g))
}

/// Aufnahme als kleine Rohdatei: 4 Byte Abtastrate, dann f32-Werte (alles Little Endian)
pub fn referenz_kodieren(ton: &[f32], rate: i32) -> Vec<u8> {
    let mut b = Vec::with_capacity(4 + ton.len() * 4);
    b.extend_from_slice(&rate.to_le_bytes());
    for x in ton {
        b.extend_from_slice(&x.to_le_bytes());
    }
    b
}
pub fn referenz_lesen(b: &[u8]) -> Option<(Vec<f32>, i32)> {
    if b.len() < 8 || (b.len() - 4) % 4 != 0 {
        return None;
    }
    let rate = i32::from_le_bytes(b[..4].try_into().ok()?);
    if !(8_000..=48_000).contains(&rate) {
        return None;
    }
    let ton: Vec<f32> = b[4..].chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
    let s = ton.len() as f32 / rate as f32;
    (MIN_REFERENZ_S..=MAX_REFERENZ_S + 0.5).contains(&s).then_some((ton, rate))
}

/// Prüft die Aufnahme: Abtastrate, Länge, nicht stumm; Werte auf −1…1 begrenzt
pub fn referenz_pruefen(ton: &[f32], rate: u32) -> Result<Vec<f32>, String> {
    if !(8_000..=48_000).contains(&rate) {
        return Err("Die Aufnahme hat eine ungewöhnliche Abtastrate.".into());
    }
    let s = ton.len() as f32 / rate as f32;
    if s < MIN_REFERENZ_S {
        return Err(format!("Die Aufnahme ist zu kurz ({s:.1} s) – nimm 5 bis 20 Sekunden, in denen nur diese Person spricht."));
    }
    if s > MAX_REFERENZ_S + 0.5 {
        return Err("Die Aufnahme ist zu lang – höchstens 20 Sekunden.".into());
    }
    let sauber: Vec<f32> = ton.iter().map(|x| if x.is_finite() { x.clamp(-1.0, 1.0) } else { 0.0 }).collect();
    if zu_leise(&sauber) {
        return Err("Auf der Aufnahme ist kaum etwas zu hören.".into());
    }
    Ok(sauber)
}

/// Text für die Sprachausgabe: ohne Nullzeichen und Steuerzeichen, begrenzt
pub fn text_vorbereiten(text: &str) -> Option<String> {
    let t: String = text.chars().map(|c| if c.is_control() { ' ' } else { c }).take(MAX_TEXT).collect::<String>().split_whitespace().collect::<Vec<_>>().join(" ");
    (!t.is_empty()).then_some(t)
}

#[tauri::command]
pub fn stimme_status(app: AppHandle, s: State<'_, Stimme>) -> Result<StimmeStatus, String> {
    let o = ordner(&app)?;
    let referenz_s = match s.referenz.lock().map_err(|_| "Interner Fehler.".to_string())?.as_ref() {
        Some(r) => Some(r.0.len() as f32 / r.1 as f32),
        None => fs::read(referenz_datei(&app)?).ok().and_then(|b| referenz_lesen(&b)).map(|(t, r)| t.len() as f32 / r as f32),
    };
    Ok(StimmeStatus {
        installiert: installiert(&o),
        laedt: s.laedt.load(Ordering::SeqCst),
        groesse_mb: DATEIEN.iter().map(|d| d.1).sum::<u64>().div_ceil(1_000_000),
        fehlt_mb: DATEIEN.iter().filter(|d| !vollstaendig(&o, d.0, d.1)).map(|d| d.1).sum::<u64>().div_ceil(1_000_000),
        referenz_s,
    })
}

/// Lädt das Stimm-Modell (nur nach Klick); Fortschritt über „gsra://stimme-laden“
#[tauri::command]
pub fn stimme_installieren(app: AppHandle, s: State<'_, Stimme>) -> Result<(), String> {
    let o = ordner(&app)?;
    if installiert(&o) {
        let _ = app.emit_to("main", EREIGNIS, Fortschritt { prozent: 100, fertig: true, fehler: None });
        return Ok(());
    }
    if s.laedt.swap(true, Ordering::SeqCst) {
        return Err("Das Stimm-Modell wird schon geladen.".into());
    }
    std::thread::spawn(move || {
        let ergebnis = laden(&app, &o, DATEIEN, EREIGNIS);
        app.state::<Stimme>().laedt.store(false, Ordering::SeqCst);
        let f = match ergebnis {
            Ok(()) => Fortschritt { prozent: 100, fertig: true, fehler: None },
            Err(e) => Fortschritt { prozent: 0, fertig: false, fehler: Some(e) },
        };
        let _ = app.emit_to("main", EREIGNIS, f);
    });
    Ok(())
}

/// Aufnahme übernehmen – nur mit bestätigter Zustimmung der Person. Gibt die Länge in Sekunden zurück.
/// Der Ton kommt als 16-Bit-Werte (halb so viel Daten wie Kommazahlen).
#[tauri::command]
pub fn stimme_referenz_setzen(app: AppHandle, s: State<'_, Stimme>, ton: Vec<i16>, rate: u32, einverstanden: bool) -> Result<f32, String> {
    if !einverstanden {
        return Err("Bitte bestätige zuerst, dass die Person zugestimmt hat (oder dass es deine eigene Stimme ist).".into());
    }
    if ton.len() > (MAX_REFERENZ_S as usize + 1) * 48_000 {
        return Err("Die Aufnahme ist zu lang – höchstens 20 Sekunden.".into());
    }
    let ton: Vec<f32> = ton.iter().map(|x| f32::from(*x) / 32_768.0).collect();
    let sauber = referenz_pruefen(&ton, rate)?;
    let datei = referenz_datei(&app)?;
    if let Some(o) = datei.parent() {
        fs::create_dir_all(o).map_err(|_| "Ordner für die Aufnahme lässt sich nicht anlegen.".to_string())?;
    }
    fs::write(&datei, referenz_kodieren(&sauber, rate as i32)).map_err(|_| "Die Aufnahme lässt sich nicht speichern.".to_string())?;
    let laenge = sauber.len() as f32 / rate as f32;
    *s.referenz.lock().map_err(|_| "Interner Fehler.".to_string())? = Some(Arc::new((sauber, rate as i32)));
    Ok(laenge)
}

/// Aufnahme löschen (Datei und Arbeitsspeicher)
#[tauri::command]
pub fn stimme_referenz_loeschen(app: AppHandle, s: State<'_, Stimme>) -> Result<(), String> {
    *s.referenz.lock().map_err(|_| "Interner Fehler.".to_string())? = None;
    let datei = referenz_datei(&app)?;
    if datei.exists() {
        fs::remove_file(&datei).map_err(|_| "Die Aufnahme ließ sich nicht löschen.".to_string())?;
    }
    Ok(())
}

fn tts(app: &AppHandle) -> Result<Arc<sherpa_onnx::OfflineTts>, String> {
    let s = app.state::<Stimme>();
    let mut platz = s.tts.lock().map_err(|_| "Interner Fehler.".to_string())?;
    if let Some(t) = platz.as_ref() {
        return Ok(t.clone());
    }
    let o = ordner(app)?;
    if !installiert(&o) {
        return Err("Das Stimm-Modell ist noch nicht (vollständig) geladen.".into());
    }
    for (name, _, sha, _) in DATEIEN {
        if pruefsumme(&o.join(name))? != *sha {
            return Err(format!("{name} ist beschädigt – bitte das Stimm-Modell neu laden."));
        }
    }
    let p = |n: &str| Some(o.join(n).to_string_lossy().into_owned());
    let threads = std::thread::available_parallelism().map(|n| n.get().clamp(1, 4)).unwrap_or(2) as i32;
    let config = sherpa_onnx::OfflineTtsConfig {
        model: sherpa_onnx::OfflineTtsModelConfig {
            pocket: sherpa_onnx::OfflineTtsPocketModelConfig {
                lm_flow: p("lm_flow.int8.onnx"),
                lm_main: p("lm_main.int8.onnx"),
                encoder: p("encoder.onnx"),
                decoder: p("decoder.int8.onnx"),
                text_conditioner: p("text_conditioner.onnx"),
                vocab_json: p("vocab.json"),
                token_scores_json: p("token_scores.json"),
                ..Default::default()
            },
            num_threads: threads,
            ..Default::default()
        },
        ..Default::default()
    };
    let t = Arc::new(sherpa_onnx::OfflineTts::create(&config).ok_or_else(|| "Die Sprachausgabe ließ sich nicht starten.".to_string())?);
    *platz = Some(t.clone());
    Ok(t)
}

fn referenz(app: &AppHandle) -> Result<Arc<(Vec<f32>, i32)>, String> {
    let s = app.state::<Stimme>();
    let mut platz = s.referenz.lock().map_err(|_| "Interner Fehler.".to_string())?;
    if let Some(r) = platz.as_ref() {
        return Ok(r.clone());
    }
    let b = fs::read(referenz_datei(app)?).map_err(|_| "Noch keine Aufnahme für die eigene Stimme gewählt.".to_string())?;
    let r = Arc::new(referenz_lesen(&b).ok_or_else(|| "Die gespeicherte Aufnahme ist beschädigt – bitte neu wählen.".to_string())?);
    *platz = Some(r.clone());
    Ok(r)
}

/// Text mit der eigenen Stimme sprechen. Antwort: 4 Byte Abtastrate + f32-Werte (Little Endian); abgespielt wird in
/// der Oberfläche – so läuft die Stimme durch den echten Funk-Filter.
#[tauri::command]
pub async fn stimme_sprechen(app: AppHandle, text: String) -> Result<tauri::ipc::Response, String> {
    let text = text_vorbereiten(&text).ok_or_else(|| "Kein Text.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let tts = tts(&app)?;
        let r = referenz(&app)?;
        let gc = sherpa_onnx::GenerationConfig {
            reference_audio: Some(r.0.clone()),
            reference_sample_rate: r.1,
            ..Default::default()
        };
        let audio = tts.generate_with_config(&text, &gc, None::<fn(&[f32], f32) -> bool>).ok_or_else(|| "Die Stimme konnte den Satz nicht sprechen.".to_string())?;
        Ok(tauri::ipc::Response::new(referenz_kodieren(audio.samples(), audio.sample_rate())))
    })
    .await
    .map_err(|_| "Interner Fehler.".to_string())?
}

/// Modell im Hintergrund laden (erster Satz kommt dann schneller)
#[tauri::command]
pub fn stimme_vorbereiten(app: AppHandle) {
    std::thread::spawn(move || {
        let _ = tts(&app);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aufnahme_hin_und_zurueck() {
        let ton: Vec<f32> = (0..16_000 * 5).map(|i| (i as f32 * 0.05).sin() * 0.3).collect();
        let b = referenz_kodieren(&ton, 16_000);
        let (t, r) = referenz_lesen(&b).expect("lesbar");
        assert_eq!(r, 16_000);
        assert_eq!(t, ton);
        // beschädigt, falsche Rate, zu kurz
        assert!(referenz_lesen(&b[..7]).is_none());
        assert!(referenz_lesen(&referenz_kodieren(&ton, 1_000)).is_none());
        assert!(referenz_lesen(&referenz_kodieren(&ton[..16_000], 16_000)).is_none());
    }

    #[test]
    fn aufnahme_pruefen() {
        let sprache: Vec<f32> = (0..16_000 * 6).map(|i| (i as f32 * 0.05).sin() * 0.3).collect();
        assert!(referenz_pruefen(&sprache, 16_000).is_ok());
        assert!(referenz_pruefen(&sprache[..16_000], 16_000).unwrap_err().contains("zu kurz"));
        assert!(referenz_pruefen(&vec![0.1; 16_000 * 25], 16_000).unwrap_err().contains("zu lang"));
        assert!(referenz_pruefen(&vec![0.0; 16_000 * 6], 16_000).unwrap_err().contains("kaum"));
        assert!(referenz_pruefen(&sprache, 4_000).is_err());
        // kaputte Werte werden begrenzt statt durchgereicht
        let mut wild = sprache.clone();
        wild[10] = f32::NAN;
        wild[11] = 7.0;
        let s = referenz_pruefen(&wild, 16_000).unwrap();
        assert_eq!(s[10], 0.0);
        assert_eq!(s[11], 1.0);
    }

    #[test]
    fn text_ohne_nullzeichen() {
        assert_eq!(text_vorbereiten("Box\0 in\n Runde 23 ").as_deref(), Some("Box in Runde 23"));
        assert_eq!(text_vorbereiten("  \0 ").as_deref(), None);
        assert_eq!(text_vorbereiten(&"a".repeat(2000)).map(|t| t.len()), Some(MAX_TEXT));
    }
}
