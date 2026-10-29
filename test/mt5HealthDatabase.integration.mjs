import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(new URL('../.debug/mmt-health-sql/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url));
test('MMT incidents are private, deduplicated and claimed without duplicate delivery',async()=>{
 const db=new PGlite();
 try {
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261029090000_mt5_execution.sql',import.meta.url),'utf8'));
  const health=await readFile(new URL('../supabase/migrations/20261029110000_mt5_health.sql',import.meta.url),'utf8');
  await db.exec(health.split('-- Cron-Transport')[0]);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from mt5_health_incidents'),/permission denied/);
  await assert.rejects(db.query('select mt5_record_health(null,null,null)'),/permission denied/);
  await db.exec('reset role;set role service_role');
  const a=(await db.query("select (mt5_record_health('fault:one','AttributeError','{}')).id as id")).rows[0].id;
  const b=(await db.query("select (mt5_record_health('fault:one','AttributeError','{}')).id as id")).rows[0].id;
  assert.equal(a,b);
  assert.equal((await db.query('select * from mt5_health_deliveries')).rows.length,2);
  assert.equal((await db.query('select * from mt5_claim_health_notifications(4)')).rows.length,2);
  assert.equal((await db.query('select * from mt5_claim_health_notifications(4)')).rows.length,0);
  await db.exec("update mt5_health_deliveries set last_attempt_at=now()-interval '3 minutes'");
  assert.equal((await db.query('select * from mt5_claim_health_notifications(4)')).rows.length,0);
  assert.equal((await db.query("select * from mt5_health_deliveries where status='uncertain'")).rows.length,2);
  await db.exec('select mt5_record_health(null,null,null)');
  const c=(await db.query("select (mt5_record_health('fault:one','AttributeError','{}')).id as id")).rows[0].id;
  assert.notEqual(c,a);
  const account=(await db.query("insert into mt5_accounts(name,login,server,mode,credentials) values('test',42,'Demo','demo','{}') returning id")).rows[0];
  await db.query('select mt5_select_test_account($1)',[account.id]);
  const snapshot={account_login:42,account_server:'Demo',trade_allowed:true,execution_ready:false};
  await db.query("insert into mt5_bridge_state(id,snapshot) values('primary',$1)",[JSON.stringify(snapshot)]);
  const now=Math.floor(Date.now()/1000),order={id:'c297afbf-172c-4304-99e7-eb1198191050',account_login:42,account_server:'Demo',created_sec:now,expires_sec:now+120};
  await db.query('select mt5_enqueue_order($1)',[JSON.stringify(order)]);
  assert.equal((await db.query('select * from mt5_begin_send($1)',[order.id])).rows.length,0);
  await db.query("update mt5_bridge_state set snapshot=$1",[JSON.stringify({...snapshot,execution_ready:true,worker_error:{code:'AttributeError'}})]);
  assert.equal((await db.query('select * from mt5_begin_send($1)',[order.id])).rows.length,0);
  await db.query("update mt5_bridge_state set snapshot=$1",[JSON.stringify({...snapshot,execution_ready:true})]);
  assert.equal((await db.query('select * from mt5_begin_send($1)',[order.id])).rows.length,1);

 } finally {await db.close();}
});
