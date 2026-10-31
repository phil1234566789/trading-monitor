import {describe,it,expect} from 'vitest';
import {tradingDay,evaluateDailyStop,assertDailyStopSnapshot,guardCommandsForExposure} from '../supabase/functions/trading-monitor-mcp/dailyStopContract.js';
const at=s=>Date.parse(s)/1000;
const now=at('2026-10-31T12:00:00Z'),window=tradingDay(now);
const snapshot=(net,open)=>({currency:'USD',equity:50000,risk:{day:window.day,time:now,realized_net_day:net,open_loss:open}});
describe('persistent daily-stop policy boundary',()=>{
 it('uses actual Berlin midnight across both DST switches',()=>{
  expect(tradingDay(at('2026-03-29T12:00:00Z')).day_end_sec-tradingDay(at('2026-03-29T12:00:00Z')).day_start_sec).toBe(23*3600);
  expect(tradingDay(at('2026-10-25T12:00:00Z')).day_end_sec-tradingDay(at('2026-10-25T12:00:00Z')).day_start_sec).toBe(25*3600);
  expect(tradingDay(at('2026-10-31T23:00:00Z')).day).toBe('2026-11-01');
 });
 it('uses realized net including costs plus only open losses',()=>{
  expect(evaluateDailyStop(snapshot(-700,-300),window,null,now)).toBe('daily_loss');
  expect(evaluateDailyStop(snapshot(-700,-299.99),window,null,now)).toBeNull();
  expect(evaluateDailyStop(snapshot(-1001,0),window,null,now)).toBe('daily_loss');
 });
 it('prefers an independently reached broker drawdown floor',()=>{
  expect(evaluateDailyStop(snapshot(100,0),window,{drawdown_floor:50001,valid_until_sec:now+60,currency:'USD'},now)).toBe('broker_drawdown');
  expect(evaluateDailyStop(snapshot(100,0),window,{drawdown_floor:50001,valid_until_sec:now-1,currency:'USD'},now)).toBeNull();
 });
 it('never treats stale or different-currency data as a valid protection check',()=>{
  expect(()=>evaluateDailyStop({...snapshot(0,0),currency:'EUR'},window,null,now)).toThrow();
  expect(()=>evaluateDailyStop(snapshot(0,0),window,null,now+6)).toThrow();
  expect(()=>evaluateDailyStop(snapshot(0,1),window,null,now)).toThrow();
 });
});

it('never retries unknown close, but assigns a fresh attempt after a definite rejection and backoff',()=>{
 const exposure={positions:[{ticket:7,volume:.01,symbol:'GBPUSD'}],orders:[]};
 const row={kind:'close',ticket:7,expected_volume:.01,attempt:0,status:'unknown',updated_at:new Date(now*1000).toISOString(),result:{reason:'guard_broker_rejected'}};
 expect(guardCommandsForExposure(exposure,[row],now+100)).toEqual([]);
 row.status='rejected';expect(guardCommandsForExposure(exposure,[row],now+4)).toEqual([]);
 expect(guardCommandsForExposure(exposure,[row],now+5)[0].attempt).toBe(1);
});
it('requires current guard capability and a hedge account for every entry mode',()=>{
 const value={...snapshot(0,0),risk_guards_ready:true,hedging:true,risk:{...snapshot(0,0).risk,latched:false}};
 expect(()=>assertDailyStopSnapshot(value,now)).not.toThrow();
 expect(()=>assertDailyStopSnapshot({...value,risk_guards_ready:false},now)).toThrow();
 expect(()=>assertDailyStopSnapshot({...value,risk:{...value.risk,latched:true}},now)).toThrow();
});
