import {reactive,watch} from 'vue';

export function useSimulationRangeDetails(repository,runId,dataset) {
 const states=reactive(new Map());
 watch([runId,()=>dataset.value?.generation],()=>states.clear());
 async function open(group){
  const key=group.key,existing=states.get(key);
  if(existing?.group||existing?.loading)return;
  const state=reactive({loading:true,error:'',group:null});states.set(key,state);
  try{
   state.group=dataset.value?.prepared?await repository.getStatisticsDetail(runId.value,dataset.value.generation,key):group;
  }catch(cause){state.error=cause.message||'DR-Details konnten nicht geladen werden.';}
  finally{state.loading=false;}
 }
 return {states,open};
}
