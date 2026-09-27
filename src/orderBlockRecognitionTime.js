import { barSecondsForTimeframeCi } from './timeframes.js';

// OB-startTime bezeichnet c2; erst die nächste tatsächlich vorhandene Kerze
// bestätigt die FVG bei ihrem Schluss. Zeitlücken dürfen nicht über Addition geraten werden.
export function orderBlockRecognitionTimes(candles, timeframe) {
  const duration = barSecondsForTimeframeCi(timeframe);
  if (!duration) return new Map();
  return new Map(candles.slice(0, -1).map((c, i) => [c.time, candles[i + 1].time + duration]));
}
