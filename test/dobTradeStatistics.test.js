import {describe,expect,it} from 'vitest';
import {dobGroups,dobRouteStats,dobTradeMonth,dobTradeSessions,dobChartLink,dobSourceLabel,dobTradePinKey,matchDobTradePins,dobMaxRBucket,dobMaxRShares,dobTargetOutcome,dobTradeR} from '../src/dobTradeStatistics.js';

// 12.11.2026 14:10 Berlin (CET) = 13:10 UTC
const at=Date.UTC(2026,10,12,13,10)/1000;
const row=(route,outcome,extra={})=>({route,outcome,recognized_at:at,entry_time:at,instrument:'XAUUSD',id:'run:x:a',setup_id:'x:a',exit_time:null,...extra});

describe('dobTradeStatistics',()=>{
 it('zählt je Route wie die Messung, offene außerhalb der Winrate',()=>{
  const r=dobRouteStats([row('a','success'),row('a','loss'),row('a','loss'),row('a','open'),row('b','loss')]);
  expect(r.a).toMatchObject({success:1,loss:2,open:1,sumR:0});
  expect(r.a.winrate).toBeCloseTo(1/3);
  expect(r.b).toMatchObject({success:0,loss:1,sumR:-1});
 });
 it('ordnet Sessions nach Berliner Entry-Zeit zu, auch mehrere',()=>{
  const sessions=[{label:'NY',from_minutes:14*60,to_minutes:22*60,days:null},{label:'MMM',from_minutes:14*60,to_minutes:15*60,days:[1,2,3,4,5]},{label:'Asia',from_minutes:1*60,to_minutes:9*60,days:null}];
  expect(dobTradeSessions(row('a','success'),sessions)).toEqual(['NY','MMM']);
  const groups=dobGroups([row('a','success'),row('a','loss',{entry_time:at-16*3600})],r=>{const s=dobTradeSessions(r,sessions);return s.length?s:['ohne Session'];});
  expect(groups.map(g=>[g.key,g.count])).toEqual([['NY',1],['MMM',1],['ohne Session',1]]);
 });
 it('Monat nach Berliner Erkennung, Chart-Link am Ausgang',()=>{
  expect(dobTradeMonth({recognized_at:Date.UTC(2026,0,31,23,30)/1000})).toBe('2026-02');
  expect(dobChartLink(row('a','success',{exit_time:at+600})).query).toEqual({dob:'run:x:a',instrument:'XAUUSD',bar:'1m',replay:String(at+600)});
  expect(dobChartLink(row('a','open')).query.replay).toBe(String(at+300));
 });
 it('Kraftquelle aus den v1-Feldern, v0 ohne',()=>{
  expect(dobSourceLabel({source_kind:null})).toBe('–');
  expect(dobSourceLabel({source_kind:'ob_h1',source_distance_atr:0.84,source_distance_usd:12})).toBe('H1-OB · 0,8 ATR');
  expect(dobSourceLabel({source_kind:'ob_h4',source_distance_atr:null,source_distance_usd:12.5})).toBe('H4-OB · 12,5 USD');
 });
 it('Pin-Schlüssel ist laufunabhängig, Zeile und Pin-Kontext ergeben denselben',()=>{
  const trade={instrument:'XAUUSD',direction:'short',entry_time:at,entry_price:3867.93,stop_price:3875.6};
  expect(dobTradePinKey({...trade,id:'dob-setup-v1:x',run_id:'dob-setup-v1'})).toBe(dobTradePinKey({...trade,id:'dob-setup-v2:x',run_id:'dob-setup-v2'}));
  expect(dobTradePinKey(trade)).toBe(`XAUUSD:short:${at}:3867.93:3875.6`);
 });
 it('ordnet Pins laufübergreifend wie /statistik zu: Zeit, Preis nur als Tiebreak, mehrdeutig = keiner',()=>{
  const base={instrument:'XAUUSD',direction:'short',entry_time:at};
  const pin=ctx=>({dobTradeContext:{...base,...ctx}});
  const rows=[{...base,id:'v2:a',entry_price:10,stop_price:12},{...base,id:'v2:b',entry_price:11,stop_price:13},{...base,id:'v2:c',entry_time:at+60,entry_price:9,stop_price:99}];
  const m=matchDobTradePins([pin({entry_price:11,stop_price:20}),pin({entry_time:at+60,entry_price:5})],rows);
  expect(m.get('v2:b')).toBeTruthy();
  expect(m.get('v2:c')).toBeTruthy();
  expect(matchDobTradePins([pin({entry_price:99})],rows).size).toBe(0);
 });
 it('Max R: Stufen-Bucket und Anteile der entschiedenen Trades',()=>{
  expect([1.5,2,3.5,null].map(max_r=>dobMaxRBucket({max_r}))).toEqual(['<2','2','3.5',null]);
  const shares=dobMaxRShares([{outcome:'loss',max_r:1},{outcome:'success',max_r:3},{outcome:'success',max_r:5},{outcome:'success',max_r:2},{outcome:'unknown',max_r:5}]);
  expect(shares).toEqual({n:4,r3:0.5,r4:0.25,r5:0.25});
 });
 it('R-Ziel aus max_r und sl_hit: Win, Loss, offen; ΣR mit +k',()=>{
  const rows=[{route:'a',outcome:'success',max_r:3.5,sl_hit:true},{route:'a',outcome:'success',max_r:2,sl_hit:false},{route:'a',outcome:'loss',max_r:1,sl_hit:true}];
  expect(rows.map(r=>dobTargetOutcome(r,3))).toEqual(['success','open','loss']);
  expect(dobRouteStats(rows,3).a).toMatchObject({success:1,loss:1,open:1,sumR:2});
  expect(dobRouteStats(rows,2).a).toMatchObject({success:2,loss:1,sumR:3});
  expect(dobTargetOutcome({outcome:'loss',max_r:null},2)).toBe('loss');
  expect(dobTargetOutcome({outcome:'loss',max_r:null},3)).toBe('unknown');
  expect(dobTradeR(rows[0],3)).toBe(3);
  expect(dobTargetOutcome({outcome:'unknown',max_r:0.5,sl_hit:false},3)).toBe('unknown');
  expect([2,3].map(k=>dobTargetOutcome({max_r:1.5,sl_hit:true,ambiguous_r:2.5},k))).toEqual(['ambiguous','loss']);
 });
});
