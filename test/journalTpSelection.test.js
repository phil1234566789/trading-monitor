import {expect,it} from 'vitest';
import {journalTpHits,journalTpPrefill,createJournalTpChartSelection} from '../src/journalTpSelection.js';
const trade={id:7,cardKey:'draft:2',dealingRangeId:3,instrument:'XAUUSD',direction:'long',entryPrice:100,entryTime:120,
 targets:[{id:1,price:110,sourceTime:0},{id:2,price:115,sourceTime:0}],invalidation:90};
const candles=[{time:60,low:80,high:120},{time:120,low:95,high:110},{time:180,low:90,high:115},{time:240,low:80,high:120}];
it('finds every exact existing line touched after entry on closed nonignored native M1 candles',()=>{
 expect(journalTpHits(candles,trade,240).map(c=>[c.time,c.lines.map(l=>l.key)]))
  .toEqual([[120,['target:1']],[180,['target:1','target:2','invalidation']]]);
 expect(journalTpHits(candles,{...trade,entryTime:121},240).map(c=>c.time)).toEqual([180]);
 expect(journalTpHits(candles.map(c=>({...c,ignored:true})),trade,240)).toEqual([]);
 expect(journalTpHits(candles,{...trade,entryTime:null},240)).toEqual([]);
 expect(journalTpHits(candles,{...trade,entryPrice:null},240)).toEqual([]);
 expect(journalTpHits(candles,{...trade,targets:[],invalidation:null},240)).toEqual([]);
 expect(journalTpHits(candles,{...trade,targets:[{id:3,price:110}],invalidation:null},240)).toEqual([]);
});
it('never treats the target source candle or earlier candles as retouches',()=>{
 const later={...trade,targets:[{id:1,price:110,sourceTime:180}],invalidation:null};
 expect(journalTpHits(candles,later,300).map(hit=>hit.time)).toEqual([240]);
});
it('paints pink, requires a candle hit, respects replay and M1 and returns every line without invented outcome',()=>{
 let input={candles,bar:'1m',nowSec:300,replayUntil:180,selection:{...trade,draftToken:4}};
 const picker=createJournalTpChartSelection(()=>input);
 expect(picker.paint(candles,'pink').filter(c=>c.color==='pink').map(c=>c.time)).toEqual([120,180]);
 const selected=picker.select(180,100);expect(selected.lines).toHaveLength(3);
 expect(selected.outcome).toBeUndefined();expect(selected.time).toBe(180);
 expect(picker.select(180,120)).toBeNull();expect(picker.select(240,100)).toBeNull();
 input={...input,bar:'5m'};expect(picker.paint(candles,'pink')).toBe(candles);expect(picker.select(180,100)).toBeNull();
 input={...input,bar:'1m',selection:null};expect(picker.select(180,100)).toBeNull();
});
it('prefills only chosen line and minute, rejecting stale card, entry, line, token, range or symbol',()=>{
 const armed={...trade,draftToken:4},result={time:180,lines:[{key:'target:2',price:115}],target:armed};
 expect(journalTpPrefill(result,'target:2',armed,trade,'XAUUSD')).toEqual({exitPrice:115,exitTime:180});
 expect(journalTpPrefill(result,'target:1',armed,trade,'XAUUSD')).toBeNull();
 for(const patch of [{cardKey:'draft:3'},{entryTime:180},{entryPrice:101},{dealingRangeId:4},{targets:[]},{targets:trade.targets.map(t=>({...t,sourceTime:180}))},{invalidation:89}])
  expect(journalTpPrefill(result,'target:2',armed,{...trade,...patch},'XAUUSD')).toBeNull();
 expect(journalTpPrefill(result,'target:2',{...armed,draftToken:5},trade,'XAUUSD')).toBeNull();
 expect(journalTpPrefill(result,'target:2',armed,trade,'EURUSD')).toBeNull();
});
