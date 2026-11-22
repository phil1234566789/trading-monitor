import {beforeEach,expect,it,vi} from 'vitest';
const fetch=vi.hoisted(()=>vi.fn());
vi.mock('../src/candleCache.js',()=>({fetchCandlesCached:fetch}));
import {loadLsReactionContext,LS_REACTION_CONTEXT_COUNTS,lsReactionRequestedBoundary} from '../src/lsReactionContextLoader.js';
beforeEach(()=>{fetch.mockReset();});
it('loads a new replay boundary independently of stale chart candles or fetch lookahead',async()=>{
 const replay=Date.parse('2026-11-05T14:45:00Z')/1000,now=replay+86400;
 const evaluatedAt=lsReactionRequestedBoundary({replayUntil:replay,currentBar:'5m',now});
 fetch.mockResolvedValue([{time:replay-3600},{time:replay+300},{time:replay+86400}]);
 const context=await loadLsReactionContext({symbol:'XAUUSD',evaluatedAt,toMs:(replay+86400)*1000,
  staleChartCandles:[{time:Date.parse('2026-07-10T20:45:00Z')/1000}]});
 expect(evaluatedAt).toBe(replay+300);
 expect(fetch.mock.calls.every(c=>c[4]===(replay+300)*1000)).toBe(true);
 expect(context.h1).toEqual([{time:replay-3600}]);
 expect(lsReactionRequestedBoundary({replayUntil:now+86400,currentBar:'1D',now})).toBe(now);
});
it('bounds both native contexts independently of chart timeframe and excludes unclosed bars',async()=>{
  fetch.mockResolvedValue([{time:0},{time:86400},{time:172800}]);
  expect(await loadLsReactionContext({symbol:'XAUUSD',evaluatedAt:172800,chartTimeframe:'1D'})).toEqual({symbol:'XAUUSD',h1:[{time:0},{time:86400}],d1:[{time:0},{time:86400}]});
  expect(fetch.mock.calls.map(c=>[c[1],c[2],c[3],c[4]])).toEqual([
    ['XAUUSD','1h',LS_REACTION_CONTEXT_COUNTS.h1,172800000],['XAUUSD','1D',LS_REACTION_CONTEXT_COUNTS.d1,172800000]]);
});
it('does not request epoch or future-unbounded data without a valid evaluation time',async()=>{
  expect(await loadLsReactionContext({symbol:'EURUSD',evaluatedAt:null})).toEqual({symbol:'EURUSD',h1:[],d1:[]});
  expect(fetch).not.toHaveBeenCalled();
});
it('propagates missing context so its caller can show unknown instead of fabricated trend data',async()=>{
  fetch.mockRejectedValue(new Error('coverage missing'));
  await expect(loadLsReactionContext({symbol:'GBPUSD',evaluatedAt:172800})).rejects.toThrow('coverage missing');
});
