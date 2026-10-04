import {expect,it,vi} from 'vitest';
import {effectScope,reactive} from 'vue';
import {watchSnapshotOverlay,SNAPSHOT_REPLAY_DEBOUNCE_MS} from '../src/composables/watchSnapshotOverlay.js';

it('coalesces rapid replay changes, aborts CPU work immediately and cancels on dispose',()=>{
  vi.useFakeTimers();
  const scope=effectScope(),state=reactive({at:600,enabled:true}),clear=vi.fn(),load=vi.fn();
  try {
    scope.run(()=>watchSnapshotOverlay(()=>['snapshot',state.at,state.enabled],clear,load));
    const first=load.mock.calls[0][0];
    for(let i=0;i<10;i++)state.at+=60;
    expect(first.aborted).toBe(true);expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(SNAPSHOT_REPLAY_DEBOUNCE_MS);
    expect(load).toHaveBeenCalledTimes(2);
    const last=load.mock.calls[1][0];
    state.enabled=false;
    expect(last.aborted).toBe(true);expect(clear).toHaveBeenCalledTimes(12);
    state.at+=60;scope.stop();vi.runAllTimers();expect(load).toHaveBeenCalledTimes(3);
  }finally{scope.stop();vi.useRealTimers();}
});
