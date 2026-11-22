import {berlinOffsetMinutes,berlinDateStrFor} from './berlinTime.js';
import {dobFeaturesOf,dobFeature,dobPoiFeature} from './dobTradeFeatures.js';
import {DOB_LQ_MATCH_LEVELS} from './dobLqSweepPoi.js';
import {dobPoiTypeOf} from './dobPoiType.js';

// Sperr- und Regel-Konfiguration des DOB-Setups je Instrument (Tabelle dob_guardrails). Eine Quelle für Statistikseite und
// dob-watcher, deshalb rein und nur mit Deno-tauglichen Importen (Dateiendung, siehe test/dobWatcherImports.test.js).
// Default: nichts gesperrt, TP 2R wie das Setup, damit ohne Konfig nichts still wegfällt oder sich ändert.
// entryWindows: Regeln je Entry-Zeitfenster {from, to, action:'block'|'tp', tpR?} in Berlin-Minuten [von, bis), über Mitternacht
// erlaubt (bis < von), Wochentage egal; das erste passende Fenster gilt. Weitere Felder je Fenster können ohne Umbau dazukommen.
// enabled:false schaltet eine Regel ab, ohne ihre Werte zu verlieren (fehlt = an); abgeschaltete Regeln wirken nirgends.
// minZoneAgeSeconds ist der wirksame Wert (null = aus), minZoneAgeSavedSeconds der gemerkte Wert für das Wiedereinschalten.
// counterDobMode (v3, Gegen-DOB seit POI-Retest, Status none/dead/live je Trade): live_block_dead_5r = lebende sperren, nur tote
// mit TP 5R (Philips Default), block_all = jeder sperrt, off = Gegen-DOBs ignorieren. TP-Regeln sind Konfig, keine Läufe.
export const DOB_DEFAULT_TP_R=2;
export const DOB_COUNTER_DOB_MODES=['block_all','live_block_dead_5r','off'];
export const DOB_COUNTER_DOB_DEAD_TP_R=5;
export const DOB_COUNTER_DOB_DEFAULT_MODE='live_block_dead_5r';
// counterCandlesMode (DOB-PA, Neubewertung): 3of3 = alle 3 letzten geschlossenen M5 vor dem Entry gegen den Trade → sperren,
// 3of5 = mind. 3 der letzten 5; off = aus (Default, damit ohne Konfig nichts wegfällt).
export const DOB_COUNTER_CANDLES_MODES=['off','3of3','3of5'];
// poiMatchMode (nur POI-Art LQ-Sweep): schwächste Verbindung TS1.1 ↔ DOB, die noch zählt; edge = gleiche Kante (Philips Regel),
// overlap/adjacent zeigen in der Statistik, ob auch Überlappung bzw. knapp daneben trägt. alarmEnabled: Alarme dieser POI-Art
// werden gesendet (aus = nur Protokoll, LQ-Sweep startet aus bis zu Philips Go).
// swingStop (nur HTF-OB, src/dobSwingStop.js): Anti-Confluence „breit“ sperrt nicht, der SL kommt hinter den M15-P2, Ziel fest. Default aus.
export const DOB_POI_MATCH_MODE_LABELS={edge:'gleiche Kante',overlap:'Kante oder Überlappung',adjacent:'Kante, Überlappung oder knapp daneben (XAU ≤ 1 USD, Forex ≤ 3 Pips)'};
export const DOB_GUARDRAILS_DEFAULT=Object.freeze({entryWindows:[],defaultTpR:DOB_DEFAULT_TP_R,blockedMonths:[],minZoneAgeSeconds:null,
 minZoneAgeSavedSeconds:null,counterDobMode:DOB_COUNTER_DOB_DEFAULT_MODE,counterCandlesMode:'off',partialAtR:null,partialPct:50,partialBe:true,
 poiMatchMode:'edge',alarmEnabled:true,swingStop:false});

