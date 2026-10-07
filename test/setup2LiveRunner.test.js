import {it,expect,vi} from 'vitest';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import minutes from './fixtures/gbpusd-m1-entry-pattern1-97.json';
import sessions from './fixtures/gbpusd-m5-dr114-session-targets.json';
import {setup1RecognitionTime} from '../src/setup1RecognitionTime.js';
const iso=t=>new Date(t*1000).toISOString();
it('T68 restart catches a newly recognized source after persisted watermark without invalid scan window',async()=>{
 const source=fixture.setups[0],recognized=setup1RecognitionTime(source),closed=recognized+600,checkpoints=[];
 const rows={ '1D':fixture.dailyCandles.filter(c=>c.time+86400<=closed), '1h':fixture.h1Candles.filter(c=>c.time+3600<=closed),
 '5m':fixture.m5Candles.filter(c=>c.time+300<=closed),'1m':minutes.filter(c=>c.time+60<=closed)};
 const setupRow={id:source.tradeSetupId,instrument:'GBPUSD',direction:'short',source:'live',created_at:iso(source.createdAt),
 ob_top:source.obTop,ob_bottom:source.obBottom,ob_start_time:iso(source.obStartTime),ob_fvg:source.obFvg,invalidation:source.invalidation,
 ls_price:source.ls.price,ls_pivot_time:iso(source.ls.pivotTime),ls_touched_time:iso(source.ls.touchedTime),
 fractal_price:source.ls.price,fractal_pivot_time:iso(source.ls.pivotTime)};
 const fetcher=vi.fn(async(input,options={})=>{
  const url=new URL(input),table=url.pathname.split('/').at(-1),query=url.searchParams;
  let body=[];
  if(table==='setup2_acquire_lease')body=true;
  else if(table==='setup2_checkpoint'){checkpoints.push(JSON.parse(options.body));body=null;}
  else if(table==='setup2-notification-watch')body={};
  else if(Number(query.get('offset'))>0)body=[];
  else if(table==='setup2_live_state')body=[{instrument:'GBPUSD',enabled:true,state:{evaluatedThrough:iso(recognized-60),lastSuccessAt:iso(recognized-50),nextExpectedCheck:iso(recognized+12)}}];
  else if(table==='sessions')body=sessions.sessions.map(s=>({...s,from_minutes:s.fromMinutes,to_minutes:s.toMinutes}));
  else if(table==='trading_schedules')body=[{instrument:'GBPUSD',trading_windows:{weekday:[[0,1440]],saturday:[],sunday:[]}}];
  else if(table==='trade_setups')body=[setupRow];
  else if(table==='fxcm_candles'){
   const from=Date.parse(query.get('time').slice(4))/1000;
   body=rows[query.get('bar').slice(3)].filter(c=>c.time>=from).map(c=>({...c,time:iso(c.time)}));
  }
  else if(table!=='news_events')throw new Error(`Unexpected mocked route ${table}`);
  return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 });
 vi.stubEnv('SUPABASE_URL','https://watcher.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','local-test-key');
 vi.stubEnv('SETUP2_WATCH_TOKEN','local-test-watch');vi.stubEnv('WATCHER_ONCE','1');vi.stubGlobal('fetch',fetcher);
 const clock=vi.spyOn(Date,'now').mockReturnValue((closed+20)*1000),log=vi.spyOn(console,'log').mockImplementation(()=>{}),error=vi.spyOn(console,'error').mockImplementation(()=>{});
 try {
  await import('../services/setup2/runner.mjs');
  expect(checkpoints).toHaveLength(1);
  expect(checkpoints[0].p_state.error).toBeNull();
  expect(checkpoints[0].p_state.evaluatedThrough).toBe(iso(closed));
  expect(error).not.toHaveBeenCalled();
 }finally{clock.mockRestore();log.mockRestore();error.mockRestore();vi.unstubAllEnvs();vi.unstubAllGlobals();}
},30000);
