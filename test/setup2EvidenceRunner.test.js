import {it,expect,vi} from 'vitest';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
const iso=t=>new Date(t*1000).toISOString();
it('checkpoints finalized scanner output atomically with the original entry and actual versioned inputs',async()=>{
 vi.resetModules();const source=fixture.setups[0],closed=source.createdAt+1200,checkpoints=[];
 const original={schemaVersion:3,id:'original-entry',setupKey:'GBPUSD:setup1:1',instrument:'GBPUSD',direction:'short',knownAt:closed,
  entry:{id:'original-entry',recognizedAt:closed,price:1.2},checklist:{evaluatedAt:closed,checks:{entry:{status:'passed'}}}};
 vi.doMock('../src/tradeSetup2Scan.js',()=>({scanTradeSetup2Window:async input=>{
  input.onSnapshot(original);return [{...original,checklistHistory:{entries:[{knownAt:closed}]},priceObservation:{rawThrough:closed},rangeCourse:{lifecycle:{evaluatedAt:closed}}}];
 }}));
 const rows={'1D':fixture.dailyCandles,'1h':fixture.h1Candles,'5m':[{time:closed-300,open:1,high:1,low:1,close:1}], '1m':[{time:closed-60,open:1,high:1,low:1,close:1}]};
 vi.stubGlobal('fetch',async(input,options={})=>{
  const url=new URL(input),table=url.pathname.split('/').at(-1),query=url.searchParams;let body=[];
  if(table==='setup2_acquire_lease')body=true;
  else if(table==='setup2_checkpoint_with_evidence'){checkpoints.push(JSON.parse(options.body));body=null;}
  else if(table==='setup2-notification-watch')body={};
  else if(Number(query.get('offset'))>0)body=[];
  else if(table==='setup2_live_state')body=[{instrument:'GBPUSD',enabled:true,state:{runtimeVersion:'live-minute-v2',evaluatedThrough:iso(closed-60),activeRanges:[],suspendedRanges:[]}}];
  else if(table==='trading_schedules')body=[{instrument:'GBPUSD',trading_windows:{weekday:[[0,1440]],saturday:[],sunday:[]}}];
  else if(table==='fxcm_candles'){const from=Date.parse(query.get('time').slice(4))/1000;body=rows[query.get('bar').slice(3)].filter(c=>c.time>=from).map(c=>({...c,time:iso(c.time)}));}
  else if(!['sessions','news_events','trade_setups'].includes(table))throw new Error(`Unexpected route ${table}`);
  return new Response(JSON.stringify(body),{status:200});
 });
 vi.stubEnv('SUPABASE_URL','https://watcher.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','local-test');vi.stubEnv('SETUP2_WATCH_TOKEN','local-test');vi.stubEnv('WATCHER_ONCE','1');
 const clock=vi.spyOn(Date,'now').mockReturnValue((closed+20)*1000),log=vi.spyOn(console,'log').mockImplementation(()=>{});
 try{
  await import('../services/setup2/runner.mjs');expect(checkpoints).toHaveLength(1);
  const body=checkpoints[0],batch=body.p_evidence[0];expect(body.p_state.entries[0].entry.id).toBe('original-entry');
  expect(batch.snapshots[0].snapshot).toEqual(original);expect(batch.snapshots[0].observation).toHaveProperty('checklistHistory.entries');
  expect(batch.configuration.configuration).toMatchObject({instrument:'GBPUSD',setupVersion:expect.any(String),entryPattern:expect.any(String),m1Period:5,sessions:[],news:[]});
  expect(body.p_events).toEqual([]);
 }finally{clock.mockRestore();log.mockRestore();vi.doUnmock('../src/tradeSetup2Scan.js');vi.unstubAllGlobals();vi.unstubAllEnvs();}
});
