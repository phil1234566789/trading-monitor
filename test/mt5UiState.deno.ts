import assert from 'node:assert/strict';
import {readMt5UiState} from '../supabase/functions/trading-monitor-mcp/mt5UiState.ts';
import {riskPolicyDay} from '../supabase/functions/trading-monitor-mcp/riskPolicyContext.js';

Deno.test('private UI sections and activity each use one read RPC and retain authentication',async()=>{
 const originalFetch=globalThis.fetch,serve=Deno.serve;
 const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',MT5_EXECUTION_ENABLED:'true',MT5_ALLOW_LIVE:'false',MT5_CONTROL_TOKEN:'ui-test-token'};
 const oldEnv=Object.keys(env).map(k=>Deno.env.get(k));for(const [key,value] of Object.entries(env))Deno.env.set(key,value);
 const revisions={catalog:1,snapshots:2,orders:3,guards:4,balances:5,plans:6},calls:string[][]=[];
 const now=Math.floor(Date.now()/1000),day=riskPolicyDay(now),snapshot={risk_guards_ready:true,hedging:true,risk:{day:day.day,time:now}};
 const bridge={heartbeat_at:new Date().toISOString(),snapshot};
 globalThis.fetch=(async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:input.toString());assert.ok(url.pathname.endsWith('/rpc/mt5_read_ui_state'));
  const fields=JSON.parse(String(init?.body));calls.push(fields.p_sections);
  const state:any={revisions};
  if(fields.p_sections.includes('catalog')){state.accounts=[{id:'a',login:42,server:'Demo'}];state.active_account_id='a';state.account_statuses={a:{risk_policy:{day:'old',risk_base:50000}}};}
  if(fields.p_sections.includes('snapshots'))state.account_statuses={a:{...state.account_statuses?.a,bridge,online:true}};
  if(fields.p_sections.includes('guards'))state.account_statuses={a:{...state.account_statuses?.a,_guard_bridge:bridge,daily_stop:{latched:false,daily_loss_limit:1000}}};
  return Response.json(state);
 }) as typeof fetch;
 try{
  const activity=await readMt5UiState({action:'ui_activity'});assert.deepEqual(activity,{revisions});assert.deepEqual(calls,[[]]);
  const boot:any=await readMt5UiState({action:'ui_state',sections:['catalog','snapshots','orders','guards','health','balances']});
  assert.equal(calls.length,2);assert.equal(boot.account_statuses.a.risk_policy.day,day.day);assert.equal(boot.account_statuses.a.daily_stop.daily_stop_ready,true);assert.equal(Object.hasOwn(boot.account_statuses.a,'_guard_bridge'),false);
  assert.equal(boot.execution_enabled,true);assert.equal(boot.server_live_allowed,false);
  const guards:any=await readMt5UiState({action:'ui_state',sections:['guards']});assert.equal(guards.account_statuses.a.daily_stop.daily_stop_ready,true);assert.equal(Object.hasOwn(guards.account_statuses.a,'bridge'),false);
  const snapshots:any=await readMt5UiState({action:'ui_state',sections:['snapshots']});assert.equal(Object.hasOwn(snapshots.account_statuses.a,'risk_policy'),false);assert.equal(Object.hasOwn(snapshots.account_statuses.a,'daily_stop'),false);
  const before=calls.length;
  for(const sections of [undefined,'catalog',['secret'],Array(7).fill('catalog')])await assert.rejects(()=>readMt5UiState({action:'ui_state',sections}));assert.equal(calls.length,before);
  let handler:any;Deno.serve=((value:any)=>{handler=value;return {};}) as typeof Deno.serve;await import('../supabase/functions/mt5-control/index.ts');
  const request=(token:string,fields:any,origin='')=>new Request('https://control.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(fields)});
  assert.equal((await handler(request('bad',{action:'ui_activity'}))).status,401);assert.equal(calls.length,before);
  assert.equal((await handler(request('ui-test-token',{action:'ui_activity'},'https://untrusted.invalid'))).status,403);assert.equal(calls.length,before);
  const response=await handler(request('ui-test-token',{action:'ui_activity'}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{revisions});assert.equal(calls.length,before+1);
 }finally{globalThis.fetch=originalFetch;Deno.serve=serve;Object.keys(env).forEach((k,i)=>oldEnv[i]==null?Deno.env.delete(k):Deno.env.set(k,oldEnv[i]!));}
});
