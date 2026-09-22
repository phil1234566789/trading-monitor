// Derselbe Produktivcode für Trend und Targets, mit Supabase-Lesezugriff statt separatem MCP-Token.
import { createAnalysisSnapshotFetch } from './analysisSnapshotFetch.js';
import { fileURLToPath } from 'node:url';
globalThis.fetch = createAnalysisSnapshotFetch(globalThis.fetch.bind(globalThis));
// Erst nach dem Analyse-Snapshot initialisieren, damit Supabase denselben Fetch verwendet.
const { compute1hStructureState } = await import('../../supabase/functions/trading-monitor-mcp/tools/dataExport.ts');
const { findTargetCandidates } = await import('../../supabase/functions/trading-monitor-mcp/findTargetCandidates.js');
const root = fileURLToPath(new URL('.', import.meta.url));
const rows = JSON.parse(await Deno.readTextFile(root+'daten-setups-sim.json'));
// Explizite Wiederaufnahme nur bei unverändertem Algorithmus und derselben Kerzenquelle.
const resume = Deno.env.get('FXCM_CONTEXT_RESUME') === '1';
const trends: Record<string,unknown> = resume ? JSON.parse(await Deno.readTextFile(root+'trend-je-dr.json')) : {};
const targets: Record<string,unknown> = resume ? JSON.parse(await Deno.readTextFile(root+'daten-targets-fxcm.json')) : {};
let index = 0, done = 0;
async function worker() {
 while (index < rows.length) {
  const r = rows[index++];
  const key = `${r.direction}|${r.ob_start_time}`;
  if (resume && trends[key] && targets[key]) { done++; continue; }
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
await Promise.all(Array.from({length:8},worker));
await Deno.writeTextFile(root+'trend-je-dr.json',JSON.stringify(trends));
await Deno.writeTextFile(root+'daten-targets-fxcm.json',JSON.stringify(targets));
console.log('FXCM trend and targets complete');

const jsonl = Object.entries(targets).map(([id,res]) => JSON.stringify({id,res})).join('\n')+'\n';
const compressed = new Blob([jsonl]).stream().pipeThrough(new CompressionStream('gzip'));
await Deno.writeFile(root+'find-targets-roh.jsonl.gz',new Uint8Array(await new Response(compressed).arrayBuffer()));
