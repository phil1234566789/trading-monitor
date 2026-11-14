import {readFileSync} from 'node:fs';
import {detectTradeSetups,detectSetupObs} from '../../src/tradeSetup.js';
import {detectLiquidityLevels} from '../../src/liquidityDetection.js';
import {tradeSetupParameters} from '../../src/tradeSetupParameters.js';
import {markIgnoredCandles} from '../../src/sessionOccurrences.js';
import {berlinOffsetMinutes} from '../../src/berlinTime.js';
import {closedChecklistCandles} from '../../src/tradeSetupChecklistTimeBasis.js';

export const fixture=JSON.parse(readFileSync(new URL('../fixtures/ts11-native/context.json',import.meta.url),'utf8'));
export const nativeInput={instrument:'XAUUSD',m5Candles:fixture.candles.m5,h1Candles:fixture.candles.h1,d1Candles:fixture.candles.d1,
 settings:fixture.settings,sessionConfigs:fixture.sessionConfigs};
export const expectedFor=ref=>fixture.expectationOverrides?.find(o=>o.pin===ref.pin)?.expectedByUser??ref.expectedByUser;
export function nativeSetupsAt(evaluatedAt){
 const rows=markIgnoredCandles(closedChecklistCandles(nativeInput.m5Candles,'5m',evaluatedAt),fixture.sessionConfigs,s=>berlinOffsetMinutes(s*1000));
 const levels=detectLiquidityLevels(rows,5),obs=detectSetupObs(rows,0),params=tradeSetupParameters('XAUUSD',rows.at(-1).time);
 return [1,-1].flatMap(dir=>{const own=dir===1?levels.highs:levels.lows;
  return detectTradeSetups(dir,own,[],own,obs,params,rows.filter(c=>!c.ignored)).map(s=>({...s,instrument:'XAUUSD'}));});
}
export function nativeSetupFor(ref){
 const ob=Date.parse(ref.row.ob_start_time)/1000;
 return nativeSetupsAt(ob+600).find(s=>s.obStartTime===ob&&s.dir===(ref.row.direction==='short'?1:-1));
}
