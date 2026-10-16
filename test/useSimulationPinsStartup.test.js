import {expect,it,vi} from 'vitest';import {effectScope,ref,nextTick} from 'vue';
const {fetchSimulationPins}=vi.hoisted(()=>({fetchSimulationPins:vi.fn(async()=>[])}));
vi.mock('../src/pinContext.js',()=>({fetchSimulationPins,addSimulationPin:vi.fn(),removePinEntry:vi.fn(),removeSimulationPins:vi.fn(),updatePinNote:vi.fn()}));
import {useSimulationPins} from '../src/composables/useSimulationPins.js';
it('does not read pins or their original snapshots before a run is selected',async()=>{
 const scope=effectScope(),filters=ref({run:'',compare:''});let state;
 try{state=scope.run(()=>useSimulationPins(filters,ref(null),ref([])));await nextTick();expect(fetchSimulationPins).not.toHaveBeenCalled();expect(state.loading.value).toBe(false);
 filters.value={run:'saved',compare:''};for(let i=0;i<3;i++)await nextTick();expect(fetchSimulationPins).toHaveBeenCalledTimes(1);
 filters.value={run:'',compare:''};await nextTick();expect(fetchSimulationPins).toHaveBeenCalledTimes(1);expect(state.pins.value).toEqual([]);
 }finally{scope.stop();}
});

it('does not resolve pin originals if their list arrives after returning to the empty root',async()=>{
 let resolve;fetchSimulationPins.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));const scope=effectScope(),filters=ref({run:'saved',compare:''}),getSnapshot=vi.fn();
 const state=scope.run(()=>useSimulationPins(filters,ref(null),ref([]),{repository:{getSnapshot}}));
 try{filters.value={run:'',compare:''};await nextTick();resolve([{kind:'simulation_entry',simulationRunId:'old',simulationEntrySnapshotId:'entry'}]);for(let i=0;i<5;i++)await nextTick();expect(getSnapshot).not.toHaveBeenCalled();expect(state.pins.value).toEqual([]);expect(state.loading.value).toBe(false);}
 finally{scope.stop();}
});
