import fs from 'node:fs';
export async function prepareEvidenceDb(db) {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;`);
 const original=fs.readFileSync('supabase/migrations/20261007170000_setup2_live_watcher.sql','utf8').split("select cron.schedule")[0];
 await db.exec(original);
 await db.exec(fs.readFileSync('supabase/migrations/20261015103000_setup2_live_evidence.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261015110000_bounded_live_evidence_packets.sql','utf8'));
 await db.exec("update setup2_live_state set enabled=true where instrument='GBPUSD'");
}
export async function checkEvidenceDb(db,batch) {
 const assert=(value,message)=>{if(!value)throw new Error(message);};
 const expectFailure=async fn=>{try{await fn();}catch{return;}throw new Error('Expected SQL rejection');};
 const acquire=()=>db.query("select setup2_acquire_lease('GBPUSD','test-owner',180)");
 const write=async(value=batch,owner='test-owner')=>db.query('select setup2_checkpoint_with_evidence($1,$2,$3,$4,$5)',
  ['GBPUSD',owner,{evaluatedThrough:'2026-10-15T06:00:00Z'},[],[value]]);
 await expectFailure(()=>write());
 await acquire();
 for(const value of [null,[],[{}],[{...batch,snapshots:null}],[{...batch,snapshots:[]}]])
  await expectFailure(()=>db.query('select setup2_checkpoint_with_evidence($1,$2,$3,$4,$5)',['GBPUSD','test-owner',{},[],value]));
 for(const field of ['knownAt','checklist','direction','id','instrument','setupKey']){const invalid=structuredClone(batch);invalid.snapshots[0].snapshot[field]=null;await expectFailure(()=>write(invalid));}
 for(const missing of [{$liveEvidenceRef:'f'.repeat(64)},{$liveEvidenceChunks:['f'.repeat(64)]}]){const bad=structuredClone(batch);bad.snapshots[0].snapshot.m1Check=missing;await expectFailure(()=>write(bad));}
 const cycle=structuredClone(batch);cycle.payloads=[{id:'e'.repeat(64),payload:{$liveEvidenceRef:'e'.repeat(64)}}];cycle.snapshots[0].snapshot.m1Check={$liveEvidenceRef:'e'.repeat(64)};await expectFailure(()=>write(cycle));
 const nullChecklist=structuredClone(batch);nullChecklist.snapshots[0].snapshot.checklist={$liveEvidenceRef:'e'.repeat(64)};await expectFailure(()=>write(nullChecklist));
 const chunksChecklist=structuredClone(batch);chunksChecklist.snapshots[0].snapshot.checklist.checks={$liveEvidenceChunks:[]};await expectFailure(()=>write(chunksChecklist));
 assert((await db.query('select count(*)::int n from setup2_live_payloads')).rows[0].n===0,'Invalid graph retained payloads');
 await write();
 await acquire();await write();
 assert((await db.query('select count(*)::int n from setup2_live_snapshots')).rows[0].n===batch.snapshots.length,'Retry duplicated evidence');
 const bad=structuredClone(batch);bad.snapshots[0].instrument='EURUSD';
 await acquire();await expectFailure(()=>write(bad));
 assert((await db.query("select lease_owner from setup2_live_state where instrument='GBPUSD'")).rows[0].lease_owner==='test-owner','Failed evidence consumed lease/checkpoint');
 const changed=structuredClone(batch);changed.configuration.configuration.version='different';
 await expectFailure(()=>write(changed));
 const different=structuredClone(batch);different.snapshots[0].snapshot.entry={id:'other'};await expectFailure(()=>write(different));
 await db.exec('set role anon');
 assert((await db.query('select count(*)::int n from setup2_live_snapshots')).rows[0].n===batch.snapshots.length,'Public read unavailable');
 await expectFailure(()=>db.exec('delete from setup2_live_snapshots'));
 await expectFailure(()=>write());await db.exec('reset role');
 assert((await db.query('select count(*)::int n from setup2_alarm_events')).rows[0].n===0,'Evidence produced alarm');
 return {retryIdempotent:true,invalidLeaseRejected:true,transactionRollback:true,configurationConflictRejected:true,readOnlyBrowser:true,noAlarm:true};
}
