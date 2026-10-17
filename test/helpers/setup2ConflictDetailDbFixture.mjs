import assert from 'node:assert/strict';
import fs from 'node:fs';

export async function checkLiveEvidenceConflictDetail(db) {
 const read=file=>fs.readFileSync('supabase/migrations/'+file,'utf8');
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls');
 await db.exec(read('20261007170000_setup2_live_watcher.sql').split('select cron.schedule')[0]);
 await db.exec(read('20261015103000_setup2_live_evidence.sql'));
 await db.exec(read('20261015110000_bounded_live_evidence_packets.sql'));
 const metadata=async()=>(await db.query("select proacl::text,prosecdef,proconfig from pg_proc where oid='setup2_store_evidence_batch(text,jsonb)'::regprocedure")).rows;
 const rows=async()=>(await db.query('select id,md5(row_to_json(s)::text) fingerprint from setup2_live_snapshots s order by id')).rows;
 const at='2026-10-16T13:55:00Z';
 const item={id:'a'.repeat(64),snapshot_id:'EURUSD:setup1:diagnostic:stand:1792158900',instrument:'EURUSD',setup_key:'EURUSD:setup1:diagnostic',known_at:at,evaluated_through:'2026-10-16T14:00:00Z',evaluation_mode:'catchup',snapshot:{id:'EURUSD:setup1:diagnostic:stand:1792158900',instrument:'EURUSD',setupKey:'EURUSD:setup1:diagnostic',knownAt:1792158900,direction:'short',checklist:{checks:{}}},observation:{}};
 const batch={configuration:{id:'b'.repeat(64),configuration:{instrument:'EURUSD'}},payloads:[],snapshots:[item]};
 const write=value=>db.query('select setup2_store_evidence_batch($1,$2)',['EURUSD',value]);
 await write(batch);
 const before=await rows(),acl=await metadata();
 const changed=structuredClone(batch);changed.snapshots[0].observation={privateMarker:'NEVER_LOG_THIS_VALUE'};
 await assert.rejects(()=>write(changed),e=>e.code==='P0001'&&e.message==='Live snapshot identity conflict'&&!e.detail);
 const migration=read('20261017073500_live_evidence_observation_paths.sql');
 await db.exec(migration);assert.deepEqual(await rows(),before);assert.deepEqual(await metadata(),acl);
 await write(batch);
 const cases=[
  ['observation',b=>b.snapshots[0].observation={privateMarker:'NEVER_LOG_THIS_VALUE'},['observation'],['observation.privateMarker']],
  ['nested',b=>b.snapshots[0].observation={rangeCourse:{lifecycle:{main:{reason:'NEVER_LOG_THIS_VALUE'}}}},['observation'],['observation.rangeCourse']],
  ['array',b=>b.snapshots[0].observation={history:['NEVER_LOG_THIS_VALUE']},['observation'],['observation.history']],
  ['snapshot',b=>b.snapshots[0].snapshot.direction='long',['snapshot']],
  ['snapshot_id',b=>{b.snapshots[0].snapshot_id+='x';b.snapshots[0].snapshot.id+='x'},['snapshot','snapshot_id']],
  ['configuration_id',b=>b.configuration.id='c'.repeat(64),['configuration_id']],
  ['evaluation_mode',b=>b.snapshots[0].evaluation_mode='live',['evaluation_mode']],
  ['known_at',b=>{b.snapshots[0].known_at='2026-10-16T13:56:00Z';b.snapshots[0].snapshot.knownAt+=60},['known_at','snapshot']],
  ['evaluated_through',b=>b.snapshots[0].evaluated_through='2026-10-16T14:01:00Z',['evaluated_through']]
 ];
 for(const [name,mutate,fields,paths=[]] of cases){
  const bad=structuredClone(batch);mutate(bad);
  await assert.rejects(()=>write(bad),error=>{
   assert.equal(error.code,'P0001');assert.equal(error.message,'Live snapshot identity conflict');
   assert.deepEqual(JSON.parse(error.detail),{id:item.id,differingFields:fields,observationPaths:paths});
   assert(!error.detail.includes('NEVER_LOG_THIS_VALUE'));return true;
  },name);
  assert.deepEqual(await rows(),before);
 }

 const capped=structuredClone(batch);capped.snapshots[0].observation=Object.fromEntries(Array.from({length:50},(_,i)=>['field'+i,'NEVER_LOG_THIS_VALUE']));
 await assert.rejects(()=>write(capped),e=>{assert.equal(JSON.parse(e.detail).observationPaths.length,32);assert(!e.detail.includes('NEVER_LOG_THIS_VALUE'));return true;});
 await db.exec('begin');
 const nested=structuredClone(batch);nested.snapshots[0].id='d'.repeat(64);
 nested.snapshots[0].observation={rangeCourse:{lifecycle:{main:{reason:'original'}}}};
 await write(nested);const drift=structuredClone(nested);drift.snapshots[0].observation.rangeCourse.lifecycle.main.reason='NEVER_LOG_THIS_VALUE';
 await assert.rejects(()=>write(drift),e=>{assert.deepEqual(JSON.parse(e.detail).observationPaths,['observation.rangeCourse.lifecycle.main.reason']);assert(!e.detail.includes('NEVER_LOG_THIS_VALUE'));return true;});
 await db.exec('rollback');await db.exec('begin');
 const deep=structuredClone(batch);deep.snapshots[0].id='e'.repeat(64);deep.snapshots[0].observation={};let cursor=deep.snapshots[0].observation;
 for(let i=0;i<12;i++){cursor.nested={};cursor=cursor.nested;}cursor.value='original';
 await write(deep);const deepDrift=structuredClone(deep);cursor=deepDrift.snapshots[0].observation;for(let i=0;i<12;i++)cursor=cursor.nested;cursor.value='NEVER_LOG_THIS_VALUE';
 await assert.rejects(()=>write(deepDrift),e=>{assert(!e.detail.includes('NEVER_LOG_THIS_VALUE'));assert.equal(JSON.parse(e.detail).observationPaths[0].split('.').length,8);return true;});
 await db.exec('rollback');
 const equivalent=structuredClone(batch);equivalent.snapshots[0].known_at='2026-10-16T15:55:00+02:00';
 await write(equivalent);assert.deepEqual(await rows(),before);
 await db.exec('set role service_role');
 await assert.rejects(()=>write(batch),/permission denied/);await db.exec('reset role');
 const original=read('20261015110000_bounded_live_evidence_packets.sql').split('revoke all on function public.setup2_store_evidence_batch')[0];
 await db.exec(original.slice(original.indexOf('create function')).replace('create function','create or replace function'));
 await assert.rejects(()=>write(changed),e=>e.code==='P0001'&&!e.detail);
 await db.exec(migration);assert.deepEqual(await metadata(),acl);assert.deepEqual(await rows(),before);
 return {baselineWithoutDetails:true,fieldsVerified:cases.map(c=>c[0]),originalsUnchanged:true,aclUnchanged:true,timezoneEquivalentRetry:true,rollbackVerified:true,detailContainsOnlyIdAndFieldNames:true,productionWrites:0};
}
