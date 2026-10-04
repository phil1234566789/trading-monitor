import { it, expect } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { DR_PRICE_OBSERVATION_VERSION } from '../src/dealingRangePriceObservation.js';
import { reviewGroups, rangeEntryCrossTable, runFunnel } from '../src/simulationRunComparison.js';
import { COUNTERTREND_STAGE_VERSION } from '../src/tradeSetup2DealingRange.js';
import { encodeSnapshotStructures, decodeSnapshotStructures } from '../src/tradeSetupSnapshotStorage.js';
import DealingRangeOutcome from '../src/components/DealingRangeOutcome.vue';
import SimulationRunQuality from '../src/components/SimulationRunQuality.vue';

const snapshot = (key, stage2, target2=30, entry=null) => ({ id:key, setupKey:key, runId:'run', instrument:'GBPUSD',
  direction:'long', knownAt:600, entry, dealingRange:{version:COUNTERTREND_STAGE_VERSION,status:'validated'},
  priceObservation:{ version:DR_PRICE_OBSERVATION_VERSION,setupKey:key,validatedAt:600,direction:'long',
    target1:20,target2,invalidation:10,stage1:'target1',stage2,t1At:900,rawThrough:1800,endAt:1200,endReason:stage2 } });
it('crosses DR price outcomes independently from entries and uses only validated T2 targets as denominator',async()=>{
  const snapshots=[snapshot('t2','target2',30,{id:'entry'}),snapshot('return','returned'),snapshot('open','open'),snapshot('none','noTarget2',null),
    {...snapshot('legacy','target2'),priceObservation:undefined}];
  const groups=reviewGroups(snapshots);
  const rows=rangeEntryCrossTable(groups,[],'wide');
  expect(rows.find(r=>r.key==='t2')).toMatchObject({total:1,without:0,pending:1});
  expect(rows.find(r=>r.key==='t1Only')).toMatchObject({total:1,without:1});
  expect(rows.find(r=>r.key==='t1Open').total).toBe(1);
  expect(rows.find(r=>r.key==='noTarget2').total).toBe(1);
  expect(rows.find(r=>r.key==='unknown').total).toBe(1);
  expect(runFunnel(groups,[])).toMatchObject({validated:5,target1:4,target2:1,target2Eligible:3,target2Unknown:1});
  const html=await renderToString(createSSRApp(SimulationRunQuality,{current:{groups,results:[]},compare:false}));
  expect(html).toContain('33.3 %');
  expect(html).toContain('T1 vor Invalidation, danach zurück ohne T2');
  const card=await renderToString(createSSRApp(DealingRangeOutcome,{group:groups.find(g=>g.snapshot.id==='t2')}));
  expect(card).toContain('T1 vor Invalidation, dann T2');
  expect(card).not.toContain('Kein Entry gespeichert');
  for (const s of snapshots) expect(decodeSnapshotStructures(encodeSnapshotStructures(s))).toEqual(s);
});
