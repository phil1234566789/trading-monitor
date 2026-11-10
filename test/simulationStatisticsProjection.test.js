import {it,expect} from 'vitest';
import {compileSimulationStatistics,projectionDataset} from '../src/simulationStatisticsProjection.js';
import {reviewGroups,filterReviewGroups,groupResults,runFunnel,rangeEntryCrossTable,variantMetrics} from '../src/simulationRunComparison.js';
import {applySimulationCommission} from '../src/tradeSetupSimulationCosts.js';
import {DEALING_RANGE_VERSION} from '../src/tradeSetup2DealingRange.js';

it('preserves filtered statistics across multiple states, re-entries, unknowns and both stop variants without loading detail trees',async()=>{
 const snapshots=[];const results=[];
 for(let i=0;i<31;i++){
  const base={id:`s${i}`,runId:'r',instrument:i%2?'GBPUSD':'XAUUSD',direction:i%2?'long':'short',setupKey:`k${i}`,knownAt:100+i,
   dealingRange:{version:DEALING_RANGE_VERSION,status:i%3?'validated':'confirmed'},checklist:{status:'ready',evaluatedAt:100+i},
   m1Check:{largeTree:Array(100).fill({price:1})}};
  snapshots.push(base,{...base,id:`later${i}`,knownAt:200+i});
  if(i%2){const entry={...base,id:`e${i}`,entry:{id:`economic${i}`,recognizedAt:120+i,entryPattern:'unknown-version'}};snapshots.push(entry);
   for(const variant of ['wide','narrow'])results.push({runId:'r',snapshotId:entry.id,entryId:entry.entry.id,entryTime:120+i,variant,status:'closed',outcome:'slBeforeT1',pnlUsd:-500,rMultiple:-1});}
 }
 const projected=await compileSimulationStatistics(snapshots,results),full=reviewGroups(snapshots),compact=projected.map(row=>row.summary),net=results.map(applySimulationCommission);
 expect(projected).toHaveLength(31);expect(JSON.stringify(compact)).not.toContain('largeTree');
 for(const filters of [{},{instrument:'GBPUSD'},{entry:'without'},{entry:'with'},{stage:'validated'},{pattern:'unknown'},{outcome:'unknown'}]){
  const a=filterReviewGroups(full,filters),b=filterReviewGroups(compact,filters);
  const ar=groupResults(a,net,filters),br=groupResults(b,projectionDataset(projected).results,filters);
  expect(b.map(g=>g.key)).toEqual(a.map(g=>g.key));expect(br).toEqual(ar);
  expect(runFunnel(b,br)).toEqual(runFunnel(a,ar));
  for(const variant of ['wide','narrow']){expect(variantMetrics(br,variant)).toEqual(variantMetrics(ar,variant));expect(rangeEntryCrossTable(b,br,variant)).toEqual(rangeEntryCrossTable(a,ar,variant));}
 }
 expect(projected[0].detail).toEqual(full[0]);
 expect(compact.every(g=>g.features.every(f=>!Object.hasOwn(f,'details')))).toBe(true);
});
