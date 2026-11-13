import {RISK_BASE} from '../supabase/functions/trading-monitor-mcp/mt5RiskContract.js';
import {mmtExecutionReady,mmtAccountSnapshot} from './milkyMetaTraderPolling.js';
import {entryDailyStopReason} from './mmtDailyStopReason.js';
import {tradePerformance} from './milkyMetaTraderPerformance.js';
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
 const stats=tradePerformance(trades);
 return {...stats,net:known?stats.net+costs.reduce((sum,d)=>sum+d.profit+d.commission+d.swap+d.fee,0):null};
}

export function challengeGauge(balance,floor,target){
 // Die Brokergrenze zieht nach; die Vergleichsskala aller 50k-Konten bleibt fest.
 const scaleFloor=RISK_BASE-3000;
 const position=balancePosition(balance,scaleFloor,target),start=balancePosition(RISK_BASE,scaleFloor,target);
 const floorPosition=balancePosition(floor,scaleFloor,target),angle=floorPosition*Math.PI/100;
 return {position,start,scaleFloor,floor:floorPosition,
  floorLabel:floorPosition==null?null:{x:110-122*Math.cos(angle),y:104-122*Math.sin(angle)},progress:balancePosition(balance,RISK_BASE,target),
  gain:position!=null&&start!=null?Math.max(0,position-start):0};
}
export function balanceHealth(status,fresh,account,now){
 if(status?.bridge?.snapshot?.worker_error||status?.health?.incident)return {ok:false,label:'Betrieb gestört'};
 if(entryDailyStopReason(status,now))return {ok:false,label:'Tagesstopp aktiv'};
 if(status?.ui_cached)return {ok:false,neutral:true,label:'Gespeicherter Stand'};
 if(!fresh||!status?.online||!mmtAccountSnapshot(account,status?.bridge))return {ok:false,label:'Verbindung prüfen'};
 const checked=Date.parse(status?.health?.checked_at);
 if(!Number.isFinite(checked)||checked>now||now-checked>(status?.ui_health_read_at?960000:150000))return {ok:false,label:'Überwachung prüfen'};
 if(!mmtExecutionReady(account,status,status?.bridge?.snapshot))return {ok:false,label:'Handel gesperrt'};
 return {ok:true,label:status?.ui_health_read_at?'Letzte Prüfung OK':'Alles OK'};
}
