import {vi,it,expect} from 'vitest';
const {derived}=vi.hoisted(()=>({derived:{instrument:'XAUUSD',dir:1,obStartTime:0,obTop:110,obBottom:105,
 sourceKind:'liquidity-sweep-existing-m5-ob-retest-v1',sourceKey:'synthetic-ob0-retest1500',
 createdAt:1800,recognizedAt:1800,orderBlockKnownAt:600,sourceRetest:{recognizedAt:1800},
 ls:{dir:1,price:108,pivotTime:300,touchedTime:1500}}}));
vi.mock('../src/sweepRetestSources.js',()=>({SWEEP_RETEST_SOURCE_KIND:'liquidity-sweep-existing-m5-ob-retest-v1',detectSweepRetestSources:()=>[derived]}));
vi.mock('../src/countertrendSnapshotCompletion.js',()=>({markCountertrendCandles:rows=>rows??[]}));
import {assembleSetupSources,setupSourceKey,setupSourceRecognitionTime} from '../src/setupSources.js';
const legacy=createdAt=>({...derived,sourceKind:undefined,sourceKey:undefined,tradeSetupId:'synthetic-legacy',createdAt});
const assemble=rows=>assembleSetupSources({instrument:'XAUUSD',evaluatedAt:1800,tradeSetups:rows,includeSweepRetestSources:true});
const known=rows=>rows.filter(s=>setupSourceRecognitionTime(s)<=1800).map(setupSourceKey);
it('retains an early legacy source and the R2 provenance until known targets prove the same idea',()=>{
 const row=legacy(1800),result=assemble([row]);expect(result).toHaveLength(2);
 const {sourceFamilyKey,sourceFamilyVersion,...original}=result[0];
 expect(original).toEqual(row);expect(sourceFamilyKey).toBeTruthy();expect(setupSourceRecognitionTime(row)).toBe(1800);
});
it('does not let a later recorded legacy source erase an earlier R2 source from full-catalog history',()=>{
 const row=legacy(2400),prefix=known(assemble([])),full=known(assemble([row]));
 expect(setupSourceRecognitionTime(row)).toBe(2400);
 expect(prefix).toHaveLength(1);
 expect(full).toEqual(prefix);
});
