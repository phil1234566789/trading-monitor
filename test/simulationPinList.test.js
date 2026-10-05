import { describe, it, expect, vi } from 'vitest';
import { createSSRApp, effectScope, ref } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createRouter,createMemoryHistory } from 'vue-router';
import SimulationPinList from '../src/components/SimulationPinList.vue';
import SimulationPinFlag from '../src/components/SimulationPinFlag.vue';
import {simulationPinKey} from '../src/simulationPinSnapshot.js';
const api=vi.hoisted(()=>({fetchSimulationPins:vi.fn(async()=>[]),removeSimulationPins:vi.fn(async()=>{}),
  updatePinNote:vi.fn(async()=>true),addSimulationPin:vi.fn(),removePinEntry:vi.fn()}));
vi.mock('../src/pinContext.js',()=>api);
import { useSimulationPins } from '../src/composables/useSimulationPins.js';
describe('simulation pin list',()=>{
  it('shows multiline notes as safe text and offers a focusable empty-note fallback',async()=>{
    const html=await renderToString(createSSRApp(SimulationPinFlag,{note:'First line\n<script>wrong()</script>'}));
    expect(html).toContain('First line\n&lt;script&gt;wrong()&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('tabindex="0"');
    expect(await renderToString(createSSRApp(SimulationPinFlag,{note:'  '}))).toContain('Keine Notiz gespeichert.');
  });
  it('uses the note of the exact DR, checkpoint or entry pin',async()=>{
    const scope=effectScope(),state=scope.run(()=>useSimulationPins(ref({run:'new'}),ref({}),ref([])));
    try {
      await state.refresh();
      const group={key:'dr',snapshot:{runId:'new',setupKey:'dr'}},feature={key:'F'},entry={id:'entry'};
      const targets=[{kind:'simulation_dr',group},{kind:'simulation_checkpoint',group,feature},{kind:'simulation_entry',group,entry}];
      state.pins.value=targets.map((t,index)=>({simulationPinKey:simulationPinKey(t),note:`Note ${index}`}));
      expect(state.pinNote(group)).toBe('Note 0');
      expect(state.pinNote(group,feature)).toBe('Note 1');
      expect(state.pinNote(group,null,entry)).toBe('Note 2');
      expect(state.pinNote({...group,snapshot:{...group.snapshot,runId:'other'}})).toBeUndefined();
    }finally{scope.stop();}
  });
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
  it('shows unmatched reasons, original run and context without offering bulk deletion of inherited pins',async()=>{
    const app=createSSRApp(SimulationPinList,{pins:[],runId:'new',unmatched:[{id:7,simulationRunId:'old',note:'Alte Notiz',
      originLabel:'September · Alter Lauf',unmatchedReason:'Entry wurde geändert.',simulationContext:{chartLink:{path:'/'}}}]});
    app.use(createRouter({history:createMemoryHistory(),routes:[{path:'/',component:{render:()=>null}}]}));
    const html=await renderToString(app);
    expect(html).toContain('Nicht zugeordnet (1)');expect(html).toContain('Entry wurde geändert.');
    expect(html).toContain('September · Alter Lauf');expect(html).toContain('Alte Notiz');
    expect(html).toContain('Ursprünglicher Chart / Snapshot');expect(html).not.toContain('Pins dieses Laufs entfernen');
  });
  it('loads old snapshot evidence once and edits the original note without creating a new pin',async()=>{
    const scope=effectScope();
    const snapshot={id:'new-s',runId:'new',setupKey:'new-dr',instrument:'GBPUSD',direction:'long',
      checklist:{setup:{primary:{sweep:{timeframe:'5M',level:{pivotTime:1,price:1.2,touchedTime:2}},reactionOB:{startTime:3,top:1.3,bottom:1.2}}}}};
    const group={key:'new:dr',snapshot,entries:[],features:[]};
    const old={id:7,kind:'simulation_dr',simulationRunId:'old',simulationSnapshotId:'old-s',note:'Alte Notiz',simulationContext:{setupKey:'old-dr'}};
    api.fetchSimulationPins.mockResolvedValue([old]);
    const getSetupSnapshot=vi.fn(async()=>({...snapshot,runId:'old',setupKey:'old-dr'}));
    const state=scope.run(()=>useSimulationPins(ref({run:'new'}),ref({}),ref([]),{repository:{getSetupSnapshot},datasets:ref(new Map([['new',{groups:[group]}]])),runs:ref([])}));
    try {
      await state.refresh();await state.refresh();
      expect(getSetupSnapshot).toHaveBeenCalledTimes(1);expect(state.listedPins.value).toHaveLength(1);
      expect(state.isPinned(group)).toBe(true);expect(state.pinNote(group)).toBe('Alte Notiz');
      state.open({kind:'simulation_dr',group});await state.save('Neue Notiz');
      expect(api.updatePinNote).toHaveBeenCalledWith(7,'Neue Notiz');expect(api.addSimulationPin).not.toHaveBeenCalled();
      expect(old).toMatchObject({note:'Alte Notiz',simulationRunId:'old',simulationSnapshotId:'old-s'});
    }finally{scope.stop();api.fetchSimulationPins.mockResolvedValue([]);}
  });
});
