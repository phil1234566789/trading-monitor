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
import { computeRangesPivots as computeRangesPivotsPure, buildMarketStructureState, pivotForDisplay, deriveTrendReaction, innermostStructureStart } from "../marketStructureAnalysis";
import { renderMarketStructureAnalysis, collectFibLevels } from "../marketStructureRendering";
import { renderPivotMarkers } from "../pivotMarkers";
import { cssColor } from "../chartColors.js";
import { buildStructureWithPhases, renderTrendPhaseBands } from "../trendPhases.js";
import { fmtPrice, fmtDateTime, fmtTime, pricePrecisionForInstrument } from "../format.js";
import { createSessionBonusResolver } from "../sessionBonus.js";
import { withoutIgnored } from "../ignoredCandles.js";
import { fetchInitialCandles as fetchInitialForexCandles } from "../forexCandles.js";
import { fetchCandlesCached } from "../candleCache.js";
import { RANGES_CANDLE_BUFFER } from "../priceChartConstants.js";
import { REPLAY_LOOKAHEAD_SEC, barSecondsFor } from "../timeframes.js";

// Debug-Text am Pivot, dessen Verarbeitung die Trendphase gewechselt hat — "was hat der Algo wann
// erkannt": z.B. "↘ Vorstufe · CHoCH 1,35576 · Algo 10:20 · Band ab 09:50".
function m5EventLabeler(events, precision) {
  const byPivot = new Map(events.map((e) => [e.pivot, e]));
  return (pivot) => {
    const e = byPivot.get(pivot);
    if (!e) return null;
    const parts = [`${e.trend === "uptrend" ? "↗" : "↘"} ${e.pre ? "Vorstufe" : "Trend"}`, e.level != null ? `${e.reason} ${fmtPrice(e.level, precision)}` : e.reason, `Algo ${fmtTime(e.at)}`];
    if (e.touchAt != null && e.touchAt < e.at) parts.push(`Band ab ${fmtTime(e.touchAt)}`);
    return parts.join(" · ");
  };
}

