import assert from 'node:assert/strict';
export async function checkLiveReadIndexDb(db,{baselineCaptureRpcMs=0}={}) {
 await db.exec("set statement_timeout='3s'");
 const stateBefore=(await db.query("select instrument,state from setup2_live_state order by instrument")).rows;
 const count=async table=>(await db.query(`select count(*)::int n from ${table}`)).rows[0].n;
 assert.equal(await count('setup2_live_snapshot_index'),0);
 const originals=(await db.query('select id,xmin::text,captured_at from setup2_live_snapshots order by id')).rows;
 const call=async(cursor={},limit=64)=>db.query('select setup2_backfill_live_snapshot_index($1,$2,$3) result',[cursor.next_captured_at ?? null,cursor.next_id ?? null,limit]);
 await assert.rejects(()=>call({},129),/Invalid live index batch/);
 await assert.rejects(()=>db.query("select setup2_backfill_live_snapshot_index(now(),null,64)"),/Invalid live index cursor/);
 const first=(await call()).rows[0].result;assert.equal(first.processed,64);assert.equal(first.inserted,64);assert.equal(first.complete,false);
 const retry=(await call()).rows[0].result;assert.equal(retry.processed,64);assert.equal(retry.inserted,0);assert.equal(retry.next_id,first.next_id);
 let cursor=first,maxBackfillMs=0,batches=1;
 while(!cursor.complete){const at=performance.now();cursor=(await call(cursor)).rows[0].result;maxBackfillMs=Math.max(maxBackfillMs,performance.now()-at);batches++;}
 assert.equal(await count('setup2_live_snapshot_index'),originals.length);
 assert.deepEqual((await db.query('select id,xmin::text,captured_at from setup2_live_snapshots order by id')).rows,originals);
 const mismatch=(await db.query(`select count(*)::int n from setup2_live_snapshot_index i join setup2_live_snapshots s using(id)
 where i.snapshot_id is distinct from s.snapshot_id or i.captured_at is distinct from s.captured_at
 or i.entry_id is distinct from s.snapshot#>>'{entry,id}' or i.dr_status is distinct from s.snapshot#>>'{dealingRange,status}'
 or i.dr_version is distinct from s.snapshot#>>'{dealingRange,version}'
 or i.direction is distinct from s.snapshot->>'direction' or i.has_history is distinct from (s.observation?'checklistHistory' and s.observation->'checklistHistory'<>'null'::jsonb)`)).rows[0].n;
 assert.equal(mismatch,0);
 const flags=(await db.query("select count(*)::int n from setup2_live_snapshot_index i join setup2_live_snapshots s using(id) where i.has_observation is distinct from exists(select 1 from jsonb_each(s.observation) e(k,v) where v<>'null'::jsonb)")).rows[0].n;assert.equal(flags,0);
 await db.exec('set role anon');assert.equal(await count('setup2_live_snapshot_index'),originals.length);
 await assert.rejects(()=>db.exec('delete from setup2_live_snapshot_index'),/permission denied/);await assert.rejects(()=>call(),/permission denied/);await db.exec('reset role');
 const source=(await db.query('select * from setup2_live_snapshots order by id limit 1')).rows[0];
 const triggerAt=performance.now();await db.query(`insert into setup2_live_snapshots(id,snapshot_id,instrument,setup_key,known_at,evaluated_through,configuration_id,evaluation_mode,snapshot,observation)
 values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,['f'.repeat(64),source.snapshot_id,source.instrument,source.setup_key,source.known_at,source.evaluated_through,source.configuration_id,source.evaluation_mode,source.snapshot,source.observation]);const triggerWriteMs=performance.now()-triggerAt;
 assert.equal(await count('setup2_live_snapshot_index'),originals.length+1);
 assert.equal((await db.query("select i.captured_at=s.captured_at same from setup2_live_snapshot_index i join setup2_live_snapshots s using(id) where id=$1",['f'.repeat(64)])).rows[0].same,true);
 const configuration=(await db.query('select id,configuration from setup2_live_configurations where id=$1',[source.configuration_id])).rows[0];
 await db.exec('set role service_role');
 await assert.rejects(()=>db.exec('delete from setup2_live_snapshot_index'),/permission denied/);
 const packet={configuration,payloads:[],snapshots:[{...source,id:'e'.repeat(64)}]};const rpcAt=performance.now();
 await db.query('select setup2_store_live_evidence($1,$2,$3)',['GBPUSD','capture-probe',packet]);const captureRpcMs=performance.now()-rpcAt;await db.exec('reset role');
 assert.equal(await count('setup2_live_snapshot_index'),originals.length+2);
 assert.deepEqual((await db.query('select instrument,state from setup2_live_state order by instrument')).rows,stateBefore);
 await assert.rejects(()=>db.exec("insert into setup2_live_snapshot_index select (jsonb_populate_record(null::setup2_live_snapshot_index,to_jsonb(i)||jsonb_build_object('id',repeat('0',64)))).* from setup2_live_snapshot_index i limit 1"),/foreign key/);
 await db.exec("alter table setup2_live_snapshot_index add constraint fixture_index_failure check(id<>repeat('a',64))");
 await db.exec('set role service_role');await assert.rejects(()=>db.query('select setup2_store_live_evidence($1,$2,$3)',['GBPUSD','capture-probe',{configuration,payloads:[],snapshots:[{...source,id:'a'.repeat(64)}]}]),/fixture_index_failure/);await db.exec('reset role');
 assert.equal((await db.query("select count(*)::int n from setup2_live_snapshots where id=repeat('a',64)")).rows[0].n,0);
 await db.exec('alter table setup2_live_snapshot_index drop constraint fixture_index_failure');
 const readAt=performance.now();const lean=(await db.query('select * from setup2_live_snapshot_index order by captured_at,id')).rows;const readMs=performance.now()-readAt;
 assert(readMs<3000);assert(maxBackfillMs<3000);assert(triggerWriteMs<1000);assert(captureRpcMs<3000);assert(captureRpcMs-baselineCaptureRpcMs<1000);
 return {foreignKeyEnforced:true,triggerFailureRollsBackOriginal:true,baselineCaptureRpcMs,captureRpcMs,captureOverheadMs:captureRpcMs-baselineCaptureRpcMs,watermarkUnchanged:true,rows:lean.length,indexBytes:Buffer.byteLength(JSON.stringify(lean)),readMs,maxBackfillMs,triggerWriteMs,batches,idempotentRetry:true,resumableCursor:true,originalRowsUnchanged:true,captureTimePreserved:true,completeIdentityCoverage:true,readOnlyBrowser:true,productionWrites:0};
}
