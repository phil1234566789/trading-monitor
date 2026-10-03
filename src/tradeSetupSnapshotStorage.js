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
export function encodeSnapshotStructures(snapshot) {
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
