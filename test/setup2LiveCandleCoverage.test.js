import {it,expect,vi} from 'vitest';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
const iso=t=>new Date(t*1000).toISOString();
it('T77 keeps the loaded M1 prefix when lazy candidates request later history',async()=>{
 vi.resetModules();
 const source=fixture.setups[1],closed=Math.ceil(source.createdAt/300)*300+1200;
 const first=Math.min(source.obStartTime,source.ls.touchedTime)-131*60;
 const native=Array.from({length:(closed-first+600)/60},(_,i)=>({time:first-600+i*60,open:1,high:1,low:1,close:1}));
 const historyRequests=[],checkpoints=[],loaded=[];
 const scan=vi.fn(async input=>{
  const before=input.m1Candles;
  const later=await input.loadM1Candles({structureFromTime:source.obStartTime});
  const earlier=await input.loadM1Candles({structureFromTime:source.ls.touchedTime});
  const expanded=await input.loadM1Candles({structureFromTime:source.ls.touchedTime-600});
  loaded.push({before,later,earlier,expanded});

  return [];
 });
 vi.doMock('../src/tradeSetup2Scan.js',()=>({scanTradeSetup2Window:scan}));
 const state={runtimeVersion:'live-minute-v2',evaluatedThrough:iso(closed-60),lastSuccessAt:iso(closed-60),
  suspendedRanges:[],activeRanges:[{source}]};
 const rows={'1D':fixture.dailyCandles,'1h':fixture.h1Candles,'5m':[{time:closed-300,open:1,high:1,low:1,close:1}],'1m':native};
 vi.stubGlobal('fetch',async(input,options={})=>{
  const url=new URL(input),table=url.pathname.split('/').at(-1),query=url.searchParams;let body=[];
  if(table==='setup2_acquire_lease')body=true;
  else if(table==='setup2_checkpoint'){checkpoints.push(JSON.parse(options.body));body=null;}
  else if(table==='setup2-notification-watch')body={};
  else if(table==='setup2_live_state')body=Number(query.get('offset'))?[]:[{instrument:'GBPUSD',enabled:true,state}];
  else if(table==='trading_schedules')body=Number(query.get('offset'))?[]:[{instrument:'GBPUSD',trading_windows:{weekday:[[0,1440]],saturday:[],sunday:[]}}];
  else if(table==='fxcm_candles'){
   const bar=query.get('bar').slice(3),from=Date.parse(query.get('time').slice(4))/1000,offset=Number(query.get('offset')??0);
   if(bar==='1m' && offset===0)historyRequests.push(from);
   body=rows[bar].filter(c=>c.time>=from).slice(offset,offset+1000).map(c=>({...c,time:iso(c.time)}));
  }else if(!['sessions','news_events','trade_setups'].includes(table))throw new Error(`Unexpected route ${table}`);
  return new Response(JSON.stringify(body),{status:200});
 });
 vi.stubEnv('SUPABASE_URL','https://watcher.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','local-test-key');vi.stubEnv('SETUP2_WATCH_TOKEN','local-test-watch');vi.stubEnv('WATCHER_ONCE','1');
 const clock=vi.spyOn(Date,'now').mockReturnValue((closed+20)*1000),log=vi.spyOn(console,'log').mockImplementation(()=>{}),error=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{
  await import('../services/setup2/runner.mjs');
  expect(scan).toHaveBeenCalledTimes(1);
  expect(checkpoints).toHaveLength(1);expect(checkpoints[0].p_state.error).toBeNull();
  expect(historyRequests.filter(from=>from<=first)).toEqual([first,first-600]);
  expect(loaded[0].later).toEqual(native.filter(c=>c.time>=first));expect(loaded[0].earlier).toEqual(native.filter(c=>c.time>=first));expect(loaded[0].earlier).toBe(loaded[0].before);
  expect(loaded[0].expanded).toEqual(native);expect(loaded[0].expanded).not.toBe(loaded[0].before);
  expect(checkpoints[0].p_state.evaluatedThrough).toBe(iso(closed));
 }finally{clock.mockRestore();log.mockRestore();error.mockRestore();vi.doUnmock('../src/tradeSetup2Scan.js');vi.unstubAllGlobals();vi.unstubAllEnvs();}
});
