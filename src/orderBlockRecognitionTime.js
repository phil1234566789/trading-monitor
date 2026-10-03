import { barSecondsForTimeframeCi } from './timeframes.js';

// OB-startTime bezeichnet c2; erst die nächste tatsächlich vorhandene Kerze
// bestätigt die FVG bei ihrem Schluss. Zeitlücken dürfen nicht über Addition geraten werden.
export function orderBlockRecognitionTimes(candles, timeframe) {
  const duration = barSecondsForTimeframeCi(timeframe);
  if (!duration) return new Map();
  return new Map(candles.slice(0, -1).map((c, i) => [c.time, candles[i + 1].time + duration]));
}
// C2 ist der Impuls, die nächste vorhandene Kerze bildet die FVG und ihr
// Schluss bestätigt sie. Eine spätere Zuordnung ändert diese Ereignisfolge nicht.
export function orderBlockFollowsSweep(ob, level, recognizedAt) {
  const touch = level.fineTouchedTime ?? Math.max(level.touchedTime, (level.recognizedAt ?? level.touchedTime + 300) - 300);
  return Number.isFinite(touch) && Number.isFinite(ob.startTime) && Number.isFinite(recognizedAt) && recognizedAt - 300 > touch;
}
