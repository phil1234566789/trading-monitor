import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {rolldown} from 'rolldown';
import assert from 'node:assert/strict';

const options=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
if(!options.output)throw new Error('Fresh --output required');
const directory=path.resolve(options.output);await mkdir(directory,{recursive:false});
const input=path.join(directory,'entry.mjs');
const source=f=>JSON.stringify(path.resolve(f).replaceAll('\\','/'));
await writeFile(input,[`export * from ${source('src/m1ScanPrefix.js')};`,
  `export * from ${source('src/candleTimeIndex.js')};`,`export * from ${source('src/orderBlockMitigation.js')};`,
  `export * from ${source('src/tradeSetupChecklistTimeBasis.js')};`].join('\n'));
const bundle=await rolldown({input,platform:'node'}),generated=await bundle.generate({format:'esm'});await bundle.close();
const coreFile=path.join(directory,'core.mjs');await writeFile(coreFile,generated.output.find(c=>c.type==='chunk').code);
const core=await import(pathToFileURL(coreFile));
const rows=JSON.parse(await readFile('.debug/setup2-f-observation-3125-v10b/cache/GBPUSD-1m-1717354800-1789682400.json','utf8'));
const anchor=1789513200;
const minutes=rows.filter(c=>c.time>=1789542000&&c.time<1789560000);
const before=()=>minutes.map(c=>{
  const end=rows.findIndex(r=>r.time===c.time)+1,prefix=core.m1ScanPrefix(rows,anchor,end);
  return core.orderBlockMitigationFvg(prefix,'short');
});
const after=()=>minutes.map(c=>core.orderBlockMitigationFvg(rows,'short',
  core.candleTimeIndex(rows,c.time)+1,core.m1ScanPrefixStart(rows,anchor)));
assert.deepEqual(after(),before());
const measurements=[];
for(let i=0;i<7;i++)for(const [name,run] of i%2?[['after',after],['before',before]]:[['before',before],['after',after]]){
  const cpu=process.cpuUsage(),start=performance.now();run();const elapsed=process.cpuUsage(cpu);
  measurements.push({name,wallMs:performance.now()-start,cpuMs:(elapsed.user+elapsed.system)/1000});
}
await writeFile(path.join(directory,'measurements.json'),JSON.stringify(measurements,null,2));console.log(JSON.stringify(measurements));
