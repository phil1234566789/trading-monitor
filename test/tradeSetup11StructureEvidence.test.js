import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {prepareTradeSetup11Context,tradeSetup11SourceTimes} from '../src/tradeSetup11Context.js';
import {tradeSetupFromRow} from '../src/tradeSetupRow.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/ts11-native/context.json',import.meta.url),'utf8'));
const input={instrument:'XAUUSD',m5Candles:fixture.candles.m5,h1Candles:fixture.candles.h1,d1Candles:fixture.candles.d1,
 settings:fixture.settings,sessionConfigs:fixture.sessionConfigs};
it('preserves every original source and unchanged native input hash without calling expectations detector results',()=>{
 expect(fixture.references.map(r=>r.pin)).toEqual([478,479,480,481,482,483,484,485,486,487,488,489]);
 expect(fixture.references.filter(r=>r.expectedByUser==='keep')).toHaveLength(7);
 expect(fixture.references.filter(r=>r.expectedByUser==='reject')).toHaveLength(4);
 expect(fixture.references.find(r=>r.pin===485).expectedByUser).toBe('preferKeep_edgeCase');
 for(const [bar,rows]of Object.entries(fixture.candles))expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe(fixture.hashes[bar]);
});
it('observes the native pin481 inner UP only once the necessary M5 close is known',()=>{
 const before=prepareTradeSetup11Context({...input,evaluatedAt:1791451199});
 const after=prepareTradeSetup11Context({...input,evaluatedAt:1791451200});
 expect(before.status).toBe('ready');expect(before.chain.map(r=>r.trend)).toEqual(['downtrend','uptrend','downtrend']);
 expect(after.chain.map(r=>r.trend)).toEqual(['downtrend','uptrend','downtrend','uptrend']);
 expect(after.anchor.knownAt).toBeLessThanOrEqual(after.evaluatedAt);
 expect(after.stateKnownAt).toBe(1791451200);
 expect(after).not.toHaveProperty('accepted');
});
it('never turns missing D1/H1 anchor history or a late M5 window into a ready trend',()=>{
 expect(prepareTradeSetup11Context({...input,d1Candles:[],evaluatedAt:1791451200}).status).toBe('unknown');
 expect(prepareTradeSetup11Context({...input,h1Candles:[],evaluatedAt:1791451200}).status).toBe('unknown');
 expect(prepareTradeSetup11Context({...input,m5Candles:input.m5Candles.filter(c=>c.time>=1791450000),evaluatedAt:1791451200}).status).toBe('unknown');
});
it('does not silently backdate the manual pin481 first-seen time to its historical OB',()=>{
 const row=fixture.references.find(r=>r.pin===481).row;
 const times=tradeSetup11SourceTimes(tradeSetupFromRow(row));
 expect(times.nativeGeometryKnownAt).toBe(1791453600);
 expect(times.storedFirstSeenAt).toBe(Date.parse(row.created_at)/1000);
 expect(times.sourceKnownAt).toBe(times.storedFirstSeenAt);
 expect(times.sourceKnownAt).toBeGreaterThan(times.nativeGeometryKnownAt+86400);
});
it('reports the actual last closed M5 watermark rather than the requested time when the tail is absent',()=>{
 const result=prepareTradeSetup11Context({...input,
  m5Candles:input.m5Candles.filter(c=>c.time!==1791450900),evaluatedAt:1791451200});
 expect(result.stateKnownAt).toBe(1791450900);
 expect(result.stateKnownAt).toBeLessThan(result.evaluatedAt);
});
