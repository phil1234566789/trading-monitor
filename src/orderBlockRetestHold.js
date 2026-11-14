import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {candleInvalidatesOrderBlock} from './orderBlockDetection.js';

// Ein später gehaltener M5-Rand repariert kein bereits gesweeptes erstes Retestextrem.
export function orderBlockRetestHoldHistory({candles,direction,anchorPrice,fromTime,evaluatedAt}) {
 const history={fromTime,throughTime:fromTime,firstSweepTime:null,unavailableAt:null,reason:null};
 if(!['long','short'].includes(direction)||!Number.isFinite(anchorPrice)||!Number.isSafeInteger(fromTime)
  ||fromTime%60!==0||!Number.isFinite(evaluatedAt)||evaluatedAt<fromTime)
  return {...history,unavailableAt:fromTime,reason:'invalidInput'};
 const through=Math.floor(evaluatedAt/60)*60;
 const boundary={dir:direction==='long'?1:-1,top:anchorPrice,bottom:anchorPrice};
 for(const candle of closedChecklistCandles(candles,'1m',through)) {
  if(candle.time<fromTime)continue;
  if(candle.time!==history.throughTime||candle.ignored||![candle.low,candle.high].every(Number.isFinite)||candle.low>candle.high)
   return {...history,unavailableAt:history.throughTime+60,reason:'missingHistory'};
  history.throughTime=candle.time+60;
  if(candleInvalidatesOrderBlock(candle,boundary))return {...history,firstSweepTime:candle.time};
 }
 if(history.throughTime<through)return {...history,unavailableAt:history.throughTime+60,reason:'missingHistory'};
 return history;
}

export function orderBlockRetestHoldAt(history,evaluatedAt) {
 const through=Math.floor(evaluatedAt/60)*60;
 const base={checkedFrom:history.fromTime,checkedThrough:through,firstSweepTime:null};
 if(!Number.isFinite(through)||through<history.fromTime||history.reason==='invalidInput')
  return {...base,status:'unknown',reason:'invalidInput'};
 if(history.firstSweepTime!==null&&history.firstSweepTime+60<=through)
  return {...base,status:'failed',reason:'retestExtremeSwept',firstSweepTime:history.firstSweepTime,firstSweepKnownAt:history.firstSweepTime+60};
 if((history.unavailableAt!==null&&history.unavailableAt<=through)||history.throughTime<through)
  return {...base,status:'unknown',reason:history.reason??'missingHistory'};
 return {...base,status:'passed',reason:null};
}
