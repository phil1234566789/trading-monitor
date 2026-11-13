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
import {renderTradeIdeas} from '../tradeIdeaRendering.js';
import {barSecondsFor} from '../timeframes.js';
import { renderAnnotations } from "../annotations.js";
import {useTradeIdeaEditing} from './useTradeIdeaEditing.js';

export function usePriceChartDrawings({store,pointAt}) {
  let chart = null;
  let candleSeries = null;
  const annotationPrimitives = [];
  const annotationPriceLines = [];
  let lastContext;
  const editor=useTradeIdeaEditing({store,pointAt,refresh:()=>{if(chart&&lastContext)refresh(lastContext);}});

  // Aufgerufen aus PriceChart.vue: onMounted, direkt nach candleSeries-Anlage.
  function create(chartInstance, candleSeriesInstance,element) {
    chart = chartInstance;
    candleSeries = candleSeriesInstance;
    editor.create(chart,element);
  }

  // Aufgerufen aus PriceChart.vue: onUnmounted.
  function dispose() {
    editor.dispose();
    chart = null;
    candleSeries = null;
  }

  function refresh({ annotations, annotationsDate, candles, currentBar }) {
    lastContext={annotations,annotationsDate,candles,currentBar};
    annotations=editor.annotations(annotations);
    renderAnnotations(candleSeries, annotations.filter(a=>!a.tradeIdea), annotationPrimitives, annotationPriceLines, candles, annotationsDate);
    const lines=[];
    renderTradeIdeas(candleSeries,annotations,annotationPrimitives,candles,barSecondsFor(currentBar),(primitive,annotation,level)=>lines.push({primitive,annotation,level}));
    editor.setLines(lines);
  }

  return { create, dispose, refresh, editingStatus:editor.status };
}
