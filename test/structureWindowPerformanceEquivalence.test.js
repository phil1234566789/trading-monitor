import {it,expect} from 'vitest';
import {computeRangesPivots,buildMarketStructureState} from '../src/marketStructureAnalysis';
import {computeRangesPivots as beforePivots,buildMarketStructureState as beforeState}
  from './fixtures/marketStructureAnalysisBeforePerformanceRound2';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import {buildStructureWithPhases} from '../src/trendPhases.js';
import {buildStructureWithPhases as beforePhases} from './fixtures/trendPhasesBeforePerformanceRound2.js';

it('preserves every structure field on growing reference prefixes',()=>{
  const rows=fixture.candles??fixture.m5Candles??fixture;
  for(let end=20;end<Math.min(rows.length,250);end+=7){
    const candles=rows.slice(0,end),anchor=candles[0].time;
    const outer=computeRangesPivots(candles,5,anchor),inner=computeRangesPivots(candles,2,anchor);
    expect(outer).toEqual(beforePivots(candles,5,anchor));
    expect(inner).toEqual(beforePivots(candles,2,anchor));
    expect(buildMarketStructureState(outer,inner,5,2,candles,{barSeconds:300}))
      .toEqual(beforeState(outer,inner,5,2,candles,{barSeconds:300}));
  }
});
it('preserves complete states with unordered, duplicate and nonfinite candle times',()=>{
  const initial=fixture.m5Candles.slice(0,180);
  for(const transform of [rows=>rows,rows=>rows.reverse(),rows=>{
    rows[20].time=rows[19].time;return rows;
  },rows=>{rows[20].time=NaN;return rows;}]){
    const candles=transform(structuredClone(initial)),outer=beforePivots(candles,5,-Infinity),
      inner=beforePivots(candles,2,-Infinity);
    expect(buildMarketStructureState(outer,inner,5,2,candles,{barSeconds:300}))
      .toEqual(beforeState(outer,inner,5,2,candles,{barSeconds:300}));
  }
});
it('preserves callback mutations between pivot steps',()=>{
  const rows=(fixture.candles??fixture.m5Candles??fixture).slice(0,250);
  const run=build=>{
    const candles=structuredClone(rows),outer=beforePivots(candles,5,candles[0].time),
      inner=beforePivots(candles,2,candles[0].time),steps=[];
    return {state:build(outer,inner,5,2,candles,{barSeconds:300,onStep(at,state){
      steps.push(structuredClone(state));
      if(steps.length===1){candles[0].time=candles.at(-1).time; candles[1].close+=.01;}
    }}),steps};
  };
  expect(run(buildMarketStructureState)).toEqual(run(beforeState));
  expect(run(beforeState).steps.length).toBeGreaterThan(0);
});
it('checks candle order once when there is no callback between pivot steps',()=>{
  const candles=fixture.m5Candles.slice(0,250);
  const outer=beforePivots(candles,5,candles[0].time),inner=beforePivots(candles,2,candles[0].time);
  let checks=0;
  candles.every=(...args)=>{checks++;return Array.prototype.every.apply(candles,args);};
  beforeState(outer,inner,5,2,candles,{barSeconds:300});expect(checks).toBeGreaterThan(1);
  checks=0;buildMarketStructureState(outer,inner,5,2,candles,{barSeconds:300});expect(checks).toBe(1);
});
it('shares the window with the internal phase callback, preserving phases and events',()=>{
  const candles=fixture.m5Candles.slice(0,250).map(c=>Object.freeze({...c}));
  const outer=beforePivots(candles,5,candles[0].time),inner=beforePivots(candles,2,candles[0].time);
  let checks=0;
  candles.every=(...args)=>{checks++;return Array.prototype.every.apply(candles,args);};
  Object.freeze(candles);
  const expected=beforePhases(outer,inner,5,2,candles,300);
  expect(checks).toBeGreaterThan(1);checks=0;
  expect(buildStructureWithPhases(outer,inner,5,2,candles,300)).toEqual(expected);
  expect(checks).toBe(1);
});
