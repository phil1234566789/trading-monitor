import {describe,expect,it} from 'vitest';
import {dobEntryM1Structure} from '../src/dobEntryM1Structure.js';

// Zickzack mit 20-Kerzen-Schwüngen und steigenden Extremen: genug Fraktale für einen Aufwärtstrend.
const zigzag=(bar,n=240,t0=1_789_000_200)=>Array.from({length:n},(_,i)=>{
 const leg=Math.floor(i/20),pos=i%20,up=leg%2===0,base=4000+leg*3;
 const mid=up?base+pos:base+20-pos;
 return {time:t0+i*bar,open:mid,high:mid+0.5,low:mid-0.5,close:mid};
});
describe('DOB-Entry-M1 Struktur',()=>{
 it('M5: P5/P2 ab Anker, Zustand und Schlusskurs-Auswertung',()=>{
  const c=zigzag(300),r=dobEntryM1Structure(c,'5m',c[0].time,'XAUUSD');
  expect(r.pivotsOuter.length).toBeGreaterThan(3);
  expect(r.pivotsInner.length).toBeGreaterThanOrEqual(r.pivotsOuter.length);
  expect(r.state).not.toBeNull();
  expect(r).toHaveProperty('closeReaction');
 });
 it('M1: nur P5 wie im Dashboard, keine Pivots vor dem Anker',()=>{
  const c=zigzag(60),anchor=c[60].time,r=dobEntryM1Structure(c,'1m',anchor,'XAUUSD');
  expect(r.pivotsInner).toEqual([]);
  expect(r.pivotsOuter.length).toBeGreaterThan(0);
  expect(r.pivotsOuter.every(p=>p.pivotTime>=anchor)).toBe(true);
  expect(r).not.toHaveProperty('closeReaction');
 });
});
