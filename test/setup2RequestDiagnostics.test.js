import {it,expect,vi} from 'vitest';
import {requestJson} from '../scripts/requestJson.mjs';
import {archiveClient} from '../scripts/tradeSetup2Archive.mjs';
it('pinpoints a failed candle request without leaking URL, credentials or raw network errors',async()=>{
 const client=archiveClient({url:'https://private.invalid',key:'secret-value',fetcher:async()=>{
  throw new DOMException('https://private.invalid?token=secret-value','TimeoutError');
 }});
 await expect(client.pages('fxcm_candles',{instrument:'eq.GBPUSD',bar:'eq.1m'}))
  .rejects.toThrow('Archive fxcm_candles instrument=eq.GBPUSD bar=eq.1m offset=0: response headers, TimeoutError');
 try {await client.pages('fxcm_candles',{instrument:'eq.GBPUSD',bar:'eq.1m'});}
 catch(error){expect(error.message).not.toContain('private.invalid');expect(error.message).not.toContain('secret-value');}
});
it('distinguishes body timeout and includes measured elapsed duration',async()=>{
 let now=100;const clock=vi.spyOn(Date,'now').mockImplementation(()=>now);
 try {
  await expect(requestJson('https://private.invalid',{},'Watcher database POST rpc/setup2_checkpoint',async()=>({
   ok:true,text:async()=>{now=60100;throw new DOMException('secret-value','AbortError');}
  }))).rejects.toThrow('Watcher database POST rpc/setup2_checkpoint: response body, AbortError, 60000ms');
 }finally{clock.mockRestore();}
});
it('preserves RPC null bodies, JSON responses and actionable HTTP status',async()=>{
 expect((await requestJson('https://local.test',{},'checkpoint',async()=>new Response(null,{status:204}))).data).toBeNull();
 expect((await requestJson('https://local.test',{},'read',async()=>new Response('{"ok":true}'))).data).toEqual({ok:true});
 await expect(requestJson('https://local.test',{},'read',async()=>new Response('secret-value',{status:503}))).rejects.toThrow('HTTP 503');
 await expect(requestJson('https://local.test',{},'read',async()=>new Response('secret-value'))).rejects.toThrow('JSON decode, request failed');
});

it('shows only known RPC failure codes and the constant lease diagnosis',async()=>{
 await expect(requestJson('https://local.test',{},'checkpoint',async()=>new Response('{"code":"P0001","message":"Watcher lease expired"}',{status:400})))
  .rejects.toThrow('HTTP 400 (Watcher lease expired)');
 try {await requestJson('https://local.test',{},'checkpoint',async()=>new Response('{"code":"P0001","message":"private-secret","details":"private-secret"}',{status:400}));}
 catch(error){expect(error.message).toContain('HTTP 400 (P0001)');expect(error.message).not.toContain('private-secret');}
});

it('retains the database timeout code while redacting the server message and details',async()=>{
 try {await requestJson('https://local.test',{},'checkpoint',async()=>new Response(JSON.stringify({code:'57014',message:'private-secret',details:'private-secret'}),{status:500}));throw new Error('Expected request failure');}
 catch(error){expect(error.message).toContain('HTTP 500 (57014)');expect(error.message).not.toContain('private-secret');}
});

import {requestDiagnostic} from '../scripts/requestJson.mjs';
import {runnerIncidentId} from '../supabase/functions/_shared/setup2IncidentIdentity.js';

it.each([
 ['ECONNRESET','connection'],['ECONNREFUSED','connection'],['EPIPE','connection'],
 ['ENOTFOUND','dns'],['EAI_AGAIN','dns'],['ETIMEDOUT','timeout'],
 ['UND_ERR_CONNECT_TIMEOUT','timeout'],['UND_ERR_HEADERS_TIMEOUT','timeout'],
 ['UND_ERR_BODY_TIMEOUT','timeout'],['UND_ERR_SOCKET','connection']
])('retains allowlisted cause %s separately from the unchanged incident message',async(code,category)=>{
 const raw=new TypeError('https://private.invalid?token=secret-value',{cause:Object.assign(new Error('secret-value'),{code,address:'secret-value'})});
 const failure=await requestJson('https://private.invalid',{headers:{Authorization:'secret-value'}},'read',async()=>{throw raw;}).catch(e=>e);
 expect(failure.message).toMatch(/^read: response headers, request failed, \d+ms$/);
 expect(requestDiagnostic(failure)).toEqual({phase:'response headers',category,code});
 expect(JSON.stringify(requestDiagnostic(failure))).not.toContain('secret-value');
 expect(runnerIncidentId('GBPUSD',null,failure.message)).toBe(runnerIncidentId('GBPUSD',null,'read: response headers, request failed, 123ms'));
});

it('rejects arbitrary error metadata, inherited keys and forged diagnostic fields',async()=>{
 for(const code of ['secret-value','constructor','toString','__proto__']){
  const raw=Object.assign(new Error('secret-value'),{name:'secret-value',code,cause:{code},diagnostic:{phase:'secret-value',category:'secret-value'}});
  const failure=await requestJson('https://private.invalid',{},'read',async()=>{throw raw;}).catch(e=>e);
  expect(requestDiagnostic(failure)).toEqual({phase:'response headers',category:'unknown',code:null});
  expect(JSON.stringify(failure)).not.toContain('secret-value');
  expect(requestDiagnostic(raw)).toBeUndefined();
 }
});

it('categorizes timeouts, aborts, body failures, decode errors and HTTP failures without free strings',async()=>{
 const cases=[
  [async()=>{throw new DOMException('secret-value','TimeoutError');},{phase:'response headers',category:'timeout',code:null}],
  [async()=>{throw new DOMException('secret-value','AbortError');},{phase:'response headers',category:'abort',code:null}],
  [async()=>({ok:true,text:async()=>{throw Object.assign(new Error('secret-value'),{code:'ECONNRESET'});}}),{phase:'response body',category:'connection',code:'ECONNRESET'}],
  [async()=>new Response('secret-value'),{phase:'JSON decode',category:'decode',code:null}],
  [async()=>new Response('secret-value',{status:503}),{phase:'response headers',category:'http',code:null}]
 ];
 for(const [fetcher,expected] of cases){
  const failure=await requestJson('https://private.invalid',{},'read',fetcher).catch(e=>e);
  expect(requestDiagnostic(failure)).toEqual(expected);
  expect(Object.isFrozen(requestDiagnostic(failure))).toBe(true);
 }
});
