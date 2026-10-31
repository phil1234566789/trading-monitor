import {describe,it,expect} from 'vitest';
import {makeTradeIdea,nearestTradeIdea,brokerIdeaMetrics,confirmedOrderTrade} from '../src/tradeIdeas.js';
describe('chart ideas never supply a broker entry',()=>{
 const a=makeTradeIdea('long',{time:100,price:10},{time:110,price:9},null).annotations[0];
 it('selects by absolute anchor distance, not rightmost or creation order',()=>{
  const future=makeTradeIdea('short',{time:1000,price:10},{time:1010,price:11},null).annotations[0];
  expect(nearestTradeIdea([future,a],120).idea.direction).toBe('long');
  expect(nearestTradeIdea([a,{...a,tradeIdea:{...a.tradeIdea,time:140}}],120).reason).toBe('tie');
  expect(nearestTradeIdea([],120).reason).toBe('missing');
 });
 it('validates stop and optional target geometry',()=>{
  expect(()=>makeTradeIdea('long',{time:1,price:10},{time:2,price:11},null)).toThrow();
  expect(()=>makeTradeIdea('short',{time:1,price:10},{time:2,price:11},{time:3,price:12})).toThrow();
 });
 it('uses broker native point-loss, live ask/bid and no invented target',()=>{
  const q={bid:10,ask:10.1,time:100,point:.01,minimum_volume:.01,loss_per_unit_long:1,loss_per_unit_short:2};
  expect(brokerIdeaMetrics(a.tradeIdea,q,101)).toMatchObject({price:10.1,volume:.01,rr:null});
  expect(brokerIdeaMetrics(a.tradeIdea,q,101).risk).toBeCloseTo(1.1);
  expect(brokerIdeaMetrics(a.tradeIdea,{...q,loss_per_unit_long:100},101).risk).toBeCloseTo(110);
  expect(brokerIdeaMetrics(a.tradeIdea,q,106)).toBeNull();
 });
 it('draws only broker-confirmed fill and never makes up its timestamp',()=>{
  const order={id:'x',status:'unknown',intent:{symbol:'GBPUSD.gbe',direction:'long',stop_loss:9},result:{price:10}};
  expect(confirmedOrderTrade(order,100)).toBeNull();
  order.status='executed';expect(confirmedOrderTrade(order,null)).toBeNull();
  expect(confirmedOrderTrade(order,100)).toMatchObject({entryPrice:10,entryTime:100,instrument:'GBPUSD'});
 });
});
