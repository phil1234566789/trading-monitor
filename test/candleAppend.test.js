import {it,expect} from 'vitest';
import {isCandleAppend} from '../src/candleAppend.js';

it('recognizes append and every in-place candle correction from an independent snapshot',()=>{
  const candle={time:100000,open:1.3,high:1.31,low:1.29,close:1.305,ignored:false};
  const previous=[{...candle}],next=[candle,{...candle,time:100300}];
  expect(isCandleAppend(previous,next)).toBe(true);
  expect(isCandleAppend(next,previous)).toBe(false);
  for(const field of ['time','open','high','low','close','ignored']){
    const corrected=[{...candle,[field]:field==='ignored'?true:candle[field]+1}];
    expect(isCandleAppend(previous,corrected)).toBe(false);
    expect(isCandleAppend(previous,[{...candle}])).toBe(true);
  }
});
