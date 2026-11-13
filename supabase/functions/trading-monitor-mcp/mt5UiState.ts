import {checked,mt5Database} from './mt5Credentials.ts';
import {riskPolicyContext} from './riskPolicyContext.js';
import {tradingDay} from './dailyStopContract.js';

const sections=new Set(['catalog','snapshots','orders','guards','health','balances']);
export async function readMt5UiState(body:Record<string,unknown>){
 const requested=body.action==='ui_activity'?[]:body.sections;
 if(!Array.isArray(requested)||requested.length>6||requested.some(s=>typeof s!=='string'||!sections.has(s)))throw new Error('invalid_ui_sections');
 const data:any=checked(await mt5Database().rpc('mt5_read_ui_state',{p_sections:[...new Set(requested)]}));
 if(!data||!data.revisions)throw new Error('mt5_storage_unavailable');
 if(requested.includes('catalog'))Object.assign(data,{execution_enabled:Deno.env.get('MT5_EXECUTION_ENABLED')==='true',server_live_allowed:Deno.env.get('MT5_ALLOW_LIVE')==='true'});
 const now=Math.floor(Date.now()/1000),day=tradingDay(now);
 for(const state of Object.values(data.account_statuses??{}) as any[]){
  state.execution_enabled=Deno.env.get('MT5_EXECUTION_ENABLED')==='true';
  state.server_live_allowed=Deno.env.get('MT5_ALLOW_LIVE')==='true';
  if(Object.hasOwn(state,'risk_policy'))state.risk_policy=riskPolicyContext(state.risk_policy,now);
  if(state.daily_stop){
   // Nur die angefragte UI-Projektion; Worker und Order-/Save-Gates lesen weiterhin frisch.
   const bridge=state._guard_bridge,snapshot=bridge?.snapshot;
   state.daily_stop={...day,...state.daily_stop,checked_at_sec:now,daily_stop_ready:!!snapshot
    &&Date.now()-Date.parse(bridge.heartbeat_at)<=5000&&snapshot.risk_guards_ready===true&&snapshot.hedging===true
    &&!snapshot.worker_error&&!snapshot.risk_error&&snapshot.risk?.day===day.day&&typeof snapshot.risk?.time==='number'&&now-snapshot.risk.time<=5&&snapshot.risk.time<=now+1};
  }
  delete state._guard_bridge;
 }
 return data;
}
