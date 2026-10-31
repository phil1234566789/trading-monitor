import {RISK_BASE} from '../supabase/functions/trading-monitor-mcp/mt5RiskContract.js';
import {mmtExecutionReady,mmtAccountSnapshot} from './milkyMetaTraderPolling.js';
export function balancePosition(balance,floor,target){
 if(![balance,floor,target].every(Number.isFinite)||target<=floor)return null;
 return Math.max(0,Math.min(100,(balance-floor)/(target-floor)*100));
}
export function accountBalance(account,saved,bridge){
 const value={...saved},snapshot=mmtAccountSnapshot(account,bridge);
 if(snapshot&&!snapshot.worker_error&&Number.isFinite(snapshot.balance)&&Date.parse(bridge.heartbeat_at)>(Date.parse(saved?.balance_at)||0)){
  Object.assign(value,{balance:snapshot.balance,equity:snapshot.equity,currency:snapshot.currency,
   positions:snapshot.positions?.length??null,balance_at:bridge.heartbeat_at,balance_source:'MT5-Worker'});
 }
 return value;
}
export function accountPerformance(id,currency,result,sync){
 const trades=result.trades.filter(t=>t.account_id===id&&t.currency===currency);
 const costs=result.unallocated.filter(d=>d.account_id===id&&d.currency===currency);
 const known=trades.length>0||Boolean(sync?.last_full_at);
 return {count:trades.length,net:known?trades.reduce((sum,t)=>sum+t.net,0)+costs.reduce((sum,d)=>sum+d.profit+d.commission+d.swap+d.fee,0):null,
  winrate:trades.length?trades.filter(t=>t.net>0).length/trades.length*100:null};
}

export function challengeGauge(balance,floor,target){
 const position=balancePosition(balance,floor,target),start=balancePosition(RISK_BASE,floor,target);
 const known=position!=null&&start!=null;
 return {position,start,progress:balancePosition(balance,RISK_BASE,target),
  gain:known?Math.max(0,position-start):0,loss:known?Math.max(0,start-position):0};
}
export function balanceHealth(status,fresh,account,now){
 if(!fresh||!status?.online||!mmtAccountSnapshot(account,status?.bridge))return {ok:false,label:'Verbindung prüfen'};
 if(status?.bridge?.snapshot?.worker_error||status?.health?.incident)return {ok:false,label:'Betrieb gestört'};
 const checked=Date.parse(status?.health?.checked_at);
 if(!Number.isFinite(checked)||checked>now||now-checked>150000)return {ok:false,label:'Überwachung prüfen'};
 if(!mmtExecutionReady(account,status,status?.bridge?.snapshot))return {ok:false,label:'Handel gesperrt'};
 return {ok:true,label:'Alles OK'};
}
