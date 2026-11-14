import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {detectSetupObs,detectTradeSetups,TRADE_SETUP_OB_SWEEP_PROFILE} from '../src/tradeSetup.js';
import {detectLiquidityLevels} from '../src/liquidityDetection.js';
import {tradeSetupParameters} from '../src/tradeSetupParameters.js';
import {filterTradeSetup11Candidates} from '../src/tradeSetup11.js';
import {fixture,nativeInput,expectedFor} from './helpers/tradeSetup11NativeFixture.js';
import {markIgnoredCandles} from '../src/sessionOccurrences.js';
import {berlinOffsetMinutes} from '../src/berlinTime.js';
import {evaluateSweepConfirmation} from '../src/tradeSetupSweepSources.js';
import {captureTradeSetupSourceSnapshot,restoreTradeSetupSourceSnapshot} from '../supabase/functions/_shared/tradeSetupSourceSnapshot.js';
const native=JSON.parse(readFileSync(new URL('./fixtures/ts11-ob-sweeps/M5.json',import.meta.url)));
const at=1793889900,obTime=1793889300;
it.each(fixture.references)('preserves original native TS11 expectation for pin $pin under the NEW source profile',async ref=>{
 const at=Date.parse(ref.row.ob_start_time)/1000+600;
 const rows=markIgnoredCandles(nativeInput.m5Candles.filter(c=>c.time+300<=at),fixture.sessionConfigs,s=>berlinOffsetMinutes(s*1000));
 const levels=detectLiquidityLevels(rows,5),dir=ref.row.direction==='short'?1:-1,own=dir===1?levels.highs:levels.lows;
 const setup=detectTradeSetups(dir,own,[],own,detectSetupObs(rows,0),
  {...tradeSetupParameters('XAUUSD',rows.at(-1).time),sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE},rows.filter(c=>!c.ignored),rows)
  .find(s=>s.obStartTime===at-600);
 expect(setup).toBeDefined();expect(setup.sweepSourceProfile).toBe(TRADE_SETUP_OB_SWEEP_PROFILE);
 expect([setup.obTop,setup.obBottom]).toEqual([ref.row.ob_top,ref.row.ob_bottom]);
 const result=filterTradeSetup11Candidates({...nativeInput,setups:[setup],evaluatedAt:at});
 expect(result.assessments[0].status).toBe(expectedFor(ref)==='reject'?'unmet':'passed');
 expect(filterTradeSetup11Candidates({...nativeInput,setups:[setup],evaluatedAt:at-1}).counts.unknown).toBe(1);
 const prefix=filterTradeSetup11Candidates({...nativeInput,setups:[setup],evaluatedAt:at,
  m5Candles:nativeInput.m5Candles.filter(c=>c.time+300<=at),h1Candles:nativeInput.h1Candles.filter(c=>c.time+3600<=at),
  d1Candles:nativeInput.d1Candles.filter(c=>c.time+86400<=at)});
 expect(prefix.assessments).toEqual(result.assessments);
 if(expectedFor(ref)!=='reject'){
  const snapshot=await captureTradeSetupSourceSnapshot({setup:result.setups[0],instrument:'XAUUSD',sourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE,
   configuration:{params:{sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE},settings:nativeInput.settings},canonicalSetupKnownAt:at,evaluationAsOf:at});
  const restored=restoreTradeSetupSourceSnapshot(JSON.parse(JSON.stringify(snapshot)));
  expect(restored.ls).toEqual(result.setups[0].ls);expect(restored.trendEvidence.goWitness).toEqual(result.setups[0].trendEvidence.goWitness);
  expect(restored.confirmationHistory).toEqual(result.setups[0].confirmationHistory);
 }
 if(ref.pin===485)expect(result.assessments[0].trendEvidence.goWitness.level.price).toBe(4179.51);
});
it('preserves native source hashes and original pins without claiming a frozen TS snapshot',()=>{
 const meta=JSON.parse(readFileSync(new URL('./fixtures/ts11-ob-sweeps/provenance.json',import.meta.url)));
 expect(createHash('sha256').update(readFileSync(new URL('./fixtures/ts11-ob-sweeps/M5.json',import.meta.url))).digest('hex')).toBe(meta.fixtureSha256);
 const pins=JSON.parse(readFileSync(new URL('./fixtures/ts11-ob-sweeps/pins.json',import.meta.url)));
 expect(pins.map(p=>p.id)).toEqual(meta.pins);expect(pins.every(p=>p.kind==='ob_zone')).toBe(true);
});
it('uses the older native OB edge instead of the expired 4124.86 first sweep (494–496)',()=>{
 const rows=native.filter(c=>c.time+300<=at),obs=detectSetupObs(rows,0),ls=detectLiquidityLevels(rows,5);
 expect(obs).toContainEqual(expect.objectContaining({startTime:1793880000,top:4135.61,bottom:4133.04,dir:-1}));
 expect(obs).toContainEqual(expect.objectContaining({startTime:1793881200,top:4131.68,bottom:4127.49,dir:-1}));
 const setup=detectTradeSetups(1,ls.highs,[],ls.highs,obs,{...tradeSetupParameters('XAUUSD',at),sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE},rows).find(s=>s.obStartTime===obTime);
 expect(setup).toBeDefined();
 expect(setup.ls).toMatchObject({sourceKind:'orderBlock',sourceStartTime:1793880000,price:4135.61,touchedTime:1793889000});
 expect(setup.sweeps.map(s=>s.level.price)).not.toContain(4124.86);
 expect(setup.sweeps.map(s=>s.level.price)).toContain(4131.68);
 expect(setup.confirmationHistory.find(s=>s.level.price===4124.86)).toMatchObject({status:'superseded',validUntil:1793889300,
  supersededBy:{level:{price:4129.63},knownAt:1793888700}});
 expect([setup.obTop,setup.obBottom]).toEqual([4135.88,4121.43]);
 const legacy=detectTradeSetups(1,ls.highs,[],ls.highs,obs,tradeSetupParameters('XAUUSD',at),rows).find(s=>s.obStartTime===obTime);
 expect(legacy.ls.price).toBe(4124.86);expect(legacy).not.toHaveProperty('sweepSourceProfile');
 expect([setup.obTop,setup.obBottom]).toEqual([legacy.obTop,legacy.obBottom]);
 const first=ls.highs.find(l=>l.price===4124.86),next=ls.highs.find(l=>l.price===4129.63);
 expect(evaluateSweepConfirmation(first,rows,1793889299,'5M',ls.highs)).toMatchObject({status:'valid',validUntil:null});
 expect(evaluateSweepConfirmation(first,rows,1793889300,'5M',ls.highs)).toMatchObject({status:'superseded',validUntil:1793889300,
  supersededBy:{level:next,knownAt:1793888700}});
});
