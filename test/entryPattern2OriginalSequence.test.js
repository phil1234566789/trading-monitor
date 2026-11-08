import {describe,it,expect} from 'vitest';
import fixture from './fixtures/xauusd-dr121-exploratory-short.json';
import {detectSweepRetestSources} from '../src/sweepRetestSources.js';
import {M1_FVG_RETEST_PATTERN_VERSION} from '../src/m1FvgRetestSequence.js';
import {buildM1Structure} from '../src/m1Structure.js';
import {evaluateM1Checklist} from '../src/m1Checklist.js';
import {buildTradeSetup2Snapshot} from '../src/tradeSetup2Snapshot.js';
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
});
