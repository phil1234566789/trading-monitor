# Milky Meta Trader (MMT)

MMT ergänzt den trading-monitor um private Brokerkonten und asynchrone MT5-Entry-Aufträge.
Dashboard/Chart → private Supabase-Queue → ausgehender Python-Worker → MT5.
Chat und MCP sind für diesen Ausführungsweg nicht erforderlich. Bei mehreren gewählten eigenen
Konten entstehen getrennte Aufträge mit eigenen Risikobudgets und unabhängigem Ausführungsstatus.
Die bisherigen Journal-Konten bleiben getrennt: deren öffentliche Anon-Rechte sind für
Brokerzugangsdaten ungeeignet.

## Erste Version

- App-Route: `/#/milky-meta-trader`, Navigation **MMT**.
- Private API `mt5-control`: separater `MT5_CONTROL_TOKEN`, Browser speichert ihn nach erfolgreichem Entsperren lokal; explizites Sperren entfernt ihn.
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
- Die aktuelle Testregel ist **keine vollständige Strategieprüfung**:
  `m1_directional_close`: nach Aktivierung geschlossene M1-Kerze, Short `close < open`,
  Long `close > open`, Doji ausgeschlossen. Konto, Richtung, SL und Ablauf
  bleiben gebunden. Brokerkurs und zulässige dynamische Lotgröße werden vor dem Entry erneut geprüft. Preislevel-Trigger bleiben
  technisch verfügbar, sind aber nicht die aktuelle Standardregel.
  `test_next_m1_close` existiert nur für explizite Demo-Verbindungstests.
- Nur M1-Schlüsse nach Aktivierung berücksichtigen. Signal höchstens zehn
  Sekunden alt, Tick höchstens fünf Sekunden alt; keine alten Signale nach einer Netzpause handeln.
- Pilot: Broker-Mindestlot bis maximal 0,01 Lot. Risky (0,5 %) und Full (0,9 %) werden aus
  nativen Broker-Verlustwerten und Lotstufen berechnet; beide teilen sich maximal 0,9 % pro Konto
  und Markt. Bestehende Positionen zählen mit. Engere Tages-/Drawdownreste und der bestätigte
  Kosten-/Slippagepuffer begrenzen jeden Modus einschließlich Pilot.
- Alle Entries brauchen die private Tageskonfiguration `risk_base`, `drawdown_floor`,
  `cost_buffer`, `currency` und `source`. Es gibt keine geratenen Default-Grenzen. Die
  Prozentbasis ist fest das ursprüngliche Kapital von 50.000 USD: Risky 250 USD, Full und
  gemeinsames Marktbudget 450 USD. Andere Prozentbasen werden abgelehnt. Herkunft des aktuellen
  Floors und Kostenpuffer werden ausdrücklich bestätigt. Tagesgültigkeit endet
  um Mitternacht Europe/Berlin; neue Höchststände bei Balance/Equity verlangen eine erneute
  Floor-Bestätigung. Ohne Policy, frische native Risikodaten oder betriebsbereiten Tagesstopp
  bleibt die Ausführung gesperrt. Ein bestätigter Floor ist keine automatisch ermittelte Brokerregel.
- Maximal eine Stunde Suchdauer. Spreadgrenze 30 Broker-Points und Deviation 5 Points bleiben
  erhalten; sie sind technische Testwerte, keine aus IQCapital-Regeln abgeleiteten Vorgaben.
  Kommission, Gaps und Slippage können tatsächliche Verluste über die Planung hinaus erhöhen.
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
   Erst ein Handelskonto auswählen; ohne Auswahl kann kein Auftrag ausgeführt werden.
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
RSI-Exitregeln und vollständige Strategie-/Challenge-Prüfungen sind nicht implementiert.
Der bestätigte Tagesstopp und gespeicherte TP-Pläne sind nachfolgend beschrieben; beide benötigen
einen aktuellen Worker und sind keine Garantie gegen Gaps, Slippage oder eine getrennte Brokerregel.

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

## Asynchrone Entry-Suche als Standard

