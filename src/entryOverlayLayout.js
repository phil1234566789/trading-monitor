export const ENTRY_OVERLAY_COLUMN_WIDTH = 200;
const GAP = 20;

export function entryOverlayLayout(candleRight, index, scaleCount) {
  const columnWidth = ENTRY_OVERLAY_COLUMN_WIDTH;
  if (!Number.isFinite(candleRight)) return null;
  const left = candleRight + GAP + index * scaleCount * columnWidth;
  return { boxX: left, boxWidth: 145,
    columns: Array.from({length:scaleCount},(_,i)=>left+(i+1)*columnWidth-32) };
}

export function entryOverlayViewport(range, lastIndex, width, columns) {
  if (!range || !columns || lastIndex < range.from || lastIndex > range.to || !width) return range;
  const reserved = GAP + columns * ENTRY_OVERLAY_COLUMN_WIDTH + 4;
  if (width <= reserved + 60) return range;
  const to = range.from+(lastIndex+0.5-range.from)*width/(width-reserved);
  return to > range.to ? {...range,to} : range;
}

export function reserveEntryOverlaySpace(chart,candles,columns) {
  const scale=chart.timeScale();
  const range=scale.getVisibleLogicalRange?.();
  const next=entryOverlayViewport(range,candles.length-1,scale.width?.(),columns);
  if(next!==range)scale.setVisibleLogicalRange(next);
}
