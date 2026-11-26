//! Echter Test der Spracherkennung (nicht in CI: braucht das geladene Modell und eine Testaufnahme).
//! Start: GSRA_MODELL=<Ordner> GSRA_TON=<16-kHz-WAV> cargo test --test spracherkennung -- --ignored --nocapture

#[test]
#[ignore]
fn deutsche_testaufnahme_wird_erkannt() {
    let ordner = std::env::var("GSRA_MODELL").expect("GSRA_MODELL fehlt");
    let datei = std::env::var("GSRA_TON").expect("GSRA_TON fehlt");
    let pfad = |n: &str| Some(format!("{ordner}/{n}"));
    let mut c = sherpa_onnx::OfflineRecognizerConfig::default();
    c.model_config.transducer = sherpa_onnx::OfflineTransducerModelConfig {
        encoder: pfad("encoder.int8.onnx"),
        decoder: pfad("decoder.int8.onnx"),
        joiner: pfad("joiner.int8.onnx"),
    };
    c.model_config.tokens = pfad("tokens.txt");
    c.model_config.model_type = Some("nemo_transducer".into());
    c.model_config.num_threads = 2;
    let start = std::time::Instant::now();
    let erkenner = sherpa_onnx::OfflineRecognizer::create(&c).expect("Erkenner");
    let laden = start.elapsed();
    let ton = sherpa_onnx::Wave::read(&datei).expect("WAV lesbar");
    let start = std::time::Instant::now();
    let s = erkenner.create_stream();
    s.accept_waveform(ton.sample_rate(), ton.samples());
    erkenner.decode(&s);
    let text = s.get_result().expect("Ergebnis").text;
    println!("Laden: {laden:?}, Erkennen: {:?} für {:.1} s Ton", start.elapsed(), ton.samples().len() as f32 / ton.sample_rate() as f32);
    println!("Erkannt: {text}");
    let klein = text.to_lowercase();
    assert!(klein.contains("sprit") || klein.contains("vor mir"), "unerwarteter Text: {text}");
}
