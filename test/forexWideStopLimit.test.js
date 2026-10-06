import { expect, it } from 'vitest';
import { entryRiskScale } from '../src/entryRisk.js';
import { sizeSimulation, evaluateSimulation } from '../src/tradeSetupSimulation.js';
import { tradeSetup2Positions } from '../src/tradeSetup2Positions.js';
import { m1EntryFromFvg, entryChecklist } from '../src/m1Entry.js';
const version = 'countertrend-entry-model-1-v9';
const make = (instrument, direction, pips) => ({ id: 't64', instrument, direction, entryPattern: version,
  price: 1.35, recognizedAt: 120, stops: { wide: { price: 1.35 + (direction === 'short' ? 1 : -1) * pips * .0001 },
    narrow: { price: 1.35 + (direction === 'short' ? 1 : -1) * .00028 } } });
it.each(['GBPUSD', 'EURUSD'].flatMap(instrument => ['long', 'short'].flatMap(direction =>
  [5.9, 6, 6.00001, 6.1].map(pips => [instrument, direction, pips]))))('wide boundary %s %s %s', (instrument, direction, pips) => {
  const entry = make(instrument, direction, pips), before = JSON.stringify(entry);
  const result = sizeSimulation(entry, 'wide');
  expect(result.status).toBe('ready');
  if(pips<=6)expect(result.stopPrice).toBe(entry.stops.wide.price);
  expect(result.stopPrice).toBeCloseTo(entry.price + (direction === 'short' ? 1 : -1) * Math.min(pips, 6) * .0001, 12);
  expect(result.actualRisk).toBeCloseTo(result.lots * Math.min(pips, 6) * 10);
  expect(sizeSimulation(entry, 'narrow').status).toBe('ready');
  expect(JSON.stringify(entry)).toBe(before);
});
it('both variants remain executable with a capped wide stop', () => {
  const entry = make('GBPUSD', 'long', 7);
  const results = ['wide', 'narrow'].map(variant => ({ instrument: entry.instrument, direction: entry.direction,
    ...evaluateSimulation({ entry, variant, target1: 1.351, target2: 1.352,
      candles: [{ time: 120, low: 1.3501, high: 1.3502 }], evaluatedAt: 180 }) }));
  expect(results[0]).toMatchObject({ status: 'open', lots: 8, actualRisk: 480 });
  expect(results[1].status).toBe('open');
  expect(tradeSetup2Positions(results, { instrument: 'GBPUSD', variant: 'both', asOf: 180 }).map(r => r.variant)).toEqual(['wide', 'narrow']);
});
it('new entry stores the capped wide SL and the unchanged narrow SL', () => {
  const context = { instrument: 'EURUSD', direction: 'long', entryPattern: version, setupKey: 'dr',
    primary: { reactionOB: { bottom: 1.3493, top: 1.35, startTime: 0 } } };
  const retest = { candleTime: 0, orderBlock: context.primary.reactionOB };
  const entry = m1EntryFromFvg(context, { candleTime: 60, recognizedAt: 180 },
    [{ time: 0, low: 1.34972, high: 1.35 }, { time: 120, low: 1.3498, high: 1.35, close: 1.35 }], 180, retest);
  expect(entry.stops.wide.price).toBeCloseTo(1.3494, 12);
  expect(entry.stops.wide.structuralPrice).toBe(1.3493);
  expect(entry.scales.wide.status).toBe('ready');
  expect(entry.scales.wide.stop).toBeCloseTo(entry.stops.wide.price, 12);
  expect(entry.scales.wide.riskPips).toBeCloseTo(6);
  expect(entry.scales.narrow.status).toBe('ready');
  expect(entryChecklist({ entry }).details.join(' ')).toContain('Weiter SL: 6,0 Pips');
});
it('historical entries and non-Forex risk scales retain their existing rules', () => {
  const entry = make('GBPUSD', 'long', 7);
  expect(sizeSimulation({ ...entry, entryPattern: 'countertrend-entry-model-1-v7' }, 'wide').status).toBe('ready');
  expect(sizeSimulation({ ...entry, entryPattern: 'countertrend-entry-model-1-v8' }, 'wide')).toMatchObject({status:'notExecutable',reason:'wideStopTooLarge',stopPrice:entry.stops.wide.price});
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

it.each(['long','short'])('simulation exits at capped wide stop (%s)', direction => {
  const entry=make('GBPUSD',direction,13.6),sign=direction==='long'?1:-1;
  const stop=entry.price-sign*.0006;
  const result=evaluateSimulation({entry,variant:'wide',target1:entry.price+sign*.001,
    candles:[{time:120,low:Math.min(entry.price,stop)-.00001,high:Math.max(entry.price,stop)+.00001}],evaluatedAt:180});
  expect(result).toMatchObject({status:'closed',outcome:'slBeforeT1',lots:8,actualRisk:480});
  expect(result.stopPrice).toBeCloseTo(stop,12);
  expect(result.exitPrice).toBeCloseTo(stop,12);
});
