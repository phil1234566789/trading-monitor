import {aggregateDobRoutes} from '../scripts/dobWinrateAggregate.mjs';
import {sessionOccurrences} from './sessionOccurrences.js';
import {berlinDateStrFor,berlinOffsetMinutes} from './berlinTime.js';
import {narrowByEntryPrice} from './simulationPinMatching.js';

// Gleiche Zählung wie die Messung (dobWinrateAggregate): je Route Win/Loss/offen, Winrate nur aus Win+Loss, R = 2·Win − Loss.
// R-Ziel k aus max_r/sl_hit: Win, wenn k vor dem SL erreicht wurde; Loss, wenn der SL vorher kam; sonst offen bzw. unbekannt. Ohne max_r (Lauf noch nicht neu befüllt) gilt nur der gespeicherte 2R-Ausgang.
export const DOB_R_TARGETS=[2,2.5,3,3.5,4,4.5,5];
export function dobTargetOutcome(row,k=2){
 if(row.max_r==null)return k===2?row.outcome:'unknown';
 if(row.max_r>=k)return 'success';
 if(k<=(row.ambiguous_r??-1))return 'ambiguous';
 // Fehlende Kerzen (Ausgang unknown) bleiben unbekannt statt offen.
 return row.sl_hit?'loss':row.outcome==='unknown'?'unknown':'open';
}
const asPairs=(rows,k)=>rows.map(r=>({entries:{[r.route]:{status:'ready',outcome:{status:dobTargetOutcome(r,k)}}}}));
export function dobRouteStats(rows,k=2){
 const routes=aggregateDobRoutes(asPairs(rows,k)).routes;
 for(const c of Object.values(routes))c.sumR=k*c.success-c.loss;
 return routes;
}
export const dobBreakEven=k=>1/(1+k);

// Jahr und Monat nach Erkennung des Paars (Berlin), wie die Messung zählt; die Session nach Entry-Zeit.
export const dobTradeMonth=row=>berlinDateStrFor(row.recognized_at).slice(0,7);
const offset=sec=>berlinOffsetMinutes(sec*1000);
export function dobTradeSessions(row,sessions){
 return sessions.filter(s=>sessionOccurrences(s.from_minutes,s.to_minutes,row.entry_time,row.entry_time+1,offset,s.days).length).map(s=>s.label);
}

// Ein Trade liegt in jeder Session, die seinen Entry umfasst (z.B. NY und MMM); ohne Treffer zählt er unter „ohne Session“.
export function dobGroups(rows,keysOf){
 const groups=new Map();
 for(const row of rows)for(const key of keysOf(row)){if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 return [...groups].map(([key,list])=>({key,count:list.length,rows:list}));
}

// Sprung ins Dashboard: XAU-Chart mit DOB-Ebene, Replay am Ausgang (offen: am Entry), damit Paar, Entry und Ausgang sichtbar sind.
export const dobChartLink=row=>({path:'/',query:{dob:row.id,instrument:row.instrument,bar:'1m',replay:String(row.exit_time??row.entry_time+300)}});
// Laufunabhängige Trade-Identität für Pins (wie uniqueDobTrades, plus Instrument): ein Pin aus v1 erscheint in jedem Lauf mit demselben Trade.
// Gilt für Tabellenzeilen und den eingefrorenen Pin-Kontext gleichermaßen (gleiche Feldnamen).
export const dobTradePinKey=t=>`${t.instrument}:${t.direction}:${t.entry_time}:${t.entry_price}:${t.stop_price}`;
// Pins laufübergreifend wie /statistik (simulationPinMatching): Instrument, Richtung, exakte Entry-Zeit aus dem eingefrorenen Kontext,
// Entry-Preis nur als Tiebreak; bleibt es mehrdeutig, wird nichts zugeordnet. SL zählt bewusst nicht, ein Lauf darf ihn verschieben.
export function matchDobTradePins(pins,rows){
 const byTime=new Map();
 for(const row of rows){const key=`${row.instrument}:${row.direction}:${row.entry_time}`;byTime.set(key,[...byTime.get(key)??[],row]);}
 const matched=new Map();
 for(const pin of pins){
  const c=pin.dobTradeContext;if(!c)continue;
  const candidates=narrowByEntryPrice(byTime.get(`${c.instrument}:${c.direction}:${c.entry_time}`)??[],c.entry_price,row=>row.entry_price);
  if(candidates.length===1&&!matched.has(candidates[0].id))matched.set(candidates[0].id,pin);
 }
 return matched;
}
// Max R: höchste Stufe vor dem SL (dobMaxR, vom Fill-Skript gespeichert). Filter wählt genaue Stufen, mehrere = ODER;
// „≥“-Stufen wären bei Mehrfachauswahl immer nur die kleinste gewählte. Alles unter 2R ist ein Loss und eine Stufe.
export const DOB_MAX_R_FILTERS=['<2','2','2.5','3','3.5','4','4.5','5'];
export const dobMaxRBucket=row=>row.max_r==null?null:row.max_r<2?'<2':String(row.max_r);
export const dobMaxRLabel=value=>value==null?'–':`${value.toLocaleString('de-DE')}R`;
// Anteile je Schwelle unter den entschiedenen Trades mit Max R (Win/Loss), für die Kachel.
export function dobMaxRShares(rows){
 const decided=rows.filter(r=>r.max_r!=null&&(r.outcome==='success'||r.outcome==='loss'));
 const share=min=>decided.length?decided.filter(r=>r.max_r>=min).length/decided.length:null;
 return {n:decided.length,r3:share(3),r4:share(4),r5:share(5)};
}
export const DOB_OUTCOME_LABELS={success:'Win',loss:'Loss',open:'offen',ambiguous:'uneindeutig',unknown:'unbekannt'};
// Eigenes Modul, damit der DOB-Watcher (Deno) das Label ohne die Pin-Abgleich-Kette dieser Datei importieren kann.
export {dobSourceLabel} from './dobSourceLabel.js';
export const dobTradeR=(row,k=2)=>({success:k,loss:-1})[dobTargetOutcome(row,k)]??null;
