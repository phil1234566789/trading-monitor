import {it,expect} from 'vitest';
import {setupEntryConditions} from '../src/tradeSetup2Review.js';
import {M1_FVG_RETEST_PATTERN_VERSION as version} from '../src/m1FvgRetestSequence.js';
import {ENTRY_PATTERN_1_VERSION} from '../src/entryPattern1Conditions.js';
const facts={retest:{recognizedAt:60,orderBlock:{dir:1}},m1PivotBreak:{direction:'long',type:'pivot-break',recognizedAt:120},retestedFvg:{direction:'long',recognizedAt:180},fvgRetest:{candleTime:180,recognizedAt:240},fvg:{direction:'long',recognizedAt:300}};
const snapshot=()=>({instrument:'XAUUSD',direction:'long',knownAt:300,entry:{id:'p2',entryPattern:version,label:'Entry Pattern 2',recognizedAt:300,conditions:structuredClone(facts)}});
it('shows all five causal Pattern 2 facts without an M5 BOS gate',()=>{
  const s=snapshot(),review=setupEntryConditions(s);
  expect(review.patternLabel).toBe('Entry Pattern 2');
  for(const key of Object.keys(facts))expect(review.rows.find(r=>r.key===key)?.status).toBe('passed');
  expect(review.rows.some(r=>r.key==='m5Bos')).toBe(false);
  s.entry.conditions.fvgRetest.candleTime=179;
  expect(setupEntryConditions(s).rows.find(r=>r.key==='fvgRetest').status).toBe('unmet');
});
it('reviews a matched second pattern without mutating the execution owner',()=>{
  const s=snapshot();s.entry.entryPattern=ENTRY_PATTERN_1_VERSION;s.entry.id='p1';s.entry.label='Entry Pattern 1';
  s.entry.patternMatches=[{id:'p1',entryPattern:ENTRY_PATTERN_1_VERSION,conditions:{}},{id:'p2',entryPattern:version,conditions:structuredClone(facts)}];
  const before=structuredClone(s),review=setupEntryConditions(s,version);
  expect(review.patternLabel).toBe('Entry Pattern 2');expect(review.patternOptions).toHaveLength(2);
  expect(review.rows.find(r=>r.key==='retestedFvg').status).toBe('passed');expect(s).toEqual(before);
});
it('selects distinct source facts by match ID when both use the same pattern version',()=>{
 const s=snapshot(),other=structuredClone(facts);other.fvgRetest.candleTime=179;
 s.entry.patternMatches=[{id:'source-a',entryPattern:version,sourceSetupKey:'a',sourceKnownAt:60,conditions:structuredClone(facts)},
  {id:'source-b',entryPattern:version,sourceSetupKey:'b',sourceKnownAt:120,conditions:other}];
 const before=structuredClone(s),review=setupEntryConditions(s,'source-b');
 expect(review.selectedPatternId).toBe('source-b');
 expect(review.rows.find(r=>r.key==='fvgRetest').status).toBe('unmet');
 expect(review.patternOptions[0].label).not.toBe(review.patternOptions[1].label);
 expect(s).toEqual(before);
});
