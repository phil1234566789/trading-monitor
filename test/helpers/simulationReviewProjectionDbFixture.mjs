import assert from 'node:assert/strict';
import {SIMULATION_REVIEW_METADATA_FIELDS,simulationReviewMetadata,simulationReviewMetadataProjection} from '../../src/simulationReviewMetadata.js';
import {encodeSnapshotStructures} from '../../src/tradeSetupSnapshotStorage.js';
const tables=['trade_setup_simulation_setups','trade_setup_simulation_entries'];
const expressions=SIMULATION_REVIEW_METADATA_FIELDS.split(',').filter(field=>field.includes(':')).map(field=>{const [alias,path]=field.split(':');return `snapshot#>'{${path.split('->').slice(1).join(',')}}' as "${alias}"`;}).join(',');
export async function checkSimulationReviewProjectionDb(db,runId){
 await db.exec("set statement_timeout='3s';set track_functions='pl'");
 const fingerprint=async()=>Promise.all([...tables.map(table=>db.query(`select run_id,id,xmin::text,md5(snapshot::text) snapshot,${table.endsWith('entries')?'md5(outcomes::text)':'null'} outcomes from ${table} order by run_id,id`).then(result=>result.rows)),db.query('select id,xmin::text,md5(run::text) run from trade_setup_simulation_runs order by id').then(result=>result.rows)]);
 const before=await fingerprint(),metrics=[];
 for(const table of tables){
  let after='',count=0;
  for(;;){
   const args=[runId,after],old=(await db.query(`select id,run_id,instrument,direction,${expressions} from ${table} where run_id=$1 and id>$2 order by id limit 10`,args)).rows;
   await db.query('select pg_stat_reset()');const started=performance.now();
   const actual=(await db.query(`select id,run_id,instrument,direction,metadata from ${table}_review_metadata where run_id=$1 and id>$2 order by id limit 10`,args)).rows;
   metrics.push({table,rows:actual.length,ms:performance.now()-started,bytes:Buffer.byteLength(JSON.stringify(actual))});
   assert.deepEqual(actual.map(({metadata,...row})=>({...row,...metadata})),old);
   await db.query('select pg_stat_force_next_flush()');await db.query('select pg_stat_clear_snapshot()');
   const calls=Number((await db.query("select calls from pg_stat_user_functions where funcname='simulation_review_metadata'")).rows[0]?.calls??0);
   assert.equal(calls,actual.length,'Projection must run once per returned row, after filtering and limiting');
   if(!actual.length)break;count+=actual.length;after=actual.at(-1).id;
  }
  assert(count>0);
 }
 for(const snapshot of [{},{id:'missing',knownAt:12},...Array.from({length:3},(_,i)=>({id:'format-'+i,checklist:{status:'ready',checks:{}},checklistHistory:Array.from({length:i?150:0},()=>({same:'value'.repeat(100)})),structure:{history:Array.from({length:300},()=>({price:1.2,time:100}))}}))]){
  for(const stored of [snapshot,encodeSnapshotStructures(snapshot)]){
   const metadata=(await db.query('select simulation_review_metadata($1) metadata',[stored])).rows[0].metadata;
   assert.deepEqual(simulationReviewMetadata(metadata),simulationReviewMetadata(simulationReviewMetadataProjection(stored)));
  }
 }
 const plans=[];
 for(const table of tables){
  const plan=(await db.query(`explain(analyze,verbose,format json) select id,metadata from ${table}_review_metadata where run_id=$1 and id>$2 order by id limit 10`,[runId,''])).rows[0]['QUERY PLAN'][0];
  plans.push(plan);assert.equal(plan.Plan['Node Type'],'Limit');assert.match(JSON.stringify(plan.Plan),/Index Scan/);assert.match(plan.Plan.Plans[0]['Index Cond'],/run_id/);assert.match(plan.Plan.Plans[0]['Index Cond'],/id >/);assert.equal(plan.Plan['Actual Rows'],Math.min(10,before[tables.indexOf(table)].filter(row=>row.run_id===runId).length));
 }
 for(const role of ['anon','authenticated','service_role']){
  // service_role besitzt im produktiven Supabase Standardsystem bereits Leserechte; hier explizit im Fixture.
  if(role==='service_role')await db.exec('grant select on trade_setup_simulation_setups,trade_setup_simulation_entries to service_role');
  await db.exec('set role '+role);
  for(const table of tables){
   assert.deepEqual((await db.query(`select id from ${table}_review_metadata where run_id=$1 order by id`,[runId])).rows,(await db.query(`select id from ${table} where run_id=$1 order by id`,[runId])).rows);
   await assert.rejects(()=>db.query(`delete from ${table}_review_metadata`),/permission denied|not automatically updatable/);
  }
  await db.exec('reset role');
 }
 await db.exec("alter policy simulation_setups_read on trade_setup_simulation_setups using(instrument='GBPUSD');set role anon");
 assert.deepEqual((await db.query('select id from trade_setup_simulation_setups_review_metadata order by id')).rows,(await db.query('select id from trade_setup_simulation_setups order by id')).rows);
 await db.exec('reset role;alter policy simulation_setups_read on trade_setup_simulation_setups using(true)');
 assert.deepEqual(await fingerprint(),before);
 const functionInfo=(await db.query("select prosecdef,provolatile,prolang=(select oid from pg_language where lanname='plpgsql') as plpgsql from pg_proc where proname='simulation_review_metadata'")).rows[0];assert.deepEqual(functionInfo,{prosecdef:false,provolatile:'i',plpgsql:true});
 const toast=(await db.query("select relname,pg_relation_size(reltoastrelid)::int as bytes from pg_class where relnamespace='public'::regnamespace and relname=any($1::text[])",[tables])).rows;assert(toast.every(row=>row.bytes>0),'Native fixtures must exercise actual external TOAST storage');
 return {toast,rows:before.flat().filter(row=>row.run_id===runId).length,maxReadMs:Math.max(...metrics.map(row=>row.ms)),bytes:metrics.reduce((n,row)=>n+row.bytes,0),metrics,plans,oneProjectionPerReturnedRow:true,runAndKeysetFilterBeforeProjection:true,sourceRowsUnchanged:true,roleAndRlsParity:true,rawCompactAndMissingFields:true,productionWrites:0};
}
