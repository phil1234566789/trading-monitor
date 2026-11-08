import {describe,it,expect} from 'vitest';
import {selectRelativeM5SweepRanges} from '../src/relativeM5SweepRanges.js';
const pivot=(price,pivotTime)=>({price,pivotTime,type:'high',touched:false});
const level=pivot(4037.84,1000),origin=pivot(4015.42,900);
const incoming={trend:'unknown',currRange:{low:origin,high:level},appliedPivots:[origin,level],structurePivots:[]};
const owner={trend:'downtrend',currRange:{low:origin,high:pivot(4082.22,100)},
  appliedPivots:[],structurePivots:[level],nestedTrend:incoming};
const root={trend:'downtrend',currRange:{low:pivot(3975.48,50),high:pivot(4199.03,10)},
  structurePivots:[level],appliedPivots:[],nestedTrend:{trend:'uptrend',currRange:{low:pivot(3975.48,50),high:pivot(4082.22,100)},
    structurePivots:[level],appliedPivots:[],nestedTrend:owner}};
const source={ls:{...level,dir:1,touched:true,touchedTime:1800,recognizedAt:1500},recognizedAt:2100};
const choch={type:'CHoCH',direction:'long',originTime:900,pivotTime:1000,price:4037.84,candleTime:1800,recognizedAt:2100};
const input={source,state:root,stateKnownAt:2100,evaluatedAt:2100,reaction:{levels:[choch]}};
describe('source-owned relative M5 ranges',()=>{
  it('selects the owning surrounding range and the existing causal incoming reaction, not the D1 root',()=>{
    const result=selectRelativeM5SweepRanges(input);
    expect(result).toMatchObject({status:'ready',outer:{trend:'downtrend',depth:2},inner:{trend:'uptrend',depth:3,
      knownAt:2100,basis:'existingCloseReactionChoch'}});
    expect(result.outer.range.high.price).toBe(4082.22);
    expect(result.inner.range.low.price).toBe(4015.42);
  });
  it('uses source ownership rather than a fixed depth',()=>{
    expect(selectRelativeM5SweepRanges({...input,state:owner})).toMatchObject({status:'ready',outer:{depth:0},inner:{depth:1}});
  });
  it('keeps missing, mismatched and future knowledge unknown',()=>{
    expect(selectRelativeM5SweepRanges({...input,reaction:{levels:[]}}).status).toBe('unknown');
    expect(selectRelativeM5SweepRanges({...input,stateKnownAt:2400}).status).toBe('unknown');
    expect(selectRelativeM5SweepRanges({...input,reaction:{levels:[{...choch,recognizedAt:2400}]}}).status).toBe('unknown');
    expect(selectRelativeM5SweepRanges({...input,source:{...source,ls:{...source.ls,pivotTime:999}}}).status).toBe('unknown');
    expect(selectRelativeM5SweepRanges({...input,source:{...source,ls:{...source.ls,recognizedAt:2400}}}).status).toBe('unknown');
  });
  it('does not force a countertrend direction when the owning range disagrees',()=>{
    const changed={...root.nestedTrend,nestedTrend:{...owner,structurePivots:[]}};
    expect(selectRelativeM5SweepRanges({...input,state:changed})).toMatchObject({status:'ready',outer:{trend:'uptrend'},inner:{trend:'uptrend'}});
  });
  it('rejects a confirmed range entirely beyond the source level instead of pretending it leads to the sweep',()=>{
    const low=pivot(4040,900),high=pivot(4045,1200);
    const state={...owner,nestedTrend:{...incoming,trend:'uptrend',currRange:{low,high}}};
    expect(selectRelativeM5SweepRanges({...input,state})).toMatchObject({status:'unknown',reason:'incomingDirectionNotToSweep'});
  });
  it('freezes classification at sweep close even when the OB retest is known later',()=>{
    const later={...source,recognizedAt:3000};
    expect(selectRelativeM5SweepRanges({...input,source:later,evaluatedAt:3000})).toMatchObject({status:'ready',inner:{knownAt:2100}});
    expect(selectRelativeM5SweepRanges({...input,source:later,evaluatedAt:3000,stateKnownAt:3000}).status).toBe('unknown');
  });
});
