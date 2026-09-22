# FXCM-Kerzenfeed

GBPUSD/EURUSD verwenden geschlossene native **FXCM-Bid-Kerzen**. Der ForexConnect-Collector läuft unabhängig vom PC auf dem Netcup-VPS. Er handelt nicht und öffnet keine Orders.

## Datenfluss

`services/fxcm/collector.py` → SQLite-Puffer → `fxcm-ingest` → `fxcm_candles` → `forex_candles` (nur lesbare Sicht) → Chart, MCP, Auswertung.

- M1/M3/M5/M15/H1/H4/D1 werden nativ abgerufen, nicht aus anderen Zeitrahmen zusammengesetzt.
- Abfrage kurz nach Minutenschluss mit zehn Sekunden Abschlussabstand. Offene Kerzen werden sowohl im Collector als auch im Ingest abgewiesen.
- Neue Datensätze sind unveränderlich; Schlüssel: Instrument, Zeitrahmen und Startzeit. Fehlgeschlagene Uploads bleiben im lokalen Puffer und werden erneut versucht.
- M1/M3/M5/M15 ab Januar 2026; H1/H4 ab Juni 2025; D1 ab Oktober 2022. Laufende Erweiterung für beide Instrumente.
- H4/D1 folgen den nativen FXCM-Handelstagsgrenzen. Keine festen Berlin- oder UTC-H4-Buckets konstruieren.
- `poi-watcher` liest M5/H1/H4 pro Auswertung aus dem Archiv. Er läuft alle fünf Minuten eine Minute nach der M5-Grenze. M5 älter als 15 Minuten führt zum Fehler statt zu einer Auswertung mit veralteten Kursen.
- H1/H4 werden nur bei einer neuen archivierten Schlusskerze neu ausgewertet; `forex_h1_cache` hält den erfolgreich verarbeiteten Stand. M5-Touch-Prüfungen laufen immer. Schreibzugriffe werden gebündelt, bestehende Objekte vollständig paginiert.
- Daily-Pivots werden stündlich idempotent aktualisiert. Alarmfenster und verbotene Sessions bleiben unverändert wirksam.

## Betrieb

Server: `v2202609424718526359.nicesrv.de`, Anwendung unter `/opt/fxcm`.

- Container `fxcm-collector`, Neustart automatisch; keine veröffentlichten Ports, Benutzer 10001, schreibgeschütztes Dateisystem, begrenzter Speicher und rotierende Logs.
- Konfiguration `/opt/fxcm/fxcm.env`, nur für Collector-Benutzer lesbar. Zugangsdaten und `FXCM_INGEST_TOKEN` gehören niemals ins Repository oder in Ausgaben.
- Daten `/opt/fxcm/data/candles.sqlite`; `uploaded=0` ist der noch ausstehende Upload-Bestand.
- Container-Healthcheck kontrolliert den Heartbeat. `fxcm-watchdog.timer` prüft jede Minute und startet einen festhängenden Collector neu.
- Prüfen: Containerstatus, letzte Fortschrittszeilen, ausstehende Uploads und `max(time)` je Instrument/Zeitreihe in `fxcm_candles`.
- Historie: dasselbe Image mit `--backfill --start YYYY-MM-DD --end YYYY-MM-DD --bars 1h,4h`; derselbe Daten-/Secret-Mount. Checkpoints erlauben Wiederaufnahme.
- Die Python-Anbindung von ForexConnect benötigt das alte CPython-3.7-Wheel. Die Isolation reduziert die Angriffsfläche, ersetzt aber keine zukünftige SDK-/Runtime-Aktualisierung. Der Zugang ist ein FXCM-Demokonto; bei dessen Ablauf müssen neue Zugangsdaten hinterlegt werden.

## Umstellung und Sicherung

Am 22.09.2026 wurde nach Philips Freigabe der alte Forex-Bestand ersetzt. Vorher wurden Journal und abhängige Tabellen vollständig im nicht öffentlich zugänglichen Schema `fxcm_backup` gesichert. Das alte Kerzenarchiv liegt ebenfalls dort. Die GBP-Sicherung wurde auf 18 Dealing-Ranges und 38 Positionen geprüft.

Die Tabelle zum Neueintragen liegt unter [GBP-Tage und Richtung](../backups/gbpusd-tage-vor-fxcm.html). Das aktive Forex-Journal ist leer; BTC-Altbestand blieb bestehen. OBs, Liquiditätslevel, Setups und Daily-Pivots wurden auf FXCM neu aufgebaut. Historische Setups gelten als bereits behandelt, `notified_at` bleibt leer: kein nachträglicher Alarmversand.

Die zwölf Ergebnisberichte in `analysis/dr-reichweite/` und `src/rScaleQuotes.js` wurden mit FXCM neu berechnet. `messeFxcmKontext.ts` verwendet dafür direkt die produktiven Trend-/Target-Funktionen; die Python-Berichte laufen danach auf den gespeicherten Antworten. Die alte Close-Check-Schwellenstudie bleibt als historische cTrader-Studie gekennzeichnet.

Der Browser-Cache wurde auf Version 10 angehoben. Nach Veröffentlichung die Seite neu laden.

Gleicher Algorithmus und gleicher Vergleichszeitraum (5. Januar bis einschließlich 21. September): 1331 cTrader-Setups, 1361 FXCM-Setups, 1114 gemeinsame OB-Zeit-/Richtungs-Schlüssel. Die 247 ausschließlich auf FXCM gefundenen Setups zeigen den praktischen Einfluss des Quellenwechsels. Das ist kein Nachweis höherer Handelsprofitabilität.

Vorbereitung und Rückweg: `services/fxcm/backup.sql` und `services/fxcm/rollback.sql`. Der Rückweg wird nur im Wartungsfenster ausgeführt, nachdem seit dem Wechsel neu angelegte Journal-Einträge separat gesichert wurden. Zusätzlich die vorherigen Edge-Functions und den vorherigen Frontend-Stand wieder bereitstellen. Den privaten Altbestand erst entfernen, wenn Philip die Migration geprüft hat.
