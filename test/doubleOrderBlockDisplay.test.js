import {describe,expect,it} from 'vitest';
import {doubleOrderBlockDisplay} from '../src/doubleOrderBlocks.js';
const entry=(entryTime,status,recognizedAt)=>({status:'ready',entryTime,outcome:{status,recognizedAt}});
const pair={recognizedAt:120,entries:{a:entry(120,'loss',300),b:entry(240,'success',420)}};

describe('DOB retrospective colors with independent a/b outcomes',()=>{
 it('reveals neither a DOB nor an outcome from the future',()=>{
  expect(doubleOrderBlockDisplay(pair,119)).toMatchObject({visible:false,tone:'neutral'});
  expect(doubleOrderBlockDisplay(pair,120)).toEqual({visible:true,tone:'gold',variants:{a:'open',b:'pending'}});
 });
 it('marks loss only when all entries valid by that time have lost',()=>{
  const futureB={...pair,entries:{a:entry(120,'loss',180),b:entry(240,'success',420)}};
  expect(doubleOrderBlockDisplay(futureB,179).tone).toBe('gold');
  expect(doubleOrderBlockDisplay(futureB,180)).toEqual({visible:true,tone:'red',variants:{a:'loss',b:'pending'}});
  expect(doubleOrderBlockDisplay(futureB,240)).toEqual({visible:true,tone:'gold',variants:{a:'loss',b:'open'}});
 });
 it('keeps different outcomes visible instead of selecting the best statistic',()=>{
  expect(doubleOrderBlockDisplay(pair,420)).toEqual({visible:true,tone:'gold',variants:{a:'loss',b:'success'}});
  expect(doubleOrderBlockDisplay({...pair,entries:{a:entry(120,'loss',300),b:entry(240,'loss',420)}},420).tone).toBe('red');
 });
 it('does not turn ambiguous or missing history into a loss, or reveal a future gap',()=>{
  const ambiguous={recognizedAt:120,entries:{a:entry(120,'ambiguous',300),b:{status:'invalid'}}};
  expect(doubleOrderBlockDisplay(ambiguous,300)).toMatchObject({tone:'gold',variants:{a:'ambiguous',b:'invalid'}});
  const missing={recognizedAt:120,entries:{a:{status:'ready',entryTime:120,outcome:{status:'unknown',unavailableAt:300}},b:{status:'pending'}}};
  expect(doubleOrderBlockDisplay(missing,299).variants.a).toBe('open');
  expect(doubleOrderBlockDisplay(missing,300).variants.a).toBe('unknown');
 });
});
