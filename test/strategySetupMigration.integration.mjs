import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.LS_SETUP_PGLITE_MODULE));
test('merges assigned LS rows and normalizes old clients without changing open, unproven or favorite data',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create table dealing_ranges(id integer primary key,setup_type text);');
  await db.exec(await readFile(new URL('../supabase/migrations/20261108000500_dealing_range_strategy_setup.sql',import.meta.url),'utf8'));
  await db.exec("insert into dealing_ranges values(1,'10/10-Trade','countertrend'),(2,null,'setup2'),(3,null,'setup3'),(4,null,'setup4'),(5,null,'continuation'),(6,'10/10-Trade',null);");
  await db.exec(await readFile(new URL('../supabase/migrations/20261108163000_merge_liquidity_sweep_strategy_setups.sql',import.meta.url),'utf8'));
  assert.deepEqual((await db.query('select strategy_setup from dealing_ranges order by id')).rows.map(r=>r.strategy_setup),['setup1','setup1','setup3','setup4','continuation',null]);
  assert.deepEqual((await db.query("select id from dealing_ranges where setup_type='10/10-Trade' order by id")).rows.map(r=>r.id),[1,6]);
  for(const legacy of ['countertrend','setup2']){
   await db.query('update dealing_ranges set strategy_setup=$1 where id=1',[legacy]);
   assert.equal((await db.query('select strategy_setup from dealing_ranges where id=1')).rows[0].strategy_setup,'setup1');
  }
  await db.exec("insert into dealing_ranges(id,strategy_setup) values(7,'setup2');");
  assert.equal((await db.query('select strategy_setup from dealing_ranges where id=7')).rows[0].strategy_setup,'setup1');
  await assert.rejects(db.exec("update dealing_ranges set strategy_setup='all' where id=1"),/check constraint/);
  await assert.rejects(db.exec("update dealing_ranges set strategy_setup='unknown' where id=1"),/check constraint/);
 }finally{await db.close();}
});
