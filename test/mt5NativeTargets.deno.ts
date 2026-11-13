import assert from 'node:assert/strict';
import {targetPlanAction} from '../supabase/functions/trading-monitor-mcp/mt5TargetPlans.ts';

Deno.test('native TP requests read without creation and save only fresh account-bound broker data',async()=>{
 const oldFetch=globalThis.fetch,keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','MT5_EXECUTION_ENABLED','MT5_ALLOW_LIVE'];
 const oldEnv=keys.map(key=>Deno.env.get(key));
 for(const [key,value] of Object.entries({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',MT5_EXECUTION_ENABLED:'true',MT5_ALLOW_LIVE:'false'}))Deno.env.set(key,value);
 const account={id:'e925a364-09a6-4336-8de5-f56f6e385296',login:42,server:'Demo',mode:'demo',archived:false};
 const orderId='d925a364-09a6-4336-8de5-f56f6e385296';
 const base={account_login:42,account_server:'Demo',mode:'demo',balance:10000,equity:10000,currency:'USD',trade_allowed:true,pending_orders:0,target_plans_ready:true,execution_ready:true,
  positions:[{ticket:123,symbol:'XAUUSD',type:0,magic:0,volume:.04,price_open:2000,sl:1990,tp:0,profit:0}],
  quotes:[{symbol:'XAUUSD',bid:2001,ask:2001.1,time:Date.now()/1000,point:.01,digits:2,minimum_volume:.01,maximum_volume:100,volume_step:.01,stops_level:.01,loss_per_unit_long:100,loss_per_unit_short:100}]};
 let snapshot=structuredClone(base),heartbeat=new Date().toISOString(),subject:any=null,stored:any=null;
 const calls:{url:URL;method:string;body:any}[]=[];
 globalThis.fetch=(async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:input.toString()),method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)):null;calls.push({url,method,body});
  if(url.pathname.endsWith('mt5_accounts'))return Response.json(account);
  if(url.pathname.endsWith('mt5_risk_policies'))return Response.json(null);
  if(url.pathname.endsWith('mt5_bridge_state'))return Response.json(url.searchParams.get('id')==='eq.primary'?null:{heartbeat_at:heartbeat,snapshot});
  if(url.pathname.endsWith('mt5_target_positions')){
   assert.equal(method,'GET');assert.equal(url.searchParams.get('account_id'),'eq.'+account.id);assert.equal(url.searchParams.get('account_login'),'eq.42');assert.equal(url.searchParams.get('account_server'),'eq.Demo');
   return Response.json(subject);
  }
  if(url.pathname.endsWith('mt5_target_plans'))return Response.json(stored);
  if(url.pathname.endsWith('mt5_target_commands'))return Response.json({id:'1e25a364-09a6-4336-8de5-f56f6e385296',kind:'install'});
  if(url.pathname.endsWith('/rpc/mt5_finish_target'))return Response.json(true);
  if(url.pathname.endsWith('mt5_execution_orders'))return Response.json({id:orderId,status:'executed',intent:{account_login:42,account_server:'Demo',mode:'demo',symbol:'XAUUSD',direction:'long',stop_loss:1990},result:{position:123,magic:9,price:2000,volume:.04,initial_sl:1990}});
  if(url.pathname.endsWith('/rpc/mt5_save_target_plan')){stored={order_id:body.p_order,revision:body.p_revision,plan:body.p_plan,checkpoint:body.p_checkpoint,state:'pending'};return Response.json(stored);}
  throw new Error('Unexpected test-only fetch '+url.pathname);
 }) as typeof fetch;
 try{
  assert.deepEqual(await targetPlanAction({action:'target_state',account_id:account.id,position_ticket:123}),{plan:null,costs:null,stop_previews:{}});
  assert.ok(calls.every(call=>call.method==='GET'));
  const request={action:'target_save',account_id:account.id,position_ticket:123,revision:crypto.randomUUID(),expected_revision:null,targets:[{price:2010,volume:.01},{price:2020,volume:.03}],observed:{volume:.04,sl:1990,tp:0}};
  const result:any=await targetPlanAction(request);
  assert.equal(result.plan.plan.account_id,account.id);assert.equal(result.plan.plan.magic,0);assert.equal(result.plan.plan.entry_price,2000);
  assert.equal(result.plan.plan.initial_sl,null);assert.equal(result.plan.plan.targets[0].rr,null);assert.equal(result.plan.checkpoint.sl,1990);
  assert.ok(!calls.some(call=>call.url.pathname.endsWith('mt5_execution_orders')));
  subject={id:result.plan.order_id};assert.deepEqual(await targetPlanAction({action:'target_state',account_id:account.id,position_ticket:123}),{plan:stored,costs:null,stop_previews:{}});
  const before=calls.filter(c=>c.method==='POST').length;
  await assert.rejects(targetPlanAction({...request,observed:{...request.observed,sl:1980}}),/target_position_changed/);
  snapshot.positions[0].volume=.03;await assert.rejects(targetPlanAction(request),/target_position_changed/);snapshot=structuredClone(base);
  await assert.rejects(targetPlanAction({...request,position_ticket:999}),/target_position_unavailable/);
  snapshot.account_login=43;await assert.rejects(targetPlanAction(request),/account_mismatch/);snapshot=structuredClone(base);
  snapshot.positions[0].magic=.5;await assert.rejects(targetPlanAction(request),/target_position_unavailable/);snapshot=structuredClone(base);
  snapshot.quotes[0].time=Date.now()/1000+20;await assert.rejects(targetPlanAction(request),/target_position_unavailable/);snapshot=structuredClone(base);
  snapshot.quotes[0].time=Date.now()/1000-6;await assert.rejects(targetPlanAction(request),/target_position_unavailable/);snapshot=structuredClone(base);
  heartbeat=new Date(Date.now()-6000).toISOString();await assert.rejects(targetPlanAction(request),/bridge_offline/);heartbeat=new Date().toISOString();
  const {position_ticket:_,...legacy}=request;await assert.rejects(targetPlanAction({...legacy,order_id:orderId}),/target_position_unavailable/);
  assert.equal(calls.filter(c=>c.method==='POST').length,before);
  snapshot=structuredClone(base);snapshot.positions[0].sl=0;
  const noSl={...request,revision:crypto.randomUUID(),observed:{...request.observed,sl:0}};
  await assert.rejects(targetPlanAction(noSl),/target_without_sl_worker_required/);
  (snapshot as any).target_without_sl_ready=true;
  const withoutStop:any=await targetPlanAction(noSl);
  assert.equal(withoutStop.plan.checkpoint.sl,0);assert.equal(withoutStop.plan.plan.initial_sl,null);
  assert.deepEqual(await targetPlanAction({action:'target_result',account_id:account.id,order_id:stored.order_id,revision:stored.revision,operation_id:'1e25a364-09a6-4336-8de5-f56f6e385296',result:{status:'executed',remaining_volume:.04,sl:0,tp:0}},true),{recorded:true});
  await assert.rejects(targetPlanAction({...noSl,observed:{...noSl.observed,sl:-1}}));
 }finally{
  globalThis.fetch=oldFetch;
  keys.forEach((key,index)=>oldEnv[index]==null?Deno.env.delete(key):Deno.env.set(key,oldEnv[index]!));
 }
});
