import {describe,it,expect} from 'vitest';
import {entryPattern2OrderBlockPlacement,evaluateEntryPattern2OrderBlockDepth,ENTRY_PATTERN_2_MAX_OB_RETEST_FRACTION} from '../src/entryPattern2OrderBlock.js';

const ob={dir:1,bottom:90,top:100,recognizedAt:60};
const bar=(time,low=96)=>({time,open:101,high:102,low,close:101});
const input={orderBlock:ob,direction:'long',retest:{candleTime:120,recognizedAt:180},entryAt:300,evaluatedAt:300,
  candles:[bar(120),bar(180),bar(240)]};
const mirror=c=>({...c,open:200-c.open,close:200-c.close,high:200-c.low,low:200-c.high});

describe('Pattern 2 OB geometry and retest depth',()=>{
  it('requires the entire zone beyond the LS, strictly and mirrored',()=>{
    const placement=level=>entryPattern2OrderBlockPlacement({orderBlock:ob,level:{price:level,recognizedAt:30},direction:'long',evaluatedAt:180});
    expect(placement(101).status).toBe('passed');
    expect(placement(100).status).toBe('unmet');
    expect(placement(95).status).toBe('unmet');
    expect(entryPattern2OrderBlockPlacement({orderBlock:{...ob,dir:-1,bottom:100,top:110},
      level:{price:99,recognizedAt:30},direction:'short',evaluatedAt:180}).status).toBe('passed');
    expect(entryPattern2OrderBlockPlacement({orderBlock:ob,level:{price:101,recognizedAt:181},direction:'long',evaluatedAt:180}).status).toBe('unknown');
  });
  it('accepts exactly 50% and rejects a later deeper wick including the confirmation candle',()=>{
    expect(ENTRY_PATTERN_2_MAX_OB_RETEST_FRACTION).toBe(.5);
    expect(evaluateEntryPattern2OrderBlockDepth({...input,candles:[bar(120,95),bar(180),bar(240,95)]})).toMatchObject({status:'passed',maxPenetrationFraction:.5});
    expect(evaluateEntryPattern2OrderBlockDepth({...input,candles:[bar(120),bar(180),bar(240,94.999)]})).toMatchObject({status:'unmet',firstBreachTime:240});
    expect(evaluateEntryPattern2OrderBlockDepth({...input,direction:'short',orderBlock:{...ob,dir:-1,bottom:100,top:110},
      candles:[bar(120,95),bar(180),bar(240,94)].map(mirror)})).toMatchObject({status:'unmet',firstBreachTime:240});
  });
  it('excludes the candle opening at entry and any still open candle',()=>{
    expect(evaluateEntryPattern2OrderBlockDepth({...input,candles:[...input.candles,bar(300,1)]}).status).toBe('passed');
    expect(evaluateEntryPattern2OrderBlockDepth({...input,evaluatedAt:299}).status).toBe('unknown');
  });
  it('does not turn a missing, ignored, malformed or duplicate minute into a pass',()=>{
    for(const candles of [[bar(120),bar(240)],[bar(120),{...bar(180),ignored:true},bar(240)],
      [bar(120),{...bar(180),low:NaN},bar(240)],[bar(120),bar(180),bar(180),bar(240)]])
      expect(evaluateEntryPattern2OrderBlockDepth({...input,candles}).status).toBe('unknown');
    expect(evaluateEntryPattern2OrderBlockDepth({...input,candles:[bar(120),bar(240,94)]}).status).toBe('unmet');
  });
  it('requires a known OB and a closed first touch in the declared direction',()=>{
    expect(evaluateEntryPattern2OrderBlockDepth({...input,orderBlock:{...ob,recognizedAt:121}}).status).toBe('unknown');
    expect(evaluateEntryPattern2OrderBlockDepth({...input,candles:[bar(120,101),bar(180),bar(240)]}).status).toBe('unknown');
    expect(evaluateEntryPattern2OrderBlockDepth({...input,direction:'short'}).status).toBe('unknown');
  });
});
