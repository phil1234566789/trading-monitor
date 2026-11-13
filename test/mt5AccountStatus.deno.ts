import assert from 'node:assert/strict';
import {getAccountExecutionStatus,getExecutionStatus} from '../supabase/functions/trading-monitor-mcp/mt5Execution.ts';
import {riskPolicyDay} from '../supabase/functions/trading-monitor-mcp/riskPolicyContext.js';

Deno.test('thin account status preserves bound broker and guard data without repeating global reads',async()=>{
 const originalFetch=globalThis.fetch,env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',MT5_EXECUTION_ENABLED:'true',MT5_ALLOW_LIVE:'false'};
 Object.assign(env,{MT5_CONTROL_TOKEN:'test-control-token'});
 const previousEnv=Object.keys(env).map(k=>Deno.env.get(k));for(const [key,value] of Object.entries(env))Deno.env.set(key,value);
 const account={id:crypto.randomUUID(),login:42,server:'Demo',mode:'demo',archived:false},now=Date.now()/1000;
 const snapshot={account_login:42,account_server:'Demo',mode:'demo',risk_guards_ready:true,hedging:true,risk:{day:riskPolicyDay(now).day,time:Math.floor(now)},positions:[{ticket:123}]};
 const bridge={id:account.id,heartbeat_at:new Date().toISOString(),snapshot};
 const reads:string[]=[];
 globalThis.fetch=(async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:input.toString()),table=url.pathname.split('/').at(-1)!;
  assert.equal(init?.method??(input instanceof Request?input.method:'GET'),'GET','status must never write');reads.push(table);
  if(table==='mt5_accounts')return url.searchParams.get('id')==='eq.'+account.id?Response.json(account):Response.json({code:'PGRST116',message:'not found'},{status:406});
  if(table==='mt5_execution_settings')return Response.json({active_account_id:account.id});
  if(table==='mt5_bridge_state')return Response.json(url.searchParams.get('id')==='eq.primary'?null:bridge);
  if(table==='mt5_risk_policies'||table==='mt5_daily_stops'||table==='mt5_health_incidents')return Response.json(null);
  if(table==='mt5_guard_commands'||table==='mt5_execution_orders')return Response.json([]);
  throw new Error('Unexpected mocked table '+table);
 }) as typeof fetch;
 try{
  const thin=await getAccountExecutionStatus(account.id);
  assert.equal(reads.length,8);assert.equal(thin.bridge.snapshot.account_login,42);assert.equal(thin.online,true);assert.equal(thin.daily_stop.daily_stop_ready,true);
  for(const omitted of ['orders','health','account_balances','active_account_id'])assert.equal(Object.hasOwn(thin,omitted),false);
  assert.ok(!reads.some(t=>['mt5_execution_orders','mt5_health_incidents','mt5_account_balances','mt5_execution_settings'].includes(t)));
  reads.length=0;const full=await getExecutionStatus(undefined,account.id);
  assert.equal(reads.length,12);assert.deepEqual({...full.daily_stop,checked_at_sec:0},{...thin.daily_stop,checked_at_sec:0});assert.deepEqual(full.bridge,thin.bridge);assert.deepEqual(full.orders,[]);
  reads.length=0;await getExecutionStatus();assert.equal(reads.length,13);
  // Vergleichbare UI-Runde: Kontenkatalog3 + Primärstatus14/20inklEnvelope + zwei Zusatzstände.
  assert.equal(3+13+3+2*8,35);assert.equal(3+17+3+2*(15+3),59);
  const count=reads.length;for(const id of [undefined,'bad',42])await assert.rejects(()=>getAccountExecutionStatus(id));assert.equal(reads.length,count);
  await assert.rejects(()=>getAccountExecutionStatus(crypto.randomUUID()),/mt5_storage_unavailable/);
  for(const patch of [{account_login:43},{account_server:'Other'},{mode:'live'}]){
   const original={...snapshot};Object.assign(snapshot,patch);await assert.rejects(()=>getAccountExecutionStatus(account.id));Object.assign(snapshot,original);
  }
  const serve=Deno.serve;let handler:any;
  try{
   Deno.serve=((value:any)=>{handler=value;return {};}) as typeof Deno.serve;
   await import('../supabase/functions/mt5-control/index.ts');
   const request=(token:string,fields:any)=>new Request('https://control.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(fields)});
   const before=reads.length;assert.equal((await handler(request('bad',{action:'account_status',account_id:account.id}))).status,401);assert.equal(reads.length,before);
   const response=await handler(request('test-control-token',{action:'account_status',account_id:account.id}));assert.equal(response.status,200);
   assert.equal((await response.json()).bridge.snapshot.account_login,42);
   assert.equal((await handler(request('test-control-token',{action:'account_status'}))).status,400);
  }finally{Deno.serve=serve;}
  account.archived=true;await assert.rejects(()=>getAccountExecutionStatus(account.id),/archived_account/);
 }finally{globalThis.fetch=originalFetch;Object.keys(env).forEach((k,i)=>previousEnv[i]==null?Deno.env.delete(k):Deno.env.set(k,previousEnv[i]!));}
});
