import {it,expect} from 'vitest';
import {tradeCalendarWeeks} from '../src/milkyMetaTraderWeeks.js';
const trade=(id,at)=>({id,closed_at:Date.parse(at)});
it('keeps all trades in Monday–Sunday Berlin weeks, independent of a 50-row page limit',()=>{
 const trades=Array.from({length:75},(_,i)=>trade(String(i),'2026-11-01T22:59:59Z'));
 const weeks=tradeCalendarWeeks([...trades,trade('monday','2026-11-01T23:00:00Z')]);
 expect(weeks.map(w=>[w.key,w.end,w.number,w.trades.length])).toEqual([
  ['2026-11-02','2026-11-08',45,1],['2026-10-26','2026-11-01',44,75],
 ]);
});
it('uses the ISO week year across New Year and includes empty calendar weeks',()=>{
 const weeks=tradeCalendarWeeks([trade('a','2020-12-31T12:00:00Z'),trade('b','2021-01-18T12:00:00Z')]);
 expect(weeks.map(w=>[w.year,w.number,w.trades.length])).toEqual([[2021,3,1],[2021,2,0],[2021,1,0],[2020,53,1]]);
 expect(tradeCalendarWeeks([])).toEqual([]);
});
it('assigns summer and winter boundary instants to the correct Berlin calendar date',()=>{
 for(const [sunday,monday] of [['2026-03-29T21:59:59Z','2026-03-29T22:00:00Z'],['2026-10-25T22:59:59Z','2026-10-25T23:00:00Z']]){
  const weeks=tradeCalendarWeeks([trade('sun',sunday),trade('mon',monday)]);
  expect(weeks).toHaveLength(2);
  expect(weeks[0].trades[0].id).toBe('mon');
  expect(weeks[1].trades[0].id).toBe('sun');
 }
});
