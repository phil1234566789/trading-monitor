// Gold nutzt denselben nativen FXCM-Archivfeed; fehlende Historie ist kein Broker-Live-Fallback.
export const isGoldInstrument = symbol => symbol === 'XAUUSD';
export const GOLD_CHART_BARS = ['5m', '1h', '4h', '1D'];
export function goldChartSelection(bar, replayTime, now = Date.now()) {
  const selectedBar = GOLD_CHART_BARS.includes(bar) ? bar : '5m';
  const start = Date.parse('2026-01-01T00:00:00Z') / 1000;
  const end = Math.floor(now / 300000) * 300 - 300;
  return { bar: selectedBar, replayTime: replayTime >= start && replayTime <= end ? replayTime : end };
}
