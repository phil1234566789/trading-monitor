import { assumeFixtureH1Direction } from './helpers/fixtureH1Direction.js';
assumeFixtureH1Direction();
import { describe, expect, it } from 'vitest';
import { buildM1Structure, activeM1Context } from '../src/m1Structure.js';
import { evaluateM1Checklist } from '../src/m1Checklist.js';
import { evaluateTradeSetupChecklist } from '../src/tradeSetupChecklist.js';
import { latestStructureSweeps, structureSweepPivots } from '../src/structureSweeps.js';
import m1 from './fixtures/gbpusd-m1-dr114-p5.json';
import tail from './fixtures/gbpusd-m1-dr114-sweep-tail.json';
import h1 from './fixtures/gbpusd-h1-dr114-lifecycle.json';
import m5 from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import m5tail from './fixtures/gbpusd-m5-dr114-sweep-tail.json';
import config from './fixtures/gbpusd-m5-dr114-session-targets.json';

// Native FXCM-Bid-Fortsetzung vom 09.09.2026, am 29.09.2026 aus dem Archiv gelesen.
const candles = [...m1, ...tail];
const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
const anchor = { pivotTime: at('08:45'), price: 1.35554, recognizedAt: at('09:30') };
const context = { instrument:'GBPUSD', direction:'short', anchor, primary:{ reactionRecognizedAt:at('09:30'),
  reactionOB:{ dir:-1, top:1.35675, bottom:1.35641, startTime:at('09:20') } } };
const evaluate = (clock, rows = candles, ctx = context) => {
  const evaluatedAt = at(clock), structure = buildM1Structure(rows,ctx.anchor,evaluatedAt);
  return { structure, check:evaluateM1Checklist({ context:ctx, structure, candles:rows, evaluatedAt }) };
};

describe('M1 internal liquidity sweep in checklist I', () => {
  it('uses the same P5 classification as the chart and the touch candle, never the origin', () => {
    const { structure, check } = evaluate('11:28');
    expect(structure.pivotsInner).toEqual([]);
    const pivot = structureSweepPivots(structure.state).find(p => p.price === 1.35476);
    expect(pivot.pivotTime).toBe(at('10:34'));
    expect(pivot.touched.touchedTime).toBe(at('11:27'));
    expect(check.internalSweeps).toEqual([{price:1.35476,pivotTime:at('10:34'),candleTime:at('11:27')}]);
    expect(check.details.at(-1)).toBe('M1 interner LQ Sweep 1.35476 um 11:27');
    expect(check.detailStatuses.at(-1)).toBe('passed');
    expect(check.status).toBe('pending');
  });
  it('requires the closed touch candle and restores the same result after rewind', () => {
    expect(evaluate('11:27').check.internalSweeps).toEqual([]);
    const confirmed = evaluate('11:28').check;
    expect(evaluate('11:30').check.internalSweeps).toEqual(confirmed.internalSweeps);
    expect(evaluate('11:27').check.details.some(d => d.startsWith('M1 interner LQ Sweep'))).toBe(false);
    expect(evaluate('11:28').check).toEqual(confirmed);
  });
  it('respects the unchanged active setup and M5 anchor at this time', () => {
    const evaluatedAt = at('11:28');
    const checklist = evaluateTradeSetupChecklist({ instrument:'GBPUSD', evaluatedAt, h1Candles:h1.candles,
      m5Candles:[...m5,...m5tail], sessionConfigs:config.sessions,
      settings:{ rangesFixedStartActive:true, rangesFixedStartTime:h1.cutoff } });
    expect(checklist.setup.primary.validity.state).toBe('active');
    const actual = activeM1Context(checklist);
    expect(actual.anchor.pivotTime).toBe(anchor.pivotTime);
    expect(evaluate('11:28',candles,actual).check.internalSweeps[0].price).toBe(1.35476);
  });
  it('uses the same sweep logic for the mirrored long structure', () => {
    const rows = candles.map(c => ({...c,open:3-c.open,close:3-c.close,high:3-c.low,low:3-c.high}));
    const long = {...context,direction:'long',anchor:{...anchor,price:3-anchor.price},primary:{}};
    const result = evaluate('11:28',rows,long).check;
    expect(result.internalSweeps[0].price).toBeCloseTo(1.64524);
    expect(result.details.at(-1)).toBe('M1 interner LQ Sweep 1.64524 um 11:27');
  });
  it('keeps only current sweeps on the newest touch candle, deduplicating nested copies', () => {
    const pivot = (price,time,type='LQ-sweep') => ({price,pivotTime:1,type,touched:{touchedTime:time}});
    const state = {structurePivots:[pivot(1,60),pivot(2,120),pivot(3,120,'break-of-structure'),pivot(4,180)],
      nestedTrend:{structurePivots:[pivot(2,120),pivot(5,120)]}};
    expect(latestStructureSweeps(state,180,60).map(s=>s.price)).toEqual([2,5]);
  });
});
