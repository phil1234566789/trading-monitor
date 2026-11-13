import {expect,it} from 'vitest';
import {riskPolicyContext} from '../supabase/functions/trading-monitor-mcp/riskPolicyContext.js';
import {riskBudget} from '../supabase/functions/trading-monitor-mcp/mt5RiskContract.js';
import {evaluateDailyStop,tradingDay} from '../supabase/functions/trading-monitor-mcp/dailyStopContract.js';
const policy={revision:'original',day:'2026-11-12',valid_until_sec:1794524400,confirmed_balance:50000,confirmed_equity:50000,risk_base:50000,drawdown_floor:47000,cost_buffer:25,currency:'USD',confirmed_at:'2026-11-12T10:00:00Z'};
it('keeps saved rules across days without changing their revision or confirmation',()=>{
 const now=Date.parse('2026-11-14T08:00:00Z')/1000,p=riskPolicyContext(policy,now);
 expect(p).toEqual({...policy,...{day:tradingDay(now).day,valid_until_sec:tradingDay(now).day_end_sec}});
 expect(policy.day).toBe('2026-11-12');
 expect(riskPolicyContext(null,now)).toBeNull();
 const snapshot={currency:'USD',balance:50000,equity:50000,positions:[],pending_orders:0,risk_guards_ready:true,risk:{day:p.day,time:now,latched:false,realized_net_day:0,open_loss:0}};
 expect(riskBudget('full','XAUUSD.gbe',snapshot,p,now).available).toBeCloseTo(425,8);
 expect(()=>riskBudget('full','XAUUSD.gbe',{...snapshot,risk:{...snapshot.risk,day:policy.day}},p,now)).toThrow('risk_guard_unavailable');
 expect(()=>riskBudget('full','XAUUSD.gbe',{...snapshot,risk:{...snapshot.risk,latched:true}},p,now)).toThrow('risk_guard_unavailable');
 expect(evaluateDailyStop({...snapshot,risk:{...snapshot.risk,realized_net_day:-1000}},tradingDay(now),p,now)).toBe('daily_loss');
 expect(()=>riskBudget('full','XAUUSD.gbe',{...snapshot,equity:50001},p,now)).toThrow('risk_floor_reconfirmation_required');
});
it.each(['2026-03-29T00:30:00Z','2026-10-25T00:30:00Z'])('uses the existing Berlin day boundary through DST: %s',iso=>{
 const now=Date.parse(iso)/1000,p=riskPolicyContext(policy,now);
 expect(p.valid_until_sec).toBe(tradingDay(now).day_end_sec);
 expect(riskPolicyContext(policy,p.valid_until_sec).day).not.toBe(p.day);
});
