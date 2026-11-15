import {computed,ref,watch} from 'vue';
import {journalTpContext,journalTpPrefill} from '../journalTpSelection.js';
import {formatDatedTime} from '../berlinTime.js';
import {fmtPrice,pricePrecisionForInstrument} from '../format.js';

export function useJournalTpFinder({modal,bar,symbol,editing,replay,armed,arm,disarm}) {
 const message=ref(''),choices=ref([]),pending=ref(null);
 const selection=computed(()=>armed.value?.key==='journalTp'?armed.value.payload:null);
 let token=0;
 const current=()=>selection.value?modal.value?.resolveExecutionTarget(selection.value.cardKey):null;
 function clear(){pending.value=null;choices.value=[];message.value='';if(selection.value)disarm();}
 function request({cardKey}){
  const trade=modal.value?.resolveExecutionTarget(cardKey);
  if(bar.value!=='1m'||!trade||symbol.value!==trade.instrument||editing.value?.dealingRangeId!==trade.dealingRangeId)return;
  if(!Number.isFinite(trade.entryPrice)||trade.entryPrice<=0||!Number.isFinite(trade.entryTime)){
   message.value='Zuerst Entry-Preis und Entry-Zeit in dieser Ausführung angeben.';return;
  }
  pending.value=null;choices.value=[];message.value='Pinke Trefferkerze anklicken. Gesucht wird in den geladenen, geschlossenen M1-Kerzen ab Entry.';
  arm('journalTp',{...trade,targets:trade.targets?.map(target=>({...target})),draftToken:++token});
 }
 function choose(key){
  const result=pending.value;
  if(bar.value!=='1m'||editing.value?.dealingRangeId!==selection.value?.dealingRangeId){clear();return;}
  const prefill=journalTpPrefill(result,key,selection.value,current(),symbol.value);
  if(!prefill){clear();return;}
  if(!modal.value?.applyExecutionPrefill(prefill,selection.value.cardKey)){clear();return;}
  const line=result.lines.find(line=>line.key===key);
  pending.value=null;choices.value=[];disarm();
  message.value=`${line.label} · ${fmtPrice(prefill.exitPrice,pricePrecisionForInstrument(symbol.value))} · Trefferminute ${formatDatedTime(prefill.exitTime)} (Europe/Berlin). Exit vorgeschlagen; Ergebnis unverändert. Erst Speichern übernimmt die Werte.`;
 }
 function select(result){
  if(!selection.value||result?.target?.draftToken!==selection.value.draftToken)return;
  if(!result.lines?.length)return;
  pending.value=result;
  if(result.lines.length===1)choose(result.lines[0].key);
  else{
   choices.value=result.lines;
   message.value=`Mehrere Linien in der Minute ${formatDatedTime(result.time)} (Europe/Berlin). Linie auswählen; die Intrabar-Reihenfolge ist unbekannt.`;
  }
 }
 watch([bar,symbol,()=>editing.value?.id,()=>editing.value?.dealingRangeId,replay],clear,{flush:'sync'});
 watch(()=>journalTpContext(current()),next=>{if(selection.value&&next!==journalTpContext(selection.value))clear();},{flush:'sync'});
 watch(armed,value=>{if(value?.key!=='journalTp'){pending.value=null;choices.value=[];message.value='';}},{flush:'sync'});
 return {selection,message,choices,request,select,choose,clear};
}
