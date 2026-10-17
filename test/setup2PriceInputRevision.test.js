import native from './fixtures/eurusd20789-price-input-native.json';
import {observeDealingRangePrice} from '../src/dealingRangePriceObservation.js';
import {it,expect} from 'vitest';
import {createLiveEvidence} from '../services/setup2/evidence.js';
const start=1792158900;
const config={instrument:'EURUSD',sessions:[],tradingWindows:{weekday:[[0,1440]]},news:[],settings:{},dailyAnchors:[]};
const original={schemaVersion:3,id:'EURUSD:setup1:20789:stand:'+start,setupKey:'EURUSD:setup1:20789',instrument:'EURUSD',direction:'long',knownAt:start,
 dealingRange:{status:'validated'},checklist:{evaluatedAt:start,checks:{},setup:{primary:{validatedAt:start,direction:'long',invalidation:.5,targetSelection:{target1:{price:2},target2:{price:3}}}}}};
const bars=[{time:start-300,high:1.2,low:.9,close:1},{time:start,high:2.2,low:1,close:2},{time:start+300,high:3.2,low:1.5,close:3}];
function capture(candles,previous,final=[]){
 const e=createLiveEvidence(config,{fromTime:start,toTime:start+600,startedAt:start+1000});e.record(original);
 return e.complete(final,{m5Candles:candles,previous});
}
it('native M5 gap repair versions price inputs while preserving original snapshot and old unknown observation',()=>{
 const missing=capture([bars[0],bars[2]]),before=structuredClone(missing);
 const repaired=capture(bars,missing.priceState);
 expect(missing.snapshots[0].observation.priceObservation.rawEndReason).toBe('missingHistory');
 expect(repaired.snapshots[0].observation.priceObservation.rawEndReason).toBe('windowEnd');
 expect(repaired.snapshots[0].snapshot).toEqual(missing.snapshots[0].snapshot);
 expect(repaired.snapshots[0].id).not.toBe(missing.snapshots[0].id);
 expect(repaired.snapshots[0].observation.priceInputRevision).not.toBe(missing.snapshots[0].observation.priceInputRevision);
 expect(missing).toEqual(before);
 expect(capture(bars,repaired.priceState).snapshots).toEqual(repaired.snapshots);
});
it('unchanged causal inputs retain identity even if a finalized non-price observation unexpectedly drifts',()=>{
 const a=capture(bars,{},[{...original,rangeCourse:{lifecycle:{reason:'first'}}}]);
 const b=capture(bars,{},[{...original,rangeCourse:{lifecycle:{reason:'changed'}}}]);
 expect(a.snapshots[0].id).toBe(b.snapshots[0].id);
 expect(a.snapshots[0].observation).not.toEqual(b.snapshots[0].observation);
});
it('future and irrelevant M5 volume do not change causal input identity',()=>{
 const a=capture(bars),b=capture([...bars.map(c=>({...c,volume:999})),{time:start+600,high:100,low:0,close:50}]);
 expect(b.snapshots[0].id).toBe(a.snapshots[0].id);
});

it('JSONB-style object key ordering never creates a new price-input revision',()=>{
 const reorder=v=>Array.isArray(v)?v.map(reorder):v && typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reorder(x)])):v;
 const first=capture(bars),restarted=capture(bars,reorder(first.priceState));
 expect(restarted.snapshots[0].observation.priceInputRevision).toBe(first.snapshots[0].observation.priceInputRevision);
 expect(restarted.snapshots[0].id).toBe(first.snapshots[0].id);
});

it('reproduces the exact nine changed price fields of native EURUSD DR20789 after the missing M5 arrives',()=>{
 const before=structuredClone(native.previous);
 const current=observeDealingRangePrice({...native.parameters,candles:native.candles,windowEnd:native.windowEnd});
 const fields=Object.keys({...before,...current}).filter(k=>JSON.stringify(before[k])!==JSON.stringify(current[k])).sort();
 expect(before.rawEndReason).toBe('missingHistory');expect(current.rawEndReason).toBe('windowEnd');
 expect(native.candles.some(c=>c.time===before.rawThrough)).toBe(true);
 expect(fields).toEqual(['endAt','endReason','extremeAt','extremePrice','processedAfterT1','processedCandles','rawEndReason','rawThrough','stage2']);
 expect(native.previous).toEqual(before);expect(current.t1At).toBe(before.t1At);
});
import {liveEvidenceView} from '../src/liveEvidenceView.js';
it('partial staging of a new input revision preserves the previous full observation in the reader',()=>{
 const build=candles=>{
  const e=createLiveEvidence(config,{fromTime:start,toTime:start+600,startedAt:start+1000});
  e.record(original);e.record({...original,id:original.id+':next',knownAt:start+60});
  return e.complete([],{m5Candles:candles});
 };
 const stored=build([bars[0],bars[2]]),repaired=build(bars);
 const rows=stored.snapshots.map(s=>({...s,configuration_id:stored.configuration.id,captured_at:new Date((start+1000)*1000).toISOString()}));
 const partial={...repaired.snapshots[0],configuration_id:repaired.configuration.id,captured_at:new Date((start+2000)*1000).toISOString()};
 expect(partial.id).not.toBe(rows[0].id);
 const selected=liveEvidenceView([], [...rows,partial],'live-watcher:2026-10');
 expect(selected.every(s=>s.priceObservation?.rawEndReason==='missingHistory')).toBe(true);
 expect(partial.observation).toEqual({});
 expect(repaired.snapshots[1].observation.priceInputRevision).toBeTruthy();
});
