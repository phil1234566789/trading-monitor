// Derselbe Produktivcode für Trend und Targets, mit Supabase-Lesezugriff statt separatem MCP-Token.
import { compute1hStructureState } from '../../supabase/functions/trading-monitor-mcp/tools/dataExport.ts';
import { findTargetCandidates } from '../../supabase/functions/trading-monitor-mcp/findTargetCandidates.js';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const rows = JSON.parse(await Deno.readTextFile(root+'daten-setups-sim.json'));
const trends: Record<string,unknown> = {};
const targets: Record<string,unknown> = {};
let index = 0, done = 0;
async function worker() {
 while (index < rows.length) {
  const r = rows[index++];
  const key = `${r.direction}|${r.ob_start_time}`;
  const currentTimeSec = Date.parse(r.ob_start_time)/1000 + 600;
  for(let attempt=0;attempt<3;attempt++) {
   try {
    const [{trend:s},target] = await Promise.all([
      compute1hStructureState('GBPUSD',currentTimeSec),
      findTargetCandidates({instrument:'GBPUSD',direction:r.direction,currentTimeSec})
    ]);
    const rng=s?.currRange;
    trends[key]={trend:s?.trend ?? null,nestedTrend:s?.nestedTrend?.trend ?? null,rangeHigh:rng?.high?.price ?? null,rangeLow:rng?.low?.price ?? null};
    targets[key]=target;
    break;
   } catch(e) { if(attempt===2) throw e; await new Promise(resolve=>setTimeout(resolve,2000)); }
  }
  done++;
  if(done%25===0) {
   await Deno.writeTextFile(root+'trend-je-dr.json',JSON.stringify(trends));
   await Deno.writeTextFile(root+'daten-targets-fxcm.json',JSON.stringify(targets));
   console.log(`${done}/${rows.length}`);
  }
 }
}
await Promise.all(Array.from({length:4},worker));
await Deno.writeTextFile(root+'trend-je-dr.json',JSON.stringify(trends));
await Deno.writeTextFile(root+'daten-targets-fxcm.json',JSON.stringify(targets));
console.log('FXCM trend and targets complete');

const jsonl = Object.entries(targets).map(([id,res]) => JSON.stringify({id,res})).join('\n')+'\n';
const compressed = new Blob([jsonl]).stream().pipeThrough(new CompressionStream('gzip'));
await Deno.writeFile(root+'find-targets-roh.jsonl.gz',new Uint8Array(await new Response(compressed).arrayBuffer()));
