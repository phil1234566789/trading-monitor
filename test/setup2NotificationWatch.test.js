import {it,expect,vi} from 'vitest';
const ctx=vi.hoisted(()=>({handler:null,client:null}));
vi.mock('../supabase/functions/_shared/setup2Http.ts',()=>({db:()=>ctx.client,env:()=> 'local-watch-token',headers:{},
 checked:r=>{if(r.error)throw new Error('Database transaction failed');return r.data;},
 json:(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})}));
const now=Date.parse('2026-10-07T11:00:00Z');
it.each([{historyFailure:false,legacyQueued:false},{historyFailure:true,legacyQueued:false},{historyFailure:false,legacyQueued:true}])('safe DR history never triggers external notification: %j',async ({historyFailure,legacyQueued})=>{
 vi.resetModules();const writes=[],calls=[],net=vi.fn();
 const server={provider_checked_at:new Date(now-30000).toISOString(),watch_checked_at:new Date(now-10000).toISOString(),provider_error:null};
 const legacyEvent={id:'health:GBPUSD:legacy',kind:'problem',instrument:'GBPUSD',payload:{message:'Suspendierte DRs GBPUSD:setup1:13590: Lifecycle-Historie konnte nicht ermittelt werden (fehlend oder lückenhaft)'}};
 const rows=[{instrument:'GBPUSD',enabled:true,state:{lastSuccessAt:new Date(now-20000).toISOString(),nextExpectedCheck:new Date(now+60000).toISOString(),activeRanges:[],suspendedRanges:[{setupKey:'DR13590',direction:'short'}]}}];
 ctx.client={from:table=>{
  const query={select:()=>query,eq:()=>query,neq:()=>query,in:()=>query,order:()=>query,limit:()=>query,lt:()=>query,single:()=>query,
   update:value=>{writes.push({table,value,mode:'update'});return query;},
   upsert:value=>{writes.push({table,value,mode:'upsert'});query.failure=historyFailure;return query;},
   then:resolve=>resolve({data:table==='setup2_live_state'?rows:table==='trading_schedules'?[{instrument:'GBPUSD',trading_windows:{weekday:[[0,1440]],saturday:[],sunday:[]}}]:table==='pushover_test_limits'?server:table==='setup2_alarm_events'?legacyEvent:[],error:query.failure?'db failure':null})};
  calls.push(table);return query;
 },rpc:vi.fn(async name=>({data:name==='setup2_claim_notifications' && legacyQueued?[{id:1,event_id:legacyEvent.id,channel:'pushover'}]:[],error:null}))};
 vi.stubGlobal('Deno',{serve:handler=>ctx.handler=handler});vi.stubGlobal('fetch',net);
 const clock=vi.spyOn(Date,'now').mockReturnValue(now);
 try{
  await import('../supabase/functions/setup2-notification-watch/index.ts');
  const response=await ctx.handler(new Request('https://watcher.test',{method:'POST',headers:{Authorization:'Bearer local-watch-token'}}));
  expect(response.status).toBe(historyFailure?503:200);expect(net).not.toHaveBeenCalled();
  expect(writes.find(w=>w.table==='setup2_alarm_events').value).toMatchObject({setup_key:'DR13590',payload:{category:'range-warning'}});
  expect(writes.some(w=>w.table==='setup2_notification_outbox' && w.mode==='upsert')).toBe(false);
  if(legacyQueued)expect(writes.find(w=>w.table==='setup2_notification_outbox').value).toMatchObject({status:'suppressed'});
  expect(ctx.client.rpc.mock.calls.some(([name])=>name==='setup2_record_problem')).toBe(false);
  expect(writes.some(w=>w.table==='pushover_test_limits' && w.value.watch_checked_at)).toBe(!historyFailure);
 }finally{clock.mockRestore();vi.unstubAllGlobals();}
});
