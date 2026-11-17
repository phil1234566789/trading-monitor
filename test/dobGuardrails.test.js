import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {DOB_GUARDRAILS_DEFAULT,dobGuardrailsFromRow,dobGuardrailsToRow,dobGuardrailReason,dobEntryTimeBlocked,dobMonthBlocked,dobEntryRule}
 from '../src/dobGuardrails.js';

// Berlin-Zeit: Januar = CET (UTC+1), August = CEST (UTC+2).
const berlin=(y,mo,d,h,mi,offset)=>Date.UTC(y,mo-1,d,h-offset,mi)/1000;
// Alte Zeile ohne entry_windows: Sperren kommen aus blocked_entry_windows (rückwärtskompatibel).
const config=dobGuardrailsFromRow({blocked_entry_windows:[[630,720],[1320,120]],blocked_months:[1],min_zone_age_seconds:86400});

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
 it('DB-Zeile hin und zurück, blocked_entry_windows wird für den alten Watcher mitgeschrieben',()=>{
  const rules={...config,entryWindows:[{from:480,to:630,action:'tp',tpR:2},{from:630,to:720,action:'block'}],defaultTpR:4};
  const row=dobGuardrailsToRow('XAUUSD',rules);
  expect(row.blocked_entry_windows).toEqual([[630,720]]);
  expect(dobGuardrailsFromRow(row)).toEqual({...rules,minZoneAgeSavedSeconds:86400,blockedEntryWindows:[[630,720]]});
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
 it('abgeschaltete Regel bleibt erhalten, wirkt aber nirgends (auch nicht in der Sperrliste für den alten Watcher)',()=>{
  const rules=dobGuardrailsFromRow({entry_windows:[{from:480,to:630,action:'block',enabled:false},{from:480,to:600,action:'tp',tpR:3}],default_tp_r:2});
  expect(rules.entryWindows).toHaveLength(2);
  expect(rules.blockedEntryWindows).toEqual([]);
  expect(dobEntryRule(rules,berlin(2026,8,3,8,30,2))).toMatchObject({action:'tp',tpR:3});
  expect(dobEntryTimeBlocked(rules,berlin(2026,8,3,9,30,2))).toBe(false);
  expect(dobGuardrailsToRow('XAUUSD',rules).blocked_entry_windows).toEqual([]);
 });
 it('Mindestalter aus: wirksam null, gemerkter Wert bleibt',()=>{
  const off=dobGuardrailsFromRow({min_zone_age_seconds:null,min_zone_age_saved_seconds:86400});
  expect(off).toMatchObject({minZoneAgeSeconds:null,minZoneAgeSavedSeconds:86400});
  expect(dobGuardrailReason(off,{entryTime:berlin(2026,8,3,15,0,2),zoneAgeSeconds:60})).toBe(null);
  expect(dobGuardrailsToRow('XAUUSD',off)).toMatchObject({min_zone_age_seconds:null,min_zone_age_saved_seconds:86400});
 });
});
