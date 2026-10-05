import { M1_STRUCTURE_PERIOD } from './m1StructureSettings.js';
import { candleTimeIndex } from './candleTimeIndex.js';

export function m1ScanPrefix(candles, anchorTime, end, supportCount) {
  return candles.slice(m1ScanPrefixStart(candles,anchorTime,supportCount),end);
}

export function m1ScanPrefixStart(candles,anchorTime,supportCount=M1_STRUCTURE_PERIOD * 2 + 1) {
  let lower = candleTimeIndex(candles,anchorTime);
  // Spread-Hour-Kerzen zählen nicht zum P5-Vorlauf. Im Präfix bleiben sie
  // trotzdem enthalten, weil Retest/FVG ihren eigenen Umgang damit haben.
  let usable = 0;
  while (lower > 0 && usable < supportCount) {
    lower--;
    if (!candles[lower].ignored) usable++;
  }
  return lower;
}

