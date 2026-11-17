import {describe,expect,it} from 'vitest';
import {DOB_ENTRY_M1_CASES,dobEntryM1Window,dobEntryM1Display,dobEntryM1CaseOf} from '../src/dobEntryM1Cases.js';

describe('DOB-Entry-M1-Fälle',()=>{
 it('15 eindeutige v3-Trades: 10 Losses inkl. 28.08. 15:38 Short, 5 Wins',()=>{
  expect(new Set(DOB_ENTRY_M1_CASES.map(c=>c.id)).size).toBe(15);
  expect(DOB_ENTRY_M1_CASES.filter(c=>c.kind==='loss')).toHaveLength(10);
  expect(DOB_ENTRY_M1_CASES.filter(c=>c.kind==='win')).toHaveLength(5);
  expect(DOB_ENTRY_M1_CASES.every(c=>c.id.startsWith('dob-setup-v3:dob:XAUUSD:'))).toBe(true);
  expect(DOB_ENTRY_M1_CASES.find(c=>c.label==='28.08. 15:38 Short b').kind).toBe('loss');
 });
 it('Fenster: 60 min vor Entry bis Ausgang, Ladebereich deckt OB1 ab',()=>{
  const row={entry_time:10_000,exit_time:12_000,first_ob_start:5_000};
  const w=dobEntryM1Window(row,'loss');
  expect(w.view).toEqual({from:6_400,to:12_900});
  expect(w.loadTo).toBe(12_900);
  expect(w.count['1m']*60).toBeGreaterThanOrEqual(12_900-(5_000-7_200));
 });
 it('Win: Fenster und TP bis 5R, Loss bleibt beim gespeicherten Ausgang',()=>{
  const row={instrument:'XAUUSD',direction:'long',entry_time:600_000,entry_price:4000,stop_price:3998,target_price:4004,exit_time:600_600,first_ob_start:599_000};
  expect(dobEntryM1Window(row,'win').view.to).toBe(600_000+5*24*3600+900);
  // 5R = 4010: erst die M1-Kerze 600_000+1200 erreicht es.
  const m1=Array.from({length:40},(_,i)=>({time:600_000+i*60,open:4001,high:i===20?4011:4005,low:3999,close:4002}));
  const d=dobEntryM1Display(row,'win',m1,dobEntryM1Window(row,'win'));
  expect(d).toMatchObject({targetLabel:'TP 5R',row:{target_price:4010,exit_time:600_000+1260},view:{to:600_000+1260+900}});
  expect(dobEntryM1Display(row,'loss',m1,dobEntryM1Window(row,'loss')).row).toBe(row);
 });
 it('Kürzel L1–L10 / W1–W5, per Kürzel oder ID auffindbar',()=>{
  expect(DOB_ENTRY_M1_CASES.map(c=>c.code)).toEqual([...Array.from({length:10},(_,i)=>'L'+(i+1)),...Array.from({length:5},(_,i)=>'W'+(i+1))]);
  expect(dobEntryM1CaseOf('L2').label).toBe('10.02. 10:23 Long a');
  expect(dobEntryM1CaseOf(DOB_ENTRY_M1_CASES[14].id).code).toBe('W5');
  expect(dobEntryM1CaseOf('X9')).toBeNull();
 });
});
