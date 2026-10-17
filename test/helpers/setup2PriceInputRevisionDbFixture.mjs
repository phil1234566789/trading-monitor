import assert from 'node:assert/strict';
export async function checkPriceInputRevisionDb(db,{legacy,missing,repaired,repeated,recapture}) {
 const write=batch=>db.query('select setup2_store_evidence_batch($1,$2)',['EURUSD',batch]);
 const read=async id=>(await db.query('select snapshot,observation,captured_at from setup2_live_snapshots where id=$1',[id])).rows[0];
 await write(legacy);const old=await read(legacy.snapshots[0].id);
 await write(missing);await write(repaired);const current=await read(repaired.snapshots[0].id);
 assert.deepEqual(await read(legacy.snapshots[0].id),old);
 assert.deepEqual(current.snapshot,old.snapshot);
 assert.notDeepEqual(current.observation.priceObservation,old.observation.priceObservation);
 assert.equal(current.observation.priceObservation.rawEndReason,'windowEnd');
 await write(repeated);assert.deepEqual(await read(repaired.snapshots[0].id),current);
 const jsonbState=(await db.query('select $1::jsonb as state',[repaired.priceState])).rows[0].state;
 const restarted=recapture(jsonbState);assert.equal(restarted.snapshots[0].id,repaired.snapshots[0].id);
 await write(restarted);assert.deepEqual(await read(repaired.snapshots[0].id),current);
 const bad=structuredClone(repaired);bad.snapshots[0].observation.rangeCourse={unexpected:'not legitimate input revision'};
 await assert.rejects(()=>write(bad),error=>error.code==='P0001'&&error.message==='Live snapshot identity conflict');
 assert.deepEqual(await read(repaired.snapshots[0].id),current);
 return {oldUnknownOriginalUnchanged:true,repairedObservationIsNewImmutableEvidence:true,decisionSnapshotUnchanged:true,retryPreservesCaptureTime:true,jsonbRestartKeepsInputIdentity:true,unexplainedSameInputDriftRejected:true,productionWrites:0};
}
