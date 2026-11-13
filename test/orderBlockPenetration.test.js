import {describe,expect,it} from 'vitest';
import {measureOrderBlockPenetration,orderBlockPenetration} from '../src/orderBlockPenetration.js';
const ob={top:110,bottom:100};
describe('shared order block penetration measurement without a strategy threshold',()=>{
 it('measures mirrored long and short depth including exact edges and a breach',()=>{
  expect(orderBlockPenetration(ob,'long',{low:110,high:112})).toBe(0);
  expect(orderBlockPenetration(ob,'long',{low:100,high:112})).toBe(10);
  expect(orderBlockPenetration(ob,'short',{low:98,high:110})).toBe(10);
  expect(measureOrderBlockPenetration(ob,'long',[{time:1,low:105,high:112},{time:2,low:99,high:113}]))
   .toEqual({status:'ready',maxPenetrationFraction:1.1,extremePrice:99,candleTime:2});
  expect(measureOrderBlockPenetration(ob,'short',[{time:1,low:98,high:103}]).maxPenetrationFraction).toBe(.3);
 });
 it('does not turn an empty, invalid or zero-width window into a measured zero',()=>{
  expect(measureOrderBlockPenetration(ob,'long',[]).status).toBe('unknown');
  expect(measureOrderBlockPenetration({...ob,top:100},'long',[{time:1,low:99,high:102}]).status).toBe('unknown');
  expect(measureOrderBlockPenetration(ob,'long',[{time:1,low:99,high:98}]).status).toBe('unknown');
 });
});
