export function balancePosition(balance,floor,target){
 if(![balance,floor,target].every(Number.isFinite)||target<=floor)return null;
 return Math.max(0,Math.min(100,(balance-floor)/(target-floor)*100));
}
export function accountBalance(account,saved,bridge){
 const value={...saved},snapshot=bridge?.snapshot;
 if(snapshot&&!snapshot.worker_error&&snapshot.account_login===Number(account.login)&&snapshot.account_server===account.server
  &&Number.isFinite(snapshot.balance)&&Date.parse(bridge.heartbeat_at)>(Date.parse(saved?.balance_at)||0)){
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
