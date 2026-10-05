import {expect,it} from 'vitest';
import {simulationRunExecution,simulationRunLabel,sortSimulationRunsByExecution} from '../src/simulationRunPresentation.js';

it('uses evidenced start before completion and never treats creation or input time as execution',()=>{
  expect(simulationRunExecution({startedAt:100,completedAt:200})).toEqual({time:100,label:'Gestartet am'});
  expect(simulationRunExecution({startedAt:'invalid',completedAt:200})).toEqual({time:200,label:'Abgeschlossen am'});
  for(const r of [{},{createdAt:200},{created_at:'2026-10-04T12:00:00Z'},
    {evaluatedAt:1791054736,provenance:{snapshotAt:1791054736,measurement:{wallMs:640824}}}])
    expect(simulationRunExecution(r)).toBeNull();
});
it('sorts by the displayed execution basis, stably preserving ties and unknown runs',()=>{
  const rows=[{id:'old',startedAt:100,evaluatedAt:999},{id:'unknown1',createdAt:999},
    {id:'new',startedAt:'1970-01-01T00:03:20Z',completedAt:900},
    {id:'tie',completedAt:200},{id:'unknown2',evaluatedAt:9999}];
  const before=JSON.stringify(rows);
  expect(sortSimulationRunsByExecution(rows).map(r=>r.id)).toEqual(['new','tie','old','unknown1','unknown2']);
  expect(JSON.stringify(rows)).toBe(before);
});
it('keeps indistinguishable September snapshots honest and single-DR labels intact',()=>{
  for(const id of ['setup2-755bebd2fc0a0e17daa76e93','setup2-ca6e88cd7865d68b9859d031']){
    const label=simulationRunLabel({id,status:'complete',configuration:{label:'GBPUSD September 2026'},evaluatedAt:1791054736});
    expect(label).toContain('Ausführungszeit unbekannt');expect(label).toContain('Datenstand');
    expect(label).toContain(id.slice(-8));expect(label).not.toContain('Gestartet am');
  }
  expect(simulationRunLabel({id:'single',from:100,to:200,status:'complete',startedAt:300,configuration:{label:'GBPUSD DR105'}})).toContain('GBPUSD DR105 · Gestartet am');
});
it('adds the whole-run DR count only when requested, keeping unknown and partial counts honest',()=>{
  const run={id:'run12345',status:'complete',configuration:{label:'September'},dealingRangeCount:57};
  expect(simulationRunLabel(run,{showDrCount:true})).toContain('September · 57 DRs');
  expect(simulationRunLabel(run)).not.toContain('57 DRs');
  expect(simulationRunLabel({...run,dealingRangeCount:0},{showDrCount:true})).toContain('0 DRs');
  expect(simulationRunLabel({...run,dealingRangeCount:1,status:'running'},{showDrCount:true})).toContain('1 DR (vorläufig)');
  for(const count of [undefined,null,-1,NaN,1.5])expect(simulationRunLabel({...run,dealingRangeCount:count},{showDrCount:true})).toContain('DR-Anzahl unbekannt');
});
