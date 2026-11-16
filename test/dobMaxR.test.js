import {describe,expect,it} from 'vitest';
import {dobMaxR} from '../src/dobMaxR.js';

// Montag 16.11.2026 10:00 UTC, Long Entry 100, SL 99 → 1R = 1.
const t0=Date.UTC(2026,10,16,10,0)/1000;
const bar=(i,low,high)=>({time:t0+i*60,open:low,close:high,low,high});
const trade={direction:'long',entryTime:t0,entryPrice:100,stopPrice:99};

describe('dobMaxR',()=>{
 it('höchste Stufe vor dem SL, auf 0,5R abgerundet',()=>{
  expect(dobMaxR(trade,{candles:[bar(0,99.5,101),bar(1,100.5,103.2),bar(2,98.5,100)],dataEnd:t0+600})).toEqual({maxR:3,slHit:true,ambiguousR:null});
 });
 it('Loss zeigt die erreichte Stufe unter 2R',()=>{
  expect(dobMaxR(trade,{candles:[bar(0,99.5,101.6),bar(1,98.5,100)],dataEnd:t0+600})).toEqual({maxR:1.5,slHit:true,ambiguousR:null});
 });
 it('deckelt bei 5R ohne SL',()=>{
  expect(dobMaxR(trade,{candles:[bar(0,99.5,110)],dataEnd:t0+600})).toEqual({maxR:5,slHit:false,ambiguousR:null});
 });
 it('weder Stufe noch SL bis Datenende = offen',()=>{
  expect(dobMaxR(trade,{candles:[bar(0,99.5,100.6)],dataEnd:t0+120})).toEqual({maxR:0.5,slHit:false,ambiguousR:null});
 });
 it('SL-Kerze trifft 2R und 2,5R: bis 2,5R unentschieden, darüber Loss',()=>{
  expect(dobMaxR(trade,{candles:[bar(0,99.5,101.6),bar(1,98.5,102.6)],dataEnd:t0+600})).toEqual({maxR:1.5,slHit:true,ambiguousR:2.5});
 });
});
