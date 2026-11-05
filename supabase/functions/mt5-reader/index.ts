import {readerAction} from '../trading-monitor-mcp/mt5Reader.ts';
Deno.serve(async req=>{
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const token=Deno.env.get('MT5_READER_TOKEN');
 if(!token||req.headers.get('Authorization')!==`Bearer ${token}`)return new Response('Unauthorized',{status:401,headers});
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers});
 const text=await req.text();
 if(text.length>64000)return new Response('Payload too large',{status:413,headers});
 try{return Response.json(await readerAction(JSON.parse(text)),{headers});}
 catch{return Response.json({error:'reader_unavailable'},{status:400,headers});}
});
