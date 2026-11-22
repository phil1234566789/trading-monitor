// LS-Reaktion (Gruppe POI): Ist die Preisreaktion an einem LQ-Level gut? Welche Level in Frage kommen, entscheidet der LQ-Algo,
// welche Range gilt, der Struktur-Algo. Gegenstück zu evaluateOrderBlockReaction() (orderBlockReaction.js).
import {liquidityTouch} from './liquidityDetection.js';
import {businessSecondsBetween} from './chartTimeUtils.js';

// Kein Zeitfilter (Philip): eines der drei Ereignisse kommt zügig. Später als 3 h Marktzeit nach dem Touch heißt fehlende Kerzen oder ein
// Erkennungsfehler; Fill bricht ab, Live wird nur geloggt. Marktzeit = Kerzenfolge: Wochenende und ausgeblendete Sessions zählen eine
// Kerze (sonst wäre jeder Sweep Freitag 22:55 mit Umkehr nach der Pause ein Fehler), eine Datenlücke unter der Woche zählt voll.
export const LS_REACTION_PLAUSIBLE_SECONDS=3*3600;
// Sweep-Extrem = erster M5-Pivot ab dem Touch, mit der inneren Strukturperiode (P2) des LQ-Algos.
export const LS_REACTION_EXTREME_PERIOD=2;

// H1-Touch ist nur der Stundenanfang: die erste M5-Kerze, die das Level kreuzt, ist der Touch.
function touchTime(setup,m5Candles){
 const touch=setup.ls?.touchedTime;
 if(!Number.isFinite(touch)||setup.sweeps?.[0]?.timeframe!=='1H')return touch;
 return m5Candles.find(c=>c.time>=touch&&c.time<touch+3600&&liquidityTouch(c,setup.ls.price,setup.dir))?.time??null;
}

// Eine bestätigte Gegen-FVG zwischen Sweep und Umkehr-OB belegt Fortsetzung statt Sweep-Reaktion.
// Beide Impulszeiten haben denselben M5-Bestätigungsvorlauf; spätere FVGs ändern die Historie nicht.
export function hasUninterruptedSweepReaction(setup, setupObs, m5Candles = []) {
  const touch = touchTime(setup, m5Candles);
  if (!Number.isFinite(touch)) return true;
  return !setupObs.some(ob => ob.dir === setup.dir && ob.startTime > touch && ob.startTime < setup.obStartTime);
}

// Drei Ereignisse nach dem Touch, das erste entscheidet (Short; Long gespiegelt): bullische M5-FVG → OUT, Kerze über dem Sweep-Extrem
// → OUT, bärischer M5-OB → IN (Umkehr-OB). Sweep-Extrem = erster M5-Pivot (Periode 2) ab der Touch-Kerze; „gehalten“ = keine Kerze
// darüber bis vor den Umkehr-OB, mit holdUntil (DOB: OB1) bis vor diesen. setup: {dir, ls:{price,touchedTime}, sweeps?, obStartTime?};
// obStartTime = eigener OB einer Setup-Zeile, sonst der erste Umkehr-OB ab dem Touch. m5: obs (detectSetupObs), candles (ohne
// ignorierte), pivots (detectLiquidityLevels(candles, 2)), ignoredTimes (Zeiten der ausgeblendeten Kerzen, aufsteigend).
export function evaluateLiquiditySweepReaction(setup,{obs=[],candles=[],pivots={highs:[],lows:[]},ignoredTimes=[]}={},{holdUntil}={}){
 const touch=touchTime(setup,candles);
 if(!Number.isFinite(touch))return {status:'in',reason:'touchUnknown'};
 const reaction=Number.isFinite(setup.obStartTime)?{startTime:setup.obStartTime}:firstFrom(obs,touch,'startTime',ob=>ob.dir===-setup.dir);
 if(!reaction)return {status:'pending',touchTime:touch};
 const extreme=firstFrom(setup.dir===1?pivots.highs:pivots.lows,touch,'pivotTime',()=>true);
 // Vorläufige Auslegung (Philip prüft später) — Gegen-FVG nach dem Touch und erst ab der Kerze des Sweep-Extrems: FVGs des Sweep-Schenkels selbst sind der Sweep, keine
 // Fortsetzung (Pin 641: OBs 06:45/06:50 vor dem Extrem 06:55 zählen nicht, IN 07:00). Liegt das Extrem auf der Touch-Kerze, zählt wie
 // bisher erst die Kerze danach (Pin 479).
 const counter=firstFrom(obs,Math.max(touch+1,extreme?.pivotTime??-Infinity),'startTime',ob=>ob.dir===setup.dir);
 if(counter&&counter.startTime<reaction.startTime)return {status:'out',reason:'sweepReactionInterrupted',touchTime:touch};
 const brokenAt=extreme?firstFrom(candles,extreme.pivotTime+1,'time',c=>setup.dir===1?c.high>extreme.price:c.low<extreme.price)?.time??null:null;
 const base={touchTime:touch,reactionOb:reaction,extreme:extreme&&{price:extreme.price,time:extreme.pivotTime},extremeBrokenAt:brokenAt};
 // Vorläufige Auslegung (Philip prüft später): OB-Kerze exklusiv, sie macht oft selbst das Extrem (Mustertrade 49404, #143 Long).
 if(brokenAt!=null&&brokenAt<reaction.startTime)return {...base,status:'out',reason:'sweepExtremeBroken'};
 if(brokenAt!=null&&brokenAt<holdUntil)return {...base,status:'out',reason:'sweepExtremeBrokenBeforeHoldEnd'};
 return {...base,status:'in',late:marketSeconds(candles,ignoredTimes,touch,reaction.startTime)>LS_REACTION_PLAUSIBLE_SECONDS};
}

// Erstes Element ab Zeit t (Arrays aufsteigend nach key sortiert, wie detectOrderBlocks/detectLiquidityLevels liefern): Binärsuche statt
// Vollscan, weil der LQ-Algo das für jede Sweep-Kerze des Jahres fragt.
function marketSeconds(candles,ignoredTimes,from,to){
 let total=0;
 for(let i=indexFrom(candles,from,'time')+1;i<candles.length&&candles[i].time<=to;i++){
  const prev=candles[i-1].time,gap=candles[i].time-prev,slots=gap/300-1;
  const planned=businessSecondsBetween(prev,candles[i].time)<gap||indexFrom(ignoredTimes,candles[i].time)-indexFrom(ignoredTimes,prev+1)>=slots;
  total+=planned?300:gap;
 }
 return total;
}
function indexFrom(rows,t,key){
 let lo=0,hi=rows.length;
 while(lo<hi){const mid=(lo+hi)>>1;if((key?rows[mid][key]:rows[mid])<t)lo=mid+1;else hi=mid;}
 return lo;
}
function firstFrom(rows,t,key,match){
 for(let i=indexFrom(rows,t,key);i<rows.length;i++)if(match(rows[i]))return rows[i];
 return null;
}
