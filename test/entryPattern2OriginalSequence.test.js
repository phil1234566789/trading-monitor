import {describe,it,expect} from 'vitest';
import fixture from './fixtures/xauusd-dr121-exploratory-short.json';
import {detectSweepRetestSources} from '../src/sweepRetestSources.js';
import {M1_FVG_RETEST_PATTERN_VERSION} from '../src/m1FvgRetestSequence.js';
import {buildM1Structure} from '../src/m1Structure.js';
import {evaluateM1Checklist} from '../src/m1Checklist.js';
import {buildTradeSetup2Snapshot} from '../src/tradeSetup2Snapshot.js';
import {gateM1ChecklistEntries} from '../src/tradeSetup2EntryGate.js';
import {evaluateEntryPattern2} from '../src/entryPattern2.js';
import {entryAgainstM5Allowed} from '../src/tradeSetup2EntrySizing.js';
const at=clock=>Date.parse(`2026-10-29T${clock}:00+01:00`)/1000;
const source=detectSweepRetestSources({instrument:'XAUUSD',m5Candles:fixture.candles.m5,h1Candles:fixture.candles.h1,evaluatedAt:at('12:25')})
  .find(s=>s.obStartTime===at('06:40')&&s.sweeps.some(sweep=>sweep.level.price===4037.84));
const primary={direction:'short',sweep:{level:source.ls,timeframe:source.sweeps[0].timeframe},
  reactionOB:{dir:-1,top:source.obTop,bottom:source.obBottom,startTime:source.obStartTime,recognizedAt:source.orderBlockKnownAt},
  targetSelection:{status:'passed',selectedAt:at('12:10'),target1:{price:4023.05}}};
const context={instrument:'XAUUSD',direction:'short',setupKey:'original-native-engine-reference',
  entryPattern:M1_FVG_RETEST_PATTERN_VERSION,primary,anchor:{entryPattern:M1_FVG_RETEST_PATTERN_VERSION,primary},
  confirmedAt:at('12:10'),validatedAt:at('12:10')};
