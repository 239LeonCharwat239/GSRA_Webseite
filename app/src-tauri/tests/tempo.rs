//! Messung (nicht in CI): Wo geht beim Sprechen Zeit verloren? Eigene Stimme mit 2 und 4 Threads, lange und kurze
//! Aufnahme, ganzer Spruch und erster Satz allein.
//! GSRA_TTS=<pocket-Ordner> GSRA_REFERENZ=<wav> cargo test --release --test tempo -- --ignored --nocapture

use std::time::Instant;

fn tts(ordner: &str, threads: i32) -> sherpa_onnx::OfflineTts {
    let p = |d: &str| Some(format!("{ordner}/{d}"));
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
    sherpa_onnx::OfflineTts::create(&config).expect("TTS")
}

#[test]
#[ignore]
fn wo_geht_die_zeit_hin() {
    let ordner = std::env::var("GSRA_TTS").expect("GSRA_TTS");
    let referenz = sherpa_onnx::Wave::read(&std::env::var("GSRA_REFERENZ").expect("GSRA_REFERENZ")).expect("Referenz");
    let rate = referenz.sample_rate();
    let lang = referenz.samples().to_vec();
    let kurz: Vec<f32> = lang[..lang.len().min(rate as usize * 6)].to_vec();
    println!("Aufnahme: {:.1} s (kurz: {:.1} s)", lang.len() as f32 / rate as f32, kurz.len() as f32 / rate as f32);
    let ganz = "Funkcheck. Hier ist Lars, ich höre dich laut und deutlich. Sprit reicht noch für sieben Runden, wir holen dich am Ende der dreiundzwanzigsten Runde rein.";
    let erster = "Funkcheck.";
    let zweiter = "Hier ist Lars, ich höre dich laut und deutlich.";
    for threads in [2, 4] {
        let t = Instant::now();
        let tts = tts(&ordner, threads);
        println!("\n{threads} Threads – Laden: {:?}", t.elapsed());
        for (name, ref_ton) in [("20-s-Aufnahme", &lang), ("6-s-Aufnahme", &kurz)] {
            let gc = sherpa_onnx::GenerationConfig { reference_audio: Some(ref_ton.clone()), reference_sample_rate: rate, ..Default::default() };
            for (art, text) in [("ganzer Spruch", ganz), ("erster Satz", erster), ("zweiter Satz", zweiter)] {
                let t = Instant::now();
                let a = tts.generate_with_config(text, &gc, None::<fn(&[f32], f32) -> bool>).expect("generate");
                let dauer = a.samples().len() as f32 / a.sample_rate() as f32;
                println!("  {name}, {art}: {:.2} s Rechenzeit für {dauer:.1} s Ton (Faktor {:.2})", t.elapsed().as_secs_f32(), t.elapsed().as_secs_f32() / dauer);
            }
        }
    }
}
