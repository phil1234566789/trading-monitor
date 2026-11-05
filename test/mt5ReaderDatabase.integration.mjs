import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(new URL('../.debug/mmt-sql/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url));
test('reader balances are monotonic, private and preserve limits, active account and execution state',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  for(const name of ['20261029090000_mt5_execution.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec('alter table mt5_accounts add column archived boolean not null default false;');
  for(const name of ['20261031233000_mt5_account_balances.sql','20261105094500_mt5_reader_balance.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  const [a,b]=(await db.query("insert into mt5_accounts(name,login,server,mode,credentials) values('A',42,'Demo','demo','{}'),('B',43,'Demo','demo','{}') returning id")).rows;
  await db.query("update mt5_execution_settings set active_account_id=$1",[a.id]);
  await db.query("insert into mt5_account_balances(account_id,loss_floor,target,limits_source) values($1,47000,54000,'confirmed broker')",[b.id]);
  const now=Date.now(),snapshot={balance:49000,equity:48900,currency:'USD',positions:1};
  const write=(at,balance=49000)=>db.query('select mt5_record_reader_balance($1,$2,$3)',[b.id,JSON.stringify({...snapshot,balance}),new Date(at).toISOString()]);
  await db.exec('set role anon');await assert.rejects(write(now),/permission denied/);
  await db.exec('reset role;set role service_role');await write(now);await write(now-1000,48000);
  const row=(await db.query('select * from mt5_account_balances where account_id=$1',[b.id])).rows[0];
  assert.equal(row.balance,49000);assert.equal(row.loss_floor,47000);assert.equal(row.target,54000);assert.equal(row.limits_source,'confirmed broker');assert.equal(row.balance_source,'MT5-Reader');
  assert.equal((await db.query('select active_account_id from mt5_execution_settings')).rows[0].active_account_id,a.id);
  assert.equal((await db.query('select count(*)::int n from mt5_bridge_state')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from mt5_execution_orders')).rows[0].n,0);
  await assert.rejects(write(now-60000),/invalid_reader_snapshot/);
  await assert.rejects(write(now+60000),/invalid_reader_snapshot/);
 }finally{await db.close();}
});
