import {describe,it,expect} from 'vitest';
import {riskBudget,riskVolume,riskPreviewMetrics} from '../supabase/functions/trading-monitor-mcp/mt5RiskContract.js';
const now=1800000000,policy={revision:'c297afbf-172c-4304-99e7-eb1198191050',confirmed_balance:50000,confirmed_equity:50000,risk_base:50000,cost_buffer:10,currency:'USD',drawdown_floor:47000,valid_until_sec:now+60,day:'2027-01-15'};
const snapshot={balance:50000,equity:50000,currency:'USD',hedging:true,positions:[],pending_orders:0,risk_guards_ready:true,risk:{time:now,day:policy.day,realized_net_day:0,open_loss:0,latched:false,remaining_risk:0}};
describe('MMT joint risk budget',()=>{
 it('shares .9% across same-market positions; full cannot add another .9%',()=>{
  const s={...snapshot,positions:[{symbol:'GBPUSD.gbe',risk_to_sl:240,remaining_risk_to_sl:240}]};
  expect(riskBudget('full','GBPUSD.gbe',s,policy,now).available).toBeCloseTo(190);
  expect(riskBudget('risky','GBPUSD.gbe',s,policy,now).available).toBeCloseTo(190);
  expect(riskBudget('full','XAUUSD.gbe',s,policy,now).available).toBeCloseTo(440);
 });
 it('uses the tighter daily and broker floors after all open risks',()=>{
  expect(riskBudget('full','GBPUSD.gbe',{...snapshot,risk:{...snapshot.risk,realized_net_day:-850}},policy,now).available).toBe(140);
  expect(riskBudget('full','GBPUSD.gbe',{...snapshot,equity:47100},policy,now).available).toBe(90);
 });
 it('fails closed without confirmed basis, daily guard, valid stop risk or current inputs',()=>{
  for(const s of [{...snapshot,risk_guards_ready:false},{...snapshot,risk:{...snapshot.risk,latched:true}},{...snapshot,positions:[{symbol:'GBPUSD.gbe',risk_to_sl:null,remaining_risk_to_sl:null}] }])expect(()=>riskBudget('full','GBPUSD.gbe',s,policy,now)).toThrow();
  expect(()=>riskBudget('full','GBPUSD.gbe',snapshot,null,now)).toThrow();
  expect(()=>riskBudget('full','GBPUSD.gbe',snapshot,policy,now+61)).toThrow();
 });
 it('invalidates an observed new high instead of assuming an unchanged trailing floor',()=>{
  expect(()=>riskBudget('full','GBPUSD.gbe',{...snapshot,equity:50001},policy,now)).toThrow('risk_floor_reconfirmation_required');
 });
 it('computes a dynamic preview from native gold versus forex slope',()=>{
  const input={symbol:'XAUUSD.gbe',direction:'short',stop_loss:4030,take_profit:null,risk_mode:'risky'};
  const q={symbol:input.symbol,bid:4020,ask:4020.1,time:now,point:.001,stops_level:.01,minimum_volume:.01,maximum_volume:100,volume_step:.01,loss_per_unit_short:1};
  const result=riskPreviewMetrics(input,{...snapshot,quotes:[q]},policy,now);
  expect(result.volume).toBe(.24);expect(result.rr).toBeNull();expect(result.risk).toBe(240);
  expect(riskPreviewMetrics({...input,symbol:'GBPUSD.gbe',stop_loss:1.31},{...snapshot,quotes:[{...q,symbol:'GBPUSD.gbe',bid:1.3,ask:1.3001,point:.00001,stops_level:.00001,loss_per_unit_short:1000}]},policy,now).volume).toBe(.24);
 });
 it('rounds down to native lot step and never invents a fractional broker minimum',()=>{
  expect(riskVolume(250,1000,{minimum_volume:.01,maximum_volume:100,volume_step:.01})).toBe(.25);
  expect(()=>riskVolume(1,1000,{minimum_volume:.01,maximum_volume:100,volume_step:.01})).toThrow();
 });
});
