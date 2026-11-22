// Gepinnte Registry-Chartobjekte, die gerade nicht gezeichnet sind (Indikator aus, außerhalb des Fensters), aus
// ihrem Snapshot zeichnen — mit Pin-Halo wie die live gezeichneten. Eine Linie je fehlendem Pin, ohne Neuerkennung.
import { LiquidityLinePrimitive } from "../liquidity.js";
import { chartObjectLine, setChartObjectHalo } from "../chartObjectRegistry.js";
import { cssColor } from "../chartColors.js";
import { lineWidth } from "../chartLineWidths.js";

export function usePriceChartPinnedChartObjects() {
  const primitives = [];
  const idOf = new Map();

  function clear(series) {
    for (const p of primitives) series?.detachPrimitive(p);
    primitives.length = 0;
    idOf.clear();
  }

  // pinned: [{ id, type, snapshot }] für Symbol und Zeitebene des Charts; drawnIds aus applyChartObjectHighlights.
  function refresh(series, candles, pinned, drawnIds, hoveredId) {
    clear(series);
    if (!series || candles.length === 0) return;
    const first = candles[0].time, last = candles[candles.length - 1].time;
    for (const { id, type, snapshot } of pinned) {
      if (drawnIds.has(id)) continue;
      const g = chartObjectLine(type, snapshot);
      const to = g?.to ?? last;
      if (!g || to < first || g.from > last) continue;
      const level = { price: g.price, dir: g.dir, pivotTime: Math.max(g.from, first), endTime: Math.min(to, last), touched: g.to != null };
      const primitive = new LiquidityLinePrimitive(level, { color: cssColor(g.styleKey), lineWidth: lineWidth(g.styleKey),
        label: null, pinColor: cssColor("pin"), hoverColor: cssColor("tradeHover"), inPinContext: true, isSelectedPin: id === hoveredId }, candles);
      series.attachPrimitive(primitive);
      primitives.push(primitive);
      idOf.set(primitive, id);
    }
  }

  function applyHover(hoveredId) {
    for (const p of primitives) setChartObjectHalo(p, true, idOf.get(p) === hoveredId);
  }

  return { refresh, applyHover, clear };
}
