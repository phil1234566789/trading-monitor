import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const [baseline,replay]=process.argv.slice(2);
if(!baseline||!replay)throw new Error('Provide baseline and replay directories');
const read=async (dir,file)=>JSON.parse(await readFile(path.join(dir,file),'utf8'));
const before=await read(baseline,'results.json'),after=await read(replay,'results.json');
if(before.snapshots)assert.deepEqual(after,before);
else{
  // Im Monatslauf liegen sämtliche Snapshots in zwei Dateien, nicht im Summary.
  assert.deepEqual(after.records,await read(baseline,'GBPUSD-entries.json'));
  assert.deepEqual(after.snapshots.filter(s=>!s.entry),await read(baseline,'GBPUSD-setups.json'));
  assert.equal(after.records.length,before.entries);
  assert.equal(new Set(after.snapshots.map(s=>s.setupKey)).size,before.DRs);
}
const result={identical:true,entries:after.records.length,
  dealingRanges:new Set(after.snapshots.map(s=>s.setupKey)).size,
  snapshots:after.snapshots.length,hash:createHash('sha256').update(JSON.stringify(after)).digest('hex')};
await writeFile(path.join(replay,'equivalence.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
