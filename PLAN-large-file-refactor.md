# PLAN: Sehr große Dateien refactoren (PriceChart.vue u.a.)

Task: `sehr-gro-e-dateien-refactoren-z-b-pricechart-vue` (milk-city, trading-monitor).
Status (2026-08-25): Phase 1-5 umgesetzt und committet (Philip: "schritt für schritt migrieren, mit
Tests absichern"), je ein eigener Commit pro Phase, `npm run test`+`npm run build`+Dev-Server-
Kompilier-Check nach jedem Schritt grün. `PriceChart.vue`: 3801 → 3453 Zeilen. Phase 6 offen.

Phase 5 lief anders als unten ursprünglich skizziert: statt eines Mocks für das komplette
`chart`/`candleSeries`-Objekt injiziert PriceChart.vue nur die jeweils gebrauchte einzelne
Koordinaten-Umrechnungsfunktion (`priceToCoordinate`/`timeToCoordinate` als `(value) =>
number|null`) in die neuen reinen `match*`-Funktionen (`priceChartHitTest.js`) — dadurch komplett
ohne lightweight-charts-Mock testbar, keine neue Test-Infrastruktur nötig. Einfacher als gedacht,
siehe Commit-Historie für die tatsächliche Aufteilung je Phase.

## Ausgangslage

`src/components/PriceChart.vue` ist mit 3801 Zeilen (~217KB) die mit Abstand größte Datei im
Repo — mehr als das Doppelte der nächstgrößeren (`Dashboard.vue`, 1935 Zeilen). Das
Read-Tool-Default-Limit (2000 Zeilen) schneidet sie beim Volleinlesen ab, ein Agent braucht
mehrere Reads nur um die Datei zu sehen, geschweige denn zu ändern.

## Warum kein 1:1 marketStructureAnalysis/-Rendering-Split

Der bestehende `marketStructureAnalysis.ts`/`marketStructureRendering.ts`-Split funktioniert, weil
beide Seiten **reine Funktionen mit expliziten Parametern** sind — kein gemeinsamer, mutierbarer
Zustand zwischen ihnen, nur ein Rückgabewert, der von einem in den anderen durchgereicht wird.

`PriceChart.vue` ist strukturell anders: fast alle `refresh*Internal()`-Funktionen (Trade-Marker,
OB-Zonen, Liquidity, Sessions, News, Ranges, Trade-Setups, RSI-Divergenz, Claude-Callouts, …)
teilen sich **~30 modul-scope Closure-Variablen** (`chart`, `candleSeries`, `allCandles`,
`orderBlockPrimitives`, `liquidityPrimitives`, `currentTradeSetups`, `focusedTradeSetup`, etc.) —
sie lesen und schreiben denselben mutablen State direkt aus der Closure, nicht über Parameter.
Ein 1:1-Split würde entweder (a) ein großes gemeinsames Context-Objekt einführen, das durch jede
Composable-Funktion gereicht wird, oder (b) Dutzende Parameter pro Funktion — beides ein
substanzieller struktureller Umbau, kein reines Verschieben von Code.

Die eigentlichen **Algorithmen** (Order-Block-/Liquidity-/Trade-Setup-Erkennung) leben bereits in
eigenen Dateien (`orderBlocks.js`, `liquidity.js`, `tradeSetup.js`, `marketStructureAnalysis.ts`)
— PriceChart.vue enthält nur noch die **Orchestrierung** (wann wird was mit welchen Props neu
berechnet und gegen `candleSeries` gezeichnet) plus einiges an **Merge-/Filter-Logik**, die bisher
nirgends ausgelagert ist.

## Strategie

Nicht in einem Zug in Feature-Composables aufteilen (siehe verworfene Option unten). Stattdessen:

1. **Zuerst die bereits reinen bzw. leicht parametrisierbaren Funktionen extrahieren** — Dinge, die
   nur auf ihre Argumente rechnen und keine `chart`/`candleSeries`-Objekte anfassen. Diese sind
   ohne Weiteres in Vitest testbar, komplett unabhängig von lightweight-charts.
2. **Jede Extraktion ist ein eigener, kleiner Schritt**: Funktion(en) in eine neue Datei verschieben
   → Testdatei dafür schreiben (Verhalten VOR der Verschiebung als Referenz, falls unklar: kurz in
   der Konsole/einem Scratch-Test nachvollziehen) → PriceChart.vue auf den Import umstellen → `npm
   run test` + `npm run build` grün → kurzer manueller Smoke-Test im Dev-Server (Chart lädt, Zonen/
   Level erscheinen wie vorher) → erst dann nächster Schritt.
3. **Die Klick-Hittest-Funktionen** (`findClickedSetup`, `findClickedLiquidityLevel`, …) brauchen
   `chart`/`candleSeries` (Koordinaten-Konvertierung) — testbar, aber erst mit einem Mock für diese
   beiden Objekte. Eigene, spätere Phase.
4. **Die `refresh*Internal()`-Zeichenfunktionen selbst** (die tatsächlichen
   `candleSeries.attachPrimitive(...)`-Aufrufe) bleiben vorerst in der Komponente. Sie sind gegen
   lightweight-charts nicht sinnvoll unit-testbar (kein Canvas im Testrunner, keine bestehende
   Infrastruktur dafür in diesem Repo), und jede hat schon jetzt oft eine reine "was soll gezeichnet
   werden"-Berechnung, die per Phase 1-3 rausgezogen wird — übrig bleibt dann ein kurzer, rein
   imperativer Rest ("detach alte Primitives, erzeuge neue, attach"), der die Zeilenzahl zwar noch
   nicht drastisch senkt, aber die eigentliche fachliche Logik aus der riesigen Datei herauszieht
   und testbar macht.

## Phasenplan

Jede Phase = ein eigener, in sich abgeschlossener Refactoring-Schritt. Reihenfolge nach Risiko
aufsteigend (sicherste/isolierteste zuerst).

### Phase 1 — Candle-/Zeit-Helfer → `src/priceChartCandles.js`

Bereits pure oder mit einem Parameter statt Closure-Zugriff pure zu machen:

- `mergeRecent(existing, freshRecent)` (Zeile ~725) — schon pure.
- `isTimeCovered(candles, time, barSeconds)` (Zeile ~748) — schon pure. Passt inhaltlich auch zu
  `chartTimeUtils.js` (dort leben `snapToBarTime`/`nextCandleAfter`/`businessSecondsBetween`,
  dieselbe Kategorie) — Alternative: dort einsortieren statt neuer Datei.
- `tradesVisibleForCandles(trades, candles)` (Zeile ~782) — schon pure.

Testdatei: `test/priceChartCandles.test.js` (oder Erweiterung von
`test/chartTimeUtils.test.js`, falls in `chartTimeUtils.js` einsortiert).

### Phase 2 — OB-Zonen-Merge/Touch-Logik → `src/priceChartObZones.js`

Aktuell an `props`/Closures gekoppelt, aber mit expliziten Parametern statt `props.x` pure machbar:

- `filterHistorical(zones, showHistoricalObs)` (Zeile ~1279) — `props.showHistoricalObs` → Parameter.
- `currentPriceEstimate(candles)` (Zeile ~1298) — `allCandles` → Parameter.
- `filterDbObZones(dbObZones, symbol, timeframe, replayUntil, price)` (Zeile ~1301) — 4 Closure-
  Zugriffe → Parameter.
- `collectObsZones(...)` (Zeile ~1315) — ruft `detectOrderBlocks` (orderBlocks.js) + obige Helfer,
  bleibt zusammengesetzt, aber pure mit genug Parametern.
- `liveObZonesForTimeframe`/`liveObZoneState` (Zeile ~1340/1345) — analog.
- `mergePinnedZones(zones, pinnedZones, candles)` (Zeile ~1358) — **schon pure**, keine Änderung nötig.
- `firstCandleTouch(candles, sourceTime, price)` (Zeile ~913) — schon pure.
- `firstCandleTouchRange(candles, sourceTime, rangeLow, rangeHigh)` (Zeile ~932) — schon pure.
- `obBoxTouchState(item, candles, liveObZoneState)` (Zeile ~946) — pure, `liveObZoneState` als
  injizierte Funktion statt Closure-Aufruf (oder direkt mitverschieben, s.o.).

Testdatei: `test/priceChartObZones.test.js`. Diese Gruppe hat die meiste Bug-Historie in den
Kommentaren (touched/endTime-Prioritätskette, Selbstheilung) — hier lohnen sich Tests am meisten,
und die Kommentare (Bug-Reports 2026-07-30/31, 2026-08-07/25) wandern 1:1 mit.

### Phase 3 — Liquidity-Merge → `src/priceChartLiquidity.js`

- `mergePinnedLevels(levels, pinnedLevels, candles)` (Zeile ~1411) — schon pure.
- `computeHtfLiquidityLevels(dbLiquidityLevelsHtf, symbol, replayUntil, price, candles)` (Zeile
  ~1446) — Closures → Parameter.
- `mergeDbLiquidityLevels(levels, dbLevels)` (Zeile ~1469) — schon pure.

Testdatei: `test/priceChartLiquidity.test.js`.

### Phase 4 — RSI-Divergenz-Pin-Merge

- `mergePinnedDivergences(divergences, pinnedDivergences, candles)` (Zeile ~2239) — schon pure.
  Klein genug, um in `rsi.js` oder `rsiRendering.js` mit aufzunehmen statt einer eigenen Datei —
  Entscheidung beim Umsetzen anhand dessen, wo die Tests am natürlichsten hinpassen.

### Phase 5 (höheres Risiko) — Klick-Hittest-Funktionen

`findClickedSetup`, `findClickedLiquidityLevel`, `findClickedOBZone`, `findClickedFibLevel`,
`findClickedDivergence`, `findClickedTarget` (Zeile ~1889-2045). Brauchen ein Mock für
`chart.timeScale().coordinateToTime`/`candleSeries.coordinateToPrice`/`priceToCoordinate` — kein
Blocker, aber neue Test-Infrastruktur (bisher hat kein Test in diesem Repo lightweight-charts
gemockt). Eigene Phase, erst nach 1-4 angehen.

### Phase 6 (größtes Risiko, eigener Folge-Task) — Rendering-Orchestrierung

Die `refresh*Internal()`-Funktionen selbst, `refreshChart()`, `onMounted`/`onUnmounted`, alle
`watch(...)`-Aufrufe, Poll-Timer (`scheduleNextPoll`/`scheduleNextRangesPoll`/
`scheduleNextTradeSetupM5Poll`), Callout-rAF-Loop. Das ist der Teil, der wirklich ein gemeinsames
Context-Objekt bräuchte, um in mehrere Composables zu wandern — nach Phase 1-5 ist die Datei
bereits spürbar kleiner (die reine Fachlogik ist raus), ob sich der Umbau des verbleibenden,
stark Vue-Lifecycle-/lightweight-charts-lastigen Rests noch lohnt, lässt sich dann realistischer
beurteilen als jetzt. Kein Commitment in diesem Plan, ob/wann das angegangen wird.

## Nicht-Ziele

- Kein Verhalten ändern, keine Bugs "nebenbei" fixen, keine Vereinfachung der Fachlogik — reines
  Verschieben + Parametrisieren. Jeder Bug-Report-Kommentar wandert mit der Funktion mit.
- Template/Style bleiben unangetastet (reine `<script setup>`-Extraktion).
- `Dashboard.vue` (1935 Zeilen, zweitgrößte Datei) ist NICHT Teil dieses Plans — andere Struktur
  (mehr reines Props-Durchreichen an Kindkomponenten, weniger lightweight-charts-Kopplung), eigene
  Analyse wert, falls das nach PriceChart.vue noch relevant ist.

## Verworfene Option: vollständiger Feature-Composable-Split in einem Zug

Wurde Philip als Option 3 vorgelegt (Trades/Liquidity/OB-Zonen/Sessions/Ranges/Callouts/
Candle-Loading/Klick-Hittests je als eigenes Composable, alles in dieser Runde). Nicht gewählt —
zu hohes Risiko in einem Schritt für eine Datei ohne bestehende Test-Abdeckung fürs eigentliche
Zeichnen, und widerspricht "schritt für schritt, mit Tests abgesichert". Die Phasen 1-4 oben liefern
denselben Kontextkosten-Nutzen (die meiste Fachlogik raus aus der großen Datei) bei viel kleinerem
Risiko pro Schritt.
