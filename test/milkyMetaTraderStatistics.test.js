import {describe,it,expect} from 'vitest';
import {closedBrokerTrades,statisticsGroups,filterBrokerTrades} from '../src/milkyMetaTraderStatistics.js';
const entry={id:1,account_id:'a',ticket:1,position_id:42,time_msc:Date.parse('2026-10-29T08:30:00Z'),type:1,entry:0,symbol:'XAUUSD.gbe',volume:.01,price:4020,profit:0,commission:-.05,swap:0,fee:0,currency:'USD'};
const exit={...entry,id:2,ticket:2,time_msc:Date.parse('2026-10-29T09:30:00Z'),type:0,entry:1,price:4010,profit:10,commission:-.05};
describe('native broker statistics',()=>{
 it('counts actual closed positions with all deal costs, not deposits',()=>{
  const data=closedBrokerTrades([entry,exit,{...entry,ticket:3,type:2,position_id:0,volume:0,price:0,profit:50000}]);
  expect(data.trades).toHaveLength(1);expect(data.trades[0].net).toBeCloseTo(9.9);expect(data.trades[0].direction).toBe('short');
 });
 it('combines partial exits and assigned standalone costs without counting a partial position closed',()=>{
  const part={...exit,volume:.004,profit:4};
  expect(closedBrokerTrades([entry,part]).trades).toHaveLength(0);
  const data=closedBrokerTrades([entry,part,{...exit,ticket:4,volume:.006,profit:6},{...exit,ticket:5,type:7,volume:0,profit:-1,commission:0}]);
  expect(data.trades[0].net).toBeCloseTo(8.85);
 });
 it('keeps accounts separate and excludes missing entries and reversals explicitly',()=>{
  expect(closedBrokerTrades([entry,{...exit,account_id:'b'}]).trades).toHaveLength(0);
  expect(closedBrokerTrades([entry,{...exit,entry:2}]).excluded).toBe(1);
 });
 it('assigns weekday and hour to Berlin entry time with DST',()=>{
  const data=closedBrokerTrades([entry,exit]).trades;
  expect(statisticsGroups(data,'hour')[0].label).toBe('09:00–09:59');
  expect(statisticsGroups(data,'weekday')[0].label).toBe('Donnerstag');
  const summer=closedBrokerTrades([{...entry,time_msc:Date.parse('2026-07-02T08:30:00Z')},{...exit,time_msc:Date.parse('2026-07-02T09:30:00Z')}]).trades;
  expect(statisticsGroups(summer,'hour')[0].label).toBe('10:00–10:59');
 });
 it('filters currency/account and Berlin close day before combining PnL',()=>{
  const trades=closedBrokerTrades([entry,exit]).trades;
  expect(filterBrokerTrades(trades,{currency:'EUR'})).toHaveLength(0);
  expect(filterBrokerTrades(trades,{currency:'USD',from:'2026-10-29',to:'2026-10-29'})).toHaveLength(1);
  expect(filterBrokerTrades(trades,{account:'b'})).toHaveLength(0);
 });
 it('deduplicates replayed deal tickets within an account',()=>{
  expect(closedBrokerTrades([entry,exit,entry,exit]).trades[0].net).toBeCloseTo(9.9);
 });
});
