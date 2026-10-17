import {it,expect} from 'vitest';
import {evaluateSimulation} from '../src/tradeSetupSimulation.js';
import {evaluateJointLossRisk} from '../src/dealingRangeRisk.js';
import original from './fixtures/gbpusd-2970-wide-loss.json';
const at=s=>Date.parse(`2026-08-18T${s}:00+02:00`)/1000;
const simulate=horizon=>original.entries.flatMap(({entry})=>['wide','narrow'].map(variant=>evaluateSimulation({entry,variant,
 candles:original.candles,evaluatedAt:horizon,target1:entry.scales[variant].targets[0].price,target2:entry.scales[variant].targets[1].price})));
it('reproduces original DR2970 wide exits at 21:59 without replacing the ambiguous narrow outcome',()=>{
 const rows=simulate(at('23:03'));
 for(const expected of original.entries.flatMap(r=>r.outcomes)){
  const actual=rows.find(r=>r.entryId===expected.entryId&&r.variant===expected.variant);
  for(const key of ['status','outcome','pnlUsd','exitTime','exitRecognizedAt','ambiguityRecognizedAt'])expect(actual[key]).toEqual(expected[key]);
 }
 for(const index of [2,3])expect(rows[index*2].exitRecognizedAt).toBe(at('21:59'));
 expect(rows[5]).toMatchObject({status:'ambiguous',outcome:null,ambiguityRecognizedAt:at('23:02')});
 expect(original.entries[2].entry.scales.narrow.riskPips).toBeCloseTo(9.7);
 expect(original.entries[2].entry.scales.wide.riskPips).toBeCloseTo(6);
});
it('counts the confirmed wide loss before the later ambiguous narrow finalization, never before its real close',()=>{
 const before=JSON.stringify(original),rows=simulate(at('21:59'));
 expect(rows[5].status).toBe('open');
 expect(evaluateJointLossRisk(simulate(at('17:18')),at('17:18'))).toBeNull();
 expect(evaluateJointLossRisk(simulate(at('21:58')),at('21:58'))).toBeNull();
 expect(evaluateJointLossRisk(rows,at('21:59'))).toMatchObject({recognizedAt:at('21:59'),entryIds:original.entries.slice(2,4).map(r=>r.entry.id)});
 expect(JSON.stringify(original)).toBe(before);
});
