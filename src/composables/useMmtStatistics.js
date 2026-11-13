import {computed,onMounted,onUnmounted,ref,watch} from 'vue';
import {requestMmtHistoryRefresh} from '../milkyMetaTraderHistory.js';
import {statisticsAccounts} from '../milkyMetaTraderAccountSelection.js';

export function useMmtStatistics(props,emit){
 const asset=ref(''),from=ref(''),to=ref(''),outcomes=ref(['win','loss','breakeven']),selectedWeek=ref(''),offset=ref(0),extremeLimit=ref(5),view=ref('list');
 const summary=ref(null),page=ref({rows:[],journal_links:[],total:0,next_offset:null}),series=ref([]),loading=ref(false),pageLoading=ref(false),seriesLoading=ref(false),refreshing=ref(false),error=ref('');
 const selectedAccounts=computed(()=>statisticsAccounts(props.accounts,props.account));
 const filters=computed(()=>({account_ids:selectedAccounts.value.map(a=>a.id),asset:asset.value,from:from.value,to:to.value,outcomes:outcomes.value,currency:'USD'}));
 const weeks=computed(()=>summary.value?.weeks??[]),weekIndex=computed(()=>Math.max(0,weeks.value.findIndex(w=>w.key===selectedWeek.value))),week=computed(()=>weeks.value[weekIndex.value]);
 let alive=true,generation=0,pageGeneration=0,seriesGeneration=0;
 async function loadPage(){
  const request=++pageGeneration,epoch=generation;
  page.value={rows:[],journal_links:[],total:0,next_offset:null};
  if(!week.value){pageLoading.value=false;return;}
  pageLoading.value=true;
  try{const data=await props.api('statistics_page',{...filters.value,week:week.value.key,offset:offset.value},{background:true});if(alive&&epoch===generation&&request===pageGeneration)page.value=data;}
  catch(e){if(alive&&epoch===generation&&request===pageGeneration)error.value=e.message;}
  finally{if(alive&&epoch===generation&&request===pageGeneration)pageLoading.value=false;}
 }
 async function loadSeries(){
  const request=++seriesGeneration,epoch=generation,rows=[];let cursor=0;
  seriesLoading.value=true;series.value=[];
  try{
   while(alive&&epoch===generation&&request===seriesGeneration){
    const data=await props.api('statistics_series',{...filters.value,offset:cursor,limit:500},{background:true});
    rows.push(...data.rows);if(!data.rows.length||data.next_offset==null)break;
    if(data.next_offset<=cursor)throw new Error('Ungültige Statistik-Paginierung');cursor=data.next_offset;
   }
   if(alive&&epoch===generation&&request===seriesGeneration)series.value=rows;
  }catch(e){if(alive&&epoch===generation&&request===seriesGeneration)error.value=e.message;}
  finally{if(alive&&epoch===generation&&request===seriesGeneration)seriesLoading.value=false;}
 }
 async function load(){
  const epoch=++generation;loading.value=true;error.value='';offset.value=0;
  try{
   const count=Number.isInteger(extremeLimit.value)&&extremeLimit.value>=1&&extremeLimit.value<=100?extremeLimit.value:5;
   const data=await props.api('statistics_summary',{...filters.value,extreme_limit:count,commission_positions:props.commissionPositions??[]},{background:true});
   if(!alive||epoch!==generation)return;
   summary.value=data;emit('history',data);
   await loadPage();if(view.value==='chart')void loadSeries();
  }catch(e){if(alive&&epoch===generation)error.value=e.message;}
  finally{if(alive&&epoch===generation)loading.value=false;}
 }
 async function refresh(){
  if(refreshing.value)return;refreshing.value=true;
  // Gespeicherte Daten sofort zeigen; auf den unabhängigen Brokerimport wartet nur der Hintergrundlauf.
  const saved=load();
  const refreshError=await requestMmtHistoryRefresh(props.api);
  if(alive){await saved;await load();if(refreshError)error.value=refreshError;refreshing.value=false;}
 }
 watch(filters,()=>{selectedWeek.value='';void load();},{deep:true});
 watch(selectedWeek,()=>{if(loading.value)return;if(offset.value)offset.value=0;else void loadPage();});
 watch(offset,()=>{if(!loading.value)void loadPage();});
 watch(extremeLimit,value=>{if(Number.isInteger(value)&&value>=1&&value<=100)void load();});
 watch(view,value=>{if(value==='chart')void loadSeries();});
 onMounted(()=>{void refresh();});onUnmounted(()=>{alive=false;generation++;pageGeneration++;seriesGeneration++;});
 return {asset,from,to,outcomes,selectedWeek,offset,extremeLimit,view,summary,page,series,loading,pageLoading,seriesLoading,refreshing,error,selectedAccounts,weeks,weekIndex,week,refresh};
}
