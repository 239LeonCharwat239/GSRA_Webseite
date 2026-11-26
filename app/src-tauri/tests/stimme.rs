//! Echter Test: Kann Pocket TTS (sherpa-onnx) eine Stimme aus einer kurzen Aufnahme nachbilden und DEUTSCH sprechen?
//! Prüfung ohne Ohren: Die Spracherkennung (Parakeet) schreibt mit, was herauskommt.
//! GSRA_TTS=<pocket-Ordner> GSRA_MODELL=<parakeet-Ordner> GSRA_REFERENZ=<wav> GSRA_AUSGABE=<wav>
//! cargo test --release --test stimme -- --ignored --nocapture

fn pfad(ordner: &str, datei: &str) -> Option<String> {
    Some(format!("{ordner}/{datei}"))
}

#[test]
#[ignore]
fn deutsch_mit_geklonter_stimme() {
    let tts_ordner = std::env::var("GSRA_TTS").expect("GSRA_TTS");
    let config = sherpa_onnx::OfflineTtsConfig {
        model: sherpa_onnx::OfflineTtsModelConfig {
            pocket: sherpa_onnx::OfflineTtsPocketModelConfig {
                lm_flow: pfad(&tts_ordner, "lm_flow.int8.onnx"),
                lm_main: pfad(&tts_ordner, "lm_main.int8.onnx"),
                encoder: pfad(&tts_ordner, "encoder.onnx"),
                decoder: pfad(&tts_ordner, "decoder.int8.onnx"),
                text_conditioner: pfad(&tts_ordner, "text_conditioner.onnx"),
                vocab_json: pfad(&tts_ordner, "vocab.json"),
                token_scores_json: pfad(&tts_ordner, "token_scores.json"),
                ..Default::default()
            },
            num_threads: 2,
            ..Default::default()
        },
        ..Default::default()
    };
    let start = std::time::Instant::now();
    let tts = sherpa_onnx::OfflineTts::create(&config).expect("TTS");
    let laden = start.elapsed();
    let referenz = sherpa_onnx::Wave::read(&std::env::var("GSRA_REFERENZ").expect("GSRA_REFERENZ")).expect("Referenz");
    let gc = sherpa_onnx::GenerationConfig {
        reference_audio: Some(referenz.samples().to_vec()),
        reference_sample_rate: referenz.sample_rate(),
        ..Default::default()
    };
    let saetze = [
        "Sprit reicht noch für sieben Runden. Wir holen dich in Runde dreiundzwanzig rein.",
        "Fuel is good for seven more laps, box in lap twenty three.",
    ];
    let mut c = sherpa_onnx::OfflineRecognizerConfig::default();
    let m = std::env::var("GSRA_MODELL").expect("GSRA_MODELL");
    c.model_config.transducer = sherpa_onnx::OfflineTransducerModelConfig {
        encoder: pfad(&m, "encoder.int8.onnx"),
        decoder: pfad(&m, "decoder.int8.onnx"),
        joiner: pfad(&m, "joiner.int8.onnx"),
    };
    c.model_config.tokens = pfad(&m, "tokens.txt");
    c.model_config.model_type = Some("nemo_transducer".into());
    c.model_config.num_threads = 2;
    let erkenner = sherpa_onnx::OfflineRecognizer::create(&c).expect("Erkenner");
    for (i, satz) in saetze.iter().enumerate() {
        let t = std::time::Instant::now();
        let audio = tts.generate_with_config(satz, &gc, None::<fn(&[f32], f32) -> bool>).expect("generate");
        let dauer = audio.samples().len() as f32 / audio.sample_rate() as f32;
        println!("Satz {i}: {:?} für {dauer:.1} s Ton (Laden einmalig {laden:?})", t.elapsed());
        if let Ok(ziel) = std::env::var("GSRA_AUSGABE") {
            let _ = audio.save(&ziel.replace(".wav", &format!("-{i}.wav")));
        }
        let s = erkenner.create_stream();
        s.accept_waveform(audio.sample_rate(), audio.samples());
        erkenner.decode(&s);
        println!("  Gesprochen: {satz}");
        println!("  Erkannt:    {}", s.get_result().map(|r| r.text).unwrap_or_default());
    }
}
