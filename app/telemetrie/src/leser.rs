//! Liest Schritt für Schritt aus einem Speicherbereich: Kopf → Variablen (einmal) → neueste Datenzeile.
//!
//! Die Simulation schreibt, während wir lesen. Deshalb kopieren wir die Zeile und schauen danach, ob ihr
//! Zähler (tickCount) noch derselbe ist – sonst wurde sie währenddessen überschrieben und wir versuchen es
//! erneut (so macht es auch das offizielle SDK).

use crate::irsdk::{self, Fehler, Karte, Kopf, Probe, Sitzung, KOPF_LAENGE, VARIABLE_LAENGE};

/// Ein Speicherbereich, aus dem nur kopiert wird (echter Bereich oder Testdaten)
pub trait Speicher {
    fn groesse(&self) -> usize;
    /// Kopiert `ziel.len()` Bytes ab `pos`; `false`, wenn der Bereich das nicht hergibt
    fn kopieren(&self, pos: usize, ziel: &mut [u8]) -> bool;
}

impl Speicher for [u8] {
    fn groesse(&self) -> usize {
        self.len()
    }
    fn kopieren(&self, pos: usize, ziel: &mut [u8]) -> bool {
        match pos.checked_add(ziel.len()).and_then(|ende| self.get(pos..ende)) {
            Some(q) => {
                ziel.copy_from_slice(q);
                true
            }
            None => false,
        }
    }
}

impl Speicher for Vec<u8> {
    fn groesse(&self) -> usize {
        self.len()
    }
    fn kopieren(&self, pos: usize, ziel: &mut [u8]) -> bool {
        self.as_slice().kopieren(pos, ziel)
    }
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct Lesung {
    pub verbunden: bool,
    pub probe: Option<Probe>,
    pub sitzung: Option<Sitzung>,
}

#[derive(Default)]
pub struct Leser {
    karte: Option<Karte>,
    schluessel: (i32, i32, i32),
    letzter_tick: Option<i32>,
    sitzung_stand: Option<i32>,
    zeile: Vec<u8>,
}

const VERSUCHE: usize = 3;

impl Leser {
    pub fn new() -> Leser {
        Leser::default()
    }

    /// Vergisst alles (z. B. nach einem Neustart der Simulation)
    pub fn zuruecksetzen(&mut self) {
        *self = Leser::default();
    }

    fn kopf<S: Speicher + ?Sized>(s: &S) -> Result<Kopf, Fehler> {
        let mut b = [0u8; KOPF_LAENGE];
        if !s.kopieren(0, &mut b) {
            return Err(Fehler::ZuKurz);
        }
        irsdk::kopf_lesen(&b)
    }

