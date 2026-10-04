import { describe, it, expect } from 'vitest';
import { observeDealingRangePrice, completeDealingRangePriceObservations } from '../src/dealingRangePriceObservation.js';
import { evaluateChecklistLifecycle } from '../src/tradeSetupChecklistLifecycle.js';
import { savedRangeOutcome } from '../src/tradeSetup2SavedRangeOutcome.js';
import { completeSavedRangeCourses } from '../src/tradeSetup2RangeCourse.js';
import { groupSetupSnapshots } from '../src/tradeSetup2Review.js';
import { DEALING_RANGE_VERSION } from '../src/tradeSetup2DealingRange.js';
import { savedDealingRangePriceOutcome } from '../src/savedDealingRangePriceOutcome.js';

const candle = (time, high, low, extra = {}) => ({ time, high, low, close: 15, ...extra });
const input = { validatedAt: 600, validationPrice: 15, target1: 20, target2: 30, invalidation: 10, direction: 'long', windowEnd: 1800 };
describe('independent M5 DR observation', () => {
  it.each(['long','short'])('measures T2, return, open and missing history for %s', direction => {
    const mirror = c => direction === 'short' ? { ...c, high: 40-c.low, low: 40-c.high } : c;
    const base = { ...input, direction, validationPrice: direction === 'short' ? 25 : 15,
      target1: 20, target2: direction === 'short' ? 10 : 30, invalidation: direction === 'short' ? 30 : 10 };
    const observe = rows => observeDealingRangePrice({ ...base, candles: rows.map(mirror) });
    expect(observe([candle(600,22,14),candle(900,30,16),candle(1200,35,9),candle(1500,31,12)]))
      .toMatchObject({ stage1: 'target1', stage2: 'target2', t1At: 600, t2At: 900,
        invalidationReturnAt: 1200, validationPriceReturnAt: 1200, extremeAt: 1200, endAt: 1200, rawThrough: 1800, processedCandles: 4 });
    expect(observe([candle(600,22,14),candle(900,25,10),candle(1200,30,12),candle(1500,31,12)]))
      .toMatchObject({ stage2: 'returned', endAt: 1200, t2At: 1200 });
    expect(observe([candle(600,22,14),candle(900,25,16),candle(1200,26,16),candle(1500,28,16)]))
      .toMatchObject({ stage2: 'open', endReason: 'windowEnd' });
    expect(observe([candle(600,22,14),candle(1200,30,16)]))
      .toMatchObject({ stage1: 'target1', stage2: 'unknown', endReason: 'missingHistory' });
  });
  it('allows T2 in the T1 candle, keeps missing T2 explicit and same-candle ordering ambiguous', () => {
    const candles = [candle(600,30,14)];
    expect(observeDealingRangePrice({ ...input, candles, windowEnd: 900 })).toMatchObject({ stage2:'target2',t1At:600,t2At:600 });
    expect(observeDealingRangePrice({ ...input, candles, target2:null, windowEnd:900 })).toMatchObject({ stage2:'noTarget2' });
    expect(observeDealingRangePrice({ ...input, candles:[candle(600,30,10)] })).toMatchObject({ stage1:'ambiguous',stage2:null });
    expect(observeDealingRangePrice({ ...input, candles:[candle(600,22,14),candle(900,30,10)], windowEnd:1200 }))
      .toMatchObject({ stage1:'target1',stage2:'ambiguous' });
  });
  it('uses only closed candles starting after validation, counts ignored slots and rejects gaps', () => {
    expect(observeDealingRangePrice({ ...input, validatedAt:601, candles:[candle(600,30,10),candle(900,22,14),candle(1200,30,10)],windowEnd:1499 }))
      .toMatchObject({ stage1:'target1',stage2:'open',processedCandles:1 });
    expect(observeDealingRangePrice({ ...input, candles:[candle(600,30,10,{ignored:true}),candle(900,19,14)],windowEnd:1200 }))
      .toMatchObject({ stage1:'open',processedCandles:2 });
    expect(observeDealingRangePrice({ ...input, candles:[] })).toMatchObject({ stage1:'unknown',endReason:'missingHistory' });
  });
  it.each([[22,14,'target1'],[19,10,'invalidation'],[22,10,'ambiguous'],[19,14,'open']])('matches legacy no-entry stage 1 (%s/%s)', (high,low,status) => {
    const selection = { status:'passed',direction:'long',selectedAt:600,target1:{price:20,knownAt:600} };
    const candles=[candle(300,19,14),candle(600,high,low)];
    const snapshot={id:'s',instrument:'GBPUSD',setupKey:'dr',knownAt:600,direction:'long',entry:null,
      dealingRange:{version:DEALING_RANGE_VERSION,status:'validated'},
      checklist:{setup:{primary:{direction:'long',invalidation:10,targetSelection:selection}}}};
    const group=groupSetupSnapshots(completeSavedRangeCourses([snapshot],candles,900))[0];
    const observation=observeDealingRangePrice({...input,candles,windowEnd:900});
    expect(observation.stage1).toBe(status);
    expect(savedRangeOutcome(group).status).toBe(status);
    const lifecycle=evaluateChecklistLifecycle({selection,invalidation:10,candles,evaluatedAt:900});
    expect(lifecycle.main.reason).toBe(status==='ambiguous'?'both':status==='open'?null:status);
    const completed=completeDealingRangePriceObservations([snapshot,{...snapshot,id:'entry',entry:{id:'e'},knownAt:650}],candles,900);
    expect(completed[0].priceObservation).toEqual(completed[1].priceObservation);
    expect(snapshot.priceObservation).toBeUndefined();
    expect(savedDealingRangePriceOutcome(group).status).toBe('unknown');
  });
});
