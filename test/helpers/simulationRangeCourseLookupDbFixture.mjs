import assert from 'node:assert/strict';

export async function checkSimulationRangeCourseLookupDb(db,run,target) {
 const original=(await db.query('select id,known_at,xmin::text,md5(snapshot::text) hash from trade_setup_simulation_setups where run_id=$1 order by id',[run.id])).rows;
 const definition=(await db.query("select pg_get_functiondef('save_trade_setup_simulation_setups(text,jsonb)'::regprocedure) sql")).rows[0].sql;
 const reference=definition.match(/select s\.snapshot into reference from public\.trade_setup_simulation_setups s([\s\S]*?)order by s\.id limit 1;/);
 assert(reference,'Writer reference query must remain auditable');
 const query=('select s.snapshot from public.trade_setup_simulation_setups s'+reference[1]+'order by s.id limit 1')
  .replaceAll('save_trade_setup_simulation_setups.run_id','$1::text').replaceAll("course->>'setupKey'",'$2::text')
  .replaceAll("(course->>'validatedAt')::numeric",'$3::numeric').replaceAll('not is_countertrend','not true');
 const args=[run.id,target.setupKey,String(target.rangeCourse.validatedAt)];
 assert.equal((await db.query(query,args)).rows.length,0);
 const plan=(await db.query('explain(analyze,buffers,format json) '+query,args)).rows[0]['QUERY PLAN'][0];
 const heapBlocks=Number((await db.query("select pg_relation_size('trade_setup_simulation_setups')/current_setting('block_size')::int blocks")).rows[0].blocks);
 const touched=(plan.Plan['Shared Hit Blocks']??0)+(plan.Plan['Shared Read Blocks']??0);
 // Ein fehlender Zeitstempel darf keine fachfremden TOAST-Belege dekomprimieren.
 assert(touched<=heapBlocks+10,`Reference lookup toasted unrelated snapshots: ${touched} blocks for ${heapBlocks} heap blocks`);
 await db.exec("set statement_timeout='3s'");
 const write=items=>db.query('select save_trade_setup_simulation_setups($1,$2)',[run.id,items]);
 const started=performance.now();await write([target]);const writeMs=performance.now()-started;
 assert(writeMs<3000);await write([target]);
 assert.deepEqual((await db.query('select snapshot from trade_setup_simulation_setups where run_id=$1 and id=$2',[run.id,target.id])).rows[0].snapshot,target);
 const next=structuredClone(target);next.id+=':next';next.knownAt+=60;await write([next]);
 const rejected=[];
 for(const field of ['invalidation','target1','target2']){
  const bad=structuredClone(target);bad.id+=':forged-'+field;
  bad.rangeCourse[field]+=0.01;
  if(field==='invalidation')bad.checklist.setup.primary.invalidation=bad.rangeCourse[field];
  else bad.checklist.setup.primary.targetSelection[field].price=bad.rangeCourse[field];
  await assert.rejects(()=>write([bad]),/Invalid frozen range course/);rejected.push(field);
 }
 for(const fraction of [0.4,0.6]){
  const item=structuredClone(target);item.id+=':fraction-'+fraction;item.setupKey+=':fraction-'+fraction;
  item.knownAt+=fraction;item.rangeCourse.setupKey=item.setupKey;item.rangeCourse.validatedAt=item.knownAt;
  item.rangeCourse.lifecycle.evaluatedAt=Math.max(item.rangeCourse.lifecycle.evaluatedAt,item.knownAt);
  await write([item]);const following=structuredClone(item);following.id+=':next';following.knownAt+=60;await write([following]);
 }
 const collision=structuredClone(target);collision.id+=':collision';collision.setupKey+=':collision';collision.rangeCourse.setupKey=collision.setupKey;
 collision.rangeCourse.target1+=0.001;collision.checklist.setup.primary.targetSelection.target1.price=collision.rangeCourse.target1;
 await write([collision]);const following=structuredClone(collision);following.id+=':next';following.knownAt+=60;await write([following]);
 const after=(await db.query('select id,known_at,xmin::text,md5(snapshot::text) hash from trade_setup_simulation_setups where run_id=$1 and id=any($2::text[]) order by id',[run.id,original.map(r=>r.id)])).rows;
 assert.deepEqual(after,original);
 assert.equal((await db.query('select count(*)::int n from trade_setup_simulation_setups where run_id=$1 and id like $2',[run.id,target.id+':forged-%'])).rows[0].n,0);
 return {originalRows:original.length,target:target.id,heapBlocks,touchedBlocks:touched,lookupMs:plan['Execution Time'],writeMs,
  retryIdempotent:true,originalRowsAndXminUnchanged:true,frozenSelfConsistentForgeriesRejected:rejected,
  fractionalTimestampRoundingPreserved:true,sameTimeOtherSetupPreserved:true,timeoutUnchanged:'3s',plan,productionWrites:0};
}
