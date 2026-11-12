# Datenbank-Nachbau-Test

Prüft alle SQL-Skripte aus `supabase/migrations` in einer nachgebauten Datenbank
(PGlite: Postgres im Arbeitsspeicher, keine Verbindung zu Supabase).

- Ausgangslage: absichtlich offene Altregeln, so wie die echte Datenbank früher aussah.
- Jedes Skript läuft zweimal, damit sicher ist, dass es mehrfach ausgeführt werden darf.
- Geprüft wird beides: was erlaubt sein muss und was verboten sein muss. Das gilt für Gäste,
  angemeldete Nutzer und Admins.

## Starten

```bash
cd tests/db
npm install
npm test
```

Variante mit der alten `setups`-Tabelle, wie sie in der echten Datenbank ursprünglich war
(PowerShell): `$env:ALT_SETUPS="1"; npm test`

Am Ende steht `ALLE PRÜFUNGEN BESTANDEN` (Exit-Code 0) oder die Anzahl der Fehler (Exit-Code 1).

## Neues Skript hinzufügen

1. Neue Datei als `supabase/migrations/0NN_name.sql` anlegen (fortlaufende Nummer). Am Ende
   gehört eine Kontrollabfrage dazu.
2. Im Test einen Abschnitt mit erlaubten und verbotenen Zugriffen ergänzen.
3. `npm test` muss grün sein, bevor das Skript im Supabase SQL Editor ausgeführt wird.
