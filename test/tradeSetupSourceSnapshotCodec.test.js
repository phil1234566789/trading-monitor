import {expect,it} from 'vitest';
import {captureTradeSetupSourceSnapshot,restoreTradeSetupSourceSnapshot,assertTradeSetupSourceSnapshot,
 tradeSetupSweepSourceKey,restoreTradeSetupSourceReferences} from '../supabase/functions/_shared/tradeSetupSourceSnapshot.js';
const profile='ts11-ob-edge-p5-supersession-v1';
const pivot={price:100,dir:1,pivotTime:300,touchedTime:2100,touched:true,endTime:2100};
const ob={sourceKind:'orderBlock',sourceStartTime:300,sourceKnownAt:900,sourceDirection:-1,sourceTop:100,sourceBottom:98,
 price:100,dir:1,pivotTime:300,touchedTime:2100,touched:true,endTime:2100};
const sw=level=>({timeframe:'5M',level});
const owner=()=>({trend:'downtrend',depth:1,basis:'confirmedNestedRange',knownAt:3000,
 low:{price:90,pivotTime:1200},high:{price:110,pivotTime:1500}});
const setup=()=>({dir:1,obStartTime:2400,obTop:103,obBottom:95,obFvg:1,pathType:'A',ls:ob,fractal:pivot,
 sweeps:[sw(ob),sw(pivot)],confirmationSources:[sw(ob),sw(pivot)],confirmationHistory:[{...sw(ob),status:'valid',validUntil:null},
 {...sw(pivot),status:'valid',validUntil:null}],sweepSourceProfile:profile,trendEvaluationVersion:'ts11-causal-inner-trend-ob-sources-p5-supersession-v2',
 trendEvidence:{goWitness:{...sw(pivot),sourceKey:tradeSetupSweepSourceKey(pivot,'5M'),knownAt:3000,ownerProof:owner()}}});
const capture=source=>captureTradeSetupSourceSnapshot({setup:source,instrument:'XAUUSD',sourceProfile:profile,
 configuration:{params:{sweepSourceProfile:profile},m5StructurePeriod:5,m5Structure2Period:2},canonicalSetupKnownAt:3000,evaluationAsOf:3600});
