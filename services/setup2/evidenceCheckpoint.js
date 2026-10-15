import {evidenceReferences} from './evidencePayload.js';
export const EVIDENCE_REQUEST_BYTES=512*1024;
const bytes=value=>Buffer.byteLength(JSON.stringify(value));

// Kleine, idempotente Belege zuerst; der Watermark darf erst nach vollständiger Speicherung weiterlaufen.
export async function checkpointEvidence(request,parameters,batches=[]) {
 if(!batches.length)return request('rpc/setup2_checkpoint',parameters);
 const manifest=[];
 for(const batch of batches){
  const {configuration}=batch,parts=new Map(),visited=new Set(),visiting=new Set(),ordered=[];
  for(const part of batch.payloads ?? []){
   if(parts.has(part.id) && JSON.stringify(parts.get(part.id).payload)!==JSON.stringify(part.payload))throw new Error('Live payload identity conflict');
   parts.set(part.id,part);
  }
  const visit=id=>{
   if(visited.has(id) || !parts.has(id))return;
   if(visiting.has(id))throw new Error('Cyclic live evidence payload');
   visiting.add(id);for(const ref of evidenceReferences(parts.get(id).payload))visit(ref);
   visiting.delete(id);visited.add(id);ordered.push(parts.get(id));
  };
  for(const id of parts.keys())visit(id);
  const stage=async(field,items)=>{
   const body={p_instrument:parameters.p_instrument,p_owner:parameters.p_owner,p_evidence:{configuration,payloads:[],snapshots:[]}};
   const base=bytes(body);let size=base,chunk=[];
   const send=async()=>{await request('rpc/setup2_store_live_evidence',{...body,p_evidence:{...body.p_evidence,[field]:chunk}});chunk=[];size=base;};
   for(const item of items){
    const added=bytes(item)+(chunk.length?1:0);
    if(base+bytes(item)>EVIDENCE_REQUEST_BYTES)throw new Error('Live evidence record exceeds request limit');
    if(size+added>EVIDENCE_REQUEST_BYTES)await send();
    chunk.push(item);size+=bytes(item)+(chunk.length>1?1:0);
   }
   if(chunk.length)await send();
  };
  await stage('payloads',ordered);await stage('snapshots',batch.snapshots);
  manifest.push({configuration_id:configuration.id,snapshot_ids:batch.snapshots.map(s=>s.id)});
 }
 const body={...parameters,p_evidence:manifest};
 if(bytes(body)>EVIDENCE_REQUEST_BYTES)throw new Error('Live evidence checkpoint exceeds request limit');
 return request('rpc/setup2_checkpoint_with_evidence',body);
}
