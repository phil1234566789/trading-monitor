import assert from 'node:assert/strict';
import fs from 'node:fs';
import {encodeSnapshotStructures,decodeSnapshotStructures} from '../../src/tradeSetupSnapshotStorage.js';

export async function checkRiskCourseDb(db,fixture,migration='supabase/migrations/20261016122000_simulation_joint_loss_range_course.sql'){
 const acl=async()=>(await db.query("select proacl::text,prosecdef,proconfig from pg_proc where oid='save_trade_setup_simulation_setups(text,jsonb)'::regprocedure")).rows;
 const fingerprint=async()=>(await db.query('select run_id,id,md5(snapshot::text) hash from trade_setup_simulation_setups order by run_id,id')).rows;
 const beforeAcl=await acl(),beforeRows=await fingerprint();
 await db.exec(fs.readFileSync(migration,'utf8'));
 assert.deepEqual(await acl(),beforeAcl);
 assert.deepEqual(await fingerprint(),beforeRows);
 await db.exec("set statement_timeout='3s'");
 const write=(runId,items)=>db.query('select save_trade_setup_simulation_setups($1,$2)',[runId,items.map(encodeSnapshotStructures)]);
 const saveRun=run=>db.query('select save_trade_setup_simulation_run($1)',[run]);
 const metrics=[];
 const nativeBefore=JSON.stringify(fixture);
 for(const instrument of ['GBPUSD','EURUSD']){
  const items=fixture.setups.filter(s=>s.instrument===instrument),started=performance.now();
  await write(fixture.run.id,items);metrics.push({instrument,candidates:items.length,ms:performance.now()-started});
  const entries=fixture.entries.filter(r=>r.snapshot.instrument===instrument);
  if(entries.length)await db.query('select save_trade_setup_simulation_entries($1,$2)',[fixture.run.id,entries.map(r=>({...r,snapshot:encodeSnapshotStructures(r.snapshot)}))]);
 }
 const verify=async()=>{
  for(const snapshot of fixture.setups){
   const stored=(await db.query('select snapshot from trade_setup_simulation_setups where run_id=$1 and id=$2',[fixture.run.id,snapshot.id])).rows[0].snapshot;
   assert.deepEqual(stored,encodeSnapshotStructures(snapshot));assert.deepEqual(decodeSnapshotStructures(stored),snapshot);
  }
  for(const row of fixture.entries){
   const stored=(await db.query('select snapshot,outcomes from trade_setup_simulation_entries where run_id=$1 and id=$2',[fixture.run.id,row.snapshot.id])).rows[0];
   assert.deepEqual(stored.snapshot,encodeSnapshotStructures(row.snapshot));assert.deepEqual(decodeSnapshotStructures(stored.snapshot),row.snapshot);
   assert.deepEqual(stored.outcomes,row.outcomes);
  }
 };
 await verify();
 await write(fixture.run.id,fixture.setups);
 for(const row of fixture.entries)await db.query('select save_trade_setup_simulation_entries($1,$2)',[fixture.run.id,[{...row,snapshot:encodeSnapshotStructures(row.snapshot)}]]);
 await verify();
 const reference=fixture.setups.find(s=>s.setupKey==='EURUSD:setup1:19982'&&s.dealingRange.status==='validated');
 const terminal=fixture.setups.find(s=>s.dealingRange.reason==='twoConsecutiveJointLosses');
 assert(reference&&terminal);
 const invalid=[];
 const reject=async(name,mutate,expected=/Invalid joint-loss risk/)=>{
  const runId=fixture.run.id+':negative:'+name;
  await saveRun({...fixture.run,id:runId});await write(runId,[reference]);
  const bad=structuredClone(terminal);mutate(bad);
  if(name!=='snapshot-risk-mismatch' && bad.rangeCourse.lifecycle.riskInvalidation)
   bad.dealingRange.riskInvalidation=structuredClone(bad.rangeCourse.lifecycle.riskInvalidation);
  const before=await fingerprint();
  await assert.rejects(()=>write(runId,[bad]),expected);
  assert.deepEqual(await fingerprint(),before);
  invalid.push(name);
 };
 await reject('unknown-course',s=>{s.rangeCourse.version='countertrend-joint-loss-risk-v4';},/Invalid frozen range course/);
 await reject('unknown-risk-version',s=>{s.rangeCourse.lifecycle.riskInvalidation.version='unsupported';});
 await reject('non-numeric-time',s=>{s.rangeCourse.lifecycle.riskInvalidation.recognizedAt='1792052640';});
 await reject('before-validation',s=>{
  const at=s.rangeCourse.validatedAt-1;
  s.rangeCourse.lifecycle.riskInvalidation.recognizedAt=at;s.rangeCourse.lifecycle.main.recognizedAt=at;
 });
 await reject('future-time',s=>{
  const at=s.rangeCourse.lifecycle.evaluatedAt+60;
  s.rangeCourse.lifecycle.riskInvalidation.recognizedAt=at;s.rangeCourse.lifecycle.main.recognizedAt=at;
  s.knownAt=at;
 });
 await reject('duplicate-entry',s=>{s.rangeCourse.lifecycle.riskInvalidation.entryIds.fill('same');});
 await reject('missing-entry',s=>{s.rangeCourse.lifecycle.riskInvalidation.entryIds.pop();});
 await reject('non-string-entry',s=>{s.rangeCourse.lifecycle.riskInvalidation.entryIds[0]=123;});
 await reject('empty-entry',s=>{s.rangeCourse.lifecycle.riskInvalidation.entryIds[0]='';});
 await reject('mismatched-main-time',s=>{s.rangeCourse.lifecycle.main.recognizedAt+=60;});
 await reject('mismatched-main-reason',s=>{s.rangeCourse.lifecycle.main.reason='invalidation';});
 await reject('active-main',s=>{s.rangeCourse.lifecycle.main.state='active';});
 await reject('entry-search-open',s=>{s.rangeCourse.lifecycle.entrySearchAllowed=true;});
 await reject('missing-risk',s=>{delete s.rangeCourse.lifecycle.riskInvalidation;});
 await reject('snapshot-risk-mismatch',s=>{s.dealingRange.riskInvalidation.entryIds=['one','two'];});
 await reject('snapshot-status-mismatch',s=>{s.dealingRange.status='validated';});
 await reject('snapshot-before-risk',s=>{s.knownAt=s.rangeCourse.lifecycle.riskInvalidation.recognizedAt-60;});
 await reject('unproved-dr-stage-v3',s=>{s.dealingRange.version='countertrend-abcdef-v3';});
 await reject('frozen-price',s=>{s.rangeCourse.invalidation+=0.01;},/Invalid frozen range course/);
 const immutable=structuredClone(reference);immutable.direction=immutable.direction==='long'?'short':'long';
 const beforeImmutable=await fingerprint();
 await assert.rejects(()=>write(fixture.run.id,[immutable]),/Setup snapshot is immutable/);
 assert.deepEqual(await fingerprint(),beforeImmutable);
 const beforeBackward=structuredClone(terminal);
 beforeBackward.rangeCourse.lifecycle.evaluatedAt-=60;
 await write(fixture.run.id,[beforeBackward]);
 assert.deepEqual((await db.query('select snapshot from trade_setup_simulation_setups where run_id=$1 and id=$2',[fixture.run.id,terminal.id])).rows[0].snapshot,encodeSnapshotStructures(terminal));
 const legacy=[];
 for(const stage of ['countertrend-abcdef-v1','countertrend-abcdef-v2']){
  const old=structuredClone(reference);old.dealingRange.version=stage;
  old.rangeCourse.version='countertrend-validation-t1-be-t2-v2';
  const runId=fixture.run.id+':legacy:'+stage;
  await saveRun({...fixture.run,id:runId});await write(runId,[old]);
  const before=await fingerprint();
  const changed=structuredClone(old);changed.rangeCourse.version='countertrend-joint-loss-risk-v3';
  await assert.rejects(()=>write(runId,[changed]),/Range course levels are immutable/);
  assert.deepEqual(await fingerprint(),before);legacy.push(stage);
 }
 const old=structuredClone(reference),runId=fixture.run.id+':legacy:first-validation-v1';
 old.rangeCourse.version='first-validation-frozen-levels-m5-v1';old.rangeCourse.lifecycle.evaluatedAt+=60;
 const {rangeCourse,...seed}=old;
 await saveRun({...fixture.run,id:runId});await write(runId,[seed]);await write(runId,[old]);
 legacy.push('first-validation-frozen-levels-m5-v1');
 const aclAfter=await acl();assert.deepEqual(aclAfter,beforeAcl);
 await db.exec('set role anon');
 await write(fixture.run.id,[reference]);
 await assert.rejects(()=>db.exec('delete from trade_setup_simulation_setups'),/permission denied/);
 await db.exec('reset role');
 assert.equal(JSON.stringify(fixture),nativeBefore);
 await verify();
 return {runId:fixture.run.id,originalCandidates:fixture.setups.length,originalEntries:fixture.entries.length,
  snapshotsRoundtripped:fixture.setups.length+fixture.entries.length,compactJsonbAndDecodedOriginalsEqual:true,
  immutableSnapshotRejected:true,frozenLevelsAndVersionUnchanged:true,backwardsCourseDidNotOverwrite:true,
  legacyVersionsAccepted:legacy,invalidRejected:invalid,writerAclAndSecurityDefinerUnchanged:true,
  publicReadOnlyTablesPreserved:true,migrationChangedNoRows:true,retryIdempotent:true,
  fixtureObjectsUnchanged:true,metrics,productionWrites:0};
}
