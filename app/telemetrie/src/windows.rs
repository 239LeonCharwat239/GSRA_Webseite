//! Öffnet den Speicherbereich von iRacing – NUR LESEND (FILE_MAP_READ).
//!
//! Der einzige `unsafe`-Code der Telemetrie steht hier: Windows-Aufrufe und das Kopieren aus dem Bereich.
//! Jede Kopie wird vorher gegen die Größe des Bereichs geprüft; gelesen wird Byte für Byte „volatile“,
//! weil die Simulation gleichzeitig schreibt (danach prüft der Leser den Zähler, siehe leser.rs).

use crate::irsdk::KOPF_LAENGE;
use crate::leser::Speicher;
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
use windows_sys::Win32::System::Memory::{
    MapViewOfFile, OpenFileMappingW, UnmapViewOfFile, VirtualQuery, FILE_MAP_READ, MEMORY_BASIC_INFORMATION,
    MEMORY_MAPPED_VIEW_ADDRESS,
};

const NAME: &str = "Local\\IRSDKMemMapFileName";

pub struct IracingSpeicher {
    handle: HANDLE,
    ansicht: MEMORY_MAPPED_VIEW_ADDRESS,
    groesse: usize,
}

// Der Bereich gehört nur diesem Objekt; es wird nur daraus kopiert.
unsafe impl Send for IracingSpeicher {}

impl IracingSpeicher {
    /// `None`, solange iRacing nicht läuft
    pub fn oeffnen() -> Option<IracingSpeicher> {
        let name: Vec<u16> = NAME.encode_utf16().chain(std::iter::once(0)).collect();
        // SAFETY: Name ist nullterminiert; alle Rückgaben werden geprüft und bei Fehlern wieder freigegeben.
        unsafe {
            let handle = OpenFileMappingW(FILE_MAP_READ, 0, name.as_ptr());
            if handle.is_null() {
                return None;
            }
            let ansicht = MapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0);
            if ansicht.Value.is_null() {
                CloseHandle(handle);
                return None;
            }
            let mut info: MEMORY_BASIC_INFORMATION = std::mem::zeroed();
            let n = VirtualQuery(ansicht.Value, &mut info, std::mem::size_of::<MEMORY_BASIC_INFORMATION>());
            if n == 0 || info.RegionSize < KOPF_LAENGE {
                UnmapViewOfFile(ansicht);
                CloseHandle(handle);
                return None;
            }
            Some(IracingSpeicher { handle, ansicht, groesse: info.RegionSize })
        }
    }
}

impl Speicher for IracingSpeicher {
    fn groesse(&self) -> usize {
        self.groesse
    }

    fn kopieren(&self, pos: usize, ziel: &mut [u8]) -> bool {
        match pos.checked_add(ziel.len()) {
            Some(ende) if ende <= self.groesse => {}
            _ => return false,
        }
        // SAFETY: pos..ende liegt innerhalb der Ansicht (oben geprüft); die Ansicht lebt so lange wie `self`.
        unsafe {
            let quelle = (self.ansicht.Value as *const u8).add(pos);
            for (i, z) in ziel.iter_mut().enumerate() {
                *z = std::ptr::read_volatile(quelle.add(i));
            }
        }
        true
    }
}

impl Drop for IracingSpeicher {
    fn drop(&mut self) {
        // SAFETY: beide wurden in `oeffnen` erfolgreich angelegt und werden genau einmal freigegeben.
        unsafe {
            UnmapViewOfFile(self.ansicht);
            CloseHandle(self.handle);
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::leser::Speicher;

    #[test]
    fn oeffnen_ohne_absturz_und_grenzen_geprueft() {
        // Ohne laufende Simulation gibt es den Bereich nicht → sauber `None`.
        // Läuft iRacing doch, muss Kopieren innerhalb klappen und außerhalb abgelehnt werden.
        if let Some(s) = super::IracingSpeicher::oeffnen() {
            let mut b = [0u8; 4];
            assert!(s.kopieren(0, &mut b));
            assert!(!s.kopieren(s.groesse() - 2, &mut b));
            assert!(!s.kopieren(usize::MAX, &mut b));
        }
    }
}
