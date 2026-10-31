export function computeTradeStats(trades){
 const closed=trades.filter(t=>t.outcome==='win'||t.outcome==='loss');
 const wins=closed.filter(t=>t.outcome==='win').length,losses=closed.length-wins;
 const knownR=closed.filter(t=>typeof t.rMultiple==='number'&&Number.isFinite(t.rMultiple));
 const totalR=knownR.reduce((sum,t)=>sum+t.rMultiple,0);
 return {total:trades.length,closed:closed.length,wins,losses,totalR,
  winrate:closed.length?wins/closed.length*100:null,avgR:knownR.length?totalR/knownR.length:null,
  knownR:knownR.length,unknownR:closed.length-knownR.length};
}
