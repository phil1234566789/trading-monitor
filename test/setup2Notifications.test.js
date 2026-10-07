import {describe,it,expect} from 'vitest';
import {secretMatches,sendPushover,validatePushover,healthReport} from '../supabase/functions/_shared/setup2Notifications.js';
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
 it('initial scan is waiting and pulse only follows verified structure within trading hours',()=>{
  const initial=[{...rows[0],state:{...rows[0].state,lastSuccessAt:null}}];
  expect(healthReport(initial,{},now,()=>true,server).state).toBe('waiting');
  const ready=[{...rows[0],state:{...rows[0].state,activeRanges:[{setupKey:'DR1',structureReady:true}]}}];
  expect(healthReport(ready,{},now,()=>true,server).pulse).toBe(true);
  expect(healthReport(ready,{},now,()=>false,server).pulse).toBe(false);
  expect(healthReport(ready,{},now,()=>false,server).state).toBe('waiting');
 });
});
