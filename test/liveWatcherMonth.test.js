import {describe,it,expect,vi} from 'vitest';
import {ref,effectScope,createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
import SimulationComparisonFilters from '../src/components/SimulationComparisonFilters.vue';
import {liveMonthBounds,liveMonthOptions,liveMonthGroups,createLiveWatcherRepository,liveEntryLink} from '../src/liveWatcherMonth.js';
import {liveEntryPriceLevels} from '../src/liveWatcherEntryLevels.js';
import {useSimulationComparison} from '../src/composables/useSimulationComparison.js';
const event=(id,stage=3)=>({id:'alarm:'+id,kind:'trading',stage,instrument:'EURUSD',setup_key:'EURUSD:setup1:16107',direction:'short',signal_at:'2026-10-09T07:28:00Z',payload:{entry:{id,recognizedAt:1791530880,entryCategory:'risky',entryPattern:'countertrend-entry-model-1-v10'},variants:[{variant:'wide',lots:4},{variant:'narrow',lots:8}]}});
describe('persisted live watcher month',()=>{
 it('uses only saved entry, stops and targets for chart lines and scaling',()=>{
   const entry={price:1.12,stops:{wide:{price:1.13},narrow:{price:1.125}},scales:{wide:{targets:[{label:'T1',price:1.11},{label:'T2',price:1.10}]}}},before=JSON.stringify(entry);
   expect(liveEntryPriceLevels(entry).map(l=>[l.title,l.price])).toEqual([['Entry',1.12],['Weiter SL',1.13],['Enger SL',1.125],['T1',1.11],['T2',1.1]]);
   expect(liveEntryPriceLevels({price:1.12})).toHaveLength(1);expect(JSON.stringify(entry)).toBe(before);
 });
 it('renders the monthly dropdown and disables unavailable simulation filters',async()=>{
  const html=await renderToString(createSSRApp(SimulationComparisonFilters,{modelValue:{run:'live-watcher:2026-10'},runs:[],features:[],liveMonths:liveMonthOptions(null,Date.parse('2026-10-14'))}));
  expect(html).toContain('Live-Watcher · Oktober 2026');expect(html).toContain('value="live-watcher:2026-10"');expect(html).toContain('disabled');
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
  expect(liveEntryLink(rows[0]).query.event).toBe('alarm:original');
 });
 it('continues capped pages to an empty page and propagates read errors',async()=>{
  const calls=[],client={from:vi.fn(()=>{const q={};for(const name of ['select','eq','gt','gte','lt','order'])q[name]=()=>q;q.range=async(a,b)=>{calls.push([a,b]);return {data:a===0?[event('a')]:a===1?[event('b')]:[],error:null};};return q;})};
  expect(await createLiveWatcherRepository(client).events('2026-10')).toHaveLength(2);
  expect(calls.map(c=>c[0])).toEqual([0,1,2]);
  client.from=()=>{const q={};for(const name of ['select','eq','gt','gte','lt','order'])q[name]=()=>q;q.range=async()=>({error:new Error('read failed')});return q;};
  await expect(createLiveWatcherRepository(client).events('2026-10')).rejects.toThrow('read failed');
 });
 it('never reads or recalculates a simulation dataset for a live selection',async()=>{
  const repository={listRuns:vi.fn(async()=>[]),listReviewMetadata:vi.fn(),listResults:vi.fn(),listRunDrCounts:vi.fn(async()=>new Map())},scope=effectScope();
  const state=scope.run(()=>useSimulationComparison(repository,ref({run:'live-watcher:2026-10',compare:'historical'}),ref([])));
  await vi.waitFor(()=>expect(state.loading.value).toBe(false));
  expect(state.error.value).toBe('');expect(repository.listReviewMetadata).not.toHaveBeenCalled();expect(repository.listResults).not.toHaveBeenCalled();scope.stop();
 });
});

