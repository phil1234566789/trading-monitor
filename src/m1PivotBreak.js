import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';

// P5 bestätigt den Pullback ggf. erst nach dem Dochtbruch. Ursprung und Bruch
// bleiben historische Zeiten; die Entry-Freigabe verwendet nur recognizedAt.
export function deriveM1PivotBreak({ pivots, candles, direction, structureFrom, evaluatedAt }) {
  if (!['short','long'].includes(direction) || !Number.isFinite(structureFrom)) return null;
  const short=direction==='short',side=short?'high':'low',opposite=short?'low':'high';
  const known=(pivots ?? []).filter(p=>p.pivotTime>=structureFrom && Number.isFinite(p.recognizedAt)
    && p.recognizedAt<=evaluatedAt).sort((a,b)=>a.pivotTime-b.pivotTime);
  const rows=closedChecklistCandles(candles,'1m',evaluatedAt).filter(c=>!c.ignored);
  let fact=null;
  for(let i=2;i<known.length;i++) {
    const [origin,level,pullback]=known.slice(i-2,i+1);
    if(origin.type!==side || level.type!==opposite || pullback.type!==side
      || !(origin.pivotTime<level.pivotTime && level.pivotTime<pullback.pivotTime)
      || !(short ? pullback.price<origin.price && pullback.price>level.price
        : pullback.price>origin.price && pullback.price<level.price)) continue;
    const breach=rows.find(c=>c.time>pullback.pivotTime && (short?c.low<level.price:c.high>level.price));
    if(!breach)continue;
    const recognizedAt=Math.max(breach.time+60,origin.recognizedAt,level.recognizedAt,pullback.recognizedAt);
    if(recognizedAt>evaluatedAt || fact && fact.recognizedAt<=recognizedAt)continue;
    fact={type:'pivot-break',direction,price:level.price,pivotTime:level.pivotTime,
      originTime:origin.pivotTime,originPrice:origin.price,pullbackTime:pullback.pivotTime,
      pullbackPrice:pullback.price,pivotRecognizedAt:pullback.recognizedAt,
      candleTime:breach.time,breachKnownAt:breach.time+60,recognizedAt};
  }
  return fact;
}
