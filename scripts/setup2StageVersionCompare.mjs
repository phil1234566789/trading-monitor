import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const [baseline97,replay97,baseline105,replay105,output]=process.argv.slice(2);
if(!output)throw new Error('Usage: baseline97 replay97 baseline105 replay105 output.json');
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function differences(a,b,p='',result=[]){
  if(JSON.stringify(a)===JSON.stringify(b))return result;
  if(a&&b&&typeof a==='object'&&typeof b==='object'){
    for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],`${p}.${k}`,result);
  }else result.push({path:p,old:a,new:b});
  return result;
}
function allowed(d){
  if(/\.checklist\.ruleVersion$|\.dealingRange\.version$/.test(d.path))
    return d.old==='countertrend-abcdef-v1'&&d.new==='countertrend-abcdef-v2';
  if(/\.checks\.(antiConfluences|confluences)\.ruleVersion$/.test(d.path))
    return d.old==='checklist-observation-rules-v2'&&d.new==='checklist-observation-rules-v3';
  if(/\.(checks\.(antiConfluences|confluences)\.rules\.\d+|evidence\.\d+)\.invalidates$/.test(d.path))
    return d.old===false&&d.new===undefined;
  if(/\.(checks\.(antiConfluences|confluences)\.rules\.\d+|evidence\.\d+)\.disqualifies$/.test(d.path))
    return d.old===undefined&&d.new===false;
  return false;
}
const cases=[];
for(const [dr,setupId,baseline,replay,times] of [
  [97,3125,baseline97,replay97,[1789544040,1789547100]],
  [105,5491,baseline105,replay105,[1790238960,1790240700]],
]){
  const old=await read(path.join(baseline,'results.json')),next=await read(path.join(replay,'results.json'));
  const manifest=await read(path.join(replay,'replay.json'));
  assert.equal(manifest.setupVersion,'countertrend-entry-model-1-v13');
  assert.deepEqual(manifest.setupIds,[setupId]);
  assert.equal(old.snapshots.length,next.snapshots.length);
  assert.deepEqual(next.records.map(r=>r.snapshot.knownAt),times);
  assert.equal(old.records.length,next.records.length);
  for(let i=0;i<old.records.length;i++){
    assert.deepEqual(next.records[i].snapshot.entry,old.records[i].snapshot.entry);
    assert.deepEqual(next.records[i].outcomes,old.records[i].outcomes);
  }
  const changes=differences(old,next);
  assert.deepEqual(changes.filter(d=>!allowed(d)),[],'Unexpected non-version/stage-field difference');
  // Jedes entfernte Regel-Flag muss ein unverändert ausgeschaltetes Gegenstück haben.
  for(const d of changes.filter(d=>d.path.endsWith('.invalidates')))
    assert(changes.some(n=>n.path===d.path.replace(/invalidates$/,'disqualifies')&&n.new===d.old));
  const financial=r=>r.records.map(x=>({entry:x.snapshot.entry,outcomes:x.outcomes}));
  const financialHash=hash(financial(old));assert.equal(hash(financial(next)),financialHash);
  cases.push({dr,setupId,setupVersion:manifest.setupVersion,snapshots:next.snapshots.length,differences:changes.length,
    financialHash,inputHash:manifest.inputHash,resultHash:hash(next),
    wallMs:(await read(path.join(replay,'measurements.json')))[0].wallMs,
    entries:next.records.map(r=>({time:new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(new Date(r.snapshot.knownAt*1000)),
      entry:r.snapshot.entry.price,variants:r.outcomes.map(o=>({variant:o.variant,stop:o.stopPrice,lots:o.lots,outcome:o.outcome,grossUsd:o.pnlUsd,netUsd:o.netPnlUsd}))})),changes});
}
await writeFile(output,JSON.stringify({equalEntriesAndOutcomes:true,onlyApprovedVersionAndStageFields:true,cases},null,2));
console.log(JSON.stringify(cases.map(({changes,...c})=>c),null,2));
