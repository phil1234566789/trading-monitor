import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {rolldown} from 'rolldown';
import assert from 'node:assert/strict';

const options=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
if(!options.output)throw new Error('Fresh --output required');
if(options.case&&!['B','C','D','A3'].includes(options.case))throw new Error('Unknown benchmark case');
const directory=path.resolve(options.output);await mkdir(directory,{recursive:false});
const input=path.join(directory,'entry.mjs');
const source=f=>JSON.stringify(path.resolve(f).replaceAll('\\','/'));
await writeFile(input,[`export * from ${source('src/m1ScanPrefix.js')};`,
  `export * from ${source('src/candleTimeIndex.js')};`,`export * from ${source('src/orderBlockMitigation.js')};`,
  `export * from ${source('src/closedCandlePrefix.js')};`,
  `export * from ${source('src/orderBlockDetection.js')};`,
  `export * from ${source('src/incrementalOrderBlocks.js')};`,
  `export {detectOrderBlocks as previousOrderBlocks} from ${source('test/fixtures/orderBlockDetectionBeforePerformanceH.js')};`,
  `export * from ${source('src/tradeSetupChecklistTimeBasis.js')};`].join('\n'));
const bundle=await rolldown({input,platform:'node'}),generated=await bundle.generate({format:'esm'});await bundle.close();
const coreFile=path.join(directory,'core.mjs');await writeFile(coreFile,generated.output.find(c=>c.type==='chunk').code);
const core=await import(pathToFileURL(coreFile));
const rows=JSON.parse(await readFile('.debug/setup2-f-observation-3125-v10b/cache/GBPUSD-1m-1717354800-1789682400.json','utf8'));
const anchor=1789513200;
const minutes=rows.filter(c=>c.time>=1789542000&&c.time<1789560000);
let before=()=>minutes.map(c=>{
  const end=rows.findIndex(r=>r.time===c.time)+1,prefix=core.m1ScanPrefix(rows,anchor,end);
  return core.orderBlockMitigationFvg(prefix,'short');
});
let after=()=>minutes.map(c=>core.orderBlockMitigationFvg(rows,'short',
  core.candleTimeIndex(rows,c.time)+1,core.m1ScanPrefixStart(rows,anchor)));
if(options.case==='C'){
  const m5=JSON.parse(await readFile('.debug/setup2-f-observation-3125-v10b/cache/GBPUSD-5m-1717354800-1789682400.json','utf8'));
  const facts=prefix=>[prefix.length,prefix[0]?.time,prefix.at(-1)?.time];
  before=()=>minutes.map(c=>facts(m5.filter(r=>r.time+300<=c.time+60)));
  after=()=>{const prefix=core.createClosedCandlePrefix(m5,300);return minutes.map(c=>facts(prefix(c.time+60)));};
}
if(options.case==='D'){
  before=()=>minutes.map(c=>rows.filter(r=>Number.isFinite(r.time)&&r.time+60<=c.time+60).slice().sort((a,b)=>a.time-b.time).length);
  after=()=>minutes.map(c=>core.closedChecklistCandles(rows,'1m',c.time+60).length);
}
if(options.case==='A3'){
  const m5=JSON.parse(await readFile('.debug/setup2-f-observation-3125-v10b/cache/GBPUSD-5m-1717354800-1789682400.json','utf8'));
  const end=m5.findIndex(c=>c.time>=1789542000),prefixes=[0,10,20].map(i=>m5.slice(0,end+i));
  before=()=>prefixes.map(prefix=>core.previousOrderBlocks(prefix,'5m'));
  after=()=>{const detect=core.createIncrementalOrderBlockDetector('5m');return prefixes.map(detect);};
}
assert.deepEqual(after(),before());
const measurements=[];
for(let i=0;i<Number(options.repeat??7);i++)for(const [name,run] of i%2?[['after',after],['before',before]]:[['before',before],['after',after]]){
  const cpu=process.cpuUsage(),start=performance.now();run();const elapsed=process.cpuUsage(cpu);
  measurements.push({name,wallMs:performance.now()-start,cpuMs:(elapsed.user+elapsed.system)/1000});
}
await writeFile(path.join(directory,'measurements.json'),JSON.stringify(measurements,null,2));console.log(JSON.stringify(measurements));
