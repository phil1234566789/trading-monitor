import {afterEach,expect,it,vi} from 'vitest';
import {effectScope,nextTick,ref} from 'vue';
import {useJournalExecutionDraft} from '../src/composables/useJournalExecutionDraft.js';
let scope;
afterEach(()=>scope?.stop());
function setup(){
 const original={id:151,dealingRangeId:128,instrument:'XAUUSD',entryPrice:4113.31,stopLoss:4117.98,exitPrice:4095.36};
 const trade=ref(original),positions=ref([original,{...original,id:152,entryPrice:4112.1}]),loading=ref(false);
 const callbacks={started:vi.fn(),cancelled:vi.fn(),created:vi.fn()},refresh=vi.fn().mockResolvedValue(true);
 scope=effectScope();return {trade,positions,loading,callbacks,refresh,draft:scope.run(()=>useJournalExecutionDraft({trade:()=>trade.value,positions,loading,refresh,...callbacks}))};
}
it('keeps both saved cards, creates only one sibling draft and cancels only that draft',async()=>{
 const {draft,positions,callbacks}=setup();
 expect(await draft.start()).toBe(true);const key=draft.draftKey.value;
 expect(draft.visiblePositions.value.map(p=>p.id)).toEqual([151,152]);expect(await draft.start()).toBe(false);
 expect(draft.draftKey.value).toBe(key);expect(callbacks.started).toHaveBeenCalledTimes(1);
 draft.cancel();expect(draft.visiblePositions.value).toEqual(positions.value);expect(draft.draftKey.value).toBeNull();
 await draft.start();expect(draft.draftKey.value).not.toBe(key);
});
it('retains the additional card while an existing-card refresh happens',async()=>{
 const {draft,positions}=setup();await draft.start();const key=draft.draftKey.value;
 positions.value=positions.value.map(p=>({...p,reasoning:'saved elsewhere'}));await draft.reload();
 expect(draft.draftKey.value).toBe(key);expect(draft.visiblePositions.value).toHaveLength(2);
});
it('replaces the successfully created draft with exactly one persisted card and does not create another draft',async()=>{
 const {draft,positions,refresh,callbacks}=setup();await draft.start();const key=draft.draftKey.value;
 refresh.mockImplementation(async()=>{positions.value=[...positions.value,{id:153,dealingRangeId:128}];
  expect(draft.visiblePositions.value.map(p=>p.id)).toEqual([151,152]);return true;});
 await draft.onCreated(153,5,key);
 expect(draft.visiblePositions.value.map(p=>p.id)).toEqual([151,152,153]);expect(draft.draftKey.value).toBeNull();
 expect(callbacks.created).toHaveBeenCalledExactlyOnceWith(153,5);
});
it('keeps a saved-but-not-yet-loaded draft guarded through a loading failure and retry',async()=>{
 const {draft,positions,refresh}=setup();await draft.start();const key=draft.draftKey.value;
 refresh.mockResolvedValue(false);await draft.onCreated(153,5,key);expect(draft.draftKey.value).toBe(key);
 refresh.mockImplementation(async()=>{positions.value.push({id:153});return true;});await draft.reload();expect(draft.draftKey.value).toBeNull();
});
it('discards a draft on a different DR and ignores late callbacks for that former draft',async()=>{
 const {draft,trade,callbacks}=setup();await draft.start();const old=draft.draftKey.value;
 trade.value={...trade.value,dealingRangeId:129};await nextTick();await draft.onCreated(153,5,old);
 expect(draft.draftKey.value).toBeNull();expect(callbacks.created).not.toHaveBeenCalled();
});
