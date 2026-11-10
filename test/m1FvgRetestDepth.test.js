import {expect,it} from 'vitest';
import native from './fixtures/dr128M1FvgSelection.json';
import {m1FvgEntryCandidates,m1FvgEntryPrefill} from '../src/m1FvgEntrySelection.js';
const candle=(time,open,high,low,close)=>({time,open,high,low,close});
const base=depth=>[candle(0,111,112,110,111),candle(60,111,111.2,100,101),candle(120,101,102,99,100),
  candle(180,101,102+8*depth,100,101),candle(240,101,101,98,99)];
const mirror=rows=>rows.map(c=>({...c,open:240-c.open,close:240-c.close,high:240-c.low,low:240-c.high}));
it.each([0,.4999,.5,1,1.1])('requires at least 50 percent wick penetration, depth=%s, in both directions',depth=>{
  for(const direction of ['short','long']){
    const rows=direction==='short'?base(depth):mirror(base(depth));
    const fvg=m1FvgEntryCandidates(rows,180,direction)[0];
    const result=m1FvgEntryPrefill({candles:rows,fvg,evaluatedAt:300,variant:'retestReaction'});
    expect(result.status).toBe(depth>=.5?'ready':'pending');
    if(depth>=.5)expect(result).toMatchObject({retestCandleTime:180,confirmationCandleTime:240,entryTime:300});
  }
});
it('does not freeze a shallow first touch; waits for a later qualifying retest and another candle',()=>{
  const rows=base(.1);rows[4]=candle(240,101,106,100,101);rows.push(candle(300,101,101,98,99));
  const fvg=m1FvgEntryCandidates(rows,180,'short')[0];
  expect(m1FvgEntryPrefill({candles:rows,fvg,evaluatedAt:300,variant:'retestReaction'}).status).toBe('pending');
  expect(m1FvgEntryPrefill({candles:rows,fvg,evaluatedAt:360,variant:'retestReaction'}))
    .toMatchObject({status:'ready',retestCandleTime:240,entryTime:360});
});
it('keeps the native DR128 shallow 20:59 retest pending through the frozen 21:10 window',()=>{
  const at=clock=>Date.parse(`2026-11-05T${clock}:00+01:00`)/1000;
  const fvg=m1FvgEntryCandidates(native,at('21:10'),'short').find(f=>f.candleTime===at('20:54'));
  expect((4115.22-fvg.bottom)/(fvg.top-fvg.bottom)).toBeCloseTo(.15306122449,9);
  expect(m1FvgEntryPrefill({candles:native,fvg,evaluatedAt:at('21:11'),variant:'retestReaction'}).status).toBe('pending');
  expect(m1FvgEntryPrefill({candles:native,fvg,evaluatedAt:at('20:56')})).toMatchObject({entryTime:at('20:56'),entryPrice:4112.90});
});
