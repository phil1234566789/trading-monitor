import {expect,it,vi} from 'vitest';
import {journalExecutionCardKey,journalCardArmedAction,useJournalEntryFinder} from '../src/composables/useJournalEntryFinder.js';
it('uses stable card refs and permits prefill only for the active still-open card',()=>{
 const changed=vi.fn(),finder=useJournalEntryFinder(changed),one={id:151},two={id:152};
 let firstOpen=true,secondOpen=false;
 const a={closeFinder:vi.fn(()=>firstOpen=false),entryTarget:()=>firstOpen?one:null,applyPrefill:vi.fn(()=>true)};
 const b={closeFinder:vi.fn(()=>secondOpen=false),entryTarget:()=>secondOpen?two:null,applyPrefill:vi.fn(()=>true)};
 const ka=journalExecutionCardKey(one),kb=journalExecutionCardKey(two);
 finder.refFor(ka)(a);finder.refFor(kb)(b);expect(finder.refFor(ka)).toBe(finder.refFor(ka));
 finder.open(ka);expect(finder.apply({entryPrice:1},ka)).toBe(true);expect(finder.apply({entryPrice:2},kb)).toBe(false);
 secondOpen=true;finder.open(kb);expect(a.closeFinder).toHaveBeenCalled();
 expect(finder.apply({entryPrice:3},ka)).toBe(false);expect(finder.apply({entryPrice:4},kb)).toBe(true);
 expect(a.applyPrefill).toHaveBeenCalledTimes(1);expect(b.applyPrefill).toHaveBeenCalledTimes(1);
 finder.close(ka);expect(finder.activeKey.value).toBe(kb);
 finder.refFor(kb)(null);expect(finder.resolve(kb)).toBeNull();expect(finder.apply({},kb)).toBe(false);
});
it('does not activate a picker merely by registering a new card and rejects removed/recreated draft keys',()=>{
 const finder=useJournalEntryFinder(vi.fn()),card={closeFinder:vi.fn(),entryTarget:()=>({id:151}),applyPrefill:vi.fn(()=>true)};
 finder.refFor('draft:1')(card);expect(finder.activeKey.value).toBeNull();expect(finder.apply({},'draft:1')).toBe(false);
 finder.open('draft:1');finder.refFor('draft:1')(null);finder.refFor('draft:2')(card);finder.open('draft:2');
 expect(finder.apply({},'draft:1')).toBe(false);finder.closeAll();expect(finder.resolve('draft:2')).toBeNull();
});

it('highlights entry-finder and evidence arms only on their own card',()=>{
 expect(journalCardArmedAction('confirmation',152,'position:151',{id:151})).toBeNull();
 expect(journalCardArmedAction('confirmation',152,'position:151',{id:152})).toBe('confirmation');
 expect(journalCardArmedAction('entryFvgImmediate',152,'position:151',{id:151})).toBe('entryFvgImmediate');
 expect(journalCardArmedAction('entryFvgImmediate',152,'position:151',{id:152})).toBeNull();
 expect(journalCardArmedAction('confirmation',151,'draft:1',{id:151},1)).toBeNull();
});
