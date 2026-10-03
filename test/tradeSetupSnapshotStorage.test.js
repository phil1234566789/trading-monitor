import {expect,it} from 'vitest';
import {encodeSnapshotStructures,decodeSnapshotStructures} from '../src/tradeSetupSnapshotStorage.js';

const tree={trend:'downtrend',currRange:{high:{price:1.35,time:300},low:{price:1.34,time:600}},nestedTrend:{trend:'uptrend'},history:Array.from({length:500},(_,i)=>({time:i*300,price:1.34+i/100000}))};
const snapshot=()=>({id:'source:stand:900',knownAt:900,dealingRange:{status:'validated'},rangeCourse:{target1:1.33,lifecycle:{evaluatedAt:900}},
 checklist:{structure:structuredClone(tree),checks:{m5Trend:{trend:'uptrend',structureState:structuredClone(tree)},outerM5Trend:{trend:'downtrend',structureState:structuredClone(tree)}},
 setup:{primary:{invalidation:1.36,targetSelection:{status:'passed',target1:{price:1.33}},checks:{m5Trend:{structureState:structuredClone(tree)}}}}}});

it('stores repeated recursive structures once and restores the complete frozen snapshot',()=>{
 const original=snapshot(),before=structuredClone(original),stored=encodeSnapshotStructures(original);
 expect(JSON.stringify(stored).length).toBeLessThan(JSON.stringify(original).length*.4);
 expect(decodeSnapshotStructures(JSON.parse(JSON.stringify(stored)))).toEqual(original);
 expect(original).toEqual(before);
 expect(stored.checklist.setup.primary.invalidation).toBe(1.36);
 expect(stored.checklist.setup.primary.targetSelection).toEqual(original.checklist.setup.primary.targetSelection);
 expect(stored.rangeCourse).toEqual(original.rangeCourse);
});
it('preserves legacy snapshots and null reads',()=>{
 expect(decodeSnapshotStructures(null)).toBeNull();
 expect(decodeSnapshotStructures(snapshot())).toEqual(snapshot());
 expect(encodeSnapshotStructures({id:'small',checklist:{structure:{trend:'unknown'}}})).toEqual({id:'small',checklist:{structure:{trend:'unknown'}}});
});
it('keeps different structure trees distinct and encoding idempotent',()=>{
 const original=snapshot();original.checklist.checks.outerM5Trend.structureState.trend='uptrend';
 const stored=encodeSnapshotStructures(original);
 expect(decodeSnapshotStructures(stored)).toEqual(original);
 expect(encodeSnapshotStructures(stored)).toEqual(stored);
});
it('rejects corrupt references and unsupported storage versions instead of guessing a trend',()=>{
 const stored=encodeSnapshotStructures(snapshot());
 stored.checklist.structure={snapshotStructureRef:999};
 expect(()=>decodeSnapshotStructures(stored)).toThrow(/reference/i);
 stored.structureStorage.version='future';
 expect(()=>decodeSnapshotStructures(stored)).toThrow(/version/i);
});
