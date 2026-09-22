# FXCM-Kerzenfeed

Zentrale Betriebs- und Notfalldokumentation für trading-monitor. Stand: 22.09.2026.
Diese Datei dokumentiert den Betrieb; ihre Bearbeitung ändert keine Server- oder Kontoeinstellungen.

GBPUSD/EURUSD verwenden geschlossene native **FXCM-Bid-Kerzen**. Der ForexConnect-Collector läuft unabhängig vom PC auf dem Netcup-VPS. Er handelt nicht und öffnet keine Orders.

## Datenfluss

`services/fxcm/collector.py` → SQLite-Puffer → `fxcm-ingest` → `fxcm_candles` → `forex_candles` (nur lesbare Sicht) → Chart, MCP, Auswertung.

- M1/M3/M5/M15/H1/H4/D1 werden nativ abgerufen, nicht aus anderen Zeitrahmen zusammengesetzt.
- Abfrage kurz nach Minutenschluss mit zehn Sekunden Abschlussabstand. Offene Kerzen werden sowohl im Collector als auch im Ingest abgewiesen.
- Neue Datensätze sind unveränderlich; Schlüssel: Instrument, Zeitrahmen und Startzeit. Fehlgeschlagene Uploads bleiben im lokalen Puffer und werden erneut versucht.
- M5 ab Januar 2025; M1/M3/M15 ab Januar 2026; H1/H4 ab Juni 2024; D1 ab Oktober 2022. Laufende Erweiterung für beide Instrumente.
- Der 2025-Backfill ist geprüft: 74998 GBPUSD- und 75193 EURUSD-M5-Kerzen, alle zwölf Monate vorhanden. Abdeckung und Auswertung: [DR-Reichweite](../analysis/dr-reichweite/README.md#aktueller-fxcm-stand-2025-und-2026).
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

Die folgende Historie beschreibt den Stand unmittelbar nach der Migration, nicht den späteren Journalbestand.

Am 22.09.2026 wurde nach Philips Freigabe der alte Forex-Bestand ersetzt. Vorher wurden Journal und abhängige Tabellen vollständig im nicht öffentlich zugänglichen Schema `fxcm_backup` gesichert. Das alte Kerzenarchiv liegt ebenfalls dort. Die GBP-Sicherung wurde auf 18 Dealing-Ranges und 38 Positionen geprüft.

Die Tabelle zum Neueintragen liegt unter [GBP-Tage und Richtung](../backups/gbpusd-tage-vor-fxcm.html). Das aktive Forex-Journal ist leer; BTC-Altbestand blieb bestehen. OBs, Liquiditätslevel, Setups und Daily-Pivots wurden auf FXCM neu aufgebaut. Historische Setups gelten als bereits behandelt, `notified_at` bleibt leer: kein nachträglicher Alarmversand.

Die zwölf Ergebnisberichte in `analysis/dr-reichweite/` und `src/rScaleQuotes.js` wurden mit FXCM neu berechnet. `messeFxcmKontext.ts` verwendet dafür direkt die produktiven Trend-/Target-Funktionen; die Python-Berichte laufen danach auf den gespeicherten Antworten. Die alte Close-Check-Schwellenstudie bleibt als historische cTrader-Studie gekennzeichnet.

Der Browser-Cache wurde auf Version 10 angehoben. Nach Veröffentlichung die Seite neu laden.

Gleicher Algorithmus und gleicher Vergleichszeitraum (5. Januar bis einschließlich 21. September): 1331 cTrader-Setups, 1361 FXCM-Setups, 1114 gemeinsame OB-Zeit-/Richtungs-Schlüssel. Die 247 ausschließlich auf FXCM gefundenen Setups zeigen den praktischen Einfluss des Quellenwechsels. Das ist kein Nachweis höherer Handelsprofitabilität.

Vorbereitung und Rückweg: `services/fxcm/backup.sql` und `services/fxcm/rollback.sql`. Der Rückweg wird nur im Wartungsfenster ausgeführt, nachdem seit dem Wechsel neu angelegte Journal-Einträge separat gesichert wurden. Zusätzlich die vorherigen Edge-Functions und den vorherigen Frontend-Stand wieder bereitstellen. Den privaten Altbestand erst entfernen, wenn Philip die Migration geprüft hat.

## Zugänge und Zuständigkeiten

| Bestandteil | Adresse / Ablage | Zweck |
|---|---|---|
| Netcup-VPS | `v2202609424718526359.nicesrv.de`, IP `62.83.34.141` | Dauerhafter Collector, Debian 13 |
| Netcup-Verwaltung | Netcup Customer Control Panel / Server Control Panel | Vertrag, Serverkonsole, Neustart und Wiederherstellung |
| FXCM | Trading-Station-Demokonto, ForexConnect-Verbindung `Demo` | Markt- und historische Bid-Daten |
| FXCM-Loginserver | `https://www.fxcorporate.com/Hosts.jsp` | Im Collector fest hinterlegt |
| Supabase-Projekt | `vkphwtqcvqrkphksproj` | Archiv, Ingest, Erkennung und Alarme |
| Ingest-Endpunkt | `https://vkphwtqcvqrkphksproj.supabase.co/functions/v1/fxcm-ingest` | Geschützter Upload vom VPS |
| Anwendung | `https://phil1234566789.github.io/trading-monitor/` | Chart und Journal |

Kontozugänge gehören in einen Passwortmanager, nicht in diese Datei. Die Serverkonfiguration
enthält `FXCM_USERNAME`, `FXCM_PASSWORD`, `FXCM_CONNECTION=Demo`, `FXCM_INGEST_URL` und
`FXCM_INGEST_TOKEN`. Das gleichnamige Ingest-Token muss zusätzlich als Supabase-Edge-Function-Secret
gesetzt sein. Der Collector benötigt keinen Supabase-Service-Role-Schlüssel; dieser bleibt in Supabase.
Der Konfigurationspfad im Container ist `/run/secrets/fxcm.env`, überschreibbar mit `FXCM_CONFIG`.

## Wenn keine neuen Kerzen kommen

Ein grüner Verbindungsstatus im Browser beweist nur die Verbindung zur Anwendung, nicht die
Aktualität des FXCM-Feeds. Entscheidend sind die letzten **geschlossenen** Kerzen je Zeitrahmen.
Wochenenden, Feiertage und noch offene H1/H4/D1-Kerzen bei der Bewertung berücksichtigen.

1. Im Supabase-SQL-Editor den Archivstand prüfen:

   ```sql
   select instrument, bar, max(time) as last_candle_start
   from public.fxcm_candles
   group by instrument, bar
   order by instrument, bar;
   ```

   Die Werte sind Kerzen-Startzeiten; für den erwarteten Abschluss die Periodenlänge hinzurechnen.
   Datenbankzeiten sind UTC, bei der Kommunikation nach Europe/Berlin umrechnen.

2. Auf dem VPS die folgenden Leseprüfungen ausführen:

   ```sh
   docker inspect --format '{{.State.Status}} {{.State.Health.Status}} restarts={{.RestartCount}}' fxcm-collector
   docker logs --tail 40 fxcm-collector
   systemctl is-active docker fxcm-watchdog.timer
   df -h /opt/fxcm
   docker exec fxcm-collector python -c "import sqlite3; c=sqlite3.connect('file:/data/candles.sqlite?mode=ro',uri=True); print('Pending:',c.execute('select count(*) from candles where uploaded=0').fetchone()[0])"
   ```

   Logs vor Weitergabe auf sensible Angaben prüfen. Kein vollständiges `docker inspect`,
   `cat fxcm.env` oder Secret-Dump in Chat, Tickets oder Git.

3. Fehler eingrenzen:

   | Befund | Nächster Schritt |
   |---|---|
   | Container startet ständig neu / keine neuen History-Zeilen | FXCM-Login, Konto und Erreichbarkeit des Loginservers prüfen |
   | Puffer wächst, Supabase bleibt alt | Ingest-Erreichbarkeit, Edge-Logs und Token-Abgleich prüfen |
   | Ingest 401 | Token in Serverdatei und Supabase-Secret müssen übereinstimmen |
   | Ingest 400 | Payload gegen `fxcm-ingest/validate.js` prüfen; Validierung nicht abschalten |
   | Ingest 503 | Supabase-Datenbank/Edge-Logs auf Schreibfehler prüfen |
   | VPS nicht erreichbar | Netcup-Status, Serverkonsole, Netzwerk und Vertragsstatus prüfen |
   | Archiv aktuell, Chart alt | Seite neu laden, Browserfehler und Chart-Abfragen prüfen |

Der Collector schreibt aus Sicherheitsgründen nur den Fehlertyp (`Collector failed: …`), nicht
die vollständige SDK-Exception. Ein allgemeiner Fehler allein beweist daher keinen Kontoablauf.
Ein `healthy`-Container beweist ebenfalls nicht, dass neue Marktdaten angekommen sind: den
Archivfortschritt immer separat prüfen. Der Watchdog repariert Hänger, aber keine gesperrten Konten,
falschen Secrets oder einen ausgeschalteten VPS. Eine externe Benachrichtigung bei komplettem
VPS-Ausfall ist durch diesen Watchdog nicht eingerichtet.

## Demokonto abgelaufen oder gesperrt

Für dieses konkrete Konto ist kein verbindliches Ablaufdatum dokumentiert. Keine feste
Lebensdauer oder automatische Verlängerung voraussetzen. Bei Problemen die aktuelle Kontomeldung
in Trading Station und die FXCM-Kontomails prüfen; nötigenfalls FXCM nach Ablauf, Reaktivierung
und ForexConnect-Zugriff fragen. Nicht allein wegen fehlender Wochenendkerzen ein neues Konto anlegen.

1. Prüfen, ob die vorhandenen Zugangsdaten direkt bei FXCM funktionieren. Trading-Station-/
   ForexConnect-Zugang verwenden; ein anderer Plattformzugang ist nicht automatisch kompatibel.
2. Falls nötig ein neues FXCM-Demokonto über den offiziellen FXCM-Weg einrichten. Neue Zugangsdaten
   sicher ablegen und prüfen, dass GBP/USD, EUR/USD und historische Daten erreichbar sind.
3. Vor dem Wechsel Container-Konfiguration und Daten sichern. Watchdog vorübergehend stoppen:
   `sudo systemctl stop fxcm-watchdog.timer`, anschließend `docker stop fxcm-collector`.
4. Auf dem VPS `/opt/fxcm/fxcm.env` sicher bearbeiten. Nur Benutzername/Passwort und gegebenenfalls
   den von FXCM bestätigten Verbindungstyp ändern. Ingest-Token und Archiv bleiben erhalten.
   Datei weiterhin Besitzer `10001:10001`, Modus `600`; niemals neue Secrets in Git speichern.
5. Den vorhandenen Container starten: `docker start fxcm-collector`. Falls die Datei durch den
   Editor atomar ersetzt wurde und der Container weiterhin die alten Zugangsdaten liest, den
   Container mit denselben Mounts und Schutzoptionen neu erstellen; keine Secrets ins Image bauen.
6. `sudo systemctl start fxcm-watchdog.timer`. Containerzustand, Fortschrittslogs, Upload-Puffer
   und neue Archivkerzen prüfen. Erst bei tatsächlich fortschreitendem Archiv ist der Feed wieder da.
7. Einige überlappende geschlossene Kerzen des alten und neuen Kontos vergleichen, insbesondere
   GBPUSD M5/H1/H4 und deren Zeitstempel. Bid/Ask, Instrumente und Handelstagsgrenzen müssen passen.

Bei einem Kontowechsel innerhalb desselben FXCM-Feeds werden weder Journal noch Archiv gelöscht.
Der normale Collector setzt am letzten lokal gespeicherten Stand mit zwei Kerzen Überlappung an.
Das holt eine Ausfalllücke nach, soweit FXCM die Historie noch liefert. Ein Brokerwechsel dagegen
ist eine eigene Datenmigration: nicht still cTrader oder einen anderen Anbieter in dasselbe Archiv
schreiben. Abweichende Dochte ändern Sweeps, FVGs, OBs und darauf beruhende Statistiken.

## Historie nachholen und Sicherungen

Der Collector verarbeitet maximal sieben Tage pro History-Fenster. Ein separater Backfill kann mit
`--backfill --start YYYY-MM-DD --end YYYY-MM-DD --bars 1h,4h` gestartet werden. Die Datumsargumente
werden im aktuellen Code als UTC interpretiert; gewünschte Grenzen vorher korrekt bestimmen.
Vorher den Live-Collector und Watchdog kontrolliert pausieren, dieselben Daten-/Secret-Mounts
verwenden und danach beide wieder starten. Ein erfolgreicher Backfill ist nicht nur am Exitcode,
sondern an vollständigen Zeitreihen in Supabase zu erkennen.

Wichtig: Backfill-Checkpoints überspringen bereits bearbeitete Abschnitte. Für eine gezielte
Reparatur alter Lücken zuerst den betroffenen Checkpoint prüfen. Bestehende Kerzen werden durch
`insert or ignore` / `ignoreDuplicates` **nicht korrigiert**. Fehlerhafte Werte erfordern eine
gezielte, gesicherte Datenkorrektur und gegebenenfalls eine Neuberechnung abgeleiteter Objekte.

Vor Serverwechsel oder Neuinstallation sichern:

- `/opt/fxcm/fxcm.env` separat und verschlüsselt;
- `/opt/fxcm/data` bei gestopptem Collector einschließlich SQLite-WAL-Dateien oder mittels
  konsistenter SQLite-Backup-Funktion; die Datenbank nicht während Schreibzugriffen blind kopieren;
- Container-Startparameter, Image/Dockerfile und Watchdog-Units;
- aktuelles Supabase-Archiv und Journal über eine geprüfte Datenbanksicherung.

Das Schema `fxcm_backup` ist eine **einmalige Migrationssicherung**, kein laufendes Backup neuer
FXCM-Daten oder neuer Journal-Einträge. Aufbewahrung und Wiederherstellbarkeit der Supabase- und
VPS-Sicherungen separat prüfen; diese Dokumentation bestätigt keinen automatischen Backup-Vertrag.

## Neuaufbau und Wartung

Quellen im Repo: [Collector](../services/fxcm/collector.py),
[Kerzennormalisierung](../services/fxcm/candles.py), [Dockerfile](../services/fxcm/Dockerfile),
[Watchdog-Service](../services/fxcm/fxcm-watchdog.service),
[Watchdog-Timer](../services/fxcm/fxcm-watchdog.timer) und
[Ingest](../supabase/functions/fxcm-ingest/index.ts).

Image beim Erstbetrieb: `fxcm-collector:20260922c`. Bei Neuaufbau aus dem versionierten Dockerfile
bauen und die benötigten Secrets/Daten separat einspielen. Containername `fxcm-collector`,
Restart-Policy `unless-stopped`, Benutzer `10001:10001`, kein veröffentlichter Port, Root-Dateisystem
read-only, beschreibbares `/tmp` als tmpfs, Datenmount nach `/data`, Secret-Datei read-only nach
`/run/secrets/fxcm.env`. Sicherheitsoptionen: `cap-drop ALL`, `no-new-privileges`, Speicherlimit 1 GB,
PID-Limit 128 und begrenzte Docker-Logs. Watchdog-Units installieren und Timer aktivieren.

Der aktuelle SDK-Stand ist `forexconnect==1.6.43` auf Python 3.7.17. Diese alte Runtime ist eine
Wartungsabhängigkeit; vor Updates SDK-/Wheel-Kompatibilität testen. Nicht unkontrolliert auf eine
neue Python-Version wechseln. Nach Änderungen Collector-Tests ausführen und einen begrenzten
History-Abruf prüfen, bevor der laufende Feed ersetzt wird.

Nach Wiederherstellung als Abnahme prüfen: beide Instrumente, alle sieben Zeitrahmen, nur
geschlossene Kerzen, sinkender Upload-Rückstand, aktuelle M5-Daten während Handelszeiten,
erfolgreicher `poi-watcher`-Lauf und sichtbare aktuelle Kerzen im Chart. Die automatische
Wiederherstellung darf keine Orders oder nachträglichen historischen Alarmsalven auslösen.
