# Lana Test Data — GBPUSD Backtest 28.08.2026, Cutoff 08:45 Berlin

Rohdaten-Dumps aus einer laufenden Laniakea-Analyse (Session unterbrochen bei Philips Frage zu
"Output too large"). Zweck dieses Ordners: Material für Philip + Vegapunk, um das MCP-Tool-Output-
Handling zu verbessern, damit Lana nicht mit unnötig großen Rohdaten geflutet wird.

## Aufgerufene MCP-Tools (chronologisch)

1. **`get_data_export`** (`instrument=GBPUSD`, `dateStr=2026-08-28`, `replayUntilSec=1787899500`
   [= 2026-08-28 06:45 UTC = 08:45 CEST])
   - **Warum:** laut `00-trading-steps.md`/`chart-daten.md` das Pflicht-Erstwerkzeug für jede
     Trading-Tag-Analyse — liefert Kerzen, Asia-Range, 1H-Structure-Trend, Liquidity-Level und
     OB-Zonen in einem Call.
   - **Ergebnis:** 152.786 Zeichen / 5.817 Zeilen → Tool-Limit überschritten, komplette Antwort
     automatisch in eine Datei umgeleitet (kein Datenverlust, siehe unten).
   - Datei hier: `get_data_export_GBPUSD_2026-08-28_0845.json`

2. **PowerShell-Zwischenschritte** (kein MCP-Tool, sondern lokales Auslesen der obigen Datei via
   `ConvertFrom-Json`), mehrere Calls:
   - Top-Level-Keys auflisten (`replay`, `asiaSession`, `structureTrendAge`, `structureWindow`,
     Kerzen-Anzahl) — um zu wissen, welche Felder überhaupt existieren, bevor gezielt gefiltert wird.
   - `structure1h`/`liquidityLevels`/`obZones` als volles JSON (`ConvertTo-Json -Depth 6/12`) — DIES
     war mit 139,7 KB selbst zu groß, wurde ebenfalls automatisch in eine Datei umgeleitet (nur
     2-KB-Vorschau zurückgegeben). Datei hier: `get_data_export_structure_liquidity_obzones_dump.json`
   - Danach dieselben Felder erneut, aber gefiltert/kompakt als Klartext-Zeilen
     (`Where-Object`/`ForEach-Object` statt vollem JSON) — blieb unter dem Limit, kam vollständig
     durch. Zählung im Anschluss bestätigt: 216 `obZones`, 19 `liquidityLevels`, 42 `m5ObZones`,
     13 `m5LiquidityLevels`, 22 Haupt-Kerzen, 84 Asia-Kerzen — deckt sich mit den vollständigen
     Werten aus der Rohdatei.

3. **`get_trading_schedule`** (`instrument=GBPUSD`)
   - **Warum:** Schritt 1 (Check Handelszeit) — Handels-/Alarmfenster für GBPUSD, inkl. MMM-Session-
     Hinweis (10:30-13:00 Uhr nur mit Zusatz-Bestätigung).

4. **`get_news_events`** (`fromTime=2026-08-27T22:00:00Z`, `toTime=2026-08-28T07:00:00Z`)
   - **Warum:** Schritt 2 (Check News) — Zeitfenster deckt Asia-Session + Vorlauf bis Cutoff ab.
     Ergebnis: leer → laut `02-check-news.md` heißt das "keine Daten hinterlegt", nicht zwingend
     "keine News" (News-Tabelle wird nur für aktuell gehandelte Tage manuell gepflegt).

5. **`get_trade_setups`** (`instrument=GBPUSD`, `fromSec=1787824800`)
   - **Warum:** um zu prüfen, welche App-erkannten Setups (M5-Sweep+Fraktal+OB) bereits vor dem
     08:45-Cutoff existierten (Schritt 5, Fall 1/2/3-Bestimmung) — Ergebnis musste manuell nach
     `created_at <= Cutoff` gefiltert werden, da das Tool selbst nicht replay-aware ist (mehrere
     Setups mit `created_at` deutlich NACH dem Cutoff kamen mit zurück und mussten verworfen werden).

