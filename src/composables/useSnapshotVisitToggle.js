import {computed,ref,watch} from 'vue';

export function useSnapshotVisitToggle(saved, snapshotView) {
  const visit=ref(null);
  watch(snapshotView,active=>{visit.value=active?true:null;},{immediate:true,flush:'sync'});
  return computed({get:()=>snapshotView.value?visit.value:saved.value,
    set:value=>{if(snapshotView.value)visit.value=value;else saved.value=value;}});
}
