import { ref,computed,watch,onScopeDispose } from 'vue';
import { fetchSimulationPins,addSimulationPin,removePinEntry,removeSimulationPins,updatePinNote } from '../pinContext.js';
import { simulationPinKey,simulationPinSnapshot } from '../simulationPinSnapshot.js';
import { matchSimulationPins } from '../simulationPinMatching.js';

export function useSimulationPins(filters,run,results,{repository,datasets,runs}={}) {
  const pins=ref([]),error=ref(''),loading=ref(false),saving=ref(false),target=ref(null);
  const origins=ref(new Map());
  const associations=computed(()=>new Map([filters.value.run,filters.value.compare].filter(Boolean).map(id=>
    [id,matchSimulationPins(pins.value,datasets?.value.get(id)?.groups??[],id,origins.value,runs?.value??[])])));
  const listedPins=computed(()=>associations.value.get(filters.value.run)?.matched??[]);
  const unmatchedPins=computed(()=>associations.value.get(filters.value.run)?.unmatched??[]);
  const associatedPins=computed(()=>[...associations.value.values()].flatMap(a=>a.matched));
  const snapshotCache=new Map();
  let revision=0;
  async function refresh() {
    const ticket=++revision;error.value='';loading.value=true;
    try {
      const rows=await fetchSimulationPins();
      const resolved=new Map();
      if(repository) {
        // Ein Herkunftssnapshot je Pin genügt; alte Läufe müssen nicht vollständig geladen werden.
        for(let offset=0;offset<rows.length;offset+=8)await Promise.all(rows.slice(offset,offset+8).map(async pin=>{
          const entry=pin.kind==='simulation_entry',id=entry?pin.simulationEntrySnapshotId:pin.simulationSnapshotId;
          if(!id)return;
          const key=JSON.stringify([pin.simulationRunId,entry,id]);
          if(!snapshotCache.has(key))snapshotCache.set(key,(entry?repository.getSnapshot:repository.getSetupSnapshot)(pin.simulationRunId,id));
          try{resolved.set(pin.id,await snapshotCache.get(key));}
          catch{snapshotCache.delete(key);resolved.set(pin.id,{pinReadError:true});}
        }));
      }
      if(ticket===revision){pins.value=rows;origins.value=resolved;}
    } catch(cause){if(ticket===revision)error.value=cause.message || 'Pins konnten nicht geladen werden.';}
    finally{if(ticket===revision)loading.value=false;}
  }
  watch([()=>filters.value.run,()=>filters.value.compare],refresh,{immediate:true});
  onScopeDispose(()=>{revision++;});
  const find=t=>pins.value.find(p=>p.simulationPinKey===simulationPinKey(t))
    ?? associatedPins.value.find(p=>p.associationKey===simulationPinKey(t));
  const matchingPin=(group,feature,entry)=>find({kind:feature?'simulation_checkpoint':entry?'simulation_entry':'simulation_dr',group,feature,entry});
  const isPinned=(...args)=>!!matchingPin(...args);
  const pinNote=(group,feature,entry)=>{
    const key=simulationPinKey({kind:feature?'simulation_checkpoint':entry?'simulation_entry':'simulation_dr',group,feature,entry});
    const matches=[...pins.value.filter(p=>p.simulationPinKey===key),...associatedPins.value.filter(p=>p.associationKey===key)];
    return [...new Map(matches.map(p=>[p.id??p.simulationPinKey,p])).values()].map(p=>p.note).filter(Boolean).join('\n\n') || undefined;
  };
  function open(value){error.value='';target.value={...value,note:find(value)?.note ?? '',existingId:find(value)?.id};}
  function editListed(pin) {
    const original=pins.value.find(p=>p.id===pin.id);
    if(original){error.value='';target.value={note:original.note ?? '',existingId:original.id,editOnly:true};}
  }
  async function save(note) {
    if(!target.value || saving.value)return;
    saving.value=true;error.value='';
    try {
      const t=target.value;
      if(t.existingId) {
        if(!await updatePinNote(t.existingId,note))throw new Error('Pin-Notiz konnte nicht gespeichert werden.');
      } else await addSimulationPin({kind:t.kind,key:simulationPinKey(t),snapshotId:t.kind==='simulation_entry'?null:t.group.snapshot.id,
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
  async function removeListed(ids) {
    if (saving.value) return;
    const runId = filters.value.run;
    const selected = pins.value.filter(p => p.simulationRunId === runId && ids.includes(p.id));
    saving.value = true; error.value = '';
    try {
      await removeSimulationPins(runId, selected.map(p => p.id));
      await refresh();
    } catch (cause) { error.value = cause.message || 'Pins konnten nicht entfernt werden.'; }
    finally { saving.value = false; }
  }
  return {pins,listedPins,unmatchedPins,associatedPins,error,loading,saving,target,refresh,isPinned,pinNote,open,editListed,save,remove,removeListed};
}
