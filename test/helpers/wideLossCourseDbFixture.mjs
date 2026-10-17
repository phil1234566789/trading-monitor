import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateJointLossRisk} from '../../src/dealingRangeRisk.js';
export async function checkWideLossCourseDb(db,fixture,migration='supabase/migrations/20261017190000_simulation_wide_loss_range_course.sql') {
 const at=Date.parse('2026-08-18T21:59:00+02:00')/1000;
 const old=structuredClone(fixture.validationSnapshot),fresh=structuredClone(old);
 const risk=evaluateJointLossRisk(fixture.entries.flatMap(r=>r.outcomes),at);
 assert(risk);fresh.rangeCourse.version='countertrend-joint-loss-risk-v4';
 fresh.rangeCourse.lifecycle={...fresh.rangeCourse.lifecycle,riskInvalidation:risk,
  main:{state:'ended',reason:'twoConsecutiveJointLosses',endedAt:at,recognizedAt:at},entrySearchAllowed:false,evaluatedAt:at};
 const acl=async()=>(await db.query("select proacl::text,prosecdef,proconfig from pg_proc where oid='save_trade_setup_simulation_setups(text,jsonb)'::regprocedure")).rows;
 const fingerprint=async()=>(await db.query('select run_id,id,md5(snapshot::text) hash from trade_setup_simulation_setups order by run_id,id')).rows;
 const seed=async id=>db.query('insert into trade_setup_simulation_runs values($1,$2)',[id,{id,to:at+3600}]);
 const write=(id,rows)=>db.query('select save_trade_setup_simulation_setups($1,$2)',[id,rows]);
 await seed('legacy');await write('legacy',[old]);
 await seed('new');await assert.rejects(()=>write('new',[fresh]),/Invalid frozen range course/);
 const before=await fingerprint(),beforeAcl=await acl();
 await db.exec(fs.readFileSync(migration,'utf8'));assert.deepEqual(await fingerprint(),before);assert.deepEqual(await acl(),beforeAcl);
 await write('new',[fresh]);await write('new',[fresh]);
 assert.deepEqual((await db.query('select snapshot from trade_setup_simulation_setups where run_id=$1',['new'])).rows[0].snapshot,fresh);
 assert.deepEqual((await db.query('select snapshot from trade_setup_simulation_setups where run_id=$1',['legacy'])).rows[0].snapshot,old);
 const invalid=[];
 const reject=async(name,source,mutate,pattern=/Invalid joint-loss risk/)=>{
  const id='bad:'+name;await seed(id);const bad=structuredClone(source);mutate(bad);const before=await fingerprint();
  await assert.rejects(()=>write(id,[bad]),pattern);assert.deepEqual(await fingerprint(),before);invalid.push(name);
 };
 await reject('new-course-old-rule',fresh,s=>s.rangeCourse.lifecycle.riskInvalidation.version='joint-sl-loss-streak-v1');
 await reject('old-course-new-rule',fresh,s=>s.rangeCourse.version='countertrend-joint-loss-risk-v3');
 await reject('future-knowledge',fresh,s=>{s.rangeCourse.lifecycle.riskInvalidation.recognizedAt=at+60;s.rangeCourse.lifecycle.main.recognizedAt=at+60;});
 await reject('duplicate-entry',fresh,s=>s.rangeCourse.lifecycle.riskInvalidation.entryIds.fill('same'));
 await reject('entry-search-open',fresh,s=>s.rangeCourse.lifecycle.entrySearchAllowed=true);
 await reject('no-risk-proof',fresh,s=>delete s.rangeCourse.lifecycle.riskInvalidation);
 await reject('unknown-course',fresh,s=>s.rangeCourse.version='unsupported',/Invalid frozen range course/);
 await reject('wrong-frozen-level',fresh,s=>s.rangeCourse.invalidation+=.01,/Invalid frozen range course/);
 const changed=structuredClone(old);changed.rangeCourse=fresh.rangeCourse;
 await assert.rejects(()=>write('legacy',[changed]),/Range course levels are immutable/);
 assert.deepEqual((await db.query('select snapshot from trade_setup_simulation_setups where run_id=$1',['legacy'])).rows[0].snapshot,old);
 return {oldVersionAndSnapshotUnchanged:true,newVersionAccepted:true,versionPairsStrict:true,migrationChangesNoRows:true,
  aclAndSecurityUnchanged:true,idempotentRetry:true,oldCourseCannotBeUpgraded:true,negativeCases:invalid,productionWrites:0};
}
