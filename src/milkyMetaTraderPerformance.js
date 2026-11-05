export function tradeOutcome(trade){
 // Commission ist bereits im Netto enthalten; Cent-Rundung hält die ±10-USD-Grenzen stabil.
 const cents=Math.round((trade.net-(trade.commission??0))*100);
 return cents>1000?'win':cents< -1000?'loss':'breakeven';
}
export function tradeOutcomeClass(trade){
 const outcome=tradeOutcome(trade);
 return outcome==='win'?'positive':outcome==='loss'?'negative':'';
}
export function tradePerformance(trades){
 const stats={count:trades.length,net:0,commission:0,wins:0,losses:0,breakeven:0};
 for(const trade of trades){
  stats.net+=trade.net;stats.commission+=trade.commission??0;
  const outcome=tradeOutcome(trade);
  stats[outcome==='win'?'wins':outcome==='loss'?'losses':'breakeven']++;
 }
 return {...stats,average:stats.count?stats.net/stats.count:null,
  winrate:stats.wins+stats.losses?stats.wins/(stats.wins+stats.losses)*100:null};
}
export function tradeExtremes(trades,count=5){
 const parsed=Number(count),limit=Number.isFinite(parsed)?Math.max(1,Math.trunc(parsed)):5;
 const ranked=outcome=>trades.filter(trade=>tradeOutcome(trade)===outcome)
  .sort((a,b)=>(outcome==='win'?b.net-a.net:a.net-b.net)||b.opened_at-a.opened_at||a.id.localeCompare(b.id)).slice(0,limit);
 return {winners:ranked('win'),losers:ranked('loss')};
}