export const dobRuleActive=w=>w.enabled!==false;
export function dobGuardrailsFromRow(row){
 if(!row)return DOB_GUARDRAILS_DEFAULT;
 return {entryWindows:Array.isArray(row.entry_windows)?row.entry_windows.map(w=>({...w})):[],
  defaultTpR:Number.isFinite(row.default_tp_r)?row.default_tp_r:DOB_DEFAULT_TP_R,
  blockedMonths:Array.isArray(row.blocked_months)?row.blocked_months:[],
  minZoneAgeSeconds:Number.isFinite(row.min_zone_age_seconds)?row.min_zone_age_seconds:null,
  minZoneAgeSavedSeconds:Number.isFinite(row.min_zone_age_saved_seconds)?row.min_zone_age_saved_seconds
   :Number.isFinite(row.min_zone_age_seconds)?row.min_zone_age_seconds:null,
  counterDobMode:DOB_COUNTER_DOB_MODES.includes(row.counter_dob_mode)?row.counter_dob_mode:DOB_COUNTER_DOB_DEFAULT_MODE,
  counterCandlesMode:DOB_COUNTER_CANDLES_MODES.includes(row.counter_candles_mode)?row.counter_candles_mode:'off',
  partialAtR:Number.isFinite(row.partial_at_r)?row.partial_at_r:null,partialPct:Number.isFinite(row.partial_pct)?row.partial_pct:50,
  partialBe:row.partial_be!==false,poiMatchMode:DOB_LQ_MATCH_LEVELS.includes(row.poi_match_mode)?row.poi_match_mode:'edge',
  alarmEnabled:row.alarm_enabled!==false,swingStop:row.swing_stop===true};
}
// Eine Leseform für alle Leser (Seite, Panel, Chart, Watcher, Labore): Konfig je Instrument UND POI-Art; ohne POI-Art
// träfe die Abfrage seit der LQ-Sweep-Zeile zwei Zeilen.
export const dobGuardrailsQuery=(client,instrument,poiType,columns='*')=>client.from('dob_guardrails').select(columns)
 .eq('instrument',instrument).eq('poi_type',dobPoiTypeOf(poiType)).maybeSingle();
export const dobGuardrailsToRow=(instrument,config,poiType)=>({instrument,poi_type:dobPoiTypeOf(poiType),entry_windows:config.entryWindows,default_tp_r:config.defaultTpR,
 blocked_months:config.blockedMonths,min_zone_age_seconds:config.minZoneAgeSeconds,
 min_zone_age_saved_seconds:config.minZoneAgeSavedSeconds??config.minZoneAgeSeconds,counter_dob_mode:config.counterDobMode??DOB_COUNTER_DOB_DEFAULT_MODE,
 counter_candles_mode:config.counterCandlesMode??'off',partial_at_r:config.partialAtR??null,partial_pct:config.partialPct??50,
 partial_be:config.partialBe!==false,poi_match_mode:config.poiMatchMode??'edge',alarm_enabled:config.alarmEnabled!==false,swing_stop:config.swingStop===true});

// Monat in Berlin (1–12). Der Watcher prüft ihn als Erstes und rechnet in gesperrten Monaten gar nicht.
export const dobMonthBlocked=(config,atSec)=>config.blockedMonths.includes(Number(berlinDateStrFor(atSec).slice(5,7)));

const berlinMinute=sec=>Math.floor((((sec+berlinOffsetMinutes(sec*1000)*60)%86400)+86400)%86400/60);
const inWindow=(minute,{from,to})=>from<=to?minute>=from&&minute<to:minute>=from||minute<to;

// Überlappende Entry-Fenster (an oder aus, Fenster über Mitternacht in zwei Stücken): je Index die Indizes der überlappenden Fenster.
// Bei Überlappung entscheidet die Reihenfolge („erstes passendes gilt“), deshalb sortiert die Konfig dann nicht um.
const segments=({from,to})=>from<=to?[[from,to]]:[[from,1440],[0,to]];
export function dobEntryWindowOverlaps(windows){
 const hits=windows.map(()=>[]);
 windows.forEach((a,i)=>windows.forEach((b,j)=>{
  if(j>i&&segments(a).some(([a0,a1])=>segments(b).some(([b0,b1])=>a0<b1&&b0<a1))){hits[i].push(j);hits[j].push(i);}
 }));
 return hits;
}
// Nach Startzeit sortiert, solange sich nichts überlappt (dann ändert die Reihenfolge nichts am Ergebnis); sonst unverändert.
export const dobSortEntryWindows=windows=>dobEntryWindowOverlaps(windows).some(h=>h.length)?windows:[...windows].sort((a,b)=>a.from-b.from);
// Regel für einen Entry: erstes passendes Fenster, sonst Default-TP. {action:'block'|'tp', tpR, window}.
export function dobEntryRule(config,entryTimeSec){
 const minute=berlinMinute(entryTimeSec);
 const window=config.entryWindows.find(w=>dobRuleActive(w)&&inWindow(minute,w))??null;
 if(window?.action==='block')return {action:'block',tpR:null,window};
 const tpR=window?.action==='tp'&&Number.isFinite(window.tpR)?window.tpR:config.defaultTpR??DOB_DEFAULT_TP_R;
 return {action:'tp',tpR,window};
}
// Gegen-DOB nach Modus: sperrt der Status? Bzw. fester TP für nur tote (sonst null). Status null (Läufe ohne Gate) wirkt nie.
export const dobCounterDobBlocked=(config,status)=>{const mode=config.counterDobMode??DOB_COUNTER_DOB_DEFAULT_MODE;
 return mode!=='off'&&(status==='live'||(status==='dead'&&mode==='block_all'));};
