import {expect,it} from 'vitest';
import {filterTradeSetup11Candidates} from '../src/tradeSetup11.js';
import {TRADE_SETUP_OB_SWEEP_PROFILE} from '../src/tradeSetup.js';
import {fixture,nativeInput,nativeSetupFor} from './helpers/tradeSetup11NativeFixture.js';
import {captureTradeSetupSourceSnapshot,restoreTradeSetupSourceSnapshot,restoreTradeSetupSourceReferences} from '../supabase/functions/_shared/tradeSetupSourceSnapshot.js';

it.each([480,485])('reconstructs a complete native evaluation projection for DB-only legacy pin %s before capture',async pin=>{
 const raw=nativeSetupFor(fixture.references.find(r=>r.pin===pin)),at=raw.obStartTime+600;
 const legacy={...raw,fromDb:true,createdAt:at,detectorVersion:'historical-legacy-v3',sweepSourceProfile:'historical-legacy'};
 const before=JSON.stringify(legacy);
 const result=filterTradeSetup11Candidates({...nativeInput,setups:[legacy],sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE,evaluatedAt:at});
 expect(result.counts.passed).toBe(1);
 const evaluated=result.assessments[0].evaluatedSetupProjection;
 expect(evaluated?.sweepSourceProfile).toBe(TRADE_SETUP_OB_SWEEP_PROFILE);
 expect(evaluated.confirmationSources.length).toBeGreaterThan(0);expect(evaluated.confirmationHistory.length).toBeGreaterThan(0);
 expect(restoreTradeSetupSourceReferences(evaluated).ls).toEqual(evaluated.ls);
 expect(result.setups[0].sweepSourceProfile).toBe('historical-legacy');expect(JSON.stringify(legacy)).toBe(before);
 const payload=await captureTradeSetupSourceSnapshot({setup:{...evaluated,trendEvaluationVersion:result.version,trendEvidence:result.assessments[0].trendEvidence},instrument:'XAUUSD',
  sourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE,configuration:{params:{sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE}},canonicalSetupKnownAt:at,evaluationAsOf:at});
 const restored=restoreTradeSetupSourceSnapshot(payload);
 expect(restored.confirmationSources).toEqual(evaluated.confirmationSources);
 expect(restored.historicalSourceProvenance.detectorVersion).toBe('historical-legacy-v3');
});
it('cannot turn missing native legacy history into a passing capturable projection',()=>{
 const raw=nativeSetupFor(fixture.references.find(r=>r.pin===480)),at=raw.obStartTime+600;
 const result=filterTradeSetup11Candidates({...nativeInput,m5Candles:nativeInput.m5Candles.filter(c=>c.time>=raw.obStartTime-300),
  setups:[{...raw,fromDb:true,createdAt:at}],sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE,evaluatedAt:at});
 expect(result.counts.unknown).toBe(1);expect(result.setups).toEqual([]);
 expect(result.assessments[0].evaluatedSetupProjection).toBeUndefined();
});
