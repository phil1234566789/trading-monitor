// Liquiditäts-Level-Zeichnung — ursprünglich refreshLiquidityInternal (+ currentLiquidityLevels/
// liquidityPrimitives/liquidityMetadata/liquidityEarliestTime) in PriceChart.vue, per
// Refactoring-Task "Sehr große Dateien refactoren" (Phase 6i, 2026-08-26) hierher verschoben.
// Reine Zeichen-Orchestrierung wie usePriceChartTradeSetupDrawing.js (Phase 6h) — die eigentliche
// Erkennung/Merge-Logik (detectLiquidityLevels, mergePinnedLevels, computeHtfLiquidityLevels,
// mergeDbLiquidityLevels, renderLiquidityLevels) lebt bereits in liquidity.js/
// priceChartLiquidity.js und ist dort getestet, deshalb hier keine neuen Tests nötig/möglich
// (gleiche Begründung wie im Kopfkommentar dort).
// Braucht nur candleSeries (kein chart-Objekt) für ihr create()/dispose()-Lifecycle, wie
// usePriceChartTradeSetupDrawing.js.
import {
  detectLiquidityLevels,
  filterRelevantLevels,
  renderLiquidityLevels,
  LIQUIDITY_FRACTAL_PERIOD,
  LIQUIDITY_MAX_RELEVANT,
} from "../liquidity.js";
import { mergePinnedLevels, computeHtfLiquidityLevels, mergeDbLiquidityLevels } from "../priceChartLiquidity.js";
import { currentPriceEstimate } from "../priceChartObZones.js";
import { pivotForDisplay } from "../marketStructureAnalysis";
import { fmtPrice, pricePrecisionForInstrument } from "../format.js";
import { ref } from "vue";

