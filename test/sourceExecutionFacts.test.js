import {it,expect} from 'vitest';
import {sourceExecutionKey,mergeSourceExecutionFacts} from '../src/sourceExecutionFacts.js';
const snapshot=(id,pattern,target=90)=>({id,setupKey:id,knownAt:2400,entry:{id,setupKey:id,instrument:'XAUUSD',direction:'short',
 entryPattern:pattern,recognizedAt:2400,ideaKnownAt:1800,ideaKey:'known-idea',exitPolicy:'half-t1-be-rest-t2-exact-half-v1',price:100,
 stops:{wide:{price:110},narrow:{price:105}},scales:{wide:{targets:[{price:target}]},narrow:{targets:[{price:target}]}}},
 checklist:{setup:{primary:{id,recognizedAt:1800}},checks:{outerM5Trend:{status:'passed'},m5Trend:{status:'passed'}}}});
it('coalesces identical execution facts while retaining both pattern and source identities',()=>{
 const a=snapshot('legacy-p1','p1'),b=snapshot('r2-p2','p2');
 expect(sourceExecutionKey(a)).toBe(sourceExecutionKey(b));
 expect(mergeSourceExecutionFacts(a,b)).toBe(true);
 expect(a.entry.id).toBe('legacy-p1');expect(a.entry.patternMatches.map(m=>m.id)).toEqual(['legacy-p1','r2-p2']);
 expect(a.entry.patternMatches[1].sourceSetupKey).toBe('r2-p2');
 expect(mergeSourceExecutionFacts(a,b)).toBe(true);expect(a.entry.patternMatches).toHaveLength(2);
});
it('keeps different targets or exit policies separate',()=>{
 const a=snapshot('a','p1'),b=snapshot('b','p2',80);
 expect(mergeSourceExecutionFacts(a,b)).toBe(false);
 b.entry.scales=a.entry.scales;b.entry.exitPolicy='different-policy';
 expect(mergeSourceExecutionFacts(a,b)).toBe(false);
});
it('does not merge different configured size or contract units',()=>{
 const a=snapshot('a','p1'),b=snapshot('b','p2');a.entry.sizing={factor:.5,fullFactor:1};b.entry.sizing={factor:1,fullFactor:1};
 expect(mergeSourceExecutionFacts(a,b)).toBe(false);
 a.entry.sizing=b.entry.sizing;a.entry.executionContract={version:'test',unitsPerLot:1};b.entry.executionContract={version:'test',unitsPerLot:100};
 expect(mergeSourceExecutionFacts(a,b)).toBe(false);
});
it('never merges an execution whose idea or source was not yet known',()=>{
 const a=snapshot('a','p1'),b=snapshot('b','p2');b.entry.ideaKnownAt=2500;
 expect(sourceExecutionKey(b)).toBeNull();expect(mergeSourceExecutionFacts(a,b)).toBe(false);
 b.entry.ideaKnownAt=1800;b.checklist.setup.primary.recognizedAt=2500;
 expect(sourceExecutionKey(b)).toBeNull();
});
