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
  currentBar.value=q.bar==='1m'?'1m':'5m';
  showDoubleOrderBlocks.value=true;
  const time=Number(q.replay);
  if(Number.isSafeInteger(time)&&time>0){replayTime.value=time;replayActive.value=true;}
  const {data,error}=await supabase.from('dob_trade_setups').select('*').eq('id',id).maybeSingle();
  if(current!==ticket||error||!data)return;
  // LQ-Sweep-POI: das LS-Reaktion-Setup dazu (LS-Level, Sweep, OB-Box) statt des POI-Kastens; fehlt es, bleibt der Trade ohne POI-Bild.
  const tsId=data.poi_kind==='ts11'?data.features?.poi_trade_setup_id:null;
  const ts=tsId==null?null:(await supabase.from('trade_setups').select('id,direction,ob_top,ob_bottom,ob_start_time,ls_price,ls_pivot_time,ls_touched_time').eq('id',tsId).maybeSingle()).data;
  if(current===ticket)dobTrade.value=ts?{...data,lsReaction:ts}:data;
 },{immediate:true});
 return dobTrade;
}
