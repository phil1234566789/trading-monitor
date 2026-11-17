import {describe,expect,it} from 'vitest';
import {DOB_ENTRY_M1_CASES,dobEntryM1Window} from '../src/dobEntryM1Cases.js';

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
  const w=dobEntryM1Window(row);
  expect(w.view).toEqual({from:6_400,to:12_900});
  expect(w.loadTo).toBe(12_900);
  expect(w.count['1m']*60).toBeGreaterThanOrEqual(12_900-(5_000-7_200));
 });
});
