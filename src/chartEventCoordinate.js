import { snapToBarTime } from './chartTimeUtils.js';

// Ereignisse innerhalb einer größeren Kerze behalten ihre echte Zeitposition.
// Nur innerhalb einer vorhandenen Kerze interpolieren, nie über Daten-/Wochenendlücken.
export function chartEventBarTime(candles, time, barSeconds) {
  if (!candles.length || time < candles[0].time) return null;
  const start = snapToBarTime(candles, time);
  if (start == null || time >= start + barSeconds) return null;
  return start;
}

export function chartEventCoordinate(timeScale, candles, time, barSeconds) {
  const start = chartEventBarTime(candles, time, barSeconds);
  if (start == null) return null;
  const x = timeScale.timeToCoordinate(start);
  return x == null ? null : x + (time - start) / barSeconds * timeScale.options().barSpacing;
}
