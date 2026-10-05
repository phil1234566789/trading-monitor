import {formatDatedTime} from './berlinTime.js';
import {fmtDateTime} from './format.js';
import {simulationRunStatusLabel} from './tradeSetupSimulationStatistics.js';
import {entryPatternText} from './entryPattern.js';

export function simulationRunExecution(run) {
  // Eingabe-Snapshot und Datensatz-Erstellung belegen keinen Ausführungszeitpunkt.
  for(const [field,label] of [['startedAt','Gestartet am'],['completedAt','Abgeschlossen am']]) {
    const value=run[field];
    const time=typeof value==='number'?value:typeof value==='string'&&value.trim()?Date.parse(value)/1000:NaN;
    if(Number.isFinite(time)&&time>0)return {time,label};
  }
  return null;
}

export function sortSimulationRunsByExecution(runs) {
  return runs.toSorted((a,b)=>{
    const first=simulationRunExecution(a)?.time,second=simulationRunExecution(b)?.time;
    return first==null?(second==null?0:1):second==null?-1:second-first;
  });
}

export function simulationRunLabel(run) {
  const date=value=>fmtDateTime(value,{year:'numeric',second:'2-digit',timeZone:'Europe/Berlin'});
  const execution=simulationRunExecution(run);
  const timestamp=execution?`${execution.label} ${date(execution.time)}`:'Ausführungszeit unbekannt';
  const data=Number.isFinite(run.evaluatedAt)?` · Datenstand ${date(run.evaluatedAt)}`:'';
  return `${entryPatternText(run.configuration?.label)??`${formatDatedTime(run.from)} – ${formatDatedTime(run.to)}`} · ${timestamp}${data} · ${simulationRunStatusLabel(run)} · ${run.id.slice(-8)}`;
}
