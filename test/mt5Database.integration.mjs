import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Isoliertes PostgreSQL/WASM; Installation nur im ignorierten Testordner, nicht im Produktbundle.
const moduleUrl = process.env.MMT_PGLITE_MODULE
  ? pathToFileURL(process.env.MMT_PGLITE_MODULE).href
  : new URL('../.debug/mmt-sql/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url).href;
const { PGlite } = await import(moduleUrl);

test('private queue enforces account selection, at-most-once send and unknown-outcome blocking',async()=>{
  const db=new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(await readFile(new URL('../supabase/migrations/20261029090000_mt5_execution.sql',import.meta.url),'utf8'));
    const result=await db.query(`insert into mt5_accounts(name,login,server,mode,credentials)
      values ('Test 1',42,'Demo','demo','{}'),('Test 2',43,'Demo','demo','{}') returning id`);
    const [a,b]=result.rows;
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from mt5_accounts'),/permission denied/);
    await assert.rejects(db.query('select mt5_begin_send(gen_random_uuid())'),/permission denied/);
    await db.exec('reset role; set role service_role');
    await db.query('select mt5_select_test_account($1)',[a.id]);
    await db.query(`insert into mt5_bridge_state(id,snapshot) values ('primary',$1)`,[
      JSON.stringify({account_login:42,account_server:'Demo',trade_allowed:true})]);
    const now=Math.floor(Date.now()/1000);
    const order={id:'c297afbf-172c-4304-99e7-eb1198191050',account_login:42,account_server:'Demo',
      created_sec:now,expires_sec:now+120};
    await db.query('select mt5_enqueue_order($1)',[JSON.stringify(order)]);
    await assert.rejects(db.query('select mt5_select_test_account($1)',[b.id]),/active_orders_block_account_switch/);
    assert.equal((await db.query('select * from mt5_begin_send($1)',[order.id])).rows.length,1);
    const premature=await db.query(`update mt5_execution_orders set status='rejected'
      where id=$1 and status='searching' returning id`,[order.id]);
    assert.equal(premature.rows.length,0);
    assert.equal((await db.query('select status from mt5_execution_orders where id=$1',[order.id])).rows[0].status,'sending');
    assert.equal((await db.query('select * from mt5_begin_send($1)',[order.id])).rows.length,0);
    const second={...order,id:'e297afbf-172c-4304-99e7-eb1198191050'};
    await db.query('select mt5_enqueue_order($1)',[JSON.stringify(second)]);
    assert.equal((await db.query('select * from mt5_begin_send($1)',[second.id])).rows.length,0);
    await db.query(`update mt5_execution_orders set status='unknown' where id=$1`,[order.id]);
    assert.equal((await db.query('select * from mt5_begin_send($1)',[second.id])).rows.length,0);
    await db.query(`update mt5_execution_orders set status='rejected'`);
    await db.query('select mt5_select_test_account($1)',[b.id]);
    assert.equal((await db.query('select * from mt5_bridge_state')).rows.length,0);
    await assert.rejects(db.query('select mt5_enqueue_order($1)',[JSON.stringify({...order,id:crypto.randomUUID()})]),/account_changed/);
    await db.exec('reset role');
  } finally {await db.close();}
});
