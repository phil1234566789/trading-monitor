import {describe,expect,it} from 'vitest';
import {dobTradeFeatures,dobCounterCandles,dobFeaturesOf,dobFeature} from '../src/dobTradeFeatures.js';
import {DOB_GUARDRAILS_DEFAULT,dobCounterCandlesBlocked,dobRowGuardrailReason,dobGuardrailsFromRow,dobGuardrailsToRow} from '../src/dobGuardrails.js';

// Philips Beispiel 28.08.2026 (XAUUSD M5, Berlin): Short-Entry 15:38, davor 15:10/15:15 rot, 15:20/15:25/15:30 grün; 15:35 noch offen.
const t0=Date.parse('2026-08-28T13:10:00Z')/1000;
const m5=[[4600.28,4598.98],[4598.98,4598.36],[4598.36,4601.05],[4601.05,4603.89],[4603.89,4604.89],[4604.89,4605.98]]
 .map(([open,close],i)=>({time:t0+i*300,open,close,high:Math.max(open,close)+1,low:Math.min(open,close)-1}));
const entry=Date.parse('2026-08-28T13:38:00Z')/1000;

describe('Konfig-Merkmale je Trade (features)',()=>{
 it('Gegenkerzen: nur vor dem Entry geschlossene M5, Farbe gegen die Richtung',()=>{
  expect(dobTradeFeatures({m5Candles:m5,entryTime:entry,direction:'short'})).toEqual({counter_candles_3:3,counter_candles_5:3});
  expect(dobTradeFeatures({m5Candles:m5,entryTime:entry,direction:'long'})).toEqual({counter_candles_3:0,counter_candles_5:2});
  // 15:35 schließt erst um 15:40: bei Entry 15:40 zählt sie mit.
  expect(dobCounterCandles(m5,entry+120,'short',3)).toBe(3);
  expect(dobCounterCandles(m5,t0,'short',3)).toBe(0);
 });
 it('Schalter: off sperrt nie, 3of3 bzw. 3of5 ab 3 Gegenkerzen; fehlendes Merkmal sperrt nicht',()=>{
  const f={counter_candles_3:3,counter_candles_5:3},g={counter_candles_3:2,counter_candles_5:3},c=mode=>({...DOB_GUARDRAILS_DEFAULT,counterCandlesMode:mode});
  expect([f,g].map(x=>dobCounterCandlesBlocked(c('3of3'),x))).toEqual([true,false]);
  expect([f,g].map(x=>dobCounterCandlesBlocked(c('3of5'),x))).toEqual([true,true]);
  expect(dobCounterCandlesBlocked(c('off'),f)).toBe(false);
  expect(dobCounterCandlesBlocked(c('3of3'),{})).toBe(false);
  const row={entry_time:entry,source_zone_age_seconds:null,counter_dob_status:'none',features:f};
  expect(dobRowGuardrailReason(c('3of3'),row)).toBe('counterCandles');
  expect(dobRowGuardrailReason(c('3of3'),{...row,features:null})).toBeNull();
  expect(dobFeature(dobFeaturesOf({}),'counterCandles3')).toBeNull();
  expect(dobGuardrailsFromRow(dobGuardrailsToRow('XAUUSD',c('3of5'))).counterCandlesMode).toBe('3of5');
  expect(dobGuardrailsFromRow({counter_candles_mode:'quatsch'}).counterCandlesMode).toBe('off');
 });
});
