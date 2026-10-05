import { describe,it,expect } from 'vitest';
import { buildM1Structure } from '../src/m1Structure.js';
import { ENTRY_PATTERN_1_VERSION } from '../src/entryPattern1Conditions.js';

const knots=[[0,10],[9,15],[19,5],[29,12],[30,8],[39,9]];
const rows=Array.from({length:40},(_,i)=>{
  const right=knots.findIndex(([j])=>j>=i),[b,y]=knots[right],[a,x]=knots[Math.max(0,right-1)];
  const price=a===b?y:x+(y-x)*(i-a)/(b-a);
  return {time:i*60,open:price,close:price,high:price+.1,low:i===30?4:price-.1};
});
const primary={direction:'short',sweep:{timeframe:'5M',level:{price:15.1,touchedTime:540}}};
const anchor={entryPattern:ENTRY_PATTERN_1_VERSION,primary};
const build=(at,candles=rows,a=anchor)=>buildM1Structure(candles,a,at);

describe('M1 structure from actual sweep',()=>{
  it('confirms a wick without a breaking P5 or a close below the level',()=>{
    expect(build(2040).pivotBreak).toBeNull();
    const result=build(2100);
    expect(result.pivotBreak).toMatchObject({originTime:540,pivotTime:1140,pullbackTime:1740,
      candleTime:1800,breachKnownAt:1860,recognizedAt:2100});
    expect(result.state.trend).toBe('downtrend');
    expect(result.pivotsOuter.every(p=>p.pivotTime>=540)).toBe(true);
    expect(result.state.appliedPivots.every(p=>p.pivotTime>=540)).toBe(true);
    expect(result.pivotsOuter.some(p=>p.pivotTime===1800)).toBe(false);
    expect(build(2040).pivotBreak).toBeNull();
  });
  it('ignores older history beyond the nine usable support bars',()=>{
    const older=Array.from({length:20},(_,i)=>({time:(i-20)*60,open:50,close:50,low:0,high:100}));
    expect(build(2100,[...older,...rows])).toEqual(build(2100));
  });
  it('waits for five usable right bars, including across an ignored minute',()=>{
    const ignored=rows.map((c,i)=>({...c,ignored:i===31}));
    expect(build(2100,ignored).pivotBreak).toBeNull();
    expect(build(2160,ignored).pivotBreak?.recognizedAt).toBe(2160);
  });
  it('mirrors the same initialization and known time for long',()=>{
    const candles=rows.map(c=>({...c,open:20-c.open,close:20-c.close,high:20-c.low,low:20-c.high}));
    const a={...anchor,primary:{direction:'long',sweep:{timeframe:'5M',level:{price:4.9,touchedTime:540}}}};
    const result=build(2100,candles,a);
    expect(result.state.trend).toBe('uptrend');
    expect(result.pivotBreak).toMatchObject({direction:'long',recognizedAt:2100,candleTime:1800});
  });
  it('continues from the wick initialization using later known P5 pivots',()=>{
    const later=Array.from({length:20},(_,i)=>{
      const index=i+40,price=index<=49?9-(index-39)*.7:2+(index-49)*.5;
      return {time:index*60,open:price,close:price,high:price+.1,low:price-.1};
    });
    const result=build(3300,[...rows,...later]);
    expect(result.state.trend).toBe('downtrend');
    expect(result.state.currRange.low).toMatchObject({pivotTime:2940,price:1.9});
    expect(result.state.firstConfirmedAt.recognizedAt).toBe(2100);
    expect(result.pivotBreak.recognizedAt).toBe(2100);
    expect(result.phases.every(p=>p.from>=2100)).toBe(true);
  });
});
