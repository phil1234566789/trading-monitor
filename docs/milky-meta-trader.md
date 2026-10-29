# Milky Meta Trader (MMT)

MMT ergänzt den trading-monitor um private Brokerkonten und asynchrone MT5-Entry-Aufträge.
Gespräch → MCP → private Supabase-Queue → ausgehender Python-Worker → MT5.
Die bisherigen Journal-Konten bleiben getrennt: deren öffentliche Anon-Rechte sind für
Brokerzugangsdaten ungeeignet. Vier Konten können gespeichert werden; zunächst wird genau
ein Testkonto ausdrücklich ausgewählt. Gemeinsame Ausführung auf mehreren Konten ist noch
nicht implementiert.

## Erste Version

- App-Route: `/#/milky-meta-trader`, Navigation **MMT**.
- Private API `mt5-control`: separater `MT5_CONTROL_TOKEN`, Browser hält ihn nur im Arbeitsspeicher.
- Zugangsdaten: AES-256-GCM, zufällige Nonce, Login/Server als authentifizierte Zusatzdaten.
  `MT5_CREDENTIAL_KEY` ausschließlich als Function Secret sichern, zusätzlich außerhalb des Repos
  sicher aufbewahren. Verlust des Schlüssels macht gespeicherte Passwörter unlesbar. Nicht rotieren,
  ohne bestehende Daten kontrolliert neu zu verschlüsseln.
- `mt5-worker` liefert das ausgewählte Konto samt entschlüsseltem Passwort nur dem authentifizierten
  Python-Worker über HTTPS. Kein öffentlicher Port auf Windows, kein Service-Role-Key im Worker.
- Alle vier Tabellen haben RLS und keine Anon-/Authenticated-Rechte.
- Eine feste UUID pro menschlichem Auftrag. Gleiche UUID mit anderem Inhalt wird abgelehnt.
- `start_mt5_entry_search` startet nach ausdrücklichem Auftrag die Suche. Eine bloße Bias-Meinung
  reicht nicht. `get_mt5_execution_status` liest Status; `cancel_mt5_entry_search` beendet nur
  noch suchende Aufträge, keine offenen Positionen.
- Die aktuelle technische Preisbedingung ist **keine vollständige Strategieprüfung**:
  geschlossene M1 strikt oberhalb/unterhalb eines ausdrücklich gewählten Levels.
  `test_next_m1_close` existiert nur für explizite Demo-Verbindungstests.
- Nur M1-Schlüsse nach Aktivierung berücksichtigen. Signal höchstens zehn
  Sekunden alt, Tick höchstens fünf Sekunden alt; keine alten Signale nach einer Netzpause handeln.
- Technische Testgrenzen: maximal 0,01 Lot, Risikobudget maximal 5 in Kontowährung,
  20 Prozent Berechnungspuffer, maximal eine Stunde Suchdauer, keine bestehenden Positionen
  oder Pending Orders auf dem Konto. Kommission, Gaps und Slippage können Verluste darüber hinaus
  verursachen. Spreadgrenze 30 Broker-Points, Deviation 5 Points; dies sind Testwerte, keine
  aus IQCapital-Regeln abgeleiteten Vorgaben.
- SL obligatorisch, TP optional. Broker-Mindestvolumen niemals zulasten des Budgets aufrunden.
  Broker-Füllungsmodus prüfen. Challenge-Konten können technisch als Demo klassifiziert sein:
  den tatsächlichen MT5-Kontotyp verwenden, nicht aus dem Challenge-Namen ableiten.

## Betrieb

Voraussetzung: Windows, vorhandenes MT5 und gültige Kontoanmeldung. Bei BeyondIQCapital war
die direkte Demo-Eröffnung im Terminal deaktiviert. Ein ungültiges altes Konto liefert keine
verlässlichen Kurse oder Handelsmöglichkeit. Investor-Passwörter erlauben keinen Handel.

