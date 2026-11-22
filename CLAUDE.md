# GSRA-Webseite – Arbeitsstandard (gilt für jede Änderung und jede neue Funktion)

Ziel: Sicherheit und Qualität werden beim Bauen erledigt, nicht später nachgearbeitet. Was hier steht,
ist das Fundament – neue Funktionen bauen darauf auf, ohne neue Protokolle oder Aufräumrunden.

## Bei jeder Funktion, von Anfang an
1. **Sicherheit gleich mitbauen**: Rechte in der Datenbank (RLS, auch „restrictive“ für gesperrte Konten),
   Schreiben nur über geprüfte Funktionen (`security definer`, fester `search_path`, `revoke … from public, anon`),
   Limits gegen Spam, Texte immer sicher ausgeben (escapen / `textContent`), nur `https`-Links,
   Dateien mit Größen- und Typgrenze. Keine Geheimnisse im Code oder im Chat.
2. **Datenbank nur über neue Migrationen**: `supabase/migrations/NNN_name.sql`, darf mehrfach laufen,
   endet mit einer Kontrollabfrage („bereit“ …). Vorher im Nachbau testen:
   `tests/db/datenbank.test.mjs` – erlaubte UND verbotene Zugriffe (Gast, Mitglied, Eigentümer, Moderator,
   Admin), beide Ausgangslagen (`ALT_SETUPS=1`). Bei Lücken erst ein Vorher-Test, der sie nachweist.
3. **TypeScript**: Neue Dateien in TypeScript. Prüfung muss 0 Fehler melden (`npm run pruefen` im Hauptordner;
   läuft auch bei jedem Push in GitHub). Bestehende Dateien werden Seite für Seite umgestellt.
4. **Im Browser prüfen** (Mock-Server `gsra-mock-test`), inkl. Handy-Breite und Schadcode-Testdaten.
5. **Berichte fortschreiben** (Claude Docs, direkt bearbeiten und abhaken):
   - Sicherheits- und Qualitätsbericht: Doc `378b554b-c465-4c11-8e3e-a66630a1b82f`, Tab `9e0f25f9-fe52`
   - Technische Bestandsaufnahme: Doc `00db0c74-2e1e-43e9-92c3-da998e19177a`, Tab `2232624b-9d00`
   Neue Funde, neue SQL-Schritte („Wartet auf euch“) und erledigte Punkte immer eintragen.
6. **Abgeben**: Commit mit Nachrichtendatei (`git commit -F`), gepusht wird von euch (GitHub Desktop).
   SQL-Dateien als Datei schicken; ihr führt sie im Supabase SQL Editor aus.

## Grenzen
- Live-Prüfungen nur lesend (öffentlicher Schlüssel, nur Zählen). Keine Passwörter oder Schlüssel eingeben.
- Keine Käufe, Tarife oder Bedingungen annehmen – das macht ihr selbst.
- Bei Unsicherheit nachfragen, statt zu raten.
