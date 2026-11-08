import { describe,it,expect } from 'vitest';
import original from './fixtures/xauusd-dr121-exploratory-short.json';
import reference from './fixtures/xauusd-dr121-entry-pattern2-reference.json';
import { evaluateM1FvgRetestSequence } from '../src/m1FvgRetestSequence.js';
import { buildM1PivotStructure } from '../src/m1PivotStructure.js';

const at=clock=>Date.parse(`2026-10-29T${clock}:00+01:00`)/1000;
const input={candles:original.candles.m1,direction:'short',
  structureKnownAt:at('12:18'),orderBlockRetestKnownAt:at('12:10'),evaluatedAt:at('12:25')};

describe('additional pattern causal M1 FVG retest sequence',()=>{
  it('uses existing P2 wick-break semantics only for the additional pattern',()=>{
    const primary={direction:'short',sweep:{timeframe:'5M',level:{price:4037.84,touchedTime:at('12:05')}}};
    expect(buildM1PivotStructure(input.candles,primary,at('12:17'),2).pivotBreak).toBeNull();
    expect(buildM1PivotStructure(input.candles,primary,at('12:18'),2).pivotBreak)
      .toMatchObject({price:4034.38,pivotTime:at('12:12'),candleTime:at('12:17'),recognizedAt:at('12:18')});
    expect(buildM1PivotStructure(input.candles,primary,at('12:25')).pivotBreak).toBeNull();
  });
  it('keeps the original DR121 annotations separate and confirms only at 12:25 Berlin',()=>{
    expect(reference.sourceM1Sha256).toBe(original.provenance.manifest.m1.sha256);
    const result=evaluateM1FvgRetestSequence(input);
    expect(result.zone).toMatchObject({candleTime:at('12:16'),recognizedAt:at('12:18'),bottom:4035.22,top:4035.93});
    expect(result.retest).toEqual({candleTime:at('12:19'),recognizedAt:at('12:20')});
    expect(result.confirmation).toMatchObject({candleTime:at('12:23'),recognizedAt:at('12:25')});
    expect(evaluateM1FvgRetestSequence({...input,evaluatedAt:at('12:24')} ).confirmation).toBeNull();
  });
  it('permits inclusive contact and wick overflow without importing OB invalidation',()=>{
    const candles=input.candles.map(c=>c.time===at('12:19')?{...c,high:4035.22}:c);
    expect(evaluateM1FvgRetestSequence({...input,candles}).retest?.candleTime).toBe(at('12:19'));
  });
  it('requires known structure after the M5 OB retest and never counts an already known FVG',()=>{
    expect(evaluateM1FvgRetestSequence({...input,structureKnownAt:null}).zone).toBeNull();
    expect(evaluateM1FvgRetestSequence({...input,orderBlockRetestKnownAt:at('12:19')}).zone).toBeNull();
    expect(evaluateM1FvgRetestSequence({...input,evaluatedAt:at('12:20')}).confirmation).toBeNull();
  });
  it('mirrors the same sequence for synthetic long candles',()=>{
    const candles=input.candles.map(c=>({...c,open:9000-c.open,close:9000-c.close,high:9000-c.low,low:9000-c.high}));
    const result=evaluateM1FvgRetestSequence({...input,candles,direction:'long'});
    expect(result.retest?.recognizedAt).toBe(at('12:20'));
    expect(result.confirmation?.recognizedAt).toBe(at('12:25'));
  });
  it('returns unknown for a missing minute instead of bridging an unobserved retest',()=>{
    const result=evaluateM1FvgRetestSequence({...input,candles:input.candles.filter(c=>c.time!==at('12:19'))});
    expect(result.status).toBe('unknown');
    expect(result.confirmation).toBeNull();
  });
  it('is identical with future candles removed and ignores future mutation',()=>{
    const prefix=input.candles.filter(c=>c.time+60<=input.evaluatedAt);
    expect(evaluateM1FvgRetestSequence({...input,candles:prefix})).toEqual(evaluateM1FvgRetestSequence(input));
    const candles=input.candles.map(c=>c.time>=input.evaluatedAt?{...c,high:9999,low:0}:c);
    expect(evaluateM1FvgRetestSequence({...input,candles})).toEqual(evaluateM1FvgRetestSequence(input));
  });
});
