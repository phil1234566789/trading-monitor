import {berlinOffsetMinutes,berlinDateStrFor} from './berlinTime.js';

// Sperr-Konfiguration des DOB-Setups je Instrument (Tabelle dob_guardrails): „hier keine Trades“. Eine Quelle für Statistikseite und
// dob-watcher, deshalb rein und nur mit Deno-tauglichen Importen (Dateiendung, siehe test/dobWatcherImports.test.js).
// Default: nichts gesperrt, damit ohne Konfig nichts still wegfällt.
export const DOB_GUARDRAILS_DEFAULT=Object.freeze({blockedEntryWindows:[],blockedMonths:[],minZoneAgeSeconds:null});

export function dobGuardrailsFromRow(row){
 if(!row)return DOB_GUARDRAILS_DEFAULT;
 return {blockedEntryWindows:Array.isArray(row.blocked_entry_windows)?row.blocked_entry_windows:[],
  blockedMonths:Array.isArray(row.blocked_months)?row.blocked_months:[],
  minZoneAgeSeconds:Number.isFinite(row.min_zone_age_seconds)?row.min_zone_age_seconds:null};
}
export const dobGuardrailsToRow=(instrument,config)=>({instrument,blocked_entry_windows:config.blockedEntryWindows,
 blocked_months:config.blockedMonths,min_zone_age_seconds:config.minZoneAgeSeconds});

// Monat in Berlin (1–12). Der Watcher prüft ihn als Erstes und rechnet in gesperrten Monaten gar nicht.
export const dobMonthBlocked=(config,atSec)=>config.blockedMonths.includes(Number(berlinDateStrFor(atSec).slice(5,7)));

// Entry-Zeitfenster in Berlin-Minuten [von, bis), über Mitternacht erlaubt (bis < von), Wochentage egal.
export function dobEntryTimeBlocked(config,entryTimeSec){
 const minute=Math.floor((((entryTimeSec+berlinOffsetMinutes(entryTimeSec*1000)*60)%86400)+86400)%86400/60);
 return config.blockedEntryWindows.some(([from,to])=>from<=to?minute>=from&&minute<to:minute>=from||minute<to);
}

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
