import {describe,it,expect} from 'vitest';
import {makeTradeIdea,editTradeIdea} from '../src/tradeIdeas.js';

describe('editing existing chart ideas',()=>{
 const annotation=makeTradeIdea('long',{time:100,price:10},{time:160,price:9},{time:220,price:12}).annotations[0];
 it('updates individual levels and keeps annotation coordinates consistent',()=>{
  expect(editTradeIdea(annotation,'sl',{price:8,time:180})).toMatchObject({to:{price:8},tradeIdea:{entry:10,sl:8,tp:12}});
  expect(editTradeIdea(annotation,'entry',{price:11,time:140})).toMatchObject({from:{price:11},tradeIdea:{time:140,entry:11,sl:9,tp:12}});
  expect(editTradeIdea(annotation,'tp',{price:13,time:300}).tradeIdea).toMatchObject({tp:13,endTime:300});
  expect(annotation.tradeIdea.sl).toBe(9);
 });
 it('rejects crossed stops, targets and inverted time ranges',()=>{
  expect(editTradeIdea(annotation,'sl',{price:11,time:180})).toBeNull();
  expect(editTradeIdea(annotation,'tp',{price:8,time:180})).toBeNull();
  expect(editTradeIdea(annotation,'entry',{price:10,time:250})).toBeNull();
  const short=makeTradeIdea('short',{time:100,price:10},{time:160,price:11},null).annotations[0];
  expect(editTradeIdea(short,'sl',{price:12,time:160}).tradeIdea.sl).toBe(12);
  expect(editTradeIdea(short,'sl',{price:9,time:160})).toBeNull();
 });
});