const evaluate=clock=>{
  const evaluatedAt=at(clock),rows=fixture.candles.m1;
  return evaluateM1Checklist({context,structure:buildM1Structure(rows,context.anchor,evaluatedAt),candles:rows,evaluatedAt});
};
describe('original native DR121 new pattern entry engine (common DR gates tested separately)',()=>{
  it('creates the separate 12:25 reference entry with full metadata, not the original journal times',()=>{
    const check=evaluate('12:25');
    expect(check.entry).toMatchObject({entryPattern:M1_FVG_RETEST_PATTERN_VERSION,recognizedAt:at('12:25'),price:4034.12,
      entryCategory:'full',positionSizeFactor:1,label:'Entry Pattern 2',stops:{wide:{price:4043.74},narrow:{price:4039.28}}});
    expect(check.entry.id).toContain(`${M1_FVG_RETEST_PATTERN_VERSION}:${at('12:25')}`);
    expect(check.conditions.orderBlockPlacement.status).toBe('passed');
    expect(check.conditions.orderBlockDepth).toMatchObject({status:'passed',maxRetestFraction:.5,checkedThrough:at('12:25')});
    expect(check.conditions.orderBlockDepth.maxPenetrationFraction).toBeCloseTo(.189090909,8);
  });
  it('blocks deeper later wicks without using the candle opening after confirmation',()=>{
    const reference=evaluate('12:25');
    const run=(rows,evaluatedAt=at('12:25'),customContext=context)=>evaluateEntryPattern2({context:customContext,rows,evaluatedAt,
      pivotBreak:reference.pivotBreak,structureStart:reference.structureStart});
    const rows=fixture.candles.m1.filter(c=>c.time+60<=at('12:25'));
    const deeper=run(rows.map(c=>c.time===at('12:15')?{...c,high:4042}:c));
    expect(deeper.entry).toBeNull();expect(deeper.conditions.orderBlockDepth.status).toBe('unmet');
    const future=run([...rows,{time:at('12:25'),open:4034,high:5000,low:4000,close:4035}],at('12:26'));
    expect(future.entry).toEqual(reference.entry);
    const noLevelKnown={...context,primary:{...context.primary,sweep:{...context.primary.sweep,
      level:{...context.primary.sweep.level,recognizedAt:undefined}}}};
    const unknown=run(rows,at('12:25'),noLevelKnown);
    expect(unknown.entry).toBeNull();expect(unknown.conditions.orderBlockPlacement.status).toBe('unknown');
    expect(unknown.entryBlockedReason).toContain('nicht vollständig bestimmbar');
  });
  it('keeps historical pre-rule conditions readable without granting a failed new proof',()=>{
    const entry=evaluate('12:25').entry;
    expect(entryAgainstM5Allowed({},entry)).toBe(true);
    const {orderBlockDepth,orderBlockPlacement,...legacy}=entry.conditions;
    expect(entryAgainstM5Allowed({},{...entry,conditions:legacy})).toBe(true);
    expect(entryAgainstM5Allowed({},{...entry,conditions:{...entry.conditions,orderBlockDepth:{...orderBlockDepth,status:'unknown'}}})).toBe(false);
    expect(entryAgainstM5Allowed({},{...entry,conditions:{...entry.conditions,orderBlockPlacement:undefined}})).toBe(false);
  });
  it('has no earlier entry and no altered journal fixture',()=>{
    for(const clock of ['12:18','12:20','12:24'])expect(evaluate(clock).entry).toBeNull();
    expect(fixture.journal.positions.map(p=>p.id)).toEqual(expect.arrayContaining([144,145]));
  });
  it('saves P2 structure evidence even when its original source supplied a P5-only display state',()=>{
    // Nur der Snapshotvertrag wird hier validiert; tatsächliche C/D-Gates bleiben separat geprüft.
    const checks={liquiditySweep:{status:'passed'},reaction:{status:'passed'},outerM5Trend:{status:'passed'},
      m5Trend:{status:'passed'},antiConfluences:{status:'clear',rules:[]},confluences:{status:'clear',rules:[]}};
    const primary={...context.primary,id:context.setupKey,setupType:'countertrend',checks,
      recognizedAt:at('12:10'),reactionRecognizedAt:at('12:10'),knownAsOf:at('12:25'),validity:{state:'active'}};
    const checklist={instrument:'XAUUSD',model:'countertrend',ruleVersion:'countertrend-abcdef-v2',
      status:'ready',evaluatedAt:at('12:25'),checks,setup:{primary}};
    const snapshot=buildTradeSetup2Snapshot({checklist,m1Check:evaluate('12:25'),m1Structure:{state:null},m1Candles:fixture.candles.m1});
    expect(snapshot.entry.sizing).toMatchObject({factor:1,reason:'m1PatternConfirmed'});
    expect(snapshot.evidence.some(e=>e.role==='structure'&&e.timeframe==='1m')).toBe(true);
    expect(snapshot.checklist.entryPattern).toBe(M1_FVG_RETEST_PATTERN_VERSION);
  });
  it('keeps the observed pattern separate from old blocked hours and permits the explicitly changed 07–18 window',()=>{
    const check=evaluate('12:25'),settings={instrument:'XAUUSD',sessionConfigs:[],news:[],newsLoadStatus:'ready'};
    const before=gateM1ChecklistEntries(check,{...settings,tradingWindows:{weekday:[[840,1080]],saturday:[],sunday:[]}});
    expect(before.entry).toBeNull();
    expect(before.patternCandidate.price).toBe(4034.12);
    expect(before.entryEligibility.status).toBe('blocked');
    const after=gateM1ChecklistEntries(check,{...settings,tradingWindows:{weekday:[[420,1080]],saturday:[],sunday:[]}});
    expect(after.entry.price).toBe(4034.12);
    expect(after.entry.entryEligibility.hours.status).toBe('passed');
  });
});
