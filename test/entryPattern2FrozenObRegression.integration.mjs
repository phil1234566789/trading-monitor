import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {rolldown} from 'rolldown';

// Explizites Frozen-Archiv statt verstecktem Download oder erneutem Mehrmonats-Scan.
const directory=process.argv[2];
if(!directory)throw new Error('Usage: node test/entryPattern2FrozenObRegression.integration.mjs <frozen-run-directory>');
const root=fileURLToPath(new URL('..',import.meta.url)),out=path.join(root,'.debug/entry-pattern2-ob-regression');
await mkdir(out,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async name=>JSON.parse(await readFile(path.join(directory,name),'utf8'));
const freeze=await read('freeze.json'),run=await read('run.json');
assert.equal(run.id,'setup2-6dd4a875d67d73c94d77ba3d');
const m1bytes=await readFile(path.join(directory,'1m.json'));
assert.equal(hash(m1bytes),freeze.inputHashes['1m.json']);
const entryBytes=await readFile(path.join(directory,'XAUUSD-entries.json')),entryHash=hash(entryBytes);
const records=JSON.parse(entryBytes),m1=JSON.parse(m1bytes);
const entryModule=path.join(out,'exports.mjs');
await writeFile(entryModule,`export * from ${JSON.stringify(path.join(root,'src/entryPattern2.js').replaceAll('\\','/'))};\nexport * from ${JSON.stringify(path.join(root,'src/entryPattern2OrderBlock.js').replaceAll('\\','/'))};`);
const bundle=await rolldown({input:entryModule,platform:'node'});
await bundle.write({file:path.join(out,'core.mjs'),format:'esm'});await bundle.close();
const core=await import(pathToFileURL(path.join(out,'core.mjs')));
const results=[];
for(const {snapshot:s} of records){
 const e=s.entry;if(e.entryPattern!=='m1-structure-fvg-retest-v1')continue;
 const primary=s.checklist.setup.primary,rows=m1.filter(c=>c.time+60<=e.recognizedAt);
 const context={instrument:s.instrument,direction:s.direction,setupKey:s.setupKey,primary,
  entryPattern:e.entryPattern,confirmedAt:primary.recognizedAt,validatedAt:primary.validatedAt};
 const check=core.evaluateEntryPattern2({context,rows,evaluatedAt:e.recognizedAt,
  pivotBreak:e.conditions.m1PivotBreak,structureStart:s.m1Check.structureStart});
 const placement=core.entryPattern2OrderBlockPlacement({orderBlock:e.conditions.retest.orderBlock,level:primary.sweep.level,
  direction:s.direction,sourceKnownAt:primary.recognizedAt,evaluatedAt:e.conditions.retest.candleTime});
 const depth=core.evaluateEntryPattern2OrderBlockDepth({orderBlock:e.conditions.retest.orderBlock,direction:s.direction,
  retest:e.conditions.retest,candles:rows,entryAt:e.recognizedAt,evaluatedAt:e.recognizedAt});
 const passes=placement.status==='passed'&&depth.status==='passed';
 assert.equal(Boolean(check.entry),passes,e.id);
 if(passes){assert.equal(check.entry.recognizedAt,e.recognizedAt);assert.equal(check.entry.price,e.price);assert.deepEqual(check.entry.stops,e.stops);}
 results.push({id:e.id,sourceKey:s.setupKey,entryAt:e.recognizedAt,placement:placement.status,depth:depth.status,retained:passes,
  measuredFraction:depth.maxPenetrationFraction});
}
assert.equal(new Set(results.map(r=>r.id)).size,101);assert.equal(results.length,101);
assert.equal(results.filter(r=>r.retained).length,28);
const cluster=results.filter(r=>r.entryAt===1792651080);
assert.equal(cluster.length,7);assert.equal(cluster.filter(r=>r.retained).length,1);
assert.equal(hash(await readFile(path.join(directory,'XAUUSD-entries.json'))),entryHash);
const proof={runId:run.id,rule:core.ENTRY_PATTERN_2_OB_RULE,method:'Existing frozen Pattern-2 entries re-evaluated at their original confirmation close; static eligibility, not a portfolio simulation.',
 inputSha256:hash(m1bytes),entrySha256:entryHash,tested:101,retained:28,removed:73,clusterBefore:7,clusterAfter:1,
 runtimeEntryParity:28,unknownRules:results.filter(r=>[r.placement,r.depth].includes('unknown')).length,
 pattern1EntriesUntouched:records.length-results.length,results};
await writeFile(path.join(out,'proof.json'),JSON.stringify(proof,null,2));
console.log(JSON.stringify({...proof,results:undefined}));