    pub fn lesen<S: Speicher + ?Sized>(&mut self, s: &S) -> Result<Lesung, Fehler> {
        let kopf = Self::kopf(s)?;
        if !kopf.verbunden() {
            self.zuruecksetzen();
            return Ok(Lesung::default());
        }
        kopf.pruefen(s.groesse())?;
        let mut lesung = Lesung { verbunden: true, ..Default::default() };

        // Variablen nur neu lesen, wenn sich ihr Aufbau geändert hat
        let schluessel = (kopf.anzahl_variablen, kopf.variablen_offset, kopf.zeilen_laenge);
        if self.karte.is_none() || self.schluessel != schluessel {
            let n = kopf.anzahl_variablen as usize;
            let mut b = vec![0u8; n * VARIABLE_LAENGE];
            if !s.kopieren(kopf.variablen_offset as usize, &mut b) {
                return Err(Fehler::ZuKurz);
            }
            let vars = irsdk::variablen_lesen(&b, n, kopf.zeilen_laenge as usize)?;
            self.karte = Some(Karte::aus(&vars));
            self.schluessel = schluessel;
            self.sitzung_stand = None;
            self.letzter_tick = None;
        }

        // Sitzungsinfo (Strecke, Fahrzeug) nur, wenn sie sich geändert hat
        if kopf.sitzung_laenge > 0 && self.sitzung_stand != Some(kopf.sitzung_stand) {
            let mut b = vec![0u8; kopf.sitzung_laenge as usize];
            if s.kopieren(kopf.sitzung_offset as usize, &mut b) {
                lesung.sitzung = Some(irsdk::sitzung_lesen(&irsdk::latin1(&b)));
                self.sitzung_stand = Some(kopf.sitzung_stand);
            }
        }

        let Some(karte) = self.karte.as_ref() else { return Ok(lesung) };
        let mut kopf = kopf;
        for versuch in 0..VERSUCHE {
            if versuch > 0 {
                kopf = Self::kopf(s)?;
                kopf.pruefen(s.groesse())?;
                if (kopf.anzahl_variablen, kopf.variablen_offset, kopf.zeilen_laenge) != self.schluessel {
                    return Ok(lesung); // Aufbau geändert – beim nächsten Aufruf neu einlesen
                }
            }
            let i = kopf.neueste_zeile();
            let tick = kopf.puffer[i].tick;
            if self.letzter_tick == Some(tick) {
                return Ok(lesung); // nichts Neues
            }
            self.zeile.resize(kopf.zeilen_laenge as usize, 0);
            if !s.kopieren(kopf.puffer[i].offset as usize, &mut self.zeile) {
                return Err(Fehler::ZuKurz);
            }
            let mut nachher = [0u8; 4];
            if !s.kopieren(irsdk::tick_position(i), &mut nachher) {
                return Err(Fehler::ZuKurz);
            }
            if i32::from_le_bytes(nachher) == tick {
                self.letzter_tick = Some(tick);
                lesung.probe = Some(karte.probe(&self.zeile, tick));
                return Ok(lesung);
            }
        }
        Ok(lesung) // dreimal überschrieben – beim nächsten Mal
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::irsdk::testdaten::Bau;
    use std::cell::{Cell, RefCell};

    #[test]
    fn liest_probe_und_meldet_nichts_neues_beim_gleichen_tick() {
        let mut bau = Bau::standard();
        bau.sitzung = "TrackDisplayName: Monza\nTrackLength: 5.79 km\n".into();
        let b = bau.bauen(1, &[("Speed", 80.0), ("Lap", 3.0)]);
        let mut l = Leser::new();
        let r = l.lesen(&b).unwrap();
        assert!(r.verbunden);
        assert_eq!(r.probe.as_ref().unwrap().tempo, Some(80.0));
        assert_eq!(r.sitzung.as_ref().unwrap().strecke.as_deref(), Some("Monza"));
        // zweiter Aufruf: gleicher Tick, gleiche Sitzungsinfo → nichts
        let r2 = l.lesen(&b).unwrap();
        assert!(r2.verbunden && r2.probe.is_none() && r2.sitzung.is_none());
    }

    #[test]
    fn nicht_verbunden_setzt_zurueck() {
        let bau = Bau::standard();
        let mut b = bau.bauen(0, &[]);
        b[4..8].copy_from_slice(&0i32.to_le_bytes());
        let mut l = Leser::new();
        assert_eq!(l.lesen(&b).unwrap(), Lesung::default());
    }

    #[test]
    fn sitzungsinfo_nur_bei_aenderung() {
        let mut bau = Bau::standard();
        bau.sitzung = "TrackDisplayName: Spa\n".into();
        let mut b = bau.bauen(0, &[]);
        let mut l = Leser::new();
        assert!(l.lesen(&b).unwrap().sitzung.is_some());
        b[48..52].copy_from_slice(&500i32.to_le_bytes()); // neuer Tick in Zeile 0
        assert!(l.lesen(&b).unwrap().sitzung.is_none());
        b[12..16].copy_from_slice(&2i32.to_le_bytes()); // sessionInfoUpdate erhöht
        assert!(l.lesen(&b).unwrap().sitzung.is_some());
    }

    #[test]
    fn kaputter_bereich_gibt_fehler_statt_absturz() {
        let bau = Bau::standard();
        let b = bau.bauen(0, &[]);
        let mut l = Leser::new();
        assert!(l.lesen(&b[..60]).is_err());
        assert!(l.lesen(&b[..bau.zeilen_start() + 10]).is_err());
        let mut c = b.clone();
        c[24..28].copy_from_slice(&i32::MAX.to_le_bytes());
        assert!(l.lesen(&c).is_err());
    }

    /// Simuliert die Simulation, die während des Kopierens der Zeile schreibt
    struct Schreibend {
        daten: RefCell<Vec<u8>>,
        zeilen_start: usize,
        stoerungen: Cell<usize>,
    }

    impl Speicher for Schreibend {
        fn groesse(&self) -> usize {
            self.daten.borrow().len()
        }
        fn kopieren(&self, pos: usize, ziel: &mut [u8]) -> bool {
            let ok = self.daten.borrow().kopieren(pos, ziel);
            if pos >= self.zeilen_start && self.stoerungen.get() > 0 {
                // nach dem Kopieren einer Zeile erhöht „die Simulation“ den Zähler der neuesten Zeile
                self.stoerungen.set(self.stoerungen.get() - 1);
                let mut d = self.daten.borrow_mut();
                let t = i32::from_le_bytes([d[48], d[49], d[50], d[51]]) + 1;
                d[48..52].copy_from_slice(&t.to_le_bytes());
            }
            ok
        }
    }

    #[test]
    fn ueberschriebene_zeile_wird_verworfen_und_neu_gelesen() {
        let bau = Bau::standard();
        let s = Schreibend { daten: RefCell::new(bau.bauen(0, &[("Speed", 33.0)])), zeilen_start: bau.zeilen_start(), stoerungen: Cell::new(1) };
        let mut l = Leser::new();
        let r = l.lesen(&s).unwrap();
        // erster Versuch verworfen, zweiter gilt (mit dem neuen Zähler)
        assert_eq!(r.probe.unwrap().tick, 101);

        let s2 = Schreibend { daten: RefCell::new(bau.bauen(0, &[])), zeilen_start: bau.zeilen_start(), stoerungen: Cell::new(10) };
        let mut l2 = Leser::new();
        let r2 = l2.lesen(&s2).unwrap();
        assert!(r2.verbunden && r2.probe.is_none(), "nach drei gestörten Versuchen keine halbe Zeile ausgeben");
    }

    #[test]
    fn zufaellige_daten_fuehren_nie_zum_absturz() {
        // einfacher Zufallsgenerator (ohne zusätzliche Pakete)
        let mut x: u64 = 0x9E37_79B9_7F4A_7C15;
        let mut zufall = || {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            x
        };
        let bau = Bau::standard();
        let echt = bau.bauen(0, &[("Speed", 1.0)]);
        for _ in 0..3000 {
            let mut b = echt.clone();
            for _ in 0..(zufall() % 12 + 1) {
                let pos = (zufall() as usize) % b.len().min(KOPF_LAENGE + 16 * VARIABLE_LAENGE);
                b[pos] = zufall() as u8;
            }
            let laenge = if zufall() % 4 == 0 { (zufall() as usize) % b.len() } else { b.len() };
            let mut l = Leser::new();
            let _ = l.lesen(&b[..laenge]);
            let _ = l.lesen(&b[..laenge]);
        }
    }
}
