import {dobEntryRule,dobMonthBlocked,dobZoneAgeBlocked,dobCounterDobBlocked,dobCounterCandlesBlocked,dobPoiMatchBlocked} from './dobGuardrails.js';
import {dobTargetOutcome} from './dobTargetOutcome.js';
import {dobFeaturesOf} from './dobTradeFeatures.js';
import {berlinDateStrFor} from './berlinTime.js';

// Statistik je Konfig-Sperre für den ⛔-Alarm (Philip, Q23: „mit schlechter Winrate angeben“): je Sperrgrund die Trades des
// Referenzlaufs (dobCanonicalRunId), die genau diese Sperre trifft, mit Winrate und ΣR bei festem 3R. Je Grund unabhängig gezählt
// (ein Trade kann unter mehreren Sperren stehen). Der Watcher rechnet sie nur neu, wenn sich die Konfig ändert oder sie einen Tag alt ist.
const monthOf=sec=>Number(berlinDateStrFor(sec).slice(5,7));
const windowKey=w=>`window:${w.from}-${w.to}`;
// Win/Loss bei festem 3R wie die Statistik (dobTotalStats): Winrate aus Win+Loss, ΣR = 3·Win − Loss.
const stats3=list=>list.reduce((s,r)=>{const o=dobTargetOutcome(r,3);if(o==='success')s.win++;else if(o==='loss')s.loss++;return s;},{win:0,loss:0});

// Schlüssel eines Sperrgrunds für einen Entry; null = Grund ohne Statistik.
export function dobBlockKey(config,reason,entryTime){
 if(reason==='blockedEntryHour'){const w=dobEntryRule(config,entryTime).window;return w?windowKey(w):null;}
 if(reason==='blockedMonth')return `month:${monthOf(entryTime)}`;
 return ['blockedZoneAge','counterDob','counterCandles'].includes(reason)?reason:null;
}

export function dobBlockStats(config,rows){
 const pool=rows.filter(r=>!dobPoiMatchBlocked(config,dobFeaturesOf(r))),groups=new Map();
 const add=(key,row)=>(groups.get(key)??groups.set(key,[]).get(key)).push(row);
 for(const r of pool){
  if(dobMonthBlocked(config,r.entry_time))add(`month:${monthOf(r.entry_time)}`,r);
  const rule=dobEntryRule(config,r.entry_time);
  if(rule.action==='block')add(windowKey(rule.window),r);
  if(dobZoneAgeBlocked(config,r.poi_zone_age_seconds))add('blockedZoneAge',r);
  if(dobCounterDobBlocked(config,r.counter_dob_status))add('counterDob',r);
  if(dobCounterCandlesBlocked(config,dobFeaturesOf(r)))add('counterCandles',r);
 }
 const years=[...new Set(pool.map(r=>berlinDateStrFor(r.entry_time).slice(0,4)))].sort();
 return {years:years.length?`${years[0]}${years.length>1?`–${years.at(-1)}`:''}`:null,
  byKey:Object.fromEntries([...groups].map(([key,list])=>{const s=stats3(list);
   return [key,{n:list.length,wr3:s.win+s.loss?Math.round(s.win/(s.win+s.loss)*1000)/10:null,sum3:3*s.win-s.loss}];}))};
}

// „ · dort WR3 18 %, −12R (2026)“ oder leer, wenn für den Grund keine Zahl vorliegt.
export function dobBlockStatsText(stats,key){
 const s=key&&stats?.byKey?.[key];
 if(!s||!s.n||s.wr3==null)return '';
 const sum=`${s.sum3>0?'+':s.sum3<0?'−':''}${Math.abs(s.sum3).toLocaleString('de-DE')}R`;
 return ` · dort WR3 ${s.wr3.toLocaleString('de-DE')} %, ${sum}${stats.years?` (${stats.years})`:''}`;
}
