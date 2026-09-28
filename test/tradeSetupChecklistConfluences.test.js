import { describe, expect, it } from 'vitest';
import { detectChecklistDivergences, detectChecklistOrderBlocks, evaluateChecklistConfluences } from '../src/tradeSetupChecklistConfluences.js';
import { orderBlockRecognitionTimes } from '../src/orderBlockRecognitionTime.js';

const divergenceCandles = (duration = 300, bullish = false) =>
  [...Array.from({ length: 21 }, (_, i) => 100 + i), 119, 118, 117, 118, 119, 120, 121, 120, 119, 118]
    .map((value, i) => { const close = bullish ? 250 - value : value; return { time: i * duration, open: close, high: close + .1, low: close - .1, close }; });
const primary = { id: 'main', direction: 'short', knownAsOf: 12000, sweep: { timeframe: '1H', ageSeconds: 86400,
  level: { dir: 1, price: 130, pivotTime: -86400, touchedTime: 9000 } } };
const counter = { id: 'counter', direction: 'long', knownAsOf: 12000, recognizedAt: 9300,
  sweep: { timeframe: '1H', ageSeconds: 172800, level: { dir: -1, price: 100, pivotTime: -172800, touchedTime: 9000 } } };
const target2 = { period: 5, timeframe: '1h', dir: -1, price: 100, pivotTime: -172800, selectedAt: 8000 };

describe('Checklist RSI evidence', () => {
  it('waits for the close of the third right candle and reports recognition time', () => {
    const candles = divergenceCandles();
    expect(detectChecklistDivergences({ candles, timeframe: '5m', evaluatedAt: 9299 }).candidates).toEqual([]);
    expect(detectChecklistDivergences({ candles, timeframe: '5m', evaluatedAt: 9300 }).candidates)
      .toMatchObject([{ type: 'bearish', toTime: 8100, recognizedAt: 9300, timeframe: '5m', association: 'unknown' }]);
  });
  it('is prefix-causal even when future candles are supplied', () => {
    const candles = divergenceCandles();
    const args = { timeframe: '5m', evaluatedAt: 8700 };
    expect(detectChecklistDivergences({ ...args, candles })).toEqual(detectChecklistDivergences({ ...args, candles: candles.slice(0, 29) }));
  });
  it('distinguishes missing and insufficient data from no detected pattern', () => {
    expect(detectChecklistDivergences({ timeframe: '5m', evaluatedAt: 9300 }).status).toBe('unknown');
    expect(detectChecklistDivergences({ candles: [], timeframe: '5m', evaluatedAt: 9300 }).status).toBe('unknown');
    const candles = divergenceCandles().map(c => ({ ...c, close: 100 }));
    expect(detectChecklistDivergences({ candles, timeframe: '5m', evaluatedAt: 9300 }).status).toBe('absent');
  });
});

describe('Checklist E/G', () => {
  it('keeps H1 counter-divergences separate from same-direction M5 evidence', () => {
    const result = evaluateChecklistConfluences({ evaluatedAt: 111600, direction: 'short', h1Candles: divergenceCandles(3600, true), m5Candles: divergenceCandles() });
    expect(result.antiConfluences.divergences.candidates).toMatchObject([{ type: 'bullish', timeframe: '1H' }]);
    expect(detectChecklistDivergences({ candles: divergenceCandles(), timeframe: '5m', evaluatedAt: 111600 }).candidates)
      .toMatchObject([{ type: 'bearish', timeframe: '5m' }]);
    expect(result.confluences.divergences.status).toBe('unknown');
    expect(result.antiConfluences.status).toBe('pending');
    expect(result.antiConfluences.details).toEqual(['bullische 1H Divergenz vorhanden']);
    expect(result.antiConfluences.explanation).toContain('RSI');
    expect(result.confluences.status).not.toBe('blocked');
  });
  it('matches the actual P5 pivot and exposes age without inventing strength', () => {
    const result = evaluateChecklistConfluences({ evaluatedAt: 12000, direction: 'short', primary, target2,
      opposingCandidates: [counter, { ...counter, id: 'same-price-other-pivot', sweep: { ...counter.sweep, level: { ...counter.sweep.level, pivotTime: -200000 } } }] });
    expect(result.antiConfluences.sweepCandidates).toMatchObject([{ id: 'counter', olderThanPrimary: true, strengthComparison: 'unknown' }]);
    expect(result.antiConfluences.sweepCandidates).toHaveLength(1);
    expect(result.antiConfluences.status).toBe('unknown');
  });
  it('does not use future as-of snapshots or targets', () => {
    const args = { evaluatedAt: 12000, direction: 'short', primary, target2, opposingCandidates: [{ ...counter, knownAsOf: 13000 }] };
    expect(evaluateChecklistConfluences(args).antiConfluences.sweepCandidates).toEqual([]);
    expect(evaluateChecklistConfluences({ ...args, opposingCandidates: [counter], target2: { ...target2, selectedAt: 13000 } }).antiConfluences.sweepCandidates).toEqual([]);
  });
  it('missing optional evidence never blocks or produces an overall GO', () => {
    const result = evaluateChecklistConfluences({ evaluatedAt: 12000, direction: 'short', primary, target2, opposingCandidates: [], h1Candles: [], m5Candles: [] });
    expect(result.confluences.status).toBe('unknown');
    expect(result.go).toBeUndefined();
    expect(result.antiConfluences.deferredChecks).toEqual(['sweep', 'orderBlock', 'strength']);
  });
  it.each([['short', false, 'bullische'], ['long', true, 'bärische']])('marks only the absent H1 counter-divergence green for %s', (direction, bullish, label) => {
    const result = evaluateChecklistConfluences({ evaluatedAt: 111600, direction, h1Candles: divergenceCandles(3600, bullish) });
    expect(result.antiConfluences.status).toBe('passed');
    expect(result.antiConfluences.details).toEqual([`keine ${label} 1H Divergenz vorhanden`]);
    expect(result.antiConfluences.explanation).toContain('nur die H1-Gegendivergenz');
    expect(result.antiConfluences.deferredChecks).toEqual(['sweep', 'orderBlock', 'strength']);
    expect(result.go).toBeUndefined();
  });
  it.each([undefined, [], divergenceCandles(3600).slice(0, 20)])('keeps missing or insufficient H1 history unknown', h1Candles => {
    const check = evaluateChecklistConfluences({ evaluatedAt: 111600, direction: 'short', h1Candles }).antiConfluences;
    expect(check.status).toBe('unknown');
    expect(check.details).toEqual(['1H-Gegendivergenz noch nicht prüfbar.']);
  });
  it('uses only closed H1 candles for the counter-divergence', () => {
    const args = { direction: 'short', h1Candles: divergenceCandles(3600, true) };
    expect(evaluateChecklistConfluences({ ...args, evaluatedAt: 20 * 3600 }).antiConfluences.status).toBe('unknown');
    expect(evaluateChecklistConfluences({ ...args, evaluatedAt: 111599 }).antiConfluences.status).toBe('passed');
    expect(evaluateChecklistConfluences({ ...args, evaluatedAt: 111600 }).antiConfluences.status).toBe('pending');
  });
});

