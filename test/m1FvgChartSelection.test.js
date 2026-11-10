import {expect,it} from 'vitest';
import native from './fixtures/dr128M1FvgSelection.json';
import {createM1FvgChartSelection} from '../src/m1FvgChartSelection.js';
const at=clock=>Date.parse(`2026-11-05T${clock}:00+01:00`)/1000;
it('uses the displayed replay candle close but never later candles for selection',()=>{
  let input={candles:native,bar:'1m',replayUntil:at('20:55'),nowSec:at('21:10'),
    selection:{dealingRangeId:128,instrument:'XAUUSD',direction:'short',variant:'immediate',draftId:1}};
  const picker=createM1FvgChartSelection(()=>input);
  expect(picker.select(at('20:54'),4115)).toMatchObject({status:'ready',entryTime:at('20:56'),entryPrice:4112.90,
    target:{dealingRangeId:128,draftId:1}});
  input={...input,replayUntil:at('20:54')};expect(picker.select(at('20:54'),4115)).toBe(null);
  input={...input,bar:'5m'};expect(picker.select(at('20:54'),4115)).toBe(null);
});
it('does not select without an armed draft or color an unconfirmed FVG',()=>{
  let input={candles:native,bar:'1m',replayUntil:at('20:54'),nowSec:at('21:10'),selection:{direction:'short',variant:'immediate'}};
  const picker=createM1FvgChartSelection(()=>input);
  expect(picker.paint(native,'gold').find(c=>c.time===at('20:54')).color).toBe(undefined);
  input={...input,selection:null};expect(picker.select(at('20:54'),4115)).toBe(null);
  expect(picker.paint(native,'gold')).toBe(native);
});
