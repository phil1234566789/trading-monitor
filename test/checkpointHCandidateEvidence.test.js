import {expect,it} from 'vitest';
import original from './fixtures/checkpointH22681.json';
import dr3033 from './fixtures/checkpointH3033.json';
import {checkpointHExplanation} from '../src/checkpointHExplanation.js';
const check=s=>checkpointHExplanation(structuredClone(s)).candidates[0];
it('shows one coherent v10 candidate instead of later green pivot and later ended lifecycle',()=>{
 const c=check(original);
 expect(c.at).toBe(1792494240);expect(c.version).toBe('countertrend-entry-model-1-v10');
 expect(c.rows.find(r=>r.key==='m1PivotBreak')).toMatchObject({state:'missing',tone:'negative',required:true});
 expect(c.rows.find(r=>r.key==='m5Bos')).toMatchObject({state:'optionalMissing',tone:'warning',required:false});
 for(const key of ['active','retest','fvg'])expect(c.rows.find(r=>r.key===key).state).toBe('fulfilled');
 expect(c.summary).toContain('Kein Entry: Pflichtregel M1-Pivotbruch');
 expect(c.timeline.join(' ')).toContain('14:07');
 expect(JSON.stringify(c.rows)).not.toContain('14:07');
});
it('keeps v11 BOS mandatory and missing',()=>{
 expect(check(dr3033).rows.find(r=>r.key==='m5Bos')).toMatchObject({state:'missing',required:true,tone:'negative'});
});
it('does not reconstruct a candidate test from a later summary',()=>{
 const s=structuredClone(original);s.checklistHistory.entries=s.checklistHistory.entries.filter(f=>f.m1Check?.evaluatedAt!==1792494240);
 const c=check(s);expect(c.state).toBe('uncertain');expect(c.rows.every(r=>r.state==='uncertain')).toBe(true);
});
it('keeps omitted optional evidence gray rather than yellow',()=>{
 const s=structuredClone(original);for(const f of s.checklistHistory.entries)if(f.m1Check?.conditions)delete f.m1Check.conditions.m5Bos;
 expect(check(s).rows.find(r=>r.key==='m5Bos')).toMatchObject({state:'uncertain',tone:'neutral'});
});
it('keeps multiple candidates and their exact tests separate',()=>{
 const s=structuredClone(original),f=structuredClone(s.checklistHistory.entries[1]);
 f.knownAt+=60;f.m1Check.evaluatedAt=f.knownAt;f.m1Check.conditions.fvg.recognizedAt=f.knownAt;f.m1Check.fvg.recognizedAt=f.knownAt;
 s.checklistHistory.entries.splice(2,0,f);
 const cs=checkpointHExplanation(s).candidates;expect(cs.map(c=>c.at)).toEqual([1792494240,1792494300]);
});
it('never imports a later lifecycle or eligibility into candidate rules',()=>{
 const s=structuredClone(original);s.entryEligibility={status:'blocked',details:['future gate']};
 const c=check(s);expect(c.rows.find(r=>r.key==='time').state).toBe('uncertain');expect(c.rows.find(r=>r.key==='active').state).toBe('fulfilled');
});
it('uses only candidate-time entry proof and does not infer an entry from green signals',()=>{
 const s=structuredClone(original);s.entry={recognizedAt:s.knownAt,price:999};
 expect(check(s).state).toBe('missing');
});
it('distinguishes an explicitly absent countertrend from unrecorded countertrend data',()=>{
 for(const absent of [true,false]){
  const s=structuredClone(original),f=s.checklistHistory.entries[1];
  if(absent)f.m1Check.conditions.m5Countertrend=null;else delete f.m1Check.conditions.m5Countertrend;
  expect(check(s).rows.find(r=>r.key==='m5Countertrend').state).toBe(absent?'missing':'uncertain');
 }
});
it('rejects a v11 BOS bound to the wrong countertrend origin',()=>{
 const s=structuredClone(dr3033),f=s.checklistHistory.entries.find(f=>f.knownAt===1787864340),at=f.knownAt;
 f.m1Check.conditions.m5Countertrend={trend:'uptrend',recognizedAt:at-60,range:{high:{pivotTime:at-120}}};
 f.m1Check.conditions.m5Bos={type:'BOS',direction:'short',recognizedAt:at-30,originTime:at-180};
 expect(check(s).rows.find(r=>r.key==='m5Bos').state).toBe('missing');
});
it('shows the retest contact separately from a mismatched orderblock direction',()=>{
 const s=structuredClone(original);s.checklistHistory.entries[1].m1Check.conditions.retest.orderBlock={dir:-1};
 const c=check(s);expect(c.rows.find(r=>r.key==='retest').state).toBe('fulfilled');
 expect(c.rows.find(r=>r.key==='retestOrderBlock').state).toBe('missing');
});
it('does not claim an unrecorded orderblock direction or countertrend range passed',()=>{
 const c=check(original);
 for(const key of ['m5Countertrend','retestOrderBlock'])expect(c.rows.find(r=>r.key===key).state).toBe('uncertain');
});
it('rejects a wrong signal type and a FVG that predates the retest',()=>{
 const s=structuredClone(original),f=s.checklistHistory.entries[1];
 f.m1Check.conditions.m1PivotBreak={type:'BOS',direction:'long',recognizedAt:f.knownAt-1};
 f.m1Check.conditions.retest.recognizedAt=f.knownAt+60;
 const c=check(s);for(const key of ['m1PivotBreak','fvgAfterRetest'])expect(c.rows.find(r=>r.key===key).state).toBe('missing');
});
