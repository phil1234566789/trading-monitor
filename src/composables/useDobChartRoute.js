import {watch} from 'vue';

// Sprung aus /dob-statistik (dobChartLink): Instrument, DOB-Ebene an, Replay am Ausgang des Trades.
export function useDobChartRoute(query,{currentSymbol,currentBar,showDoubleOrderBlocks,replayTime,replayActive},symbols){
 watch(query,q=>{
  if(typeof q.dob!=='string'||!q.dob)return;
  if(symbols.includes(q.instrument))currentSymbol.value=q.instrument;
  currentBar.value=q.bar==='5m'?'5m':'1m';
  showDoubleOrderBlocks.value=true;
  const time=Number(q.replay);
  if(Number.isSafeInteger(time)&&time>0){replayTime.value=time;replayActive.value=true;}
 },{immediate:true});
}
