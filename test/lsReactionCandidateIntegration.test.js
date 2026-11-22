import {afterEach,expect,it,vi} from 'vitest';
import * as detection from '../src/tradeSetup.js';
import * as reaction from '../src/liquiditySweepReaction.js';
import {usePriceChartTradeSetups} from '../src/composables/usePriceChartTradeSetups.js';
import candles from './fixtures/gbpusd-m5-2026-07-20-long-setup.json';
afterEach(()=>vi.restoreAllMocks());

it('opts into typed sweep sources without changing legacy detection or removing ignored formation bars',()=>{
  const detect=vi.spyOn(detection,'detectTradeSetups').mockReturnValue([]);
  const input={candles,marketStructureState:null,symbol:'GBPUSD',tradeSetupHistoryCount:1};
  usePriceChartTradeSetups({sweepSourceProfile:detection.TRADE_SETUP_OB_SWEEP_PROFILE}).computeTradeSetups(input);
  expect(detect.mock.calls).toHaveLength(2);
  for(const call of detect.mock.calls){
    expect(call[5].sweepSourceProfile).toBe(detection.TRADE_SETUP_OB_SWEEP_PROFILE);
    expect(call[7]).toHaveLength(candles.length);
    expect(call[6].every(c=>!c.ignored)).toBe(true);
  }
  detect.mockClear();
  usePriceChartTradeSetups().computeTradeSetups(input);
  expect(detect.mock.calls.every(call=>call[5].sweepSourceProfile===undefined)).toBe(true);
});

it('applies the new policy to merged candidates before history, preserving legacy default behavior',()=>{
  const input={candles,marketStructureState:null,symbol:'GBPUSD',tradeSetupHistoryCount:1};
  const baseline=usePriceChartTradeSetups();baseline.computeTradeSetups({...input,tradeSetupHistoryCount:20});
  const longs=baseline.tradeSetupsMetadata.value.filter(s=>s.dir===-1);
  expect(longs.length).toBeGreaterThan(1);
  const kept=longs[0],stored={...longs.at(-1),instrument:'GBPUSD',tradeSetupId:123,fromDb:true};
  const evaluateCandidates=vi.fn(rows=>rows.filter(s=>s.obStartTime===kept.obStartTime&&s.dir===-1));
  const current=usePriceChartTradeSetups({evaluateCandidates});
  current.computeTradeSetups({...input,dbTradeSetups:[stored],policyContext:{evaluatedAt:1790000000}});
  expect(evaluateCandidates).toHaveBeenCalledOnce();
  expect(evaluateCandidates.mock.calls[0][0].length).toBeGreaterThan(1);
  expect(current.tradeSetupsMetadata.value.map(s=>s.obStartTime)).toEqual([kept.obStartTime]);
  current.computeTradeSetups({...input,dbTradeSetups:[stored],policyContext:{evaluatedAt:1790000300}});
  expect(evaluateCandidates).toHaveBeenCalledTimes(2);
});

it('rejects a DB-only newer candidate before history can hide an older valid live setup',()=>{
  const live={dir:-1,obStartTime:1784530800,obTop:1.35,obBottom:1.34,ls:{},fractal:{}};
  const stored={...live,instrument:'GBPUSD',obStartTime:1784531100,tradeSetupId:999,fromDb:true,detectorVersion:'old'};
  vi.spyOn(detection,'detectTradeSetups').mockImplementation(dir=>dir===-1?[live]:[]);
  vi.spyOn(reaction,'hasUninterruptedSweepReaction').mockReturnValue(true);
  const evaluateCandidates=vi.fn(rows=>rows.filter(s=>s.tradeSetupId!==999));
  const api=usePriceChartTradeSetups({evaluateCandidates});
  api.computeTradeSetups({candles,marketStructureState:null,symbol:'GBPUSD',tradeSetupHistoryCount:1,dbTradeSetups:[stored]});
  expect(evaluateCandidates.mock.calls[0][0]).toContainEqual(stored);
  expect(api.tradeSetupsMetadata.value).toHaveLength(1);
  expect(api.tradeSetupsMetadata.value[0].obStartTime).toBe(live.obStartTime);
});
it('clears pending signals and applies only the latest asynchronous policy result',async()=>{
  const pending=[],updated=vi.fn();
  const api=usePriceChartTradeSetups({evaluateCandidates:rows=>new Promise(resolve=>pending.push({rows,resolve})),onEvaluated:updated});
  const input={candles,marketStructureState:null,symbol:'GBPUSD',tradeSetupHistoryCount:1};
  const older=api.computeTradeSetups({...input,policyContext:{revision:1}});
  const latest=api.computeTradeSetups({...input,policyContext:{revision:2}});
  expect(api.tradeSetupsMetadata.value).toEqual([]);
  pending[1].resolve(pending[1].rows);await latest;
  const accepted=api.tradeSetupsMetadata.value;
  pending[0].resolve([]);await older;
  expect(api.tradeSetupsMetadata.value).toEqual(accepted);
  expect(accepted.length).toBeGreaterThan(0);expect(updated).toHaveBeenCalledOnce();
});
