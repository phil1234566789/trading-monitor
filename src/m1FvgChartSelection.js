import {closedReplayEvaluationTime} from './tradeSetupChecklistTimeBasis.js';
import {matchM1FvgEntryCandidate} from './m1FvgEntrySelection.js';
import {createM1FvgEntryProjection} from './m1FvgEntryProjection.js';
import {tintM1FvgCandidates,tintManualFvgConfirmations} from './fvgCandleTint.js';

export function createM1FvgChartSelection(read) {
  const project=createM1FvgEntryProjection();
  function context() {
    const input=read();
    if(input.bar!=='1m'||!input.selection)return null;
    const evaluatedAt=closedReplayEvaluationTime(input.replayUntil,input.nowSec,input.candles,'1m');
    return {...input,evaluatedAt,...project({...input,evaluatedAt,direction:input.selection.direction,variant:input.selection.variant})};
  }
  return {
    paint(candles,color,confirmationColor){
      const c=context();
      return c?tintManualFvgConfirmations(tintM1FvgCandidates(candles,c.candidates,'1m',color),c.confirmations,'1m',confirmationColor):candles;
    },
    select(time,price){
      const c=context();
      if(!c)return null;
      const candle=c.candles.find(row=>row.time===time);
      if(!candle||!Number.isFinite(price)||price<candle.low||price>candle.high)return null;
      const confirmation=c.confirmationResults.get(time);
      if(confirmation)return {...confirmation,target:{...c.selection}};
      const fvg=matchM1FvgEntryCandidate(c.candidates,c.candles,time,price);
      if(!fvg)return null;
      return {...c.results.get(fvg.candleTime),target:{...c.selection}};
    },
  };
}
