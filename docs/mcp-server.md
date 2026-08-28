# MCP-Server: tiefere Referenz

Exponiert die App-Daten als Tools für Claude (ersetzt das alte "Daten-Export-Button →
copy/paste"-Verfahren). Einzige Kopie, Deno: `supabase/functions/trading-monitor-mcp/`.

## Eine Kopie, Deno (früher Dual-Copy mit `mcp-server/`)

Bis 2026-08-27 gab es zusätzlich `mcp-server/`, eine lokale Node/`npx tsx`-Authoring-Kopie, von der
aus jede Tool-Änderung von Hand nach `supabase/functions/trading-monitor-mcp/` portiert wurde
(Deno-kompatible Imports: `npm:`-Präfix statt bloßer Paketname, `.ts`- statt `.js`-Extensions).
Komplett gelöscht (Philip: "war von früher, als wir den MCP nur lokal verwendet haben") —
`supabase/functions/trading-monitor-mcp/` ist jetzt die einzige Kopie, kein Portier-Schritt mehr
nötig.

`supabase/functions/trading-monitor-mcp/scripts/` (`backfillForexCandles.ts`, `backfillObZones.ts`,
`backfillLiquidityLevels.ts`, `rsiDivergenceStats.ts`) sind manuelle One-off-Scripts (`deno run`,
kein laufendes Tool im MCP-Server selbst) — bei der Löschung von `mcp-server/` nach Deno portiert,
damit die Backfill-Funktionalität erhalten bleibt.

## Deployment

HTTP-Transport, deployed als Supabase Edge Function `trading-monitor-mcp` — `.mcp.json` zeigt auf
`https://<project>.supabase.co/functions/v1/trading-monitor-mcp` mit
`Authorization: Bearer ${TRADING_MONITOR_MCP_TOKEN}` (eigenes Bearer-Schema, keine Supabase-JWT,
`verify_jwt = false` in `supabase/config.toml`). Läuft ohne lokalen Prozess, kann auch als
Remote-Connector in Claude Desktop/claude.ai registriert werden.

## Auth & Tabellenrechte

Anon-Key-Pattern wie `src/supabaseClient.js` (kein `service_role`):
- Read-only: `ob_zones`, `liquidity_levels`, `trade_setups`, `trade_partial_exits`, `news_events`,
  `trading_schedules`, `trading_accounts`
- Read+Insert: `claude_annotations`
- Full read/write: `dealing_ranges`, `trade_positions`, `trade_targets` (Trade-Journal-Tools)

## `get_data_export` — der Einstiegspunkt

Bündelt M5-Kerzen + Asia-Session-Range, 1H-Struktur/Trend, relevante Liquidity-Levels und OB-Zonen
für ein Instrument in einem Call, statt ein halbes Dutzend `get_*`-Tools einzeln zu feuern.
Struktur-Trend-Parameter (`periodOuter`/`periodInner`/`lookbackHours*`/`fixedStartActive`/
`fixedStartTime`) defaulten auf dieselben period-5/2-Werte wie der "Daten-Export"-Button, aber mit
21 Tagen rollierendem Lookback (`STRUCTURE_LOOKBACK_HOURS` in `dataExport.ts`, MCP-Server-only —
der Button selbst bleibt bei 7 Tagen), damit ein zu kurzes Fenster nicht den Ursprung eines
mehrfach verschachtelten Trends abschneidet (siehe `marketStructureAnalysis.rules.md`
"beliebige Verschachtelungstiefe"). Ein nicht-default "fixer Start" lebt nur in Philips
Browser-`localStorage` (nie zu Supabase synced) — der Tool kann ihn nicht selbst entdecken, bei
Bedarf nachfragen statt raten.

## Warum nicht einfach `src/dataExport.js` wiederverwenden

`buildDataExport` (und transitiv `liquidity.js`/`chartColors.js`/`sessions.js`) fasst
`localStorage` und `import.meta.env` zur Modul-Ladezeit an — crasht sofort außerhalb des Browsers.
`db.ts` liest stattdessen die bereits von `poi-watcher` persistierten
`ob_zones`/`liquidity_levels`-Tabellen statt aus Kerzen neu zu detektieren (kein dritter Port der
Detection-Algorithmen). Kleine, stabile, dependency-freie Stücke sind hier in Deno-sicherer Form
dupliziert: `berlinTime.ts` (Berlin-Zeitzonen-Datumsmathe aus `dataExport.js`),
`db.ts`s `filterRelevantRows` (aus `liquidity.js`s `filterRelevantLevels`), `tools/annotations.ts`s
`validateAnnotations` (aus `claudeAnnotations.js`s `validateAnnotationList`). Wird eines der
Originale geändert, prüfen ob der Port hier denselben Fix braucht.

## Trade-Journal-Write-Tools (`tools/trades.ts`)

`create_trade` legt eine `dealing_ranges`-Zeile (Idee) plus GENAU EINE `trade_positions`-Zeile
(Execution) plus optional `trade_targets` an — entspricht dem Idee/Execution-Split (siehe
CLAUDE.md "Trade journal"-Abschnitt). Keine echte Transaktion (Supabase-JS-Client kann das ohne
eigene Postgres-RPC nicht) — schlägt der `trade_positions`-Insert nach dem `dealing_ranges`-Insert
fehl, löscht `createTrade` die `dealing_ranges`-Zeile wieder statt eine Waise zu hinterlassen.
`update_trade_position`/`update_dealing_range` patchen nur tatsächlich übergebene Felder
(`Object.keys(fields)`-getrieben) — ein weggelassenes Feld bleibt unangetastet, explizites `null`
löscht es. `add_trade_position(dealingRangeId, ...)` hängt eine ZWEITE (oder dritte...) Execution
an eine BESTEHENDE `dealing_ranges`-Zeile (Re-Entry oder verzögerter Fill derselben Idee) statt
eine neue Idee anzulegen — teilt die Insert-Logik mit `create_trade` über `db.ts`s
`insertTradePosition`/`TradePositionInput`; bei Änderung den gemeinsamen Helper anfassen, nicht
duplizieren. `dealingRangeId` ist dieselbe ID, die Philip verbal über "Long#N"/"Short#N" meint.
Anders als `post_chart_annotations` sind diese Tools NICHT allow-gelistet — eine falsche
Chart-Zeichnung ist kosmetisch, ein falscher Journal-Eintrag verfälscht die Trade-Historie, also
weiter Bestätigung abfragen, außer Philip sagt explizit was anderes.

## Write-Tool-Safety: `post_chart_annotations` vs. Pin

`post_chart_annotations` ist NACHRANGIG zu den Pin-Tools — für alles mit passendem Pin-`kind`
zuerst `add_pin_entry` versuchen. `post_chart_annotations` bleibt nur für: einzelne Kerze markieren,
freie Preis-Notiz ohne zugrundeliegendes erkanntes Objekt, RSI-Divergenz-Sonderfälle. Alle drei
Write-Tools (`add_pin_entry`/`remove_pin_entry`/`post_chart_annotations`) sind in
`.claude/settings.local.json` (gitignored, personal-machine) allow-gelistet — taucht bei einem
davon unerwartet ein Bestätigungs-Prompt auf, direkt diese Datei prüfen statt zu raten.

## Pin (`tools/pins.ts`)

Pin/Unpin von Chart-POIs in die `pin_context`-Tabelle — Kinds: `ob_zone`/`liquidity_level`/
`trade_setup`/`m5_ob`/`m5_liquidity_level`/`rsi_divergence`. Spiegelt Philips Rechtsklick
"an Lana übergeben" im Browser. `trade_position`/`trade_confirmation` bleiben browser-only (kein
MCP-Write-Tool dafür). `m5_ob` ist keine eigene DB-Kind mehr — Pinnen macht ein Find-or-Create in
`ob_zones` (Timeframe `'5M'`) und speichert als normale `kind='ob_zone'`-Zeile, wie ein 1H/4H-Pin.
`m5_ob` bleibt nur auf der Input-Seite von `add_pin_entry`/der Client-Pin-Kandidatenliste
(`PriceChart.vue`s `findNearbyPinCandidates`) ein eigener Wert, weil das Auflösen den
Find-or-Create-Schritt statt eines einfachen By-ID-Lookups braucht. `m5_liquidity_level`/
`rsi_divergence` bleiben reine Snapshots (nie als eigene DB-Zeile persistiert) — ein Pin kann von
der Live-Realität abweichen, kein späteres Refresh.

Zwei Nebeneffekte hängen mit an Pin dran:
- Chart-Highlighting ("Pin-Halo") für `liquidity_level`/`m5_liquidity_level` (`src/liquidity.js`)
  und `rsi_divergence` (`src/rsiRendering.js`).
- `poi-watcher` sendet einen Telegram-"Touch"-Alarm für gepinnte `ob_zone`/`liquidity_level`/
  `trade_setup` (gegen den frisch upserteten `touched`-State) und `m5_liquidity_level` (gegen den
  aktuellen Preis) — gated über `alarm_settings`-Toggle `pin_context` +
  `notified`/`notified_at`-Spalten. `resolvePinTouch` (`poi-watcher/index.ts`) behandelt
  `ob_zones.timeframe === '5M'` als Sonderfall (direkter Preis-vs-Bounds-Vergleich statt des
  dauerhaft veralteten `touched`-Flags, weil M5 nur live-neu-berechnet wird, nie
  live-nachverfolgt). `rsi_divergence`-Pins lösen diesen Alarm bewusst nicht aus
  (Formations-Event, kein Touch-Event).

## RSI/EMA (`get_forex_rsi`/`get_forex_ema`)

M5-only, nur GBPUSD/EURUSD, teilen sich `dateStr`/`replayUntilSec`-Fenstersemantik mit
`get_data_export` (`indicatorWindow.ts`s `resolveDayWindow`/`fetchM5WithWarmup`/
`isWithinDayWindow`) — kein `dateStr` = aktueller Tag live, `dateStr` wählt einen Berlin-Kalendertag,
`replayUntilSec` deckelt auf einen simulierten Zeitpunkt. Holen zusätzlich Warmup-Kerzen VOR
Tagesbeginn, damit die Indikator-Rekursion beim ersten zurückgegebenen Punkt schon eingeschwungen
ist (sonst wäre die erste Stunde jedes Tages ungenau).

- `get_forex_rsi`: Wilder RSI(14) (`rsi.ts`). Divergenz-Erkennung (HH/LH, LL/HL) bewusst NICHT hier
  berechnet — Claude vergleicht die zurückgegebene Preis+RSI-Serie selbst; der fehleranfällige Teil
  ist die Wilder-Glättung selbst (nicht zuverlässig per Auge ableitbar), nicht das
  Pattern-Matching danach.
- `get_forex_ema`: EMA(50)/EMA(200) via `src/ema.js`s `computeEma` direkt (Cross-Directory-Import,
  dependency-frei, kein eigener Port, keine Drift-Gefahr). Warmup fix 1000 Kerzen
  (`EMA_WARMUP_CANDLES`), weil `computeEma` seine Rekursion ab der ersten Kerze seedet und
  entsprechend mehr Lead-in braucht als RSIs Wilder-Glättung, besonders für EMA(200).

## Candle-Archiv (`forex_candles`)

Sowohl Frontend als auch der MCP-Server-eigene `fetchForexCandles` sind archive-first: erst
`getForexCandlesArchiveUpTo` ("neueste N Kerzen bis zu einem Cutoff"), live nur für das
Fehlende, mit gleichem Graceful-Degradation-Verhalten bei Live-Fehlern. `get_forex_candles_archive`
bleibt als eigenes Tool nur für explizite `fromTime`+`toTime`-Bereichs-Queries relevant (mehrtägige
historische Scans) — für "neueste N bis zu einem Punkt" deckt `get_forex_candles` das jetzt ab.
`pollRecent()` (Frontend-Live-Tail) bleibt bewusst live-only — das Archiv ist auf den letzten
Backfill-Stand eingefroren, kann strukturell nie "die gerade geschlossene Kerze" vor dem nächsten
Live-Fetch liefern.

Die `forex-candles`-Edge-Function upsertet zusätzlich jede zurückgegebene geschlossene Kerze in
`forex_candles` (`persistClosedCandles`, `ignoreDuplicates: true`) — jeder einmal live
abgerufene Bereich (von irgendwem) braucht danach keinen erneuten Live-Roundtrip mehr. Nur
`period`-Werte im `bar`-CHECK-Constraint (`'5m'|'1h'|'4h'`) werden persistiert — `1m`/`3m`/`15m`/
`1D`-Fetches (Replay-Feintuning) bleiben reine Live-Reads.

## Backfill-Scripts (`supabase/functions/trading-monitor-mcp/scripts/`)

`backfillForexCandles.ts`/`backfillObZones.ts`/`backfillLiquidityLevels.ts` — manuell auszuführen,
wenn ein Pin-/Backtest-Lookup auf eine historische Lücke stößt (z. B. `poi-watcher`s rollierendes
Live-Fenster hat einen alten Pivot nie erfasst). Laufen `detectOrderBlocks`/`detectLiquidityLevels`
(dependency-frei, kein dritter Port) einmalig über die GESAMTE archivierte Kerzenserie statt über
ein rollierendes Live-Fenster, upserten mit `ignoreDuplicates: true` (nie ein live-getracktes
Zeilen-Update überschreiben, jederzeit idempotent wiederholbar) und markieren bereits-beim-ersten-
Sehen-berührte Zeilen als `notified`, damit kein rückwirkender Telegram-Alarm feuert. Kein
`sendTelegram`-Call in diesen Scripts — historische Zonen dürfen nie einen echten Alarm auslösen.

**Wichtig:** Backfill-Scripts, die in `forex_candles` schreiben, müssen `fetchLiveForexCandles`
importieren (reine Live-Funktion), NIE das archive-first `fetchForexCandles` — sonst greift
während desselben Laufs die "top up from live"-Logik auf die eigenen, noch unvollständigen
frisch geschriebenen Archiv-Zeilen zu und die Pagination-Cursor-Erwartung des Scripts stimmt nicht
mehr (Gap-/Duplikat-Risiko).

`SUPABASE_URL=... SUPABASE_ANON_KEY=... [BACKFILL_INSTRUMENTS=GBPUSD,EURUSD] deno run --allow-net
--allow-env supabase/functions/trading-monitor-mcp/scripts/backfillLiquidityLevels.ts` — analog
für die anderen Scripts, Parameter über Env-Vars (`BACKFILL_INSTRUMENTS`/`BACKFILL_BARS`/
`BACKFILL_START_DATE` je nach Script) statt Konstanten im Code.

`ob_zones`/`liquidity_levels` brauchten dafür eine anon-insert(-delete)-RLS-Policy (die Scripts
laufen mit Anon-Key, kein `service_role` lokal verfügbar) — `poi-watcher` selbst schreibt weiter
über `service_role`, unverändert.
