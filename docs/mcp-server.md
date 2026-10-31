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
`fixedStartTime`) defaulten auf dieselben period-5/2-Werte wie der "Daten-Export"-Button. Seit Task
"Market-Structure-Startpunkt: 1D-Periode-4-Pivots" (2026-08-30) ist der Default-Cutoff (wenn
`fixedStartActive` GAR NICHT im Aufruf steht, nicht explizit `false`) der letzte persistierte
1D-Periode-4-Fraktal-Pivot dieses Instruments (`daily_structure_pivots`, aufgelöst über
`structure_start_time` — siehe `daily-structure-pivots/index.ts` und
`src/marketStructureAnalysis.notes.md`), nicht mehr ein rollierendes Zeitfenster. Nur solange für
ein Instrument noch kein Pivot vorliegt, fällt `compute1hStructureState` auf das alte Verhalten
zurück: 21 Tage rollierender Lookback (`STRUCTURE_LOOKBACK_HOURS` in `dataExport.ts`,
MCP-Server-only — der Button selbst bleibt bei 7 Tagen), damit ein zu kurzes Fenster nicht den
Ursprung eines mehrfach verschachtelten Trends abschneidet (siehe `marketStructureAnalysis.rules.md`
"beliebige Verschachtelungstiefe"). Ein explizit übergebener "fixer Start"
(`fixedStartActive: true`) hat weiterhin Vorrang vor beidem — lebt nur in Philips
Browser-`localStorage` (nie zu Supabase synced), der Tool kann ihn nicht selbst entdecken, bei
Bedarf nachfragen statt raten.

## Warum nicht einfach `src/dataExport.js` wiederverwenden

`buildDataExport` (und transitiv `liquidity.js`/`chartColors.js`/`sessions.js`) fasst
`localStorage` und `import.meta.env` zur Modul-Ladezeit an — crasht sofort außerhalb des Browsers.
`db.ts` liest stattdessen die bereits von `poi-watcher` persistierten
`ob_zones`/`liquidity_levels`-Tabellen statt aus Kerzen neu zu detektieren (kein dritter Port der
Detection-Algorithmen). Kleine, stabile, dependency-freie Stücke sind hier in Deno-sicherer Form
dupliziert: `_shared/berlinTime.ts` (Berlin-Zeitzonen-Datumsmathe aus `dataExport.js`),
`db.ts`s `filterRelevantRows` (aus `liquidity.js`s `filterRelevantLevels`), `tools/annotations.ts`s
`validateAnnotations` (aus `src/annotations.js`s `validateAnnotationList`). Wird eines der
Originale geändert, prüfen ob der Port hier denselben Fix braucht.

`berlinTime.ts`/`sessionOccurrences.js`/`pipConfig.js` lagen bis 09/2026 direkt in diesem Ordner
und liegen seitdem in `_shared/` — `poi-watcher` braucht dieselben Bausteine für sein
Forbidden-Session-Gate, und `_shared/` ist die einzige Cross-Function-Grenze im Repo (eine dritte
Kopie wäre die Alternative gewesen).

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

## Private MMT-Handelskonten

