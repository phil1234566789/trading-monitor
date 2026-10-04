import {onScopeDispose,watch} from 'vue';

export const SNAPSHOT_REPLAY_DEBOUNCE_MS=150;
export function watchSnapshotOverlay(source,clear,load) {
  let controller,timer;
  watch(source,(next,previous)=>{
    controller?.abort();clearTimeout(timer);clear();
    controller=new AbortController();
    const signal=controller.signal;
    const run=()=>{if(!signal.aborted)void load(signal);};
    // Nur Replay-Scrubbing verzögern; Abschalten/Schließen entfernt Linien sofort.
    if(previous&&next[0]===previous[0]&&next[1]!==previous[1])timer=setTimeout(run,SNAPSHOT_REPLAY_DEBOUNCE_MS);
    else run();
  },{immediate:true,flush:'sync'});
  onScopeDispose(()=>{controller?.abort();clearTimeout(timer);});
}
