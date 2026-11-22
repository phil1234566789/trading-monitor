import {aggregateDobRoutes} from '../scripts/dobWinrateAggregate.mjs';
import {sessionOccurrences} from './sessionOccurrences.js';
import {berlinDateStrFor,berlinOffsetMinutes} from './berlinTime.js';
import {narrowByEntryPrice} from './simulationPinMatching.js';

// Gleiche Zählung wie die Messung (dobWinrateAggregate): je Route Win/Loss/offen, Winrate nur aus Win+Loss, R = 2·Win − Loss.
// R-Ziel k aus max_r/sl_hit: src/dobTargetOutcome.js (eigene Datei, damit der dob-watcher es ohne die Statistik-Abhängigkeiten bündelt).
export {dobTargetOutcome} from './dobTargetOutcome.js';
import {dobTargetOutcome} from './dobTargetOutcome.js';
// k: festes Ziel für alle Trades oder Funktion je Trade (Konfig: TP aus der Regel seines Entry-Fensters); ΣR je Trade mit seinem k.
// Liefert die Funktion ein Ergebnis {target, outcome, r} (dobRowConfigScore, Teilprofit), zählt dessen r.
export function dobRouteStats(rows,k=2){
 const kOf=typeof k==='function'?k:()=>k;
 const scored=rows.map(r=>{const t=kOf(r);
  if(typeof t==='object')return {route:r.route,...t};
  const outcome=dobTargetOutcome(r,t);return {route:r.route,target:t,outcome,r:outcome==='success'?t:outcome==='loss'?-1:null};});
 const routes=aggregateDobRoutes(scored.map(s=>({entries:{[s.route]:{status:'ready',outcome:{status:s.outcome}}}}))).routes;
 for(const [route,c] of Object.entries(routes))
  c.sumR=Math.round(scored.filter(s=>s.route===route).reduce((sum,s)=>sum+(s.r??0),0)*1000)/1000;
 return routes;
}
export const dobBreakEven=k=>1/(1+k);
// Die Seite zeigt diese Ziele fest nebeneinander (Schwerpunkt 3R und 5R); kompakt „37,9 % · +54“.
export const DOB_STAT_TARGETS=[2,3,4,5];
export const dobPct=v=>v==null?'–':`${(v*100).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})} %`;
export const dobSignedR=r=>r==null?'–':`${r>0?'+':r<0?'−':'±'}${Math.abs(r).toLocaleString('de-DE')}`;
export const dobWinTone=(v,k)=>v==null?'':v>dobBreakEven(k)?'positive':v<dobBreakEven(k)?'negative':'';

