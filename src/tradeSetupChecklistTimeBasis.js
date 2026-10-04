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
  const rows=candles??[];
  let sorted=true;
  for(let i=0;i<rows.length;i++)if(!Number.isFinite(rows[i]?.time)||(i>0&&rows[i-1].time>rows[i].time)){
    sorted=false;break;
  }
  if(sorted)return rows.slice(0,closedCandleEnd(rows,duration,evaluatedAt));
  return rows.filter(c => Number.isFinite(c.time) && c.time + duration <= evaluatedAt)
    .slice().sort((a, b) => a.time - b.time);
}
