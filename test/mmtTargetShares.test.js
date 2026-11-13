import {afterEach,expect,it} from 'vitest';
import {targetShares,splitTargetShares,redistributeTargetShares} from '../src/mmtTargetShares.js';
import {setTargetDraft,useTargetDraft,removeTargetDraft,splitTargetDraft,changeTargetShare} from '../src/mmtTargetDrafts.js';
import {targetDraftAllocation} from '../supabase/functions/trading-monitor-mcp/targetPlanContract.js';
afterEach(()=>{removeTargetDraft('one');removeTargetDraft('other');});
it('splits a full target 50/50 and redistributes 75/25 without touching prices',()=>{
 const split=splitTargetShares([{price:2010,volume:.7}],0,.7);
 expect(split.map(t=>t.percent)).toEqual([50,50]);
 expect(redistributeTargetShares(split,0,75,.7).map(t=>t.percent)).toEqual([75,25]);
 expect(split.map(t=>t.price)).toEqual([2010,2010]);
});
it('keeps unallocated exposure free and adjusts several targets proportionally',()=>{
 const split=splitTargetShares([{price:2010,volume:.4}],0,1);
 expect(split.map(t=>t.percent)).toEqual([20,20]);
 expect(redistributeTargetShares(split,0,30,1).map(t=>t.percent)).toEqual([30,10]);
 const targets=[{price:1,percent:50},{price:2,percent:30},{price:3,percent:20}];
 expect(redistributeTargetShares(targets,0,75,1).map(t=>t.percent)).toEqual([75,15,10]);
 expect(redistributeTargetShares(targets,0,100,1)).toBeNull();
});
it('preserves native lot steps and leaves blank quantities unallocated when splitting',()=>{
 const split=splitTargetShares([{price:2010,volume:.04},{price:2020,volume:.4}],1,.7);
 expect(targetDraftAllocation(split,.7,.01)).toEqual({targets:[{price:2010,volume:.04},{price:2020,volume:.2},{price:2020,volume:.2}],remainder:.26});
 const blank=splitTargetShares([{price:2010,volume:.4},{price:2020,volume:''}],0,1);
 expect(targetDraftAllocation(blank,1,.01)).toEqual({targets:[{price:2010,volume:.2},{price:2020,volume:0},{price:2010,volume:.2}],remainder:.6});
});
it('splits only one account draft, keeps the five target cap and requires an explicit save elsewhere',()=>{
 const draft={symbol:'XAUUSD',positionVolume:1,targets:[{price:2010,volume:1}],dirty:false};
 setTargetDraft('one',draft);setTargetDraft('other',draft);
 expect(splitTargetDraft('one',0)).toBe(1);expect(changeTargetShare('one',0,75)).toBe(true);
 expect(useTargetDraft('one').value.targets.map(t=>t.percent)).toEqual([75,25]);
 expect(useTargetDraft('other').value).toEqual({...draft,selectedIndex:null});
 for(let i=0;i<10;i++)splitTargetDraft('one',0);
 expect(useTargetDraft('one').value.targets).toHaveLength(5);
 expect(useTargetDraft('one').value.dirty).toBe(true);
 expect(targetShares([{price:1,volume:.4}],.5)).toEqual([80]);
});
