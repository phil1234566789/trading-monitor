import {it,expect,vi} from 'vitest';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {writeJson} from '../scripts/batchJsonFiles.mjs';
import {readPublicationCatalog,savePublicationRecords,verifyPublicationRecords} from '../scripts/simulationPublicationResume.mjs';
const snapshot=id=>({id,instrument:'XAUUSD',knownAt:300,checks:{status:'unknown'},rangeCourse:{evaluatedAt:600}});
const entry=id=>({snapshot:snapshot(id),outcomes:[{variant:'wide',status:'unknown'},{variant:'narrow',status:'closed',pnlUsd:12}]});
async function fixture(records,kind='setups'){
 const directory=await mkdtemp(path.join(tmpdir(),'publication-resume-'));
 const file=path.join(directory,'XAUUSD-'+kind+'.json');await writeJson(file,records);return {directory,file};
}
function database(records,kind='setups',{cap=1000,fail=false}={}){
 const rows=structuredClone(records.map(r=>({id:(r.snapshot??r).id,snapshot:r.snapshot??r,...kind==='entries'?{outcomes:r.outcomes}:{}})));
 const calls=[];
 return {rows,calls,from(table){let ids,fields;const query={select:f=>{fields=f;return query;},eq:(key,value)=>{expect([key,value]).toEqual(['run_id','run']);return query;},
  in:(key,value)=>{expect(key).toBe('id');ids=value;return query;},order:()=>query,
  range:async(from,to)=>{calls.push({table,fields,ids,from,to});if(fail)return {error:new Error('read failed')};
   const selected=rows.filter(r=>!ids||ids.includes(r.id)).toSorted((a,b)=>a.id.localeCompare(b.id)).slice(from,Math.min(to+1,from+cap));
   return {data:selected.map(r=>/^id,snapshot(?:,|$)/.test(fields)?structuredClone(r):{id:r.id,structureStorage:r.snapshot.structureStorage?.version})};}};return query;}};
}
it('skips only exact original snapshots and outcomes, forwarding changed or missing rows through the same writer',async()=>{
 const records=Array.from({length:12},(_,i)=>entry(String(i).padStart(2,'0'))),{file}=await fixture(records,'entries');
 const existing=structuredClone(records.slice(0,11));existing[1].outcomes[0].status='closed';existing[2].snapshot.rangeCourse.evaluatedAt=500;
 const db=database(existing,'entries'),save=vi.fn(async()=>{});
 const result=await savePublicationRecords({db,runId:'run',kind:'entries',file,existingIds:new Set(existing.map(r=>r.snapshot.id)),batchSize:2,save});
 expect(result).toEqual({records:12,skipped:9,written:3});
 expect(save.mock.calls.flatMap(([rows])=>rows)).toEqual([records[1],records[2],records[11]]);
 expect(db.calls).toHaveLength(3);expect(records[0].outcomes[0].status).toBe('unknown');
});
it('needs no remote payload requests for a new run and retains configured write batching',async()=>{
 const records=Array.from({length:6},(_,i)=>snapshot('s'+i)),{file}=await fixture(records),db=database([]),save=vi.fn(async()=>{});
 expect(await savePublicationRecords({db,runId:'run',kind:'setups',file,existingIds:new Set(),batchSize:4,save}))
  .toEqual({records:6,skipped:0,written:6});
 expect(db.calls).toHaveLength(0);expect(save.mock.calls.map(([rows])=>rows.length)).toEqual([4,2]);
});
it('paginates short server-capped pages by returned length, including catalog termination on an empty page',async()=>{
 const records=Array.from({length:7},(_,i)=>snapshot('s'+i)),{file}=await fixture(records),db=database(records,'setups',{cap:2}),save=vi.fn();
 const catalog=await readPublicationCatalog(db,'setups','run');expect(catalog.ids.size).toBe(7);expect(catalog.rawIds.size).toBe(7);
 expect(db.calls.map(c=>c.from)).toEqual([0,2,4,6,7]);db.calls.length=0;
 expect((await savePublicationRecords({db,runId:'run',kind:'setups',file,existingIds:catalog.ids,batchSize:1,save})).skipped).toBe(7);
 expect(save).not.toHaveBeenCalled();expect(db.calls.map(c=>c.from)).toEqual([0,2,4,0]);
});
it('does not treat a failed remote read as absence and never skips a changed outcome on resume',async()=>{
 const record=entry('one'),{file}=await fixture([record],'entries'),save=vi.fn();
 await expect(savePublicationRecords({db:database([record],'entries',{fail:true}),runId:'run',kind:'entries',file,existingIds:new Set(['one']),batchSize:1,save})).rejects.toThrow('read failed');
 expect(save).not.toHaveBeenCalled();
});
it('performs a fresh full snapshot, outcome and ID-set roundtrip, including rows skipped earlier',async()=>{
 const records=[entry('one'),entry('two')],{directory,file}=await fixture(records,'entries');await writeJson(path.join(directory,'XAUUSD-setups.json'),[]);
 const db=database(records,'entries'),originalFrom=db.from.bind(db);
 db.from=table=>table.endsWith('setups')?database([]).from(table):originalFrom(table);
 expect(await verifyPublicationRecords({db,runId:'run',directory,instruments:['XAUUSD']})).toEqual({setups:0,entries:2,outcomes:4});
 expect(db.calls.filter(c=>!c.ids).every(c=>c.fields==='id')).toBe(true);
 db.rows[0].outcomes[0].status='closed';
 await expect(verifyPublicationRecords({db,runId:'run',directory,instruments:['XAUUSD']})).rejects.toThrow('Outcome roundtrip');
 db.rows[0].outcomes=records[0].outcomes;db.rows.push({id:'unexpected',snapshot:snapshot('unexpected'),outcomes:[]});
 await expect(verifyPublicationRecords({db,runId:'run',directory,instruments:['XAUUSD']})).rejects.toThrow('ID set');
 await writeJson(file,[entry('missing')]);
 await expect(verifyPublicationRecords({db,runId:'run',directory,instruments:['XAUUSD']})).rejects.toThrow('Snapshot roundtrip');
});
it('fully verifies short capped pages and rejects truncated, duplicate or missing IDs and outcomes',async()=>{
 const records=[entry('one'),entry('two')],{directory,file}=await fixture(records,'entries');await writeJson(path.join(directory,'XAUUSD-setups.json'),[]);
 async function verify(change=()=>{},local=records){
  const db=database(records,'entries',{cap:1});change(db.rows);const originalFrom=db.from.bind(db);
  db.from=table=>table.endsWith('setups')?database([]).from(table):originalFrom(table);
  await writeJson(file,local);return verifyPublicationRecords({db,runId:'run',directory,instruments:['XAUUSD']});
 }
 expect(await verify()).toEqual({setups:0,entries:2,outcomes:4});
 await expect(verify(rows=>{rows.pop();})).rejects.toThrow('Snapshot roundtrip');
 await expect(verify(rows=>{delete rows[0].snapshot.checks;})).rejects.toThrow('Snapshot roundtrip');
 await expect(verify(rows=>{rows.push(structuredClone(rows[0]));})).rejects.toThrow('remote snapshot identity');
 await expect(verify(()=>{},[records[0],records[0]])).rejects.toThrow('Duplicate local');
 for(const change of [rows=>{delete rows[0].outcomes;},rows=>{rows[0].outcomes.pop();},
  rows=>{rows[0].outcomes[1]=structuredClone(rows[0].outcomes[0]);}])
  await expect(verify(change)).rejects.toThrow('Outcome roundtrip');
});
