import {describe,it,expect} from 'vitest';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {detectOrderBlocks as previousOrderBlocks} from './fixtures/orderBlockDetectionBeforePerformanceH.js';
import {closedChecklistCandles} from '../src/tradeSetupChecklistTimeBasis.js';
import {evaluateChecklistM5} from '../src/tradeSetupChecklistM5.js';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import {orderBlockMitigationFvg} from '../src/orderBlockMitigation.js';
import {m1ScanPrefix,m1ScanPrefixStart} from '../src/m1ScanPrefix.js';
import {createClosedCandlePrefix} from '../src/closedCandlePrefix.js';

const previousClosed=(rows,duration,at)=>rows.filter(c=>Number.isFinite(c.time)&&c.time+duration<=at).slice().sort((a,b)=>a.time-b.time);
function randomCandles(seed,count){
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  let price=1.3;
  return Array.from({length:count},(_,i)=>{
    const open=price;price+=(random()-.5)*.003;
    return {time:100000+i*300,open,close:price,high:Math.max(open,price)+random()*.0003,
      low:Math.min(open,price)-random()*.0003,ignored:random()<.08};
  });
}
describe('Performance H exact prefix equivalence',()=>{
  it('reuses only identical closed prefixes, including rewind and gaps',()=>{
    const rows=randomCandles(7,80),prefixAt=createClosedCandlePrefix(rows,300);
    for(const at of [100000,100300,100599,101201,120000,105000,105299]){
      expect(prefixAt(at)).toEqual(previousClosed(rows,300,at));
      expect(prefixAt(at+0.01)).toBe(prefixAt(at));
    }
  });
  it('indexed FVG prefilter preserves slices, gaps and ignored candles',()=>{
    for(let seed=1;seed<=12;seed++){
      const rows=randomCandles(seed,100).map((c,i)=>({...c,time:100000+i*60}));
      rows[50].time+=1;
      for(let end=0;end<=rows.length;end++)for(const direction of ['long','short']){
        const anchor=rows[30].time,prefix=m1ScanPrefix(rows,anchor,end);
        expect(orderBlockMitigationFvg(rows,direction,end,m1ScanPrefixStart(rows,anchor)))
          .toEqual(orderBlockMitigationFvg(prefix,direction));
      }
    }
  });
  it('matches frozen OB detection and closed prefixes on growing random histories',()=>{
    for(let seed=1;seed<=12;seed++){
      const rows=randomCandles(seed,100);
      for(let end=0;end<=rows.length;end++){
        const prefix=rows.slice(0,end),at=100000+end*300;
        expect(detectOrderBlocks(prefix,'5m')).toEqual(previousOrderBlocks(prefix,'5m'));
        expect(closedChecklistCandles(prefix,'5m',at)).toEqual(previousClosed(prefix,300,at));
      }
      for(const rowsVariant of [rows.toReversed(),[...rows,{time:NaN}],[...rows,rows[2]]])
        for(const at of [99999,105000,Infinity,NaN])
          expect(closedChecklistCandles(rowsVariant,'5m',at)).toEqual(Number.isFinite(at)?previousClosed(rowsVariant,300,at):[]);
    }
  });
  it('keeps real OB lists and M5 structure nodes deterministic over growing prefixes',()=>{
    const rows=fixture.m5Candles.slice(-180),anchor=rows[10].time;
    for(let end=20;end<=rows.length;end+=10){
      const prefix=rows.slice(0,end),at=prefix.at(-1).time+300;
      expect(detectOrderBlocks(prefix,'5m')).toEqual(previousOrderBlocks(prefix,'5m'));
      const input={instrument:'GBPUSD',direction:'short',evaluatedAt:at};
      const old=evaluateChecklistM5({...input,m5Candles:previousClosed(prefix,300,at)},{},anchor);
      const current=evaluateChecklistM5({...input,m5Candles:closedChecklistCandles(prefix,'5m',at)},{},anchor);
      expect(current).toEqual(old);
    }
  });
});
