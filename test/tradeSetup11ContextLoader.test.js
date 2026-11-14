import {beforeEach,expect,it,vi} from 'vitest';
const fetch=vi.hoisted(()=>vi.fn());
vi.mock('../src/candleCache.js',()=>({fetchCandlesCached:fetch}));
import {loadTradeSetup11Context,TRADE_SETUP_11_CONTEXT_COUNTS} from '../src/tradeSetup11ContextLoader.js';
beforeEach(()=>{fetch.mockReset();});
it('bounds both native contexts independently of chart timeframe and excludes unclosed bars',async()=>{
  fetch.mockResolvedValue([{time:0},{time:86400},{time:172800}]);
  expect(await loadTradeSetup11Context({symbol:'XAUUSD',evaluatedAt:172800,chartTimeframe:'1D'})).toEqual({symbol:'XAUUSD',h1:[{time:0},{time:86400}],d1:[{time:0},{time:86400}]});
  expect(fetch.mock.calls.map(c=>[c[1],c[2],c[3],c[4]])).toEqual([
    ['XAUUSD','1h',TRADE_SETUP_11_CONTEXT_COUNTS.h1,172800000],['XAUUSD','1D',TRADE_SETUP_11_CONTEXT_COUNTS.d1,172800000]]);
});
it('does not request epoch or future-unbounded data without a valid evaluation time',async()=>{
  expect(await loadTradeSetup11Context({symbol:'EURUSD',evaluatedAt:null})).toEqual({symbol:'EURUSD',h1:[],d1:[]});
  expect(fetch).not.toHaveBeenCalled();
});
it('propagates missing context so its caller can show unknown instead of fabricated trend data',async()=>{
  fetch.mockRejectedValue(new Error('coverage missing'));
  await expect(loadTradeSetup11Context({symbol:'GBPUSD',evaluatedAt:172800})).rejects.toThrow('coverage missing');
});
