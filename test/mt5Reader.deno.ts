import assert from 'node:assert/strict';
import {readerAction} from '../supabase/functions/trading-monitor-mcp/mt5Reader.ts';
Deno.test('reader dispatch cannot reach trading or active-account state',async()=>{
 const original=globalThis.fetch;
 Deno.env.set('SUPABASE_URL','https://example.supabase.co');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','fake-test-key');
 const id='edc84f4d-4ec1-4d1b-8464-5bc64bc362a5',calls:string[]=[];
 globalThis.fetch=(async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:input.toString());calls.push(url.pathname);
  if(url.pathname.endsWith('/mt5_accounts'))return Response.json({id,login:42,server:'Demo',archived:false});
  if(url.pathname.endsWith('/rpc/mt5_record_reader_balance'))return new Response(null,{status:204});
  if(url.pathname.endsWith('/mt5_history_sync'))return Response.json(null);
  throw new Error('unexpected path '+url.pathname);
 }) as typeof fetch;
 try{
  await assert.rejects(readerAction({action:'poll',account_id:id}),/unknown_reader_action/);
  assert.equal(calls.length,0);
  await assert.rejects(readerAction({action:'snapshot',account_id:id,account_login:43,account_server:'Demo'}),/account_mismatch/);
  assert.equal(calls.length,1);
  const result=await readerAction({action:'snapshot',account_id:id,account_login:42,account_server:'Demo',observed_at_sec:Math.floor(Date.now()/1000),snapshot:{balance:48000,equity:47900,positions:0,currency:'USD'}});
  assert.ok('recorded' in result);assert.equal(result.recorded,true);
  const context=await readerAction({action:'history_context',account_id:id});
  assert.ok('full_due' in context);assert.equal(context.account_login,42);assert.equal(context.full_due,true);
  assert.ok(!calls.some(p=>/execution|bridge|target/.test(p)));
 }finally{globalThis.fetch=original;}
});