// 1h-Token -> M5-Token für renderMarketStructureAnalysis(styleKey), siehe chartColors.js.
const M5_STRUCTURE_STYLE_KEYS = {
  rangeHigh: "m5RangeHigh",
  rangeLow: "m5RangeLow",
  rangeProtectedLow: "m5RangeProtectedLow",
  rangeLqSweep: "m5RangeLqSweep",
  rangeBreakOfStructure: "m5RangeBreakOfStructure",
  rangeLiveUptrend: "m5RangeLiveUptrend",
  rangeLiveDowntrend: "m5RangeLiveDowntrend",
  rangeClosed: "m5RangeClosed",
  rangeClosedDowntrend: "m5RangeClosedDowntrend",
  rangeChoch: "m5RangeChoch",
  rangeFib: "m5RangeFib",
};

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
  let m5StructurePrimitives = [];
  let m5TrendPhasePrimitives = [];
  let outerCutoff = null; // Start des 1h-Outer-Trends = M5-Anker-Fallback ohne Nested, siehe refreshM5Structure
  let m5ComputedKey = null;
  let m5Computed = { state: null, phases: [], events: [], pivotsOuter: null, pivotsInner: null };
  let m5MarkerPrimitives = [];
  // Ältere M5-Historie, falls der Anker vor der ältesten geladenen M5-Kerze liegt (Trade-Setups laden
  // fix TRADE_SETUP_M5_CANDLE_COUNT = ~8,7 Handelstage; ohne 1h-Nested fällt der Anker auf den
  // Outer-Start, der auch 12+ Tage zurückliegen kann). Einmal je Symbol/Anker nachgeladen.
  let m5Older = { symbol: null, candles: [] };
  let m5OlderRequested = null;
  let lastM5Args = null;

  const marketStructureState = ref(null);
  const rangesMetadata = ref(null); // Liste der erkannten H1-Periode-5-Pivots fürs Ranges-Metadaten-Panel
  const rangesMetadata2 = ref(null); // dito Periode 2
  // { trend, reaction } der M5-Struktur fürs TSC, siehe deriveTrendReaction (marketStructureAnalysis.ts).
  const m5Trend = ref(null);

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
    return { pivots: computeRangesPivotsPure(candlesClipped, period, cutoff, fmtDateTime), cutoff };
  }

  // Berechnet rangesPivots/rangesPivots2 + die Metadaten-Panel-Spiegelung neu. candlesClipped =
  // bereits clipReplay-gefiltertes rangesH1Candles (siehe PriceChart.vue: refreshRangesInternal).
  // Rückgabe { earliestTime } fürs Debug-Metadaten-Panel (structureEarliestTime in PriceChart.vue) —
  // der früheste ROHE pivotTime über beide Perioden, null wenn keine Pivots vorliegen.
  function computeRangesPivotsAndMetadata(rohKerzen, { symbol, rangesPeriod, rangesLookbackHours, ranges2Period, ranges2LookbackHours, replayUntil, rangesFixedStartActive, rangesFixedStartTime }) {
    // Spread-Hour-Kerzen ganz weg statt nur markiert (Philip 2026-09-24: "ja"): der Struktur-Algo
    // kennt keine FVG, ein Fraktal und ein Kerzenschluss-Check sind reine High/Low-Vergleiche —
    // die Zeitluecke stoert sie nicht, und so braucht marketStructureAnalysis.ts keine Aenderung.
    const candlesClipped = withoutIgnored(rohKerzen, symbol);
    const rangeCtx = { replayUntil, rangesFixedStartActive, rangesFixedStartTime };
    const outer = candlesClipped.length > 0 ? computeRangesPivotsFor(candlesClipped, rangesPeriod, rangesLookbackHours, rangeCtx) : null;
    rangesPivots = outer?.pivots ?? null;
    outerCutoff = outer?.cutoff ?? null;
    rangesPivots2 = candlesClipped.length > 0 ? computeRangesPivotsFor(candlesClipped, ranges2Period, ranges2LookbackHours, rangeCtx).pivots : null;
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

  // Roter Pfeil+Linie an range.high, grüner an range.low, ggf. "protected low"-Linie +
  // Trend-Label rechts/mittig (siehe Chat) — sichtbar, sobald showRanges an ist, unabhängig vom
  // Debug-Toggle (im Gegensatz zu den rohen Punktmarkern oben). Neuer "1h-Range"-Marktstruktur-
  // Trendalgorithmus (siehe marketStructureAnalysis.ts, test/tdd_mit_claude.ts) — läuft über
  // dieselben H1-Pivots wie die Debug-Punktmarker, unabhängig vom Debug-Toggle: das eigentliche
  // Analyse-Ergebnis. buildMarketStructureState (marketStructureAnalysis.ts) trägt die Merge-/
  // Apply-Logik, NICHT hier, damit Tests exakt denselben Code aufrufen wie die App. h1CandlesClipped
  // = bereits clipReplay-gefiltertes rangesH1Candles (nicht allCandles) — andere Auflösung je nach
  // gewähltem Chart-Timeframe.
  function refreshMarketStructure({ candles, h1CandlesClipped, symbol, replayUntil, showRanges, rangesPeriod, ranges2Period }) {
    // Dieselbe Filterung wie bei den Pivots (computeRangesPivotsAndMetadata) — die Close-Checks in
    // buildMarketStructureState duerfen die Spread Hour sonst doch noch als Bruch werten.
    const state = buildMarketStructureState(rangesPivots, rangesPivots2, rangesPeriod, ranges2Period, withoutIgnored(h1CandlesClipped, symbol));
    marketStructureState.value = state; // fürs Metadaten-Panel + TSC, unabhängig von showRanges (Zeichnen)
    currentFibLevels = collectFibLevels(state); // für den Bestätigungs-Klick-Hittest, siehe findClickedFibLevel (PriceChart.vue)
    renderMarketStructureAnalysis(candleSeries, showRanges ? state : null, marketStructurePrimitives, candles, structureRenderOptions(candles, symbol, replayUntil));
  }

  // Gemeinsame Render-Optionen für die 1h- UND die M5-Struktur.
  function structureRenderOptions(candles, symbol, replayUntil) {
    const precision = pricePrecisionForInstrument(symbol);
    return {
      // "Alter"-Anzeige an der LQ-Sweep-Linie (Chat 2026-07-22) — im Replay bezogen auf
      // replayUntil, nicht die echte Uhrzeit, sonst wäre das Alter beim Testen falsch/inkonsistent.
      nowSec: replayUntil ?? Math.floor(Date.now() / 1000),
      // Preis ist seit Chat 2026-07-28 fester Bestandteil des LQ-Sweep-Labels ("Major LS 1,13545
      // ..." statt "1h LQ-Sweep ..."), nicht mehr debug-gated — siehe formatLsLabel (liquidity.js).
      formatPrice: (price) => fmtPrice(price, precision),
      // Session-Kontext am LQ-Sweep-Label ("Asia-High Major LS ...", Philip 2026-09-21) — derselbe
      // Auflöser wie an der Trade-Setup-LS-Linie, damit die beiden beim Überlappen weiterhin
      // denselben String zeigen.
      bonusFor: createSessionBonusResolver(candles, symbol),
    };
  }

  // M5-Struktur (PLAN-m5-trend.md): derselbe Algo auf M5-Kerzen, verankert am Start der innersten
  // 1h-Ebene (innermostStructureStart, ohne Nested der 1h-Outer-Start outerCutoff). Reichen die
  // geladenen M5-Kerzen nicht bis zum Anker, lädt loadOlderM5 den Rest einmalig nach (Philip
  // 27.09.2026: "muss sichergestellt werden, dass genug Candles da sind"). Läuft unabhängig von den
  // Toggles, weil das TSC den Trend immer braucht; die Toggles steuern nur das Zeichnen.
  function refreshM5Structure(args) {
    lastM5Args = args;
    const { candles, symbol, replayUntil, showM5Structure, showM5TrendPhases, showLiquidityDebug, m5Period, m5Period2 } = args;
    const anchor = innermostStructureStart(marketStructureState.value, outerCutoff);
    if (m5Older.symbol !== symbol) m5Older = { symbol, candles: [] };
    const loaded = args.m5CandlesClipped;
    const m5CandlesClipped = withoutIgnored(loaded.length > 0 ? [...m5Older.candles.filter((c) => c.time < loaded[0].time), ...loaded] : loaded, symbol);
    if (anchor != null && m5CandlesClipped.length > 0 && anchor < m5CandlesClipped[0].time) loadOlderM5(symbol, anchor, m5CandlesClipped[0].time);
    // Memo: bei P5/P2 über ~12 Tage ~150 ms — refreshChart() läuft aber auch bei jedem Style-Regler-
    // Event, dort soll nur neu gezeichnet, nicht neu gerechnet werden.
    const key = `${m5CandlesClipped.length}:${m5CandlesClipped.at(-1)?.time}:${anchor}:${m5Period}:${m5Period2}`;
    if (key !== m5ComputedKey) {
      m5ComputedKey = key;
      const ready = anchor != null && m5CandlesClipped.length > 0;
      const pivotsOuter = ready ? computeRangesPivotsPure(m5CandlesClipped, m5Period, anchor, fmtDateTime) : null;
      const pivotsInner = ready ? computeRangesPivotsPure(m5CandlesClipped, m5Period2, anchor, fmtDateTime) : null;
      m5Computed = {
        ...buildStructureWithPhases(pivotsOuter, pivotsInner, m5Period, m5Period2, m5CandlesClipped, barSecondsFor("5m")),
        pivotsOuter,
        pivotsInner,
      };
      m5Trend.value = deriveTrendReaction(m5Computed.state);
    }
    const { state, phases, events, pivotsOuter, pivotsInner } = m5Computed;
    // Roh-Pivots (Periode Outer/Inner) als Debug-Punkte, wie refreshRangesMarkers für 1h — damit
    // Philip die Trendwechsel gegen die Pivots nachvollziehen kann. Dieselben Marker-Farben wie 1h:
    // Herkunft klärt der Toggle (M5-Struktur/-Trendphasen an, 1h-Structure aus).
    const showMarkers = showLiquidityDebug && (showM5Structure || showM5TrendPhases) && (pivotsOuter || pivotsInner);
    const precision = pricePrecisionForInstrument(symbol);
    renderPivotMarkers(
      candleSeries,
      showMarkers
        ? [
            ...(pivotsOuter ? [{ points: pivotsOuter, color: cssColor("rangesMarker") }] : []),
            ...(pivotsInner ? [{ points: pivotsInner, color: cssColor("rangesMarker2"), dotRadius: 1.5 }] : []),
          ]
        : [],
      m5MarkerPrimitives,
      candles,
      { showLabels: true, formatPrice: (price) => fmtPrice(price, precision), extraLabel: m5EventLabeler(events, precision) },
    );
    renderMarketStructureAnalysis(candleSeries, showM5Structure ? state : null, m5StructurePrimitives, candles, {
      ...structureRenderOptions(candles, symbol, replayUntil),
      styleKey: (key) => M5_STRUCTURE_STYLE_KEYS[key],
      barSeconds: barSecondsFor("5m"),
    });
    renderTrendPhaseBands(candleSeries, showM5TrendPhases ? phases : [], m5TrendPhasePrimitives, candles, {
      up: cssColor("m5TrendPhaseUp"),
      upPre: cssColor("m5TrendPhaseUpPre"),
      down: cssColor("m5TrendPhaseDown"),
      downPre: cssColor("m5TrendPhaseDownPre"),
    });
  }

  // Lädt die M5-Kerzen zwischen Anker und ältester geladener Kerze nach und zeichnet danach neu.
  // count über die Kalenderzeit ist eine Obergrenze (Wochenenden zählen mit), +20 für die
  // Fraktal-Vorlaufkerzen; gedeckelt auf das cTrader-Limit von 14000 Bars/Request.
  async function loadOlderM5(symbol, anchor, oldestTime) {
    const key = `${symbol}:${anchor}:${oldestTime}`;
    if (m5OlderRequested === key) return;
    m5OlderRequested = key;
    try {
      const count = Math.min(14000, Math.ceil((oldestTime - anchor) / barSecondsFor("5m")) + 20);
      const older = await fetchInitialForexCandles(symbol, "5m", count, oldestTime * 1000);
      if (m5Older.symbol !== symbol || older.length === 0) return;
      m5Older = { symbol, candles: [...older.filter((c) => c.time < oldestTime), ...m5Older.candles.filter((c) => c.time >= oldestTime)] };
      if (candleSeries && lastM5Args) refreshM5Structure(lastM5Args);
    } catch (err) {
      console.error("Ältere M5-Kerzen für die M5-Struktur fehlgeschlagen:", err);
    }
  }

  // Eigener H1-Fetch fürs Ranges-Metadaten-Panel (und seit Chat 2026-07-28 auch für die H1-Level
  // der Trade-Setup-Erkennung, siehe collectStructureLqLevels in usePriceChartTradeSetups.js) — lädt genug
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
    m5Trend,
    rangesMetadata,
    rangesMetadata2,
    getRangesH1Candles,
    getCurrentFibLevels,
    create,
    dispose,
    computeRangesPivotsAndMetadata,
    refreshRangesMarkers,
    refreshMarketStructure,
    refreshM5Structure,
    fetchRangesCandles,
  };
}