// Jahr und Monat nach Erkennung des Paars (Berlin), wie die Messung zählt; die Session nach Entry-Zeit.
export const dobTradeMonth=row=>berlinDateStrFor(row.recognized_at).slice(0,7);
// Halbjahr und Wochentag nach Berliner Entry-Datum (Sperren-Gegenprobe, Tabelle je Wochentag).
export const DOB_HALVES=['Jan–Jun','Jul–Dez'];
export const dobTradeHalf=row=>Number(berlinDateStrFor(row.entry_time).slice(5,7))<=6?DOB_HALVES[0]:DOB_HALVES[1];
// Ø Trades je Kalenderwoche (Montag–Sonntag, Berliner Entry-Datum): Wochen von der ersten bis zur letzten Woche mit Trades, leere
// Wochen dazwischen zählen mit. Eine Nachkommastelle in der Anzeige.
const berlinWeek=row=>{const [y,m,d]=berlinDateStrFor(row.entry_time).split('-').map(Number);return Math.floor((Date.UTC(y,m-1,d)/86400000+3)/7);};
export function dobTradesPerWeek(rows){
 if(!rows.length)return {n:0,weeks:0,perWeek:null};
 const weeks=rows.map(berlinWeek),span=Math.max(...weeks)-Math.min(...weeks)+1;
 return {n:rows.length,weeks:span,perWeek:rows.length/span};
}
export const dobPerWeekText=w=>w.perWeek==null?'–':w.perWeek.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
export const DOB_WEEKDAYS=[[1,'Montag'],[2,'Dienstag'],[3,'Mittwoch'],[4,'Donnerstag'],[5,'Freitag'],[6,'Samstag'],[0,'Sonntag']];
export const dobTradeWeekday=row=>new Date(`${berlinDateStrFor(row.entry_time)}T12:00:00Z`).getUTCDay();
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
// Replay 4 h nach dem Ausgang (Philip: Nachlauf sehen), höchstens bis jetzt (volle Minute), solange die Zukunft live noch fehlt.
export const DOB_CHART_AFTER_EXIT_SECONDS=4*3600;
export const dobChartLink=(row,nowSec=Math.floor(Date.now()/1000))=>({path:'/',query:{dob:row.id,instrument:row.instrument,bar:'5m',
 replay:String(Math.min((row.exit_time??row.entry_time+300)+DOB_CHART_AFTER_EXIT_SECONDS,Math.floor(nowSec/60)*60))}});
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
// Mustertrades (Pin-Typ model) müssen jeden Neulauf derselben POI-Art im gerechneten Zeitraum überleben; fehlende stoppen das Schreiben.
export const dobRunPoiType=runId=>runId.includes('lq-sweep')?'lq_sweep':'htf_ob';
export function missingDobModelTrades(pins,rows,{poiType,fromSec=0}){
 const matched=new Set(matchDobTradePins(pins,rows).values());
 return pins.filter(p=>p.pinType==='model'&&p.dobTradeContext&&dobRunPoiType(p.dobTradeContext.run_id)===poiType
  &&p.dobTradeContext.entry_time>=fromSec&&!matched.has(p));
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
// Alle Routen zusammen (Kacheln je Retest-Art, Zwischensummen).
export const dobTotalStats=(rows,k=2)=>dobRouteStats(rows.map(r=>({...r,route:'a'})),k).a;
export const DOB_RETEST_KINDS={first:'erster Touch',followUp:'Folge-Touch'};

// Börsenöffnungen in Berlin-Zeit, ganzjährig gleich, weil Frankfurt und London die Sommerzeit wie Berlin wechseln (gängige Forex-Angabe:
// Frankfurt 07:00 GMT, London 08:00 GMT, jeweils lokale Winterzeit). Bewusst nicht in der sessions-Tabelle: sie benennen nur Lücken zwischen Sessions.
export const DOB_EXCHANGE_OPENS=[{minutes:8*60,name:'Frankfurt'},{minutes:9*60,name:'London'}];

// Tageszeit-Slots (Berlin, Entry-Zeit): volle Stunden, an Session-Grenzen auf halber Stunde geteilt (z.B. 10:00–10:30 / 10:30–11:00).
// Gruppiert unter der Session, in der der Slot beginnt (aus der sessions-Tabelle, folgt also Änderungen im Sessions-Modal). Lücken zwischen
// Sessions sind eigene Gruppen mit ihrer Uhrzeit als Titel, geteilt an Börsenöffnungen („vor Frankfurt“, „Frankfurt-Open“, „London-Open“),
// weil die Liquidität mit den Börsenöffnungen kommt. Wochentage der Sessions spielen für die Gruppierung keine Rolle.
const hhmm=m=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const inSession=(s,m)=>s.from_minutes<=s.to_minutes?m>=s.from_minutes&&m<s.to_minutes:m>=s.from_minutes||m<s.to_minutes;
export function dobTimeSlotGroups(rows,sessions,opens=DOB_EXCHANGE_OPENS){
 const cuts=[...new Set([...Array.from({length:25},(_,h)=>h*60),...sessions.flatMap(s=>[s.from_minutes%1440,s.to_minutes%1440]),
  ...opens.map(o=>o.minutes)])].sort((a,b)=>a-b);
 const ordered=[...sessions].sort((a,b)=>a.from_minutes-b.from_minutes);
 const slots=cuts.slice(0,-1).map((start,i)=>({start,end:cuts[i+1],label:`${hhmm(start)}–${hhmm(cuts[i+1])}`,rows:[],
  session:ordered.find(s=>inSession(s,start))?.label??null,open:opens.find(o=>o.minutes===start)??null}));
 for(const row of rows){
  const m=Math.floor(((row.entry_time+berlinOffsetMinutes(row.entry_time*1000)*60)%86400+86400)%86400/60);
  slots.find(s=>m>=s.start&&m<s.end).rows.push(row);
 }
 const groups=[];
 for(const slot of slots){
  const last=groups.at(-1);
  if(last&&last.session===slot.session&&!(slot.session==null&&slot.open))last.slots.push(slot);
  else groups.push({session:slot.session,open:slot.session==null?slot.open:null,slots:[slot]});
 }
 // Lückenteil vor der ersten Öffnung derselben Lücke heißt „vor <Börse>“.
 groups.forEach((g,i)=>{if(g.session==null&&!g.open&&groups[i+1]?.session==null&&groups[i+1]?.open)g.before=groups[i+1].open;});
 return groups.map(g=>{
  const range=`${g.slots[0].label.slice(0,5)}–${g.slots.at(-1).label.slice(6)}`;
  const phase=g.open?`${g.open.name}-Open`:g.before?`vor ${g.before.name}`:null;
  return {title:g.session??(phase?`${range} · ${phase}`:range),slots:g.slots.filter(s=>s.rows.length),rows:g.slots.flatMap(s=>s.rows)};
 }).filter(g=>g.rows.length);
}

// Alter der H1/H4-Zone von ihrer Entstehung bis zum Retest (Start der letzten Touch-Episode vor OB1), nur v1/v2.
const DAY=86400;
export const DOB_ZONE_AGE_BUCKETS=[['< 1 Tag',DAY],['1–3 Tage',3*DAY],['3–7 Tage',7*DAY],['1–4 Wochen',28*DAY],['> 4 Wochen',Infinity]];
export const dobZoneAgeBucket=row=>Number.isFinite(row.poi_zone_age_seconds)?DOB_ZONE_AGE_BUCKETS.find(([,max])=>row.poi_zone_age_seconds<max)[0]:null;
// Rückkehr aus dem Chart-Tab erkennen: nur nach „Im Chart“ (arm) und erst, wenn die Seite danach verborgen war und wieder sichtbar
// wird, genau einmal true. Fokuswechsel, Klicks, Dropdowns oder ein Tabwechsel ohne vorheriges „Im Chart“ lösen nichts aus.
export function dobReturnTracker(){
 let armed=false,left=false;
 return {arm(){armed=true;left=false;},
  visibility(hidden){if(!armed)return false;if(hidden){left=true;return false;}if(!left)return false;armed=false;left=false;return true;}};
}
// SL-Vergleich: dieselbe Zeile mit den Werten der weiten SL-Variante (ferne OB2-Kante); nur Trades mit Variante (Extrem-SL).
export const dobHasWideVariant=row=>row.wide_max_r!=null;
export const dobAsWide=row=>({...row,max_r:row.wide_max_r,sl_hit:row.wide_sl_hit,ambiguous_r:row.wide_ambiguous_r});
// SL-Variante (c) (Konfig swingStop, nur HTF-OB): Trades mit Anti-Confluence und M15-P2 rechnen mit dessen Werten, alle anderen
// unverändert. stop_price bleibt (Pin-Schlüssel), der neue SL steht in swing_stop_price.
export const dobHasSwingStopVariant=row=>row.swing_max_r!=null;
export const dobRowStopPrice=(config,row)=>config?.swingStop&&dobHasSwingStopVariant(row)?row.swing_stop_price:row.stop_price;
export const dobAsSwingStop=row=>dobHasSwingStopVariant(row)?{...row,max_r:row.swing_max_r,sl_hit:row.swing_sl_hit,ambiguous_r:row.swing_ambiguous_r}:row;
export const dobMedian=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return v.length?v[v.length>>1]:null;};
export const DOB_OUTCOME_LABELS={success:'Win',loss:'Loss',open:'offen',ambiguous:'uneindeutig',unknown:'unbekannt'};
// Eigenes Modul, damit der DOB-Watcher (Deno) das Label ohne die Pin-Abgleich-Kette dieser Datei importieren kann.
export {dobPoiLabel} from './dobPoiLabel.js';
export const dobTradeR=(row,k=2)=>({success:k,loss:-1})[dobTargetOutcome(row,k)]??null;