Im Chart Symbol, Richtung, SL/TP und Suchdauer (1 bis 60 Minuten, Standard 30) vorbereiten.
Ein Klick auf **Entry suchen** führt intern die signierte Vorprüfung (`search_preview`)
und danach das kontogebundene Enqueue (`search_confirm`) aus. Es gibt keinen zweiten Startbutton.
Die angenommene Suche wartet asynchron auf die passende neu geschlossene M1-Kerze.
Die Suchfrist steht explizit in der Ansicht. Der aktuelle Brokerkurs, SL/TP-Seite,
Mindestlotgroesse und Risikobudget werden beim tatsaechlichen Entry erneut geprueft.
Ein ausgefuehrter Auftrag endet; keine automatische Wiederholung oder Vervielfachung.
`search_preview` erzeugt nur eine signierte Ansicht, `search_confirm` aktiviert die Queue.
Keine Bindung an den Vorbereitungskurs und keine 0,5-Pip-Grenze fuer diesen Suchauftrag.

Vor dem Enqueue wird dieselbe Auftrags-ID dauerhaft als ungeklärt reserviert. Doppelklicks
senden nicht erneut; ein unklarer Ausgang bleibt bis zum exakten Statusabgleich an diese ID
gebunden. Änderungen an Chartidee oder Kontoauswahl löschen keine Rückmeldungen. Ablehnungen,
Timeouts und abgelaufene Suchen bleiben sichtbar. Pro Konto wird unabhängig rückgemeldet;
ein Teilerfolg darf einen Fehler des anderen Kontos nicht verdecken. Replay oder eine geänderte
Idee während der Vorprüfung verhindern das anschließende Enqueue.

Die Dashboard-Sidebar zeigt Suchen und Positionen aller Konten und Assets mit gemeinsamer
Konten-/Snapshot-Identitätsprüfung. Die alten TP-Verwaltungsformulare entfallen dort; unsichtbare
Editorcontroller erhalten die Chartbedienung. Fehler beim initialen Planladen bleiben als
kompakte Konto-/Positionsmeldung sichtbar. Broker- und Risikoguards werden nicht umgangen.


## Technischer Marktorder-Endpunkt mit Vorschau und Bestaetigung

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

## Fehleralarmierung und Fill-Rueckmeldung

Workerfehler werden ohne rohe Exception-Texte als Klasse, Codeposition und Fehlerbeginn
an den privaten Worker-Endpunkt gemeldet. Der Heartbeat kann weiterlaufen, aber
`execution_ready=false` und `worker_error` machen die gestoerte Ausfuehrung sichtbar.
Eine frische Verbindung ist allein kein Betriebsnachweis. Die atomare Versandfreigabe
blockiert einen Workerfehler auch auf Datenbankebene.

`mt5-health` prueft unabhaengig jede Minute den Worker-Heartbeat, Ausfuehrungsfehler und
unklare Versandzustaende. Ein Heartbeat-Ausfall wird nach 60 Sekunden kritisch, daher
mit Cron-Takt typischerweise innerhalb von ein bis zwei Minuten erkannt. Neue Incidents
legen je eine private Pushover- und Telegram-Zustellung an. Wiederholungen desselben
aktiven Fehlers erzeugen keinen neuen Incident. Definite Providerablehnungen werden
begrenzt erneut versucht; unbekannte Annahme oder abgebrochener Versand werden als
`uncertain` dokumentiert und niemals blind wiederholt. MMT zeigt den Kanalstatus sowie
eine ueberfaellige unabhaengige Alarmpruefung an. Die Providerannahme beweist nicht,
dass eine Nachricht auf dem Telefon bereits gelesen wurde.

Der Cron verwendet den vorhandenen privaten Vault-Token `setup2_watch_token`, der
Endpoint prueft `SETUP2_WATCH_TOKEN`. Ein Alarmtest per POST `{"action":"test"}`
benoetigt den privaten MMT-Control-Token. Zugangsdaten und Kontostaende stehen nicht
in den Fehlermeldungen. Die bestehenden Pushover-/Telegram-Secrets bleiben serverseitig.

IQ kann Erfolg mit Orderticket, aber ohne Deal-ID und Fill-Preis bestaetigen. Der Worker
sendet niemals erneut: Er gleicht Orderticket, Magic und Volumen gegen Dealhistorie oder
eine exakt passende Position ab. Dealticket und Positionsticket bleiben verschiedene
Felder; erst ein belegter positiver Fill-Preis wird als ausgefuehrter Entry angezeigt.
Ein noch nicht belegter Fill bleibt offen/unknown und sperrt weitere Sendungen. Fehler
bei der Resultatuebertragung duerfen die Heartbeats nicht mehr unterdruecken.