export const dobCounterDobTpR=(config,status)=>(config.counterDobMode??DOB_COUNTER_DOB_DEFAULT_MODE)==='live_block_dead_5r'&&status==='dead'?DOB_COUNTER_DOB_DEAD_TP_R:null;
// Gegenkerzen nach Modus; fehlendes Merkmal (ältere Läufe) sperrt nicht.
export function dobCounterCandlesBlocked(config,features){
 const mode=config.counterCandlesMode??'off',n=mode==='3of3'?dobFeature(features,'counterCandles3'):mode==='3of5'?dobFeature(features,'counterCandles5'):null;
 return n!=null&&n>=3;
}
// TP für einen Entry nach Konfig; gesperrte Fenster bekommen den Default (Statistik rechnet auch gesperrte Trades zur Gegenprobe).
// Nur tote Gegen-DOBs im Modus live_block_dead_5r gewinnen vor der Fensterregel.
export const dobConfigTpR=(config,entryTimeSec,counterDobStatus=null)=>{
 const dead=dobCounterDobTpR(config,counterDobStatus);if(dead)return dead;
 const rule=dobEntryRule(config,entryTimeSec);return rule.action==='tp'?rule.tpR:config.defaultTpR??DOB_DEFAULT_TP_R;};
export const dobEntryTimeBlocked=(config,entryTimeSec)=>dobEntryRule(config,entryTimeSec).action==='block';

// Alter der POI-Zone bis zum Retest. Unbekanntes Alter (kein POI, kein Retest) sperrt nicht: ohne Wert kein Urteil.
export const dobZoneAgeBlocked=(config,zoneAgeSeconds)=>
 config.minZoneAgeSeconds!=null&&Number.isFinite(zoneAgeSeconds)&&zoneAgeSeconds<config.minZoneAgeSeconds;

// Gesamturteil für einen Trade: null = erlaubt, sonst der erste greifende Grund in der Reihenfolge des Watchers.
export const dobPoiMatchBlocked=(config,features)=>{const match=dobPoiFeature(features,'match');
 return match!=null&&DOB_LQ_MATCH_LEVELS.indexOf(match)>DOB_LQ_MATCH_LEVELS.indexOf(config.poiMatchMode??'edge');};
export function dobGuardrailReason(config,{entryTime,zoneAgeSeconds,counterDobStatus=null,features={}}){
 if(dobMonthBlocked(config,entryTime))return 'blockedMonth';
 if(dobZoneAgeBlocked(config,zoneAgeSeconds))return 'blockedZoneAge';
 if(dobEntryTimeBlocked(config,entryTime))return 'blockedEntryHour';
 if(dobCounterDobBlocked(config,counterDobStatus))return 'counterDob';
 if(dobCounterCandlesBlocked(config,features))return 'counterCandles';
 if(dobPoiMatchBlocked(config,features))return 'poiMatch';
 return null;
}
// Dieselben Urteile für eine Zeile aus dob_trade_setups (Statistikseite), damit die Feldzuordnung an einer Stelle steht.
// Künftige Merkmale kommen aus der jsonb-Spalte features (Philip), gelesen über eine gemeinsame Funktion, nicht als neue Spalten.
export const dobRowGuardrailReason=(config,row)=>dobGuardrailReason(config,{entryTime:row.entry_time,zoneAgeSeconds:row.poi_zone_age_seconds,
 counterDobStatus:row.counter_dob_status??null,features:dobFeaturesOf(row)});
