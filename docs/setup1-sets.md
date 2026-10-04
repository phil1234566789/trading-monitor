# Versionierte Setup 1 Eingabesätze

`scripts/setup1BuildSets.mjs` baut GBPUSD, EURUSD und XAUUSD aus eingefrorenen nativen
FXCM-Bid-M5/H1-Kerzen neu auf. Es liest Supabase ausschließlich über GET und schreibt lokal.
Erkennungsregeln, Live-Zeilen und Produktion bleiben unverändert.

## Ablage und Backup

- `local-data/setup1-builds/<Snapshot>/`: eingefrorene Kerzen, Live-Zeilen, Einstellungen,
  `input.json`, Erkennungsbundle `recognition.mjs`, `report.json` und lesbarer `report.html`.
- `local-data/setup1-sets/<Satz-ID>/`: pro Instrument `manifest.json`, `sources.json`,
  `comparison.json`, `M5.json`, `H1.json`, `live.json`, `input.json` und `recognition.mjs`.

Beide Ordner sind über `.gitignore` ausgeschlossen. **Vollständig extern sichern**;
Git sichert diese Daten nicht. Der Neuaufbau erstellt kein automatisches Backup.

## Erstellen und wiederholen

```powershell
node scripts/setup1BuildSets.mjs
node scripts/setup1BuildSets.mjs --snapshot=local-data/setup1-builds/<Snapshot>
```

Der erste Befehl braucht die vorhandene `.env` und lesenden Netzwerkzugriff. Standard:
1. Januar 2026, Mitternacht Berlin, bis zum Startzeitpunkt. `--from` und `--to` akzeptieren
ISO-Zeitstempel mit expliziter Zeitzone. `--cache=<Ordner>` kann einen vorhandenen Kerzen-Cache
verwenden. Der zweite Befehl liest ausschließlich den vorhandenen Snapshot und sein
Erkennungsbundle; Kerzen-, Live- und Bundle-Hashes werden vor dem Replay geprüft.

Die Erkennung verwendet 300 M5- und bis zu 3000 H1-Kerzen, erste Erkennung je OB gewinnt.
Der alte Backfill und der neue Satz teilen `setup1Replay.ts`; der alte Backfill behält
Fenster, Parameter und Zeitsemantik seiner bisherigen Aufrufe. Im neuen Satz gelten
heutige Gold-Skalierung, heutige Ignore-Sessions und die aktuelle feste Konfiguration
rückwirkend für das ganze Jahr. Erkennung läuft wie heute live rund um die Uhr;
Handels-/Alarmfenster sind im Manifest dokumentiert und begrenzen keine Setup-Erkennung.

Nur geschlossene Kerzen werden benutzt. `created_at` im Satz ist der simulierte
M5-Schluss. Zeitgleiche H1-Schlüsse sind dann verfügbar; `nowTime` für die Erkennungsregeln
bleibt die Öffnungszeit der letzten M5-Kerze, wie im Live-Aufruf. Historische Tickpreise
fehlen: H1-Touches werden aus verfügbaren M5-Kerzen rekonstruiert. Live-Feldgleichheit
ist deshalb kein Versprechen des Neuaufbaus. Die Archivabfragen sind keine DB-Transaktion;
die gespeicherten Dateien und SHA-256-Hashes definieren den tatsächlich benutzten Stand.

## Schlüssel und Abgleich

`setup_key = Instrument:Richtung:OB-Zeit-in-Unix-Sekunden` entspricht dem natürlichen
Live-Unique-Key. Bei gleichem Schlüssel trägt die Satzzeile `live_id` und `id` der
Live-Zeile; bei zusätzlichen Setups ist `live_id=null` und `id=setup_key`.
Eine zugeordnete Live-ID besagt nur Schlüsselgleichheit, keine Feldgleichheit.

`comparison.json` zählt pro Berlin-Kalendermonat gemeinsame Schlüssel, exakt gleiche
Felder, gleiche Erkennungsfelder, Live-only und Neuaufbau-only. Erkennungsfeldgleichheit
ignoriert `created_at`, `alert_price` und numerische DB-Rundung unter 1e-12;
der exakte Vergleich bewahrt auch diese Rohabweichungen. Sweeps werden unabhängig von
der DB-Rückgabereihenfolge verglichen. Gemeinsame Schlüssel zählen im Neuaufbau-Monat,
Live-only im ursprünglichen `created_at`-Monat; Monatswechsel stehen in der Abweichungsliste.
Benachrichtigungszustand, Zone-FK und sonstige DB-Metadaten sind keine Erkennungsfelder.

3125 und 5491 werden vollständig als Referenzen abgeglichen: fehlende Schlüssel oder
abweichende Felder werden benannt, niemals mit Live-Werten „repariert“.
4986 wird ebenfalls separat geprüft und im Live-Snapshot unverändert erhalten.
Das Manifest kennzeichnet Golds fehlenden Jahresvorlauf, erstes volles M5/H1-Fenster
und erstes Datum mit beiden vollen Fenstern. Frühe Gold-Ergebnisse verwenden verkürzte
H1-Historie. Für vollständigen Vorlauf wären ältere Gold-Kerzen nötig;
eine FXCM-Quellenprobe ist nicht Teil dieses Neuaufbaus.

## Verwendung im Jahreslauf

```powershell
node scripts/tradeSetup2YearRun.mjs --setupSet=setup1-<24-stellige-Hash-ID> --settings=<Datei> --output=.debug/<neuer-Lauf>
```

Ein Satz deckt genau ein Instrument ab. Instrument und Endzeit werden standardmäßig
aus seinem Manifest übernommen. Der Loader prüft Vollständigkeit, Instrument,
Zeitraumabdeckung und Zeilen-Hash; der Jahreslauf kopiert die gelesenen Quellen und
das Satzmanifest in seine Eingaben/Provenienz. Ein vorhandener Lauf darf weder zu
einem anderen Satz noch zurück zum Live-Bestand wechseln. `--setupIds=3125,5491`
filtert weiterhin nach den mitgeführten Live-IDs. Golds Setup-1-Satz ist verfügbar,
die bestehende Setup-2-Jahressimulation benötigt weiterhin M1 und akzeptiert Gold nicht.
