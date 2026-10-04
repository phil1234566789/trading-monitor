import { ref,watch,onScopeDispose } from 'vue';
import { fetchSimulationPins,addSimulationPin,removePinEntry } from '../pinContext.js';
import { simulationPinKey,simulationPinSnapshot } from '../simulationPinSnapshot.js';

export function useSimulationPins(filters,run,results) {
  const pins=ref([]),error=ref(''),loading=ref(false),saving=ref(false),target=ref(null);
  let revision=0;
  async function refresh() {
    const ticket=++revision;error.value='';loading.value=true;
    try {
      const ids=[...new Set([filters.value.run,filters.value.compare].filter(Boolean))];
      const rows=await Promise.all(ids.map(fetchSimulationPins));
      if(ticket===revision)pins.value=rows.flat();
    } catch(cause){if(ticket===revision)error.value=cause.message || 'Pins konnten nicht geladen werden.';}
    finally{if(ticket===revision)loading.value=false;}
  }
  watch([()=>filters.value.run,()=>filters.value.compare],refresh,{immediate:true});
  onScopeDispose(()=>{revision++;});
  const find=t=>pins.value.find(p=>p.simulationPinKey===simulationPinKey(t));
  const isPinned=(group,feature,entry)=>!!find({kind:feature?'simulation_checkpoint':entry?'simulation_entry':'simulation_dr',group,feature,entry});
  function open(value){error.value='';target.value={...value,note:find(value)?.note ?? '',existingId:find(value)?.id};}
  async function save(note) {
    if(!target.value || saving.value)return;
    saving.value=true;error.value='';
    try {
      const t=target.value;
      await addSimulationPin({kind:t.kind,key:simulationPinKey(t),snapshotId:t.kind==='simulation_entry'?null:t.group.snapshot.id,
        entrySnapshotId:t.entry?.id,checkpointKey:t.feature?.key,variant:t.entry?'both':null,
        context:simulationPinSnapshot(t,run.value,results.value)},note);
      await refresh();target.value=null;
    } catch(cause){error.value=cause.message || 'Pin konnte nicht gespeichert werden.';}
    finally{saving.value=false;}
  }
  async function remove() {
    const id=target.value?.existingId;if(!id || saving.value)return;
    saving.value=true;error.value='';
    try {
      if(!await removePinEntry(id))throw new Error('Pin konnte nicht entfernt werden.');
      await refresh();target.value=null;
    }catch(cause){error.value=cause.message;}
    finally{saving.value=false;}
  }
  return {pins,error,loading,saving,target,refresh,isPinned,open,save,remove};
}
