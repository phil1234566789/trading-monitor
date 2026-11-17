import {formatBerlinTime,berlinDateStrFor} from './berlinTime.js';
import {dobSourceLabel,dobRetestLabel} from './dobSourceLabel.js';
import {m1GapCovered} from './goldWeekendGap.js';

// Alarme des DOB-Live-Watchers (supabase/functions/dob-watcher) aus dem Ergebnis von checkDobTradeSetup(). Rein, damit Vitest
// und Edge Function dieselben Schlüssel und Texte nutzen. Alarm-Zeitpunkt (Q3): OB2-Retest; zweiter Alarm beim Entry.
export const DOB_SITE_URL='https://phil1234566789.github.io/trading-monitor/';
// Beim (Neu-)Start meldet der Watcher nur frische Phasen, keine des ganzen Tages nach.
export const DOB_ALARM_FRESH_SECONDS=15*60;
// Ohne neue M1-Kerze so lange bei offenem Markt: lieber ein Hinweis als stilles Schweigen.
export const DOB_STALE_SECONDS=5*60;
const ENTERED=new Set(['entry','win','loss','ambiguous','unknown']);
// Sperren aus dob_guardrails: gesperrte Fälle kommen ins Protokoll (dob_alarm_events.guardrail), aber nicht als normaler Alarm.
const GUARDRAILS=new Set(['blockedZoneAge','blockedEntryHour','counterDob']);
// Q23 (Philip offen): Entry in gesperrter Stunde → 'warn' = Entry-Alarm mit Hinweis „kein Trade“, 'none' = nur Protokoll.
export const DOB_BLOCKED_ENTRY_ALARM='warn';
// v3: Entry trotz Gegen-DOB seit Quellen-Retest → 'warn' = „⛔ Gegen-DOB seit Retest, kein Trade“, 'none' = nur Protokoll.
export const DOB_COUNTER_DOB_ALARM='warn';
const WARN_TEXT={blockedEntryHour:'Entry in Sperrzeit',counterDob:'Gegen-DOB seit Retest, Entry'};

const price=v=>Number.isFinite(v)?v.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}):'–';
const zone=z=>`${price(z.bottom)}–${price(z.top)}`;
const side=direction=>direction==='long'?'Long':'Short';
export const dobChartUrl=(id,instrument,at)=>`${DOB_SITE_URL}#/?dob=${encodeURIComponent(id)}&instrument=${instrument}&bar=1m&replay=${at}`;
function sourceLine({sourceOfStrength:s}){
 if(!s)return 'Quelle der Kraft: –';
 const label=dobSourceLabel({source_kind:`ob_${s.timeframe.toLowerCase()}`,source_distance_atr:s.distanceAtr});
 const touch=dobRetestLabel({kind:s.retestKind,count:s.retestCount,ageSeconds:s.retestAgeSeconds});
 const retest=touch?` · ${touch}`:s.retested?' · retestet':'';
 return `Quelle der Kraft: ${label} · Zone ${zone(s.zone)}${retest}`;
}
const hhmm=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
// Ohne Konfig (tpRule fehlt) bleibt es beim festen 2R des Setups.
const tpLabel=({tpRule:r})=>!r?'TP 2R':`TP ${String(r.tpR).replace('.',',')}R (${r.window?.action==='tp'?`Fensterregel ${hhmm(r.window.from)}–${hhmm(r.window.to)}`:'Standard'})`;
const obLines=({chart})=>[`OB1 ${formatBerlinTime(chart.firstOrderBlockStart)} · ${zone(chart.firstOrderBlock)}`,
 `OB2 ${formatBerlinTime(chart.secondOrderBlockStart)} · ${zone(chart.secondOrderBlock)}`];

