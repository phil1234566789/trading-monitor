import {computed,nextTick,ref,watch} from 'vue';

export function useJournalExecutionDraft({trade,loading,positions,refresh,started,cancelled,created}) {
 const draftKey=ref(null),draftBase=ref(null),card=ref(null),container=ref(null),pendingCreatedId=ref(null);
 let nextKey=0;
 const visiblePositions=computed(()=>positions.value.filter(position=>draftKey.value==null||position.id!==pendingCreatedId.value));
 async function start(){
  if(loading.value||draftKey.value!=null||trade().dealingRangeId==null)return false;
  draftBase.value={...trade()};draftKey.value=++nextKey;started();
  await nextTick();container.value?.scrollIntoView?.({block:'start'});return true;
 }
 function cancel(){draftKey.value=null;draftBase.value=null;pendingCreatedId.value=null;cancelled();}
 function apply(prefill,key){return draftKey.value===key ? card.value?.applyPrefill(prefill)??false : false;}
 async function reload(){
  const ok=await refresh();
  if(ok&&pendingCreatedId.value!=null&&positions.value.some(position=>position.id===pendingCreatedId.value))cancel();
  return ok;
 }
 async function onCreated(id,accountId,key){
  if(key!==draftKey.value)return;
  const range=trade().dealingRangeId,symbol=trade().instrument;
  pendingCreatedId.value=id;await reload();
  if(trade().dealingRangeId===range&&trade().instrument===symbol)created(id,accountId);
 }
 watch([()=>trade().dealingRangeId,()=>trade().instrument],()=>{if(draftKey.value!=null)cancel();});
 return {draftKey,draftBase,card,container,visiblePositions,start,cancel,apply,reload,onCreated};
}
