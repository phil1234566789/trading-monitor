import {it,expect} from 'vitest';
import {m5EntryHistoryKnown} from '../src/m5EntryHistory.js';
const at=text=>Date.parse(text)/1000;
const weekend=[{instrument:'GBPUSD',fromMinutes:1380,toMinutes:4260,days:[5]}];
it.each([
 ['2026-10-23T23:00:00+02:00','2026-10-25T23:00:00+01:00'],
 ['2027-03-26T23:00:00+01:00','2027-03-28T23:00:00+02:00'],
 ['2026-10-25T22:00:00+01:00','2026-10-25T23:00:00+01:00']
])('uses actual Berlin closure boundaries including DST and an already-running closure (%s)',(from,to)=>{
 expect(m5EntryHistoryKnown([],at(from),at(to),weekend,'GBPUSD')).toBe(true);
 expect(m5EntryHistoryKnown([],at(from),at(to)+300,weekend,'GBPUSD')).toBe(false);
});
it('never forgives a post-reopening missing hour in spring, or a normal trading hole',()=>{
 expect(m5EntryHistoryKnown([],at('2027-03-26T23:00:00+01:00'),at('2027-03-29T00:00:00+02:00'),weekend,'GBPUSD')).toBe(false);
 const start=at('2026-10-07T10:00:00+02:00'),c=time=>({time,open:1,high:2,low:0,close:1});
 expect(m5EntryHistoryKnown([c(start),c(start+300)],start,start+600,[],'GBPUSD')).toBe(true);
 expect(m5EntryHistoryKnown([c(start)],start,start+600,[],'GBPUSD')).toBe(false);
 expect(m5EntryHistoryKnown([{...c(start),close:NaN}],start,start+300,[],'GBPUSD')).toBe(false);
});
it('uses only configured ignored intervals, not every forbidden session',()=>{
 const from=at('2026-10-07T23:00:00+02:00'),to=from+3600;
 const session={instrument:'GBPUSD',fromMinutes:1380,toMinutes:0,days:[3],danger:'forbidden'};
 expect(m5EntryHistoryKnown([],from,to,[session],'GBPUSD')).toBe(false);
 expect(m5EntryHistoryKnown([],from,to,[{...session,ignoreLiquidity:true}],'GBPUSD')).toBe(true);
 expect(m5EntryHistoryKnown([],from,to,[{...session,ignoreLiquidity:true,instrument:'EURUSD'}],'GBPUSD')).toBe(false);
});
