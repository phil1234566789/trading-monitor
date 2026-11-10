import {expect,it} from 'vitest';
import native from './fixtures/dr128M1FvgSelection.json';
import {m1FvgEntryCandidates,m1FvgEntryPrefill,matchM1FvgEntryCandidate,m1FvgDraftPrefill} from '../src/m1FvgEntrySelection.js';
import {tintM1FvgCandidates} from '../src/fvgCandleTint.js';
const at=clock=>Date.parse(`2026-11-05T${clock}:00+01:00`)/1000;
const fvg=(rows,clock,direction='short')=>m1FvgEntryCandidates(rows,at('21:10'),direction).find(f=>f.candleTime===at(clock));
const qualified=()=>native.map(c=>c.time===at('20:59')?{...c,high:4115.56}:c);
it('uses the third Bid candle close and its close time for the native DR128 FVG',()=>{
  const selected=fvg(native,'20:54');
  expect(selected).toMatchObject({recognizedAt:at('20:56'),top:4116.05,bottom:4115.07});
  expect(m1FvgEntryPrefill({candles:native,fvg:selected,evaluatedAt:at('20:56')}))
    .toMatchObject({status:'ready',entryTime:at('20:56'),entryPrice:4112.90});
  expect(m1FvgEntryPrefill({candles:native,fvg:selected,evaluatedAt:at('20:55')})).toMatchObject({status:'unknown'});
  expect(m1FvgEntryCandidates(native,at('20:55'),'short').some(f=>f.candleTime===at('20:54'))).toBe(false);
});
it('requires an additional direction candle strictly after the retest and its completed close',()=>{
  // Synthetische Grenzvariante: der echte native Docht erreicht nur 15,31 % (separater Negativtest).
  const rows=qualified(),selected=fvg(rows,'20:54'),input={candles:rows,fvg:selected,variant:'retestReaction'};
  expect(m1FvgEntryPrefill({...input,evaluatedAt:at('21:00')})).toMatchObject({status:'pending'});
  expect(m1FvgEntryPrefill({...input,evaluatedAt:at('21:01')})).toMatchObject({status:'ready',
    retestCandleTime:at('20:59'),confirmationCandleTime:at('21:00'),entryTime:at('21:01'),entryPrice:4112.12});
  const missing=rows.filter(c=>c.time!==at('20:58'));
  expect(m1FvgEntryPrefill({...input,candles:missing,evaluatedAt:at('21:01')})).toMatchObject({status:'unknown'});
});
it('keeps the later 21:00 FVG impulse distinct from its 21:02 confirmation',()=>{
  const selected=fvg(native,'21:00');
  expect(selected).toMatchObject({recognizedAt:at('21:02'),bottom:4112.28,top:4113.18});
  expect(m1FvgEntryPrefill({candles:native,fvg:selected,evaluatedAt:at('21:02')})).toMatchObject({status:'ready',entryTime:at('21:02')});
  expect(m1FvgEntryPrefill({candles:native,fvg:selected,evaluatedAt:at('21:10'),variant:'retestReaction'})).toMatchObject({status:'pending'});
});
it('mirrors the same sequence for Long, never reads a next open or modifies journal data',()=>{
  const rows=qualified().map(c=>({...c,open:9000-c.open,close:9000-c.close,high:9000-c.low,low:9000-c.high}));
  const before=JSON.stringify(rows),selected=fvg(rows,'20:54','long');
  expect(m1FvgEntryPrefill({candles:rows,fvg:selected,evaluatedAt:at('21:01'),variant:'retestReaction'}))
    .toMatchObject({status:'ready',entryTime:at('21:01'),entryPrice:9000-4112.12});
  expect(JSON.stringify(rows)).toBe(before);
  const changed=rows.map(c=>c.time===at('21:01')?{...c,open:1}:c);
  expect(m1FvgEntryPrefill({candles:changed,fvg:selected,evaluatedAt:at('21:01'),variant:'retestReaction'}).entryPrice).toBe(9000-4112.12);
});
it('hits only a rendered impulse candle, and highlights the same candidates without mutation',()=>{
  const candidates=m1FvgEntryCandidates(native,at('20:56'),'short'),selected=fvg(native,'20:54');
  expect(matchM1FvgEntryCandidate(candidates,native,at('20:54'),4115)).toEqual(selected);
  expect(matchM1FvgEntryCandidate(candidates,native,at('20:54'),5000)).toBe(null);
  expect(matchM1FvgEntryCandidate(candidates,native,at('21:00'),4113)).toBe(null);
  const tinted=tintM1FvgCandidates(native,candidates,'1m','#ffd54f');
  expect(tinted.find(c=>c.time===at('20:54')).color).toBe('#ffd54f');
  expect(native.every(c=>c.color===undefined)).toBe(true);
  expect(tintM1FvgCandidates(native,candidates,'5m','#ffd54f')).toBe(native);
});
it('only prefills the still selected DR draft, with no stop or exit fields',()=>{
  const trade={id:151,dealingRangeId:128,instrument:'XAUUSD',direction:'short'};
  const target={...trade,draftToken:4},result={status:'ready',target,entryTime:at('21:01'),entryPrice:4112.12,stopLoss:999,exitPrice:1};
  expect(m1FvgDraftPrefill(result,target,trade,'XAUUSD')).toEqual({entryTime:at('21:01'),entryPrice:4112.12});
  expect(m1FvgDraftPrefill(result,{...target,draftToken:5},trade,'XAUUSD')).toBe(null);
  expect(m1FvgDraftPrefill(result,target,{...trade,dealingRangeId:127},'XAUUSD')).toBe(null);
  expect(m1FvgDraftPrefill(result,target,trade,'GBPUSD')).toBe(null);
  expect(m1FvgDraftPrefill(result,null,trade,'XAUUSD')).toBe(null);
});
