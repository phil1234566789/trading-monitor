import {it,expect,vi} from 'vitest';
import {recoveryHealthReady} from '../supabase/functions/_shared/setup2Recovery.js';
import {sendTelegram,telegramText} from '../supabase/functions/_shared/setup2Notifications.js';
vi.mock('../src/supabaseClient.js',()=>({supabase:{}}));
import {setup2AlarmRow} from '../src/algoWatcher.js';
const ctx=vi.hoisted(()=>({handler:null,client:null}));
vi.mock('../supabase/functions/_shared/setup2Http.ts',()=>({db:()=>ctx.client,env:()=> 'test-token',headers:{},
 checked:r=>{if(r.error)throw new Error('Database transaction failed');return r.data;},
 json:(data,status=200)=>new Response(JSON.stringify(data),{status})}));
const now=Date.parse('2026-10-08T06:00:00Z');
const at=offset=>new Date(now+offset).toISOString();
const recovery={id:'recovery:problem-1',instrument:'GBPUSD',kind:'recovery',stage:0,
 payload:{incidentId:'problem-1',reportedAt:at(-120000),recoveredAt:at(-30000)}};
const healthy={state:'live',actionRequired:false,instruments:[{enabled:true,lastSuccessAt:at(-30000),stale:false,error:null}]};
it('requires actual success after the reported incident, including every enabled instrument',()=>{
 expect(recoveryHealthReady(healthy,recovery.payload.reportedAt)).toBe(true);
 expect(recoveryHealthReady({...healthy,state:'waiting'},recovery.payload.reportedAt)).toBe(true);
 for(const instrument of [{lastSuccessAt:null},{lastSuccessAt:at(-130000)},{stale:true},{error:'feed failed'}])
  expect(recoveryHealthReady({...healthy,instruments:[...healthy.instruments,{...healthy.instruments[0],...instrument}]},recovery.payload.reportedAt)).toBe(false);
 for(const state of ['off','error'])expect(recoveryHealthReady({...healthy,state})).toBe(false);
 expect(recoveryHealthReady({...healthy,actionRequired:true})).toBe(false);
 expect(recoveryHealthReady({...healthy,instruments:[]})).toBe(false);
});
it('formats a recovery as Telegram recovery, and preserves definitive rejection vs unknown acceptance',async()=>{
 expect(telegramText(recovery,null)).toContain('Watcher läuft wieder; kein Eingreifen nötig');
 expect(telegramText(recovery,null)).toContain('Incident: problem-1');
 const env=()=> 'secret',net=vi.fn(async()=>new Response('{"ok":true}'));
 await sendTelegram(recovery,null,env,net);
 expect(net.mock.calls[0][0]).toContain('api.telegram.org');
 expect(JSON.parse(net.mock.calls[0][1].body).text).not.toContain('Alarm-Protokoll prüfen');
 await expect(sendTelegram(recovery,null,env,async()=>new Response('{"ok":false}',{status:429}))).rejects.toThrow('rejected');
 await expect(sendTelegram(recovery,null,env,async()=>{throw new Error('secret URL');})).rejects.toThrow('acceptance unknown');
});
it('shows persistent incident and actual send state in the protocol',()=>{
 const row=setup2AlarmRow({...recovery,payload:{...recovery.payload,message:'Watcher läuft wieder; kein Eingreifen nötig',delivery:{status:'accepted',acceptedAt:at(-1000)}}});
 expect(row.typeLabel).toBe('Algo-Entwarnung');expect(row.detail).toContain('Incident problem-1');
 expect(row.notifiedAt).toBe(at(-1000));expect(row.deliveryLabel).toBe('Telegram · accepted');
});
it.each([
 {mode:'accepted',expected:'accepted',sends:1},
 {mode:'rejected',expected:'failed',sends:1},
 {mode:'timeout',expected:'uncertain',sends:1},
 {mode:'unhealthy',expected:'pending',sends:0},
 {mode:'process-only',expected:'pending',sends:0},
 {mode:'superseded',expected:'suppressed',sends:0},
 {mode:'database-failed',expected:null,sends:0}
])('recovery dispatcher respects real health, retries and superseding incidents: $mode',async({mode,expected,sends})=>{
 vi.resetModules();const writes=[],readQueries=[];
 const server={provider_checked_at:at(-30000),watch_checked_at:at(-10000),provider_error:null};
 const rows=[{instrument:'GBPUSD',enabled:true,state:{lastSuccessAt:mode==='process-only'?null:at(-30000),
  lastProcessAt:at(-1000),nextExpectedCheck:at(60000),error:mode==='unhealthy'?'feed delayed':null}}];
 ctx.client={from:table=>{
  const query={select:value=>{readQueries.push(value);return query;},eq:()=>query,neq:()=>query,in:()=>query,order:()=>query,
   limit:()=>query,lt:()=>query,single:()=>query,upsert:()=>query,
   update:value=>{writes.push({table,value});return query;},
   then:resolve=>resolve({data:table==='setup2_live_state'?rows:table==='trading_schedules'?[{instrument:'GBPUSD',trading_windows:{weekday:[[0,1440]],saturday:[],sunday:[]}}]:table==='pushover_test_limits'?server:table==='setup2_alarm_events'?recovery:[],error:null})};
  return query;
 },rpc:vi.fn(async name=>({data:name==='setup2_claim_notifications'?[{id:7,event_id:recovery.id,channel:'telegram',attempts:1}]:name==='setup2_recovery_status'?mode==='superseded'?'superseded':'ready':null,error:mode==='database-failed' && name==='setup2_prepare_recovery'?'failed':null}))};
 const net=vi.fn(async()=>{if(mode==='timeout')throw new Error('timeout');return new Response(mode==='rejected'?'{"ok":false}':'{"ok":true}',{status:mode==='rejected'?429:200});});
 vi.stubGlobal('Deno',{serve:handler=>ctx.handler=handler});vi.stubGlobal('fetch',net);
 const clock=vi.spyOn(Date,'now').mockReturnValue(now);
 try {
  await import('../supabase/functions/setup2-notification-watch/index.ts');
  const response=await ctx.handler(new Request('https://watcher.test',{method:'POST',headers:{Authorization:'Bearer test-token'}}));
  expect(response.status).toBe(mode==='database-failed'?503:200);expect(net).toHaveBeenCalledTimes(sends);
  if(sends)expect(net.mock.calls[0][0]).toContain('api.telegram.org');
  const write=writes.find(w=>w.table==='setup2_notification_outbox')?.value;
  if(expected)expect(write.status).toBe(expected);else expect(write).toBeUndefined();
  if(expected==='failed' || expected==='pending')expect(Date.parse(write.retry_after)).toBe(now+60000);
  if(expected==='pending')expect(write.attempts).toBe(0);
  if(expected==='uncertain')expect(write.retry_after).toBeNull();
  expect(ctx.client.rpc.mock.calls.some(([name])=>name==='setup2_record_problem')).toBe(mode==='unhealthy');
  expect(readQueries).toContain('status,error,provider_accepted_at,setup2_alarm_events!inner(kind)');
 }finally{clock.mockRestore();vi.unstubAllGlobals();}
});
