import { describe, it, expect } from 'vitest';
import { sizeSimulation, evaluateSimulation } from '../src/tradeSetupSimulation.js';

const entry = { id: 'e', instrument: 'GBPUSD', direction: 'long', price: 1.35, recognizedAt: 120,
  stops: { wide: { price: 1.3494 }, narrow: { price: 1.34967 } } };
const bar = (time, low, high) => ({ time, open: 1.35, low, high, close: 1.35 });
const run = (candles, extra = {}) => evaluateSimulation({ entry, variant: 'wide', target1: 1.351,
  target2: 1.352, candles, evaluatedAt: 120 + candles.filter(c => c.time >= 120).length * 60, ...extra });

describe('fixed-budget whole-lot simulation', () => {
  it('floors initial lots and halves the actual volume', () => {
    expect(sizeSimulation(entry, 'wide')).toMatchObject({ lots: 8, t1Lots: 4, actualRisk: 480, riskBudget: 500 });
    expect(sizeSimulation(entry, 'narrow')).toMatchObject({ lots: 15, t1Lots: 7.5, actualRisk: 495 });
  });
  it('does not invent a lot or apply FX sizing to gold', () => {
    expect(sizeSimulation({ ...entry, stops: { wide: { price: 1.34 } } }, 'wide').status).toBe('notExecutable');
    expect(sizeSimulation({ ...entry, instrument: 'XAUUSD' }, 'wide').status).toBe('notExecutable');
  });
  it('excludes the entry candle and future incomplete candles', () => {
    expect(run([bar(60, 1.34, 1.36), bar(120, 1.3498, 1.3502)], { evaluatedAt: 179 }).status).toBe('open');
  });
  it('loses actual risk before T1', () => {
    expect(run([bar(120, 1.3493, 1.3502)])).toMatchObject({ status: 'closed', outcome: 'slBeforeT1', pnlUsd: -480, rMultiple: -1, exitTime: 120, exitRecognizedAt: 180 });
  });
  it('retains positive T1 profit after break-even', () => {
    expect(run([bar(120, 1.3501, 1.3511), bar(180, 1.3499, 1.3511)])).toMatchObject({ status: 'closed', outcome: 't1Be', pnlUsd: 400, realizedPnlUsd: 400 });
  });
  it('keeps known partial profit while rest is open without T2', () => {
    expect(run([bar(120, 1.3501, 1.3511)], { target2: null })).toMatchObject({ status: 'open', pnlUsd: null, realizedPnlUsd: 400 });
  });
  it('takes both halves at their respective targets', () => {
    expect(run([bar(120, 1.3501, 1.3521)])).toMatchObject({ status: 'closed', outcome: 't2', pnlUsd: 1200 });
  });
  it('does not choose favorable intrabar ordering', () => {
    expect(run([bar(120, 1.3493, 1.3511)])).toMatchObject({ status: 'ambiguous', reason: 'sameCandle', pnlUsd: null });
    expect(run([bar(120, 1.3499, 1.3511)])).toMatchObject({ status: 'ambiguous', reason: 'sameCandle' });
  });
  it('preserves uncertainty across missing minutes', () => {
    expect(run([bar(180, 1.3501, 1.3521)], { evaluatedAt: 600 })).toMatchObject({ status: 'ambiguous', reason: 'missingHistory', ambiguityRecognizedAt: 180 });
    expect(run([], { evaluatedAt: 180 })).toMatchObject({ status: 'ambiguous', reason: 'missingHistory' });
  });
  it('records when a same-minute conflict actually became known', () => {
    expect(run([bar(120, 1.3501, 1.3502), bar(180, 1.3493, 1.3511)], { evaluatedAt: 600 }))
      .toMatchObject({ status: 'ambiguous', ambiguityRecognizedAt: 240, evaluatedAt: 600 });
  });
  it('dates missing history after explicitly evidenced closures', () => {
    const closedIntervals = [{ from: 180, to: 240 }, { from: 240, to: 300 }];
    const candles = [bar(120, 1.3501, 1.3502), bar(360, 1.3501, 1.3502)];
    expect(run(candles, { closedIntervals, evaluatedAt: 240 }).status).toBe('open');
    expect(run(candles, { closedIntervals, evaluatedAt: 359 }).status).toBe('open');
    expect(run(candles, { closedIntervals, evaluatedAt: 360 }))
      .toMatchObject({ status: 'ambiguous', ambiguityRecognizedAt: 360 });
    expect(run(candles, { closedIntervals, evaluatedAt: 600 }))
      .toMatchObject({ status: 'ambiguous', ambiguityRecognizedAt: 360 });
  });
  it('supports short trades with the same profit logic', () => {
    const short = { ...entry, direction: 'short', stops: { wide: { price: 1.3506 } } };
    expect(run([bar(120, 1.3479, 1.3499)], { entry: short, target1: 1.349, target2: 1.348 })).toMatchObject({ outcome: 't2', pnlUsd: 1200 });
  });
});
