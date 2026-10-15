import {packEvidence,hydrateEvidence,evidenceReferences} from '../services/setup2/evidencePayload.js';
import {createHash} from 'node:crypto';
import {it,expect} from 'vitest';
import {createLiveEvidence} from '../services/setup2/evidence.js';
const at=1792036800;
const original={schemaVersion:3,id:'entry-1',setupKey:'GBPUSD:setup1:1',instrument:'GBPUSD',direction:'short',knownAt:at,
 entry:{id:'entry-1',recognizedAt:at},checklist:{evaluatedAt:at,checks:{entry:{status:'passed'}}}};
const config={version:'test-v1',sessions:[],tradingWindows:{weekday:[[0,1440]]},news:[],settings:{},dailyAnchors:[]};
it('freezes the original and stores finalized future history separately with stable configuration identity',()=>{
 const evidence=createLiveEvidence(config,{fromTime:at,toTime:at+60,startedAt:at+20});
 evidence.record(original);
 const finalized={...original,checklistHistory:{entries:[{knownAt:at+60}]},rangeCourse:{lifecycle:{evaluatedAt:at+60}},priceObservation:{rawThrough:at+60}};
 const batch=evidence.complete([finalized]);
 original.checklist.checks.entry.status='changed';
 expect(batch.snapshots[0]).toMatchObject({snapshot_id:'entry-1',known_at:new Date(at*1000).toISOString(),evaluated_through:new Date((at+60)*1000).toISOString(),evaluation_mode:'live',
 snapshot:{id:'entry-1',checklist:{checks:{entry:{status:'passed'}}}},observation:{checklistHistory:finalized.checklistHistory,priceObservation:finalized.priceObservation}});
 expect(batch.snapshots[0].snapshot.checklistHistory).toBeUndefined();
 expect(batch.configuration.configuration).toMatchObject({schemaVersion:1,m1Period:5,...config});
 const again=createLiveEvidence(config,{fromTime:at,toTime:at+60,startedAt:at+20});again.record({...original,checklist:{}});
 expect(again.complete([]).configuration.id).toBe(batch.configuration.id);
 expect(again.complete([]).snapshots[0].id).toBe(batch.snapshots[0].id);
});
it('records DRs with no alarm or entry, and labels delayed/recovery evaluation as catchup',()=>{
 const evidence=createLiveEvidence(config,{fromTime:at,toTime:at+60,startedAt:at+600});
 evidence.record({...original,id:'range:stand:1',entry:null});
 expect(evidence.complete([]).snapshots[0]).toMatchObject({snapshot_id:'range:stand:1',evaluation_mode:'catchup',snapshot:{entry:null}});
 const recovered=createLiveEvidence(config,{fromTime:at,toTime:at+60,startedAt:at,mode:'catchup'});recovered.record(original);
 expect(recovered.complete([]).snapshots[0].evaluation_mode).toBe('catchup');
});
it('does not persist reconstructed pre-window callbacks or mutate inputs',()=>{
 const evidence=createLiveEvidence(config,{fromTime:at+60,toTime:at+120,startedAt:at+60});evidence.record(original);
 expect(evidence.complete([]).snapshots).toEqual([]);
 const other=createLiveEvidence({...config,version:'test-v2'},{fromTime:at,toTime:at+60,startedAt:at});
 expect(other.complete([]).configuration.id).not.toBe(evidence.complete([]).configuration.id);
});

it('losslessly shares repeated large pools and refuses missing evidence instead of inventing it',()=>{
 const pool=Array.from({length:1000},(_,i)=>({time:i,price:i+1})),parts=new Map();
 const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 const original={checklist:{checks:{m5Trend:{structureState:{pivots:pool}}}},other:{structure:{pivots:pool}}};
 const packed=packEvidence(original,parts,hash),map=new Map([...parts].map(([k,v])=>[k,v.payload]));
 expect(parts.size).toBeLessThan(25);expect(evidenceReferences(packed).size).toBeGreaterThan(0);
 expect(hydrateEvidence(packed,map)).toEqual(original);expect(()=>hydrateEvidence(packed,new Map())).toThrow('Missing');
 expect(JSON.stringify(packed).length+JSON.stringify([...parts.values()]).length).toBeLessThan(JSON.stringify(original).length);
});

it('keeps coverage and price-outcome scalar metadata directly projectable',()=>{
 const parts=new Map(),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 const value={coverage:{originSnapshotId:'x'.repeat(80),validatedAt:123,sourceValidatedAt:1,missingBeforeCapture:true,configurationId:'a'.repeat(64),evaluatedThrough:456},
  priceObservation:{version:'v'.repeat(80),stage1:'target1',stage2:'target2',validatedAt:123,rawThrough:456},
  rangeCourse:{version:'v'.repeat(80),lifecycle:{version:'v'.repeat(80),main:{state:'ended',reason:'target1'},entrySearchAllowed:false}}};
 const packed=packEvidence(value,parts,hash);
 expect(packed.coverage.missingBeforeCapture).toBe(true);expect(packed.priceObservation.stage1).toBe('target1');
 expect(packed.rangeCourse.lifecycle.entrySearchAllowed).toBe(false);expect(hydrateEvidence(packed,new Map([...parts].map(([k,v])=>[k,v.payload])))).toEqual(value);
});
