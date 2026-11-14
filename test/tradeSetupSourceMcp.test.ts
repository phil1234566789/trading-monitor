import assert from 'node:assert/strict';
Deno.env.set('SUPABASE_URL','https://unit-test.supabase.co');
Deno.env.set('SUPABASE_ANON_KEY','unit-test-anon-key');
const {getPinContext}=await import('../supabase/functions/trading-monitor-mcp/db.ts');
Deno.test('MCP reads the exact explicit source snapshot and rejects missing frozen evidence',async()=>{
 const cases=JSON.parse(await Deno.readTextFile(new URL('../scripts/fixtures/tradeSetupSourceSqlCases.json',import.meta.url)));
 const payload=cases.validCases[0].payload;
 const originalFetch=globalThis.fetch;let selected='',missing=false,writes=0;
 globalThis.fetch=async(input:any,init:any)=>{
  const request=new Request(input,init),url=new URL(request.url);
  if(request.method!=='GET'){writes++;throw new Error('No writes permitted');}
  if(!url.pathname.endsWith('/pin_context'))throw new Error('Unexpected request');
  selected=url.searchParams.get('select')??'';
  return Response.json(Number(url.searchParams.get('offset')??0)===0?[{id:1,kind:'trade_setup',
   trade_setup_id:9,trade_setup_source_snapshot_id:17,
   trade_setup_source_snapshots:missing?null:{payload}}]:[]);
 };
 try{
  const rows=await getPinContext();
  assert.deepEqual(rows[0].trade_setup_source_snapshots.payload,payload);
  assert.ok(selected.includes('trade_setup_source_snapshot_id'));
  assert.ok(selected.includes('trade_setup_source_snapshots(payload)'));
  missing=true;await assert.rejects(()=>getPinContext(),/Quellenstand/);
  assert.equal(writes,0);
 }finally{globalThis.fetch=originalFetch;}
});
