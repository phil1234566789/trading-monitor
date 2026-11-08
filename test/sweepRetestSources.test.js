import {describe,it,expect} from 'vitest';
import fixture from './fixtures/xauusd-dr121-exploratory-short.json';
import {detectSweepRetestSources} from '../src/sweepRetestSources.js';
import {assembleSetupSources,setupSourceKey,setupSourceRecognitionTime} from '../src/setupSources.js';
const at=clock=>Date.parse(`2026-10-29T${clock}:00+01:00`)/1000;
const input={instrument:'XAUUSD',m5Candles:fixture.candles.m5,h1Candles:fixture.candles.h1,evaluatedAt:at('12:25')};
const reference=sources=>sources.find(s=>s.obStartTime===at('06:40')&&s.sweeps.some(sweep=>sweep.level.price===4037.84));
describe('additional causal sweep / existing M5 OB source',()=>{
  it('discovers the original DR121 geometry without a new post-sweep M5 OB or fake database ID',()=>{
    const source=reference(detectSweepRetestSources(input));
    expect(source).toMatchObject({obTop:4043.74,obBottom:4038.24,createdAt:at('12:10'),orderBlockKnownAt:at('06:50')});
    expect(source.tradeSetupId).toBeUndefined();
    expect(setupSourceKey(source)).toContain(':sweep-retest:');
    expect(setupSourceRecognitionTime(source)).toBe(at('12:10'));
  });
  it('does not know the contact before the native M5 candle closes',()=>{
    expect(reference(detectSweepRetestSources({...input,evaluatedAt:at('12:09')}))).toBeUndefined();
    expect(reference(detectSweepRetestSources({...input,evaluatedAt:at('12:10')}))).toBeDefined();
  });
  it('reconstructs past sources independently of future candles and returns stable identities',()=>{
    const source=reference(detectSweepRetestSources(input));
    const prefix={...input,m5Candles:input.m5Candles.filter(c=>c.time+300<=input.evaluatedAt),
      h1Candles:input.h1Candles.filter(c=>c.time+3600<=input.evaluatedAt)};
    expect(reference(detectSweepRetestSources(prefix))).toEqual(source);
    const {sourceFamilyKey,sourceFamilyVersion,...assembled}=reference(assembleSetupSources({...input,includeSweepRetestSources:true,tradeSetups:[source]}));
    expect(assembled).toEqual(source);expect(sourceFamilyKey).toBeTruthy();
    expect(assembleSetupSources({...input,includeSweepRetestSources:true,tradeSetups:[source]}).filter(s=>setupSourceKey(s)===setupSourceKey(source))).toHaveLength(1);
  });
  it('does not invent validity across missing OB history',()=>{
    expect(reference(detectSweepRetestSources({...input,m5Candles:input.m5Candles.filter(c=>c.time!==at('10:30'))}))).toBeUndefined();
  });
  it('mirrors native geometry as synthetic long data without changing the configured gap minimum',()=>{
    const mirror=rows=>rows.map(c=>({...c,open:9000-c.open,close:9000-c.close,high:9000-c.low,low:9000-c.high}));
    const sources=detectSweepRetestSources({...input,m5Candles:mirror(input.m5Candles),h1Candles:mirror(input.h1Candles)});
    const source=sources.find(s=>s.obStartTime===at('06:40')&&Math.abs(s.ls.price-(9000-4037.84))<1e-9);
    expect(source).toMatchObject({dir:-1,createdAt:at('12:10')});
    expect(source.obBottom).toBeCloseTo(9000-4043.74,8);
  });
  it('freezes every past source identically when later H1 candles and sweeps become available',()=>{
    const prefix=detectSweepRetestSources({...input,evaluatedAt:at('12:10')});
    const later=detectSweepRetestSources({...input,evaluatedAt:at('13:30')})
      .filter(source=>source.recognizedAt<=at('12:10'));
    expect(later).toEqual(prefix);
    expect(later.every(source=>source.sweeps.length<=3)).toBe(true);
    expect(new Set(later.map(setupSourceKey)).size).toBe(later.length);
  });
});
