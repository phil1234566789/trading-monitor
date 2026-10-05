import { it,expect } from 'vitest';
import { simulationPinKey,simulationPinSnapshot } from '../src/simulationPinSnapshot.js';
it('freezes the full displayed checkpoint and both entry variants with unambiguous times',()=>{
  const snapshot={id:'s',runId:'run',setupKey:'dr',knownAt:1790238960,checklist:{ruleVersion:'rules',setup:{primary:{tradeSetupId:42}}}};
  const feature={key:'dummy',group:'checkpoint',label:'I',value:'observed',details:['evidence']};
  const group={key:'dr',snapshot,features:[feature],recognizedAt:1790238960,instrument:'GBPUSD',direction:'short',stage:'validated',setupType:'countertrend',outcome:{status:'t1Unknown'}};
  const target={kind:'simulation_checkpoint',group,feature};
  const frozen=simulationPinSnapshot(target,{version:'v12',configuration:{entryPattern:'v3'}},[],'2026-10-04T11:00:00Z');
  expect(frozen).toMatchObject({runId:'run',runVersion:'v12',entryPatternVersion:'v3',setup1Id:42,checkpoint:{key:'dummy',value:'observed'},recognizedAt:{berlin:'2026-09-24 10:36',utc:'2026-09-24T08:36:00.000Z'}});
  const entry={...snapshot,id:'entry',entry:{id:'entry',recognizedAt:1790238960,price:1.3,stops:{wide:{price:1.4}}}};
  const rows=['wide','narrow'].map(variant=>({snapshotId:'entry',runId:'run',variant,netRMultiple:2}));
  const context=simulationPinSnapshot({kind:'simulation_entry',group,entry},{version:'v12'},rows);
  expect(context.entry.results.wide.netRMultiple).toBe(2);expect(context.entry.results.narrow.netRMultiple).toBe(2);
  expect(simulationPinKey(target)).not.toBe(simulationPinKey({...target,group:{...group,snapshot:{...snapshot,runId:'other'}}}));
  expect(simulationPinKey(target)).toBe(simulationPinKey({...target,group:{...group,snapshot:{...snapshot,id:'newer-snapshot'}}}));
});
