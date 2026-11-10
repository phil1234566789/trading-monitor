import {closedReplayEvaluationTime} from './tradeSetupChecklistTimeBasis.js';
import {m1FvgEntryCandidates,m1FvgEntryPrefill,matchM1FvgEntryCandidate} from './m1FvgEntrySelection.js';
import {tintM1FvgCandidates} from './fvgCandleTint.js';

export function createM1FvgChartSelection(read) {
  function context() {
    const input=read();
    if(input.bar!=='1m'||!input.selection)return null;
    const evaluatedAt=closedReplayEvaluationTime(input.replayUntil,input.nowSec,input.candles,'1m');
    return {...input,evaluatedAt,candidates:m1FvgEntryCandidates(input.candles,evaluatedAt,input.selection.direction)};
  }
  return {
    paint(candles,color){const c=context();return c?tintM1FvgCandidates(candles,c.candidates,'1m',color):candles;},
    select(time,price){
      const c=context();
      if(!c)return null;
      const fvg=matchM1FvgEntryCandidate(c.candidates,c.candles,time,price);
      if(!fvg)return null;
      return {...m1FvgEntryPrefill({...c,fvg,variant:c.selection.variant}),target:{...c.selection}};
    },
  };
}
