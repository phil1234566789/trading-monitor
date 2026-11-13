import {describe,it,expect} from 'vitest';
import {validateStopAllocation,rescaleExitLeg,stopDraftAllocation} from '../supabase/functions/trading-monitor-mcp/stopPlanContract.js';
import {stopRiskBudget,stopRiskPreview,validateStopRisk} from '../supabase/functions/trading-monitor-mcp/stopRiskContract.js';
const now=1000,policy={confirmed_balance:50000,confirmed_equity:51000,cost_buffer:25,risk_base:50000,drawdown_floor:47000,valid_until_sec:2000,currency:'USD',day:'2026-11-13'};
const p={ticket:1,type:0,symbol:'XAUUSD.gbe',volume:1,price_open:3900,price_current:3901,profit:100,swap:0,sl:0,risk_to_sl:null,remaining_risk_to_sl:null};
const q={bid:3901,ask:3901.1,time:now,point:.01,digits:2,minimum_volume:.01,maximum_volume:50,volume_step:.01,stops_level:.02,loss_per_unit_long:1,loss_per_unit_short:1};
const snapshot=()=>({balance:50000,equity:50100,currency:'USD',pending_orders:0,hedging:true,risk_guards_ready:true,risk:{time:now,day:policy.day,latched:false,realized_net_day:0,open_loss:0},positions:[p],quotes:[q]});
describe('position stop plan',()=>{
 it('covers all lots with an outer native fallback rather than the weighted budget illusion',()=>{
  const plan=validateStopAllocation([{price:3899,volume:.5},{price:3898,volume:.5}],p,q,3900,3898);
  expect(plan.native_sl).toBe(3898);expect(plan.stops.map(s=>s.rr)).toEqual([-.5,-1]);
  expect(()=>validateStopAllocation([{price:3899,volume:.5}],p,q,3900,3898)).toThrow('stop_volume_must_cover_position');
 });
 it('places short presets above entry and sorts the innermost protection before the outer fallback',()=>{
  const short={...p,type:1,price_current:3899,profit:100},s=snapshot();s.positions=[short];s.quotes=[{...q,bid:3898.9,ask:3899}];
  expect(stopRiskPreview('risky',short,s,policy,s.quotes[0],now).price).toBe(3902.25);
  const plan=validateStopAllocation([{price:3902,volume:.5},{price:3901,volume:.5}],short,s.quotes[0],3900,3902);
  expect(plan.stops.map(x=>x.price)).toEqual([3901,3902]);expect(plan.native_sl).toBe(3902);
 });
 it('rejects wrong-side, wrong precision and impossible volume without weakening TP rules',()=>{
  for(const [price,volume,error] of [[3901,.5,'invalid_stop_price'],[3899.005,1,'invalid_stop_precision'],[3899,.505,'invalid_stop_volume']])expect(()=>validateStopAllocation([{price,volume}],p,q,3900,3898)).toThrow(error);
 });
 it('reuses the per-account 250/450 USD caps and reserves 25 USD inside the cap',()=>{
  expect(stopRiskPreview('risky',p,snapshot(),policy,q,now)).toMatchObject({price:3897.75,budget:{requested:250,allocation:250,available:225}});
  const full=stopRiskPreview('full',p,snapshot(),policy,q,now);
  expect(full.price).toBe(3895.75);expect(full.budget.requested).toBeCloseTo(450);expect(full.budget.allocation).toBeCloseTo(450);expect(full.budget.available).toBeCloseTo(425);
 });
 it('does not count its existing loss twice or spend its open profit as daily budget',()=>{
  const s=snapshot();s.risk.realized_net_day=-800;
  expect(stopRiskPreview('risky',p,s,policy,q,now)).toMatchObject({price:3898.25,budget:{allocation:200,available:175,effective_percent:.4}});
  const losing={...p,price_current:3899,profit:-100};s.positions=[losing];s.equity=49900;s.risk.open_loss=-100;
  expect(stopRiskBudget('risky',losing,s,policy,now).allocation).toBe(200);
 });
 it('uses the outer SL for full volume and still rejects unknown risk on other accounts/positions',()=>{
  expect(()=>validateStopRisk('risky',[{price:3899,volume:.99},{price:3896,volume:.01}],p,snapshot(),policy,q,now)).toThrow('stop_risk_budget_exceeded');
  const s=snapshot();s.positions.push({...p,ticket:2});expect(()=>stopRiskBudget('full',p,s,policy,now)).toThrow('risk_exposure_unavailable');
  const netting=snapshot();netting.hedging=false;expect(()=>stopRiskBudget('risky',p,netting,policy,now)).toThrow('risk_exposure_unavailable');
 });
 it('rescales the opposite leg and preserves intentionally unplanned TP remainder',()=>{
  expect(rescaleExitLeg([{price:3902,volume:.5},{price:3903,volume:.5}],.5,1,.01,.01).map(x=>x.volume)).toEqual([.25,.25]);
  expect(rescaleExitLeg([{price:3902,volume:.4}],.5,1,.01,.01).map(x=>x.volume)).toEqual([.2]);
  expect(rescaleExitLeg([{price:3899,volume:.5},{price:3898,volume:.5}],.01,1,.01,.01)).toEqual([{price:3898,volume:.01}]);
 });
 it('assigns only SL percentage rounding dust to the outer fallback, preserving explicit incomplete allocations',()=>{
  const result=stopDraftAllocation([{price:3899,percent:50},{price:3898,percent:50}],.03,q,'long');
  expect(result.targets.map(s=>s.volume)).toEqual([.01,.02]);expect(result.remainder).toBe(0);
  expect(stopDraftAllocation([{price:3899,volume:.01}],.03,q,'long').remainder).toBe(.02);
 });
});
