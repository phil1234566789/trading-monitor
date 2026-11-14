import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),filter:vi.fn(),compute:vi.fn(),baseFetch:vi.fn(),evaluate:null}));
vi.mock('../src/sessions.js',()=>({sessions:[{instrument:'XAUUSD',id:'gold'},{instrument:'EURUSD',id:'euro'}]}));
vi.mock('../src/candleCache.js',()=>({fetchCandlesCached:mocks.fetch}));
vi.mock('../src/composables/usePriceChartTradeSetups.js',()=>({usePriceChartTradeSetups(options){
  mocks.evaluate=options.evaluateCandidates;
  return {tradeSetupsMetadata:{value:[]},getM5Candles:()=>[{time:300}],invalidate:vi.fn(),computeTradeSetups:mocks.compute,fetchM5Candles:mocks.baseFetch};
}}));
import {usePriceChartTradeSetup11,TRADE_SETUP_11_CONTEXT_COUNTS} from '../src/composables/usePriceChartTradeSetup11.js';
beforeEach(()=>{
  vi.clearAllMocks();mocks.compute.mockReset();mocks.baseFetch.mockResolvedValue({ok:true,applied:true});
  mocks.fetch.mockResolvedValue([{time:0},{time:86400},{time:172800}]);
  mocks.filter.mockReturnValue({version:'ts11',status:'unknown',setups:[],assessments:[],counts:{passed:0,unmet:0,unknown:2}});
});
it('loads bounded closed native context and forwards settings/asOf without rewriting source provenance',async()=>{
  const api=usePriceChartTradeSetup11({worker:{run:mocks.filter,cancel:vi.fn(),dispose:vi.fn()}}),evaluatedAt=172800;
  await api.fetchM5Candles({symbol:'XAUUSD',evaluatedAt,toMs:evaluatedAt*1000});
  expect(mocks.fetch.mock.calls.map(c=>[c[2],c[3],c[4]])).toEqual([
    ['1h',TRADE_SETUP_11_CONTEXT_COUNTS.h1,evaluatedAt*1000],['1D',TRADE_SETUP_11_CONTEXT_COUNTS.d1,evaluatedAt*1000]]);
  api.computeTradeSetups({symbol:'XAUUSD',candles:[{time:300}],evaluatedAt,settings:{m5StructurePeriod:7}});
  const {policyContext}=mocks.compute.mock.calls[0][0];
  expect(policyContext.h1Candles).toEqual([{time:0},{time:86400}]);
  expect(policyContext.d1Candles).toEqual([{time:0},{time:86400}]);
  expect(policyContext).toMatchObject({evaluatedAt,settings:{m5StructurePeriod:7}});
  const source={detectorVersion:'historical',tradeSetupId:17};
  await mocks.evaluate([source],policyContext);
  expect(mocks.filter.mock.calls[0][0].setups[0]).toBe(source);
  expect(mocks.filter.mock.calls[0][0]).toMatchObject({instrument:'XAUUSD',sessionConfigs:[{instrument:'XAUUSD',id:'gold'}]});
  expect(api.status.value).toContain('2 Trenddaten unbekannt');
});
it('never reuses another symbol context and handles failed context as unknown rather than a successful pass',async()=>{
  mocks.fetch.mockRejectedValue(new Error('missing'));
  const api=usePriceChartTradeSetup11({worker:{run:mocks.filter,cancel:vi.fn(),dispose:vi.fn()}});
  await expect(api.fetchM5Candles({symbol:'XAUUSD',evaluatedAt:172800})).resolves.toEqual({ok:true,applied:true});
  api.computeTradeSetups({symbol:'EURUSD',candles:[{time:300}],evaluatedAt:172800});
  expect(mocks.compute).not.toHaveBeenCalled();expect(api.status.value).toContain('Trenddaten nicht verfügbar');
});
it('does not let an older symbol request overwrite the currently applied native context',async()=>{
  const pending=[];mocks.fetch.mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));
  const onUpdate=vi.fn(),worker={run:mocks.filter,cancel:vi.fn(),dispose:vi.fn()};
  const api=usePriceChartTradeSetup11({worker,onUpdate});
  const older=api.fetchM5Candles({symbol:'XAUUSD',evaluatedAt:172800});
  expect(api.status.value).toContain('Daten laden');
  expect(onUpdate).toHaveBeenCalledOnce();expect(worker.cancel).toHaveBeenCalledOnce();
  const newer=api.fetchM5Candles({symbol:'EURUSD',evaluatedAt:172800});
  pending[2]([{time:3600}]);pending[3]([{time:86400}]);
  expect(await newer).toEqual({ok:true,applied:true});
  pending[0]([{time:7200}]);pending[1]([{time:0}]);
  expect(await older).toEqual({ok:true,applied:false});
  api.computeTradeSetups({symbol:'EURUSD',candles:[{time:300}],evaluatedAt:172800});
  expect(mocks.compute.mock.calls[0][0].policyContext).toMatchObject({instrument:'EURUSD',h1Candles:[{time:3600}],d1Candles:[{time:86400}]});
});
it('does not leave a successful or loading status after the M5 source fails',async()=>{
  mocks.baseFetch.mockResolvedValue({ok:false,applied:false});
  const api=usePriceChartTradeSetup11({worker:{run:mocks.filter,cancel:vi.fn(),dispose:vi.fn()}});
  expect(await api.fetchM5Candles({symbol:'XAUUSD',evaluatedAt:172800})).toEqual({ok:false,applied:false});
  expect(api.status.value).toBe('TS1.1: M5-Daten nicht verfügbar.');
});
it('restores original chart references and Infinity after worker serialization, and terminates on dispose',async()=>{
  const worker={run:mocks.filter,cancel:vi.fn(),dispose:vi.fn()};
  const api=usePriceChartTradeSetup11({worker});
  const level={price:1,pivotTime:300,endTime:Infinity};
  const source={dir:-1,obStartTime:600,fractal:level,ls:level,detectorVersion:'legacy',tradeSetupId:17};
  mocks.filter.mockResolvedValue({version:'ts11',status:'ready',counts:{passed:1,unmet:0,unknown:0},
    assessments:[{setupKey:'XAUUSD:-1:600',status:'passed',setup:JSON.parse(JSON.stringify(source)),trendEvidence:{knownAt:1200}}]});
  const [restored]=await mocks.evaluate([source],{instrument:'XAUUSD'});
  expect(restored.fractal).toBe(level);expect(restored.ls).toBe(level);expect(restored.fractal.endTime).toBe(Infinity);
  expect(restored).toMatchObject({detectorVersion:'legacy',tradeSetupId:17,trendEvaluationVersion:'ts11'});
  api.dispose();expect(worker.dispose).toHaveBeenCalledOnce();
});
it('keeps loading distinct from unknown while native context is still being fetched',async()=>{
  const pending=[];mocks.fetch.mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));
  mocks.compute.mockImplementation(input=>mocks.evaluate([{dir:-1,obStartTime:600}],input.policyContext));
  const api=usePriceChartTradeSetup11({worker:{run:mocks.filter,cancel:vi.fn(),dispose:vi.fn()}});
  const loaded=api.fetchM5Candles({symbol:'XAUUSD',evaluatedAt:172800});
  await api.computeTradeSetups({symbol:'XAUUSD',candles:[{time:300}],evaluatedAt:172800});
  expect(mocks.filter).not.toHaveBeenCalled();
  expect(api.status.value).toContain('Daten laden');
  pending.forEach(resolve=>resolve([{time:0}]));await loaded;
  expect(mocks.filter).toHaveBeenCalledOnce();
  expect(mocks.filter.mock.calls[0][0]).toMatchObject({h1Candles:[{time:0}],d1Candles:[{time:0}],m5Candles:[{time:300}]});
});
