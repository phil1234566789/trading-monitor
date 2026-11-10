import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const [archiveArg,runtimeArg]=process.argv.slice(2);
if(!archiveArg||!runtimeArg)throw new Error('Usage: node test/patternLocalSweepAgeFrozen.integration.mjs <6dd4-archive> <new-runtime>');
const archive=path.resolve(archiveArg),directory=path.resolve(runtimeArg),root=fileURLToPath(new URL('..',import.meta.url));
const {loadFrozen}=await import(pathToFileURL(path.resolve(archive,'../../experiments/xau-both-aug-nov/inputs.mjs')));
const {core:old,input,data,values}=await loadFrozen(archive);
const core=await import(pathToFileURL(path.join(directory,'core.mjs')));
const results=[];
for(const record of values['baseline-entries.json']){
 const s=record.snapshot,e=s.entry,context=old.activeM1Context(s.checklist);assert(context,e.id);
 Object.assign(context,{entryPatterns:[e.entryPattern],settings:input.settings,sessionConfigs:input.sessionConfigs,
  m5Candles:data['5m'].filter(c=>c.time>=context.structureStart-9*300&&c.time+300<=e.recognizedAt)});
 const rows=data['1m'].filter(c=>c.time+60<=e.recognizedAt),structure=old.buildM1Structure(rows,context.anchor,e.recognizedAt);
 const args={context,structure,candles:rows,evaluatedAt:e.recognizedAt};
 const before=old.evaluateM1Checklist(args),after=core.evaluateM1Checklist(args);
 assert(before.entry,'Archived native P1 reference missing '+e.id);assert(after.entry,'New H lost P1 '+e.id);
 const clean=entry=>{const copy=structuredClone(entry);delete copy.conditions.sweepAge;return copy;};
 assert.deepEqual(clean(after.entry),clean(before.entry));
 assert.equal(after.entry.recognizedAt,e.recognizedAt);assert.equal(after.entry.price,e.price);assert.deepEqual(after.entry.stops,e.stops);
 for(const outcome of record.outcomes){
  const targets=e.scales[outcome.variant].targets;
  const actual=core.evaluateSimulation({entry:e,variant:outcome.variant,candles:data['1m'],evaluatedAt:outcome.evaluatedAt,
   target1:targets[0].price,target2:targets[1].price,executionContract:input.executionContract});
  assert.deepEqual(actual,outcome,'Outcome changed '+e.id+' '+outcome.variant);
 }
 results.push({id:e.id,ageSeconds:after.entry.conditions.sweepAge.ageSeconds,entryExactExceptNewProof:true,outcomesExact:true});
 console.log(JSON.stringify({instrument:'XAUUSD',phase:'P1-existing-entry-parity',completed:results.length,total:18}));
}
assert.equal(results.length,18);
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const fixture=await read(path.join(root,'test/fixtures/xauusd-dr121-exploratory-short.json'));
const reference=await read(path.resolve(archive,'../../../entry-pattern2-fvg-retest/.debug/dr121-causal-alias-validation.json'));
const source=reference.source,at=Date.parse('2026-10-29T12:25:00+01:00')/1000;
const anchor=input.dailyAnchors.filter(a=>a.knownAt<=source.recognizedAt).at(-1);
const merge=(older,original)=>[...older.filter(c=>c.time<original[0].time),...original];
const m5=merge(data['5m'],fixture.candles.m5).filter(c=>c.time>=anchor.structureStartTime-9*300);
const common={...input,m5Candles:m5,h1Candles:merge(data['1h'],fixture.candles.h1),tradeSetups:[source],
 includeSweepRetestSources:true,sourcesAssembled:true,evaluatedAt:at,newsLoadStatus:'ready'};
const previous=old.evaluateCountertrendChecklist(structuredClone(common));
const current=core.evaluateCountertrendChecklist(structuredClone(common));
assert.equal(previous.dealingRange.status,'disqualified');
assert.equal(previous.checks.antiConfluences.rules.find(r=>r.id==='countertrendSweepLevelAge').status,'found');
assert.equal(current.checks.outerM5Trend.status,'passed');assert.equal(current.checks.m5Trend.status,'passed');
assert.equal(current.dealingRange.status,'validated');
assert(!current.checks.antiConfluences.rules.some(r=>r.id==='countertrendSweepLevelAge'));
const context=core.activeM1Context(current);assert(context);
const structure=core.buildM1Structure(fixture.candles.m1,context.anchor,at);
const check=core.evaluateM1Checklist({context,structure,candles:fixture.candles.m1,evaluatedAt:at});
assert.equal(check.entry?.price,4034.12);assert.equal(check.entry.recognizedAt,at);
assert.equal(check.conditions.orderBlockDepth.status,'passed');
const entry=core.createSetup2Entry({...common,evaluatedAt:at},()=>check.entry);assert(entry);
const snapshot=core.buildTradeSetup2Snapshot({checklist:current,m1Check:{...check,entry},m1Structure:structure,m1Candles:fixture.candles.m1});
assert.equal(snapshot.entry.price,4034.12);
const dirty=structuredClone(current);dirty.setup.primary.checks.antiConfluences.rules.push({id:'genuine-dr-anti-confluence',label:'Explicit test DR blocker',
 disqualifies:true,status:'found',evidence:[{recognizedAt:source.recognizedAt}]});
const stillDirty=core.evaluateDealingRange(dirty,dirty.setup.primary);assert.equal(stillDirty.status,'disqualified');
const proof={method:'18 isolated native XAU P1 evaluator comparisons plus original36 outcomes; single DR121 native full common-gates path; no multi-month scan.',
 XAUUSD:{baselineRunId:'setup2-ececb114d190fcccead91cf4',entries:18,outcomes:36,results},
 DR121:{oldF:'disqualified',newF:'validated',C:'passed',D:'passed',sweepAgeSeconds:current.setup.primary.sweep.ageSeconds,
  entryAt:at,entryPrice:snapshot.entry.price,orderBlockMaxFraction:check.conditions.orderBlockDepth.maxPenetrationFraction,trueFBlockerStillBlocks:true}};
await writeFile(path.join(directory,'native-reference-proof.json'),JSON.stringify(proof,null,2));
console.log(JSON.stringify({...proof,XAUUSD:{...proof.XAUUSD,results:undefined}}));
