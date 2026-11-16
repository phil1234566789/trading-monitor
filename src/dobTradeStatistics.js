import {aggregateDobRoutes} from '../scripts/dobWinrateAggregate.mjs';
import {sessionOccurrences} from './sessionOccurrences.js';
import {berlinDateStrFor,berlinOffsetMinutes} from './berlinTime.js';

// Gleiche Zählung wie die Messung (dobWinrateAggregate): je Route Win/Loss/offen, Winrate nur aus Win+Loss, R = 2·Win − Loss.
const asPairs=rows=>rows.map(r=>({entries:{[r.route]:{status:'ready',outcome:{status:r.outcome}}}}));
export const dobRouteStats=rows=>aggregateDobRoutes(asPairs(rows)).routes;
export const DOB_BREAK_EVEN_WINRATE=1/3;

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
 return [...groups].map(([key,list])=>({key,count:list.length,routes:dobRouteStats(list)}));
}

// Sprung ins Dashboard: XAU-Chart mit DOB-Ebene, Replay am Ausgang (offen: am Entry), damit Paar, Entry und Ausgang sichtbar sind.
export const dobChartLink=row=>({path:'/',query:{dob:row.id,instrument:row.instrument,bar:'1m',replay:String(row.exit_time??row.entry_time+300)}});
export const DOB_OUTCOME_LABELS={success:'Win',loss:'Loss',open:'offen',ambiguous:'uneindeutig',unknown:'unbekannt'};
// Kraftquelle aus den v1-Feldern, z.B. „H1-OB · 0,8 ATR“; v0 hat keine und zeigt „–“.
export function dobSourceLabel(row){
 if(!row.source_kind)return '–';
 const num=v=>v.toLocaleString('de-DE',{maximumFractionDigits:1});
 const distance=Number.isFinite(row.source_distance_atr)?` · ${num(row.source_distance_atr)} ATR`
  :Number.isFinite(row.source_distance_usd)?` · ${num(row.source_distance_usd)} USD`:'';
 const kind=/^ob_(h\d)$/.exec(row.source_kind);
 return (kind?`${kind[1].toUpperCase()}-OB`:row.source_kind)+distance;
}
export const dobTradeR=row=>row.outcome==='success'?2:row.outcome==='loss'?-1:null;
