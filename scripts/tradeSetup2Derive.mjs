import {assertT82ParentReference} from './t82DerivationReference.mjs';
import {readFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {rolldown} from 'rolldown';
import {readJsonArray,writeJson} from './batchJsonFiles.mjs';import {fileHash} from './batchRunInputs.mjs';import {scanBatchInstrument} from './batchInstrument.mjs';import {mergeDerivedSetups} from './derivedBatchRun.mjs';
import {createRunDerivation} from '../src/simulationRunDerivation.js';import {tradeSetupFromRow} from '../src/tradeSetupRow.js';import {simulationRunInputs} from '../src/simulationRunInputs.js';
const root=fileURLToPath(new URL('..',import.meta.url)),options=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
if(!options.parent||!options.output)throw new Error('Provide --parent and a separate --output');
const parentDirectory=path.resolve(options.parent),directory=path.resolve(options.output),relative=path.relative(parentDirectory,directory);
if(!relative||!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))throw new Error('Derived output must be outside the parent directory');
const read=async file=>JSON.parse(await readFile(file,'utf8')),hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const parent=await read(path.join(parentDirectory,'run.json')),manifest=await read(path.join(parentDirectory,'manifest.json'));
// Nur fuer diesen geprueften, rein verschaerfenden Gatewechsel ist Vererbung nachgewiesen.
if(parent.status!=='complete'||parent.version!=='countertrend-entry-model-1-v23'||parent.configuration.entryPattern!=='countertrend-entry-model-1-v10'||parent.provenance.sourceHash!=='8d2603fd87c7283aeb9251df4708dcd00d1f4c37d46f0399ea525ea52feb6de5'||JSON.stringify(manifest.instruments)!=='["GBPUSD"]'||manifest.requestedTo!==parent.to)throw new Error('Unsupported certified parent run');
if(hash(await readFile(path.join(parentDirectory,'core.mjs'),'utf8'))!==parent.provenance.sourceHash)throw new Error('Parent scanner hash differs');
await mkdir(directory,{recursive:true});let previous;try{previous=await read(path.join(directory,'run.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
const modules=new Set(),entry=path.join(directory,'core-entry.mjs');
await writeJson(path.join(directory,'execution-request.json'),{parentDirectory,targetRulesCommit:'d78913ee52015c49bb495138e9b7ad0783cfd2df'});
await import('node:fs/promises').then(fs=>fs.writeFile(entry,['tradeSetup2Scan.js','tradeSetupSimulation.js','tradeSetup2Anchors.js','tradeSetup2Configuration.js','tradeSetup2RangeCourse.js','setup1RecognitionTime.js','countertrendChecklist.js','countertrendLifecycle.js','entryPattern1Conditions.js'].map(f=>`export * from ${JSON.stringify(path.join(root,'src',f).replaceAll('\\','/'))};`).join('\n')));
const bundle=await rolldown({input:entry,platform:'node',plugins:[{name:'derivation-source-identity',transform(code,id){modules.add(id);return null;}}]}),generated=await bundle.generate({format:'esm'});await bundle.close();
const code=generated.output.find(x=>x.type==='chunk').code,sourceHash=hash(code);
if(previous&&previous.provenance.sourceHash!==sourceHash)throw new Error('Derived scanner changed; use a fresh output directory');
const algorithmFiles=[...modules].filter(f=>f.startsWith(path.join(root,'src'))||f.startsWith(path.join(root,'supabase'))).map(f=>path.relative(root,f).replaceAll('\\','/'));
execFileSync('git',['diff','--exit-code','d78913ee52015c49bb495138e9b7ad0783cfd2df','--',...algorithmFiles],{cwd:root,stdio:'pipe'});
const coreFile=path.join(directory,'core.mjs');await import('node:fs/promises').then(fs=>fs.writeFile(coreFile,code));const core=await import(pathToFileURL(coreFile));
if(core.SETUP2_VERSION!=='countertrend-entry-model-1-v24'||core.ENTRY_PATTERN_1_VERSION!=='countertrend-entry-model-1-v11')throw new Error('Unexpected target rules');
const parentHashes={};for(const name of ['run.json','manifest.json','core.mjs','GBPUSD-sources.json','GBPUSD-setups.json','GBPUSD-entries.json'])parentHashes[name]=await fileHash(path.join(parentDirectory,name));
assertT82ParentReference(parent,parentHashes);
const inputHashes={},rows={},cache=path.join(parentDirectory,'cache'),names=await readdir(cache);
for(const bar of ['1D','1h','5m','1m']){
 const matches=names.filter(f=>f.startsWith(`GBPUSD-${bar}-`)&&f.endsWith(`-${parent.to}.json`));if(matches.length!==1)throw new Error(`Ambiguous frozen ${bar}`);
 const file=path.join(cache,matches[0]);inputHashes[bar]=await fileHash(file);
 if(inputHashes[bar]!==parent.provenance.inputPolicy?.exclusions?.[bar]?.filteredHash)throw new Error(`Frozen ${bar} differs`);rows[bar]=await read(file);
}
const replayKeys=new Set();let oldEntries=0;for await(const record of readJsonArray(path.join(parentDirectory,'GBPUSD-entries.json'))){const e=record.snapshot?.entry;if(!e||e.entryPattern!=='countertrend-entry-model-1-v10'||!core.entryPattern1ConditionsReady(e.conditions,e.direction,e.recognizedAt,e.entryPattern))throw new Error('Unverified parent entry');replayKeys.add(record.snapshot.setupKey);oldEntries++;}
const allKeys=new Set();for await(const s of readJsonArray(path.join(parentDirectory,'GBPUSD-setups.json'))){if(s.entry||s.checklist?.entryPattern!=='countertrend-entry-model-1-v10')throw new Error('Unverified parent DR');allKeys.add(s.setupKey);}
if(oldEntries!==170||allKeys.size!==505||replayKeys.size!==110)throw new Error('Certified T82 partition differs');
if([...replayKeys].some(k=>!allKeys.has(k)))throw new Error('Parent entry has no DR');
const sources=await read(path.join(parentDirectory,'GBPUSD-sources.json'));if(hash(sources)!==parent.provenance.setupSourcesHash)throw new Error('Frozen sources differ');
const selected=sources.filter(s=>replayKeys.has(`GBPUSD:setup1:${s.id}`));if(selected.length!==replayKeys.size)throw new Error('Missing or duplicate replay source');
const derivation=createRunDerivation({parentRunId:parent.id,parentSetupVersion:parent.version,parentEntryPattern:parent.configuration.entryPattern,targetSetupVersion:core.SETUP2_VERSION,targetEntryPattern:core.ENTRY_PATTERN_1_VERSION,inheritedSetupKeys:[...allKeys].filter(k=>!replayKeys.has(k)),recomputedSetupKeys:[...replayKeys],parentHashes,inputHashes,parentInputPolicy:parent.provenance.inputPolicy,sourceSubsetHash:hash(selected),parentSourceCount:sources.length,targetRulesCommit:'d78913ee52015c49bb495138e9b7ad0783cfd2df'});
const runnerHashes={};for(const f of ['scripts/tradeSetup2Derive.mjs','scripts/t82DerivationReference.mjs','scripts/derivedBatchRun.mjs','scripts/batchInstrument.mjs','scripts/batchCheckpoint.mjs','scripts/batchJsonFiles.mjs','scripts/batchScanResults.mjs','src/tradeSetupRow.js','src/simulationRunDerivation.js'])runnerHashes[f]=await fileHash(path.join(root,f));
const id='setup2-derived-'+hash({sourceHash,derivation,runnerHashes}).slice(0,24);
if(previous&&previous.id!==id)throw new Error('Derived input/code identity changed; use a fresh output directory');
if(previous?.status==='complete'){console.log(JSON.stringify({runId:id,status:'complete',output:directory,resumedCompleted:true}));process.exit(0);}
const configuration={...structuredClone(parent.configuration),entryPattern:core.ENTRY_PATTERN_1_VERSION,label:`T88 · T82 mit M5-BOS-Pflicht · ${derivation.inheritedSetupKeys.length} übernommen / ${replayKeys.size} neu`,instruments:parent.configuration.instruments.map(c=>({...c,setupVersion:core.SETUP2_VERSION,entryPattern:core.ENTRY_PATTERN_1_VERSION}))};
const run={id,version:core.SETUP2_VERSION,configuration,from:parent.from,to:parent.to,evaluatedAt:parent.evaluatedAt,status:'running',startedAt:previous?.startedAt??Math.floor(Date.now()/1000),coverage:structuredClone(parent.coverage),progress:{phase:'scan',instrument:'GBPUSD',completed:0,total:0},provenance:{source:'FXCM Bid · unveränderte T82-Eingaben',sourceHash,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),derivation,runnerHashes,limitations:[...(parent.provenance.limitations??[]),'Teilneuberechnung: Übernommene DR-Belege behalten v23/v10; nur die ausgewiesenen Entry-DRs wurden unter v24/v11 neu berechnet.']}};
run.provenance.inputs=simulationRunInputs({configuration,from:run.from,to:run.to,fetchedAt:parent.provenance.snapshotAt,sourceHash,sourceCommit:run.provenance.sourceCommit,hash});
const runFile=path.join(directory,'run.json'),save=()=>writeJson(runFile,run);await save();await writeJson(path.join(directory,'manifest.json'),manifest);await writeJson(path.join(directory,'derivation.json'),derivation);await writeJson(path.join(directory,'GBPUSD-sources.json'),sources);
const controller=new AbortController();process.on('SIGINT',()=>controller.abort());process.on('SIGTERM',()=>controller.abort());const started=performance.now(),cpu=process.cpuUsage();
try{
 const config=configuration.instruments[0],replayDirectory=path.join(directory,'replay');await mkdir(replayDirectory,{recursive:true});
 await scanBatchInstrument({core,directory:replayDirectory,identity:{id,sourceHash,derivation,runnerHashes},input:{instrument:'GBPUSD',h1Candles:rows['1h'],m5Candles:rows['5m'],m1Candles:rows['1m'],tradeSetups:selected.map(tradeSetupFromRow),dailyAnchors:core.buildHistoricalDailyAnchors(rows['1D'],rows['1h']),fromTime:run.from,toTime:run.to-1,settings:configuration.settings,sessionConfigs:config.sessions,tradingWindows:config.tradingWindows,news:config.news,newsLoadStatus:config.newsLoadStatus,signal:controller.signal},onProgress:async p=>{run.progress={...p,phase:'scan',instrument:'GBPUSD'};await save();}});
 run.progress={phase:'merge',completed:0,total:allKeys.size};await save();
 const audit=await mergeDerivedSetups({parentFile:path.join(parentDirectory,'GBPUSD-setups.json'),replayFile:path.join(replayDirectory,'GBPUSD-setups.json'),outputFile:path.join(directory,'GBPUSD-setups.json'),derivation});
 for await(const r of readJsonArray(path.join(replayDirectory,'GBPUSD-entries.json'))){const e=r.snapshot.entry;if(!replayKeys.has(r.snapshot.setupKey)||e.entryPattern!==core.ENTRY_PATTERN_1_VERSION||!core.entryPattern1ConditionsReady(e.conditions,e.direction,e.recognizedAt,e.entryPattern)||e.entryCategory!=='full')throw new Error('Invalid derived entry');}
 await import('node:fs/promises').then(fs=>fs.copyFile(path.join(replayDirectory,'GBPUSD-entries.json'),path.join(directory,'GBPUSD-entries.json')));
 for(const [name,expected] of Object.entries(parentHashes))if(await fileHash(path.join(parentDirectory,name))!==expected)throw new Error('Parent original changed during replay');
 for(const [bar,expected] of Object.entries(inputHashes)){const file=names.find(f=>f.startsWith(`GBPUSD-${bar}-`)&&f.endsWith(`-${parent.to}.json`));if(await fileHash(path.join(cache,file))!==expected)throw new Error('Frozen parent candles changed during replay');}
 if(audit.inherited!==789)throw new Error('Inherited T82 snapshot count differs');
 await writeJson(path.join(directory,'merge-audit.json'),audit);run.provenance.derivation.inheritedSnapshotSetHash=hash(audit.inheritedSnapshotHashes);run.provenance.derivation.inheritedSnapshotCount=audit.inherited;run.provenance.derivation.recomputedSnapshotCount=audit.recomputed;
 const used=process.cpuUsage(cpu);run.provenance.measurement={attemptWallMs:performance.now()-started,attemptCpuMs:(used.user+used.system)/1000};run.status='complete';run.completedAt=Math.floor(Date.now()/1000);run.progress={phase:'complete',completed:allKeys.size,total:allKeys.size};await save();console.log(JSON.stringify({runId:id,status:run.status,output:directory}));
}catch(error){run.status='failed';run.progress={...run.progress,error:error.message};await save();throw error;}
