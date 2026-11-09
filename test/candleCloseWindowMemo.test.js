import {describe,it,expect} from 'vitest';
import {closesPastLevel,withCandleCloseWindow} from '../src/candleCloseWindow';
const linear=(rows,from,to,price,above)=>!rows.length||rows.some(c=>c.time>from&&c.time<=to&&(above?c.close>price:c.close<price));
describe('immutable close-query windows',()=>{
 it('reuses identical queries without rereading the candle interval',()=>{
  let reads=0;const rows=Array.from({length:100},(_,time)=>({time,get close(){reads++;return 1;}}));
  withCandleCloseWindow(rows,()=>{for(let i=0;i<100;i++)expect(closesPastLevel(rows,0,99,2,true)).toBe(false);},{cacheCloses:true});
  expect(reads).toBe(99);
 });
 it('keeps all bounds, price and direction in query identity',()=>{
  const boundary=[{time:1,close:1},{time:2,close:3},{time:3,close:2}];
  withCandleCloseWindow(boundary,()=>{
   expect(closesPastLevel(boundary,0,1,2,true)).toBe(false);
   expect(closesPastLevel(boundary,0,2,2,true)).toBe(true);
   expect(closesPastLevel(boundary,0,2,4,true)).toBe(false);
   expect(closesPastLevel(boundary,0,2,4,false)).toBe(true);
   expect(closesPastLevel(boundary,2,3,2,true)).toBe(false);
  },{cacheCloses:true});
  const rows=Array.from({length:20},(_,time)=>({time,close:time%3?time:NaN}));
  withCandleCloseWindow(rows,()=>{for(const from of [-Infinity,0,3,Infinity,NaN])for(const to of [-Infinity,3,9,Infinity,NaN])for(const price of [-Infinity,4,15,Infinity,NaN])for(const above of [false,true])for(let i=0;i<2;i++)expect(closesPastLevel(rows,from,to,price,above)).toBe(linear(rows,from,to,price,above));},{cacheCloses:true});
  for(const unordered of [[],[...rows].reverse(),[...rows,{time:NaN,close:50}]])withCandleCloseWindow(unordered,()=>{for(let i=0;i<2;i++)expect(closesPastLevel(unordered,2,15,5,true)).toBe(linear(unordered,2,15,5,true));},{cacheCloses:true});
 });
 it('observes time changes inside the default mutable window',()=>{
  const rows=[{time:1,close:1},{time:2,close:4}];
  withCandleCloseWindow(rows,()=>{
   withCandleCloseWindow(rows,()=>expect(closesPastLevel(rows,0,2,3,true)).toBe(true),{cacheCloses:true});
   rows[1].time=3;
   withCandleCloseWindow(rows,()=>expect(closesPastLevel(rows,0,2,3,true)).toBe(false),{cacheCloses:true});
  });
 });
 it('does not upgrade an outer mutable window when nested and resets on throw',()=>{
  const rows=[{time:1,close:1},{time:2,close:2}];
  withCandleCloseWindow(rows,()=>{
   withCandleCloseWindow(rows,()=>expect(closesPastLevel(rows,0,2,3,true)).toBe(false),{cacheCloses:true});
   rows[0].close=4;rows[1].time=3;
   withCandleCloseWindow(rows,()=>expect(closesPastLevel(rows,0,2,3,true)).toBe(true),{cacheCloses:true});
  });
  expect(()=>withCandleCloseWindow(rows,()=>{closesPastLevel(rows,0,2,3,true);throw Error('stop');},{cacheCloses:true})).toThrow('stop');
  rows[0].close=1;
  withCandleCloseWindow(rows,()=>expect(closesPastLevel(rows,0,2,3,true)).toBe(false),{cacheCloses:true});
 });
});
