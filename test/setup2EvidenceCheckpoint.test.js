import {it,expect} from 'vitest';
import {checkpointEvidence,EVIDENCE_REQUEST_BYTES} from '../services/setup2/evidenceCheckpoint.js';
const config={id:'a'.repeat(64),configuration:{instrument:'GBPUSD'}};
const params={p_instrument:'GBPUSD',p_owner:'owner',p_state:{evaluatedThrough:'2026-10-15T08:00:00Z'},p_events:[]};
it('bounds every evidence request and commits only verified snapshot identities after all staging succeeds',async()=>{
 const payloads=Array.from({length:9},(_,i)=>({id:String(i).padStart(64,'0'),payload:{text:'x'.repeat(70000)}}));
 const snapshots=Array.from({length:9},(_,i)=>({id:String(i+20).padStart(64,'0'),snapshot:{padding:'y'.repeat(70000)}}));
 const calls=[];await checkpointEvidence(async(path,body)=>{calls.push({path,body});},params,[{configuration:config,payloads,snapshots}]);
 expect(calls.length).toBeGreaterThan(3);
 expect(calls.every(c=>Buffer.byteLength(JSON.stringify(c.body))<=EVIDENCE_REQUEST_BYTES)).toBe(true);
 expect(calls.slice(0,-1).every(c=>c.path==='rpc/setup2_store_live_evidence')).toBe(true);
 expect(calls.slice(0,-1).flatMap(c=>c.body.p_evidence.snapshots).map(s=>s.id)).toEqual(snapshots.map(s=>s.id));
 expect(calls.at(-1)).toEqual({path:'rpc/setup2_checkpoint_with_evidence',body:{...params,p_evidence:[{configuration_id:config.id,snapshot_ids:snapshots.map(s=>s.id)}]}});
 const failed=[];await expect(checkpointEvidence(async(path)=>{failed.push(path);throw new Error('stage unavailable');},params,[{configuration:config,payloads,snapshots}])).rejects.toThrow('stage unavailable');
 expect(failed).toEqual(['rpc/setup2_store_live_evidence']);
});
it('stages shared dependencies before their parents, keeps the ordinary empty checkpoint and rejects oversized records',async()=>{
 const parent={id:'b'.repeat(64),payload:{$liveEvidenceRef:'c'.repeat(64)}},child={id:'c'.repeat(64),payload:[1,2,3]};
 const calls=[];await checkpointEvidence(async(path,body)=>calls.push({path,body}),params,[{configuration:config,payloads:[parent,child],snapshots:[{id:'d'.repeat(64)}]}]);
 expect(calls[0].body.p_evidence.payloads).toEqual([child,parent]);
 const empty=[];await checkpointEvidence(async(path,body)=>empty.push({path,body}),params,[]);expect(empty).toEqual([{path:'rpc/setup2_checkpoint',body:params}]);
 await expect(checkpointEvidence(async()=>{},params,[{configuration:config,payloads:[{...child,payload:'x'.repeat(EVIDENCE_REQUEST_BYTES)}],snapshots:[{id:'d'.repeat(64)}]}])).rejects.toThrow('exceeds');
});