1. Migration `20261029090000_mt5_execution.sql` anwenden. CLI-Dry-Run vorher auf exakt diese
   Migration prüfen. Keine fremde Migrationshistorie reparieren.
2. Function-Secrets setzen: `MT5_CREDENTIAL_KEY` (32 zufällige Bytes als Base64),
   `MT5_CONTROL_TOKEN` und `MT5_WORKER_TOKEN` (je eigene starke Zufallswerte),
   `MT5_EXECUTION_ENABLED=true`, zunächst `MT5_ALLOW_LIVE=false`.
   `MT5_CONTROL_ORIGINS` enthält nur erlaubte Browser-Origins, standardmäßig die Pages-Origin
   und `http://localhost:5173`. Bei `127.0.0.1` dessen exakte Origin ebenfalls eintragen.
3. `mt5-control`, `mt5-worker` und `trading-monitor-mcp` deployen; Frontend veröffentlichen.
   Nur der MCP-Server verwendet seine eigene `deno.json` für zueinander passende SDK/Zod-Versionen.
4. In MMT entsperren und Konten mit numerischer MT5-Login-ID, Server und Trading-Passwort speichern.
   Die längere IQCapital-Account-Bezeichnung ist nicht die numerische Login-ID.
   Erst eines als Testkonto auswählen; ohne Auswahl kann kein Auftrag ausgeführt werden.
5. Python-Umgebung und offizielle Bibliothek installieren:

   ```powershell
   python -m venv services/mt5/.venv
   services/mt5/.venv/Scripts/python.exe -m pip install -r services/mt5/requirements.txt
   ```

6. Lokale Umgebungsvariablen (keine Passwörter im Aufruf oder Log):

   ```powershell
   $env:MT5_TERMINAL_PATH = 'C:\Program Files\Beyond IQ Capital MT5 Terminal\terminal64.exe'
   $env:MT5_WORKER_URL = 'https://<project>.supabase.co/functions/v1/mt5-worker'
   $env:MT5_WORKER_TOKEN = '<privat hinterlegter Worker-Token>'
   # Nur bei ausdrücklich freigegebenem Real-Konto zusätzlich lokal und serverseitig:
   $env:MT5_ALLOW_LIVE = 'true'
   services/mt5/.venv/Scripts/python.exe services/mt5/worker.py
   ```

   `--probe` liest nur die aktuelle lokale MT5-Sitzung; es nimmt keine Cloudaufträge an.
   Keine dauerhafte Worker-Aktivierung vor erfolgreichem Kontotest. Kontowechsel erfordert
   aktuell Worker-Neustart; die Kontoidentität wird vor jeder Order erneut geprüft.

## Ausfälle und Rücknahme

`searching → sending → executed / rejected / unknown`; alternativ `cancelled / expired`.
Postgres vergibt das Versandrecht atomar. SQLite reserviert die UUID dauerhaft vor `order_send`.
Ein Neustart sendet reservierte Aufträge nicht erneut. Broker-Teilfüllungen werden separat markiert,
nie automatisch durch eine zweite Order ergänzt.

Bei ungeklärtem Ausgang blockieren weitere Sendungen und Kontowechsel. Aktuell muss der tatsächliche
Brokerstand manuell anhand Deal-/Order-Ticket, Magic und Historie abgeglichen werden; es gibt noch
keine automatische Auflösung dieser Sperre. Niemals durch neue UUID oder Journal-Löschen umgehen.
Eine nachträgliche Ablehnung darf nur eingetragen werden, wenn sicher keine Ausführung erfolgte.

Abbruch ist bis zum atomaren Versandrecht möglich; danach ist er kein garantierter Stopp mehr.
Der Worker muss laufen und verbunden sein. Bei Ausfall wirken nur bestätigte serverseitige SL/TP.
Aktive SL-/RSI-/Teilverkaufsregeln sind noch nicht implementiert. Kontoschutz, Challenge-Regeln und
Strategieregeln müssen vor regulärem Einsatz ergänzt und geprüft werden.

