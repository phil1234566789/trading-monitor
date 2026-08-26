// Ursprünglich refreshClaudeAnnotationsInternal + claudeCalloutTick (inkl. der zugehörigen
// Callout-Refs/tscCardRef) in PriceChart.vue, per Refactoring-Task "Sehr große Dateien
// refactoren" (Phase 6d, 2026-08-26) hierher verschoben. chart/candleSeries als Lifecycle-Objekt
// (create/dispose, analog usePriceChartRsi.js) — der rAF-Tick braucht aber zusätzlich pro Frame
// wechselnde Werte (chartContainerRef-Element, allCandles, props), die NICHT über create() gesetzt
// werden können, deshalb ein getCtx()-Callback statt fixer Parameter.
import { ref } from "vue";
import { renderClaudeAnnotations, annotationAnchorPoint, ANNOTATION_COLOR as CLAUDE_ANNOTATION_COLOR } from "../claudeAnnotations.js";
import { CALLOUT_STACK_GAP_PX } from "../priceChartConstants.js";

export function usePriceChartClaudeAnnotations() {
  let chart = null;
  let candleSeries = null;
  const claudeAnnotationPrimitives = [];
  const claudeAnnotationPriceLines = [];

  // TSC-Callouts ("Zeiger-Linien") — Claude-Notizen-Labels (line/marker/label) floaten als eigene
  // DOM-Chips über der TSC-Karte und zeigen per SVG-Linie auf ihren Chart-Punkt. Bug-Report Philip:
  // automatisch für ALLE Notizen ergab bei vielen gleichzeitigen Annotationen ein unlesbares
  // Spinnennetz ("okay irgendwie ist es schlimmer als davor HAHAHA") — jetzt opt-in PRO Annotation
  // über das "pointer"-Feld (claudeAnnotations.js: validateAnnotationList). Nur aktiv, wenn die
  // TSC-Karte sichtbar ist (tscCalloutModeActive in PriceChart.vue) — sonst kein sinnvoller Anker.
  const tscCardRef = ref(null);
  const claudeCalloutItems = ref([]); // [{ id, text, color, x, y }] — x/y = Chart-lokaler Anker (CSS-Px)
  const claudeCalloutLines = ref([]); // [{ id, x1, y1, x2, y2, color }] — x1/y1 = Label-Chip-Position
  const claudeCalloutStackBottom = ref(24); // px von unten in .chart-wrapper, knapp über der TSC-Karte
  const claudeCalloutChipEls = {}; // id -> HTMLElement, NICHT reaktiv (nur fürs Auslesen der Rects im rAF-Tick)
  let calloutRafId = null;
  let ctxGetter = null;
  // WeakMap statt einer id-Eigenschaft auf den Annotation-Objekten selbst (die kommen roh aus
  // Supabase/claudeAnnotationsStore.js, sollen nicht mutiert werden) — stabile id pro Objekt-Referenz.
  const calloutIdMap = new WeakMap();
  let calloutIdSeq = 0;
  function calloutIdFor(ann) {
    if (!calloutIdMap.has(ann)) calloutIdMap.set(ann, ++calloutIdSeq);
    return calloutIdMap.get(ann);
  }

  function setCalloutChipEl(id, el) {
    if (el) claudeCalloutChipEls[id] = el;
    else delete claudeCalloutChipEls[id];
  }

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

  // Bug-Report Philip 2026-07-30 ("okay irgendwie ist es schlimmer als davor HAHAHA"): ALLE
  // Annotationen automatisch zu Zeiger-Callouts zu machen ergab bei vielen Notizen ein unlesbares
  // Spinnennetz. Jetzt entscheidet Claude das PRO Annotation über das optionale "pointer"-Feld — nur
  // pointer:true wandert in die schwebenden Chips (siehe tick unten), alles andere bleibt inline im
  // Canvas. hline behält seinen Text immer, pointer wird dafür ignoriert.
  function refresh({ annotations, annotationsDate, candles, tscCalloutModeActive }) {
    const annotationsForCanvas = tscCalloutModeActive
      ? annotations.map((a) => (a.type === "hline" || !a.text || !a.pointer ? a : { ...a, text: undefined }))
      : annotations;
    renderClaudeAnnotations(candleSeries, annotationsForCanvas, claudeAnnotationPrimitives, claudeAnnotationPriceLines, candles, annotationsDate);
  }

  // rAF-Tick statt einzelner Event-Subscriptions (Pan/Zoom/Resize/TSC-Inhaltsänderung durch Locked-
  // Banner etc.) — die Zeiger-Linien müssen auf JEDE Chart-Bewegung reagieren, nicht nur auf Daten-
  // änderungen; ein rAF-Loop garantiert das unabhängig davon, welches Event gerade der Auslöser war,
  // bei vernachlässigbaren Kosten (ein paar timeToCoordinate/getBoundingClientRect-Aufrufe, nur
  // während TSC-Callouts tatsächlich aktiv sind UND es beschriftete Annotationen gibt). getCtx()
  // liefert pro Frame frisch: wrapperEl (.chart-container-Element), candles (clipReplay-gefiltert),
  // annotations/annotationsDate (Props), tscCalloutModeActive, tscCardEl (TSC-Karten-DOM-Element).
  function tick() {
    calloutRafId = requestAnimationFrame(tick);
    if (!chart || !candleSeries || !ctxGetter) return;
    const ctx = ctxGetter();
    if (!ctx.wrapperEl) return;

    const labeled = ctx.tscCalloutModeActive ? ctx.annotations.filter((a) => a.type !== "hline" && a.text && a.pointer) : [];
    if (labeled.length === 0) {
      if (claudeCalloutItems.value.length > 0) claudeCalloutItems.value = [];
      if (claudeCalloutLines.value.length > 0) claudeCalloutLines.value = [];
      return;
    }

    // .chart-container füllt .chart-wrapper komplett aus (flex:1, einziges layoutrelevantes Kind) —
    // dessen Rect dient hier als lokaler Koordinaten-Ursprung.
    const wrapperRect = ctx.wrapperEl.getBoundingClientRect();

    // 1) Verbindungslinien ZUERST anhand der aktuell im DOM stehenden Chips (vom letzten Tick)
    // berechnen — dadurch immer genau einen Frame "hinter" einer Textänderung, aber nie anhand
    // von Chips berechnet, die zu den gleich neu gesetzten Items gar nicht mehr passen.
    const lines = [];
    for (const item of claudeCalloutItems.value) {
      const chipEl = claudeCalloutChipEls[item.id];
      if (!chipEl) continue;
      const chipRect = chipEl.getBoundingClientRect();
      lines.push({
        id: item.id,
        x1: chipRect.left - wrapperRect.left,
        y1: chipRect.top - wrapperRect.top + chipRect.height / 2,
        x2: item.x,
        y2: item.y,
        color: item.color,
      });
    }
    claudeCalloutLines.value = lines;

    // 2) Label-Inhalte + Chart-Anker fürs nächste Chip-Layout neu berechnen.
    const items = [];
    for (const ann of labeled) {
      const anchor = annotationAnchorPoint(chart, candleSeries, ctx.candles, ctx.annotationsDate, ann);
      if (!anchor) continue; // Zeit/Preis gerade außerhalb des sichtbaren Bereichs
      items.push({ id: calloutIdFor(ann), text: ann.text, color: ann.color ?? CLAUDE_ANNOTATION_COLOR, x: anchor.x, y: anchor.y });
    }
    claudeCalloutItems.value = items;

    // 3) TSC-Karten-Position messen, Label-Stack knapp darüber andocken.
    if (ctx.tscCardEl) {
      const tscTopLocal = ctx.tscCardEl.getBoundingClientRect().top - wrapperRect.top;
      claudeCalloutStackBottom.value = wrapperRect.height - tscTopLocal + CALLOUT_STACK_GAP_PX;
    }
  }

  // Aufgerufen aus PriceChart.vue: onMounted. getCtx wird bei jedem Frame neu aufgerufen, siehe tick().
  function startTick(getCtx) {
    ctxGetter = getCtx;
    calloutRafId = requestAnimationFrame(tick);
  }

  // Aufgerufen aus PriceChart.vue: onUnmounted.
  function stopTick() {
    if (calloutRafId != null) cancelAnimationFrame(calloutRafId);
    ctxGetter = null;
  }

  return {
    tscCardRef,
    claudeCalloutItems,
    claudeCalloutLines,
    claudeCalloutStackBottom,
    setCalloutChipEl,
    create,
    dispose,
    refresh,
    startTick,
    stopTick,
  };
}
