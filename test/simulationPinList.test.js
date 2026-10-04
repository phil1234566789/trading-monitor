import { describe, it, expect, vi } from 'vitest';
import { createSSRApp, effectScope, ref } from 'vue';
import { renderToString } from '@vue/server-renderer';
import SimulationPinList from '../src/components/SimulationPinList.vue';
const api=vi.hoisted(()=>({fetchSimulationPins:vi.fn(async()=>[]),removeSimulationPins:vi.fn(async()=>{})}));
vi.mock('../src/pinContext.js',()=>({...api,addSimulationPin:vi.fn(),removePinEntry:vi.fn()}));
import { useSimulationPins } from '../src/composables/useSimulationPins.js';
describe('simulation pin list',()=>{
  it('shows saved context, notes and a scoped clear button',async()=>{
    const html=await renderToString(createSSRApp(SimulationPinList,{open:false,pins:[{id:1,kind:'simulation_checkpoint',note:'Bitte prüfen',simulationContext:{instrument:'GBPUSD',checkpoint:{label:'F · Anti-Confluences'},recognizedAt:{berlin:'2026-09-01 10:00'}}}]}));
    expect(html).toContain('F · Anti-Confluences');
    expect(html).toContain('Bitte prüfen');
    expect(html).toContain('Alle 1 Pins dieses Laufs entfernen');
  });
  it('cannot clear pins from the comparison run or arbitrary ids',async()=>{
    const scope=effectScope();
    const state=scope.run(()=>useSimulationPins(ref({run:'new',compare:'old'}),ref({}),ref([])));
    await state.refresh();
    state.pins.value=[{id:1,simulationRunId:'new'},{id:2,simulationRunId:'old'}];
    await state.removeListed([1,2,999]);
    expect(api.removeSimulationPins).toHaveBeenCalledWith('new',[1]);
    scope.stop();
  });
});
