import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {entryRiskScale} from './entryRisk.js';
import {candleTouchesPrice} from './structurePivotTime';

// Preisbeobachtung des Indikators: keine Lots, Teilverkäufe, Commission oder Handelsfreigabe.
export function evaluateDoubleOrderBlockOutcome({direction,entryTime,entryPrice,stopPrice,candles,evaluatedAt,instrument='XAUUSD'}) {
 const scale=entryRiskScale(entryPrice,stopPrice,[],instrument,direction);
 const targetPrice=scale.status==='ready'?entryPrice+(direction==='long'?1:-1)*2*scale.risk:null;
 const result={status:'open',recognizedAt:null,exitPrice:null,targetPrice,checkedThrough:entryTime,reason:null};
 if(scale.status!=='ready'||!Number.isFinite(entryTime)||!Number.isFinite(evaluatedAt)||entryTime>evaluatedAt)
  return {...result,status:'unknown',reason:'invalidRisk'};
 let next=entryTime;
 for(const candle of closedChecklistCandles(candles,'1m',evaluatedAt)){
  if(candle.time<entryTime)continue;
  if(candle.time!==next||candle.ignored||![candle.low,candle.high].every(Number.isFinite)||candle.low>candle.high)
   return {...result,status:'unknown',reason:'missingHistory',checkedThrough:next,unavailableAt:next+60};
  next=candle.time+60;
  const short=direction==='short',stop=candleTouchesPrice(candle,stopPrice,!short),target=candleTouchesPrice(candle,targetPrice,short);
  if(stop||target)return {...result,status:stop&&target?'ambiguous':stop?'loss':'success',
   recognizedAt:next,checkedThrough:next,exitPrice:stop&&target?null:stop?stopPrice:targetPrice,
   reason:stop&&target?'sameCandle':null};
 }
 return {...result,checkedThrough:next,...(next<Math.floor(evaluatedAt/60)*60?{status:'unknown',reason:'missingHistory',unavailableAt:next+60}:{})};
}
