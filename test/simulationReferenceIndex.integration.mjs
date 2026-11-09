import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const sql=await readFile(new URL('../supabase/migrations/20261109065000_simulation_reference_lookup_index.sql',import.meta.url),'utf8');
const db=new PGlite();
try{
 await db.exec(`create table public.trade_setup_simulation_setups(run_id text,id text,known_at bigint,snapshot jsonb,primary key(run_id,id));
 insert into public.trade_setup_simulation_setups select 'run',lpad(i::text,8,'0'),i,
 jsonb_build_object('knownAt',i,'setupKey','other','evidence',repeat('x',2048)) from generate_series(1,5000)i;
 insert into public.trade_setup_simulation_setups values
 ('run','z-reference',7000,'{"setupKey":"idea","knownAt":7000,"dealingRange":{"status":"validated"}}'),
 ('run','a-reference',7000,'{"setupKey":"idea","knownAt":7000,"dealingRange":{"status":"validated"}}'),
 ('run','0-other',7000,'{"setupKey":"other","knownAt":7000,"dealingRange":{"status":"validated"}}'),
 ('run','0-fraction',7000,'{"setupKey":"idea","knownAt":7000.4,"dealingRange":{"status":"validated"}}');
 analyze public.trade_setup_simulation_setups;`);
 const query=`select id,snapshot from public.trade_setup_simulation_setups s where s.run_id='run' and s.known_at=7000
 and s.snapshot->>'setupKey'='idea' and (s.snapshot->>'knownAt')::numeric=7000
 and s.snapshot->'dealingRange'->>'status'='validated' order by s.id limit 1`;
 const before=await db.query(query),fingerprint=async()=> (await db.query("select count(*)::int n,md5(string_agg(row(run_id,id,known_at,snapshot)::text,'' order by id)) hash from public.trade_setup_simulation_setups")).rows;
 const saved=await fingerprint();
 await db.exec(sql);
 assert.deepEqual((await db.query(query)).rows,before.rows);
 assert.equal(before.rows[0].id,'a-reference');
 assert.deepEqual(await fingerprint(),saved,'Index creation must not alter snapshots or rows');
 const index=(await db.query("select indexdef from pg_indexes where indexname='trade_setup_simulation_setups_reference_lookup'")).rows[0].indexdef;
 assert.match(index,/USING btree \(run_id, known_at, id\)/);assert(!index.includes('UNIQUE'));
 const plan=(await db.query('explain(format json) '+query)).rows[0]['QUERY PLAN'];
 assert(JSON.stringify(plan).includes('trade_setup_simulation_setups_reference_lookup'),'Actual planner must use the bounded reference index');
 const missing=query.replaceAll('7000','9000');assert.equal((await db.query(missing)).rows.length,0);
 console.log(JSON.stringify({status:'passed',rows:5004,index,indexUsed:true,referenceAndSnapshotBytesUnchanged:true,
  sameTimeOtherSetupAndFractionExcluded:true,lexicalFirstReferencePreserved:true,missingReferencePreserved:true}));
}finally{await db.close();}
