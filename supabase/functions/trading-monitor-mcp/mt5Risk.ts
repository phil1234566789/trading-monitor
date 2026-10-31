import {activeMt5Account,checked,mt5Database} from './mt5Credentials.ts';
import {berlinDateStrFor,berlinDayRangeUtcMs} from '../_shared/berlinTime.ts';
export async function readRiskPolicy(accountId:string){
 return checked(await mt5Database().from('mt5_risk_policies').select('*').eq('account_id',accountId).maybeSingle());
}
export function riskPolicyDay(now:number){
 const day=berlinDateStrFor(now),next=new Date(day+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
 return {day,valid_until_sec:Math.floor(berlinDayRangeUtcMs(next.toISOString().slice(0,10)).startUtcMs/1000)};
}
export async function riskPolicyAction(body:Record<string,any>){
 const account=await activeMt5Account(),db=mt5Database();
 if(body.action==='risk_policy')return {policy:await readRiskPolicy(account.id)};
 if(body.action!=='risk_policy_save')throw new Error('unknown_action');
 const p=body.policy,now=Math.floor(Date.now()/1000);
 if(!p||Object.keys(p).some(k=>!['risk_base','drawdown_floor','cost_buffer','currency','source'].includes(k))
  ||![p.risk_base,p.drawdown_floor,p.cost_buffer].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)
  ||p.currency!=='USD'||typeof p.source!=='string'||!p.source.trim()||p.source.length>500)throw new Error('invalid_risk_policy');
 const bridge=checked(await db.from('mt5_bridge_state').select('*').eq('id','primary').single());
 if(!bridge||Date.now()-Date.parse(bridge.heartbeat_at)>5000||bridge.snapshot.account_login!==Number(account.login)
  ||bridge.snapshot.account_server!==account.server||bridge.snapshot.currency!==p.currency||bridge.snapshot.worker_error
  ||p.drawdown_floor>=bridge.snapshot.equity)throw new Error('risk_limits_unconfirmed');
 const policy={...p,confirmed_balance:bridge.snapshot.balance,confirmed_equity:bridge.snapshot.equity,source:p.source.trim(),...riskPolicyDay(now),revision:crypto.randomUUID(),account_id:account.id,confirmed_at:new Date().toISOString()};
 return {policy:checked(await db.from('mt5_risk_policies').upsert(policy).select('*').single())};
}
