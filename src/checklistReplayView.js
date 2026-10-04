import {checklistHistoryAt,CHECKLIST_HISTORY_VERSION} from './tradeSetup2ChecklistHistory.js';

export function snapshotChecklistAt(snapshot,at) {
  if(!snapshot)return null;
  if(snapshot.checklistHistory?.version!==CHECKLIST_HISTORY_VERSION)return snapshot.knownAt<=at?snapshot:null;
  const state=checklistHistoryAt(snapshot.checklistHistory,at);
  if(!state)return null;
  const checks=Object.fromEntries(Object.entries(state.checklist.checks).map(([key,value])=>[key,{...snapshot.checklist?.checks?.[key],...value}]));
  return {...snapshot,knownAt:state.knownAt,historyEntry:state,checklist:{...snapshot.checklist,...state.checklist,checks,
    setup:{primary:{...snapshot.checklist?.setup?.primary,...state.checklist.setup.primary}}},
    m1Check:state.m1Check,dealingRange:state.dealingRange,
    entry:snapshot.entry?.recognizedAt<=at?snapshot.entry:null};
}
export function checklistHistoryChanges(entry,checkpoint='') {
  const key={A:'liquiditySweep',B:'reaction',C:'outerM5Trend',D:'m5Trend',E:'targets',F:'antiConfluences',G:'confluences'}[checkpoint];
  return (entry.changes ?? []).filter(c=>!checkpoint || (key ? c.key===key || c.key.startsWith(`${key}.`) : ['m5Bos','m1Choch','m5Choch','m1Bos','retest','fvg','entry','structure','anchor'].includes(c.key)));
}
