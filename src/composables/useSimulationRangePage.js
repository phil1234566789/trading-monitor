import {ref,watch,onScopeDispose} from 'vue';

export function useSimulationRangePage(repository,runId,dataset,groups) {
 const page=ref([]),loading=ref(false),error=ref(''),count=ref(0);
 let revision=0;
 async function more(reset=false){
  const ticket=reset?++revision:revision;
  if(!reset&&loading.value)return;
  if(reset){page.value=[];count.value=0;}
  error.value='';loading.value=true;
  const selected=groups.value.slice(count.value,count.value+25);
  try{
   const state=dataset.value;
   const rows=state?.prepared?await repository.getStatisticsPage(runId.value,state.generation,selected.map(g=>g.key)):selected;
   if(ticket!==revision)return;
   // Zeitraum-/Patternfilter dürfen beim Seitennachladen keine ausgeblendeten Entries zurückbringen.
   const scoped=new Map(selected.map(g=>[g.key,g]));
   page.value=[...page.value,...rows.map(g=>({...g,entries:scoped.get(g.key).entries}))];count.value+=rows.length;
  }catch(cause){if(ticket===revision)error.value=cause.message||'DR-Seite konnte nicht geladen werden.';}
  finally{if(ticket===revision)loading.value=false;}
 }
 watch([runId,dataset,groups],()=>more(true),{immediate:true});
 onScopeDispose(()=>{revision++;});
 return {page,loading,error,count,more:()=>more(false),retry:()=>more(false)};
}
