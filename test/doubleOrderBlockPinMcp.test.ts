import {registerPinTools} from '../supabase/functions/trading-monitor-mcp/tools/pins.ts';
import {z} from 'npm:zod@3.24.1';
Deno.test('MCP add_pin_entry -> get_pin_context retains exact atomic DOB snapshot and both canonical IDs',async()=>{
 const handlers=new Map<string,any>(),schemas=new Map<string,any>();
 registerPinTools({registerTool:(name:string,spec:any,fn:any)=>{handlers.set(name,fn);schemas.set(name,spec.inputSchema);}} as any);
 let row:any=null,obWrites=0,pinWrites=0,selected='';const originalFetch=globalThis.fetch;
 globalThis.fetch=async(input:any,init:any)=>{
  const request=new Request(input,init),url=new URL(request.url);
  if(url.pathname.endsWith('/ob_zones')){obWrites++;return Response.json({id:obWrites===1?501:502});}
  if(!url.pathname.endsWith('/pin_context'))throw new Error('Unexpected request '+url.pathname);
  if(request.method==='POST'){pinWrites++;row={id:901,...await request.json()};return Response.json(row);}
  selected=url.searchParams.get('select')??'';return Response.json(Number(url.searchParams.get('offset')??0)===0&&row?[row]:[]);
 };
 try{
 const s={contextVersion:'double-order-block-pin-v1',engineVersion:'test-v1',evaluatedAt:1200,view:{symbol:'XAUUSD',bar:'1m'},coverage:{m5:{from:1,through:1200,count:4},m1:{from:1,through:1200,count:20}},pair:{id:'dob:XAUUSD:1:100:400',instrument:'XAUUSD',direction:'long',recognizedAt:1000,firstOrderBlock:{dir:1,timeframe:'5M',startTime:100,top:12,bottom:10},secondOrderBlock:{dir:1,timeframe:'5M',startTime:400,top:14,bottom:12},entries:{a:{status:'ready',outcome:{status:'open'}},b:{status:'pending'}}}};
 const args=z.object(schemas.get('add_pin_entry')).parse({kind:'double_order_block',dobSnapshot:s,note:'exact pair',pinType:'observation'});
 await handlers.get('add_pin_entry')(args);
 const read=JSON.parse((await handlers.get('get_pin_context')()).content[0].text);
 const equal=(a:any,b:any)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('Snapshot mismatch');};
 equal(read[0].dob_context,row.dob_context);equal(read[0].dob_context.pair.entries,s.pair.entries);
 if(obWrites!==2||pinWrites!==1||read[0].dob_context.pair.firstOrderBlock.obZoneId!==501||read[0].dob_context.pair.secondOrderBlock.obZoneId!==502||read[0].note!=='exact pair'||!selected.includes('dob_context')||!selected.includes('dob_pin_key'))throw new Error('Roundtrip contract failed');
 }finally{globalThis.fetch=originalFetch;}
});
