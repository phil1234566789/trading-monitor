import { setupEntryConditions } from './tradeSetup2Review.js';
import { evaluateDealingRange } from './tradeSetup2DealingRange.js';
import { checklistObservationRules } from './checklistObservationRules.js';

export const CHECKLIST_HISTORY_VERSION = 'checklist-changes-v1';
const pick = (value, keys) => value ? Object.fromEntries(keys.filter(k => value[k] !== undefined).map(k => [k,value[k]])) : null;
const signal = value => pick(value,['recognizedAt','knownAt','candleTime','pivotTime','price','direction','gap','startTime','top','bottom','fromTime','toTime']);
function lightChecks(checks) {
  return Object.fromEntries(Object.entries(checks ?? {}).map(([key,c]) => [key,{
    ...pick(c,['status','details','detailStatuses','explanation','ruleVersion']),
    ...(c?.m1Anchor ? {m1Anchor:signal(c.m1Anchor)} : {}),
    ...(['antiConfluences','confluences'].includes(key) ? {rules:checklistObservationRules(c,key).map(r=>({
      ...pick(r,['id','label','status','invalidates','disqualifies']),evidence:(r.evidence ?? []).map(signal)}))} : {}),
  }]));
}
const lightLifecycle = c => c ? {...pick(c,['version','entrySearchAllowed']),
  main:pick(c.main,['state','reason','recognizedAt']),target1:pick(c.target1,['status','recognizedAt']),
  target2:pick(c.target2,['status','recognizedAt'])} : null;

// Nur Evaluator-Ergebnisse kopieren; weder Kerzen noch Strukturpools oder neue M1-Arbeit.
export function createChecklistHistoryRecorder() {
  const histories=new Map(),previous=new Map(),m1Checks=new Map();
  function record(checklist,candidate,source='M5',m1Check,savedEntry=null) {
    const at=checklist.evaluatedAt,key=candidate.id;
    if(m1Check)m1Checks.set(key,{...pick(m1Check,['status','details','detailStatuses','trends','currentTrend','entryModel','evaluatedAt']),
      instrument:checklist.instrument,
      entry:pick(savedEntry,['id','label','entryModel','recognizedAt','candleTime','price','direction','conditions','scales','sizing']),
      conditions:Object.fromEntries(Object.entries(m1Check.conditions ?? {}).map(([k,v])=>[k,signal(v)])),
      retest:signal(m1Check.retest),fvg:signal(m1Check.fvg),bos:signal(m1Check.bos),choch:signal(m1Check.choch)});
    const lifecycle=lightLifecycle(candidate.lifecycle),stage=evaluateDealingRange(checklist,candidate);
    const primary={...pick(candidate,['id','direction','recognizedAt','reactionRecognizedAt','invalidation','setupType']),
      targetSelection:pick(candidate.targetSelection,['status','selectedAt','details']),lifecycle,validity:lifecycle?.main};
    if(primary.targetSelection)Object.assign(primary.targetSelection,{target1:signal(candidate.targetSelection.target1),target2:signal(candidate.targetSelection.target2)});
    const checks=lightChecks({...checklist.checks,...candidate.checks});
    const value={checks,primary,dealingRange:pick(stage,['version','model','status','details','reason']),m1Check:m1Checks.get(key) ?? null};
    const signature=JSON.stringify({...value,m1Check:value.m1Check ? {...value.m1Check,evaluatedAt:undefined} : null});
    if(previous.get(key)?.signature===signature)return;
    const state={...pick(checklist,['instrument','direction','status','model','ruleVersion','entryModel']),direction:candidate.direction,
      evaluatedAt:at,checks,setup:{primary},dealingRange:{...value.dealingRange,evaluatedAt:at}};
    const rows=setupEntryConditions({knownAt:at,instrument:checklist.instrument,direction:candidate.direction,
      checklist:state,dealingRange:state.dealingRange,m1Check:value.m1Check,entry:value.m1Check?.entry}).rows;
    const before=previous.get(key)?.entry;
    const oldRows=new Map(before?.rows.map(r=>[r.key,r]) ?? []);
    const changes=rows.filter(row=>{const old=oldRows.get(row.key);return JSON.stringify([row.status,row.details])!==JSON.stringify(old && [old.status,old.details]);})
      .map(row=>({key:row.key,label:row.label,old:oldRows.get(row.key)?.status ?? null,new:row.status,text:row.details?.join(' · ')}));
    if(before?.dealingRange.status!==value.dealingRange.status)changes.push({key:'stage',old:before?.dealingRange.status ?? null,new:value.dealingRange.status,text:stage.details?.join(' · ')});
    if(JSON.stringify(before?.lifecycle)!==JSON.stringify(lifecycle))changes.push({key:'lifecycle',old:before?.lifecycle ?? null,new:lifecycle,text:lifecycle?.main?.reason ?? lifecycle?.main?.state});
    const entry={knownAt:at,evaluatedAt:at,source,rows,changes,checklist:state,m1Check:value.m1Check,
      dealingRange:state.dealingRange,lifecycle};
    if(!histories.has(key))histories.set(key,[]);
    histories.get(key).push(entry);previous.set(key,{signature,entry});
  }
  return {record,complete:snapshots=>snapshots.map(s=>({...s,schemaVersion:4,
    checklistHistory:{version:CHECKLIST_HISTORY_VERSION,entries:histories.get(s.setupKey) ?? []}}))};
}

export function checklistHistoryAt(history,at) {
  if(history?.version!==CHECKLIST_HISTORY_VERSION)return null;
  const entries=history.entries ?? [];let lo=0,hi=entries.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(entries[mid].knownAt<=at)lo=mid+1;else hi=mid;}
  return entries[lo-1] ?? null;
}
