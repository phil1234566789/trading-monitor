import { describe, expect, it } from 'vitest';
import { entrySizingAt, ENTRY_SIZING_VERSION, entrySizingLabel } from '../src/tradeSetup2EntrySizing.js';
import { sizeSimulation, evaluateSimulation } from '../src/tradeSetupSimulation.js';
import { buildTradeSetup2Snapshot, restoreTradeSetup2Snapshot } from '../src/tradeSetup2Snapshot.js';
import { buildTradeSetup2Configuration } from '../src/tradeSetup2Configuration.js';

const entryAt = direction => ({ id: 'entry', setupKey: 'setup', instrument: 'GBPUSD', direction,
  recognizedAt: 600, price: 1.35, stops: { wide: { price: direction === 'long' ? 1.34967 : 1.35033 } } });
const checklistAt = (direction, recognizedAt) => ({ status: 'ready', instrument: 'GBPUSD', evaluatedAt: 600,
  direction, setup: { primary: { id: 'setup', direction, reactionRecognizedAt: 300,
    checks: { liquiditySweep: { status: 'passed' }, reaction: { status: 'passed' } },
    targetSelection: { status: 'passed', selectedAt: 300, target1: { price: 1.36 } } } },
  checks: { h1Trend: { status: 'passed' }, time: { status: 'passed' },
    m5Trend: { structureReaction: { direction, choch: recognizedAt == null ? null : { type: 'CHoCH', direction, recognizedAt, candleTime: recognizedAt - 300 } } } } });

