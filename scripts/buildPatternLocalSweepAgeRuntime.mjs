import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parse} from 'acorn';
import {rolldown} from 'rolldown';

// Neue Runtime-Dateien statt Änderungen an veröffentlichten Frozen-Läufen.
const [archiveArg,outArg]=process.argv.slice(2);
if(!archiveArg||!outArg)throw new Error('Usage: node scripts/buildPatternLocalSweepAgeRuntime.mjs <frozen-6dd4-directory> <NEW-output-directory>');
const archive=path.resolve(archiveArg),out=path.resolve(outArg),root=fileURLToPath(new URL('..',import.meta.url));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read=async name=>JSON.parse(await readFile(path.join(archive,name),'utf8'));
const freeze=await read('freeze.json'),run=await read('run.json');
assert.equal(run.id,'setup2-6dd4a875d67d73c94d77ba3d');
let code=await readFile(path.join(archive,'core.mjs'),'utf8');
const baseline=await readFile(path.join(archive,'baseline.mjs'),'utf8');
assert.equal(digest(code),freeze.runtimeHashes['core.mjs']);
assert.equal(digest(baseline),freeze.runtimeHashes['baseline.mjs']);
await mkdir(out,{recursive:false});
await copyFile(path.join(archive,'baseline.mjs'),path.join(out,'baseline.mjs'));
const exports={entryPattern1SweepAge:'*',entryPattern1Conditions:'*',entryPattern2:'*',sweepRetestSources:'*',entryPattern2OrderBlock:'*'};
await writeFile(path.join(out,'modern-entry.mjs'),Object.keys(exports).map(name=>`export * from ${JSON.stringify(path.join(root,'src',name+'.js').replaceAll('\\','/'))};`).join('\n'));
const build=await rolldown({input:path.join(out,'modern-entry.mjs'),platform:'node'});
await build.write({file:path.join(out,'modern.mjs'),format:'esm'});await build.close();
const replacements={
 evaluateCountertrendEntryPattern1:`function evaluateCountertrendEntryPattern1(input){
 const check=bothBaseline.evaluateCountertrendEntryPattern1(input);
 const sweepAge=localRules.entryPattern1SweepAgeRule(input.context.instrument,input.context.primary,input.evaluatedAt);
 const conditions={...check.conditions,sweepAge};
 const entry=check.entry&&localRules.entryPattern1SweepAgePassed(conditions,check.entry.recognizedAt)?{...check.entry,conditions}:null;
 return {...check,conditions,entry,status:entry?check.status:'pending',
  entryBlockedReason:entry?null:sweepAge.status==='blocked'?'Nur Pattern 1 gesperrt: Sweep-Level jünger als 4 Stunden.':sweepAge.status==='unknown'?'Nur Pattern 1 ungeklärt: Sweep-Level-Alter nicht kausal belegt.':check.entryBlockedReason};
}`,
 evaluateEntryPattern2:'function evaluateEntryPattern2(input){return localRules.evaluateEntryPattern2(input);}',
 detectSweepRetestSources:'function detectSweepRetestSources(input){return localRules.detectSweepRetestSources(input);}',
 entryPattern1ConditionResults:'function entryPattern1ConditionResults(...args){return localRules.entryPattern1ConditionResults(...args);}',
 entryPattern1ConditionsReady:'function entryPattern1ConditionsReady(...args){return localRules.entryPattern1ConditionsReady(...args);}',
 entryPattern1StructureCategory:'function entryPattern1StructureCategory(...args){return localRules.entryPattern1StructureCategory(...args);}',
 evaluateChecklistConfluences:`function evaluateChecklistConfluences(input){
 const result=bothBaseline.evaluateChecklistConfluences(input);
 return removePatternAgeFromF(result,input.evaluatedAt);
}`,
 evaluateCountertrendChecklist:`function evaluateCountertrendChecklist(input={}){
 const sources=input.tradeSetups??[];if(sources.length>1)throw new Error('Combined adapter requires single-source classification');
 const relative=isSweepRetestSource(sources[0]);
 const result=relative?bothMain_evaluateCountertrendChecklist(input):bothBaseline.evaluateCountertrendChecklist(input);
 for(const candidate of result.setup?.candidates??[]){
  Object.assign(candidate.checks,removePatternAgeFromF(candidate.checks,candidate.recognizedAt));
  candidate.sourceId=relative?sources[0].sourceKey:candidate.tradeSetupId;
  if(input.includeSweepRetestSources)Object.assign(candidate,{instrument:input.instrument,sourceFamilyKey:naturalSourceFamilyKey(sources[0]),exitPolicy:SOURCE_IDEA_EXIT_POLICY});
  candidate.entryPattern=relative?M1_FVG_RETEST_PATTERN_VERSION:ENTRY_PATTERN_1_VERSION;
  candidate.entryPatterns=input.includeSweepRetestSources?(relative?[M1_FVG_RETEST_PATTERN_VERSION]:[ENTRY_PATTERN_1_VERSION,M1_FVG_RETEST_PATTERN_VERSION]):[ENTRY_PATTERN_1_VERSION];
  if(bothBaseline.evaluateDealingRange(result,candidate).status==='validated')candidate.validatedAt=Math.max(candidate.recognizedAt,candidate.targetSelection.selectedAt);
  else delete candidate.validatedAt;
 }
 const primary=result.setup?.primary;
 if(primary){result.entryPattern=primary.entryPattern;result.entryPatterns=primary.entryPatterns;Object.assign(result.checks,primary.checks);}
 result.dealingRange=bothBaseline.evaluateDealingRange(result);
 result.confirmed=['confirmed','validated','disqualified'].includes(result.dealingRange.status);return result;
}`,
 buildTradeSetup2Configuration:`function buildTradeSetup2Configuration(input){
 const original=bothBaseline.buildTradeSetup2Configuration(input);
 return {...original,setupVersion:SETUP2_VERSION,
  antiConfluenceRules:(original.antiConfluenceRules??[]).filter(rule=>rule.id!=='countertrendSweepLevelAge'),
  entryPattern1SweepAgeRule:localRules.ENTRY_PATTERN_1_SWEEP_AGE_POLICY,entryPattern2OrderBlockRule:localRules.ENTRY_PATTERN_2_OB_RULE,
  entryPatterns:[ENTRY_PATTERN_1_VERSION,M1_FVG_RETEST_PATTERN_VERSION],includeSweepRetestSources:true,
  m1Periods:{[ENTRY_PATTERN_1_VERSION]:5,[M1_FVG_RETEST_PATTERN_VERSION]:2},relativeM5SweepRangeVersion:RELATIVE_M5_SWEEP_RANGE_VERSION,
  sourceFamilyVersion:SOURCE_FAMILY_VERSION,sourceIdeaBindingVersion:SOURCE_IDEA_BINDING_VERSION,exitPolicy:SOURCE_IDEA_EXIT_POLICY,
  commonGatePolicy:'archived-v30-common-gates-except-sweep-age-moved-to-H-P1',legacySourcePolicy:'Frozen originals unchanged; P2 OB rules versioned explicitly'};
}`
};
const nodes=parse(code,{ecmaVersion:'latest',sourceType:'module'}).body.filter(node=>node.type==='FunctionDeclaration');
const edits=Object.entries(replacements).map(([name,text])=>{const matches=nodes.filter(node=>node.id.name===name);assert.equal(matches.length,1,name);return {...matches[0],name,text};});
const changes=edits.map(node=>({name:node.name,beforeHash:digest(code.slice(node.start,node.end)),afterHash:digest(node.text)}));
for(const node of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,node.start)+node.text+code.slice(node.end);
const oldVersion='const SETUP2_VERSION = "xau-v30-both-frozen-recognition-v1";';
assert.equal(code.split(oldVersion).length,2);
code=code.replace(oldVersion,'const SETUP2_VERSION = "xau-v30-both-pattern-local-sweep-age-v3";');
code='import * as localRules from "./modern.mjs";\n'+code+`\nfunction removePatternAgeFromF(checks,at){
 const anti=checks.antiConfluences;if(!Array.isArray(anti?.rules))return checks;
 const rules=anti.rules.filter(rule=>rule.id!=='countertrendSweepLevelAge');
 return {...checks,antiConfluences:{...anti,rules,status:bothBaseline.summarizeAntiConfluenceRules(rules,at,anti.ruleVersion)}};
}\nexport {removePatternAgeFromF,evaluateDealingRange};\n`;
await writeFile(path.join(out,'core.mjs'),code);
const proof={version:'pattern-local-sweep-age-runtime-v1',basedOnRunId:run.id,
 archivedRuntimeHashes:freeze.runtimeHashes,coreHash:digest(code),modernHash:digest(await readFile(path.join(out,'modern.mjs'),'utf8')),
 changes,scope:'Only the exact age rule leaves global F; original v30 P1 detection, C/D/E, other F rules, execution contract, outcomes and lifecycle remain archived. P2 uses released 50% OB rules.',
 usage:'New run identity and manifest required; never resume or overwrite the historical run.'};
await writeFile(path.join(out,'provenance.json'),JSON.stringify(proof,null,2));
assert.equal(digest(await readFile(path.join(archive,'core.mjs'),'utf8')),freeze.runtimeHashes['core.mjs']);
assert.equal(digest(await readFile(path.join(archive,'baseline.mjs'),'utf8')),freeze.runtimeHashes['baseline.mjs']);
console.log(JSON.stringify({directory:out,coreHash:proof.coreHash,changedFunctions:changes.length,originalsUnchanged:true}));
