import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {DOB_GUARDRAILS_DEFAULT,dobGuardrailsFromRow,dobGuardrailsToRow,dobGuardrailReason,dobEntryTimeBlocked,dobMonthBlocked}
 from '../src/dobGuardrails.js';

// Berlin-Zeit: Januar = CET (UTC+1), August = CEST (UTC+2).
const berlin=(y,mo,d,h,mi,offset)=>Date.UTC(y,mo-1,d,h-offset,mi)/1000;
const config={blockedEntryWindows:[[630,720],[1320,120]],blockedMonths:[1],minZoneAgeSeconds:86400};

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
  expect(dobGuardrailsFromRow(dobGuardrailsToRow('XAUUSD',config))).toEqual(config);
 });
 it('nur relative Importe mit Dateiendung (Deno-Bundle des Watchers)',()=>{
  const source=readFileSync(new URL('../src/dobGuardrails.js',import.meta.url),'utf8');
  for(const [,spec] of source.matchAll(/from\s*['"](\.[^'"]+)['"]/g))expect(spec).toMatch(/\.(js|ts|mjs)$/);
 });
});