## Verbindung mit dem bestehenden Journal

Die PnL-Liste öffnet über **Journal / Kommentare** die exakte Brokerposition und ihre
Zuordnung zu DR und Journalposition. Nach Import im Chat sind dieselben privaten Kommentare
auch im bestehenden Trade-Editor sichtbar und korrigierbar; der Chart-Link öffnet dessen
vorhandene Darstellung. MMT zuvor entsperren. Ohne Zuordnung zuerst DR-Nummer, Konto und
Brokerpositions-ID nennen; bereits manuell journalisierte Ausführungen ausdrücklich angeben.
Historischer SL/TP und R bleiben ohne Nachweis unbekannt. Technischer Vertrag, Schutz der
öffentlichen Journalzugriffe und Tests: [Privates MMT-Journal](mcp-server.md#privates-mmt-journal).

## Aktives Handelskonto wechseln

Unter „Brokerkonten verwalten“ manuell wählen oder im Chat das konkrete Konto nennen.
Die privaten Tools `list_mt5_trading_accounts` und `select_mt5_trading_account` nutzen
denselben Auswahlpfad wie die UI. Nach einem tatsächlichen Wechsel den Worker für dieses
Konto neu starten und die Verbindung prüfen. Ein bestehender Suchauftrag wird nie umgeleitet.

Die atomare Datenbankprüfung sperrt den Wechsel bei suchenden/sendenden/unklaren Aufträgen,
noch nicht abschließend abgeglichenen Ausführungen, offenen Brokerpositionen oder Pending
Orders. Ein bestehendes Handelskonto darf nur mit fehlerfreiem, höchstens 15 Sekunden altem
Brokerstand verlassen werden. Dieselbe Auswahl ist ein No-op und löscht keinen Heartbeat.
`mt5_select_test_account` bleibt ausschließlich als historischer RPC-Vertrag erhalten.
Der sichtbare Testbetrieb-Hinweis wurde entfernt; technische Handelslimits gelten weiter.

## Balance aller Konten

Die Halbkreis-Anzeigen verwenden eine feste Vergleichsskala von 47.000 bis 54.000 USD.
Balance-Zeiger und tatsächliche Verlustgrenze bewegen sich getrennt; der Fortschritt ist
der bereits geschaffte Anteil seit 50.000 USD. Ergänzt wird die Winrate belegter Brokertrades. Fehlende
Historie bleibt unbekannt; Einzahlungen und Resets sind kein Trading-PnL. Anzeigen aktiviert
kein Konto. Für das Verlustrisiko ist die Equity maßgeblich, nicht die Balance-Anzeige.
Vier Konten passen nebeneinander; weitere Konten und schmale Bildschirme nutzen dieselbe
horizontal scrollbare Kontoleiste (auch per Tastatur erreichbar).

`mt5_account_balances` ist ausschließlich über den privaten Control-Endpoint lesbar.
Der Datenbanktrigger hält den letzten fehlerfreien Workerstand pro Konto fest, auch nach
einem späteren Kontowechsel. Manuell aus dem Brokerportal übernommene Balance/Equity und
Limits tragen getrennte Quellen und Übernahmezeitpunkte; das ist keine Broker-Livezeit.
Limits bei Bedarf erneut im Brokerportal prüfen und privat aktualisieren. Der Worker
schreibt nur Kontostand und Positionszahl fort, niemals die EOD-Trailing-Grenze aus einer
fallenden Balance neu berechnen. Transaktionaler Check: Migration plus
`scripts/checkMt5AccountBalances.sql` innerhalb `begin`/`rollback` ausführen.


Zusätzliche Konten erhalten eigene portable MT5-Instanzen mit deaktiviertem Algo-Handel.
`services/mt5/reader.py` liest Kontostand und Historie alle 30 Sekunden. Sein eigener
`mt5-reader`-Endpoint akzeptiert ausschließlich Konfiguration, Kontostand und Historienaktionen;
`MT5_READER_TOKEN` gilt nicht am Handelsendpoint. Er schreibt weder Kontowahl noch
Handelsheartbeat. `mt5_record_reader_balance` bewahrt bestätigte Limits und neuere Snapshots.

Private `*.reader.json`-Dateien enthalten Konto-UUID, isolierten `terminal_path`, `url`,
`token` und den expliziten `server_time_offset_sec`. Zugangsdaten werden nur über HTTPS
abgerufen, nicht in Logs oder JSON-Konfiguration gespeichert. `.mmt-read-only` bindet das
Terminalverzeichnis an die Konto-UUID; `path` und `data_path` müssen genau dazu passen.
`start-readers.ps1 -ConfigDirectory <privater Ordner> -Python <vorhandene Python-Umgebung>`
startet die Leser versteckt und lässt bereits laufende Prozesse bestehen. Eine Dateisperre
verhindert doppelte Leser je Konfiguration. Der Windows-Task `MMT Read-only Accounts 2-4`
prüft bei Anmeldung und alle fünf Minuten, ob ein Leser neu gestartet werden muss.

Frische Lesesnapshots sind als „Daten aktuell“ gekennzeichnet. Nach 90 Sekunden ohne neuen
Snapshot erscheint wieder „Gespeicherter Stand“ mit Zeitpunkt im Tooltip. Computer und MT5
müssen für laufende Daten eingeschaltet und verbunden bleiben. Diese Aktualisierung bestätigt
keine neue Drawdown-Grenze; dafür bleibt eine belegte Brokerquelle erforderlich.

## Positionsstatus bei Reload

Der Worker gleicht ausgefuehrte Auftraege weiter rein lesend mit MT5 ab. Die Auftragsliste
zeigt nach dem Reload den zuletzt synchronisierten Brokerstatus: offen, Exit-Abgleich
oder geschlossen mit TP/SL-Grund, echtem Exitpreis und Nettoergebnis. Ein verschwundener
Positionsdatensatz allein beweist keinen TP. Fuer einen Schluss muessen zugeordnete
Eroeffnungsdeals und vollstaendig ausgeglichenes Exitvolumen vorliegen. Die Statuspflege
sendet keine Brokerorder und veraendert keine Stops oder Ziele.

Lifecycle-Daten liegen getrennt unter `result.position_lifecycle`; die urspruengliche
Versandbestaetigung bleibt auch nach deren Ergaenzung idempotent. Closed ist endgueltig.
Der Worker liest offene historische Auftraege in 20er-Seiten pro ausgewaehltem Konto,
setzt den Cursor anhand der tatsaechlich gelesenen letzten ID fort und erst bei leerer
Seite zurueck. Dadurch werden auch aeltere nicht abgeschlossene Abgleiche nachgefuehrt.


## Dashboard und Tagesstopp

**Trades → MMT** blendet die kompakte Card rechts vom vorhandenen Dashboard-Chart ein,
oberhalb des TSC. Long-/Short-Ideen verwenden den Zeichnungsspeicher und bestehende Chartprimitiven.
Der gezeichnete Entry ist ausschließlich ein Anker; er wird nie als Ausführungspreis/Trigger
an MMT übergeben. Richtung und SL stammen aus der zeitlich nächsten sichtbaren Idee zur letzten
Chartkerze; Gleichstände verlangen eine eindeutige Zeichnungsauswahl. RR ohne Ziel bleibt unbekannt.
Chartkerzen bleiben im bestehenden Feed; Broker-Bid/Ask und native Kontraktdaten bestimmen die Suche.

Alle laufenden Suchen bleiben assetübergreifend sichtbar. Erst brokerbestätigte Fills mit belegter
Brokerzeit erhalten die vorhandene Positionszeichnung; unbekannte oder abgebrochene Aufträge
werden nicht als Ausführung dargestellt. Bestehende DR-/Journalverknüpfungen bleiben zugänglich.

Der Tagesverlust pro Konto ist realisiertes Tagesnetto einschließlich Commission, Swap und Fee
plus offene Verluste; offene Gewinne verdecken offene Verlust-/Swapanteile nicht. Bei 1.000 USD
Verlust wird die Sperre für den Berlin-Tag dauerhaft gesetzt. Entry-Suchen enden, Broker-Pendings
werden storniert und offene Positionen über persistente, ticketgebundene Notfallaufträge geschlossen.
Erholung hebt die Sperre nicht auf. Erst der neue Berlin-Tag setzt die Tagesgrenze zurück; ungeklärte
Versandresultate bleiben darüber hinaus gesperrt. Eine zurückgenommene Drei-Loss-Regel existiert nicht.

Entry-, Tagesstopp- und TP-Versandrechte werden gemeinsam koordiniert. Ungeklärte Close-Ergebnisse
werden niemals blind wiederholt. Eine ungeklärte Aktion auf Position A verhindert keine notwendige
Notfallschließung anderer Positionen. Broker-/Workerfehler und offene Abgleiche bleiben sichtbar.

Für das Update zuerst die privaten Risiko-, TP- und Tagesstopp-Migrationen anwenden, dann
`mt5-control`, `mt5-worker` und gegebenenfalls `trading-monitor-mcp` deployen, den Worker aktualisieren
und das Frontend veröffentlichen. Alte Worker erfüllen die neuen Schutz-Capabilities nicht;
Entries bleiben dann gesperrt. Betrieb, Tests und Deployment dürfen keine echte Testorder erzeugen.

## Gemeinsame TP-/SL-Pläne offener Positionen

`MmtTargetEditor`, `useMmtExitEditor` und `useMmtTargetDrawing` bearbeiten einen gemeinsamen
Browserentwurf. Erst **Speichern** übergibt ihn verbindlich; **Abbrechen** oder Escape verwirft
beide Seiten. Je Seite sind bis fünf Linien möglich. Ohne SL bieten die Entry-Buttons 0,5 %
oder 0,9 % an. Sie verwenden die bestehenden 250-/450-USD-Kontobudgets einschließlich
Kostenreserve; begrenzendes Restbudget und effektiver Betrag werden ausgewiesen.

MT5 besitzt pro Position nur einen nativen SL. Deshalb schützt der äußerste SL immer das
gesamte Restvolumen; innere Teil-SLs überwacht der Worker. Das Budget wird gegen den Verlust
der gesamten Restmenge am äußersten SL geprüft, nicht gegen einen günstigeren gewichteten
Teilclose-Verlauf. Bei Worker-Ausfall bleiben dieser Broker-SL und ein möglicher nativer TP
bestehen; synthetische Teilcloses können ausfallen. Bei vollständiger SL-Prozentaufteilung
geht ein Rundungsrest an den äußersten SL. Nicht ausführbare Mindestmengen bleiben gesperrt.
TP-Reste werden weiterhin ausdrücklich unverplant belassen.

Ein gemeinsamer Checkpoint und atomare Versandrechte verhindern konkurrierende TP-/SL-Closes.
Nach einem Teilclose werden die noch offenen Mengen der Gegenseite proportional reduziert.
Externe Änderungen an Volumen oder Brokerabsicherung pausieren den Plan; ein bloßer TP-Edit
setzt einen inzwischen manuell engeren SL nicht wieder zurück. Ungeklärte Ergebnisse bleiben
`unknown` und sperren weitere Aktionen; nie durch neue Revision oder Journal-Löschen umgehen.
Die priorisierte Tagesnotbremse läuft vor der Exitplan-Engine.

R verwendet den Preisabstand zum belegten initialen SL. Fehlt dieser, legt erst der erste
bestätigte Verlust-SL eine unveränderliche neue Planbasis fest. Break-even oder Gewinnsicherung
allein ergeben keine erfundene Verlustbasis: dann bleibt R unbekannt. Die Nettoanzeige ist eine
Schätzung aus nativer Gewinn-/Verlustberechnung, anteiligen gespeicherten Entrykosten, aktuellem
Swap und belegtem Exitkostenprofil. Fehlende Kosten bedeuten unbekannt, nicht null. Die
25-USD-Reserve ist keine tatsächliche Gebühr. Neue offene Positionen liefern ihre Deals einmal
gezielt nach; es gibt dafür keinen zusätzlichen Vollhistorien-Poll.

Migration `20261113200000_mt5_split_stop_plans.sql` erweitert die privaten Pläne und Versandrechte;
Altpläne werden dabei nicht verändert. Neue SL-Pläne benötigen `exit_plans_ready` und explizite
Version 1 bei Poll/Claim. Neue Workerdateien werden vollständig versioniert bereitgestellt;
private Konfiguration, Kontozuordnung und SQLite-Journal bleiben unverändert. Vor dem Worker
werden Migration und Edge-Funktionen veröffentlicht. Keine echte Brokerorder gehört zum Testablauf.

Broker-Schnittstelle: [MT5 order_send](https://www.mql5.com/en/docs/python_metatrader5/mt5ordersend_py),
[Positions-SL/TP](https://www.mql5.com/en/docs/constants/tradingconstants/positionproperties)
und [native Gewinnberechnung](https://www.mql5.com/en/docs/python_metatrader5/mt5ordercalcprofit_py).
