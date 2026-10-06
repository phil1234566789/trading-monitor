const VERSION='deduplicated-structures-v1';
const structureKey=key=>key==='structure'||key==='structureState';
const reference=value=>value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===1&&Object.hasOwn(value,'snapshotStructureRef');

function transform(value,replace,key='') {
  const changed=replace(value,key);
  if(changed!==value)return changed;
  if(Array.isArray(value))return value.map(item=>transform(item,replace));
  return value&&typeof value==='object'
    ? Object.fromEntries(Object.entries(value).map(([name,item])=>[name,transform(item,replace,name)])) : value;
}

// Die gleichen großen Strukturbelege stehen in C, D, primary und checklist.
// Nur die Speicherung teilt sie; Levels, Prüfungen und Lifecycle bleiben direkt prüfbar.
function encodeLegacyStructures(snapshot) {
  if(!snapshot||snapshot.structureStorage)return snapshot;
  const repeated=new Map();
  transform(snapshot,(value,key)=>{
    if(structureKey(key)&&value&&typeof value==='object'){
      const json=JSON.stringify(value);
      if(json.length>=4096)repeated.set(json,(repeated.get(json)??0)+1);
    }
    return value;
  });
  const pool=[...repeated].filter(([,count])=>count>1).map(([json])=>json);
  if(!pool.length)return snapshot;
  const indices=new Map(pool.map((json,index)=>[json,index]));
  const encoded=transform(snapshot,(value,key)=>{
    const index=structureKey(key)&&value&&typeof value==='object'?indices.get(JSON.stringify(value)):undefined;
    return index===undefined?value:{snapshotStructureRef:index};
  });
  return {...encoded,structureStorage:{version:VERSION,structures:pool.map(JSON.parse)}};
}

export function decodeSnapshotStructures(snapshot) {
  if(!snapshot?.structureStorage)return snapshot;
  const {version,structures}=snapshot.structureStorage;
  if(version===VALUE_VERSION)return decodeValues(snapshot);
  if(version!==VERSION||!Array.isArray(structures))throw new Error('Unsupported snapshot structure storage version');
  const {structureStorage,...stored}=snapshot;
  return transform(stored,(value,key)=>{
    if(!structureKey(key)||!reference(value))return value;
    const index=value.snapshotStructureRef;
    if(!Number.isInteger(index)||index<0||index>=structures.length||!structures[index]||typeof structures[index]!=='object')
      throw new Error('Invalid snapshot structure reference');
    return structuredClone(structures[index]);
  });
}

const VALUE_VERSION='deduplicated-values-v2';

// Lange M1-Checklisten überschreiten trotz geteilter Strukturen den JSONB-Vertrag.
// SQL-/Review-Felder bleiben direkt lesbar; nur Belegblöcke teilen rekursive Werte.
function encodeValues(snapshot) {
  const counts=new Map();
  const json=value=>JSON.stringify(value);
  const eligible=(key,inside)=>inside||key==='checklistHistory'||structureKey(key);
  function collect(value,key='',inside=false) {
    if(reference(value))throw new Error('Reserved snapshot structure reference');
    inside=eligible(key,inside);
    const text=json(value);
    if(inside&&text?.length>=128)counts.set(text,(counts.get(text)??0)+1);
    if(value&&typeof value==='object')for(const [name,item]of Object.entries(value))collect(item,name,inside);
  }
  collect(snapshot);
  const pool=[...counts].filter(([,count])=>count>1).map(([text])=>text);
  const indices=new Map(pool.map((text,index)=>[text,index]));
  function pack(value,key='',inside=false,skip=false) {
    inside=eligible(key,inside);
    const index=inside?indices.get(json(value)):undefined;
    if(index!==undefined&&!skip)return {snapshotStructureRef:index};
    if(Array.isArray(value))return value.map(item=>pack(item,'',inside));
    return value&&typeof value==='object'
      ? Object.fromEntries(Object.entries(value).map(([name,item])=>[name,pack(item,name,inside)])) : value;
  }
  return {...pack(snapshot),structureStorage:{version:VALUE_VERSION,structures:pool.map(text=>pack(JSON.parse(text),'',true,true))}};
}

export function encodeSnapshotStructures(snapshot) {
  const legacy=encodeLegacyStructures(snapshot);
  if(!snapshot||snapshot.structureStorage||JSON.stringify(legacy).length<500000)return legacy;
  const compact=encodeValues(snapshot);
  return JSON.stringify(compact).length<JSON.stringify(legacy).length?compact:legacy;
}

function decodeValues(snapshot) {
  const {structureStorage,...stored}=snapshot;
  const pool=structureStorage.structures;
  if(!Array.isArray(pool))throw new Error('Invalid snapshot structure reference pool');
  const active=new Set(),resolved=new Map();
  function unpack(value) {
    if(reference(value)) {
      const index=value.snapshotStructureRef;
      if(!Number.isInteger(index)||index<0||index>=pool.length||active.has(index))throw new Error('Invalid snapshot structure reference');
      if(!resolved.has(index)) {
        active.add(index);resolved.set(index,unpack(pool[index]));active.delete(index);
      }
      return structuredClone(resolved.get(index));
    }
    if(Array.isArray(value))return value.map(unpack);
    return value&&typeof value==='object'
      ? Object.fromEntries(Object.entries(value).map(([key,item])=>[key,unpack(item)])) : value;
  }
  return unpack(stored);
}
