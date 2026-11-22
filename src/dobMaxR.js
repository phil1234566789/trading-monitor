import {evaluateDoubleOrderBlockOutcome} from './doubleOrderBlockOutcome.js';

// Wie weit hätte die Kraft getragen? Höchste Stufe (0,5R-Raster bis 5R), die vor dem SL erreicht wird, verfolgt wie der 2R-Ausgang
// ab Entry auf M1 bis zum SL, bis 5R oder bis zum Datenende (kein Schnitt am Marktschluss, sonst wiche Ziel 2R vom Ausgang ab).
export const DOB_MAX_R_STEPS=[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5];

// slHit: der SL kam, bevor die nächste Stufe erreicht war. Trifft die SL-Kerze zugleich Stufen (ambiguous wie beim 2R-Ausgang),
// reicht ambiguousR bis zur höchsten davon: Ziele bis dort bleiben unentschieden, höhere sind Loss. Damit gilt für jedes Ziel k:
// Win bei maxR ≥ k, unentschieden bei k ≤ ambiguousR, Loss bei slHit, sonst offen/unbekannt.
// breakevenAtR (Teilprofit, Konfig partialBe): dieselben Stufen mit SL auf Entry ab dieser R-Weite; slHit heißt dann ausgestoppt
// (auf Entry oder am SL). rScale: Stufen in einer anderen R-Einheit messen (Variante (c): R des DOB-Risikos bei weiterem SL).
export function dobMaxR(trade,{candles,dataEnd,instrument='XAUUSD',breakevenAtR=null,rScale=1}){
 const status=rMultiple=>evaluateDoubleOrderBlockOutcome({...trade,candles,evaluatedAt:dataEnd,instrument,rMultiple:rMultiple*rScale,breakevenAtR}).status;
 let maxR=0,slHit=false,ambiguousR=null;
 // Stufen sind monoton: wird eine nicht erreicht, folgt keine höhere.
 for(const [i,rMultiple] of DOB_MAX_R_STEPS.entries()){
  const result=status(rMultiple);
  if(result==='success'){maxR=rMultiple;continue;}
  slHit=result==='loss'||result==='ambiguous'||result==='breakeven';
  for(const next of DOB_MAX_R_STEPS.slice(i)){if(status(next)!=='ambiguous')break;ambiguousR=next;}
  break;
 }
 return {maxR,slHit,ambiguousR};
}

// Weite SL-Variante (Messung DOB-SL-VARIANTEN, Statistikseite „SL-Vergleich“): Wo der Indikator den SL ans Retest-Extrem legt,
// zum Vergleich der SL an der fernen M5-Kante von OB2 (Long Unterkante, Short Oberkante). Entry bleibt, Ziele aus dem weiten Risiko.
export const dobWideStopPrice=t=>t.direction==='long'?t.chart.secondOrderBlock.bottom:t.chart.secondOrderBlock.top;
// null, wenn der Trade schon an der M5-Kante stoppt (dort ist eng = weit).
export function dobWideVariant(t,options){
 if(t.stopAnchor!=='retestExtreme')return null;
 const stopPrice=dobWideStopPrice(t);
 return {stopPrice,riskUsd:Math.abs(t.entryPrice-stopPrice),...dobMaxR({...t,stopPrice},options)};
}

// SL-Variante (c) (src/dobSwingStop.js, nur HTF-OB): SL hinter dem M15-P2, Ziel bleibt als Preis. Die Stufen bleiben in R des DOB-Risikos,
// damit dobTargetOutcome(row,k) das feste Ziel k·DOB-Risiko gegen den neuen SL prüft. null = keine Anti-Confluence oder kein Swing.
export function dobSwingStopVariant(t,options){
 const stop=t.swingStop?.stop;
 if(!stop)return null;
 const riskUsd=Math.abs(t.entryPrice-stop.stopPrice);
 return {stopPrice:stop.stopPrice,riskUsd,...dobMaxR({...t,stopPrice:stop.stopPrice},{...options,rScale:Math.abs(t.entryPrice-t.stopPrice)/riskUsd})};
}
