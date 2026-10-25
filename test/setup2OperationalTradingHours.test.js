import {describe,it,expect} from 'vitest';
import {healthReport} from '../supabase/functions/_shared/setup2Notifications.js';
import {operationalNotificationAllowed} from '../supabase/functions/_shared/setup2OperationalHealth.js';
import {isWithinTradingWindows} from '../supabase/functions/_shared/tradingHoursGate.ts';
const windows={weekday:[[480,1080]],saturday:[],sunday:[]};
const state=(instrument,now)=>({instrument,enabled:true,updated_at:new Date(now-900000).toISOString(),state:{lastSuccessAt:new Date(now-900000).toISOString(),nextExpectedCheck:new Date(now-600000).toISOString(),activeRanges:[]}});
const report=(time,inside)=>{const now=Date.parse(time);return healthReport([state('GBPUSD',now)],{},now,inside??(()=>isWithinTradingWindows(now/1000,windows)),{checkingNow:true,watch_checked_at:new Date(now).toISOString(),provider_checked_at:new Date(now).toISOString()});};
describe('operational notifications respect configured Berlin trading windows',()=>{
 it.each(['2026-10-23T18:00:00+02:00','2026-10-23T23:10:14+02:00','2026-10-24T10:00:00+02:00','2026-10-25T02:30:00+02:00','2026-10-25T02:30:00+01:00','2026-10-26T00:01:00+01:00'])('keeps a real incident visible but quiet outside the window: %s',time=>{
  const value=report(time);expect(value.actionRequired).toBe(true);expect(value.state).toBe('error');expect(operationalNotificationAllowed(value)).toBe(false);
 });
 it.each(['2026-10-23T08:00:00+02:00','2026-10-26T08:00:00+01:00'])('allows an ongoing incident at market observation start across DST: %s',time=>expect(operationalNotificationAllowed(report(time))).toBe(true));
 it('uses the affected instrument window rather than a different open instrument',()=>{
  const value=report('2026-10-23T23:10:14+02:00');value.instruments.push({instrument:'EURUSD',enabled:true,inHours:true});
  expect(operationalNotificationAllowed(value)).toBe(false);
  value.criticalReasons.push({source:'provider'});expect(operationalNotificationAllowed(value)).toBe(true);
 });
 it('gates recovery notifications too, and never uses disabled instruments as an open window',()=>{
  const value={actionRequired:false,criticalReasons:[],instruments:[{instrument:'GBPUSD',enabled:true,inHours:false},{instrument:'EURUSD',enabled:false,inHours:true}]};
  expect(operationalNotificationAllowed(value)).toBe(false);value.instruments[0].inHours=true;expect(operationalNotificationAllowed(value)).toBe(true);
 });
});
