import {describe,it,expect} from 'vitest';
import {simulationEntryPatterns,simulationGroupEntryPatterns} from '../src/simulationEntryPatterns.js';
import {comparisonFilters,filterReviewGroups,groupResults,variantMetrics} from '../src/simulationRunComparison.js';
import {ENTRY_PATTERN_1_VERSION} from '../src/entryPattern1Conditions.js';
import {M1_FVG_RETEST_PATTERN_VERSION} from '../src/m1FvgRetestSequence.js';
import {simulationReviewMetadata,simulationReviewMetadataProjection} from '../src/simulationReviewMetadata.js';

const entry=(id,version,matches)=>({id,runId:'run',knownAt:100,entry:{recognizedAt:100,entryPattern:version,...(matches?{patternMatches:matches.map(entryPattern=>({entryPattern}))}:{})}});
const p1=entry('p1',ENTRY_PATTERN_1_VERSION),p2=entry('p2',M1_FVG_RETEST_PATTERN_VERSION);
const both=entry('both',ENTRY_PATTERN_1_VERSION,[ENTRY_PATTERN_1_VERSION,M1_FVG_RETEST_PATTERN_VERSION,M1_FVG_RETEST_PATTERN_VERSION]);
describe('saved entry pattern presentation and filters',()=>{
 it('uses explicit versions including historical entryModel, never IDs or Full sizing',()=>{
  expect(simulationEntryPatterns(p1)).toEqual(['pattern1']);
  expect(simulationEntryPatterns(p2)).toEqual(['pattern2']);
  expect(simulationEntryPatterns({entry:{entryModel:'countertrend-entry-model-1-v3'}})).toEqual(['pattern1']);
  expect(simulationEntryPatterns({id:'entry-pattern-1',entry:{entryCategory:'full',label:'Entry Pattern 1'},checklist:{entryPattern:ENTRY_PATTERN_1_VERSION}})).toEqual(['unknown']);
  expect(simulationEntryPatterns(entry('future','future-pattern-v99'))).toEqual(['unknown']);
 });
 it('retains both pattern matches without duplicating an execution or hiding unknown evidence',()=>{
  expect(simulationEntryPatterns(both)).toEqual(['pattern1','pattern2']);
  expect(simulationEntryPatterns(entry('mixed',ENTRY_PATTERN_1_VERSION,['future-pattern']))).toEqual(['pattern1','unknown']);
  expect(simulationGroupEntryPatterns({entries:[p2,p1,both]})).toEqual(['pattern1','pattern2']);
 });
 it('preserves matches through the actual compact statistics metadata path',()=>{
  const row=simulationReviewMetadata({id:both.id,run_id:'run',...simulationReviewMetadataProjection(both)});
  expect(simulationEntryPatterns(row)).toEqual(['pattern1','pattern2']);
 });
 it('filters executions and resulting metrics, retains DR context and original pin identity',()=>{
  const group={key:'range',instrument:'XAUUSD',snapshot:{id:'context'},outcome:{status:'unknown'},entries:[p1,p2,both]};
  const filtered=filterReviewGroups([group],{pattern:'pattern2'});
  expect(filtered[0].entries.map(e=>e.id)).toEqual(['p2','both']);
  expect(filtered[0].snapshot).toBe(group.snapshot);
  expect(filtered[0].entries[0]).toBe(p2);
  expect(group.entries).toHaveLength(3);
  const results=[p1,p2,both].map(e=>({runId:'run',snapshotId:e.id,variant:'wide',entryTime:100,status:'closed',netPnlUsd:-100,netRMultiple:-1}));
  const scoped=groupResults(filtered,results);
  expect(scoped.map(r=>r.snapshotId)).toEqual(['p2','both']);
  expect(variantMetrics(scoped,'wide').total).toBe(2);
  expect(filterReviewGroups([group],{pattern:'both'})[0].entries.map(e=>e.id)).toEqual(['both']);
 });
 it('combines date and pattern on the same entry, excludes no-entry DRs, and exposes missing versions',()=>{
  const at=Date.parse('2026-11-05T12:00:00+01:00')/1000;
  const inside={...p1,entry:{...p1.entry,recognizedAt:at}};
  const group={entries:[inside,p2],outcome:{},snapshot:{}};
  expect(filterReviewGroups([group],{from:'2026-11-05',pattern:'pattern2'})).toHaveLength(0);
  expect(filterReviewGroups([{...group,entries:[]}],{pattern:'unknown'})).toHaveLength(0);
  expect(filterReviewGroups([{...group,entries:[entry('old',null)]}],{pattern:'unknown'})).toHaveLength(1);
 });
 it('roundtrips the pattern URL filter and ignores unsupported values',()=>{
  expect(comparisonFilters({pattern:'pattern2'}).pattern).toBe('pattern2');
  expect(comparisonFilters({pattern:'future'}).pattern).toBe('');
 });
});
