import {describe,expect,it} from 'vitest';
import {candleHammer,candleStar,candlePatternsIn,candleDirection} from '../src/candlePatterns.js';

// Philips Beispiel: XAUUSD M5, 28.08.2026 (Berlin), vor dem Short-Entry 15:38 (fxcm_candles).
const M5={
 '15:00':[4601.72,4603.63,4596.1,4599.24],'15:05':[4599.24,4605.34,4598.77,4600.28],'15:10':[4600.28,4601.09,4597.59,4598.98],
 '15:15':[4598.98,4599.86,4593.68,4598.36],'15:20':[4598.36,4601.16,4596.04,4601.05],'15:25':[4601.05,4604.42,4599.39,4603.89],
 '15:30':[4603.89,4605.43,4598.79,4604.89],'15:35':[4604.89,4607.16,4600.56,4605.98],'15:40':[4605.98,4607.84,4601.65,4604.78]};
const c=(t)=>{const [open,high,low,close]=M5[t];const [h,m]=t.split(':').map(Number);return {time:h*3600+m*60,open,high,low,close};};

describe('Kerzenmuster an Philips Beispielen (28.08.)',()=>{
 it('Hammer: 15:15, 15:30, 15:35 bullisch (15:15 trotz roter Kerze), 15:05 bärisch (trotz grüner Kerze)',()=>{
  expect(['15:15','15:30','15:35'].map(t=>candleHammer(c(t)))).toEqual(['bull','bull','bull']);
  expect(candleHammer(c('15:05'))).toBe('bear');
  expect([candleDirection(c('15:15')),candleDirection(c('15:05'))]).toEqual(['bear','bull']);
 });
 it('kein Hammer: volle Körper und 15:40 (Docht zu kurz, Gegendocht zu lang)',()=>{
  expect(['15:00','15:10','15:20','15:25','15:40'].map(t=>candleHammer(c(t)))).toEqual([null,null,null,null,null]);
 });
 it('Morning Star 15:10–15:20, gespiegelt ein Evening Star',()=>{
  expect(candleStar(c('15:10'),c('15:15'),c('15:20'))).toBe('bull');
  const flip=k=>({...k,open:-k.open,close:-k.close,high:-k.low,low:-k.high});
  expect(candleStar(flip(c('15:10')),flip(c('15:15')),flip(c('15:20')))).toBe('bear');
  // Mittlere Kerze zu groß bzw. dritte schließt nicht über der Mitte.
  expect(candleStar(c('15:05'),c('15:10'),c('15:15'))).toBeNull();
  expect(candleStar(c('15:15'),c('15:20'),c('15:25'))).toBeNull();
 });
 it('Fenster vor dem Entry 15:38 (letzte 5 geschlossene M5 bis 15:30): Morning Star und Hammer gegen den Short',()=>{
  const found=candlePatternsIn(['15:10','15:15','15:20','15:25','15:30'].map(c));
  expect(found.map(p=>`${p.type}:${p.side}`)).toEqual(['hammer:bull','star:bull','hammer:bull']);
 });
});