it('roundtrips mixed same-time OB/pivot sources without aliasing them and freezes the historical witness',async()=>{
 const source=setup(),before=JSON.stringify(source),payload=await capture(source),stored=JSON.parse(JSON.stringify(payload));
 expect(assertTradeSetupSourceSnapshot(stored)).toBe(stored);
 const restored=restoreTradeSetupSourceSnapshot(stored);
 expect(restored.ls.sourceKind).toBe('orderBlock');expect(restored.fractal.sourceKind??'liquidity').toBe('liquidity');
 expect(restored.ls).not.toBe(restored.fractal);expect(restored.sweeps[0].level).toBe(restored.ls);
 expect(restored.trendEvidence.goWitness.sourceKey).toBe(tradeSetupSweepSourceKey(pivot,'5M'));
 expect(restored.confirmationHistory).toEqual(source.confirmationHistory);
 expect(payload.settingsHash).toMatch(/^[a-f0-9]{64}$/);expect(payload.frozenAt).toBe(3600);
 source.ls={...ob,price:999};expect(stored.setup.ls.price).toBe(100);expect(before).toContain('100');
});
it('restores a real shared pivot reference and an explicitly open fractal endpoint',async()=>{
 const source=setup();source.ls=pivot;source.fractal=pivot;source.sweeps=[sw(pivot)];source.confirmationSources=[sw(pivot)];
 const restored=restoreTradeSetupSourceSnapshot(await capture(source));expect(restored.fractal).toBe(restored.ls);
 const transported=restoreTradeSetupSourceReferences(JSON.parse(JSON.stringify(source)));
 expect(transported.fractal).toBe(transported.ls);
 source.fractal={price:104,dir:1,pivotTime:1800,touched:false,touchedTime:null,endTime:Infinity};
 expect(restoreTradeSetupSourceSnapshot(await capture(source)).fractal.endTime).toBe(Infinity);
});
it('rejects absent identity, future provenance, broken OB direction and forged GO witness',async()=>{
 const good=await capture(setup());
 for(const mutate of [p=>delete p.sourceProfile,p=>p.setup.obStartTime='2400',p=>p.canonicalSetupKnownAt=3601,
  p=>p.frozenAt=4000,p=>p.setup.ls.sourceDirection=1,p=>p.setup.ls.sourceKnownAt=2400,p=>p.setup.ls.sourceKnownAt=1200,
  p=>p.setup.trendEvidence.goWitness.sourceKey='foreign',p=>delete p.setup.trendEvidence.goWitness.ownerProof,
  p=>p.setup.trendEvidence.goWitness.ownerProof.knownAt=3600,p=>p.setup.trendEvidence.goWitness.ownerProof.basis='forged',
  p=>p.setup.trendEvidence.goWitness.ownerProof={status:'ready',range:owner(),depth:1,knownAt:3000,
   basis:'deepestRangeAtLevelBirth',pivot:{price:99,pivotTime:300}},
  p=>p.settingsHash=null,p=>p.setup.obTop=NaN,
  p=>p.setup.confirmationHistory[0].level={...p.setup.confirmationHistory[0].level,sourceKnownAt:1200}]){
  const bad=structuredClone(good);mutate(bad);expect(()=>assertTradeSetupSourceSnapshot(bad)).toThrow();
 }
});
it('rejects non-JSON metadata, NUL and oversize before resolving or persisting anything',async()=>{
 for(const bad of [{...setup(),note:'\0'},{...setup(),note:'x'.repeat(140000)},
  {...setup(),trendEvidence:{...setup().trendEvidence,unsafe:Infinity}},{...setup(),['bad\0key']:1}])await expect(capture(bad)).rejects.toThrow();
});
it('uses existing canonical configuration hashing and binds it to the source profile',async()=>{
 const a=await capture(setup()),b=await capture(setup());expect(a.settingsHash).toBe(b.settingsHash);
 await expect(captureTradeSetupSourceSnapshot({setup:setup(),instrument:'XAUUSD',sourceProfile:profile,
  configuration:{params:{sweepSourceProfile:'legacy'}},canonicalSetupKnownAt:3000,evaluationAsOf:3600})).rejects.toThrow();
});
it('keeps historical source provenance separate from a verified evaluation profile and rejects missing eligible evidence',async()=>{
 const source=setup();delete source.sweepSourceProfile;source.trendEvaluationSourceProfile=profile;
 const restored=restoreTradeSetupSourceSnapshot(await capture(source));
 expect(restored.sweepSourceProfile).toBeUndefined();expect(restored.trendEvaluationSourceProfile).toBe(profile);
 delete source.confirmationSources;await expect(capture(source)).rejects.toThrow();
});
it('keeps the existing H1 coarse bucket plus known native M5 fine touch without waiting for the whole hour',async()=>{
 const level={...pivot,touchedTime:1800,fineTouchedTime:2100,recognizedAt:2400,endTime:1800};
 const source=setup(),sweep={timeframe:'1H',level};
 Object.assign(source,{ls:level,fractal:level,sweeps:[sweep],confirmationSources:[sweep],confirmationHistory:[]});
 source.trendEvidence.goWitness={...sweep,sourceKey:tradeSetupSweepSourceKey(level,'1H'),knownAt:3000,ownerProof:owner()};
 const restored=restoreTradeSetupSourceSnapshot(await capture(source));
 expect(restored.ls.fineTouchedTime).toBe(2100);expect(restored.fractal).toBe(restored.ls);
 source.ls.fineTouchedTime=1700;await expect(capture(source)).rejects.toThrow();
});
it('freezes a fractal touched after the canonical setup time as still open (pin from a later replay)',async()=>{
 const source=setup();source.fractal={price:104,dir:1,pivotTime:1800,touched:true,touchedTime:3300,endTime:3300};
 const payload=await capture(source);
 expect(payload.setup.fractal).toMatchObject({price:104,touched:false,touchedTime:null,endTime:null});
 expect(source.fractal.touched).toBe(true);
 expect(restoreTradeSetupSourceSnapshot(JSON.parse(JSON.stringify(payload))).fractal.endTime).toBe(Infinity);
});
it('accepts the root as LS owner (depth 0, v7 root rule) but no depth-0 nested range',async()=>{
 const source=setup();source.trendEvidence.goWitness.ownerProof={status:'ready',range:owner(),depth:0,knownAt:3000,
  basis:'deepestRangeAtLevelBirth',pivot:{price:100,pivotTime:300}};
 source.ls=pivot;source.sweeps=[sw(pivot)];source.confirmationSources=[sw(pivot)];source.confirmationHistory=[];
 expect((await capture(source)).setup.trendEvidence.goWitness.ownerProof.depth).toBe(0);
 source.trendEvidence.goWitness.ownerProof={...owner(),depth:0};await expect(capture(source)).rejects.toThrow();
});
