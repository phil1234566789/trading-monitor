import {it,expect,vi} from 'vitest';
import {effectScope,ref} from 'vue';
vi.mock('../src/pinContext.js',()=>({fetchSimulationPins:vi.fn(async()=>[]),addSimulationPin:vi.fn(),removePinEntry:vi.fn(),removeSimulationPins:vi.fn(),updatePinNote:vi.fn(async()=>true)}));
import {addSimulationPin,updatePinNote,fetchSimulationPins,removeSimulationPins} from '../src/pinContext.js';
import {useSimulationPins} from '../src/composables/useSimulationPins.js';
import {liveWatcherSnapshots,liveWatcherEntryResults,liveWatcherRun} from '../src/liveWatcherSnapshots.js';
import {reviewGroups} from '../src/simulationRunComparison.js';
import {simulationPinKey,simulationPinSnapshot} from '../src/simulationPinSnapshot.js';
import {matchSimulationPins} from '../src/simulationPinMatching.js';
import {simulationPinStageLabel} from '../src/simulationPinPresentation.js';
import {scopePinSource} from '../src/simulationPinSource.js';
const runId='live-watcher:2026-10',at=1791530880;
const event={id:'original-event',kind:'trading',stage:3,instrument:'EURUSD',direction:'short',setup_key:'EURUSD:setup1:16107',signal_at:'2026-10-09T07:28:00Z',payload:{entry:{id:'original-entry',recognizedAt:at,price:1.12,entryCategory:'risky'},variants:[]}};
const snapshots=liveWatcherSnapshots([event],runId),group=reviewGroups(snapshots)[0],results=snapshots.flatMap(liveWatcherEntryResults),run=liveWatcherRun({id:runId});
const target={kind:'simulation_entry',group,entry:group.entries[0]};
it('keeps live identity stable across months, with an optional run and exact event source',()=>{
 const context=simulationPinSnapshot(target,run,results),key=simulationPinKey(target);
 expect(context).toMatchObject({contextVersion:'simulation-pin-context-v3',runId:null,snapshotId:'original-entry',source:{kind:'live-watcher',eventId:event.id,viewId:runId}});
 expect(simulationPinStageLabel(context)).toBe('DR-Stufe nicht gespeichert');
 const next={...target,group:{...group,snapshot:{...group.snapshot,runId:'live-watcher:2026-11'}}};expect(simulationPinKey(next)).toBe(key);
 const pin={id:1,kind:'simulation_entry',simulationRunId:null,liveEventId:event.id,simulationEntrySnapshotId:'original-entry',simulationContext:context,simulationPinKey:key};
 expect(matchSimulationPins([pin],[group],runId).matched).toHaveLength(1);
 const historical={...group,snapshot:{...group.snapshot,runId:'historical'},entries:group.entries.map(e=>({...e,runId:'historical'}))};
 expect(matchSimulationPins([pin],[historical],'historical',new Map([[1,snapshots[0]]])).matched).toHaveLength(1);
});
it('scopes NULL-run deletes to explicit live sources, leaving ordinary run filters unchanged',()=>{
 const query={is:vi.fn().mockReturnThis(),not:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis()};
 scopePinSource(query,runId);expect(query.is).toHaveBeenCalledWith('simulation_run_id',null);expect(query.not).toHaveBeenCalledWith('live_event_id','is',null);
 scopePinSource(query,'old-run');expect(query.eq).toHaveBeenCalledWith('simulation_run_id','old-run');
});
it('saves through the same pin flow without a fake run and retains ordinary note edits',async()=>{
 const scope=effectScope(),state=scope.run(()=>useSimulationPins(ref({run:runId}),ref(run),ref(results)));
 state.target.value=target;await state.save('note','bug');expect(addSimulationPin).toHaveBeenCalledWith(expect.objectContaining({context:expect.objectContaining({runId:null,source:expect.objectContaining({eventId:event.id})})}),'note','bug');
 state.target.value={existingId:'old-pin',editOnly:true};await state.save('changed','observation');expect(updatePinNote).toHaveBeenCalledWith('old-pin','changed','observation');scope.stop();
});
it('bulk-removes only the selected pins belonging to the chosen source',async()=>{
 fetchSimulationPins.mockResolvedValueOnce([{id:1,simulationRunId:null,liveEventId:event.id,simulationContext:{source:{kind:'live-watcher',eventId:event.id}}},{id:2,simulationRunId:'other'}]);
 const scope=effectScope(),state=scope.run(()=>useSimulationPins(ref({run:runId}),ref(run),ref([])));await vi.waitFor(()=>expect(state.pins.value).toHaveLength(2));await state.removeListed([1,2]);expect(removeSimulationPins).toHaveBeenCalledWith(runId,[1]);scope.stop();
});
