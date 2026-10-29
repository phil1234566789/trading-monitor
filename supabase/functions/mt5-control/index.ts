import { manageMt5Accounts } from '../trading-monitor-mcp/mt5Credentials.ts';
import { cancelExecutionOrder, getExecutionStatus } from '../trading-monitor-mcp/mt5Execution.ts';

Deno.serve(async req => {
  const origin=req.headers.get('Origin')??'';
  const allowed=(Deno.env.get('MT5_CONTROL_ORIGINS')??'https://phil1234566789.github.io,http://localhost:5173').split(',');
  const headers:Record<string,string>={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if (allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Headers']='Authorization, Content-Type';
    headers['Access-Control-Allow-Methods']='POST, OPTIONS';
  }
  if (req.method==='OPTIONS') return new Response(null,{status:allowed.includes(origin)?204:403,headers});
  if (origin&&!allowed.includes(origin)) return new Response('Forbidden',{status:403,headers});
  const token=Deno.env.get('MT5_CONTROL_TOKEN');
  if (!token||req.headers.get('Authorization')!==`Bearer ${token}`) return new Response('Unauthorized',{status:401,headers});
  if (req.method!=='POST') return new Response('Method not allowed',{status:405,headers});
  const text=await req.text();
  if(text.length>16000) return new Response('Payload too large',{status:413,headers});
  try {
    const body=JSON.parse(text);
    let result;
    if(body.action==='status') result=await getExecutionStatus();
    else if(body.action==='cancel') result=await cancelExecutionOrder(body.id);
    else result=await manageMt5Accounts(body);
    return Response.json(result,{headers});
  } catch {
    return Response.json({error:'Anfrage fehlgeschlagen. Konfiguration, Kontodaten und offene Aufträge prüfen.'},{status:400,headers});
  }
});
