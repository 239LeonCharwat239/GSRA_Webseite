//! Prüfung (nicht in CI): Ist ein veröffentlichtes Update mit dem Schlüssel der App gültig signiert – genau so, wie das
//! Update-Modul es vor dem Installieren prüft? GSRA_DATEI=<GSRA-Setup.exe> GSRA_SIGNATUR=<Datei mit der Signatur aus
//! latest.json> cargo test --release --test update_signatur -- --ignored --nocapture

use base64::Engine;

fn text(b64: &str) -> String {
    String::from_utf8(base64::engine::general_purpose::STANDARD.decode(b64.trim()).expect("base64")).expect("utf8")
}

#[test]
#[ignore]
fn veroeffentlichtes_update_ist_gueltig() {
    let konf: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json");
    let pubkey = konf["plugins"]["updater"]["pubkey"].as_str().expect("pubkey");
    let schluessel = minisign_verify::PublicKey::decode(&text(pubkey)).expect("öffentlicher Schlüssel");
    let signatur = minisign_verify::Signature::decode(&text(&std::fs::read_to_string(std::env::var("GSRA_SIGNATUR").expect("GSRA_SIGNATUR")).unwrap())).expect("Signatur");
    let daten = std::fs::read(std::env::var("GSRA_DATEI").expect("GSRA_DATEI")).expect("Datei");
    schluessel.verify(&daten, &signatur, true).expect("Signatur passt NICHT");
    println!("Signatur gültig – {}", signatur.trusted_comment());
}