6. **`get_journal`** (`instrument=GBPUSD`, `limit=10`)
   - **Warum:** Abgleich, ob für den 28.08. bereits eine Dealing Range im Journal hinterlegt ist
     (keine gefunden — jüngste Einträge stammen aus 25.-27.08. bzw. älter).

## Rohdaten pro MCP-Call (1:1 Dateien)

Auf Philips Wunsch ("kannst du für jeden MCP Aufruf die Response in ne Datei packen?") liegt hier
zusätzlich pro Tool-Call die Roh-Response als eigene Datei, unabhängig davon, ob der Call selbst
über das Kontext-Limit lief:

- `get_trading_schedule_GBPUSD.json`
- `get_news_events_2026-08-28.json`
- `get_trade_setups_GBPUSD_from-2026-08-27.json`
- `get_journal_GBPUSD_limit10.json`

(Die beiden `get_data_export`-Dateien oben zählen ebenfalls dazu.) Gilt ab jetzt für jeden
weiteren MCP-Call in dieser Session.

## Punkte für Vegapunk — alle erledigt (30.08.2026)

1. **`get_data_export`/`get_trade_setups` lieferten mehr Rohdaten, als für eine Replay-Analyse bis
   zu einem festen Cutoff nötig ist** — Philip: "ich verbessere das jetzt dann gleich mit
   Vegapunk, damit du nicht mit Daten vollgemüllt wirst".
   - `get_trade_setups`: Default-`limit` 50 → 2 ("die letzten 2 reichen ja"), plus neuer
     `replayUntilSec`-Parameter (filtert auf `created_at`, vorher kamen Setups nach dem Cutoff
     unfiltriert zurück).
   - `get_data_export`: `obZones`/`liquidityLevels` in `obZones1h`/`obZones4h`/`liquidityLevels1h`/
     `liquidityLevels4h` aufgeteilt, preis-/zeitgefiltert statt des gesamten historischen Bestands
     (216 → 17 Zonen im Testfall), kuratierte Form (poi-watcher-Interna raus) + neues `kontext`-Feld
     (Alter, ohne Session-Bonus). `m5ObZones` zusätzlich preisgefiltert (20 Pips, ohne Zeit-
     Ausnahme — bei M5 ist "vor Tagen getoucht" der Normalfall, kein Signal) + `kontext`.
     `structurePivots` auf letzte 8 Einträge gekappt. `pivotAt`/`touchedAt` jetzt Berlin-formatiert
     statt roher Unix-Sekunden-Strings (`computeRangesPivots`s bisher ungenutzter `formatTime`-
     Parameter). `asiaSession.candles` entfernt (nur noch `rangeHigh`/`rangeLow`).
     **Ergebnis: 152.786 → 21.762 Bytes (−86%)** für denselben Testfall, siehe
     `get_data_export_GBPUSD_2026-08-28_0845_AFTER_SLIMMING.json`.
2. **`get_journal` brauchte einen Datums-Filter.** Neuer optionaler `dateStr`-Parameter (YYYY-MM-DD,
   Europe/Berlin), filtert `triggered_at` auf den Kalendertag — `get_journal('GBPUSD', dateStr:
   '2026-08-30')` funktioniert jetzt.

Code: `supabase/functions/trading-monitor-mcp/{db.ts,tools/dataExport.ts,tools/reads.ts,
tools/nearRelevantObZones.ts}`. Handbuch (`trading`-Repo) entsprechend nachgezogen
(`chart-daten.md`, `00-trading-steps/03-htf-bias/03-htf-bias.md`). Testskript (ruft `buildDataExport`
direkt auf, ohne zu deployen): `supabase/functions/trading-monitor-mcp/scripts/testDataExport.ts`.
