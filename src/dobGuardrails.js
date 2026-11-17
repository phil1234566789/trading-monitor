import {berlinOffsetMinutes,berlinDateStrFor} from './berlinTime.js';

// Sperr- und Regel-Konfiguration des DOB-Setups je Instrument (Tabelle dob_guardrails). Eine Quelle für Statistikseite und
// dob-watcher, deshalb rein und nur mit Deno-tauglichen Importen (Dateiendung, siehe test/dobWatcherImports.test.js).
// Default: nichts gesperrt, TP 2R wie das Setup, damit ohne Konfig nichts still wegfällt oder sich ändert.
// entryWindows: Regeln je Entry-Zeitfenster {from, to, action:'block'|'tp', tpR?} in Berlin-Minuten [von, bis), über Mitternacht
// erlaubt (bis < von), Wochentage egal; das erste passende Fenster gilt. Weitere Felder je Fenster können ohne Umbau dazukommen.
export const DOB_DEFAULT_TP_R=2;
export const DOB_GUARDRAILS_DEFAULT=Object.freeze({entryWindows:[],defaultTpR:DOB_DEFAULT_TP_R,blockedMonths:[],minZoneAgeSeconds:null,
 blockedEntryWindows:[]});

const blockedOf=windows=>windows.filter(w=>w.action==='block').map(w=>[w.from,w.to]);
// Konfig aus der DB-Zeile. Ohne entry_windows (alte Zeile oder Leser, der die Spalte nicht abfragt) gelten die Sperren aus
// blocked_entry_windows. blockedEntryWindows bleibt als abgeleitete Liste für ältere Aufrufer erhalten.
export function dobGuardrailsFromRow(row){
 if(!row)return DOB_GUARDRAILS_DEFAULT;
 const entryWindows=Array.isArray(row.entry_windows)?row.entry_windows.map(w=>({...w}))
  :(Array.isArray(row.blocked_entry_windows)?row.blocked_entry_windows:[]).map(([from,to])=>({from,to,action:'block'}));
 return {entryWindows,defaultTpR:Number.isFinite(row.default_tp_r)?row.default_tp_r:DOB_DEFAULT_TP_R,
  blockedMonths:Array.isArray(row.blocked_months)?row.blocked_months:[],
  minZoneAgeSeconds:Number.isFinite(row.min_zone_age_seconds)?row.min_zone_age_seconds:null,blockedEntryWindows:blockedOf(entryWindows)};
}
// blocked_entry_windows wird mitgeschrieben, solange der Watcher noch diese Spalte liest (Übergang, siehe Migration).
export const dobGuardrailsToRow=(instrument,config)=>({instrument,entry_windows:config.entryWindows,default_tp_r:config.defaultTpR,
 blocked_entry_windows:blockedOf(config.entryWindows),blocked_months:config.blockedMonths,min_zone_age_seconds:config.minZoneAgeSeconds});

// Monat in Berlin (1–12). Der Watcher prüft ihn als Erstes und rechnet in gesperrten Monaten gar nicht.
export const dobMonthBlocked=(config,atSec)=>config.blockedMonths.includes(Number(berlinDateStrFor(atSec).slice(5,7)));

const berlinMinute=sec=>Math.floor((((sec+berlinOffsetMinutes(sec*1000)*60)%86400)+86400)%86400/60);
const inWindow=(minute,{from,to})=>from<=to?minute>=from&&minute<to:minute>=from||minute<to;
// Regel für einen Entry: erstes passendes Fenster, sonst Default-TP. {action:'block'|'tp', tpR, window}.
export function dobEntryRule(config,entryTimeSec){
 const minute=berlinMinute(entryTimeSec);
 const windows=config.entryWindows??config.blockedEntryWindows.map(([from,to])=>({from,to,action:'block'}));
 const window=windows.find(w=>inWindow(minute,w))??null;
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
