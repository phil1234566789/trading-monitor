import {it,expect} from 'vitest';
import reference from './fixtures/xauusd-dr121-relative-m5-ranges.json';
import native from './fixtures/xauusd-dr121-exploratory-short.json';
import {selectRelativeM5SweepRanges} from '../src/relativeM5SweepRanges.js';
import {classifyM5SetupType} from '../src/countertrendChecklist.js';
it('associates the original DR121 source with native owner pivots and its already known CHoCH',()=>{
  const result=selectRelativeM5SweepRanges(reference);
  expect(result).toMatchObject({status:'ready',outer:{trend:'downtrend',depth:2},
    inner:{trend:'uptrend',rawTrend:'unknown',basis:'existingCloseReactionChoch',knownAt:reference.source.recognizedAt}});
  for(const point of [result.outer.range.high,result.outer.range.low,result.inner.range.high]){
    const candle=native.candles.m5.find(c=>c.time===point.pivotTime);
    expect([candle.high,candle.low]).toContain(point.price);
  }
  const fact=result.inner.confirmation,candle=native.candles.m5.find(c=>c.time===fact.candleTime);
  expect(candle.time+300).toBe(fact.recognizedAt);
  expect(candle.close).toBeGreaterThan(reference.source.ls.price);
  expect(classifyM5SetupType('short',result.inner.trend,result.outer.trend).type).toBe('countertrend');
  expect(classifyM5SetupType('short','downtrend','downtrend').type).toBe('trendContinuation');
  expect(selectRelativeM5SweepRanges({...reference,stateKnownAt:reference.stateKnownAt+900}).status).toBe('unknown');
});
