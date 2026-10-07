import {it,expect,vi} from 'vitest';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import {setup1RecognitionTime} from '../src/setup1RecognitionTime.js';
const iso=t=>new Date(t*1000).toISOString();
it.each([{feedFailure:false,legacy:false},{feedFailure:true,legacy:false},{feedFailure:false,legacy:true}])('T68 retains suspended DR watermark independently: %j',async ({feedFailure,legacy})=>{
 vi.resetModules();
 const source=fixture.setups[0],closed=source.createdAt+1200,watermark=iso(closed-120),checkpoints=[];
 const retained={...source,tradeSetupId:13590},snapshot={setupKey:'GBPUSD:setup1:13590',direction:'short',dealingRange:{status:'validated'},rangeCourse:{lifecycle:{main:{state:'unknown'}}}};
 const scan=vi.fn(async input=>{expect(input.tradeSetups).toContainEqual(retained);expect(input.fromTime).toBe(legacy?setup1RecognitionTime(retained):closed-240);input.onSnapshot(snapshot);return [snapshot];});
 vi.doMock('../src/tradeSetup2Scan.js',()=>({scanTradeSetup2Window:scan}));
 const rows={'1D':fixture.dailyCandles,'1h':fixture.h1Candles,'5m':[{time:closed-300,open:1,high:1,low:1,close:1}], '1m':[{time:closed-60,open:1,high:1,low:1,close:1}]};
 vi.stubGlobal('fetch',async(input,options={})=>{
  const url=new URL(input),table=url.pathname.split('/').at(-1),query=url.searchParams;let body=[];
  if(table==='setup2_acquire_lease')body=true;
  else if(table==='setup2_checkpoint'){checkpoints.push(JSON.parse(options.body));body=null;}
  else if(table==='setup2-notification-watch')body={};
  else if(Number(query.get('offset'))>0)body=[];
  else if(table==='setup2_live_state')body=[{instrument:'GBPUSD',enabled:true,state:{runtimeVersion:'live-minute-v2',evaluatedThrough:query.has('instrument')?watermark:iso(closed-600),lastSuccessAt:watermark,error:'previous gap',suspendedRanges:[{setupKey:snapshot.setupKey,source:retained,evaluatedThrough:legacy?undefined:iso(closed-300)}],activeRanges:[]}}];
  else if(table==='trading_schedules')body=[{instrument:'GBPUSD',trading_windows:{weekday:[[0,1440]],saturday:[],sunday:[]}}];
  else if(table==='fxcm_candles'){const from=Date.parse(query.get('time').slice(4))/1000;body=rows[query.get('bar').slice(3)].filter(c=>c.time>=from).map(c=>({...c,time:iso(c.time)}));}
  else if(!['sessions','news_events','trade_setups'].includes(table))throw new Error(`Unexpected mock route ${table}`);
  return new Response(JSON.stringify(body),{status:200});
 });
 vi.stubEnv('SUPABASE_URL','https://watcher.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','local-test-key');vi.stubEnv('SETUP2_WATCH_TOKEN','local-test-watch');vi.stubEnv('WATCHER_ONCE','1');
 const clock=vi.spyOn(Date,'now').mockReturnValue((closed+(feedFailure?200:20))*1000),log=vi.spyOn(console,'log').mockImplementation(()=>{});
 try{
  await import('../services/setup2/runner.mjs');
  expect(scan).toHaveBeenCalled();expect(checkpoints).toHaveLength(1);
  const state=checkpoints[0].p_state;
  expect(state.evaluatedThrough).toBe(feedFailure?watermark:iso(closed));expect(state.lastSuccessAt).toBe(feedFailure?watermark:iso(closed+20));
  expect(state.activeRanges).toEqual([]);expect(state.suspendedRanges).toMatchObject([{setupKey:snapshot.setupKey,direction:'short',source:retained,evaluatedThrough:legacy?iso(setup1RecognitionTime(retained)-60):iso(closed-300)}]);
  expect(checkpoints[0].p_events.filter(e=>e.kind==='trading')).toEqual([]);
  if(feedFailure)expect(checkpoints[0].p_events).toMatchObject([{kind:'problem',payload:{message:expect.stringContaining('FXCM-M1-Feed')}}]);else expect(checkpoints[0].p_events).toEqual([]);
  if(feedFailure)expect(state.error).toContain('FXCM-M1-Feed');else expect(state.error).toBeNull();
 }finally{clock.mockRestore();log.mockRestore();vi.doUnmock('../src/tradeSetup2Scan.js');vi.unstubAllGlobals();vi.unstubAllEnvs();}
});
