import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {candleTouchesOrderBlock} from './orderBlockDetection.js';
import {candleTimeIndex} from './candleTimeIndex.js';
import {closedCandleEnd} from './closedCandlePrefix.js';

export const SWEEP_RETEST_INVALIDATION_VERSION='first-m1-ob-retest-extreme-break-v1';

// Ein späteres tieferes/höheres Tief/Hoch darf den ersten Retest nicht still ersetzen.
export function evaluateSweepRetestInvalidation({candidate,m1Candles=[],evaluatedAt,progress,dataRevision}){
 candidate=candidate?.ideaBinding?.retestSource??candidate;
 const base={version:SWEEP_RETEST_INVALIDATION_VERSION,status:'notApplicable'};
 if(candidate?.sourceKind!=='liquidity-sweep-existing-m5-ob-retest-v1')return base;
 const sourceRetest=candidate.sourceRetest,ob=candidate.reactionOB;
 const unknown={...base,status:'unknown',reason:'missingRetestHistory'};
 if(!Number.isFinite(evaluatedAt)||!Number.isFinite(sourceRetest?.candleTime)||!ob
  ||!['long','short'].includes(candidate.direction))return unknown;
 const key=JSON.stringify([candidate.direction,sourceRetest,ob,dataRevision]);
 // Nur Scanner-Archive mit expliziter Revision sind inkrementell; Korrektur/Replay startet neu.
 const incremental=!!progress&&Number.isFinite(dataRevision);
 const previous=incremental&&progress.retest?.result.status!=='unknown'&&progress.retest?.key===key&&progress.retest.at<=evaluatedAt?progress.retest:null;
 if(previous?.result.status==='invalidated')return previous.result;
 let next=previous?.next??sourceRetest.candleTime,anchor=previous?.anchor??null,gap=previous?.gap??false;
 const end=incremental?closedCandleEnd(m1Candles,60,evaluatedAt):null;
 const rows=incremental?m1Candles.slice(candleTimeIndex(m1Candles,next),end)
  :closedChecklistCandles(m1Candles,'1m',evaluatedAt).filter(c=>c.time>=sourceRetest.candleTime);
 const save=result=>{if(incremental)progress.retest={key,at:evaluatedAt,next,anchor,gap,result};return result;};
 for(const candle of rows){
  if(progress)progress.retestProcessed=(progress.retestProcessed??0)+1;
  if(candle.time!==next)gap=true;
  next=candle.time+60;
  if(candle.ignored||![candle.high,candle.low].every(Number.isFinite)){gap=true;continue;}
  if(!anchor){
   if(gap||candle.time>=sourceRetest.recognizedAt)return save(unknown);
   if(candleTouchesOrderBlock(candle,ob))anchor=candle;
   continue;
  }
  const price=candidate.direction==='long'?anchor.low:anchor.high;
  const broken=candidate.direction==='long'?candle.low<price:candle.high>price;
  if(broken)return save({...base,status:'invalidated',reason:'retestExtremeBroken',retestTime:anchor.time,
   retestKnownAt:anchor.time+60,price,breachTime:candle.time,recognizedAt:candle.time+60});
 }
 if(!anchor||gap||next<Math.floor(evaluatedAt/60)*60)return save(unknown);
 return save({...base,status:'active',retestTime:anchor.time,retestKnownAt:anchor.time+60,
  price:candidate.direction==='long'?anchor.low:anchor.high,checkedThrough:evaluatedAt});
}
