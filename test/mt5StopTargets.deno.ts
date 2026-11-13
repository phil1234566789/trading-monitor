import assert from 'node:assert/strict';
import {targetPlanAction} from '../supabase/functions/trading-monitor-mcp/mt5TargetPlans.ts';
import {riskPolicyDay} from '../supabase/functions/trading-monitor-mcp/riskPolicyContext.js';

Deno.test('split stops preserve legacy targets, first real R basis and explicit stop edit intent',async()=>{
 const originalFetch=globalThis.fetch,env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',MT5_EXECUTION_ENABLED:'true',MT5_ALLOW_LIVE:'false'};
 const previousEnv=Object.keys(env).map(k=>Deno.env.get(k));for(const [key,value] of Object.entries(env))Deno.env.set(key,value);
 const account={id:crypto.randomUUID(),login:42,server:'Demo',mode:'demo',archived:false},now=Date.now()/1000;
 const policy={...riskPolicyDay(now),revision:crypto.randomUUID(),confirmed_balance:50000,confirmed_equity:51000,cost_buffer:25,risk_base:50000,drawdown_floor:47000,currency:'USD'};
 let snapshot:any={account_login:42,account_server:'Demo',mode:'demo',balance:50000,equity:50100,currency:'USD',trade_allowed:true,pending_orders:0,hedging:true,risk_guards_ready:true,target_plans_ready:true,target_without_sl_ready:true,exit_plans_ready:true,execution_ready:true,
  risk:{time:Math.floor(now),day:policy.day,latched:false,realized_net_day:0,open_loss:0},
  positions:[{ticket:123,symbol:'XAUUSD',type:0,magic:0,volume:1,price_open:3900,price_current:3901,sl:0,tp:0,profit:100,swap:0,risk_to_sl:null,remaining_risk_to_sl:null}],
  quotes:[{symbol:'XAUUSD',bid:3901,ask:3901.1,time:now,point:.01,digits:2,minimum_volume:.01,maximum_volume:50,volume_step:.01,stops_level:.02,loss_per_unit_long:1,loss_per_unit_short:1,profit_per_unit_long:1,profit_per_unit_short:1}]};
 let subject:any=null,stored:any=null,writes=0;
 globalThis.fetch=(async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:input.toString()),body=init?.body?JSON.parse(String(init.body)):null;
  if(url.pathname.endsWith('mt5_accounts'))return Response.json(account);
  if(url.pathname.endsWith('mt5_risk_policies'))return Response.json(policy);
  if(url.pathname.endsWith('mt5_bridge_state'))return Response.json(url.searchParams.get('id')==='eq.primary'?null:{heartbeat_at:new Date().toISOString(),snapshot});
  if(url.pathname.endsWith('mt5_target_positions'))return Response.json(subject);
  if(url.pathname.endsWith('mt5_target_plans')){
   const cursor=url.searchParams.get('order_id');
   return Response.json(cursor?.startsWith('eq.')?stored:stored&&cursor!=='gt.'+stored.order_id?[stored]:[]);
  }
  if(url.pathname.endsWith('mt5_target_commands'))return Response.json([]);
  if(url.pathname.endsWith('/rpc/mt5_position_forecast_costs')){assert.equal(body.p_position,120);return Response.json({entry_costs:-5,entry_volume:1,estimated_exit_costs_per_lot:0,exit_sample_at:Date.now()});}
  if(url.pathname.endsWith('/rpc/mt5_save_target_plan')){
   writes++;subject={id:subject?.id??body.p_order,position_ticket:123};
   stored={order_id:subject.id,revision:body.p_revision,plan:body.p_plan,checkpoint:body.p_checkpoint,state:'pending',next_index:0,next_stop_index:0};return Response.json(stored);
  }
  throw new Error('Unexpected mocked request '+url.pathname);
 }) as typeof fetch;
 const save=(fields:any={})=>targetPlanAction({action:'target_save',account_id:account.id,position_ticket:123,revision:crypto.randomUUID(),expected_revision:stored?.revision??null,
  targets:[{price:3910,volume:.5},{price:3920,volume:.5}],stops:[{price:3898.5,volume:.5},{price:3897.75,volume:.5}],stops_changed:true,risk_mode:'risky',
  observed:{volume:snapshot.positions[0].volume,sl:snapshot.positions[0].sl,tp:snapshot.positions[0].tp},...fields});
 try{
  snapshot.positions[0].identifier=120;
  const state:any=await targetPlanAction({action:'target_state',account_id:account.id,position_ticket:123});
  assert.equal(writes,0);assert.equal(state.stop_previews.risky.price,3897.75);assert.equal(state.costs.estimated_exit_costs_per_lot,0);
  let result:any=await save();assert.equal(result.plan.plan.native_sl,3897.75);assert.equal(result.plan.plan.initial_sl,null);assert.equal(result.plan.plan.risk_basis_sl,3897.75);
  assert.equal(result.plan.plan.stops[1].rr,-1);
  const oldWrites=writes;snapshot.exit_plans_ready=false;await assert.rejects(save(),/stop_worker_required/);assert.equal(writes,oldWrites);snapshot.exit_plans_ready=true;
  snapshot.quotes[0].time=now-6;await assert.rejects(save(),/target_position_unavailable/);snapshot.quotes[0].time=now;
  snapshot.risk.time=Math.floor(now)-6;await assert.rejects(save(),/risk_guard_unavailable/);snapshot.risk.time=Math.floor(now);
  stored.state='active';stored.checkpoint.sl=3897.75;snapshot.positions[0].sl=3898.5;
  await assert.rejects(save({stops:undefined,risk_mode:undefined,stops_changed:false}),/stop_plan_refresh_required/);assert.equal(writes,oldWrites);
  result=await save({stops:[{price:3898.5,volume:1}]});assert.equal(result.plan.plan.native_sl,3898.5);assert.equal(result.plan.plan.risk_basis_sl,3897.75);
  // Ein erster BE- oder Gewinnsicherungs-SL ist zulässig, aber kein erfundenes ursprüngliches Verlustrisiko.
  for(const stop of [3900,3900.5]){
   subject=null;stored=null;snapshot.positions[0].sl=0;
   result=await save({stops:[{price:stop,volume:1}],targets:[{price:3910,volume:1}]});assert.equal(result.plan.plan.risk_basis_sl,null);assert.equal(result.plan.plan.targets[0].rr,null);
   stored.state='active';stored.checkpoint.sl=stop;stored.checkpoint.tp=3910;snapshot.positions[0].sl=stop;snapshot.positions[0].tp=3910;
   result=await save({stops:undefined,risk_mode:undefined,stops_changed:false,targets:[{price:3920,volume:1}]});assert.equal(result.plan.plan.native_sl,stop);assert.equal(result.plan.plan.risk_basis_sl,null);
   stored.state='active';stored.checkpoint.sl=stop;stored.checkpoint.tp=3920;snapshot.positions[0].tp=3920;
   result=await save({stops:[{price:3898,volume:1}],targets:[{price:3920,volume:1}]});assert.equal(result.plan.plan.risk_basis_sl,3898);
   snapshot.positions[0].tp=0;
  }
  const beforeRemoval=writes;await assert.rejects(save({stops:[],stops_changed:true}));assert.equal(writes,beforeRemoval);
  const legacy:any=await targetPlanAction({action:'target_poll',account_id:account.id},true);assert.deepEqual(legacy.plans,[]);
  const modern:any=await targetPlanAction({action:'target_poll',account_id:account.id,exit_plan_version:1},true);assert.equal(modern.plans.length,1);
 }finally{globalThis.fetch=originalFetch;Object.keys(env).forEach((k,i)=>previousEnv[i]==null?Deno.env.delete(k):Deno.env.set(k,previousEnv[i]!));}
});
