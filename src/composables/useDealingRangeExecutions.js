import {computed,onScopeDispose,ref,watch} from 'vue';
import {fetchTrades} from '../trades.js';
import {ALL_ACCOUNTS_ID} from '../tradingAccounts.js';

export function useDealingRangeExecutions(trade,available) {
 const rows=ref([]),loading=ref(false),error=ref('');
 let generation=0;
 const positions=computed(()=>rows.value.slice().sort((a,b)=>a.id-b.id));
 function mergeKnown(values){
  const own=values.filter(row=>row.dealingRangeId===trade().dealingRangeId&&row.instrument===trade().instrument);
  const byId=new Map(rows.value.map(row=>[row.id,row]));
  for(const row of own)byId.set(row.id,row);
  rows.value=[...byId.values()];
 }
 async function refresh(){
  const current=trade(),ticket=++generation;
  loading.value=true;error.value='';
  try{
   const result=await fetchTrades(current.instrument,ALL_ACCOUNTS_ID,current.dealingRangeId);
   if(ticket!==generation)return false;
   rows.value=result;return true;
  }catch{
   if(ticket===generation)error.value='Ausführungen konnten nicht vollständig geladen werden.';
   return false;
  }finally{if(ticket===generation)loading.value=false;}
 }
 watch([()=>trade().dealingRangeId,()=>trade().instrument],()=>{
  rows.value=[];mergeKnown(available());mergeKnown([trade()]);void refresh();
 },{immediate:true});
 watch(available,mergeKnown);
 onScopeDispose(()=>generation++);
 return {positions,loading,error,refresh};
}
