import { describe,it,expect } from 'vitest';
import { findOrderPosition, snapshotAgeSeconds } from '../src/milkyMetaTraderMonitoring.js';
const order={status:'executed',intent:{account_login:42,account_server:'Demo',symbol:'XAUUSD.gbe',direction:'short'},result:{order:41,position_lifecycle:{state:'open',position:42}}};
const position={ticket:42,symbol:'XAUUSD.gbe',type:1};
describe('broker position matching',()=>{
 it('uses the actual position ticket rather than another trade on the symbol',()=>{
  expect(findOrderPosition(order,{account_login:42,account_server:'Demo',positions:[{...position,ticket:41},position]})).toBe(position);
  expect(findOrderPosition(order,{account_login:42,account_server:'Demo',positions:[{...position,ticket:99}]})).toBeNull();
  expect(findOrderPosition(order,{account_login:42,account_server:'Demo',positions:[{...position,symbol:'EURUSD.gbe'}]})).toBeNull();
  expect(findOrderPosition(order,{account_login:42,account_server:'Demo',positions:[{...position,type:0}]})).toBeNull();
 });
 it('does not attach the same ticket on another account or server',()=>{
  expect(findOrderPosition(order,{account_login:99,account_server:'Demo',positions:[position]})).toBeNull();
  expect(findOrderPosition(order,{account_login:42,account_server:'Other',positions:[position]})).toBeNull();
 });
 it('never resurrects a closed order or attaches positions to a search',()=>{
  expect(findOrderPosition({...order,status:'searching'},{account_login:42,account_server:'Demo',positions:[position]})).toBeNull();
  expect(findOrderPosition({...order,result:{...order.result,position_lifecycle:{state:'closed',position:42}}},{account_login:42,account_server:'Demo',positions:[position]})).toBeNull();
 });
 it('treats absent and invalid timestamps as unknown',()=>{
  expect(snapshotAgeSeconds(null,2000)).toBeNull();
  expect(snapshotAgeSeconds('bad',2000)).toBeNull();
  expect(snapshotAgeSeconds('2026-10-29T12:00:00Z',Date.parse('2026-10-29T12:00:16Z'))).toBe(16);
 });
});
