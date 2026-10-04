import {it,expect} from 'vitest';
import {createIncrementalLiquidityDetector} from '../src/incrementalLiquidityLevels.js';
import {detectLiquidityLevels as before} from './fixtures/liquidityDetectionBeforePerformanceRound2.js';
import {detectLiquidityLevels} from '../src/liquidityDetection.js';
import {detectLiquidityLevels as mcp} from '../supabase/functions/_shared/liquidityDetection.ts';
import {detectLiquidityLevels as watcher} from '../supabase/functions/_shared/liquidity.ts';

function candles(seed){
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  return Array.from({length:120},(_,i)=>({time:100000+i*300,
    high:Math.floor(random()*12),low:-Math.floor(random()*12),ignored:random()<.12}));
}
it('preserves frozen liquidity levels through appends, corrections and rewinds',()=>{
  for(const period of [1,2,4,5])for(let seed=1;seed<=12;seed++){
    const rows=candles(seed),detect=createIncrementalLiquidityDetector(period);
    for(let end=0;end<=rows.length;end++){
      const prefix=rows.slice(0,end),actual=detect(prefix);
      expect(actual).toEqual(before(prefix,period));
      if(actual.highs.length)actual.highs[0].price=999;
      expect(detect(prefix)).toEqual(before(prefix,period));
    }
    rows[10].high+=30;rows[11].ignored=!rows[11].ignored;rows[12].time+=1;
    for(const prefix of [rows,rows.slice(0,40),rows.slice(10),rows.toReversed(),rows])
      expect(detect(prefix)).toEqual(before(prefix,period));
  }
});
it('keeps the full frontend and both backend detectors equivalent to the frozen rules',()=>{
  for(const period of [1,2,4,5])for(let seed=1;seed<=12;seed++){
    const rows=candles(seed);
    rows[7].high=NaN;rows[13].low=-Infinity;rows[14].high=Infinity;
    rows[20].time=rows[19].time;
    const detect=createIncrementalLiquidityDetector(period);
    for(let end=0;end<=rows.length;end+=3){
      const prefix=rows.slice(0,end),expected=before(prefix,period);
      expect(detectLiquidityLevels(prefix,period)).toEqual(expected);
      expect(detect(prefix)).toEqual(expected);expect(mcp(prefix,period)).toEqual(expected);
      const withoutDir=Object.fromEntries(Object.entries(expected)
        .map(([key,levels])=>[key,levels.map(({dir,...level})=>level)]));
      expect(watcher(prefix,period)).toEqual(withoutDir);
    }
  }
});
it('preserves legacy behavior for missing or nonpositive periods',()=>{
  for(const period of [undefined,NaN,null,0,-1]){
    const detect=createIncrementalLiquidityDetector(period),rows=candles(1);
    for(let end=0;end<25;end++){
      const prefix=rows.slice(0,end);
      let expected;
      try{expected=before(prefix,period);}catch{
        expect(()=>detect(prefix)).toThrow();continue;
      }
      expect(detect(prefix)).toEqual(expected);
    }
  }
});
