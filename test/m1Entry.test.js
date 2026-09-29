import { describe, expect, it } from 'vitest';
import { m1EntryFromFvg, entryChecklist } from '../src/m1Entry.js';
import { m1RetestAfterReaction } from '../src/m1Retest.js';
import { closedChecklistCandles } from '../src/tradeSetupChecklistTimeBasis.js';
import candles from './fixtures/gbpusd-m1-dr114-p5.json';

const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
const context = { instrument: 'GBPUSD', setupKey: 'dr114', direction: 'short',
  primary: { reactionRecognizedAt: at('09:30'), reactionOB: { dir: -1, top: 1.35675, bottom: 1.35641 },
    targetSelection: { status: 'passed', selectedAt: at('09:30'), target1: { price: 1.35335 }, target2: { price: 1.35300 } } } };
const entryAt = clock => {
  const until = at(clock);
  const rows = closedChecklistCandles(candles, '1m', until);
  const { fvg, retest } = m1RetestAfterReaction(rows, context.primary, until);
  return m1EntryFromFvg(context, fvg, rows, until, retest);
};

describe('first M1 FVG entry', () => {
  it('starts at the confirmation candle close, never at the gold impulse', () => {
    expect(entryAt('09:49')).toBeNull();
    const entry = entryAt('09:50');
    expect(entry).toMatchObject({ label: 'Entry 1', candleTime: at('09:49'), recognizedAt: at('09:50'),
      price: candles.find(c => c.time === at('09:49')).close, instrument: 'GBPUSD', setupKey: 'dr114' });
    expect(entry.price).not.toBe(candles.find(c => c.time === at('09:48')).close);
    expect(entryAt('09:55')).toEqual(entry);
    expect(entryAt('10:15')).toEqual(entry);
    expect(entryAt('09:49')).toBeNull();
    expect(entryAt('09:50')).toEqual(entry);
  });
  it('requires the actual closed confirmation candle and keeps setup identities separate', () => {
    const fvg = { candleTime: at('09:48'), recognizedAt: at('09:50') };
    expect(m1EntryFromFvg(context, fvg, candles, at('09:49'))).toBeNull();
    expect(m1EntryFromFvg(context, fvg, candles.filter(c => c.time !== at('09:49')), at('09:50'))).toBeNull();
    const original = entryAt('09:50');
    expect(m1EntryFromFvg({ ...context, setupKey: 'other' }, fvg, candles, at('09:50')).id).not.toBe(original.id);
    expect(m1EntryFromFvg({ ...context, instrument: 'EURUSD' }, fvg, candles, at('09:50')).id).not.toBe(original.id);
  });
  it('shows Entry 1 without inventing a requirement that all other checks pass', () => {
    expect(entryChecklist({ entry: entryAt('09:50'), detailStatuses: ['unmet'] })).toMatchObject({
      status: 'passed', details: ['Entry 1 um 09:50 Uhr', 'Weiter SL: 6,0 Pips', 'Enger SL: 3,3 Pips'], detailStatuses: ['passed'] });
    expect(entryChecklist({ entry: entryAt('10:15'), evaluatedAt: at('10:15') }).details[0]).toBe('Entry 1 um 09:50 Uhr');
    expect(entryChecklist({ entry: { label: 'Entry 1', recognizedAt: Date.parse('2026-01-09T09:50:00+01:00') / 1000 } }).details[0]).toBe('Entry 1 um 09:50 Uhr');
    expect(entryChecklist({})).toMatchObject({ status: 'pending', details: [] });
  });
  it('freezes the C-OB stop, the full known retest extreme and both target ratios at entry', () => {
    const entry = entryAt('09:50');
    expect(entry.stops.wide.price).toBe(1.35675);
    expect(entry.stops.narrow).toEqual({ price: 1.35648, sourceTime: at('09:46') });
    expect(entry.scales.wide.riskPips).toBeCloseTo(6);
    expect(entry.scales.narrow.riskPips).toBeCloseTo(3.3);
    expect(entry.scales.wide.targets[0].rr).toBeCloseTo(4.666666);
    expect(entry.scales.narrow.targets[0].rr).toBeCloseTo(8.484848);
    const modified = candles.map(c => ({ ...c, high: c.time === at('09:47') ? 1.35655 : c.time > at('09:49') ? 1.4 : c.high }));
    const after = m1EntryFromFvg(context, { candleTime: at('09:48'), recognizedAt: at('09:50') }, modified, at('10:15'), { candleTime: at('09:46') });
    expect(after.stops.narrow).toEqual({ price: 1.35655, sourceTime: at('09:47') });
    expect(after.stops.wide.price).toBe(entry.stops.wide.price);
  });
  it('uses the symmetric known retest low and C-OB bottom for long entries', () => {
    const reflected = candles.map(c => ({ ...c, open: 3-c.open, close: 3-c.close, high: 3-c.low, low: 3-c.high }));
    const long = { ...context, direction: 'long', primary: { ...context.primary,
      reactionOB: { dir: 1, top: 3-1.35641, bottom: 3-1.35675 },
      targetSelection: { status: 'passed', selectedAt: at('09:30'), target1: { price: 3-1.35335 } } } };
    const entry = m1EntryFromFvg(long, { candleTime: at('09:48'), recognizedAt: at('09:50') }, reflected, at('09:50'), { candleTime: at('09:46') });
    expect(entry.stops.narrow.price).toBeCloseTo(3-1.35648);
    expect(entry.scales.wide.targets[0].rr).toBeCloseTo(entryAt('09:50').scales.wide.targets[0].rr);
    expect(entry.scales.wide.targets).toHaveLength(1);
  });
});
