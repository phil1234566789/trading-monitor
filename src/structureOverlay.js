import { renderMarketStructureAnalysis } from './marketStructureRendering';
import { renderPivotMarkers } from './pivotMarkers';
import { cssColor } from './chartColors.js';
import { fmtPrice, fmtTime, pricePrecisionForInstrument } from './format.js';
import { createSessionBonusResolver } from './sessionBonus.js';
import { coversCloseLevel, renderCloseLevels } from './structureCloseLevels.js';

const LOWER_STRUCTURE_STYLE_KEYS = {
  rangeHigh: 'm5RangeHigh', rangeLow: 'm5RangeLow', rangeProtectedLow: 'm5RangeProtectedLow',
  rangeLqSweep: 'm5RangeLqSweep', rangeBreakOfStructure: 'm5RangeBreakOfStructure',
  rangeLiveUptrend: 'm5RangeLiveUptrend', rangeLiveDowntrend: 'm5RangeLiveDowntrend',
  rangeClosed: 'm5RangeClosed', rangeClosedDowntrend: 'm5RangeClosedDowntrend',
  rangeChoch: 'm5RangeChoch', rangeFib: 'm5RangeFib',
};

export function structureRenderOptions(candles, symbol, replayUntil) {
  // Replay-Alter bezieht sich auf den damaligen Stand; derselbe Session-Auflöser wie
  // bei Trade-Setup-Linien verhindert widersprüchliche Sweep-Labels bei Überlappung.
  return { nowSec: replayUntil ?? Math.floor(Date.now() / 1000),
    formatPrice: price => fmtPrice(price, pricePrecisionForInstrument(symbol)),
    bonusFor: createSessionBonusResolver(candles, symbol) };
}

function eventLabeler(events, precision) {
  // Debug trennt Erkennungszeit vom beim CHoCH rückdatierten Bandbeginn.
  const byPivot = new Map(events.map(e => [e.pivot, e]));
  return pivot => {
    const e = byPivot.get(pivot);
    if (!e) return null;
    const parts = [`${e.trend === 'uptrend' ? '↗' : '↘'} ${e.pre ? 'Vorstufe' : 'Trend'}`,
      e.level != null ? `${e.reason} ${fmtPrice(e.level, precision)}` : e.reason, `Algo ${fmtTime(e.at)}`];
    if (e.touchAt != null && e.touchAt < e.at) parts.push(`Band ab ${fmtTime(e.touchAt)}`);
    return parts.join(' · ');
  };
}

// Beide kleinen Zeitrahmen verwenden die vorhandenen M5-Styles und dieselbe Zeichnung.
export function renderStructurePivots(series, result, markers, candles, { symbol, debug }) {
  const precision = pricePrecisionForInstrument(symbol);
  const { pivotsOuter = [], pivotsInner = [], events = [] } = result ?? {};
  renderPivotMarkers(series, debug ? [
    { points: pivotsOuter ?? [], color: cssColor('rangesMarker') },
    { points: pivotsInner ?? [], color: cssColor('rangesMarker2'), dotRadius: 1.5 },
  ] : [], markers, candles, { showLabels: true, formatPrice: price => fmtPrice(price, precision),
    extraLabel: eventLabeler(events, precision) });
}

export function renderLowerStructure(series, result, primitives, markers, candles,
  { symbol, replayUntil, show, debug, barSeconds }) {
  const state = result?.state ?? null;
  const closeLevels = result?.closeReaction?.levels ?? [];
  renderStructurePivots(series, result, markers, candles, { symbol, debug });
  renderMarketStructureAnalysis(series, show ? state : null, primitives, candles, {
    ...structureRenderOptions(candles, symbol, replayUntil), barSeconds,
    styleKey: key => LOWER_STRUCTURE_STYLE_KEYS[key],
    hideLevel: (type, pivot) => coversCloseLevel(closeLevels, type, pivot),
  });
  if (show && state) renderCloseLevels(series, closeLevels, primitives, candles);
}
