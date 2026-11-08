import {describe,it,expect} from 'vitest';
import {minuteAlarmEvents,rememberStructure,structureTrackingKey} from '../services/setup2/events.js';
import {M1_FVG_RETEST_PATTERN_VERSION as version} from '../src/m1FvgRetestSequence.js';
const at=Date.parse('2026-10-29T12:00:00+01:00')/1000;
const windows={weekday:[[0,1440]],saturday:[],sunday:[]};
const context={instrument:'GBPUSD',direction:'short',setupKey:'separate-pattern-source',confirmedAt:at-600,validatedAt:at-600};
const conditions={retest:{recognizedAt:at-180,orderBlock:{dir:-1,startTime:at-1200}},
  m1PivotBreak:{direction:'short',type:'pivot-break',recognizedAt:at-120},
  retestedFvg:{direction:'short',recognizedAt:at-120},fvgRetest:{candleTime:at-60,recognizedAt:at},
  fvg:{direction:'short',recognizedAt:at+60}};
const minute=knownAt=>({context,check:{conditions,entryPattern:version},knownAt});
describe('Pattern 2 independent alarm and execution contracts',()=>{
  it('uses independent first structure readiness and stable restart tracking per pattern',()=>{
    const state=new Map([[context.setupKey,at-300]]);
    expect(rememberStructure(minute(at-120),state)).toBe(at-120);
    expect(state.get(context.setupKey)).toBe(at-300);
    expect(state.get(structureTrackingKey(minute(at)))).toBe(at-120);
    expect(rememberStructure(minute(at),new Map(state))).toBe(at-120);
  });
  it('emits P2 structure then FVG retest warnings without requiring M5 BOS',()=>{
    expect(minuteAlarmEvents(minute(at-120),windows).map(e=>e.stage)).toEqual([1]);
    expect(minuteAlarmEvents(minute(at),windows).map(e=>e.stage)).toEqual([2]);
    expect(minuteAlarmEvents(minute(at+30),windows)).toEqual([]);
  });
  it('keeps executable Forex notifications separate from unsupported Gold lots',()=>{
    const entry={id:'p2-reference',instrument:'GBPUSD',entryPattern:version,direction:'short',recognizedAt:at+60,
      price:1.3,stops:{wide:{price:1.301},narrow:{price:1.3004}},conditions,entryCategory:'full',optionalConditionsMissing:[],positionSizeFactor:1};
    expect(minuteAlarmEvents({...minute(at+60),snapshot:{entry}},windows).map(e=>e.stage)).toEqual([3]);
    const gold={...entry,instrument:'XAUUSD',price:4034.12,stops:{wide:{price:4043.74},narrow:{price:4039.28}}};
    expect(minuteAlarmEvents({...minute(at+60),context:{...context,instrument:'XAUUSD'},snapshot:{entry:gold}},windows)).toEqual([]);
  });
});
