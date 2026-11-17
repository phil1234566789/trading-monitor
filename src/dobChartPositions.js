import {dobRowGuardrailReason,DOB_GUARDRAILS_DEFAULT} from './dobGuardrails.js';
import {dobRowConfigScore} from './dobPartialProfit.js';
import {entryRiskScale} from './entryRisk.js';
import {candleTouchesPrice} from './structurePivotTime.ts';

// Roher Lauf wie die Kachel „Standard“: TP 2R, nichts gesperrt. Der Default sperrt lebende Gegen-DOBs, deshalb hier ausdrücklich aus.
export const DOB_RAW_CONFIG=Object.freeze({...DOB_GUARDRAILS_DEFAULT,counterDobMode:'off'});

// Ein Lauf-Trade (dob_trade_setups) als Position im Hauptchart: TP und Ausgang nach der Konfig wie auf /dob-statistik
// (dobRowConfigScore inkl. Teilprofit), gesperrte nur mit showBlocked. null = nicht zeichnen. Rest auf Entry ausgestoppt: Ausgang am
// Entry-Preis, erste Kerze nach dem TP1-Treffer, die den Entry berührt (TP1 selbst zeichnet die Position nicht).
// Gespeichert ist nur der Exit für Ziel 2R (bzw. den SL); für andere Ziele sucht die Anzeige die erste Kerze, die TP bzw. SL berührt.
// Auf M5 ist das bis auf die Kerze genau, der Ausgang selbst kommt aber immer aus der Messung (M1).
export function dobChartPosition(row,config,candles,showBlocked=false){
 const blocked=dobRowGuardrailReason(config,row)!=null;
 if((blocked&&!showBlocked)||!candles.length)return null;
 const first=candles[0].time,last=candles.at(-1).time;
 if(row.entry_time>last)return null;
 const score=dobRowConfigScore(config,row),k=score.target;
 const scale=entryRiskScale(row.entry_price,row.stop_price,[],row.instrument,row.direction);
 if(scale.status!=='ready')return null;
 const long=row.direction==='long',targetPrice=row.entry_price+(long?1:-1)*k*scale.risk;
 const outcome={success:'win',loss:'loss'}[score.outcome]??null;
 let exitTime=null,exitPrice=null;
 if(outcome&&score.rest==='breakeven'){
  exitPrice=row.entry_price;
  const tp1=row.entry_price+(long?1:-1)*config.partialAtR*scale.risk;
  const hit=candles.find(c=>c.time>=row.entry_time&&candleTouchesPrice(c,tp1,!long));
  exitTime=hit?candles.find(c=>c.time>hit.time&&candleTouchesPrice(c,exitPrice,long))?.time??null:null;
 }else if(outcome){
  exitPrice=outcome==='win'?targetPrice:row.stop_price;
  const stored=(k===2||outcome==='loss'&&row.outcome==='loss')?row.exit_time:null;
  exitTime=stored??candles.find(c=>c.time>=row.entry_time&&candleTouchesPrice(c,exitPrice,(outcome==='loss')===long))?.time??null;
 }
 // Im Replay liegt der Ausgang womöglich noch in der Zukunft: dann offen bis zur letzten Kerze, sonst verrät der Chart das Ergebnis.
 const visibleOutcome=exitTime!=null&&exitTime<=last?outcome:null;
 const endTime=visibleOutcome?exitTime:last;
 if(endTime<first)return null;
 return {id:row.id,blocked,k,r:score.r,label:score.label,stopPrice:row.stop_price,targetPrice,endTime,
  position:{id:row.id,direction:row.direction,entryTime:row.entry_time,entryPrice:row.entry_price,
   exitTime:visibleOutcome?exitTime:null,exitPrice:visibleOutcome?exitPrice:null,outcome:visibleOutcome}};
}
