import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {rolldown} from 'rolldown';
import {createHash} from 'node:crypto';
import {tradeSetupFromRow} from '../src/tradeSetupRow.js';
import {setup2ProfilingPlugin,setup2WithoutProfilingPlugin,createSetup2Profile} from './setup2Profiling.mjs';

const options=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
if(!options.fixture||!options.output)throw new Error('--fixture and fresh --output required');
const directory=path.resolve(options.output);
await mkdir(directory,{recursive:false});
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const fixture=path.resolve(options.fixture),manifest=await read(path.join(fixture,'manifest.json'));
const configuration=await read(path.join(fixture,'settings.json'));
const cache=path.resolve(options.cache??path.join(fixture,'cache')),files=await readdir(cache),rows={};
for(const bar of ['1D','1h','5m','1m']){
  const matches=files.filter(f=>f.startsWith(`GBPUSD-${bar}-`)&&f.endsWith(`-${manifest.requestedTo}.json`));
  if(matches.length!==1)throw new Error(`Ambiguous/missing frozen ${bar} cache`);
  rows[bar]=await read(path.join(cache,matches[0]));
}
const input=path.join(directory,'entry.mjs');
await writeFile(input,['tradeSetup2Scan.js','tradeSetup2Anchors.js','tradeSetupSimulation.js','tradeSetup2Configuration.js']
  .map(f=>`export * from ${JSON.stringify(path.resolve('src',f).replaceAll('\\','/'))};`).join('\n'));
const bundle=await rolldown({input:options.core?path.resolve(options.core):input,platform:'node',plugins:options.profile==='true'?[setup2ProfilingPlugin()]:[setup2WithoutProfilingPlugin()]});
const generated=await bundle.generate({format:'esm'});await bundle.close();
const code=generated.output.find(f=>f.type==='chunk').code;
const coreFile=path.join(directory,'core.mjs');await writeFile(coreFile,code);
const core=await import(pathToFileURL(coreFile));
if(options.version && core.SETUP2_VERSION!==options.version)throw new Error('Unexpected setup version');
const allSources=await read(path.join(fixture,'GBPUSD-sources.json'));
const setupIds=options.setupIds?.split(',').map(Number);
const sources=setupIds ? allSources.filter(s=>setupIds.includes(s.id)) : allSources;
if(setupIds?.some(id=>!Number.isInteger(id)||!sources.some(s=>s.id===id)))
  throw new Error('Every requested setup ID must exist in the frozen fixture');
const fromTime=Number(options.from??manifest.requestedFrom),toTime=Number(options.to??manifest.requestedTo);
if(fromTime<manifest.requestedFrom || toTime>manifest.requestedTo || !(fromTime<toTime))
  throw new Error('Replay window must stay inside the frozen fixture');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
await writeFile(path.join(directory,'replay.json'),JSON.stringify({fixture,cache,
  fromTime,toTime,setupIds,setupVersion:core.SETUP2_VERSION,inputHash:hash({manifest,configuration,sources,rows,fromTime,toTime}),sourceHash:hash(code)},null,2));
const sessions=manifest.sessions.map(r=>({id:r.id,label:r.label,instrument:r.instrument,fromMinutes:r.from_minutes,
  toMinutes:r.to_minutes,highLowRelevant:r.high_low_relevant,ignoreLiquidity:r.ignore_liquidity??false,danger:r.danger,days:r.days}));
const results=[];
for(let repeat=0;repeat<Number(options.repeat??3);repeat++){
  const profile=options.profile==='true'?createSetup2Profile():null;globalThis.__setup2Profile=profile;
  const start=performance.now(),cpu=process.cpuUsage();
  const snapshots=await core.scanTradeSetup2Window({instrument:'GBPUSD',h1Candles:rows['1h'],m5Candles:rows['5m'],m1Candles:rows['1m'],
    tradeSetups:sources.map(tradeSetupFromRow),dailyAnchors:core.buildHistoricalDailyAnchors(rows['1D'],rows['1h']),
    fromTime,toTime:toTime-1,settings:configuration.settings,sessionConfigs:sessions,
    tradingWindows:manifest.schedules.find(s=>s.instrument==='GBPUSD')?.trading_windows,
    news:manifest.news.map(n=>({...n,eventTime:Date.parse(n.event_time)/1000})),newsLoadStatus:'unknown',yieldControl:()=>Promise.resolve()});
  const elapsedCpu=process.cpuUsage(cpu),wallMs=performance.now()-start;
  const records=snapshots.filter(s=>s.entry).map(snapshot=>({snapshot,outcomes:['wide','narrow'].map(variant=>
    core.evaluateSimulation({entry:snapshot.entry,variant,candles:rows['1m'],evaluatedAt:toTime,
      target1:snapshot.checklist.setup.primary.targetSelection?.target1?.price,
      target2:snapshot.checklist.setup.primary.targetSelection?.target2?.price??null}))}));
  const result={snapshots,records},resultHash=hash(result);
  if(repeat===0)await writeFile(path.join(directory,'results.json'),JSON.stringify(result));
  if(results.some(r=>r.hash!==resultHash))throw new Error('Non-deterministic replay');
  results.push({wallMs,cpuMs:(elapsedCpu.user+elapsedCpu.system)/1000,hash:resultHash,entries:records.map(r=>r.snapshot.knownAt),functions:profile?.functions,memo:profile?.memo,memos:profile?.memos,detectors:profile?.detectors});
  await writeFile(path.join(directory,'measurements.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.at(-1)));
}
delete globalThis.__setup2Profile;
