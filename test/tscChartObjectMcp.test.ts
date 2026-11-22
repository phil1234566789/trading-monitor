// deno test --allow-env --allow-net=unit-test.supabase.co --allow-read test/tscChartObjectMcp.test.ts
// Lana schreibt und liest Registry-Chartobjekte in den TSC-Rollen (add_trade_confirmation/add_trade_target/get_tsc_range).
import assert from 'node:assert/strict';
Deno.env.set('SUPABASE_URL','https://unit-test.supabase.co');
Deno.env.set('SUPABASE_ANON_KEY','unit-test-anon-key');
const {addTradeConfirmation,addTradeTarget,fetchDealingRangeCockpit}=await import('../supabase/functions/trading-monitor-mcp/db.ts');

const chartObject={type:'double_order_block',key:'GBPUSD|5m|497',instrument:'GBPUSD',timeframe:'5m',
 snapshot:{pair:{id:497,firstOrderBlock:{startTime:1795000000}}}};
const columns={chart_object_type:'double_order_block',chart_object_key:'GBPUSD|5m|497',chart_object_instrument:'GBPUSD',
 chart_object_timeframe:'5m',chart_object_snapshot:chartObject.snapshot};

function mockFetch(handler:(req:Request,url:URL,body:any)=>unknown) {
 const original=globalThis.fetch;
 globalThis.fetch=async(input:any,init:any)=>{
  const request=new Request(input,init),url=new URL(request.url);
  const body=request.method==='GET'?null:await request.json();
  const result=handler(request,url,body);
  return Response.json(result);
 };
 return ()=>{globalThis.fetch=original;};
}

Deno.test('add_trade_confirmation / add_trade_target speichern ein DOB als chart_object',async()=>{
 const posts:any[]=[];
 const restore=mockFetch((req,url,body)=>{
  if(req.method==='POST'){posts.push({table:url.pathname.split('/').pop(),body});return {id:posts.length,...body};}
  if(url.pathname.endsWith('/dealing_ranges'))return {id:7,instrument:'GBPUSD'};
  return null; // Duplikat-Suche: keine Zeile
 });
 try{
  await addTradeConfirmation({level:'range',id:7,chartObject,category:'anti_confluence',price:1.325} as any);
  await addTradeTarget(7,{chartObject,price:1.3,sourceTime:'2026-11-20T10:00:00Z'} as any);
 }finally{restore();}
 assert.equal(posts[0].table,'trade_evidence');
 assert.deepEqual({...posts[0].body,source_time:undefined},{...posts[0].body,source_time:undefined,kind:'chart_object',category:'anti_confluence',
  price:1.325,ob_zone_id:null,liquidity_level_id:null,...columns});
 assert.equal(posts[0].body.source_time,new Date(1795000000*1000).toISOString());
 assert.equal(posts[1].table,'trade_targets');
 assert.equal(posts[1].body.kind,'chart_object');
 assert.equal(posts[1].body.chart_object_key,'GBPUSD|5m|497');
});

Deno.test('add_trade_confirmation lehnt ein unvollständiges chartObject ab',async()=>{
 await assert.rejects(()=>addTradeConfirmation({level:'range',id:7,chartObject:{...chartObject,key:''},price:1} as any),/chartObject.key/);
});

Deno.test('get_tsc_range liefert chartObject an Evidenz, Target und Invalidierung',async()=>{
 const selects:string[]=[];
 const restore=mockFetch((_req,url)=>{
  selects.push(url.searchParams.get('select')??'');
  if(url.pathname.endsWith('/dealing_ranges'))return {id:7,instrument:'GBPUSD',direction:'short',invalidation:1.33,
   ...Object.fromEntries(Object.entries(columns).map(([k,v])=>['invalidation_'+k,v]))};
  return [{id:1,price:1.325,kind:'chart_object',category:'anti_confluence',...columns}];
 });
 let range:any;
 try{range=await fetchDealingRangeCockpit(7);}finally{restore();}
 assert.ok(selects.every(s=>s.includes('chart_object_snapshot')));
 assert.equal(range.invalidationChartObject.key,'GBPUSD|5m|497');
 assert.equal(range.confirmations[0].chartObject.type,'double_order_block');
 assert.equal(range.targets[0].chartObject.type,'double_order_block');
});
