import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.MMT_PGLITE_MODULE;
const {PGlite}=await import(modulePath?pathToFileURL(modulePath).href:new URL('../.debug/mmt-health-sql/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url));

test('native target identities preserve legacy plans, account isolation and revision safety without execution rows',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  const migration=async name=>db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await migration('20261029090000_mt5_execution.sql');
  await db.exec('alter table mt5_accounts add column archived boolean not null default false;');
  await migration('20261101001500_mt5_target_plans.sql');
  const [a,b]=(await db.query("insert into mt5_accounts(name,login,server,mode,credentials) values('A',42,'Demo','demo','{}'),('B',43,'Demo','demo','{}') returning *")).rows;
  const legacy=crypto.randomUUID(),revision=crypto.randomUUID();
  const plan=(account,ticket,id)=>({order_id:id,account_id:account.id,account_login:Number(account.login),account_server:account.server,mode:'demo',position:ticket,symbol:'XAUUSD',direction:'long',magic:0,entry_price:2000,initial_sl:null,filled_volume:.04,targets:[{price:2010,volume:.01},{price:2020,volume:.03}],remainder:0,native_tp:0});
  const checkpoint={volume:.04,sl:1990,tp:0};
  await db.query("insert into mt5_execution_orders(id,intent,expires_at,status,result) values($1,$2,now()+interval '1 minute','executed',$3)",[legacy,JSON.stringify({account_login:42,account_server:'Demo'}),JSON.stringify({position:100})]);
  await db.query("insert into mt5_target_plans(order_id,revision,plan,checkpoint,state) values($1,$2,$3,$4,'active')",[legacy,revision,JSON.stringify(plan(a,100,legacy)),JSON.stringify(checkpoint)]);
  await migration('20261113120000_mt5_native_target_positions.sql');
  assert.equal((await db.query('select id,execution_order_id from mt5_target_positions where id=$1',[legacy])).rows[0].execution_order_id,legacy);
  await db.exec('set role anon');await assert.rejects(db.query('select * from mt5_target_positions'),/permission denied/);await db.exec('reset role');
  const save=async(account,ticket,id,rev=crypto.randomUUID(),expected=null)=>{
   const body=plan(account,ticket,id);
   return (await db.query('select (mt5_save_target_plan($1,$2,$3,$4,$5)).*',[id,rev,expected,JSON.stringify(body),JSON.stringify(checkpoint)])).rows[0];
  };
  const id=crypto.randomUUID(),rev=crypto.randomUUID(),saved=await save(a,200,id,rev);
  assert.equal(saved.order_id,id);assert.equal(saved.plan.magic,0);assert.equal(saved.plan.initial_sl,null);assert.equal(saved.checkpoint.sl,1990);
  assert.equal((await db.query('select count(*)::int n from mt5_execution_orders')).rows[0].n,1);
  assert.equal((await save(a,200,crypto.randomUUID(),rev)).order_id,id);
  await assert.rejects(save(a,200,crypto.randomUUID()),/target_revision_changed/);
  const nativeOrder=crypto.randomUUID();
  await db.query("insert into mt5_execution_orders(id,intent,expires_at,status,result) values($1,$2,now()+interval '1 minute','executed',$3)",[nativeOrder,JSON.stringify({account_login:42,account_server:'Demo'}),JSON.stringify({position:200})]);
  assert.equal((await save(a,200,nativeOrder,rev,rev)).order_id,id);
  assert.equal((await db.query('select execution_order_id from mt5_target_positions where id=$1',[id])).rows[0].execution_order_id,nativeOrder);
  await db.query('update mt5_execution_settings set active_account_id=$1',[a.id]);
  const operation=crypto.randomUUID();
  assert.equal((await db.query("select mt5_claim_target($1,$2,$3,'install',-1) authorized",[id,rev,operation])).rows[0].authorized,true);
  assert.equal((await db.query('select mt5_finish_target($1,$2) recorded',[operation,JSON.stringify({status:'executed',remaining_volume:.04,sl:1990,tp:0})])).rows[0].recorded,true);
  assert.equal((await db.query('select checkpoint from mt5_target_plans where order_id=$1',[id])).rows[0].checkpoint.sl,1990);
  const other=await save(b,200,crypto.randomUUID());assert.notEqual(other.order_id,id);
  const updated=await save(a,100,crypto.randomUUID(),crypto.randomUUID(),revision);assert.equal(updated.order_id,legacy);
  assert.equal((await db.query('select count(*)::int n from mt5_target_positions')).rows[0].n,3);
  await db.query("update mt5_target_plans set state='unknown' where order_id=$1",[id]);
  await assert.rejects(save(a,200,id,crypto.randomUUID(),rev),/target_outcome_unresolved/);
  await db.query('update mt5_accounts set archived=true where id=$1',[a.id]);
  await assert.rejects(save(a,300,crypto.randomUUID()),/account_changed/);
 }finally{await db.close();}
});
