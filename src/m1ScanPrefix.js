import { M1_STRUCTURE_PERIOD } from './m1Structure.js';

export function m1ScanPrefix(candles, anchorTime, end) {
  let lower = 0, upper = candles.length;
  while (lower < upper) {
    const mid = (lower + upper) >>> 1;
    if (candles[mid].time < anchorTime) lower = mid + 1; else upper = mid;
  }
  // Spread-Hour-Kerzen zählen nicht zum P5-Vorlauf. Im Präfix bleiben sie
  // trotzdem enthalten, weil Retest/FVG ihren eigenen Umgang damit haben.
  let usable = 0;
  while (lower > 0 && usable < M1_STRUCTURE_PERIOD * 2 + 1) {
    lower--;
    if (!candles[lower].ignored) usable++;
  }
  return candles.slice(lower, end);
}

