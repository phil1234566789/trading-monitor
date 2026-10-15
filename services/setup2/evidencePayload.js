// Inhaltsadressierte Teile sparen identische Strukturpools, ohne Originalbelege zu kürzen.
export function packEvidence(value,payloads,hash,key='',parentKey='') {
 if(value==null || typeof value!=='object')return value;
 if(key==='stops' && parentKey==='entry')return JSON.parse(JSON.stringify(value));
 const packed=Array.isArray(value)?value.map(v=>packEvidence(v,payloads,hash)):
  Object.fromEntries(Object.entries(value).map(([k,v])=>[k,packEvidence(v,payloads,hash,k,key)]));
 const large=JSON.stringify(packed).length>128;
 if(Array.isArray(value) && value.length>128 && large){
  const ids=[];for(let i=0;i<packed.length;i+=128){const payload=packed.slice(i,i+128),id=hash(payload);payloads.set(id,{id,payload});ids.push(id);}
  return {$liveEvidenceChunks:ids};
 }
 if((Array.isArray(value) || !['','checklist','checks','setup','primary','entry','m1Check','dealingRange'].includes(key) && typeof value.status!=='string' || key==='checks' && parentKey==='primary') && large) {
  const id=hash(packed);payloads.set(id,{id,payload:packed});return {$liveEvidenceRef:id};
 }
 return packed;
}
export function evidenceReferences(value,result=new Set()) {
 if(!value || typeof value!=='object')return result;
 if(value.$liveEvidenceChunks)for(const id of value.$liveEvidenceChunks)result.add(id);
 else if(value.$liveEvidenceRef)result.add(value.$liveEvidenceRef);
 else for(const child of Object.values(value))evidenceReferences(child,result);
 return result;
}
export function hydrateEvidence(value,payloadMap,ancestors=new Set()) {
 if(value==null || typeof value!=='object')return value;
 if(value.$liveEvidenceChunks)return value.$liveEvidenceChunks.flatMap(id=>hydrateEvidence({$liveEvidenceRef:id},payloadMap,ancestors));
 if(value.$liveEvidenceRef) {
  const id=value.$liveEvidenceRef,payload=payloadMap instanceof Map?payloadMap.get(id):payloadMap[id];
  if(payload===undefined || ancestors.has(id))throw new Error('Missing or cyclic live evidence payload');
  return hydrateEvidence(payload,payloadMap,new Set([...ancestors,id]));
 }
 return Array.isArray(value)?value.map(v=>hydrateEvidence(v,payloadMap,ancestors)):
  Object.fromEntries(Object.entries(value).map(([k,v])=>[k,hydrateEvidence(v,payloadMap,ancestors)]));
}
