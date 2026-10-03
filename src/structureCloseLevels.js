import { LiquidityLinePrimitive } from './liquidity.js';
import { cssColor } from './chartColors.js';
import { lineWidth } from './chartLineWidths.js';

export function coversCloseLevel(levels, type, pivot) {
  return levels.some(level => level.type === type && level.pivotTime === pivot.pivotTime && level.price === pivot.price);
}

// Offene Level reichen bis zur letzten sichtbaren Kerze. Der bestätigte Bruch endet
// an der M5-Signalkerze, unabhängig von Dochten oder dem gewählten Chart-Zeitrahmen.
export function renderCloseLevels(series, levels, primitives, candles, styleKey = key => key) {
  if (!candles.length) return;
  for (const level of levels) {
    const confirmed = level.candleTime != null;
    const key = styleKey(level.type === 'CHoCH' ? 'm5RangeChoch' : 'm5RangeBreakOfStructure');
    const above = (level.direction === 'short') === (level.type === 'BOS');
    const line = new LiquidityLinePrimitive({ price: level.price, pivotTime: level.pivotTime,
      endTime: level.candleTime ?? candles.at(-1).time }, {
      color: cssColor(key), lineWidth: lineWidth(key), dashed: confirmed,
      label: confirmed ? level.type : `${level.type} offen`,
      labelSide: confirmed ? (above ? 'center-above' : 'center-below') : 'end',
    }, candles);
    series.attachPrimitive(line);
    primitives.push(line);
  }
}
