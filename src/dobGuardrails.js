import {berlinOffsetMinutes,berlinDateStrFor} from './berlinTime.js';

// Sperr- und Regel-Konfiguration des DOB-Setups je Instrument (Tabelle dob_guardrails). Eine Quelle für Statistikseite und
// dob-watcher, deshalb rein und nur mit Deno-tauglichen Importen (Dateiendung, siehe test/dobWatcherImports.test.js).
// Default: nichts gesperrt, TP 2R wie das Setup, damit ohne Konfig nichts still wegfällt oder sich ändert.
// entryWindows: Regeln je Entry-Zeitfenster {from, to, action:'block'|'tp', tpR?} in Berlin-Minuten [von, bis), über Mitternacht
// erlaubt (bis < von), Wochentage egal; das erste passende Fenster gilt. Weitere Felder je Fenster können ohne Umbau dazukommen.
// enabled:false schaltet eine Regel ab, ohne ihre Werte zu verlieren (fehlt = an); abgeschaltete Regeln wirken nirgends.
// minZoneAgeSeconds ist der wirksame Wert (null = aus), minZoneAgeSavedSeconds der gemerkte Wert für das Wiedereinschalten.
export const DOB_DEFAULT_TP_R=2;
export const DOB_GUARDRAILS_DEFAULT=Object.freeze({entryWindows:[],defaultTpR:DOB_DEFAULT_TP_R,blockedMonths:[],minZoneAgeSeconds:null,
 minZoneAgeSavedSeconds:null});

export const dobRuleActive=w=>w.enabled!==false;
export function dobGuardrailsFromRow(row){
 if(!row)return DOB_GUARDRAILS_DEFAULT;
 return {entryWindows:Array.isArray(row.entry_windows)?row.entry_windows.map(w=>({...w})):[],
  defaultTpR:Number.isFinite(row.default_tp_r)?row.default_tp_r:DOB_DEFAULT_TP_R,
  blockedMonths:Array.isArray(row.blocked_months)?row.blocked_months:[],
  minZoneAgeSeconds:Number.isFinite(row.min_zone_age_seconds)?row.min_zone_age_seconds:null,
  minZoneAgeSavedSeconds:Number.isFinite(row.min_zone_age_saved_seconds)?row.min_zone_age_saved_seconds
   :Number.isFinite(row.min_zone_age_seconds)?row.min_zone_age_seconds:null};
}
export const dobGuardrailsToRow=(instrument,config)=>({instrument,entry_windows:config.entryWindows,default_tp_r:config.defaultTpR,
 blocked_months:config.blockedMonths,min_zone_age_seconds:config.minZoneAgeSeconds,
 min_zone_age_saved_seconds:config.minZoneAgeSavedSeconds??config.minZoneAgeSeconds});

// Monat in Berlin (1–12). Der Watcher prüft ihn als Erstes und rechnet in gesperrten Monaten gar nicht.
export const dobMonthBlocked=(config,atSec)=>config.blockedMonths.includes(Number(berlinDateStrFor(atSec).slice(5,7)));

const berlinMinute=sec=>Math.floor((((sec+berlinOffsetMinutes(sec*1000)*60)%86400)+86400)%86400/60);
const inWindow=(minute,{from,to})=>from<=to?minute>=from&&minute<to:minute>=from||minute<to;
// Regel für einen Entry: erstes passendes Fenster, sonst Default-TP. {action:'block'|'tp', tpR, window}.
export function dobEntryRule(config,entryTimeSec){
 const minute=berlinMinute(entryTimeSec);
 const window=config.entryWindows.find(w=>dobRuleActive(w)&&inWindow(minute,w))??null;
 if(window?.action==='block')return {action:'block',tpR:null,window};
 const tpR=window?.action==='tp'&&Number.isFinite(window.tpR)?window.tpR:config.defaultTpR??DOB_DEFAULT_TP_R;
 return {action:'tp',tpR,window};
}
// TP für einen Entry nach Konfig; gesperrte Fenster bekommen den Default (Statistik rechnet auch gesperrte Trades zur Gegenprobe).
export const dobConfigTpR=(config,entryTimeSec)=>{const rule=dobEntryRule(config,entryTimeSec);return rule.action==='tp'?rule.tpR:config.defaultTpR??DOB_DEFAULT_TP_R;};
export const dobEntryTimeBlocked=(config,entryTimeSec)=>dobEntryRule(config,entryTimeSec).action==='block';

// Alter der Kraftquelle-Zone bis zum Retest. Unbekanntes Alter (keine Quelle, kein Retest) sperrt nicht: ohne Wert kein Urteil.
export const dobZoneAgeBlocked=(config,zoneAgeSeconds)=>
 config.minZoneAgeSeconds!=null&&Number.isFinite(zoneAgeSeconds)&&zoneAgeSeconds<config.minZoneAgeSeconds;

// Gesamturteil für einen Trade: null = erlaubt, sonst der erste greifende Grund in der Reihenfolge des Watchers.
export function dobGuardrailReason(config,{entryTime,zoneAgeSeconds}){
 if(dobMonthBlocked(config,entryTime))return 'blockedMonth';
 if(dobZoneAgeBlocked(config,zoneAgeSeconds))return 'blockedZoneAge';
 if(dobEntryTimeBlocked(config,entryTime))return 'blockedEntryHour';
 return null;
}

// Kurzbeschreibung einer Konfig für Panel-Kopf und Konto-Kachel, z.B. „Sperren 10:30–11:00, 21:00–22:00 · Jan · 09:00–10:00 TP 2R ·
// sonst 2,5R · Zone ≥ 1 Tag“. Nur wirksame Regeln; abgeschaltete zählen als „aus“ am Ende.
const MONTH_NAMES=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const clock=m=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const rText=r=>`${r.toLocaleString('de-DE')}R`;
const ageText=sec=>sec%(7*86400)===0?`${sec/(7*86400)} Wo`:sec%86400===0?`${sec/86400} ${sec===86400?'Tag':'Tage'}`:`${Math.round(sec/3600)} h`;
export function dobGuardrailsSummary(config){
 const active=config.entryWindows.filter(dobRuleActive),span=w=>`${clock(w.from)}–${clock(w.to)}`;
 const blocks=active.filter(w=>w.action==='block').map(span);
 const parts=[blocks.length?`Sperren ${blocks.join(', ')}`:null,
  config.blockedMonths.length?config.blockedMonths.map(m=>MONTH_NAMES[m-1]).join(', '):null,
  ...active.filter(w=>w.action==='tp').map(w=>`${span(w)} TP ${rText(w.tpR)}`),
  `${active.some(w=>w.action==='tp')?'sonst ':'TP '}${rText(config.defaultTpR)}`,
  config.minZoneAgeSeconds!=null?`Zone ≥ ${ageText(config.minZoneAgeSeconds)}`:null,
  config.entryWindows.length>active.length?`${config.entryWindows.length-active.length} Regel${config.entryWindows.length-active.length>1?'n':''} aus`:null];
 return parts.filter(Boolean).join(' · ');
}