describe('Checklist OB evidence', () => {
  it('uses the next actual candle across gaps, with no guessed time for the last candle', () => {
    const times = orderBlockRecognitionTimes([{ time: 0 }, { time: 900 }], '5M');
    expect(times.get(0)).toBe(1200);
    expect(times.has(900)).toBe(false);
    expect(orderBlockRecognitionTimes([{ time: 0 }, { time: 900 }], 'bad').size).toBe(0);
  });
  const candles = [
    { time: 0, open: 1.30, close: 1.30, high: 1.301, low: 1.299 },
    { time: 300, open: 1.30, close: 1.30, high: 1.301, low: 1.299 },
    { time: 600, open: 1.30, close: 1.31, high: 1.311, low: 1.300 },
    { time: 900, open: 1.31, close: 1.31, high: 1.312, low: 1.305 },
    { time: 1200, open: 1.305, close: 1.306, high: 1.307, low: 1.301 },
    { time: 1500, open: 1.307, close: 1.310, high: 1.312, low: 1.309 },
  ];
  it('uses FVG close for recognition and never confuses retestedAt with recognition', () => {
    expect(detectChecklistOrderBlocks({ candles, timeframe: '5m', evaluatedAt: 1199 }).candidates).toEqual([]);
    expect(detectChecklistOrderBlocks({ candles, timeframe: '5m', evaluatedAt: 1200 }).candidates[0]).toMatchObject({ startTime: 600, recognizedAt: 1200 });
    const obs = detectChecklistOrderBlocks({ candles, timeframe: '5m', evaluatedAt: 1800 }).candidates;
    expect(obs[0]).toMatchObject({ touched: true, touchRecognizedAt: 1500, mitigation: 'unknown' });
  });
  it('reports a lower-timeframe retest only after the confirming FVG closes', () => {
    const extended = [...candles, { time: 1800, open: 1.31, close: 1.312, high: 1.315, low: 1.31 }];
    expect(detectChecklistOrderBlocks({ candles: extended, timeframe: '5m', evaluatedAt: 2099 }).candidates[0].retested).toBe(false);
    expect(detectChecklistOrderBlocks({ candles: extended, timeframe: '5m', evaluatedAt: 2100 }).candidates[0])
      .toMatchObject({ retested: true, retestedAt: 1500, retestRecognizedAt: 2100, mitigation: 'unknown' });
  });
  it('exposes overlapping counter OBs only as unproven origins when no exact sweep exists', () => {
    const result = evaluateChecklistConfluences({ evaluatedAt: 1800, direction: 'short', m5Candles: candles, opposingCandidates: [],
      target2: { ...target2, price: 1.3, selectedAt: 0 } });
    expect(result.antiConfluences.obCandidates).toMatchObject([{ dir: 1, targetAssociation: 'price-overlap', originOfCounterReaction: 'unknown' }]);
    expect(result.antiConfluences.status).toBe('unknown');
  });
  it('can prove a touch on the sweep candle without claiming same movement or mitigation', () => {
    const result = evaluateChecklistConfluences({ evaluatedAt: 1800, direction: 'long', m5Candles: candles,
      primary: { ...primary, direction: 'long', knownAsOf: 1800, sweep: { ...primary.sweep,
        level: { ...primary.sweep.level, dir: -1, price: 1.302, touchedTime: 1200 } } } });
    expect(result.confluences.obCandidates).toMatchObject([{ dir: 1, touchOnSweepCandle: true, sameMovement: 'unknown', mitigation: 'unknown' }]);
    expect(result.confluences.status).toBe('unknown');
  });
  it('ignores formation windows containing spread-hour candles', () => {
    expect(detectChecklistOrderBlocks({ candles: candles.map((c, i) => ({ ...c, ignored: i === 2 })), timeframe: '5m', evaluatedAt: 1800 }).candidates).toEqual([]);
  });
});
