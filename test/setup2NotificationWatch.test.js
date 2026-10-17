import {it,expect,vi} from 'vitest';
const ctx=vi.hoisted(()=>({handler:null,client:null}));
vi.mock('../supabase/functions/_shared/setup2Http.ts',()=>({db:()=>ctx.client,env:()=> 'local-watch-token',headers:{},
 checked:r=>{if(r.error)throw new Error('Database transaction failed');return r.data;},
 json:(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})}));
const now=Date.parse('2026-10-07T11:00:00Z');
it.each([{historyFailure:false,legacyQueued:false},{historyFailure:true,legacyQueued:false},{historyFailure:false,legacyQueued:true},
 {historyFailure:false,legacyQueued:false,stateWarning:'DR GBPUSD:setup1:13590: Lifecycle-Historie fehlt oder ist lueckenhaft'},
 {historyFailure:false,legacyQueued:false,stateWarning:'Suspendierte DRs GBPUSD:setup1:13590: Lifecycle-Historie konnte nicht ermittelt werden (fehlend oder lückenhaft)'},
 {historyFailure:false,legacyQueued:false,realError:'Watcher database POST rpc/setup2_store_live_evidence instrument=GBPUSD: response headers, HTTP 400 (P0001), 121ms'}])('safe DR history never triggers external notification: %j',async ({historyFailure,legacyQueued,stateWarning,realError})=>{
 vi.resetModules();const writes=[],calls=[],net=vi.fn(async()=>new Response(JSON.stringify({status:1}),{status:200}));
 const server={provider_checked_at:new Date(now-30000).toISOString(),watch_checked_at:new Date(now-10000).toISOString(),provider_error:null};
 let storedEvent; const legacyEvent={id:'health:GBPUSD:legacy',kind:'problem',instrument:'GBPUSD',payload:{message:'Suspendierte DRs GBPUSD:setup1:13590: Lifecycle-Historie konnte nicht ermittelt werden (fehlend oder lückenhaft)'}};
 storedEvent=legacyEvent; const rows=[{instrument:'GBPUSD',enabled:true,state:{...((stateWarning||realError)?{error:stateWarning||realError}:{}),lastSuccessAt:new Date(now-20000).toISOString(),nextExpectedCheck:new Date(now+60000).toISOString(),activeRanges:[],lastM5Time:now/1000-300,evaluatedThrough:new Date(now-20000).toISOString(),suspendedRanges:[{setupKey:'DR13590',direction:'short'}]}}];
 ctx.client={from:table=>{
  const query={select:()=>query,eq:()=>query,neq:()=>query,in:()=>query,order:()=>query,limit:()=>query,lt:()=>query,single:()=>query,
   update:value=>{writes.push({table,value,mode:'update'});return query;},
   upsert:value=>{writes.push({table,value,mode:'upsert'});query.failure=historyFailure;return query;},
   then:resolve=>resolve({data:table==='setup2_live_state'?rows:table==='trading_schedules'?[{instrument:'GBPUSD',trading_windows:{weekday:[[0,1440]],saturday:[],sunday:[]}}]:table==='pushover_test_limits'?server:table==='setup2_alarm_events'?storedEvent:[],error:query.failure?'db failure':null})};
  calls.push(table);return query;
 },rpc:vi.fn(async (name,args)=>{if(name==='setup2_record_problem')storedEvent={id:args.p_id,kind:'problem',instrument:args.p_instrument,payload:args.p_payload};return {data:name==='setup2_claim_notifications' && (legacyQueued||stateWarning||realError)?[{id:1,event_id:storedEvent.id,channel:'pushover'}]:[],error:null};})};
 vi.stubGlobal('Deno',{serve:handler=>ctx.handler=handler});vi.stubGlobal('fetch',net);
 const clock=vi.spyOn(Date,'now').mockReturnValue(now);
 try{
  await import('../supabase/functions/setup2-notification-watch/index.ts');
  const response=await ctx.handler(new Request('https://watcher.test',{method:'POST',headers:{Authorization:'Bearer local-watch-token'}}));
  expect(response.status).toBe(historyFailure?503:200);expect(net).toHaveBeenCalledTimes(realError?1:0);
  expect(writes.find(w=>w.table==='setup2_alarm_events').value).toMatchObject({setup_key:'DR13590',payload:{category:'range-warning'}});
  expect(writes.some(w=>w.table==='setup2_notification_outbox' && w.mode==='upsert')).toBe(false);
  if(legacyQueued||stateWarning)expect(writes.find(w=>w.table==='setup2_notification_outbox').value).toMatchObject({status:'suppressed'});
  expect(ctx.client.rpc.mock.calls.some(([name])=>name==='setup2_record_problem')).toBe(!!(stateWarning||realError));
  if(stateWarning)expect(storedEvent.payload.category).toBe('range-warning');
  if(realError){expect(storedEvent.payload.category).toBeUndefined();expect(writes.find(w=>w.table==='setup2_notification_outbox').value.status).toBe('accepted');}
  expect(writes.some(w=>w.table==='pushover_test_limits' && w.value.watch_checked_at)).toBe(!historyFailure);
 }finally{clock.mockRestore();vi.unstubAllGlobals();}
});
