export const P2_PRELIMINARY_M5_BOS_VERSION='m5-p2-preliminary-close-same-d-v2';

// Die Vorstufe ergänzt nur das Entry-Gate; die Strukturprüfung C/D bleibt unverändert.
export function p2PreliminaryM5Bos({primary,countertrend,direction,evaluatedAt,candles,anchor,periodOuter,periodInner,currentState,deps}) {
 const {detectLiquidityLevels,computeRangesPivots,buildMarketStructureState,entryPattern1CountertrendState}=deps;
 if(!['short','long'].includes(direction)||!countertrend||!Number.isFinite(anchor)||!Number.isFinite(evaluatedAt))return null;
 const short=direction==='short',origin=countertrend.range?.[short?'high':'low'];
 if(!origin||!Number.isFinite(origin.pivotTime)||countertrend.trend!==(short?'uptrend':'downtrend'))return null;
 const rows=candles.filter(c=>!c.ignored&&c.time+300<=evaluatedAt);
 const current=entryPattern1CountertrendState(primary,direction,evaluatedAt,currentState);
 if(current?.currRange?.[short?'high':'low']?.pivotTime!==origin.pivotTime)return null;
 const rangeStart=countertrend.range?.[short?'low':'high']?.pivotTime;
 if(!Number.isFinite(rangeStart))return null;
 const raw=detectLiquidityLevels(rows,periodInner),pivots=short?raw.lows:raw.highs;
 const reclaimsOrigin=c=>short?c.close>origin.price:c.close<origin.price;
 const candidates=[];
 for(const pivot of pivots){
  if(pivot.pivotTime>=origin.pivotTime||pivot.pivotTime<=rangeStart)continue;
  const pivotIndex=rows.findIndex(c=>c.time===pivot.pivotTime),known=rows[pivotIndex+periodInner];
  if(pivotIndex<0||!known)continue;
  const pivotKnownAt=known.time+300;
  const index=rows.findIndex(c=>c.time>origin.pivotTime&&c.time>=pivotKnownAt&&(short?c.close<pivot.price:c.close>pivot.price));
  if(index<1||rows.some(c=>c.time>rows[index].time&&reclaimsOrigin(c)))continue;
  const prefix=rows.slice(0,index);
  const state=buildMarketStructureState(computeRangesPivots(prefix,periodOuter,anchor),computeRangesPivots(prefix,periodInner,anchor),periodOuter,periodInner,prefix,{barSeconds:300});
  const relevant=entryPattern1CountertrendState(primary,direction,evaluatedAt,state);
  if(relevant?.currRange?.[short?'high':'low']?.pivotTime!==origin.pivotTime)continue;
  // Ein beliebiger P2 im Archiv genügt nicht: er muss im vorher bekannten D-Zustand liegen.
  const member=relevant.innerStructurePivots?.some(p=>p.pivotTime===pivot.pivotTime&&p.price===pivot.price);
  const protectedPivot=relevant.structurePivots?.find(p=>p.type===(short?'protected-low':'protected-high'));
  if(!member||!protectedPivot||pivot.pivotTime<=protectedPivot.pivotTime)continue;
  candidates.push({type:'BOS',direction,originTime:origin.pivotTime,price:pivot.price,pivotTime:pivot.pivotTime,
   candleTime:rows[index].time,recognizedAt:rows[index].time+300,pivotKnownAt,
   evidenceType:'P2-preliminary-close-break',ruleVersion:P2_PRELIMINARY_M5_BOS_VERSION});
 }
 return candidates.sort((a,b)=>a.recognizedAt-b.recognizedAt||b.pivotTime-a.pivotTime)[0]??null;
}
