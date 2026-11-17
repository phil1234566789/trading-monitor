import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {dobM5Trend,dobTrendVerdict,createDobM5TrendGate} from '../src/dobM5Trend.js';

// Philips dob_trade-Pins 513–520 (17.11.2026): negativ = gegen den kurzfristigen M5-Trend, positiv = Winner im Trend.
// Erwartet ist, was der unveränderte Trend-Algo zur OB2-Retest-Zeit auf 24 h M5 liefert (scripts/dobTrendPinFixtures.mjs).
const {cases}=JSON.parse(readFileSync(new URL('./fixtures/dob-native/m5-trend-pins.json',import.meta.url),'utf8'));
const candlesOf=c=>c.m5.map(([time,open,high,low,close,ignored])=>({time,open,high,low,close,...(ignored?{ignored:true}:{})}));
const EXPECTED={513:'downtrend',516:'downtrend',517:'uptrend',518:'downtrend',519:'unknown',520:'downtrend'};

describe('DOB v3: M5-Strukturtrend als Anti-Gate',()=>{
 it.each(cases)('Pin $pin ($expected, $direction): innerster M5-Trend zur OB2-Retest-Zeit',c=>{
  expect(dobM5Trend(candlesOf(c),c.retestAt).trend).toBe(EXPECTED[c.pin]);
 });
 it.each(cases.filter(c=>c.expected==='negativ'))('Pin $pin wird als gegen den Trend verworfen',c=>{
  const gate=createDobM5TrendGate(candlesOf(c));
  expect(gate({direction:c.direction,chart:{secondRetestTime:c.retestAt-60}})).toMatchObject({verdict:'against',rejectReason:'againstM5Trend'});
 });
 it.each(cases.filter(c=>c.expected==='positiv'))('Pin $pin bleibt (Winner im Trend)',c=>{
  const gate=createDobM5TrendGate(candlesOf(c));
  expect(gate({direction:c.direction,chart:{secondRetestTime:c.retestAt-60}}).rejectReason).toBeNull();
 });
 // Pin 519: im 24-h-Fenster schließt keine Kerze über dem Range-Hoch 4656,95 (bester Schluss 4656,17, nur Docht 4659,82),
 // der Algo bestätigt deshalb keinen Aufwärtstrend. Mit „unknown blocken“ fiele dieser Winner weg.
 it('Pin 519: unknown wird durchgelassen, nur mit blockUnknown verworfen',()=>{
  const c=cases.find(x=>x.pin===519),setup={direction:c.direction,chart:{secondRetestTime:c.retestAt-60}};
  expect(createDobM5TrendGate(candlesOf(c))(setup)).toMatchObject({verdict:'unknown',rejectReason:null});
  expect(createDobM5TrendGate(candlesOf(c),{blockUnknown:true})(setup)).toMatchObject({rejectReason:'m5TrendUnknown'});
 });
 it('ist kausal: Kerzen nach der Retest-Zeit ändern das Ergebnis nicht',()=>{
  const c=cases.find(x=>x.pin===517),candles=candlesOf(c),last=candles.at(-1);
  const future=[...candles,...Array.from({length:50},(_,i)=>({time:last.time+300*(i+1),open:9000,high:9000,low:1000,close:1000}))];
  expect(dobM5Trend(future,c.retestAt)).toEqual(dobM5Trend(candles,c.retestAt));
 });
 it('Richtungslogik',()=>{
  expect(dobTrendVerdict('short','uptrend')).toBe('against');
  expect(dobTrendVerdict('long','uptrend')).toBe('with');
  expect(dobTrendVerdict('long','downtrend')).toBe('against');
  expect(dobTrendVerdict('short','unknown')).toBe('unknown');
 });
});
