import {createSharedOrderBlockDetector} from '../src/sharedOrderBlocks.js';
import {it,expect} from 'vitest';
import {createIncrementalOrderBlockDetector} from '../src/incrementalOrderBlocks.js';
import {detectOrderBlocks as before} from './fixtures/orderBlockDetectionBeforePerformanceH.js';

function rows(seed){
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  let price=1.3;
  return Array.from({length:100},(_,i)=>{const open=price;price+=(random()-.5)*.003;
    return {time:100000+i*300,open,close:price,high:Math.max(open,price)+random()*.0003,
      low:Math.min(open,price)-random()*.0003,ignored:random()<.08};});
}
// ZunÃ¤chst gegen die unverÃ¤nderte Einzel-Implementierung; dieselbe Spezifikation gilt fÃ¼rs Teilen.
export function sharedDetectorCases(create){
  for(const tf of ['5m','1H'])for(let seed=1;seed<=8;seed++){
    const candles=rows(seed),detect=create(tf),saved=[];
    for(const end of [0,4,25,25,60,25,61,60,80,20,100,80]){
      const prefix=candles.slice(0,end),actual=detect(prefix);
      expect(actual).toEqual(before(prefix,tf));saved.push([prefix.map(c=>({...c})),structuredClone(actual)]);
      if(actual[0])actual[0].top=-1;
      expect(detect(prefix)).toEqual(before(prefix,tf));
    }
    candles[20].high+=.005; candles[21].ignored=!candles[21].ignored;
    for(const prefix of [candles,candles.slice(0,25),candles.slice(10),candles.toReversed(),candles])
      expect(detect(prefix)).toEqual(before(prefix,tf));
    for(const [prefix,actual] of saved)expect(actual).toEqual(before(prefix,tf));
  }
}
it('preserves independent callers, earlier snapshots, ignored bars and in-place corrections',()=>sharedDetectorCases(createIncrementalOrderBlockDetector));

it('shares the detector without changing any interleaved result',()=>sharedDetectorCases(createSharedOrderBlockDetector));
