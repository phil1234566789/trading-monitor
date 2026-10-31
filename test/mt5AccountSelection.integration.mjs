import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(new URL('../.debug/mmt-sql/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url));

test('account selection preserves monitoring and never retargets an existing search',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261029090000_mt5_execution.sql',import.meta.url),'utf8'));
  await db.exec('alter table mt5_accounts add column archived boolean not null default false;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261101001000_mt5_trading_account_selection.sql',import.meta.url),'utf8'));
  const [a,b,archived]=(await db.query("insert into mt5_accounts(name,login,server,mode,credentials) values('A',42,'Demo','demo','{}'),('B',43,'Demo','demo','{}'),('Archived',44,'Demo','demo','{}') returning id")).rows;
  await db.query('update mt5_accounts set archived=true where id=$1',[archived.id]);
  await db.exec('set role anon');
  await assert.rejects(db.query('select mt5_select_test_account($1)',[a.id]),/permission denied/);
  await db.exec('reset role;set role service_role');
  await db.query('select mt5_select_test_account($1)',[a.id]);
  const clean={account_login:42,account_server:'Demo',balance:50000,equity:50000,currency:'USD',positions:[],pending_orders:0};
  const bridge=async(snapshot=clean,age=0)=>db.query("insert into mt5_bridge_state(id,snapshot,heartbeat_at) values('primary',$1,now()-$2*interval '1 second') on conflict(id) do update set snapshot=excluded.snapshot,heartbeat_at=excluded.heartbeat_at",[JSON.stringify(snapshot),age]);
  await bridge();
  await db.query('select mt5_select_test_account($1)',[a.id]);
  assert.equal((await db.query('select count(*)::int n from mt5_bridge_state')).rows[0].n,1);
  for(const [snapshot,age,reason] of [
   [{...clean,positions:[{ticket:1}]},0,/active_positions_block_account_switch/],
   [{...clean,pending_orders:1},0,/active_positions_block_account_switch/],
   [clean,60,/account_state_unavailable/],
   [{...clean,worker_error:{code:'failed'}},0,/account_state_unavailable/],
   [{...clean,account_login:43},0,/account_state_unavailable/],
  ]){await bridge(snapshot,age);await assert.rejects(db.query('select mt5_select_test_account($1)',[b.id]),reason);}
  await bridge();
  await assert.rejects(db.query('select mt5_select_test_account($1)',[archived.id]),/archived_account/);
  const order={id:crypto.randomUUID(),account_login:42,account_server:'Demo',created_sec:Math.floor(Date.now()/1000),expires_sec:Math.floor(Date.now()/1000)+120};
  await db.query('select mt5_enqueue_order($1)',[JSON.stringify(order)]);
  for(const status of ['searching','sending','unknown']){
   await db.query('update mt5_execution_orders set status=$1',[status]);
   await assert.rejects(db.query('select mt5_select_test_account($1)',[b.id]),/active_orders_block_account_switch/);
  }
  await db.exec("update mt5_execution_orders set status='executed',result='{}'");
  await assert.rejects(db.query('select mt5_select_test_account($1)',[b.id]),/active_positions_block_account_switch/);
  await db.exec(`update mt5_execution_orders set result='{"position_lifecycle":{"state":"closed"}}'`);
  await db.query('select mt5_select_test_account($1)',[b.id]);
  assert.equal((await db.query('select active_account_id from mt5_execution_settings')).rows[0].active_account_id,b.id);
  assert.equal((await db.query('select intent from mt5_execution_orders')).rows[0].intent.account_login,42);
  assert.equal((await db.query('select count(*)::int n from mt5_bridge_state')).rows[0].n,0);
 }finally{await db.close();}
});
