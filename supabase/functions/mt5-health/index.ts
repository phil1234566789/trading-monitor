import {checkMt5Health,sendMt5HealthTest} from '../trading-monitor-mcp/mt5Health.ts';
import {secretMatches} from '../_shared/setup2Notifications.js';

Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');
 const control=await secretMatches(token,Deno.env.get('MT5_CONTROL_TOKEN'));
 const cron=await secretMatches(token,Deno.env.get('SETUP2_WATCH_TOKEN'));
 if(!control&&!cron)return new Response('Unauthorized',{status:401});
 try {
  const raw=await req.text();if(raw.length>1024)return new Response('Too large',{status:413});
  const body=JSON.parse(raw||'{}');
  if(body.action==='test'&&!control)return new Response('Forbidden',{status:403});
  return Response.json(body.action==='test'?await sendMt5HealthTest():await checkMt5Health(),{headers:{'Cache-Control':'no-store'}});
 } catch {return Response.json({error:'health_check_failed'},{status:503});}
});
