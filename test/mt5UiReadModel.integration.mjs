import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '../.debug/mmt-health-sql/node_modules/@electric-sql/pglite/dist/index.js';

test('private UI batches and activity counters separate lifetimes without tick-driven invalidations',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table mt5_accounts(id uuid primary key,name text,login bigint,server text,mode text,archived boolean default false,created_at timestamptz default now(),trade_role text,archive_details jsonb,credentials jsonb);
   create table mt5_execution_settings(id text primary key,active_account_id uuid,health_checked_at timestamptz);
   create table mt5_bridge_state(id text primary key,snapshot jsonb,heartbeat_at timestamptz);
   create table mt5_risk_policies(account_id uuid primary key,revision uuid,risk_base float,drawdown_floor float,cost_buffer float,currency text,source text,confirmed_balance float,confirmed_equity float,confirmed_at timestamptz);
   create table mt5_execution_orders(id uuid primary key,intent jsonb,status text,result jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
   create table mt5_daily_stops(account_id uuid,day date,reason text,snapshot jsonb,latched_at timestamptz default now());
   create table mt5_guard_commands(id uuid primary key,account_id uuid,day date,status text,symbol text,kind text,ticket bigint,result jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
   create table mt5_target_plans(order_id uuid primary key,state text,revision uuid,plan jsonb,checkpoint jsonb,next_index integer,next_stop_index integer,reason text,updated_at timestamptz default now());
   create table mt5_broker_deals(id bigint primary key,account_id uuid,commission float);
   create table mt5_account_balances(account_id uuid primary key,balance float,equity float,positions integer,currency text,balance_at timestamptz,loss_floor float,target float);
   create table mt5_health_incidents(id uuid primary key,code text,detail jsonb,resolved_at timestamptz);
   create table mt5_health_deliveries(id uuid primary key,incident_id uuid,channel text,status text,error text,accepted_at timestamptz);
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261113230000_mt5_ui_read_model.sql',import.meta.url),'utf8'));
  const ids=[randomUUID(),randomUUID(),randomUUID()];
  for(let i=0;i<3;i++)await db.query("insert into mt5_accounts(id,name,login,server,mode,archived,credentials)values($1,$2,$3,'Demo','demo',$4,'{\"ciphertext\":\"SECRET\"}')",[ids[i],`Konto ${i}`,i+1,i===2]);
  await db.query("insert into mt5_execution_settings values('primary',$1,now())",[ids[0]]);
  const position={ticket:10,identifier:10,symbol:'XAUUSD',type:0,magic:0,volume:1,sl:3900,tp:4000,price_open:3950,price_current:3960,profit:1000};
  const snapshot=(login,positions=[])=>({account_login:login,account_server:'Demo',mode:'demo',positions,pending_orders:0,balance:50000,equity:51000,risk_guards_ready:true,execution_ready:true,trade_allowed:true,risk:{day:'2026-11-13',latched:false,time:1},quotes:[{bid:3960}]});
  const put=async(id,value)=>db.query('insert into mt5_bridge_state values($1,$2,now()) on conflict(id)do update set snapshot=excluded.snapshot,heartbeat_at=clock_timestamp()',[id,value]);
  await put(ids[0],snapshot(1,[position]));await put('primary',snapshot(1,[position]));await put(ids[1],snapshot(2));await put(ids[2],snapshot(3,[position]));
  const state=async sections=>(await db.query('select mt5_read_ui_state($1) data',[sections])).rows[0].data;
  const revisions=async()=>(await state([])).revisions;
  let previous=await revisions();
  for(let n=0;n<100;n++)await put(ids[0],{...snapshot(1,[{...position,profit:n,price_current:3960+n}]),equity:51000+n,risk:{day:'2026-11-13',latched:false,time:n},quotes:[{bid:3960+n}]});
  assert.deepEqual(await revisions(),previous,'quotes, heartbeat, current price, profit, equity and risk timestamp must be silent');
  await db.query("update mt5_bridge_state set snapshot=$1,heartbeat_at=(select heartbeat_at from mt5_bridge_state where id=$2) where id='primary'",[snapshot(1,[position]),ids[0]]);assert.deepEqual(await revisions(),previous,'selected alias must not invalidate twice');
  await put('primary',snapshot(1,[{...position,sl:3899}]));assert.ok((await revisions()).snapshots>previous.snapshots,'newer legacy-only snapshot must remain discoverable');
  assert.equal((await state(['snapshots'])).account_statuses[ids[0]].bridge.snapshot.positions[0].sl,3899);
  await put(ids[0],snapshot(1,[position]));previous=await revisions();
  for(const patch of [{sl:3901},{tp:4001},{volume:.5},{ticket:11},{identifier:11},{type:1},{magic:2},{symbol:'EURUSD'},{price_open:3951},{opened_at_sec:1}]){
   previous=await revisions();await put(ids[0],snapshot(1,[{...position,...patch}]));assert.ok((await revisions()).snapshots>previous.snapshots);
  }
  previous=await revisions();await put(ids[0],snapshot(1,[]));assert.ok((await revisions()).snapshots>previous.snapshots);
  previous=await revisions();await put(ids[1],snapshot(2,[position]));assert.ok((await revisions()).snapshots>previous.snapshots,'new position on other account must be discovered');
  previous=await revisions();await put(ids[1],{...snapshot(2,[position]),risk:{day:'2026-11-14',latched:true,time:2}});const dayChange=await revisions();assert.ok(dayChange.guards>previous.guards&&dayChange.catalog>previous.catalog);
  await db.query("insert into mt5_account_balances values($1,50000,51000,1,'USD',now(),47000,54000)",[ids[0]]);previous=await revisions();
  await db.query('update mt5_account_balances set equity=52000,balance_at=clock_timestamp()');assert.deepEqual(await revisions(),previous);
  await db.query('update mt5_account_balances set balance=50100');assert.ok((await revisions()).balances>previous.balances);
  previous=await revisions();await db.query("update mt5_execution_settings set health_checked_at=clock_timestamp()");assert.deepEqual(await revisions(),previous);
  await db.query('update mt5_execution_settings set active_account_id=$1',[ids[1]]);assert.ok((await revisions()).catalog>previous.catalog);
  const order=randomUUID();await db.query("insert into mt5_execution_orders values($1,'{}','searching','{}',now(),now())",[order]);previous=await revisions();
  await db.query('update mt5_execution_orders set updated_at=clock_timestamp()');assert.deepEqual(await revisions(),previous);
  for(const status of ['sending','unknown','executed','rejected','cancelled','expired']){previous=await revisions();await db.query('update mt5_execution_orders set status=$1',[status]);assert.ok((await revisions()).orders>previous.orders);}
  previous=await revisions();await db.query("update mt5_execution_orders set result='{\"position_lifecycle\":{\"state\":\"closed\"}}'");assert.ok((await revisions()).orders>previous.orders);
  await db.query("insert into mt5_target_plans(order_id,state,revision,plan,checkpoint,next_index,next_stop_index) values($1,'active',$2,'{}','{}',0,0)",[order,randomUUID()]);previous=await revisions();
  await db.query('update mt5_target_plans set updated_at=clock_timestamp()');assert.deepEqual(await revisions(),previous);
  for(const patch of ["state='paused'","reason='broker_position_changed'","next_index=1","next_stop_index=1","checkpoint='{\"sl\":12}'","plan='{\"targets\":[{\"price\":13,\"volume\":0.5}]}'"]){previous=await revisions();await db.exec('update mt5_target_plans set '+patch);assert.ok((await revisions()).plans>previous.plans);}
  previous=await revisions();await db.query('insert into mt5_broker_deals select n,$1,-5 from generate_series(1,100)n',[ids[0]]);assert.equal((await revisions()).plans,previous.plans+1,'batch invalidates once');previous=await revisions();
  await db.query('update mt5_broker_deals set commission=commission');assert.deepEqual(await revisions(),previous,'identical upsert values do not invalidate');
  await db.query('update mt5_broker_deals set commission=-6 where id=1');assert.equal((await revisions()).plans,previous.plans+1);
  previous=await revisions();await db.query("insert into mt5_risk_policies(account_id,revision,risk_base,currency) values($1,$2,50000,'USD')",[ids[0],randomUUID()]);assert.ok((await revisions()).catalog>previous.catalog);
  previous=await revisions();await db.query("insert into mt5_daily_stops(account_id,day,reason,snapshot) values($1,(now() at time zone 'Europe/Berlin')::date,'daily_loss','{}')",[ids[0]]);assert.ok((await revisions()).guards>previous.guards);
  previous=await revisions();await db.query("insert into mt5_guard_commands(id,account_id,status) values($1,$2,'unknown')",[randomUUID(),ids[0]]);assert.ok((await revisions()).guards>previous.guards);
  const boot=await state(['catalog','snapshots','guards','orders','balances','health']);
  assert.equal(boot.accounts.length,3);assert.equal(JSON.stringify(boot).includes('SECRET'),false);assert.equal(JSON.stringify(boot).includes('credentials'),false);
  assert.equal(boot.active_account_id,ids[1]);assert.equal(boot.account_statuses[ids[2]].online,false);assert.equal(boot.account_statuses[ids[2]].inactive,true);
  assert.equal(boot.account_statuses[ids[1]].bridge.snapshot.account_login,2);
  assert.equal(boot.account_statuses[ids[0]].daily_stop.latched,true);assert.equal(boot.account_statuses[ids[0]].daily_stop.reason,'daily_loss');assert.equal(boot.account_statuses[ids[0]].daily_stop.commands[0].status,'unknown');
  const live=await state(['snapshots']);assert.deepEqual(Object.keys(live).sort(),['account_statuses','revisions']);assert.equal(Object.hasOwn(live.account_statuses[ids[1]],'risk_policy'),false);assert.equal(Object.hasOwn(live.account_statuses[ids[1]],'daily_stop'),false);
  await put(ids[1],snapshot(99,[position]));assert.equal((await state(['snapshots'])).account_statuses[ids[1]].bridge,null,'foreign login must never attach');
  await put(ids[1],{...snapshot(2,[position]),account_server:'Other'});assert.equal((await state(['snapshots'])).account_statuses[ids[1]].bridge,null);
  await put(ids[1],{...snapshot(2,[position]),mode:'live'});assert.equal((await state(['snapshots'])).account_statuses[ids[1]].bridge,null);
  // Activity darf selbst dann funktionieren, wenn keine Fachtabelle mehr erreichbar ist.
  await db.exec('alter table mt5_accounts rename to hidden_accounts');assert.deepEqual(Object.keys(await state([])),['revisions']);await db.exec('alter table hidden_accounts rename to mt5_accounts');
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(state([]),/permission denied/);await assert.rejects(db.query('select * from mt5_ui_activity'),/permission denied/);await db.exec('reset role');}
  await db.exec('set role service_role');assert.ok((await state([])).revisions);await db.exec('reset role');await assert.rejects(state(['credentials']),/invalid_ui_sections/);
  const plan=await db.query('explain(analyze,format json) select catalog,snapshots,orders,guards,balances from mt5_ui_activity where id');
  assert.equal(plan.rows[0]['QUERY PLAN'][0].Plan['Actual Rows'],1);
  console.log('activity row EXPLAIN ANALYZE ms:',plan.rows[0]['QUERY PLAN'][0]['Execution Time']);
  if(process.env.MMT_UI_BENCHMARK==='1'){
   await db.exec('alter table mt5_account_balances add column balance_source text');
   const originalBalance=await readFile(new URL('../supabase/migrations/20261031233000_mt5_account_balances.sql',import.meta.url),'utf8');
   await db.exec(originalBalance.slice(originalBalance.indexOf('create function public.mt5_remember_account_balance')));
   await put(ids[1],snapshot(2,[position]));await put('primary',snapshot(2,[position]));
   const update=`do $$ declare stamp timestamptz;begin for n in 1..1000 loop stamp:=clock_timestamp();
    update mt5_bridge_state set heartbeat_at=stamp,snapshot=jsonb_set(snapshot,'{risk,time}',to_jsonb(n)) where id='${ids[1]}';
    update mt5_bridge_state set heartbeat_at=stamp,snapshot=jsonb_set(snapshot,'{risk,time}',to_jsonb(n)) where id='primary';
    end loop;end $$;`;
   const before=await revisions(),samples={before:[],after:[]};
   for(let run=0;run<6;run++)for(const mode of run%2?['after','before']:['before','after']){
    await db.exec(`alter table mt5_bridge_state ${mode==='before'?'disable':'enable'} trigger mt5_ui_snapshot_activity;alter table mt5_account_balances ${mode==='before'?'disable':'enable'} trigger mt5_ui_balance_activity;`);
    const start=performance.now();await db.exec(update);if(run) samples[mode].push(performance.now()-start);
   }
   await db.exec('alter table mt5_bridge_state enable trigger mt5_ui_snapshot_activity;alter table mt5_account_balances enable trigger mt5_ui_balance_activity;');
   assert.deepEqual(await revisions(),before,'stable worker cycles never write UI counters');
   const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
   console.log('1000 selected-worker cycles (own+primary+original balance trigger), PGlite ms:',JSON.stringify({samples,median_before:median(samples.before),median_after:median(samples.after),extra_ms_per_cycle:(median(samples.after)-median(samples.before))/1000}));
  }
 }finally{await db.close();}
});
