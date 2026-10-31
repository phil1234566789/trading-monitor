import {describe,it,expect} from 'vitest';
import {brokerJournalPosition,validateJournalComment} from '../supabase/functions/trading-monitor-mcp/mt5JournalContract.js';
const rows=[{account_id:'a',ticket:1,position_id:23,time_msc:1000,type:0,entry:0,symbol:'XAUUSD',currency:'USD',volume:.01,price:2300,profit:0,commission:-1,swap:0,fee:0},{account_id:'a',ticket:2,position_id:23,time_msc:2000,type:1,entry:1,symbol:'XAUUSD',currency:'USD',volume:.01,price:2310,profit:10,commission:-1,swap:-.5,fee:-.2}];
describe('private broker journal contract',()=>{
 it('uses exact broker identity and native net costs, leaves unproven stops unknown',()=>{
  const position=brokerJournalPosition(rows,'a',23,'XAUUSD');
  expect(position).toMatchObject({entry_price:2300,exit_price:2310,commission:-2,stop_loss:null,r_multiple:null,size:.01,account_currency:'USD',triggered_at:'1970-01-01T00:00:01.000Z'});
  expect(position.net_pl).toBeCloseTo(7.3);
 });
 it('refuses missing, open, reversed and different broker positions',()=>{
  for(const [r,a,p,s] of [[rows,'b',23,'XAUUSD'],[rows,'a',24,'XAUUSD'],[rows,'a',23,'EURUSD'],[rows.slice(0,1),'a',23,'XAUUSD'],[[...rows,{...rows[1],ticket:3,entry:2}],'a',23,'XAUUSD']])expect(()=>brokerJournalPosition(r,a,p,s)).toThrow();
 });
 it('requires provenance and distinguishes statement, observation and hypothesis',()=>{
  const valid={id:'a',position_id:4,kind:'statement',body:'Philip sagt: zu früh.',source:'Chat: Test',occurred_at:'2026-10-31T20:00:00Z'};
  expect(validateJournalComment(valid).body).toBe(valid.body);
  for(const patch of [{kind:'diagnosis'},{source:''},{occurred_at:'yesterday'},{body:' '},{position_id:0}])expect(()=>validateJournalComment({...valid,...patch})).toThrow();
 });
});
