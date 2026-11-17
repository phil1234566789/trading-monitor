import {describe,expect,it} from 'vitest';
import {dobChartPosition} from '../src/dobChartPositions.js';
import {dobGuardrailsFromRow,DOB_GUARDRAILS_DEFAULT} from '../src/dobGuardrails.js';

// Long, Entry 100, SL 99 (1R = 1): Ziel 2R bei 102 um t=600 erreicht, später 3R (103) bei t=1200.
const candles=[0,300,600,900,1200,1500].map((time,i)=>({time,open:100,low:99.5,high:[100.5,101,102,102,103,103][i],close:100}));
const row={id:'a',instrument:'XAUUSD',direction:'long',entry_time:300,entry_price:100,stop_price:99,exit_time:600,outcome:'success',max_r:3.2,sl_hit:false,ambiguous_r:null};

describe('dobChartPosition',()=>{
 it('TP 2R: gespeicherter Exit, Win',()=>{
  const p=dobChartPosition(row,DOB_GUARDRAILS_DEFAULT,candles);
  expect(p).toMatchObject({k:2,targetPrice:102,blocked:false,endTime:600,position:{outcome:'win',exitTime:600,exitPrice:102}});
 });
 it('TP nach Konfig 3R: Exit an der ersten Kerze, die den TP berührt',()=>{
  const p=dobChartPosition(row,dobGuardrailsFromRow({default_tp_r:3}),candles);
  expect(p).toMatchObject({k:3,targetPrice:103,position:{outcome:'win',exitTime:1200}});
 });
 it('Ziel nicht erreicht und kein SL: offen bis zur letzten Kerze',()=>{
  const p=dobChartPosition(row,dobGuardrailsFromRow({default_tp_r:4}),candles);
  expect(p).toMatchObject({endTime:1500,position:{outcome:null,exitTime:null}});
 });
 it('Replay vor dem Exit verrät das Ergebnis nicht',()=>{
  const p=dobChartPosition(row,DOB_GUARDRAILS_DEFAULT,candles.slice(0,2));
  expect(p).toMatchObject({endTime:300,position:{outcome:null}});
  expect(dobChartPosition({...row,entry_time:900},DOB_GUARDRAILS_DEFAULT,candles.slice(0,2))).toBe(null);
 });
 it('gesperrte nur mit showBlocked, dann markiert',()=>{
  const blocked=dobGuardrailsFromRow({blocked_months:[1]}); // t=300 ist Januar 1970
  expect(dobChartPosition(row,blocked,candles)).toBe(null);
  expect(dobChartPosition(row,blocked,candles,true)).toMatchObject({blocked:true});
 });
});
