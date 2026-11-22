import {expect,it} from 'vitest';
import * as frontend from '../src/tradeSetupSweepSources.js';
import * as backend from '../supabase/functions/_shared/tradeSetupSweepSources.ts';
import {detectTradeSetup as backendDetect} from '../supabase/functions/_shared/tradeSetup.ts';
import {detectSetupObs,detectTradeSetups,TRADE_SETUP_OB_SWEEP_PROFILE} from '../src/tradeSetup.js';
import {detectLiquidityLevels,detectOrderBlockLiquidityLevels} from '../src/liquidityDetection.js';
import {detectOrderBlockLiquidityLevels as backendObLevels} from '../supabase/functions/_shared/liquidityDetection.ts';
import {tradeSetupParameters} from '../src/tradeSetupParameters.js';
import {readFileSync} from 'node:fs';
it.each([1,-1])('keeps typed source and strict lifecycle identical across runtimes dir %s',dir=>{
 const ob={dir:-dir,top:100,bottom:98,startTime:300};
 const candles=[300,600,900,1200,1500].map(time=>({time,open:99,close:99,high:time===1500?103:101,low:time===1500?95:97}));
 const sources=detectOrderBlockLiquidityLevels([ob],candles,dir,1800);
 expect(backendObLevels([ob],candles,dir,1800)).toEqual(sources);
 for(const at of [1199,1200,1500,1800])
  expect(backend.evaluateSweepConfirmation(sources[0],candles,at)).toEqual(frontend.evaluateSweepConfirmation(sources[0],candles,at));
});
it('keeps native opt-in primary confirmations and legacy defaults in both detectors',()=>{
 const rows=JSON.parse(readFileSync(new URL('./fixtures/ls-reaction-ob-sweeps/M5.json',import.meta.url))).filter(c=>c.time+300<=1793889900);
 const obs=detectSetupObs(rows,0),own=detectLiquidityLevels(rows,5).highs;
 const first=own.find(l=>l.price===4124.86);
 for(const at of [1793889299,1793889300,1793889900])
  expect(backend.evaluateSweepConfirmation(first,rows,at,'5M',own)).toEqual(frontend.evaluateSweepConfirmation(first,rows,at,'5M',own));
 const params=tradeSetupParameters('XAUUSD',rows.at(-1).time);
 for(const profile of [undefined,TRADE_SETUP_OB_SWEEP_PROFILE]){
  const p={...params,sweepSourceProfile:profile};
  const front=detectTradeSetups(1,own,[],own,obs,p,rows).find(s=>s.obStartTime===1793889300);
  const back=backendDetect(1,own,[],own,obs,p,rows);
  expect(back?.ls).toEqual(front.ls);expect(back?.sweeps).toEqual(front.sweeps);
  expect(back?.confirmationSources).toEqual(front.confirmationSources);
  expect(back?.confirmationHistory).toEqual(front.confirmationHistory);
 }
});
