import {shallowRef,watch} from 'vue';
import {supabase} from '../supabaseClient.js';

// Sprung aus /dob-statistik (dobChartLink): Instrument, DOB-Ebene an, Replay am Ausgang und der Trade selbst
// (dob_trade_setups-Zeile) für Position und R-Skala. ?dob= ist die Zeilen-ID (Lauf + Setup), damit der Trade eindeutig ist.
export function useDobChartRoute(query,{currentSymbol,currentBar,showDoubleOrderBlocks,replayTime,replayActive},symbols){
 const dobTrade=shallowRef(null);
 let ticket=0;
 watch(query,async q=>{
  const id=typeof q.dob==='string'&&q.dob?q.dob:null;
  if(id===dobTrade.value?.id)return;
  const current=++ticket;
  dobTrade.value=null;
  if(!id)return;
  if(symbols.includes(q.instrument))currentSymbol.value=q.instrument;
  currentBar.value=q.bar==='5m'?'5m':'1m';
  showDoubleOrderBlocks.value=true;
  const time=Number(q.replay);
  if(Number.isSafeInteger(time)&&time>0){replayTime.value=time;replayActive.value=true;}
  const {data,error}=await supabase.from('dob_trade_setups').select('*').eq('id',id).maybeSingle();
  if(current===ticket&&!error)dobTrade.value=data;
 },{immediate:true});
 return dobTrade;
}
