// Windows-Stimme als Ton (Wunsch 28.11.): Bisher sprach der Renningenieur über die Sprachausgabe des Browsers. Die kann
// immer nur EINE Stimme gleichzeitig – rief der Spotter dazwischen, musste der Satz des Renningenieurs abbrechen
// („pures Chaos“). Jetzt erzeugt Windows den Satz als WAV (Windows.Media.SpeechSynthesis, dieselben Stimmen wie in der
// Systemsteuerung) und die Oberfläche spielt ihn wie die eigene Stimme ab: durch den echten Funk-Filter, und während der
// Spotter spricht nur leiser im Hintergrund.
//
// Sicherheit: nur Text (ohne Steuerzeichen, höchstens 600 Zeichen), nur auf dem PC, nichts wird gespeichert oder gesendet.

/// Text für die Stimme: ohne Steuerzeichen, Leerraum zusammengefasst, höchstens 600 Zeichen
pub fn text_pruefen(text: &str) -> Result<String, String> {
    let sauber: String = text.chars().map(|c| if c.is_control() { ' ' } else { c }).collect();
    let sauber = sauber.split_whitespace().collect::<Vec<_>>().join(" ");
    if sauber.is_empty() {
        return Err("Kein Text".into());
    }
    Ok(sauber.chars().take(600).collect())
}

/// Passt eine Windows-Stimme? Der Browser nennt sie „Microsoft Katja - German (Germany)“, Windows „Microsoft Katja“.
/// Ohne Wunschstimme genügt die Sprache („de“ passt zu „de-DE“).
pub fn stimme_passt(anzeige: &str, sprache_win: &str, wunsch: &str, sprache: &str) -> bool {
    let basis = |s: &str| s.trim().to_lowercase().split('-').next().unwrap_or("").to_string();
    if basis(sprache).is_empty() || basis(sprache_win) != basis(sprache) {
        return false;
    }
    if wunsch.trim().is_empty() {
        return true;
    }
    let name = anzeige.trim().to_lowercase();
    let w = wunsch.trim().to_lowercase();
    // „Microsoft Katja“ passt zu „Microsoft Katja - German (Germany)“, aber nicht zu „Microsoft Katja Online (Natural) …“
    !name.is_empty() && (w == name || w.starts_with(&format!("{name} -")) || w.starts_with(&format!("{name}-")))
}
#[tauri::command]
pub async fn systemstimme(text: String, stimme: String, sprache: String, tempo: f64, hoehe: f64) -> Result<tauri::ipc::Response, String> {
    let text = text_pruefen(&text)?;
    if stimme.len() > 200 || sprache.len() > 20 {
        return Err("Ungültige Stimme".into());
    }
    let tempo = if tempo.is_finite() { tempo.clamp(0.5, 2.0) } else { 1.0 };
    let hoehe = if hoehe.is_finite() { hoehe.clamp(0.5, 1.5) } else { 1.0 };
    let ton = tauri::async_runtime::spawn_blocking(move || erzeugen(&text, &stimme, &sprache, tempo, hoehe))
        .await
        .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(ton))
}

#[cfg(windows)]
fn erzeugen(text: &str, stimme: &str, sprache: &str, tempo: f64, hoehe: f64) -> Result<Vec<u8>, String> {
    use windows::core::HSTRING;
    use windows::Media::SpeechSynthesis::SpeechSynthesizer;
    use windows::Storage::Streams::DataReader;
    let f = |e: windows::core::Error| format!("Windows-Stimme: {}", e.message());
    let synth = SpeechSynthesizer::new().map_err(f)?;
    let alle = SpeechSynthesizer::AllVoices().map_err(f)?;
    let mut gewaehlt = None;
    for i in 0..alle.Size().map_err(f)? {
        let v = alle.GetAt(i).map_err(f)?;
        let name = v.DisplayName().map_err(f)?.to_string();
        let lang = v.Language().map_err(f)?.to_string();
        if stimme_passt(&name, &lang, stimme, sprache) {
            gewaehlt = Some(v);
            break;
        }
    }
    // Nicht gefunden (z. B. eine Online-Stimme des Browsers): die Oberfläche nimmt dann die Browser-Stimme
    let v = gewaehlt.ok_or_else(|| "Diese Stimme gibt es in Windows nicht als Ton".to_string())?;
    synth.SetVoice(&v).map_err(f)?;
    let o = synth.Options().map_err(f)?;
    o.SetSpeakingRate(tempo).map_err(f)?;
    o.SetAudioPitch(hoehe).map_err(f)?;
    let strom = synth.SynthesizeTextToStreamAsync(&HSTRING::from(text)).map_err(f)?.join().map_err(f)?;
    let groesse = strom.Size().map_err(f)?;
    if groesse == 0 || groesse > 40_000_000 {
        return Err("Windows-Stimme: unerwartete Länge".into());
    }
    let leser = DataReader::CreateDataReader(&strom.GetInputStreamAt(0).map_err(f)?).map_err(f)?;
    let geladen = leser.LoadAsync(groesse as u32).map_err(f)?.join().map_err(f)?;
    let mut ton = vec![0u8; geladen as usize];
    leser.ReadBytes(&mut ton).map_err(f)?;
    if !ton.starts_with(b"RIFF") {
        return Err("Windows-Stimme: kein WAV".into());
    }
    Ok(ton)
}

#[cfg(not(windows))]
fn erzeugen(_: &str, _: &str, _: &str, _: f64, _: f64) -> Result<Vec<u8>, String> {
    Err("Nur unter Windows".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_wird_gesaeubert_und_begrenzt() {
        assert_eq!(text_pruefen("  Box\u{0}  diese\nRunde ").unwrap(), "Box diese Runde");
        assert!(text_pruefen(" \u{7} ").is_err());
        assert_eq!(text_pruefen(&"a".repeat(900)).unwrap().chars().count(), 600);
    }

    #[test]
    fn stimme_aus_dem_browser_wird_gefunden() {
        assert!(stimme_passt("Microsoft Katja", "de-DE", "Microsoft Katja - German (Germany)", "de-DE"));
        assert!(!stimme_passt("Microsoft Stefan", "de-DE", "Microsoft Katja - German (Germany)", "de-DE"));
        assert!(!stimme_passt("Microsoft Katja", "de-DE", "Microsoft Katja Online (Natural) - German (Germany)", "de-DE"), "Online-Stimmen nicht verwechseln");
        assert!(!stimme_passt("Microsoft Katja", "de-DE", "Microsoft Katja - German (Germany)", "en-US"), "falsche Sprache");
        // ohne Wunsch: die Sprache entscheidet
        assert!(stimme_passt("Microsoft Zira", "en-US", "", "en"));
        assert!(stimme_passt("Microsoft Zira", "en-US", "", "en-US"));
        assert!(!stimme_passt("Microsoft Zira", "en-US", "", "de"));
    }

    #[test]
    #[ignore] // echte Windows-Stimme: cargo test -- --ignored
    fn windows_erzeugt_wav() {
        let ton = erzeugen("Box diese Runde.", "", "de", 1.0, 1.0).expect("deutsche Windows-Stimme");
        assert!(ton.len() > 10_000 && ton.starts_with(b"RIFF"));
    }
}
