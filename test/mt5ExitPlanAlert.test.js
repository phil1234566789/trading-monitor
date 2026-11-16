import {describe,it,expect} from 'vitest';
import {observedReason,exitPlanAlertMessage} from '../supabase/functions/trading-monitor-mcp/mt5ExitPlanAlert.js';
import {stopWarning} from '../src/mmtTargetDrafts.js';

const row=sl=>({plan:{position:3164003,symbol:'XAUUSD.gbe',account_login:26781,stops:[{price:3872.65,volume:.5}]},checkpoint:{sl,tp:0,volume:.5}});
describe('paused SL plans are never silent',()=>{
 it('keeps the concrete precheck error and rejects arbitrary text',()=>{
  expect(observedReason('broker_precheck_failed','stop_risk_budget_exceeded')).toBe('broker_precheck_failed:stop_risk_budget_exceeded');
  expect(observedReason('broker_precheck_failed','target_broker_precheck_failed_10016')).toBe('broker_precheck_failed:target_broker_precheck_failed_10016');
  expect(observedReason('broker_precheck_failed','<b>x</b>')).toBe('broker_precheck_failed:other');
  expect(observedReason('broker_position_closed',undefined)).toBe('broker_position_closed');
 });
 it('alerts loudly for an unprotected position and still warns when an older broker SL remains',()=>{
  expect(exitPlanAlertMessage(row(0),'paused','broker_precheck_failed:x')).toMatch(/UNGESCHÜTZT #3164003 .*kein SL beim Broker.*3872.65.*broker_precheck_failed:x/);
  expect(exitPlanAlertMessage(row(3880),'paused','r')).toMatch(/NICHT aktiv, beim Broker bleibt SL 3880/);
 });
 it('stays quiet for completed plans and plans without stops',()=>{
  expect(exitPlanAlertMessage(row(0),'completed','broker_position_closed')).toBeNull();
  expect(exitPlanAlertMessage({...row(0),plan:{...row(0).plan,stops:undefined}},'paused','r')).toBeNull();
 });
});
describe('chart SL warning',()=>{
 const d={stops:[{price:3872.65,volume:.5}],stopsDirty:false,brokerStop:3872.65,planState:'active',planReason:null};
 it('marks a saved SL that is paused, unresolved or missing at the broker',()=>{
  expect(stopWarning(d)).toBe('');
  expect(stopWarning({...d,planState:'paused',planReason:'broker_precheck_failed:x'})).toBe('SL NICHT AKTIV · Plan pausiert · broker_precheck_failed:x');
  expect(stopWarning({...d,planState:'unknown'})).toContain('ungeklärt');
  expect(stopWarning({...d,planState:'pending',brokerStop:0})).toBe('SL NOCH NICHT BEIM BROKER');
 });
 it('does not warn about an unsaved draft',()=>{
  expect(stopWarning({...d,stopsDirty:true,planState:'paused',brokerStop:0})).toBe('');
 });
});