// Dedup: mehrere OB1-Partner tragen oft dasselbe OB2 bzw. denselben Trade, deshalb Schlüssel über OB2 bzw. Entry/SL statt Setup-ID.
// Erlaubte Setups zuerst: trägt irgendein Paar den Alarm ungesperrt, gewinnt es den Schlüssel (wie die Statistik-Dedup).
// suppressed = nur Protokoll, nicht senden.
export function dobAlarmEvents(result,evaluatedAt,{blockedEntryAlarm=DOB_BLOCKED_ENTRY_ALARM,counterDobAlarm=DOB_COUNTER_DOB_ALARM}={}){
 const events=new Map();
 for(const s of [...result.setups,...result.rejected.filter(r=>GUARDRAILS.has(r.reason))]){
  const instrument=s.instrument??'XAUUSD',guardrail=s.reason??null;
  if(s.phase==='ob2Retest'&&s.phaseSince>=evaluatedAt-DOB_ALARM_FRESH_SECONDS){
   const id=`dob:retest:${instrument}:${s.direction}:${s.chart.secondOrderBlockStart}`;
   if(!events.has(id))events.set(id,{id,phase:'ob2Retest',setupId:s.id,instrument,direction:s.direction,signalAt:s.phaseSince,guardrail,suppressed:!!guardrail,
    text:[`🟡 DOB ${instrument} ${side(s.direction)} · OB2-Retest ${formatBerlinTime(s.phaseSince)}`,sourceLine(s),...obLines(s),
     `Entry-Zone: OB2 ${zone(s.chart.secondOrderBlock)} · Entry nach der OB2-Reaktion (Route a/b), SL laut Indikator, TP je nach Entry-Fensterregel`,
     dobChartUrl(id,instrument,s.phaseSince)].join('\n')});
  }
  if(ENTERED.has(s.phase)&&s.entryTime>=evaluatedAt-DOB_ALARM_FRESH_SECONDS){
   const id=`dob:entry:${instrument}:${s.direction}:${s.entryTime}:${s.entryPrice}:${s.stopPrice}`;
   const warn=({blockedEntryHour:blockedEntryAlarm,counterDob:counterDobAlarm})[guardrail]==='warn';
   if(!events.has(id))events.set(id,{id,phase:'entry',setupId:s.id,instrument,direction:s.direction,signalAt:s.entryTime,guardrail,suppressed:!!guardrail&&!warn,
    text:[warn?`⛔ DOB ${instrument} ${side(s.direction)} · ${WARN_TEXT[guardrail]} ${formatBerlinTime(s.entryTime)}, kein Trade`
     :`🟢 DOB ${instrument} ${side(s.direction)} · Entry ${s.route} ${formatBerlinTime(s.entryTime)}`,
     `Entry ${price(s.entryPrice)} · SL ${price(s.stopPrice)} · ${tpLabel(s)} ${price(s.targetPrice)}`,sourceLine(s),...obLines(s),
     dobChartUrl(id,instrument,s.entryTime+60)].join('\n')});
  }
 }
 return [...events.values()];
}

// Datenlücke bei offenem Markt (FXCM-Collector steht): ein Hinweis je Stunde statt stillem Ausfall.
export function dobStaleAlarm({instrument='XAUUSD',lastM1Time,evaluatedAt}){
 const next=Number.isFinite(lastM1Time)?lastM1Time+60:null;
 if(next!=null&&(evaluatedAt-next<DOB_STALE_SECONDS||m1GapCovered(instrument,next,Math.floor(evaluatedAt/60)*60)))return null;
 const hour=formatBerlinTime(Math.floor(evaluatedAt/3600)*3600);
 return {id:`dob:stale:${instrument}:${berlinDateStrFor(evaluatedAt)}:${hour}`,phase:'stale',instrument,signalAt:evaluatedAt,
  text:`⚠️ DOB-Watcher ${instrument}: keine neuen M1-Kerzen seit ${next==null?'–':formatBerlinTime(next)}. Alarme können fehlen, FXCM-Collector prüfen.`};
}
