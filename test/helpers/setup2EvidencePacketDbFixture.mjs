import assert from 'node:assert/strict';
import {checkpointEvidence,EVIDENCE_REQUEST_BYTES} from '../../services/setup2/evidenceCheckpoint.js';
export async function checkStagedEvidenceDb(db,batch) {
 const owner='packet-test',instrument=batch.configuration.configuration.instrument,parameters={p_instrument:instrument,p_owner:owner,p_state:{evaluatedThrough:batch.snapshots.at(-1).evaluated_through},p_events:[]};
 const routes=[],metrics=[],request=async(path,body)=>{
  const at=performance.now(),size=Buffer.byteLength(JSON.stringify(body));assert(size<=EVIDENCE_REQUEST_BYTES);
  const names=Object.keys(body),args=names.map(name=>'p.'+name),columns=names.map(name=>name+' '+(['p_instrument','p_owner'].includes(name)?'text':'jsonb'));
  const value=await db.query(`select ${path.split('/').at(-1)}(${args.join(',')}) from json_to_record($1::json) as p(${columns.join(',')})`,[JSON.stringify(body)]);
  metrics.push({route:path,bytes:size,ms:performance.now()-at});routes.push(path);return value;
 };
 const acquire=()=>db.query('select setup2_acquire_lease($1,$2,900)',[instrument,owner]);
 const manifest=[{configuration_id:batch.configuration.id,snapshot_ids:batch.snapshots.map(s=>s.id)}];
 await acquire();await assert.rejects(()=>request('rpc/setup2_checkpoint_with_evidence',{...parameters,p_evidence:manifest}),/Missing staged/);
 assert.equal((await db.query('select state from setup2_live_state where instrument=$1',[instrument])).rows[0].state.evaluatedThrough,undefined);
 const empty={configuration:batch.configuration,payloads:[],snapshots:[batch.snapshots[0]]};
 const bad=structuredClone(empty);bad.snapshots[0].snapshot.m1Check={$liveEvidenceRef:'f'.repeat(64)};
 await assert.rejects(()=>request('rpc/setup2_store_live_evidence',{p_instrument:instrument,p_owner:owner,p_evidence:bad}),/Missing live evidence/);
 await assert.rejects(()=>request('rpc/setup2_store_live_evidence',{p_instrument:instrument,p_owner:'wrong',p_evidence:empty}),/Watcher lease expired/);
 const cyclic={configuration:batch.configuration,snapshots:[],payloads:[{id:'e'.repeat(64),payload:{$liveEvidenceRef:'e'.repeat(64)}}]};
 await assert.rejects(()=>request('rpc/setup2_store_live_evidence',{p_instrument:instrument,p_owner:owner,p_evidence:cyclic}),/cyclic/);
 let stagedCalls=0;await assert.rejects(()=>checkpointEvidence(async(path,body)=>{if(++stagedCalls===2)throw new Error('connection interrupted');return request(path,body);},parameters,[batch]),/connection interrupted/);
 assert.equal((await db.query('select state from setup2_live_state where instrument=$1',[instrument])).rows[0].state.evaluatedThrough,undefined);
 await checkpointEvidence(request,parameters,[batch]);
 const originals=(await db.query('select id,captured_at from setup2_live_snapshots order by id')).rows;
 assert.equal(originals.length,batch.snapshots.length);
 await acquire();await checkpointEvidence(request,parameters,[batch,batch,batch]);
 assert.deepEqual((await db.query('select id,captured_at from setup2_live_snapshots order by id')).rows,originals);
 const conflict=structuredClone(empty);conflict.snapshots[0].snapshot.direction=conflict.snapshots[0].snapshot.direction==='long'?'short':'long';
 await acquire();await assert.rejects(()=>request('rpc/setup2_store_live_evidence',{p_instrument:instrument,p_owner:owner,p_evidence:conflict}),/identity conflict/);
 await assert.rejects(()=>request('rpc/setup2_checkpoint_with_evidence',{...parameters,p_evidence:[{configuration_id:'f'.repeat(64),snapshot_ids:[batch.snapshots[0].id]}]}),/Missing staged/);
 await db.exec('set role anon');await assert.rejects(()=>request('rpc/setup2_store_live_evidence',{p_instrument:instrument,p_owner:owner,p_evidence:empty}),/permission denied/);await db.exec('reset role');
 assert(Math.max(...metrics.map(m=>m.ms))<2000,'RPC too close to production 8s budget');
 return {partialFailurePreservesWatermark:true,postgrestJsonEnvelope:true,snapshotCount:originals.length,requests:metrics.length,maxBytes:Math.max(...metrics.map(m=>m.bytes)),maxRpcMs:Math.max(...metrics.map(m=>m.ms)),finalRpcMs:metrics.filter(m=>m.route.endsWith('checkpoint_with_evidence')).map(m=>m.ms),missingRejected:true,cycleRejected:true,conflictRejected:true,leaseRequired:true,retryPreservesCapturedAt:true,unchangedTimeout:true,productionWrites:0};
}
