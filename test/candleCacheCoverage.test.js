import {expect,it} from 'vitest';
import {addCandleCoverage} from '../src/candleCacheCoverage.js';
import {cachedCandlesUpTo} from '../src/candleCache.js';
const candles=Array.from({length:10},(_,i)=>({time:i*300}));

it('merges overlapping and adjacent reads while preserving unfetched gaps',()=>{
  const original=[{from:0,to:900},{from:3000,to:6000}];
  expect(addCandleCoverage(original,1200,2700,300)).toEqual([{from:0,to:6000}]);
  expect(original).toEqual([{from:0,to:900},{from:3000,to:6000}]);
  expect(addCandleCoverage(original,1800,2400,300)).toHaveLength(3);
});
it('does not grant coverage from an empty or invalid response',()=>{
  expect(addCandleCoverage([],undefined,null,300)).toEqual([]);
  expect(addCandleCoverage([],900,600,300)).toEqual([]);
});
it('rejects legacy scalar claims and history reaching outside the verified interval',()=>{
  expect(cachedCandlesUpTo(candles,6000,2700,5,0,[])).toBeNull();
  expect(cachedCandlesUpTo(candles,6000,2700,10,0,[{from:1500,to:6000}])).toBeNull();
});
it('keeps verified weekends as hits and limits lookahead to the same fetched interval',()=>{
  const weekendEnd=2700+60*3600;
  expect(cachedCandlesUpTo(candles,weekendEnd,weekendEnd,10,0,[{from:0,to:weekendEnd}])).toEqual(candles);
  const ranges=[{from:0,to:1200},{from:1800,to:2700}];
  expect(cachedCandlesUpTo(candles,2700,900,4,3000,ranges).at(-1).time).toBe(1200);
});
