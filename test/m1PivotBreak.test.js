import { describe, it, expect } from 'vitest';
import { deriveM1PivotBreak } from '../src/m1PivotBreak.js';

const candle=(time,low=8,high=12,close=10)=>({time,open:10,low,high,close});
const pivots=[{type:'high',price:15,pivotTime:600,recognizedAt:960},
  {type:'low',price:5,pivotTime:1200,recognizedAt:1560},
  {type:'high',price:12,pivotTime:1800,recognizedAt:2160}];
const input={pivots,direction:'short',structureFrom:600,
  candles:[candle(1860,4,11,8)],evaluatedAt:2160};

describe('causal M1 P5 pivot break',()=>{
  it('accepts a prior wick only when the lower high is confirmed',()=>{
    expect(deriveM1PivotBreak({...input,evaluatedAt:2100})).toBeNull();
    expect(deriveM1PivotBreak(input)).toMatchObject({type:'pivot-break',direction:'short',
      price:5,originTime:600,pivotTime:1200,pullbackTime:1800,candleTime:1860,
      breachKnownAt:1920,recognizedAt:2160});
  });
  it('uses the later breach when P5 is known first',()=>{
    expect(deriveM1PivotBreak({...input,candles:[candle(2220,4)],evaluatedAt:2280}))
      .toMatchObject({candleTime:2220,recognizedAt:2280});
  });
  it('rejects equality, an open breach bar and a break before the pullback origin',()=>{
    expect(deriveM1PivotBreak({...input,candles:[candle(1860,5)]})).toBeNull();
    expect(deriveM1PivotBreak({...input,candles:[candle(2160,4)]})).toBeNull();
    expect(deriveM1PivotBreak({...input,candles:[candle(1740,4)]})).toBeNull();
  });
  it('requires all three known P5 origins at or after the structure start',()=>{
    expect(deriveM1PivotBreak({...input,structureFrom:601})).toBeNull();
    expect(deriveM1PivotBreak({...input,pivots:pivots.map((p,i)=>i===1?{...p,recognizedAt:2220}:p)})).toBeNull();
    expect(deriveM1PivotBreak({...input,pivots:pivots.map((p,i)=>i===2?{...p,price:16}:p)})).toBeNull();
  });
  it('mirrors the decided higher-low wick break for long',()=>{
    const mirrored=pivots.map(p=>({...p,type:p.type==='high'?'low':'high',price:20-p.price}));
    const candles=input.candles.map(c=>({...c,open:20-c.open,close:20-c.close,high:20-c.low,low:20-c.high}));
    expect(deriveM1PivotBreak({...input,pivots:mirrored,candles,direction:'long'}))
      .toMatchObject({direction:'long',price:15,recognizedAt:2160});
    expect(deriveM1PivotBreak({...input,pivots:mirrored,candles:[candle(1860,9,15)],direction:'long'})).toBeNull();
  });
  it('does not invent confirmation times or retain facts on replay rewind',()=>{
    expect(deriveM1PivotBreak({...input,pivots:pivots.map(({recognizedAt,...p})=>p)})).toBeNull();
    for(const evaluatedAt of [2160,2100,2160])expect(deriveM1PivotBreak({...input,evaluatedAt})!==null).toBe(evaluatedAt===2160);
  });
});
