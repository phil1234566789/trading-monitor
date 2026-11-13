import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '../.debug/mmt-health-sql/node_modules/@electric-sql/pglite/dist/index.js';
const migration=async name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
test('one atomic exit checkpoint scales the opposite leg and never grants two close rights',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table mt5_accounts(id uuid primary key,login bigint,server text,archived boolean default false);
   create table mt5_execution_orders(id uuid primary key,status text,intent jsonb,result jsonb);
   create table mt5_execution_settings(id text primary key,active_account_id uuid);
   create table mt5_bridge_state(id text primary key);
   create table mt5_broker_deals(account_id uuid,position_id bigint,ticket bigint,type integer,entry integer,symbol text,currency text,volume double precision,price double precision,profit double precision,commission double precision,fee double precision,swap double precision,time_msc bigint);
  `);
  await db.exec(await migration('20261101001500_mt5_target_plans.sql'));
  const accountWorkers=await migration('20261105110000_mt5_account_workers.sql');
  const begin=accountWorkers.indexOf('create or replace function public.mt5_claim_target');
  await db.exec(accountWorkers.slice(begin,accountWorkers.indexOf('-- Eine fehlende Versandantwort',begin)));
  await db.exec(await migration('20261113120000_mt5_native_target_positions.sql'));
  await db.exec(await migration('20261113200000_mt5_split_stop_plans.sql'));
  const account=randomUUID(),id=randomUUID(),revision=randomUUID();
  await db.query(`insert into mt5_accounts values($1,42,'Demo',false)`,[account]);
  const plan={order_id:id,account_id:account,account_login:42,account_server:'Demo',position:123,mode:'demo',direction:'long',symbol:'XAUUSD',magic:0,
   entry_price:3900,initial_sl:null,filled_volume:1,exit_version:1,risk_mode:'risky',risk_basis_sl:3898,risk_basis_source:'confirmed_stop_plan',volume_step:.01,minimum_volume:.01,
   native_sl:3898,native_tp:0,targets:[{price:3902,volume:.5},{price:3903,volume:.5}],stops:[{price:3899,volume:.5},{price:3898,volume:.5}]};
  const save=async(p=plan,rev=revision,expected=null)=>db.query('select (mt5_save_target_plan($1,$2,$3,$4,$5)).*',[id,rev,expected,p,{volume:1,sl:0,tp:0}]);
  await save();
  const state=async()=> (await db.query('select * from mt5_target_plans where order_id=$1',[id])).rows[0];
  const claim=async(kind,index)=>{const cmd=randomUUID();const accepted=(await db.query('select mt5_claim_target($1,$2,$3,$4,$5) yes',[id,revision,cmd,kind,index])).rows[0].yes;return {cmd,accepted};};
  const finish=async(cmd,remaining,deal)=>db.query('select mt5_finish_target($1,$2)',[cmd,{status:'executed',remaining_volume:remaining,sl:3898,tp:0,...(deal?{deal}:{})}]);
  let c=await claim('install',-1);assert.equal(c.accepted,true);await finish(c.cmd,1);
  const [tp,sl]=await Promise.all([claim('close',0),claim('stop_close',0)]);assert.equal(tp.accepted,true);assert.equal(sl.accepted,false);
  await finish(tp.cmd,.5,100);let s=await state();assert.equal(s.next_index,1);assert.deepEqual(s.plan.stops.map(x=>x.volume),[.25,.25]);
  c=await claim('stop_close',0);assert.equal(c.accepted,true);await finish(c.cmd,.25,101);s=await state();
  assert.equal(s.next_stop_index,1);assert.equal(s.next_index,0);assert.deepEqual(s.plan.targets,[{price:3903,volume:.25}]);assert.equal(s.checkpoint.sl,3898);
  await finish(c.cmd,.25,101);assert.deepEqual((await state()).checkpoint,s.checkpoint);
  await assert.rejects(save({...s.plan,risk_basis_sl:3897},randomUUID(),revision),/stop_risk_basis_changed/);
  const withoutStops={...s.plan};delete withoutStops.stops;
  await assert.rejects(save(withoutStops,randomUUID(),revision),/stop_plan_refresh_required/);
  c=await claim('close',0);assert.equal(c.accepted,true);await finish(c.cmd,0,102);assert.equal((await state()).state,'completed');
  const rescaled=(await db.query(`select mt5_rescale_exit_levels($1,1,.5,.01,.01) x`,[[{price:3902,volume:.4}]])).rows[0].x;assert.deepEqual(rescaled,[{price:3902,volume:.2}]);
  await db.query(`insert into mt5_broker_deals values($1,123,1,0,0,'XAUUSD','USD',1,3900,0,-5,0,0,1000),($1,124,2,1,1,'XAUUSD','USD',1,3901,100,0,0,0,2000)`,[account]);
  const costs=(await db.query(`select mt5_position_forecast_costs($1,123,'XAUUSD') x`,[account])).rows[0].x;
  assert.equal(costs.entry_costs,-5);assert.equal(costs.estimated_exit_costs_per_lot,0);
  assert.equal((await db.query(`select has_function_privilege('anon','mt5_position_forecast_costs(uuid,bigint,text)','EXECUTE') allowed`)).rows[0].allowed,false);
  // Ein unklarer Close bleibt auch nach einem erneuten Save unklar, kein zweites Versandrecht.
  const nextRev=randomUUID();await save(plan,nextRev,revision);
  const sending=randomUUID();assert.equal((await db.query('select mt5_claim_target($1,$2,$3,$4,$5) yes',[id,nextRev,sending,'install',-1])).rows[0].yes,true);
  await db.query('select mt5_finish_target($1,$2)',[sending,{status:'unknown',reason:'broker_reply_missing'}]);
  await assert.rejects(save(plan,randomUUID(),nextRev),/target_outcome_unresolved/);
  assert.equal((await state()).state,'unknown');
 }finally{await db.close();}
});