describe.each(['long', 'short'])('M5-CHoCH sizing for %s', direction => {
  it('uses only a same-direction CHoCH known at the entry close, never BOS or later evidence', () => {
    const entry = entryAt(direction);
    expect(entrySizingAt(checklistAt(direction, 600), entry).factor).toBe(1);
    expect(entrySizingAt(checklistAt(direction, 300), entry).factor).toBe(1);
    for (const time of [null, 601]) expect(entrySizingAt(checklistAt(direction, time), entry).factor).toBe(0.5);
    const checklist = checklistAt(direction, 600);
    checklist.checks.m5Trend.structureReaction.choch.direction = direction === 'long' ? 'short' : 'long';
    expect(entrySizingAt(checklist, entry).factor).toBe(0.5);
    checklist.checks.m5Trend.structureReaction = { direction, bos: { type: 'BOS', direction, recognizedAt: 300 } };
    expect(entrySizingAt(checklist, entry).factor).toBe(0.5);
  });
  it('freezes factor and causal evidence in both entry representations without changing the source', () => {
    const entry = entryAt(direction), checklist = checklistAt(direction, 600);
    const snapshot = buildTradeSetup2Snapshot({ checklist, m1Check: { entry, evaluatedAt: 600 } });
    expect(snapshot.schemaVersion).toBe(3);
    expect(snapshot.entry.sizing).toMatchObject({ version: ENTRY_SIZING_VERSION, factor: 1, evaluatedAt: 600, reason: 'm5ChochConfirmed' });
    expect(snapshot.m1Check.entry.sizing).toEqual(snapshot.entry.sizing);
    expect(entry.sizing).toBeUndefined();
    checklist.checks.m5Trend.structureReaction.choch.recognizedAt = 900;
    expect(snapshot.entry.sizing.choch.recognizedAt).toBe(600);
    expect(buildTradeSetup2Snapshot({ checklist, m1Check: { entry, evaluatedAt: 600 } }).entry.sizing.factor).toBe(0.5);
  });
  it('reduces the budget before rounding lots and calculates partial profit and commission from actual volume', () => {
    const entry = entryAt(direction);
    entry.sizing = entrySizingAt(checklistAt(direction, null), entry);
    expect(sizeSimulation(entry, 'wide')).toMatchObject({ riskBudget: 250, lots: 7, t1Lots: 3.5, actualRisk: 231 });
    const sign = direction === 'long' ? 1 : -1;
    const reflect = value => direction === 'long' ? value : 2.7 - value;
    const candles = [{ time: 600, low: reflect(direction === 'long' ? 1.3501 : 1.3511), high: reflect(direction === 'long' ? 1.3511 : 1.3501) },
      { time: 660, low: reflect(direction === 'long' ? 1.3499 : 1.3502), high: reflect(direction === 'long' ? 1.3502 : 1.3499) }];
    const result = evaluateSimulation({ entry, variant: 'wide', candles, evaluatedAt: 720, target1: 1.35 + sign * .001, target2: 1.35 + sign * .002 });
    expect(result).toMatchObject({ outcome: 't1Be', pnlUsd: 350, commissionUsd: 35, netPnlUsd: 315, lots: 7, t1Lots: 3.5 });
    expect(result.rMultiple).toBeCloseTo(350 / 231);
    expect(result.netRMultiple).toBeCloseTo(315 / 231);
    const t2 = evaluateSimulation({ entry, variant: 'wide', candles: [{ time: 600,
      low: direction === 'long' ? 1.3501 : 1.3479, high: direction === 'long' ? 1.3521 : 1.3499 }],
      evaluatedAt: 660, target1: 1.35 + sign * .001, target2: 1.35 + sign * .002 });
    expect(t2).toMatchObject({ outcome: 't2', pnlUsd: 1050, commissionUsd: 35, netPnlUsd: 1015 });
    const stop = evaluateSimulation({ entry, variant: 'wide', candles: [{ time: 600, low: 1.3496, high: 1.3504 }], evaluatedAt: 660, target1: 1.35 + sign * .001 });
    expect(stop).toMatchObject({ outcome: 'slBeforeT1', pnlUsd: -231, commissionUsd: 35, netPnlUsd: -266 });
    entry.sizing = entrySizingAt(checklistAt(direction, 600), entry);
    expect(sizeSimulation(entry, 'wide')).toMatchObject({ riskBudget: 500, lots: 15, t1Lots: 7.5, actualRisk: 495 });
  });
  it('keeps the known F time block for both size variants', () => {
    for (const time of [null, 600]) {
      const checklist = checklistAt(direction, time); checklist.checks.time.status = 'blocked';
      expect(buildTradeSetup2Snapshot({ checklist, m1Check: { entry: entryAt(direction), evaluatedAt: 600 } })).toBeNull();
      checklist.checks.time.status = 'unknown';
      expect(buildTradeSetup2Snapshot({ checklist, m1Check: { entry: entryAt(direction), evaluatedAt: 600 } })).not.toBeNull();
    }
  });
});

it('preserves old snapshots and budgets, versions new run configurations and rejects malformed new sizing', () => {
  const entry = entryAt('long');
  const old = { schemaVersion: 1, instrument: 'GBPUSD', entry };
  const restored = restoreTradeSetup2Snapshot(old);
  expect(restored.entry).toEqual(entry);
  expect(restored.entry.sizing).toBeUndefined();
  expect(sizeSimulation(restored.entry, 'wide')).toMatchObject({ riskBudget: 500, lots: 15, actualRisk: 495 });
  expect(entrySizingLabel(restored.entry.sizing)).toContain('Historischer Stand');
  expect(buildTradeSetup2Configuration({ instrument: 'GBPUSD' }).entrySizingVersion).toBe(ENTRY_SIZING_VERSION);
  expect(sizeSimulation({ ...entry, sizing: { factor: .5 } }, 'wide')).toMatchObject({ status: 'notExecutable', reason: 'invalidSizing' });
  const wide = { ...entry, stops: { wide: { price: 1.347 } }, sizing: entrySizingAt(checklistAt('long', null), entry) };
  expect(sizeSimulation(wide, 'wide')).toMatchObject({ riskBudget: 250, status: 'notExecutable', reason: 'belowOneLot' });
});
