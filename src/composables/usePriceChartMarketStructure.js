// "Ranges"/1h-Struktur-Trend (H1-Fraktale Periode 5+2, Debug-Punktmarker) + der darauf aufbauende
// "1h-Range"-Trendalgorithmus (marketStructureAnalysis.ts: Trend, "1h LQ-Sweep", Fib-Level,
// Zeichnung) — ursprünglich computeRangesPivotsFor/refreshRangesMarkersInternal/
// refreshRangesInternal/computeMarketStructureState/refreshMarketStructureInternal/
// loadRangesCandles(Fetch-Teil) in PriceChart.vue, per Refactoring-Task "Sehr große Dateien
// refactoren" (Phase 6g, 2026-08-26) hierher verschoben. Beide Feature-Hälften kommen zusammen in
// EINEN Composable (nicht zwei), weil sie sich denselben Zustand teilen (rangesPivots/-2,
// rangesH1Candles, marketStructureState) und die Struktur-Analyse direkt auf den frisch
// berechneten Pivots aufbaut — eine Aufteilung würde nur denselben Zustand zwischen zwei Dateien
// hin- und herreichen.
//
// Braucht wie usePriceChartRsi.js ein create(chart, candleSeries)/dispose()-Lifecycle (anders als
// z.B. usePriceChartTradeSetups.js), weil refreshMarketStructure/refreshRangesMarkers direkt auf
// candleSeries zeichnen.
//
// Die Refresh-Kaskaden nach jedem Schritt (Fetch -> Pivots -> Structure -> Trade-Setups/TSC, siehe
// PriceChart.vue: loadRangesCandles/refreshRangesInternal/refreshMarketStructureInternal) bleiben
// bewusst in PriceChart.vue — die angestoßenen Refreshs (computeTradeSetupsInternal/
// refreshCockpitInternal/buildActiveMetadataSnapshotInternal) gehören zu anderen, bereits
// eigenständigen Features; eine Vermischung hier würde zirkuläre Abhängigkeiten zwischen den
// Composables erzeugen (siehe usePriceChartTradeSetups.js-Kopfkommentar für dasselbe Prinzip).
// rangesNeedsData/scheduleNextRangesPoll/startRangesPolling/stopRangesPolling bleiben aus
// demselben Grund ebenfalls in PriceChart.vue (hängen an withPollRetries + mehreren fremden Props).
import { ref } from "vue";
import { computeRangesPivots as computeRangesPivotsPure, buildMarketStructureState, pivotForDisplay } from "../marketStructureAnalysis";
import { renderMarketStructureAnalysis, collectFibLevels } from "../marketStructureRendering";
import { renderPivotMarkers } from "../pivotMarkers";
import { cssColor } from "../chartColors.js";
import { fmtPrice, fmtDateTime, pricePrecisionForInstrument } from "../format.js";
import { fetchInitialCandles as fetchInitialForexCandles } from "../forexCandles.js";
import { fetchCandlesCached } from "../candleCache.js";
import { RANGES_CANDLE_BUFFER } from "../priceChartConstants.js";
import { REPLAY_LOOKAHEAD_SEC } from "../timeframes.js";

