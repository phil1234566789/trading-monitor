import {markIgnoredCandles} from './sessionOccurrences.js';
import {berlinOffsetMinutes} from './berlinTime.js';
import {CHECKLIST_HISTORY_VERSION} from './tradeSetup2ChecklistHistory.js';
import {completeDealingRangePriceObservations} from './dealingRangePriceObservation.js';

export function markCountertrendCandles(rows,instrument,sessions=[]){
 return markIgnoredCandles((rows??[]).slice().sort((a,b)=>a.time-b.time),sessions.filter(s=>s.instrument===instrument),sec=>berlinOffsetMinutes(sec*1000));
}

export function completeCountertrendSnapshots(snapshots,m5,toTime,historyForSetup){
 const latest=new Map(snapshots.filter(s=>s.rangeCourse).map(s=>[s.setupKey,s.rangeCourse]));
 const completed=snapshots.map(s=>({...s,...(s.entry?{rangeCourse:latest.get(s.setupKey)??null}:{}),schemaVersion:4,
  checklistHistory:{version:CHECKLIST_HISTORY_VERSION,entries:historyForSetup(s.setupKey)}}));
 return completeDealingRangePriceObservations(completed,m5,toTime);
}
