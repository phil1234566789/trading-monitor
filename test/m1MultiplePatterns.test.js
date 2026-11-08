import {describe,it,expect,vi,afterEach} from 'vitest';
import {evaluateM1Checklist} from '../src/m1Checklist.js';
import * as pattern1 from '../src/countertrendEntryPattern1.js';
import * as pattern2 from '../src/entryPattern2.js';
import * as pivots from '../src/m1PivotStructure.js';
import {ENTRY_PATTERN_1_VERSION} from '../src/entryPattern1Conditions.js';
import {M1_FVG_RETEST_PATTERN_VERSION} from '../src/m1FvgRetestSequence.js';
import {gateM1ChecklistEntries} from '../src/tradeSetup2EntryGate.js';
const entry=(version,price=1.3)=>({id:`same-DR:${version}:300`,entryPattern:version,setupKey:'same-DR',direction:'short',
  recognizedAt:300,price,stops:{wide:{price:1.301},narrow:{price:1.3005}},conditions:{version}});
const check=version=>({entryPattern:version,evaluatedAt:300,entry:entry(version)});
const input={context:{entryPattern:ENTRY_PATTERN_1_VERSION,entryPatterns:[ENTRY_PATTERN_1_VERSION,M1_FVG_RETEST_PATTERN_VERSION],primary:{}},
  structure:{status:'ready',state:null},candles:[],evaluatedAt:300};
afterEach(()=>vi.restoreAllMocks());
describe('additional entry pattern on the same original Setup 1.0 source',()=>{
  it('preserves both pattern facts but counts an identical execution only once',()=>{
    vi.spyOn(pattern1,'evaluateCountertrendEntryPattern1').mockReturnValue(check(ENTRY_PATTERN_1_VERSION));
    vi.spyOn(pattern2,'evaluateEntryPattern2').mockReturnValue(check(M1_FVG_RETEST_PATTERN_VERSION));
    vi.spyOn(pivots,'buildM1PivotStructure').mockReturnValue({status:'ready',state:null});
    const result=evaluateM1Checklist(input);
    expect(result.patterns.map(c=>c.entryPattern)).toEqual(input.context.entryPatterns);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe(entry(ENTRY_PATTERN_1_VERSION).id);
    expect(result.entries[0].patternMatches.map(m=>m.entryPattern)).toEqual(input.context.entryPatterns);
  });
  it('keeps different execution prices separate within the same source',()=>{
    vi.spyOn(pattern1,'evaluateCountertrendEntryPattern1').mockReturnValue(check(ENTRY_PATTERN_1_VERSION));
    vi.spyOn(pattern2,'evaluateEntryPattern2').mockReturnValue({...check(M1_FVG_RETEST_PATTERN_VERSION),entry:entry(M1_FVG_RETEST_PATTERN_VERSION,1.299)});
    vi.spyOn(pivots,'buildM1PivotStructure').mockReturnValue({status:'ready',state:null});
    expect(evaluateM1Checklist(input).entries.map(e=>e.price)).toEqual([1.3,1.299]);
  });
  it('retains the original single-pattern contract for historical callers',()=>{
    const legacy=check(ENTRY_PATTERN_1_VERSION);
    vi.spyOn(pattern1,'evaluateCountertrendEntryPattern1').mockReturnValue(legacy);
    const second=vi.spyOn(pattern2,'evaluateEntryPattern2');
    expect(evaluateM1Checklist({...input,context:{...input.context,entryPatterns:undefined}})).toBe(legacy);
    expect(second).not.toHaveBeenCalled();
  });
  it('applies the same central time gate to every visible pattern entry',()=>{
    const patterns=[check(ENTRY_PATTERN_1_VERSION),check(M1_FVG_RETEST_PATTERN_VERSION)];
    const combined={...patterns[0],patterns,entryChecks:patterns,entries:patterns.map(c=>c.entry)};
    const gated=gateM1ChecklistEntries(combined,{instrument:'GBPUSD',tradingWindows:{weekday:[],saturday:[],sunday:[]},
      sessionConfigs:[],news:[],newsLoadStatus:'ready'});
    expect(gated.entry).toBeNull();
    expect(gated.entries).toEqual([]);
    expect(gated.patterns.every(c=>c.entry===null)).toBe(true);
    expect(gated.entryChecks).toEqual([]);
    expect(gated.patternCandidate.id).toBe(combined.entry.id);
    expect(gated.entryEligibility.status).toBe('blocked');
    expect(gated.patterns.every(c=>c.patternCandidate&&c.entryEligibility.status==='blocked')).toBe(true);
  });
});