export function usePriceChartMarketStructure() {
  let chart = null;
  let candleSeries = null;
  let rangesH1Candles = [];
  let rangesPivots = null; // roh (mit pivotTime), Periode 5
  let rangesPivots2 = null; // roh (mit pivotTime), eingebettete Periode 2 (siehe Chat 2026-07-19)
  let currentFibLevels = []; // für den Bestätigungs-Klick-Hittest, siehe findClickedFibLevel (PriceChart.vue)
  let fetchSeq = 0;
  let rangesMarkerPrimitives = [];
  let marketStructurePrimitives = [];

  const marketStructureState = ref(null);
  const rangesMetadata = ref(null); // Liste der erkannten H1-Periode-5-Pivots fürs Ranges-Metadaten-Panel
  const rangesMetadata2 = ref(null); // dito Periode 2

  function getRangesH1Candles() {
    return rangesH1Candles;
  }
  function getCurrentFibLevels() {
    return currentFibLevels;
  }

  function create(chartInstance, candleSeriesInstance) {
    chart = chartInstance;
    candleSeries = candleSeriesInstance;
  }
  function dispose() {
    chart = null;
    candleSeries = null;
  }

  // H1-Fraktale im konfigurierten Lookback-Fenster — reine Pivot-Liste, noch keine weak/protected/
  // sweep-Klassifizierung. Generalisiert auf (period, lookbackHours), damit dieselbe Logik für die
  // Periode-5- UND die eingebettete Periode-2-Erkennung läuft. cutoff statt "alle erkannten
  // Pivots", weil RANGES_CANDLE_BUFFER zusätzliche Kerzen VOR dem Lookback-Fenster lädt (siehe
  // fetchRangesCandles) — die dort erkannten Fraktale sollen nicht mitgezählt werden.
  function computeRangesPivotsFor(candlesClipped, period, lookbackHours, { replayUntil, rangesFixedStartActive, rangesFixedStartTime }) {
    // Im Replay-Modus zählt das Lookback-Fenster ab replayUntil, nicht ab der echten aktuellen
    // Zeit. rangesFixedStartActive ersetzt den ROLLIERENDEN Cutoff durch einen ABSOLUTEN — bleibt
    // beim Scrubben durch den Replay-Modus stabil; lookbackHours wird in dem Fall ignoriert.
    const now = replayUntil ?? Math.floor(Date.now() / 1000);
    const cutoff = rangesFixedStartActive && rangesFixedStartTime != null ? rangesFixedStartTime : now - lookbackHours * 3600;
    return computeRangesPivotsPure(candlesClipped, period, cutoff, fmtDateTime);
  }

  // Berechnet rangesPivots/rangesPivots2 + die Metadaten-Panel-Spiegelung neu. candlesClipped =
  // bereits clipReplay-gefiltertes rangesH1Candles (siehe PriceChart.vue: refreshRangesInternal).
  // Rückgabe { earliestTime } fürs Debug-Metadaten-Panel (structureEarliestTime in PriceChart.vue) —
  // der früheste ROHE pivotTime über beide Perioden, null wenn keine Pivots vorliegen.
  function computeRangesPivotsAndMetadata(candlesClipped, { rangesPeriod, rangesLookbackHours, ranges2Period, ranges2LookbackHours, replayUntil, rangesFixedStartActive, rangesFixedStartTime }) {
    const rangeCtx = { replayUntil, rangesFixedStartActive, rangesFixedStartTime };
    rangesPivots = candlesClipped.length > 0 ? computeRangesPivotsFor(candlesClipped, rangesPeriod, rangesLookbackHours, rangeCtx) : null;
    rangesPivots2 = candlesClipped.length > 0 ? computeRangesPivotsFor(candlesClipped, ranges2Period, ranges2LookbackHours, rangeCtx) : null;
    rangesMetadata.value = rangesPivots ? rangesPivots.map(pivotForDisplay) : null;
    rangesMetadata2.value = rangesPivots2 ? rangesPivots2.map(pivotForDisplay) : null;
    const allPivotTimes = [...(rangesPivots ?? []), ...(rangesPivots2 ?? [])].map((p) => p.pivotTime);
    return { earliestTime: allPivotTimes.length > 0 ? Math.min(...allPivotTimes) : null };
  }

  // Punkt-Marker für die H1-Ranges-Pivots — nur sichtbar, wenn Ranges-Metadaten-Panel + Debug-Modus
  // beide an sind. ALLE Pivots EINER Periode in EINER renderPivotMarkers-Gruppe (nicht eine Gruppe
  // pro Pivot), damit sich ihre Preis-Labels gegenseitig entzerren statt bei eng beieinanderliegenden
  // Pivots übereinander zu fallen (Bug-Report Philip 2026-07-19). Periode-5 und Periode-2 laufen im
  // SELBEN renderPivotMarkers-Aufruf (vorher zwei getrennte Listen mit unabhängiger Entzerrung —
  // Bug-Report: Labels bei deckungsgleichem Pivot leicht verschoben). Periode-2 bekommt kleineren
  // dotRadius + eigene, transparentere Farbe (rangesMarker2), um beide Ebenen optisch zu trennen.
  function refreshRangesMarkers({ candles, symbol, showRanges, showLiquidityDebug }) {
    const precision = pricePrecisionForInstrument(symbol);
    const showMarkers = showRanges && showLiquidityDebug;

    if (!showMarkers || (!rangesPivots && !rangesPivots2)) {
      renderPivotMarkers(candleSeries, [], rangesMarkerPrimitives, candles);
    } else {
      const groups = [
        ...(rangesPivots ? [{ points: rangesPivots, color: cssColor("rangesMarker") }] : []),
        ...(rangesPivots2 ? [{ points: rangesPivots2, color: cssColor("rangesMarker2"), dotRadius: 1.5 }] : []),
      ];
      renderPivotMarkers(candleSeries, groups, rangesMarkerPrimitives, candles, {
        showLabels: true,
        formatPrice: (price) => fmtPrice(price, precision),
      });
    }
  }

  // Roter Pfeil+Linie an range.high, grüner an range.low, ggf. "1h protected low"-Linie +
  // Trend-Label rechts/mittig (siehe Chat) — sichtbar, sobald showRanges an ist, unabhängig vom
  // Debug-Toggle (im Gegensatz zu den rohen Punktmarkern oben). Neuer "1h-Range"-Marktstruktur-
  // Trendalgorithmus (siehe marketStructureAnalysis.ts, test/tdd_mit_claude.ts) — läuft über
  // dieselben H1-Pivots wie die Debug-Punktmarker, unabhängig vom Debug-Toggle: das eigentliche
  // Analyse-Ergebnis. buildMarketStructureState (marketStructureAnalysis.ts) trägt die Merge-/
  // Apply-Logik, NICHT hier, damit Tests exakt denselben Code aufrufen wie die App. h1CandlesClipped
  // = bereits clipReplay-gefiltertes rangesH1Candles (nicht allCandles) — andere Auflösung je nach
  // gewähltem Chart-Timeframe.
  function refreshMarketStructure({ candles, h1CandlesClipped, symbol, replayUntil, showRanges, rangesPeriod, ranges2Period }) {
    const state = buildMarketStructureState(rangesPivots, rangesPivots2, rangesPeriod, ranges2Period, h1CandlesClipped);
    marketStructureState.value = state; // fürs Metadaten-Panel + TSC, unabhängig von showRanges (Zeichnen)
    currentFibLevels = collectFibLevels(state); // für den Bestätigungs-Klick-Hittest, siehe findClickedFibLevel (PriceChart.vue)
    const precision = pricePrecisionForInstrument(symbol);
    renderMarketStructureAnalysis(candleSeries, showRanges ? state : null, marketStructurePrimitives, candles, {
      // "Alter"-Anzeige an der "1h LQ-Sweep"-Linie (Chat 2026-07-22) — im Replay bezogen auf
      // replayUntil, nicht die echte Uhrzeit, sonst wäre das Alter beim Testen falsch/inkonsistent.
      nowSec: replayUntil ?? Math.floor(Date.now() / 1000),
      // Preis ist seit Chat 2026-07-28 fester Bestandteil des LQ-Sweep-Labels ("Major LS 1,13545
      // ..." statt "1h LQ-Sweep ..."), nicht mehr debug-gated — siehe formatLsLabel (liquidity.js).
      formatPrice: (price) => fmtPrice(price, precision),
    });
  }

  // Eigener H1-Fetch fürs Ranges-Metadaten-Panel (und seit Chat 2026-07-28 auch für die H1-Level
  // der Trade-Setup-Erkennung, siehe collectH1LqLevels in usePriceChartTradeSetups.js) — lädt genug
  // Historie für das GRÖSSERE der beiden Lookback-Fenster (Periode 5 + eingebettete Periode 2,
  // siehe Chat 2026-07-19) + Erkennungspuffer. EIN Fetch für beide Perioden (nicht zwei separate
  // cTrader-Connects) — computeRangesPivotsFor schneidet sich aus rangesH1Candles selbst den für
  // die jeweilige Periode passenden, ggf. kürzeren Ausschnitt raus. Rückgabe {ok, applied} statt
  // eines einzelnen Booleans, aus demselben Grund wie usePriceChartTradeSetups.js: ok:true+
  // applied:false bei einem durch einen neueren Fetch überholten Aufruf (siehe dort für die volle
  // Begründung).
  async function fetchRangesCandles({ symbol, toMs, replayUntil, rangesFixedStartActive, rangesFixedStartTime, rangesLookbackHours, ranges2LookbackHours }) {
    const seq = ++fetchSeq;
    try {
      // rangesFixedStartActive: genug Historie ab dem fixen Startzeitpunkt laden statt der
      // rollierenden lookbackHours (siehe cutoff in computeRangesPivotsFor). Math.ceil zwingend
      // (Bug-Report Philip 2026-07-21: "+1 Kerze hängt") — ein nicht-ganzzahliges hours/count lief
      // ungeprüft bis in den cTrader-Request und war vermutlich der Auslöser des Hängers.
      const nowSec = replayUntil ?? Math.floor(Date.now() / 1000);
      const hours =
        rangesFixedStartActive && rangesFixedStartTime != null
          ? Math.max(1, Math.ceil((nowSec - rangesFixedStartTime) / 3600))
          : Math.max(rangesLookbackHours, ranges2LookbackHours);
      const count = hours + RANGES_CANDLE_BUFFER;
      // Teilt sich den H1-Cache-Eintrag mit loadInitial (falls currentBar "1h" ist) — statt
      // unabhängig komplett neu zu fetchen, nur der fehlende/neue Teil.
      const candles = await fetchCandlesCached(fetchInitialForexCandles, symbol, "1h", count, toMs, REPLAY_LOOKAHEAD_SEC);
      if (seq !== fetchSeq) return { ok: true, applied: false }; // inzwischen überholt — kein Fehler
      rangesH1Candles = candles;
      return { ok: true, applied: true };
    } catch (err) {
      console.error("Ranges-Kerzen fehlgeschlagen:", err);
      return { ok: false, applied: false };
    }
  }

  return {
    marketStructureState,
    rangesMetadata,
    rangesMetadata2,
    getRangesH1Candles,
    getCurrentFibLevels,
    create,
    dispose,
    computeRangesPivotsAndMetadata,
    refreshRangesMarkers,
    refreshMarketStructure,
    fetchRangesCandles,
  };
}
