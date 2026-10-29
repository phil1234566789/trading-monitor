import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import('../.debug/mmt-health-sql/node_modules/@electric-sql/pglite/dist/index.js');
test('broker history is private, account-scoped and replay-idempotent',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261029090000_mt5_execution.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261029180000_mt5_statistics.sql',import.meta.url),'utf8'));
  const {rows:[a]}=await db.query(`insert into mt5_accounts(name,login,server,mode,credentials)values('Test',42,'Demo','demo','{}')returning id`);
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(db.query('select * from mt5_broker_deals'),/permission denied/);
   await assert.rejects(db.query('select * from mt5_history_sync'),/permission denied/);
   await db.exec('reset role');
  }
  await db.exec('set role service_role');
  const sql=`insert into mt5_broker_deals(account_id,ticket,position_id,time_msc,type,entry,symbol,volume,price,profit,commission,swap,fee,currency)values($1,1,2,1800000000000,1,0,'XAUUSD.gbe',.01,4020,0,-.05,0,0,'USD')on conflict(account_id,ticket)do update set profit=excluded.profit`;
  await db.query(sql,[a.id]);await db.query(sql,[a.id]);
  assert.equal((await db.query('select count(*)::int as n from mt5_broker_deals')).rows[0].n,1);
 }finally{await db.close();}
});
