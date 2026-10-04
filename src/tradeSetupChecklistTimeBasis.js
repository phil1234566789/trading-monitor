import { barSecondsFor, barSecondsForTimeframeCi } from './timeframes.js';
import { closedCandleEnd } from './closedCandlePrefix.js';

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
  // Keine dauerhafte Sortiert-Markierung: Chart-Aufrufer dürfen Arrays korrigieren.
  // Der schnelle Archivpfad gibt weiterhin eine eigene, veränderbare Kopie zurück.
  if(candles?.every((c,i)=>Number.isFinite(c.time)&&(i===0||candles[i-1].time<=c.time)))
    return candles.slice(0,closedCandleEnd(candles,duration,evaluatedAt));
  return (candles ?? []).filter(c => Number.isFinite(c.time) && c.time + duration <= evaluatedAt)
    .slice().sort((a, b) => a.time - b.time);
}