export const dobRowConfigTpR=(config,row)=>dobConfigTpR(config,row.entry_time,row.counter_dob_status??null);
// Teilprofit (partialAtR, null = aus): pct % bei atR schließen, be = Rest-SL danach auf Entry, Rest bis zum Konfig-TP. Liegt der TP
// bei ≤ atR, gibt es keinen Teilprofit (alles beim TP). Rechnung je Trade: src/dobPartialProfit.js.
export const dobPartialPlan=(config,tpR)=>config.partialAtR!=null&&tpR>config.partialAtR
 ?{atR:config.partialAtR,pct:config.partialPct??50,be:config.partialBe!==false}:null;
export const dobPartialText=({atR,pct,be})=>`Teilprofit ${pct} % bei ${rText(atR)}${be?' → SL auf Entry':''}`;

// Kurzbeschreibung einer Konfig für Panel-Kopf und Konto-Kachel, z.B. „Sperren 10:30–11:00, 21:00–22:00 · Jan · 09:00–10:00 TP 2R ·
// sonst 2,5R · Zone ≥ 1 Tag“. Nur wirksame Regeln; abgeschaltete zählen als „aus“ am Ende.
const MONTH_NAMES=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const clock=m=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const rText=r=>`${r.toLocaleString('de-DE')}R`;
const ageText=sec=>sec%(7*86400)===0?`${sec/(7*86400)} Wo`:sec%86400===0?`${sec/86400} ${sec===86400?'Tag':'Tage'}`:`${Math.round(sec/3600)} h`;
export const DOB_COUNTER_DOB_MODE_LABELS={block_all:'Gegen-DOB sperrt',live_block_dead_5r:'lebender Gegen-DOB sperrt, nur tote TP 5R',off:'Gegen-DOB aus'};
export const DOB_COUNTER_CANDLES_MODE_LABELS={off:'Gegenkerzen aus','3of3':'3 von 3 Gegenkerzen sperrt','3of5':'3 von 5 Gegenkerzen sperrt'};
export const DOB_SWING_STOP_LABEL='Anti-Confluence: SL hinter M15-P2 statt Sperre';
export function dobGuardrailsSummary(config){
 const active=config.entryWindows.filter(dobRuleActive),span=w=>`${clock(w.from)}–${clock(w.to)}`;
 const blocks=active.filter(w=>w.action==='block').map(span);
 const parts=[blocks.length?`Sperren ${blocks.join(', ')}`:null,
  config.blockedMonths.length?config.blockedMonths.map(m=>MONTH_NAMES[m-1]).join(', '):null,
  ...active.filter(w=>w.action==='tp').map(w=>`${span(w)} TP ${rText(w.tpR)}`),
  `${active.some(w=>w.action==='tp')?'sonst ':'TP '}${rText(config.defaultTpR)}`,
  config.minZoneAgeSeconds!=null?`Zone ≥ ${ageText(config.minZoneAgeSeconds)}`:null,
  // Der Default-Modus bleibt still (gilt nur im v3-Lauf, das Panel zeigt den Schalter dort); Abweichungen stehen im Kopf.
  (config.counterDobMode??DOB_COUNTER_DOB_DEFAULT_MODE)!==DOB_COUNTER_DOB_DEFAULT_MODE?DOB_COUNTER_DOB_MODE_LABELS[config.counterDobMode]:null,
  (config.counterCandlesMode??'off')!=='off'?DOB_COUNTER_CANDLES_MODE_LABELS[config.counterCandlesMode]:null,
  (config.poiMatchMode??'edge')!=='edge'?`POI: ${DOB_POI_MATCH_MODE_LABELS[config.poiMatchMode]}`:null,
  config.swingStop?DOB_SWING_STOP_LABEL:null,
  config.partialAtR!=null?dobPartialText({atR:config.partialAtR,pct:config.partialPct??50,be:config.partialBe!==false}):null,
  config.entryWindows.length>active.length?`${config.entryWindows.length-active.length} Regel${config.entryWindows.length-active.length>1?'n':''} aus`:null];
 return parts.filter(Boolean).join(' · ');
}
