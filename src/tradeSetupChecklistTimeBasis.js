import { barSecondsForTimeframeCi } from './timeframes.js';

// Neutraler Import für Evaluator, Sweeps und Targets; kein Modul muss dadurch
// seinen eigenen Aufrufer importieren oder eine andere Schlussgrenze verwenden.
export function closedChecklistCandles(candles, bar, evaluatedAt) {
  const duration = barSecondsForTimeframeCi(bar);
  if (!Number.isFinite(evaluatedAt) || duration == null) return [];
  return (candles ?? []).filter(c => Number.isFinite(c.time) && c.time + duration <= evaluatedAt)
    .slice().sort((a, b) => a.time - b.time);
}
