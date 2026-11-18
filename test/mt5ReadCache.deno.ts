import {assertEquals} from 'jsr:@std/assert@1';
import {cachedMt5Read,enableMt5ReadCache} from '../supabase/functions/trading-monitor-mcp/mt5Credentials.ts';

Deno.test('mt5 read cache: aus ohne enable, an mit TTL, Fehler werden nicht gecacht, Kopien statt Referenz',async()=>{
  let reads=0;const read=async()=>({n:++reads});
  await cachedMt5Read('k',read);await cachedMt5Read('k',read);
  assertEquals(reads,2);
  enableMt5ReadCache(50);
  const first=await cachedMt5Read('k',read);first.n=99;
  assertEquals((await cachedMt5Read('k',read)).n,3);
  let failed=0;
  try{await cachedMt5Read('e',async()=>{failed++;throw new Error('x');});}catch{}
  try{await cachedMt5Read('e',async()=>{failed++;throw new Error('x');});}catch{}
  assertEquals(failed,2);
  await new Promise(r=>setTimeout(r,60));
  assertEquals((await cachedMt5Read('k',read)).n,4);
  enableMt5ReadCache(0);
});
