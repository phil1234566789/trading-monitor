import {expect,it} from 'vitest';
import {entryPatternVersion,entryPatternText} from '../src/entryPattern.js';
import {entrySizingAt} from '../src/tradeSetup2EntrySizing.js';
import {restoreTradeSetup2Snapshot} from '../src/tradeSetup2Snapshot.js';
import {simulationRunLabel} from '../src/simulationRunPresentation.js';
import {createSimulationRepository} from '../src/tradeSetupSimulationRepository.js';

it('reads old and new field names with identical sizing while preserving serialized archive objects',()=>{
  const legacy={entryModel:'countertrend-entry-model-1-v4',direction:'short',recognizedAt:600,
    conditions:{m5Bos:{type:'BOS',direction:'short',recognizedAt:300}}};
  const canonical={...legacy,entryPattern:legacy.entryModel};delete canonical.entryModel;
  expect(entryPatternVersion(legacy)).toBe(entryPatternVersion(canonical));
  expect(entrySizingAt({evaluatedAt:600},legacy)).toEqual(entrySizingAt({evaluatedAt:600},canonical));
  const snapshot={knownAt:600,instrument:'GBPUSD',entry:legacy,checklist:{entryModel:legacy.entryModel,checks:{}},evidence:[]};
  const serialized=JSON.stringify(snapshot);
  expect(entryPatternVersion(restoreTradeSetup2Snapshot(snapshot).entry)).toBe(legacy.entryModel);
  expect(JSON.stringify(snapshot)).toBe(serialized);
});

it('presents historical labels using the new term without rewriting stored labels',()=>{
  const run={id:'saved',from:1,to:600,status:'complete',configuration:{label:'GBPUSD · Entry-Modell 1'}};
  const serialized=JSON.stringify(run);
  expect(simulationRunLabel(run)).toContain('GBPUSD · Entry Pattern 1');
  expect(entryPatternText('Entry Modell 1')).toBe('Entry Pattern 1');
  expect(JSON.stringify(run)).toBe(serialized);
});

it('projects both archived field names and gives the canonical field precedence',async()=>{
  const rows=[{id:'old',entryModel:'countertrend-entry-model-1-v3'},
    {id:'new',entryPattern:'countertrend-entry-model-1-v4',entryModel:'countertrend-entry-model-1-v3'}];
  const selections=[];
  const db={from:table=>({select:fields=>{selections.push(fields);const query={order:()=>query,
    range:async offset=>({data:table==='trade_setup_simulation_entries'&&offset===0?rows:[],error:null})};return query;}})};
  const snapshots=await createSimulationRepository(db).listReviewSnapshots();
  expect(snapshots.map(s=>s.checklist.entryPattern)).toEqual(['countertrend-entry-model-1-v3','countertrend-entry-model-1-v4']);
  expect(selections.every(s=>s.includes('entryModel:snapshot->checklist->>entryModel')&&s.includes('entryPattern:snapshot->checklist->>entryPattern'))).toBe(true);
});
