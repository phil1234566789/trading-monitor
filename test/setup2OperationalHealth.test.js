import {describe,it,expect} from 'vitest';
import {healthReport} from '../supabase/functions/_shared/setup2Notifications.js';
const at=t=>Date.parse(`2026-10-19T${t}+02:00`);
const iso=t=>new Date(t).toISOString();
const server=now=>({watch_checked_at:iso(now-10000),provider_checked_at:iso(now-60000),provider_error:null});
const row=(instrument,success,watermark,next,error=null)=>({instrument,enabled:true,updated_at:iso(at(success)),state:{
 lastSuccessAt:iso(at(success)),evaluatedThrough:iso(at(watermark)),nextExpectedCheck:iso(at(next)),activeRanges:[{setupKey:'test'}],error
}});
const report=(rows,now,delivery={},proof=server(now))=>healthReport(rows,delivery,now,()=>true,proof);

describe('T78 operational classification from real 19 October incident sequence',()=>{
 it('keeps minute-boundary staleness and one connection reset visible without demanding human intervention',()=>{
  const now=at('13:49:14');
  const value=report([
   row('GBPUSD','13:47:51','13:47:00','13:48:12','Watcher database POST rpc/setup2_store_live_evidence instrument=GBPUSD: response headers, request failed, 31741ms'),
   row('EURUSD','13:48:51','13:47:00','13:49:12')
  ],now);
  expect(value).toMatchObject({state:'warning',actionRequired:false,pulse:false});
  expect(value.instruments.every(r=>r.stale)).toBe(true);
  expect(value.instruments[0].error).toContain('request failed');
  expect(value.criticalReasons).toEqual([]);
 });
 it('accepts successful pending retry and continuing real watermarks without inventing fresh market data',()=>{
  const now=at('13:50:02');
  const value=report([row('GBPUSD','13:49:49','13:48:00','13:49:12'),row('EURUSD','13:49:48','13:48:00','13:50:12')],now);
  expect(value).toMatchObject({state:'warning',actionRequired:false});
  expect(value.instruments[0].marketLagSeconds).toBe(122);
  expect(value.recoveryReady).toBe(true);
 });
 it('allows the observed 264-second cold start but escalates an actually stopped observation after its bounded grace',()=>{
  const pending=[row('EURUSD','13:51:50','13:50:00','13:52:12')];
  expect(report(pending,at('13:56:36'))).toMatchObject({state:'warning',actionRequired:false});
  const failed=report(pending,at('13:57:13'));
  expect(failed).toMatchObject({state:'error',actionRequired:true,recoveryReady:false});
  expect(failed.criticalReasons).toHaveLength(1);
 });
 it('does not allow future schedule timestamps or process pings to hide a frozen market watermark',()=>{
  const pending=[{...row('GBPUSD','13:57:59','13:50:00','14:10:00'),state:{...row('GBPUSD','13:57:59','13:50:00','14:10:00').state,lastProcessAt:iso(at('13:58:00'))}}];
  expect(report(pending,at('13:58:01'))).toMatchObject({state:'error',actionRequired:true});
 });
 it('escalates a proven credentials block immediately, while isolated unknown DRs remain protocol-only',()=>{
  const blocked=report([row('GBPUSD','13:59:40','13:59:00','14:00:12','Watcher database POST rpc/setup2_checkpoint: response headers, HTTP 401, 10ms')],at('14:00:00'));
  expect(blocked).toMatchObject({state:'error',actionRequired:true});
  expect(blocked.action).toContain('Zugang');
  const isolated=report([row('GBPUSD','13:59:40','13:59:00','14:00:12')],at('14:00:00'));
  expect(isolated.state).toBe('live');
 });
 it('treats one uncertain delivery as a warning and leaves the historical outcome in the protocol',()=>{
  const now=at('14:00:00');
  expect(report([row('GBPUSD','13:59:40','13:59:00','14:00:12')],now,{status:'uncertain',error:'The operation was aborted due to timeout',issueAt:iso(now)}))
   .toMatchObject({state:'warning',actionRequired:false});
 });
 it('distinguishes brief missing independent proof from a sustained unavailable notification watcher',()=>{
  const now=at('14:00:00'),rows=[row('GBPUSD','13:59:40','13:59:00','14:00:12')];
  expect(report(rows,now,{}, {...server(now),watch_checked_at:iso(now-160000)})).toMatchObject({state:'warning',actionRequired:false});
  expect(report(rows,now,{}, {...server(now),watch_checked_at:iso(now-301000)})).toMatchObject({state:'error',actionRequired:true});
  expect(report(rows,now,{}, {...server(now),provider_error:'Pushover secrets missing'})).toMatchObject({state:'error',actionRequired:true});
 });
});

it('keeps M5 recovery eligible between scheduled steps while requiring a new market candle in the SQL episode',()=>{
 const begin=at('14:00:00');
 const value=row('GBPUSD','14:00:00','14:00:00','14:05:12');value.state.activeRanges=[];value.state.lastM5Time=begin/1000-300;
 for(const seconds of [0,60,120,180,240])expect(report([value],begin+seconds*1000).recoveryReady).toBe(true);
});

it('allows a newer successful provider check to resolve an old delivery auth error without changing its history',()=>{
 const now=at('14:00:00'),rows=[row('GBPUSD','13:59:40','13:59:00','14:00:12')];
 const old={status:'failed',error:'Pushover rejected request (HTTP 403)',issueAt:iso(now-120000)};
 expect(report(rows,now,{...old,consecutiveFailures:3,firstIssueAt:iso(now-600000)})).toMatchObject({state:'warning',actionRequired:false});
 expect(report(rows,now,{...old,issueAt:iso(now-10000)})).toMatchObject({state:'error',actionRequired:true});
});

it('does not turn an isolated legacy DR-history warning into an operational outage',()=>{
 const value=row('GBPUSD','13:59:40','13:59:00','14:00:12','Suspendierte DRs GBPUSD:setup1:13590: Lifecycle-Historie konnte nicht ermittelt werden (fehlend oder lückenhaft)');
 const status=report([value],at('14:00:00'));expect(status).toMatchObject({state:'live',actionRequired:false});
});
