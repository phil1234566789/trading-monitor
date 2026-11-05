// npm:-Imports und Deno.env gehören in den Edge-Runtime-Test, nicht in Vitest.
import assert from 'node:assert/strict';
import {registerMt5AccountTools} from '../supabase/functions/trading-monitor-mcp/tools/mt5Accounts.ts';
import {selectMt5TradingAccount} from '../supabase/functions/trading-monitor-mcp/mt5AccountManagement.ts';
import type {McpServer} from 'npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js';

Deno.test('private account tools paginate safe fields and expose only sanitized switch failures',async()=>{
 const originalFetch=globalThis.fetch,oldUrl=Deno.env.get('SUPABASE_URL'),oldKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const id='e925a364-09a6-4336-8de5-f56f6e385296',calls:URL[]=[],tools=new Map<string,any>();
 Deno.env.set('SUPABASE_URL','https://example.supabase.co');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only');
 globalThis.fetch=(async(input)=>{
  const url=new URL(input instanceof Request?input.url:input.toString());calls.push(url);
  if(url.pathname.endsWith('mt5_accounts')){
   assert.equal(url.searchParams.get('select'),'id,name,login,server,mode,archived,created_at,trade_role,archive_details');
   return Response.json(url.searchParams.get('id')?.endsWith(id)?[]:[{id,name:'Unchanged account name',login:42,server:'Demo',mode:'demo',archived:false,created_at:'2026-10-31T10:00:00Z'}]);
  }
  if(url.pathname.endsWith('mt5_execution_settings'))return Response.json({active_account_id:id});
  return Response.json({message:'private database detail',code:'P0001'},{status:400});
 }) as typeof fetch;
 try{
  registerMt5AccountTools({registerTool:(name:string,definition:unknown,handler:unknown)=>tools.set(name,{definition,handler})} as unknown as McpServer);
  const list=tools.get('list_mt5_trading_accounts');
  assert.equal(list.definition.annotations.readOnlyHint,true);
  const result=JSON.parse((await list.handler()).content[0].text);
  assert.equal(result.accounts.length,1);assert.equal(result.active_account_id,id);
  assert.equal(result.accounts[0].name,'Unchanged account name');
  assert.equal(calls.filter(url=>url.pathname.endsWith('mt5_accounts')).length,2);
  assert.ok(!JSON.stringify(result).includes('credentials'));
  const selection=tools.get('select_mt5_trading_account');
  assert.equal(selection.definition.annotations.readOnlyHint,false);
  assert.match(selection.definition.description,/konkretem menschlichem Wechselauftrag/);
  assert.throws(()=>selection.definition.inputSchema.account_id.parse('ambiguous account name'));
  await assert.rejects(selectMt5TradingAccount('invalid'),/invalid_id/);
  await assert.rejects(selection.handler({account_id:id}),/^Error: mt5_storage_unavailable$/);
 }finally{
  globalThis.fetch=originalFetch;
  for(const [key,value] of [['SUPABASE_URL',oldUrl],['SUPABASE_SERVICE_ROLE_KEY',oldKey]]){
   if(value==null)Deno.env.delete(key!);else Deno.env.set(key!,value);
  }
 }
});
