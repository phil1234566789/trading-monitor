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

// Bestehende Zeichnungen behalten ihr Snapping; gespeicherte M1-Belege können
// dieselben Primitiven mit expliziter Ereignisprojektion auf M5 verwenden.
export function chartObjectCoordinate(timeScale, candles, time, eventBarSeconds, futureBarSeconds) {
  // Nur Ideen dürfen in die freie Zukunft reichen; Detektionszonen behalten ihr Snapping.
  if(futureBarSeconds && candles.length && time>candles[candles.length-1].time) {
    const last=candles[candles.length-1].time,x=timeScale.timeToCoordinate(last);
    return x==null?null:x+(time-last)/futureBarSeconds*timeScale.options().barSpacing;
  }
  if (eventBarSeconds) return chartEventCoordinate(timeScale,candles,time,eventBarSeconds);
  const bar=snapToBarTime(candles,time);
  return bar==null?null:timeScale.timeToCoordinate(bar);
}
