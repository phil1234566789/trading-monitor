import {it,expect,vi} from 'vitest';
const ctx=vi.hoisted(()=>({handler:null,client:null}));
vi.mock('../supabase/functions/_shared/setup2Http.ts',()=>({db:()=>ctx.client,env:()=> 'test-token',headers:{},
 checked:r=>{if(r.error)throw new Error('Database transaction failed');return r.data;},
 json:(data,status=200)=>new Response(JSON.stringify(data),{status})}));
const now=Date.parse('2026-10-19T14:00:00+02:00'),at=seconds=>new Date(now+seconds*1000).toISOString();
it.each([
 {mode:'critical',kind:'problem',category:'operational-critical',critical:true,expected:'accepted',sends:1},
 {mode:'outside-hours',kind:'problem',category:'operational-critical',critical:true,expected:'pending',sends:0},
 {mode:'recovery-outside-hours',kind:'recovery',category:'operational-recovery',critical:false,expected:'pending',sends:0},
 {mode:'timeout',kind:'problem',category:'operational-critical',critical:true,expected:'uncertain',sends:1},
 {mode:'obsolete',kind:'problem',category:'operational-critical',critical:true,expected:'suppressed',sends:0},
 {mode:'recovered',kind:'problem',category:'operational-critical',critical:false,expected:'pending',sends:0},
 {mode:'provider-change',kind:'problem',category:null,critical:false,expected:'suppressed',sends:1},
 {mode:'old-problem',kind:'problem',category:null,critical:true,expected:'suppressed',sends:0},
 {mode:'old-recovery',kind:'recovery',category:null,critical:false,expected:'suppressed',sends:0}
])('operational delivery boundary $mode has no legacy spam or blind resend',async({mode,kind,category,critical,expected,sends})=>{
 vi.resetModules();let claimed=false;const writes=[];
 const event={id:'operational:test',instrument:'GBPUSD',stage:0,kind,payload:{category,message:'Marktbeobachtung ausgefallen',
  action:'Beobachtung selbst übernehmen',affected:['GBPUSD','EURUSD'],openedAt:at(-500),lastSuccessAt:at(-600)}};
 const state={lastSuccessAt:at(critical?-600:-20),evaluatedThrough:at(critical?-660:-60),nextExpectedCheck:at(critical?-600:12),activeRanges:[{setupKey:'test'}]};
 const server={watch_checked_at:at(-10),provider_checked_at:at(mode==='provider-change'?-301:-30),provider_error:mode==='provider-change'?'old failure':null,provider_error_since:mode==='provider-change'?at(-600):null};
 ctx.client={from:table=>{
  const query={select:()=>query,eq:()=>query,neq:()=>query,in:()=>query,order:()=>query,limit:()=>query,lt:()=>query,single:()=>query,
   update:value=>{writes.push({table,value});if(table==='pushover_test_limits')Object.assign(server,value);return query;},upsert:value=>{writes.push({table,value,upsert:true});return query;},
   then:resolve=>resolve({data:table==='setup2_live_state'?[{instrument:'GBPUSD',enabled:true,state}]:table==='trading_schedules'?[{instrument:'GBPUSD',trading_windows:{weekday:mode.includes('outside-hours')?[[480,600]]:[[0,1440]],saturday:[],sunday:[]}}]:table==='pushover_test_limits'?server:table==='setup2_alarm_events'?event:[],error:null})};return query;
 },rpc:vi.fn(async(name)=>{
  if(name==='setup2_claim_notifications'){if(claimed)return {data:[],error:null};claimed=true;return {data:[{id:1,event_id:event.id,channel:'pushover',attempts:1}],error:null};}
  return {data:name==='setup2_operational_incident_status'?mode==='obsolete'?'superseded':mode==='recovery-outside-hours'?'ready':'critical':null,error:null};
 })};
 const net=vi.fn(async()=>{if(mode==='timeout'||mode==='provider-change')throw new Error('new transport failure');return new Response('{"status":1}');});
 vi.stubGlobal('Deno',{serve:handler=>ctx.handler=handler});vi.stubGlobal('fetch',net);const clock=vi.spyOn(Date,'now').mockReturnValue(now);
 try{
  await import('../supabase/functions/setup2-notification-watch/index.ts');
  for(let i=0;i<2;i++)expect((await ctx.handler(new Request('https://watcher.test',{method:'POST',headers:{Authorization:'Bearer test-token'}}))).status).toBe(200);
  expect(net).toHaveBeenCalledTimes(sends);
  const result=writes.find(w=>w.table==='setup2_notification_outbox'&&!w.upsert)?.value;
  expect(result.status).toBe(expected);
  if(mode.includes('outside-hours'))expect(ctx.client.rpc.mock.calls.find(([name])=>name==='setup2_update_operational_incident')[1].p_critical).toBe(false);
  if(mode==='timeout')expect(result.retry_after).toBeNull();
  if(mode==='recovered'){expect(result.attempts).toBe(0);expect(result.retry_after).toBe(at(60));}
  if(mode==='provider-change'){expect(server.provider_error_since).toBe(at(-600));expect(ctx.client.rpc.mock.calls.find(([name])=>name==='setup2_update_operational_incident')[1].p_critical).toBe(true);}
  if(mode==='critical'){
   const message=net.mock.calls[0][1].body.get('message');
   expect(message).toContain('GBPUSD, EURUSD');expect(message).toContain('Als kritisch erkannt');
   expect(message).toContain('Beobachtung selbst übernehmen');expect(message).not.toContain('VPS-Dienst');
  }
 }finally{clock.mockRestore();vi.unstubAllGlobals();}
});