Rücknahme: `MT5_EXECUTION_ENABLED=false`, Worker stoppen, noch suchende Aufträge abbrechen.
Ein abgeschaltetes Backend schließt bereits offene Positionen nicht. Neue Tabellen und verschlüsselte
Konten zur Wiederherstellung erhalten; keine automatische Datenlöschung.

## Prüfung

```powershell
python -m unittest discover -s services/mt5 -p 'test_*.py'
npx vitest run test/mt5Execution.test.js test/milkyMetaTraderClient.test.js
deno test --config supabase/functions/trading-monitor-mcp/deno.json --allow-env supabase/functions/trading-monitor-mcp/mt5Execution.deno.ts
```

Isolierter PostgreSQL-Test ohne Produktivdaten:

```powershell
npm install --prefix .debug/mmt-sql --ignore-scripts --no-package-lock @electric-sql/pglite@0.5.13
$env:MMT_PGLITE_MODULE = (Resolve-Path .debug/mmt-sql/node_modules/@electric-sql/pglite/dist/index.js).Path
node --test test/mt5Database.integration.mjs
```

Reale Brokerfills sind durch diese Simulationen nicht nachgewiesen. Erster kontrollierter
Ende-zu-Ende-Test benötigt gültige Kontodaten, ausdrücklich vereinbartes Instrument, Richtung,
Trigger, SL und Budget. Vier gemeinsame Orders sind ein späterer eigener Meilenstein.

## Abhängigkeitsprüfung 29.10.2026

Der bestehende Frontend-Lock meldet Audit-Befunde bei Vue/SSR, DOMPurify/Mermaid, KaTeX,
Nanoid, PostCSS, source-map-js und Vite. Keine neuen Frontend-Pakete für MMT. MMT rendert keine
unvertrauenswürdigen HTML-/Mermaid-Inhalte und verwendet kein SSR. Die Befunde sind nicht als
behoben auszugeben; separate Wartung mit Reachability-Prüfung bis 12.11.2026, kein ungeprüftes
`audit fix --force` oder Mermaid-Major-Upgrade in dieser Änderung.

## Marktorder mit Vorschau und Bestaetigung

Die private MMT-Ansicht bietet eine aktuelle Vorschau mit Broker-Symbol, Richtung,
Mindestlotgroesse, SL/TP und Risiko in Kontowaehrung. Sie gilt 30 Sekunden und wird
serverseitig signiert. Erst der Nutzerknopf sendet den konkreten Auftrag in die Queue;
Vorschau, Seitenaufruf oder Reload legen keine Order an. Der Worker prueft Konto,
Quote, bestehende Exposure, Risiko und Broker-Precheck erneut. Die aktuelle Quote darf
hoechstens fuenf Brokerpunkte von der Vorschau abweichen; der Fill kann durch Slippage
abweichen. Verlorene HTTP-Antworten werden anhand der gespeicherten Auftrags-ID abgeglichen.

`start-worker.ps1 -ConfigPath <private-worker.env> -Monitor` synchronisiert ausschliesslich
Kontostand und Kurse. Auftragspruefung, Versand und Journalzustellung sind dabei gesperrt.
Der Versandbetrieb benoetigt weiterhin lokale und serverseitige Live-Freigabe sowie die
MT5-Freigabe fuer Algo Trading. Eine serverseitige Sperre verhindert auch bestaetigte Orders.

`MT5_SERVER_TIME_OFFSET_SEC` ist eine explizite Feed-Zeitkorrektur, Standard 0. Fuer den
geprueften BeyondIQCapital-Feed wurde ein Versatz von +10800 Sekunden gemessen und lokal
konfiguriert. Er wird von nativen Tick- und M1-Zeitstempeln abgezogen. Bei Broker-/Feed-
oder saisonalem Zeitwechsel erneut messen; keine automatische Ableitung aus alten Kursen.
Die maximale Tick-Altersgrenze von fuenf Sekunden bleibt bestehen.
