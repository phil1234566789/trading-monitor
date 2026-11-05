import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.MMT_PGLITE_MODULE));
test('role assignment is private, unique, movable and rejects archived accounts',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261029090000_mt5_execution.sql',import.meta.url),'utf8'));
  await db.exec('alter table mt5_accounts add column archived boolean not null default false;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261105180000_mt5_account_roles.sql',import.meta.url),'utf8'));
  const {rows:[a,b]}=await db.query("insert into mt5_accounts(name,login,server,mode,credentials) values('a',42,'Demo','demo','{}'),('b',43,'Demo','demo','{}') returning id");
  const assign=(id,role)=>db.query('select mt5_assign_account_role($1,$2)',[id,role]);
  await db.exec('set role anon');await assert.rejects(assign(a.id,'risky'),/permission denied/);
  await db.exec('reset role;set role service_role');await assign(a.id,'risky');await assign(b.id,'risky');
  assert.equal((await db.query('select trade_role from mt5_accounts where id=$1',[a.id])).rows[0].trade_role,null);
  await assert.rejects(assign(a.id,'all'),/invalid_role/);
  await db.query('update mt5_accounts set archived=true where id=$1',[a.id]);
  await assert.rejects(assign(a.id,'safe'),/account_not_found/);
  assert.equal((await db.query("select id from mt5_accounts where trade_role='risky'")).rows[0].id,b.id);
 }finally{await db.close();}
});
