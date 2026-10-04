import { describe, it, expect } from 'vitest';
import { deriveM1SweepReaction, m1SweepBoundary } from '../src/m1SweepReaction.js';
import candles97 from './fixtures/gbpusd-m1-entry-model1-97.json';
import candles105 from './fixtures/gbpusd-m1-entry-model1-105.json';

describe('M1 reaction belonging to the setup sweep', () => {
  it('uses the actual swept candle extreme rather than an unrelated OB edge',()=>{
    const primary={direction:'short',invalidation:1.36,sweep:{level:{touchedTime:1789538400}}};
    expect(m1SweepBoundary(primary,candles97).sweepTime).toBe(1789538400);
    expect(m1SweepBoundary(primary,candles97).sweepPrice).toBeCloseTo(1.3498,10);
    expect(m1SweepBoundary(primary,candles97.filter(c=>c.time!==1789538400))).toBeNull();
  });
  it.each([
    [candles97, 1789530000, 1789538400, 1.3498, 1789544040, 1.34781, 1789540380],
    [candles105, 1790234100, 1790236200, 1.32556, 1790238960, 1.32446, 1790237820],
  ])('retains the closed sweep CHoCH through nested recovery and unknown structure',
    (candles, pivotTime, sweepTime, sweepPrice, evaluatedAt, price, recognizedAt) => {
      const input = { candles, anchor: { pivotTime }, direction: 'short', sweepTime, sweepPrice, evaluatedAt };
      expect(deriveM1SweepReaction(input)).toMatchObject({
        direction: 'short', choch: { type: 'CHoCH', direction: 'short', price, recognizedAt },
      });
      expect(deriveM1SweepReaction({ ...input, evaluatedAt: recognizedAt - 1 }).choch).toBeNull();
    });
  it('ignores wicks and equal closes, but retains a strict close invalidation through a later recovery', () => {
    const input={candles:candles97.filter(c=>c.time+60<=1789544040),anchor:{pivotTime:1789530000},
      direction:'short',sweepTime:1789538400,sweepPrice:1.3498,evaluatedAt:1789544280};
    const candle=(time,close)=>({time,open:1.3497,high:1.3500,low:1.3495,close});
    const safe=[...input.candles,candle(1789544040,1.3498)];
    expect(deriveM1SweepReaction({...input,candles:safe}).active).toBe(true);
    const broken=[...safe,candle(1789544100,1.34981),candle(1789544160,1.3497)];
    expect(deriveM1SweepReaction({...input,candles:broken})).toMatchObject({active:false,invalidatedAt:1789544160});
  });
  it('mirrors the anchored CHoCH and close boundary for long', () => {
    const candles=candles97.map(c=>({...c,open:3-c.open,close:3-c.close,high:3-c.low,low:3-c.high}));
    const result=deriveM1SweepReaction({candles,anchor:{pivotTime:1789530000},direction:'long',
      sweepTime:1789538400,sweepPrice:3-1.3498,evaluatedAt:1789544040});
    expect(result.active).toBe(true);
    expect(result.choch.direction).toBe('long');
    expect(result.choch.recognizedAt).toBe(1789540380);
  });
  it('keeps cached evaluation equivalent through jumps, invalidation and rewind', () => {
    const input={candles:candles97,anchor:{pivotTime:1789530000},direction:'short',
      sweepTime:1789538400,sweepPrice:1.3498},progress={};
    for(const evaluatedAt of [1789539000,1789540200,1789544040,1789545180,1789539600,1789544040]) {
      expect(deriveM1SweepReaction({...input,evaluatedAt,progress})).toEqual(deriveM1SweepReaction({...input,evaluatedAt}));
    }
  });
});
