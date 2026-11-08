import {describe,it,expect} from 'vitest';
import {m1EntryFromFvg} from '../src/m1Entry.js';
import {entryRiskScale} from '../src/entryRisk.js';
import {M1_FVG_RETEST_PATTERN_VERSION as version} from '../src/m1FvgRetestSequence.js';
import {entryAgainstM5Allowed,entrySizingAt} from '../src/tradeSetup2EntrySizing.js';

describe('Pattern 2 execution policy',()=>{
  const confirmedEntry=direction=>({direction,entryPattern:version,recognizedAt:360,conditions:{
    retest:{recognizedAt:60,orderBlock:{dir:direction==='long'?1:-1}},
    m1PivotBreak:{type:'pivot-break',direction,recognizedAt:120},
    retestedFvg:{direction,recognizedAt:180},fvgRetest:{candleTime:180,recognizedAt:240},
    fvg:{direction,recognizedAt:360}}});
  it.each(['long','short'])('uses full size without M5 BOS or CHoCH for %s',direction=>{
    const entry=confirmedEntry(direction),checklist={evaluatedAt:360,checks:{m5Trend:{structureReaction:{trend:direction==='long'?'downtrend':'uptrend'}}}};
    expect(entryAgainstM5Allowed(checklist,entry)).toBe(true);
    expect(entrySizingAt(checklist,entry)).toMatchObject({model:'relative-full-entry',entryCategory:'full',factor:1,positionSizeFactor:1,reason:'m1PatternConfirmed'});
    expect(entrySizingAt({...checklist,evaluatedAt:361},entry).factor).toBeNull();
    for(const key of ['m1PivotBreak','retest','retestedFvg','fvgRetest','fvg']){
      const incomplete=structuredClone(entry);delete incomplete.conditions[key];
      expect(entryAgainstM5Allowed(checklist,incomplete)).toBe(false);
      expect(entrySizingAt(checklist,incomplete).factor).toBeNull();
    }
    const future=structuredClone(entry);future.conditions.m1PivotBreak.recognizedAt=361;
    expect(entryAgainstM5Allowed(checklist,future)).toBe(false);
  });
  it.each(['long','short'])('uses the contacted OB and pattern-specific identity for %s',direction=>{
    const sign=direction==='long'?1:-1;
    const context={instrument:'XAUUSD',setupKey:'range',direction,entryPattern:version,
      primary:{reactionOB:{top:99,bottom:90},targetSelection:{status:'passed',selectedAt:0,target1:{price:100+sign*10}}}};
    const retest={candleTime:60,orderBlock:{startTime:0,top:102,bottom:98}};
    const rows=[{time:60,high:101,low:99},{time:120,high:101.5,low:98.5,close:100}];
    const entry=m1EntryFromFvg(context,{recognizedAt:180,candleTime:60},rows,180,retest);
    expect(entry.id).toBe(`XAUUSD:range:${version}:180`);
    expect(entry.label).toBe('Entry Pattern 2');
    expect(entry.stops.wide.price).toBe(direction==='long'?98:102);
    expect(entry.stops.narrow.price).toBe(direction==='long'?98.5:101.5);
  });
  it.each(['GBPUSD','EURUSD'])('clamps only the wide Forex stop for %s',instrument=>{
    for(const direction of ['long','short']){
      const sign=direction==='long'?1:-1;
      const wide=entryRiskScale(1.35,1.35-sign*.001,[],instrument,direction,{variant:'wide',entryPattern:version});
      expect(wide.riskPips).toBeCloseTo(6);
      expect(entryRiskScale(1.35,1.35-sign*.001,[],instrument,direction,{variant:'narrow',entryPattern:version}).riskPips).toBeCloseTo(10);
    }
  });
  it('preserves gold and legacy policy',()=>{
    expect(entryRiskScale(4332,4323,[],'XAUUSD','long',{variant:'wide',entryPattern:version}).stop).toBe(4323);
    expect(entryRiskScale(1.35,1.349,[],'GBPUSD','long',{variant:'wide'}).riskPips).toBeCloseTo(10);
  });
});
