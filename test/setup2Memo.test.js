import {it,expect,vi} from 'vitest';
import {createSetup2Memo,isCandleAppend} from '../src/setup2Memo.js';
import {evaluateCountertrendChecklist} from '../src/countertrendChecklist.js';
import {buildHistoricalDailyAnchors} from '../src/tradeSetup2Anchors.js';
import {setup1RecognitionTime} from '../src/setup1RecognitionTime.js';
import * as targets from '../src/tradeSetupChecklistLifecycle.js';
import * as structure from '../src/tradeSetupChecklistM5.js';
import * as observations from '../src/tradeSetupChecklistConfluences.js';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import {scanTradeSetup2Window} from '../src/tradeSetup2Scan.js';
import sessions from './fixtures/gbpusd-m5-dr114-session-targets.json';

const source=fixture.setups[0],at=setup1RecognitionTime(source);
const input={instrument:'GBPUSD',tradeSetups:[source],m5Candles:fixture.m5Candles,h1Candles:fixture.h1Candles,
 dailyAnchors:buildHistoricalDailyAnchors(fixture.dailyCandles,fixture.h1Candles),sessionConfigs:sessions.sessions};
it('freezes A–E and final F/G, retries unknown F, and invalidates on an archive revision',()=>{
 const memo=createSetup2Memo(),target=vi.spyOn(targets,'fixChecklistTargets'),outer=vi.spyOn(structure,'evaluateChecklistOuterM5');
 const anti=vi.spyOn(observations,'evaluateChecklistConfluences')
  .mockReturnValueOnce({antiConfluences:{status:'unknown'},confluences:{status:'pending'}})
  .mockReturnValue({antiConfluences:{status:'passed'},confluences:{status:'pending'}});
 try{
  const first=evaluateCountertrendChecklist({...input,evaluatedAt:at,setupMemo:memo});
  expect(first.dealingRange.status).toBe('confirmed');
  for(const evaluatedAt of [at+300,at+600,at+900]){
   expect(evaluateCountertrendChecklist({...input,evaluatedAt,setupMemo:memo}).dealingRange.status).toBe('validated');
  }
  expect(target).toHaveBeenCalledOnce();expect(outer).toHaveBeenCalledOnce();expect(anti).toHaveBeenCalledTimes(2);
  evaluateCountertrendChecklist({...input,evaluatedAt:at+900,setupMemo:memo,dataRevision:1});
  expect(target).toHaveBeenCalledTimes(2);expect(outer).toHaveBeenCalledTimes(2);
 }finally{target.mockRestore();outer.mockRestore();anti.mockRestore();}
});
it('bounds cached setups and distinguishes appended candles from corrected history',()=>{
 const memo=createSetup2Memo(2);memo.set('a',{});memo.set('b',{});memo.set('c',{});
 expect(memo.size).toBe(2);expect(memo.get('a')).toBeUndefined();
 expect(isCandleAppend([{time:0,close:1}],[{time:0,close:1},{time:60,close:2}])).toBe(true);
 expect(isCandleAppend([{time:0,close:1}],[{time:0,close:2}])).toBe(false);
});
it('two-day scanner emits identical stages and courses and stops evaluating ended ranges',async()=>{
 const outer=vi.spyOn(structure,'evaluateChecklistOuterM5').mockReturnValue({state:{trend:'downtrend'}});
 const current=vi.spyOn(structure,'evaluateChecklistM5').mockReturnValue({structureReaction:{trend:'uptrend'},
  m1Anchor:{pivotTime:at-300,price:1.35,recognizedAt:at}});
 const target=vi.spyOn(targets,'fixChecklistTargets').mockImplementation(({candidate})=>({status:'passed',
  selectedAt:candidate.recognizedAt,direction:'short',target1:{price:1.29},target2:null}));
 const anti=vi.spyOn(observations,'evaluateChecklistConfluences').mockReturnValue({antiConfluences:{status:'passed'},confluences:{status:'pending'}});
 try{
  const second={...source,tradeSetupId:3126,createdAt:source.createdAt+86400,obStartTime:source.obStartTime+86400,
   ls:{...source.ls,pivotTime:source.ls.pivotTime+86400,touchedTime:source.ls.touchedTime+86400}};
  const candles=Array.from({length:578},(_,i)=>({time:at-300+i*300,open:1.3,close:1.3,high:1.301,
   low:[13,301].includes(i)?1.28:1.299}));
  const scan={...input,tradeSetups:[source,second],m5Candles:candles,m1Candles:[],fromTime:at,toTime:at+172800,
   tradingWindows:{weekday:[],saturday:[],sunday:[]}};
  const memo=await scanTradeSetup2Window(scan);
  expect(target).toHaveBeenCalledTimes(2);expect(outer).toHaveBeenCalledTimes(2);expect(anti).toHaveBeenCalledTimes(2);
  expect(memo).toEqual(await scanTradeSetup2Window({...scan,useMemo:false}));
  expect(new Set(memo.map(s=>s.setupKey)).size).toBe(2);
 }finally{outer.mockRestore();current.mockRestore();target.mockRestore();anti.mockRestore();}
});
