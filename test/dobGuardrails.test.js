import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {DOB_GUARDRAILS_DEFAULT,dobGuardrailsFromRow,dobGuardrailsToRow,dobGuardrailReason,dobEntryTimeBlocked,dobMonthBlocked,dobEntryRule,dobGuardrailsSummary,dobRowGuardrailReason,dobRowConfigTpR,dobEntryWindowOverlaps,dobSortEntryWindows}
 from '../src/dobGuardrails.js';

// Berlin-Zeit: Januar = CET (UTC+1), August = CEST (UTC+2).
const berlin=(y,mo,d,h,mi,offset)=>Date.UTC(y,mo-1,d,h-offset,mi)/1000;
const config=dobGuardrailsFromRow({entry_windows:[{from:630,to:720,action:'block'},{from:1320,to:120,action:'block'}],blocked_months:[1],min_zone_age_seconds:86400});

describe('dobGuardrails',()=>{
 it('Default sperrt nichts',()=>{
  expect(dobGuardrailReason(DOB_GUARDRAILS_DEFAULT,{entryTime:berlin(2026,1,5,11,0,1),zoneAgeSeconds:60})).toBe(null);
  expect(dobGuardrailsFromRow(null)).toBe(DOB_GUARDRAILS_DEFAULT);
 });
 it('Monat nach Berlin, auch am Monatswechsel',()=>{
  expect(dobMonthBlocked(config,berlin(2026,2,1,0,30,1))).toBe(false); // UTC noch 31.01.
  expect(dobMonthBlocked(config,berlin(2026,1,31,23,30,1))).toBe(true);
 });
 it('Entry-Fenster in Berlin-Minuten, Sommer- und Winterzeit, über Mitternacht',()=>{
  expect(dobEntryTimeBlocked(config,berlin(2026,8,3,10,30,2))).toBe(true);
  expect(dobEntryTimeBlocked(config,berlin(2026,8,3,12,0,2))).toBe(false); // bis exklusiv
  expect(dobEntryTimeBlocked(config,berlin(2026,11,3,10,45,1))).toBe(true);
  expect(dobEntryTimeBlocked(config,berlin(2026,11,3,1,0,1))).toBe(true);
  expect(dobEntryTimeBlocked(config,berlin(2026,11,3,3,0,1))).toBe(false);
 });
 it('Gründe in Watcher-Reihenfolge, unbekanntes Zonenalter sperrt nicht',()=>{
  expect(dobGuardrailReason(config,{entryTime:berlin(2026,1,5,15,0,1),zoneAgeSeconds:60})).toBe('blockedMonth');
  expect(dobGuardrailReason(config,{entryTime:berlin(2026,8,5,10,45,2),zoneAgeSeconds:3600})).toBe('blockedZoneAge');
  expect(dobGuardrailReason(config,{entryTime:berlin(2026,8,5,10,45,2),zoneAgeSeconds:null})).toBe('blockedEntryHour');
  expect(dobGuardrailReason(config,{entryTime:berlin(2026,8,5,15,0,2),zoneAgeSeconds:2*86400})).toBe(null);
 });
 it('DB-Zeile hin und zurück',()=>{
  const rules={...config,entryWindows:[{from:480,to:630,action:'tp',tpR:2},{from:630,to:720,action:'block'}],defaultTpR:4};
  const row=dobGuardrailsToRow('XAUUSD',rules);
  expect(dobGuardrailsFromRow(row)).toEqual({...rules,minZoneAgeSavedSeconds:86400});
 });
 it('Regel je Fenster: Sperre, fester TP, sonst Default-TP; erstes passendes Fenster gilt',()=>{
  const rules=dobGuardrailsFromRow({entry_windows:[{from:480,to:630,action:'tp',tpR:2},{from:600,to:720,action:'block'}],default_tp_r:4});
  expect(dobEntryRule(rules,berlin(2026,8,3,8,30,2))).toMatchObject({action:'tp',tpR:2});
  expect(dobEntryRule(rules,berlin(2026,8,3,10,15,2))).toMatchObject({action:'tp',tpR:2}); // erstes Fenster gewinnt
  expect(dobEntryRule(rules,berlin(2026,8,3,11,0,2))).toMatchObject({action:'block',tpR:null});
  expect(dobEntryRule(rules,berlin(2026,8,3,15,0,2))).toEqual({action:'tp',tpR:4,window:null});
  expect(dobGuardrailReason(rules,{entryTime:berlin(2026,8,3,11,0,2),zoneAgeSeconds:null})).toBe('blockedEntryHour');
  expect(dobEntryRule(DOB_GUARDRAILS_DEFAULT,berlin(2026,8,3,15,0,2)).tpR).toBe(2);
 });
 it('nur relative Importe mit Dateiendung (Deno-Bundle des Watchers)',()=>{
  const source=readFileSync(new URL('../src/dobGuardrails.js',import.meta.url),'utf8');
  for(const [,spec] of source.matchAll(/from\s*['"](\.[^'"]+)['"]/g))expect(spec).toMatch(/\.(js|ts|mjs)$/);
 });
 it('abgeschaltete Regel bleibt erhalten, wirkt aber nirgends',()=>{
  const rules=dobGuardrailsFromRow({entry_windows:[{from:480,to:630,action:'block',enabled:false},{from:480,to:600,action:'tp',tpR:3}],default_tp_r:2});
  expect(rules.entryWindows).toHaveLength(2);
  expect(dobEntryRule(rules,berlin(2026,8,3,8,30,2))).toMatchObject({action:'tp',tpR:3});
  expect(dobEntryTimeBlocked(rules,berlin(2026,8,3,9,30,2))).toBe(false);
 });
 it('Mindestalter aus: wirksam null, gemerkter Wert bleibt',()=>{
  const off=dobGuardrailsFromRow({min_zone_age_seconds:null,min_zone_age_saved_seconds:86400});
  expect(off).toMatchObject({minZoneAgeSeconds:null,minZoneAgeSavedSeconds:86400});
  expect(dobGuardrailReason(off,{entryTime:berlin(2026,8,3,15,0,2),zoneAgeSeconds:60})).toBe(null);
  expect(dobGuardrailsToRow('XAUUSD',off)).toMatchObject({min_zone_age_seconds:null,min_zone_age_saved_seconds:86400});
 });
 it('Gegen-DOB-Modus: block_all sperrt tot und lebend, Kombi sperrt lebend und gibt tot TP 5R, off ignoriert',()=>{
  const at=Date.parse('2026-11-10T13:00:00Z')/1000,row=status=>({entry_time:at,poi_zone_age_seconds:null,counter_dob_status:status});
  const c=counterDobMode=>({...DOB_GUARDRAILS_DEFAULT,counterDobMode});
  expect(['none','dead','live',null].map(s=>dobRowGuardrailReason(c('block_all'),row(s)))).toEqual([null,'counterDob','counterDob',null]);
  expect(['none','dead','live'].map(s=>dobRowGuardrailReason(c('live_block_dead_5r'),row(s)))).toEqual([null,null,'counterDob']);
  expect(['none','dead','live'].map(s=>dobRowGuardrailReason(c('off'),row(s)))).toEqual([null,null,null]);
  expect(['none','dead'].map(s=>dobRowConfigTpR(c('live_block_dead_5r'),row(s)))).toEqual([2,5]);
  expect(dobRowConfigTpR(c('block_all'),row('dead'))).toBe(2);
  expect(dobGuardrailsFromRow(dobGuardrailsToRow('XAUUSD',c('off'))).counterDobMode).toBe('off');
  // Default (Philip): lebende sperren, nur tote TP 5R.
  expect(dobGuardrailsFromRow({counter_dob_mode:'quatsch'}).counterDobMode).toBe('live_block_dead_5r');
  expect(dobRowConfigTpR(DOB_GUARDRAILS_DEFAULT,row('dead'))).toBe(5);
 });
 it('Kurzbeschreibung der Konfig',()=>{
  const rules=dobGuardrailsFromRow({entry_windows:[{from:630,to:660,action:'block'},{from:1260,to:1320,action:'block'},{from:540,to:600,action:'tp',tpR:2},
   {from:480,to:540,action:'block',enabled:false}],default_tp_r:2.5,blocked_months:[1],min_zone_age_seconds:86400});
  expect(dobGuardrailsSummary(rules)).toBe('Sperren 10:30–11:00, 21:00–22:00 · Jan · 09:00–10:00 TP 2R · sonst 2,5R · Zone ≥ 1 Tag · 1 Regel aus');
  expect(dobGuardrailsSummary(DOB_GUARDRAILS_DEFAULT)).toBe('TP 2R');
 });
});

describe('Entry-Fenster sortieren',()=>{
 it('ohne Überlappung nach Startzeit, angrenzend zählt nicht als Überlappung',()=>{
  const w=[{from:840,to:1140},{from:120,to:420},{from:420,to:540}];
  expect(dobSortEntryWindows(w).map(x=>x.from)).toEqual([120,420,840]);
  expect(dobEntryWindowOverlaps(w)).toEqual([[],[],[]]);
 });
 it('mit Überlappung (auch über Mitternacht) bleibt die Reihenfolge, beide Seiten markiert',()=>{
  const w=[{from:600,to:720},{from:1380,to:120},{from:660,to:700,enabled:false},{from:60,to:90}];
  expect(dobEntryWindowOverlaps(w)).toEqual([[2],[3],[0],[1]]);
  expect(dobSortEntryWindows(w)).toBe(w);
 });
});
