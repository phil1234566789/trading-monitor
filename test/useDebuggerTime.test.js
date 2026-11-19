import {describe,it,expect} from 'vitest';
import {clampTime,jumpTarget,useDebuggerTime} from '../src/composables/useDebuggerTime.js';

describe('useDebuggerTime',()=>{
 it('rastet auf das Schrittraster ab from ein und klemmt in den Bereich',()=>{
  const r={from:1000,through:4000};
  expect(clampTime(1290,r,300)).toBe(1300);
  expect(clampTime(500,r,300)).toBe(1000);
  expect(clampTime(9000,r,300)).toBe(4000);
  expect(clampTime(4000,{from:1000,through:4030},60)).toBe(4000);
 });

 it('neuer Fall setzt den Startwert, gleicher Fall mit neuem Bereich lässt den Regler stehen',()=>{
  const t=useDebuggerTime(300);
  t.show('P1',{from:0,through:3000},600);
  expect(t.at.value).toBe(600);
  t.at.value=1500;
  t.show('P1',{from:0,through:6000},600);
  expect(t.at.value).toBe(1500);
  t.show('P1',{from:0,through:900},600);
  expect(t.at.value).toBe(900);
  t.show('P2',{from:0,through:6000},6000);
  expect(t.at.value).toBe(6000);
 });

 it('findet die nächste bzw. vorige Änderung',()=>{
  expect(jumpTarget([100,200,300],200,1)).toBe(300);
  expect(jumpTarget([100,200,300],200,-1)).toBe(100);
  expect(jumpTarget(null,200,1)).toBeUndefined();
 });
});
