import {targetPlanAction} from '../trading-monitor-mcp/mt5TargetPlans.ts';
import {riskPolicyAction} from '../trading-monitor-mcp/mt5Risk.ts';
import { readHistoryPage } from '../trading-monitor-mcp/mt5History.ts';
import { readAccountBalances } from './accountBalances.ts';
import { mt5JournalAction } from '../trading-monitor-mcp/mt5Journal.ts';
import { marketPreviewAction } from '../trading-monitor-mcp/marketPreview.ts';
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
    if(['preview','confirm','search_preview','search_confirm'].includes(body.action)) result=await marketPreviewAction(body);
    else if(typeof body.action==='string'&&body.action.startsWith('target_')) result=await targetPlanAction(body);
    else if(['risk_policy','risk_policy_save'].includes(body.action)) result=await riskPolicyAction(body);
    else if(body.action==='history_page') result=await readHistoryPage(body);
    else if(typeof body.action==='string'&&body.action.startsWith('journal_')) result=await mt5JournalAction(body);
    else if(body.action==='status') {
      result=await getExecutionStatus(body.id);
      if(!body.id)result={...result,account_balances:await readAccountBalances()};
    }
    else if(body.action==='cancel') result=await cancelExecutionOrder(body.id);
    else result=await manageMt5Accounts(body);
    return Response.json(result,{headers});
  } catch(error) {
    const reason=error instanceof Error?error.message:'';
    const code=['bridge_offline','bridge_not_ready','quote_stale','minimum_volume_exceeds_budget',
      'daily_stop_not_ready','daily_stop_latched','risk_limits_unconfirmed','risk_guard_unavailable','risk_floor_reconfirmation_required','risk_exposure_unavailable','risk_budget_exhausted','risk_sizing_unavailable','target_position_changed','target_daily_stop','target_command_unresolved','invalid_risk_policy','invalid_stop_or_target','preview_expired','invalid_preview','live_not_enabled','bridge_not_ready'].includes(reason)?reason:'request_failed';
    return Response.json({code,error:'Anfrage fehlgeschlagen. Konfiguration, Kontodaten und offene Aufträge prüfen.'},{status:400,headers});
  }
});
