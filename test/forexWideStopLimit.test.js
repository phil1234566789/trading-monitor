import { expect, it } from 'vitest';
import { entryRiskScale } from '../src/entryRisk.js';
import { sizeSimulation, evaluateSimulation } from '../src/tradeSetupSimulation.js';
import { tradeSetup2Positions } from '../src/tradeSetup2Positions.js';
import { m1EntryFromFvg, entryChecklist } from '../src/m1Entry.js';
const version = 'countertrend-entry-model-1-v8';
const make = (instrument, direction, pips) => ({ id: 't64', instrument, direction, entryPattern: version,
  price: 1.35, recognizedAt: 120, stops: { wide: { price: 1.35 + (direction === 'short' ? 1 : -1) * pips * .0001 },
    narrow: { price: 1.35 + (direction === 'short' ? 1 : -1) * .00028 } } });
it.each(['GBPUSD', 'EURUSD'].flatMap(instrument => ['long', 'short'].flatMap(direction =>
  [5.9, 6, 6.00001, 6.1].map(pips => [instrument, direction, pips]))))('wide boundary %s %s %s', (instrument, direction, pips) => {
  const entry = make(instrument, direction, pips), before = JSON.stringify(entry);
  const result = sizeSimulation(entry, 'wide');
  expect(result.status).toBe(pips <= 6 ? 'ready' : 'notExecutable');
  if (pips > 6) expect(result).toMatchObject({ reason: 'wideStopTooLarge', stopPrice: entry.stops.wide.price, lots: 0 });
  expect(sizeSimulation(entry, 'narrow').status).toBe('ready');
  expect(JSON.stringify(entry)).toBe(before);
});
it('narrow simulation and both-mode positions survive a blocked wide variant', () => {
  const entry = make('GBPUSD', 'long', 7);
  const results = ['wide', 'narrow'].map(variant => ({ instrument: entry.instrument, direction: entry.direction,
    ...evaluateSimulation({ entry, variant, target1: 1.351, target2: 1.352,
      candles: [{ time: 120, low: 1.3501, high: 1.3502 }], evaluatedAt: 180 }) }));
  expect(results[0]).toMatchObject({ status: 'notExecutable', reason: 'wideStopTooLarge' });
  expect(results[1].status).toBe('open');
  expect(tradeSetup2Positions(results, { instrument: 'GBPUSD', variant: 'both', asOf: 180 }).map(r => r.variant)).toEqual(['narrow']);
});
it('new entry shows the original blocked wide SL and the unchanged narrow SL', () => {
  const context = { instrument: 'EURUSD', direction: 'long', entryPattern: version, setupKey: 'dr',
    primary: { reactionOB: { bottom: 1.3493, top: 1.35, startTime: 0 } } };
  const retest = { candleTime: 0, orderBlock: context.primary.reactionOB };
  const entry = m1EntryFromFvg(context, { candleTime: 60, recognizedAt: 180 },
    [{ time: 0, low: 1.34972, high: 1.35 }, { time: 120, low: 1.3498, high: 1.35, close: 1.35 }], 180, retest);
  expect(entry.stops.wide.price).toBe(1.3493);
  expect(entry.scales.wide).toMatchObject({ status: 'notExecutable', reason: 'wideStopTooLarge', stop: 1.3493 });
  expect(entry.scales.narrow.status).toBe('ready');
  expect(entryChecklist({ entry }).details.join(' ')).toContain('Weiter SL über 6 Pips');
});
it('historical entries and non-Forex risk scales retain their existing rules', () => {
  const entry = make('GBPUSD', 'long', 7);
  expect(sizeSimulation({ ...entry, entryPattern: 'countertrend-entry-model-1-v7' }, 'wide').status).toBe('ready');
  const { entryPattern, ...legacy } = entry;
  expect(sizeSimulation(legacy, 'wide').status).toBe('ready');
  expect(entryRiskScale(2300, 2293, [], 'XAUUSD', 'long', { variant: 'wide', entryPattern: version }).status).toBe('ready');
});

it.each(['GBPUSD', 'EURUSD'])('does not cap narrow SLs even above 6 pips (%s)', instrument => {
  const entry = make(instrument, 'long', 7);
  entry.stops.narrow.price = 1.349;
  expect(sizeSimulation(entry, 'narrow').status).toBe('ready');
  expect(entryRiskScale(entry.price, entry.stops.narrow.price, [], instrument, 'long',
    { variant: 'narrow', entryPattern: version })).toMatchObject({ status: 'ready', stop: 1.349 });
});
