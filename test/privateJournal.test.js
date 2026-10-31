import {describe,it,expect} from 'vitest';
import {loadPrivateJournalPages} from '../src/privateJournal.js';
import {computeTradeStats} from '../src/tradeStats.js';
import {fmtMoney} from '../src/format.js';
describe('private journal',()=>{
 it('preserves native account currency while retaining manual USD formatting',()=>{
  expect(fmtMoney(-12.5,'EUR')).toBe('-12.50 EUR');expect(fmtMoney(7,'GBP')).toBe('7.00 GBP');expect(fmtMoney(-12.5)).toBe('-$12.50');
 });
 it('continues after short pages and uses actual server cursor until empty',async()=>{
  const seen=[];const api=async(action,input)=>{seen.push(input.after_id);return input.after_id===undefined?{rows:[{id:2}],next_cursor:2}:input.after_id===2?{rows:[{id:5}],next_cursor:5}:{rows:[],next_cursor:null};};
  expect(await loadPrivateJournalPages('journal_positions',{instrument:'XAUUSD'},api)).toEqual([{id:2},{id:5}]);
  expect(seen).toEqual([undefined,2,5]);
 });
 it('rejects a broken cursor instead of silently omitting data',async()=>{
  await expect(loadPrivateJournalPages('journal_comments',{},async()=>({rows:[{id:1}],next_cursor:null}))).rejects.toThrow();
 });
 it('keeps unproven broker risk out of R averages',()=>{
  expect(computeTradeStats([{outcome:'win',rMultiple:2},{outcome:'loss',rMultiple:null},{outcome:'win',rMultiple:0}])).toMatchObject({avgR:1,totalR:2,knownR:2,unknownR:1,wins:2,losses:1});
  expect(computeTradeStats([{outcome:'loss',rMultiple:null}]).avgR).toBeNull();
 });
});
