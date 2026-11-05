// Gold nutzt denselben nativen FXCM-Archivfeed; fehlende Historie ist kein Broker-Live-Fallback.
import { barSecondsFor } from './timeframes.js';

export const isGoldInstrument = symbol => symbol === 'XAUUSD';
export const GOLD_CHART_BARS = ['1m', '3m', '5m', '1h', '4h', '1D'];
export function goldChartSelection(bar, replayTime, now = Date.now()) {
  const selectedBar = GOLD_CHART_BARS.includes(bar) ? bar : '5m';
  const start = Date.parse('2026-01-01T00:00:00Z') / 1000;
  // Grobe native FXCM-Bars behalten ihre Tagesgrenzen; nur M1/M3 brauchen feinere Replay-Schritte.
  const seconds = Math.min(300, barSecondsFor(selectedBar));
  const end = Math.floor(now / (seconds * 1000)) * seconds - seconds;
  return { bar: selectedBar, replayTime: replayTime >= start && replayTime <= end ? replayTime : end };
}
