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
