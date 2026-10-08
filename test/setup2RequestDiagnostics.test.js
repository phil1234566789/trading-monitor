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
