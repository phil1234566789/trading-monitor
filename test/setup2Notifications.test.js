import {describe,it,expect} from 'vitest';
import {RANGE_HISTORY_WARNING,rangeWarningEvent,isRangeWarning} from '../supabase/functions/_shared/setup2RangeWarnings.js';
import {secretMatches,sendPushover,validatePushover,healthReport,notificationText} from '../supabase/functions/_shared/setup2Notifications.js';
const now=Date.parse('2026-10-07T10:00:00Z');
const server={watch_checked_at:new Date(now-10000).toISOString(),provider_checked_at:new Date(now-60000).toISOString(),provider_error:null};
const rows=[{instrument:'GBPUSD',enabled:true,state:{lastSuccessAt:new Date(now-20000).toISOString(),nextExpectedCheck:new Date(now+60000).toISOString(),activeRanges:[],lastM5Time:now/1000-300,evaluatedThrough:new Date(now-20000).toISOString()}}];
describe('T68 server notification boundaries',()=>{
 it('checks password without accepting empty or malformed values',async()=>{
  expect(await secretMatches('abc','abc')).toBe(true);expect(await secretMatches('abd','abc')).toBe(false);expect(await secretMatches(null,'abc')).toBe(false);expect(await secretMatches('','')).toBe(false);
 });
 it('requires both HTTP and provider acceptance',async()=>{
  const env=()=> 'test-secret';
  expect(await sendPushover('fixed test','title',env,async()=>new Response('{"status":1}',{status:200}))).toEqual({status:'accepted'});
  await expect(sendPushover('test','title',env,async()=>new Response('{"status":0}',{status:200}))).rejects.toThrow('rejected');
  await expect(validatePushover(env,async()=>new Response('{"status":1}',{status:400}))).rejects.toThrow('rejected');
 });
 it('zero active ranges remains live; browser GET cannot replace independent cron or provider evidence',()=>{
  expect(healthReport(rows,{},now,()=>true,server).state).toBe('live');
  expect(healthReport(rows,{},now,()=>true,{}).state).toBe('error');
  expect(healthReport(rows,{},now+160000,()=>true,server)).toMatchObject({state:'warning',actionRequired:false});
  expect(healthReport(rows,{},now+310000,()=>true,server)).toMatchObject({state:'error',actionRequired:true});
  expect(healthReport(rows,{},now,()=>true,{...server,provider_error:'Rejected'}).state).toBe('warning');
 });
 it('suspended DRs stay visible without exposing stored source details or enabling pulse',()=>{
  const suspended=[{...rows[0],state:{...rows[0].state,suspendedRanges:[{setupKey:'DR13590',direction:'short',source:{private:'stored input'}}]}}];
  const report=healthReport(suspended,{},now,()=>true,server);
  expect(report.state).toBe('live');expect(report.actionRequired).toBe(false);expect(report.pulse).toBe(false);
  expect(report.instruments[0].suspendedRanges).toEqual([{setupKey:'DR13590',direction:'short',reason:RANGE_HISTORY_WARNING}]);
 });
 it('keeps genuine faults visible and escalates sustained outages instead of one recoverable error',()=>{
  const warned=[{...rows[0],state:{...rows[0].state,suspendedRanges:[{setupKey:'DR13590'}]}}];
  for(const error of ['Watcher stopped','FXCM-M1-Feed delayed']){
   const transient=[{...warned[0],state:{...warned[0].state,error}}];
   expect(healthReport(transient,{},now,()=>true,server)).toMatchObject({state:'warning',actionRequired:false});
   const later=now+361000,proof={watch_checked_at:new Date(later-1000).toISOString(),provider_checked_at:new Date(later-1000).toISOString()};
   const failed=healthReport(transient,{},later,()=>true,proof);
   expect(failed).toMatchObject({state:'error',actionRequired:true});
   expect(failed.criticalReasons.some(r=>r.instrument==='GBPUSD')).toBe(true);
  }
  expect(()=>notificationText({kind:'problem',payload:{message:null}})).not.toThrow();
  expect(healthReport([{...warned[0],state:{...warned[0].state,activeRanges:[{structureReady:true}]}}],{},now,()=>true,server).pulse).toBe(true);
  expect(healthReport(warned,{error:'The operation was aborted due to timeout'},now,()=>true,server)).toMatchObject({state:'warning',actionRequired:false});
  expect(healthReport(warned,{},now,()=>true,{...server,provider_error:'Rejected'})).toMatchObject({state:'warning',actionRequired:false});
  expect(healthReport(warned,{},now,()=>true,{...server,provider_error:'Pushover secrets missing'})).toMatchObject({state:'error',actionRequired:true});
 });
 it('range warnings keep causal DR history without being trading or technical delivery alerts',()=>{
  const range={setupKey:'DR13590',direction:'short',suspendedAt:'2026-10-07T09:00:00Z'};
  const event=rangeWarningEvent('GBPUSD',range,now);
  expect(event).toMatchObject({setup_key:'DR13590',signal_at:range.suspendedAt,payload:{category:'range-warning',message:RANGE_HISTORY_WARNING}});
  expect(isRangeWarning(event)).toBe(true);
  expect(isRangeWarning({id:'health:GBPUSD:old',kind:'problem',payload:{message:'Suspendierte DRs GBPUSD:setup1:13590: Lifecycle-Historie konnte nicht ermittelt werden (fehlend oder lückenhaft)'}})).toBe(true);
  expect(isRangeWarning({id:'runner:GBPUSD:old',kind:'problem',payload:{message:'Unexpected lifecycle computation failure'}})).toBe(false);
 expect(isRangeWarning({kind:'problem',payload:{message:'Runner stopped'}})).toBe(false);
 });
 it('initial scan is waiting and pulse only follows verified structure within trading hours',()=>{
  const initial=[{...rows[0],state:{...rows[0].state,lastSuccessAt:null}}];
  expect(healthReport(initial,{},now,()=>true,server).state).toBe('waiting');
  const ready=[{...rows[0],state:{...rows[0].state,activeRanges:[{setupKey:'DR1',structureReady:true}]}}];
  expect(healthReport(ready,{},now,()=>true,server).pulse).toBe(true);
  expect(healthReport(ready,{},now,()=>false,server).pulse).toBe(false);
  expect(healthReport(ready,{},now,()=>false,server).state).toBe('waiting');
 });
});
