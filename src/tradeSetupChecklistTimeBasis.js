import { barSecondsFor, barSecondsForTimeframeCi } from './timeframes.js';

export function checklistEvaluationTime(replayUntil, nowSec, m5Candles = []) {
  return closedReplayEvaluationTime(replayUntil, nowSec, m5Candles, '5m');
}

export function closedReplayEvaluationTime(replayUntil, nowSec, candles, bar) {
  if (replayUntil == null) return nowSec;
  // Replay zeigt ganze Kerzen anhand ihrer Open-Time. Nur eine tatsächlich vorhandene,
  // inzwischen geschlossene Kerze darf den Wissensstand bis zu ihrem Schluss erweitern.
  const latest = closedChecklistCandles(candles, bar, nowSec)
    .findLast(c => c.time <= replayUntil);
  return latest ? latest.time + barSecondsFor(bar) : null;
}

// Neutraler Import für Evaluator, Sweeps und Targets; kein Modul muss dadurch
// seinen eigenen Aufrufer importieren oder eine andere Schlussgrenze verwenden.
export function closedChecklistCandles(candles, bar, evaluatedAt) {
  const duration = barSecondsForTimeframeCi(bar);
  if (!Number.isFinite(evaluatedAt) || duration == null) return [];
  return (candles ?? []).filter(c => Number.isFinite(c.time) && c.time + duration <= evaluatedAt)
    .slice().sort((a, b) => a.time - b.time);
}