`list_mt5_trading_accounts` liest sichere Kontometadaten und das aktive Konto ohne
Credentials. `select_mt5_trading_account(account_id)` wählt ausschließlich nach konkretem
menschlichem Wechselauftrag genau ein Handelskonto; `null` wählt ab. Keine Order und keine
Vervielfachung oder Umleitung bestehender Suchen. UI und MCP teilen den atomaren Auswahlpfad.
Wechsel-Sperren und Worker-Neustart: [Aktives Handelskonto wechseln](milky-meta-trader.md#aktives-handelskonto-wechseln).
Tests ohne echte Kontowechsel: `node --test test/mt5AccountSelection.integration.mjs` sowie
`deno test --config supabase/functions/trading-monitor-mcp/deno.json --allow-env test/mt5AccountTools.deno.ts`.

## Privates MMT-Journal

`get_mt5_broker_history` liest native Deals samt Profit, Commission, Swap, Gebühren,
Kontowährung und Historien-Sync. Erste Seite enthält sichere Kontometadaten ohne Secrets.
`after_id=next_cursor` fortsetzen, bis `rows` leer ist; kurze Seiten sind kein Ende.
Historische SL/TP werden vom Dealarchiv nicht belegt und bleiben unbekannt.

`mt5_journal_import` verbindet eine ausdrücklich ausgewählte Brokerposition mit einer
vorhandenen `dealing_ranges.id`. Konto-UUID, Server, Brokerpositions-ID, exaktes Brokersymbol
und ausdrücklich zugeordnetes Journalinstrument sind Pflicht. Symbol/Zeit allein beweisen
keine Zuordnung. Bei bereits manuell journalisiertem Trade `existing_position_id` angeben;
solange öffentliche Positionen auf der DR vorhanden sind, wird ein neuer Insert abgewiesen.
Die optionale Journalkonto-ID wird nicht aus dem Brokernamen geraten. Mehrere importierte
Re-Entries können derselben DR zugeordnet werden.

Migration `20261031230000_mt5_journal.sql`: `import_mt5_journal` sperrt den Identitätsschlüssel
transaktional; Unique-Constraints verhindern doppelte Broker- und Journalzuordnung. Retry
liefert dieselbe Position, eine andere DR wird abgewiesen. Native Entry/Exit/Volumen/Netto/
Commission kommen aus dem vorhandenen `closedBrokerTrades`-Aggregator. Nur vollständig
geschlossene, widerspruchsfreie Verläufe bei bestätigtem Full-Sync sind importierbar.
Bekannter SL und Journalkonto einer vorhandenen Position bleiben bei fehlenden Brokerwerten
erhalten. R wird nicht aus aktuellem oder geratenem SL berechnet. Historischer Import löst
keinen heutigen Live-Loop aus und sendet keine Brokerorder.

`broker_private` schützt importierte `trade_positions` zusätzlich zu den bisherigen
permissiven Policies durch eine restriktive RLS-Policy für anon/authenticated. Die Link-
und Kommentartabellen haben keine öffentlichen Rechte. Die Import-RPC ist ausschließlich
für service_role freigegeben. Die private API und der bestehend authentifizierte MCP dürfen
die Daten lesen/schreiben. `get_journal` bleibt bei seinen bisherigen öffentlichen Daten;
`mt5_journal_positions` ergänzt die privaten Positionen mit identischen Chart-Embeds.
Im Browser lädt `fetchTrades` private Positionen nach MMT-Entsperren und verwendet denselben
Mapper, Editor und Chart. Ohne MMT-Schlüssel werden keine privaten Positionen geladen.
Ein ungültiger Schlüssel erzeugt einen Ladefehler statt einer scheinbar vollständigen Liste.

`mt5_journal_context` löst die Brokeridentität auf Journalposition und DR auf.
`mt5_journal_comments` liest gemeinsame private Kommentare je Journalposition mit UUID-
Keyset-Paginierung. `mt5_journal_comment_save` erstellt/korrigiert mit stabiler Kommentar-UUID:
`statement` = belegte Aussage, `observation` = belegbare Beobachtung, `hypothesis` = ausdrücklich
Vermutung. Quelle und Ereigniszeit mit Zeitzone sind Pflicht; keine erfundenen Aussagen oder
psychologischen Diagnosen. Erst eine tatsächliche Änderung setzt `updated_at` neu; der
Eltern-Trade bleibt fest. Die gleiche `TradeJournalComments`-Komponente erlaubt Lesen und
Korrigieren in MMT und im vorhandenen Trade-Editor. Vor dem Import ist eine Brokerposition
noch keiner gemeinsamen Journal-Kommentarhistorie zugeordnet.

`mt5_journal_position_update` korrigiert ausdrücklich übergebene Journalfelder hinter dem
privaten Zugriff; Original-Deals bleiben unverändert. Löschen verknüpfter Positionen ist
durch den Link-FK gesperrt. Rücknahme des Frontend-/Backend-Releases kann die neue UI entfernen;
RLS und private Tabellen dabei zum Schutz vorhandener Brokerdaten erhalten.

Prüfung: `npx vitest run test/mt5JournalContract.test.js test/privateJournal.test.js` sowie
`deno run --node-modules-dir=none --allow-read --allow-env --allow-sys scripts/checkMt5JournalMigration.ts`.
Der SQL-Test verwendet isoliertes PostgreSQL-WASM, keine Produktionsdaten. Deno-MCP-Prüfung
mit `--config supabase/functions/trading-monitor-mcp/deno.json`, damit die vorhandenen
SDK-/Zod-Pins gelten.

## Write-Tool-Safety: `post_chart_annotations` vs. Pin

`post_chart_annotations` ist NACHRANGIG zu den Pin-Tools — für alles mit passendem Pin-`kind`
zuerst `add_pin_entry` versuchen. `post_chart_annotations` bleibt nur für: einzelne Kerze markieren,
freie Preis-Notiz ohne zugrundeliegendes erkanntes Objekt, RSI-Divergenz-Sonderfälle. Alle drei
Write-Tools (`add_pin_entry`/`remove_pin_entry`/`post_chart_annotations`) sind in
`.claude/settings.local.json` (gitignored, personal-machine) allow-gelistet — taucht bei einem
davon unerwartet ein Bestätigungs-Prompt auf, direkt diese Datei prüfen statt zu raten.

## Pin (`tools/pins.ts`)

Die Statistik-Seite pinnt `simulation_dr`, `simulation_checkpoint` und `simulation_entry`
browserseitig in dieselbe Tabelle. `get_pin_context` liefert `simulation_context` vollständig:
eingefrorener Lauf-/Regel-/Entry Pattern-Stand, DR-Ausgang, Registry-Belege, beide SL-Ergebnisse,
Berlin-/UTC-Zeiten, Chart-Link und Pin-Zeitpunkt. Wiederholtes Pinnen ändert nur die Notiz.
`add_pin_entry` nimmt diese Arten nicht an; `remove_pin_entry` entfernt sie wie alle Pins per ID.
Die Referenzspalten, CHECK und der Upsert-Schlüssel stehen in
`20261004140000_simulation_pin_context.sql`; Registry-Merkmale sind im JSON per SQL abfragbar.
Chart-Rendering und Touch-Alarme ignorieren diese Arten. Geänderte Tool-Beschreibungen werden
in bestehenden Chats erst nach einem neuen Sitzungsstart geladen.

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
