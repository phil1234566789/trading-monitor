import {describe,expect,it} from 'vitest';
import {m1GapCovered} from '../src/goldWeekendGap.js';

// New York im November 2026 = EST (UTC−5), im Juli = EDT (UTC−4).
const ny=(y,mo,d,h,mi,offset)=>Date.UTC(y,mo-1,d,h+offset,mi)/1000;

describe('m1GapCovered für Forex',()=>{
 it('Wochenende Fr 16:58 bis So 17:11 New York',()=>{
  expect(m1GapCovered('GBPUSD',ny(2026,11,13,16,59,5),ny(2026,11,15,17,11,5))).toBe(true);
 });
 it('Tagespause Mo–Do um 17:00 New York, auch verlängert',()=>{
  expect(m1GapCovered('GBPUSD',ny(2026,7,9,17,1,4),ny(2026,7,9,17,31,4))).toBe(true);
  expect(m1GapCovered('GBPUSD',ny(2026,9,10,17,11,4),ny(2026,9,10,18,0,4))).toBe(true);
 });
 it('Lücken mitten in der Session bleiben Lücken',()=>{
  expect(m1GapCovered('GBPUSD',ny(2026,2,16,14,32,5),ny(2026,2,16,14,33,5))).toBe(false);
  expect(m1GapCovered('GBPUSD',ny(2026,7,9,16,0,4),ny(2026,7,9,17,10,4))).toBe(false);
 });
 it('ohne Instrument (bridgeClosures aus) überbrückt nichts',()=>{
  expect(m1GapCovered(null,ny(2026,7,9,17,1,4),ny(2026,7,9,17,31,4))).toBe(false);
 });
});
