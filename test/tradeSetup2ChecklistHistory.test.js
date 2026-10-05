import {expect,it} from 'vitest';
import {createChecklistHistoryRecorder,checklistHistoryAt,CHECKLIST_HISTORY_VERSION} from '../src/tradeSetup2ChecklistHistory.js';
import {ENTRY_MODEL_1_VERSION} from '../src/entryModel1Conditions.js';
import {checklistHistoryChanges} from '../src/checklistReplayView.js';
const candidate={id:'dr',direction:'short',recognizedAt:100,invalidation:1.4,checks:{},lifecycle:{main:{state:'active'}}};
const state=at=>({instrument:'GBPUSD',status:'ready',model:'countertrend',evaluatedAt:at,checks:{liquiditySweep:{status:'passed',details:['Sweep']}},setup:{primary:candidate}});
it('records changes only, keeps lightweight evidence and chooses the last causal state',()=>{
  const recorder=createChecklistHistoryRecorder();
  recorder.record(state(100),candidate);recorder.record(state(200),candidate);
  const changed={...candidate,checks:{reaction:{status:'passed',details:['OB']}}};
  recorder.record(state(300),changed,'M1');
  const snapshot=recorder.complete([{setupKey:'dr'}])[0];
  const history=snapshot.checklistHistory;
  expect(history.version).toBe(CHECKLIST_HISTORY_VERSION);
  expect(history.entries).toHaveLength(2);
  expect(history.entries[1].changes.map(c=>c.key)).toEqual(['reaction']);
  expect(checklistHistoryAt(history,99)).toBeNull();
  expect(checklistHistoryAt(history,299).knownAt).toBe(100);
  expect(checklistHistoryAt(history,300).knownAt).toBe(300);
  expect(checklistHistoryAt(history,999).source).toBe('M1');
  expect(checklistHistoryAt(null,999)).toBeNull();
  expect(JSON.stringify(history).length).toBeLessThan(30000);
});
it('preserves causal pivot-break provenance and the sweep start in replay history',()=>{
  const recorder=createChecklistHistoryRecorder();
  const fact={type:'pivot-break',direction:'short',recognizedAt:300,candleTime:180,pivotTime:120,
    originTime:60,pullbackTime:150,pivotRecognizedAt:300,breachKnownAt:240,price:1.3};
  const structureStart={structureFrom:60,recognizedAt:120,sourceTime:0,sourceTimeframe:'1H',price:1.4};
  const m1Check={entryModel:ENTRY_MODEL_1_VERSION,evaluatedAt:300,conditions:{m1PivotBreak:fact},
    pivotBreak:fact,structureStart};
  recorder.record({...state(300),entryModel:ENTRY_MODEL_1_VERSION},candidate,'M1',m1Check);
  const entry=recorder.complete([{setupKey:'dr'}])[0].checklistHistory.entries[0];
  expect(entry.m1Check.pivotBreak).toEqual(fact);
  expect(entry.m1Check.conditions.m1PivotBreak).toEqual(fact);
  expect(entry.m1Check.structureStart).toEqual(structureStart);
  expect(checklistHistoryChanges(entry,'H').some(c=>c.key==='m1PivotBreak')).toBe(true);
});
