import {expect,it,vi} from 'vitest';
import {effectScope,nextTick} from 'vue';
const {fetchDrawings,storage}=vi.hoisted(()=>({fetchDrawings:vi.fn(async()=>[]),storage:new Map()}));
vi.mock('../src/drawingsStore.js',()=>({fetchDrawings,addDrawing:vi.fn(),removeDrawing:vi.fn(),updateDrawingVisible:vi.fn()}));
vi.mock('../src/composables/useLocalStorageRef.js',async()=>{const {ref}=await import('vue');return {useLocalStorageRef:(key,initial)=>{if(!storage.has(key))storage.set(key,ref(initial));return storage.get(key);}};});
import {useDrawings} from '../src/composables/useDrawings.js';
it('loads only for chart or modal consumers, shares one watcher and cleans up after the last user',async()=>{
 const shell=effectScope(),chart=effectScope(),modal=effectScope();
 try{shell.run(()=>useDrawings({load:false}));expect(fetchDrawings).not.toHaveBeenCalled();const state=chart.run(()=>useDrawings());modal.run(()=>useDrawings());await nextTick();expect(fetchDrawings).toHaveBeenCalledTimes(1);
 chart.stop();storage.get('currentSymbol').value='EURUSD';await nextTick();expect(fetchDrawings).toHaveBeenCalledTimes(2);
 state.drawings.value=[{id:'previous-chart'}];modal.stop();expect(state.drawings.value).toEqual([]);storage.get('currentSymbol').value='GBPUSD';await nextTick();expect(fetchDrawings).toHaveBeenCalledTimes(2);
 }finally{shell.stop();chart.stop();modal.stop();}
});

it('ignores a delayed drawing response after the chart or modal was left',async()=>{
 let resolve;fetchDrawings.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));const scope=effectScope(),state=scope.run(()=>useDrawings());
 scope.stop();resolve([{id:'stale-fixture'}]);for(let i=0;i<3;i++)await nextTick();expect(state.drawings.value).toEqual([]);expect(state.loading.value).toBe(false);
});
