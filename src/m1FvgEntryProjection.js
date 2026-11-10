import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {m1FvgEntryCandidates} from './m1FvgEntrySelection.js';
import {m1FvgEntrySequence,advanceM1FvgEntrySequence,m1FvgSequenceResult} from './m1FvgEntrySequence.js';

const FIELDS=['time','open','high','low','close','ignored'];
function sameRows(a,b) {
  return a.length===b.length && a.every((row,i)=>FIELDS.every(key=>row[key]===b[i][key]));
}
function project(rows,candidates,variant) {
  const states=candidates.map(fvg=>m1FvgEntrySequence(fvg,variant));
  let active=[],next=0,stateVisits=0;
  if(variant==='retestReaction')for(const candle of rows){
    while(next<states.length && states[next].fvg.recognizedAt<=candle.time)active.push(states[next++]);
    active=active.filter(state=>{
      stateVisits++;
      advanceM1FvgEntrySequence(state,candle);
      return !state.result;
    });
  }
  const results=new Map(states.map(state=>[state.fvg.candleTime,m1FvgSequenceResult(state)]));
  const confirmationResults=new Map();
  // Mehrere FVGs derselben Bestätigung liefern denselben Entry; der früheste Ursprung bleibt der Beleg.
  for(const result of results.values())if(result.status==='ready'&&!confirmationResults.has(result.confirmationCandleTime))
    confirmationResults.set(result.confirmationCandleTime,result);
  return {candidates,results,confirmationResults,confirmations:[...new Set([...results.values()]
    .filter(result=>result.status==='ready').map(result=>result.confirmationCandleTime))],stateVisits};
}

// Chart-Farbwechsel, Hover und FVG-Auswahl dürfen nicht dieselben Retest-Sequenzen erneut auswerten.
export function createM1FvgEntryProjection() {
  let saved=[],savedDirection,candidates=[],variants=new Map();
  return ({candles,evaluatedAt,direction,variant})=>{
    const rows=closedChecklistCandles(candles,'1m',evaluatedAt);
    if(direction!==savedDirection || !sameRows(rows,saved)){
      saved=rows.map(row=>({...row}));savedDirection=direction;
      candidates=m1FvgEntryCandidates(rows,evaluatedAt,direction);
      variants.clear();
    }
    if(!variants.has(variant))variants.set(variant,project(rows,candidates,variant));
    return variants.get(variant);
  };
}
