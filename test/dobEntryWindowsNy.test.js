import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {dobEntryRule,dobRowGuardrailReason,DOB_GUARDRAILS_DEFAULT} from '../src/dobGuardrails.js';
import {dobChartPosition} from '../src/dobChartPositions.js';
import {load,run,berlin} from './dobFixtures.js';

// Die Default-Fenster stehen nur in der Migration; der Test liest sie dort, damit Test und Konfig nicht auseinanderlaufen.
const sql=readFileSync(new URL('../supabase/migrations/20261122150000_dob_entry_windows_ny.sql',import.meta.url),'utf8');
const [nyClose,nyOpen]=[...sql.matchAll(/'(\{"label".*?\})'::jsonb/g)].map(m=>JSON.parse(m[1]));
const cfg=(windows,rest={})=>({...DOB_GUARDRAILS_DEFAULT,entryWindows:windows,...rest});

describe('Default-Entry-Fenster NY (HTF-OB)',()=>{
 it('Migration legt NY-Close-Schluss an (an) und NY-Open (aus)',()=>{
  expect(nyClose).toMatchObject({label:'NY-Close-Schluss',from:1200,to:0,action:'block',enabled:true});
  expect(nyOpen).toMatchObject({label:'NY-Open',from:900,to:960,action:'block',enabled:false});
 });
 it.each([['2026-07-15','Sommer'],['2026-01-15','Winter']])('NY-Close-Schluss sperrt ab 20:00 Berlin (%s, %s)',day=>{
  const c=cfg([nyClose,nyOpen]);
  expect(dobEntryRule(c,berlin(day,'19:59')).action).toBe('tp');
  expect(dobEntryRule(c,berlin(day,'20:00')).action).toBe('block');
  expect(dobEntryRule(c,berlin(day,'21:59')).action).toBe('block');
  expect(dobEntryRule(c,berlin(day,'02:00')).action).toBe('tp');
 });
 it('NY-Open ist aus, eingeschaltet sperrt es 15:00–16:00 auch vor einer späteren TP-Regel (XAU 14–19 Uhr)',()=>{
  const xauTp={from:840,to:1140,action:'tp',tpR:4};
  expect(dobEntryRule(cfg([nyClose,nyOpen,xauTp]),berlin('2026-07-15','15:30'))).toMatchObject({action:'tp',tpR:4});
  const on=cfg([nyClose,{...nyOpen,enabled:true},xauTp]);
  for(const day of ['2026-07-15','2026-01-15']){
   expect(dobEntryRule(on,berlin(day,'15:00')).action).toBe('block');
   expect(dobEntryRule(on,berlin(day,'16:00'))).toMatchObject({action:'tp',tpR:4});
  }
 });
});

describe('Entry-Fenster: Chart = Alarm',()=>{
 // Fixture-Trade 12.11. 14:10 (Winter): ein Fenster darum sperrt den Alarm (Watcher-Weg) und die Chart-Position (Lauf-Zeile) gleich.
 const fixture=load('2026-11-12');
 const done=run(fixture).setups.find(s=>s.entryTime===berlin('2026-11-12','14:10'));
 const c=cfg([{label:'Test',from:840,to:870,action:'block'}]);
 it('beide Wege sperren mit blockedEntryHour',()=>{
  const rejected=run(fixture,undefined,true,undefined,{guardrails:c}).rejected.find(s=>s.entryTime===done.entryTime);
  expect(rejected.reason).toBe('blockedEntryHour');
  const row={id:'x',instrument:'XAUUSD',direction:done.direction,entry_time:done.entryTime,entry_price:done.entryPrice,stop_price:done.stopPrice,
   outcome:'success',exit_time:null,max_r:2,sl_hit:false,ambiguous_r:null};
  expect(dobRowGuardrailReason(c,row)).toBe('blockedEntryHour');
  expect(dobChartPosition(row,c,fixture.candles.m5)).toBeNull();
  expect(dobChartPosition(row,c,fixture.candles.m5,true).blocked).toBe(true);
 });
});

describe('Entry-Fenster mit Wochentag (XAU „Montag“)',()=>{
 const sqlMonday=readFileSync(new URL('../supabase/migrations/20261122160000_dob_entry_window_monday_xau.sql',import.meta.url),'utf8');
 const monday=JSON.parse(sqlMonday.match(/'\[(\{"label":"Montag".*?\})\]'::jsonb/)[1]);
 const xauTp={from:840,to:1140,action:'tp',tpR:4};
 it('Migration legt „Montag“ aus an, ganzer Tag, nur Montag',()=>{
  expect(monday).toMatchObject({label:'Montag',from:0,to:1440,days:[1],action:'block',enabled:false});
  expect(dobEntryRule(cfg([monday,xauTp]),berlin('2026-07-13','15:00'))).toMatchObject({action:'tp',tpR:4});
 });
 it.each([['2026-07-13','Sommer'],['2026-01-12','Winter']])('eingeschaltet sperrt es den ganzen Berliner Montag (%s, %s)',day=>{
  const on=cfg([{...monday,enabled:true},xauTp]),next=new Date(Date.parse(`${day}T12:00:00Z`)+86400e3).toISOString().slice(0,10);
  // 00:30 Berlin ist in UTC noch Sonntag: der Wochentag kommt aus Europe/Berlin, nicht aus UTC.
  for(const hhmm of ['00:30','15:00','23:59'])expect(dobEntryRule(on,berlin(day,hhmm)).action).toBe('block');
  expect(dobEntryRule(on,berlin(next,'00:30'))).toMatchObject({action:'tp'});
 });
 it('Chart = Alarm mit Wochentag: Donnerstag sperrt beide Wege, Mittwoch keinen',()=>{
  const fixture=load('2026-11-12'),done=run(fixture).setups.find(s=>s.entryTime===berlin('2026-11-12','14:10'));
  const row={id:'x',instrument:'XAUUSD',direction:done.direction,entry_time:done.entryTime,entry_price:done.entryPrice,stop_price:done.stopPrice,
   outcome:'success',exit_time:null,max_r:2,sl_hit:false,ambiguous_r:null};
  for(const [days,blocked] of [[[4],true],[[3],false]]){
   const c=cfg([{label:'Tag',from:0,to:1440,days,action:'block'}]);
   const rejected=run(fixture,undefined,true,undefined,{guardrails:c}).rejected.some(s=>s.entryTime===done.entryTime&&s.reason==='blockedEntryHour');
   expect(rejected).toBe(blocked);
   expect(dobRowGuardrailReason(c,row)==='blockedEntryHour').toBe(blocked);
  }
 });
});
