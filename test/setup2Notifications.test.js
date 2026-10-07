import {describe,it,expect} from 'vitest';
import {RANGE_HISTORY_WARNING,rangeWarningEvent,isRangeWarning} from '../supabase/functions/_shared/setup2RangeWarnings.js';
import {secretMatches,sendPushover,validatePushover,healthReport,notificationText} from '../supabase/functions/_shared/setup2Notifications.js';
const now=Date.parse('2026-10-07T10:00:00Z');
const server={watch_checked_at:new Date(now-10000).toISOString(),provider_checked_at:new Date(now-60000).toISOString(),provider_error:null};
const rows=[{instrument:'GBPUSD',enabled:true,state:{lastSuccessAt:new Date(now-20000).toISOString(),nextExpectedCheck:new Date(now+60000).toISOString(),activeRanges:[]}}];
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
  expect(healthReport(rows,{},now+160000,()=>true,server).state).toBe('error');
  expect(healthReport(rows,{},now,()=>true,{...server,provider_error:'Rejected'}).state).toBe('error');
 });
 it('suspended DRs stay visible without exposing stored source details or enabling pulse',()=>{
  const suspended=[{...rows[0],state:{...rows[0].state,suspendedRanges:[{setupKey:'DR13590',direction:'short',source:{private:'stored input'}}]}}];
  const report=healthReport(suspended,{},now,()=>true,server);
  expect(report.state).toBe('live');expect(report.actionRequired).toBe(false);expect(report.pulse).toBe(false);
  expect(report.instruments[0].suspendedRanges).toEqual([{setupKey:'DR13590',direction:'short',reason:RANGE_HISTORY_WARNING}]);
 });
 it('suspended DRs cannot mask a real runner, feed, provider or delivery fault',()=>{
  const warned=[{...rows[0],state:{...rows[0].state,suspendedRanges:[{setupKey:'DR13590'}]}}];
  for(const error of ['Watcher stopped','FXCM-M1-Feed delayed'])expect(healthReport([{...warned[0],state:{...warned[0].state,error}}],{},now,()=>true,server)).toMatchObject({state:'error',actionRequired:true});
  const realFeed=healthReport([{...warned[0],state:{...warned[0].state,error:'FXCM-M1-Feed delayed'}}],{},now,()=>true,server);
  expect(()=>notificationText({kind:'problem',payload:{message:null}})).not.toThrow();
  expect(realFeed.action).toContain('FXCM-Collector');
  expect(notificationText({kind:'problem',instrument:'GBPUSD',payload:{message:'FXCM-M1-Feed delayed'}})).toContain('🔴 Du bist dran · T68');
  expect(healthReport([{...warned[0],state:{...warned[0].state,activeRanges:[{structureReady:true}]}}],{},now,()=>true,server).pulse).toBe(true);
  expect(healthReport(warned,{error:'The operation was aborted due to timeout'},now,()=>true,server).action).toContain('Pushover-Zugang');
  expect(healthReport(warned,{},now,()=>true,{...server,provider_error:'Rejected'}).action).toContain('Pushover-Zugang');
  expect(healthReport(warned,{error:'Provider delivery uncertain'},now,()=>true,server).state).toBe('error');
  expect(healthReport(warned,{},now,()=>true,{...server,provider_error:'Rejected'}).state).toBe('error');
  expect(healthReport(warned,{},now+160000,()=>true,server).state).toBe('error');
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
