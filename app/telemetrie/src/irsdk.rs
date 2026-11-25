//! Auswertung des iRacing-Datenformats (Version 2) – ohne Betriebssystem, ohne `unsafe`.
//!
//! Speicheraufbau (alle Zahlen Little Endian):
//! * Kopf, 112 Byte: ver, status, tickRate, sessionInfoUpdate, sessionInfoLen, sessionInfoOffset,
//!   numVars, varHeaderOffset, numBuf, bufLen, 2× Füllung, dann 4× { tickCount, bufOffset, 2× Füllung }
//! * Variablenbeschreibungen, je 144 Byte: type, offset, count, countAsTime(+3 Füllung), name[32], desc[64], unit[32]
//! * bis zu 4 Datenzeilen (Ringpuffer); gültig ist die mit dem höchsten tickCount
//! * Sitzungsinfo: Text im YAML-Format (Strecke, Fahrzeuge, Fahrer …), Zeichensatz Latin-1

use serde::Serialize;

pub const KOPF_LAENGE: usize = 112;
pub const VARIABLE_LAENGE: usize = 144;
pub const MAX_PUFFER: usize = 4;
pub const STATUS_VERBUNDEN: i32 = 1;
pub const VERSION: i32 = 2;

// Obergrenzen gegen unsinnige Werte (echte Werte liegen weit darunter)
pub const MAX_VARIABLEN: usize = 4096;
pub const MAX_ZEILE: usize = 1 << 20; // 1 MiB je Datenzeile
pub const MAX_SITZUNGSINFO: usize = 4 << 20; // 4 MiB Text

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Fehler {
    ZuKurz,
    Version(i32),
    Ungueltig(&'static str),
}

impl std::fmt::Display for Fehler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Fehler::ZuKurz => write!(f, "Datenbereich zu kurz"),
            Fehler::Version(v) => write!(f, "unbekannte Datenversion {v}"),
            Fehler::Ungueltig(t) => write!(f, "ungültige Daten: {t}"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Puffer {
    pub tick: i32,
    pub offset: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Kopf {
    pub version: i32,
    pub status: i32,
    pub tick_rate: i32,
    pub sitzung_stand: i32,
    pub sitzung_laenge: i32,
    pub sitzung_offset: i32,
    pub anzahl_variablen: i32,
    pub variablen_offset: i32,
    pub anzahl_puffer: i32,
    pub zeilen_laenge: i32,
    pub puffer: [Puffer; MAX_PUFFER],
}

impl Kopf {
    pub fn verbunden(&self) -> bool {
        self.status & STATUS_VERBUNDEN != 0
    }

    /// Index der neuesten Datenzeile (höchster tickCount)
    pub fn neueste_zeile(&self) -> usize {
        let n = (self.anzahl_puffer.clamp(1, MAX_PUFFER as i32)) as usize;
        let mut beste = 0;
        for i in 1..n {
            if self.puffer[i].tick > self.puffer[beste].tick {
                beste = i;
            }
        }
        beste
    }

    /// Prüft alle Positionen gegen die Größe des Speicherbereichs.
    pub fn pruefen(&self, groesse: usize) -> Result<(), Fehler> {
        if self.version != VERSION {
            return Err(Fehler::Version(self.version));
        }
        let anzahl = nicht_negativ(self.anzahl_variablen, "Variablenanzahl")?;
        if anzahl == 0 || anzahl > MAX_VARIABLEN {
            return Err(Fehler::Ungueltig("Variablenanzahl"));
        }
        let start = nicht_negativ(self.variablen_offset, "Variablenposition")?;
        bereich(start, anzahl * VARIABLE_LAENGE, groesse, "Variablenbereich")?;

        let puffer = nicht_negativ(self.anzahl_puffer, "Pufferanzahl")?;
        if puffer == 0 || puffer > MAX_PUFFER {
            return Err(Fehler::Ungueltig("Pufferanzahl"));
        }
        let zeile = nicht_negativ(self.zeilen_laenge, "Zeilenlänge")?;
        if zeile == 0 || zeile > MAX_ZEILE {
            return Err(Fehler::Ungueltig("Zeilenlänge"));
        }
        for p in &self.puffer[..puffer] {
            let o = nicht_negativ(p.offset, "Zeilenposition")?;
            bereich(o, zeile, groesse, "Datenzeile")?;
        }

        let info = nicht_negativ(self.sitzung_laenge, "Sitzungsinfo-Länge")?;
        if info > MAX_SITZUNGSINFO {
            return Err(Fehler::Ungueltig("Sitzungsinfo zu groß"));
        }
        if info > 0 {
            let o = nicht_negativ(self.sitzung_offset, "Sitzungsinfo-Position")?;
            bereich(o, info, groesse, "Sitzungsinfo")?;
        }
        Ok(())
    }
}

fn nicht_negativ(v: i32, was: &'static str) -> Result<usize, Fehler> {
    usize::try_from(v).map_err(|_| Fehler::Ungueltig(was))
}

fn bereich(start: usize, laenge: usize, groesse: usize, was: &'static str) -> Result<(), Fehler> {
    match start.checked_add(laenge) {
        Some(ende) if ende <= groesse => Ok(()),
        _ => Err(Fehler::Ungueltig(was)),
    }
}

fn i32_bei(b: &[u8], pos: usize) -> Option<i32> {
    let s = b.get(pos..pos.checked_add(4)?)?;
    Some(i32::from_le_bytes([s[0], s[1], s[2], s[3]]))
}

pub fn kopf_lesen(b: &[u8]) -> Result<Kopf, Fehler> {
    if b.len() < KOPF_LAENGE {
        return Err(Fehler::ZuKurz);
    }
    let z = |i: usize| i32_bei(b, i * 4).unwrap_or(0);
    let mut puffer = [Puffer::default(); MAX_PUFFER];
    for (i, p) in puffer.iter_mut().enumerate() {
        let basis = 48 + i * 16;
        p.tick = i32_bei(b, basis).unwrap_or(0);
        p.offset = i32_bei(b, basis + 4).unwrap_or(0);
    }
    Ok(Kopf {
        version: z(0),
        status: z(1),
        tick_rate: z(2),
        sitzung_stand: z(3),
        sitzung_laenge: z(4),
        sitzung_offset: z(5),
        anzahl_variablen: z(6),
        variablen_offset: z(7),
        anzahl_puffer: z(8),
        zeilen_laenge: z(9),
        puffer,
    })
}

/// Position des tickCount der Datenzeile `i` im Kopf (zum Nachprüfen nach dem Kopieren)
pub fn tick_position(i: usize) -> usize {
    48 + i * 16
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Typ {
    Zeichen,
    Bool,
    Ganzzahl,
    Bitfeld,
    Zahl,
    Doppelt,
}

impl Typ {
    fn aus(v: i32) -> Option<Typ> {
        Some(match v {
            0 => Typ::Zeichen,
            1 => Typ::Bool,
            2 => Typ::Ganzzahl,
            3 => Typ::Bitfeld,
            4 => Typ::Zahl,
            5 => Typ::Doppelt,
            _ => return None,
        })
    }
    pub fn groesse(self) -> usize {
        match self {
            Typ::Zeichen | Typ::Bool => 1,
            Typ::Ganzzahl | Typ::Bitfeld | Typ::Zahl => 4,
            Typ::Doppelt => 8,
        }
    }
    pub fn nummer(self) -> i32 {
        match self {
            Typ::Zeichen => 0,
            Typ::Bool => 1,
            Typ::Ganzzahl => 2,
            Typ::Bitfeld => 3,
            Typ::Zahl => 4,
            Typ::Doppelt => 5,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Variable {
    pub name: String,
    pub typ: Typ,
    pub offset: usize,
    pub anzahl: usize,
}

/// Text aus einem festen Feld (endet am ersten Nullbyte); nur druckbare ASCII-Zeichen
fn feld_text(b: &[u8]) -> String {
    let ende = b.iter().position(|&c| c == 0).unwrap_or(b.len());
    b[..ende].iter().filter(|c| c.is_ascii_graphic() || **c == b' ').map(|&c| c as char).collect()
}

/// Liest alle Variablenbeschreibungen. Ungültige Einträge (falscher Typ, außerhalb der Zeile) werden
/// übersprungen statt die ganze Verbindung abzulehnen.
pub fn variablen_lesen(b: &[u8], anzahl: usize, zeilen_laenge: usize) -> Result<Vec<Variable>, Fehler> {
    if anzahl > MAX_VARIABLEN || b.len() < anzahl * VARIABLE_LAENGE {
        return Err(Fehler::ZuKurz);
    }
    let mut liste = Vec::with_capacity(anzahl);
    for i in 0..anzahl {
        let v = &b[i * VARIABLE_LAENGE..(i + 1) * VARIABLE_LAENGE];
        let Some(typ) = i32_bei(v, 0).and_then(Typ::aus) else { continue };
        let (Ok(offset), Ok(anzahl)) = (usize::try_from(i32_bei(v, 4).unwrap_or(-1)), usize::try_from(i32_bei(v, 8).unwrap_or(-1))) else { continue };
        if anzahl == 0 || anzahl > 4096 {
            continue;
        }
        match offset.checked_add(typ.groesse() * anzahl) {
            Some(ende) if ende <= zeilen_laenge => {}
            _ => continue,
        }
        let name = feld_text(&v[16..48]);
        if name.is_empty() {
            continue;
        }
        liste.push(Variable { name, typ, offset, anzahl });
    }
    Ok(liste)
}

/// Wert einer Variablen (erstes Element) als Zahl; `None`, wenn nicht lesbar oder nicht endlich
pub fn wert(zeile: &[u8], v: &Variable) -> Option<f64> {
    let s = zeile.get(v.offset..v.offset.checked_add(v.typ.groesse())?)?;
    let x = match v.typ {
        Typ::Zeichen | Typ::Bool => s[0] as f64,
        Typ::Ganzzahl | Typ::Bitfeld => i32::from_le_bytes([s[0], s[1], s[2], s[3]]) as f64,
        Typ::Zahl => f32::from_le_bytes([s[0], s[1], s[2], s[3]]) as f64,
        Typ::Doppelt => f64::from_le_bytes([s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]]),
    };
    x.is_finite().then_some(x)
}

/// Die Werte, die die App braucht (Namen wie im iRacing-SDK)
const NAMEN: [&str; 17] = [
    "SessionTime",
    "Lap",
    "LapDistPct",
    "LapDist",
    "Speed",
    "RPM",
    "Gear",
    "Throttle",
    "Brake",
    "SteeringWheelAngle",
    "FuelLevel",
    "LapCurrentLapTime",
    "LapLastLapTime",
    "LapBestLapTime",
    "IsOnTrack",
    "OnPitRoad",
    "YawNorth",
];

/// Zuordnung Name → Variable (fehlende Werte bleiben leer)
#[derive(Debug, Clone, Default)]
pub struct Karte {
    felder: [Option<Variable>; 17],
}

impl Karte {
    pub fn aus(vars: &[Variable]) -> Karte {
        let mut k = Karte::default();
        for (i, name) in NAMEN.iter().enumerate() {
            k.felder[i] = vars.iter().find(|v| v.name == *name).cloned();
        }
        k
    }
    pub fn vorhanden(&self) -> usize {
        self.felder.iter().filter(|f| f.is_some()).count()
    }
    fn zahl(&self, zeile: &[u8], i: usize) -> Option<f64> {
        self.felder[i].as_ref().and_then(|v| wert(zeile, v))
    }

    pub fn probe(&self, zeile: &[u8], tick: i32) -> Probe {
        let z = |i| self.zahl(zeile, i);
        let b = |i| self.zahl(zeile, i).map(|x| x != 0.0);
        Probe {
            tick,
            zeit: z(0),
            runde: z(1).map(|x| x as i32),
            anteil: z(2),
            meter: z(3),
            tempo: z(4),
            drehzahl: z(5),
            gang: z(6).map(|x| x as i32),
            gas: z(7),
            bremse: z(8),
            lenkung: z(9),
            sprit: z(10),
            rundenzeit: z(11),
            letzte_runde: z(12),
            beste_runde: z(13),
            auf_strecke: b(14),
            in_box: b(15),
            richtung: z(16),
        }
    }
}

/// Ein Messpunkt (Einheiten: Sekunden, Meter, m/s, U/min, Liter; Pedale 0…1; Lenkung im Bogenmaß)
#[derive(Debug, Clone, PartialEq, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Probe {
    pub tick: i32,
    pub zeit: Option<f64>,
    pub runde: Option<i32>,
    pub anteil: Option<f64>,
    pub meter: Option<f64>,
    pub tempo: Option<f64>,
    pub drehzahl: Option<f64>,
    pub gang: Option<i32>,
    pub gas: Option<f64>,
    pub bremse: Option<f64>,
    pub lenkung: Option<f64>,
    pub sprit: Option<f64>,
    pub rundenzeit: Option<f64>,
    pub letzte_runde: Option<f64>,
    pub beste_runde: Option<f64>,
    pub auf_strecke: Option<bool>,
    pub in_box: Option<bool>,
    /// Fahrtrichtung zur Nordrichtung (Bogenmaß) – daraus entsteht die Streckenkarte
    pub richtung: Option<f64>,
}

/// Strecke und Fahrzeug aus der Sitzungsinfo (nur, was die App anzeigt)
#[derive(Debug, Clone, PartialEq, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Sitzung {
    pub strecke: Option<String>,
    pub streckenlaenge_m: Option<f64>,
    pub fahrzeug: Option<String>,
    pub sitzungsart: Option<String>,
}

/// Latin-1 → Text (jedes Byte ist ein Zeichen); endet am ersten Nullbyte
pub fn latin1(b: &[u8]) -> String {
    let ende = b.iter().position(|&c| c == 0).unwrap_or(b.len());
    b[..ende].iter().map(|&c| c as char).collect()
}

/// Bereinigt einen Wert für die Anzeige: ohne Steuerzeichen, ohne Anführungszeichen außen, höchstens 80 Zeichen
fn sauber(s: &str) -> Option<String> {
    let t: String = s.trim().trim_matches('"').chars().filter(|c| !c.is_control()).take(80).collect();
    let t = t.trim().to_string();
    (!t.is_empty()).then_some(t)
}

/// Erster Wert zu `schluessel:` in den Zeilen (einfaches YAML, wie iRacing es schreibt)
fn yaml_wert<'a>(zeilen: impl Iterator<Item = &'a str>, schluessel: &str) -> Option<String> {
    for z in zeilen {
        let t = z.trim_start().trim_start_matches("- ");
        if let Some(rest) = t.strip_prefix(schluessel) {
            if let Some(w) = rest.strip_prefix(':') {
                return sauber(w);
            }
        }
    }
    None
}

pub fn sitzung_lesen(yaml: &str) -> Sitzung {
    let strecke = yaml_wert(yaml.lines(), "TrackDisplayName");
    // „TrackLength: 5.79 km“
    let streckenlaenge_m = yaml_wert(yaml.lines(), "TrackLength").and_then(|w| {
        let mut teile = w.split_whitespace();
        let zahl: f64 = teile.next()?.parse().ok()?;
        let faktor = match teile.next() {
            Some("km") | None => 1000.0,
            Some("mi") => 1609.344,
            Some("m") => 1.0,
            _ => return None,
        };
        let m = zahl * faktor;
        (m.is_finite() && m > 100.0 && m < 100_000.0).then_some(m)
    });
    // Fahrzeug: im Fahrerblock mit CarIdx == DriverCarIdx
    let fahrzeug = yaml_wert(yaml.lines(), "DriverCarIdx").and_then(|idx| {
        let mut im_block = false;
        for z in yaml.lines() {
            let t = z.trim_start();
            if let Some(rest) = t.strip_prefix("- CarIdx:") {
                im_block = rest.trim() == idx;
                continue;
            }
            if im_block {
                if let Some(w) = t.strip_prefix("CarScreenName:") {
                    return sauber(w);
                }
            }
        }
        None
    });
    // Art der aktuellen Sitzung: CurrentSessionNum → SessionType im passenden Block
    let sitzungsart = yaml_wert(yaml.lines(), "CurrentSessionNum").and_then(|nr| {
        let mut im_block = false;
        for z in yaml.lines() {
            let t = z.trim_start();
            if let Some(rest) = t.strip_prefix("- SessionNum:") {
                im_block = rest.trim() == nr;
                continue;
            }
            if im_block {
                if let Some(w) = t.strip_prefix("SessionType:") {
                    return sauber(w);
                }
            }
        }
        None
    });
    Sitzung { strecke, streckenlaenge_m, fahrzeug, sitzungsart }
}

#[cfg(test)]
pub mod testdaten {
    //! Baut einen künstlichen iRacing-Speicherbereich für Tests.
    use super::*;

    pub struct Bau {
        pub vars: Vec<(String, Typ, usize)>, // Name, Typ, Offset in der Zeile
        pub zeilen_laenge: usize,
        pub sitzung: String,
    }

    pub const VAR_START: usize = 112;

    impl Bau {
        pub fn standard() -> Bau {
            let mut vars = Vec::new();
            let mut o = 0;
            for (n, t) in [
                ("SessionTime", Typ::Doppelt),
                ("Lap", Typ::Ganzzahl),
                ("LapDistPct", Typ::Zahl),
                ("LapDist", Typ::Zahl),
                ("Speed", Typ::Zahl),
                ("RPM", Typ::Zahl),
                ("Gear", Typ::Ganzzahl),
                ("Throttle", Typ::Zahl),
                ("Brake", Typ::Zahl),
                ("SteeringWheelAngle", Typ::Zahl),
                ("FuelLevel", Typ::Zahl),
                ("LapCurrentLapTime", Typ::Zahl),
                ("LapLastLapTime", Typ::Zahl),
                ("LapBestLapTime", Typ::Zahl),
                ("IsOnTrack", Typ::Bool),
                ("OnPitRoad", Typ::Bool),
                ("YawNorth", Typ::Zahl),
            ] {
                vars.push((n.to_string(), t, o));
                o += t.groesse();
            }
            Bau { vars, zeilen_laenge: 128, sitzung: String::new() }
        }

        pub fn zeilen_start(&self) -> usize {
            VAR_START + self.vars.len() * VARIABLE_LAENGE
        }
        pub fn sitzung_start(&self) -> usize {
            self.zeilen_start() + 3 * self.zeilen_laenge
        }

        /// Speicherbereich mit 3 Datenzeilen; Zeile `neu` bekommt den höchsten tickCount
        pub fn bauen(&self, neu: usize, werte: &[(&str, f64)]) -> Vec<u8> {
            let groesse = self.sitzung_start() + self.sitzung.len() + 1;
            let mut b = vec![0u8; groesse];
            let setze = |b: &mut Vec<u8>, pos: usize, v: i32| b[pos..pos + 4].copy_from_slice(&v.to_le_bytes());
            setze(&mut b, 0, VERSION);
            setze(&mut b, 4, STATUS_VERBUNDEN);
            setze(&mut b, 8, 60);
            setze(&mut b, 12, 1);
            setze(&mut b, 16, self.sitzung.len() as i32);
            setze(&mut b, 20, self.sitzung_start() as i32);
            setze(&mut b, 24, self.vars.len() as i32);
            setze(&mut b, 28, VAR_START as i32);
            setze(&mut b, 32, 3);
            setze(&mut b, 36, self.zeilen_laenge as i32);
            for i in 0..3 {
                setze(&mut b, 48 + i * 16, if i == neu { 100 } else { 10 + i as i32 });
                setze(&mut b, 52 + i * 16, (self.zeilen_start() + i * self.zeilen_laenge) as i32);
            }
            for (i, (name, typ, offset)) in self.vars.iter().enumerate() {
                let p = VAR_START + i * VARIABLE_LAENGE;
                setze(&mut b, p, typ.nummer());
                setze(&mut b, p + 4, *offset as i32);
                setze(&mut b, p + 8, 1);
                b[p + 16..p + 16 + name.len()].copy_from_slice(name.as_bytes());
            }
            // Werte in alle Zeilen schreiben – die neueste bekommt die echten, die anderen Unsinn
            for zeile in 0..3 {
                let basis = self.zeilen_start() + zeile * self.zeilen_laenge;
                for (name, typ, offset) in &self.vars {
                    let w = if zeile == neu { werte.iter().find(|(n, _)| n == name).map(|x| x.1).unwrap_or(0.0) } else { -999.0 };
                    let p = basis + offset;
                    if offset + typ.groesse() > self.zeilen_laenge {
                        continue; // absichtlich kaputte Testvariable: nichts schreiben
                    }
                    match typ {
                        Typ::Doppelt => b[p..p + 8].copy_from_slice(&w.to_le_bytes()),
                        Typ::Zahl => b[p..p + 4].copy_from_slice(&(w as f32).to_le_bytes()),
                        Typ::Ganzzahl | Typ::Bitfeld => b[p..p + 4].copy_from_slice(&(w as i32).to_le_bytes()),
                        Typ::Bool | Typ::Zeichen => b[p] = if w != 0.0 { 1 } else { 0 },
                    }
                }
            }
            let s = self.sitzung_start();
            b[s..s + self.sitzung.len()].copy_from_slice(self.sitzung.as_bytes());
            b
        }
    }
}

#[cfg(test)]
mod tests {
    use super::testdaten::*;
    use super::*;

    #[test]
    fn kopf_und_variablen_werden_gelesen() {
        let bau = Bau::standard();
        let b = bau.bauen(1, &[("Speed", 50.0)]);
        let k = kopf_lesen(&b).unwrap();
        assert!(k.verbunden());
        assert_eq!(k.anzahl_variablen, 17);
        assert_eq!(k.neueste_zeile(), 1);
        k.pruefen(b.len()).unwrap();
        let vars = variablen_lesen(&b[VAR_START..], 17, bau.zeilen_laenge).unwrap();
        assert_eq!(vars.len(), 17);
        assert_eq!(vars[0].name, "SessionTime");
        assert_eq!(vars[0].typ, Typ::Doppelt);
    }

    #[test]
    fn probe_liest_die_neueste_zeile_mit_allen_typen() {
        let bau = Bau::standard();
        let b = bau.bauen(2, &[
            ("SessionTime", 1234.5),
            ("Lap", 7.0),
            ("LapDistPct", 0.25),
            ("Speed", 61.5),
            ("Gear", 4.0),
            ("Throttle", 1.0),
            ("FuelLevel", 42.25),
            ("IsOnTrack", 1.0),
            ("OnPitRoad", 0.0),
            ("YawNorth", 1.5),
        ]);
        let k = kopf_lesen(&b).unwrap();
        let vars = variablen_lesen(&b[VAR_START..], 17, bau.zeilen_laenge).unwrap();
        let karte = Karte::aus(&vars);
        assert_eq!(karte.vorhanden(), 17);
        let i = k.neueste_zeile();
        let o = k.puffer[i].offset as usize;
        let p = karte.probe(&b[o..o + bau.zeilen_laenge], k.puffer[i].tick);
        assert_eq!(p.zeit, Some(1234.5));
        assert_eq!(p.runde, Some(7));
        assert_eq!(p.anteil, Some(0.25));
        assert_eq!(p.tempo, Some(61.5));
        assert_eq!(p.gang, Some(4));
        assert_eq!(p.sprit, Some(42.25));
        assert_eq!(p.auf_strecke, Some(true));
        assert_eq!(p.in_box, Some(false));
        assert_eq!(p.richtung, Some(1.5));
        assert_eq!(p.tick, 100);
    }

    #[test]
    fn fehlende_variablen_bleiben_leer() {
        let mut bau = Bau::standard();
        bau.vars.retain(|(n, _, _)| n != "FuelLevel" && n != "RPM");
        let b = bau.bauen(0, &[("Speed", 10.0)]);
        let vars = variablen_lesen(&b[VAR_START..], bau.vars.len(), bau.zeilen_laenge).unwrap();
        let karte = Karte::aus(&vars);
        let k = kopf_lesen(&b).unwrap();
        let o = k.puffer[0].offset as usize;
        let p = karte.probe(&b[o..o + bau.zeilen_laenge], 1);
        assert_eq!(p.sprit, None);
        assert_eq!(p.drehzahl, None);
        assert_eq!(p.tempo, Some(10.0));
    }

    #[test]
    fn unendliche_und_nan_werte_werden_verworfen() {
        let bau = Bau::standard();
        let b = bau.bauen(0, &[("Speed", f64::NAN), ("SessionTime", f64::INFINITY)]);
        let vars = variablen_lesen(&b[VAR_START..], 17, bau.zeilen_laenge).unwrap();
        let k = kopf_lesen(&b).unwrap();
        let o = k.puffer[0].offset as usize;
        let p = Karte::aus(&vars).probe(&b[o..o + bau.zeilen_laenge], 1);
        assert_eq!(p.tempo, None);
        assert_eq!(p.zeit, None);
    }

    fn mit(b: &[u8], pos: usize, v: i32) -> Vec<u8> {
        let mut c = b.to_vec();
        c[pos..pos + 4].copy_from_slice(&v.to_le_bytes());
        c
    }

    #[test]
    fn kaputte_koepfe_werden_abgelehnt() {
        let mut bau = Bau::standard();
        bau.sitzung = "TrackDisplayName: Spa\n".into();
        let b = bau.bauen(0, &[]);
        let g = b.len();
        assert_eq!(kopf_lesen(&b[..50]).unwrap_err(), Fehler::ZuKurz);
        assert_eq!(kopf_lesen(&mit(&b, 0, 1)).unwrap().pruefen(g).unwrap_err(), Fehler::Version(1));
        // Variablen außerhalb des Bereichs, negative Werte, riesige Zahlen
        for (pos, wert) in [(24, -1), (24, 0), (24, 100_000), (28, -5), (28, g as i32), (32, 0), (32, 9), (36, 0), (36, -1), (36, 1 << 30), (52, -1), (52, g as i32 - 10), (16, -1), (16, 1 << 30), (20, g as i32)] {
            let k = kopf_lesen(&mit(&b, pos, wert)).unwrap();
            assert!(k.pruefen(g).is_err(), "Position {pos} mit {wert} hätte abgelehnt werden müssen");
        }
        // Überlauf bei Position + Länge
        let k = kopf_lesen(&mit(&mit(&b, 20, i32::MAX), 16, 100)).unwrap();
        assert!(k.pruefen(g).is_err());
    }

    #[test]
    fn variablen_ausserhalb_der_zeile_werden_uebersprungen() {
        let mut bau = Bau::standard();
        bau.vars.push(("Boese".into(), Typ::Doppelt, 125)); // 125 + 8 > 128
        let b = bau.bauen(0, &[]);
        let mut b2 = b.clone();
        // unbekannter Typ bei Variable 0
        b2[VAR_START..VAR_START + 4].copy_from_slice(&9i32.to_le_bytes());
        let vars = variablen_lesen(&b2[VAR_START..], bau.vars.len(), bau.zeilen_laenge).unwrap();
        assert!(vars.iter().all(|v| v.name != "Boese" && v.name != "SessionTime"));
        assert_eq!(vars.len(), bau.vars.len() - 2);
        // zu wenig Bytes für die angegebene Anzahl
        assert!(variablen_lesen(&b[VAR_START..VAR_START + 100], 2, 128).is_err());
    }

    #[test]
    fn variablennamen_ohne_steuerzeichen() {
        let mut feld = [0u8; 32];
        feld[..6].copy_from_slice(b"Sp\x07e<d");
        assert_eq!(feld_text(&feld), "Spe<d");
    }

    #[test]
    fn sitzungsinfo_strecke_fahrzeug_art() {
        let yaml = "---\nWeekendInfo:\n TrackName: spa\n TrackDisplayName: Circuit de Spa-Francorchamps\n TrackLength: 6.93 km\nSessionInfo:\n CurrentSessionNum: 1\n Sessions:\n - SessionNum: 0\n   SessionType: Practice\n - SessionNum: 1\n   SessionType: Race\nDriverInfo:\n DriverCarIdx: 2\n Drivers:\n - CarIdx: 0\n   CarScreenName: Pace Car\n - CarIdx: 2\n   CarScreenName: \"Porsche 911 GT3 R\"\n";
        let s = sitzung_lesen(yaml);
        assert_eq!(s.strecke.as_deref(), Some("Circuit de Spa-Francorchamps"));
        assert_eq!(s.streckenlaenge_m, Some(6930.0));
        assert_eq!(s.fahrzeug.as_deref(), Some("Porsche 911 GT3 R"));
        assert_eq!(s.sitzungsart.as_deref(), Some("Race"));
    }

    #[test]
    fn sitzungsinfo_mit_unsinn() {
        let s = sitzung_lesen("TrackLength: -3 km\nTrackDisplayName: \u{0007}\nDriverCarIdx: 9\n");
        assert_eq!(s.streckenlaenge_m, None);
        assert_eq!(s.strecke, None);
        assert_eq!(s.fahrzeug, None);
        let lang = format!("TrackDisplayName: {}\n", "x".repeat(500));
        assert_eq!(sitzung_lesen(&lang).strecke.map(|t| t.len()), Some(80));
        assert_eq!(sitzung_lesen("TrackLength: 3.2 mi").streckenlaenge_m.map(|m| m.round()), Some(5150.0));
    }

    #[test]
    fn latin1_wird_umgewandelt() {
        assert_eq!(latin1(&[0x4e, 0xfc, 0x72, 0x62, 0, 0x41]), "Nürb");
    }
}
