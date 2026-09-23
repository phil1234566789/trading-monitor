// Ursprünglich refreshDrawingsInternal in PriceChart.vue, per Refactoring-Task "Sehr
// große Dateien refactoren" (Phase 6d, 2026-08-26) hierher verschoben.
//
// TSC-"Zeiger-Callouts" (Zeichnungen als schwebende Chips mit Zeiger-Linie, verankert an der
// TSC-Karten-Position) sind seit Chat 2026-08-28 wieder raus — die TSC-Karte zog aus einem
// Chart-Overlay in eine eigene Sidebar-Spalte (siehe Dashboard.vue) um, "knapp über der Karte
// andocken" ergab dort keinen sinnvollen Anker mehr. Philip explizit: Callouts einfach weglassen
// statt einen neuen festen Anker zu bauen. Annotationen mit `pointer: true` (siehe
// annotations.js: validateAnnotationList) verhalten sich seitdem wie jede andere Notiz auch
// (normaler Inline-Text im Chart) — das Feld selbst bleibt im Schema gültig, nur ohne besondere
// Wirkung mehr.
import { renderAnnotations } from "../annotations.js";

export function usePriceChartDrawings() {
  let chart = null;
  let candleSeries = null;
  const annotationPrimitives = [];
  const annotationPriceLines = [];

  // Aufgerufen aus PriceChart.vue: onMounted, direkt nach candleSeries-Anlage.
  function create(chartInstance, candleSeriesInstance) {
    chart = chartInstance;
    candleSeries = candleSeriesInstance;
  }

  // Aufgerufen aus PriceChart.vue: onUnmounted.
  function dispose() {
    chart = null;
    candleSeries = null;
  }

  function refresh({ annotations, annotationsDate, candles }) {
    renderAnnotations(candleSeries, annotations, annotationPrimitives, annotationPriceLines, candles, annotationsDate);
  }

  return { create, dispose, refresh };
}
