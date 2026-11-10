import {expect,it} from 'vitest';
import native from './fixtures/xau27OctM1FvgSelection.json';
import {m1FvgEntryCandidates,m1FvgEntryPrefill} from '../src/m1FvgEntrySelection.js';
import {tintManualFvgConfirmation,tintM1FvgCandidates} from '../src/fvgCandleTint.js';
const at=clock=>Date.parse(`2026-10-27T${clock}:00+01:00`)/1000;
const selected=(rows=native)=>m1FvgEntryCandidates(rows,at('08:35'),'short').find(f=>f.candleTime===at('08:25'));
it('derives the native associated OB and accepts full fill plus same-candle OB retest before a later confirmation',()=>{
 const fvg=selected();
 expect(fvg).toMatchObject({bottom:4005.74,top:4006.18,recognizedAt:at('08:27'),orderBlock:{bottom:4006.18,top:4007.79,startTime:at('08:25')}});
 expect(m1FvgEntryPrefill({candles:native,fvg,evaluatedAt:at('08:34'),variant:'retestReaction'}).status).toBe('pending');
 expect(m1FvgEntryPrefill({candles:native,fvg,evaluatedAt:at('08:35'),variant:'retestReaction'}))
  .toMatchObject({status:'ready',retestCandleTime:at('08:33'),confirmationCandleTime:at('08:34'),entryTime:at('08:35'),entryPrice:4004.83});
});
it('does not invent an OB from only three FVG candles or a gap/ignored formation',()=>{
 for(const rows of [native.filter(c=>c.time>=at('08:24')),native.filter(c=>c.time!==at('08:23')),native.map(c=>c.time===at('08:23')?{...c,ignored:true}:c)]){
  const fvg=selected(rows);expect(fvg.orderBlock).toBeNull();
  expect(m1FvgEntryPrefill({candles:rows,fvg,evaluatedAt:at('08:35'),variant:'retestReaction'}).status).not.toBe('ready');
  expect(m1FvgEntryPrefill({candles:rows,fvg,evaluatedAt:at('08:27')})).toMatchObject({status:'ready',entryTime:at('08:27')});
 }
});
it('keeps gold impulse bodies and marks coincident confirmation with the current positions color without mutation',()=>{
 const rows=[{time:60,open:1,high:3,low:0,close:2},{time:120,open:2,high:3,low:0,close:1}];
 const preview={status:'ready',confirmationCandleTime:60};
 const gold=tintM1FvgCandidates(rows,[{candleTime:60}],'1m','gold');
 expect(tintManualFvgConfirmation(gold,preview,'1m','pink')[0]).toMatchObject({color:'gold',wickColor:'gold',borderColor:'pink'});
 expect(tintManualFvgConfirmation(rows,preview,'1m','changed')[0]).toMatchObject({color:'changed',borderColor:'changed'});
 expect(tintManualFvgConfirmation(rows,null,'1m','pink')).toBe(rows);
 expect(tintManualFvgConfirmation(rows,preview,'5m','pink')).toBe(rows);
 expect(rows[0].color).toBeUndefined();
});
