import {expect,it} from 'vitest';
import {orderBlockRetestHoldHistory,orderBlockRetestHoldAt} from '../src/orderBlockRetestHold.js';

const candle=(time,low=10,high=10)=>({time,low,high,open:10,close:10});
const history=(candles,direction='long',evaluatedAt=240)=>orderBlockRetestHoldHistory({candles,direction,anchorPrice:10,fromTime:60,evaluatedAt});
it.each(['long','short'])('preserves exact equality and rejects a strict %s sweep only when its candle closes',direction=>{
 const rows=[candle(60),candle(120),direction==='long'?candle(180,9.99):candle(180,10,10.01)];
 const evidence=history(rows,direction);
 expect(orderBlockRetestHoldAt(evidence,180).status).toBe('passed');
 expect(orderBlockRetestHoldAt(evidence,239).status).toBe('passed');
 expect(orderBlockRetestHoldAt(evidence,240)).toMatchObject({status:'failed',firstSweepTime:180,firstSweepKnownAt:240});
 expect(orderBlockRetestHoldAt(history(rows.slice(0,2),direction,180),180).status).toBe('passed');
});
it('does not treat a later missing or ignored minute as known before that minute would close',()=>{
 for(const rows of [[candle(60),candle(180)],[candle(60),{...candle(120),ignored:true},candle(180)]]){
  const evidence=history(rows);
  expect(orderBlockRetestHoldAt(evidence,120).status).toBe('passed');
  expect(orderBlockRetestHoldAt(evidence,180).status).toBe('unknown');
  expect(orderBlockRetestHoldAt(evidence,240).status).toBe('unknown');
 }
});
it('requires the initial minute and complete trailing coverage',()=>{
 expect(orderBlockRetestHoldAt(history([candle(120),candle(180)]),240).status).toBe('unknown');
 expect(orderBlockRetestHoldAt(history([candle(60),candle(120)]),240).status).toBe('unknown');
});
it('does not let a later gap undo an already observed strict sweep',()=>{
 expect(orderBlockRetestHoldAt(history([candle(60,9.99),candle(180)]),240)).toMatchObject({status:'failed',firstSweepTime:60});
});
it('does not include earlier candles or an unclosed future sweep',()=>{
 const evidence=history([candle(0,9),candle(60),candle(120),candle(180,9)],'long',239);
 expect(orderBlockRetestHoldAt(evidence,239).status).toBe('passed');
});
