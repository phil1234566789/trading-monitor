import {describe,expect,it} from 'vitest';
import {evaluateDoubleOrderBlockOutcome} from '../src/doubleOrderBlockOutcome.js';
const candle=(time,low,high)=>({time,low,high,open:(low+high)/2,close:(low+high)/2});
const entry={direction:'long',entryTime:120,entryPrice:100,stopPrice:99};
const run=(candles,evaluatedAt=300,overrides={})=>evaluateDoubleOrderBlockOutcome({...entry,...overrides,candles,evaluatedAt});

describe('DOB price-only 2R observation',()=>{
 it('recognizes 2R before a later stop and never replaces the successful outcome',()=>{
  expect(run([candle(120,99.5,102),candle(180,98,103)])).toMatchObject({status:'success',recognizedAt:180,exitPrice:102});
 });
 it('recognizes a loss before a later 2R touch',()=>{
  expect(run([candle(120,99,101),candle(180,100,103)])).toMatchObject({status:'loss',recognizedAt:180,exitPrice:99});
 });
 it('mirrors the calculation for short entries',()=>{
  expect(run([candle(120,98,100.5)],180,{direction:'short',stopPrice:101})).toMatchObject({status:'success',targetPrice:98});
 });
 it('does not know the outcome inside an unfinished minute or use the entry confirmation candle',()=>{
  expect(run([candle(60,90,110),candle(120,99.5,102)],179)).toMatchObject({status:'open',recognizedAt:null});
 });
 it('leaves simultaneous M1 stop and 2R touches ambiguous',()=>{
  expect(run([candle(120,99,102)])).toMatchObject({status:'ambiguous',recognizedAt:180});
 });
 it('distinguishes missing history, pending history and an invalid stop',()=>{
  expect(run([candle(180,100,102)])).toMatchObject({status:'unknown',reason:'missingHistory'});
  expect(run([],120)).toMatchObject({status:'open'});
  expect(run([candle(120,99.5,101)],240)).toMatchObject({status:'unknown',reason:'missingHistory'});
  expect(run([],120,{stopPrice:100})).toMatchObject({status:'unknown',reason:'invalidRisk'});
 });
 it('returns the same historical result with future rows appended',()=>{
  const rows=[candle(120,99.5,101),candle(180,99.5,102),candle(240,98,103)];
  expect(run(rows,180)).toEqual(run(rows.slice(0,1),180));
 });
 it('bridges XAU market closures but keeps open-session gaps unknown',()=>{
  const at=s=>Date.parse(s)/1000,xau={entryTime:at('2026-11-10T16:58:00-05:00'),entryPrice:100,stopPrice:99};
  // Tagespause Di 17:00–18:00 New York, FXCM liefert die erste Kerze erst um 18:01.
  const daily=[candle(xau.entryTime,99.5,101),candle(at('2026-11-10T16:59:00-05:00'),99.5,101),candle(at('2026-11-10T18:01:00-05:00'),99.5,102)];
  expect(run(daily,at('2026-11-10T18:05:00-05:00'),xau)).toMatchObject({status:'success'});
  const friday={...xau,entryTime:at('2026-11-13T16:43:00-05:00')};
  const weekend=[candle(friday.entryTime,99.5,101),candle(at('2026-11-13T16:44:00-05:00'),99.5,101),candle(at('2026-11-15T18:01:00-05:00'),98,101)];
  expect(run(weekend,at('2026-11-15T18:05:00-05:00'),friday)).toMatchObject({status:'loss'});
  expect(run(weekend.slice(0,2),at('2026-11-14T12:00:00-05:00'),friday)).toMatchObject({status:'open'});
  const intraday=[candle(at('2026-11-10T12:00:00-05:00'),99.5,101),candle(at('2026-11-10T12:02:00-05:00'),99.5,102)];
  expect(run(intraday,at('2026-11-10T12:05:00-05:00'),{...xau,entryTime:intraday[0].time})).toMatchObject({status:'unknown',reason:'missingHistory'});
  expect(run(daily,at('2026-11-10T18:05:00-05:00'),{...xau,instrument:'EURUSD'})).toMatchObject({status:'unknown'});
 });
 it('counts session-ignored candles as real prices instead of aborting',()=>{
  expect(run([{...candle(120,99.5,101),ignored:true},candle(180,99.5,102)])).toMatchObject({status:'success'});
 });
});