export function usePriceChartLiquidity() {
  let candleSeries = null;
  const liquidityPrimitives = []; // Array-Referenz direkt zurückgegeben (wie divergencePriceLinePrimitives in
  // usePriceChartRsi.js) — pinPrimitivesBag() (PriceChart.vue) braucht sie fürs Pin-Kontextmenü.
  // Aktuell gezeichnete Liquiditäts-Level — für den Zielmodus-Klick-Hittest (Chat 2026-07-27:
  // "Können wir die Linien klickbar machen?") gebraucht, siehe getCurrentLiquidityLevels() unten.
  let currentLiquidityLevels = [];

  const liquidityMetadata = ref(null);
  const liquidityEarliestTime = ref(null);

  function getCurrentLiquidityLevels() {
    return currentLiquidityLevels;
  }

  function create(candleSeriesInstance) {
    candleSeries = candleSeriesInstance;
  }
  function dispose() {
    candleSeries = null;
  }

  // Liquiditäts-Level (Fractal-Pivots, siehe tv-indikator/src/liquidity.pine) gibt es bisher nicht
  // aus dem Backend — deshalb hier direkt aus den geladenen Kerzen des aktuellen Chart-Timeframes
  // neu erkannt, analog zur OB-Erkennung. `showSweptLiquidity` zeigt ALLE erkannten M5-Pivots
  // ungefiltert (kein filterRelevantLevels, keine maxRelevant-Deckelung) — auch längst berührte.
  // Für die Trendanalyse-Diskussion mit Philip: er braucht wirklich jeden Pivot sichtbar, nicht
  // nur die 10 neuesten je Richtung, die filterRelevantLevels selbst mit onlyRelevant=false noch
  // abschneiden würde.
  //
  // Kein Auto-Nachladen mehr (siehe refreshPoiZonesInternal-Kommentar in PriceChart.vue, Punkt 10
  // — dieselbe Entscheidung 2026-08-23 umgekehrt): eine relevante 1H-Zeile, deren pivotTime vor
  // der geladenen Kerzenserie liegt, wird per snapToBarTime auf die älteste geladene Kerze
  // geklemmt statt einen Nachlade-Request auszulösen. Korrigiert sich von selbst, sobald aus einem
  // anderen Grund (normales Zurückscrollen) genug Kerzen geladen sind.
  //
  // candles = bereits clipReplay-gefiltertes allCandles, allCandles = das ungefilterte Original
  // (nur für currentPriceEstimate gebraucht, siehe computeHtfLiquidityLevels).
  function refresh(candles, allCandles, ctx) {
    const { showLiquidity, pinnedLiquidityLevels, pinLiquidityLevelKeys, hoveredPinLiquidityLevelKey } = ctx;
    if (!showLiquidity) {
      // Kein db1h hier (mehr) — die relevanten 1H-Level sind seit 2026-08-23 an showLiquidity
      // gekoppelt (s.u.), bei showLiquidity=false bleiben nur Pins sichtbar, wie vor Punkt 12/13.
      const pinnedOnly = mergePinnedLevels([], pinnedLiquidityLevels, candles);
      renderLiquidityLevels(candleSeries, pinnedOnly, liquidityPrimitives, candles, {
        pinKeys: pinLiquidityLevelKeys,
        hoveredKey: hoveredPinLiquidityLevelKey,
      });
      liquidityMetadata.value = null;
      liquidityEarliestTime.value = null;
      currentLiquidityLevels = [];
      return;
    }
    const { showSweptLiquidity, dbLiquidityLevelsHtf, symbol, replayUntil, showLiquidityDebug, currentBar } = ctx;
    // timeframe = der gerade angezeigte Chart-Timeframe (Task "Chart-Objekte..." Nachbesserung
    // 2026-08-23: M5/1H/4H-Chart-Style-Kategorien, siehe liquidity.js: liquidityStyleTimeframe) —
    // live erkannte Level tragen sonst kein eigenes Timeframe-Feld wie die persistierten HTF-Level.
    const { highs: rawHighs, lows: rawLows } = detectLiquidityLevels(candles, LIQUIDITY_FRACTAL_PERIOD);
    const highs = rawHighs.map((l) => ({ ...l, timeframe: currentBar }));
    const lows = rawLows.map((l) => ({ ...l, timeframe: currentBar }));
    const liveRelevant = showSweptLiquidity
      ? [...highs, ...lows]
      : [...filterRelevantLevels(highs, LIQUIDITY_MAX_RELEVANT, true), ...filterRelevantLevels(lows, LIQUIDITY_MAX_RELEVANT, true)];
    const htfLevels = computeHtfLiquidityLevels(candles, dbLiquidityLevelsHtf, symbol, replayUntil, currentPriceEstimate(allCandles));
    const relevant = mergeDbLiquidityLevels(liveRelevant, htfLevels);
    currentLiquidityLevels = relevant;
    const precision = pricePrecisionForInstrument(symbol);
    const finalLevels = mergePinnedLevels(relevant, pinnedLiquidityLevels, candles);
    renderLiquidityLevels(candleSeries, finalLevels, liquidityPrimitives, candles, {
      debugPrices: showLiquidityDebug,
      formatPrice: (price) => fmtPrice(price, precision),
      // "Alter"-Anzeige an den Debug-Preis-Labels (Chat 2026-07-22) — im Replay bezogen auf
      // replayUntil, nicht die echte Uhrzeit, sonst wäre das Alter beim Testen falsch/inkonsistent.
      nowSec: replayUntil ?? Math.floor(Date.now() / 1000),
      pinKeys: pinLiquidityLevelKeys,
      hoveredKey: hoveredPinLiquidityLevelKey,
    });
    liquidityMetadata.value = relevant.map(pivotForDisplay);
    liquidityEarliestTime.value = relevant.length > 0 ? Math.min(...relevant.map((lvl) => lvl.pivotTime)) : null;
  }

  return {
    liquidityMetadata,
    liquidityEarliestTime,
    liquidityPrimitives,
    getCurrentLiquidityLevels,
    create,
    dispose,
    refresh,
  };
}
