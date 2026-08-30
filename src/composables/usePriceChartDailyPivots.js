// Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots" — Fetch-Merge-Render-Orchestrierung für
// die 1D-Struktur-Pivot-Dreiecke, analog zu usePriceChartTradeSetupDrawing.js: braucht nur
// candleSeries (kein chart-Objekt) für create()/dispose(), läuft unabhängig vom aktiven currentBar
// (dbDailyPivots kommt bereits fertig aus Dashboard.vue, siehe dailyPivots.js: fetchDailyStructurePivots).
import { renderDailyPivotMarkers } from "../dailyPivotMarkers.js";

export function usePriceChartDailyPivots() {
  let candleSeries = null;
  const dailyPivotPrimitives = [];

  function create(candleSeriesInstance) {
    candleSeries = candleSeriesInstance;
  }
  function dispose() {
    candleSeries = null;
  }

  function refresh(candles, ctx) {
    const { dbDailyPivots, symbol } = ctx;
    const pivotsForSymbol = (dbDailyPivots ?? []).filter((p) => p.instrument === symbol);
    renderDailyPivotMarkers(candleSeries, pivotsForSymbol, dailyPivotPrimitives, candles);
  }

  return { dailyPivotPrimitives, create, dispose, refresh };
}
