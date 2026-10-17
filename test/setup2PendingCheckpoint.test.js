import {it,expect,vi} from 'vitest';
import {queueEvidenceCheckpoint,flushPendingCheckpoint} from '../services/setup2/pendingCheckpoint.js';
const instrument='EURUSD',state={evaluatedThrough:'2026-10-16T20:59:00Z',nativeHistoryRevision:0,entries:[{entry:{id:'new'}}]},previous={evaluatedThrough:'2026-10-16T13:54:00Z',nativeHistoryRevision:0};
const batches=[{configuration:{id:'config'},snapshots:[{id:'frozen',snapshot:{knownAt:1}}],payloads:[]}];
it('failed completed batches remain frozen and bounded until a byte-identical retry succeeds',async()=>{
 const cache={pendingEvidence:batches},calls=[];let fail=true;
 const request=async(path,body)=>{calls.push({path,body:structuredClone(body)});if(fail && path.endsWith('checkpoint_with_evidence'))throw new Error('temporary failure');};
 queueEvidenceCheckpoint(cache,{state,events:[],previous,anchors:[],h1:[]});
 await expect(flushPendingCheckpoint(request,cache,{instrument,owner:'first',previous})).rejects.toThrow('temporary failure');
 expect(cache.pendingEvidence).toHaveLength(1);
 expect(()=>queueEvidenceCheckpoint(cache,{state,events:[],previous})).toThrow('Pending checkpoint must finish');
 expect(cache.pendingEvidence).toEqual(batches);
 fail=false;await flushPendingCheckpoint(request,cache,{instrument,owner:'second',previous});
 const snapshots=calls.filter(c=>c.body.p_evidence?.snapshots?.length);
 expect(snapshots).toHaveLength(2);expect(snapshots[0].body.p_evidence).toEqual(snapshots[1].body.p_evidence);
 expect(cache.pendingEvidence).toEqual([]);expect(cache.pendingCheckpoint).toBeUndefined();expect(cache.liveState).toEqual(state);
});
it('a newer independent checkpoint is never overwritten by an old pending state',async()=>{
 const cache={pendingEvidence:batches},calls=[];
 queueEvidenceCheckpoint(cache,{state,events:[],previous,anchors:['old'],h1:['old']});
 const recovered={...state,evaluatedThrough:'2026-10-16T21:03:00Z',nativeHistoryRevision:1,entries:[{entry:{id:'recovered'}}],evidencePriceObservations:{B:{coverage:{}}}};
 await flushPendingCheckpoint(async(path,body)=>calls.push({path,body}),cache,{instrument,owner:'fresh',previous:recovered});
 expect(calls.at(-1).body.p_state).toEqual(recovered);expect(cache.entries).toEqual(recovered.entries);expect(cache.evidencePriceObservations).toEqual(recovered.evidencePriceObservations);
 expect(cache.pendingEvidence).toEqual([]);
});

it('a previously live Stage-3 signal becomes a missed Telegram/protocol event on a later-minute retry',async()=>{
 const at=Date.parse('2026-10-16T13:55:00Z'),event={id:'original-stage3',kind:'trading',stage:3,signal_at:new Date(at).toISOString(),missed_reason:null,payload:{provenance:{evaluationMode:'live'}}};
 const cache={pendingEvidence:batches},calls=[];let fail=true;const clock=vi.spyOn(Date,'now').mockReturnValue(at+20000);
 const request=async(path,body)=>{calls.push({path,body:structuredClone(body)});if(fail && path.endsWith('setup2_store_live_evidence'))throw new Error('staging failure');};
 try{
  queueEvidenceCheckpoint(cache,{state:{...state,evaluatedThrough:event.signal_at},events:[event],previous});
  await expect(flushPendingCheckpoint(request,cache,{instrument,owner:'first',previous})).rejects.toThrow('staging failure');
  fail=false;clock.mockReturnValue(at+80000);await flushPendingCheckpoint(request,cache,{instrument,owner:'fresh',previous});
  const retried=calls.at(-1).body.p_events[0];expect(retried.id).toBe(event.id);expect(retried.missed_reason).toMatch(/Checkpoint/);
  expect(retried.payload).toEqual(event.payload);expect(event.missed_reason).toBeNull();
 }finally{clock.mockRestore();}
});
