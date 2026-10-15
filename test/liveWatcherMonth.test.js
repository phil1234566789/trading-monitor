import {describe,it,expect,vi} from 'vitest';
import {ref,effectScope,createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
import SimulationComparisonFilters from '../src/components/SimulationComparisonFilters.vue';
import {liveMonthBounds,liveMonthOptions,liveMonthGroups,createLiveWatcherRepository,liveEntryLink} from '../src/liveWatcherMonth.js';
import {liveWatcherRun,liveWatcherSnapshots,liveWatcherEntryResults} from '../src/liveWatcherSnapshots.js';
import {reviewGroups} from '../src/simulationRunComparison.js';
import TradeSetupChecklist from '../src/components/TradeSetupChecklist.vue';
import SimulationDrList from '../src/components/SimulationDrList.vue';
import {createRouter,createMemoryHistory} from 'vue-router';
import {useSimulationComparison} from '../src/composables/useSimulationComparison.js';
const event=(id,stage=3)=>({id:'alarm:'+id,kind:'trading',stage,instrument:'EURUSD',setup_key:'EURUSD:setup1:16107',direction:'short',signal_at:'2026-10-09T07:28:00Z',payload:{entry:{id,recognizedAt:1791530880,entryCategory:'risky',entryPattern:'countertrend-entry-model-1-v10'},variants:[{variant:'wide',lots:4},{variant:'narrow',lots:8}]}});
describe('persisted live watcher month',()=>{
 it('shows missing snapshot checks in the ordinary checklist without promising a new evaluation',async()=>{
  const html=await renderToString(createSSRApp(TradeSetupChecklist,{instrument:'EURUSD',snapshotView:true,savedEntry:event('one').payload.entry}));
  expect(html).toContain('Prüfdaten nicht gespeichert');expect(html).toContain('Am gespeicherten Stand nicht belegt');expect(html).not.toContain('Wartet auf die automatische Auswertung');expect(html).not.toContain('checklist-spinner');expect(html).toContain('Risky Entry');
 });
 it('renders the same DR cards, feature chips and entry tables as ordinary runs',async()=>{
  const runId='live-watcher:2026-10',snapshots=liveWatcherSnapshots([event('one'),event('two')],runId),groups=reviewGroups(snapshots),results=snapshots.flatMap(liveWatcherEntryResults);
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:{template:'<div/>'}}]});await router.push('/');
  const app=createSSRApp(SimulationDrList,{groups,results});app.use(router);
  const html=await renderToString(app);
  expect(html).toContain('class="dr-card"');expect(html).toContain('entry-scroll');expect(html).toContain('Nettoergebnisse nach Kommission');
  expect(html).toContain('Risky Entry');expect(html).toContain('Ergebnis nicht gespeichert');expect(html).toContain('DR-Stufe nicht gespeichert');
  expect(html).toContain('setup2=one');expect(html).toContain('run=live-watcher');expect(html).not.toContain('/live-watcher-entry');
  expect(groups[0].outcome.status).toBe('unknown');expect(groups[0].entries).toHaveLength(2);
  expect(results.every(r=>r.status==='notStored' && r.commissionUsd===null)).toBe(true);
  expect(snapshots.every(s=>!s.checklist && !s.dealingRange)).toBe(true);
 });
 it('keeps all ordinary filters available for live months',async()=>{
  const run=liveWatcherRun({id:'live-watcher:2026-10',label:'Live-Watcher · Oktober 2026'});
  const html=await renderToString(createSSRApp(SimulationComparisonFilters,{modelValue:{run:run.id},runs:[run],features:[]}));
  expect(html).toContain('Live-Watcher · Oktober 2026');expect(html).toContain('DR-Stufe');expect(html).toContain('Entry ab');expect(html).toContain('Angepinnt');
 });
 it('uses Berlin month boundaries across DST and year changes',()=>{
  expect(liveMonthBounds('2026-10')).toEqual({from:'2026-09-30T22:00:00.000Z',to:'2026-10-31T23:00:00.000Z'});
  expect(liveMonthBounds('2026-12').to).toBe('2026-12-31T23:00:00.000Z');
  expect(()=>liveMonthBounds('2026-13')).toThrow();
  expect(liveMonthOptions('2026-09-30T22:00:00Z',Date.parse('2026-11-01T00:00:00Z')).map(m=>m.label)).toEqual(['Live-Watcher · November 2026','Live-Watcher · Oktober 2026']);
 });
 it('counts entry IDs once, retains original versions and never synthesizes outcomes',()=>{
  const rows=[event('original'),event('original'),event('prewarning',1),event('other'),{...event('problem'),kind:'problem'},{...event('outside'),signal_at:'2026-11-01T00:00:00Z'}],before=JSON.stringify(rows);
  const groups=liveMonthGroups(rows,'2026-10');
  expect(groups).toHaveLength(1);expect(groups[0].entries).toHaveLength(2);
  expect(groups[0].entries[0].payload.entry.entryPattern).toBe('countertrend-entry-model-1-v10');
  expect(groups[0].entries[0].payload.variants).toHaveLength(2);
  expect(groups[0].entries[0].payload.variants[0]).not.toHaveProperty('outcome');
  expect(JSON.stringify(rows)).toBe(before);expect(liveMonthGroups(rows,'2026-10','GBPUSD')).toEqual([]);
  expect(liveEntryLink(rows[0]).path).toBe('/');expect(liveEntryLink(rows[0]).query.setup2).toBe('original');
 });
 it('continues capped pages to an empty page and propagates read errors',async()=>{
  const calls=[],client={from:vi.fn(()=>{const q={};for(const name of ['select','eq','gt','gte','lt','order'])q[name]=()=>q;q.range=async(a,b)=>{calls.push([a,b]);return {data:a===0?[event('a')]:a===1?[event('b')]:[],error:null};};return q;})};
  expect(await createLiveWatcherRepository(client).events('2026-10')).toHaveLength(2);
  expect(calls.map(c=>c[0])).toEqual([0,1,2]);
  client.from=()=>{const q={};for(const name of ['select','eq','gt','gte','lt','order'])q[name]=()=>q;q.range=async()=>({error:new Error('read failed')});return q;};
  await expect(createLiveWatcherRepository(client).events('2026-10')).rejects.toThrow('read failed');
 });
 it('uses the common dataset path without deriving commission or outcomes',async()=>{
  const run='live-watcher:2026-10',snapshots=liveWatcherSnapshots([event('original')],run),results=snapshots.flatMap(liveWatcherEntryResults);
  const repository={listRuns:vi.fn(async()=>[liveWatcherRun({id:run})]),listReviewMetadata:vi.fn(async()=>snapshots),listResults:vi.fn(async()=>results),listRunDrCounts:vi.fn(async()=>new Map())},scope=effectScope();
  const state=scope.run(()=>useSimulationComparison(repository,ref({run,compare:''}),ref([])));
  await vi.waitFor(()=>expect(state.loading.value).toBe(false));
  expect(state.error.value).toBe('');expect(repository.listReviewMetadata).toHaveBeenCalledWith(run);expect(state.current.value.groups).toHaveLength(1);
  expect(state.current.value.results[0]).toMatchObject({status:'notStored',commissionUsd:null,netPnlUsd:null});scope.stop();
 });
});

it('normalizes legacy month aliases for both statistics and chart selection while retaining ordinary run IDs',async()=>{
 const {liveMonthViewId}=await import('../src/liveWatcherMonth.js');
 expect(liveMonthViewId('live-watcher:2026-10:catchup')).toBe('live-watcher:2026-10');
 expect(liveMonthViewId('live-watcher:2026-10')).toBe('live-watcher:2026-10');expect(liveMonthViewId('saved-run')).toBe('saved-run');
});
