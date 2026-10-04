import {it,expect} from 'vitest';
import {createIncrementalOrderBlockDetector} from '../src/orderBlockDetection.js';
import {detectOrderBlocks as before} from './fixtures/orderBlockDetectionBeforePerformanceH.js';

function candles(seed){
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  let price=1.3;
  return Array.from({length:100},(_,i)=>{const open=price;price+=(random()-.5)*.003;
    return {time:100000+i*300,open,close:price,high:Math.max(open,price)+random()*.0003,
      low:Math.min(open,price)-random()*.0003,ignored:random()<.08};});
}
it('matches the frozen detector after each append, correction, truncation and rewind',()=>{
  for(const tf of ['1m','5m','1H',undefined])for(let seed=1;seed<=12;seed++){
    const rows=candles(seed),detect=createIncrementalOrderBlockDetector(tf);
    const snapshots=[];
    for(let end=0;end<=rows.length;end++){
      const prefix=rows.slice(0,end),actual=detect(prefix);
      expect(actual).toEqual(before(prefix,tf));snapshots.push(structuredClone(actual));
      if(end===60){actual[0]&&(actual[0].top=0);expect(detect(prefix)).toEqual(before(prefix,tf));}
    }
    rows[20].high+=.005;rows[21].ignored=!rows[21].ignored;
    for(const prefix of [rows,rows.slice(0,35),rows.slice(10),rows.toReversed(),rows])
      expect(detect(prefix)).toEqual(before(prefix,tf));
    expect(snapshots[80]).toEqual(before(candles(seed).slice(0,80),tf));
  }
});
